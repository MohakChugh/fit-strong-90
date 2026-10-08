/**
 * A daily steps goal the person chose (acceptance J07; board D27, as revised):
 * theirs, with no default and no floor, and never raised for them. Each day is
 * read against the goal in force that day, so changing it never re-scores the
 * past. Progress is a quiet line of words — no ring, no streak (D19).
 */

import { isDay } from '@/health/observation';
import type { UserSettings } from '@/types';
import { formatNumber } from './units';

export type StepsGoalSettings = Pick<UserSettings, 'dailyStepsGoal' | 'dailyStepsGoalHistory'>;
type Change = { from: string; goal?: number };

const isGoal = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

/**
 * The changes as stored, keeping only what this app could have written:
 * settings can arrive in an imported file, which is checked only as a whole.
 */
function historyOf(settings: StepsGoalSettings | undefined): Change[] {
  const h: unknown = settings?.dailyStepsGoalHistory;
  return Array.isArray(h)
    ? h.filter((c): c is Change => typeof c === 'object' && c !== null && isDay(c.from) && (c.goal === undefined || isGoal(c.goal)))
    : [];
}

/** The goal chosen now, if it is one. */
export function currentStepsGoal(settings: StepsGoalSettings | undefined): number | undefined {
  return isGoal(settings?.dailyStepsGoal) ? settings.dailyStepsGoal : undefined;
}

/** The goal in force on `day`: the last change made on or before it, or none before the first. */
export function stepsGoalOn(settings: StepsGoalSettings | undefined, day: string): number | undefined {
  let goal: number | undefined;
  for (const h of historyOf(settings)) if (h.from <= day) goal = h.goal;
  return goal;
}

/**
 * The settings with the goal set — or removed, with `undefined` — from `day`
 * on. Earlier days keep the goal they had, so a change never re-scores them;
 * a second change the same day replaces the first.
 */
export function withStepsGoal(settings: StepsGoalSettings | undefined, goal: number | undefined, day: string): StepsGoalSettings {
  const history = [...historyOf(settings).filter(h => h.from !== day), { from: day, ...(goal !== undefined ? { goal } : {}) }]
    .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  return { dailyStepsGoal: goal, dailyStepsGoalHistory: history };
}

/** "80% of the 2,500 goal", rounded down so it never says more than was done. Nothing without a goal. */
export function stepsProgress(steps: number, goal: number | undefined): string | undefined {
  if (goal === undefined || !(goal > 0)) return undefined;
  return `${Math.floor((steps / goal) * 100 + 1e-9)}% of the ${formatNumber(goal)} goal`;
}

/**
 * The one goal in force on every day from `from` to `to`, for a chart's line;
 * `changed` when it began, changed or ended within them, because one line
 * across those days would measure some against a goal they never had.
 */
export function stepsGoalThroughout(settings: StepsGoalSettings | undefined, from: string, to: string): number | undefined | 'changed' {
  const first = stepsGoalOn(settings, from);
  const changed = historyOf(settings).some(h => h.from > from && h.from <= to && h.goal !== first);
  return changed ? 'changed' : first;
}
