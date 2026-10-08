/**
 * What the Walk setup screen offers, and how its choices travel to the live
 * screen. They travel in the address (`/walk/live?…`) because the start goes
 * through the shared check-in gate, which may show its sheet before it
 * navigates; nothing is created until the live screen opens.
 */

import type { Meal } from '@/types/habits';
import type { WalkPlan } from './clock';

export const MEALS: readonly Meal[] = ['breakfast', 'lunch', 'dinner'];

export const MEAL_LABEL: Record<Meal, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };

/** "After breakfast", for titles. */
export function afterMealTitle(meal: Meal): string {
  return `After ${meal}`;
}

/** What the setup screen has chosen, before Start makes it a plan. */
export interface SetupChoice {
  kind: WalkPlan['kind'];
  /** Chosen by the person: never assumed from the time of day (J10). */
  meal: Meal | undefined;
  /** When the meal started, in minutes before now. */
  mealAgo: number;
  targetMinutes?: number;
  gps: boolean;
  steps: boolean;
}

/** The plan Start makes, or nothing while an after-meal walk has no meal chosen. */
export function setupPlan(c: SetupChoice, now: number): WalkPlan | undefined {
  if (c.kind === 'afterMeal' && !c.meal) return undefined;
  return {
    kind: c.kind,
    ...(c.kind === 'afterMeal' && c.meal ? { meal: { which: c.meal, startedAt: now - c.mealAgo * 60_000 } } : {}),
    ...(c.targetMinutes ? { targetMinutes: c.targetMinutes } : {}),
    gps: c.gps,
    steps: c.steps,
  };
}

/**
 * When the meal started, as minutes before now. "Just now" first, because a
 * walk soon after eating is what the study tested; two hours is where "after
 * a meal" stops meaning much.
 */
export const MEAL_STARTED_AGO: readonly number[] = [0, 10, 20, 30, 45, 60, 90, 120];

export function mealStartedLabel(minutesAgo: number): string {
  if (minutesAgo === 0) return 'Just now';
  if (minutesAgo < 60) return `${minutesAgo} minutes ago`;
  if (minutesAgo === 60) return '1 hour ago';
  if (minutesAgo === 90) return '1½ hours ago';
  return `${minutesAgo / 60} hours ago`;
}

/** Targets on offer, in minutes. */
export const TARGETS: readonly number[] = [5, 10, 15, 20, 30, 45, 60];

/** Suggested after a meal: the study's 10 minutes (board D26). */
export const AFTER_MEAL_TARGET = 10;

/** A new walk's id: time-ordered, with enough randomness never to collide. */
export function newWalkId(now: number): string {
  const noise = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${now.toString(36)}-${noise}`;
}

const ID_PATTERN = /^[a-z0-9-]{4,40}$/;

export function isWalkId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

/** The live screen's address for a new walk. */
export function liveHref(id: string, plan: WalkPlan): string {
  const q = new URLSearchParams({ id });
  if (plan.kind === 'afterMeal' && plan.meal) {
    q.set('meal', plan.meal.which);
    q.set('mealAt', String(Math.round(plan.meal.startedAt)));
  }
  if (plan.targetMinutes !== undefined) q.set('target', String(plan.targetMinutes));
  if (plan.gps) q.set('gps', '1');
  if (plan.steps) q.set('steps', '1');
  return `/walk/live?${q.toString()}`;
}

/** Longest target accepted from an address: four hours. */
const MAX_TARGET = 240;
/** A meal start this far back is not "after a meal" any more; nor is one in the future. */
const MEAL_WINDOW_MS = 6 * 60 * 60 * 1000;
const MEAL_FUTURE_SLACK_MS = 5 * 60 * 1000;

export function isMeal(value: unknown): value is Meal {
  return value === 'breakfast' || value === 'lunch' || value === 'dinner';
}

/**
 * Read a new walk from the live screen's address. Anything malformed is
 * dropped rather than guessed: no id means no walk, and a meal time that
 * makes no sense makes it an ordinary walk.
 */
export function walkFromSearch(search: URLSearchParams, now: number): { id: string; plan: WalkPlan } | undefined {
  const id = search.get('id');
  if (!isWalkId(id)) return undefined;

  const which = search.get('meal');
  const at = Number(search.get('mealAt'));
  const mealOk = isMeal(which) && Number.isFinite(at) && at <= now + MEAL_FUTURE_SLACK_MS && at >= now - MEAL_WINDOW_MS;

  const rawTarget = search.get('target');
  const target = rawTarget === null ? Number.NaN : Number(rawTarget);
  const targetOk = Number.isInteger(target) && target > 0 && target <= MAX_TARGET;

  return {
    id,
    plan: {
      kind: mealOk ? 'afterMeal' : 'walk',
      ...(mealOk ? { meal: { which, startedAt: Math.min(at, now) } } : {}),
      ...(targetOk ? { targetMinutes: target } : {}),
      gps: search.get('gps') === '1',
      steps: search.get('steps') === '1',
    },
  };
}

/** The meal another screen asked for, e.g. Today's after-dinner prompt linking to `/walk?meal=dinner`. */
export function mealFromSearch(search: URLSearchParams): Meal | undefined {
  const meal = search.get('meal');
  return isMeal(meal) ? meal : undefined;
}

/** Walk setup's address, opening on "After a meal" with `meal` chosen when one is given: what `mealFromSearch` reads. */
export function walkSetupHref(meal?: Meal): string {
  return meal ? `/walk?meal=${meal}` : '/walk';
}

/** What the person chose to measure. */
export interface MeasureChoice {
  gps: boolean;
  steps: boolean;
}

/** Whether the switches now differ from what is remembered. Nothing remembered reads as both off. */
export function choiceChanged(remembered: MeasureChoice | undefined, now: MeasureChoice): boolean {
  const was = remembered ?? { gps: false, steps: false };
  return was.gps !== now.gps || was.steps !== now.steps;
}
