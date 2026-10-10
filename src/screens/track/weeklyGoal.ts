/**
 * The weekly movement goal, kept by the week (journey §12.5, B-16).
 *
 * A change applies from the next Monday: the week under way keeps the goal
 * it started with, so its ring never moves under someone mid-week (B-32 keys
 * the ring by the goal it is drawn against). A first goal, set in a week that
 * had none, applies at once: there is nothing to keep. Past weeks keep
 * theirs. A goal v1 set before goals were dated has no date, and none is
 * invented: it holds for every week before the first dated change.
 */
import { isDay } from '@/health/observation';
import type { UserSettings } from '@/types';
import { addDays, mondayOf } from './periods';

export type WeeklyGoalSettings = Pick<UserSettings, 'weeklyMovementGoalMinutes' | 'weeklyMovementGoalHistory'>;
type Change = { from: string; goal?: number };

const isGoal = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;
/** A Monday, or '' for the goal v1 kept with no date. */
const isFrom = (v: unknown): v is string => v === '' || (typeof v === 'string' && isDay(v) && mondayOf(v) === v);

/**
 * The changes as stored, oldest first, keeping only what this app could have
 * written: settings can arrive in an imported file. Me's Goals lists them
 * (Plan 4).
 */
export function weeklyGoalChanges(settings: WeeklyGoalSettings | undefined): Change[] {
  const h: unknown = settings?.weeklyMovementGoalHistory;
  if (!Array.isArray(h)) return [];
  return h
    .filter((c): c is Change => typeof c === 'object' && c !== null && isFrom((c as Change).from) && ((c as Change).goal === undefined || isGoal((c as Change).goal)))
    .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
}

/** The goal in force for the week holding `day`. */
export function weeklyGoalOn(settings: WeeklyGoalSettings | undefined, day: string): number | undefined {
  const history = weeklyGoalChanges(settings);
  if (history.length === 0) return isGoal(settings?.weeklyMovementGoalMinutes) ? settings.weeklyMovementGoalMinutes : undefined;
  const week = mondayOf(day);
  let goal: number | undefined;
  for (const h of history) if (h.from <= week) goal = h.goal;
  return goal;
}

/** The change waiting for a later Monday, if there is one: what the goal sheet and the Workout hub say. */
export function pendingWeeklyGoal(settings: WeeklyGoalSettings | undefined, day: string): Change | undefined {
  const week = mondayOf(day);
  return weeklyGoalChanges(settings).find(h => h.from > week);
}

/**
 * The settings with `goal` chosen on `day` (`undefined` removes it). A first
 * goal applies from this week; a change or a removal from next Monday. A
 * second change before then replaces the first, and choosing this week's goal
 * again cancels it. `weeklyMovementGoalMinutes` is the goal last chosen.
 */
export function withWeeklyGoal(settings: WeeklyGoalSettings | undefined, goal: number | undefined, day: string): WeeklyGoalSettings {
  const week = mondayOf(day);
  const now = weeklyGoalOn(settings, day);
  const dated = weeklyGoalChanges(settings);
  const undated: Change[] = dated.length === 0 && isGoal(settings?.weeklyMovementGoalMinutes) ? [{ from: '', goal: settings.weeklyMovementGoalMinutes }] : [];
  const kept = [...undated, ...dated].filter(h => h.from <= week);
  const from = now === undefined ? week : addDays(week, 7);
  const history = goal === now ? kept : [...kept.filter(h => h.from !== from), { from, ...(goal !== undefined ? { goal } : {}) }];
  return { weeklyMovementGoalMinutes: goal, weeklyMovementGoalHistory: history };
}
