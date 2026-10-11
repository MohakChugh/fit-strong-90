import { describe, expect, it } from 'vitest';
import { dailyNutrition, dayLine, mealsOn, weekFood } from './days';
import type { FoodItem, MealRecord } from './types';

const roti: FoodItem = { kind: 'food', foodId: 'roti', rev: 1, name: 'Roti', unit: 'piece', count: 2, gramsPerPortion: 40, kcal: 204, carbsG: 43.2, carbsLowG: 31.1, carbsHighG: 57 };
const meal = (id: string, at: string, items: MealRecord['items'] = [roti]): MealRecord => ({ id, at, day: at.slice(0, 10), meal: 'lunch', items, level: 'estimates', loggedAt: at, edits: [] });
const MEALS = [
  meal('b', '2026-10-08T20:00:00.000+05:30'),
  meal('a', '2026-10-08T08:30:00.000+05:30', [roti, { kind: 'custom', customId: 'food-1', name: 'Bhel puri', count: 1, per: { qty: 1, unit: 'plate' }, basis: {}, version: '2026-10-08T09:00:00.000+05:30' }]),
  meal('c', '2026-10-06T13:00:00.000+05:30'),
];
const shown = { show: true, ranges: false } as const;

describe('meals by day (journey §11.2)', () => {
  it('lists a day’s meals in the order they were eaten', () => {
    expect(mealsOn(MEALS, '2026-10-08').map(m => m.id)).toEqual(['a', 'b']);
  });
  it('gives the week Monday to Sunday, with totals only when numbers are shown', () => {
    const week = weekFood(MEALS, '2026-10-08', shown);
    expect(week.map(d => d.day)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']);
    expect(week.map(d => d.meals)).toEqual([0, 1, 0, 2, 0, 0, 0]);
    expect(week[3].totals?.kcal).toBe(408);
    // The day's bhel puri has no figure, so the day is partial, and says what (H7-14, K7-17).
    expect(dayLine(week[3])).toBe('2 meals · Estimated 410 kcal in logged foods · Partial: Bhel puri has no calorie estimate');
  });
  it('shows no figure in counts-free mode, though every meal carries its estimate (B-11, Review Focus 3)', () => {
    const week = weekFood(MEALS, '2026-10-08', { show: false });
    expect(week[3]).toEqual({ day: '2026-10-08', meals: 2 });
    expect(dayLine(week[3])).toBe('2 meals');
    expect(dailyNutrition(MEALS, '2026-10-08', '2026-10-08', { show: false })).toEqual([{ day: '2026-10-08', meals: 2, missing: 1 }]);
  });
  it('gives the daily series a Food trend would draw, partial days marked by what’s missing (B-12)', () => {
    expect(dailyNutrition(MEALS, '2026-10-06', '2026-10-08', shown)).toEqual([
      { day: '2026-10-06', meals: 1, missing: 0, kcal: 204, carbsG: 43.2 },
      { day: '2026-10-07', meals: 0, missing: 0 },
      { day: '2026-10-08', meals: 2, missing: 1, kcal: 408, carbsG: 86.4 },
    ]);
  });
});

describe('meals by day: the other rules (mutation-checked)', () => {
  it('gives an empty day no totals, a day of unknowns no figure, and a kcal-only day no carbs', () => {
    expect(weekFood(MEALS, '2026-10-08', shown)[0]).toEqual({ day: '2026-10-05', meals: 0 });
    const unknown = meal('u', '2026-10-09T13:00:00.000+05:30', [{ kind: 'custom', customId: 'food-1', name: 'Bhel puri', count: 1, per: { qty: 1, unit: 'plate' }, basis: {}, version: '2026-10-08T09:00:00.000+05:30' }]);
    expect(dayLine(weekFood([unknown], '2026-10-09', shown).find(d => d.day === '2026-10-09')!)).toBe('1 meal · Bhel puri has no calorie estimate');
    expect(dayLine(weekFood([unknown, { ...unknown, id: 'v' }, { ...unknown, id: 'w' }], '2026-10-09', shown).find(d => d.day === '2026-10-09')!))
      .toBe('3 meals · 3 items have no calorie estimate');
    const thepla = { ...unknown, id: 't', items: [{ ...unknown.items[0], name: 'Thepla' }] };
    expect(dayLine(weekFood([unknown, thepla], '2026-10-09', shown).find(d => d.day === '2026-10-09')!)).toBe('2 meals · Bhel puri and Thepla have no calorie estimate');
    const plate = meal('p', '2026-10-09T13:00:00.000+05:30', [{ kind: 'quick', size: 'normal', name: 'Normal plate', kcal: 500 }]);
    expect(dailyNutrition([plate], '2026-10-09', '2026-10-09', shown)).toEqual([{ day: '2026-10-09', meals: 1, missing: 1, kcal: 500 }]);
  });
});
