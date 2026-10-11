import { allergiesOf, recommendable, type AllergenTags } from '@/food/allergens';
import { foodById, ingredientByKey } from '@/food/data';
import type { Food } from '@/food/types';
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
}

const dishPart = (f: Food): Part => ({ patterns: f.patterns, words: f.words, ...f.allergens });

/** A component's foods: its dishes and the ingredients it names apart from them (H7-02). `undefined` for one the table lacks. */
function partsOf(mapped: ComponentFoods): (Part | undefined)[] {
  return [
    ...mapped.dishes.map(id => {
      const f = foodById(id);
      return f && dishPart(f);
    }),
    ...(mapped.also ?? []).map(key => {
      const i = ingredientByKey(key);
      return i && { patterns: i.patterns, words: i.words, contains: i.contains, mayContain: i.mayContain, complete: !i.blend };
    }),
  ];
}

/**
 * Whether a template suits an eating pattern. A Jain plate is a vegetarian
 * one whose words name nothing Jain cooking leaves out, and whose dishes
 * all suit it (D100). Other patterns are as the templates were written.
 */
export function suits(meal: MealTemplate, pattern?: Pattern): boolean {
  const p = mealPattern(pattern);
  if (p === undefined) return true;
  if (!meal.patterns.includes(p)) return false;
  if (pattern !== 'jain') return true;
  if ([...ownWords(meal, pattern)].some(w => JAIN_WORDS.has(w))) return false;
  return componentsFor(meal, pattern).every(c => partsOf(dishesOf(meal, c) ?? { dishes: [] }).every(part => part?.patterns.includes('jain') === true));
}

/**
 * A template's allergen tags (B-13): its components' dishes and the
 * ingredients they name, what a component with no dish may carry, and every
 * word it and its dishes go by. A component the map doesn't know leaves the
 * template not fully tagged.
 */
export function mealTags(meal: MealTemplate, pattern?: Pattern): AllergenTags {
  const contains = new Set<AllergenId>();
  const may = new Set<AllergenId>();
  const words = ownWords(meal, pattern);
  let complete = true;
  for (const c of componentsFor(meal, pattern)) {
    const mapped = dishesOf(meal, c);
    if (!mapped) {
      complete = false;
      continue;
    }
    for (const a of mapped.mayContain ?? []) may.add(a);
    for (const part of partsOf(mapped)) {
      if (!part) {
        complete = false;
        continue;
      }
      for (const a of part.contains) contains.add(a);
      for (const a of part.mayContain) may.add(a);
      if (!part.complete) complete = false;
      for (const w of part.words) words.add(w);
    }
  }
  return { contains: [...contains], mayContain: [...may].filter(a => !contains.has(a)), complete, words: [...words] };
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
