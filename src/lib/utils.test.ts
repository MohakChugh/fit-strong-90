import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  toDateString,
  todayString,
  parseDateString,
  getDayOfWeekFromDate,
  getCurrentDayOfWeek,
  getWeekNumber,
  getPhaseForWeek,
  isToday,
  calculateStreak,
  getWorkoutsThisWeek,
  calculateVolume,
  detectPR,
  formatDuration,
  TOTAL_WEEKS,
} from './utils';
import { getPhaseInfo, getWorkoutsPerPhase, PHASES } from '@/data/program';
import type { WorkoutSession, WorkoutSet } from '@/types';

afterEach(() => {
  vi.useRealTimers();
});

/**
 * Pin the clock to a real instant. `setSystemTime` sets an absolute moment;
 * what local calendar date that lands on depends on the runner's timezone,
 * which is exactly what the UTC-drift tests below need to exercise.
 */
function atLocalTime(iso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
}

function makeSession(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: 'id',
    date: '2026-03-02',
    dayOfWeek: 'monday',
    muscleGroup: 'back',
    phase: 'foundation',
    week: 1,
    status: 'completed',
    sets: [],
    startedAt: null,
    completedAt: null,
    notes: '',
    totalVolume: 0,
    ...overrides,
  };
}

function makeSet(overrides: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    id: 'set',
    exerciseId: 'lat-pulldown',
    setNumber: 1,
    plannedReps: 10,
    actualReps: 10,
    weight: 50,
    status: 'completed',
    rpe: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Local-date handling (regression: toISOString() returned the UTC date, which
// is the PREVIOUS day for any user behind UTC)
// ---------------------------------------------------------------------------

describe('local date handling', () => {
  it('toDateString uses the local calendar date, not the UTC date', () => {
    // 30 Mar 2026 at 22:30 local time. In any timezone ahead of UTC this is
    // still the 30th locally; naive toISOString() would report the 30th or 31st
    // depending on offset. We assert it matches the LOCAL date components.
    const d = new Date(2026, 2, 30, 22, 30, 0); // month is 0-based: 2 = March
    expect(toDateString(d)).toBe('2026-03-30');
  });

  it('toDateString is stable just before local midnight', () => {
    const d = new Date(2026, 2, 30, 23, 59, 59);
    expect(toDateString(d)).toBe('2026-03-30');
  });

  it('toDateString is stable just after local midnight', () => {
    const d = new Date(2026, 2, 31, 0, 0, 1);
    expect(toDateString(d)).toBe('2026-03-31');
  });

  it('toDateString zero-pads single-digit months and days', () => {
    expect(toDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('parseDateString round-trips with toDateString', () => {
    const s = '2026-07-04';
    expect(toDateString(parseDateString(s))).toBe(s);
  });

  it('parseDateString yields local midnight, so the weekday is not shifted', () => {
    const d = parseDateString('2026-03-30');
    expect(d.getHours()).toBe(0);
    expect(d.getDate()).toBe(30);
    expect(d.getMonth()).toBe(2);
  });

  it('todayString agrees with the local date at late-evening local time', () => {
    // This is the exact scenario the old code got wrong: late local evening
    // west of UTC rolled the UTC date forward, east of UTC it rolled back.
    atLocalTime('2026-03-30T22:30:00');
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(todayString()).toBe(expected);
  });

  it('todayString agrees with the local date at early-morning local time', () => {
    atLocalTime('2026-03-30T00:30:00');
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(todayString()).toBe(expected);
  });
});

describe('getDayOfWeekFromDate', () => {
  it('maps known dates to the correct weekday', () => {
    // 2026-03-30 is a Monday.
    expect(getDayOfWeekFromDate('2026-03-30')).toBe('monday');
    expect(getDayOfWeekFromDate('2026-04-04')).toBe('saturday');
    expect(getDayOfWeekFromDate('2026-04-05')).toBe('sunday');
  });

  it('covers a full week without gaps or repeats', () => {
    const days = [
      '2026-03-30', '2026-03-31', '2026-04-01', '2026-04-02',
      '2026-04-03', '2026-04-04', '2026-04-05',
    ].map(getDayOfWeekFromDate);
    expect(days).toEqual([
      'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    ]);
  });

  it('getCurrentDayOfWeek matches the local weekday late in the evening', () => {
    atLocalTime('2026-03-30T23:00:00');
    const names = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    expect(getCurrentDayOfWeek()).toBe(names[new Date().getDay()]);
  });
});

// ---------------------------------------------------------------------------
// Week numbering (regression: two divergent implementations, one unclamped
// and one that treated the start date as week 0)
// ---------------------------------------------------------------------------

describe('getWeekNumber', () => {
  const start = '2026-03-30';

  it('treats the start date itself as week 1', () => {
    expect(getWeekNumber(start, '2026-03-30')).toBe(1);
  });

  it('keeps the whole first 7 days in week 1', () => {
    expect(getWeekNumber(start, '2026-04-01')).toBe(1);
    expect(getWeekNumber(start, '2026-04-05')).toBe(1); // day 6
  });

  it('rolls to week 2 exactly on day 7', () => {
    // The old program.ts version (ceil) reported week 1 here; the old utils.ts
    // version reported week 2. This pins the correct boundary.
    expect(getWeekNumber(start, '2026-04-06')).toBe(2);
  });

  it('computes later weeks correctly', () => {
    expect(getWeekNumber(start, '2026-04-13')).toBe(3);  // day 14
        expect(getWeekNumber(start, '2026-05-04')).toBe(6);  // day 35
  });

  it('reaches week 12 on the final week of the program', () => {
    expect(getWeekNumber(start, '2026-06-15')).toBe(12); // day 77
  });

  it('clamps past the end of the program instead of returning 13+', () => {
    // This is what crashed getPhaseInfo: an unclamped week 13 had no phase.
    expect(getWeekNumber(start, '2026-06-22')).toBe(TOTAL_WEEKS);
    expect(getWeekNumber(start, '2027-01-01')).toBe(TOTAL_WEEKS);
  });

  it('clamps dates before the start date to week 1', () => {
    // The old version used Math.abs, so earlier dates counted FORWARD.
    expect(getWeekNumber(start, '2026-03-01')).toBe(1);
    expect(getWeekNumber(start, '2025-01-01')).toBe(1);
  });

  it('falls back to week 1 when the start date is unset', () => {
    expect(getWeekNumber('', '2026-04-06')).toBe(1);
  });

  it('falls back to week 1 on an unparseable start date', () => {
    expect(getWeekNumber('not-a-date', '2026-04-06')).toBe(1);
  });

  it('defaults currentDate to today', () => {
    atLocalTime('2026-04-06T12:00:00');
    expect(getWeekNumber(todayString())).toBe(1);
  });

  it('never returns a value outside 1..TOTAL_WEEKS', () => {
    for (let dayOffset = -40; dayOffset <= 200; dayOffset += 1) {
      const d = parseDateString(start);
      d.setDate(d.getDate() + dayOffset);
      const week = getWeekNumber(start, toDateString(d));
      expect(week).toBeGreaterThanOrEqual(1);
      expect(week).toBeLessThanOrEqual(TOTAL_WEEKS);
      expect(Number.isInteger(week)).toBe(true);
    }
  });
});

describe('getPhaseForWeek', () => {
  it('maps each week to its documented phase', () => {
    expect([1, 2, 3, 4].map(getPhaseForWeek)).toEqual(
      ['foundation', 'foundation', 'foundation', 'foundation']
    );
    expect([5, 6, 7, 8].map(getPhaseForWeek)).toEqual(
      ['hypertrophy', 'hypertrophy', 'hypertrophy', 'hypertrophy']
    );
    expect([9, 10, 11, 12].map(getPhaseForWeek)).toEqual(
      ['strength', 'strength', 'strength', 'strength']
    );
  });

  it('is total: out-of-range weeks do not throw', () => {
    // program.ts used to throw here, white-screening the app past week 12.
    expect(() => getPhaseForWeek(0)).not.toThrow();
    expect(() => getPhaseForWeek(13)).not.toThrow();
    expect(() => getPhaseForWeek(999)).not.toThrow();
  });
});

describe('getPhaseInfo', () => {
  it('resolves a phase for every week in the program', () => {
    for (let week = 1; week <= TOTAL_WEEKS; week += 1) {
      expect(getPhaseInfo(week)).toBeDefined();
      expect(getPhaseInfo(week).name).toBeTruthy();
    }
  });

  it('does not throw for weeks past the end of the program', () => {
    // Regression: AppLayout fed an unclamped week here and crashed on day 84+.
    expect(() => getPhaseInfo(13)).not.toThrow();
    expect(() => getPhaseInfo(99)).not.toThrow();
    expect(getPhaseInfo(99).phase).toBe('strength');
  });

  it('agrees with the phase week ranges declared in PHASES', () => {
    for (const phase of PHASES) {
      const [startWeek, endWeek] = phase.weeks;
      expect(getPhaseInfo(startWeek).phase).toBe(phase.phase);
      expect(getPhaseInfo(endWeek).phase).toBe(phase.phase);
    }
  });
});

describe('getWorkoutsPerPhase', () => {
  it('is 24 for every phase (6 training days x 4 weeks)', () => {
    expect(getWorkoutsPerPhase('foundation')).toBe(24);
    expect(getWorkoutsPerPhase('hypertrophy')).toBe(24);
    expect(getWorkoutsPerPhase('strength')).toBe(24);
  });

  it('matches the week span declared for each phase', () => {
    for (const phase of PHASES) {
      const [startWeek, endWeek] = phase.weeks;
      expect(getWorkoutsPerPhase(phase.phase)).toBe(6 * (endWeek - startWeek + 1));
    }
  });
});

// ---------------------------------------------------------------------------
// Week-label ordering (regression: charts filtered with `"W10" <= "W9"`,
// a lexicographic comparison that let future weeks through)
// ---------------------------------------------------------------------------

describe('week filtering by number rather than label', () => {
  it('demonstrates why the old string comparison was wrong', () => {
    // Guard against anyone reintroducing label-based comparison.
    expect('W10' <= 'W9').toBe(true);   // lexicographic: wrong
    expect(10 <= 9).toBe(false);        // numeric: correct
  });

  it('includes weeks up to the current one and excludes later empty weeks', () => {
    const currentWeek = 9;
    const weeks = Array.from({ length: TOTAL_WEEKS }, (_, i) => ({
      week: i + 1,
      count: 0,
    }));
    const shown = weeks.filter(d => d.count > 0 || d.week <= currentWeek).map(d => d.week);
    expect(shown).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(shown).not.toContain(10);
    expect(shown).not.toContain(12);
  });

  it('still includes a later week when it has data', () => {
    const currentWeek = 9;
    const weeks = Array.from({ length: TOTAL_WEEKS }, (_, i) => ({
      week: i + 1,
      count: i + 1 === 11 ? 3 : 0,
    }));
    const shown = weeks.filter(d => d.count > 0 || d.week <= currentWeek).map(d => d.week);
    expect(shown).toContain(11);
    expect(shown).not.toContain(10);
  });
});

// ---------------------------------------------------------------------------
// Workout math
// ---------------------------------------------------------------------------

describe('calculateVolume', () => {
  it('sums weight x reps over completed sets only', () => {
    expect(calculateVolume([
      makeSet({ id: 'a', weight: 50, actualReps: 10 }),
      makeSet({ id: 'b', weight: 60, actualReps: 5 }),
    ])).toBe(800);
  });

  it('ignores pending and skipped sets', () => {
    expect(calculateVolume([
      makeSet({ id: 'a', weight: 50, actualReps: 10 }),
      makeSet({ id: 'b', weight: 99, actualReps: 99, status: 'pending' }),
      makeSet({ id: 'c', weight: 99, actualReps: 99, status: 'skipped' }),
    ])).toBe(500);
  });

  it('ignores completed sets with missing weight or reps', () => {
    expect(calculateVolume([
      makeSet({ id: 'a', weight: null }),
      makeSet({ id: 'b', actualReps: null }),
    ])).toBe(0);
  });

  it('is 0 for an empty list', () => {
    expect(calculateVolume([])).toBe(0);
  });
});

describe('calculateStreak', () => {
  it('is 0 with no sessions', () => {
    expect(calculateStreak([])).toBe(0);
  });

  it('counts consecutive completed days ending today', () => {
    atLocalTime('2026-03-30T12:00:00');
    const today = todayString();
    const dayBefore = (n: number) => {
      const d = parseDateString(today);
      d.setDate(d.getDate() - n);
      return toDateString(d);
    };
    expect(calculateStreak([
      makeSession({ id: '1', date: today }),
      makeSession({ id: '2', date: dayBefore(1) }),
      makeSession({ id: '3', date: dayBefore(2) }),
    ])).toBe(3);
  });

  it('stops at a gap', () => {
    atLocalTime('2026-03-30T12:00:00');
    const today = todayString();
    const dayBefore = (n: number) => {
      const d = parseDateString(today);
      d.setDate(d.getDate() - n);
      return toDateString(d);
    };
    expect(calculateStreak([
      makeSession({ id: '1', date: today }),
      makeSession({ id: '2', date: dayBefore(3) }),
    ])).toBe(1);
  });

  it('does not count an incomplete session', () => {
    atLocalTime('2026-03-30T12:00:00');
    expect(calculateStreak([
      makeSession({ id: '1', date: todayString(), status: 'in_progress' }),
    ])).toBe(0);
  });

  it('is unaffected by late-evening local time', () => {
    // Under the old UTC-parsing logic the day arithmetic drifted by one,
    // silently zeroing a real streak.
    atLocalTime('2026-03-30T23:30:00');
    expect(calculateStreak([makeSession({ date: todayString() })])).toBe(1);
  });
});

describe('getWorkoutsThisWeek', () => {
  it('includes sessions in the current Sunday-Saturday window', () => {
    atLocalTime('2026-04-01T12:00:00'); // a Wednesday
    const now = new Date();
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - now.getDay());
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);

    const sessions = [
      makeSession({ id: 'sun', date: toDateString(sunday) }),
      makeSession({ id: 'today', date: todayString() }),
      makeSession({ id: 'sat', date: toDateString(saturday) }),
    ];
    expect(getWorkoutsThisWeek(sessions).map(s => s.id).sort())
      .toEqual(['sat', 'sun', 'today']);
  });

  it('excludes sessions just outside the window on both sides', () => {
    atLocalTime('2026-04-01T12:00:00');
    const now = new Date();
    const beforeSunday = new Date(now);
    beforeSunday.setDate(now.getDate() - now.getDay() - 1);
    const afterSaturday = new Date(now);
    afterSaturday.setDate(now.getDate() - now.getDay() + 7);

    const sessions = [
      makeSession({ id: 'before', date: toDateString(beforeSunday) }),
      makeSession({ id: 'after', date: toDateString(afterSaturday) }),
    ];
    expect(getWorkoutsThisWeek(sessions)).toEqual([]);
  });
});

describe('detectPR', () => {
  const prs = [{ exerciseId: 'squat', weight: 100, reps: 5, date: '2026-03-01', volume: 500 }];

  it('is a PR when no record exists for the exercise', () => {
    expect(detectPR('bench', 50, 5, prs)).toBe(true);
  });

  it('is a PR when volume beats the existing record', () => {
    expect(detectPR('squat', 110, 5, prs)).toBe(true);
  });

  it('is not a PR when volume is lower', () => {
    expect(detectPR('squat', 90, 5, prs)).toBe(false);
  });

  it('is not a PR when volume merely ties the record', () => {
    expect(detectPR('squat', 100, 5, prs)).toBe(false);
  });
});

describe('isToday', () => {
  it('is true for today and false for other days', () => {
    atLocalTime('2026-03-30T22:00:00');
    expect(isToday(todayString())).toBe(true);
    expect(isToday('2020-01-01')).toBe(false);
  });
});

describe('formatDuration', () => {
  it('formats as M:SS with a zero-padded seconds field', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(9)).toBe('0:09');
    expect(formatDuration(90)).toBe('1:30');
    expect(formatDuration(600)).toBe('10:00');
  });
});
