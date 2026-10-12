import { describe, expect, it } from 'vitest';
import type { FoodItem, MealRecord, SavedMeal } from './types';
import { usualFor, usualSlot } from './usual';

const roti: FoodItem = { kind: 'food', foodId: 'roti', rev: 1, name: 'Roti', unit: 'piece', count: 2, gramsPerPortion: 40 };
const dal: FoodItem = { kind: 'food', foodId: 'toor-dal', rev: 1, name: 'Toor dal', unit: 'katori', count: 1, gramsPerPortion: 150 };
const lunch = (id: string, at: string, items = [roti, dal]): MealRecord => ({ id, at, day: at.slice(0, 10), meal: 'lunch', items, level: 'meals', loggedAt: at, edits: [] });
const usual = (id: string, updatedAt: string, meal?: SavedMeal['meal']): SavedMeal => ({ id, name: `Usual ${id}`, ...(meal ? { meal } : {}), items: [dal], savedAt: updatedAt, updatedAt });

describe('Your usual (journey §11.3, B-10)', () => {
  it('starts with the same meal yesterday, the latest one if there were two', () => {
    const meals = [lunch('a', '2026-10-07T12:30:00.000+05:30', [dal]), lunch('b', '2026-10-07T13:10:00.000+05:30')];
    expect(usualFor('lunch', '2026-10-08', meals, [])).toEqual([
      { key: 'yesterday:b', label: 'Same as yesterday’s lunch', detail: 'Roti ×2 · Toor dal', meal: 'lunch', items: [roti, dal] },
    ]);
  });
  it('then the usual meals for that meal, or for any meal, newest first, three at most', () => {
    const saved = [usual('1', '2026-10-01T09:00:00.000+05:30', 'lunch'), usual('2', '2026-10-05T09:00:00.000+05:30'), usual('3', '2026-10-06T09:00:00.000+05:30', 'dinner'), usual('4', '2026-10-03T09:00:00.000+05:30', 'lunch')];
    const meals = [lunch('b', '2026-10-07T13:10:00.000+05:30')];
    expect(usualFor('lunch', '2026-10-08', meals, saved).map(u => u.key)).toEqual(['yesterday:b', 'saved:2', 'saved:4']);
  });
  it('offers nothing from the day before yesterday', () => {
    expect(usualFor('lunch', '2026-10-08', [lunch('a', '2026-10-06T13:10:00.000+05:30')], [])).toEqual([]);
  });
});

describe('Your usual’s other rules (mutation-checked)', () => {
  it('offers yesterday’s same meal only, never another one', () => {
    const dinner: MealRecord = { ...lunch('d', '2026-10-07T20:30:00.000+05:30'), meal: 'dinner' };
    expect(usualFor('lunch', '2026-10-08', [dinner], [])).toEqual([]);
    expect(usualFor('dinner', '2026-10-08', [dinner], []).map(u => [u.key, u.meal, u.label])).toEqual([['yesterday:d', 'dinner', 'Same as yesterday’s dinner']]);
  });
  it('offers a usual meal for the meal asked about, with its own name and items', () => {
    expect(usualFor('breakfast', '2026-10-08', [], [usual('2', '2026-10-05T09:00:00.000+05:30')])).toEqual([
      { key: 'saved:2', label: 'Usual 2', detail: 'Toor dal', meal: 'breakfast', items: [dal] },
    ]);
  });
});

describe('usualSlot: the meal usual meals are for (K7-07; board D139)', () => {
  const at = (h: number, m = 0) => h * 60 + m;
  it('is the latest main meal whose time has come and that isn’t logged yet', () => {
    expect(usualSlot('snack', at(16), [{ meal: 'breakfast' }])).toBe('lunch');
    expect(usualSlot('dinner', at(21), [{ meal: 'lunch' }])).toBe('dinner');
    expect(usualSlot('breakfast', at(9), [])).toBe('breakfast');
    expect(usualSlot('snack', at(16), [])).toBe('lunch');
  });
  it('never goes back past a main meal logged since: a skipped breakfast stays skipped once lunch is in (K7R-05)', () => {
    expect(usualSlot('snack', at(16), [{ meal: 'lunch' }])).toBe('snack');
    expect(usualSlot('lunch', at(13, 30), [{ meal: 'lunch' }])).toBe('lunch');
    expect(usualSlot('dinner', at(21), [{ meal: 'dinner' }])).toBe('dinner');
    expect(usualSlot('dinner', at(21), [{ meal: 'breakfast' }, { meal: 'snack' }])).toBe('dinner');
    expect(usualSlot('snack', at(17), [{ meal: 'snack' }])).toBe('lunch');
  });
  it('takes each meal’s time from the clock’s own turns: dinner at 19:00, breakfast at 04:00', () => {
    expect(usualSlot('snack', at(18, 59), [{ meal: 'lunch' }])).toBe('snack');
    expect(usualSlot('dinner', at(19), [{ meal: 'lunch' }])).toBe('dinner');
    expect(usualSlot('dinner', at(3, 59), [])).toBe('dinner');
    expect(usualSlot('breakfast', at(4), [])).toBe('breakfast');
  });
  it('is the clock’s meal once each main meal so far is logged, or before any has come', () => {
    expect(usualSlot('snack', at(16), [{ meal: 'breakfast' }, { meal: 'lunch' }])).toBe('snack');
    expect(usualSlot('dinner', at(2), [])).toBe('dinner');
    expect(usualSlot('lunch', at(11), [{ meal: 'breakfast' }])).toBe('lunch');
    expect(usualSlot('breakfast', at(10, 59), [{ meal: 'breakfast' }])).toBe('breakfast');
  });
});
