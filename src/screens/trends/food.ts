/**
 * Food's trend (journey §11.4–11.5, §12; B-11, K-22; board D114). Only while
 * estimates are on. A stated measure: a day with meals logged has its
 * estimate, and any other day says "Not logged". "Estimated" before every
 * figure and "in logged foods" after it; a day with a food that has no
 * estimate says so. No comparison with another period, no target and no
 * "highest day". kcal to the nearest 10; carbs a range with insulin, a
 * sulfonylurea or a meglitinide: the table's foods' range, with the person's
 * own figures named apart and never in it, as the hub says a day (Plan 7's
 * D132, D149). It makes Plan 3's `TrendView`, so the chart, its list and its
 * words take it as they are.
 */
import { FOOD_COPY } from '@/food/copy';
import { mealsOn } from '@/food/days';
import { totalsOf, type Totals } from '@/food/estimate';
import { carbsRangeText, carbsText, kcalText, ownGrams } from '@/food/format';
import type { MealRecord } from '@/food/types';
import { shiftDay } from '@/health/status';
import { formatNumber } from '@/screens/track/units';
import type { ChartModel, ChartSeries, Slot } from './chart';
import { TRENDS } from './metrics';
import { slotLabel, slotName, type Headline, type StatItem, type TrendRowView, type TrendView } from './model';
import { windowOf, windowTitle, type TrendWindow } from './periods';
import type { DayContext } from './stats';

export type FoodMetric = 'kcal' | 'carbs';

export const FOOD_METRICS: readonly { id: FoodMetric; label: string }[] = [
  { id: 'kcal', label: 'Energy' },
  { id: 'carbs', label: 'Carbs' },
];

export const isFoodMetric = (x: unknown): x is FoodMetric => x === 'kcal' || x === 'carbs';

export const FOOD_TREND_COPY = {
  statistic: 'Estimated, a day on average',
  noCompare: 'Shown as logged, with no comparison to another period.',
  notLogged: 'Not logged',
  noEstimate: 'Logged, with no estimate',
  stillToCome: 'Still to come',
  partial: (n: number) => `${formatNumber(n)} ${n === 1 ? 'day has' : 'days have'} a food with no estimate: its figure is for the logged foods that have one.`,
} as const;

export interface FoodInput {
  metric: FoodMetric;
  window: TrendWindow;
  meals: readonly MealRecord[];
  /** Carbs as a range (K-22): the `ranges` of the numbers view the caller asked for. */
  ranges: boolean;
  ctx: DayContext;
}

type Range = TrendWindow['buckets'][number];

/**
 * A day's figure, or several days' as an average day. `value` is the bar: kcal, or every carb
 * figure added. With carb ranges, the table's foods are `low`–`high` with their own estimate
 * `mid` inside, and the person's own figures `own`, apart (Plan 7's handoff, D132).
 */
interface Figure { value: number; low: number; high: number; mid: number; own: number; ranged: boolean; owned: boolean; partial: boolean }

const average = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** A day's figure, or nothing when none of its logged foods has one. */
function figureOf(t: Totals, metric: FoodMetric): Figure | undefined {
  if (metric === 'kcal') {
    return t.withKcal > 0 ? { value: t.kcal, low: 0, high: 0, mid: 0, own: 0, ranged: false, owned: false, partial: t.missing.some(m => m.kcal) } : undefined;
  }
  if (t.withCarbs === 0) return undefined;
  // The table's foods' own estimate, held inside their range against the rounding of the two sums.
  const mid = Math.min(t.carbsHighG, Math.max(t.carbsLowG, t.carbsG - t.ownCarbsG));
  return {
    value: t.carbsG, low: t.carbsLowG, high: t.carbsHighG, mid, own: t.ownCarbsG,
    ranged: t.withCarbRange > 0, owned: t.withOwnCarbs > 0, partial: t.missing.some(m => m.carbs),
  };
}

/** Several days as one: the average day of those with a figure. */
function averaged(fs: readonly Figure[]): Figure | undefined {
  if (fs.length === 0) return undefined;
  const of = (pick: (f: Figure) => number) => average(fs.map(pick));
  return {
    value: of(f => f.value), low: of(f => f.low), high: of(f => f.high), mid: of(f => f.mid), own: of(f => f.own),
    ranged: fs.some(f => f.ranged), owned: fs.some(f => f.owned), partial: fs.some(f => f.partial),
  };
}

/**
 * A figure in words, split as the headline shows it: the figure, and what follows it. As
 * `totalsLines` says a day's totals: with carb ranges the table's foods are a range, "about
 * 30–60 g carbs in logged foods", and an own figure follows apart, "plus 40 g from foods you
 * entered yourself"; with only own figures, "40 g carbs from foods you entered yourself",
 * which no one estimated. Equal ends are one figure, never printed as a range (D149).
 */
function wordsOf(f: Figure, metric: FoodMetric, ranges: boolean): { value: string; unit: string; estimated: boolean } {
  if (metric === 'kcal') return { value: kcalText(f.value).replace(/ kcal$/, ''), unit: 'kcal in logged foods', estimated: true };
  if (!ranges) return { value: carbsText(f.value).replace(/ g carbs$/, ''), unit: 'g carbs in logged foods', estimated: true };
  const own = f.owned ? ownGrams(f.own) : undefined;
  if (!f.ranged && own) return { value: own.replace(/ g$/, ''), unit: 'g carbs from foods you entered yourself', estimated: false };
  const range = carbsRangeText({ low: f.low, high: f.high }) ?? carbsText(f.low);
  return { value: range.replace(/ g carbs$/, ''), unit: `g carbs in logged foods${own ? `, plus ${own} from foods you entered yourself` : ''}`, estimated: true };
}

export function foodView({ metric, window: w, meals, ranges, ctx }: FoodInput): TrendView {
  const def = TRENDS.food;
  const unit = metric === 'kcal' ? 'kcal' : 'g carbs';
  const said = (f: Figure) => {
    const words = wordsOf(f, metric, ranges);
    return `${words.estimated ? 'Estimated ' : ''}${words.value} ${words.unit}`;
  };
  const daysIn = (range: Range) => {
    const out: { day: string; meals: number; f?: Figure }[] = [];
    for (let day = range.from; day <= range.to && day <= ctx.today; day = shiftDay(day, 1)) {
      const list = mealsOn(meals, day);
      const f = list.length > 0 ? figureOf(totalsOf(list.flatMap(m => m.items)), metric) : undefined;
      out.push({ day, meals: list.length, ...(f ? { f } : {}) });
    }
    return out;
  };

  const logged = daysIn({ from: w.from, to: w.to }).filter(d => d.meals > 0);
  const avg = averaged(logged.flatMap(d => (d.f ? [d.f] : [])));
  const title = windowTitle(w, ctx.today);
  const [one, many] = def.coverage;
  const figure = avg && wordsOf(avg, metric, ranges);
  const headline: Headline = {
    statistic: FOOD_TREND_COPY.statistic,
    coverage: `${formatNumber(logged.length)} ${logged.length === 1 ? one : many}`,
    // Meals logged with no figure are said so, never "Not logged" (A-17).
    ...(figure ? { value: figure.value, unit: figure.unit } : { value: logged.length > 0 ? FOOD_TREND_COPY.noEstimate : FOOD_TREND_COPY.notLogged }),
  };
  const stats: StatItem[] = [
    { label: 'Days with meals logged', value: formatNumber(logged.length) },
    { label: 'Meals logged', value: formatNumber(logged.reduce((t, d) => t + d.meals, 0)) },
  ];
  const partialDays = logged.filter(d => !d.f || d.f.partial).length;
  const notes = [
    ...(partialDays > 0 ? [FOOD_TREND_COPY.partial(partialDays)] : []),
    ...(metric === 'carbs' && ranges ? [FOOD_COPY.roughCarbs] : []),
  ];

  const dayly = w.period === 'week' || w.period === 'month';
  const cells = w.buckets.map(b => {
    if (b.from > ctx.today) return { value: null, range: null, text: FOOD_TREND_COPY.stillToCome };
    const inBucket = daysIn(b).filter(d => d.meals > 0);
    const f = averaged(inBucket.flatMap(d => (d.f ? [d.f] : [])));
    if (!f) return { value: null, range: null, text: inBucket.length > 0 ? FOOD_TREND_COPY.noEstimate : FOOD_TREND_COPY.notLogged };
    return {
      value: f.value,
      // Only the table's foods are a range: the person's own figures are never in it (D132).
      range: f.ranged ? { min: f.low, max: f.high, mean: f.mid } : null,
      text: `${said(f)}${dayly ? '' : ', on an average day'}${f.partial ? ' (a food has no estimate)' : ''}`,
    };
  });
  const slots: Slot[] = w.buckets.map((b, i) => {
    const name = slotName(w.period, b, ctx.today);
    const future = b.from > ctx.today;
    return {
      key: b.from, label: slotLabel(w.period, b), name, range: b,
      ...(future ? { future: true as const } : {}),
      ...(dayly && !future ? { day: b.from } : {}),
      text: `${name}: ${cells[i].text}.`,
    };
  });
  const colour = `var(${def.colour})`;
  const rangesDrawn = metric === 'carbs' && ranges;
  const series: ChartSeries[] = rangesDrawn
    ? [{ kind: 'ranges', id: 'current', label: title, colour, shape: 'circle', values: cells.map(c => c.range) }]
    : [{ kind: 'bars', id: 'current', label: title, colour, values: cells.map(c => c.value) }];
  // The line sits where the drawn figure's average is: the bars', or the table's foods' own estimate inside their range.
  const line = avg && (rangesDrawn ? (avg.ranged ? avg.mid : undefined) : avg.value);
  const chart: ChartModel = {
    slots, series, lines: [], unit, decimals: 0,
    ...(avg && line !== undefined ? { average: { value: line, label: `${said(avg)}, a day on average` } } : {}),
  };
  const head = dayly ? 'Day' : w.period === 'sixMonths' ? 'Week' : 'Month';
  const rows = w.buckets.flatMap((b, i) => (b.from > ctx.today ? [] : [[slots[i].name, cells[i].text]]));
  return {
    title, headline, change: { text: FOOD_TREND_COPY.noCompare }, stats, notes, chart,
    table: { columns: [head, title], rows },
    summary: `${def.title}, ${title}. ${headline.statistic}, ${headline.coverage}: ${headline.value}${headline.unit ? ` ${headline.unit}` : ''}. ${[FOOD_TREND_COPY.noCompare, ...notes].join(' ')}`,
  };
}

/** Food's row on the Trends tab: this week's average day, the figure's words as the trend's own. */
export function foodRow({ meals, ranges, ctx }: Omit<FoodInput, 'metric' | 'window'>): TrendRowView {
  const view = foodView({ metric: 'kcal', window: windowOf('week', ctx.today), meals, ranges, ctx });
  const h = view.headline;
  const bars = view.chart.series.find(s => s.kind === 'bars');
  return {
    id: 'food', title: TRENDS.food.title, colour: TRENDS.food.colour,
    value: h.unit ? `${h.statistic} this week: ${h.value} ${h.unit}` : `${h.value} this week`,
    spark: bars?.kind === 'bars' ? bars.values : [],
  };
}
