import { describe, it, expect } from 'vitest';
import { countdown, pauseCountdown, secondsLeft, startCountdown, tickCountdown, type Countdown } from './useTimer';

const T0 = 1_000_000;
const shown = (c: Countdown) => secondsLeft(c.leftMs);

describe('rest countdown', () => {
  it('counts from the clock, so a suspended tab is right on its next tick', () => {
    // A 90 s rest, the tab suspended for 60 s, one late callback: counting
    // callbacks showed 89 here.
    const running = startCountdown(countdown(90), T0);
    expect(shown(tickCountdown(running, T0 + 60_000))).toBe(30);
  });

  it('shows whole seconds and re-renders only when the second changes', () => {
    const running = startCountdown(countdown(90), T0);
    expect(shown(running)).toBe(90);
    const first = tickCountdown(running, T0 + 1_000);
    expect(shown(first)).toBe(89);
    expect(tickCountdown(first, T0 + 1_250)).toBe(first);
    expect(shown(tickCountdown(first, T0 + 2_000))).toBe(88);
  });

  it('keeps the time left while paused and sets a new deadline on resume', () => {
    const paused = pauseCountdown(startCountdown(countdown(90), T0), T0 + 10_500);
    expect(paused).toEqual({ endsAt: null, leftMs: 79_500 });
    expect(tickCountdown(paused, T0 + 500_000)).toBe(paused);

    const resumed = startCountdown(paused, T0 + 100_000);
    expect(resumed.endsAt).toBe(T0 + 179_500);
    expect(shown(tickCountdown(resumed, T0 + 120_000))).toBe(60);
  });

  it('finishes at zero however late the tick, and does not restart from zero', () => {
    const done = tickCountdown(startCountdown(countdown(90), T0), T0 + 600_000);
    expect(done).toEqual({ endsAt: null, leftMs: 0 });
    expect(startCountdown(done, T0 + 600_000)).toBe(done);
  });
});
