import { describe, expect, it } from 'vitest';
import { foodItem } from './estimate';
import { addFood, step, slotAt, weighed, withCount, type Lookup } from './tray';
import type { Food, FoodItem } from './types';

const roti = { id: 'roti', rev: 2, name: 'Roti', portion: { unit: 'piece', grams: 40, count: 1, noun: ['roti', 'rotis'] }, per100g: { kcal: 255, carbsG: 54, carbsLowG: 48.6, carbsHighG: 59.4 } } as Food;
const idli = { id: 'idli', rev: 1, name: 'Idli', portion: { unit: 'piece', grams: 40, count: 2, noun: ['idli', 'idlis'] }, per100g: { kcal: 144, carbsG: 30, carbsLowG: 27, carbsHighG: 33 } } as Food;
const dal = { id: 'toor-dal', rev: 1, name: 'Toor dal', portion: { unit: 'katori', grams: 150, count: 1 }, per100g: { kcal: 94.3, carbsG: 13.07, carbsLowG: 11.76, carbsHighG: 14.38 } } as Food;
const look: Lookup = { food: id => [roti, idli, dal].find(f => f.id === id), custom: () => undefined };

describe('the meal tray (journey §11.3, B-08)', () => {
  it('"+" adds one standard portion, and a second "+" adds another to the same row', () => {
    const one = addFood([], idli, look);
    expect(one).toEqual([foodItem(idli)]);
    expect(addFood(one, idli, look)).toEqual([foodItem(idli, 4)]);
  });
  it('steps pieces by one and katoris by halves, never below one step or above 20', () => {
    expect(step(foodItem(roti), 1, look)).toEqual(foodItem(roti, 2));
    expect(step(foodItem(dal), 1, look)).toEqual(foodItem(dal, 1.5));
    expect(step(foodItem(dal, 0.5), -1, look)).toEqual(foodItem(dal, 0.5));
    expect(withCount(foodItem(roti), 50, look)).toEqual(foodItem(roti, 20));
  });
  it('keeps an item on the recipe it was logged with when the table has moved on (B-12)', () => {
    const logged: FoodItem = { kind: 'food', foodId: 'roti', rev: 1, name: 'Roti', unit: 'piece', count: 2, gramsPerPortion: 40, kcal: 204, carbsG: 43.2, carbsLowG: 31.1, carbsHighG: 57 };
    expect(withCount(logged, 3, look)).toEqual({ ...logged, count: 3, kcal: 306, carbsG: 64.8, carbsLowG: 46.7, carbsHighG: 85.5 });
  });
  it('weighs a portion: the weight given, and no portion variance', () => {
    expect(weighed(foodItem(roti, 2), 35, roti)).toEqual(foodItem(roti, 2, 35, true));
  });
  it('suggests the meal by the time of day', () => {
    expect(slotAt(9 * 60)).toBe('breakfast');
    expect(slotAt(13 * 60 + 20)).toBe('lunch');
    expect(slotAt(17 * 60)).toBe('snack');
    expect(slotAt(21 * 60)).toBe('dinner');
    expect(slotAt(2 * 60)).toBe('dinner');
  });
});

describe('the tray’s other rules (mutation-checked)', () => {
  const bhel = { id: 'food-1', name: 'Bhel puri', per: { qty: 1, unit: 'plate' }, kcal: 300, createdAt: '2026-10-08T09:00:00.000+05:30', updatedAt: '2026-10-08T09:00:00.000+05:30' };
  const withBhel: Lookup = { food: look.food, custom: id => (id === 'food-1' ? bhel : undefined) };
  it('steps the person’s own food by half a portion, from what they said it holds', () => {
    expect(step({ kind: 'custom', customId: 'food-1', name: 'Bhel puri', count: 1, kcal: 300 }, 1, withBhel)).toEqual({ kind: 'custom', customId: 'food-1', name: 'Bhel puri', count: 1.5, kcal: 450 });
    // Gone from the person's foods: its own figures are scaled.
    expect(withCount({ kind: 'custom', customId: 'food-9', name: 'Kachori', count: 1, kcal: 200, carbsG: 25 }, 2, look)).toEqual({ kind: 'custom', customId: 'food-9', name: 'Kachori', count: 2, kcal: 400, carbsG: 50 });
  });
  it('leaves a quick add as it is, and keeps a weighed portion weighed when its recipe moved on', () => {
    const quick = { kind: 'quick', size: 'normal', name: 'Normal plate' } as const;
    expect(step(quick, 1, look)).toBe(quick);
    expect(withCount(quick, 3, look)).toBe(quick);
    const old: FoodItem = { kind: 'food', foodId: 'roti', rev: 1, name: 'Roti', unit: 'piece', count: 1, gramsPerPortion: 35, weighed: true, kcal: 89 };
    expect(withCount(old, 2, look)).toEqual({ ...old, count: 2, kcal: 178 });
  });
  it('adds a new row beside a weighed one, and rounds a weighed portion to the gram', () => {
    const tray = [weighed(foodItem(roti), 35, roti)];
    expect(addFood(tray, roti, look)).toEqual([...tray, foodItem(roti)]);
    expect(addFood([foodItem(dal), foodItem(roti)], roti, look)).toEqual([foodItem(dal), foodItem(roti, 2)]);
    expect(weighed(foodItem(roti), 35.4, roti).gramsPerPortion).toBe(35);
    // Stepped on the recipe as it is now, a weighed portion keeps its weight and stays weighed.
    expect(step(weighed(foodItem(roti), 35, roti), 1, look)).toEqual(foodItem(roti, 2, 35, true));
  });
  it('works an own food out again from what the person says it holds now', () => {
    const now: Lookup = { food: look.food, custom: id => (id === 'food-1' ? { ...bhel, kcal: 320 } : undefined) };
    expect(step({ kind: 'custom', customId: 'food-1', name: 'Bhel puri', count: 1, kcal: 300 }, 1, now)).toMatchObject({ count: 1.5, kcal: 480 });
  });
  it('turns from one meal to the next at 04:00, 11:00, 15:30 and 19:00', () => {
    expect([3 * 60 + 59, 4 * 60, 10 * 60 + 59, 11 * 60, 15 * 60 + 29, 15 * 60 + 30, 18 * 60 + 59, 19 * 60].map(slotAt))
      .toEqual(['dinner', 'breakfast', 'breakfast', 'lunch', 'lunch', 'snack', 'snack', 'dinner']);
  });
});
