/**
 * The meal tray (journey §11.3, B-08): what "+" adds, what the stepper does,
 * a weighed portion, and which meal a time of day suggests. Pure; the sheet
 * holds the items and hands in the foods it knows.
 */
import { customItem, foodItem } from './estimate';
import type { CustomFood, CustomItem, Food, FoodItem, MealItem, Slot } from './types';
import { UNITS } from './units';

export const MAX_COUNT = 20;

export interface Lookup {
  food(id: string): Food | undefined;
  custom(id: string): CustomFood | undefined;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** What the stepper moves an item by: its unit's step, or half a portion of the person's own food. */
export function stepOf(item: MealItem): number {
  return item.kind === 'food' ? UNITS[item.unit].step : 0.5;
}

/** An item's own figures for another count, on the recipe it was logged with (B-12). */
function scaled(item: FoodItem | CustomItem, count: number): FoodItem | CustomItem {
  const f = count / item.count;
  const kcal = item.kcal === undefined ? {} : { kcal: Math.round(item.kcal * f) };
  const carbs = item.carbsG === undefined ? {} : { carbsG: r1(item.carbsG * f) };
  if (item.kind === 'custom') return { kind: 'custom', customId: item.customId, name: item.name, count, ...kcal, ...carbs };
  return {
    kind: 'food', foodId: item.foodId, rev: item.rev, name: item.name, unit: item.unit, count, gramsPerPortion: item.gramsPerPortion,
    ...(item.weighed ? { weighed: true as const } : {}), ...kcal, ...carbs,
    ...(item.carbsLowG === undefined ? {} : { carbsLowG: r1(item.carbsLowG * f) }),
    ...(item.carbsHighG === undefined ? {} : { carbsHighG: r1(item.carbsHighG * f) }),
  };
}

/**
 * The item at another count, from one step to 20. Worked out again from the
 * table when it still has the recipe revision the item used; otherwise the
 * item's own figures are scaled, so it stays on that revision (B-12).
 */
export function withCount(item: MealItem, count: number, look: Lookup): MealItem {
  if (item.kind === 'quick') return item;
  const c = Math.min(MAX_COUNT, Math.max(stepOf(item), count));
  if (item.kind === 'food') {
    const food = look.food(item.foodId);
    return food && food.rev === item.rev ? foodItem(food, c, item.gramsPerPortion, item.weighed === true) : scaled(item, c);
  }
  const custom = look.custom(item.customId);
  return custom ? customItem(custom, c) : scaled(item, c);
}

/** "Less" or "More": one step. */
export function step(item: MealItem, by: 1 | -1, look: Lookup): MealItem {
  return item.kind === 'quick' ? item : withCount(item, item.count + by * stepOf(item), look);
}

/** "+" (journey §11.3): one standard portion at once. Added again, the same food gets another portion, not a second row. */
export function addFood(items: readonly MealItem[], food: Food, look: Lookup): MealItem[] {
  const i = items.findIndex(x => x.kind === 'food' && x.foodId === food.id && !x.weighed);
  if (i < 0) return [...items, foodItem(food)];
  const item = items[i] as FoodItem;
  return items.map((x, j) => (j === i ? withCount(item, item.count + food.portion.count, look) : x));
}

/** A portion the person weighed (journey §11.6): that weight, from the table as it is now, with no portion variance (B-12). */
export function weighed(item: FoodItem, grams: number, food: Food): FoodItem {
  return foodItem(food, item.count, Math.round(grams), true);
}

/** The meal a time of day suggests: breakfast from 04:00, lunch from 11:00, a snack from 15:30, dinner from 19:00. */
export function slotAt(minuteOfDay: number): Slot {
  if (minuteOfDay >= 4 * 60 && minuteOfDay < 11 * 60) return 'breakfast';
  if (minuteOfDay >= 11 * 60 && minuteOfDay < 15 * 60 + 30) return 'lunch';
  if (minuteOfDay >= 15 * 60 + 30 && minuteOfDay < 19 * 60) return 'snack';
  return 'dinner';
}
