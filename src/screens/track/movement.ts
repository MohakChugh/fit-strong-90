/**
 * Recorded movement minutes: what the weekly ring counts (board D31).
 *
 * Movement reaches the record three ways — a `movementMinutes` observation,
 * a walk's `walkDuration`, or a session in `sessions` — and one activity can
 * arrive by more than one of them. So each activity is first expressed as one
 * `sessionObserved` interval, and the minutes are then added by
 * `aggregate.sum`, the only place observations are combined: overlapping
 * intervals are counted once and reported, never added twice (D10).
 *
 * Only observed activity time counts. A whole-day movement total (`dayTotal`)
 * is a different kind of statement and is never mixed in.
 */

import type { WorkoutSession } from '@/types';
import { sum, type DayRange, type Flag } from '@/health/aggregate';
import { newObservation, nowAt, type Observation } from '@/health/observation';
import { addDays } from './periods';

export interface MovementTotal {
  /** Minutes, unrounded. Zero when nothing was recorded. */
  minutes: number;
  /**
   * Of those, the minutes the person entered rather than the app measured — a
   * workout written down, time added to a walk for a gap — so the total can
   * say so instead of passing them off as observed (codex-vision §9).
   */
  enteredMinutes: number;
  /**
   * A hand-logged workout's entered minutes have no time of their own, but its
   * span from first set to finish took in measured activity: those minutes may
   * already include it. Said, not guessed away in either direction (R01).
   */
  mayRepeat: boolean;
  /** The intervals counted. */
  counted: Observation[];
  /** Overlaps and other things the person should be told. */
  flags: Flag[];
}

/** The `walk:` or `session:` id an interval belongs to, so a second copy of it is recognised. */
function activityOf(o: Pick<Observation, 'context'>): string | undefined {
  const c = o.context;
  return c !== undefined && (c.startsWith('walk:') || c.startsWith('session:')) ? c : undefined;
}

/** An instant written in a given offset, in the observation format: the same moment, another clock. */
function atInOffset(ms: number, offsetMinutes: number): string {
  if (offsetMinutes === 0) return `${new Date(ms).toISOString().slice(0, 23)}Z`;
  const wall = new Date(ms + offsetMinutes * 60_000).toISOString().slice(0, 23);
  const abs = Math.abs(offsetMinutes);
  return `${wall}${offsetMinutes < 0 ? '-' : '+'}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

/** The offset an observation's time is written in, in minutes east of UTC. */
function offsetOf(at: string): number {
  const m = /([+-])(\d{2}):(\d{2})$/.exec(at);
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
}

/**
 * A session's start, written so that it falls on the day the session was
 * recorded (`session.date`). A session keeps the instant it started but not
 * the offset it was captured in, so on a device that has since changed zone
 * the device's clock could move a Monday session to Sunday, and last week's
 * ring with it (F19). This documented fallback writes the same instant in the
 * nearest offset that keeps the recorded day; only when no real offset can,
 * the device's own is used.
 */
function startOnRecordedDay(ms: number, day: string): string {
  const local = nowAt(new Date(ms));
  if (local.slice(0, 10) === day) return local;
  const device = -new Date(ms).getTimezoneOffset();
  let best: number | undefined;
  for (let offset = -12 * 60; offset <= 14 * 60; offset += 15) {
    if (atInOffset(ms, offset).slice(0, 10) !== day) continue;
    if (best === undefined || Math.abs(offset - device) < Math.abs(best - device)) best = offset;
  }
  return best === undefined ? local : atInOffset(ms, best);
}

/**
 * A guided session as a movement interval: from its start, for the active time
 * the player measured. A hand-logged workout is not an interval: the active
 * minutes the person entered say how long, not when, and a block placed at
 * the first set would be timing nobody measured — enough to hide a walk taken
 * in between as an "overlap" (R01). Those minutes are entered time on the
 * workout's day (`enteredTotal`). Never the wall-clock span from first set to
 * finish, which can be hours of a locked phone (F20). A session with no start
 * or no active time cannot be placed, so it is left out, not given one.
 */
export function sessionInterval(session: WorkoutSession): Observation | undefined {
  if (!session.guided || !session.startedAt) return undefined;
  const seconds = session.durationSeconds;
  if (seconds === undefined || !(seconds > 0)) return undefined;
  const start = Date.parse(session.startedAt);
  if (!Number.isFinite(start)) return undefined;
  return newObservation({
    id: `session:${session.id}:movement`,
    kind: 'movementMinutes',
    scope: 'sessionObserved',
    // The player measured it.
    source: 'measured',
    at: startOnRecordedDay(start, session.date),
    value: seconds / 60,
    coverageMs: seconds * 1000,
    context: `session:${session.id}`,
  });
}

/** A hand-logged workout's entered active minutes: a total on its recorded day, with no time of its own. */
function enteredTotal(session: WorkoutSession): number | undefined {
  if (session.guided) return undefined;
  const seconds = session.durationSeconds;
  return typeof seconds === 'number' && seconds > 0 ? seconds / 60 : undefined;
}

/** One interval's identity: two records of the same stretch of time for the same activity are one. */
function intervalKey(o: Observation): string {
  return `${activityOf(o) ?? o.id}|${Date.parse(o.at)}|${o.coverageMs ?? 0}`;
}

/**
 * The part of an interval inside a range of local days, in the interval's own
 * clock: a walk from 23:59 to 00:02 is one minute on the first day and two on
 * the next, and each week gets its own share (F17). Undefined when none of it
 * falls inside.
 */
function clip(o: Observation, range: DayRange): Observation | undefined {
  const start = Date.parse(o.at);
  const length = o.coverageMs ?? 0;
  if (!(length > 0)) return undefined;
  const zone = o.at.endsWith('Z') ? 'Z' : o.at.slice(-6);
  const from = Date.parse(`${range.from}T00:00:00.000${zone}`);
  const to = Date.parse(`${addDays(range.to, 1)}T00:00:00.000${zone}`);
  const begin = Math.max(start, from);
  const end = Math.min(start + length, to);
  if (end <= begin) return undefined;
  if (begin === start && end === start + length) return o;
  return newObservation({
    id: `${o.id}:${range.from}`,
    kind: o.kind,
    scope: o.scope,
    source: o.source,
    at: atInOffset(begin, offsetOf(o.at)),
    value: (o.value * (end - begin)) / length,
    coverageMs: end - begin,
    ...(o.context !== undefined ? { context: o.context } : {}),
  });
}

/**
 * Every movement interval in a range, one per stretch of activity: stored
 * `movementMinutes` intervals first, then walk segments and sessions that
 * have none. Copies of one interval are dropped; distinct segments of the same
 * walk all count (F18). Each is clipped to the range at local midnight.
 */
export function movementIntervals(range: DayRange, observations: readonly Observation[], sessions: readonly WorkoutSession[]): Observation[] {
  // A day early, for an interval that started the evening before the range.
  const near = (day: string) => day >= addDays(range.from, -1) && day <= range.to;
  const stored = observations.filter(o => o.kind === 'movementMinutes' && o.scope === 'sessionObserved' && near(o.day));
  const seen = new Set(stored.map(intervalKey));
  const activities = new Set(stored.map(activityOf).filter((c): c is string => c !== undefined));

  const walks: Observation[] = [];
  for (const o of observations) {
    if (o.kind !== 'walkDuration' || o.scope !== 'sessionObserved' || !near(o.day)) continue;
    if (typeof o.coverageMs !== 'number' || !(o.coverageMs > 0)) continue;
    const key = intervalKey(o);
    if (seen.has(key)) continue;
    seen.add(key);
    walks.push(newObservation({
      id: `${o.id}:movement`,
      kind: 'movementMinutes',
      scope: 'sessionObserved',
      source: o.source,
      at: o.at,
      value: o.value,
      coverageMs: o.coverageMs,
      ...(o.context !== undefined ? { context: o.context } : {}),
    }));
  }

  const fromSessions: Observation[] = [];
  for (const s of sessions) {
    // A session is one interval: a movement record of its own already stands for it.
    if (activities.has(`session:${s.id}`)) continue;
    const interval = sessionInterval(s);
    if (interval && near(interval.day)) fromSessions.push(interval);
  }

  return [...stored, ...walks, ...fromSessions]
    .map(o => clip(o, range))
    .filter((o): o is Observation => o !== undefined);
}

/**
 * Recorded movement minutes over a range: placed intervals through
 * `aggregate.sum`, which counts overlaps once (D10), plus the active minutes
 * entered for hand-logged workouts, as entered time on their recorded days.
 * Those have no interval, so they are never tested against the overlap rule
 * nor allowed to hide measured time; they are added as stated, and named as
 * entered (`enteredMinutes`, `mayRepeat`).
 */
export function recordedMovement(range: DayRange, observations: readonly Observation[], sessions: readonly WorkoutSession[]): MovementTotal {
  const intervals = movementIntervals(range, observations, sessions);
  // One unit is guaranteed — `movementMinutes` has only `min` — so `sum`
  // cannot refuse this set; it can only exclude overlaps.
  const placed = intervals.length > 0 ? sum(intervals) : undefined;
  const counted = placed?.contributed ?? [];

  // A workout whose own movement record stands for it is already counted.
  const represented = new Set(observations.filter(o => o.kind === 'movementMinutes' && o.scope === 'sessionObserved').map(activityOf));
  const unplaced = sessions
    .filter(s => s.date >= range.from && s.date <= range.to && !represented.has(`session:${s.id}`))
    .map(s => ({ session: s, minutes: enteredTotal(s) }))
    .filter((e): e is { session: WorkoutSession; minutes: number } => e.minutes !== undefined);
  const unplacedMinutes = unplaced.reduce((total, e) => total + e.minutes, 0);

  // Already free of overlaps, so the entered share is summed as it stands.
  const enteredIntervals = counted.filter(o => o.source === 'manual');
  const measured = counted.filter(o => o.source !== 'manual');
  const mayRepeat = unplaced.some(({ session }) => {
    const from = Date.parse(session.startedAt ?? '');
    const to = Date.parse(session.completedAt ?? '');
    if (!Number.isFinite(from) || !Number.isFinite(to)) return false;
    return measured.some(o => Date.parse(o.at) < to && Date.parse(o.at) + (o.coverageMs ?? 0) > from);
  });

  return {
    minutes: (placed?.value ?? 0) + unplacedMinutes,
    enteredMinutes: (enteredIntervals.length > 0 ? sum(enteredIntervals).value : 0) + unplacedMinutes,
    mayRepeat,
    counted,
    flags: placed?.flags ?? [],
  };
}

/**
 * Whole minutes for display, to the nearest, the one rule for movement minutes
 * (scan J2-10): a session's summary, its row in Track, the weekly ring and
 * Today all say the same number for the same session.
 */
export function wholeMinutes(minutes: number): number {
  return Math.round(minutes + 1e-9);
}

export type CheckedGoal = { ok: true; minutes: number } | { ok: false; message: string };

/**
 * A weekly goal the person typed. Whole minutes, at least 10 and at most 2,000
 * (about 4½ hours a day) — beyond that it is a slip of the finger, not a plan.
 */
export function checkWeeklyGoal(raw: string): CheckedGoal {
  const text = raw.trim();
  if (text === '') return { ok: false, message: 'Enter the minutes you would like each week.' };
  if (!/^\d+$/.test(text)) return { ok: false, message: 'Enter whole minutes, using digits only.' };
  const minutes = Number(text);
  if (minutes < 10) return { ok: false, message: 'Choose at least 10 minutes a week.' };
  if (minutes > 2000) return { ok: false, message: 'That is more than 4 hours a day. Choose 2,000 minutes a week or fewer.' };
  return { ok: true, minutes };
}

/** WHO 2020: adults, 150 to 300 minutes of moderate activity a week. Offered, never set. */
export const WHO_WEEKLY_MINUTES = 150;
