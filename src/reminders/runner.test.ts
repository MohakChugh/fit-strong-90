import { describe, expect, it } from 'vitest';
import type { HabitSettings } from '@/types/habits';
import { createDefaultProfile } from '@/profile/defaults';
import { MAX_WAIT_MS, startReminders } from './runner';
import type { DayStatus, Occurrence } from './schedule';

const profile = createDefaultProfile({ weightKg: 80 });
const WATER: HabitSettings = { water: { enabled: true, glassMl: 250, everyMinutes: 120, from: '09:00', to: '21:00' } };

/** Local time on 8 October 2026. */
const clock = (h: number, m: number, s = 0) => new Date(2026, 9, 8, h, m, s).getTime();

interface Timer { at: number; run: () => void; live: boolean }

function harness(startAt: number, habits: HabitSettings = WATER) {
  let now = startAt;
  let status: DayStatus = 'normal';
  let current = habits;
  const timers: Timer[] = [];
  const shown: Occurrence[][] = [];
  const runner = startReminders({
    now: () => new Date(now),
    context: () => ({ habits: current, profile, status }),
    show: due => shown.push(due),
    later: (run, ms) => {
      const timer = { at: now + ms, run, live: true };
      timers.push(timer);
      return () => { timer.live = false; };
    },
  });
  const live = () => timers.filter(t => t.live);
  return {
    runner,
    shown: () => shown.flat().map(o => o.id),
    live,
    now: () => now,
    /** Let time pass with the app open: every timer that falls due runs. */
    advance(to: number) {
      for (;;) {
        const next = live().filter(t => t.at <= to).sort((a, b) => a.at - b.at)[0];
        if (!next) break;
        next.live = false;
        now = next.at;
        next.run();
      }
      now = to;
    },
    /** Time passes with the app suspended: no timer runs at all. */
    suspendUntil(to: number) { now = to; },
    setStatus(next: DayStatus) { status = next; },
    setHabits(next: HabitSettings) { current = next; },
  };
}

describe('startReminders', () => {
  it('waits for the next reminder, shows it on its minute, then waits again', () => {
    const h = harness(clock(10, 58));
    h.advance(clock(10, 59, 59));
    expect(h.shown()).toEqual([]);
    h.advance(clock(11, 0, 1));
    expect(h.shown()).toEqual(['water@2026-10-08T11:00']);
    // The next one is two hours off, but the loop still looks within a minute:
    // a clock change or a phone asleep must not leave it waiting two hours.
    expect(h.live().length).toBe(1);
    expect(h.live()[0].at - h.now()).toBeLessThanOrEqual(MAX_WAIT_MS);
    h.advance(clock(12, 59, 59));
    expect(h.shown()).toEqual(['water@2026-10-08T11:00']);
    h.advance(clock(13, 0, 1));
    expect(h.shown()).toEqual(['water@2026-10-08T11:00', 'water@2026-10-08T13:00']);
  });

  it('keeps exactly one timer, never more than a minute away, however often it is woken', () => {
    const h = harness(clock(9, 0), {});
    for (let i = 1; i <= 5; i++) {
      expect(h.live().length).toBe(1);
      expect(h.live()[0].at - h.now()).toBeLessThanOrEqual(MAX_WAIT_MS);
      h.advance(clock(9, i));
    }
    // Coming back to the screen, or getting focus, looks again without leaving
    // the previous wait behind.
    h.runner.check();
    h.runner.check();
    h.runner.restart();
    expect(h.live().length).toBe(1);
    expect(h.shown()).toEqual([]);
  });

  it('shows what came due while the app was in the background, if it is still timely', () => {
    const h = harness(clock(10, 50));
    h.suspendUntil(clock(11, 10));
    h.runner.check();
    expect(h.shown()).toEqual(['water@2026-10-08T11:00']);
  });

  it('after hours away shows only the latest timely reminder', () => {
    const h = harness(clock(9, 0));
    h.suspendUntil(clock(15, 5));
    h.runner.check();
    expect(h.shown()).toEqual(['water@2026-10-08T15:00']);
  });

  it('does not replay what came due while the Status was not Normal', () => {
    const h = harness(clock(10, 0));
    h.setStatus('away');
    h.runner.restart();
    h.advance(clock(11, 5));
    expect(h.shown()).toEqual([]);

    h.setStatus('normal');
    h.runner.restart();
    h.advance(clock(12, 59));
    expect(h.shown()).toEqual([]);
    h.advance(clock(13, 0, 30));
    expect(h.shown()).toEqual(['water@2026-10-08T13:00']);
  });

  it('starts from now when the habits change, so turning one on does not fire a reminder from the past', () => {
    // The last look is at 10:59:30; water is turned on at 11:00:10, after its
    // 11:00 time. Without starting again from now, the next look would see
    // 11:00 as due and show it.
    const h = harness(clock(10, 55, 30), {});
    h.advance(clock(11, 0, 10));
    h.setHabits(WATER);
    h.runner.restart();
    h.advance(clock(11, 30));
    expect(h.shown()).toEqual([]);
  });

  it('stops for good', () => {
    const h = harness(clock(10, 58));
    h.runner.stop();
    expect(h.live()).toEqual([]);
    h.suspendUntil(clock(11, 1));
    h.runner.check();
    h.runner.restart();
    expect(h.shown()).toEqual([]);
    expect(h.live()).toEqual([]);
  });
});
