/**
 * Food records as the store keeps them (journey §18.2, B-05, B-12; board
 * D104). Each rule says what a meal, a usual meal or a person's own food must
 * hold to be read, and which of two copies a merge keeps. A correction keeps
 * the version it replaced, and a restore uses a fresh id. Plan 6's registry
 * calls these for every put and every imported row.
 *
 * Kept free of the food table and of the store, so the registry, Home and the
 * reminder host can import it.
 */
import { isAt } from '@/health/observation';
import type { Records, StoredRecord } from '@/store/records';
import { ALLERGEN_IDS } from '@/types/profile';
import type { CustomFood, MealEdit, MealRecord, SavedMeal, Slot } from './types';
import { isUnitId } from './units';

export const MEAL_LIMITS = { items: 40, edits: 50, name: 80 } as const;

const SLOTS: readonly Slot[] = ['breakfast', 'lunch', 'snack', 'dinner'];
const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isSlot = (x: unknown): x is Slot => typeof x === 'string' && (SLOTS as readonly string[]).includes(x);
const isText = (x: unknown, max: number = MEAL_LIMITS.name): x is string => typeof x === 'string' && x.trim() !== '' && x.length <= max;
const isAmount = (x: unknown, max: number): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= max;
/** A count the stepper can reach: halves, from ½ to 20. */
const isCount = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0 && x <= 20 && Number.isInteger(x * 2);
const optional = (x: unknown, check: (v: unknown) => boolean) => x === undefined || check(x);

/** Why a logged item can't be read, or nothing. */
export function itemProblem(x: unknown): string | undefined {
  if (!isObject(x)) return 'an item is not an object';
  if (!isText(x.name)) return 'an item needs its name';
  const name = x.name;
  if (!optional(x.kcal, v => isAmount(v, 10_000))) return `${name}: an impossible kcal figure`;
  if (!optional(x.carbsG, v => isAmount(v, 2_000))) return `${name}: an impossible carb figure`;
  switch (x.kind) {
    case 'food': {
      if (!isText(x.foodId) || !(typeof x.rev === 'number' && Number.isInteger(x.rev) && x.rev >= 1)) return `${name}: the recipe it was worked out from is missing`;
      if (!isUnitId(x.unit) || !isCount(x.count) || !isAmount(x.gramsPerPortion, 2_000) || x.gramsPerPortion === 0) return `${name}: an impossible portion`;
      if (!optional(x.weighed, v => v === true)) return `${name}: an impossible portion`;
      if (!optional(x.carbsLowG, v => isAmount(v, 2_000)) || !optional(x.carbsHighG, v => isAmount(v, 2_000))) return `${name}: an impossible carb range`;
      // The estimate and its range are one set (B-12, H7-06): a range is never made from part of one.
      const { carbsG, carbsLowG, carbsHighG } = x;
      const given = [carbsG, carbsLowG, carbsHighG].filter(v => v !== undefined).length;
      if (given !== 0 && given !== 3) return `${name}: a carb estimate needs its whole carb range`;
      if (given === 3 && !((carbsLowG as number) <= (carbsG as number) && (carbsG as number) <= (carbsHighG as number))) {
        return `${name}: a carb range that doesn’t hold its estimate`;
      }
      return undefined;
    }
    case 'custom': {
      if (!isText(x.customId) || !isCount(x.count)) return `${name}: an impossible portion of your own food`;
      // Its snapshot, so it reads on its own whether or not the food is still here (board D134, H7-10).
      const per = x.per;
      if (!isObject(per) || !(typeof per.qty === 'number' && per.qty > 0 && per.qty <= 10_000) || !isText(per.unit, 20)) return `${name}: what one portion of your own food was can’t be read`;
      const basis = x.basis;
      if (!isObject(basis) || !optional(basis.kcal, v => isAmount(v, 5_000)) || !optional(basis.carbsG, v => isAmount(v, 1_000))) return `${name}: what your own food held can’t be read`;
      if (!isAt(x.version)) return `${name}: which version of your own food it was can’t be read`;
      if ((x.kcal === undefined) !== (basis.kcal === undefined) || (x.carbsG === undefined) !== (basis.carbsG === undefined)) return `${name}: your own food’s figures don’t match what it held`;
      return undefined;
    }
    case 'quick':
      if (x.size !== 'small' && x.size !== 'normal' && x.size !== 'large') return `${name}: a quick add needs its size`;
      return x.carbsG === undefined ? undefined : `${name}: a quick add never has carbs`;
    default:
      return 'an item of a kind this version doesn’t know';
  }
}

function itemsProblem(items: unknown): string | undefined {
  if (!Array.isArray(items) || items.length === 0 || items.length > MEAL_LIMITS.items) return `a meal holds between 1 and ${MEAL_LIMITS.items} items`;
  for (const item of items) {
    const problem = itemProblem(item);
    if (problem) return problem;
  }
  return undefined;
}

/** Why a stored or imported meal can't be read, or nothing (journey §18.3). */
export function mealProblem(r: StoredRecord): string | undefined {
  if (!isText(r.id)) return 'a meal needs its id';
  if (!isAt(r.at)) return 'a meal needs when it was eaten, ISO with an offset';
  if (r.day !== r.at.slice(0, 10)) return 'a meal’s day must be the day it was eaten';
  if (!isSlot(r.meal)) return 'a meal needs breakfast, lunch, a snack or dinner';
  if (r.level !== 'meals' && r.level !== 'estimates') return 'a meal needs the level it was logged at';
  if (!isAt(r.loggedAt) || !optional(r.editedAt, isAt)) return 'a meal needs when it was logged, and when it was corrected';
  if (!optional(r.restoredFrom, v => isText(v))) return 'a restored meal needs the id it came back from';
  const items = itemsProblem(r.items);
  if (items) return items;
  if (!Array.isArray(r.edits) || r.edits.length > MEAL_LIMITS.edits) return `a meal keeps at most ${MEAL_LIMITS.edits} earlier versions`;
  for (const e of r.edits) {
    if (!isObject(e) || !isAt(e.replacedAt) || !isAt(e.at) || !isSlot(e.meal)) return 'an earlier version of a meal can’t be read';
    const problem = itemsProblem(e.items);
    if (problem) return problem;
  }
  if (r.edits.length > 0 && r.editedAt === undefined) return 'a corrected meal needs when it was corrected';
  return undefined;
}

/** Why a usual meal can't be read, or nothing. */
export function savedMealProblem(r: StoredRecord): string | undefined {
  if (!isText(r.id)) return 'a usual meal needs its id';
  if (!isText(r.name, 60)) return 'a usual meal needs a name of 1 to 60 characters';
  if (!optional(r.meal, isSlot)) return 'a usual meal’s meal must be breakfast, lunch, a snack or dinner';
  if (!isAt(r.savedAt) || !isAt(r.updatedAt)) return 'a usual meal needs when it was saved';
  if (!optional(r.restoredFrom, v => isText(v))) return 'a restored usual meal needs the id it came back from';
  return itemsProblem(r.items);
}

/** Why one of the person's own foods can't be read, or nothing. */
export function customFoodProblem(r: StoredRecord): string | undefined {
  if (!isText(r.id)) return 'your own food needs its id';
  if (!isText(r.name, 60)) return 'your own food needs a name of 1 to 60 characters';
  const per = r.per;
  if (!isObject(per) || !(typeof per.qty === 'number' && per.qty > 0 && per.qty <= 10_000) || !isText(per.unit, 20)) return `${r.name}: what one portion is can’t be read`;
  if (!optional(r.kcal, v => isAmount(v, 5_000)) || !optional(r.carbsG, v => isAmount(v, 1_000))) return `${r.name}: an impossible figure`;
  if (!optional(r.allergens, v => Array.isArray(v) && v.every(a => (ALLERGEN_IDS as readonly unknown[]).includes(a)))) return `${r.name}: an allergen this version doesn’t know`;
  if (!isAt(r.createdAt) || !isAt(r.updatedAt)) return `${r.name}: when it was added can’t be read`;
  return undefined;
}

/** The latest of these instants on a record. */
function lastChange(r: StoredRecord, keys: readonly string[]): number {
  let latest = -Infinity;
  for (const k of keys) {
    const v = r[k];
    if (typeof v === 'string') latest = Math.max(latest, Date.parse(v));
  }
  return latest;
}

/** Plan 6's `newer`: >0 takes the file's copy, <0 keeps this phone's, 0 is a conflict. */
const byLatest = (keys: readonly string[]) => (here: StoredRecord, file: StoredRecord): number =>
  Math.sign(lastChange(file, keys) - lastChange(here, keys)) || 0;

/** The copy corrected (or logged) last. */
export const newerMeal = byLatest(['editedAt', 'loggedAt']);
/** The copy changed last: a usual meal, or the person's own food. */
export const newerByUpdate = byLatest(['updatedAt']);

const readable = new WeakMap<readonly StoredRecord[], readonly StoredRecord[]>();

/** The rows of a store this version can read, worked out once per list. */
function readableIn(list: readonly StoredRecord[], problem: (r: StoredRecord) => string | undefined): readonly StoredRecord[] {
  let kept = readable.get(list);
  if (!kept) {
    kept = list.filter(r => problem(r) === undefined);
    readable.set(list, kept);
  }
  return kept;
}

export const mealsIn = (records: Pick<Records, 'meals'>): readonly MealRecord[] =>
  readableIn(records.meals, mealProblem) as unknown as readonly MealRecord[];
export const savedMealsIn = (records: Pick<Records, 'savedMeals'>): readonly SavedMeal[] =>
  readableIn(records.savedMeals, savedMealProblem) as unknown as readonly SavedMeal[];
export const customFoodsIn = (records: Pick<Records, 'customFoods'>): readonly CustomFood[] =>
  readableIn(records.customFoods, customFoodProblem) as unknown as readonly CustomFood[];

/**
 * A meal as corrected (A-22): the new time, meal and items, with the version
 * it replaces kept in `edits`. Moved past midnight, it moves to that day
 * (Review Focus 4). Unchanged, it's the same meal.
 */
export function corrected(meal: MealRecord, next: Pick<MealRecord, 'at' | 'meal' | 'items'>, now: string): MealRecord {
  if (meal.at === next.at && meal.meal === next.meal && JSON.stringify(meal.items) === JSON.stringify(next.items)) return meal;
  const before: MealEdit = { replacedAt: now, at: meal.at, meal: meal.meal, items: meal.items };
  return {
    ...meal, at: next.at, day: next.at.slice(0, 10), meal: next.meal, items: next.items, editedAt: now,
    edits: [...meal.edits, before].slice(-MEAL_LIMITS.edits),
  };
}

/** A deleted record brought back by Undo, under a fresh id (B-05). The original's deletion record stays. */
export function restored<T extends { id: string }>(record: T, id: string): T & { restoredFrom: string } {
  return { ...record, id, restoredFrom: record.id };
}

/** A food record as the store's registry types it. */
export const stored = (r: MealRecord | SavedMeal | CustomFood): StoredRecord => r as unknown as StoredRecord;
