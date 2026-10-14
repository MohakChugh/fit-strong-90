/**
 * Finding a food to add (journey §11.3): by name or alias as the person
 * types, their own foods first, and "Common Indian foods" for the meal when
 * nothing is typed. Pure; the sheet keeps the list still while a finger is on
 * it (M15).
 */
import { tokens } from '@/content/text';
import type { CustomFood, Food, ShelfId, Slot } from './types';

export const SHELVES: readonly { id: ShelfId; title: string }[] = [
  { id: 'breads', title: 'Roti and rice' },
  { id: 'breakfast', title: 'Breakfast' },
  { id: 'dal', title: 'Dal and curries' },
  { id: 'veg', title: 'Vegetables' },
  { id: 'sides', title: 'Curd, salads and chutneys' },
  { id: 'eggsMeat', title: 'Eggs, fish and chicken' },
  { id: 'snacks', title: 'Snacks' },
  { id: 'drinks', title: 'Drinks' },
  { id: 'fruit', title: 'Fruit' },
];

export const COMMON_MAX = 12;

/** How well names match the typed words: every word must, the last as a prefix. 3 is the whole name, 2 its start, 0 no match. */
function score(names: readonly string[], typed: readonly string[]): number {
  let best = 0;
  for (const name of names) {
    const words = tokens(name);
    const matches = typed.every((t, i) => words.some(w => (i === typed.length - 1 ? w.startsWith(t) : w === t)));
    if (!matches) continue;
    best = Math.max(best, words.join(' ') === typed.join(' ') ? 3 : words[0]?.startsWith(typed[0]) ? 2 : 1);
  }
  return best;
}

function ranked<T>(list: readonly T[], names: (x: T) => readonly string[], typed: readonly string[]): T[] {
  return list
    .map((x, i) => ({ x, i, s: score(names(x), typed) }))
    .filter(r => r.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map(r => r.x);
}

export interface FoodResults {
  customs: CustomFood[];
  foods: Food[];
}

export function searchFoods(query: string, foods: readonly Food[], customs: readonly CustomFood[]): FoodResults {
  const typed = tokens(query);
  if (typed.length === 0) return { customs: [], foods: [] };
  return { customs: ranked(customs, c => [c.name], typed), foods: ranked(foods, f => [f.name, ...f.aliases], typed) };
}

/** "Common Indian foods" for a meal: what's eaten at it, shelf by shelf, in the table's order. */
export function commonFoods(foods: readonly Food[], slot: Slot): Food[] {
  const shelf = (f: Food) => SHELVES.findIndex(s => s.id === f.shelf);
  return foods
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.slots.includes(slot))
    .sort((a, b) => shelf(a.f) - shelf(b.f) || a.i - b.i)
    .slice(0, COMMON_MAX)
    .map(({ f }) => f);
}
