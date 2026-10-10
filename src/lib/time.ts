/**
 * A time of day, written one way wherever the app writes one (scan J2-14):
 * "7:53 am" on a 12-hour clock, with no leading zero, and "07:53" on a
 * 24-hour one — whichever this device uses.
 */

/** Whether this device, or `locale`, writes times on a 12-hour clock. */
export function prefersHour12(locale?: string): boolean {
  try {
    const cycle = new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hourCycle;
    return cycle === 'h11' || cycle === 'h12';
  } catch {
    return false;
  }
}

/** Hours and minutes of a day, as the app writes them. */
export function formatTime(hours: number, minutes: number, hour12: boolean = prefersHour12()): string {
  const mm = String(minutes).padStart(2, '0');
  if (!hour12) return `${String(hours).padStart(2, '0')}:${mm}`;
  const h = hours % 12 === 0 ? 12 : hours % 12;
  return `${h}:${mm} ${hours < 12 ? 'am' : 'pm'}`;
}

/** An instant's time of day on this device's clock: a date, epoch milliseconds or an ISO string. Empty when it is not a time. */
export function timeOf(when: Date | number | string, hour12: boolean = prefersHour12()): string {
  const d = when instanceof Date ? when : new Date(when);
  if (Number.isNaN(d.getTime())) return '';
  return formatTime(d.getHours(), d.getMinutes(), hour12);
}
