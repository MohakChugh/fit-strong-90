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
import { formatDayLong, type DisplayPrefs } from '@/screens/track/format';
import { formatNumber } from '@/screens/track/units';
import type { UserSettings } from '@/types';
import type { UserProfile } from '@/types/profile';
import { MARK_WORDS, type ChartModel, type ChartSeries, type Slot, type SlotMark } from './chart';
import { figuresFor, type TrendDef } from './metrics';
import { compareRanges, comparedText, previousName, previousWindow, rangeText, windowTitle, type TrendPeriod, type TrendWindow } from './periods';
import { firstRecordDay, stretchedDays, type TrendData } from './records';
import {
  compareDaily, dailyStats, dayContext, figureOf, statisticFor, statusList,
  type Comparison, type DailyRule, type DayContext, type DayFigure, type Direction, type Statistic,
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

/** "Tue 6 Oct". */
export const shortDay = (day: string): string => format(noon(day), 'EEE d MMM');

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

/** "Higher than last week · +417 steps a day": the direction in words, and the difference with its unit and statistic (A-41). */
function changeOf(c: Comparison, against: string, unit: string, decimals: number, period: TrendPeriod, compared?: string): Change {
  if (!c.shown) return { text: c.reason === 'meterLo' ? METER_LO_TEXT : fewDaysText(period) };
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
    stats.push({ label: rule === 'stated' ? 'Highest' : 'Highest day', value: `${formatNumber(s.high.value, d)} ${unit} · ${shortDay(s.high.day)}` });
  }

  const notes: string[] = [];
  const list = statusList(s.status);
  if (list) notes.push(rule === 'counted' && statistic !== 'total' ? `Includes ${list}, not counted as days in the average.` : `Includes ${list}.`);
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
