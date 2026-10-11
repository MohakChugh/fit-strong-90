import { describe, expect, it } from 'vitest';
import { openDraft } from './draft';
import { foodItem } from './estimate';
import type { Lookup } from './tray';
import type { Food, FoodItem, MealRecord, SavedMeal } from './types';

const NOW = '2026-10-08T13:20:00.000+05:30';
const roti = { id: 'roti', rev: 2, name: 'Roti', portion: { unit: 'piece', grams: 40, count: 1, noun: ['roti', 'rotis'] }, per100g: { kcal: 255, carbsG: 54, carbsLowG: 48.6, carbsHighG: 59.4 } } as Food;
const look: Lookup = { food: id => (id === 'roti' ? roti : undefined), custom: () => undefined };
const logged: FoodItem = { kind: 'food', foodId: 'roti', rev: 1, name: 'Roti', unit: 'piece', count: 2, gramsPerPortion: 40, kcal: 210, carbsG: 44 };
const yesterday: MealRecord = { id: 'meal-1', at: '2026-10-07T13:10:00.000+05:30', day: '2026-10-07', meal: 'lunch', items: [logged], level: 'meals', loggedAt: '2026-10-07T13:15:00.000+05:30', edits: [] };
const usual: SavedMeal = { id: 'usual-1', name: 'Roti breakfast', meal: 'breakfast', items: [logged], savedAt: NOW, updatedAt: NOW };
const ctx = { now: NOW, meals: [yesterday], saved: [usual], look };

describe('what "Log a meal" opens with (journey §11.3)', () => {
  it('the meal the time suggests, with nothing in it', () => {
    expect(openDraft({}, ctx)).toEqual({ slot: 'lunch', items: [], page: { kind: 'tray' } });
    expect(openDraft({ meal: 'dinner' }, ctx).slot).toBe('dinner');
  });
  it('yesterday’s meal, its items worked out again from the table as it is now (B-12)', () => {
    expect(openDraft({ usual: 'yesterday:meal-1' }, ctx)).toEqual({ slot: 'lunch', items: [foodItem(roti, 2)], page: { kind: 'tray' } });
  });
  it('a usual meal, on the meal it was saved for', () => {
    expect(openDraft({ usual: 'saved:usual-1' }, ctx)).toMatchObject({ slot: 'breakfast', items: [foodItem(roti, 2)] });
    expect(openDraft({ usual: 'saved:nope' }, ctx)).toMatchObject({ slot: 'lunch', items: [] });
  });
  it('a logged meal to correct, at its own time, or says it’s gone', () => {
    expect(openDraft({ edit: 'meal-1' }, ctx)).toEqual({ slot: 'lunch', items: [logged], at: yesterday.at, editing: yesterday, page: { kind: 'tray' } });
    expect(openDraft({ edit: 'nope' }, ctx)).toMatchObject({ gone: true, items: [] });
  });
  it('a past day’s meal at that meal’s usual hour, in this phone’s offset; today is no past day', () => {
    expect(openDraft({ day: '2026-10-05', meal: 'dinner' }, ctx).at).toBe('2026-10-05T20:30:00.000+05:30');
    expect(openDraft({ day: '2026-10-08' }, ctx).at).toBeUndefined();
  });
  it('a food’s portion page, or Quick add', () => {
    expect(openDraft({ food: 'roti' }, ctx).page).toEqual({ kind: 'portion', foodId: 'roti' });
    expect(openDraft({ food: 'nope' }, ctx).page).toEqual({ kind: 'tray' });
    expect(openDraft({ quick: true }, ctx).page).toEqual({ kind: 'quick' });
  });
});

describe('what "Log a meal" opens with: the other rules (mutation-checked)', () => {
  const dinner: MealRecord = { ...yesterday, id: 'meal-2', at: '2026-10-07T20:40:00.000+05:30', meal: 'dinner' };
  it('opens yesterday’s meal on its own meal, unless the address names one', () => {
    expect(openDraft({ usual: 'yesterday:meal-2' }, { ...ctx, meals: [dinner] }).slot).toBe('dinner');
    expect(openDraft({ usual: 'yesterday:meal-2', meal: 'snack' }, { ...ctx, meals: [dinner] }).slot).toBe('snack');
    expect(openDraft({ usual: 'saved:usual-1', meal: 'snack' }, ctx).slot).toBe('snack');
    expect(openDraft({ usual: 'nonsense' }, ctx)).toMatchObject({ slot: 'lunch', items: [] });
  });
  it('reads the minutes too: 15:40 is a snack', () => {
    expect(openDraft({}, { ...ctx, now: '2026-10-08T15:40:00.000+05:30' }).slot).toBe('snack');
  });
  it('writes a past day’s time in the clock’s own offset, UTC included', () => {
    expect(openDraft({ day: '2026-10-05' }, { ...ctx, now: '2026-10-08T07:50:00.000Z' }).at).toBe('2026-10-05T08:30:00.000Z');
  });
});
