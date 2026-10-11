/**
 * What the "Log a meal" sheet opens with (journey §11.3): the meal by the
 * time of day, a past day's usual hour, a usual meal's items worked out again
 * from the table as it is now (B-12), a logged meal to correct, or a food's
 * portion page. Pure, and handed the clock, so a test can say what opens.
 */
import { refreshItem } from './estimate';
import type { LogRequest } from './links';
import { slotAt, type Lookup } from './tray';
import type { MealItem, MealRecord, SavedMeal, Slot } from './types';

/** A meal on a past day, before the person gives its time: that meal's usual hour. */
export const SLOT_HOUR: Record<Slot, string> = { breakfast: '08:30', lunch: '13:00', snack: '17:00', dinner: '20:30' };

export interface Draft {
  slot: Slot;
  items: MealItem[];
  /** The moment the meal stands for until the person changes it. Absent: the moment Save is tapped. */
  at?: string;
  /** A past day's meal: its time follows the meal chosen (`atOn`), until the person sets one (K7-12). */
  pastDay?: { day: string; offset: string };
  editing?: MealRecord;
  page: { kind: 'tray' } | { kind: 'portion'; foodId: string } | { kind: 'quick' };
  /** The meal the address names isn't stored any more. */
  gone?: true;
}

/** A past day's meal at that meal's usual hour, in this phone's offset. */
export function atOn(pastDay: { day: string; offset: string }, slot: Slot): string {
  return `${pastDay.day}T${SLOT_HOUR[slot]}:00.000${pastDay.offset}`;
}

/** `now` is ISO with this phone's offset (`nowAt()`). */
export function openDraft(r: LogRequest, ctx: { now: string; meals: readonly MealRecord[]; saved: readonly SavedMeal[]; look: Lookup }): Draft {
  if (r.edit) {
    const meal = ctx.meals.find(m => m.id === r.edit);
    if (meal) return { slot: meal.meal, items: meal.items, at: meal.at, editing: meal, page: { kind: 'tray' } };
  }
  const minute = Number(ctx.now.slice(11, 13)) * 60 + Number(ctx.now.slice(14, 16));
  let slot: Slot = r.meal ?? slotAt(minute);
  let items: MealItem[] = [];
  const sep = r.usual?.indexOf(':') ?? -1;
  const kind = r.usual && sep > 0 ? r.usual.slice(0, sep) : undefined;
  const id = r.usual && sep > 0 ? r.usual.slice(sep + 1) : undefined;
  if (kind === 'yesterday') {
    const m = ctx.meals.find(x => x.id === id);
    if (m) {
      items = m.items;
      slot = r.meal ?? m.meal;
    }
  }
  if (kind === 'saved') {
    const s = ctx.saved.find(x => x.id === id);
    if (s) {
      items = s.items;
      slot = r.meal ?? s.meal ?? slot;
    }
  }
  const today = ctx.now.slice(0, 10);
  const offset = /([+-]\d\d:\d\d|Z)$/.exec(ctx.now)?.[1] ?? 'Z';
  const pastDay = r.day && r.day < today ? { day: r.day, offset } : undefined;
  const at = pastDay ? atOn(pastDay, slot) : undefined;
  const page: Draft['page'] = r.food && ctx.look.food(r.food) ? { kind: 'portion', foodId: r.food } : r.quick ? { kind: 'quick' } : { kind: 'tray' };
  return {
    slot,
    items: items.map(i => (i.kind === 'food' ? refreshItem(i, ctx.look.food(i.foodId)) : i)),
    ...(at && pastDay ? { at, pastDay } : {}),
    page,
    ...(r.edit ? { gone: true as const } : {}),
  };
}
