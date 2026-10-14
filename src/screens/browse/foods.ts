/**
 * Browse's food rows (journey §14, board D115): the food table's matches for
 * what is typed, at most 6, each opening "Log a meal" at that food's portion
 * page. A figure only with estimates on (B-11): the caller passes the numbers
 * view it asked for. Apart from browse.ts, so the food table loads with
 * Browse, never with the first screen.
 */
import { BROWSE_GROUPS } from '@/categories';
import type { AllergyAnswer } from '@/food/allergens';
import { foodRowDetail } from '@/food/format';
import { logsMeals, type NumbersView } from '@/food/level';
import { logHref } from '@/food/links';
import { searchFoods } from '@/food/search';
import type { Food } from '@/food/types';
import type { FoodPreferences } from '@/types/profile';
import type { BrowseResults, BrowseRow } from './browse';

export const FOOD_ROWS_MAX = 6;

/**
 * Whether Browse lists foods to log (D115): for someone who logs meals, since a row opens
 * "Log a meal", which "meal ideas only" doesn't have; and only once their food allergies are
 * known, by the same answer Browse's meal ideas wait for (`allergyAnswer`; the owner's rule,
 * Plan 5's D194): a food record that never answered them doesn't know them, and "No food
 * allergies" is an answer, `[]`.
 */
export function listsFoods(food: FoodPreferences | undefined, allergies: AllergyAnswer | undefined): boolean {
  return logsMeals(food) && allergies !== undefined;
}

export function foodRows(query: string, foods: readonly Food[], view: NumbersView): Extract<BrowseRow, { kind: 'food' }>[] {
  return searchFoods(query, foods, []).foods.slice(0, FOOD_ROWS_MAX).map(food => ({
    kind: 'food', id: food.id, title: food.name, detail: foodRowDetail(food, view), to: logHref({ food: food.id }),
  }));
}

const CONTENT: ReadonlySet<BrowseRow['kind']> = new Set(['meal', 'topic', 'card']);

/** The food rows under Eat, after its categories and meal ideas. A food with every word typed is an answer, so part-matches go, as beside a category. */
export function withFoods(results: BrowseResults, rows: readonly BrowseRow[]): BrowseResults {
  if (rows.length === 0) return results;
  const kept = results.partial ? results.groups.map(g => ({ ...g, rows: g.rows.filter(r => !CONTENT.has(r.kind)) })) : results.groups;
  const eatTitle = BROWSE_GROUPS.find(g => g.id === 'eat')!.title;
  const eat = kept.find(g => g.id === 'eat') ?? { id: 'eat' as const, title: eatTitle, rows: [] };
  const order = BROWSE_GROUPS.map(g => g.id);
  const groups = [...kept.filter(g => g.id !== 'eat'), { ...eat, rows: [...eat.rows, ...rows] }]
    .filter(g => g.rows.length > 0)
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  return { groups, partial: false };
}
