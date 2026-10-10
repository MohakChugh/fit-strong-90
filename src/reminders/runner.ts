/**
 * The in-app scheduler's loop: wait for the next reminder, show it, repeat.
 *
 * It only runs while the page does. iOS suspends a web app the moment it
 * leaves the screen and offers no way to wake it on a timer (no Notification
 * Triggers, no background sync), which is why reminders for a closed app go
 * to Calendar instead (`ics.ts`, D15). The loop says nothing about that; it
 * just never assumes a timer fired on time.
 *
 * Clock and timers are injected so the tests run the loop with a fake clock.
 */

import { nextAfter, tick, type Occurrence, type ReminderContext, type TickState } from './schedule';
import { instantOf, wallTimeOf } from './time';

/** Even with nothing due, look again this often: clocks change, phones sleep. */
export const MAX_WAIT_MS = 60_000;

export interface RunnerDeps {
  now(): Date;
  /** Read afresh on every check, so the latest settings always apply. */
  context(): ReminderContext;
  show(due: Occurrence[]): void;
  /** `setTimeout`, returning a cancel. */
  later(run: () => void, ms: number): () => void;
}

export interface Runner {
  /** Look now: the app came back to the screen, or the window got focus. */
  check(): void;
  /** Settings or the Status changed: start counting again from now. */
  restart(): void;
  stop(): void;
}

export function startReminders(deps: RunnerDeps): Runner {
  let state: TickState = {};
  let cancel: (() => void) | undefined;
  let stopped = false;

  function schedule(): void {
    cancel?.();
    if (stopped) return;
    const now = deps.now();
    const next = nextAfter(wallTimeOf(now), deps.context());
    // A quarter-second past the minute, so the check that wakes for 11:00
    // reads 11:00 and not 10:59 on a clock a few milliseconds slow.
    const until = next ? instantOf(next).getTime() - now.getTime() + 250 : MAX_WAIT_MS;
    cancel = deps.later(check, Math.min(Math.max(until, 1_000), MAX_WAIT_MS));
  }

  function check(): void {
    if (stopped) return;
    const result = tick(state, wallTimeOf(deps.now()), deps.context());
    state = result.state;
    if (result.fire.length > 0) deps.show(result.fire);
    schedule();
  }

  function restart(): void {
    if (stopped) return;
    state = { lastCheck: wallTimeOf(deps.now()) };
    schedule();
  }

  // The first look starts the count; see `tick`.
  check();

  return {
    check,
    restart,
    stop() {
      stopped = true;
      cancel?.();
      cancel = undefined;
    },
  };
}
