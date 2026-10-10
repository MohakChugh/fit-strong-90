/**
 * The whole record as one value, and the one way it changes.
 *
 * Every write — a tap, an update, a migration, an import, clear-all — is a
 * `Change` applied to a `Snapshot` by `prepare`, a pure function, and stored
 * by `commitChange` in a single transaction across every store. That one
 * shape is what fixes a family of review findings at once:
 *
 * - **Atomic** (F01, F05, F13, F24). A logical change touches several stores
 *   and commits together or not at all.
 * - **Never from a stale copy** (F04). `commitChange` reads `revision` inside
 *   the write transaction. If another open copy has written since this one
 *   last looked, everything is re-read *in that same transaction* and the
 *   change is planned again against what is really stored. IndexedDB runs
 *   readwrite transactions over overlapping stores one at a time, so nothing
 *   can slip in between the read and the write.
 * - **Ordered** (cross-copy ties). Each commit stamps `seq = revision` on the
 *   observations it writes, so "the later statement wins" means the later
 *   commit in every copy.
 */

import type { BodyMetric, PersonalRecord, UserSettings, WorkoutSession } from '@/types';
import type { CheckInRecord, DailyCheckIn } from '@/types/checkin';
import type { DayFocus } from '@/types/plan';
import type { UserProfile } from '@/types/profile';
import { compareObservations, type Observation } from '@/health/observation';
import { withLogged } from '@/engine/readiness';
import { doc, type Db, type Doc, type Rows, type StoreFailure, type StoreName, type TxHandle } from './db';
import { readingKey } from './project';

export interface Snapshot {
  /** Moves on every commit; equal revisions mean equal contents. */
  revision: number;
  schemaVersion?: number;
  /** In `compareObservations` order. */
  observations: Observation[];
  /** Newest date first, then by id. */
  sessions: WorkoutSession[];
  /** As stored. Defaults are filled where it is read, not written in. */
  settings?: UserSettings;
  profile?: UserProfile;
  checkIns: CheckInRecord[];
  personalRecords: PersonalRecord[];
  bodyMetrics: BodyMetric[];
  focusOverrides: Record<string, DayFocus>;
  /** The `content-state` store: per-article reading state and the like. */
  content: Record<string, unknown>;
}

export function emptySnapshot(revision = 0): Snapshot {
  return {
    revision,
    observations: [],
    sessions: [],
    checkIns: [],
    personalRecords: [],
    bodyMetrics: [],
    focusOverrides: {},
    content: {},
  };
}

export interface Change {
  /** Empty every store first: clear-all, and an import that replaces. */
  reset?: boolean;
  /** Write the schema marker. */
  schemaVersion?: number;
  /**
   * `keepOrder`: the puts' own `seq` values give their commit order within
   * this change — an import keeps the order its file's records were said in
   * (J05). They are restamped as consecutive commit numbers after the base,
   * a put with none first, and the commit ends on the last.
   */
  observations?: { put?: Observation[]; remove?: string[]; keepOrder?: boolean };
  sessions?: { put?: WorkoutSession[]; remove?: string[] };
  /**
   * Field by field, so that two writers each changing one setting both land:
   * `patch` sets fields, `unset` removes optional ones, `replace` swaps the
   * whole document (a migration, an import).
   */
  settings?: { patch?: Partial<UserSettings>; unset?: string[]; replace?: UserSettings };
  /** Sets the profile; `null` removes it; absent (or `undefined`) leaves it alone. */
  profile?: UserProfile | null;
  checkIns?: CheckInRecord[];
  personalRecords?: PersonalRecord[];
  bodyMetrics?: BodyMetric[];
  focusOverrides?: Record<string, DayFocus>;
  content?: { put?: Record<string, unknown>; remove?: string[] };
}

export type Write =
  | { op: 'clear'; store: StoreName }
  | { op: 'put'; store: StoreName; value: object }
  | { op: 'delete'; store: StoreName; key: string };

export interface Prepared {
  next: Snapshot;
  /** Exactly what the transaction does, decided before it opens. */
  writes: Write[];
}

/** Newest date first, then id, so the order never depends on insertion. */
export function bySessionOrder(a: WorkoutSession, b: WorkoutSession): number {
  return a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** The last of each id: a change that names a record twice means the later one. */
function lastById<T extends { id: string }>(list: readonly T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of list) byId.set(item.id, item);
  return [...byId.values()];
}

/**
 * Insert into an already-sorted list without re-sorting it: a lifetime of
 * readings is hundreds of thousands of rows, and a tap should not sort them.
 */
function mergeObservations(list: readonly Observation[], puts: readonly Observation[], removes: readonly string[]): Observation[] {
  if (puts.length === 0 && removes.length === 0) return list as Observation[];
  const drop = new Set(removes);
  for (const p of puts) drop.add(p.id);
  const kept = list.filter(o => !drop.has(o.id));
  // Two sorted lists, merged in one pass: inserting each put in its place
  // would move the list once per put, which a restore of a lifetime of
  // readings cannot afford (C2-04). A record equal in order to one already
  // there goes after it.
  const added = [...puts].sort(compareObservations);
  const out: Observation[] = new Array(kept.length + added.length);
  let i = 0;
  let j = 0;
  let k = 0;
  while (i < kept.length && j < added.length) out[k++] = compareObservations(kept[i], added[j]) <= 0 ? kept[i++] : added[j++];
  while (i < kept.length) out[k++] = kept[i++];
  while (j < added.length) out[k++] = added[j++];
  return out;
}

function mergeSessions(list: readonly WorkoutSession[], puts: readonly WorkoutSession[], removes: readonly string[]): WorkoutSession[] {
  if (puts.length === 0 && removes.length === 0) return list as WorkoutSession[];
  const drop = new Set(removes);
  for (const p of puts) drop.add(p.id);
  return [...list.filter(s => !drop.has(s.id)), ...puts].sort(bySessionOrder);
}

/**
 * Remember the ids a change deletes, and forget those it writes again (D-06),
 * in the settings, so a backup carries them. The same settings back when
 * nothing about them changes.
 */
type Ids = { observations: readonly string[]; sessions: readonly string[]; readings: readonly string[] };

function withDeleted(settings: UserSettings | undefined, gone: Ids, written: Ids): UserSettings | undefined {
  const was = settings?.deleted;
  if (!was && gone.observations.length === 0 && gone.sessions.length === 0 && gone.readings.length === 0) return settings;
  const step = (list: readonly string[] | undefined, add: readonly string[], back: readonly string[]) => {
    const out = new Set(list);
    for (const id of back) out.delete(id);
    for (const id of add) out.add(id);
    return out.size > 0 ? [...out] : undefined;
  };
  const observations = step(was?.observations, gone.observations, written.observations);
  const sessions = step(was?.sessions, gone.sessions, written.sessions);
  const readings = step(was?.readings, gone.readings, written.readings);
  const same = (a: readonly string[] | undefined, b: readonly string[] | undefined) =>
    (a?.length ?? 0) === (b?.length ?? 0) && (a ?? []).every((id, i) => id === b?.[i]);
  if (same(observations, was?.observations) && same(sessions, was?.sessions) && same(readings, was?.readings)) return settings;
  const next = { ...(settings ?? {}) } as UserSettings;
  if (observations || sessions || readings) {
    next.deleted = { ...(observations ? { observations } : {}), ...(sessions ? { sessions } : {}), ...(readings ? { readings } : {}) };
  } else delete next.deleted;
  return next;
}

/** The check-in readings among these, as what was measured (R5-01). */
function keysOf(list: readonly Observation[]): string[] {
  return list.map(readingKey).filter((key): key is string => key !== undefined);
}

/** The records with these ids, looked up once: only for a change that deletes, which is rare. */
function withIds(list: readonly Observation[], ids: readonly string[]): Observation[] {
  if (ids.length === 0) return [];
  const wanted = new Set(ids);
  return list.filter(o => wanted.has(o.id));
}

/**
 * Apply a change. Pure: the same base and change always give the same next
 * snapshot and the same writes, and slices the change does not touch keep
 * their identity — which is what lets a screen's memo survive a commit.
 */
export function prepare(base: Snapshot, change: Change): Prepared {
  const given = lastById(change.observations?.put ?? []);
  // Every observation this commit writes carries its commit order: one number
  // for the commit, or with `keepOrder` one per step of the order it was given.
  const steps = change.observations?.keepOrder ? [...new Set(given.map(o => o.seq ?? -1))].sort((a, b) => a - b) : [];
  const revision = base.revision + Math.max(1, steps.length);
  const from = change.reset ? emptySnapshot(base.revision) : base;

  // Each step's place, looked up rather than searched for (C2-04).
  const rank = new Map(steps.map((step, i) => [step, i]));
  const puts = given.map(o => ({ ...o, seq: steps.length ? base.revision + 1 + rank.get(o.seq ?? -1)! : revision }));
  const removes = change.observations?.remove ?? [];
  const sessionPuts = lastById(change.sessions?.put ?? []);
  const sessionRemoves = change.sessions?.remove ?? [];

  let settings = from.settings;
  if (change.settings) {
    if (change.settings.replace) settings = change.settings.replace;
    if (change.settings.patch || change.settings.unset) {
      const next = { ...(settings ?? {}), ...(change.settings.patch ?? {}) } as Record<string, unknown>;
      for (const field of change.settings.unset ?? []) delete next[field];
      settings = next as unknown as UserSettings;
    }
  }

  // A check-in reading is also remembered by what was measured, which a merge
  // and every later lift go by (R5-01).
  settings = withDeleted(
    settings,
    { observations: removes, sessions: sessionRemoves, readings: keysOf(withIds(from.observations, removes)) },
    // Only the readings a put is not already remembering as deleted need looking at.
    { observations: puts.map(o => o.id), sessions: sessionPuts.map(s => s.id), readings: settings?.deleted?.readings?.length ? keysOf(puts) : [] },
  );

  let content = from.content;
  if (change.content) {
    content = { ...content, ...(change.content.put ?? {}) };
    for (const key of change.content.remove ?? []) delete content[key];
  }

  const next: Snapshot = {
    revision,
    ...((change.schemaVersion ?? from.schemaVersion) !== undefined ? { schemaVersion: change.schemaVersion ?? from.schemaVersion } : {}),
    observations: mergeObservations(from.observations, puts, removes),
    sessions: mergeSessions(from.sessions, sessionPuts, sessionRemoves),
    ...(settings !== undefined ? { settings } : {}),
    ...(change.profile === null ? {} : change.profile !== undefined ? { profile: change.profile } : from.profile !== undefined ? { profile: from.profile } : {}),
    checkIns: change.checkIns ?? from.checkIns,
    personalRecords: change.personalRecords ?? from.personalRecords,
    bodyMetrics: change.bodyMetrics ?? from.bodyMetrics,
    focusOverrides: change.focusOverrides ?? from.focusOverrides,
    content,
  };

  const writes: Write[] = [];
  const docs = (keys: Doc['key'][]) => {
    for (const key of keys) {
      const value = docValue(next, key);
      if (value === undefined) writes.push({ op: 'delete', store: 'settings', key });
      else writes.push({ op: 'put', store: 'settings', value: doc(key, value) });
    }
  };

  if (change.reset) {
    for (const store of ['observations', 'sessions', 'settings', 'content-state'] as const) writes.push({ op: 'clear', store });
    for (const o of next.observations) writes.push({ op: 'put', store: 'observations', value: o });
    for (const s of next.sessions) writes.push({ op: 'put', store: 'sessions', value: s });
    for (const [key, value] of Object.entries(next.content)) writes.push({ op: 'put', store: 'content-state', value: { key, value } });
    for (const key of ['schemaVersion', 'settings', 'profile', 'checkIns', 'personalRecords', 'bodyMetrics', 'focusOverrides'] as const) {
      const value = docValue(next, key);
      if (value !== undefined) writes.push({ op: 'put', store: 'settings', value: doc(key, value) });
    }
  } else {
    for (const id of removes) writes.push({ op: 'delete', store: 'observations', key: id });
    for (const o of puts) writes.push({ op: 'put', store: 'observations', value: o });
    for (const id of sessionRemoves) writes.push({ op: 'delete', store: 'sessions', key: id });
    for (const s of sessionPuts) writes.push({ op: 'put', store: 'sessions', value: s });
    if (change.schemaVersion !== undefined) docs(['schemaVersion']);
    if (change.settings || settings !== from.settings) docs(['settings']);
    if (change.profile !== undefined) docs(['profile']);
    if (change.checkIns) docs(['checkIns']);
    if (change.personalRecords) docs(['personalRecords']);
    if (change.bodyMetrics) docs(['bodyMetrics']);
    if (change.focusOverrides) docs(['focusOverrides']);
    for (const key of change.content?.remove ?? []) writes.push({ op: 'delete', store: 'content-state', key });
    for (const [key, value] of Object.entries(change.content?.put ?? {})) writes.push({ op: 'put', store: 'content-state', value: { key, value } });
  }
  writes.push({ op: 'put', store: 'settings', value: doc('revision', revision) });

  return { next, writes };
}

function docValue(s: Snapshot, key: Doc['key']): unknown {
  switch (key) {
    case 'schemaVersion': return s.schemaVersion;
    case 'settings': return s.settings;
    case 'profile': return s.profile;
    case 'checkIns': return s.checkIns;
    case 'personalRecords': return s.personalRecords;
    case 'bodyMetrics': return s.bodyMetrics;
    case 'focusOverrides': return s.focusOverrides;
    case 'revision': return s.revision;
  }
}

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/**
 * A session's copy of its day's check-in as it is now kept (N-02, see
 * `toWorkoutSession`): Track's readings folded in once by the engine's own
 * projection, and without what only the screens' copy carries (`logged`,
 * `readingsOnly`, `durable`). Earlier builds kept the screens' copy, so it is
 * read this way wherever it comes in: from this device's store and from a
 * backup. One whose `logged` cannot be folded in is left as it is, for an
 * import to refuse.
 */
export function keptCheckIn<T extends DailyCheckIn>(c: T): T {
  if (c.logged === undefined && c.readingsOnly === undefined && c.durable === undefined) return c;
  const logged: unknown = c.logged;
  const lists = (x: unknown) => x === undefined || (Array.isArray(x) && x.every(isRecord));
  if (logged !== undefined && !(isRecord(logged) && lists(logged.glucose) && lists(logged.bp))) return c;
  const { readingsOnly: _onlyReadings, durable: _stored, ...kept } = withLogged(c) as T;
  void _onlyReadings;
  void _stored;
  return kept as T;
}

/** A session with its check-in copy as it is kept; the same session when it already is. */
export function keptSession<T extends { checkIn?: unknown }>(s: T): T {
  if (!isRecord(s.checkIn)) return s;
  const kept = keptCheckIn(s.checkIn as unknown as DailyCheckIn);
  return kept === (s.checkIn as unknown) ? s : { ...s, checkIn: kept };
}

/**
 * A snapshot from raw rows. Rows were validated on the way in, so this only
 * guards against shapes that would crash a render — a non-object row, a
 * document that is not the type it should be.
 */
export function fromRows(rows: Rows): Snapshot {
  const docs = new Map<string, unknown>();
  for (const row of rows.settings) if (isRecord(row) && typeof row.key === 'string') docs.set(row.key, row.value);
  const list = <T>(key: string): T[] => {
    const value = docs.get(key);
    return Array.isArray(value) ? value.filter(isRecord) as T[] : [];
  };
  const revision = Number(docs.get('revision'));
  const schemaVersion = docs.get('schemaVersion');
  const settings = docs.get('settings');
  const profile = docs.get('profile');
  const focusOverrides = docs.get('focusOverrides');

  const content: Record<string, unknown> = {};
  for (const row of rows.content) if (isRecord(row) && typeof row.key === 'string') content[row.key] = row.value;

  return {
    revision: Number.isSafeInteger(revision) && revision >= 0 ? revision : 0,
    ...(typeof schemaVersion === 'number' ? { schemaVersion } : {}),
    observations: (rows.observations.filter(isRecord) as unknown as Observation[]).sort(compareObservations),
    sessions: (rows.sessions.filter(row => isRecord(row) && typeof row.id === 'string') as unknown as WorkoutSession[]).map(keptSession).sort(bySessionOrder),
    ...(isRecord(settings) ? { settings: settings as unknown as UserSettings } : {}),
    ...(isRecord(profile) ? { profile: profile as unknown as UserProfile } : {}),
    checkIns: list<CheckInRecord>('checkIns'),
    personalRecords: list<PersonalRecord>('personalRecords'),
    bodyMetrics: list<BodyMetric>('bodyMetrics'),
    focusOverrides: isRecord(focusOverrides) ? focusOverrides as Record<string, DayFocus> : {},
    content,
  };
}

/** The whole record, read in one transaction. Rejects with a `StoreFailure`. */
export async function readSnapshot(db: Db): Promise<Snapshot> {
  return fromRows(await db.readAll());
}

function readAllIn(tx: TxHandle, then: (rows: Rows) => void): void {
  const rows: Partial<Rows> = {};
  let left = 4;
  const done = (slot: keyof Rows) => (found: unknown[]) => {
    rows[slot] = found;
    left -= 1;
    if (left === 0) then(rows as Rows);
  };
  tx.getAll('observations', done('observations'));
  tx.getAll('sessions', done('sessions'));
  tx.getAll('settings', done('settings'));
  tx.getAll('content-state', done('content'));
}

/** What a commit decided, given the snapshot it found. `null`: nothing to do. */
export interface Resolution {
  change: Change;
  /** Already prepared against exactly this base — the view's work, reused. */
  prepared?: Prepared;
}

export interface Committed {
  /** The snapshot the change was planned against: `known`, or a fresh read. */
  base: Snapshot;
  next: Snapshot;
  /** Another copy had written, so everything was re-read before planning. */
  refreshed: boolean;
  resolution: Resolution | null;
}

export type CommitResult =
  | { ok: true; value: Committed }
  | { ok: false; failure: StoreFailure; refreshed?: Snapshot };

/**
 * Plan a change against what is really stored, and store it, in one
 * transaction.
 *
 * `known` is the snapshot the caller believes is current. If the stored
 * `revision` matches, it is used as is; otherwise every store is read inside
 * this transaction and `resolve` is called with that. `resolve` may throw to
 * refuse, and nothing is written.
 */
export function commitChange(
  db: Db,
  known: Snapshot | undefined,
  resolve: (base: Snapshot, refreshed: boolean) => Resolution | null,
): Promise<CommitResult> {
  let committed: Committed | undefined;
  let refreshedBase: Snapshot | undefined;

  return db.transact(tx => {
    tx.get('settings', 'revision', row => {
      const stored = Number(isRecord(row) ? row.value : 0);
      const revision = Number.isSafeInteger(stored) && stored >= 0 ? stored : 0;
      const proceed = (base: Snapshot, refreshed: boolean) => {
        const resolution = resolve(base, refreshed);
        if (resolution === null) {
          committed = { base, next: base, refreshed, resolution: null };
          return;
        }
        const prepared = resolution.prepared ?? prepare(base, resolution.change);
        for (const w of prepared.writes) {
          if (w.op === 'clear') tx.clear(w.store);
          else if (w.op === 'delete') tx.delete(w.store, w.key);
          else tx.put(w.store, w.value);
        }
        committed = { base, next: prepared.next, refreshed, resolution: { ...resolution, prepared } };
      };

      if (known && known.revision === revision) {
        proceed(known, false);
        return;
      }
      readAllIn(tx, rows => {
        // A database never written by this build has no revision row; its
        // contents decide, not the absent counter.
        const base = { ...fromRows(rows), revision };
        refreshedBase = base;
        proceed(base, true);
      });
    });
  }).then(result => (result.ok
    ? { ok: true as const, value: committed! }
    : { ok: false as const, failure: result.failure, ...(refreshedBase ? { refreshed: refreshedBase } : {}) }));
}
