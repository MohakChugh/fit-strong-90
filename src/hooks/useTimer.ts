import { useState, useEffect, useCallback } from 'react';
import { formatDuration } from '@/lib/utils';

/**
 * A countdown kept as a deadline rather than a count of interval callbacks: a
 * background tab throttles or suspends intervals, but the clock keeps going,
 * so the time left is right as soon as the page ticks again.
 */
export interface Countdown {
  /** Epoch ms at which it reaches zero while running; null while paused or finished. */
  endsAt: number | null;
  /** Time left: kept while paused, refreshed by `tickCountdown` while running. */
  leftMs: number;
}

/** A paused countdown of `seconds`. */
export const countdown = (seconds: number): Countdown => ({ endsAt: null, leftMs: seconds * 1000 });

/** Whole seconds shown for `ms` left. */
export const secondsLeft = (ms: number) => Math.ceil(ms / 1000);

/** Start or resume: the time left becomes a deadline. */
export function startCountdown(c: Countdown, now: number): Countdown {
  return c.endsAt !== null || c.leftMs <= 0 ? c : { ...c, endsAt: now + c.leftMs };
}

/** Pause: keep the time left, drop the deadline. */
export function pauseCountdown(c: Countdown, now: number): Countdown {
  return c.endsAt === null ? c : { endsAt: null, leftMs: Math.max(0, c.endsAt - now) };
}

/** Recompute the time left from the clock; reaching zero finishes it. */
export function tickCountdown(c: Countdown, now: number): Countdown {
  if (c.endsAt === null) return c;
  const leftMs = Math.max(0, c.endsAt - now);
  if (leftMs === 0) return { endsAt: null, leftMs: 0 };
  // Same second on screen: keep the object so React skips the render.
  return secondsLeft(leftMs) === secondsLeft(c.leftMs) ? c : { ...c, leftMs };
}

/**
 * Rest timer hook
 *
 * Provides a countdown timer with start, pause, and reset functionality
 * Returns the current time in seconds, control functions, and formatted time string
 */
export function useTimer(initialSeconds: number = 90) {
  const [timer, setTimer] = useState(() => countdown(initialSeconds));
  const isRunning = timer.endsAt !== null;

  const start = useCallback(() => {
    const now = Date.now();
    setTimer(c => startCountdown(c, now));
  }, []);

  const pause = useCallback(() => {
    const now = Date.now();
    setTimer(c => pauseCountdown(c, now));
  }, []);

  const reset = useCallback((newSeconds?: number) => {
    setTimer(countdown(newSeconds ?? initialSeconds));
  }, [initialSeconds]);

  // One interval per run; each tick reads the clock, and so does coming back to the page.
  useEffect(() => {
    if (!isRunning) return;
    const tick = () => setTimer(c => tickCountdown(c, Date.now()));
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    const id = window.setInterval(tick, 250);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isRunning]);

  const seconds = secondsLeft(timer.leftMs);

  return {
    seconds,
    isRunning,
    start,
    pause,
    reset,
    formatted: formatDuration(seconds),
  };
}
