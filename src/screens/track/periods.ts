/**
 * Local calendar days and the spans Track shows.
 *
 * Days are `YYYY-MM-DD` strings in the person's local calendar, the same key
 * every observation carries in `day`. The arithmetic runs on UTC dates built
 * from those three numbers, so a daylight-saving change can never turn
 * "minus one day" into "minus 23 hours" and land on the same date.
 */

import { isDay } from '@/health/observation';
import type { DayRange } from '@/health/aggregate';
import { toDateString } from '@/lib/utils';

export type Period = 'week' | 'month' | 'quarter' | 'year';

export const PERIODS: readonly { id: Period; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'quarter', label: '3 months' },
  { id: 'year', label: 'Year' },
];

export function isPeriod(value: unknown): value is Period {
  return PERIODS.some(p => p.id === value);
}

function parts(day: string): [number, number, number] {
  if (!isDay(day)) throw new Error(`Not a YYYY-MM-DD day: ${String(day)}`);
  return [Number(day.slice(0, 4)), Number(day.slice(5, 7)), Number(day.slice(8, 10))];
}

function fromUtc(date: Date): string {
  const y = String(date.getUTCFullYear()).padStart(4, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = parts(day);
  return fromUtc(new Date(Date.UTC(y, m - 1, d + n)));
}

/**
 * The same day `n` months earlier, clamped to the end of a shorter month:
 * 31 March minus one month is 28 (or 29) February, not 3 March.
 */
export function subtractMonths(day: string, n: number): string {
  const [y, m, d] = parts(day);
  const lastOfTarget = new Date(Date.UTC(y, m - 1 - n + 1, 0)).getUTCDate();
  return fromUtc(new Date(Date.UTC(y, m - 1 - n, Math.min(d, lastOfTarget))));
}

/** Monday on or before `day`. Weeks run Monday to Sunday, as the planner's `mondayOf` does. */
export function mondayOf(day: string): string {
  const [y, m, d] = parts(day);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}

/** The Monday-to-Sunday week that contains `day`. */
export function weekOf(day: string): DayRange {
  const from = mondayOf(day);
  return { from, to: addDays(from, 6) };
}

/**
 * A period ending on `end`, inclusive: the last 7 days, or the span since the
 * same date one, three or twelve months earlier. Rolling rather than calendar
 * spans, so "Month" on the 2nd still shows a month of readings.
 */
export function periodRange(period: Period, end: string): DayRange {
  switch (period) {
    case 'week':
      return { from: addDays(end, -6), to: end };
    case 'month':
      return { from: addDays(subtractMonths(end, 1), 1), to: end };
    case 'quarter':
      return { from: addDays(subtractMonths(end, 3), 1), to: end };
    case 'year':
      return { from: addDays(subtractMonths(end, 12), 1), to: end };
  }
}

/** Every day in a range, oldest first. */
export function daysIn(range: DayRange): string[] {
  if (range.from > range.to) return [];
  const days: string[] = [];
  for (let day = range.from; day <= range.to; day = addDays(day, 1)) days.push(day);
  return days;
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = parts(from);
  const [y2, m2, d2] = parts(to);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** Today on this device. */
export function today(now: Date = new Date()): string {
  return toDateString(now);
}

/**
 * The day a screen should show for a `?day=` value: a real day that is not in
 * the future, or today. A bookmarked tomorrow never shows an empty future.
 */
export function clampDay(value: string | null | undefined, current: string = today()): string {
  if (!value || !isDay(value) || value > current) return current;
  return value;
}
