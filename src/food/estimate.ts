/**
 * Estimates for what a person ate (journey §11.2–11.4, B-12): from the food
 * table's per-100 g values, for the grams eaten, with a carb range that adds
 * the portion's own variance unless the person weighed it. A meal's or a
 * day's total adds the known items only; the others are named, never 0.
 *
 * Kept free of the food table: it is handed the foods it works with.
 */
import { UNITS } from './units';
import type { CustomFood, CustomItem, Food, FoodItem, MealItem, QuickItem } from './types';

const r1 = (n: number) => Math.round(n * 10) / 10;

export interface Estimate { kcal: number; carbsG: number; carbsLowG: number; carbsHighG: number }

export function estimateFood(food: Pick<Food, 'per100g' | 'portion'>, count: number, gramsPerPortion: number, weighed = false): Estimate {
  const share = (count * gramsPerPortion) / 100;
  const variance = weighed ? 0 : UNITS[food.portion.unit].variance;
  return {
    kcal: Math.round(food.per100g.kcal * share),
    carbsG: r1(food.per100g.carbsG * share),
    carbsLowG: r1(food.per100g.carbsLowG * share * (1 - variance)),
    carbsHighG: r1(food.per100g.carbsHighG * share * (1 + variance)),
  };
}

/** A tray item for a food from the table: its standard portion unless told otherwise, with the estimate (B-12). */
export function foodItem(food: Food, count = food.portion.count, gramsPerPortion = food.portion.grams, weighed = false): FoodItem {
  return {
    kind: 'food', foodId: food.id, rev: food.rev, name: food.name, unit: food.portion.unit, count, gramsPerPortion,
    ...(weighed ? { weighed: true as const } : {}),
    ...estimateFood(food, count, gramsPerPortion, weighed),
  };
}

export function customItem(custom: CustomFood, count = 1): CustomItem {
  return {
    kind: 'custom', customId: custom.id, name: custom.name, count,
    ...(custom.kcal !== undefined ? { kcal: Math.round(custom.kcal * count) } : {}),
    ...(custom.carbsG !== undefined ? { carbsG: r1(custom.carbsG * count) } : {}),
  };
}

export const QUICK_NAME: Record<QuickItem['size'], string> = { small: 'Small plate', normal: 'Normal plate', large: 'Large plate' };

export function quickItem(size: QuickItem['size'], kcal?: number): QuickItem {
  return { kind: 'quick', size, name: QUICK_NAME[size], ...(kcal !== undefined ? { kcal: Math.round(kcal) } : {}) };
}

/**
 * An item worked out again from the table as it is now: when its recipe has
 * a new revision, or it was stored without an estimate. A weighed portion
 * keeps its grams; otherwise the table's standard grams apply. Anything the
 * table no longer has is kept as it was.
 */
export function refreshItem(item: MealItem, food: Food | undefined): MealItem {
  if (item.kind !== 'food' || !food) return item;
  if (item.rev === food.rev && item.kcal !== undefined) return item;
  return foodItem(food, item.count, item.weighed ? item.gramsPerPortion : food.portion.grams, item.weighed === true);
}

export interface Totals {
  kcal: number;
  carbsG: number;
  carbsLowG: number;
  carbsHighG: number;
  /** How many items have a calorie figure, and how many a carb figure. */
  withKcal: number;
  withCarbs: number;
  /** Each item missing a figure (A-17): named, never counted as 0. */
  missing: { name: string; kcal: boolean; carbs: boolean }[];
  items: number;
}

export function totalsOf(items: readonly MealItem[]): Totals {
  let kcal = 0;
  let carbs = 0;
  let low = 0;
  let high = 0;
  let withKcal = 0;
  let withCarbs = 0;
  const missing: Totals['missing'] = [];
  for (const item of items) {
    if (item.kcal !== undefined) {
      kcal += item.kcal;
      withKcal += 1;
    }
    if (item.carbsG !== undefined) {
      carbs += item.carbsG;
      low += item.kind === 'food' ? item.carbsLowG ?? item.carbsG : item.carbsG;
      high += item.kind === 'food' ? item.carbsHighG ?? item.carbsG : item.carbsG;
      withCarbs += 1;
    }
    if (item.kcal === undefined || item.carbsG === undefined) missing.push({ name: item.name, kcal: item.kcal === undefined, carbs: item.carbsG === undefined });
  }
  return { kcal: Math.round(kcal), carbsG: r1(carbs), carbsLowG: r1(low), carbsHighG: r1(high), withKcal, withCarbs, missing, items: items.length };
}
