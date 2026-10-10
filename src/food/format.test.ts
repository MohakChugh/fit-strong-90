import { describe, expect, it } from 'vitest';
import type { FoodItem, CustomItem, Food } from './types';
import { totalsOf } from './estimate';
import { careTeamLine, carbsText, foodRowDetail, foodTileLine, itemEstimate, itemsLine, kcalText, mealRowDetail, totalsLines } from './format';

const shown = { show: true, ranges: false } as const;
const ranged = { show: true, ranges: true } as const;
const hidden = { show: false } as const;
const roti: FoodItem = { kind: 'food', foodId: 'roti', rev: 1, name: 'Roti', unit: 'piece', count: 2, gramsPerPortion: 40, kcal: 204, carbsG: 43.2, carbsLowG: 31.1, carbsHighG: 57 };
const bhel: CustomItem = { kind: 'custom', customId: 'c1', name: 'Bhel puri', count: 1 };

describe('kcalText and carbsText (journey §11.4)', () => {
  it('rounds kcal to 10, and carbs to the gram under 10 and to 5 above', () => {
    expect(kcalText(204)).toBe('200 kcal');
    expect(kcalText(1455)).toBe('1,460 kcal');
    expect(kcalText(4)).toBe('under 10 kcal');
    expect(carbsText({ carbsG: 43.2 }, false)).toBe('45 g carbs');
    expect(carbsText({ carbsG: 7.6 }, false)).toBe('8 g carbs');
    expect(carbsText({ carbsG: 0.4 }, false)).toBe('under 1 g carbs');
  });
  it('shows carbs as a range that never narrows the estimate (K-22)', () => {
    expect(carbsText({ carbsG: 43.2, carbsLowG: 31.1, carbsHighG: 57 }, true)).toBe('about 30–60 g carbs');
    expect(carbsText({ carbsG: 4, carbsLowG: 3.1, carbsHighG: 5.3 }, true)).toBe('about 3–6 g carbs');
    expect(carbsText({ carbsG: 30 }, true)).toBe('about 30 g carbs');
    expect(carbsText({ carbsG: 0.4, carbsLowG: 0.3, carbsHighG: 0.5 }, true)).toBe('under 1 g carbs');
    // 33.8 would round up to 35, inside the estimate's own range: the low end goes down instead.
    expect(carbsText({ carbsG: 40, carbsLowG: 33.8, carbsHighG: 46.2 }, true)).toBe('about 30–50 g carbs');
  });
});

describe('item and meal lines', () => {
  it('say “Estimated” before every figure, and “No estimate” for an unknown food', () => {
    expect(itemEstimate(roti, shown)).toBe('Estimated 200 kcal · 45 g carbs');
    expect(itemEstimate(roti, ranged)).toBe('Estimated 200 kcal · about 30–60 g carbs');
    expect(itemEstimate(bhel, shown)).toBe('No estimate');
    expect(itemEstimate({ ...bhel, kcal: 300 }, shown)).toBe('Estimated 300 kcal · no carb estimate');
    expect(itemEstimate({ ...bhel, carbsG: 30 }, shown)).toBe('Estimated 30 g carbs · no calorie estimate');
  });
  it('label a partial total “in logged foods” and count what has no estimate (A-17)', () => {
    expect(totalsLines(totalsOf([roti, bhel]), shown)).toEqual({ estimate: 'Estimated 200 kcal · 45 g carbs in logged foods', missing: '1 item has no estimate' });
    expect(totalsLines(totalsOf([roti, bhel, bhel]), ranged)).toEqual({ estimate: 'Estimated 200 kcal · about 30–60 g carbs in logged foods', missing: '2 items have no estimate' });
    const plate = { kind: 'quick', size: 'small', name: 'Small plate', kcal: 250 } as const;
    expect(totalsLines(totalsOf([roti, plate, { ...bhel, carbsG: 30 }]), shown)).toEqual({
      estimate: 'Estimated 450 kcal · 75 g carbs in logged foods', missing: '1 item has no carb estimate · 1 item has no calorie estimate',
    });
  });
  it('list what was eaten, with counts', () => {
    expect(itemsLine([roti, { ...roti, foodId: 'toor-dal', name: 'Toor dal', count: 1.5 }, bhel])).toBe('Roti ×2 · Toor dal ×1½ · Bhel puri');
    expect(itemsLine([{ kind: 'quick', size: 'normal', name: 'Normal plate' }])).toBe('Normal plate');
  });
  it('show nothing numeric in counts-free mode, even for a meal logged with estimates (B-11, Review Focus 3)', () => {
    expect(itemEstimate(roti, hidden)).toBeUndefined();
    expect(totalsLines(totalsOf([roti]), hidden)).toEqual({});
    const meal = { at: '2026-10-07T13:10:00.000+05:30', items: [roti] };
    expect(mealRowDetail(meal, hidden, true)).toBe('1:10 pm · Roti ×2');
    expect(mealRowDetail(meal, shown, true)).toBe('1:10 pm · Roti ×2 · Estimated 200 kcal');
    expect(mealRowDetail({ ...meal, items: [roti, bhel] }, shown, false)).toBe('13:10 · Roti ×2 · Bhel puri · Estimated 200 kcal in logged foods');
    const food = { portion: { unit: 'piece', grams: 40, count: 1, noun: ['roti', 'rotis'] }, per100g: { kcal: 255, carbsG: 54, carbsLowG: 48.6, carbsHighG: 59.4 } } as Food;
    expect(foodRowDetail(food, hidden)).toBe('1 roti (≈ 40 g)');
    expect(foodRowDetail(food, shown)).toBe('1 roti (≈ 40 g) · Estimated 100 kcal');
  });
});

describe('the Food tile and the care-team target', () => {
  it('reads ideas, nothing yet, or how many meals today, never a figure', () => {
    expect(foodTileLine('ideas', 3).text).toBe('Meal ideas for you');
    expect(foodTileLine('meals', 0).text).toBe('Log a meal · ideas for you');
    expect(foodTileLine('estimates', 1).text).toBe('1 meal logged today');
    expect(foodTileLine('meals', 2).text).toBe('2 meals logged today');
  });
  it('shows a care-team target only with estimates, as theirs (journey §11.5)', () => {
    expect(careTeamLine({ kcal: 1600, carbsG: 180, setOn: '2026-10-01' }, shown)).toBe('From your care team: 1,600 kcal and 180 g carbs a day');
    expect(careTeamLine({ kcal: 1600, setOn: '2026-10-01' }, hidden)).toBeUndefined();
    expect(careTeamLine(undefined, shown)).toBeUndefined();
    expect(careTeamLine({ kcal: 1600, setOn: '2026-10-01' }, shown)).toBe('From your care team: 1,600 kcal a day');
    expect(careTeamLine({ carbsG: 180, setOn: '2026-10-01' }, ranged)).toBe('From your care team: 180 g carbs a day');
    expect(careTeamLine({ setOn: '2026-10-01' }, shown)).toBeUndefined();
  });
});
