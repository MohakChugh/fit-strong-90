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

/** An item of the person's own food: `count` portions of it as it is now, with that snapshot kept (board D134). */
export function customItem(custom: CustomFood, count = 1): CustomItem {
  const basis = { ...(custom.kcal !== undefined ? { kcal: custom.kcal } : {}), ...(custom.carbsG !== undefined ? { carbsG: custom.carbsG } : {}) };
  return { kind: 'custom', customId: custom.id, name: custom.name, count, per: { ...custom.per }, basis, version: custom.updatedAt, ...ownFigures(basis, count) };
}

/** What `count` portions hold, from what one held: unknown stays unknown, never 0 (A-17). */
export function ownFigures(basis: NonNullable<CustomItem['basis']>, count: number): Pick<CustomItem, 'kcal' | 'carbsG'> {
  return {
    ...(basis.kcal !== undefined ? { kcal: Math.round(basis.kcal * count) } : {}),
    ...(basis.carbsG !== undefined ? { carbsG: r1(basis.carbsG * count) } : {}),
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

/**
 * An item's carbs as they may be shown (B-12, board D132): a table food's
 * with its range, the person's own food's as they gave it, with no range.
 * A table food's figure without its range is unknown: a range is never made
 * from a single figure, and equal ends of 1 g or more are one (board D149).
 */
export type ItemCarbs = { g: number; own: false; low: number; high: number } | { g: number; own: true };

export function itemCarbs(item: MealItem): ItemCarbs | undefined {
  if (item.carbsG === undefined) return undefined;
  if (item.kind === 'custom') return { g: item.carbsG, own: true };
  if (item.kind === 'food' && item.carbsLowG !== undefined && item.carbsHighG !== undefined && (item.carbsLowG < item.carbsHighG || item.carbsHighG < 1)) {
    return { g: item.carbsG, own: false, low: item.carbsLowG, high: item.carbsHighG };
  }
  return undefined;
}

export interface Totals {
  kcal: number;
  /** Every carb figure added: what's shown when carbs aren't ranges. */
  carbsG: number;
  /** The table's foods as a range (B-12). The person's own figures are never in it (D132). */
  carbsLowG: number;
  carbsHighG: number;
  /** The person's own foods' carbs: their figures added, with no range. */
  ownCarbsG: number;
  /** How many items have a calorie figure, a carb figure, a carb range, and a carb figure of the person's own. */
  withKcal: number;
  withCarbs: number;
  withCarbRange: number;
  withOwnCarbs: number;
  /** Each item missing a figure (A-17): named, never counted as 0. */
  missing: { name: string; kcal: boolean; carbs: boolean }[];
  items: number;
}

export function totalsOf(items: readonly MealItem[]): Totals {
  let kcal = 0;
  let carbs = 0;
  let low = 0;
  let high = 0;
  let own = 0;
  let withKcal = 0;
  let withCarbRange = 0;
  let withOwnCarbs = 0;
  const missing: Totals['missing'] = [];
  for (const item of items) {
    if (item.kcal !== undefined) {
      kcal += item.kcal;
      withKcal += 1;
    }
    const c = itemCarbs(item);
    if (c) carbs += c.g;
    if (c?.own === false) {
      low += c.low;
      high += c.high;
      withCarbRange += 1;
    }
    if (c?.own) {
      own += c.g;
      withOwnCarbs += 1;
    }
    if (item.kcal === undefined || !c) missing.push({ name: item.name, kcal: item.kcal === undefined, carbs: !c });
  }
  return {
    kcal: Math.round(kcal), carbsG: r1(carbs), carbsLowG: r1(low), carbsHighG: r1(high), ownCarbsG: r1(own),
    withKcal, withCarbs: withCarbRange + withOwnCarbs, withCarbRange, withOwnCarbs, missing, items: items.length,
  };
}
