/**
 * Addresses into Food (journey §11.3): the "Log a meal" sheet, opened for a
 * meal, a past day, a usual meal, a food, Quick add, or a meal to correct.
 * Pure and free of the food table: the reminder banner and Today's log link here.
 */
import { isDay } from '@/health/observation';
import type { Slot } from './types';

export interface LogRequest {
  meal?: Slot;
  /** A past day, from Today's log. */
  day?: string;
  /** A logged meal to correct. */
  edit?: string;
  /** A "Your usual" key (`usual.ts`). */
  usual?: string;
  /** A food's portion page. */
  food?: string;
  quick?: true;
}

const SLOTS: readonly string[] = ['breakfast', 'lunch', 'snack', 'dinner'];

export function logHref(r: LogRequest = {}): string {
  const q = new URLSearchParams();
  if (r.edit) q.set('edit', r.edit);
  if (r.meal) q.set('meal', r.meal);
  if (r.day) q.set('day', r.day);
  if (r.usual) q.set('usual', r.usual);
  if (r.food) q.set('food', r.food);
  if (r.quick) q.set('quick', '1');
  const s = q.toString();
  return `/hub/food/log${s ? `?${s}` : ''}`;
}

/** What an address asks for. Anything it can't read is left out, never guessed. */
export function logRequest(search: string): LogRequest {
  const q = new URLSearchParams(search);
  const text = (k: string) => {
    const v = q.get(k);
    return v && v.length <= 200 ? v : undefined;
  };
  const meal = q.get('meal');
  const day = q.get('day');
  const edit = text('edit');
  const usual = text('usual');
  const food = text('food');
  return {
    ...(meal && SLOTS.includes(meal) ? { meal: meal as Slot } : {}),
    ...(day && isDay(day) ? { day } : {}),
    ...(edit ? { edit } : {}),
    ...(usual ? { usual } : {}),
    ...(food ? { food } : {}),
    ...(q.get('quick') === '1' ? { quick: true as const } : {}),
  };
}
