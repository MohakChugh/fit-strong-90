import { describe, expect, it } from 'vitest';
import { FOOD_COPY } from '@/food/copy';
import type { MealItem, MealRecord } from '@/food/types';
import { foodRow, foodView } from './food';
import { hasData } from './metrics';
import { windowOf } from './periods';
import type { DayContext } from './stats';

const ctx: DayContext = { today: '2026-10-08', since: '2026-09-01', statusOn: () => 'normal', restOn: () => false };
const roti: MealItem = { kind: 'food', foodId: 'roti', rev: 1, name: 'Roti', unit: 'piece', count: 2, gramsPerPortion: 40, kcal: 204, carbsG: 43.2, carbsLowG: 31.1, carbsHighG: 57 };
const bhel: MealItem = { kind: 'custom', customId: 'food-1', name: 'Bhel puri', count: 1 };
// One of the person's own foods, with their own figures in its snapshot (Plan 7's D134).
const thepla: MealItem = {
  kind: 'custom', customId: 'food-2', name: 'Thepla', count: 1, per: { qty: 1, unit: 'piece' }, basis: { kcal: 120, carbsG: 40 },
  version: '2026-10-01T10:00:00.000+05:30', kcal: 120, carbsG: 40,
};
const meal = (id: string, day: string, items: MealItem[]): MealRecord =>
  ({ id, at: `${day}T13:10:00.000+05:30`, day, meal: 'lunch', items, level: 'estimates', loggedAt: `${day}T13:10:00.000+05:30`, edits: [] });
const MEALS = [meal('m1', '2026-10-05', [roti]), meal('m2', '2026-10-06', [roti, roti]), meal('m3', '2026-10-07', [roti, bhel])];
const week = windowOf('week', '2026-10-08');

describe('Food’s trend (journey §11.4, §12; B-11; D114)', () => {
  it('says “Estimated” before the figure and “in logged foods” after it, to the nearest 10 kcal, with no comparison', () => {
    const v = foodView({ metric: 'kcal', window: week, meals: MEALS, ranges: false, ctx });
    expect(v.headline).toEqual({ statistic: 'Estimated, a day on average', coverage: '3 days with meals logged', value: '270', unit: 'kcal in logged foods' });
    expect(v.change).toEqual({ text: 'Shown as logged, with no comparison to another period.' });
    expect(v.stats).toEqual([{ label: 'Days with meals logged', value: '3' }, { label: 'Meals logged', value: '3' }]);
    expect(v.notes).toEqual(['1 day has a food with no estimate: its figure is for the logged foods that have one.']);
    expect(JSON.stringify(v)).not.toMatch(/Highest|Higher than|Lower than|target|\bover\b/i);
  });

  it('gives each day its own words, and “Not logged” for a day with no meals', () => {
    const v = foodView({ metric: 'kcal', window: week, meals: MEALS, ranges: false, ctx });
    expect(v.table).toEqual({
      columns: ['Day', 'This week'],
      rows: [
        ['Monday, 5 October', 'Estimated 200 kcal in logged foods'],
        ['Tuesday, 6 October', 'Estimated 410 kcal in logged foods'],
        ['Wednesday, 7 October', 'Estimated 200 kcal in logged foods (a food has no estimate)'],
        ['Thursday, 8 October', 'Not logged'],
      ],
    });
    expect(v.chart.series).toEqual([expect.objectContaining({ kind: 'bars', values: [204, 408, 204, null, null, null, null] })]);
    expect(v.chart.slots.filter(s => s.future).map(s => s.key)).toEqual(['2026-10-09', '2026-10-10', '2026-10-11']);
    expect(v.chart.slots.find(s => s.key === '2026-10-09')?.text).toBe('Friday, 9 October: Still to come.');
  });

  it('gives carbs as a range with insulin, a sulfonylurea or a meglitinide, and says they are rough (K-22)', () => {
    const v = foodView({ metric: 'carbs', window: week, meals: MEALS, ranges: true, ctx });
    expect(v.headline).toMatchObject({ value: 'about 40–80', unit: 'g carbs in logged foods' });
    expect(v.chart.series[0].kind).toBe('ranges');
    expect(v.notes).toContain('Carb figures are rough estimates. Follow your care team’s plan.');
    const plain = foodView({ metric: 'carbs', window: week, meals: MEALS, ranges: false, ctx });
    expect(plain.headline).toMatchObject({ value: '60', unit: 'g carbs in logged foods' });
    expect(plain.notes).not.toContain(FOOD_COPY.roughCarbs);
  });

  it('says a week with nothing logged in words, on its row too', () => {
    expect(foodView({ metric: 'kcal', window: week, meals: [], ranges: false, ctx }).headline).toEqual({ statistic: 'Estimated, a day on average', coverage: '0 days with meals logged', value: 'Not logged' });
    expect(foodRow({ meals: [], ranges: false, ctx }).value).toBe('Not logged this week');
    expect(foodRow({ meals: MEALS, ranges: false, ctx })).toMatchObject({ id: 'food', title: 'Food', value: 'Estimated, a day on average this week: 270 kcal in logged foods', spark: [204, 408, 204, null, null, null, null] });
  });

  it('is listed only while estimates are on and a meal is logged (B-11)', () => {
    const data = (meals: MealRecord[], show: boolean) => ({ observations: [], sessions: [], checkIns: [], meals, numbers: show ? { show: true as const, ranges: false } : { show: false as const } });
    expect(hasData('food', data(MEALS, true))).toBe(true);
    expect(hasData('food', data(MEALS, false))).toBe(false);
    expect(hasData('food', data([], true))).toBe(false);
  });

  it('labels the chart’s average line as an estimate in logged foods, a day on average', () => {
    expect(foodView({ metric: 'kcal', window: week, meals: MEALS, ranges: false, ctx }).chart.average).toEqual({ value: 272, label: 'Estimated 270 kcal in logged foods, a day on average' });
    expect(foodView({ metric: 'kcal', window: week, meals: [], ranges: false, ctx }).chart.average).toBeUndefined();
  });

  it('says a day whose foods have no estimate in words, never as 0 (A-17)', () => {
    const v = foodView({ metric: 'kcal', window: week, meals: [meal('m9', '2026-10-05', [bhel])], ranges: false, ctx });
    expect(v.table.rows[0]).toEqual(['Monday, 5 October', 'Logged, with no estimate']);
    expect(v.chart.series[0]).toMatchObject({ kind: 'bars', values: [null, null, null, null, null, null, null] });
    expect(v.headline).toEqual({ statistic: 'Estimated, a day on average', coverage: '1 day with meals logged', value: 'Logged, with no estimate' });
  });
});

describe('the person’s own carb figures (Plan 7’s D132)', () => {
  const OWN = [meal('o1', '2026-10-05', [roti, thepla]), meal('o2', '2026-10-06', [thepla])];

  it('with carb ranges, names them apart from the table’s range and never puts them in it', () => {
    const v = foodView({ metric: 'carbs', window: week, meals: OWN, ranges: true, ctx });
    expect(v.table.rows.slice(0, 2)).toEqual([
      ['Monday, 5 October', 'Estimated about 30–60 g carbs in logged foods, plus 40 g from foods you entered yourself'],
      ['Tuesday, 6 October', '40 g carbs from foods you entered yourself'],
    ]);
    // The range drawn is the table's foods' alone, with their own estimate inside it; a day of own figures only draws none.
    expect(v.chart.series[0]).toMatchObject({ kind: 'ranges', values: [{ min: 31.1, max: 57, mean: 43.2 }, null, null, null, null, null, null] });
    expect(v.headline).toMatchObject({ value: 'about 15–30', unit: 'g carbs in logged foods, plus 40 g from foods you entered yourself' });
    // The average line is the table's foods' own estimate, where their range is drawn; the words name the own figure apart.
    expect(v.chart.average?.value).toBeCloseTo(21.6, 9);
    expect(v.chart.average?.label).toBe('Estimated about 15–30 g carbs in logged foods, plus 40 g from foods you entered yourself, a day on average');
  });

  it('says equal ends as one figure, never as a range (D149)', () => {
    // A weighed pinch, whose ends meet under 1 g each: together they are one figure of 1 g or more.
    const pinch: MealItem = { kind: 'food', foodId: 'jeera', rev: 1, name: 'Jeera', unit: 'tbsp', count: 1, gramsPerPortion: 1, weighed: true, kcal: 4, carbsG: 0.4, carbsLowG: 0.4, carbsHighG: 0.4 };
    const v = foodView({ metric: 'carbs', window: week, meals: [meal('p1', '2026-10-05', [pinch, pinch, pinch])], ranges: true, ctx });
    expect(v.table.rows[0]).toEqual(['Monday, 5 October', 'Estimated 1 g carbs in logged foods']);
    expect(v.headline).toMatchObject({ value: '1', unit: 'g carbs in logged foods' });
  });

  it('with ranges off, adds them into the one figure, as the hub does', () => {
    const v = foodView({ metric: 'carbs', window: week, meals: OWN, ranges: false, ctx });
    expect(v.table.rows.slice(0, 2)).toEqual([
      ['Monday, 5 October', 'Estimated 85 g carbs in logged foods'],
      ['Tuesday, 6 October', 'Estimated 40 g carbs in logged foods'],
    ]);
    expect(v.chart.series[0]).toMatchObject({ kind: 'bars', values: [83.2, 40, null, null, null, null, null] });
  });
});
