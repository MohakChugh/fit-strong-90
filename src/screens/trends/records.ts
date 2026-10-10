/**
 * What counts in Trends (journey §12.3, A-40). Every figure is read through
 * v1's typed aggregation and its overlap rules (D10, F17, F19), or through
 * Plan 2's own readings of a day's steps and of a hub's history, so a figure
 * here is the figure Home, the hubs and Today's log show.
 */
import type { Mode } from '@/engine/permission';
import { series, type DayRange } from '@/health/aggregate';
import { nowAt, type Observation } from '@/health/observation';
import { activitiesFrom } from '@/health/recommend';
import { movementHistory, type HistoryRow } from '@/screens/hub/week';
import type { DisplayPrefs } from '@/screens/track/format';
import { addDays } from '@/screens/track/periods';
import { stepsDayFigure } from '@/screens/track/stepsDay';
import type { WorkoutSession } from '@/types';
import type { CheckInRecord } from '@/types/checkin';
import { walkRecords } from '@/walk/record';
import type { DayFigure, MeterReading } from './stats';

export interface TrendData {
  observations: readonly Observation[];
  sessions: readonly WorkoutSession[];
  checkIns: readonly CheckInRecord[];
}

/** The first day anything was recorded (J§12.2, early days): nothing before it is a day of the record. */
export function firstRecordDay({ observations, sessions, checkIns }: TrendData): string | undefined {
  let first: string | undefined;
  const see = (day: string | undefined) => {
    if (typeof day === 'string' && (first === undefined || day < first)) first = day;
  };
  for (const o of observations) see(o.day);
  for (const s of sessions) see(s.date);
  for (const c of checkIns) see(c.date);
  return first;
}

const did = (s: WorkoutSession) => s.status === 'completed' || s.status === 'partial';

/** Programme sessions or stretches with work in them, as the recommendation counts them (`activitiesFrom`). */
export function sessionsOf(mode: 'programme' | 'stretch', sessions: readonly WorkoutSession[]): WorkoutSession[] {
  const ids = new Set(activitiesFrom(sessions, []).filter(a => a.mode === mode).map(a => a.id));
  return sessions.filter(s => ids.has(`session:${s.id}`));
}

/**
 * Each day's active minutes, as the sessions recorded them (`durationSeconds`,
 * pauses excluded, the figure `sessionInterval` places): a category's own
 * time. A stopped session keeps its partial minutes (§12.3). The week's
 * recorded movement across categories, overlaps resolved (F19), is
 * `recordedMovement`'s, as Home's ring and Your week say it.
 */
export function sessionMinutes(sessions: readonly WorkoutSession[], range: DayRange): DayFigure[] {
  const byDay = new Map<string, number>();
  for (const s of sessions) {
    if (s.date < range.from || s.date > range.to) continue;
    const seconds = s.durationSeconds;
    if (typeof seconds !== 'number' || !(seconds > 0)) continue;
    byDay.set(s.date, (byDay.get(s.date) ?? 0) + seconds / 60);
  }
  return [...byDay].sort(([a], [b]) => (a < b ? -1 : 1)).map(([day, value]) => ({ day, value }));
}

/** §12.3: the days with a stretch routine, or with any session whose mobility block was done. */
export function stretchedDays(sessions: readonly WorkoutSession[]): Set<string> {
  const out = new Set(sessionsOf('stretch', sessions).map(s => s.date));
  for (const s of sessions) if (did(s) && s.mobility?.some(m => m.seconds > 0)) out.add(s.date);
  return out;
}

/** Walking time or distance by day: overlapping walks once, the first kept, each on the day it started (D10, F17). */
export function walkFigures(kind: 'walkDuration' | 'walkDistance', range: DayRange, observations: readonly Observation[]): DayFigure[] {
  return series(kind, range, observations).points.filter(p => p.scope === 'sessionObserved').map(p => ({ day: p.day, value: p.value }));
}

/** A day total (water, sleep) by day: the statement that counts, by the replace rule (D10). */
export function dayTotals(kind: 'water' | 'sleep', range: DayRange, observations: readonly Observation[]): DayFigure[] {
  return series(kind, range, observations).points.filter(p => p.scope === 'dayTotal').map(p => ({ day: p.day, value: p.value }));
}

/**
 * The days of `range` with steps, each as Plan 2's `stepsDayFigure` says it
 * (J§9.6): an entered total, FitStrong walks only, or at least the total
 * plus the walks after it. Every day with steps or a walk is asked, and
 * `stepsDayFigure` decides, so how it credits a walk is its own rule. Each
 * day is read with its own steps and walks and the day's either side, for
 * a walk past midnight either way, so its figure is the one Home gives it
 * from the whole record. The rest isn't read: two years of days asked of
 * every record at once took 2.4 s.
 */
export function stepsDays(range: DayRange, observations: readonly Observation[], hour12: boolean): DayFigure[] {
  const from = addDays(range.from, -1);
  const to = addDays(range.to, 1);
  const byDay = new Map<string, Observation[]>();
  for (const o of observations) {
    if (o.day < from || o.day > to || (o.kind !== 'steps' && !(o.context?.startsWith('walk:') ?? false))) continue;
    const held = byDay.get(o.day);
    if (held) held.push(o);
    else byDay.set(o.day, [o]);
  }
  const days = [...byDay.keys()].filter(day => day >= range.from && day <= range.to).sort();
  return days.flatMap((day): DayFigure[] => {
    const near = [addDays(day, -1), day, addDays(day, 1)].flatMap(d => byDay.get(d) ?? []);
    const f = stepsDayFigure(day, near, hour12);
    if (f.kind === 'none' || f.steps === undefined) return [];
    return [{ day, value: f.steps, basis: f.kind, note: f.source }];
  });
}

/** An instant written in its own offset ("+05:30"), not as UTC: the clock it was measured on is in it. */
const OWN_OFFSET = /[+-]\d{2}:\d{2}$/;

/** The day an instant falls on at a fixed offset from UTC, in hours. */
const dayAtOffset = (ms: number, hours: number) => new Date(ms + hours * 3_600_000).toISOString().slice(0, 10);

/**
 * A meter's HI and LO, from the check-ins: the only place they are kept,
 * because they have no number (K-11). Each once, on the day and at the clock
 * it was measured, in the offset it was measured in, wherever the phone is
 * now (J§4.10); on the check-in's day when no time was kept. One kept only as
 * a UTC instant, saved before the offset was (H3-01), has lost its zone: it
 * is read on this phone's clock, as the check-in's numbers were filed when it
 * was saved (`local` in store/project.ts), and says the days it could have
 * been measured on, from UTC−12 to UTC+14.
 */
export function meterReadings(checkIns: readonly CheckInRecord[]): MeterReading[] {
  const out: MeterReading[] = [];
  for (const c of checkIns) {
    const seen = new Set<string>();
    const entries = [...(Array.isArray(c.glucoseEarlier) ? c.glucoseEarlier : []), ...(c.glucoseDisplay ? [c.glucoseDisplay] : [])];
    for (const e of entries) {
      if (!('display' in e) || (e.display !== 'HI' && e.display !== 'LO')) continue;
      const raw = typeof e.measuredAt === 'string' ? e.measuredAt : '';
      const ms = Date.parse(raw);
      const timed = Number.isFinite(ms);
      const kept = timed && OWN_OFFSET.test(raw);
      const at = kept ? raw : timed ? nowAt(new Date(ms)) : undefined;
      // One measurement, however its time was written.
      const key = `${e.display}|${timed ? ms : ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        day: at ? at.slice(0, 10) : c.date, ...(at ? { at } : {}), display: e.display,
        ...(timed && !kept ? { couldBe: { from: dayAtOffset(ms, -12), to: dayAtOffset(ms, 14) } } : {}),
      });
    }
  }
  return out;
}

export interface ActivityRow extends HistoryRow {
  kind: 'workout' | 'stretch' | 'walk';
  /** The day it counts on: a session's recorded day, or a walk's first. */
  day: string;
  /** What a mixed list calls it: the session's name, or "Walk · 25 min". */
  heading: string;
}

const KINDS: readonly [ActivityRow['kind'], Mode][] = [['workout', 'guided'], ['stretch', 'stretch'], ['walk', 'walk']];

/** Workouts, stretches and walks, newest first, each as its hub's history shows it (Plan 2's `movementHistory`). */
export function activities(data: TrendData, prefs: DisplayPrefs, current: string): ActivityRow[] {
  const sessionDay = new Map(data.sessions.map(s => [`session:${s.id}`, s.date]));
  const walkDay = new Map(walkRecords(data.observations).map(w => [`walk:${w.id}`, w.day]));
  return KINDS.flatMap(([kind, mode]) => movementHistory(mode, data.sessions, data.observations, prefs, current).map((r): ActivityRow => ({
    ...r,
    kind,
    day: sessionDay.get(r.key) ?? walkDay.get(r.key) ?? r.at.slice(0, 10),
    heading: kind === 'walk' ? `Walk · ${r.label}` : r.label,
  }))).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
