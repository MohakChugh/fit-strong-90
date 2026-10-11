/**
 * The words estimates are shown in (journey §11.4): "Estimated" before every
 * figure, carbs as a range with insulin or a sulfonylurea (K-22), partial
 * totals said to be "in logged foods", unknowns counted apart, and nothing
 * numeric at all unless the person chose estimates (B-11), on old records too.
 *
 * Kept free of the food table: Home and Today's log import this file.
 */
import type { TileLine } from '@/screens/home/tileLine';
import { formatClock } from '@/screens/track/format';
import type { FoodPreferences } from '@/types/profile';
import { estimateFood, itemCarbs, totalsOf, type ItemCarbs, type Totals } from './estimate';
import type { FoodLevel, NumbersView } from './level';
import type { Food, MealItem, MealRecord, Slot } from './types';
import { countText, portionText } from './units';

export const SLOT_LABEL: Record<Slot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack', dinner: 'Dinner' };

const fmt = (n: number) => n.toLocaleString('en-IN');
const to = (n: number, step: number, how: 'round' | 'floor' | 'ceil') => Math[how](n / step) * step;
const carbStep = (n: number) => (n < 10 ? 1 : 5);

/** "200 kcal": to the nearest 10, and under 10 said as such. */
export function kcalText(kcal: number): string {
  return kcal < 10 ? 'under 10 kcal' : `${fmt(to(kcal, 10, 'round'))} kcal`;
}

/** "45 g carbs": to the gram under 10 g, to 5 g above. */
export function carbsText(carbsG: number): string {
  return carbsG < 1 ? 'under 1 g carbs' : `${fmt(to(carbsG, carbStep(carbsG), 'round'))} g carbs`;
}

/** "about 30–60 g carbs" (K-22): the low end rounded down and the high end up, so it never narrows the estimate. */
export function carbsRangeText(c: { low: number; high: number }): string {
  if (c.high < 1) return 'under 1 g carbs';
  const low = to(c.low, carbStep(c.low), 'floor');
  const high = to(c.high, carbStep(c.high), 'ceil');
  return low === high ? `about ${fmt(low)} g carbs` : `about ${fmt(low)}–${fmt(high)} g carbs`;
}

/** An item's carbs: a range with ranges on, except the person's own figure, which is never one (board D132). */
function itemCarbsText(c: ItemCarbs, ranges: boolean): string {
  if (!ranges) return carbsText(c.g);
  return c.own ? `${fmt(Math.round(c.g))} g carbs, your own figure` : carbsRangeText(c);
}

/** One item's estimate in the tray, or nothing when numbers aren't shown. */
export function itemEstimate(item: MealItem, view: NumbersView): string | undefined {
  if (!view.show) return undefined;
  const carbs = itemCarbs(item);
  if (item.kcal === undefined && !carbs) return 'No estimate';
  const known = [item.kcal !== undefined ? kcalText(item.kcal) : undefined, carbs ? itemCarbsText(carbs, view.ranges) : undefined].filter(Boolean);
  const gap = item.kcal === undefined ? ' · no calorie estimate' : !carbs ? ' · no carb estimate' : '';
  return `Estimated ${known.join(' · ')}${gap}`;
}

export interface TotalsLines {
  /** "Estimated 620 kcal · 85 g carbs in logged foods". */
  estimate?: string;
  /** "2 items have no estimate". */
  missing?: string;
}

/**
 * A meal's or a day's totals (journey §11.2, A-17). With ranges on, the
 * table's foods are a range and the person's own figures are named apart,
 * never added into it (board D132): "Estimated about 30–50 g carbs in logged
 * foods, plus 40 g from foods you entered yourself".
 */
export function totalsLines(t: Totals, view: NumbersView): TotalsLines {
  if (!view.show || t.items === 0) return {};
  const ranged = view.ranges && t.withCarbRange > 0 ? carbsRangeText({ low: t.carbsLowG, high: t.carbsHighG }) : undefined;
  const carbs = view.ranges ? ranged : t.withCarbs > 0 ? carbsText(t.carbsG) : undefined;
  const parts = [t.withKcal > 0 ? kcalText(t.kcal) : undefined, carbs].filter(Boolean);
  const base = parts.length > 0 ? `Estimated ${parts.join(' · ')} in logged foods` : undefined;
  const ownG = `${fmt(Math.round(t.ownCarbsG))} g`;
  const own = !view.ranges || t.withOwnCarbs === 0 ? undefined
    : !base ? `${ownG} carbs from foods you entered yourself`
      : ranged ? `plus ${ownG} from foods you entered yourself`
        : `plus ${ownG} carbs from foods you entered yourself`;
  const estimate = [base, own].filter(Boolean).join(', ');
  const say = (n: number, what: string) => `${n} ${n === 1 ? 'item has' : 'items have'} no ${what}`;
  const none = t.missing.filter(m => m.kcal && m.carbs).length;
  const noCarbs = t.missing.filter(m => m.carbs && !m.kcal).length;
  const noKcal = t.missing.filter(m => m.kcal && !m.carbs).length;
  const missing = [none > 0 && say(none, 'estimate'), noCarbs > 0 && say(noCarbs, 'carb estimate'), noKcal > 0 && say(noKcal, 'calorie estimate')].filter(Boolean).join(' · ');
  return { ...(estimate ? { estimate } : {}), ...(missing ? { missing } : {}) };
}

/** "Roti ×2 · Toor dal ×1½ · Bhel puri". */
export function itemsLine(items: readonly MealItem[]): string {
  return items.map(i => (i.kind === 'quick' || i.count === 1 ? i.name : `${i.name} ×${countText(i.count)}`)).join(' · ');
}

/** A logged meal's line in Today's log and the hub: "1:10 pm · Roti ×2", with its estimate when numbers are shown. */
export function mealRowDetail(meal: Pick<MealRecord, 'at' | 'items'>, view: NumbersView, hour12: boolean): string {
  const parts = [formatClock(meal.at, hour12), itemsLine(meal.items)];
  if (view.show) {
    const t = totalsOf(meal.items);
    if (t.withKcal > 0) parts.push(`Estimated ${kcalText(t.kcal)}${t.missing.some(m => m.kcal) ? ' in logged foods' : ''}`);
  }
  return parts.join(' · ');
}

/** A food's line in a list: its standard portion, and its estimate when numbers are shown (B-11 covers search too). */
export function foodRowDetail(food: Pick<Food, 'portion' | 'per100g'>, view: NumbersView): string {
  const portion = portionText(food.portion, food.portion.count, food.portion.grams);
  if (!view.show) return portion;
  return `${portion} · Estimated ${kcalText(estimateFood(food, food.portion.count, food.portion.grams).kcal)}`;
}

/** Home's Food tile (journey §7.2): ideas, or how many meals today. Never a figure on Home. */
export function foodTileLine(level: FoodLevel, mealsToday: number): TileLine {
  if (level === 'ideas') return { text: 'Meal ideas for you', tone: 'normal' };
  if (mealsToday === 0) return { text: 'Log a meal · ideas for you', tone: 'normal' };
  return { text: `${mealsToday} ${mealsToday === 1 ? 'meal' : 'meals'} logged today`, tone: 'normal' };
}

/** A target the person's care team gave them, only with estimates (journey §11.5). No progress, no "left". */
export function careTeamLine(targets: FoodPreferences['careTeamTargets'], view: NumbersView): string | undefined {
  if (!view.show || !targets || (targets.kcal === undefined && targets.carbsG === undefined)) return undefined;
  const parts = [targets.kcal !== undefined ? `${fmt(targets.kcal)} kcal` : undefined, targets.carbsG !== undefined ? `${fmt(targets.carbsG)} g carbs` : undefined].filter(Boolean);
  return `From your care team: ${parts.join(' and ')} a day`;
}
