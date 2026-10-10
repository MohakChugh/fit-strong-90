/**
 * v4 `localStorage` → v5 IndexedDB (PLAN.md Task 1, D13).
 *
 * The owner has real data on a real device and this is the only copy. The
 * rules that follow from that:
 *
 * 1. **Nothing is dropped.** Every v4 field is written through unchanged:
 *    sessions with their sets, personal records, body metrics, the profile,
 *    the check-ins and the focus overrides. The projection into observations
 *    is *additional*, not a replacement. A session with a missing or repeated
 *    id is given a fresh one and reported, never merged away.
 * 2. **Nothing is invented.** A measurement becomes an `Observation` only
 *    where v4 held an actual number. `sleep` is a band (`lt5` | `5to7` |
 *    `gt7`) and `energy` is energy rather than mood, so neither is projected —
 *    both stay in the retained check-in record.
 * 3. **All of it or none of it** (review F05). The data and the v5 marker are
 *    one transaction. A device that fills up half-way is left exactly as it
 *    was, still on v4, and the store refuses to save anything new over a
 *    record it has not finished moving.
 * 4. **An unreadable source is not an empty one** (F06). If `localStorage`
 *    cannot be read, the device is not marked migrated; the next start tries
 *    again.
 *
 * The old `localStorage` blob is deliberately left in place. Until the user
 * has exported once, deleting their only other copy to tidy up would be the
 * single worst thing this function could do.
 */

import { migrateData } from '@/services/storage';
import type { AppData, WorkoutSession } from '@/types';
import type { CheckInRecord } from '@/types/checkin';
import type { Observation } from '@/health/observation';
import { StoreFailure, readDoc, toFailure, type Db, type StoreResult } from './db';
import { commitChange, emptySnapshot, prepare, type Change, type Snapshot } from './snapshot';
import { liftBodyMetric, liftCheckIn, liftSessionPain, type SkippedRecord } from './project';

export type { SkippedRecord } from './project';

export const SCHEMA_VERSION = 5;

/** The key the v4 blob lives under. Mirrors `STORAGE_KEY` in services/storage.ts. */
export const V4_KEY = 'fit-strong-90-data';

export interface MigrationReport {
  /** The version of the blob that was found; 0 when there was nothing to migrate. */
  from: number;
  observations: number;
  sessions: number;
  checkIns: number;
  personalRecords: number;
  bodyMetrics: number;
  /** Numbers that could not become an observation, each with a reason. */
  skipped: SkippedRecord[];
  /** The database was already at v5, so nothing was written. */
  alreadyDone: boolean;
  /** The old blob was there but unreadable. It has been left untouched. */
  unreadable: boolean;
  /** Sessions that had no id, or one already used, and were given a new one: `[old, new]`. */
  renamedSessions?: [string, string][];
}

export interface Projection {
  observations: Observation[];
  skipped: SkippedRecord[];
}

/**
 * The measurements inside one check-in, on their own: every reading, with its
 * exact day and an unknown time, under the ids a migration would give it.
 */
export function observationsFromCheckIn(record: CheckInRecord): Projection {
  const lifted = liftCheckIn(record, { existing: [] });
  return { observations: lifted.put, skipped: lifted.skipped };
}

/**
 * Lift the measurements out of a v4 blob, through the same functions every
 * live save uses, so a migrated reading and a live one cannot drift apart.
 *
 * Anything a hand-edited or half-written blob holds that is not a measurement
 * is reported and skipped rather than aborting the migration.
 */
export function projectV4(data: AppData): Projection {
  const observations: Observation[] = [];
  const skipped: SkippedRecord[] = [];
  const take = (lifted: { put: Observation[]; skipped: SkippedRecord[] }) => {
    observations.push(...lifted.put);
    skipped.push(...lifted.skipped);
  };

  const checkIns = Array.isArray(data.checkIns) ? data.checkIns : [];
  // Two check-ins on one date are two summaries; each keeps its readings.
  for (const record of checkIns) take(liftCheckIn(record, { existing: observations }));

  const dates = new Set(checkIns.map(c => c.date));
  for (const session of Array.isArray(data.sessions) ? data.sessions : []) {
    // A check-in the app only ever wrote onto the session would otherwise be
    // invisible to every new screen.
    if (session?.checkIn && !dates.has(session.checkIn.date)) {
      dates.add(session.checkIn.date);
      take(liftCheckIn(session.checkIn, { existing: observations }));
    }
    if (session && typeof session.id === 'string') take(liftSessionPain(session.id, session, observations));
  }

  for (const metric of Array.isArray(data.bodyMetrics) ? data.bodyMetrics : []) {
    if (metric && typeof metric.date === 'string') take(liftBodyMetric(metric.date, metric, observations));
  }

  return { observations, skipped };
}

/** The observations a v4 blob yields, without the skip report. */
export function observationsFromV4(data: AppData): Observation[] {
  return projectV4(data).observations;
}

function emptyReport(over: Partial<MigrationReport> = {}): MigrationReport {
  return {
    from: 0, observations: 0, sessions: 0, checkIns: 0, personalRecords: 0, bodyMetrics: 0,
    skipped: [], alreadyDone: false, unreadable: false, ...over,
  };
}

export type LegacyRead = { ok: true; raw: string | null } | { ok: false; failure: StoreFailure };

/**
 * The v4 blob, or `null` when there is none — and a failure, distinct from
 * both, when `localStorage` refused to be read. Safari throws on access in
 * some modes; treating that as "no data" would mark a device migrated with
 * its history still sitting where nothing will ever look again (F06).
 */
export function readLegacy(): LegacyRead {
  try {
    return { ok: true, raw: typeof localStorage === 'undefined' ? null : localStorage.getItem(V4_KEY) };
  } catch (error) {
    return {
      ok: false,
      failure: new StoreFailure('readFailed', 'The records saved by the previous version of the app could not be read, so nothing new is being saved over them yet.', error),
    };
  }
}

/** Every session with an id IndexedDB will accept, and none sharing one. */
function keyedSessions(sessions: WorkoutSession[]): { sessions: WorkoutSession[]; renamed: [string, string][] } {
  const used = new Set<string>();
  const renamed: [string, string][] = [];
  const out = sessions.filter(s => typeof s === 'object' && s !== null).map((s, i) => {
    let id = typeof s.id === 'string' && s.id !== '' ? s.id : `legacy-session-${i}`;
    if (used.has(id)) {
      let n = 2;
      while (used.has(`${id}~${n}`)) n += 1;
      id = `${id}~${n}`;
    }
    used.add(id);
    if (id === s.id) return s;
    renamed.push([String(s.id), id]);
    return { ...s, id };
  });
  return { sessions: out, renamed };
}

interface Plan {
  change: Change;
  report: MigrationReport;
  /** What the device holds once this lands, for showing while it cannot. */
  data?: AppData;
}

/** What migrating this blob would write. Pure; throws only on a blob `migrateData` cannot read. */
function planMigration(raw: string | null): Plan {
  if (!raw) return { change: { schemaVersion: SCHEMA_VERSION }, report: emptyReport() };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = undefined;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    // Leave the blob exactly where it is: a human can still recover it, and
    // refusing to mark the device would retry this failure on every start.
    return { change: { schemaVersion: SCHEMA_VERSION }, report: emptyReport({ unreadable: true }) };
  }

  const stored = Number((parsed as AppData).version);
  const from = Number.isFinite(stored) ? stored : 1;
  // Reuse the tested v1 → v4 ladder rather than reimplementing it; it is
  // idempotent, so a blob already at v4 passes through untouched.
  const data = migrateData(parsed as AppData);
  const { sessions, renamed } = keyedSessions(data.sessions);
  const projection = projectV4({ ...data, sessions });

  const change: Change = {
    schemaVersion: SCHEMA_VERSION,
    observations: { put: projection.observations },
    sessions: { put: sessions },
    settings: { replace: data.settings },
    ...(data.profile !== undefined ? { profile: data.profile } : {}),
    checkIns: data.checkIns ?? [],
    personalRecords: data.personalRecords,
    bodyMetrics: data.bodyMetrics,
    focusOverrides: data.focusOverrides ?? {},
  };

  return {
    change,
    data: { ...data, sessions },
    report: {
      from,
      observations: projection.observations.length,
      sessions: sessions.length,
      checkIns: (data.checkIns ?? []).length,
      personalRecords: data.personalRecords.length,
      bodyMetrics: data.bodyMetrics.length,
      skipped: projection.skipped,
      alreadyDone: false,
      unreadable: false,
      ...(renamed.length > 0 ? { renamedSessions: renamed } : {}),
    },
  };
}

/**
 * The record a v4 blob holds, as a snapshot, without writing anything: what
 * the app shows while it cannot finish moving it (a full device), so the
 * owner still sees their own history.
 */
export function legacySnapshot(raw: string | null): Snapshot | undefined {
  try {
    const plan = planMigration(raw);
    if (!plan.data) return undefined;
    return prepare(emptySnapshot(), plan.change).next;
  } catch {
    return undefined;
  }
}

const isDone = (marker: unknown) => typeof marker === 'number' && marker >= SCHEMA_VERSION;

/**
 * Move this device from v4 to v5, once.
 *
 * Pass `raw` to migrate a specific blob; omit it to read the one on this
 * device. Returns a failure rather than throwing, because the caller is app
 * start-up and a full device has to become a message rather than a blank
 * screen (D16).
 */
export async function migrateToV5(db: Db, raw?: string | null): Promise<StoreResult<MigrationReport>> {
  // A device that has moved never touches the old storage again.
  try {
    if (isDone(await readDoc<number>(db, 'schemaVersion'))) return { ok: true, value: emptyReport({ alreadyDone: true }) };
  } catch (error) {
    return { ok: false, failure: toFailure(error, 'readFailed') };
  }

  const legacy: LegacyRead = raw !== undefined ? { ok: true, raw } : readLegacy();
  if (!legacy.ok) return { ok: false, failure: legacy.failure };

  let plan: Plan;
  try {
    plan = planMigration(legacy.raw);
  } catch (error) {
    return {
      ok: false,
      failure: new StoreFailure('readFailed', 'The records saved by the previous version of the app could not be read. They have been left exactly as they were.', error),
    };
  }

  // Checked again inside the transaction: another open copy may have
  // migrated in the moment since the read above.
  const committed = await commitChange(db, undefined, base => (isDone(base.schemaVersion) ? null : { change: plan.change }));
  if (!committed.ok) return { ok: false, failure: committed.failure };
  if (committed.value.resolution === null) return { ok: true, value: emptyReport({ alreadyDone: true }) };
  return { ok: true, value: plan.report };
}
