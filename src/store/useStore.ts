/**
 * One store, one copy of the truth (PLAN.md Task 1).
 *
 * The hook it replaces, `useAppData`, gave every caller its own `useState`
 * snapshot of `localStorage`, which is why Clear-all-data could not reach
 * onboarding: `App` still held the old data. So: module-level state, a
 * subscriber set, and `useSyncExternalStore`. Every mounted component reads the
 * same object and is notified by the same publish.
 *
 * How a change moves (the design the data review asked for):
 *
 * - **Committed, and pending.** `committed` is what is stored, as far as this
 *   copy knows. Each action is a *mutation*: a pure plan from a snapshot to a
 *   change. What screens see is `committed` with every pending mutation applied
 *   in order. A mutation is planned once against the exact snapshot in front
 *   of it and that plan is reused for as long as that snapshot stays the same
 *   object. It is planned again only when its base changes underneath it — an
 *   earlier mutation failed, another copy of the app wrote — so a failure is
 *   never resurrected by its successor (F03), a pending change is never
 *   overwritten by an older one (F02), and an updater is not re-run for no
 *   reason.
 * - **Shown at once, stored in order.** The view is published the moment a
 *   mutation is made, because screens write and navigate in the same tick: the
 *   check-in flow saves and opens `/session`, which builds its plan from this
 *   data. A commit that goes as planned leaves the view *the same object*,
 *   slice for slice, so nothing rebuilt from it is rebuilt again.
 * - **One transaction per mutation, planned against what is stored.** See
 *   `snapshot.ts`: atomic across stores, and re-planned inside the transaction
 *   if another copy has written (F04, F13).
 * - **Every result is a result.** Actions resolve to a `StoreResult` and never
 *   reject; a failure also lands on `state.failure` for the screen (D16, F25).
 */

import { useSyncExternalStore } from 'react';
import { CURRENT_VERSION, migrateData, resetData } from '@/services/storage';
import type { AppData, BodyMetric, PersonalRecord, UserSettings, WorkoutSession } from '@/types';
import type { CheckInRecord } from '@/types/checkin';
import type { DayFocus } from '@/types/plan';
import type { UserProfile } from '@/types/profile';
import {
  atOnDay,
  bpContext,
  bpReadingId,
  canonicalUnit,
  compareStatements,
  dayOf,
  isDay,
  newObservation,
  nowAt,
  reviseObservation,
  type Observation,
  type ObservationInput,
  type ObservationKind,
  type ObservationSource,
  type ObservationTag,
} from '@/health/observation';
import { pairBloodPressure, type BpReading } from '@/health/aggregate';
import { StoreFailure, openDb, requestPersistence, toFailure, type Db, type Doc, type FailureDetail, type StoreResult } from './db';
import { SCHEMA_VERSION, legacySnapshot, migrateToV5, readLegacy, type MigrationReport } from './migrate';
import { liftBodyMetric, liftCheckIn, liftSessionPain } from './project';
import { commitChange, emptySnapshot, prepare, readSnapshot, type Change, type Prepared, type Snapshot } from './snapshot';
import {
  encode,
  planImport,
  previewImport,
  sameValue,
  toTransferDoc,
  type EncodedTransfer,
  type ImportMode,
  type ImportOptions,
  type ImportPreview,
  type ImportProblem,
  type ImportReport,
} from './transfer';

export interface StoreState {
  status: 'loading' | 'ready' | 'unavailable';
  /** Chronological, oldest first. */
  observations: Observation[];
  /** Newest first, as the old storage layer ordered them. */
  sessions: WorkoutSession[];
  settings: UserSettings;
  profile?: UserProfile;
  checkIns: CheckInRecord[];
  personalRecords: PersonalRecord[];
  bodyMetrics: BodyMetric[];
  /** Workouts swapped in by date (YYYY-MM-DD); no key means the scheduled focus. */
  focusOverrides: Record<string, DayFocus>;
  /** The `content-state` store: per-article reading state and the like. */
  contentState: Readonly<Record<string, unknown>>;
  /**
   * Why nothing is being saved, while `unavailable`; otherwise the most recent
   * write that failed, cleared by the next one that works.
   */
  failure?: StoreFailure;
  /** What the v4 → v5 migration did on this device. */
  migration?: MigrationReport;
  /** Whether the browser granted storage that survives eviction (D16). */
  persisted: boolean;
  /** Changes are on screen but not yet confirmed stored. A "Saving…" indicator waits on this. */
  saving: boolean;
  /** Running as an installed web app; `undefined` when the browser cannot say. */
  installed?: boolean;
  /**
   * The revision of what is stored, as far as this copy knows. It moves with
   * every commit of anything — a reading, a backdated session, a profile or
   * settings edit — and is the same number in every open copy once each has
   * caught up. Changes still on their way are not counted until stored.
   * Revisions belong to one database: compare them only with revisions from
   * this device.
   */
  revision: number;
}

// ============================================================================
// Module state
// ============================================================================

type Listener = () => void;
const listeners = new Set<Listener>();

/** Whatever was thrown, made into a `StoreFailure`, with `invalid` for refusals. */
const failed = (error: unknown) => toFailure(error);

let defaultSettings: UserSettings | undefined;
/**
 * Defaults come from the tested v4 migration rather than a second copy of the
 * same twenty fields, so they cannot drift from `services/storage`.
 */
function defaults(): UserSettings {
  defaultSettings ??= migrateData({ version: CURRENT_VERSION } as AppData).settings;
  return defaultSettings;
}

let filledFrom: UserSettings | undefined | null = null;
let filled: UserSettings = defaults();
/** Stored settings with defaults filled, keeping identity while the stored value does. */
function settingsOf(stored: UserSettings | undefined): UserSettings {
  if (stored !== filledFrom) {
    filledFrom = stored;
    filled = { ...defaults(), ...stored };
  }
  return filled;
}

let db: Db | undefined;
/** What is stored, as far as this copy knows — or, while nothing can be saved, what this session holds. */
let committed: Snapshot = emptySnapshot();
/** The last snapshot known to be on disk. `undefined` until a database has been read. */
let durable: Snapshot | undefined;
/** `committed` with every pending mutation applied: what screens see. */
let view: Snapshot = committed;
let mode: 'loading' | 'ready' | 'memory' = 'loading';
/** Why nothing is being saved, in memory mode. */
let memoryReason: StoreFailure | undefined;
/** Memory mode was seeded with something to show; a failed retry must not replace it. */
let memorySeeded = false;
let lastFailure: StoreFailure | undefined;
let migration: MigrationReport | undefined;
let persisted = false;
let installed: boolean | undefined;
let booted: Promise<void> | undefined;
let channel: BroadcastLike | undefined;
let detachVisibility: (() => void) | undefined;
/** Bumped by `resetForTests`, so a commit still in flight from an earlier test cannot touch the next one. */
let generation = 0;

interface Planned<T> {
  /** `null`: nothing to do, and nothing is written. */
  change: Change | null;
  result: (next: Snapshot) => T;
}

interface Mutation<T> {
  plan: (base: Snapshot) => Planned<T>;
  /** The plan for one exact base, and what it does to it. */
  cached?: { on: Snapshot; planned: Planned<T>; prepared: Prepared };
  /** The last attempt to plan against the current base threw. */
  planFailure?: StoreFailure;
  settle: (result: StoreResult<T>) => void;
  /** After the change is applied: may turn success into a reported partial failure. */
  after?: () => StoreResult<T> | undefined;
  /**
   * Not shown until it is stored. Clear-all: an empty record on screen, even
   * for a moment, sends the app to Welcome, and a clear that then fails would
   * leave the person somewhere they never asked to go (J18).
   */
  hold?: boolean;
  /** The payload came from `JSON.parse` and is already plain data. */
  plain?: boolean;
}

type Job =
  | { kind: 'mutation'; m: Mutation<unknown> }
  | { kind: 'task'; run: () => Promise<void> };

const jobs: Job[] = [];
let pumping = false;

function toState(s: Snapshot): StoreState {
  return {
    status: mode === 'ready' ? 'ready' : mode === 'memory' ? 'unavailable' : 'loading',
    observations: s.observations,
    sessions: s.sessions,
    settings: settingsOf(s.settings),
    profile: s.profile,
    checkIns: s.checkIns,
    personalRecords: s.personalRecords,
    bodyMetrics: s.bodyMetrics,
    focusOverrides: s.focusOverrides,
    contentState: s.content,
    failure: mode === 'memory' ? memoryReason : lastFailure,
    migration,
    persisted,
    saving: jobs.some(j => j.kind === 'mutation'),
    installed,
    revision: committed.revision,
  };
}

let state: StoreState = toState(view);

function publish(): void {
  state = toState(view);
  // Copy the set: a listener may unsubscribe while being notified.
  for (const listener of [...listeners]) listener();
}

export function getState(): StoreState {
  return state;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

// ============================================================================
// Planning, the view, and the commit queue
// ============================================================================

/**
 * Plan a mutation against one exact base, or reuse the plan already made for
 * it. A change that cannot be stored — a Proxy, a function, a class with
 * getters — is refused here, before it is ever shown (F25): structured cloning
 * is what IndexedDB will do with it, so the clone is what is kept.
 */
function planOn<T>(m: Mutation<T>, base: Snapshot): { planned: Planned<T>; prepared: Prepared } {
  if (m.cached && m.cached.on === base) return m.cached;
  const planned = m.plan(base);
  const change = planned.change === null ? null : m.plain ? planned.change : structuredClone(planned.change);
  const prepared: Prepared = change === null ? { next: base, writes: [] } : prepare(base, change);
  m.cached = { on: base, planned: { ...planned, change }, prepared };
  m.planFailure = undefined;
  return m.cached;
}

/** The view: committed, with each pending mutation's cached plan applied in order. */
function recompute(): void {
  let base = committed;
  for (const job of jobs) {
    if (job.kind !== 'mutation') continue;
    const m = job.m;
    try {
      const planned = planOn(m, base).prepared.next;
      if (!m.hold) base = planned;
    } catch (error) {
      // It cannot be made against what is now in front of it; it will fail
      // when its turn comes, and shows nothing until then.
      m.planFailure = failed(error);
      m.cached = undefined;
    }
  }
  view = base;
}

/** A failure the screen should hear about, outside memory mode. */
function note(failure: StoreFailure): void {
  if (mode !== 'memory') lastFailure = failure;
  publish();
}

function enqueue<T>(m: Omit<Mutation<T>, 'settle'>): Promise<StoreResult<T>> {
  return new Promise<StoreResult<T>>(resolve => {
    const mutation = { ...m, settle: resolve } as Mutation<T>;
    try {
      // Planned now, against what the user is looking at.
      const { planned } = planOn(mutation, view);
      // Nothing to write is done at once only when what is on screen is what
      // is stored. Behind a write still waiting, "nothing to write" may only
      // mean that write is shown; if it is then refused, this one would have
      // been called saved when it was not (M-06). So it waits its turn and is
      // planned again against what was stored: done if that landed, written
      // itself if it did not.
      if (planned.change === null && jobs.length === 0 && view === durable) {
        resolve({ ok: true, value: planned.result(view) });
        return;
      }
    } catch (error) {
      const failure = failed(error);
      note(failure);
      resolve({ ok: false, failure });
      return;
    }
    jobs.push({ kind: 'mutation', m: mutation as Mutation<unknown> });
    if (!mutation.hold) view = mutation.cached!.prepared.next;
    publish();
    void pump();
  });
}

/** Work that must wait its turn behind the mutations already made (an export, a reload). */
function enqueueTask<T>(run: () => Promise<T>): Promise<T> {
  return new Promise<T>(resolve => {
    jobs.push({ kind: 'task', run: async () => { resolve(await run()); } });
    void pump();
  });
}

async function pump(): Promise<void> {
  if (pumping) return;
  pumping = true;
  const mine = generation;
  try {
    while (jobs.length > 0 && mine === generation) {
      const job = jobs[0];
      if (job.kind === 'task') {
        await job.run();
        if (mine !== generation) return;
        jobs.shift();
        continue;
      }
      const result = await commit(job.m);
      if (mine !== generation) return;
      jobs.shift();
      recompute();
      publish();
      job.m.settle(result);
    }
  } finally {
    if (mine === generation) pumping = false;
  }
}

function unavailableFailure(): StoreFailure {
  return memoryReason ?? new StoreFailure('unavailable', 'The app is not storing data on this device yet. Nothing was saved.');
}

async function commit<T>(m: Mutation<T>): Promise<StoreResult<T>> {
  const handle = db;
  if (!handle) {
    // Nowhere to write. The change is kept for this session only — the app
    // still works, it just cannot remember — and the result says it was not
    // saved (F09). Nothing writes it later: the screens say so, and starting
    // again reloads the page (C2-10).
    let planned: { planned: Planned<T>; prepared: Prepared };
    try {
      planned = planOn(m, committed);
    } catch (error) {
      return { ok: false, failure: m.planFailure ?? failed(error) };
    }
    committed = planned.prepared.next;
    // Its tidying up is for a change that was stored, and this one was not (C2-08).
    return { ok: false, failure: unavailableFailure() };
  }

  const outcome = await commitChange(handle, committed, (base, refreshed) => {
    if (!refreshed && m.cached && m.cached.on === base) {
      return m.cached.planned.change === null ? null : { change: m.cached.planned.change, prepared: m.cached.prepared };
    }
    const fresh = planOn(m, base);
    return fresh.planned.change === null ? null : { change: fresh.planned.change, prepared: fresh.prepared };
  });

  if (!outcome.ok) {
    // What the failed transaction saw is still what is stored: adopt it, so a
    // copy that was stale stops being stale. The theme flag follows what is
    // stored, which a failure did not change.
    if (outcome.refreshed) committed = durable = outcome.refreshed;
    mirror(committed);
    lastFailure = outcome.failure;
    return { ok: false, failure: m.planFailure ?? outcome.failure };
  }

  committed = durable = outcome.value.next;
  lastFailure = undefined;
  mirror(committed);
  channel?.postMessage({ revision: committed.revision });
  const value = m.cached!.planned.result(committed);
  const after = m.after?.();
  if (after) {
    if (!after.ok) lastFailure = after.failure;
    return after;
  }
  return { ok: true, value };
}

// ============================================================================
// Starting, retrying, and other open copies
// ============================================================================

/** The part of `BroadcastChannel` used here, so tests can hand in their own. */
export interface BroadcastLike {
  postMessage(message: unknown): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  close(): void;
}

export interface StartOptions {
  /** Injected in tests; the app uses the browser's. */
  factory?: IDBFactory;
  navigator?: Navigator;
  /**
   * Tells other open copies when this one writes, so they refresh rather
   * than show stale data. `null` for none; defaults to the browser's
   * `BroadcastChannel` where there is one. Correctness never rests on it —
   * the revision check in every commit does — it only keeps screens fresh.
   */
  broadcast?: ((name: string) => BroadcastLike) | null;
  /** Whether the app runs installed; detected from the browser when absent. */
  installed?: boolean;
}

const CHANNEL = 'fit-strong-store';

function detectInstalled(): boolean | undefined {
  try {
    const nav = globalThis.navigator as (Navigator & { standalone?: unknown }) | undefined;
    if (nav && typeof nav.standalone === 'boolean') return nav.standalone;
    if (typeof globalThis.matchMedia === 'function') return globalThis.matchMedia('(display-mode: standalone)').matches;
  } catch {
    // Not knowing is an answer: `undefined`.
  }
  return undefined;
}

/**
 * Open the database, move v4 data across, and publish what is on the device.
 * Safe to call from several components: the first call does the work.
 */
export function start(options: StartOptions = {}): Promise<void> {
  booted ??= boot(options);
  return booted;
}

/** The theme from the first-paint flag, for a session that has nothing else to show. */
function seed(base: Snapshot | undefined): Snapshot {
  if (base) return base;
  const theme = readStoredTheme();
  return theme ? { ...emptySnapshot(), settings: { theme } as UserSettings } : emptySnapshot();
}

/**
 * Stop saving, and say why. `base` is what to show when nothing has been
 * loaded yet — the old v4 record, say; `'keep'` keeps what is on screen, for
 * a store that was working until now.
 */
function enterMemory(reason: StoreFailure, base?: Snapshot | 'keep'): void {
  mode = 'memory';
  memoryReason = reason;
  db = undefined;
  if (base === 'keep') {
    memorySeeded = true;
  } else if (!memorySeeded) {
    committed = seed(base);
    memorySeeded = true;
  }
  recompute();
  publish();
}

async function boot(options: StartOptions): Promise<void> {
  installed = options.installed ?? detectInstalled();
  const mine = generation;
  let handle: Db;
  try {
    handle = await openDb('factory' in options ? options.factory : globalThis.indexedDB, {
      onBlocked: () => {
        if (mine === generation) enterMemory(new StoreFailure('blocked', 'Another tab or window of this app is open and holding its data.'));
      },
      onVersionChange: () => { if (mine === generation) leave(); },
    });
  } catch (error) {
    // Nothing is known about what the database holds, so nothing from the
    // old v4 copy is shown either: on a device that has already moved, that
    // copy is an old backup and would look like the current record.
    if (mine === generation) enterMemory(toFailure(error, 'unavailable'));
    return;
  }
  if (mine !== generation) { handle.close(); return; }

  // Asked alongside, never waited on: a browser that puts the question to
  // the person would keep the record off screen until it was answered
  // (C2-09). The answer is shown when it comes.
  void requestPersistence(options.navigator).then(kept => {
    if (mine !== generation || kept === persisted) return;
    persisted = kept;
    publish();
  });
  const migrated = await migrateToV5(handle);
  if (mine !== generation) { handle.close(); return; }
  if (!migrated.ok) {
    // The record has not finished moving. Nothing new is saved over it —
    // the next start would move the old copy over anything saved now (F05) —
    // but what it holds is shown, so the owner still sees their history.
    // Only when the move itself failed: if even the marker could not be
    // read, whether this device has moved is unknown.
    handle.close();
    const legacy = migrated.failure.code === 'readFailed' ? undefined : readLegacy();
    enterMemory(migrated.failure, legacy?.ok ? legacySnapshot(legacy.raw) : undefined);
    return;
  }

  let snap: Snapshot;
  try {
    snap = await readSnapshot(handle);
  } catch (error) {
    handle.close();
    if (mine === generation) enterMemory(toFailure(error, 'readFailed'));
    return;
  }
  if (mine !== generation) { handle.close(); return; }

  db = handle;
  migration = migrated.value;
  committed = durable = snap;
  mode = 'ready';
  memoryReason = undefined;
  lastFailure = undefined;
  mirror(snap);
  coordinate(options);
  recompute();
  publish();
}

/**
 * Another copy wants to upgrade the database (a new version of the app, in
 * another tab). This connection is closed so that upgrade is not blocked; a
 * commit already under way finishes, and everything after it is kept in
 * memory and reported, until this page is reloaded.
 */
function leave(): void {
  const handle = db;
  db = undefined;
  handle?.close();
  // Everything already stored stays on screen; only new changes go unsaved.
  enterMemory(new StoreFailure('stale', 'The app was updated in another tab or window.'), 'keep');
}

function coordinate(options: StartOptions): void {
  channel?.close();
  detachVisibility?.();
  const make = options.broadcast === null
    ? undefined
    : options.broadcast ?? (typeof window !== 'undefined' && typeof BroadcastChannel === 'function'
      ? (name: string) => new BroadcastChannel(name) as unknown as BroadcastLike
      : undefined);
  channel = make?.(CHANNEL);
  if (channel) {
    channel.onmessage = event => {
      const revision = Number((event?.data as { revision?: unknown } | undefined)?.revision);
      if (Number.isFinite(revision) && revision !== committed.revision) void checkOutside();
    };
  }
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    // A copy left in the background may have missed the message.
    const onVisible = () => { if (document.visibilityState === 'visible') void checkOutside(); };
    document.addEventListener('visibilitychange', onVisible);
    detachVisibility = () => document.removeEventListener('visibilitychange', onVisible);
  }
}

/** Another copy may have written: if the revision moved, take what is stored. */
function checkOutside(): Promise<void> {
  return enqueueTask(async () => {
    const handle = db;
    if (!handle) return;
    try {
      const row = await handle.get<Doc>('settings', 'revision');
      if (Number(row?.value ?? 0) === committed.revision) return;
      adopt(await readSnapshot(handle));
    } catch {
      // A background check that fails changes nothing.
    }
  });
}

function adopt(snap: Snapshot): void {
  if (snap.revision !== committed.revision || durable === undefined) {
    committed = durable = snap;
    mirror(snap);
  }
  recompute();
  publish();
}

/** Tests only: drop the connection and the state between cases. */
export function resetForTests(): void {
  generation += 1;
  db?.close();
  db = undefined;
  channel?.close();
  channel = undefined;
  detachVisibility?.();
  detachVisibility = undefined;
  booted = undefined;
  jobs.length = 0;
  pumping = false;
  committed = emptySnapshot();
  durable = undefined;
  view = committed;
  mode = 'loading';
  memoryReason = undefined;
  memorySeeded = false;
  lastFailure = undefined;
  migration = undefined;
  persisted = false;
  installed = undefined;
  listeners.clear();
  state = toState(view);
}

// ============================================================================
// The theme, which has to be readable before IndexedDB is (D13)
// ============================================================================

export type Theme = UserSettings['theme'];

/** The one preference `localStorage` still holds: a raw `'light' | 'dark' | 'system'` string. */
export const THEME_KEY = 'fit-strong-90-theme';

/**
 * The theme, synchronously.
 *
 * IndexedDB cannot be read before the first frame, so a theme that lived only
 * in the store would paint light and then flip to dark on every launch. D13
 * keeps `localStorage` for exactly this. The flag is a copy of the theme that
 * is *stored*: written after a commit that changes it and on every start, and
 * never ahead of one, so a theme whose save failed is not the next launch's
 * first frame (F28).
 */
export function readStoredTheme(): Theme | undefined {
  try {
    if (typeof localStorage === 'undefined') return undefined;
    const raw = localStorage.getItem(THEME_KEY);
    return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : undefined;
  } catch {
    return undefined;
  }
}

export function writeStoredTheme(theme: Theme): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(THEME_KEY, theme);
  } catch {
    // A blocked or full `localStorage` must not stop the app; the theme simply
    // costs a frame on the next launch.
  }
}

function mirror(s: Snapshot): void {
  const theme = settingsOf(s.settings).theme;
  if (readStoredTheme() !== theme) writeStoredTheme(theme);
}

/**
 * The theme to paint: the first-paint flag until the store has loaded, then
 * the store's — including a choice made while nothing can be saved, which
 * holds for this session.
 */
export function displayTheme(current: StoreState, atBoot: Theme): Theme {
  return current.status === 'loading' ? atBoot : current.settings.theme;
}

// ============================================================================
// Observations
// ============================================================================

let lastId = 0;
let withinId = 0;

/** An id made once, at the call, so a re-planned mutation keeps the id it was shown with. */
function freshId(prefix = ''): string {
  const now = Date.now();
  if (now === lastId) withinId += 1;
  else { lastId = now; withinId = 0; }
  const noise = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${prefix}${now.toString(36).padStart(9, '0')}-${withinId.toString(36).padStart(4, '0')}-${noise}`;
}

const findObservation = (s: Snapshot, id: string) => s.observations.find(o => o.id === id);

/**
 * Record a measurement. An id already in use is refused, on disk and on
 * screen alike — one id is one record (F23); correcting a record is
 * `editObservation`.
 */
export function addObservation(input: ObservationInput): Promise<StoreResult<Observation>> {
  // Made once, so a re-plan cannot give the record a second identity.
  const fixed: ObservationInput = { ...input, id: input.id ?? freshId(), at: input.at ?? nowAt() };
  return enqueue<Observation>({
    plan: base => {
      const record = newObservation(fixed);
      if (findObservation(base, record.id)) {
        throw new StoreFailure('conflict', 'A record with that id is already on this device. Correct it rather than adding it again.');
      }
      return { change: { observations: { put: [record] } }, result: next => findObservation(next, record.id)! };
    },
  });
}

/** "Record 2 (walkDistance): …; record 4: …" — which items, by their position in the batch. */
function describeRefusals(details: readonly FailureDetail[], inputs: readonly ObservationInput[]): string {
  return details.map(d => `record ${d.index + 1}${inputs[d.index]?.kind ? ` (${inputs[d.index].kind})` : ''}: ${d.reason}`).join('; ');
}

/**
 * Record several measurements as one: a walk is a duration, a movement
 * interval, a distance and a step count, and saving them one at a time
 * leaves a walk with half its numbers when a later write fails or the page
 * reloads in between. All or nothing, in one transaction.
 *
 * The whole batch is refused — nothing shown, nothing written — if any record
 * is invalid or uses an id already stored or repeated in the batch; the
 * failure's `details` say which, by position.
 */
export function addObservations(inputs: readonly ObservationInput[]): Promise<StoreResult<Observation[]>> {
  // Made once, so a re-plan cannot give a record a second identity.
  const fixed = inputs.map(input => ({ ...input, id: input.id ?? freshId(), at: input.at ?? nowAt() }));
  const ids = fixed.map(input => input.id);
  return enqueue<Observation[]>({
    plan: base => {
      if (fixed.length === 0) return { change: null, result: () => [] };

      const records: Observation[] = [];
      const invalid: FailureDetail[] = [];
      fixed.forEach((input, index) => {
        try {
          records.push(newObservation(input));
        } catch (error) {
          invalid.push({ index, id: input.id, reason: error instanceof Error ? error.message : String(error) });
        }
      });
      if (invalid.length > 0) {
        throw new StoreFailure('invalid', `Nothing was saved. ${describeRefusals(invalid, fixed)}`, undefined, invalid);
      }

      const stored = new Set<string>();
      const wanted = new Set(ids);
      for (const o of base.observations) if (wanted.has(o.id)) stored.add(o.id);
      const clashes: FailureDetail[] = [];
      const seen = new Set<string>();
      records.forEach((record, index) => {
        if (seen.has(record.id)) clashes.push({ index, id: record.id, reason: 'The same id appears twice in this batch.' });
        else if (stored.has(record.id)) clashes.push({ index, id: record.id, reason: 'A record with this id is already on this device.' });
        seen.add(record.id);
      });
      if (clashes.length > 0) {
        throw new StoreFailure('conflict', `Nothing was saved. ${describeRefusals(clashes, fixed)}`, undefined, clashes);
      }

      return {
        change: { observations: { put: records } },
        result: next => {
          const byId = new Map<string, Observation>();
          for (const o of next.observations) if (wanted.has(o.id)) byId.set(o.id, o);
          return ids.map(id => byId.get(id)!);
        },
      };
    },
  });
}

/**
 * Remove several records as one — every observation of a walk — in one
 * transaction: all of them, or, if the removal fails, none. An id that is
 * already gone is no reason to keep the rest, so it is passed over.
 */
export function removeObservations(ids: readonly string[]): Promise<StoreResult> {
  const wanted = new Set(ids);
  return enqueue<void>({
    plan: base => {
      const present = base.observations.filter(o => wanted.has(o.id)).map(o => o.id);
      return { change: present.length > 0 ? { observations: { remove: present } } : null, result: () => undefined };
    },
  });
}

export interface ObservationPatch {
  value?: number;
  unit?: string;
  /** `null` removes the note. */
  note?: string | null;
  /** Correcting the time of a reading also moves it to the right day. */
  at?: string;
  /** `null` removes the timing tag. */
  tag?: ObservationTag | null;
  /** `null` removes the meal start. */
  mealStartedAt?: string | null;
}

/**
 * Correct a stored record. Everything not named in the patch is kept — a
 * corrected glucose keeps its timing tag and meal start (F11). `at` keeps the
 * moment observed and `editedAt` records when the correction was made, which
 * is what decides whose day total is current.
 */
export function editObservation(id: string, patch: ObservationPatch): Promise<StoreResult<Observation>> {
  const editedAt = nowAt();
  return enqueue<Observation>({
    plan: base => {
      const existing = findObservation(base, id);
      if (!existing) throw new StoreFailure('unknown', 'That record is no longer on this device.');
      const record = reviseObservation(existing, patch, editedAt);
      return { change: { observations: { put: [record] } }, result: next => findObservation(next, id)! };
    },
  });
}

export function removeObservation(id: string): Promise<StoreResult> {
  return enqueue<void>({
    plan: base => ({ change: findObservation(base, id) ? { observations: { remove: [id] } } : null, result: () => undefined }),
  });
}

export interface BloodPressureInput {
  systolic: number;
  diastolic: number;
  /**
   * Defaults to now — or, correcting a reading, to its own time. Both halves
   * share it. A time given here is a time recorded: correcting a reading whose
   * time was never recorded keeps it unrecorded unless one is given.
   */
  at?: string;
  /** Unchanged when absent; `null` clears it, as an observation patch does. */
  tag?: 'morning' | 'evening' | 'other' | null;
  source?: ObservationSource;
  note?: string;
  /** Supply one to correct an existing reading in place. */
  readingId?: string;
}

/**
 * Record a blood-pressure reading: one event, two observations, one write.
 *
 * Both halves go in a single transaction with the same instant and the same
 * `bp:` context, so the store can never hold a systolic whose diastolic was
 * lost — see `pairBloodPressure`, and `removeReading` for the other direction.
 * Correcting a reading reuses its halves' ids and drops any duplicates, so
 * the reading is whole and unambiguous afterwards.
 */
export function putBloodPressure(input: BloodPressureInput): Promise<StoreResult<BpReading>> {
  const readingId = input.readingId ?? `reading-${freshId()}`;
  const now = nowAt();
  return enqueue<BpReading>({
    plan: base => {
      const context = bpContext(readingId);
      const existing = base.observations.filter(o => bpReadingId(o.context) === readingId);
      const latestOf = (kind: ObservationKind) => existing.filter(o => o.kind === kind).sort(compareStatements).at(-1);
      const oldSys = latestOf('bloodPressureSystolic');
      const oldDia = latestOf('bloodPressureDiastolic');
      const prior = oldSys ?? oldDia;
      const at = input.at ?? prior?.at ?? now;
      const tag = input.tag === undefined ? prior?.tag : (input.tag ?? undefined);
      const note = input.note ?? prior?.note;
      const shared = {
        at,
        context,
        scope: 'pointInTime' as const,
        source: input.source ?? prior?.source ?? 'manual',
        ...(tag !== undefined ? { tag } : {}),
        ...(note !== undefined ? { note } : {}),
        // A half added to a reading whose time was never recorded shares that.
        ...(prior?.timeUnknown && input.at === undefined ? { timeUnknown: true } : {}),
      };
      // A half that exists is revised, so everything a correction does not
      // name — a time never recorded, its note, its provenance — is kept
      // (Track T3-03). Only a given time makes the time known; `null` clears
      // the timing (T3-04).
      const half = (old: Observation | undefined, kind: 'bloodPressureSystolic' | 'bloodPressureDiastolic', value: number) => (old
        ? reviseObservation(old, {
          value,
          ...(input.at !== undefined ? { at: input.at } : {}),
          ...(input.tag !== undefined ? { tag: input.tag } : {}),
          ...(input.note !== undefined ? { note: input.note } : {}),
        }, now)
        : { ...newObservation({ ...shared, id: `${readingId}:${kind}`, kind, value }), ...(prior ? { editedAt: now } : {}) });
      const halves = [half(oldSys, 'bloodPressureSystolic', input.systolic), half(oldDia, 'bloodPressureDiastolic', input.diastolic)];
      const kept = new Set(halves.map(h => h.id));
      return {
        change: { observations: { put: halves, remove: existing.filter(o => !kept.has(o.id)).map(o => o.id) } },
        result: next => pairBloodPressure(next.observations.filter(o => kept.has(o.id)))[0],
      };
    },
  });
}

/**
 * Delete a whole reading, both halves together, so a deletion can never
 * leave a lone systolic behind.
 */
export function removeReading(readingId: string): Promise<StoreResult> {
  return enqueue<void>({
    plan: base => {
      const doomed = base.observations.filter(o => bpReadingId(o.context) === readingId);
      if (doomed.length === 0) throw new StoreFailure('unknown', 'That reading is no longer on this device.');
      return { change: { observations: { remove: doomed.map(o => o.id) } }, result: () => undefined };
    },
  });
}

export interface DayTotalOptions {
  /** Defaults to today, locally. */
  day?: string;
  source?: ObservationSource;
  unit?: string;
  context?: string;
}

/**
 * Add to a day's running total — a glass of water, a few more minutes.
 *
 * Appends a *replacing* total rather than a second one, which is the only way
 * to grow a `dayTotal` without breaking D10. The tap's moment and day are
 * taken when it is made and the baseline when it is stored, from the same
 * day: a tap at 23:59:59 counts towards that day even if it is written after
 * midnight (F18). The baseline is that source's own latest statement for that
 * day and unit, not whichever source spoke last (F16).
 */
export function addToDayTotal(kind: ObservationKind, delta: number, options: DayTotalOptions = {}): Promise<StoreResult<Observation>> {
  let at: string;
  try {
    at = options.day !== undefined ? atOnDay(options.day) : nowAt();
  } catch (error) {
    const failure = failed(error);
    note(failure);
    return Promise.resolve({ ok: false, failure });
  }
  const day = dayOf(at);
  const source = options.source ?? 'manual';
  const unit = options.unit ?? canonicalUnit(kind);
  const id = freshId();
  return enqueue<Observation>({
    plan: base => {
      const mine = base.observations
        .filter(o => o.kind === kind && o.scope === 'dayTotal' && o.day === day && o.source === source && o.unit === unit)
        .sort(compareStatements);
      const previous = mine.at(-1)?.value ?? 0;
      const record = newObservation({
        id, kind, value: previous + delta, scope: 'dayTotal', source, unit, at,
        ...(options.context !== undefined ? { context: options.context } : {}),
      });
      return { change: { observations: { put: [record] } }, result: next => findObservation(next, id)! };
    },
  });
}

// ============================================================================
// Sessions and the documents v4 carried
// ============================================================================

/** The fields a stored record is keyed by, checked before anything is written. */
function keyed(session: WorkoutSession): void {
  if (typeof session?.id !== 'string' || session.id === '') throw new StoreFailure('invalid', 'A session needs an id.');
  if (!isDay(session.date)) throw new StoreFailure('invalid', `A session needs a YYYY-MM-DD date, not ${String(session.date)}.`);
}

export function putSession(session: WorkoutSession): Promise<StoreResult> {
  const now = nowAt();
  return enqueue<void>({
    plan: base => {
      keyed(session);
      const lifted = liftSessionPain(session.id, session, base.observations, now);
      return {
        change: { sessions: { put: [session] }, observations: { put: lifted.put, remove: lifted.remove } },
        result: () => undefined,
      };
    },
  });
}

export function removeSession(id: string): Promise<StoreResult> {
  return enqueue<void>({
    plan: base => {
      const lifted = liftSessionPain(id, undefined, base.observations);
      return { change: { sessions: { remove: [id] }, observations: { remove: lifted.remove } }, result: () => undefined };
    },
  });
}

/**
 * Change some settings, field by field: two writers each changing one setting
 * both land (F02). A field given as `undefined` is removed.
 */
export function setSettings(patch: Partial<UserSettings>): Promise<StoreResult> {
  const set: Record<string, unknown> = {};
  const unset: string[] = [];
  for (const [field, value] of Object.entries(patch)) {
    if (value === undefined) unset.push(field);
    else set[field] = value;
  }
  return enqueue<void>({ plan: () => ({ change: { settings: { patch: set as Partial<UserSettings>, unset } }, result: () => undefined }) });
}

export function setProfile(profile: UserProfile): Promise<StoreResult> {
  return enqueue<void>({ plan: () => ({ change: { profile }, result: () => undefined }) });
}

export interface RemoveCheckInOptions {
  /** Readings to delete along with the summary. Without them, the readings stay: they are history. */
  observationIds?: readonly string[];
}

/**
 * Remove a day's check-in summary. The measurements taken with it are kept —
 * deleting a readiness summary is not deleting a glucose reading — unless the
 * caller names them, in which case they go in the same transaction.
 */
export function removeCheckIn(date: string, options: RemoveCheckInOptions = {}): Promise<StoreResult> {
  return enqueue<void>({
    plan: base => {
      const doomed = (options.observationIds ?? []).filter(id => findObservation(base, id));
      const holds = base.checkIns.some(c => c.date === date);
      if (!holds && doomed.length === 0) return { change: null, result: () => undefined };
      return {
        change: {
          ...(holds ? { checkIns: base.checkIns.filter(c => c.date !== date) } : {}),
          ...(doomed.length > 0 ? { observations: { remove: doomed } } : {}),
        },
        result: () => undefined,
      };
    },
  });
}

export function putPersonalRecord(record: PersonalRecord): Promise<StoreResult> {
  return enqueue<void>({
    plan: base => ({
      change: { personalRecords: [...base.personalRecords.filter(r => r.exerciseId !== record.exerciseId), record] },
      result: () => undefined,
    }),
  });
}

/** Record a body measurement; its weight and waist series follow it (F14). */
export function putBodyMetric(metric: BodyMetric): Promise<StoreResult> {
  const now = nowAt();
  return enqueue<void>({
    plan: base => {
      if (!isDay(metric?.date)) throw new StoreFailure('invalid', 'A body measurement needs a YYYY-MM-DD date.');
      const lifted = liftBodyMetric(metric.date, metric, base.observations, now);
      const bodyMetrics = [...base.bodyMetrics.filter(m => m.date !== metric.date), metric].sort((a, b) => b.date.localeCompare(a.date));
      return { change: { bodyMetrics, observations: { put: lifted.put, remove: lifted.remove } }, result: () => undefined };
    },
  });
}

export function setFocusOverride(day: string, focus: DayFocus | undefined): Promise<StoreResult> {
  return enqueue<void>({
    plan: base => {
      const focusOverrides = { ...base.focusOverrides };
      if (focus === undefined) delete focusOverrides[day];
      else focusOverrides[day] = focus;
      return { change: { focusOverrides }, result: () => undefined };
    },
  });
}

/** Per-key reading state for the Guide (bookmarks, read markers). `undefined` removes the key. */
export function setContentState(key: string, value: unknown): Promise<StoreResult> {
  return enqueue<void>({
    plan: () => {
      if (typeof key !== 'string' || key === '') throw new StoreFailure('invalid', 'Content state needs a key.');
      return { change: { content: value === undefined ? { remove: [key] } : { put: { [key]: value } } }, result: () => undefined };
    },
  });
}

/**
 * Clear all data (spec §10.2, D23).
 *
 * Every store and the schema marker in one transaction, so it either all
 * happens or none of it does (F24). Then the app's `localStorage` keys —
 * including the in-progress session, which quotes the user's readings — are
 * swept; if the browser refuses that, the result says the records *were*
 * deleted and what was left.
 */
export function clearAll(): Promise<StoreResult> {
  return enqueue<void>({
    // Nothing is shown as cleared until it is (J18).
    hold: true,
    plan: () => {
      // With nothing it can store to, it can delete nothing there either: it
      // refuses, so what it says and what it does agree (C2-08). Clearing the
      // screen and the small flags alone would look like a deletion that
      // never reached the record.
      if (!db) {
        throw new StoreFailure('unavailable', 'This app cannot reach this device’s storage right now, so it cannot delete what is kept there. Close the app, open it again, and try again.');
      }
      return { change: { reset: true, schemaVersion: SCHEMA_VERSION }, result: () => undefined };
    },
    after: () => {
      try {
        resetData();
        return undefined;
      } catch (error) {
        return {
          ok: false,
          failure: new StoreFailure(
            'partial',
            'Your records were deleted from this device, but this browser would not let the app remove some of its other data. Close the app and clear this site’s data in your browser settings to remove the rest.',
            error,
          ),
        };
      }
    },
  });
}

// ============================================================================
// The v4 shape, for the screens that still speak it
// ============================================================================

let projectedFrom: unknown[] = [];
let projected: AppData | undefined;

/**
 * The store as an `AppData`, the shape every existing screen reads.
 *
 * Memoised on the slices it is made of, not on the state object, so a publish
 * that changes nothing a screen reads — `saving` flipping, a reading being
 * added — keeps `data` the same object, and `useMemo(…, [data])` in a screen
 * does not rebuild a session plan for nothing.
 */
export function projectAppData(current: StoreState = state): AppData {
  const parts = [current.settings, current.sessions, current.bodyMetrics, current.personalRecords, current.profile, current.checkIns, current.focusOverrides];
  if (projected && parts.every((p, i) => p === projectedFrom[i])) return projected;
  projectedFrom = parts;
  projected = {
    version: CURRENT_VERSION,
    settings: current.settings,
    sessions: current.sessions,
    bodyMetrics: current.bodyMetrics,
    personalRecords: current.personalRecords,
    ...(current.profile !== undefined ? { profile: current.profile } : {}),
    checkIns: current.checkIns,
    focusOverrides: current.focusOverrides,
  };
  return projected;
}

function appDataOf(s: Snapshot): AppData {
  return {
    version: CURRENT_VERSION,
    settings: settingsOf(s.settings),
    sessions: s.sessions,
    bodyMetrics: s.bodyMetrics,
    personalRecords: s.personalRecords,
    ...(s.profile !== undefined ? { profile: s.profile } : {}),
    checkIns: s.checkIns,
    focusOverrides: s.focusOverrides,
  };
}

/**
 * What an updater changed, as record- and field-level changes, with the
 * measurements those records imply lifted out the same way the direct
 * actions lift them.
 *
 * ponytail: compares every session against its copy, O(sessions) per update.
 * Upgrade: none needed — this path serves the legacy pages, which Task 9
 * removes; new screens call the targeted actions.
 */
function describeUpdate(base: Snapshot, before: AppData, after: AppData, now: string, readings: 'append' | 'correct' = 'append'): Change | null {
  if (typeof after !== 'object' || after === null || !Array.isArray(after.sessions)) {
    throw new StoreFailure('invalid', 'That change did not produce app data.');
  }
  const change: Change = {};

  const settingsPatch: Record<string, unknown> = {};
  const settingsUnset: string[] = [];
  const fields = new Set([...Object.keys(before.settings), ...Object.keys(after.settings ?? {})]);
  for (const field of fields) {
    const was = (before.settings as unknown as Record<string, unknown>)[field];
    const is = ((after.settings ?? {}) as unknown as Record<string, unknown>)[field];
    if (sameValue(was, is)) continue;
    if (is === undefined) settingsUnset.push(field);
    else settingsPatch[field] = is;
  }
  if (Object.keys(settingsPatch).length > 0 || settingsUnset.length > 0) {
    change.settings = { patch: settingsPatch as Partial<UserSettings>, unset: settingsUnset };
  }

  if (!sameValue(before.profile, after.profile)) change.profile = after.profile ?? null;

  const puts: Observation[] = [];
  const removes: string[] = [];
  const pool = () => [...base.observations, ...puts];

  const checkIns = after.checkIns ?? [];
  if (!sameValue(before.checkIns ?? [], checkIns)) {
    for (const record of checkIns) {
      if (!isDay(record?.date)) throw new StoreFailure('invalid', 'A check-in needs a YYYY-MM-DD date.');
    }
    change.checkIns = checkIns;
    // A summary that changed or arrived lifts its readings; one removed keeps them.
    const dates = new Set(checkIns.map(c => c.date));
    for (const date of dates) {
      const was = (before.checkIns ?? []).filter(c => c.date === date);
      const is = checkIns.filter(c => c.date === date);
      if (sameValue(was, is)) continue;
      for (const record of is) {
        const lifted = liftCheckIn(record, { existing: pool(), ...(was.length > 0 ? { previous: was[was.length - 1] } : {}), now, readings });
        puts.push(...lifted.put);
      }
    }
  }

  if (!sameValue(before.personalRecords, after.personalRecords)) change.personalRecords = after.personalRecords ?? [];

  if (!sameValue(before.bodyMetrics, after.bodyMetrics)) {
    const metrics = after.bodyMetrics ?? [];
    change.bodyMetrics = metrics;
    const dates = new Set([...before.bodyMetrics.map(m => m.date), ...metrics.map(m => m.date)]);
    for (const date of dates) {
      const was = before.bodyMetrics.find(m => m.date === date);
      const is = metrics.find(m => m.date === date);
      if (sameValue(was, is)) continue;
      const lifted = liftBodyMetric(date, is, pool(), now);
      puts.push(...lifted.put);
      removes.push(...lifted.remove);
    }
  }

  const overrides = after.focusOverrides ?? {};
  if (!sameValue(before.focusOverrides ?? {}, overrides)) change.focusOverrides = overrides;

  // Sessions are a store of their own, so only the ones that changed are
  // written — not the whole history on every set logged.
  const held = new Map(before.sessions.map(s => [s.id, s]));
  const sessionPuts = after.sessions.filter(s => !sameValue(held.get(s?.id), s));
  for (const s of sessionPuts) keyed(s);
  const kept = new Set(after.sessions.map(s => s.id));
  const sessionRemoves = before.sessions.filter(s => !kept.has(s.id)).map(s => s.id);
  if (sessionPuts.length > 0 || sessionRemoves.length > 0) change.sessions = { put: sessionPuts, remove: sessionRemoves };
  for (const s of sessionPuts) {
    const lifted = liftSessionPain(s.id, s, pool(), now);
    puts.push(...lifted.put);
    removes.push(...lifted.remove);
  }
  for (const id of sessionRemoves) removes.push(...liftSessionPain(id, undefined, pool()).remove);

  if (puts.length > 0 || removes.length > 0) change.observations = { put: puts, remove: removes };
  return Object.keys(change).length === 0 ? null : change;
}

/**
 * Apply a change written in the v4 shape, for the screens that still speak it.
 *
 * **Published before it is stored, deliberately.** Callers write and then
 * navigate in the same tick, and the next screen must see the new truth. The
 * returned promise resolves once the change is durably stored — or fails, in
 * which case it is taken back out and `state.failure` says why — so anything
 * that must not act on an unsaved change (deleting a recovery copy, F09)
 * awaits it.
 *
 * The updater is given a copy and may be run again if what it was based on
 * changes before its turn comes (an earlier change failed, another tab
 * wrote). It should be a pure function of its argument, as a React updater is.
 */
export interface UpdateOptions {
  /**
   * How the readings of a changed check-in are lifted: `append` (the default)
   * records a changed number as a new reading, since it may be a recheck;
   * `correct` revises the reading in place, for a number typed wrongly.
   */
  readings?: 'append' | 'correct';
  /**
   * Not shown until it is stored. For a change the screens switch on, like
   * finishing Welcome: shown at once and then refused, it would move the
   * person somewhere and straight back, and lose what the screen held (D-04).
   */
  hold?: boolean;
  /**
   * Readings to delete in the same write: a check-in's reading taken out of
   * the record and the series together, so neither brings the other back on
   * the next save (scan C2-01). An id no longer stored is passed over.
   */
  removeObservations?: readonly string[];
}

export function update(updater: (previous: AppData) => AppData, options: UpdateOptions = {}): Promise<StoreResult> {
  const now = nowAt();
  return enqueue<void>({
    ...(options.hold ? { hold: true } : {}),
    plan: base => {
      const before = appDataOf(base);
      // A copy: an updater that edits in place — the old `localStorage` habit —
      // cannot reach into live state, and the edit still shows as a difference.
      const after = updater(structuredClone(before));
      const change = describeUpdate(base, before, after, now, options.readings ?? 'append');
      const doomed = new Set((options.removeObservations ?? []).filter(id => findObservation(base, id)));
      if (doomed.size === 0) return { change, result: () => undefined };
      const observations = change?.observations;
      return {
        change: {
          ...change,
          observations: {
            ...observations,
            put: (observations?.put ?? []).filter(o => !doomed.has(o.id)),
            remove: [...(observations?.remove ?? []), ...doomed],
          },
        },
        result: () => undefined,
      };
    },
  });
}

/**
 * Whether a session is durably stored on this device — not merely on screen.
 *
 * The question to ask before deleting a recovery copy: a session shown in
 * `sessions` may still be waiting to be written, or may never be if storage
 * is unavailable (F09).
 */
export function isSessionSaved(sessionId: string): boolean {
  return durable?.sessions.some(s => s.id === sessionId) ?? false;
}

// ============================================================================
// What to tell the user about storage (D16, D23)
// ============================================================================

export interface StorageNotice {
  title: string;
  detail: string;
  /** `warning` is this session only; `error` is a write that did not happen. */
  tone: 'warning' | 'error';
}

/**
 * The one thing the app must say out loud about storage, matched to the cause
 * it can detect. Installing the app is offered as the answer only when it is
 * one — a browser tab that will not store data — and never for an installed
 * app, a blocked database or a failed read.
 */
export function storageNotice(current: StoreState = state): StorageNotice | undefined {
  if (current.status === 'unavailable') {
    switch (current.failure?.code) {
      case 'blocked':
        return {
          tone: 'warning',
          title: 'Close the app’s other tabs',
          detail: 'Another tab or window of this app is open and holding its data, so nothing is being saved here. Close the other tabs of this app, then try again.',
        };
      case 'stale':
        return {
          tone: 'warning',
          title: 'This copy of the app is out of date',
          detail: 'The app was updated in another tab or window. Reload this page to keep saving; anything you do before then is not saved.',
        };
      case 'readFailed':
        return {
          tone: 'warning',
          title: 'Your records could not be read',
          detail: 'The app could not read the records already on this device, so it is not saving anything new over them. Your records have not been changed. Try again, and if it keeps happening, restart the app.',
        };
      case 'quotaExceeded':
        return {
          tone: 'warning',
          title: 'This device is full',
          detail: 'There is not enough space to finish moving your records, so nothing new is being saved yet. Your records are safe where they are. Free some space, then try again.',
        };
      default:
        if (current.installed === false) {
          return {
            tone: 'warning',
            title: 'Nothing is being saved on this device',
            detail: 'This browser tab is not letting the app store data, so anything you do now is lost when you close it. Add the app to your Home Screen and open it from there to keep your records.',
          };
        }
        return {
          tone: 'warning',
          title: 'Nothing is being saved on this device',
          detail: 'Your iPhone isn’t letting the app store data right now. Try again, and if it keeps happening, restart the app.',
        };
    }
  }
  if (current.failure) {
    return { tone: 'error', title: 'That did not save', detail: current.failure.message };
  }
  return undefined;
}

export function useStorageNotice(): StorageNotice | undefined {
  return storageNotice(useStore());
}

// ============================================================================
// Export and import (D17)
// ============================================================================

/** An export, and exactly what it covers. */
export interface ExportedRecord extends EncodedTransfer {
  /** The revision of the snapshot in the file: what was stored when it was read. */
  revision: number;
  /** When that snapshot was read; the same value the file carries as `exportedAt`. */
  exportedAt: string;
}

/**
 * The whole record as a file, ready to hand to `deliver`, with the revision
 * and moment it covers — so a backup can record exactly what it holds, and
 * anything stored after it, however it is dated, counts as newer.
 *
 * Waits for every change already made, then reads one consistent moment of
 * what is stored — the revision is that moment's, even if this copy had not
 * caught up with another tab. While nothing can be saved, it exports what this
 * session holds — the one way left to keep it.
 */
export function exportRecord(): Promise<StoreResult<ExportedRecord>> {
  return enqueueTask(async () => {
    try {
      const snap = db ? await readSnapshot(db) : committed;
      // A copy that had not caught up now has, at no extra cost.
      if (db && snap.revision !== committed.revision) adopt(snap);
      const exportedAt = nowAt();
      const file = await encode(toTransferDoc(snap, exportedAt));
      return { ok: true as const, value: { ...file, revision: snap.revision, exportedAt } };
    } catch (error) {
      const failure = toFailure(error, 'readFailed');
      note(failure);
      return { ok: false as const, failure };
    }
  });
}

/** What importing this file would do here: counts, unreadable records, and conflicts with this device. */
export function previewRecord(raw: unknown): ImportPreview | ImportProblem {
  return previewImport(raw, view);
}

/**
 * Write an imported file and publish what the device then holds.
 *
 * Preview it with `previewRecord` first: the user chooses merge or replace,
 * and how conflicts are settled.
 */
export function importRecord(raw: unknown, mode: ImportMode, options: ImportOptions = {}): Promise<StoreResult<ImportReport>> {
  return enqueue<ImportReport>({
    plain: true,
    // A file can finish Welcome; shown before it is stored, a refusal would
    // bounce the person out of the restore flow and back (D-09).
    hold: true,
    plan: base => {
      const planned = planImport(raw, mode, base, options);
      return { change: planned.change, result: () => planned.report };
    },
  });
}

/**
 * Clear all data and restart onto onboarding.
 *
 * The v4 `resetAndRestart` swept `localStorage` and reloaded, which is no
 * longer enough: the record lives in IndexedDB, so a reload would bring it
 * straight back. Once the records are deleted the app restarts even if the
 * tidying up afterwards failed, so nothing on screen still shows them.
 */
export async function clearAllAndRestart(
  loc: Pick<Location, 'replace' | 'reload'> = window.location,
  /** The screen's own tidying up — reminders, the icon's badge — once the record is gone. */
  beforeRestart?: () => void,
): Promise<StoreResult> {
  const cleared = await clearAll();
  if (!cleared.ok && cleared.failure.code !== 'partial') return cleared;
  beforeRestart?.();
  loc.replace('#/onboarding');
  loc.reload();
  return cleared;
}

/** Re-read everything from the device. For an import, or another tab's write. */
export function reload(): Promise<StoreResult> {
  return enqueueTask(async () => {
    const handle = db;
    if (!handle) return { ok: false as const, failure: unavailableFailure() };
    try {
      const snap = await readSnapshot(handle);
      committed = durable = snap;
      mirror(snap);
      lastFailure = undefined;
      recompute();
      publish();
      return { ok: true as const, value: undefined };
    } catch (error) {
      const failure = toFailure(error, 'readFailed');
      note(failure);
      return { ok: false as const, failure };
    }
  });
}

/** The live state. Every caller gets the same object and the same updates. */
export function useStore(): StoreState {
  return useSyncExternalStore(subscribe, getState, getState);
}
