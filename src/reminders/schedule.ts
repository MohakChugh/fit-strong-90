/**
 * When each reminder the user chose should show (D15).
 *
 * Pure: the habits, the profile and the clock go in, the reminders come out.
 * Nothing here holds a timer, so every rule — quiet hours, midnight, the
 * Status, a water goal already met — is tested without waiting for anything.
 *
 * Two consumers share `dailyTimes`, so the app and the calendar file can never
 * disagree about what the user chose: the in-app scheduler below, and the
 * `.ics` generator in `ics.ts`.
 */

import type { HabitSettings, Meal } from '@/types/habits';
import type { UserProfile } from '@/types/profile';
import type { Status } from '@/health/status';
import {
  MINUTES_PER_DAY,
  addDays,
  addMinutes,
  compareWall,
  formatClock,
  minutesBetween,
  parseClock,
  type WallTime,
} from './time';
import { waterBlock } from './water';
import { habitOffered } from './advice';

export type HabitId = 'water' | 'sittingBreak' | 'mealWalk';

export const HABITS: readonly HabitId[] = ['water', 'sittingBreak', 'mealWalk'];

export const MEALS: readonly Meal[] = ['breakfast', 'lunch', 'dinner'];

/**
 * The dated Status of board D25 (`@/health/status`). Set from Today; this
 * module only reads it. Anything but `normal` — a flare-up, being unwell,
 * being away — quiets every habit prompt on that day.
 */
export type DayStatus = Status;

/**
 * Bounds any stored interval must meet, whatever the screen offered. A file
 * imported from elsewhere could say "every 0 minutes", and that must produce
 * no reminders rather than an endless loop.
 */
export const MIN_EVERY_MINUTES = 15;
export const MAX_EVERY_MINUTES = 12 * 60;

/** A reminder that has come due late is still shown if it is at most this old. */
export const GRACE_MINUTES = 15;

/** One time of day in the user's schedule. */
export interface DailyTime {
  habit: HabitId;
  /** Minutes after local midnight, 0–1439. */
  minute: number;
  meal?: Meal;
}

/** One reminder on one day. */
export interface Occurrence extends DailyTime {
  /** Unique to this habit, meal, day and time. */
  id: string;
  day: string;
}

export interface ReminderContext {
  habits?: HabitSettings;
  profile?: UserProfile;
  /**
   * The Status, or the Status on a given day. A function lets a period that
   * ends today be over at midnight, without anything having to re-render.
   */
  status: DayStatus | ((day: string) => DayStatus);
  /**
   * Water recorded on a day, in ml, so a goal the user set themselves can end
   * that day's water reminders. `undefined` means not known, which never ends them.
   */
  waterOn?: (day: string) => number | undefined;
}

function validEvery(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= MIN_EVERY_MINUTES && value <= MAX_EVERY_MINUTES;
}

/**
 * The times inside a from–to window: the first one interval after the window
 * opens, the last no later than it closes. A window may cross midnight
 * (22:00 to 02:00); from === to is no window at all.
 */
export function windowTimes(from: unknown, to: unknown, everyMinutes: unknown): number[] {
  const start = parseClock(from);
  const end = parseClock(to);
  if (start === undefined || end === undefined || start === end || !validEvery(everyMinutes)) return [];
  const length = (end - start + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const times: number[] = [];
  for (let at = everyMinutes; at <= length; at += everyMinutes) times.push((start + at) % MINUTES_PER_DAY);
  return times;
}

/**
 * Times of day in the order their window runs, from its start: a window from
 * 22:00 to 02:00 reads 23:00 to 02:00, not 00:00 to 23:00 as a list sorted
 * by the clock would (D-11).
 */
export function inWindowOrder(minutes: readonly number[], from: unknown): number[] {
  const start = parseClock(from) ?? 0;
  const offset = (m: number) => (m - start + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return [...minutes].sort((a, b) => offset(a) - offset(b));
}

/** Whether a minute of the day is inside quiet hours, which may cross midnight. */
export function isQuiet(minute: number, quiet: HabitSettings['quietHours']): boolean {
  const from = parseClock(quiet?.from);
  const to = parseClock(quiet?.to);
  if (from === undefined || to === undefined || from === to) return false;
  return from < to ? minute >= from && minute < to : minute >= from || minute < to;
}

/**
 * Every time of day the user asked to be reminded, for the habits that are on
 * and allowed, minus quiet hours. Water drops out entirely when the profile
 * calls for a fluid limit (`waterBlock`), however it was set; standing and
 * walking prompts drop out when the Guide does not offer them — an open foot
 * wound or active Charcot foot (`habitOffered`), habits already on included.
 */
export function dailyTimes(habits: HabitSettings | undefined, profile: UserProfile | undefined): DailyTime[] {
  if (!habits) return [];
  const times: DailyTime[] = [];
  const { water, sittingBreak, mealWalk } = habits;

  if (water?.enabled && !waterBlock(profile, habits) && habitOffered('water', profile, habits)) {
    for (const minute of windowTimes(water.from, water.to, water.everyMinutes)) times.push({ habit: 'water', minute });
  }
  if (sittingBreak?.enabled && habitOffered('sittingBreak', profile, habits)) {
    for (const minute of windowTimes(sittingBreak.from, sittingBreak.to, sittingBreak.everyMinutes)) {
      times.push({ habit: 'sittingBreak', minute });
    }
  }
  if (mealWalk?.enabled && Array.isArray(mealWalk.meals) && habitOffered('mealWalk', profile, habits)) {
    for (const meal of MEALS) {
      if (!mealWalk.meals.includes(meal)) continue;
      // No time, no reminder: guessing when someone eats would be inventing it.
      const minute = parseClock(mealWalk.finish?.[meal]);
      if (minute !== undefined) times.push({ habit: 'mealWalk', meal, minute });
    }
  }

  return times
    .filter(t => !isQuiet(t.minute, habits.quietHours))
    .sort((a, b) => a.minute - b.minute || HABITS.indexOf(a.habit) - HABITS.indexOf(b.habit));
}

/** What identifies "the same reminder" across days: a newer one replaces an older one. */
export function reminderKey(time: DailyTime): string {
  return time.meal ? `${time.habit}:${time.meal}` : time.habit;
}

function occurrence(time: DailyTime, day: string): Occurrence {
  return { ...time, day, id: `${reminderKey(time)}@${day}T${formatClock(time.minute)}` };
}

/** Banners can show on this day: the user has not turned them off, and the Status that day is Normal. */
function canShow(context: ReminderContext, day: string): boolean {
  if (context.habits?.inApp === false) return false;
  return (typeof context.status === 'function' ? context.status(day) : context.status) === 'normal';
}

function waterGoalMet(context: ReminderContext, day: string): boolean {
  const goal = context.habits?.water?.dailyGoalMl;
  if (typeof goal !== 'number' || !(goal > 0)) return false;
  const had = context.waterOn?.(day);
  return typeof had === 'number' && had >= goal;
}

/** The in-app reminders one local day holds, in time order. */
export function occurrencesOn(day: string, context: ReminderContext, times = dailyTimes(context.habits, context.profile)): Occurrence[] {
  if (!canShow(context, day)) return [];
  const met = waterGoalMet(context, day);
  return times.filter(t => !(met && t.habit === 'water')).map(t => occurrence(t, day));
}

/**
 * Whether a reminder that came due may still show at `now`. Checked against
 * how things are now, not when it came due: the same local day, banners on, a
 * Normal day today, outside quiet hours, its habit still on and allowed (water
 * stops the moment a fluid limit, or not knowing, is recorded), and for water,
 * today's goal not yet met. Used for catching up after a gap and for the
 * reminders already waiting, so neither can outlive a change.
 */
export function stillDue(o: Occurrence, now: WallTime, context: ReminderContext): boolean {
  if (o.day !== now.day || !canShow(context, now.day)) return false;
  if (isQuiet(now.minute, context.habits?.quietHours)) return false;
  if (o.habit === 'water' && waterGoalMet(context, now.day)) return false;
  // `dailyTimes` holds only habits that are on and allowed, and meals still chosen.
  return dailyTimes(context.habits, context.profile).some(t => t.habit === o.habit && t.meal === o.meal);
}

/** How far back `dueBetween` looks. Anything older is never shown anyway. */
const LOOKBACK_DAYS = 2;

/**
 * Reminders due after `after` and up to and including `upTo`, in time order.
 * Crosses midnight like any other minute. Looks back at most two days, so a
 * clock that jumped a year cannot make it walk a year.
 */
export function dueBetween(after: WallTime, upTo: WallTime, context: ReminderContext): Occurrence[] {
  if (compareWall(upTo, after) <= 0) return [];
  const times = dailyTimes(context.habits, context.profile);
  if (times.length === 0) return [];

  const floor = { day: addDays(upTo.day, -LOOKBACK_DAYS), minute: upTo.minute };
  const from = compareWall(after, floor) < 0 ? floor : after;
  const due: Occurrence[] = [];
  for (let day = from.day; day <= upTo.day; day = addDays(day, 1)) {
    for (const o of occurrencesOn(day, context, times)) {
      const at = { day, minute: o.minute };
      if (compareWall(at, from) > 0 && compareWall(at, upTo) <= 0) due.push(o);
    }
  }
  return due;
}

/**
 * The next reminder strictly after `after`, or `undefined` when none will show
 * in the next two days — banners are off, nothing is chosen, the Status is
 * not Normal. Two days covers a water goal already met today and a status
 * that ends tonight; anything further, the loop finds when it looks again.
 */
export function nextAfter(after: WallTime, context: ReminderContext, horizonDays = 2): Occurrence | undefined {
  const times = dailyTimes(context.habits, context.profile);
  if (times.length === 0) return undefined;
  for (let i = 0; i <= horizonDays; i++) {
    const day = addDays(after.day, i);
    const next = occurrencesOn(day, context, times).find(o => compareWall({ day, minute: o.minute }, after) > 0);
    if (next) return next;
  }
  return undefined;
}

export interface TickState {
  /** The last moment checked. Reminders after it and up to now are due. */
  lastCheck?: WallTime;
}

export interface TickResult {
  state: TickState;
  /** What to show now, in time order. */
  fire: Occurrence[];
}

/**
 * One look at the clock.
 *
 * - The first look only starts the count. A reminder that came due before the
 *   app was opened did not happen "while open", and replaying it after every
 *   reload would make one reminder show twice.
 * - After a gap (the phone slept, the app sat in the background), only what is
 *   still timely shows: under `GRACE_MINUTES` old. Coming back at 15:00 must
 *   not unload a morning of reminders. Since no habit repeats more often than
 *   `MIN_EVERY_MINUTES`, that window holds at most one of each.
 * - A clock that went backwards (a time-zone change westwards) restarts the
 *   count rather than replaying the hours it repeats.
 * - What is caught up must still be allowed now (`stillDue`): a reminder from
 *   before quiet hours began, or from a day that has ended, does not show.
 */
export function tick(state: TickState, now: WallTime, context: ReminderContext): TickResult {
  const last = state.lastCheck;
  if (!last || compareWall(now, last) <= 0) return { state: { lastCheck: now }, fire: [] };
  const from = minutesBetween(last, now) > GRACE_MINUTES ? addMinutes(now, -GRACE_MINUTES) : last;
  return { state: { lastCheck: now }, fire: dueBetween(from, now, context).filter(o => stillDue(o, now, context)) };
}
