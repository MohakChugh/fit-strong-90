/**
 * The food table, as scripts/food/build.ts wrote it. Imported only where food
 * is logged or ideas are filtered: Home and the reminder host never import it,
 * so the first screen doesn't carry it (boundaries.node.test.ts).
 */
import raw from '@/data/food/foods.json';
import type { Food, FoodData, FoodIngredient } from './types';

// Generated, and checked against its inputs and its shape by data.node.test.ts.
export const FOOD_DATA = raw as unknown as FoodData;
export const FOODS: readonly Food[] = FOOD_DATA.foods;
const BY_ID = new Map(FOODS.map(f => [f.id, f]));
const INGREDIENT_BY_KEY = new Map(FOOD_DATA.ingredients.map(i => [i.key, i]));

export function foodById(id: string): Food | undefined {
  return BY_ID.get(id);
}

/** One of our ingredients, for a meal idea that names it apart from its dishes (B-13). */
export function ingredientByKey(key: string): FoodIngredient | undefined {
  return INGREDIENT_BY_KEY.get(key);
}
