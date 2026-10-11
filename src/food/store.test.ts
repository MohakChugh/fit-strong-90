import { beforeEach, describe, expect, it } from 'vitest';
import { openDb } from '@/store/db';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { commitChange, readSnapshot } from '@/store/snapshot';
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
const { corrected, customFoodsIn, mealsIn, savedMealsIn, stored: asStored } = await import('./records');

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
    const usual: SavedMeal = { id: 'usual-1', name: 'Bhel and roti', meal: 'lunch', items: [roti, { kind: 'custom', customId: 'food-1', name: 'Bhel puri', count: 1, per: { qty: 1, unit: 'plate' }, basis: {}, version: AT }], savedAt: AT, updatedAt: AT };
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
    const own: CustomFood = { id: 'food-1', name: 'Bhel puri', per: { qty: 1, unit: 'plate' }, createdAt: AT, updatedAt: AT };
    expect((await food.saveCorrection(dinner, { at: '2026-10-08T00:30:00.000+05:30', meal: 'dinner', items: dinner.items }, '2026-10-08T09:00:00.000+05:30', { customFoods: [own] })).ok).toBe(true);
    expect(customFoodsIn(store.getState().records)).toEqual([own]);
    const kept = mealsIn(store.getState().records);
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ id: 'meal-1', day: '2026-10-08', editedAt: '2026-10-08T09:00:00.000+05:30' });
    expect(kept[0].edits).toEqual([{ replacedAt: '2026-10-08T09:00:00.000+05:30', at: dinner.at, meal: 'dinner', items: dinner.items }]);
  });

  it('corrects the meal as stored now, refusing one corrected or deleted since the sheet opened it (H7-08; board D135)', async () => {
    await booted();
    const m = meal('meal-1');
    await food.saveMeal(m);
    const first = await food.saveCorrection(m, { at: AT, meal: 'dinner', items: m.items }, '2026-10-08T14:00:00.000+05:30');
    expect(first.ok).toBe(true);
    const now = mealsIn(store.getState().records)[0];
    // The same old version again: refused, in the caller's words, and the first correction stands.
    const stale = await food.saveCorrection(m, { at: AT, meal: 'lunch', items: [{ ...roti, count: 3 }] }, '2026-10-08T14:05:00.000+05:30', { describe: c => `now ${c?.meal}` });
    expect(!stale.ok && [stale.failure.code, stale.failure.message]).toEqual(['conflict', 'now dinner']);
    expect(mealsIn(store.getState().records)).toEqual([now]);
    // The version it now is: corrected, keeping both earlier versions.
    expect((await food.saveCorrection(now, { at: AT, meal: 'snack', items: m.items }, '2026-10-08T14:10:00.000+05:30')).ok).toBe(true);
    expect(mealsIn(store.getState().records)[0].edits.map(e => e.meal)).toEqual(['lunch', 'dinner']);
    // Deleted since: refused, and its deletion record kept.
    await food.deleteMeal('meal-1');
    const gone = await food.saveCorrection(mealsIn(store.getState().records)[0] ?? now, { at: AT, meal: 'lunch', items: m.items }, '2026-10-08T14:20:00.000+05:30');
    expect(!gone.ok && gone.failure.code).toBe('conflict');
    expect(mealsIn(store.getState().records)).toEqual([]);
    expect(store.getState().settings.deleted?.records?.meals).toEqual(['meal-1']);
  });

  it('refuses a correction of a copy stored since with the same times but other contents, as a merge may bring (H7-08)', async () => {
    await booted();
    const m = meal('meal-1');
    await food.saveMeal(m);
    const merged = { ...m, items: [{ ...roti, count: 3 }] };
    await store.writeRecords({ put: { meals: [merged] } });
    const result = await food.saveCorrection(m, { at: AT, meal: 'dinner', items: m.items }, '2026-10-08T14:00:00.000+05:30');
    expect(!result.ok && result.failure.code).toBe('conflict');
    expect(mealsIn(store.getState().records)).toEqual([merged]);
  });

  it('is planned against what the screen shows, a delete still waiting to be written included: nothing comes back, even for a moment (H7-08)', async () => {
    await booted();
    const m = meal('meal-1');
    await food.saveMeal(m);
    const deleting = food.deleteMeal('meal-1');
    const correcting = food.saveCorrection(m, { at: AT, meal: 'dinner', items: m.items }, '2026-10-08T14:00:00.000+05:30');
    expect(mealsIn(store.getState().records)).toEqual([]);
    expect((await deleting).ok).toBe(true);
    expect((await correcting).ok).toBe(false);
    expect(mealsIn(store.getState().records)).toEqual([]);
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

  it('reads a restore made on another device as the same meal: the original here takes its deletion, the copy counts once (H7-11; board D136)', async () => {
    await booted();
    const m = meal('meal-1');
    await food.saveMeal(m);
    const exported = await store.exportRecord();
    if (!exported.ok) throw exported.failure;
    // On the other device: deleted, restored under a fresh id with its deletion record kept, then backed up.
    const doc = (await decode(exported.value.bytes)) as { records: { meals: unknown[] }; settings: { deleted?: unknown } };
    const back = { ...m, id: 'meal-2', restoredFrom: 'meal-1' };
    // And one restored there from a meal this phone never had: just a meal.
    const other = { ...m, id: 'meal-3', restoredFrom: 'meal-9' };
    const file = { ...doc, records: { ...doc.records, meals: [back, other] }, settings: { ...doc.settings, deleted: { records: { meals: ['meal-1', 'meal-9'] } } } };
    const preview = store.previewRecord(file);
    expect(preview.ok && preview.restoredHere).toBe(1);
    expect((await store.importRecord(file, 'merge')).ok).toBe(true);
    expect(mealsIn(store.getState().records)).toEqual([back, other]);
    expect(store.getState().settings.deleted?.records?.meals).toEqual(['meal-1', 'meal-9']);
    // Merged again: nothing changes, and nothing comes back.
    expect((await store.importRecord(file, 'merge')).ok).toBe(true);
    expect(mealsIn(store.getState().records)).toEqual([back, other]);
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

/**
 * Rows as a device on 610d832 (Plan 7 before own-food snapshots) holds them, written there by that build's own
 * saveMeal, saveCorrection and stepper (H7R-01): lemon rice logged once and as a usual meal of two, sprouts stepped to
 * 1½, kheer (no figures) only in a breakfast's earlier version, and laddoo, whose own food has since gone.
 */
const PRE_SNAPSHOT = {
  meals: [
    { id: 'meal-breakfast', at: '2026-10-06T08:30:00.000+05:30', day: '2026-10-06', meal: 'breakfast', items: [{ kind: 'food', foodId: 'roti', rev: 1, name: 'Roti (whole-wheat)', unit: 'piece', count: 1, gramsPerPortion: 40, kcal: 102, carbsG: 21.6, carbsLowG: 15.6, carbsHighG: 28.5 }], level: 'meals', loggedAt: '2026-10-06T08:30:00.000+05:30', edits: [{ replacedAt: '2026-10-06T09:00:00.000+05:30', at: '2026-10-06T08:30:00.000+05:30', meal: 'breakfast', items: [{ kind: 'custom', customId: 'food-kheer', name: 'Kheer', count: 2 }] }], editedAt: '2026-10-06T09:00:00.000+05:30' },
    { id: 'meal-dinner', at: '2026-10-05T20:30:00.000+05:30', day: '2026-10-05', meal: 'dinner', items: [{ kind: 'custom', customId: 'food-sprouts', name: 'Sprout salad', count: 1.5, kcal: 212 }], level: 'estimates', loggedAt: '2026-10-05T20:30:00.000+05:30', edits: [] },
    { id: 'meal-lunch', at: '2026-10-05T13:10:00.000+05:30', day: '2026-10-05', meal: 'lunch', items: [{ kind: 'custom', customId: 'food-lemon', name: 'Lemon rice', count: 1, kcal: 333, carbsG: 52.5 }, { kind: 'food', foodId: 'roti', rev: 1, name: 'Roti (whole-wheat)', unit: 'piece', count: 1, gramsPerPortion: 40, kcal: 102, carbsG: 21.6, carbsLowG: 15.6, carbsHighG: 28.5 }], level: 'estimates', loggedAt: '2026-10-05T13:10:00.000+05:30', edits: [] },
    { id: 'meal-lunch-2', at: '2026-10-07T13:00:00.000+05:30', day: '2026-10-07', meal: 'lunch', items: [{ kind: 'custom', customId: 'food-lemon', name: 'Lemon rice', count: 2, kcal: 666, carbsG: 105 }, { kind: 'custom', customId: 'food-kheer', name: 'Kheer', count: 1 }], level: 'estimates', loggedAt: '2026-10-07T13:00:00.000+05:30', edits: [] },
    { id: 'meal-snack', at: '2026-10-06T16:45:00.000+05:30', day: '2026-10-06', meal: 'snack', items: [{ kind: 'custom', customId: 'food-laddoo', name: 'Besan laddoo', count: 1.5, kcal: 281, carbsG: 32 }], level: 'estimates', loggedAt: '2026-10-06T16:45:00.000+05:30', edits: [] },
  ],
  savedMeals: [
    { id: 'usual-1', name: 'Sunday lunch', meal: 'lunch', items: [{ kind: 'custom', customId: 'food-lemon', name: 'Lemon rice', count: 2, kcal: 666, carbsG: 105 }, { kind: 'custom', customId: 'food-kheer', name: 'Kheer', count: 1 }], savedAt: '2026-10-05T13:10:00.000+05:30', updatedAt: '2026-10-05T13:10:00.000+05:30' },
  ],
  customFoods: [
    { id: 'food-kheer', name: 'Kheer', per: { qty: 1, unit: 'katori' }, createdAt: '2026-10-05T13:10:00.000+05:30', updatedAt: '2026-10-05T13:10:00.000+05:30' },
    { id: 'food-lemon', name: 'Lemon rice', per: { qty: 1, unit: 'plate' }, kcal: 333, carbsG: 52.5, allergens: ['peanut'], createdAt: '2026-10-05T13:10:00.000+05:30', updatedAt: '2026-10-05T13:10:00.000+05:30' },
    { id: 'food-sprouts', name: 'Sprout salad', per: { qty: 1, unit: 'bowl' }, kcal: 141, createdAt: '2026-10-05T13:10:00.000+05:30', updatedAt: '2026-10-05T13:10:00.000+05:30' },
  ],
};

describe('own foods logged before snapshots (H7R-01; board D146)', () => {
  const T = '2026-10-05T13:10:00.000+05:30';
  const plate = { per: { qty: 1, unit: 'plate' }, basis: { kcal: 333, carbsG: 52.5 }, version: T };
  const katori = { per: { qty: 1, unit: 'katori' }, basis: {}, version: T };
  /** The pre-snapshot rows, put straight into the database as that build left them. */
  async function preSnapshotPhone(fake: ReturnType<typeof fakeIndexedDB>) {
    await store.start({ factory: fake, broadcast: null });
    const tab = await openDb(fake);
    const put = await commitChange(tab, undefined, () => ({
      change: { records: { meals: { put: PRE_SNAPSHOT.meals }, savedMeals: { put: PRE_SNAPSHOT.savedMeals }, customFoods: { put: PRE_SNAPSHOT.customFoods } } },
    }));
    tab.close();
    expect(put.ok).toBe(true);
    store.resetForTests();
  }
  const stored = async (fake: ReturnType<typeof fakeIndexedDB>) => {
    const db = await openDb(fake);
    const snap = await readSnapshot(db);
    db.close();
    return snap;
  };

  it('keeps every meal and usual meal, each item given its snapshot from its own food, once', async () => {
    const fake = fakeIndexedDB();
    await preSnapshotPhone(fake);
    await store.start({ factory: fake, broadcast: null });
    const records = store.getState().records;
    const meals = mealsIn(records);
    expect(meals.map(m => m.id)).toEqual(['meal-breakfast', 'meal-dinner', 'meal-lunch', 'meal-lunch-2', 'meal-snack']);
    const byId = (id: string) => meals.find(m => m.id === id)!;
    expect(byId('meal-lunch').items[0]).toEqual({ kind: 'custom', customId: 'food-lemon', name: 'Lemon rice', count: 1, kcal: 333, carbsG: 52.5, ...plate });
    expect(byId('meal-lunch').items[1]).toEqual(PRE_SNAPSHOT.meals[2].items[1]);
    expect(byId('meal-dinner').items).toEqual([{ kind: 'custom', customId: 'food-sprouts', name: 'Sprout salad', count: 1.5, kcal: 212, per: { qty: 1, unit: 'bowl' }, basis: { kcal: 141 }, version: T }]);
    // Only in an earlier version, and with no figures: given its snapshot all the same.
    expect(byId('meal-breakfast').edits[0].items).toEqual([{ kind: 'custom', customId: 'food-kheer', name: 'Kheer', count: 2, ...katori }]);
    // Its own food gone: kept by its name and count, with nothing known of it ("No estimate"), never dropped.
    expect(byId('meal-snack').items).toEqual([{ kind: 'custom', customId: 'food-laddoo', name: 'Besan laddoo', count: 1.5 }]);
    expect(savedMealsIn(records).map(u => u.items)).toEqual([[
      { kind: 'custom', customId: 'food-lemon', name: 'Lemon rice', count: 2, kcal: 666, carbsG: 105, ...plate },
      { kind: 'custom', customId: 'food-kheer', name: 'Kheer', count: 1, ...katori },
    ]]);
    // Written, not just read so: what's stored is what's shown, and the next start writes nothing.
    expect((await stored(fake)).records).toEqual(records);
    const revision = store.getState().revision;
    store.resetForTests();
    await store.start({ factory: fake, broadcast: null });
    expect(store.getState().revision).toBe(revision);
    expect(mealsIn(store.getState().records)).toEqual(meals);
  });

  it('writes them in one transaction: refused part-way, every row stays as it was, and the next start does it', async () => {
    let refuse = false;
    const fake = fakeIndexedDB({ failWrite: (s: string) => (refuse && s === 'savedMeals' ? new DOMException('The operation failed.', 'QuotaExceededError') : undefined) });
    await preSnapshotPhone(fake);
    refuse = true;
    await store.start({ factory: fake, broadcast: null });
    expect(store.getState().status).toBe('ready');
    expect((await stored(fake)).records.meals).toEqual(PRE_SNAPSHOT.meals);
    // Read all the same while it can't be written (H7R-01): every meal and the usual meal, as they'll be stored.
    expect(mealsIn(store.getState().records)).toHaveLength(5);
    expect(savedMealsIn(store.getState().records)).toHaveLength(1);
    expect(mealsIn(store.getState().records).find(m => m.id === 'meal-snack')?.items).toEqual([{ kind: 'custom', customId: 'food-laddoo', name: 'Besan laddoo', count: 1.5 }]);
    // A save meanwhile writes its own meal only; the rest are written once a start can.
    expect((await food.saveMeal(meal('meal-new'))).ok).toBe(true);
    expect((await stored(fake)).records.meals.find(r => r.id === 'meal-lunch')).toEqual(PRE_SNAPSHOT.meals.find(r => r.id === 'meal-lunch'));
    expect(mealsIn(store.getState().records)).toHaveLength(6);
    refuse = false;
    store.resetForTests();
    await store.start({ factory: fake, broadcast: null });
    expect(mealsIn(store.getState().records)).toHaveLength(6);
    expect(savedMealsIn(store.getState().records)).toHaveLength(1);
    expect((await stored(fake)).records.meals.find(r => r.id === 'meal-lunch')?.items).toEqual(mealsIn(store.getState().records).find(m => m.id === 'meal-lunch')?.items);
  });

  it('keeps a meal held with equal carb ends from before D149, the item with no carb estimate and all else as it was (H7F-03; board D207)', async () => {
    const fake = fakeIndexedDB();
    await store.start({ factory: fake, broadcast: null });
    const flat = { ...roti, carbsG: 40, carbsLowG: 40, carbsHighG: 40 };
    const { carbsG, carbsLowG, carbsHighG, ...noCarbs } = flat;
    void carbsG; void carbsLowG; void carbsHighG;
    const held = meal('meal-flat', { items: [flat, roti], editedAt: AT, edits: [{ replacedAt: AT, at: AT, meal: 'lunch', items: [flat] }] });
    const usual = { id: 'usual-flat', name: 'Lunch', meal: 'lunch', items: [flat], savedAt: AT, updatedAt: AT };
    // A tiny weighed portion's ends may meet under 1 g: that's a reading ("under 1 g carbs"), and it stays.
    const tiny = { ...roti, count: 1, gramsPerPortion: 1, weighed: true as const, kcal: 3, carbsG: 0.5, carbsLowG: 0.5, carbsHighG: 0.5 };
    const tab = await openDb(fake);
    expect((await commitChange(tab, undefined, () => ({ change: { records: { meals: { put: [asStored(held), asStored(meal('meal-ok', { items: [tiny] })), asStored(meal('meal-bad', { items: [{ ...flat, carbsG: 30 }] }))] }, savedMeals: { put: [usual] } } } }))).ok).toBe(true);
    tab.close();
    store.resetForTests();
    await store.start({ factory: fake, broadcast: null });
    const meals = mealsIn(store.getState().records);
    // One never valid, its estimate outside its own range, isn't quietly put right: it stays as stored, unread.
    expect(meals.map(m => m.id)).toEqual(['meal-flat', 'meal-ok']);
    expect((await stored(fake)).records.meals.find(r => r.id === 'meal-bad')?.items).toEqual([{ ...flat, carbsG: 30 }]);
    expect(meals[0].items).toEqual([noCarbs, roti]);
    expect(meals[0].edits[0].items).toEqual([noCarbs]);
    expect(meals[1]).toEqual(meal('meal-ok', { items: [tiny] }));
    expect(savedMealsIn(store.getState().records)[0].items).toEqual([noCarbs]);
    // Written once: what's stored reads the same.
    expect((await stored(fake)).records.meals.find(r => r.id === 'meal-flat')?.items).toEqual([noCarbs, roti]);
  });

  it('takes a backup made before snapshots whole, each item given its snapshot from the file’s own food, else this phone’s', async () => {
    await booted();
    const file = (stores: string[]) => ({
      format: 'fit-strong-health-record', version: 1, exportedAt: T, schemaVersion: 6, observations: [], sessions: [], checkIns: [], personalRecords: [], bodyMetrics: [],
      focusOverrides: {}, contentState: [], stores,
      records: Object.fromEntries(stores.map(s => [s, PRE_SNAPSHOT[s as keyof typeof PRE_SNAPSHOT]])),
    });
    const whole = file(['meals', 'savedMeals', 'customFoods']);
    const preview = store.previewRecord(whole);
    expect(preview.ok && preview.rejected).toMatchObject({ meals: 0, savedMeals: 0, customFoods: 0 });
    expect((await store.importRecord(whole, 'merge')).ok).toBe(true);
    const lunch = mealsIn(store.getState().records).find(m => m.id === 'meal-lunch')!;
    expect(lunch.items[0]).toEqual({ kind: 'custom', customId: 'food-lemon', name: 'Lemon rice', count: 1, kcal: 333, carbsG: 52.5, ...plate });
    expect(mealsIn(store.getState().records).find(m => m.id === 'meal-snack')!.items).toEqual([{ kind: 'custom', customId: 'food-laddoo', name: 'Besan laddoo', count: 1.5 }]);
    // Merged again, nothing differs: the file's rows read as this phone's now are.
    const again = store.previewRecord(whole);
    expect(again.ok && again.conflicts).toMatchObject({ meals: 0, savedMeals: 0, customFoods: 0 });

    // Meals alone, on a phone that holds the foods: from this phone's.
    store.resetForTests();
    local.clear();
    await booted();
    expect((await store.writeRecords({ put: { customFoods: PRE_SNAPSHOT.customFoods } })).ok).toBe(true);
    const mealsOnly = file(['meals']);
    expect((await store.importRecord(mealsOnly, 'merge')).ok).toBe(true);
    expect(mealsIn(store.getState().records).find(m => m.id === 'meal-dinner')!.items[0]).toMatchObject({ per: { qty: 1, unit: 'bowl' }, basis: { kcal: 141 }, kcal: 212 });
  });
});
