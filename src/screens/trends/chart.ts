/**
 * The chart's model (journey §12.2, §20.2; B-15): what `TrendChart` draws,
 * decided by a trend's model and never by the chart, which computes no
 * statistic. A slot is one place along the axis (a day, a week or a month);
 * a series is bars, points or ranges over the slots. Food's kcal and carbs
 * (Plan 7) are one more bars series of this same model: nothing here knows
 * the metric.
 */
import { niceDomain, niceTicks, type LinearDomain } from '@/components/hig/scale';
import type { DayRange } from '@/health/aggregate';
import type { Shape } from './metrics';
import type { StatusMark } from './stats';

/** A day shaded in a movement chart: never drawn as a zero (D25, K-49). */
export type SlotMark = 'rest' | StatusMark;

export const MARK_WORDS: Record<SlotMark, string> = { rest: 'Rest day', flare: 'Flare-up', unwell: 'Unwell', away: 'Away' };

export interface Slot {
  /** The bucket's first day: stable from one render to the next. */
  key: string;
  /** Under the axis: "Mon", "8", "4 May", "Nov". The chart thins them to fit. */
  label: string;
  /** Said and listed: "Tuesday, 6 October", "4–10 May", "November 2025". */
  name: string;
  range: DayRange;
  /** Hatched and labelled, in movement charts only. */
  mark?: SlotMark;
  /** After today: nothing yet, and it can't be chosen. */
  future?: true;
  /** The slot in words, for the callout and the slider: "Tuesday, 6 October: 7,000 steps, entered at 8:00 pm. Last week: 6,000 steps." */
  text: string;
  /** A day slot opens that day in Today's log. */
  day?: string;
}

export interface BarSeries {
  kind: 'bars';
  id: string;
  label: string;
  /** A CSS colour: `var(--cat-steps)`, or `var(--trend-previous)`. */
  colour: string;
  /** One per slot; `null` draws nothing: not entered, shaded, or before the record. */
  values: (number | null)[];
  /** The period before: behind the current bars, full width, grey and striped (B-15). */
  previous?: true;
}

export interface PointSeries {
  kind: 'points';
  id: string;
  label: string;
  colour: string;
  shape: Shape;
  /** Each reading: its slot, how far through the slot its time falls (0–1), and a line it is past. */
  points: { slot: number; at: number; value: number; flag?: 'low' | 'high' }[];
}

export interface RangeSeries {
  kind: 'ranges';
  id: string;
  label: string;
  colour: string;
  /** The mean's mark, the series' own shape, as its readings are drawn by the day (H3-08). */
  shape: Shape;
  /** One per slot: the lowest, the highest and the mean of its numeric readings. */
  values: ({ min: number; max: number; mean: number } | null)[];
}

export type ChartSeries = BarSeries | PointSeries | RangeSeries;

export interface ChartModel {
  slots: Slot[];
  series: ChartSeries[];
  /** The labelled average line (journey §12.2). */
  average?: { value: number; label: string };
  /** Reference lines, labelled, drawn when they fall inside the axis: "70 mg/dL". */
  lines: { value: number; label: string }[];
  unit: string;
  decimals: number;
}

/** Every figure the chart draws. A loop, not a spread: a year of readings would overflow the call stack. */
function figures(model: ChartModel): number[] {
  const out: number[] = [];
  for (const s of model.series) {
    if (s.kind === 'bars') {
      for (const v of s.values) if (v !== null) out.push(v);
    } else if (s.kind === 'points') {
      for (const p of s.points) out.push(p.value);
    } else {
      for (const r of s.values) if (r) out.push(r.min, r.max);
    }
  }
  return out;
}

/** The value axis: bars from zero, readings around their spread, the average always on it. */
export function domainOf(model: ChartModel): { domain: LinearDomain; ticks: number[] } {
  const bars = model.series.some(s => s.kind === 'bars');
  const domain = niceDomain(figures(model), { include: model.average ? [model.average.value] : [], zeroBased: bars });
  return { domain, ticks: niceTicks(domain) };
}

/** How many slots can be chosen: those up to today, which always come first. */
export function selectable(model: Pick<ChartModel, 'slots'>): number {
  let n = 0;
  for (const s of model.slots) if (!s.future) n += 1;
  return n;
}

/** The slot under `x`, anywhere across the plot, held to the first and the last (B-15). */
export function slotAt(x: number, plot: { left: number; width: number }, count: number): number | undefined {
  if (count <= 0 || !(plot.width > 0) || !Number.isFinite(x)) return undefined;
  const i = Math.floor(((x - plot.left) / plot.width) * count);
  return Math.min(count - 1, Math.max(0, i));
}

/**
 * The chart's value as a slider after a key: 0 is nothing chosen, n the nth
 * slot. Undefined for a key the chart leaves to the page.
 */
export function stepValue(key: string, value: number, max: number): number | undefined {
  switch (key) {
    case 'ArrowRight':
    case 'ArrowUp': return Math.min(max, value + 1);
    case 'ArrowLeft':
    case 'ArrowDown': return Math.max(0, value - 1);
    case 'Home': return Math.min(1, max);
    case 'End': return max;
    case 'Escape': return 0;
    default: return undefined;
  }
}

export interface LegendItem {
  id: string;
  label: string;
  swatch: 'bar' | 'previous' | 'range' | 'mark' | Shape;
  colour: string;
  /** A range's mean mark. */
  shape?: Shape;
}

const MARK_ORDER: readonly SlotMark[] = ['rest', 'flare', 'unwell', 'away'];

/** Each series, then each kind of shaded day present, in words beside its swatch (journey §20.3). */
export function legendOf(model: ChartModel): LegendItem[] {
  const items = model.series.map((s): LegendItem => ({
    id: s.id,
    label: s.label,
    colour: s.colour,
    swatch: s.kind === 'bars' ? (s.previous ? 'previous' : 'bar') : s.kind === 'points' ? s.shape : 'range',
    ...(s.kind === 'ranges' ? { shape: s.shape } : {}),
  }));
  const marks = new Set(model.slots.map(s => s.mark));
  for (const m of MARK_ORDER) if (marks.has(m)) items.push({ id: `mark:${m}`, label: MARK_WORDS[m], swatch: 'mark', colour: 'var(--muted-foreground)' });
  return items;
}
