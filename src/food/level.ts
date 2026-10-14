/**
 * How much the person logs, and what that lets the app show (journey §11.1,
 * §11.4, B-11). Every screen that could show a nutrition figure, or an energy
 * figure from movement, asks here first.
 *
 * Kept free of the food table: Home and the reminder host import this file.
 */
import { deriveHealth, profileGaps, takes } from '@/engine/health';
import type { FoodPreferences, UserProfile } from '@/types/profile';

export type FoodLevel = NonNullable<FoodPreferences['level']>;

/** The level the person chose. Nothing chosen is "meal ideas only" (A-20). */
export function foodLevel(food: FoodPreferences | undefined): FoodLevel {
  return food?.level ?? 'ideas';
}

/** Meals can be logged: "meals only, no numbers" or "with estimates". */
export function logsMeals(food: FoodPreferences | undefined): boolean {
  return foodLevel(food) !== 'ideas';
}

/**
 * Counts-free (B-11; board D101, D133): no calorie or carb figure and no
 * energy figure from movement anywhere, on old records too; no food prompts;
 * no numeric targets. It's "Meals only, no numbers", and also any level but
 * estimates once "Has food or weight ever been hard for you?" is answered
 * Yes or Prefer not to say: meal ideas only then shows no movement energy.
 */
export function countsFree(profile: Pick<UserProfile, 'food'> | undefined): boolean {
  const level = foodLevel(profile?.food);
  const hard = profile?.food?.hardBefore === 'yes' || profile?.food?.hardBefore === 'preferNot';
  return level === 'meals' || (hard && level !== 'estimates');
}

/**
 * Carbs as a range, with "Carb figures are rough estimates…" (K-22): with
 * insulin, a sulfonylurea or a meglitinide, or while the medicine answers
 * aren't known, which the engine reads as "may be taking one".
 */
export function carbRanges(profile: UserProfile | undefined): boolean {
  if (!profile || profile.needsHealthReview) return true;
  const h = profile.health;
  if (deriveHealth(h).hypoRisk || h.insulin !== 'none' || takes(h.sulfonylureaOrMeglitinide)) return true;
  return profileGaps(profile).medicinesUnknown;
}

/** What a food screen may show: nothing numeric, or estimates, with carbs as ranges or not. */
export type NumbersView = { show: false } | { show: true; ranges: boolean };

export function numbersView(profile: UserProfile | undefined): NumbersView {
  return foodLevel(profile?.food) === 'estimates' ? { show: true, ranges: carbRanges(profile) } : { show: false };
}

/** The answer to "Has food or weight ever been hard for you?", kept as `food.hardBefore` (board D102). */
export type ScreenAnswer = NonNullable<FoodPreferences['hardBefore']>;

/**
 * What to offer once that question is answered (journey §6.2 chapter 7,
 * §11.5): "No" goes straight to estimates; "Yes" or "Prefer not to say"
 * recommends meals only, and estimates stay available.
 */
export function afterScreening(answer: ScreenAnswer): { recommended: FoodLevel; others: FoodLevel[] } {
  return answer === 'no' ? { recommended: 'estimates', others: [] } : { recommended: 'meals', others: ['estimates'] };
}
