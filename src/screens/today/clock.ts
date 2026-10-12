import { useSyncExternalStore } from 'react';

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

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    timer = setInterval(tick, TICK_MS);
    document.addEventListener('visibilitychange', onVisibility);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    clearInterval(timer);
    timer = undefined;
    document.removeEventListener('visibilitychange', onVisibility);
  };
}

/**
 * While nothing is subscribed the snapshot is not kept current, so the first
 * read after a quiet spell refreshes it — otherwise Today, opened an hour
 * after it was last shown, would first draw itself at the old time. Reads
 * within the same second return the same object, as React requires.
 */
function read(): ClockSnapshot {
  if (listeners.size === 0) {
    const now = new Date();
    if (now.getTime() - snapshot.now.getTime() >= 1000) snapshot = { now, visit: snapshot.visit };
  }
  return snapshot;
}

export function useClock(): ClockSnapshot {
  return useSyncExternalStore(subscribe, read, read);
}
