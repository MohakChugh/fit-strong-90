import type { FoodPreferences } from '@/types/profile';
import { MEALS } from './meals';
import type { MealComponent, MealTemplate, Pattern, Slot } from './schema';
import { tokens } from './text';

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** The parts of a meal this person eats: a vegan's plate has no dahi. */
export function componentsFor(meal: MealTemplate, pattern?: Pattern): MealComponent[] {
  return pattern ? meal.components.filter(c => !c.notFor?.includes(pattern)) : meal.components;
}

export function suits(meal: MealTemplate, pattern?: Pattern): boolean {
  return pattern === undefined || meal.patterns.includes(pattern);
}

/**
 * Whether the person asked to leave out something in this meal. Matching is
 * by word, after the same plural folding search uses, against the meal's
 * names and every component they would eat — so "peanut" hides poha with
 * peanuts, and "curd" hides a dahi side, while "nut" does not hide coconut.
 */
export function isAvoided(meal: MealTemplate, avoid: readonly string[] = [], pattern?: Pattern): boolean {
  if (avoid.length === 0) return false;
  const words = new Set(
    [meal.name, ...meal.aliases, ...componentsFor(meal, pattern).flatMap(c => [c.name, ...(c.aliases ?? [])])]
      .flatMap(tokens),
  );
  return avoid.some(term => {
    const wanted = tokens(term);
    return wanted.length > 0 && wanted.every(w => words.has(w));
  });
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
 * out. With a region, dishes familiar there come first and every other dish
 * still follows, so a preference narrows the order, never the choice.
 */
export function mealsFor(food?: FoodPreferences, slot?: Slot): MealTemplate[] {
  const pool = MEALS.filter(m =>
    (slot === undefined || m.slot === slot)
    && suits(m, food?.pattern)
    && !isAvoided(m, food?.avoid, food?.pattern));
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
