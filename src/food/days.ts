/**
 * Meals by day (journey §11.2): Today, This week, and the daily series a Food
 * trend would draw. A partial total stays labelled partial, and counts-free
 * gives no figure at all (B-11, B-12).
 *
 * Kept free of the food table: Home imports this file.
 */
import { addDays, mondayOf } from '@/screens/track/periods';
import { FOOD_COPY } from './copy';
import { totalsOf, type Totals } from './estimate';
import { kcalText } from './format';
import type { NumbersView } from './level';
import type { MealRecord } from './types';

/** One day's meals, in the order they were eaten. */
export function mealsOn(meals: readonly MealRecord[], day: string): MealRecord[] {
  return meals.filter(m => m.day === day).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

export interface DayFood {
  day: string;
  meals: number;
  /** Only when numbers are shown and the day has a meal. */
  totals?: Totals;
}

/** Monday to Sunday of the week holding `day`. */
export function weekFood(meals: readonly MealRecord[], day: string, view: NumbersView): DayFood[] {
  const monday = mondayOf(day);
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i);
    const list = mealsOn(meals, d);
    return { day: d, meals: list.length, ...(view.show && list.length > 0 ? { totals: totalsOf(list.flatMap(m => m.items)) } : {}) };
  });
}

/** "Bhel puri", "Bhel puri and thepla", or "3 items": what has no calorie estimate. */
function noKcal(t: Totals): string | undefined {
  const names = t.missing.filter(m => m.kcal).map(m => m.name);
  if (names.length === 0) return undefined;
  const who = names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.length} items`;
  return `${who} ${names.length === 1 ? 'has' : 'have'} no calorie estimate`;
}

/**
 * "2 meals · Estimated 1,460 kcal in logged foods" (journey §11.2), labelled
 * partial and naming what has no figure: "· Partial: Bhel puri has no calorie
 * estimate" (A-17, H7-14). Only when numbers are shown.
 */
export function dayLine(d: DayFood): string {
  const parts = [FOOD_COPY.mealsCount(d.meals)];
  const unknown = d.totals ? noKcal(d.totals) : undefined;
  if (d.totals && d.totals.withKcal > 0) parts.push(`Estimated ${kcalText(d.totals.kcal)} in logged foods`, ...(unknown ? [`Partial: ${unknown}`] : []));
  else if (unknown) parts.push(unknown);
  return parts.join(' · ');
}

export interface DailyNutrition {
  day: string;
  meals: number;
  /** Items with no figure, so a partial day is never drawn as a whole one. */
  missing: number;
  kcal?: number;
  carbsG?: number;
}

/** Per day from `from` to `to`, inclusive: Plan 3's chart reads this for a Food trend. */
export function dailyNutrition(meals: readonly MealRecord[], from: string, to: string, view: NumbersView): DailyNutrition[] {
  const out: DailyNutrition[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const list = mealsOn(meals, d);
    const t = totalsOf(list.flatMap(m => m.items));
    out.push({
      day: d, meals: list.length, missing: t.missing.length,
      ...(view.show && t.withKcal > 0 ? { kcal: t.kcal } : {}),
      ...(view.show && t.withCarbs > 0 ? { carbsG: t.carbsG } : {}),
    });
  }
  return out;
}
