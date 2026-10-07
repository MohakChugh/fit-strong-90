/**
 * Wall-clock time source for the session runner. Timing is always computed
 * from anchors (`Date.now()`), never by counting ticks, so throttled or
 * suspended pages land on the correct segment when they wake (spec §6.2).
 *
 * A dev-only `?timescale=N` query parameter speeds time up for end-to-end
 * tests; production builds ignore it.
 */

export interface Clock {
  /** Scaled epoch milliseconds. */
  now(): number;
  readonly scale: number;
}

export function createClock(opts: { timescale?: number; realNow?: () => number } = {}): Clock {
  const realNow = opts.realNow ?? Date.now;
  const scale = opts.timescale && opts.timescale > 0 ? opts.timescale : 1;
  if (scale === 1) return { now: realNow, scale };
  const origin = realNow();
  return { now: () => origin + (realNow() - origin) * scale, scale };
}

/** Read `?timescale=` from the URL (hash routes included) in dev builds only. */
export function devTimescale(isDev: boolean, href: string): number {
  if (!isDev) return 1;
  const match = /[?&]timescale=(\d+(?:\.\d+)?)/.exec(href);
  const n = match ? Number(match[1]) : 1;
  return Number.isFinite(n) && n >= 1 && n <= 200 ? n : 1;
}
