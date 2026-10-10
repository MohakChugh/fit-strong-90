import { describe, expect, it } from 'vitest';
import type { CustomFood, Food, FoodItem } from './types';
import { customItem, estimateFood, foodItem, quickItem, refreshItem, totalsOf } from './estimate';

const roti = {
  id: 'roti', rev: 1, name: 'Roti', portion: { unit: 'piece', grams: 40, count: 1, noun: ['roti', 'rotis'] },
  per100g: { kcal: 255, carbsG: 54, carbsLowG: 48.6, carbsHighG: 59.4 },
} as Food;
const dal = {
  id: 'toor-dal', rev: 2, name: 'Toor dal', portion: { unit: 'katori', grams: 150, count: 1 },
  per100g: { kcal: 94.3, carbsG: 13.07, carbsLowG: 11.76, carbsHighG: 14.38 },
} as Food;
const bhel: CustomFood = { id: 'c1', name: 'Bhel puri', per: { qty: 1, unit: 'plate' }, createdAt: '2026-10-08T09:00:00.000+05:30', updatedAt: '2026-10-08T09:00:00.000+05:30' };

describe('estimateFood (B-12)', () => {
  it('scales per-100 g values to the grams eaten, with the portion’s variance on the carb range', () => {
    // 2 rotis are 80 g: 204 kcal and 43.2 g carbs; the range is 38.88 × 0.8 to 47.52 × 1.2.
    expect(estimateFood(roti, 2, 40)).toEqual({ kcal: 204, carbsG: 43.2, carbsLowG: 31.1, carbsHighG: 57 });
  });
  it('drops the portion’s variance for a portion the person weighed', () => {
    expect(estimateFood(roti, 2, 40, true)).toEqual({ kcal: 204, carbsG: 43.2, carbsLowG: 38.9, carbsHighG: 47.5 });
  });
});

describe('items', () => {
  it('keep the food’s name, revision, unit and grams with the estimate (B-12)', () => {
    expect(foodItem(dal)).toEqual({ kind: 'food', foodId: 'toor-dal', rev: 2, name: 'Toor dal', unit: 'katori', count: 1, gramsPerPortion: 150, kcal: 141, carbsG: 19.6, carbsLowG: 14.1, carbsHighG: 25.9 });
  });
  it('leave a custom food’s unknown values unknown, never 0 (A-17)', () => {
    expect(customItem(bhel)).toEqual({ kind: 'custom', customId: 'c1', name: 'Bhel puri', count: 1 });
    expect(customItem({ ...bhel, kcal: 300 }, 2)).toEqual({ kind: 'custom', customId: 'c1', name: 'Bhel puri', count: 2, kcal: 600 });
    expect(quickItem('normal')).toEqual({ kind: 'quick', size: 'normal', name: 'Normal plate' });
    expect(customItem({ ...bhel, carbsG: 45.5 }, 2)).toEqual({ kind: 'custom', customId: 'c1', name: 'Bhel puri', count: 2, carbsG: 91 });
    expect(quickItem('large', 612.4)).toEqual({ kind: 'quick', size: 'large', name: 'Large plate', kcal: 612 });
  });
  it('start at the food’s standard portion: two idlis, at their own grams', () => {
    const idli = { ...roti, id: 'idli', name: 'Idli', portion: { unit: 'piece', grams: 40, count: 2, noun: ['idli', 'idlis'] } } as Food;
    expect(foodItem(idli)).toMatchObject({ foodId: 'idli', count: 2, gramsPerPortion: 40 });
  });
  it('are worked out again when the recipe moved on, keeping a weighed portion’s grams', () => {
    const old: FoodItem = { ...foodItem(dal), rev: 1, kcal: 999 };
    expect(refreshItem(old, dal)).toEqual(foodItem(dal));
    expect(refreshItem({ ...foodItem(dal, 1, 200, true), rev: 1 }, dal)).toEqual(foodItem(dal, 1, 200, true));
    const stored: FoodItem = { kind: 'food', foodId: 'roti', rev: 1, name: 'Roti', unit: 'piece', count: 2, gramsPerPortion: 40 };
    expect(refreshItem(stored, roti)).toEqual(foodItem(roti, 2));
    expect(refreshItem(old, undefined)).toBe(old);
  });
});

describe('totalsOf (A-17, B-12)', () => {
  it('adds the known items and names the unknown ones apart', () => {
    expect(totalsOf([foodItem(roti, 2), customItem(bhel), quickItem('small', 250)])).toEqual({
      kcal: 454, carbsG: 43.2, carbsLowG: 31.1, carbsHighG: 57, withKcal: 2, withCarbs: 1, items: 3,
      missing: [{ name: 'Bhel puri', kcal: true, carbs: true }, { name: 'Small plate', kcal: false, carbs: true }],
    });
  });
  it('knows nothing for an empty meal', () => {
    expect(totalsOf([])).toEqual({ kcal: 0, carbsG: 0, carbsLowG: 0, carbsHighG: 0, withKcal: 0, withCarbs: 0, items: 0, missing: [] });
  });
});
