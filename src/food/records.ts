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
import { customItem, ownFigures } from './estimate';
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

/** An own-food item logged before snapshots (board D146, H7R-01): none of `per`, `basis` and `version`. */
const preSnapshot = (x: Record<string, unknown>) => x.kind === 'custom' && x.per === undefined && x.basis === undefined && x.version === undefined;

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
      // Equal ends of 1 g or more are a single figure, which the app never works out (board D149, H7-05).
      if (given === 3 && carbsLowG === carbsHighG && (carbsHighG as number) >= 1) return `${name}: a carb range that is a single figure`;
      return undefined;
    }
    case 'custom': {
      if (!isText(x.customId) || !isCount(x.count)) return `${name}: an impossible portion of your own food`;
      // Logged before snapshots, with no food left to give it one (board D146, H7R-01): its name, with nothing known.
      if (preSnapshot(x)) return x.kcal === undefined && x.carbsG === undefined ? undefined : `${name}: your own food’s figures can’t be read without what it held`;
      // Its snapshot, so it reads on its own whether or not the food is still here (board D134, H7-10).
      const per = x.per;
      if (!isObject(per) || !(typeof per.qty === 'number' && per.qty > 0 && per.qty <= 10_000) || !isText(per.unit, 20)) return `${name}: what one portion of your own food was can’t be read`;
      const basis = x.basis;
      if (!isObject(basis) || !optional(basis.kcal, v => isAmount(v, 5_000)) || !optional(basis.carbsG, v => isAmount(v, 1_000))) return `${name}: what your own food held can’t be read`;
      if (!isAt(x.version)) return `${name}: which version of your own food it was can’t be read`;
      // Its figures are its snapshot's, at its count, as the stepper works them out (board D148, H7R-03).
      const figures = ownFigures(basis, x.count);
      if (x.kcal !== figures.kcal || x.carbsG !== figures.carbsG) return `${name}: your own food’s figures don’t match what it held`;
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

/**
 * An own-food item logged before snapshots, given one (board D146, H7R-01): from its food as held now, when
 * that food still gives the figures the item was logged with. Otherwise its food is gone, or isn't the version
 * it was logged from, so it keeps its name and count and holds no figure: "No estimate". Any other item is itself.
 */
export function upgradedItem(x: unknown, foodOf: (id: string) => CustomFood | undefined): unknown {
  if (!isObject(x) || !preSnapshot(x) || !isText(x.customId) || !isCount(x.count)) return x;
  // A figure that can't be read is never made unknown: the item stays as it is, and is refused (H7F-05; D207).
  if (!optional(x.kcal, v => isAmount(v, 10_000)) || !optional(x.carbsG, v => isAmount(v, 2_000))) return x;
  const food = foodOf(x.customId);
  const now = food && customItem(food, x.count);
  if (now && now.kcal === x.kcal && now.carbsG === x.carbsG) return { ...x, per: now.per, basis: now.basis, version: now.version };
  if (x.kcal === undefined && x.carbsG === undefined) return x;
  const { kcal, carbsG, ...known } = x;
  void kcal; void carbsG;
  return known;
}

/**
 * A table food stored with equal carb ends of 1 g or more before D149 refused them (H7F-03; board D207): a
 * single figure, never a range, so it keeps everything else and has no carb estimate. Any other item is itself.
 */
export function withoutFlatRange(x: unknown): unknown {
  if (!isObject(x) || x.kind !== 'food') return x;
  const { carbsG, carbsLowG, carbsHighG, ...rest } = x;
  const flat = typeof carbsHighG === 'number' && carbsHighG >= 1 && carbsLowG === carbsHighG && carbsG === carbsHighG;
  return flat ? rest : x;
}

/** These foods by id, the first of an id winning. */
function foodsById(foods: readonly CustomFood[]): (id: string) => CustomFood | undefined {
  const byId = new Map<string, CustomFood>();
  for (const f of foods) if (!byId.has(f.id)) byId.set(f.id, f);
  return id => byId.get(id);
}

/**
 * A meal (every earlier version too) or a usual meal with its items as `upgradedItem` makes them, from these
 * foods, the first of an id winning: the same row when nothing in it changes. A file's rows are read so.
 */
export function withSnapshots(foods: readonly CustomFood[]): (row: unknown) => unknown {
  const foodOf = foodsById(foods);
  return eachItem(i => upgradedItem(i, foodOf));
}

/** The rows this device holds, kept readable at start: `withSnapshots`, and no flat carb range either (H7F-03). */
export function keptReadable(foods: readonly CustomFood[]): (row: unknown) => unknown {
  const foodOf = foodsById(foods);
  return eachItem(i => withoutFlatRange(upgradedItem(i, foodOf)));
}

/** A meal (every earlier version too) or a usual meal with each item as `f` makes it: the same row when nothing changes. */
function eachItem(f: (item: unknown) => unknown): (row: unknown) => unknown {
  const items = (list: unknown) => {
    if (!Array.isArray(list)) return list;
    const next = list.map(f);
    return next.some((v, i) => v !== list[i]) ? next : list;
  };
  return row => {
    if (!isObject(row)) return row;
    const its = items(row.items);
    const edits = Array.isArray(row.edits) ? row.edits.map(e => {
      const next = isObject(e) ? items(e.items) : undefined;
      return isObject(e) && next !== e.items ? { ...e, items: next } : e;
    }) : row.edits;
    const editsChanged = Array.isArray(row.edits) && (edits as unknown[]).some((e, i) => e !== (row.edits as unknown[])[i]);
    return its === row.items && !editsChanged ? row : { ...row, items: its, ...(editsChanged ? { edits } : {}) };
  };
}

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
 * it replaces kept in `edits`, every one of them: a correction never drops
 * one (§4.6), so one past `MEAL_LIMITS.edits` is refused where it's saved
 * (codex F-food-03). Moved past midnight, it moves to that day (Review
 * Focus 4). Unchanged, it's the same meal.
 */
export function corrected(meal: MealRecord, next: Pick<MealRecord, 'at' | 'meal' | 'items'>, now: string): MealRecord {
  if (meal.at === next.at && meal.meal === next.meal && JSON.stringify(meal.items) === JSON.stringify(next.items)) return meal;
  const before: MealEdit = { replacedAt: now, at: meal.at, meal: meal.meal, items: meal.items };
  return {
    ...meal, at: next.at, day: next.at.slice(0, 10), meal: next.meal, items: next.items, editedAt: now,
    edits: [...meal.edits, before],
  };
}

/**
 * A deleted record brought back by Undo, under a fresh id (B-05). The original's deletion record stays.
 * A copy brought back again names the same original, so every copy of a record names it (board D147).
 */
export function restored<T extends { id: string; restoredFrom?: string }>(record: T, id: string): T & { restoredFrom: string } {
  return { ...record, id, restoredFrom: record.restoredFrom ?? record.id };
}

/** A food record as the store's registry types it. */
export const stored = (r: MealRecord | SavedMeal | CustomFood): StoredRecord => r as unknown as StoredRecord;
