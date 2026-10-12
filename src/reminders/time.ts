/**
 * Local wall-clock time for reminders.
 *
 * A habit reminder is "09:30 wherever I am", not an instant: it must stay at
 * 09:30 across a daylight-saving change and after a flight. So the schedule is
 * computed on a calendar day plus minutes since that day's midnight, and only
 * the timer that waits for it ever touches a `Date`. That also keeps every
 * schedule test independent of the time zone the tests happen to run in.
 */

export const MINUTES_PER_DAY = 24 * 60;

/** A local calendar day (`YYYY-MM-DD`) and minutes since its midnight, 0–1439. */
export interface WallTime {
  day: string;
  minute: number;
}

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * `"HH:MM"` (24-hour, what `<input type="time">` produces) as minutes after
 * midnight. Anything else — a typo in an imported file, `"24:00"` — is
 * `undefined`, never a guessed time.
 */
export function parseClock(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const m = CLOCK.exec(value);
  return m ? Number(m[1]) * 60 + Number(m[2]) : undefined;
}

/** Minutes after midnight as `"HH:MM"`, wrapping past midnight. */
export function formatClock(minute: number): string {
  const m = ((Math.floor(minute) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Days since 1970-01-01 for a `YYYY-MM-DD`, computed in UTC so no zone can shift it. */
export function dayNumber(day: string): number {
  const m = DAY.exec(day);
  if (!m) throw new RangeError(`Not a YYYY-MM-DD day: ${day}`);
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000);
}

export function addDays(day: string, days: number): string {
  return new Date((dayNumber(day) + days) * 86_400_000).toISOString().slice(0, 10);
}

export function compareWall(a: WallTime, b: WallTime): number {
  return a.day === b.day ? a.minute - b.minute : a.day < b.day ? -1 : 1;
}

/** How many minutes `to` is after `from` (negative when it is before). */
export function minutesBetween(from: WallTime, to: WallTime): number {
  return (dayNumber(to.day) - dayNumber(from.day)) * MINUTES_PER_DAY + (to.minute - from.minute);
}

/** A wall time moved by some minutes, across midnight in either direction. */
export function addMinutes(time: WallTime, minutes: number): WallTime {
  const total = dayNumber(time.day) * MINUTES_PER_DAY + time.minute + minutes;
  const days = Math.floor(total / MINUTES_PER_DAY);
  return { day: new Date(days * 86_400_000).toISOString().slice(0, 10), minute: total - days * MINUTES_PER_DAY };
}

/** The device's local wall clock at an instant. Seconds are dropped. */
export function wallTimeOf(date: Date): WallTime {
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return { day, minute: date.getHours() * 60 + date.getMinutes() };
}

/**
 * The instant a wall time next happens on this device. A time inside a
 * daylight-saving gap (02:30 on the morning clocks go forward) does not exist,
 * and `Date` moves it to the first minute that does — which is when a
 * reminder for it should show.
 */
export function instantOf(time: WallTime): Date {
  const m = DAY.exec(time.day);
  if (!m) throw new RangeError(`Not a YYYY-MM-DD day: ${time.day}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, time.minute);
}

/**
 * Milliseconds until the next whole minute. Quiet hours and days begin on a
 * minute, so a look then catches the boundary itself rather than up to a
 * polling interval later.
 */
export function msToNextMinute(nowMs: number): number {
  return 60_000 - (((nowMs % 60_000) + 60_000) % 60_000);
}
