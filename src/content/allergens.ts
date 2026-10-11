/**
 * The food choices meal ideas read beside the recipe tags: the words a
 * Jain plate leaves out (board D100), the pattern v1's templates were
 * written for, and the picker's answers merged into what setup stored.
 * Allergens are matched by each idea's recipe tags (`@/food/allergens`,
 * B-13), which replaced Plan 5's interim word lists.
 */
import type { AllergenId, FoodPattern, FoodPreferences } from '@/types/profile';
import type { Region } from './schema';

/** Words a Jain plate leaves out (D100): root vegetables and bulbs, eggs, fish, meat and honey, in English, Hinglish and Hindi. */
export const JAIN_LEAVES_OUT: readonly string[] = [
  'onion', 'kanda', 'pyaz', 'pyaaz', 'garlic', 'lahsun', 'lehsun', 'potato', 'aloo', 'alu', 'batata', 'carrot', 'gajar',
  'beetroot', 'beet', 'radish', 'mooli', 'ginger', 'adrak', 'yam', 'arbi', 'egg', 'anda', 'fish', 'machli', 'chicken',
  'murgh', 'murga', 'meat', 'mutton', 'prawn', 'honey', 'shahad',
  'प्याज', 'लहसुन', 'आलू', 'अदरक', 'गाजर', 'मूली', 'अंडा', 'मछली', 'शहद',
];

/** The pattern v1's meal templates are tagged with: Jain food is chosen from the vegetarian ones. */
export function mealPattern(p: FoodPattern | undefined): Exclude<FoodPattern, 'jain'> | undefined {
  return p === 'jain' ? 'vegetarian' : p;
}

/**
 * Meal ideas' own food question, answered: it changes what it asks and
 * keeps the rest of what was stored (the level, the screening answer, a
 * target). The picker's allergies replace the stored ones when it gives them.
 */
export function withPicked(food: FoodPreferences | undefined, picked: {
  pattern: FoodPattern;
  avoid: string[];
  region: Region | 'any';
  allergies?: AllergenId[];
  customAllergies?: string[];
}): FoodPreferences {
  const next: FoodPreferences = { ...food, pattern: picked.pattern, avoid: picked.avoid };
  if (picked.region === 'any') delete next.region;
  else next.region = picked.region;
  // Kept even when empty: setup reads an empty list as "answered: none".
  if (picked.allergies !== undefined) next.allergies = [...picked.allergies];
  if (picked.customAllergies !== undefined) {
    if (picked.customAllergies.length > 0) next.customAllergies = [...picked.customAllergies];
    else delete next.customAllergies;
  }
  return next;
}
