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
import type { CheckInRecord, ClockHold } from '@/types/checkin';
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
import { HoldFailure, JOURNAL_STORE, StoreFailure, openDb, requestPersistence, toFailure, type Db, type Doc, type FailureDetail, type StoreResult, type TxHandle } from './db';
import { clinicalOf, clockHoldOn, holdLifted, touchesClinical } from './holds';
import { setStorageReadOnly } from './writable';
import { exportExcess, exportWarning } from './limits';
import {
  NOT_RECENT, expiryPlan, nextExpiry, planDeletion, planRestore, recentKey, recentWithoutRoutes, restorable, withoutRecentCarrier,
  type DeleteRequest, type Restored,
} from './recent';
import { newWalkId } from '@/walk/plan';
import { parseJournalEntry, withJournalled, type JournalEntry } from '@/walk/journal';
import { sameClockChange, type ClockSeen } from '@/walk/clock';
import { clockGeneration, erasedGeneration, routeErased, walkSettings, withClockChange, withErase, withPendingClock, type WalkSettings } from '@/walk/consent';
import { routeRecord, type RouteRecord } from '@/walk/routeRecord';
import type { WalkInput } from '@/walk/record';
import { SCHEMA_VERSION, giveSnapshots, legacySnapshot, migrateToV5, migrateToV6, readLegacy, type MigrationReport } from './migrate';
import { liftBodyMetric, liftCheckIn, liftSessionPain } from './project';
import { RECORD_RULES, RECORD_STORES, recordKey, recordProblem, type RecordStore, type Records, type StoredRecord } from './records';
import { commitChange, emptySnapshot, prepare, readSnapshot, type Change, type Prepared, type Snapshot, type TxRead } from './snapshot';
import {
  encode,
  planImport,
  previewImport,
  sameValue,
  toTransferDoc,
  type EncodedTransfer,
  type ExportOptions,
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
  /**
   * The check-ins and observations as stored, as far as this copy knows: on
   * the device, or with no storage what the app was opened with, never a
   * change still on its way or one refused (F-safety-01). What every gate
   * takes as stored; the screens show `checkIns` and `observations`.
   */
  stored: { checkIns: CheckInRecord[]; observations: Observation[] };
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
  /** The v2 record stores (Plan 6 Task 1), each in key order. */
  records: Readonly<Records>;
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
   * B-19: the clock hold every gate reads (`settings.walk.clock`), with any
   * change seen here that the device has not stored yet: held from the
   * moment it is seen, and released by nothing until it is (H6F-02, board
   * D188). A reading is stamped by what is stored (`acquisitionStamp`).
   */
  clockHold?: ClockHold;
  /** Storage was lost while the app ran: every screen stays, nothing more is saved, and nothing new starts (P8S-04). A first open that fails is never this. */
  readOnly: boolean;
  /**
   * The revision of what is stored, as far as this copy knows. It moves with
   * every commit of anything — a reading, a backdated session, a profile or
   * settings edit — and is the same number in every open copy once each has
   * caught up. Changes still on their way are not counted until stored.
   * Revisions belong to one database: compare them only with revisions from
   * this device.
   */
  revision: number;
  /**
   * The record's generation (`Snapshot.generation`): moves on when the whole
   * record is replaced, by a backup restored with Replace or everything
   * deleted, here or in another copy of the app. What a screen kept for the
   * record before (setup's answers on a page, say) belonged to that record,
   * and is dropped when this moves (H5-07, H5R-09).
   */
  epoch: number;
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
/** What memory mode was opened with, when no database was ever read: stored elsewhere (a v1 copy) or nothing (F-safety-01). */
let memoryBase: Snapshot | undefined;
let lastFailure: StoreFailure | undefined;
let migration: MigrationReport | undefined;
let persisted = false;
let installed: boolean | undefined;
let booted: Promise<void> | undefined;
let channel: BroadcastLike | undefined;
let detachVisibility: (() => void) | undefined;
/** Bumped by `resetForTests`, so a commit still in flight from an earlier test cannot touch the next one. */
let generation = 0;
/** B-19: the days of each change to the clock seen here and not yet stored, held meanwhile (`markClockChange`, H6F-02). */
let clockPending: (readonly string[])[] = [];
/** `StoreState.readOnly`: a working store lost its storage (`leave`), as opposed to a first open that failed (P8S-04). */
let wentReadOnly = false;

interface Planned<T> {
  /** `null`: nothing to do, and nothing is written. */
  change: Change | null;
  result: (next: Snapshot) => T;
}

interface Mutation<T> {
  /** `read`: what the commit read inside its own transaction, when it asked (`journal`); absent when planned for the screen. */
  plan: (base: Snapshot, read?: TxRead) => Planned<T>;
  /** Walk journal entries the plan needs, read inside the commit's own transaction (H6-06): by key, or every one. */
  journal?: readonly string[] | 'all';
  /** The plan for one exact base, and what it does to it. */
  cached?: { on: Snapshot; planned: Planned<T>; prepared: Prepared; read?: true };
  /** The last attempt to plan against the current base threw. */
  planFailure?: StoreFailure;
  settle: (result: StoreResult<T>) => void;
  /** After the change is applied: may turn success into a reported partial failure. */
  after?: () => StoreResult<T> | undefined;
  /**
   * Only worth doing if it is stored — clear-all, an import — so with nothing
   * to store to it is refused with this, before anything changes, even on
   * screen. Checked at its turn, not when planned: storage can go meanwhile,
   * when another tab upgrades the app (R5-03).
   */
  needsStorage?: string;
  /**
   * Not shown until it is stored. Clear-all: an empty record on screen, even
   * for a moment, sends the app to Welcome, and a clear that then fails would
   * leave the person somewhere they never asked to go (J18).
   */
  hold?: boolean;
  /**
   * The device's own safety record, a change to the phone's clock (B-19): let in while a restart to update
   * holds new work, as nothing else is, and the restart's reload waits for it (board D106 with Plan 6's
   * H6F-02): a change seen is held until it is stored, a reload included.
   */
  safety?: boolean;
  /** Not an edit the person made (D113): a delete, a restore, background work. Only edits end an Undo (Task 7). */
  edit?: false;
  /**
   * "Delete all data" (D119): the person's confirmed choice to erase
   * everything, the one change the engine isn't asked about.
   */
  erasesAll?: true;
  /**
   * What it may do depends on the time: a restore, which an entry past its 7
   * days may no longer make, and expiry (P8S-09). Planned again when its turn
   * comes, inside the transaction that commits it, never from a plan made
   * earlier against the same snapshot.
   */
  timed?: true;
  /** The payload came from `JSON.parse` and is already plain data. */
  plain?: boolean;
}

type Job =
  | { kind: 'mutation'; m: Mutation<unknown> }
  | { kind: 'task'; run: () => Promise<void> };

const jobs: Job[] = [];
let pumping = false;

let storedSlices: StoreState['stored'] = { checkIns: [], observations: [] };
/** The last snapshot known stored (`durable`), else what memory mode opened with, else what this copy holds (nothing yet, while loading). */
function storedOf(): StoreState['stored'] {
  const s = durable ?? memoryBase ?? committed;
  // The same object while what is stored is the same, so a screen's memo holds across publishes that store nothing.
  if (s.checkIns !== storedSlices.checkIns || s.observations !== storedSlices.observations) storedSlices = { checkIns: s.checkIns, observations: s.observations };
  return storedSlices;
}

function toState(s: Snapshot): StoreState {
  return {
    status: mode === 'ready' ? 'ready' : mode === 'memory' ? 'unavailable' : 'loading',
    observations: s.observations,
    stored: storedOf(),
    sessions: s.sessions,
    settings: settingsOf(s.settings),
    profile: s.profile,
    checkIns: s.checkIns,
    personalRecords: s.personalRecords,
    bodyMetrics: s.bodyMetrics,
    focusOverrides: s.focusOverrides,
    contentState: s.content,
    records: s.records,
    failure: mode === 'memory' ? memoryReason : lastFailure,
    migration,
    persisted,
    saving: jobs.some(j => j.kind === 'mutation'),
    installed,
    readOnly: mode === 'memory' && wentReadOnly,
    clockHold: withPendingClock(settingsOf(s.settings).walk?.clock, clockPending),
    revision: committed.revision,
    epoch: s.generation,
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
function planOn<T>(m: Mutation<T>, base: Snapshot, read?: TxRead): { planned: Planned<T>; prepared: Prepared } {
  if (!read && !m.timed && m.cached && m.cached.on === base && !m.cached.read) return m.cached;
  const planned = m.plan(base, read);
  const change = planned.change === null ? null : m.plain ? planned.change : structuredClone(planned.change);
  const prepared: Prepared = change === null ? { next: base, writes: [] } : prepare(base, change);
  if (change !== null && !m.erasesAll && touchesClinical(change, base)) {
    // Asked of what is really there, before and after, for every change that can take a clinical
    // measurement away, whichever function or caller asked for it (D119, P8S-03): the stored profile,
    // and the phone's clock changes from the moment each is seen (Plan 5's D197; Plan 6's H6F-02).
    const now = new Date();
    const removedDays = base.checkIns.map(c => c.date).filter(d => !prepared.next.checkIns.some(c => c.date === d));
    const refused = holdLifted(clinicalOf(base, clockPending), clinicalOf(prepared.next, clockPending), now, { clock: clockHoldOn(base.settings, now, clockPending), removedDays });
    if (refused) throw new HoldFailure(refused.held, refused.release, refused.said);
  }
  m.cached = { on: base, planned: { ...planned, change }, prepared, ...(read ? { read: true as const } : {}) };
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
    // A restart to update is under way (D106, P8S-13): nothing new is shown or written.
    if (!admitting && !m.safety) {
      resolve({ ok: false, failure: new StoreFailure('unavailable', RESTARTING_REFUSAL) });
      return;
    }
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
      // A refusal is said where it was asked, never as the storage banner (D119).
      if (failure.code !== 'held') note(failure);
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

const editListeners = new Set<() => void>();

/**
 * Told after every change the person made is stored (B-04, D113): what ends
 * an Undo, wherever it was made, a manual workout's sets included. A delete,
 * a restore, expiry and reading progress pass `edit: false`, and aren't; nor
 * is the device's own record of a change to its clock.
 */
export function subscribeEdits(listener: () => void): () => void {
  editListeners.add(listener);
  return () => void editListeners.delete(listener);
}

let admitting = true;
export const RESTARTING_REFUSAL = 'FitStrong is restarting to update, so this wasn’t saved.';

/**
 * Lets in no new work while FitStrong restarts to update (board D106, Codex
 * P8S-13): every mutation asked for from now is refused at once, with nothing
 * shown or written, until the function this gives back is called. Work
 * already queued carries on (`whenSettled`).
 */
export function holdNewWork(): () => void {
  admitting = false;
  return () => { admitting = true; };
}

/** Resolves once every write queued before it has been stored or refused. */
export const whenSettled = (): Promise<void> => enqueueTask(async () => undefined);

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
      // An edit the person made, stored: what ends an Undo (B-04, D113).
      if (result.ok && job.m.edit !== false) for (const listener of [...editListeners]) listener();
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
  if (!handle && m.needsStorage) return { ok: false, failure: new StoreFailure('unavailable', m.needsStorage) };
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

  const outcome = await commitChange(handle, committed, (base, refreshed, read) => {
    // A plan that reads the journal is made again here, with what this transaction read.
    if (!m.journal && !m.timed && !refreshed && m.cached && m.cached.on === base) {
      return m.cached.planned.change === null ? null : { change: m.cached.planned.change, prepared: m.cached.prepared };
    }
    const fresh = planOn(m, base, m.journal ? read : undefined);
    return fresh.planned.change === null ? null : { change: fresh.planned.change, prepared: fresh.prepared };
  }, m.journal ? { journal: m.journal } : {});

  if (!outcome.ok) {
    // What the failed transaction saw is still what is stored: adopt it, so a
    // copy that was stale stops being stale. The theme flag follows what is
    // stored, which a failure did not change.
    if (outcome.refreshed) committed = durable = outcome.refreshed;
    mirror(committed);
    if (outcome.failure.code !== 'held') lastFailure = outcome.failure;
    return { ok: false, failure: m.planFailure ?? outcome.failure };
  }

  committed = durable = outcome.value.next;
  armExpiry();
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
    memoryBase = committed;
    memorySeeded = true;
  }
  recompute();
  publish();
}

async function boot(options: StartOptions): Promise<void> {
  installed = options.installed ?? detectInstalled();
  const mine = generation;
  let handle: Db | undefined;
  // Another copy upgrading the database while this one is still starting: this
  // one lets go at once, so the upgrade is never held up by a start, and stops
  // there (B-21). Once started, `leave` does the same.
  let superseded = false;
  const stopped = () => mine !== generation || superseded;
  try {
    handle = await openDb('factory' in options ? options.factory : globalThis.indexedDB, {
      onBlocked: () => {
        if (mine === generation) enterMemory(new StoreFailure('blocked', 'Another tab or window of this app is open and holding its data.'));
      },
      onVersionChange: () => {
        if (mine !== generation) return;
        if (db) { leave(); return; }
        superseded = true;
        handle?.close();
        enterMemory(new StoreFailure('stale', 'The app was updated in another tab or window.'));
      },
    });
  } catch (error) {
    // Nothing is known about what the database holds, so nothing from the
    // old v4 copy is shown either: on a device that has already moved, that
    // copy is an old backup and would look like the current record.
    if (mine === generation) enterMemory(toFailure(error, 'unavailable'));
    return;
  }
  if (stopped()) { handle.close(); return; }

  // Asked alongside, never waited on: a browser that puts the question to
  // the person would keep the record off screen until it was answered
  // (C2-09). The answer is shown when it comes.
  void requestPersistence(options.navigator).then(kept => {
    if (mine !== generation || kept === persisted) return;
    persisted = kept;
    publish();
  });
  // A newer build has been here: this one writes nothing in its shape (D107). Its
  // migrations know only the shapes before it; FitStrong opened again is the newer build.
  const marker = await schemaMarker(handle);
  if (stopped()) { handle.close(); return; }
  if (typeof marker === 'number' && marker > SCHEMA_VERSION) {
    handle.close();
    enterMemory(new StoreFailure('stale', 'FitStrong was updated in another window.'));
    return;
  }
  const migrated = await migrateToV5(handle);
  if (stopped()) { handle.close(); return; }
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
  // Schema 5 → 6 (Plan 6): additive. A device that can't stamp it now keeps working, and tries again next start.
  await migrateToV6(handle);
  if (stopped()) { handle.close(); return; }

  let snap: Snapshot;
  try {
    snap = await readSnapshot(handle);
  } catch (error) {
    handle.close();
    if (!stopped()) enterMemory(toFailure(error, 'readFailed'));
    return;
  }
  if (stopped()) { handle.close(); return; }
  // Own foods logged before snapshots, given theirs once (board D146, H7R-01).
  snap = await giveSnapshots(handle, snap);
  if (stopped()) { handle.close(); return; }

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
  convertLegacyErase();
  // Recently deleted: what has passed its 7 days goes at every start, and the next one is waited for (D109).
  armExpiry();
  void expireDeleted();
}

/** The schema marker as stored, or nothing when there is none or it can't be read (`migrateToV5` then says why). */
async function schemaMarker(handle: Db): Promise<unknown> {
  try {
    return (await handle.get<Doc>('settings', 'schemaVersion'))?.value;
  } catch {
    return undefined;
  }
}

/**
 * B-05: an erase made before board D176 kept only when it ran
 * (`routesErasedAt`) and, as deleted, the routes it took. As the app starts,
 * it becomes this phone's erase record, conservatively: every route of a walk
 * begun by then (never later than now, so a clock that was ahead drops no
 * walk recorded since) and every route deleted here, by name. Until that is
 * stored, the old marker is read as it is (H6F-07, board D210).
 */
function convertLegacyErase(): void {
  const legacy = (s: Snapshot) => (s.settings?.walk as { routesErasedAt?: unknown } | undefined)?.routesErasedAt;
  if (typeof legacy(committed) !== 'number') return;
  void enqueue<void>({
    edit: false,
    plan: base => {
      const at = legacy(base);
      if (typeof at !== 'number') return { change: null, result: () => undefined };
      const { routesErasedAt: _old, ...walk } = walkSettings(base.settings ?? {}) as WalkSettings & { routesErasedAt?: number };
      void _old;
      const before = Math.max(walk.erased?.before ?? -Infinity, Math.min(at, Date.now()));
      const walks = [...new Set([...(walk.erased?.walks ?? []), ...(base.settings?.deleted?.records?.routes ?? [])])].sort();
      return { change: { settings: { patch: { walk: { ...walk, erased: { generation: erasedGeneration(walk), walks, before } } } } }, result: () => undefined };
    },
  });
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
  // Everything already stored stays on screen; only new changes go unsaved, and nothing new starts (P8S-04).
  wentReadOnly = true;
  setStorageReadOnly(true);
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
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void checkOutside();
      // And on every return (D109, P8-12).
      void expireDeleted();
    };
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
  admitting = true;
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
  memoryBase = undefined;
  storedSlices = { checkIns: [], observations: [] };
  lastFailure = undefined;
  migration = undefined;
  persisted = false;
  installed = undefined;
  listeners.clear();
  clockSeen = [];
  clockPending = [];
  if (expiryTimer !== undefined) clearTimeout(expiryTimer);
  expiryTimer = undefined;
  editListeners.clear();
  wentReadOnly = false;
  setStorageReadOnly(false);
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
export function freshId(prefix = ''): string {
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

/**
 * Change this phone's own walk answers, field by field, against the walk
 * settings the transaction finds (H6R-07, board D176): an answer given from
 * a screen opened before another tab erased routes, or changed the other
 * answer, never takes either back. `undefined` leaves a field as it is.
 */
export function setWalkSettings(patch: Partial<Pick<WalkSettings, 'saveRoutes' | 'map' | 'stepCardSeen'>>): Promise<StoreResult> {
  const given = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  return enqueue<void>({
    plan: base => ({ change: { settings: { patch: { walk: { ...walkSettings(base.settings ?? {}), ...given } } } }, result: () => undefined }),
  });
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
    // What has been read in Learn is no edit (D113).
    edit: false,
    plan: () => {
      if (typeof key !== 'string' || key === '') throw new StoreFailure('invalid', 'Content state needs a key.');
      return { change: { content: value === undefined ? { remove: [key] } : { put: { [key]: value } } }, result: () => undefined };
    },
  });
}

// ============================================================================
// The v2 record stores (Plan 6 Task 1; Plan 7 adds the food rules)
// ============================================================================

/**
 * One store's records, as one change: each is written under its key, over
 * any copy already there. A single record its store's rule refuses refuses
 * the batch, saying which, and nothing is written.
 */
export function putRecords(store: RecordStore, records: readonly StoredRecord[]): Promise<StoreResult> {
  return enqueue<void>({
    plan: () => {
      const refused: FailureDetail[] = [];
      records.forEach((r, index) => {
        const problem = recordProblem(store, r);
        if (!problem) return;
        // Read only off an object: this is where a caller's mistake becomes a refusal, not a fault.
        const key = typeof r === 'object' && r !== null ? recordKey(store, r) : '';
        refused.push({ index, ...(key ? { id: key } : {}), reason: problem });
      });
      if (refused.length > 0) {
        throw new StoreFailure('invalid', `Nothing was saved. ${refused.map(d => `${RECORD_RULES[store].label.one} ${d.index + 1}: ${d.reason}`).join('; ')}`, undefined, refused);
      }
      return { change: records.length ? { records: { [store]: { put: [...records] } } as Change['records'] } : null, result: () => undefined };
    },
  });
}

/** Remove records by key, remembered as deleted (D-06). Keys no longer stored are passed over. */
export function removeRecords(store: RecordStore, keys: readonly string[]): Promise<StoreResult> {
  const wanted = new Set(keys);
  return enqueue<void>({
    plan: base => {
      const present = base.records[store].map(r => recordKey(store, r)).filter(k => wanted.has(k));
      return { change: present.length ? { records: { [store]: { remove: present } } as Change['records'] } : null, result: () => undefined };
    },
  });
}

/** Records to put and keys to remove, store by store. */
export interface RecordsWrite {
  put?: Partial<Record<RecordStore, readonly StoredRecord[]>>;
  remove?: Partial<Record<RecordStore, readonly string[]>>;
}

/**
 * Records in several stores as one change (Plan 7): a meal saved with a new
 * usual meal and the person's own foods. Every put is checked first, and one
 * refusal writes nothing. Keys no longer stored are passed over. Given a
 * plan, it's worked out against the records as stored when it's written, as
 * every mutation is, and may refuse by throwing a `StoreFailure` (a
 * correction of a meal changed or deleted elsewhere, H7-08).
 */
export function writeRecords(write: RecordsWrite | ((records: Readonly<Records>) => RecordsWrite)): Promise<StoreResult> {
  return enqueue<void>({
    plan: base => {
      const w = typeof write === 'function' ? write(base.records) : write;
      const refused: FailureDetail[] = [];
      const records: NonNullable<Change['records']> = {};
      for (const store of RECORD_STORES) {
        const put = w.put?.[store] ?? [];
        put.forEach((r, index) => {
          const problem = recordProblem(store, r);
          if (problem) refused.push({ index, ...(recordKey(store, r) ? { id: recordKey(store, r) } : {}), reason: `${RECORD_RULES[store].label.one} ${index + 1}: ${problem}` });
        });
        const wanted = new Set(w.remove?.[store] ?? []);
        const remove = base.records[store].map(r => recordKey(store, r)).filter(k => wanted.has(k));
        if (put.length > 0 || remove.length > 0) records[store] = { ...(put.length > 0 ? { put: [...put] } : {}), ...(remove.length > 0 ? { remove } : {}) };
      }
      if (refused.length > 0) throw new StoreFailure('invalid', `Nothing was saved. ${refused.map(d => d.reason).join('; ')}`, undefined, refused);
      return { change: Object.keys(records).length > 0 ? { records } : null, result: () => undefined };
    },
  });
}

// ============================================================================
// A walk: its recovery journal, and saving it with its route (journey §9.4, §18.3)
// ============================================================================

/**
 * A walk's recovery checkpoint, written straight to the journal store: outside
 * the record, so it moves no revision and reaches no other tab or backup.
 * Nothing is kept while storage is unavailable. Its route goes in only on
 * this phone's yes and for a walk no "Erase all routes" has erased, both as
 * stored, read in the write's own transaction: a checkpoint from a tab that
 * hasn't heard yet never writes coordinates back (H6R-06, board D176).
 */
export function putWalkJournal(entry: JournalEntry, options: { keepJournalled?: boolean } = {}): Promise<StoreResult<JournalEntry>> {
  const handle = db;
  if (!handle) return Promise.resolve({ ok: false, failure: unavailableFailure() });
  /** What the transaction stored, which the page's copy takes once it is (H6F-08). */
  let written = entry;
  const put = (tx: TxHandle, e: JournalEntry) => { written = e; tx.put(JOURNAL_STORE, e); };
  const gen = entry.walk.recordGen;
  return handle.transact(tx => {
    const write = () => {
      if (!entry.route) return put(tx, entry);
      tx.get('settings', 'settings', row => {
        const walk = ((row as Doc | undefined)?.value as UserSettings | undefined)?.walk;
        const keeps = walk?.saveRoutes === true && !routeErased(walk, entry.id, entry.walk.plan, entry.walk.startedAt);
        if (!keeps) return put(tx, (({ route: _gone, ...rest }) => { void _gone; return rest; })(entry));
        if (!options.keepJournalled) return put(tx, entry);
        // A page still reading the route back: the lines held stay beside what it walked since (H6R-10).
        tx.get(JOURNAL_STORE, entry.id, stored => put(tx, { ...entry, route: withJournalled(parseJournalEntry(stored)?.route, entry.route)! }));
      });
    };
    if (gen === undefined) return write();
    // A walk of a record since replaced, or deleted in this tab or another, writes nothing back (F-data-01):
    // asked of the record's generation as stored, in this transaction.
    tx.get('settings', 'generation', row => {
      if (Number((row as Doc | undefined)?.value ?? 0) !== gen) throw new StoreFailure('conflict', REPLACED);
      write();
    });
  }).then(result => (result.ok ? { ok: true, value: written } : result));
}

/** Every readable checkpoint on this device. One that can't be read is left out, never guessed. */
export async function readWalkJournals(): Promise<StoreResult<JournalEntry[]>> {
  const handle = db;
  if (!handle) return { ok: true, value: [] };
  try {
    const rows = await handle.getAll<unknown>(JOURNAL_STORE);
    return { ok: true, value: rows.map(parseJournalEntry).filter((e): e is JournalEntry => e !== null) };
  } catch (error) {
    return { ok: false, failure: toFailure(error, 'readFailed') };
  }
}

/** Retire checkpoints whose walks are already saved: tidying, never a walk. */
export function retireWalkJournals(ids: readonly string[]): Promise<StoreResult> {
  const handle = db;
  if (!handle || ids.length === 0) return Promise.resolve({ ok: true, value: undefined });
  return handle.transact(tx => { for (const id of ids) tx.delete(JOURNAL_STORE, id); });
}

export interface SaveWalkInput {
  walkId: string;
  /** Every record of the walk, with stable ids (`walkObservations`). Those already stored are left as they are. */
  observations: readonly WalkInput[];
  /** Only when the person keeps routes. */
  route?: RouteRecord;
  /**
   * The walk keeps its route, which began at this moment (ISO with its
   * offset): with no `route` given, the one in the walk's journal is read
   * inside the save's own transaction (H6-06). A route still loading on
   * screen, or never read back after a reload, is then never lost when the
   * journal is retired with the save.
   */
  routeStartedAt?: string;
  /** The erase generation the walk began in (`WalkPlan.routeGen`): an "Erase all routes" since, and no route is kept (B-05). */
  routeGen?: number;
  /** The record's generation the walk began in (`Walk.recordGen`): replaced or deleted since, and nothing is saved (F-data-01). */
  recordGen?: number;
}

/** The route a walk's journal entry holds, as the routes store keeps it, or nothing. */
function journalRoute(raw: unknown, walkId: string, startedAt: string): RouteRecord | undefined {
  const lines = parseJournalEntry(raw)?.route;
  return lines ? routeRecord(walkId, startedAt, lines) : undefined;
}

/**
 * A walk, its route and the retirement of its recovery state, in one
 * transaction (journey §18.3, A-55). A retry, or a second tap, writes only
 * what is missing; the journal goes either way, and with the route it held.
 */
export function saveWalk(input: SaveWalkInput): Promise<StoreResult> {
  const fixed = input.observations.map(o => ({ ...o, at: o.at ?? nowAt() }));
  const startedAt = input.route?.startedAt ?? input.routeStartedAt;
  return enqueue<void>({
    ...(startedAt !== undefined ? { journal: [input.walkId] } : {}),
    plan: (base, read) => {
      // A walk of a record since replaced, or deleted here or in another tab, saves nothing into the next one (F-data-01).
      if (input.recordGen !== undefined && base.generation !== input.recordGen) throw new StoreFailure('conflict', REPLACED);
      const wanted = new Set(fixed.map(o => o.id));
      const held = new Set(base.observations.filter(o => wanted.has(o.id)).map(o => o.id));
      const records = fixed.filter(o => !held.has(o.id)).map(o => newObservation(o));
      // The screen's route with the journal's, read in this transaction: a screen that never read
      // back the route walked before a reload saves both, as does one that has none (H6-06, H6R-10).
      const journalled = startedAt !== undefined && read ? journalRoute(read.journal[input.walkId], input.walkId, startedAt) : undefined;
      const lines = withJournalled(journalled?.segments, input.route?.segments);
      const given = lines && startedAt !== undefined ? routeRecord(input.walkId, startedAt, lines) : undefined;
      // Never a route of a walk an "Erase all routes" erased, whichever screen saves it: by this
      // phone's own count of erases and the walk's id, never its clock (B-05, K6R-12, board D176),
      // or one an erase made before board D176 erased, by when it began (H6F-07, board D210).
      const erased = given !== undefined
        && routeErased(base.settings?.walk, input.walkId, { ...(input.routeGen !== undefined ? { routeGen: input.routeGen } : {}) }, Date.parse(given.startedAt));
      let route: StoredRecord | undefined;
      // Kept only on this phone's yes, as it is when the walk is saved, whatever the walk was given (H6-04).
      if (given && !erased && base.settings?.walk?.saveRoutes === true) {
        const problem = recordProblem('routes', given);
        if (problem) throw new StoreFailure('invalid', `The route could not be saved: ${problem}.`);
        if (!base.records.routes.some(r => r.walkId === input.walkId)) route = given as unknown as StoredRecord;
      }
      return {
        change: {
          ...(records.length > 0 ? { observations: { put: records } } : {}),
          ...(route ? { records: { routes: { put: [route] } } } : {}),
          journal: { remove: [input.walkId] },
        },
        result: () => undefined,
      };
    },
  });
}

/**
 * B-05: every route on this device erased for good, in one transaction: the
 * saved routes (remembered as deleted, so no merge brings them back), the
 * route in every walk journal, read and rewritten inside the same
 * transaction so no checkpoint slips between, and, through this phone's
 * count of erases (`settings.walk.erased`), which every tab's live walk
 * watches, the route a walk is recording now. From then on no route of a
 * walk that began before it is kept, by a save, a checkpoint or an import:
 * by that count and the routes' walk ids, never the clock (H6R-08, K6R-12,
 * board D176). The walks stay. Recently deleted's entries lose their routes
 * in the same transaction, and a `settings.deleted.recent` goes (D93, D109).
 */
export function eraseRoutes(): Promise<StoreResult> {
  return enqueue<void>({
    // Shown only once stored: every tab forgets its routes on seeing it, which a failed erase must not set off (H6R-09).
    hold: true,
    journal: 'all',
    plan: (base, read) => {
      const keys = base.records.routes.map(r => recordKey('routes', r));
      const stripped = Object.values(read?.journal ?? {})
        .filter((e): e is { id: string; route?: unknown } => typeof e === 'object' && e !== null && 'route' in e && typeof (e as { id?: unknown }).id === 'string')
        .map(({ route: _erased, ...rest }) => { void _erased; return rest; });
      // Every route by name, saved, deleted before or journalled, and the count of erases moved on (H6R-08).
      const journals = Object.values(read?.journal ?? {}).flatMap(e => (typeof e === 'object' && e !== null && typeof (e as { id?: unknown }).id === 'string' ? [(e as { id: string }).id] : []));
      const walk = withErase(walkSettings(base.settings ?? {}), [...keys, ...journals, ...(base.settings?.deleted?.records?.routes ?? [])]);
      // Every carrier of a coordinate, in this same transaction (B-05, D109): Recently deleted's
      // entries, and a `settings.deleted.recent` a file once left here.
      const recent = recentWithoutRoutes(base.content);
      const carried = withoutRecentCarrier(base.settings);
      return {
        change: {
          ...(keys.length > 0 ? { records: { routes: { remove: keys } } } : {}),
          ...(stripped.length > 0 ? { journal: { put: stripped } } : {}),
          ...(recent ? { content: recent } : {}),
          settings: { patch: { walk, ...(carried !== base.settings ? { deleted: carried?.deleted } : {}) } },
        },
        result: () => undefined,
      };
    },
  });
}

/**
 * B-19: the clock generation a glucose reading acquired now is stamped with
 * (`acquiredIn`), by the screen that takes it, as the device has kept its
 * changes to the clock (H6R-03, board D186).
 */
export function acquisitionStamp(): number {
  return clockGeneration(state.settings);
}

/** B-19: the changes to the clock this page has marked, each by the observation that saw it (H6F-04). */
let clockSeen: { seen: ClockSeen; marked: Promise<StoreResult> }[] = [];
/** B-19: how soon a refused clock marker is written again (H6F-02). */
export const CLOCK_RETRY_MS = 5_000;

/** A change to the phone's clock seen here and not stored yet (`markClockChange`): a restart would lose it, so none happens meanwhile (D106 with H6F-02). */
export const clockChangeWaiting = (): boolean => clockPending.length > 0;

/**
 * B-19: a walk or the page saw this phone's clock change. The device's clock
 * generation moves on, against the settings this transaction finds, so
 * another tab's change is never lost; from then on every movement gate holds
 * someone who can go low until a reading acquired since, a finished walk's
 * next start included (H6R-02, board D174). A change this page has already
 * marked, seen again by its own observation (`seen`), is not marked twice:
 * a walk and the page watching the same moment (H6F-04, board D187).
 *
 * Held from the moment it is seen (`clockHold`), never shown as stored
 * before it is, and written again until it is: a refused write takes
 * nothing back, and nothing acquired meanwhile is stamped with a generation
 * the device hasn't kept (H6F-02, board D188). Resolves once stored; with
 * nowhere to store at all, once held for this session as everything is.
 */
export function markClockChange(days: readonly string[], seen?: ClockSeen): Promise<StoreResult> {
  const known = seen && clockSeen.find(c => sameClockChange(c.seen, seen));
  if (known) return known.marked;
  // Shown by the write's own publish, and by every one until it is stored.
  const mine = generation;
  const waiting = [...days];
  clockPending = [...clockPending, waiting];
  const write = async (): Promise<StoreResult> => {
    const result = await enqueue<void>({
      hold: true,
      safety: true,
      edit: false,
      plan: base => ({ change: { settings: { patch: { walk: withClockChange(walkSettings(base.settings ?? {}), days) } } }, result: () => undefined }),
    });
    if (!result.ok && db) {
      await new Promise(resolve => setTimeout(resolve, CLOCK_RETRY_MS));
      // A test's reset ends it: nothing from an earlier test writes into the next.
      return mine === generation ? write() : result;
    }
    clockPending = clockPending.filter(d => d !== waiting);
    publish();
    return result;
  };
  const marked = write();
  if (seen) clockSeen.push({ seen, marked });
  return marked;
}

/** A walk, its route and its recovery state gone in one transaction (F09). Only the observations named go; the walk's pain ratings can stay. */
export function removeWalk(walkId: string, observationIds: readonly string[]): Promise<StoreResult> {
  const wanted = new Set(observationIds);
  return enqueue<void>({
    plan: base => {
      const present = base.observations.filter(o => wanted.has(o.id)).map(o => o.id);
      const route = base.records.routes.some(r => r.walkId === walkId);
      return {
        change: {
          ...(present.length > 0 ? { observations: { remove: present } } : {}),
          ...(route ? { records: { routes: { remove: [walkId] } } } : {}),
          journal: { remove: [walkId] },
        },
        result: () => undefined,
      };
    },
  });
}

/**
 * A routine delete (B-04, D109, D111): the record and everything that belongs
 * to it go in one change, kept for 7 days as one Recently deleted entry.
 * Resolves with the entry's id, which Undo and Recently deleted restore by.
 */
export function deleteRecord(request: DeleteRequest): Promise<StoreResult<string>> {
  const entry = freshId('deleted-');
  const at = nowAt();
  return enqueue<string>({
    edit: false,
    plan: base => ({ change: planDeletion(request, base, { entry, at }).change, result: () => entry }),
  });
}

/** Undo, or Restore in Recently deleted (B-05, D110): fresh ids, references rewritten, the entry dropped, in one change. */
export function restoreDeleted(entryId: string): Promise<StoreResult<Restored>> {
  const fresh = { stem: freshId(), walkId: newWalkId(Date.now()) };
  return enqueue<Restored>({
    edit: false,
    timed: true,
    plan: base => {
      const planned = planRestore(entryId, base, fresh, Date.now());
      return { change: planned.change, result: () => planned.restored };
    },
  });
}

/**
 * Recently deleted's expiry, and the carrier it never writes (D109, P8-11,
 * P8-12, K8-01), in one transaction: at every start, on every return to the
 * app, and at the moment the next entry's 7 days end while the page runs, so
 * nothing outlives its 7 days whatever else happens or doesn't. Background
 * work: no Undo ends for it.
 */
export function expireDeleted(): Promise<StoreResult> {
  return enqueue<void>({
    edit: false,
    timed: true,
    plan: base => {
      const due = expiryPlan(base.content, Date.now());
      const settings = withoutRecentCarrier(base.settings);
      const change: Change = {
        ...(due ? { content: due } : {}),
        ...(settings !== base.settings ? { settings: { patch: { deleted: settings?.deleted } as Partial<UserSettings> } } : {}),
      };
      return { change: Object.keys(change).length > 0 ? change : null, result: () => undefined };
    },
  });
}

let expiryTimer: ReturnType<typeof setTimeout> | undefined;

/** Waits, while the page runs, for the next entry's 7 days to end, then expires it with nothing else needed (P8R-14). */
function armExpiry(): void {
  if (expiryTimer !== undefined) clearTimeout(expiryTimer);
  expiryTimer = undefined;
  const due = mode === 'ready' ? nextExpiry(committed.content) : undefined;
  if (due === undefined) return;
  // ponytail: a timer waits at most setTimeout's own ceiling, about 24.8 days; one due later (a clock set
  // back) wakes then, finds nothing due, and waits again.
  expiryTimer = setTimeout(() => {
    expiryTimer = undefined;
    void expireDeleted().then(() => { if (expiryTimer === undefined) armExpiry(); });
  }, Math.min(2 ** 31 - 1, Math.max(1000, due - Date.now())));
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
    // The person's confirmed choice to erase everything: the engine isn't asked (D119).
    erasesAll: true,
    // Nothing is shown as cleared until it is (J18).
    hold: true,
    // With nothing it can store to, it can delete nothing there either: it
    // refuses, so what it says and what it does agree (C2-08). Clearing the
    // screen and the small flags alone would look like a deletion that never
    // reached the record.
    needsStorage: 'This app cannot reach this device’s storage right now, so it cannot delete what is kept there. Close the app, open it again, and try again.',
    plan: () => ({ change: { reset: true, schemaVersion: SCHEMA_VERSION }, result: () => undefined }),
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
    // A summary that changed or arrived lifts its readings; one removed keeps
    // them. A reading the person deleted stays deleted, even while a record
    // still names it (R5-01).
    const deleted = new Set(base.settings?.deleted?.readings ?? []);
    const dates = new Set(checkIns.map(c => c.date));
    for (const date of dates) {
      const was = (before.checkIns ?? []).filter(c => c.date === date);
      const is = checkIns.filter(c => c.date === date);
      if (sameValue(was, is)) continue;
      for (const record of is) {
        const lifted = liftCheckIn(record, { existing: pool(), ...(was.length > 0 ? { previous: was[was.length - 1] } : {}), now, readings, deleted });
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
   * Only worth doing if it is stored, as with clear-all and an import: with
   * nothing to store to, it is refused with this message before anything
   * changes, even in this session's memory. Finishing setup is one such
   * change, since without saving its safety gap must stay (B-07; H5-06).
   */
  needsStorage?: string;
  /**
   * Readings to delete in the same write: a check-in's reading taken out of
   * the record and the series together, so neither brings the other back on
   * the next save (scan C2-01). An id no longer stored is passed over. A list,
   * or worked out from what is stored when the change is planned.
   */
  removeObservations?: readonly string[] | ((base: Snapshot) => readonly string[]);
  /**
   * Readings recorded in the same write: the weight, height and waist an edit
   * of the profile states, each a dated reading (journey §18.1). Their ids and
   * times are fixed here, so a re-plan never makes a second record.
   */
  addObservations?: readonly ObservationInput[];
  /**
   * The readings are added only when this holds of the change as planned
   * against what is stored: a write its own updater turns down (setup
   * finished in another tab, say) adds none of them (H5-09).
   */
  addObservationsWhen?: (before: AppData, after: AppData) => boolean;
  /**
   * Planned for this record (`StoreState.epoch` when it was asked for): once
   * a backup has replaced it or everything was deleted, here or in another
   * copy, the write is refused, inside its transaction (H5R-09).
   */
  generation?: number;
  /**
   * Content-state rows written in the same transaction (Plan 8): a Recently
   * deleted entry, a lineage row. Asked after the updater, with the snapshot
   * the change is planned on, so it can hold what the updater found and what
   * is stored with it.
   */
  content?: (base: Snapshot) => { put?: Record<string, unknown>; remove?: readonly string[] } | undefined;
  /**
   * The Recently deleted entry this change restores (B-05): still restorable
   * when the change is stored, or nothing is written (P8R-14); used up in the
   * same change.
   */
  entry?: string;
  /**
   * Rows a restore brings back as they are, under their fresh ids (D110).
   * Asked after the updater; one the updater's own lifting would make under
   * the same id is this row instead, so nothing is worked out again from an
   * older field (P8S-06).
   */
  restored?: () => readonly Observation[];
  /** Not an edit the person made: a delete or a restore (D113). */
  edit?: false;
}

/** A write planned for a record that has since been replaced (H5R-09). */
export const REPLACED = 'This was for a record that has since been replaced on this device, by a restored backup or by deleting everything, so it wasn’t saved.';

export function update(updater: (previous: AppData) => AppData, options: UpdateOptions = {}): Promise<StoreResult> {
  const now = nowAt();
  const adding = (options.addObservations ?? []).map(input => ({ ...input, id: input.id ?? freshId(), at: input.at ?? now }));
  return enqueue<void>({
    ...(options.hold ? { hold: true } : {}),
    ...(options.needsStorage ? { needsStorage: options.needsStorage } : {}),
    ...(options.edit === false ? { edit: false as const } : {}),
    ...(options.entry !== undefined ? { timed: true as const } : {}),
    plan: base => {
      // A restore, asked of what is stored as it commits (P8R-14, P8S-09).
      if (options.entry !== undefined && !restorable(base.content, options.entry, Date.now())) throw new StoreFailure('invalid', NOT_RECENT);
      if (options.generation !== undefined && base.generation !== options.generation) throw new StoreFailure('conflict', REPLACED);
      const before = appDataOf(base);
      // A copy: an updater that edits in place — the old `localStorage` habit —
      // cannot reach into live state, and the edit still shows as a difference.
      const after = updater(structuredClone(before));
      const described = describeUpdate(base, before, after, now, options.readings ?? 'append');
      const removing = typeof options.removeObservations === 'function' ? options.removeObservations(base) : options.removeObservations ?? [];
      const doomed = new Set(removing.filter(id => findObservation(base, id)));
      // An invalid reading throws here, so the whole write is refused before anything shows.
      // One already stored, from an earlier plan of this same write, isn't added twice.
      const wanted = options.addObservationsWhen?.(before, after) ?? true;
      const added = wanted ? adding.filter(input => !findObservation(base, input.id)).map(input => newObservation(input)) : [];
      const observations = described?.observations;
      const change: Change | null = doomed.size === 0 && added.length === 0 ? described : {
        ...described,
        observations: {
          ...observations,
          put: [...(observations?.put ?? []).filter(o => !doomed.has(o.id)), ...added],
          remove: [...(observations?.remove ?? []), ...doomed],
        },
      };
      // Recently deleted's entry, the lineage, and the rows a restore brings back as they were (D110).
      const extra = options.content?.(base);
      const used = options.entry !== undefined ? [recentKey(options.entry)] : [];
      const rows = options.restored?.() ?? [];
      const back = new Set(rows.map(o => o.id));
      const contentChange = extra || used.length > 0 ? {
        put: { ...(change?.content?.put ?? {}), ...(extra?.put ?? {}) },
        remove: [...(change?.content?.remove ?? []), ...(extra?.remove ?? []), ...used],
      } : undefined;
      const withExtra: Change | null = contentChange || rows.length > 0 ? {
        ...(change ?? {}),
        ...(contentChange ? { content: contentChange } : {}),
        ...(rows.length > 0 ? {
          observations: {
            ...change?.observations,
            put: [...(change?.observations?.put ?? []).filter(o => !back.has(o.id)), ...rows],
            remove: (change?.observations?.remove ?? []).filter(id => !back.has(id)),
            // Each keeps the place it was said in, as every restore does (D110).
            kept: [...back],
          },
        } : {}),
      } : change;
      return { change: withExtra, result: () => undefined };
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
      // This copy is the newer one: an older connection hasn't let go (D107).
      case 'blocked':
        return {
          tone: 'warning',
          title: 'Close FitStrong’s other tabs',
          detail: 'Another tab or window still has an older version of FitStrong open, so nothing is being saved here yet. Close the other tabs of FitStrong, and this one carries on by itself.',
        };
      // This copy is the older one (D107).
      case 'stale':
        return {
          tone: 'warning',
          title: 'A newer version of FitStrong is open',
          detail: 'FitStrong is open somewhere else with a newer version. Close this window and open FitStrong again. Nothing is saved here until then; your saved records are safe.',
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
  /** The v2 record stores the file holds. */
  stores: RecordStore[];
  /** The record is past a limit a restore applies: it still holds everything (D108). */
  warning?: string;
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
export function exportRecord(options: ExportOptions = {}): Promise<StoreResult<ExportedRecord>> {
  return enqueueTask(async () => {
    try {
      const snap = db ? await readSnapshot(db) : committed;
      // A copy that had not caught up now has, at no extra cost.
      if (db && snap.revision !== committed.revision) adopt(snap);
      const exportedAt = nowAt();
      const doc = toTransferDoc(snap, exportedAt, options);
      const file = await encode(doc);
      const excess = exportExcess(doc, { packed: file.bytes.byteLength, unpacked: file.textBytes });
      return { ok: true as const, value: { ...file, revision: snap.revision, exportedAt, stores: doc.stores ?? [], ...(excess ? { warning: exportWarning(excess) } : {}) } };
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
    // Restored into a session that keeps nothing, it would show a record
    // that is not there, beside a message saying nothing changed.
    needsStorage: 'This app cannot reach this device’s storage right now, so the backup was not restored. Close the app, open it again, and try again.',
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
