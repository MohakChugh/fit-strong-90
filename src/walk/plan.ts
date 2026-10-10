/**
 * What the Walk setup screen offers, and how its choices travel to the live
 * screen. They travel in the address (`/walk/live?…`) because the start goes
 * through the shared check-in gate, which may show its sheet before it
 * navigates; nothing is created until the live screen opens.
 */

import { timeOf } from '@/lib/time';
import type { Meal } from '@/types/habits';
import type { WalkOrigin, WalkPlan } from './clock';

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

/** How far back a meal's usual end can be and still be the meal just had: Walk's own longest "Started" choice. */
const MEAL_SUGGEST_MS = 2 * 60 * 60 * 1000;

/**
 * B-09: what the after-meal button says, and the meal time it records once
 * tapped. It is the meal's usual finish time today (or last night's, for a
 * dinner after midnight), or now when that is still to come or more than two
 * hours ago. A usual time is only a suggestion, and the tap is what confirms
 * it (A-10, L-05). It is never a time in the future.
 */
export function afterMealSuggestion({ meal, finish, now, hour12 }: { meal: Meal; finish?: string; now: number; hour12: boolean }): { at: number; title: string; label: string } {
  const at = usualFinish(finish, now) ?? now;
  return { at, title: `A walk after ${meal}`, label: `I had ${meal} at ${timeOf(at, hour12)}: walk now` };
}

/** The latest past moment at a local `HH:MM`, if it is within two hours of `now`. */
function usualFinish(finish: string | undefined, now: number): number | undefined {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(finish ?? '');
  if (!m) return undefined;
  const d = new Date(now);
  const on = (offset: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset, Number(m[1]), Number(m[2])).getTime();
  const last = on(0) > now ? on(-1) : on(0);
  return now - last <= MEAL_SUGGEST_MS ? last : undefined;
}

/** Whole minutes from the meal to now, never negative: what the walk's "Started" choice holds. */
export function mealMinutesAgo(at: number, now: number): number {
  return Math.max(0, Math.round((now - at) / 60_000));
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

/**
 * A walk started straight from Home's Right now card (journey §7.4, K-32):
 * after the meal the person confirmed, or "Just a walk", measuring what they
 * chose last time. Its id is made now, at the tap.
 */
export function directWalkHref(walk: { meal?: Meal; mealStartedAt?: number }, now: number, measure: MeasureChoice): string {
  const plan: WalkPlan = walk.meal && walk.mealStartedAt !== undefined
    ? { kind: 'afterMeal', meal: { which: walk.meal, startedAt: walk.mealStartedAt }, gps: measure.gps, steps: measure.steps }
    : { kind: 'walk', gps: measure.gps, steps: measure.steps };
  return liveHref(newWalkId(now), plan);
}

/** The live screen's address for a new walk. */
export function liveHref(id: string, plan: WalkPlan): string {
  const q = new URLSearchParams({ id });
  if (plan.kind === 'afterMeal' && plan.meal) {
    q.set('meal', plan.meal.which);
    q.set('mealAt', String(Math.round(plan.meal.startedAt)));
    if (plan.meal.basis === 'had') q.set('mealBasis', 'had');
  }
  if (plan.targetMinutes !== undefined) q.set('target', String(plan.targetMinutes));
  if (plan.gps) q.set('gps', '1');
  if (plan.stepsDenied) q.set('steps', 'denied');
  else if (plan.steps) q.set('steps', '1');
  if (plan.keepRoute) q.set('route', '1');
  if (plan.from) q.set('from', plan.from === '/hub/walk' ? 'walk' : 'home');
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
      ...(mealOk ? { meal: { which, startedAt: Math.min(at, now), ...(search.get('mealBasis') === 'had' ? { basis: 'had' as const } : {}) } } : {}),
      ...(targetOk ? { targetMinutes: target } : {}),
      gps: search.get('gps') === '1',
      steps: search.get('steps') === '1',
      // A route is kept only from GPS, and only when the person said so on this phone (§9.1).
      ...(search.get('route') === '1' && search.get('gps') === '1' ? { keepRoute: true } : {}),
      ...(search.get('steps') === 'denied' ? { stepsDenied: true } : {}),
      ...(search.get('from') === 'walk' ? { from: '/hub/walk' as const } : search.get('from') === 'home' ? { from: '/home' as const } : {}),
    },
  };
}

/** The origin a start was made from (motion M12): the Walk hub, or Home for everything else. */
export function originOf(pathname: string): WalkOrigin {
  return pathname.startsWith('/hub/walk') ? '/hub/walk' : '/home';
}

/** The plan in a live walk's address, or nothing for any other address. */
export function walkPlanOf(href: string, now: number = Date.now()): WalkPlan | undefined {
  const prefix = '/walk/live?';
  if (!href.startsWith(prefix)) return undefined;
  return walkFromSearch(new URLSearchParams(href.slice(prefix.length)), now)?.plan;
}

/** The meal another screen asked for, e.g. Home's after-dinner prompt linking to `/hub/walk?meal=dinner`. */
export function mealFromSearch(search: URLSearchParams): Meal | undefined {
  const meal = search.get('meal');
  return isMeal(meal) ? meal : undefined;
}

/** Walk setup's address, opening on "After a meal" with `meal` chosen when one is given: what `mealFromSearch` reads. */
export function walkSetupHref(meal?: Meal): string {
  return meal ? `/hub/walk?meal=${meal}` : '/hub/walk';
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
