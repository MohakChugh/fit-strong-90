/**
 * Instants at a fixed offset (B-19): a walk's records carry the day and the
 * offset each segment was recorded in, so changing the phone's time zone
 * between walking and saving never moves a record to another day.
 */

const DAY_MS = 86_400_000;

/** Minutes east of UTC at that instant, on this device. */
export const offsetAt = (t: number): number => -new Date(t).getTimezoneOffset();

/** ISO 8601 with milliseconds at `offsetMin`, as `nowAt` writes it: `Z` for 0. */
export function isoAt(t: number, offsetMin: number): string {
  const d = new Date(t + offsetMin * 60_000);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  const zone = offsetMin === 0
    ? 'Z'
    : `${offsetMin > 0 ? '+' : '-'}${pad(Math.floor(Math.abs(offsetMin) / 60))}:${pad(Math.abs(offsetMin) % 60)}`;
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${pad(d.getUTCMilliseconds(), 3)}${zone}`;
}

/** The first local midnight after `t` at that offset. */
export function nextMidnightAt(t: number, offsetMin: number): number {
  const local = t + offsetMin * 60_000;
  return local - (((local % DAY_MS) + DAY_MS) % DAY_MS) + DAY_MS - offsetMin * 60_000;
}
