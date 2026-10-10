import { useEffect, useSyncExternalStore } from 'react';

/**
 * The time Today reads, held as an external store so no render reads the
 * clock itself (a render must give the same answer every time it runs).
 *
 * `visit` counts returns to the app. Coming back from another app, or from a
 * locked phone, is "a new visit" for the recommendation, which recomputes on
 * it rather than on every tick.
 */
export interface ClockSnapshot {
  now: Date;
  visit: number;
}

/** A minute is enough: the date line, and a fresh time for the next recompute. */
const TICK_MS = 60_000;

let snapshot: ClockSnapshot = { now: new Date(), visit: 0 };
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function publish(next: ClockSnapshot): void {
  snapshot = next;
  for (const listener of [...listeners]) listener();
}

const tick = () => publish({ now: new Date(), visit: snapshot.visit });

function onVisibility(): void {
  if (document.visibilityState === 'visible') publish({ now: new Date(), visit: snapshot.visit + 1 });
}

/** No document outside a browser (node tests): the minute's tick still runs. */
const hasDocument = () => typeof document !== 'undefined';

function subscribe(listener: () => void): () => void {
  // The first listener after a quiet spell reads the time as it is now,
  // whichever it does first, reading or subscribing.
  if (listeners.size === 0) refresh();
  listeners.add(listener);
  if (listeners.size === 1) {
    timer = setInterval(tick, TICK_MS);
    if (hasDocument()) document.addEventListener('visibilitychange', onVisibility);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    clearInterval(timer);
    timer = undefined;
    if (hasDocument()) document.removeEventListener('visibilitychange', onVisibility);
  };
}

/**
 * A snapshot a second or more off, replaced, a clock set back included; one
 * from this second, kept (React needs the same object).
 */
function refresh(): void {
  const now = new Date();
  if (Math.abs(now.getTime() - snapshot.now.getTime()) >= 1000) snapshot = { now, visit: snapshot.visit };
}

/**
 * While nothing is subscribed the snapshot is not kept current, so the first
 * read after a quiet spell refreshes it — otherwise Today, opened an hour
 * after it was last shown, would first draw itself at the old time. Reads
 * within the same second return the same object, as React requires.
 */
function read(): ClockSnapshot {
  if (listeners.size === 0) refresh();
  return snapshot;
}

export function useClock(): ClockSnapshot {
  return useSyncExternalStore(subscribe, read, read);
}

/** The longest a browser timer waits (about 24.8 days); anything later is met by the minute's tick. */
const MAX_TIMER_MS = 2 ** 31 - 1;
/** Just past the moment, so the time read is on the far side of it. */
const PAST_THE_EDGE_MS = 25;

/**
 * Read the clock again at `at` (epoch ms), between the minute's ticks: the
 * moment a re-check falls due, a reading stops being fresh or a new part of
 * the day begins (`nextBoundary`) is met when it comes, not up to a minute
 * later (L-07, B-20). Every screen reading the clock sees the new time.
 */
export function useWakeAt(at: number | undefined): void {
  useEffect(() => {
    if (at === undefined || !Number.isFinite(at)) return;
    const wait = Math.max(0, at - Date.now()) + PAST_THE_EDGE_MS;
    if (wait > MAX_TIMER_MS) return;
    const id = setTimeout(tick, wait);
    return () => clearTimeout(id);
  }, [at]);
}

