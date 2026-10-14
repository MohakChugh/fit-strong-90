import { describe, expect, it } from 'vitest';
import type { FoodItem, CustomItem, Food } from './types';
import { totalsOf } from './estimate';
import { careTeamLine, carbsRangeText, carbsText, foodRowDetail, foodTileLine, itemEstimate, itemsLine, kcalText, mealRowDetail, totalsLines } from './format';

const shown = { show: true, ranges: false } as const;
const ranged = { show: true, ranges: true } as const;
const hidden = { show: false } as const;
const roti: FoodItem = { kind: 'food', foodId: 'roti', rev: 1, name: 'Roti', unit: 'piece', count: 2, gramsPerPortion: 40, kcal: 204, carbsG: 43.2, carbsLowG: 31.1, carbsHighG: 57 };
const bhel: CustomItem = { kind: 'custom', customId: 'c1', name: 'Bhel puri', count: 1, per: { qty: 1, unit: 'plate' }, basis: {}, version: '2026-10-08T09:00:00.000+05:30' };

describe('kcalText and carbsText (journey §11.4)', () => {
  it('rounds kcal to 10, and carbs to the gram under 10 and to 5 above', () => {
    expect(kcalText(204)).toBe('200 kcal');
    expect(kcalText(1455)).toBe('1,460 kcal');
    expect(kcalText(4)).toBe('under 10 kcal');
    expect(carbsText(43.2)).toBe('45 g carbs');
    expect(carbsText(7.6)).toBe('8 g carbs');
    expect(carbsText(0.4)).toBe('under 1 g carbs');
  });
  it('shows carbs as a range that never narrows the estimate (K-22)', () => {
    expect(carbsRangeText({ low: 31.1, high: 57 })).toBe('about 30–60 g carbs');
    expect(carbsRangeText({ low: 3.1, high: 5.3 })).toBe('about 3–6 g carbs');
    expect(carbsRangeText({ low: 0.3, high: 0.5 })).toBe('under 1 g carbs');
    // 33.8 would round up to 35, inside the estimate's own range: the low end goes down instead.
    expect(carbsRangeText({ low: 33.8, high: 46.2 })).toBe('about 30–50 g carbs');
  });
});

describe('a carb range with equal ends (H7-05; board D149)', () => {
  const flat: FoodItem = { ...roti, carbsG: 40, carbsLowG: 40, carbsHighG: 40 };
  it('is a single figure, never shown as one: the item has no carb estimate, and the total says so', () => {
    expect(carbsRangeText({ low: 40, high: 40 })).toBeUndefined();
    expect(carbsRangeText({ low: 7, high: 7 })).toBeUndefined();
    expect(itemEstimate(flat, ranged)).toBe('Estimated 200 kcal · no carb estimate');
    expect(itemEstimate(flat, shown)).toBe('Estimated 200 kcal · no carb estimate');
    expect(totalsLines(totalsOf([flat]), ranged)).toEqual({ estimate: 'Estimated 200 kcal in logged foods', missing: '1 item has no carb estimate' });
    expect(totalsLines(totalsOf([flat, roti]), ranged).estimate).toBe('Estimated 410 kcal · about 30–60 g carbs in logged foods');
  });
  it('reads “under 1 g” for a tiny portion, and a total of them with no width has no single figure either', () => {
    const tiny: FoodItem = { ...roti, count: 1, gramsPerPortion: 1, weighed: true, kcal: 3, carbsG: 0.1, carbsLowG: 0.1, carbsHighG: 0.1 };
    expect(carbsRangeText({ low: 0.4, high: 0.4 })).toBe('under 1 g carbs');
    expect(itemEstimate(tiny, ranged)).toBe('Estimated under 10 kcal · under 1 g carbs');
    expect(totalsLines(totalsOf(Array<FoodItem>(10).fill(tiny)), ranged).estimate).toBe('Estimated 30 kcal in logged foods');
  });
  it('still reads a real range, however narrow, as one', () => {
    expect(carbsRangeText({ low: 39.9, high: 40 })).toBe('about 35–40 g carbs');
    expect(carbsRangeText({ low: 40, high: 40.1 })).toBe('about 40–45 g carbs');
    expect(carbsRangeText({ low: 7, high: 7.1 })).toBe('about 7–8 g carbs');
    expect(carbsRangeText({ low: 9.5, high: 10 })).toBe('about 9–10 g carbs');
  });
});

describe('your own food’s carbs, with ranges on (H7-05, K7-05; board D132)', () => {
  const mine = { ...bhel, kcal: 300, carbsG: 40 };
  it('read as your own figure, never as a range', () => {
    expect(itemEstimate({ ...bhel, carbsG: 30 }, ranged)).toBe('Estimated 30 g carbs, your own figure · no calorie estimate');
    // As entered, to one decimal, or under 1 g: never rounded off (K7R-07).
    expect(itemEstimate({ ...bhel, carbsG: 42.5 }, ranged)).toBe('Estimated 42.5 g carbs, your own figure · no calorie estimate');
    expect(itemEstimate({ ...bhel, carbsG: 12.5 }, ranged)).toBe('Estimated 12.5 g carbs, your own figure · no calorie estimate');
    expect(itemEstimate({ ...bhel, carbsG: 0.4 }, ranged)).toBe('Estimated under 1 g carbs, your own figure · no calorie estimate');
    expect(itemEstimate({ ...bhel, carbsG: 1234.5 }, ranged)).toBe('Estimated 1,234.5 g carbs, your own figure · no calorie estimate');
    expect(itemEstimate(mine, shown)).toBe('Estimated 300 kcal · 40 g carbs');
  });
  it('stay out of the closed range, named apart', () => {
    expect(totalsLines(totalsOf([roti, mine]), ranged).estimate).toBe('Estimated 500 kcal · about 30–60 g carbs in logged foods, plus 40 g from foods you entered yourself');
    expect(totalsLines(totalsOf([roti, { ...bhel, carbsG: 40 }]), ranged).estimate).toBe('Estimated 200 kcal · about 30–60 g carbs in logged foods, plus 40 g from foods you entered yourself');
    expect(totalsLines(totalsOf([mine]), ranged).estimate).toBe('Estimated 300 kcal in logged foods, plus 40 g carbs from foods you entered yourself');
    expect(totalsLines(totalsOf([roti, { ...bhel, carbsG: 12.5 }]), ranged).estimate).toBe('Estimated 200 kcal · about 30–60 g carbs in logged foods, plus 12.5 g from foods you entered yourself');
    expect(totalsLines(totalsOf([roti, { ...bhel, carbsG: 0.4 }]), ranged).estimate).toBe('Estimated 200 kcal · about 30–60 g carbs in logged foods, plus under 1 g from foods you entered yourself');
    expect(totalsLines(totalsOf([{ ...bhel, carbsG: 40 }, { ...bhel, name: 'Thepla', carbsG: 25 }]), ranged))
      .toEqual({ estimate: '65 g carbs from foods you entered yourself', missing: '2 items have no calorie estimate' });
  });
  it('add into one figure with ranges off', () => {
    expect(totalsLines(totalsOf([roti, mine]), shown).estimate).toBe('Estimated 500 kcal · 85 g carbs in logged foods');
    expect(totalsLines(totalsOf([{ ...bhel, carbsG: 40 }]), shown).estimate).toBe('Estimated 40 g carbs in logged foods');
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
