/**
 * B-19, with no walk recording (P8S-02, board D185): a change to the phone's
 * clock, seen by the page itself. The device's clock (`now`) and the
 * monotonic one (`monotonic`, `performance.now()`) are compared at each
 * check, every minute while the page is in view, when it is hidden, and when
 * it comes back; a disagreement past the walk's own threshold
 * (`CLOCK_JUMP_MS`) is a change to the clock, marked as a walk marks one
 * (`markClockChange`): every gate then holds someone who can go low until a
 * reading taken since. The walk keeps its own detection too.
 *
 * Across a time out of view, only a clock set back counts: an iPhone's
 * monotonic clock stands still while it sleeps, so one set forward then can't
 * be told from a phone that was locked. A clock set forward makes a reading
 * look older, never newer, so nothing is let through by not counting it. In
 * view, a look judges only the couple of minutes since the one before: over
 * a longer span the minute's check didn't run, timers held up, and two
 * clocks that stopped agreeing then can't be told from one that changed.
 */
import { CLOCK_JUMP_MS, daysAround, type Clocks, type ClockSeen } from './clock';
import { getState, markClockChange } from '@/store/useStore';

/** How often the page looks while it is in view. */
export const CLOCK_CHECK_MS = 60_000;
/** The longest span a look in view judges: two and a half of its minutes. */
const IN_VIEW_SPAN_MS = 2.5 * CLOCK_CHECK_MS;

export interface ClockWatchPorts {
  now(): number;
  monotonic(): number;
  visible(): boolean;
  /** Whether the device's record has been read, so a change can be kept with it. */
  ready(): boolean;
  every(fn: () => void, ms: number): () => void;
  /** `fn` with whether the page is in view, each time it is hidden or shown. */
  onVisibility(fn: (visible: boolean) => void): () => void;
  /** A change, seen around `days` between the two clocks `seen` holds: the store tells one a walk has marked already by it (H6F-04). */
  changed(days: readonly string[], seen: ClockSeen): void;
}

export function watchClock(ports: ClockWatchPorts): () => void {
  const take = (): Clocks => ({ wall: ports.now(), mono: ports.monotonic() });
  let last = take();
  /** Since the last look; `backOnly` across a time out of view. */
  const look = (backOnly: boolean) => {
    // Kept as it was until the record is read, so a change made meanwhile is still seen.
    if (!ports.ready()) return;
    const next = take();
    const drift = (next.wall - last.wall) - (next.mono - last.mono);
    const judged = backOnly || next.mono - last.mono <= IN_VIEW_SPAN_MS;
    const changed = judged && (backOnly ? drift < -CLOCK_JUMP_MS : Math.abs(drift) > CLOCK_JUMP_MS);
    if (changed) ports.changed(daysAround(last.wall, next.wall), { from: last, to: next });
    last = take();
  };
  const stopEvery = ports.every(() => { if (ports.visible()) look(false); }, CLOCK_CHECK_MS);
  // Hidden: since the last look the page was in view. Shown: it was out of view.
  const stopVisibility = ports.onVisibility(visible => look(visible));
  return () => {
    stopEvery();
    stopVisibility();
  };
}

/** The page's own watch, as the app starts it (`App`). */
export function startClockWatch(): () => void {
  return watchClock({
    now: () => Date.now(),
    monotonic: () => performance.now(),
    visible: () => document.visibilityState === 'visible',
    ready: () => getState().status !== 'loading',
    every(fn, ms) {
      const id = window.setInterval(fn, ms);
      return () => window.clearInterval(id);
    },
    onVisibility(fn) {
      const heard = () => fn(document.visibilityState === 'visible');
      document.addEventListener('visibilitychange', heard);
      return () => document.removeEventListener('visibilitychange', heard);
    },
    changed: (days, seen) => void markClockChange(days, seen),
  });
}
