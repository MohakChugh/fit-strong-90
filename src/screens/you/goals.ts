/**
 * What Me → Goals says (journey §16, §12.5, B-16), as plain lines. A goal's
 * history is newest first, each change from the day it applies. Nothing here
 * decides when a change applies: that is the weekly goal's own module
 * (`@/screens/track/weeklyGoal`) and the steps goal's.
 */
import { format, parseISO } from 'date-fns';
import type { UserSettings } from '@/types';
import { currentStepsGoal, stepsGoalChanges } from '@/screens/track/stepsGoal';
import { formatNumber } from '@/screens/track/units';
import { weeklyGoalChanges, weeklyGoalOn } from '@/screens/track/weeklyGoal';
import { shortDay } from './dates';

const weekly = (minutes?: number) => (minutes === undefined ? 'No weekly goal' : `${minutes} min a week`);
const daily = (steps?: number) => (steps === undefined ? 'No steps goal' : `${formatNumber(steps)} steps a day`);

/** Me's Goals row: the goals in force today, or that there are none. */
export function goalsLine(settings: UserSettings, day: string): string {
  const minutes = weeklyGoalOn(settings, day);
  const steps = currentStepsGoal(settings);
  if (minutes === undefined && steps === undefined) return 'No goals yet';
  return [minutes !== undefined && weekly(minutes), steps !== undefined && daily(steps)].filter(Boolean).join(' · ');
}

/** "From Monday 12 October: 120 min a week. This week keeps 150 min." */
export function pendingLine(pending: { from: string; goal?: number }, thisWeek: number | undefined): string {
  const keeps = thisWeek === undefined ? 'This week has none.' : `This week keeps ${thisWeek} min.`;
  return `From ${format(parseISO(pending.from), 'EEEE d MMMM')}: ${pending.goal === undefined ? 'no weekly goal' : `${pending.goal} min a week`}. ${keeps}`;
}

export interface HistoryLine {
  key: string;
  what: string;
  when: string;
}

/** The weekly goal's changes. v1's goal, which has no date, reads "Before then", after the dated ones. */
export function weeklyGoalLines(settings: UserSettings): HistoryLine[] {
  return [...weeklyGoalChanges(settings)].reverse().map(c => (c.from === ''
    ? { key: 'undated', what: weekly(c.goal), when: 'Before then' }
    : { key: c.from, what: weekly(c.goal), when: `From ${shortDay(c.from)}` }));
}

export function stepsGoalLines(settings: UserSettings): HistoryLine[] {
  return [...stepsGoalChanges(settings)].reverse().map(c => ({ key: c.from, what: daily(c.goal), when: `From ${shortDay(c.from)}` }));
}
