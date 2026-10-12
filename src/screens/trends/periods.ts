/**
 * The windows a trend shows (journey §12.2): Week is Monday to Sunday in
 * days, Month the calendar month in days, 6 Months the last 6 calendar months
 * in Monday–Sunday weeks, and Year the last 12 calendar months in months.
 * Days are local `YYYY-MM-DD` strings, as every record's `day` is, so no
 * clock or time zone enters the arithmetic.
 */
import { format } from 'date-fns';
import type { DayRange } from '@/health/aggregate';
import { addDays, daysBetween, daysIn, mondayOf } from '@/screens/track/periods';

export type TrendPeriod = 'week' | 'month' | 'sixMonths' | 'year';

export const TREND_PERIODS: readonly { id: TrendPeriod; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'sixMonths', label: '6 Months' },
  { id: 'year', label: 'Year' },
];

export function isTrendPeriod(value: unknown): value is TrendPeriod {
  return TREND_PERIODS.some(p => p.id === value);
}

export interface TrendWindow {
  period: TrendPeriod;
  /** The first and last day, inclusive. */
  from: string;
  to: string;
  /** One per bar: a day, a Monday–Sunday week or a calendar month, cut to the window. */
  buckets: DayRange[];
}

const pad = (n: number) => String(n).padStart(2, '0');
const noon = (day: string) => new Date(`${day}T12:00:00`);
const sameYear = (a: string, b: string) => a.slice(0, 4) === b.slice(0, 4);

/** The first day of the month `offset` months after the one `day` is in. */
export function monthStart(day: string, offset = 0): string {
  const d = new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1 + offset, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-01`;
}

/** The last day of that month. */
export function monthEnd(day: string, offset = 0): string {
  return addDays(monthStart(day, offset + 1), -1);
}

const dayBuckets = (from: string, to: string): DayRange[] => daysIn({ from, to }).map(d => ({ from: d, to: d }));

function weekBuckets(from: string, to: string): DayRange[] {
  const out: DayRange[] = [];
  for (let monday = mondayOf(from); monday <= to; monday = addDays(monday, 7)) {
    const sunday = addDays(monday, 6);
    out.push({ from: monday < from ? from : monday, to: sunday > to ? to : sunday });
  }
  return out;
}

function monthBuckets(from: string, to: string): DayRange[] {
  const out: DayRange[] = [];
  for (let start = from; start <= to; start = monthStart(start, 1)) {
    const end = monthEnd(start);
    out.push({ from: start, to: end > to ? to : end });
  }
  return out;
}

/** The window of `period` that holds `anchor`. */
export function windowOf(period: TrendPeriod, anchor: string): TrendWindow {
  switch (period) {
    case 'week': {
      const from = mondayOf(anchor);
      const to = addDays(from, 6);
      return { period, from, to, buckets: dayBuckets(from, to) };
    }
    case 'month': {
      const from = monthStart(anchor);
      const to = monthEnd(anchor);
      return { period, from, to, buckets: dayBuckets(from, to) };
    }
    case 'sixMonths': {
      const from = monthStart(anchor, -5);
      const to = monthEnd(anchor);
      return { period, from, to, buckets: weekBuckets(from, to) };
    }
    case 'year': {
      const from = monthStart(anchor, -11);
      const to = monthEnd(anchor);
      return { period, from, to, buckets: monthBuckets(from, to) };
    }
  }
}

/** The window just before: last week, last month, the 6 or 12 months before. */
export function previousWindow(w: TrendWindow): TrendWindow {
  return windowOf(w.period, addDays(w.from, -1));
}

/** How far 6 Months and Year move, in months: a whole window each way (H3-10). */
const SPAN: Partial<Record<TrendPeriod, number>> = { sixMonths: 6, year: 12 };

/** The window just after: the next week or month, the next 6 or 12 months. */
export function nextWindow(w: TrendWindow): TrendWindow {
  const months = SPAN[w.period];
  return windowOf(w.period, months === undefined ? addDays(w.to, 1) : monthStart(w.to, months));
}

/** The window holds today. */
export function isCurrent(w: TrendWindow, today: string): boolean {
  return w.from <= today && today <= w.to;
}

/**
 * A window as the address keeps it (`at`, H3-10): its last day, which reads
 * back as the same window for every period, 6 Months and Year ending in the
 * anchor's month. Today's window keeps none, so it stays today's.
 */
export function anchorOf(w: TrendWindow, today: string): string | null {
  return isCurrent(w, today) ? null : w.to;
}

export interface CompareRanges {
  current: DayRange;
  previous: DayRange;
  /** An unfinished window, set against the same number of days of the one before. */
  partial: boolean;
}

/**
 * What a comparison sets side by side (A-42): a finished window against the
 * whole one before it; the current one, unfinished, against the same number
 * of days from the start of the one before ("Mon–Thu vs last Mon–Thu"), cut
 * to that window's end (30 March against all of February). Nothing for a
 * window that hasn't started.
 */
export function compareRanges(w: TrendWindow, today: string): CompareRanges | undefined {
  if (w.from > today) return undefined;
  const prev = previousWindow(w);
  if (w.to <= today) return { current: { from: w.from, to: w.to }, previous: { from: prev.from, to: prev.to }, partial: false };
  const to = addDays(prev.from, daysBetween(w.from, today));
  return { current: { from: w.from, to: today }, previous: { from: prev.from, to: to > prev.to ? prev.to : to }, partial: true };
}

/** "5–11 Oct", "28 Sep – 4 Oct", "28 Dec 2025 – 3 Jan 2026": the year only when it isn't today's. */
export function rangeText({ from, to }: DayRange, today: string): string {
  const year = !sameYear(from, to) || !sameYear(to, today);
  const end = format(noon(to), year ? 'd MMM yyyy' : 'd MMM');
  if (from === to) return end;
  if (from.slice(0, 7) === to.slice(0, 7)) return `${Number(from.slice(8, 10))}–${end}`;
  if (sameYear(from, to)) return `${format(noon(from), 'd MMM')} – ${end}`;
  return `${format(noon(from), 'd MMM yyyy')} – ${end}`;
}

/** The pager's title: "This week", "Last week", "21–27 Sep"; "This month", "September"; "May – Oct 2026". */
export function windowTitle(w: TrendWindow, today: string): string {
  const current = isCurrent(w, today);
  if (w.period === 'week') {
    if (current) return 'This week';
    return isCurrent(nextWindow(w), today) ? 'Last week' : rangeText(w, today);
  }
  if (w.period === 'month') return current ? 'This month' : format(noon(w.from), sameYear(w.from, today) ? 'MMMM' : 'MMMM yyyy');
  const end = format(noon(w.to), 'MMM yyyy');
  return sameYear(w.from, w.to) ? `${format(noon(w.from), 'MMM')} – ${end}` : `${format(noon(w.from), 'MMM yyyy')} – ${end}`;
}

const PAGE: Record<TrendPeriod, string> = { week: 'week', month: 'month', sixMonths: '6 months', year: 'year' };

/** The pager's buttons say where they go, not only an arrow (B-08). */
export function pagerLabels(period: TrendPeriod): { previous: string; next: string } {
  return { previous: `Previous ${PAGE[period]}`, next: `Next ${PAGE[period]}` };
}

/** What a change is measured against: "last week", "the week before", "the 6 months before". */
export function previousName(w: TrendWindow, today: string): string {
  const current = isCurrent(w, today);
  switch (w.period) {
    case 'week': return current ? 'last week' : 'the week before';
    case 'month': return current ? 'last month' : 'the month before';
    case 'sixMonths': return 'the 6 months before';
    case 'year': return 'the 12 months before';
  }
}

/** The days compared, said: "Mon–Thu vs last Mon–Thu", "1–8 Oct vs 1–8 Sep", "28 Sep – 4 Oct vs 21–27 Sep". */
export function comparedText(w: TrendWindow, r: CompareRanges, today: string): string {
  if (w.period === 'week' && r.partial) {
    if (r.current.from === r.current.to) return `${format(noon(r.current.from), 'EEEE')} vs last ${format(noon(r.previous.from), 'EEEE')}`;
    const day = (d: string) => format(noon(d), 'EEE');
    return `${day(r.current.from)}–${day(r.current.to)} vs last ${day(r.previous.from)}–${day(r.previous.to)}`;
  }
  return `${rangeText(r.current, today)} vs ${rangeText(r.previous, today)}`;
}
