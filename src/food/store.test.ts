import { beforeEach, describe, expect, it } from 'vitest';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { decode } from '@/store/transfer';
import type { CustomFood, MealRecord, SavedMeal } from './types';

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null,
  setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k),
  clear: () => local.clear(),
  key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;

const store = await import('@/store/useStore');
const food = await import('./store');
const { corrected, customFoodsIn, mealsIn, savedMealsIn } = await import('./records');

const AT = '2026-10-08T13:10:00.000+05:30';
const roti = { kind: 'food', foodId: 'roti', rev: 1, name: 'Roti', unit: 'piece', count: 2, gramsPerPortion: 40, kcal: 204, carbsG: 43.2, carbsLowG: 31.1, carbsHighG: 57 } as const;
const meal = (id: string, over: Partial<MealRecord> = {}): MealRecord =>
  ({ id, at: AT, day: '2026-10-08', meal: 'lunch', items: [roti], level: 'estimates', loggedAt: AT, edits: [], ...over });

async function booted() {
  await store.start({ factory: fakeIndexedDB(), broadcast: null });
}

beforeEach(() => {
  local.clear();
  store.resetForTests();
});

describe('saving a meal (journey §11.3, §4.5)', () => {
  it('saves one meal for a shaky double tap, not two (Review Focus 1)', async () => {
    await booted();
    const m = meal('meal-1');
    const [a, b] = await Promise.all([food.saveMeal(m), food.saveMeal(m)]);
    expect(a.ok && b.ok).toBe(true);
    expect(mealsIn(store.getState().records)).toEqual([m]);
  });

  it('saves a new usual meal and the person’s own foods with it, in one change', async () => {
    await booted();
    const own: CustomFood = { id: 'food-1', name: 'Bhel puri', per: { qty: 1, unit: 'plate' }, createdAt: AT, updatedAt: AT };
    const usual: SavedMeal = { id: 'usual-1', name: 'Bhel and roti', meal: 'lunch', items: [roti, { kind: 'custom', customId: 'food-1', name: 'Bhel puri', count: 1 }], savedAt: AT, updatedAt: AT };
    const m = meal('meal-1', { items: usual.items });
    expect((await food.saveMeal(m, { usual, customFoods: [own] })).ok).toBe(true);
    const records = store.getState().records;
    expect(mealsIn(records)).toEqual([m]);
    expect(savedMealsIn(records)).toEqual([usual]);
    expect(customFoodsIn(records)).toEqual([own]);
  });

  it('refuses the whole change when one record in it can’t be read, writing nothing', async () => {
    await booted();
    const broken = { id: 'usual-1', name: '', items: [roti], savedAt: AT, updatedAt: AT } as SavedMeal;
    const result = await food.saveMeal(meal('meal-1'), { usual: broken });
    expect(!result.ok && result.failure.code).toBe('invalid');
    expect(!result.ok && result.failure.message).toMatch(/usual meal 1: a usual meal needs a name/);
    expect(store.getState().records.meals).toEqual([]);
  });

  it('removes records in the same change, remembering each deletion, and passes over a key no longer there', async () => {
    await booted();
    await food.saveMeal(meal('meal-1'));
    expect((await store.writeRecords({ remove: { meals: ['meal-1', 'meal-gone'] } })).ok).toBe(true);
    expect(store.getState().records.meals).toEqual([]);
    expect(store.getState().settings.deleted?.records?.meals).toEqual(['meal-1']);
  });

  it('refuses a meal with nothing in it, and writes nothing', async () => {
    await booted();
    const result = await food.saveMeal(meal('meal-1', { items: [] }));
    expect(!result.ok && result.failure.code).toBe('invalid');
    expect(store.getState().records.meals).toEqual([]);
  });
});

describe('correcting, deleting and restoring (A-22, B-05)', () => {
  it('keeps the version a correction replaced, and moves the meal to the day it now belongs to (Review Focus 4)', async () => {
    await booted();
    const dinner = meal('meal-1', { at: '2026-10-07T23:30:00.000+05:30', day: '2026-10-07', meal: 'dinner' });
    await food.saveMeal(dinner);
    const later = corrected(dinner, { at: '2026-10-08T00:30:00.000+05:30', meal: 'dinner', items: dinner.items }, '2026-10-08T09:00:00.000+05:30');
    const own: CustomFood = { id: 'food-1', name: 'Bhel puri', per: { qty: 1, unit: 'plate' }, createdAt: AT, updatedAt: AT };
    expect((await food.saveCorrection(later, [own])).ok).toBe(true);
    expect(customFoodsIn(store.getState().records)).toEqual([own]);
    const kept = mealsIn(store.getState().records);
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ id: 'meal-1', day: '2026-10-08', editedAt: '2026-10-08T09:00:00.000+05:30' });
    expect(kept[0].edits).toEqual([{ replacedAt: '2026-10-08T09:00:00.000+05:30', at: dinner.at, meal: 'dinner', items: dinner.items }]);
  });

  it('deletes at once, remembers the deletion, and brings the meal back under a fresh id', async () => {
    await booted();
    const m = meal('meal-1');
    await food.saveMeal(m);
    expect((await food.deleteMeal('meal-1')).ok).toBe(true);
    expect(store.getState().settings.deleted?.records?.meals).toEqual(['meal-1']);
    const back = await food.restoreMeal(m);
    if (!back.ok) throw back.failure;
    expect(back.value).toMatchObject({ restoredFrom: 'meal-1', items: m.items });
    expect(back.value.id).not.toBe('meal-1');
    expect(mealsIn(store.getState().records).map(x => x.id)).toEqual([back.value.id]);
    // The original's deletion record stays, so an older backup can't bring it back beside its copy (B-05).
    expect(store.getState().settings.deleted?.records?.meals).toEqual(['meal-1']);
  });
});

describe('usual meals', () => {
  it('are removed at once and come back under a fresh id', async () => {
    await booted();
    const usual: SavedMeal = { id: 'usual-1', name: 'Weekday lunch', meal: 'lunch', items: [roti], savedAt: AT, updatedAt: AT };
    await food.saveMeal(meal('meal-1'), { usual });
    expect((await food.deleteUsual('usual-1')).ok).toBe(true);
    expect(savedMealsIn(store.getState().records)).toEqual([]);
    const back = await food.restoreUsual(usual);
    if (!back.ok) throw back.failure;
    expect(back.value).toMatchObject({ restoredFrom: 'usual-1', name: 'Weekday lunch' });
    expect(savedMealsIn(store.getState().records).map(u => u.id)).toEqual([back.value.id]);
    expect(back.value.id).toMatch(/^usual-/);
    expect(back.value.id).not.toBe('usual-1');
    expect(food.newMealId()).toMatch(/^meal-/);
    expect(food.newCustomId()).toMatch(/^food-/);
  });
});

describe('meals in backups (journey §18.3)', () => {
  it('go into a backup and come back from it, history included', async () => {
    await booted();
    const m = corrected(meal('meal-1'), { at: AT, meal: 'lunch', items: [{ ...roti, count: 3 }] }, '2026-10-08T14:00:00.000+05:30');
    await food.saveMeal(m);
    const exported = await store.exportRecord();
    if (!exported.ok) throw exported.failure;
    expect(exported.value.stores).toEqual(['meals', 'savedMeals', 'customFoods']);
    const doc = await decode(exported.value.bytes);
    expect((doc as { records: { meals: unknown[] } }).records.meals).toEqual([m]);
    store.resetForTests();
    local.clear();
    await booted();
    expect((await store.importRecord(doc, 'replace')).ok).toBe(true);
    expect(mealsIn(store.getState().records)).toEqual([m]);
  });

  it('refuses a file holding a meal it can’t read, unless the person allows it', async () => {
    await booted();
    await food.saveMeal(meal('meal-1'));
    const exported = await store.exportRecord();
    if (!exported.ok) throw exported.failure;
    const doc = (await decode(exported.value.bytes)) as { records: { meals: unknown[] } };
    const bad = { ...doc, records: { ...doc.records, meals: [...doc.records.meals, { id: 'meal-2', at: 'yesterday' }] } };
    expect((await store.importRecord(bad, 'merge')).ok).toBe(false);
    expect((await store.importRecord(bad, 'merge', { allowRejected: true })).ok).toBe(true);
    expect(mealsIn(store.getState().records).map(x => x.id)).toEqual(['meal-1']);
  });
});
