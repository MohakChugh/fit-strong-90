import { describe, expect, it } from 'vitest';
import { RECORD_RULES, recordProblem } from '@/store/records';
import { emptySnapshot } from '@/store/snapshot';
import { planImport, previewImport, TRANSFER_FORMAT } from '@/store/transfer';
import type { CustomFood, MealEdit, MealRecord, SavedMeal } from './types';
import {
  corrected, customFoodProblem, itemProblem, mealProblem, mealsIn, newerByUpdate, newerMeal, restored, savedMealProblem, stored,
  upgradedItem, withSnapshots,
} from './records';

const AT = '2026-10-08T13:10:00.000+05:30';
const roti = { kind: 'food', foodId: 'roti', rev: 1, name: 'Roti', unit: 'piece', count: 2, gramsPerPortion: 40, kcal: 204, carbsG: 43.2, carbsLowG: 31.1, carbsHighG: 57 } as const;
const base: MealRecord = { id: 'meal-1', at: AT, day: '2026-10-08', meal: 'lunch', items: [roti], level: 'estimates', loggedAt: AT, edits: [] };
const meal = (over: Record<string, unknown> = {}) => ({ ...stored(base), ...over });

describe('a meal record (journey §18.2, B-12)', () => {
  it('keeps each item with its recipe revision, unit, grams and estimate (D104)', () => {
    expect(mealProblem(meal())).toBeUndefined();
    expect(recordProblem('meals', meal())).toBeUndefined();
  });
  it('refuses what a meal could not hold', () => {
    const bad = (over: Record<string, unknown>) => mealProblem(meal(over));
    expect(bad({ at: '2026-10-08 13:10' })).toMatch(/when it was eaten/);
    expect(bad({ day: '2026-10-07' })).toMatch(/day/);
    expect(bad({ meal: 'brunch' })).toMatch(/breakfast, lunch/);
    expect(bad({ level: 'ideas' })).toMatch(/level/);
    expect(bad({ items: [] })).toMatch(/between 1 and 40/);
    expect(bad({ items: [{ ...roti, rev: 0 }] })).toMatch(/recipe/);
    expect(bad({ items: [{ ...roti, count: 0.3 }] })).toMatch(/portion/);
    expect(bad({ items: [{ ...roti, unit: 'bucket' }] })).toMatch(/portion/);
    expect(bad({ items: [{ ...roti, carbsLowG: 50 }] })).toMatch(/range/);
    expect(bad({ items: [{ kind: 'quick', size: 'small', name: 'Small plate', carbsG: 30 }] })).toMatch(/never has carbs/);
    expect(bad({ items: [{ kind: 'mystery', name: 'X' }] })).toMatch(/kind/);
    expect(bad({ edits: [{ replacedAt: AT, at: AT, meal: 'lunch', items: [roti] }] })).toMatch(/when it was corrected/);
  });
  it('reads a carb estimate and its range as one set: all three, in order, or none (H7-06)', () => {
    const { carbsG, carbsLowG, carbsHighG, ...bare } = roti;
    void carbsG; void carbsLowG; void carbsHighG;
    expect(itemProblem(bare)).toBeUndefined();
    expect(itemProblem({ ...bare, carbsG: 40, carbsLowG: 60 })).toMatch(/carb range/);
    expect(itemProblem({ ...bare, carbsG: 40, carbsHighG: 50 })).toMatch(/carb range/);
    expect(itemProblem({ ...bare, carbsG: 40 })).toMatch(/carb range/);
    expect(itemProblem({ ...bare, carbsLowG: 30, carbsHighG: 50 })).toMatch(/carb range/);
    expect(itemProblem({ ...bare, carbsG: 40, carbsLowG: 50, carbsHighG: 60 })).toMatch(/carb range/);
    expect(itemProblem({ ...bare, carbsG: 40, carbsLowG: 30, carbsHighG: 50 })).toBeUndefined();
  });
  it('refuses a backup whose meal holds half a carb range, before anything is written (H7-06)', () => {
    const doc = {
      format: TRANSFER_FORMAT, version: 1, exportedAt: AT, schemaVersion: 6, observations: [], sessions: [], checkIns: [], personalRecords: [], bodyMetrics: [],
      focusOverrides: {}, contentState: [], stores: ['meals'], records: { meals: [meal({ items: [{ ...roti, carbsG: 40, carbsLowG: 60, carbsHighG: undefined }] })] },
    };
    const preview = previewImport(JSON.parse(JSON.stringify(doc)));
    expect(preview.ok && preview.rejected?.meals).toBe(1);
    expect(() => planImport(JSON.parse(JSON.stringify(doc)), 'merge', emptySnapshot())).toThrow(/could not be read, so nothing was changed/);
  });
  it('requires your own food’s snapshot, so the item reads on its own; its food may be gone (H7-10; board D134)', () => {
    const own = { kind: 'custom', customId: 'food-gone', name: 'Bhel puri', count: 1.5, per: { qty: 1, unit: 'plate' }, basis: { kcal: 300 }, version: AT, kcal: 450 };
    expect(itemProblem(own)).toBeUndefined();
    // Logged before snapshots, with no food to give it one (board D146): its name and count, and no figure without what it held.
    expect(itemProblem({ kind: 'custom', customId: 'food-1', name: 'Bhel puri', count: 1 })).toBeUndefined();
    expect(itemProblem({ kind: 'custom', customId: 'food-1', name: 'Bhel puri', count: 1, kcal: 300 })).toMatch(/your own food/);
    expect(itemProblem({ kind: 'custom', customId: 'food-1', name: 'Bhel puri', count: 1, carbsG: 40 })).toMatch(/your own food/);
    const { per, basis, version, ...bare } = own;
    void per; void basis; void version;
    expect(itemProblem({ ...bare, basis: { kcal: 300 }, version: AT })).toMatch(/your own food/);
    expect(itemProblem({ ...own, per: { qty: 0, unit: 'plate' } })).toMatch(/your own food/);
    expect(itemProblem({ ...own, per: { qty: 1, unit: '' } })).toMatch(/your own food/);
    expect(itemProblem({ ...own, version: 'yesterday' })).toMatch(/your own food/);
    expect(itemProblem({ ...own, basis: { kcal: -1 } })).toMatch(/your own food/);
    expect(itemProblem({ ...own, basis: 'a plate' })).toMatch(/your own food/);
    // Its figures and its basis agree: one without the other can't be read.
    expect(itemProblem({ ...own, basis: {} })).toMatch(/your own food/);
    expect(itemProblem({ ...own, kcal: undefined })).toMatch(/your own food/);
    expect(itemProblem({ ...own, carbsG: 40 })).toMatch(/your own food/);
  });
  it('takes a backup whose meal names an own food it doesn’t hold, read from the item’s snapshot, and refuses part of one (H7-10, D146)', () => {
    const doc = (item: Record<string, unknown>) => JSON.parse(JSON.stringify({
      format: TRANSFER_FORMAT, version: 1, exportedAt: AT, schemaVersion: 6, observations: [], sessions: [], checkIns: [], personalRecords: [], bodyMetrics: [],
      focusOverrides: {}, contentState: [], stores: ['meals', 'customFoods'], records: { meals: [meal({ items: [item] })], customFoods: [] },
    }));
    const snapshot = { kind: 'custom', customId: 'missing', name: 'Bhel puri', count: 1, per: { qty: 1, unit: 'plate' }, basis: {}, version: AT };
    const ok = previewImport(doc(snapshot));
    expect(ok.ok && ok.rejected?.meals).toBe(0);
    const { per, ...partial } = snapshot;
    void per;
    const refused = previewImport(doc(partial));
    expect(refused.ok && refused.rejected?.meals).toBe(1);
    // With no snapshot at all, it was logged before them: read by its name (board D146).
    const { basis, version, ...bare } = partial;
    void basis; void version;
    const old = previewImport(doc(bare));
    expect(old.ok && old.rejected?.meals).toBe(0);
  });
  it('refuses your own food’s figures when its snapshot can’t give them, as the stepper works them out (H7R-03; board D148)', () => {
    const own = { kind: 'custom', customId: 'food-1', name: 'Bhel puri', count: 1, per: { qty: 1, unit: 'plate' }, basis: { kcal: 300, carbsG: 40 }, version: AT, kcal: 300, carbsG: 40 };
    expect(itemProblem(own)).toBeUndefined();
    // Codex's file: 600 kcal and 80 g from one plate of 300 and 40, which More would turn into 450 and 60.
    expect(itemProblem({ ...own, kcal: 600, carbsG: 80 })).toMatch(/your own food/);
    expect(itemProblem({ ...own, kcal: 600 })).toMatch(/your own food/);
    expect(itemProblem({ ...own, carbsG: 80 })).toMatch(/your own food/);
    // Rounded as `ownFigures` rounds: 1½ × 133 kcal is 200, 1½ × 21.3 g is 32 g.
    const half = { ...own, count: 1.5, basis: { kcal: 133, carbsG: 21.3 } };
    expect(itemProblem({ ...half, kcal: 200, carbsG: 32 })).toBeUndefined();
    expect(itemProblem({ ...half, kcal: 199, carbsG: 32 })).toMatch(/your own food/);
    expect(itemProblem({ ...half, kcal: 200, carbsG: 31.9 })).toMatch(/your own food/);
  });
  it('refuses a backup holding such an item, in a meal, an earlier version of one, or a usual meal (H7R-03)', () => {
    const bad = { kind: 'custom', customId: 'food-1', name: 'Bhel puri', count: 1, per: { qty: 1, unit: 'plate' }, basis: { kcal: 300, carbsG: 40 }, version: AT, kcal: 600, carbsG: 80 };
    const doc = (records: Record<string, unknown[]>) => JSON.parse(JSON.stringify({
      format: TRANSFER_FORMAT, version: 1, exportedAt: AT, schemaVersion: 6, observations: [], sessions: [], checkIns: [], personalRecords: [], bodyMetrics: [],
      focusOverrides: {}, contentState: [], stores: Object.keys(records), records,
    }));
    const rejected = (records: Record<string, unknown[]>) => { const p = previewImport(doc(records)); return p.ok ? p.rejected : undefined; };
    expect(rejected({ meals: [meal({ items: [bad] })] })?.meals).toBe(1);
    expect(rejected({ meals: [meal({ editedAt: AT, edits: [{ replacedAt: AT, at: AT, meal: 'lunch', items: [bad] }] })] })?.meals).toBe(1);
    expect(rejected({ savedMeals: [{ id: 'usual-1', name: 'Lunch', items: [bad], savedAt: AT, updatedAt: AT }] })?.savedMeals).toBe(1);
  });
  it('takes an unknown figure as unknown, never as 0 (A-17)', () => {
    expect(itemProblem({ kind: 'custom', customId: 'food-1', name: 'Bhel puri', count: 1, per: { qty: 1, unit: 'plate' }, basis: {}, version: AT })).toBeUndefined();
    expect(itemProblem({ kind: 'quick', size: 'normal', name: 'Normal plate' })).toBeUndefined();
  });
});

describe('usual meals and own foods', () => {
  const usual: SavedMeal = { id: 'usual-1', name: 'Weekday lunch', meal: 'lunch', items: [roti], savedAt: AT, updatedAt: AT };
  const own: CustomFood = { id: 'food-1', name: 'Bhel puri', per: { qty: 1, unit: 'plate' }, createdAt: AT, updatedAt: AT };
  it('are read whole, or refused with the reason', () => {
    expect(savedMealProblem(stored(usual))).toBeUndefined();
    expect(savedMealProblem({ ...stored(usual), name: '' })).toMatch(/name/);
    expect(customFoodProblem(stored(own))).toBeUndefined();
    expect(customFoodProblem({ ...stored(own), kcal: -1 })).toMatch(/figure/);
    expect(customFoodProblem({ ...stored(own), allergens: ['coconut'] })).toMatch(/allergen/);
    expect(customFoodProblem({ ...stored(own), per: { qty: 0, unit: 'plate' } })).toMatch(/portion/);
  });
  it('fill Plan 6’s three food rules', () => {
    expect(RECORD_RULES.meals).toMatchObject({ keyPath: 'id', backup: 'always', problem: mealProblem, newer: newerMeal });
    expect(RECORD_RULES.savedMeals).toMatchObject({ keyPath: 'id', backup: 'always', problem: savedMealProblem, newer: newerByUpdate });
    expect(RECORD_RULES.customFoods).toMatchObject({ keyPath: 'id', backup: 'always', problem: customFoodProblem, newer: newerByUpdate });
  });
});

describe('two copies of one meal, in a merge (journey §18.3)', () => {
  it('keep the one changed last, and call equal times a conflict', () => {
    const later = meal({ editedAt: '2026-10-08T15:00:00.000+05:30', edits: [{ replacedAt: '2026-10-08T15:00:00.000+05:30', at: AT, meal: 'lunch', items: [roti] }] });
    expect(newerMeal(meal(), later)).toBe(1);
    expect(newerMeal(later, meal())).toBe(-1);
    expect(newerMeal(meal(), meal({ items: [{ ...roti, count: 3 }] }))).toBe(0);
  });
});

describe('corrections and restores (A-22, B-05)', () => {
  it('keep the version a correction replaced, and leave an unchanged meal alone', () => {
    const next = corrected(base, { at: AT, meal: 'lunch', items: [{ ...roti, count: 3 }] }, '2026-10-08T15:00:00.000+05:30');
    expect(next).toMatchObject({ id: 'meal-1', editedAt: '2026-10-08T15:00:00.000+05:30' });
    expect(next.edits).toEqual([{ replacedAt: '2026-10-08T15:00:00.000+05:30', at: AT, meal: 'lunch', items: [roti] }]);
    expect(corrected(base, { at: AT, meal: 'lunch', items: [roti] }, '2026-10-08T15:00:00.000+05:30')).toBe(base);
  });
  it('move a dinner corrected past midnight onto its new day, keeping its id (Review Focus 4)', () => {
    const next = corrected(base, { at: '2026-10-09T00:20:00.000+05:30', meal: 'dinner', items: base.items }, '2026-10-09T08:00:00.000+05:30');
    expect(next).toMatchObject({ id: 'meal-1', day: '2026-10-09', meal: 'dinner' });
    expect(mealProblem(stored(next))).toBeUndefined();
  });
  it('restore under a fresh id, naming the one it came from', () => {
    expect(restored(base, 'meal-2')).toMatchObject({ id: 'meal-2', restoredFrom: 'meal-1', items: base.items });
  });
});

describe('an own-food item logged before snapshots (H7R-01; board D146)', () => {
  const lemon: CustomFood = { id: 'food-lemon', name: 'Lemon rice', per: { qty: 1, unit: 'plate' }, kcal: 333, carbsG: 52.5, createdAt: AT, updatedAt: AT };
  const old = { kind: 'custom', customId: 'food-lemon', name: 'Lemon rice', count: 1.5, kcal: 500, carbsG: 78.8 };
  const foods = (...list: CustomFood[]) => (id: string) => list.find(f => f.id === id);

  it('takes its snapshot from its food when that food still gives the figures it was logged with, keeping its own name', () => {
    const renamed = { ...lemon, name: 'Lemon rice (home)' };
    expect(upgradedItem(old, foods(renamed))).toEqual({ ...old, per: { qty: 1, unit: 'plate' }, basis: { kcal: 333, carbsG: 52.5 }, version: AT });
    expect(itemProblem(upgradedItem(old, foods(lemon)))).toBeUndefined();
    const kheer = { kind: 'custom', customId: 'food-kheer', name: 'Kheer', count: 2 };
    expect(upgradedItem(kheer, foods({ id: 'food-kheer', name: 'Kheer', per: { qty: 1, unit: 'katori' }, createdAt: AT, updatedAt: AT })))
      .toEqual({ ...kheer, per: { qty: 1, unit: 'katori' }, basis: {}, version: AT });
  });
  it('keeps its name and count and no figure when its food is gone, or gives other figures (another version)', () => {
    const bare = { kind: 'custom', customId: 'food-lemon', name: 'Lemon rice', count: 1.5 };
    expect(upgradedItem(old, foods())).toEqual(bare);
    expect(upgradedItem(old, foods({ ...lemon, kcal: 300 }))).toEqual(bare);
    expect(upgradedItem(old, foods({ ...lemon, carbsG: 50 }))).toEqual(bare);
    expect(upgradedItem({ ...old, carbsG: undefined }, foods(lemon))).toEqual(bare);
    expect(itemProblem(bare)).toBeUndefined();
  });
  it('leaves every other item as it is: a snapshot, part of one, a table food, a quick add', () => {
    const items = [
      { ...old, per: { qty: 1, unit: 'plate' }, basis: { kcal: 333, carbsG: 52.5 }, version: AT },
      { ...old, basis: {} },
      { ...old, per: { qty: 1, unit: 'plate' } },
      { ...old, version: AT },
      { ...old, count: 0.3 },
      { ...old, customId: '' },
      roti,
      { kind: 'quick', size: 'small', name: 'Small plate' },
    ];
    for (const item of items) expect(upgradedItem(item, foods(lemon))).toBe(item);
  });
  it('gives a meal’s items and every earlier version’s theirs, from the first food of an id, and leaves a row with none alone', () => {
    const give = withSnapshots([{ ...lemon, kcal: 999 }, lemon]);
    const m = meal({ items: [old, roti], edits: [{ replacedAt: AT, at: AT, meal: 'lunch', items: [roti] }, { replacedAt: AT, at: AT, meal: 'lunch', items: [{ ...old, kcal: 1499 }] }], editedAt: AT }) as unknown as MealRecord;
    const out = give(m) as MealRecord;
    expect(out.items).toEqual([{ kind: 'custom', customId: 'food-lemon', name: 'Lemon rice', count: 1.5 }, roti]);
    expect(out.edits[0]).toBe(m.edits[0]);
    expect(out.edits[1].items[0]).toMatchObject({ basis: { kcal: 999, carbsG: 52.5 }, kcal: 1499 });
    expect(mealProblem(stored(out))).toBeUndefined();
    const plain = meal();
    expect(give(plain)).toBe(plain);
    const usual = { id: 'usual-1', name: 'Lunch', items: [old], savedAt: AT, updatedAt: AT };
    expect((withSnapshots([lemon])(usual) as SavedMeal).items[0]).toMatchObject({ basis: { kcal: 333, carbsG: 52.5 } });
    expect(give('not a row')).toBe('not a row');
  });
});

describe('reading what the store holds', () => {
  it('passes over a row this version can’t read, and works it out once per list', () => {
    const list = [meal(), { id: 'meal-x' }];
    const first = mealsIn({ meals: list });
    expect(first.map(m => m.id)).toEqual(['meal-1']);
    expect(mealsIn({ meals: list })).toBe(first);
  });
});

describe('every other part a food record could not hold (mutation-checked)', () => {
  const usual = (over: Record<string, unknown> = {}) => ({ id: 'usual-1', name: 'Weekday lunch', meal: 'lunch', items: [roti], savedAt: AT, updatedAt: AT, ...over });
  const own = (over: Record<string, unknown> = {}) => ({ id: 'food-1', name: 'Bhel puri', per: { qty: 1, unit: 'plate' }, createdAt: AT, updatedAt: AT, ...over });
  const edit: MealEdit = { replacedAt: AT, at: AT, meal: 'lunch', items: [roti] };
  it('refuses an item it can’t read', () => {
    const cases: [unknown, RegExp][] = [
      ['roti', /not an object/],
      [null, /not an object/],
      [[roti], /not an object/],
      [{ ...roti, name: '' }, /needs its name/],
      [{ ...roti, kcal: -1 }, /impossible kcal/],
      [{ ...roti, kcal: 20_000 }, /impossible kcal/],
      [{ ...roti, carbsG: 3_000 }, /impossible carb figure/],
      [{ ...roti, weighed: false }, /impossible portion/],
      [{ ...roti, gramsPerPortion: 0 }, /impossible portion/],
      [{ ...roti, count: 21 }, /impossible portion/],
      [{ ...roti, foodId: '' }, /recipe/],
      [{ ...roti, carbsHighG: -1 }, /impossible carb range/],
      [{ kind: 'custom', customId: '', name: 'Bhel puri', count: 1 }, /your own food/],
      [{ kind: 'custom', customId: 'food-1', name: 'Bhel puri', count: 0 }, /your own food/],
      [{ kind: 'quick', size: 'huge', name: 'Huge plate' }, /needs its size/],
    ];
    for (const [item, why] of cases) expect(itemProblem(item), JSON.stringify(item)).toMatch(why);
    // A weighed portion keeps its whole range; carbs with no range are refused (H7-06, above).
    expect(itemProblem({ ...roti, weighed: true })).toBeUndefined();
  });
  it('refuses a meal it can’t read', () => {
    const cases: [Record<string, unknown>, RegExp][] = [
      [{ id: '' }, /needs its id/],
      [{ loggedAt: 'x' }, /when it was logged/],
      [{ editedAt: 'x' }, /when it was corrected/],
      [{ restoredFrom: '' }, /came back from/],
      [{ items: Array.from({ length: 41 }, () => roti) }, /between 1 and 40/],
      [{ edits: Array.from({ length: 51 }, () => edit), editedAt: AT }, /at most 50 earlier versions/],
      [{ edits: 'none' }, /at most 50 earlier versions/],
      [{ edits: [{ ...edit, replacedAt: 'x' }], editedAt: AT }, /earlier version/],
      [{ edits: [{ ...edit, meal: 'brunch' }], editedAt: AT }, /earlier version/],
      [{ edits: [{ ...edit, items: [] }], editedAt: AT }, /between 1 and 40/],
    ];
    for (const [over, why] of cases) expect(mealProblem(meal(over)), JSON.stringify(over)).toMatch(why);
    expect(mealProblem(meal({ edits: [edit], editedAt: AT, restoredFrom: 'meal-0' }))).toBeUndefined();
  });
  it('refuses a usual meal it can’t read', () => {
    const cases: [Record<string, unknown>, RegExp][] = [
      [{ id: '' }, /its id/], [{ name: 'x'.repeat(61) }, /name/], [{ meal: 'brunch' }, /breakfast, lunch/],
      [{ savedAt: 'x' }, /when it was saved/], [{ updatedAt: 'x' }, /when it was saved/], [{ restoredFrom: '' }, /came back from/],
      [{ items: [] }, /between 1 and 40/],
    ];
    for (const [over, why] of cases) expect(savedMealProblem(usual(over)), JSON.stringify(over)).toMatch(why);
    expect(savedMealProblem(usual({ meal: undefined }))).toBeUndefined();
  });
  it('refuses an own food it can’t read', () => {
    const cases: [Record<string, unknown>, RegExp][] = [
      [{ id: '' }, /its id/], [{ name: '' }, /name/], [{ per: { qty: 1, unit: '' } }, /portion/], [{ per: { qty: 20_000, unit: 'plate' } }, /portion/],
      [{ per: 'plate' }, /portion/], [{ carbsG: 2_000 }, /figure/], [{ kcal: 6_000 }, /figure/], [{ allergens: 'peanut' }, /allergen/],
      [{ createdAt: 'x' }, /when it was added/], [{ updatedAt: 'x' }, /when it was added/],
    ];
    for (const [over, why] of cases) expect(customFoodProblem(own(over)), JSON.stringify(over)).toMatch(why);
    expect(customFoodProblem(own({ kcal: 300, carbsG: 45, allergens: ['peanut', 'sesame'] }))).toBeUndefined();
  });
  it('merges usual meals and own foods by the copy changed last', () => {
    expect(newerByUpdate(usual(), usual({ updatedAt: '2026-10-09T09:00:00.000+05:30' }))).toBe(1);
    expect(newerByUpdate(usual({ updatedAt: '2026-10-09T09:00:00.000+05:30' }), usual())).toBe(-1);
    expect(newerByUpdate(own(), own({ name: 'Bhel' }))).toBe(0);
  });
  it('keeps at most 50 earlier versions, dropping the oldest', () => {
    const edits = Array.from({ length: 50 }, (_, i) => ({ ...edit, replacedAt: `2026-10-08T14:${String(i).padStart(2, '0')}:00.000+05:30` }));
    const next = corrected({ ...base, edits, editedAt: edits[49].replacedAt }, { at: AT, meal: 'dinner', items: [roti] }, '2026-10-08T16:00:00.000+05:30');
    expect(next.edits).toHaveLength(50);
    expect(next.edits[0].replacedAt).toBe(edits[1].replacedAt);
    expect(next.edits[49]).toMatchObject({ replacedAt: '2026-10-08T16:00:00.000+05:30', meal: 'lunch' });
  });
});
