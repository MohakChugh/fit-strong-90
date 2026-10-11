/**
 * What a trend shows (journey §12.2, B-15), worked out from the records and
 * the window: the headline with its statistic and coverage, the change with
 * the days it compares, the spread, the notes, the chart's model, its list
 * and its words for VoiceOver. Pure: the screen only draws it.
 */
import { format } from 'date-fns';
import type { DayRange } from '@/health/aggregate';
import { isDay } from '@/health/observation';
import { isEnrolled } from '@/health/recommend';
import { restDaysOf } from '@/screens/home/week';
import { HIGH_GLUCOSE_MGDL, HYPO_LEVEL_1_MGDL } from '@/screens/track/escalation';
import { formatDayLong, formatValue, type DisplayPrefs } from '@/screens/track/format';
import { LAB_OPTIONS, type LabKind } from '@/screens/track/logKinds';
import { daysBetween } from '@/screens/track/periods';
import { displayBoundaries } from '@/screens/track/targets';
import { MGDL_PER_MMOL, decimalsFor, formatNumber, safeDecimals } from '@/screens/track/units';
import type { UserSettings } from '@/types';
import type { UserProfile } from '@/types/profile';
import { MARK_WORDS, type ChartModel, type ChartSeries, type PointSeries, type RangeSeries, type Slot, type SlotMark } from './chart';
import { GLUCOSE_LINES, TRENDS, figuresFor, labPoints, readingsFor, type TrendDef, type TrendId } from './metrics';
import {
  compareRanges, comparedText, monthEnd, monthStart, previousName, previousWindow, rangeText, windowOf, windowTitle,
  type TrendPeriod, type TrendWindow,
} from './periods';
import { firstRecordDay, stretchedDays, type TrendData } from './records';
import {
  compareDaily, compareReadings, dailyStats, dayContext, figureOf, labHistory, readingStats, statisticFor, statusList,
  type Comparison, type DailyRule, type DayContext, type DayFigure, type Direction, type LabRow, type Statistic,
} from './stats';

export interface StatItem {
  label: string;
  value: string;
}

/** The headline figure, and what it is (B-15). */
export interface Headline {
  /** "A day on average", "Total", "A week on average", "Average", "Latest". */
  statistic: string;
  /** What it covers: "3 days with steps", "7 days", "from 11 days", "5 readings, all with a number". */
  coverage: string;
  /** "6,167"; or words: "Not entered", "Nothing recorded", "No numeric readings". */
  value: string;
  /** Absent when `value` is words, or carries its own unit ("7.1%"). */
  unit?: string;
}

/** The change against the period before, said neutrally (A-41), or why there is none. */
export interface Change {
  text: string;
  /** For the arrow, drawn in body ink. */
  direction?: Direction;
  /** The days compared: "Mon–Thu vs last Mon–Thu" (A-42). */
  compared?: string;
}

export interface TrendView {
  /** The window's title: "This week", "September". */
  title: string;
  headline: Headline;
  change: Change;
  stats: StatItem[];
  notes: string[];
  /** Readings: a meter's HI and LO, said above the average in caution ink (K-11). */
  meter?: string;
  chart: ChartModel;
  table: { columns: string[]; rows: string[][] };
  /** The whole view in a few sentences, for VoiceOver (A-63). */
  summary: string;
}

export interface TrendInput {
  def: TrendDef;
  window: TrendWindow;
  data: TrendData;
  prefs: DisplayPrefs;
  ctx: DayContext;
}

const noon = (day: string) => new Date(`${day}T12:00:00`);
const cap = (s: string) => `${s.charAt(0).toUpperCase()}${s.slice(1)}`;

/** "Tue 6 Oct", and "Tue 30 Dec 2025" outside today's year, so an older clinical value is never undated (H3-05). */
export const shortDay = (day: string, today: string): string => format(noon(day), day.slice(0, 4) === today.slice(0, 4) ? 'EEE d MMM' : 'EEE d MMM yyyy');

/** "3 days with steps", "1 reading": a count and its noun. */
export function countText(n: number, [one, many]: readonly [string, string]): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

const BOTH: Record<TrendPeriod, string> = { week: 'weeks', month: 'months', sixMonths: 'periods', year: 'periods' };

/** "Comparisons start once there are 3 days with data in both weeks." (J§12.2, early days) */
export function fewDaysText(period: TrendPeriod): string {
  return `Comparisons start once there are 3 days with data in both ${BOTH[period]}.`;
}

export const METER_LO_TEXT = 'No change shown: a meter LO has no number, so an average would leave out the lowest reading.';

/** "Comparisons start once one kind of reading, such as fasting, has 3 days in both weeks." (KT-07) */
export function fewKindsText(period: TrendPeriod): string {
  return `Comparisons start once one kind of reading, such as fasting, has 3 days in both ${BOTH[period]}.`;
}

/** "Higher than last week · +417 steps a day": the direction in words, and the difference with its unit and statistic (A-41). */
function changeOf(c: Comparison, against: string, unit: string, decimals: number, period: TrendPeriod, compared?: string): Change {
  if (!c.shown) return { text: c.reason === 'meterLo' ? METER_LO_TEXT : c.reason === 'fewKinds' ? fewKindsText(period) : fewDaysText(period) };
  const by = formatNumber(c.difference, decimals);
  const text = c.direction === 'same' ? `The same as ${against}`
    : c.direction === 'higher' ? `Higher than ${against} · +${by} ${unit}` : `Lower than ${against} · −${by} ${unit}`;
  return { text, direction: c.direction, ...(compared ? { compared } : {}) };
}

/** The view in sentences for VoiceOver: the screen's own words, the dots read as commas. */
function summaryOf(title: string, windowName: string, h: Headline, change: Change, extra: readonly string[]): string {
  const spoken = (t: string) => t.replaceAll(' · ', ', ').replace(/\.$/, '');
  return `${[
    `${title}, ${windowName}`,
    `${h.statistic}, ${h.coverage}: ${h.value}${h.unit ? ` ${h.unit}` : ''}`,
    `${spoken(change.text)}${change.compared ? `, ${change.compared}` : ''}`,
    ...extra.map(spoken),
  ].join('. ')}.`;
}

function statName(statistic: Statistic, def: TrendDef): string {
  switch (statistic) {
    case 'total': return 'Total';
    case 'perDay': return `A ${def.per} on average`;
    case 'perWeek': return 'A week on average';
    case 'perMonth': return 'A month on average';
  }
}

/** What a figure is per: " a day", " a week"; nothing for a total. */
function perWords(statistic: Statistic, def: TrendDef): string {
  switch (statistic) {
    case 'total': return '';
    case 'perDay': return ` a ${def.per}`;
    case 'perWeek': return ' a week';
    case 'perMonth': return ' a month';
  }
}

/** What one slot holds: its figure, its shading, its words in full, and in brief for the period before. */
interface Cell {
  value: number | null;
  mark?: SlotMark;
  text: string;
  brief: string;
}

const words = (text: string): Cell => ({ value: null, text, brief: text });

/** A day's figure, shading and words (Week and Month). */
function dayCell(day: string, f: DayFigure | undefined, { def, prefs, ctx }: TrendInput, rule: DailyRule): Cell {
  if (day > ctx.today) return words('Still to come');
  const unit = def.unit(prefs);
  const d = def.decimals(prefs);
  const status = ctx.statusOn(day);
  // Shading is for movement charts only (J§12.2); a rest day is shaded only when nothing was done on it.
  const mark: SlotMark | undefined = !def.movement ? undefined : status !== 'normal' ? status : !f && ctx.restOn(day) ? 'rest' : undefined;
  if (f) {
    const brief = `${f.basis === 'atLeast' ? 'at least ' : ''}${formatNumber(f.value, d)} ${unit}`;
    return { value: f.value, ...(mark ? { mark } : {}), text: `${brief}${f.note ? `, ${f.note}` : ''}${mark ? ` (${MARK_WORDS[mark]})` : ''}`, brief };
  }
  if (mark) return { ...words(MARK_WORDS[mark]), mark };
  if (rule === 'stated') return words('Not entered');
  // Counted: a day of the record with nothing in it is a real 0 (D68); before the record there is no day at all.
  if (ctx.since === undefined || day < ctx.since) return words('Before your first record');
  return { value: 0, text: `0 ${unit}`, brief: `0 ${unit}` };
}

/** A week's or a month's figure and words (6 Months and Year): the counted total, or the stated average a day (D68). */
function bucketCell(range: DayRange, figures: readonly DayFigure[], { def, prefs, ctx }: TrendInput, rule: DailyRule): Cell {
  if (range.from > ctx.today) return words('Still to come');
  const unit = def.unit(prefs);
  const d = def.decimals(prefs);
  const s = dailyStats(range, figures, ctx, rule);
  if (rule === 'counted') {
    const total = figureOf(s, 'total');
    if (total === undefined) return words('Before your first record');
    const text = `${formatNumber(total, d)} ${unit}`;
    return { value: total, text, brief: text };
  }
  if (s.perDay === undefined) return words('Not entered');
  const brief = `${formatNumber(s.perDay, d)} ${unit} a ${def.per}`;
  return { value: s.perDay, text: `${brief} on average, from ${countText(s.days, def.coverage)}`, brief };
}

function slotLabel(period: TrendPeriod, b: DayRange): string {
  switch (period) {
    case 'week': return format(noon(b.from), 'EEE');
    case 'month': return String(Number(b.from.slice(8, 10)));
    case 'sixMonths': return format(noon(b.from), 'd MMM');
    case 'year': return format(noon(b.from), 'MMM');
  }
}

function slotName(period: TrendPeriod, b: DayRange, today: string): string {
  if (period === 'week' || period === 'month') return formatDayLong(b.from, today);
  return period === 'sixMonths' ? rangeText(b, today) : format(noon(b.from), 'MMMM yyyy');
}

/** A counted or stated trend over its window (B-15; D68, D69, D70). */
export function dailyView(input: TrendInput): TrendView {
  const { def, window: w, data, prefs, ctx } = input;
  const rule: DailyRule = def.family === 'counted' ? 'counted' : 'stated';
  const prev = previousWindow(w);
  const figures = figuresFor(def.id, { from: prev.from, to: w.to }, data, prefs);
  const byDay = new Map(figures.map(f => [f.day, f]));
  const unit = def.unit(prefs);
  const d = def.decimals(prefs);
  const statistic = statisticFor(rule, w.period);
  const s = dailyStats(w, figures, ctx, rule);
  const value = figureOf(s, statistic);
  const title = windowTitle(w, ctx.today);
  const against = previousName(w, ctx.today);

  const headline: Headline = {
    statistic: statName(statistic, def),
    coverage: statistic === 'total' ? countText(s.recordDays, ['day', 'days'])
      : statistic === 'perDay' ? countText(s.days, def.coverage)
        : `from ${countText(s.days, ['day', 'days'])}`,
    ...(value === undefined ? { value: rule === 'stated' ? 'Not entered' : 'Nothing recorded' } : { value: formatNumber(value, d), unit }),
  };

  const ranges = compareRanges(w, ctx.today);
  const comparison: Comparison = ranges
    ? compareDaily(dailyStats(ranges.current, figures, ctx, rule), dailyStats(ranges.previous, figures, ctx, rule), statistic, d)
    : { shown: false, reason: 'fewDays' };
  const change = changeOf(comparison, against, `${unit}${perWords(statistic, def)}`, d, w.period, ranges && comparedText(w, ranges, ctx.today));

  const inWindow = (day: string) => day >= w.from && day <= w.to && day <= ctx.today;
  const stats: StatItem[] = [];
  if (rule === 'stated') {
    if (s.days > 0) stats.push({ label: cap(def.coverage[1]), value: formatNumber(s.days) });
  } else {
    stats.push({ label: 'Days with time recorded', value: formatNumber(figures.filter(f => inWindow(f.day) && f.value > 0).length) });
    if (def.id === 'stretch') stats.push({ label: 'Days stretched', value: formatNumber([...stretchedDays(data.sessions)].filter(inWindow).length) });
    if (statistic !== 'total' && s.recordDays > 0) stats.push({ label: 'Total', value: `${formatNumber(s.sum, d)} ${unit}` });
  }
  if (s.high && s.high.value > 0) {
    stats.push({ label: rule === 'stated' ? 'Highest' : 'Highest day', value: `${formatNumber(s.high.value, d)} ${unit} · ${shortDay(s.high.day, ctx.today)}` });
  }

  const notes: string[] = [];
  const list = statusList(s.status);
  // Counted: status days and empty rest days are in the total, out of the average (D88); stated: each figure counts, its day named.
  if (list) notes.push(rule === 'counted' ? `Includes ${s.outside > 0 ? `${formatNumber(s.outside, d)} ${unit} on ` : ''}${list}, not in the average.` : `Includes ${list}.`);
  if (s.restDays > 0) notes.push(`Includes ${countText(s.restDays, ['rest day', 'rest days'])} with nothing recorded, not in the average.`);
  if (s.partialDays > 0) {
    notes.push(`${countText(s.partialDays, ['day shows', 'days show'])} at least the steps counted: FitStrong walks only, or walks after a total was entered.`);
  }

  const dayly = w.period === 'week' || w.period === 'month';
  const cellsOf = (win: TrendWindow) => win.buckets.map(b => (dayly ? dayCell(b.from, byDay.get(b.from), input, rule) : bucketCell(b, figures, input, rule)));
  const current = cellsOf(w);
  // A shorter month or 6 months before has fewer slots: those have nothing behind them.
  const before: (Cell | undefined)[] = cellsOf(prev);
  const beforeLabel = cap(against);
  const slots: Slot[] = w.buckets.map((b, i) => {
    const c = current[i];
    const was = before[i];
    const name = slotName(w.period, b, ctx.today);
    const future = b.from > ctx.today;
    return {
      key: b.from,
      label: slotLabel(w.period, b),
      name,
      range: b,
      ...(c.mark ? { mark: c.mark } : {}),
      ...(future ? { future: true as const } : {}),
      ...(dayly && !future ? { day: b.from } : {}),
      text: `${name}: ${c.text}.${was ? ` ${beforeLabel}: ${was.brief}.` : ''}`,
    };
  });
  const series: ChartSeries[] = [
    { kind: 'bars', id: 'previous', label: beforeLabel, colour: 'var(--trend-previous)', values: w.buckets.map((_, i) => before[i]?.value ?? null), previous: true },
    { kind: 'bars', id: 'current', label: title, colour: `var(${def.colour})`, values: current.map(c => c.value) },
  ];
  // Week and Month: the average day. 6 Months and Year: what the bars are, a week's or a month's time, or a stated day.
  const lineStat: Statistic = rule === 'stated' || dayly ? 'perDay' : statistic;
  const average = figureOf(s, lineStat);
  const chart: ChartModel = {
    slots, series, lines: [], unit, decimals: d,
    ...(average !== undefined ? { average: { value: average, label: `Average ${formatNumber(average, d)} ${unit}${perWords(lineStat, def)}` } } : {}),
  };

  const head = dayly ? 'Day' : w.period === 'sixMonths' ? 'Week' : 'Month';
  const rows = w.buckets.flatMap((b, i) => (b.from > ctx.today ? [] : [[slots[i].name, current[i].text, before[i]?.brief ?? '']]));
  return {
    title, headline, change, stats, notes, chart,
    table: { columns: [head, title, beforeLabel], rows },
    summary: summaryOf(def.title, title, headline, change, notes),
  };
}

/** The day context from the record and the settings: its first day, the statuses, and the programme's rest days. */
export function trendContext({ today, data, settings, profile }: {
  today: string;
  data: TrendData;
  settings: Pick<UserSettings, 'startDate' | 'statusPeriods'>;
  profile: Pick<UserProfile, 'trainingDays'> | undefined;
}): DayContext {
  const since = firstRecordDay(data);
  return dayContext({
    today,
    ...(since ? { since } : {}),
    ...(settings.statusPeriods ? { statusPeriods: settings.statusPeriods } : {}),
    // The programme's planned rest days, as Home's week marks them (A-39), from its start; none outside it.
    restDays: restDaysOf(isEnrolled(settings, profile), profile?.trainingDays),
    startDate: isDay(settings.startDate) ? settings.startDate : '',
  });
}

const READING: readonly [string, string] = ['reading', 'readings'];
const lowerFirst = (s: string) => `${s.charAt(0).toLowerCase()}${s.slice(1)}`;

/** "5 readings, all with a number", "6 readings: 5 with a number, 1 meter LO" (B-15). */
export function readingCount(n: number, hi: number, lo: number): string {
  const total = n + hi + lo;
  const meter = [lo > 0 ? `${formatNumber(lo)} meter LO` : '', hi > 0 ? `${formatNumber(hi)} meter HI` : ''].filter(Boolean).join(' and ');
  if (meter) return `${countText(total, READING)}: ${n === 0 ? 'none' : formatNumber(n)} with a number, ${meter}`;
  if (total === 0) return '0 readings';
  return total === 1 ? '1 reading with a number' : `${countText(total, READING)}, all with a number`;
}

/** A pressure is two numbers and back pain isn't leg pain: each is averaged on its own, the first in the headline. */
const GROUPS: Partial<Record<TrendId, readonly { id: string; words: string }[]>> = {
  bp: [{ id: 'systolic', words: 'top number' }, { id: 'diastolic', words: 'bottom number' }],
  back: [{ id: 'back', words: 'back' }, { id: 'leg', words: 'leg' }],
};

/** A readings trend over its window: the average with n, the spread, the meter's HI and LO, and each reading (A-44, K-11). */
export function readingsView(input: TrendInput): TrendView {
  const { def, window: w, data, prefs, ctx } = input;
  const prev = previousWindow(w);
  const r = readingsFor(def.id, { from: prev.from, to: w.to }, data, prefs);
  const unit = def.unit(prefs);
  const d = def.decimals(prefs);
  // A glucose figure is never rounded across a line it is judged against: 53.9 mg/dL is no "54" (KT-01, J06).
  const lines = def.id === 'glucose' ? displayBoundaries('glucose', unit) : [];
  const fmt = (v: number) => formatNumber(v, safeDecimals(v, d, lines));
  const title = windowTitle(w, ctx.today);
  const against = previousName(w, ctx.today);
  const groups = GROUPS[def.id];
  const primary = groups?.[0].id;
  const of = (series?: string) => (series === undefined ? r.points : r.points.filter(p => p.series === series));
  const stat = (range: DayRange, series?: string) => readingStats(range, of(series), r.meters, ctx);
  const inside = (day: string) => day >= w.from && day <= w.to;
  const all = stat(w);
  const main = groups ? groups.map(g => stat(w, g.id)) : [all];
  const texts = r.texts.filter(t => inside(t.day));
  // A pressure's two numbers are one reading: count the readings as they're listed, a meter's display among them.
  const numeric = texts.length - all.hi - all.lo;

  const value = def.id === 'bp'
    ? (main.some(s => s.mean !== undefined) ? main.map(s => (s.mean === undefined ? 'Not entered' : fmt(s.mean))).join('/') : undefined)
    : main[0].mean === undefined ? undefined : fmt(main[0].mean);
  // Back pain is the headline, leg pain its own stat: each counts its own readings (H3-07).
  const back = def.id === 'back';
  const headline: Headline = {
    statistic: back ? 'Back pain on average' : 'Average',
    coverage: back ? readingCount(main[0].n, 0, 0) : readingCount(numeric, all.hi, all.lo),
    ...(value === undefined ? { value: texts.length === 0 ? 'No readings' : back ? 'No back readings' : 'No numeric readings' } : { value, unit }),
  };

  const ranges = compareRanges(w, ctx.today);
  // `r.meters` are those that may have been measured in either period: one whose zone was lost, wherever it could have been (H3-01).
  const lo = r.meters.filter(m => m.display === 'LO').length;
  // Like with like (KT-07): glucose of more than one kind on the compared days is compared a kind at a time, the first
  // in the fixed order with 3 days in both, and the change says which; a mean of a mix would change with when one tests.
  const kinds = def.id === 'glucose' && ranges ? r.series.filter(sr => stat(ranges.current, sr.id).n + stat(ranges.previous, sr.id).n > 0) : [];
  const like = kinds.length > 1 && ranges ? kinds.find(sr => compareReadings(stat(ranges.current, sr.id), stat(ranges.previous, sr.id), d).shown) : undefined;
  const basis = like?.id ?? primary;
  const comparison: Comparison = !ranges ? { shown: false, reason: 'fewDays' }
    // A LO anywhere in either period hides the change, not only on the days compared (B-15).
    : lo > 0 ? { shown: false, reason: 'meterLo' }
      : kinds.length > 1 && !like ? { shown: false, reason: 'fewKinds' }
        : compareReadings(stat(ranges.current, basis), stat(ranges.previous, basis), d);
  const by = def.id === 'bp' ? `${unit}, top number` : like ? `${unit}, ${lowerFirst(like.label)}` : unit;
  const change = changeOf(comparison, against, by, d, w.period, ranges && comparedText(w, ranges, ctx.today));

  const stats: StatItem[] = [];
  (groups ?? [{ id: '', words: '' }]).forEach((g, i) => {
    const s = main[i];
    if (s.min !== undefined && s.max !== undefined) stats.push({ label: g.words ? `Range, ${g.words}` : 'Range', value: `${fmt(s.min)}–${fmt(s.max)} ${unit}` });
  });
  if (back && main[1].mean !== undefined) stats.push({ label: 'Leg pain on average', value: `${fmt(main[1].mean)} ${unit}, ${countText(main[1].n, READING)}` });
  if (def.id === 'glucose') {
    const line = GLUCOSE_LINES[prefs.glucose];
    stats.push({ label: `Below ${line.low}`, value: formatNumber(all.lows) }, { label: `Above ${line.high}`, value: formatNumber(all.highs) });
    const contexts = r.series.flatMap(sr => {
      const s = stat(w, sr.id);
      return s.mean === undefined ? [] : [{ label: sr.label, mean: s.mean, n: s.n }];
    });
    if (contexts.length > 1) for (const c of contexts) stats.push({ label: c.label, value: `${fmt(c.mean)} ${unit} on average, ${countText(c.n, READING)}` });
  }
  if (def.id === 'bp') stats.push({ label: '180/120 mmHg or higher', value: formatNumber(texts.filter(t => t.note === 'Very high').length) });

  const shown = [all.lo > 0 ? `${formatNumber(all.lo)} LO` : '', all.hi > 0 ? `${formatNumber(all.hi)} HI` : ''].filter(Boolean).join(' and ');
  const meter = shown ? `Not in the average: ${shown}. The meter showed ${all.lo + all.hi === 1 ? 'this' : 'these'} instead of a number.` : undefined;
  const notes: string[] = [];
  const list = statusList(all.status);
  if (list) notes.push(`Includes ${list}.`);

  const dayly = w.period === 'week' || w.period === 'month';
  const colour = `var(${def.colour})`;
  const slotOf = (day: string) => w.buckets.findIndex(b => day >= b.from && day <= b.to);
  const series: ChartSeries[] = dayly
    ? r.series.map((sr): PointSeries => ({
      kind: 'points', id: sr.id, label: sr.label, colour, shape: sr.shape,
      points: r.points.filter(p => p.series === sr.id && inside(p.day)).map(p => ({
        slot: slotOf(p.day),
        // Where through its day the reading was taken, on the wall clock it was recorded in.
        at: (Number(p.at.slice(11, 13)) * 60 + Number(p.at.slice(14, 16))) / 1440,
        value: p.value,
        ...(p.low ? { flag: 'low' as const } : p.high ? { flag: 'high' as const } : {}),
      })),
    })).filter(s => s.points.length > 0)
    // A range for every series plotted by the day: each glucose context, each number of a pressure, back and leg (H3-08).
    : r.series.map((sr): RangeSeries => ({
      kind: 'ranges', id: sr.id, label: sr.label, colour, shape: sr.shape,
      values: w.buckets.map(b => {
        const s = stat(b, sr.id);
        return s.mean === undefined || s.min === undefined || s.max === undefined ? null : { min: s.min, max: s.max, mean: s.mean };
      }),
    }));
  const mmol = prefs.glucose === 'mmol/L';
  const refs = def.id !== 'glucose' ? [] : [
    { value: mmol ? HYPO_LEVEL_1_MGDL / MGDL_PER_MMOL : HYPO_LEVEL_1_MGDL, label: GLUCOSE_LINES[prefs.glucose].low },
    { value: mmol ? HIGH_GLUCOSE_MGDL / MGDL_PER_MMOL : HIGH_GLUCOSE_MGDL, label: GLUCOSE_LINES[prefs.glucose].high },
  ];
  const average = groups ? undefined : all.mean;

  // A week's or a month's readings, every plotted series named when there is more than one (H3-08, H3-15).
  const named = r.series.length > 1;
  const plotted = (b: DayRange) => r.series.flatMap(sr => {
    const s = stat(b, sr.id);
    return s.mean === undefined || s.min === undefined || s.max === undefined ? [] : [{ label: sr.label, n: s.n, min: s.min, max: s.max, mean: s.mean }];
  });
  const said = (b: DayRange): string => {
    if (b.from > ctx.today) return 'Still to come';
    if (dayly) {
      const day = texts.filter(t => t.day === b.from).map(t => `${t.text}${t.note ? `, ${lowerFirst(t.note)}` : ''}`);
      return day.length ? day.join('; ') : 'No readings';
    }
    const parts = plotted(b).map(p => `${named ? `${p.label}: ` : ''}${countText(p.n, READING)}, ${fmt(p.min)} to ${fmt(p.max)} ${unit}, average ${fmt(p.mean)} ${unit}`);
    return parts.length ? parts.join('; ') : 'No readings';
  };
  const slots: Slot[] = w.buckets.map(b => {
    const name = slotName(w.period, b, ctx.today);
    const future = b.from > ctx.today;
    return {
      key: b.from, label: slotLabel(w.period, b), name, range: b,
      ...(future ? { future: true as const } : {}),
      ...(dayly && !future ? { day: b.from } : {}),
      text: `${name}: ${said(b)}.`,
    };
  });

  const table = dayly
    ? { columns: ['Day', 'Reading', 'Note'], rows: texts.map(t => [formatDayLong(t.day, ctx.today), t.text, t.note ?? '']) }
    : {
      columns: [w.period === 'sixMonths' ? 'Week' : 'Month', 'Readings', 'Range', 'Average'],
      rows: w.buckets.flatMap(b => plotted(b).map(p => [
        `${slotName(w.period, b, ctx.today)}${named ? ` · ${p.label}` : ''}`, formatNumber(p.n), `${fmt(p.min)}–${fmt(p.max)} ${unit}`, `${fmt(p.mean)} ${unit}`,
      ])),
    };

  return {
    title, headline, change, stats, notes, ...(meter ? { meter } : {}),
    chart: { slots, series, lines: refs, unit, decimals: d, ...(average !== undefined ? { average: { value: average, label: `Average ${fmt(average)} ${unit}` } } : {}) },
    table,
    summary: summaryOf(def.title, title, headline, change, [...(meter ? [meter] : []), ...notes]),
  };
}

export const LAB_TITLE = Object.fromEntries(LAB_OPTIONS.map(o => [o.kind, o.title])) as Record<LabKind, string>;

export interface LabView {
  lab: LabKind;
  title: string;
  headline: Headline;
  /** When the latest was measured, beside it, and how long after the one before (J§4.10, A-45). */
  change: Change;
  rows: LabRow[];
  chart: ChartModel;
  table: { columns: string[]; rows: string[][] };
  summary: string;
}

/** One lab's results (A-45): dated points with their intervals, from the first, with no period and no 7-day rule. */
export function labsView(lab: LabKind, data: TrendData, prefs: DisplayPrefs, today: string): LabView {
  const title = LAB_TITLE[lab];
  const rows = labHistory(labPoints(lab, data.observations, prefs));
  const latest = rows.at(-1);
  const shown = (r: LabRow) => formatValue(r.value, lab, r.unit);
  const headline: Headline = {
    statistic: 'Latest',
    coverage: countText(rows.length, ['result', 'results']),
    value: latest ? shown(latest) : `No ${title} results yet`,
  };
  // A slot a month, from the first result's month to this one, so results sit as far apart as they were taken.
  const end = latest && latest.day > today ? latest.day : today;
  const months: DayRange[] = [];
  for (let m = monthStart(rows[0]?.day ?? today); m <= end; m = monthStart(m, 1)) months.push({ from: m, to: monthEnd(m) });
  const slotOf = (day: string) => months.findIndex(b => day >= b.from && day <= b.to);
  const slots: Slot[] = months.map((b, i) => {
    const name = format(noon(b.from), 'MMMM yyyy');
    const here = rows.filter(r => r.day >= b.from && r.day <= b.to);
    return {
      key: b.from, name, range: b,
      label: format(noon(b.from), i === 0 || b.from.endsWith('-01-01') ? 'MMM yyyy' : 'MMM'),
      text: `${name}: ${here.length ? here.map(r => `${shown(r)} on ${format(noon(r.day), 'd MMM')}`).join('; ') : 'No results'}.`,
    };
  });
  const points = rows.map(r => {
    const slot = slotOf(r.day);
    return { slot, at: (Number(r.day.slice(8, 10)) - 0.5) / (daysBetween(months[slot].from, months[slot].to) + 1), value: r.value };
  });
  const measured = latest ? formatDayLong(latest.day, today) : undefined;
  return {
    lab, title, headline, rows,
    change: { text: latest && measured ? `Measured ${measured} · ${latest.interval}` : 'No results yet. Add one in Labs.' },
    chart: {
      slots, lines: [], unit: latest?.unit ?? '', decimals: latest ? decimalsFor(lab, latest.unit) : 0,
      series: rows.length ? [{ kind: 'points', id: lab, label: title, colour: `var(${TRENDS.labs.colour})`, shape: 'circle', points }] : [],
    },
    table: { columns: ['Date', 'Result', 'Interval'], rows: rows.map(r => [formatDayLong(r.day, today), shown(r), r.interval]) },
    summary: `${title}. ${headline.statistic}, ${headline.coverage}: ${headline.value}${measured ? `, measured on ${measured}` : ''}.${rows.length > 1 ? ` The first was on ${formatDayLong(rows[0].day, today)}.` : ''}`,
  };
}

export interface TrendRowView {
  id: TrendId;
  title: string;
  colour: string;
  /** The figure with its statistic named: "A day on average this week: 6,167 steps" (J§12.1). */
  value: string;
  /** The small chart's values, oldest first; empty draws none. */
  spark: (number | null)[];
}

/** A category's row on the Trends tab: its week, or its latest reading or result. */
export function trendRow(def: TrendDef, data: TrendData, prefs: DisplayPrefs, ctx: DayContext): TrendRowView {
  const base = { id: def.id, title: def.title, colour: def.colour };
  if (def.family === 'labs') {
    const latest = LAB_OPTIONS
      .flatMap(o => labHistory(labPoints(o.kind, data.observations, prefs)).map(r => ({ lab: o.kind, r })))
      .sort((a, b) => a.r.day.localeCompare(b.r.day))
      .at(-1);
    return {
      ...base,
      value: latest ? `Latest ${LAB_TITLE[latest.lab]}: ${formatValue(latest.r.value, latest.lab, latest.r.unit)} · ${shortDay(latest.r.day, ctx.today)}` : 'No results yet',
      spark: [],
    };
  }
  if (def.family === 'readings') {
    const r = readingsFor(def.id, { from: ctx.since ?? ctx.today, to: ctx.today }, data, prefs);
    const last = r.texts.at(-1);
    const primary = GROUPS[def.id]?.[0].id;
    return {
      ...base,
      value: last ? `Latest: ${last.text} · ${shortDay(last.day, ctx.today)}` : 'No readings yet',
      spark: r.points.filter(p => primary === undefined || p.series === primary).slice(-10).map(p => p.value),
    };
  }
  const view = dailyView({ def, window: windowOf('week', ctx.today), data, prefs, ctx });
  const h = view.headline;
  const bars = view.chart.series.find(s => s.kind === 'bars' && !s.previous);
  return {
    ...base,
    value: h.unit ? `${h.statistic} this week: ${h.value} ${h.unit}` : `${h.value} this week`,
    spark: bars?.kind === 'bars' ? bars.values : [],
  };
}
