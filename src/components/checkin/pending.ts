/**
 * Check-in answers this device has been given but not yet durably stored, and
 * the one record every movement gate must read (re-audit round 3, B04).
 *
 * No React here, so the Walk controller and any other non-React gate can use
 * it too. React screens get the same thing from `useGuided().checkIn`.
 *
 * Two rules make it safe:
 * - **Lossless.** Every save is merged against what is stored *and* what is
 *   still waiting to be stored — an earlier write the device refused, or one
 *   still on its way. So a second failed or stale save can never drop the low,
 *   the ketone result or the emergency answer a first one carried.
 * - **Never looser than the device.** The record a gate reads is the stricter
 *   of the two ways of combining stored and waiting answers. A refused write
 *   can tighten what the device holds; it can never loosen it.
 *
 * A waiting record stays until a durable write covers everything in it. It
 * lives in memory only: the sheet says so when a write fails.
 */

import type { AppData } from '@/types';
import type { BpPartialReading, BpReading, CheckInRecord, ClockHold, DailyCheckIn, EmergencyFlag, EpisodeAnswer, GlucoseDisplayReading, GlucoseEntry, GlucoseReading, GlucoseUnit, NewsItem, RedFlag, SymptomReach } from '@/types/checkin';
import { isHeld, type HeldReading, type HoldFailure } from '@/store/db';
import { toDateString } from '@/lib/utils';
import type { UserProfile } from '@/types/profile';
import { bpPartialId, completes, evaluateCheckIn, newsReadingId, stoppedIn } from '@/engine/readiness';
import { checkInDayOf, measuredStamp, type Observation } from '@/health/observation';
import { acquiredIn } from '@/walk/consent';
import { pairBloodPressure } from '@/health/aggregate';
import { carryForward, withoutGateFields } from './form';
import { checkInReadingEntry, recentKey } from '@/store/recent';
import type { UpdateOptions } from '@/store/useStore';

/** What a check-in save did: the record as it was merged and stored, and whether the device kept it. */
export interface SaveResult {
  /** The complete record, merged with anything the day already held. Evaluate this, never the raw answers. */
  record: CheckInRecord;
  /** False when the device refused the write. The answer still counts; it is just not durable yet. */
  stored: boolean;
}

/** The store's `update`, as `useAppData` hands it out, with its own options (a Recently deleted entry's included). */
export type StoreUpdate = (
  updater: (previous: AppData) => AppData,
  options?: UpdateOptions,
) => Promise<{ ok: boolean; failure?: { message: string } }>;

const waiting = new Map<string, CheckInRecord>();
/**
 * Each date's records written before the one waiting now, oldest first, none
 * of them stored yet (F-safety-01). Each still counts on its own, so a later
 * answer the device hasn't kept releases nothing an earlier one holds, even
 * with nothing stored for the day. They go once a write the device keeps
 * covers them.
 */
const earlier = new Map<string, CheckInRecord[]>();
/** Dates whose latest write was refused, as opposed to merely still on its way. */
const refused = new Set<string>();
/**
 * Dates whose waiting record came back from before a reload, not from
 * anything answered on this visit (`restore`): evidence, never a check-in.
 */
const restored = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;

/**
 * Where waiting answers are kept across a reload (acceptance J17 step 7): a
 * refused emergency must still stop every screen after the page comes back.
 * Under the app's own key prefix, so "Clear all data" sweeps it, and removed
 * as soon as nothing is waiting. Best effort: if this browser storage is full
 * too, memory still holds the answers for this visit and the sheet says they
 * may be lost.
 */
const MIRROR_KEY = 'fit-strong-90-pending-checkins';

function mirror(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (waiting.size === 0) localStorage.removeItem(MIRROR_KEY);
    else localStorage.setItem(MIRROR_KEY, JSON.stringify({ waiting: [...waiting.values()], refused: [...refused], earlier: [...earlier.values()].flat() }));
  } catch {
    // Full or unavailable: the answers still count for this visit.
  }
}

function restore(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(MIRROR_KEY);
    if (!raw) return;
    const kept = JSON.parse(raw) as { waiting?: unknown; refused?: unknown; earlier?: unknown };
    const readable = (r: unknown): r is CheckInRecord => {
      const c = r as CheckInRecord;
      return !!c && typeof c.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.date) && !!c.readiness && Array.isArray(c.news);
    };
    for (const c of Array.isArray(kept.waiting) ? kept.waiting : []) {
      if (!readable(c)) continue;
      waiting.set(c.date, c);
      restored.add(c.date);
    }
    for (const d of Array.isArray(kept.refused) ? kept.refused : []) if (typeof d === 'string' && waiting.has(d)) refused.add(d);
    for (const c of Array.isArray(kept.earlier) ? kept.earlier : []) if (readable(c) && waiting.has(c.date)) earlier.set(c.date, [...(earlier.get(c.date) ?? []), c]);
  } catch {
    // Unreadable: nothing to restore.
  }
}
restore();

/**
 * A record kept from before a reload, as the gates must read it (J17 steps
 * 7 and 9). Everything it says still counts, so a refused emergency stops
 * every screen after the reload. But an answer the device never stored does
 * not stand in for today's check-in: a "None of these" only the kept copy
 * holds is taken back, so the next start asks again rather than going
 * straight into movement. An answer the device did store keeps counting, and
 * is never erased by what was merely kept (scan C2-02). Once the stored
 * record holds everything in it, the stored record alone decides.
 */
function asRestored(c: CheckInRecord, stored: CheckInRecord | undefined): CheckInRecord | undefined {
  if (stored && covers(stored, c)) return undefined;
  if (c.emergency?.length) return c;
  if (stored?.emergency !== undefined) {
    return { ...c, emergency: [...stored.emergency], urgentSymptoms: c.urgentSymptoms || stored.urgentSymptoms };
  }
  const { emergency: _answered, ...evidence } = c;
  void _answered;
  return evidence;
}

/** What waits for `date`, as the gates read it. */
function waitingFor(date: string, stored: CheckInRecord | undefined): CheckInRecord | undefined {
  const c = waiting.get(date);
  return c && restored.has(date) ? asRestored(c, stored) : c;
}

function publish(): void {
  version++;
  mirror();
  for (const l of [...listeners]) l();
}

/**
 * `record` waits for `date` now. The record it replaces, unless it is this
 * same write's own earlier plan (`own`), was never stored either, so it keeps
 * counting on its own (`earlier`, F-safety-01).
 */
function setWaiting(date: string, record: CheckInRecord, own: CheckInRecord | undefined): void {
  const before = waiting.get(date);
  if (before && before !== own) earlier.set(date, [...(earlier.get(date) ?? []), before]);
  waiting.set(date, record);
}

/**
 * The device kept `record`: it holds everything written before it, so those
 * stop waiting, and so does what waits now if `record` covers it.
 */
function keptStored(date: string, record: CheckInRecord): void {
  refused.delete(date);
  const list = earlier.get(date) ?? [];
  const at = list.indexOf(record);
  const left = at >= 0 ? list.slice(at + 1) : waiting.get(date) === record ? [] : list;
  const still = waiting.get(date);
  if (still && covers(record, still)) waiting.delete(date);
  if (!waiting.has(date) || left.length === 0) earlier.delete(date);
  else earlier.set(date, left);
}

/** Called whenever a waiting record appears, changes or is stored. */
export function subscribePendingCheckIns(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** Changes whenever anything waiting changes: a snapshot for `useSyncExternalStore`. */
export function pendingCheckInsVersion(): number {
  return version;
}

/** The answers for `date` not yet durably stored, if any. */
export function pendingCheckIn(date: string): CheckInRecord | undefined {
  return waiting.get(date);
}

/** The answers for `date` whose write the device refused, if any (not merely in flight). */
export function unstoredCheckIn(date: string): CheckInRecord | null {
  return refused.has(date) ? waiting.get(date) ?? null : null;
}

/** Test seam: forget everything waiting. */
export function resetPendingCheckInsForTests(): void {
  waiting.clear();
  earlier.clear();
  refused.clear();
  restored.clear();
  publish();
}

/** Test seam: read the kept copy again, as a reload would. */
export function restorePendingCheckInsForTests(): void {
  waiting.clear();
  earlier.clear();
  refused.clear();
  restored.clear();
  restore();
  version++;
  for (const l of [...listeners]) l();
}

const evaluated = (profile: UserProfile, c: DailyCheckIn, recent: DailyCheckIn[]): CheckInRecord => {
  const { readiness: _old, ...plain } = c as CheckInRecord;
  void _old;
  return { ...plain, readiness: evaluateCheckIn(profile, plain, recent) };
};

/**
 * The record a check-in write stores, and the one that waits until the device
 * keeps it: the day's own answers, evaluated, with nothing only the gates
 * attach (P-01). Every write of a check-in goes through here, whatever its
 * answers were built from; Track's readings stay Track's.
 */
const toStore = (profile: UserProfile, c: DailyCheckIn, recent: DailyCheckIn[]): CheckInRecord =>
  evaluated(profile, withoutGateFields(c), recent);

/**
 * What a gate must act on for one day: the stored record and the waiting one
 * together (`strictest`). The answers the device has not kept can add to what
 * it holds, and never take anything away, so a refused save cannot loosen a
 * mode's refusal or restriction however the two would rank (R5-02).
 */
export function effectiveRecord(
  stored: CheckInRecord | undefined,
  pending: CheckInRecord | undefined,
  profile: UserProfile,
  recent: DailyCheckIn[] = [],
): CheckInRecord | undefined {
  if (!pending) return stored;
  if (!stored || stored.date !== pending.date) return evaluated(profile, pending, recent);
  // The stored record decides at least as strictly as the two together (N-01):
  // a newer reading the device has not kept cannot release what it holds.
  const { readiness: _r, durable: _d, ...durable } = stored;
  void _r;
  void _d;
  return evaluated(profile, { ...strictest(stored, pending), durable }, recent);
}

/** A record to store, from one a gate reads: what the device stored is never written back inside it (N-01). */
export const recordToStore = (c: CheckInRecord | undefined): CheckInRecord | undefined => {
  if (!c) return c;
  const { durable: _d, ...rest } = c;
  void _d;
  return rest;
};

const REACH_ORDER: SymptomReach[] = ['back', 'buttock', 'thigh', 'belowKnee', 'foot'];
const SLEEP_ORDER: NonNullable<DailyCheckIn['sleep']>[] = ['lt5', '5to7', 'gt7'];
const BACK_YES_NO = ['newNeuro', 'caudaEquinaFlag', 'newSensory', 'newWeakness', 'weaknessFast', 'feverish', 'suddenSevere', 'worseFunction', 'spreadToday'] as const;

/** Of two answers to a yes-or-no question, the one that says more: yes if either says yes. */
const either = (a?: boolean, b?: boolean) => (a === true || b === true ? true : a === false || b === false ? false : undefined);

/** Two days' back answers as one: every symptom either reports, the higher pain, the furthest reach. */
function strictBack(a: DailyCheckIn['back'], b: DailyCheckIn['back']): DailyCheckIn['back'] {
  if (!a || !b) return a ?? b;
  const out: NonNullable<DailyCheckIn['back']> = {};
  for (const k of BACK_YES_NO) {
    const v = either(a[k], b[k]);
    if (v !== undefined) out[k] = v;
  }
  for (const k of ['pain', 'legPain'] as const) {
    const said = [a[k], b[k]].filter((n): n is number => n !== undefined);
    if (said.length) out[k] = Math.max(...said);
  }
  const reach = [a.reach, b.reach].filter((r): r is SymptomReach => !!r).sort((x, y) => REACH_ORDER.indexOf(y) - REACH_ORDER.indexOf(x))[0];
  if (reach) out.reach = reach;
  return out;
}

/**
 * The stored record and one waiting to be stored, as one (R5-02). What the
 * device has not kept adds to what it holds and never takes away: every
 * reading either holds (`carryForward`), every emergency, news item, back
 * symptom, provoking movement and flag either reports, the higher pain and
 * the shorter sleep or lower energy. An answer that releases something counts
 * once it is stored; one that reopens something counts at once.
 */
function strictest(stored: DailyCheckIn, pending: DailyCheckIn): DailyCheckIn {
  const merged = carryForward(stored, pending);
  const { emergency: _e, back: _b, sleep: _s, energy: _n, lowRecovered: _l, bpSymptoms: _p, resolutions: _r, ...rest } = merged;
  void _e; void _b; void _s; void _n; void _l; void _p; void _r;
  const emergency = stored.emergency || pending.emergency ? [...new Set([...(stored.emergency ?? []), ...(pending.emergency ?? [])])] : undefined;
  const back = strictBack(stored.back, pending.back);
  const sleep = [stored.sleep, pending.sleep].filter((x): x is NonNullable<DailyCheckIn['sleep']> => !!x).sort((x, y) => SLEEP_ORDER.indexOf(x) - SLEEP_ORDER.indexOf(y))[0];
  const energies = [stored.energy, pending.energy].filter((x): x is NonNullable<DailyCheckIn['energy']> => x !== undefined);
  const energy = energies.length ? (Math.min(...energies) as NonNullable<DailyCheckIn['energy']>) : undefined;
  const lowRecovered = stored.lowRecovered === true && pending.lowRecovered === true ? true
    : stored.lowRecovered === false || pending.lowRecovered === false ? false : undefined;
  const bpSymptoms = either(stored.bpSymptoms, pending.bpSymptoms);
  const kept = stored.resolutions ?? [];
  const resolutions = [...kept, ...(pending.resolutions ?? []).filter(a => a.resolution === 'reopened' && !kept.some(k => JSON.stringify(k) === JSON.stringify(a)))];
  return {
    ...rest,
    urgentSymptoms: stored.urgentSymptoms || pending.urgentSymptoms,
    news: [...new Set([...stored.news, ...pending.news])],
    ...(emergency ? { emergency } : {}),
    ...(back ? { back } : {}),
    ...(sleep ? { sleep } : {}),
    ...(energy !== undefined ? { energy } : {}),
    ...(lowRecovered !== undefined ? { lowRecovered } : {}),
    ...(bpSymptoms !== undefined ? { bpSymptoms } : {}),
    ...(resolutions.length ? { resolutions } : {}),
  };
}

/**
 * A day from elsewhere without its answers about readings this device holds
 * (§4.6, P8-02): `known`, by the ids answers name them by. Whatever such an
 * answer says — settled, a mistake, reopened — it neither settles nor
 * reopens what this device holds; the device's own answers do. An answer
 * also about readings this device doesn't hold keeps those.
 */
export function withoutAnswersAbout<T extends DailyCheckIn>(day: T, known: ReadonlySet<string>): T {
  if (!day.resolutions?.length || known.size === 0) return day;
  let changed = false;
  const resolutions = day.resolutions.flatMap(a => {
    const readings = a.readings.filter(id => !known.has(id));
    if (readings.length === a.readings.length) return [a];
    changed = true;
    return readings.length ? [{ ...a, readings }] : [];
  });
  if (!changed) return day;
  const { resolutions: _all, ...rest } = day;
  void _all;
  return (resolutions.length ? { ...rest, resolutions } : rest) as T;
}

/**
 * Two copies of one day as one, never looser than `kept` (H6-03, P8-02):
 * what an import keeps of this device's day beside the file's. `strictest`,
 * with the device's copy as the newer one, so its readings stay current and
 * every reading, answer and symptom either holds is kept; then the answers:
 * the device's own, and the other's about anything but `known`, the readings
 * this device holds, so nothing in it settles or reopens one of them; and the
 * later "feeling low" moment of the two, so no reading between them answers it.
 */
export function neverLooser(kept: DailyCheckIn, other: DailyCheckIn, known: ReadonlySet<string>): DailyCheckIn {
  const { resolutions: _theirs, ...merged } = strictest(withoutSettled(other, kept, known), kept);
  void _theirs;
  const mine = kept.resolutions ?? [];
  const theirs = withoutAnswersAbout(other, known).resolutions ?? [];
  const resolutions = [...mine, ...theirs.filter(a => !mine.some(k => JSON.stringify(k) === JSON.stringify(a)))];
  const felt = [kept.lowSymptomsAt, other.lowSymptomsAt]
    .filter((t): t is string => typeof t === 'string' && !Number.isNaN(Date.parse(t)))
    .sort((a, b) => Date.parse(a) - Date.parse(b)).at(-1);
  return { ...merged, ...(resolutions.length ? { resolutions } : {}), ...(felt ? { lowSymptomsAt: felt } : {}) };
}

/** Where a back red flag is said in a day's answers, for `withoutSettled`. */
const BACK_FLAG_FIELDS: Partial<Record<RedFlag, readonly (keyof NonNullable<DailyCheckIn['back']>)[]>> = {
  // A record from before `newWeakness` was asked said it as `newNeuro`.
  newWeakness: ['newWeakness', 'newNeuro'],
  backFever: ['feverish'],
  backSudden: ['suddenSevere'],
};

/**
 * The other copy of a day without its reports of what this device knows
 * (H6R-05, board D175): a news item or red flag the device holds, answered,
 * or said and unticked since, is the device's to say, so the other copy's
 * report of it from before, a file's raw news or back answers, reopens
 * nothing. Anything the device doesn't know is kept, so the day is never
 * looser for it.
 */
function withoutSettled(other: DailyCheckIn, kept: DailyCheckIn, known: ReadonlySet<string>): DailyCheckIn {
  const knownFlag = (f: RedFlag) => known.has(`flag:${f}@${kept.date}`);
  const knownNews = (n: NewsItem) => known.has(newsReadingId(kept.date, n)) || ((n === 'footProblem' || n === 'hotSwollenFoot') && knownFlag(n));
  const news = other.news.filter(n => !knownNews(n));
  const backFields = (Object.entries(BACK_FLAG_FIELDS) as [RedFlag, readonly (keyof NonNullable<DailyCheckIn['back']>)[]][])
    .filter(([f]) => knownFlag(f)).flatMap(([, fields]) => fields);
  if (news.length === other.news.length && !(other.back && backFields.length)) return other;
  const back = other.back && backFields.length
    ? { ...other.back, ...Object.fromEntries(backFields.map(k => [k, kept.back?.[k]])) } as NonNullable<DailyCheckIn['back']>
    : other.back;
  return { ...other, news, ...(back ? { back } : {}) };
}

const previousDate = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
};
const toMg = (value: number, unit: GlucoseUnit) => (unit === 'mmol/L' ? value * 18 : value);

/**
 * Readings logged outside the check-in that every gate must see (scan
 * X2-01): Track's point-in-time glucose and blood pressure, by day. A reading
 * lifted from a check-in is that check-in's own and is left out; a time that
 * only stands in for a date is no time at all. The latest day and the one
 * before keep every reading — a low that runs past midnight is one episode
 * (X2-08) — earlier days only those serious enough to be carried, which is
 * all the rules read of them.
 */
export function loggedReadings(observations: readonly Observation[]): Map<string, NonNullable<DailyCheckIn['logged']>> {
  const glucose: Observation[] = [];
  const pressure: Observation[] = [];
  let latest = '';
  for (const o of observations) {
    if (o.scope !== 'pointInTime' || checkInDayOf(o)) continue;
    if (o.kind === 'glucose' && (o.unit === 'mg/dL' || o.unit === 'mmol/L') && Number.isFinite(o.value)) glucose.push(o);
    else if (o.kind === 'bloodPressureSystolic' || o.kind === 'bloodPressureDiastolic') pressure.push(o);
    else continue;
    if (o.day > latest) latest = o.day;
  }
  const out = new Map<string, NonNullable<DailyCheckIn['logged']>>();
  if (!latest) return out;
  const full = (day: string) => day >= previousDate(latest);
  const day = (d: string) => {
    let held = out.get(d);
    if (!held) out.set(d, (held = {}));
    return held;
  };
  for (const o of glucose) {
    const unit = o.unit as GlucoseUnit;
    const mg = toMg(o.value, unit);
    if (!full(o.day) && mg < 600 && mg >= 54) continue;
    const reading: GlucoseReading = {
      value: o.value, unit, unitConfirmed: true, source: o.source === 'measured' ? 'sensor' : 'meter',
      ...(o.timeUnknown ? {} : { measuredAt: o.at }),
      ...(o.gen !== undefined ? { gen: o.gen } : {}),
    };
    (day(o.day).glucose ??= []).push(reading);
  }
  for (const r of pairBloodPressure(pressure)) {
    if (r.systolic === null || r.diastolic === null) continue;
    if (!full(r.day) && r.systolic < 180 && r.diastolic < 120) continue;
    (day(r.day).bp ??= []).push({ sys: r.systolic, dia: r.diastolic, at: r.at });
  }
  return out;
}

/**
 * Every stored check-in, with each day that has waiting answers replaced by
 * its effective record, and every day's Track readings attached for the
 * gates (`logged`, X2-01). A day with readings but no record gets one that
 * holds only them: evidence for every rule, never a check-in. Nothing here
 * is stored: a save reads the store's own records.
 *
 * `stored` is what the device has stored (`StoreState.stored`), never a
 * change still on its way or one it refused, so an answer waiting to be
 * stored can add to a day and never take from it (F-safety-01). Track's
 * readings are counted as shown (`observations`), so one on its way counts
 * at once, and a day read beside its stored ones (`storedObservations`, in
 * `durable`): one still on its way releases nothing either (N-01).
 */
export function effectiveCheckIns(
  stored: readonly CheckInRecord[], profile: UserProfile, observations: readonly Observation[] = [], clock?: ClockHold,
  storedObservations: readonly Observation[] = observations,
): CheckInRecord[] {
  return withClockHold(effectiveDays(stored, profile, observations, true, storedObservations), clock);
}

/**
 * The same, as stored: Track's readings attached and the phone's clock changes, without any answer still
 * waiting. What the store's guard asks the engine about, before and after a change (board D119): a correction
 * waiting for its own write is never read as standing beside the reading it corrects.
 */
export function storedCheckIns(
  stored: readonly CheckInRecord[], profile: UserProfile, observations: readonly Observation[] = [], clock?: ClockHold,
): CheckInRecord[] {
  return withClockHold(effectiveDays(stored, profile, observations, false), clock);
}

/**
 * B-19: the changes to this phone's clock (`settings.walk.clock`), on every
 * day the gates read, so each gate can tell a reading taken since the latest
 * from one taken before it (board D174). The records as they are without one.
 */
export function withClockHold<T extends DailyCheckIn>(records: T[], clock: ClockHold | undefined): T[] {
  return clock ? records.map(c => ({ ...c, clockHold: clock })) : records;
}

type Logged = Map<string, NonNullable<DailyCheckIn['logged']>>;

function effectiveDays(
  stored: readonly CheckInRecord[], profile: UserProfile, observations: readonly Observation[], waitingToo = true,
  storedObservations: readonly Observation[] = observations,
): CheckInRecord[] {
  const logged: Logged = observations.length ? loggedReadings(observations) : new Map();
  // Track's readings as stored: one still on its way releases nothing either (N-01, F-safety-01).
  const loggedStored: Logged = storedObservations === observations ? logged : storedObservations.length ? loggedReadings(storedObservations) : new Map();
  const pending = waitingToo ? [...waiting.keys()] : [];
  if (pending.length === 0 && logged.size === 0 && loggedStored.size === 0) return [...stored];
  const dates = new Set([...stored.map(c => c.date), ...pending, ...logged.keys(), ...loggedStored.keys()]);
  return [...dates].sort().flatMap(date => {
    const recent = stored.filter(c => c.date < date);
    const mine = stored.find(c => c.date === date);
    const said = waitingToo ? waitingFor(date, mine) : undefined;
    const record = effectiveRecord(mine, said, profile, recent);
    // Every answer written before the one waiting, none of them stored: each still counts on its own (F-safety-01).
    const unstored = said ? earlier.get(date) ?? [] : [];
    const readings = logged.get(date);
    const storedReadings = loggedStored.get(date);
    if (!readings && !storedReadings && unstored.length === 0) return record ? [record] : [];
    const { readiness: _r, ...plain }: Partial<CheckInRecord> & DailyCheckIn = record ?? { date, urgentSymptoms: false, news: [], readingsOnly: true };
    void _r;
    // The day as stored, with the Track readings stored for it, whenever either is not what is shown.
    const differs = readings !== storedReadings && JSON.stringify(readings ?? {}) !== JSON.stringify(storedReadings ?? {});
    const base: DailyCheckIn | undefined = plain.durable ?? (differs ? (mine ? withoutReadiness(mine) : { date, urgentSymptoms: false, news: [], readingsOnly: true }) : undefined);
    const day: DailyCheckIn = {
      ...plain,
      ...(readings ? { logged: readings } : {}),
      ...(base ? { durable: { ...base, ...(readings || storedReadings ? { logged: storedReadings ?? {} } : {}) } } : {}),
      ...(unstored.length ? { unstored: unstored.map(withoutReadiness) } : {}),
    };
    return [{ ...day, readiness: evaluateCheckIn(profile, day, recent) }];
  });
}

const withoutReadiness = (c: CheckInRecord): DailyCheckIn => {
  const { readiness: _r, ...rest } = c;
  void _r;
  return rest;
};

/** Everything in `pending` is already in `stored`. */
function covers(stored: CheckInRecord, pending: CheckInRecord): boolean {
  const plain = (c: DailyCheckIn) => {
    const { readiness: _r, ...rest } = c as CheckInRecord;
    void _r;
    return JSON.stringify(rest);
  };
  return plain(carryForward(stored, pending)) === plain(stored);
}

/**
 * Save today's answers through the store.
 *
 * The updater may be run again by the store — when an earlier write fails, or
 * another tab writes — so the merge happens inside it, against whatever it is
 * handed plus whatever is still waiting. The record waits from the moment it is
 * made, so a stop counts on every screen before the write lands.
 */
export function saveCheckInRecord(
  answers: DailyCheckIn,
  deps: { profile: UserProfile; update: StoreUpdate },
): Promise<SaveResult> {
  return saveWith(answers.date, () => answers, deps);
}

/**
 * Something said during movement — a low, worse back symptoms, an emergency,
 * a reading — added to today's check-in (round 3 B06, B09; Walk N01).
 *
 * Everything is added, never replaced: news items and emergency answers join
 * what the day already holds, a reading becomes the current one with the old
 * one kept as earlier, an exercise joins the ones left out for the day, and
 * back answers are laid over today's. Only `newsGone` removes anything, for
 * the person saying a symptom has passed.
 */
export interface SymptomReport {
  news?: NewsItem[];
  /** News the person says is over, e.g. 'lowSymptoms' once the symptoms have gone. */
  newsGone?: NewsItem[];
  emergency?: EmergencyFlag[];
  /** A new reading; without `measuredAt` it is timed at the report. */
  glucose?: GlucoseReading;
  /** The meter showed HI or LO instead of a number: a reading too, timed the same way, as the check-in records one. */
  glucoseDisplay?: GlucoseDisplayReading;
  lowRecovered?: boolean;
  provoked?: string[];
  back?: Partial<NonNullable<DailyCheckIn['back']>>;
}

/** B-19: a report's reading as it is given, stamped with the clock generation it is acquired in (`acquiredIn`, H6R-03, board D186). */
export function acquiredReport(r: SymptomReport, generation: number): SymptomReport {
  return {
    ...r,
    ...(r.glucose ? { glucose: acquiredIn(r.glucose, generation) } : {}),
    ...(r.glucoseDisplay ? { glucoseDisplay: acquiredIn(r.glucoseDisplay, generation) } : {}),
  };
}

/**
 * Report symptoms into today's effective check-in and save it, the same way
 * from every screen. Built inside the store's updater, from the latest stored
 * and waiting record, so two reports in a row never lose each other. "Feeling
 * like a low is coming" is timed at `at`, so only a reading taken after it can
 * answer it. Kept waiting, and counting, if the device refuses the write.
 */
export function reportSymptoms(
  report: SymptomReport,
  deps: { profile: UserProfile; update: StoreUpdate; date: string },
  at: Date = new Date(),
): Promise<SaveResult> {
  return saveWith(deps.date, (today, recent) => applyReport(today, report, deps.date, at, recent), deps);
}

function applyReport(today: CheckInRecord | undefined, r: SymptomReport, date: string, at: Date, recent: readonly DailyCheckIn[] = []): DailyCheckIn {
  // A day with no record yet — movement that ran past midnight — gets one
  // holding only what was said. Nothing else is filled in, and the
  // emergency question stays unanswered, so it is evidence for every rule
  // but never a check-in: the next start still asks for one (scan M-01).
  const base: DailyCheckIn = today ? (({ readiness: _r, ...rest }) => { void _r; return rest; })(today) : { date, urgentSymptoms: false, news: [] };
  const gone = new Set(r.newsGone ?? []);
  const news = [...new Set([...base.news.filter(n => !gone.has(n)), ...(r.news ?? [])])];
  const reportsLow = (r.news ?? []).includes('lowSymptoms');
  const emergency = r.emergency?.length ? [...new Set([...(base.emergency ?? []), ...r.emergency])] : base.emergency;
  // A new reading, a number or the meter's HI or LO, is the current one. The
  // one it replaces goes to the earlier list when the record is saved
  // (`carryForward`), as in the check-in.
  const reading = !!(r.glucose || r.glucoseDisplay);
  const withoutReading = (({ glucose: _g, glucoseDisplay: _d, ...rest }) => { void _g; void _d; return rest; })(base);
  const timed = <T extends { measuredAt?: string }>(e: T): T => ({ ...e, measuredAt: e.measuredAt ?? at.toISOString() });
  return {
    ...(reading ? withoutReading : base),
    news,
    ...(emergency ? { emergency, urgentSymptoms: base.urgentSymptoms || emergency.length > 0 } : {}),
    ...(r.glucose ? { glucose: timed(r.glucose) } : {}),
    // A meter's HI or LO is kept only here, so in this phone's offset, written out (H3-01).
    ...(r.glucoseDisplay ? { glucoseDisplay: { ...r.glucoseDisplay, measuredAt: r.glucoseDisplay.measuredAt ?? measuredStamp(at) } } : {}),
    ...(reportsLow ? { lowSymptomsAt: at.toISOString() } : {}),
    ...(r.lowRecovered !== undefined ? { lowRecovered: r.lowRecovered } : {}),
    ...(r.provoked?.length ? { provoked: [...new Set([...(base.provoked ?? []), ...r.provoked])] } : {}),
    // Laid over today's back answers; nothing is filled in that was not said (J03, J16).
    ...(r.back ? { back: { ...base.back, ...r.back } } : {}),
    // An answer to "I need to stop" is kept as one, about every stop still
    // open, today's and earlier days' (H6R-01): so it holds as history, and a
    // stop coming back from an older copy of a day reopens nothing (H6R-05).
    ...(gone.has('stopped') ? { resolutions: [...(base.resolutions ?? []), stopAnswered([...recent, base], at)] } : {}),
  };
}

/** The answer to every stop said and not yet answered, given now. */
function stopAnswered(days: readonly DailyCheckIn[], at: Date): EpisodeAnswer {
  const readings = [...new Set(days.filter(stoppedIn).map(c => newsReadingId(c.date, 'stopped')))];
  return { kind: 'news', readings, resolution: 'resolved', at: at.toISOString() };
}

async function saveWith(
  date: string,
  build: (today: CheckInRecord | undefined, recent: readonly CheckInRecord[]) => DailyCheckIn,
  deps: { profile: UserProfile; update: StoreUpdate },
): Promise<SaveResult> {
  const { profile, update } = deps;
  let record: CheckInRecord | undefined;
  let answers: DailyCheckIn | undefined;
  /** This write's own plan, planned again only by the store: it replaces itself, not an earlier answer. */
  let own: CheckInRecord | undefined;
  const written = update(prev => {
    const list = prev.checkIns ?? [];
    const recent = list.filter(x => x.date < date);
    const mine = list.find(x => x.date === date);
    const base = effectiveRecord(mine, waitingFor(date, mine), profile, recent);
    answers = build(base, recent);
    record = toStore(profile, carryForward(base, answers), recent);
    // Given on this visit: from here it is answered, not merely kept.
    restored.delete(date);
    setWaiting(date, record, own);
    own = record;
    return { ...prev, checkIns: [...list.filter(x => x.date !== date), record] };
  });
  publish();
  const result = await written;
  const saved = record ?? toStore(profile, answers ?? build(undefined, []), []);
  if (result.ok) keptStored(date, saved);
  else refused.add(date);
  publish();
  return { record: saved, stored: result.ok };
}

/**
 * "It was a mistake" (board D119): each held measurement, exactly as the
 * refusal named it, answered as typed wrongly in today's check-in, as the
 * check-in sheet's "I typed it wrongly" answers one. A later day's answer
 * settles an earlier day's reading too, as the engine reads them, and it is
 * kept like any answer: the reading's history is what was measured and what
 * was said about it (J§4.6, K8-07).
 */
export function answerMistakes(held: readonly HeldReading[], deps: { profile: UserProfile; update: StoreUpdate }, now: Date = new Date()): Promise<SaveResult> {
  const date = toDateString(now);
  const at = now.toISOString();
  const answers: EpisodeAnswer[] = held.map(h => ({ kind: h.kind, readings: [h.id], resolution: 'mistake', at }));
  return saveWith(date, today => {
    const base: DailyCheckIn = today ?? { date, urgentSymptoms: false, news: [] };
    return { ...base, resolutions: [...(base.resolutions ?? []), ...answers] };
  }, deps);
}

// ============================================================================
// Correcting a reading typed wrongly (Track T3-01)
// ============================================================================

/** A blood-pressure reading of a day's check-in, as its lifted readings show it, and what it should have been. */
export interface PressureCorrection {
  /** When it was taken; absent when the check-in never recorded a time for it. */
  at?: string;
  was: { sys: number; dia: number };
  to: { sys: number; dia: number };
}

const sameInstant = (a: string | undefined, b: string | undefined) => a !== undefined && b !== undefined && Date.parse(a) === Date.parse(b);

/**
 * A half-entered number goes with the measurement it was the start of, and
 * only a half linked to it when its own row was completed is that (P-02,
 * Q-01). When Track corrects that reading, the half follows it while the
 * corrected reading still holds the half's number; otherwise its number was
 * part of what was typed wrongly, and it goes, as it does when Track deletes
 * the reading. Every other half is another measurement and is left as it is,
 * and so is one whose link could never have been to that reading, as the
 * engine reads it (R-02): it keeps counting, without the link.
 */
function halvesWith(record: DailyCheckIn, was: BpReading, now?: BpReading): DailyCheckIn {
  const linked = (h: BpPartialReading) => !!h.completion && h.completion.sys === was.sys && h.completion.dia === was.dia
    && (sameInstant(h.completion.at, was.at) || (h.completion.at === undefined && was.at === undefined));
  if (!record.bpPartial?.some(linked)) return record;
  const bpPartial = record.bpPartial.flatMap(h => {
    if (!linked(h)) return [h];
    if (!completes(h, was)) {
      const { completion: _impossible, ...standing } = h;
      void _impossible;
      return [standing];
    }
    return now && completes(h, now) ? [{ ...h, completion: now }] : [];
  });
  const { bpPartial: _halves, ...rest } = record;
  void _halves;
  return bpPartial.length ? { ...rest, bpPartial } : rest;
}

/**
 * The record with one blood-pressure reading corrected, or undefined when it
 * holds no such reading. Found by when it was taken and what it said; a
 * reading the check-in kept no time for, by what it said; one whose number
 * was corrected on its own before, by its time alone. The day's average is
 * worked out again when a current reading changes. The corrected reading
 * replaces the old one: a typo is not kept as an earlier reading.
 */
export function withPressureCorrected(record: DailyCheckIn, c: PressureCorrection): DailyCheckIn | undefined {
  const said = (r: BpReading) => r.sys === c.was.sys && r.dia === c.was.dia;
  const tests: ((r: BpReading) => boolean)[] = [
    r => sameInstant(r.at, c.at) && said(r),
    r => r.at === undefined && said(r),
    r => sameInstant(r.at, c.at),
  ];
  const fix = (r: BpReading): BpReading => ({ ...r, sys: c.to.sys, dia: c.to.dia });
  // A correction tried again after a refused one finds the corrected reading
  // there already, kept beside the old by the waiting copy: one reading, once (C2-01).
  const twinOf = (f: BpReading) => (r: BpReading) => r.sys === f.sys && r.dia === f.dia && (sameInstant(r.at, f.at) || (r.at === undefined && f.at === undefined));
  for (const test of tests) {
    const i = record.bpReadings?.findIndex(test) ?? -1;
    if (i >= 0) {
      const fixed = fix(record.bpReadings![i]);
      const twin = twinOf(fixed);
      const bpReadings = record.bpReadings!.flatMap((r, j) => (j === i ? [fixed] : twin(r) ? [] : [r]));
      const bp = {
        sys: Math.round(bpReadings.reduce((a, r) => a + r.sys, 0) / bpReadings.length),
        dia: Math.round(bpReadings.reduce((a, r) => a + r.dia, 0) / bpReadings.length),
      };
      const { bpEarlier: _earlier, ...rest } = record;
      void _earlier;
      const bpEarlier = (record.bpEarlier ?? []).filter(r => !twin(r));
      return halvesWith({ ...rest, bpReadings, bp, ...(bpEarlier.length ? { bpEarlier } : {}) }, record.bpReadings![i], fixed);
    }
    const k = record.bpEarlier?.findIndex(test) ?? -1;
    if (k >= 0) {
      const fixed = fix(record.bpEarlier![k]);
      const twin = twinOf(fixed);
      // When a current reading already says the same, it stands for it.
      const keep = !(record.bpReadings ?? []).some(twin);
      const { bpEarlier: _earlier, ...rest } = record;
      void _earlier;
      const bpEarlier = record.bpEarlier!.flatMap((r, j) => (j === k ? (keep ? [fixed] : []) : twin(r) ? [] : [r]));
      return halvesWith({ ...rest, ...(bpEarlier.length ? { bpEarlier } : {}) }, record.bpEarlier![k], fixed);
    }
  }
  // An older record kept its one reading only as the day's summary.
  if (!record.bpReadings?.length && record.bp && record.bp.sys === c.was.sys && record.bp.dia === c.was.dia) {
    const bp = { sys: c.to.sys, dia: c.to.dia };
    return halvesWith({ ...record, bp }, record.bp, bp);
  }
  return undefined;
}

export interface CorrectionResult {
  /** The day's check-in held the reading, so the record every gate reads was corrected. */
  matched: boolean;
  /** The device kept the write. A refused correction still counts, waiting. */
  stored: boolean;
  /** Why it was not stored. */
  failure?: string;
  /** A restore that had nothing to put back (K8-06): the check-in holds it already, or has a newer answer. */
  unchanged?: 'already' | 'newer';
  /** Refused: it would lift a hold the engine hasn't released, or the phone's clock changed (D119). Nothing changed. */
  held?: HoldFailure;
}

/**
 * Correct a check-in's blood-pressure reading — a number typed wrongly — in
 * the record every movement gate reads and in its lifted readings, in one
 * write. Built inside the store's updater from the latest stored and waiting
 * record, as `reportSymptoms` is, and kept waiting until a durable write
 * covers it: a refused write still counts, and can only tighten.
 *
 * The corrected reading is a new reading to the safety rules: an answer the
 * person gave about the old number does not settle it. A genuine reading is
 * never dropped by this: correcting is saying the number was typed wrongly;
 * a new reading is added, not corrected.
 */
export async function correctCheckInPressure(
  c: PressureCorrection,
  deps: { profile: UserProfile; update: StoreUpdate; date: string },
): Promise<CorrectionResult> {
  const { profile, update, date } = deps;
  let record: CheckInRecord | undefined;
  // What was waiting before this write, given back if it is refused (D119), and read by a plan made again.
  const prior = { record: waiting.get(date), restored: restored.has(date), earlier: earlier.get(date) ?? [] };
  let own: CheckInRecord | undefined;
  const written = update(prev => {
    if (own !== undefined && waiting.get(date) === own) giveBack(date, own, prior);
    const list = prev.checkIns ?? [];
    const recent = list.filter(x => x.date < date);
    // The same reading of what waits as every other save (`saveWith`): a copy
    // kept from before a reload is evidence, never an answer to store.
    const mine = list.find(x => x.date === date);
    const base = recordToStore(effectiveRecord(mine, waitingFor(date, mine), profile, recent));
    const fixed = base ? withPressureCorrected(base, c) : undefined;
    record = fixed ? toStore(profile, fixed, recent) : undefined;
    if (!record) return prev;
    restored.delete(date);
    setWaiting(date, record, own);
    own = record;
    return { ...prev, checkIns: [...list.filter(x => x.date !== date), record] };
  }, { readings: 'correct' });
  publish();
  const result = await written;
  if (isHeld(result.failure)) {
    giveBack(date, record, prior);
    publish();
    return { matched: record !== undefined, stored: false, failure: result.failure.message, held: result.failure };
  }
  if (!record) return { matched: false, stored: result.ok };
  if (result.ok) keptStored(date, record);
  else refused.add(date);
  publish();
  return { matched: true, stored: result.ok, ...(result.ok ? {} : { failure: result.failure?.message ?? 'The device did not keep it.' }) };
}

// ============================================================================
// A check-in's reading corrected or deleted from Track (code review C2-01)
// ============================================================================

/** One of a check-in's readings, as its lifted reading in Track shows it. */
export type CheckInReading =
  /** `at` is absent when the check-in never recorded a time for it. */
  | { kind: 'glucose'; at?: string; value: number; unit: string }
  | { kind: 'pressure'; at?: string; sys: number; dia: number }
  | { kind: 'backPain' | 'legPain'; value: number };

export interface GlucoseCorrection {
  at?: string;
  was: { value: number; unit: string };
  to: { value: number; unit: GlucoseUnit };
}

export interface PainCorrection {
  kind: 'backPain' | 'legPain';
  was: number;
  to: number;
}

type Glucose = { at?: string; value: number; unit: string };

/**
 * Where a glucose reading is in a record, tried in order: by when it was
 * taken and what it said; one the check-in kept no time for, by what it said;
 * one whose number was corrected on its own before, by its time alone.
 */
function findGlucose(record: DailyCheckIn, g: Glucose): { current: true } | { earlier: number } | undefined {
  const said = (e: GlucoseEntry) => !('display' in e) && e.value === g.value && e.unit === g.unit;
  const tests: ((e: GlucoseEntry) => boolean)[] = [
    e => sameInstant(e.measuredAt, g.at) && said(e),
    e => e.measuredAt === undefined && said(e),
    e => !('display' in e) && sameInstant(e.measuredAt, g.at),
  ];
  for (const test of tests) {
    if (record.glucose && test(record.glucose)) return { current: true };
    const k = record.glucoseEarlier?.findIndex(test) ?? -1;
    if (k >= 0) return { earlier: k };
  }
  return undefined;
}

/**
 * The record with one glucose reading corrected, or undefined when it holds
 * no such reading. The corrected number replaces the old one where it was:
 * a typo is not kept as an earlier reading. A unit confirmed for the old
 * number says nothing about the new one, so it is not carried over.
 */
export function withGlucoseCorrected(record: DailyCheckIn, c: GlucoseCorrection): DailyCheckIn | undefined {
  const where = findGlucose(record, { ...(c.at !== undefined ? { at: c.at } : {}), ...c.was });
  if (!where) return undefined;
  const fix = (e: GlucoseEntry): GlucoseReading => {
    const { unitConfirmed: _confirmed, ...kept } = e as GlucoseReading;
    void _confirmed;
    return { ...kept, value: c.to.value, unit: c.to.unit };
  };
  const fixed = fix('current' in where ? record.glucose! : record.glucoseEarlier![where.earlier]);
  // A correction tried again after a refused one finds the corrected number
  // there already, kept beside the old by the waiting copy: one reading, once.
  const twin = (e: GlucoseEntry) => !('display' in e) && e.value === fixed.value && e.unit === fixed.unit
    && (sameInstant(e.measuredAt, fixed.measuredAt) || (e.measuredAt === undefined && fixed.measuredAt === undefined));
  const { glucose: current, glucoseEarlier: _list, ...rest } = record;
  void _list;
  if ('current' in where) {
    const glucoseEarlier = (record.glucoseEarlier ?? []).filter(e => !twin(e));
    return { ...rest, glucose: fixed, ...(glucoseEarlier.length ? { glucoseEarlier } : {}) };
  }
  // Corrected among the earlier readings; when the latest already says the same, it stands for it.
  const keep = !(current && twin(current));
  const glucoseEarlier = (record.glucoseEarlier ?? []).flatMap((e, j) => (j === where.earlier ? (keep ? [fixed] : []) : twin(e) ? [] : [e]));
  return { ...rest, ...(current ? { glucose: current } : {}), ...(glucoseEarlier.length ? { glucoseEarlier } : {}) };
}

/** The record with its back or leg pain corrected, when that is the score it holds. */
export function withPainCorrected(record: DailyCheckIn, c: PainCorrection): DailyCheckIn | undefined {
  const field = c.kind === 'backPain' ? 'pain' : 'legPain';
  if (record.back?.[field] !== c.was) return undefined;
  return { ...record, back: { ...record.back, [field]: c.to } };
}

const average = (readings: readonly BpReading[]) => ({
  sys: Math.round(readings.reduce((a, r) => a + r.sys, 0) / readings.length),
  dia: Math.round(readings.reduce((a, r) => a + r.dia, 0) / readings.length),
});

/** What a check-in reading's delete took out, and where it stood, so a restore can put it back as it was (D110). */
export type KeptReading =
  | { kind: 'glucose'; slot: 'current' | 'earlier'; entry: GlucoseReading }
  | { kind: 'pressure'; slot: 'readings' | 'earlier' | 'summary'; entry: BpReading; halves: BpPartialReading[] }
  | { kind: 'backPain' | 'legPain'; value: number };

/**
 * The record with one reading taken out, and what it took; undefined when it
 * holds no such reading. What deleting it in Track means, so the record cannot
 * bring it back. Deleting the latest glucose makes the one before it the
 * latest again, as it was before that reading was entered; deleting a current
 * blood-pressure reading works the day's average out again from the rest.
 */
export function takenOut(record: DailyCheckIn, r: CheckInReading): { record: DailyCheckIn; kept: KeptReading } | undefined {
  if (r.kind === 'glucose') {
    const where = findGlucose(record, r);
    if (!where) return undefined;
    const { glucose: _gone, glucoseEarlier: _list, ...rest } = record;
    void _gone; void _list;
    if ('earlier' in where) {
      const entry = record.glucoseEarlier![where.earlier] as GlucoseReading;
      const glucoseEarlier = record.glucoseEarlier!.filter((_, j) => j !== where.earlier);
      return { record: { ...rest, ...(record.glucose ? { glucose: record.glucose } : {}), ...(glucoseEarlier.length ? { glucoseEarlier } : {}) }, kept: { kind: 'glucose', slot: 'earlier', entry } };
    }
    // The latest went; with no HI or LO shown after it, the one before it is the latest again.
    const earlier = [...(record.glucoseEarlier ?? [])];
    const before = record.glucoseDisplay ? undefined : earlier.pop();
    const promoted = before === undefined ? {} : 'display' in before ? { glucoseDisplay: before } : { glucose: before };
    return { record: { ...rest, ...promoted, ...(earlier.length ? { glucoseEarlier: earlier } : {}) }, kept: { kind: 'glucose', slot: 'current', entry: record.glucose! } };
  }

  if (r.kind === 'pressure') {
    const halves = record.bpPartial ?? [];
    const said = (b: BpReading) => b.sys === r.sys && b.dia === r.dia;
    const tests: ((b: BpReading) => boolean)[] = [b => sameInstant(b.at, r.at) && said(b), b => b.at === undefined && said(b), b => sameInstant(b.at, r.at)];
    for (const test of tests) {
      const i = record.bpReadings?.findIndex(test) ?? -1;
      if (i >= 0) {
        const bpReadings = record.bpReadings!.filter((_, j) => j !== i);
        const { bp: _bp, bpReadings: _all, ...rest } = record;
        void _bp; void _all;
        const entry = record.bpReadings![i];
        return { record: halvesWith(bpReadings.length ? { ...rest, bpReadings, bp: average(bpReadings) } : rest, entry), kept: { kind: 'pressure', slot: 'readings', entry, halves } };
      }
      const k = record.bpEarlier?.findIndex(test) ?? -1;
      if (k >= 0) {
        const bpEarlier = record.bpEarlier!.filter((_, j) => j !== k);
        const { bpEarlier: _list, ...rest } = record;
        void _list;
        const entry = record.bpEarlier![k];
        return { record: halvesWith(bpEarlier.length ? { ...rest, bpEarlier } : rest, entry), kept: { kind: 'pressure', slot: 'earlier', entry, halves } };
      }
    }
    // An older record kept its one reading only as the day's summary.
    if (!record.bpReadings?.length && record.bp && said(record.bp)) {
      const { bp: _bp, ...rest } = record;
      void _bp;
      return { record: halvesWith(rest, record.bp), kept: { kind: 'pressure', slot: 'summary', entry: record.bp, halves } };
    }
    return undefined;
  }

  const field = r.kind === 'backPain' ? 'pain' : 'legPain';
  if (record.back?.[field] !== r.value) return undefined;
  const { [field]: _score, ...back } = record.back;
  void _score;
  const { back: _back, ...rest } = record;
  void _back;
  return { record: Object.keys(back).length ? { ...rest, back } : rest, kept: { kind: r.kind, value: r.value } };
}

export function withReadingRemoved(record: DailyCheckIn, r: CheckInReading): DailyCheckIn | undefined {
  return takenOut(record, r)?.record;
}

/**
 * A reading a delete took out, put back where it stood (D110): the latest
 * again if it was, with the one promoted when it went back before it; a blood
 * pressure reading among the day's again, its average worked out again and
 * its half-entered numbers relinked. 'already' when the record holds it
 * already; 'newer' when a pain score has been answered again since: that
 * answer is the day's own (K8-06).
 */
export function withReadingPutBack(record: DailyCheckIn, k: KeptReading): DailyCheckIn | 'already' | 'newer' {
  if (k.kind === 'glucose') {
    const same = (e: GlucoseEntry) => !('display' in e) && e.value === k.entry.value && e.unit === k.entry.unit
      && (sameInstant(e.measuredAt, k.entry.measuredAt) || (e.measuredAt === undefined && k.entry.measuredAt === undefined));
    if ([...(record.glucoseEarlier ?? []), ...(record.glucose ? [record.glucose] : [])].some(same)) return 'already';
    if (k.slot === 'current' && !record.glucoseDisplay) {
      const earlier = [...(record.glucoseEarlier ?? []), ...(record.glucose ? [record.glucose] : [])];
      return { ...record, glucose: k.entry, ...(earlier.length ? { glucoseEarlier: earlier } : {}) };
    }
    return { ...record, glucoseEarlier: [...(record.glucoseEarlier ?? []), k.entry] };
  }
  if (k.kind === 'pressure') {
    const same = (b: BpReading) => b.sys === k.entry.sys && b.dia === k.entry.dia && (sameInstant(b.at, k.entry.at) || (b.at === undefined && k.entry.at === undefined));
    if ([...(record.bpReadings ?? []), ...(record.bpEarlier ?? []), ...(record.bp && !record.bpReadings?.length ? [record.bp] : [])].some(same)) return 'already';
    const byId = new Map((record.bpPartial ?? []).map(h => [bpPartialId(h, record.date), h] as const));
    for (const h of k.halves) byId.set(bpPartialId(h, record.date), h);
    const withHalves = byId.size ? { bpPartial: [...byId.values()] } : {};
    if (k.slot === 'earlier') return { ...record, bpEarlier: [...(record.bpEarlier ?? []), k.entry], ...withHalves };
    if (k.slot === 'summary' && !record.bpReadings?.length && !record.bp) return { ...record, bp: k.entry, ...withHalves };
    const bpReadings = [...(record.bpReadings ?? []), k.entry];
    return { ...record, bpReadings, bp: average(bpReadings), ...withHalves };
  }
  const field = k.kind === 'backPain' ? 'pain' : 'legPain';
  if (record.back?.[field] === k.value) return 'already';
  if (record.back?.[field] !== undefined) return 'newer';
  return { ...record, back: { ...(record.back ?? {}), [field]: k.value } };
}

export const ALREADY_BACK = 'Already back in your check-in.';
export const NEWER_STAYS = 'Your newer answer stays.';

/** What waited for `date` before a write, back in place of the record that write set, when it is still that record's. */
function giveBack(date: string, mine: CheckInRecord | undefined, prior: { record: CheckInRecord | undefined; restored: boolean; earlier: CheckInRecord[] }): void {
  if (mine === undefined || waiting.get(date) !== mine) return;
  if (prior.record) waiting.set(date, prior.record);
  else waiting.delete(date);
  if (prior.earlier.length) earlier.set(date, prior.earlier);
  else earlier.delete(date);
  if (prior.restored) restored.add(date);
}

/**
 * Change a day's check-in where every movement gate reads it, in the same
 * write as its readings, as `correctCheckInPressure` does: built inside the
 * store's updater from the latest stored and waiting record (as a save reads
 * them), and waiting until a durable write covers it, so a refused write
 * still counts and can only tighten. `fix` gives the changed record, or
 * nothing when the day's check-in does not hold the reading.
 */
async function reviseCheckIn(
  fix: (record: CheckInRecord) => DailyCheckIn | undefined,
  deps: { profile: UserProfile; update: StoreUpdate; date: string },
  options: NonNullable<Parameters<StoreUpdate>[1]>,
): Promise<CorrectionResult> {
  const { profile, update, date } = deps;
  let record: CheckInRecord | undefined;
  // What was waiting before this write. A plan made again (a restore's, at its commit: P8S-09) reads that,
  // never its own earlier plan's record, which would look like the change made already.
  const prior = { record: waiting.get(date), restored: restored.has(date), earlier: earlier.get(date) ?? [] };
  let own: CheckInRecord | undefined;
  const written = update(prev => {
    if (own !== undefined && waiting.get(date) === own) giveBack(date, own, prior);
    const list = prev.checkIns ?? [];
    const recent = list.filter(x => x.date < date);
    const mine = list.find(x => x.date === date);
    const base = recordToStore(effectiveRecord(mine, waitingFor(date, mine), profile, recent));
    const fixed = base ? fix(base) : undefined;
    record = fixed ? toStore(profile, fixed, recent) : undefined;
    if (!record) return prev;
    restored.delete(date);
    setWaiting(date, record, own);
    own = record;
    return { ...prev, checkIns: [...list.filter(x => x.date !== date), record] };
  }, options);
  publish();
  const result = await written;
  if (isHeld(result.failure)) {
    // Refused before anything was written (D119): what waited before waits again, and nothing else moved.
    giveBack(date, record, prior);
    publish();
    return { matched: record !== undefined, stored: false, failure: result.failure.message, held: result.failure };
  }
  const failure = result.ok ? {} : { failure: result.failure?.message ?? 'The device did not keep it.' };
  if (!record) return { matched: false, stored: result.ok, ...failure };
  if (result.ok) keptStored(date, record);
  else refused.add(date);
  publish();
  return { matched: true, stored: result.ok, ...failure };
}

/**
 * Correct a check-in's glucose reading — a number typed wrongly — in the
 * record every gate reads and in its lifted reading, in one write. The
 * corrected number is a new reading to the safety rules: an answer about the
 * old one does not settle it.
 */
export function correctCheckInGlucose(c: GlucoseCorrection, deps: { profile: UserProfile; update: StoreUpdate; date: string }): Promise<CorrectionResult> {
  return reviseCheckIn(record => withGlucoseCorrected(record, c), deps, { readings: 'correct' });
}

/** Correct a check-in's back or leg pain score in the record and its reading, in one write. */
export function correctCheckInPain(c: PainCorrection, deps: { profile: UserProfile; update: StoreUpdate; date: string }): Promise<CorrectionResult> {
  return reviseCheckIn(record => withPainCorrected(record, c), deps, { readings: 'correct' });
}

/**
 * Delete a check-in's reading: from the record every gate reads and from the
 * series, in one write, so neither can bring the other back on the next save.
 * The series readings named go even when the record no longer holds the
 * reading (`matched` false): then nothing can bring them back.
 */
export function removeCheckInReading(
  r: CheckInReading,
  observationIds: readonly string[],
  deps: { profile: UserProfile; update: StoreUpdate; date: string },
  /** A routine delete (D111): kept in Recently deleted for 7 days, with the readings as Track showed them. */
  recent?: { entry: string; at: string; observations: readonly Observation[] },
): Promise<CorrectionResult> {
  let kept: KeptReading | undefined;
  return reviseCheckIn(record => {
    const out = takenOut(record, r);
    kept = out?.kept;
    return out?.record;
  }, deps, {
    removeObservations: observationIds,
    ...(recent ? {
      edit: false as const,
      content: () => (kept ? { put: { [recentKey(recent.entry)]: checkInReadingEntry(recent, deps.date, kept, recent.observations) } } : undefined),
    } : {}),
  });
}

/**
 * A check-in's reading put back from Recently deleted (B-05, D110, D111,
 * P8R-03): into its day's check-in where it stood, and its rows into the
 * series under fresh ids with `restoredFrom`, the entry used up, in one
 * write. What was measured is its identity, apart from any row's id (R5-01):
 * `prepare` drops the measurement's deletion record as its row returns, and
 * keeps the old id's, so an older backup can't bring the old row back beside
 * it. When the check-in holds it already, or has a newer pain answer, nothing
 * is put back and the entry goes all the same, with words to say so (K8-06).
 */
export async function restoreCheckInReading(
  entry: { id: string; kept: KeptReading; observations?: readonly Observation[] },
  deps: { profile: UserProfile; update: StoreUpdate; date: string },
): Promise<CorrectionResult> {
  let unchanged: 'already' | 'newer' | undefined;
  // One stem for the whole reading, so a blood pressure's two halves stay one reading: letters and digits
  // only, the token `checkInDayOf` reads after `#`, so the rows stay the check-in's (P8S-07).
  const stem = `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.replace(/[^0-9a-z]/g, '');
  const rows = (entry.observations ?? []).map(o => ({
    ...o,
    id: `${stem}:${o.kind}`,
    ...(o.context?.startsWith('bp:') ? { context: `bp:checkIn:${deps.date}#${stem}` } : {}),
    restoredFrom: o.id,
  }));
  const result = await reviseCheckIn(record => {
    const next = withReadingPutBack(record, entry.kept);
    unchanged = typeof next === 'string' ? next : undefined;
    return typeof next === 'string' ? undefined : next;
  }, deps, {
    readings: 'append',
    edit: false,
    entry: entry.id,
    restored: () => (unchanged ? [] : rows),
  });
  // Nothing to put back: the entry was still used up, in that same write.
  return unchanged ? { ...result, matched: true, unchanged } : result;
}
