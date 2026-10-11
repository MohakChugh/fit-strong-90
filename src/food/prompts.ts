/**
 * The food prompt (journey §7.4, §11.5, A-73; board D103): one meal, at one
 * time, with estimates only, in the app only. Never in a calendar file, which
 * can't know what was logged. The scheduler adds the rest of its rules: never
 * in quiet hours, never while the day isn't Normal, and not once that meal is
 * logged.
 *
 * Kept free of the food table: the reminder host imports this file.
 */
import { formatClock, MINUTES_PER_DAY, parseClock } from '@/reminders/time';
import type { HabitSettings, Meal } from '@/types/habits';
import type { UserProfile } from '@/types/profile';
import { foodLevel } from './level';

/** The prompt's time of day, when the person hasn't set one. */
const FIXED: Record<Meal, string> = { breakfast: '10:00', lunch: '14:30', dinner: '21:30' };

/** When a meal's prompt defaults to: an hour after its usual finish, from setup's meal times, or a fixed hour. */
export function promptDefault(meal: Meal, habits: Pick<HabitSettings, 'mealWalk'> | undefined): string {
  const finish = parseClock(habits?.mealWalk?.finish?.[meal]);
  return finish === undefined ? FIXED[meal] : formatClock((finish + 60) % MINUTES_PER_DAY);
}

/** The food prompt's time, or nothing: off, not with estimates (B-11), or a time that can't be read. */
export function foodPromptTime(profile: UserProfile | undefined): { habit: 'foodLog'; meal: Meal; minute: number } | undefined {
  const reminder = profile?.food?.logReminder;
  if (!reminder || foodLevel(profile?.food) !== 'estimates') return undefined;
  const minute = parseClock(reminder.at);
  return minute === undefined ? undefined : { habit: 'foodLog', meal: reminder.meal, minute };
}
