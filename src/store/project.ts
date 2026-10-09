/**
 * Measurements lifted out of the records that carry them (D21, review F10,
 * F14, F15).
 *
 * A check-in, a body measurement and a session's post-session pain each hold
 * numbers that belong in a series. These functions are the one way those
 * numbers become observations, used by both the v4 migration and every live
 * save, so the two paths cannot drift apart again: the same record yields the
 * same ids, contexts and times whichever route it came by.
 *
 * Two kinds of link, deliberately different:
 *
 * - **A check-in's readings are measurements in their own right.** A summary
 *   is replaced when the day's check-in is submitted again, but a glucose of
 *   50 that was treated and rechecked to 110 is clinical history: both stay.
 *   A new number is appended as a new reading; an unchanged one is not
 *   recorded twice; removing the summary keeps its readings unless the caller
 *   names them.
 * - **A body measurement or a session's pain score is the record itself**, one
 *   number per date or per session. The observation is a projection of it,
 *   so it is corrected in place and removed with it.
 */

import type { BodyMetric, WorkoutSession } from '@/types';
import type { BpReading as CheckInBp, CheckInRecord } from '@/types/checkin';
import {
  ObservationError,
  atOnDay,
  bpContext,
  checkInDayOf,
  dayOf,
  isAt,
  isDay,
  newObservation,
  nowAt,
  reviseObservation,
  type Observation,
  type ObservationKind,
} from '@/health/observation';
import { pairBloodPressure } from '@/health/aggregate';

export interface SkippedRecord {
  kind: ObservationKind;
  /** Which source record it came from, e.g. `checkIn:2026-10-01`. */
  context: string;
  reason: string;
}

export interface Lifted {
  put: Observation[];
  remove: string[];
  skipped: SkippedRecord[];
}

const none = (): Lifted => ({ put: [], remove: [], skipped: [] });

/**
 * The id of the n-th reading event on a check-in day, as a migration names it:
 * `checkIn:2026-10-08` for the first, `checkIn:2026-10-08#1` for a recheck.
 * The same old record always yields the same ids, whichever route it came by,
 * which is why a migrated reading and a live correction of it can be told
 * apart (F15).
 */
export function checkInEventId(day: string, n: number): string {
  return n === 0 ? `checkIn:${day}` : `checkIn:${day}#${n}`;
}

/** This copy of the app, so the events it names cannot be named the same by another device. */
const COPY = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID().replace(/-/g, '')
  : `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`).slice(0, 10);

/**
 * The id of a reading event saved now (D-02). Numbered per day alone, two
 * devices gave their own check-ins the same ids, and a merge took one for the
 * other. Named by this copy of the app as well, so no other device can make
 * it, and planning the same save again names it the same.
 */
export function liveEventId(day: string, n: number): string {
  return `checkIn:${day}#${COPY}${n === 0 ? '' : n.toString(36)}`;
}

export interface CheckInContext {
  /** Observations already held, to allocate free ids and find what is already recorded. */
  existing: readonly Observation[];
  /** The summary this replaces, if any: its readings are already recorded. */
  previous?: CheckInRecord;
  /**
   * Now, for a check-in entered live. A reading taken today is recorded at the
   * moment it was entered; without `now` (a migration) every time is unknown.
   */
  now?: string;
  /**
   * `append` (the default) records a changed number as a new reading, because
   * it might be a recheck and losing a real hypo is worse than keeping a typo.
   * `correct` says the caller knows it is a correction: the day's latest
   * reading of that kind is revised in place.
   */
  readings?: 'append' | 'correct';
  /**
   * What was deleted, by `readingKey` (R5-01). A record restored from an
   * older backup, or kept from before a deletion took the reading out of it,
   * can still name a reading the person deleted; it is not lifted back.
   */
  deleted?: ReadonlySet<string>;
}

/**
 * A check-in reading as what was measured: the day's check-in, the kind,
 * the moment and the number, whatever its id (R5-01). The same reading gets
 * a different id on another device, or after a reload, but never this.
 * `undefined` for a record that is not a check-in reading.
 */
export function readingKey(o: Pick<Observation, 'kind' | 'at' | 'value' | 'context'> & { unit?: string }): string | undefined {
  const day = checkInDayOf(o);
  if (day === undefined) return undefined;
  return `${day}|${o.kind}|${Date.parse(o.at)}|${o.value}${o.kind === 'glucose' ? `|${o.unit}` : ''}`;
}

interface Single { kind: 'glucose' | 'backPain' | 'legPain'; value: number; unit?: string; at?: string }
interface Pressure { sys: number; dia: number; at?: string }

function numeric(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

/**
 * A measured time, in this device's offset. The check-in sheet stamps readings
 * with `toISOString()` — UTC — and a reading taken at 01:30 in Kolkata is
 * 20:00Z the day before. The instant is kept; only the day it is filed under,
 * which is the local one, depends on this.
 */
function local(at: unknown): string | undefined {
  return isAt(at) ? nowAt(new Date(Date.parse(at))) : undefined;
}

/** Every number a check-in holds, in the order it would have been taken. */
function readingsOf(record: CheckInRecord): { singles: Single[]; pressures: Pressure[] } {
  const singles: Single[] = [];
  const glucose = (g: unknown) => {
    if (typeof g !== 'object' || g === null) return;
    const r = g as { value?: unknown; unit?: unknown; measuredAt?: unknown };
    // A meter that showed HI or LO gave no number, and none is invented.
    if (!numeric(r.value)) return;
    const at = local(r.measuredAt);
    singles.push({
      kind: 'glucose',
      value: r.value,
      ...(typeof r.unit === 'string' ? { unit: r.unit } : {}),
      ...(at !== undefined ? { at } : {}),
    });
  };
  for (const g of Array.isArray(record.glucoseEarlier) ? record.glucoseEarlier : []) glucose(g);
  glucose(record.glucose);

  // D21: the signature screen plots pain against the loading ladder over
  // time, which needs pain as a series rather than a field inside a check-in.
  if (record.back && numeric(record.back.pain)) singles.push({ kind: 'backPain', value: record.back.pain });
  if (record.back && numeric(record.back.legPain)) singles.push({ kind: 'legPain', value: record.back.legPain });

  // Individual readings where the record keeps them; the average is derived
  // from those and is not a measurement of its own. A v4 record has only the
  // average, which was the reading it showed.
  const pressures: Pressure[] = [];
  const pressure = (p: CheckInBp | { sys: number; dia: number } | undefined) => {
    if (!p || !numeric(p.sys) || !numeric(p.dia)) return;
    const at = local((p as CheckInBp).at);
    pressures.push({ sys: p.sys, dia: p.dia, ...(at !== undefined ? { at } : {}) });
  };
  for (const p of Array.isArray(record.bpEarlier) ? record.bpEarlier : []) pressure(p);
  if (Array.isArray(record.bpReadings) && record.bpReadings.length > 0) {
    for (const p of record.bpReadings) pressure(p);
  } else {
    pressure(record.bp);
  }
  return { singles, pressures };
}

/** A multiset of what a previous summary already recorded, by value. */
function tally(keys: string[]) {
  const counts = new Map<string, number>();
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  return {
    take(key: string): boolean {
      const n = counts.get(key) ?? 0;
      if (n === 0) return false;
      counts.set(key, n - 1);
      return true;
    },
  };
}

const singleKey = (s: Single) => `${s.kind}|${s.value}|${s.unit ?? ''}`;
const pressureKey = (p: Pressure) => `${p.sys}/${p.dia}`;

/** The latest statement among records, or undefined. */
function newest(list: Observation[]): Observation | undefined {
  return [...list].sort((a, b) => Date.parse(a.editedAt ?? a.at) - Date.parse(b.editedAt ?? b.at) || (a.seq ?? 0) - (b.seq ?? 0))
    .at(-1);
}

/**
 * The readings in a check-in that are not already recorded, as observations.
 *
 * A reading with a measured time is identified by that time: saved again with
 * the same number it is left alone, with a different number it is a
 * correction of that measurement. A reading without one is matched against
 * the summary it replaces: a number that summary already held is not recorded
 * twice, and a new number is a new reading.
 */
export function liftCheckIn(record: CheckInRecord, ctx: CheckInContext): Lifted {
  const out = none();
  const day = record.date;
  if (!isDay(day)) {
    out.skipped.push({ kind: 'glucose', context: `checkIn:${String(day)}`, reason: 'The check-in has no valid date.' });
    return out;
  }

  const context = `checkIn:${day}`;
  const linked = ctx.existing.filter(o => checkInDayOf(o) === day);
  const used = new Set(ctx.existing.map(o => o.id));
  const live = ctx.now !== undefined && dayOf(ctx.now) === day;
  const mode = ctx.readings ?? 'append';
  const prior = ctx.previous ? readingsOf(ctx.previous) : { singles: [], pressures: [] };
  const seenSingle = tally(prior.singles.map(singleKey));
  const seenPressure = tally(prior.pressures.map(pressureKey));
  const editedAt = ctx.now ?? nowAt();
  // A stored record answers for one incoming reading only. Two readings typed
  // together carry the same time, and the second must not be taken for — and
  // overwrite — the first.
  const matched = new Set<string>();

  // Without a measured time, a reading entered today is stamped now; one for
  // another day, or from a migration, keeps its exact day and says the time is
  // a stand-in.
  const timeFor = (at: string | undefined) => (at !== undefined ? { at } : live ? { at: ctx.now! } : { at: atOnDay(day), timeUnknown: true });

  const free = (kinds: ObservationKind[]): string => {
    for (let n = 0; ; n += 1) {
      const event = ctx.now !== undefined ? liveEventId(day, n) : checkInEventId(day, n);
      if (kinds.every(k => !used.has(`${event}:${k}`))) {
        for (const k of kinds) used.add(`${event}:${k}`);
        return event;
      }
    }
  };

  const tryPush = (kind: ObservationKind, make: () => Observation[]) => {
    try {
      out.put.push(...make());
    } catch (error) {
      if (!(error instanceof ObservationError)) throw error;
      out.skipped.push({ kind, context, reason: error.message });
    }
  };

  const { singles, pressures } = readingsOf(record);
  const sameInstant = (a: string, b: string) => Date.parse(a) === Date.parse(b);

  // First, every reading already stored exactly as it is — same kind, same
  // time, same number — claims its record. Only then are the rest matched as
  // corrections, so a corrected reading can never take the record another
  // reading matches exactly (which would put the correction on the wrong one).
  const exact = new Set<Single | Pressure>();
  for (const s of singles) {
    if (s.at === undefined) continue;
    const hit = linked.find(o => o.kind === s.kind && !matched.has(o.id) && sameInstant(o.at, s.at!)
      && o.value === s.value && (s.kind !== 'glucose' || o.unit === s.unit));
    if (hit) { matched.add(hit.id); exact.add(s); }
  }
  const pairs = pairBloodPressure(linked);
  for (const p of pressures) {
    if (p.at === undefined) continue;
    const hit = pairs.find(r => !matched.has(r.id) && sameInstant(r.at, p.at!) && r.systolic === p.sys && r.diastolic === p.dia);
    if (hit) { matched.add(hit.id); exact.add(p); }
  }

  for (const s of singles) {
    if (exact.has(s)) continue;
    const unit = s.kind === 'glucose' ? s.unit : undefined;
    if (s.kind === 'glucose' && unit === undefined) {
      // 7.2 is a normal mmol/L and a dangerous mg/dL: never guess which.
      out.skipped.push({ kind: 'glucose', context, reason: 'A glucose reading has no unit.' });
      continue;
    }
    const sameKind = linked.filter(o => o.kind === s.kind);

    if (s.at !== undefined) {
      // A record at the same time not claimed by an exact match: a correction of it.
      const match = sameKind.find(o => !matched.has(o.id) && sameInstant(o.at, s.at!));
      if (match) {
        matched.add(match.id);
        tryPush(s.kind, () => [reviseObservation(match, { value: s.value, ...(unit !== undefined ? { unit } : {}) }, editedAt)]);
        continue;
      }
    } else if (seenSingle.take(singleKey(s))) {
      continue;
    } else if (mode === 'correct') {
      const target = newest(sameKind);
      if (target) {
        tryPush(s.kind, () => [reviseObservation(target, { value: s.value, ...(unit !== undefined ? { unit } : {}) }, editedAt)]);
        continue;
      }
    }

    // Measured at a known moment, a reading the person deleted is not brought back.
    if (s.at !== undefined && ctx.deleted?.has(readingKey({ kind: s.kind, at: s.at, value: s.value, unit, context })!)) continue;
    tryPush(s.kind, () => {
      const event = free([s.kind]);
      return [newObservation({
        id: `${event}:${s.kind}`, kind: s.kind, value: s.value, ...(unit !== undefined ? { unit } : {}),
        scope: 'pointInTime', source: 'manual', context, ...timeFor(s.at),
      })];
    });
  }

  for (const p of pressures) {
    if (exact.has(p)) continue;
    const revisePair = (reading: (typeof pairs)[number]) => {
      const sys = reading.halves.filter(h => h.kind === 'bloodPressureSystolic');
      const dia = reading.halves.filter(h => h.kind === 'bloodPressureDiastolic');
      const s = newest(sys);
      const d = newest(dia);
      tryPush('bloodPressureSystolic', () => {
        const halves: Observation[] = [];
        if (s && s.value !== p.sys) halves.push(reviseObservation(s, { value: p.sys }, editedAt));
        if (d && d.value !== p.dia) halves.push(reviseObservation(d, { value: p.dia }, editedAt));
        return halves;
      });
    };

    if (p.at !== undefined) {
      const match = pairs.find(r => !matched.has(r.id) && sameInstant(r.at, p.at!));
      if (match) {
        matched.add(match.id);
        revisePair(match);
        continue;
      }
    } else if (seenPressure.take(pressureKey(p))) {
      continue;
    } else if (mode === 'correct' && pairs.length > 0) {
      revisePair(pairs[pairs.length - 1]);
      continue;
    }

    if (p.at !== undefined && ctx.deleted !== undefined) {
      const half = (kind: 'bloodPressureSystolic' | 'bloodPressureDiastolic', value: number) =>
        ctx.deleted!.has(readingKey({ kind, at: p.at!, value, context: bpContext(checkInEventId(day, 0)) })!);
      if (half('bloodPressureSystolic', p.sys) || half('bloodPressureDiastolic', p.dia)) continue;
    }
    // Both halves or neither: a lone systolic is a reading nobody can read.
    tryPush('bloodPressureSystolic', () => {
      const event = free(['bloodPressureSystolic', 'bloodPressureDiastolic']);
      const shared = { scope: 'pointInTime' as const, source: 'manual' as const, context: bpContext(event), ...timeFor(p.at) };
      return [
        newObservation({ ...shared, id: `${event}:bloodPressureSystolic`, kind: 'bloodPressureSystolic', value: p.sys }),
        newObservation({ ...shared, id: `${event}:bloodPressureDiastolic`, kind: 'bloodPressureDiastolic', value: p.dia }),
      ];
    });
  }

  return out;
}

/**
 * A body measurement's weight and waist as observations, one per date and
 * field. Corrected in place when the measurement changes, removed when the
 * field is cleared or the measurement deleted.
 */
export function liftBodyMetric(date: string, metric: BodyMetric | undefined, existing: readonly Observation[], now?: string): Lifted {
  const out = none();
  if (!isDay(date)) return out;
  const fields: [ObservationKind, 'weight' | 'waist'][] = [['weight', 'weight'], ['waist', 'waist']];
  for (const [kind, field] of fields) {
    const id = `bodyMetric:${date}:${kind}`;
    const held = existing.find(o => o.id === id);
    const value = metric?.[field];
    if (!numeric(value)) {
      if (held) out.remove.push(id);
      continue;
    }
    if (held && held.value === value) continue;
    try {
      const fresh = newObservation({
        id, kind, value, scope: 'pointInTime', source: 'manual',
        at: atOnDay(date), timeUnknown: true, context: `bodyMetric:${date}`,
      });
      out.put.push(held ? { ...fresh, editedAt: now ?? nowAt() } : fresh);
    } catch (error) {
      if (!(error instanceof ObservationError)) throw error;
      out.skipped.push({ kind, context: `bodyMetric:${date}`, reason: error.message });
    }
  }
  return out;
}

/**
 * The pain a session recorded afterwards, as a reading against the session.
 *
 * Timed at `completedAt` when that falls on the session's own day, so the
 * reading sits with the session it describes; otherwise at a stand-in time on
 * the session's day.
 */
export function liftSessionPain(sessionId: string, session: WorkoutSession | undefined, existing: readonly Observation[], now?: string): Lifted {
  const out = none();
  const id = `session:${sessionId}:backPain`;
  const held = existing.find(o => o.id === id);
  const value = session?.painAfter;
  if (!session || !numeric(value) || !isDay(session.date)) {
    if (held) out.remove.push(id);
    return out;
  }

  const finished = session.completedAt ? Date.parse(session.completedAt) : NaN;
  const local = Number.isFinite(finished) ? nowAt(new Date(finished)) : undefined;
  const when = local !== undefined && local.slice(0, 10) === session.date
    ? { at: local }
    : { at: atOnDay(session.date), timeUnknown: true };

  if (held && held.value === value && held.at === when.at) return out;
  try {
    const fresh = newObservation({ id, kind: 'backPain', value, scope: 'pointInTime', source: 'manual', context: `session:${sessionId}`, ...when });
    out.put.push(held ? { ...fresh, editedAt: now ?? nowAt() } : fresh);
  } catch (error) {
    if (!(error instanceof ObservationError)) throw error;
    out.skipped.push({ kind: 'backPain', context: `session:${sessionId}`, reason: error.message });
  }
  return out;
}
