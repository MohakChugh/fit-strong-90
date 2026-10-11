import { allergiesOf, recommendable, resolveAllergens, type AllergenTags } from '@/food/allergens';
import { FOOD_DATA, foodById, ingredientByKey } from '@/food/data';
import type { Food, FoodIngredient } from '@/food/types';
import type { AllergenId, FoodPreferences } from '@/types/profile';
import { JAIN_LEAVES_OUT, mealPattern } from './allergens';
import { MEALS } from './meals';
import { componentKey, MEAL_DISHES, type ComponentFoods } from './mealDishes';
import type { MealComponent, MealTemplate, Pattern, Slot } from './schema';
import { tokens } from './text';

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** The folded words a Jain plate leaves out. */
const JAIN_WORDS = new Set(JAIN_LEAVES_OUT.flatMap(tokens));

/** The parts of a meal this person eats: a vegan's plate has no dahi. */
export function componentsFor(meal: MealTemplate, pattern?: Pattern): MealComponent[] {
  const p = mealPattern(pattern);
  return p ? meal.components.filter(c => !c.notFor?.includes(p)) : meal.components;
}

/** Every word a template, and the components this person would eat, go by. */
function ownWords(meal: MealTemplate, pattern?: Pattern): Set<string> {
  return new Set([meal.name, ...meal.aliases, ...componentsFor(meal, pattern).flatMap(c => [c.name, ...(c.aliases ?? [])])].flatMap(tokens));
}

/** The dishes a component this person eats is, from the map. */
const dishesOf = (meal: MealTemplate, c: MealComponent) => MEAL_DISHES[componentKey(meal.id, c.name)];

/** What meal ideas read of a dish, or of an ingredient a component names apart from its dishes. */
interface Part {
  patterns: readonly Pattern[];
  words: readonly string[];
  contains: readonly AllergenId[];
  mayContain: readonly AllergenId[];
  complete: boolean;
  named: boolean;
}

const dishPart = (f: Food): Part => ({ patterns: f.patterns, words: f.words, ...f.allergens });
const ingredientPart = (i: FoodIngredient): Part =>
  ({ patterns: i.patterns, words: i.words, contains: i.contains, mayContain: i.mayContain, complete: true, named: !i.blend });

/**
 * A dish made with other ingredients in place of some of its own (a vegan
 * plate's sunflower oil for ghee, H7-20): read from the ingredients, as the
 * table reads the dish itself. `undefined` if one isn't in the table.
 */
function madeWith(f: Food, swaps: Readonly<Record<string, string>>): Part | undefined {
  const used = f.recipe.ingredients.map(r => ingredientByKey(swaps[r.key] ?? r.key));
  if (used.some(i => i === undefined)) return undefined;
  const parts = (used as FoodIngredient[]).map(ingredientPart);
  const contains = [...new Set(parts.flatMap(x => x.contains))];
  return {
    // A pattern suits the dish when it suits every ingredient (as patternsOf reads a recipe).
    patterns: parts.reduce<readonly Pattern[]>((ok, x) => ok.filter(q => x.patterns.includes(q)), parts[0]?.patterns ?? []),
    words: [...new Set([...[f.name, ...f.aliases].flatMap(tokens), ...parts.flatMap(x => x.words)])],
    contains,
    mayContain: [...new Set(parts.flatMap(x => x.mayContain))].filter(a => !contains.includes(a)),
    complete: true,
    named: parts.every(x => x.named),
  };
}

/**
 * A component's foods as this person's plate makes them: its dishes (with
 * the map's vegan swaps, for a vegan) and the ingredients it names apart from
 * them (H7-02, H7-20). `undefined` for one the table lacks.
 */
function partsOf(mapped: ComponentFoods, pattern?: Pattern): (Part | undefined)[] {
  const swaps = pattern === 'vegan' ? mapped.vegan : undefined;
  return [
    ...mapped.dishes.map(id => {
      const f = foodById(id);
      if (!f) return undefined;
      return swaps ? madeWith(f, swaps) : dishPart(f);
    }),
    ...(mapped.also ?? []).map(key => {
      const i = ingredientByKey(key);
      return i && ingredientPart(i);
    }),
  ];
}

/**
 * Whether a template suits an eating pattern: the template is written for
 * it, and every recipe behind each part the person eats, as their plate
 * makes it, suits it too (H7-20). A Jain plate's words also name nothing
 * Jain cooking leaves out (D100). A part the map doesn't know, or a dish the
 * table lacks, never suits a pattern (K7-18). Every food suits a
 * non-vegetarian plate.
 */
export function suits(meal: MealTemplate, pattern?: Pattern): boolean {
  const p = mealPattern(pattern);
  if (p === undefined || pattern === undefined) return true;
  if (!meal.patterns.includes(p)) return false;
  if (pattern === 'nonVegetarian') return true;
  if (pattern === 'jain' && [...ownWords(meal, pattern)].some(w => JAIN_WORDS.has(w))) return false;
  return componentsFor(meal, pattern).every(c => {
    const mapped = dishesOf(meal, c);
    return mapped !== undefined && partsOf(mapped, pattern).every(part => part?.patterns.includes(pattern) === true);
  });
}

/** The swaps a vegan plate makes in this idea's recipes, as the map says (H7-20): "sunflower oil instead of ghee". */
export function veganSwaps(meal: MealTemplate, pattern?: Pattern): { from: string; to: string }[] {
  if (pattern !== 'vegan') return [];
  const seen = new Map<string, { from: string; to: string }>();
  for (const c of componentsFor(meal, pattern)) {
    const mapped = dishesOf(meal, c);
    for (const [from, to] of Object.entries(mapped?.vegan ?? {})) {
      const made = mapped!.dishes.some(id => foodById(id)?.recipe.ingredients.some(r => r.key === from));
      const a = ingredientByKey(from);
      const b = ingredientByKey(to);
      if (made && a && b) seen.set(`${from}>${to}`, { from: a.name.toLowerCase(), to: b.name.toLowerCase() });
    }
  }
  return [...seen.values()];
}

/**
 * A template's allergen tags (B-13): its components' dishes and the
 * ingredients they name, what a component with no dish may carry, and every
 * word it and its dishes go by. A component the map doesn't know, or whose
 * make-up isn't established, leaves the template not fully tagged (H7-03).
 */
export function mealTags(meal: MealTemplate, pattern?: Pattern): AllergenTags {
  const contains = new Set<AllergenId>();
  const may = new Set<AllergenId>();
  const words = ownWords(meal, pattern);
  let complete = true;
  let named = true;
  for (const c of componentsFor(meal, pattern)) {
    const mapped = dishesOf(meal, c);
    if (!mapped) {
      complete = named = false;
      continue;
    }
    for (const a of mapped.mayContain ?? []) may.add(a);
    if (mapped.unknown) complete = named = false;
    for (const part of partsOf(mapped, pattern)) {
      if (!part) {
        complete = named = false;
        continue;
      }
      for (const a of part.contains) contains.add(a);
      for (const a of part.mayContain) may.add(a);
      if (!part.complete) complete = false;
      if (!part.named) named = false;
      for (const w of part.words) words.add(w);
    }
  }
  return { contains: [...contains], mayContain: [...may].filter(a => !contains.has(a)), complete, named, words: [...words] };
}

/**
 * Whether the person asked to leave out something in this meal. Matching is
 * by word, after the same plural folding search uses, against the meal's
 * names and every component they would eat, as in v1: "peanut" hides poha
 * with peanuts, "nut" doesn't hide coconut, and "coconut milk" names no
 * meal (audit R04). Only an allergy goes into each dish's ingredients (D99).
 */
export function isAvoided(meal: MealTemplate, avoid: readonly string[] = [], pattern?: Pattern): boolean {
  if (avoid.length === 0) return false;
  const words = ownWords(meal, pattern);
  return avoid.some(term => {
    const wanted = tokens(term);
    return wanted.length > 0 && wanted.every(w => words.has(w));
  });
}

/** Every filter for one person (A-16, B-13): the pattern, the foods they leave out, and their allergies. */
export function mealAllowed(meal: MealTemplate, food?: FoodPreferences): boolean {
  return suits(meal, food?.pattern)
    && !isAvoided(meal, food?.avoid, food?.pattern)
    && recommendable(mealTags(meal, food?.pattern), allergiesOf(food));
}

/**
 * The "leave out" entries that hid nothing: no meal this pattern would see
 * matches them, by the same per-meal test the filter uses. Shown to the
 * person, so a misspelling, a dish no single meal contains ("peanut chutney")
 * or a language the meals do not know never passes for a successful
 * exclusion (Codex content audit F21, re-check R04).
 */
export function unmatchedAvoid(avoid: readonly string[] = [], pattern?: Pattern): string[] {
  const pool = MEALS.filter(m => suits(m, pattern));
  return avoid.filter(term => !pool.some(m => isAvoided(m, [term], pattern)));
}

/** Each food's and ingredient's own words, worked out once: the words an allergy in a person's own words is matched against. */
let foodWords: Set<string>[] | undefined;

/**
 * What an allergy in the person's own words is read as (K7R-02; board D180): the allergens its words name
 * ("chaach" is milk), or, when none does and no one food or ingredient of ours goes by all its words, `unknown`:
 * it can't keep a meal out by itself, so the person checks every meal. Nothing: our foods' words find it, as written.
 */
export function ownAllergyReading(entry: string): { allergens: AllergenId[] } | 'unknown' | undefined {
  const allergens = resolveAllergens(entry);
  if (allergens.length > 0) return { allergens };
  // No words at all is in every food, vacuously: nothing to say.
  const wanted = tokens(entry);
  foodWords ??= [...FOOD_DATA.foods, ...FOOD_DATA.ingredients].map(f => new Set(f.words));
  return foodWords.some(words => wanted.every(w => words.has(w))) ? undefined : 'unknown';
}

/**
 * Meals for the person's food pattern, without anything they asked to leave
 * out or are allergic to (`mealAllowed`). With a region, dishes familiar
 * there come first and every other dish still follows, so a preference
 * narrows the order, never the choice.
 */
export function mealsFor(food?: FoodPreferences, slot?: Slot): MealTemplate[] {
  const pool = MEALS.filter(m => (slot === undefined || m.slot === slot) && mealAllowed(m, food));
  const region = food?.region && food.region !== 'mixed' ? food.region : undefined;
  if (!region) return pool;
  const local = pool.filter(m => m.regions?.includes(region));
  return [...local, ...pool.filter(m => !local.includes(m))];
}

export interface SampleDay {
  day: Weekday;
  /** Absent when nothing is left for that slot after the person's exclusions. */
  meals: Partial<Record<Slot, MealTemplate>>;
}

const SLOT_ORDER: Slot[] = ['breakfast', 'lunch', 'snack', 'dinner'];

/**
 * A week assembled from the meal templates and nothing else, so it adds no
 * claim the templates do not already carry. Each slot walks its list in order,
 * which keeps any two days in a row different whenever there are two or more
 * options, and starts with regional dishes when a region was chosen.
 */
export function sampleWeek(food: FoodPreferences): SampleDay[] {
  const pools = new Map(SLOT_ORDER.map(slot => [slot, mealsFor(food, slot)]));
  return WEEKDAYS.map((day, i) => {
    const meals: Partial<Record<Slot, MealTemplate>> = {};
    for (const slot of SLOT_ORDER) {
      const pool = pools.get(slot) ?? [];
      if (pool.length > 0) meals[slot] = pool[i % pool.length];
    }
    return { day, meals };
  });
}
