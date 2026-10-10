/**
 * Setup's food answers, as meal ideas read them until Plan 7 tags each recipe
 * (board D82): the words that name each allergen, the words a Jain plate
 * leaves out, the pattern v1's templates were written for, and Meal ideas'
 * own question merged into what setup stored.
 *
 * Matching is by word against each idea's own names and parts (`isAvoided`),
 * as v1 matched "Leave out". Words can't see an ingredient an idea doesn't
 * name, which is why Plan 7 replaces them with recipe tags (its Task 7). The
 * branch ships only after Plan 7 (B-22).
 */
import type { AllergenId, FoodPattern, FoodPreferences } from '@/types/profile';
import type { Region } from './schema';
import { tokens } from './text';

/** Words that name each allergen, in English, Hinglish and Hindi. A meal idea that says any of them is left out. */
export const ALLERGEN_TERMS: Record<AllergenId, readonly string[]> = {
  // "Nuts" in a meal idea may be peanuts.
  peanut: ['peanut', 'groundnut', 'moongphali', 'mungfali', 'nut', 'मूंगफली'],
  treeNut: ['nut', 'almond', 'badam', 'cashew', 'kaju', 'walnut', 'akhrot', 'pistachio', 'pista', 'hazelnut', 'pecan', 'बादाम', 'काजू'],
  milk: [
    'milk', 'dairy', 'lactose', 'curd', 'dahi', 'yogurt', 'yoghurt', 'paneer', 'cheese', 'ghee', 'butter', 'buttermilk', 'cream',
    'khoya', 'doodh', 'raita', 'chaas', 'lassi', 'thayir', 'दूध', 'दही', 'पनीर', 'घी',
  ],
  egg: ['egg', 'anda', 'omelette', 'अंडा'],
  wheat: ['wheat', 'gluten', 'atta', 'maida', 'sooji', 'suji', 'rava', 'semolina', 'dalia', 'daliya', 'गेहूं'],
  soy: ['soy', 'soya', 'soybean', 'tofu'],
  // "Seeds" in a meal idea may be sesame.
  sesame: ['sesame', 'til', 'gingelly', 'seed', 'तिल'],
  fish: ['fish', 'seafood', 'machli', 'machhli', 'meen', 'मछली'],
  shellfish: ['shellfish', 'seafood', 'prawn', 'shrimp', 'jhinga', 'crab', 'lobster', 'squid', 'clam', 'oyster', 'mussel', 'झींगा'],
  mustard: ['mustard', 'rai', 'sarson', 'सरसों', 'राई'],
};

/** Words a Jain plate leaves out: root vegetables and bulbs, eggs, fish, meat and honey, in English, Hinglish and Hindi (board D82). */
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

const phrase = (text: string) => tokens(text).join(' ');
const NAMES = (Object.entries(ALLERGEN_TERMS) as [AllergenId, readonly string[]][]).map(([id, terms]) => ({ id, names: new Set(terms.map(phrase)) }));

/** The canonical allergens a person's own words are one of the names of: "Groundnuts" is peanut. */
function named(entry: string): AllergenId[] {
  const said = phrase(entry);
  return said === '' ? [] : NAMES.filter(n => n.names.has(said)).map(n => n.id);
}

/**
 * Everything meal ideas leave out for this person, as words, in this order:
 * the foods they typed (v1's "Leave out", then allergies in their own
 * words), the words of each allergen, and Jain's rule.
 */
export function leaveOut(food: FoodPreferences | undefined): string[] {
  if (!food) return [];
  const custom = food.customAllergies ?? [];
  const allergens = [...new Set([...(food.allergies ?? []), ...custom.flatMap(named)])];
  return [...new Set([
    ...food.avoid,
    ...custom,
    ...allergens.flatMap(id => ALLERGEN_TERMS[id]),
    ...(food.pattern === 'jain' ? JAIN_LEAVES_OUT : []),
  ])];
}

/**
 * Meal ideas' own food question, answered: it changes what it asks and keeps
 * the rest of what was stored (setup's allergies, the logging level, the
 * screening answer).
 */
export function withPicked(food: FoodPreferences | undefined, picked: { pattern: FoodPattern; avoid: string[]; region: Region | 'any' }): FoodPreferences {
  const next: FoodPreferences = { ...food, pattern: picked.pattern, avoid: picked.avoid };
  if (picked.region === 'any') delete next.region;
  else next.region = picked.region;
  return next;
}
