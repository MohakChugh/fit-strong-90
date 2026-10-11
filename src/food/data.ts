/**
 * The food table, as scripts/food/build.ts wrote it. Imported only where food
 * is logged or ideas are filtered: Home and the reminder host never import it,
 * so the first screen doesn't carry it (boundaries.node.test.ts).
 */
import raw from '@/data/food/foods.json';
import type { Food, FoodData } from './types';

// Generated, and checked against its inputs and its shape by data.node.test.ts.
export const FOOD_DATA = raw as unknown as FoodData;
export const FOODS: readonly Food[] = FOOD_DATA.foods;
const BY_ID = new Map(FOODS.map(f => [f.id, f]));

export function foodById(id: string): Food | undefined {
  return BY_ID.get(id);
}
