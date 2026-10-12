/**
 * What turning a habit on asks for, and what counts as a usable answer.
 *
 * Only the minimum: a glass size and how often for water, how often for
 * sitting breaks, which meals for walks. The starting values are when a
 * reminder may show — the sitting interval is ADA's every 30 minutes — never
 * an amount anyone should drink. There is no default water goal at all.
 */

import type { HabitSettings, Meal } from '@/types/habits';
import type { UserProfile } from '@/types/profile';
import { windowTimes, type HabitId } from '@/reminders/schedule';
import { fluidRestriction } from '@/reminders/water';
import { parseClock } from '@/reminders/time';

export const GLASS_SIZES = [150, 200, 250, 300] as const;
export const WATER_EVERY = [60, 90, 120, 180] as const;
export const SITTING_EVERY = [30, 45, 60] as const;

type Water = NonNullable<HabitSettings['water']>;
type Sitting = NonNullable<HabitSettings['sittingBreak']>;

export const DEFAULT_WATER: Omit<Water, 'enabled'> = { glassMl: 250, everyMinutes: 120, from: '09:00', to: '21:00' };
export const DEFAULT_SITTING: Omit<Sitting, 'enabled'> = { everyMinutes: 30, from: '09:00', to: '18:00' };
export const DEFAULT_FINISH: Record<Meal, string> = { breakfast: '08:30', lunch: '13:30', dinner: '20:30' };
export const DEFAULT_QUIET = { from: '22:00', to: '07:00' };

/** The bounds a typed water goal must fall in, to catch a slipped digit. */
export const GOAL_MIN_ML = 100;
export const GOAL_MAX_ML = 10_000;

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

/** The optional daily goal, as typed. Empty is no goal, which is the default. */
export function parseGoal(text: string): Parsed<number | undefined> {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: true, value: undefined };
  if (!/^\d+$/.test(trimmed)) return { ok: false, message: 'Enter the goal as a whole number of ml, or leave it empty.' };
  const value = Number(trimmed);
  if (value < GOAL_MIN_ML || value > GOAL_MAX_ML) {
    return { ok: false, message: `Enter a goal between ${GOAL_MIN_ML} and ${GOAL_MAX_ML.toLocaleString()} ml, or leave it empty.` };
  }
  return { ok: true, value };
}

/** Why a from–to window cannot hold a reminder, or `undefined` when it can. */
export function windowProblem(from: string, to: string, everyMinutes: number): string | undefined {
  if (parseClock(from) === undefined || parseClock(to) === undefined) return 'Choose a start and an end time.';
  if (from === to) return 'Choose an end time different from the start.';
  if (windowTimes(from, to, everyMinutes).length === 0) return 'That window is shorter than the gap between reminders. Choose a later end, or a shorter gap.';
  return undefined;
}

/** Why a meal-walk choice is not complete, or `undefined` when it is. */
export function mealProblem(meals: readonly Meal[], finish: Partial<Record<Meal, string>>): string | undefined {
  if (meals.length === 0) return 'Choose at least one meal.';
  if (meals.some(meal => parseClock(finish[meal]) === undefined)) return 'Choose when you usually finish each meal.';
  return undefined;
}

/**
 * Whether a habit has been set up before, so its switch can turn it straight
 * back on. Water also needs the fluid-limit question answered "no", on the
 * profile or in an answer kept from before: a setting that arrived some other
 * way (an imported file) has not been asked it.
 */
export function isSetUp(habits: HabitSettings | undefined, habit: HabitId, profile?: UserProfile): boolean {
  switch (habit) {
    case 'water': {
      const water = habits?.water;
      return fluidRestriction(profile, habits) === false && !!water && !windowProblem(water.from, water.to, water.everyMinutes);
    }
    case 'sittingBreak': {
      const sitting = habits?.sittingBreak;
      return !!sitting && !windowProblem(sitting.from, sitting.to, sitting.everyMinutes);
    }
    case 'mealWalk': {
      const walk = habits?.mealWalk;
      return !!walk && !mealProblem(walk.meals, walk.finish ?? {});
    }
  }
}

/** The habits with one turned on or off, its setup kept for next time. */
export function withEnabled(habits: HabitSettings, habit: HabitId, enabled: boolean): HabitSettings {
  switch (habit) {
    case 'water':
      return habits.water ? { ...habits, water: { ...habits.water, enabled } } : habits;
    case 'sittingBreak':
      return habits.sittingBreak ? { ...habits, sittingBreak: { ...habits.sittingBreak, enabled } } : habits;
    case 'mealWalk':
      return habits.mealWalk ? { ...habits, mealWalk: { ...habits.mealWalk, enabled } } : habits;
  }
}
