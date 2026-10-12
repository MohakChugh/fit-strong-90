import { describe, it, expect } from 'vitest';
import type { WorkoutSession } from '@/types';
import { abandoned, pastDate, resumable, unfinishedOn } from './resume';

const TODAY = '2026-10-08';
const NOW = Date.parse('2026-10-08T01:30:00');

const session = (id: string, date: string, startedAt: string | null, over: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id, date, dayOfWeek: 'thursday', muscleGroup: 'lower', phase: 'foundation', week: 2, status: 'in_progress', sets: [],
  startedAt, completedAt: null, notes: '', totalVolume: 0, ...over,
});

describe('picking a workout back up', () => {
  it("continues today's unfinished workout, even one begun only by a skip", () => {
    const today = session('t', TODAY, null);
    expect(resumable([today], TODAY, NOW)).toBe(today);
    expect(abandoned([today], TODAY, NOW)).toEqual([]);
  });

  it('continues one carried past midnight for a few hours, then lists it instead', () => {
    const late = session('l', '2026-10-07', new Date(NOW - 2 * 3600_000).toISOString());
    expect(resumable([late], TODAY, NOW)).toBe(late);
    const old = session('o', '2026-10-07', new Date(NOW - 5 * 3600_000).toISOString());
    expect(resumable([old], TODAY, NOW)).toBeUndefined();
    expect(abandoned([old], TODAY, NOW)).toEqual([old]);
  });

  it('never picks up a guided session or a finished workout', () => {
    const guided = session('g', TODAY, null, { guided: true });
    const done = session('d', TODAY, null, { status: 'completed' });
    expect(resumable([guided, done], TODAY, NOW)).toBeUndefined();
    expect(abandoned([guided, done], TODAY, NOW)).toEqual([]);
  });

  it('continues the newest of two, and lists the other', () => {
    const first = session('a', TODAY, '2026-10-08T00:10:00');
    const second = session('b', TODAY, '2026-10-08T01:00:00');
    expect(resumable([first, second], TODAY, NOW)).toBe(second);
    expect(abandoned([first, second], TODAY, NOW)).toEqual([first]);
  });
});

describe('logging a past day', () => {
  it('takes only a real date before today from the address', () => {
    expect(pastDate('2026-10-06', TODAY)).toBe('2026-10-06');
    for (const bad of [null, '', 'yesterday', '2026-10-6', '2026-02-31', '2026-13-01', TODAY, '2026-10-09', '2026-10-06T00:00']) {
      expect(pastDate(bad, TODAY)).toBeUndefined();
    }
  });

  it("finds that day's unfinished workout logged by hand", () => {
    const a = session('a', '2026-10-06', null);
    const guided = session('g', '2026-10-06', null, { guided: true });
    const other = session('o', '2026-10-05', null);
    expect(unfinishedOn([guided, other, a], '2026-10-06')).toBe(a);
    expect(unfinishedOn([guided, other], '2026-10-06')).toBeUndefined();
  });
});
