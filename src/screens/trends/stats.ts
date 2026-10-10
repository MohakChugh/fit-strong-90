/**
 * The statistics a trend states (journey §12.2, B-15), by kind of measure:
 *
 * - `counted`: recorded movement (minutes of workouts, stretches, walks). The
 *   app records every activity it knows of, so a day of the record with
 *   nothing in it is a real 0, and a day of data. A status day (Away, Unwell,
 *   Flare-up) is shaded and isn't a day of data, though what was recorded on
 *   it still counts (D25, K-49).
 * - `stated`: steps, water and sleep, which the person enters. A day without
 *   a figure is "Not entered", never 0, and isn't a day of data (D14).
 * - readings: each numeric reading counts once, at its measured time. A
 *   meter's HI or LO has no number and is never averaged (K-11). Readings on
 *   status days are never left out, only named (A-43).
 *
 * A comparison needs 3 days of data in both windows, and a LO in either
 * window hides a readings change (B-15). Pure: the caller supplies the days.
 */
import type { DayRange } from '@/health/aggregate';
import { statusOn, weekdayOf, type Status } from '@/health/status';
import { daysBetween, daysIn } from '@/screens/track/periods';
import { roundTo } from '@/screens/track/units';
import type { DayOfWeek, StatusPeriod } from '@/types';
import type { TrendPeriod } from './periods';

export type StatusMark = Exclude<Status, 'normal'>;

export interface DayContext {
  today: string;
  /** The first day of the person's record. Absent: nothing recorded yet. */
  since?: string;
  statusOn: (day: string) => Status;
  /** A rest day in the programme's plan, shaded in movement charts. */
  restOn: (day: string) => boolean;
}

/** The day context from the settings: statuses, and the programme's rest days from its start. */
export function dayContext({ today, since, statusPeriods, restDays, startDate }: {
  today: string;
  since?: string;
  statusPeriods?: readonly StatusPeriod[];
  restDays: readonly DayOfWeek[];
  startDate: string;
}): DayContext {
  return {
    today,
    ...(since ? { since } : {}),
    statusOn: day => statusOn(statusPeriods, day),
    restOn: day => restDays.length > 0 && startDate !== '' && day >= startDate && restDays.includes(weekdayOf(day)),
  };
}

/** The days of `range` that are part of the record: from its first day to today. */
export function recordDays(range: DayRange, ctx: DayContext): string[] {
  if (!ctx.since) return [];
  const from = range.from > ctx.since ? range.from : ctx.since;
  const to = range.to < ctx.today ? range.to : ctx.today;
  return from > to ? [] : daysIn({ from, to });
}

/** One day's figure for a daily trend. */
export interface DayFigure {
  day: string;
  value: number;
  /** Steps (J§9.6): an entered total, FitStrong walks only, or at least the entered total plus walks after it. */
  basis?: 'entered' | 'walks' | 'atLeast';
  /** Where the figure came from, in words: "entered at 6:00 pm". */
  note?: string;
}

export type DailyRule = 'counted' | 'stated';

export interface DailyStats {
  /** Everything recorded on the record's days in the range, status days included. */
  sum: number;
  /** Days of data, by the rule. */
  days: number;
  /** Days of the record in the range. */
  recordDays: number;
  /** `sum ÷ days`; absent with no day of data. */
  perDay?: number;
  /** The highest day of data. */
  high?: { day: string; value: number };
  /** Status days in the range, by kind. */
  status: Partial<Record<StatusMark, number>>;
  /** Days whose figure is a lower bound: steps from walks only, or "at least". */
  partialDays: number;
}

export function dailyStats(range: DayRange, figures: readonly DayFigure[], ctx: DayContext, rule: DailyRule): DailyStats {
  const byDay = new Map(figures.map(f => [f.day, f]));
  const days = recordDays(range, ctx);
  const out: DailyStats = { sum: 0, days: 0, recordDays: days.length, status: {}, partialDays: 0 };
  for (const day of days) {
    const status = ctx.statusOn(day);
    if (status !== 'normal') out.status[status] = (out.status[status] ?? 0) + 1;
    const figure = byDay.get(day);
    if (figure) out.sum += figure.value;
    const isData = rule === 'counted' ? status === 'normal' : figure !== undefined;
    if (!isData) continue;
    out.days += 1;
    const value = figure?.value ?? 0;
    if (figure?.basis === 'walks' || figure?.basis === 'atLeast') out.partialDays += 1;
    if (!out.high || value > out.high.value) out.high = { day, value };
  }
  if (out.days > 0) out.perDay = out.sum / out.days;
  return out;
}

/** What a daily trend's headline states. */
export type Statistic = 'total' | 'perDay' | 'perWeek' | 'perMonth';

/** Days in an average month, so "a month on average" means the same in February and in March. */
export const DAYS_PER_MONTH = 365.25 / 12;

/** Counted: a total for Week and Month, then a week or a month on average. Stated: always a day on average (D68, D69). */
export function statisticFor(rule: DailyRule, period: TrendPeriod): Statistic {
  if (rule === 'stated') return 'perDay';
  return period === 'sixMonths' ? 'perWeek' : period === 'year' ? 'perMonth' : 'total';
}

/** The statistic's value: a total over the record's days; an average over the days of data. Nothing without them. */
export function figureOf(s: DailyStats, statistic: Statistic): number | undefined {
  if (statistic === 'total') return s.recordDays > 0 ? s.sum : undefined;
  if (s.perDay === undefined) return undefined;
  return statistic === 'perDay' ? s.perDay : statistic === 'perWeek' ? s.perDay * 7 : s.perDay * DAYS_PER_MONTH;
}

/** A comparison needs this many days of data in both windows (journey §12.2). */
export const MIN_DAYS = 3;

export type Direction = 'higher' | 'lower' | 'same';

export type Comparison =
  | { shown: true; direction: Direction; difference: number }
  | { shown: false; reason: 'fewDays' | 'meterLo' };

/** The change as shown: both figures rounded as the screen shows them, so "the same" is the same on screen. */
export function change(current: number, previous: number, decimals: number): Comparison {
  const difference = roundTo(roundTo(current, decimals) - roundTo(previous, decimals), decimals);
  return { shown: true, direction: difference > 0 ? 'higher' : difference < 0 ? 'lower' : 'same', difference: Math.abs(difference) };
}

export function compareDaily(current: DailyStats, previous: DailyStats, statistic: Statistic, decimals: number): Comparison {
  const a = figureOf(current, statistic);
  const b = figureOf(previous, statistic);
  if (current.days < MIN_DAYS || previous.days < MIN_DAYS || a === undefined || b === undefined) return { shown: false, reason: 'fewDays' };
  return change(a, b, decimals);
}

/** One numeric reading, in the display unit. */
export interface ReadingPoint {
  id: string;
  day: string;
  at: string;
  value: number;
  /** The series it belongs to: a glucose context, a blood-pressure number, back or leg. */
  series: string;
  /** Past the low or the high line (glucose: under 70 or over 250 mg/dL). */
  low?: true;
  high?: true;
}

/** A meter's HI or LO: no number, so never averaged (K-11). */
export interface MeterReading {
  day: string;
  at?: string;
  display: 'HI' | 'LO';
}

export interface ReadingStats {
  /** Numeric readings. */
  n: number;
  mean?: number;
  min?: number;
  max?: number;
  /** Days with a numeric reading: what a comparison's 3 days count. */
  days: number;
  hi: number;
  lo: number;
  /** Numeric readings past the lines, with the meter's LO and HI, which are past them by definition. */
  lows: number;
  highs: number;
  /** Status days among the days with readings: named, never left out (A-43). */
  status: Partial<Record<StatusMark, number>>;
}

export function readingStats(range: DayRange, points: readonly ReadingPoint[], meters: readonly MeterReading[], ctx: DayContext): ReadingStats {
  const inside = (day: string) => day >= range.from && day <= range.to;
  let n = 0;
  let total = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let lows = 0;
  let highs = 0;
  const numericDays = new Set<string>();
  const seen = new Set<string>();
  // Loops, not Math.min(...values): a year of sensor readings would overflow the call stack.
  for (const p of points) {
    if (!inside(p.day)) continue;
    n += 1;
    total += p.value;
    if (p.value < min) min = p.value;
    if (p.value > max) max = p.value;
    if (p.low) lows += 1;
    if (p.high) highs += 1;
    numericDays.add(p.day);
    seen.add(p.day);
  }
  let hi = 0;
  let lo = 0;
  for (const m of meters) {
    if (!inside(m.day)) continue;
    if (m.display === 'HI') hi += 1;
    else lo += 1;
    seen.add(m.day);
  }
  const status: Partial<Record<StatusMark, number>> = {};
  for (const day of seen) {
    const s = ctx.statusOn(day);
    if (s !== 'normal') status[s] = (status[s] ?? 0) + 1;
  }
  return { n, ...(n > 0 ? { mean: total / n, min, max } : {}), days: numericDays.size, hi, lo, lows: lows + lo, highs: highs + hi, status };
}

/**
 * Means compared, with 3 days with a number in both windows. A LO in either
 * period hides it, because the average would leave the lowest reading out
 * (K-11, B-15): `otherLo` counts LOs in the periods outside the compared days.
 */
export function compareReadings(current: ReadingStats, previous: ReadingStats, decimals: number, otherLo = 0): Comparison {
  if (current.lo + previous.lo + otherLo > 0) return { shown: false, reason: 'meterLo' };
  if (current.days < MIN_DAYS || previous.days < MIN_DAYS || current.mean === undefined || previous.mean === undefined) {
    return { shown: false, reason: 'fewDays' };
  }
  return change(current.mean, previous.mean, decimals);
}

/** One lab result, in the display unit. */
export interface LabPoint {
  id: string;
  day: string;
  value: number;
  unit: string;
}

export interface LabRow extends LabPoint {
  interval: string;
}

/** "First result", "12 days after the one before", "4 months after the one before". */
export function intervalText(days: number | undefined): string {
  if (days === undefined) return 'First result';
  if (days === 0) return 'The same day as the one before';
  if (days < 60) return `${days} ${days === 1 ? 'day' : 'days'} after the one before`;
  return `${Math.round(days / DAYS_PER_MONTH)} months after the one before`;
}

/** Every result, oldest first, with how long after the one before it came (A-45). No 7-day rule applies. */
export function labHistory(points: readonly LabPoint[]): LabRow[] {
  const sorted = [...points].sort((a, b) => a.day.localeCompare(b.day) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return sorted.map((p, i) => ({ ...p, interval: intervalText(i === 0 ? undefined : daysBetween(sorted[i - 1].day, p.day)) }));
}

const STATUS_WORDS: Record<StatusMark, [string, string]> = {
  flare: ['Flare-up day', 'Flare-up days'],
  unwell: ['Unwell day', 'Unwell days'],
  away: ['Away day', 'Away days'],
};

/** "2 Unwell days and 1 Away day", in a fixed order; nothing for none. */
export function statusList(status: Partial<Record<StatusMark, number>>): string | undefined {
  const parts = (['flare', 'unwell', 'away'] as const)
    .filter(k => (status[k] ?? 0) > 0)
    .map(k => `${status[k]} ${STATUS_WORDS[k][status[k] === 1 ? 0 : 1]}`);
  if (parts.length === 0) return undefined;
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}
