import { describe, expect, it } from 'vitest';
import { customItem, foodItem } from './estimate';
import { addFood, moreFits, step, slotAt, weighed, withCount, type Lookup } from './tray';
import type { CustomFood, Food, FoodItem } from './types';

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

describe('“More”, only as far as the store keeps an item (H7-12)', () => {
  it('stops at 20, and short of what one item can hold, for a table food, a weighed one and your own food', () => {
    expect(moreFits(foodItem(roti, 19), look)).toBe(true);
    expect(moreFits(foodItem(roti, 20), look)).toBe(false);
    // A kilo of roti is 2,550 kcal: three of them 7,650, four 10,200, more than one item holds.
    expect(moreFits(foodItem(roti, 2, 1000, true), look)).toBe(true);
    expect(moreFits(foodItem(roti, 3, 1000, true), look)).toBe(false);
    const big: CustomFood = { id: 'food-1', name: 'Feast', per: { qty: 1, unit: 'plate' }, kcal: 5000, createdAt: '2026-10-08T09:00:00.000+05:30', updatedAt: '2026-10-08T09:00:00.000+05:30' };
    expect(moreFits(customItem(big, 1.5), look)).toBe(true);
    expect(moreFits(customItem(big, 2), look)).toBe(false);
    expect(moreFits({ kind: 'quick', size: 'large', name: 'Large plate', kcal: 900 }, look)).toBe(false);
  });
});

describe('the tray’s other rules (mutation-checked)', () => {
  const bhel: CustomFood = { id: 'food-1', name: 'Bhel puri', per: { qty: 1, unit: 'plate' }, kcal: 300, createdAt: '2026-10-08T09:00:00.000+05:30', updatedAt: '2026-10-08T09:00:00.000+05:30' };
  const withBhel: Lookup = { food: look.food, custom: id => (id === 'food-1' ? bhel : undefined) };
  it('steps the person’s own food by half a portion, from what it was logged as holding', () => {
    expect(step(customItem(bhel), 1, withBhel)).toEqual({ ...customItem(bhel), count: 1.5, kcal: 450 });
    // Gone from the person's foods: its own snapshot is scaled all the same.
    const kachori = customItem({ ...bhel, id: 'food-9', name: 'Kachori', kcal: 200, carbsG: 25 });
    expect(withCount(kachori, 2, look)).toEqual({ ...kachori, count: 2, kcal: 400, carbsG: 50 });
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
  it('keeps a snapshot of your own food: one portion, what it holds, and which version (H7-09; board D134)', () => {
    expect(customItem({ ...bhel, carbsG: 40 })).toEqual({
      kind: 'custom', customId: 'food-1', name: 'Bhel puri', count: 1, per: { qty: 1, unit: 'plate' }, basis: { kcal: 300, carbsG: 40 }, version: bhel.updatedAt, kcal: 300, carbsG: 40,
    });
    expect(customItem({ ...bhel, kcal: undefined })).toEqual({ kind: 'custom', customId: 'food-1', name: 'Bhel puri', count: 1, per: { qty: 1, unit: 'plate' }, basis: {}, version: bhel.updatedAt });
    // The version is when the food was last changed.
    expect(customItem({ ...bhel, updatedAt: '2026-10-08T10:00:00.000+05:30' }).version).toBe('2026-10-08T10:00:00.000+05:30');
  });
  it('scales that snapshot, never a newer version of the food: more is never less (H7-09; board D134)', () => {
    // Logged as one plate, 300 kcal; since redefined (a merge) as 100 g, 150 kcal.
    const now: Lookup = { food: look.food, custom: id => (id === 'food-1' ? { ...bhel, per: { qty: 100, unit: 'g' }, kcal: 150, updatedAt: '2026-10-09T09:00:00.000+05:30' } : undefined) };
    const logged = customItem(bhel);
    expect(step(logged, 1, now)).toEqual({ ...logged, count: 1.5, kcal: 450 });
    expect(withCount(logged, 2, now)).toEqual({ ...logged, count: 2, kcal: 600 });
  });
  it('turns from one meal to the next at 04:00, 11:00, 15:30 and 19:00', () => {
    expect([3 * 60 + 59, 4 * 60, 10 * 60 + 59, 11 * 60, 15 * 60 + 29, 15 * 60 + 30, 18 * 60 + 59, 19 * 60].map(slotAt))
      .toEqual(['dinner', 'breakfast', 'breakfast', 'lunch', 'lunch', 'snack', 'snack', 'dinner']);
  });
});
