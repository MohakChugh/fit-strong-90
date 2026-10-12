/**
 * "Your usual" (journey §11.2–11.3, B-10): the same meal yesterday, then the
 * person's usual meals for it, at most three. Tapping one fills the tray, and
 * Save logs it: three taps from the Food tile.
 */
import { addDays } from '@/screens/track/periods';
import { FOOD_COPY } from './copy';
import { itemsLine, SLOT_LABEL } from './format';
import { slotAt } from './tray';
import type { MealItem, MealRecord, SavedMeal, Slot } from './types';

export const USUAL_MAX = 3;

const DAY = 24 * 60;
/** The main meals, in the day's order. */
const MAIN: readonly Slot[] = ['breakfast', 'lunch', 'dinner'];
/** The minute each main meal's time comes: where `slotAt` turns to it (dinner's in the evening, not after midnight). */
const FROM = new Map(MAIN.map(slot => {
  let m = 0;
  while (m < DAY && !(slotAt(m) === slot && slotAt((m + DAY - 1) % DAY) !== slot)) m += 1;
  return [slot, m] as const;
}));

/**
 * The meal usual meals are offered for (board D139, K7-07, K7R-05): the
 * latest main meal whose time has come today and that comes after every main
 * meal logged today, so lunch is still offered after 15:30, and a breakfast
 * skipped stays skipped once lunch is in. With none, the meal the clock
 * suggests. Snacks are optional, so one never stands in for a main meal.
 */
export function usualSlot(clockSlot: Slot, minuteOfDay: number, todays: readonly Pick<MealRecord, 'meal'>[]): Slot {
  const latest = Math.max(-1, ...todays.map(m => MAIN.indexOf(m.meal)));
  return MAIN.filter((slot, i) => i > latest && minuteOfDay >= FROM.get(slot)!).at(-1) ?? clockSlot;
}

export interface Usual {
  /** `yesterday:<meal id>` or `saved:<usual meal id>`: what `?usual=` opens the sheet with. */
  key: string;
  label: string;
  detail: string;
  meal: Slot;
  items: MealItem[];
}

const newestFirst = (a: string, b: string) => Date.parse(b) - Date.parse(a);

export function usualFor(slot: Slot, today: string, meals: readonly MealRecord[], saved: readonly SavedMeal[]): Usual[] {
  const yesterday = addDays(today, -1);
  const last = meals.filter(m => m.day === yesterday && m.meal === slot).sort((a, b) => newestFirst(a.at, b.at))[0];
  const out: Usual[] = [];
  if (last) out.push({ key: `yesterday:${last.id}`, label: FOOD_COPY.sameAsYesterday(SLOT_LABEL[slot]), detail: itemsLine(last.items), meal: slot, items: last.items });
  const mine = saved.filter(s => s.meal === undefined || s.meal === slot).sort((a, b) => newestFirst(a.updatedAt, b.updatedAt));
  for (const s of mine) out.push({ key: `saved:${s.id}`, label: s.name, detail: itemsLine(s.items), meal: slot, items: s.items });
  return out.slice(0, USUAL_MAX);
}
