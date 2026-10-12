import { describe, expect, it, vi } from 'vitest';
import { checkWeeklyGoal, movementIntervals, recordedMovement, sessionInterval, wholeMinutes } from './movement';
import { obs, session } from './fixtures';
import { weekOf } from './periods';
import { formatDuration } from './format';

const week = weekOf('2026-10-08'); // Monday 5 to Sunday 11 October

describe('sessionInterval', () => {
  it('places a session from its start, for its active time', () => {
    const s = session({ id: 's1', date: '2026-10-06', guided: true, startedAt: '2026-10-06T01:30:00.000Z', durationSeconds: 3600 });
    const interval = sessionInterval(s)!;
    expect(interval.value).toBe(60);
    expect(interval.coverageMs).toBe(3_600_000);
    expect(Date.parse(interval.at)).toBe(Date.parse('2026-10-06T01:30:00.000Z'));
    expect(interval.source).toBe('measured');
    expect(interval.context).toBe('session:s1');
  });

  it('leaves out a session it cannot place in time', () => {
    expect(sessionInterval(session({ id: 's', date: '2026-10-06', durationSeconds: 600 }))).toBeUndefined();
    expect(sessionInterval(session({ id: 's', date: '2026-10-06', startedAt: '2026-10-06T01:30:00.000Z' }))).toBeUndefined();
    expect(sessionInterval(session({ id: 's', date: '2026-10-06', startedAt: '2026-10-06T01:30:00.000Z', durationSeconds: 0 }))).toBeUndefined();
  });

  it('never credits the wall-clock span between start and finish as movement (F20)', () => {
    // A manual workout finished four hours after its first set has no recorded active time.
    const s = session({ id: 's', date: '2026-10-06', startedAt: '2026-10-06T03:30:00.000Z', completedAt: '2026-10-06T07:30:00.000Z' });
    expect(sessionInterval(s)).toBeUndefined();
    expect(recordedMovement(week, [], [s]).minutes).toBe(0);
    // Active time the person entered is counted, as theirs, on its day.
    const timed = session({ id: 't', date: '2026-10-06', startedAt: '2026-10-06T03:30:00.000Z', completedAt: '2026-10-06T07:30:00.000Z', durationSeconds: 1200 });
    expect(recordedMovement(week, [], [timed])).toMatchObject({ minutes: 20, enteredMinutes: 20 });
  });

  it('keeps a session on the day it was recorded, whatever zone the device is in now (F19)', () => {
    // Delhi, Monday 12 October 00:05: stored as Sunday 18:35 UTC. Opened in Los Angeles, it is still Monday's.
    vi.stubEnv('TZ', 'America/Los_Angeles');
    try {
      const s = session({ id: 'd', date: '2026-10-12', guided: true, startedAt: '2026-10-11T18:35:00.000Z', durationSeconds: 600 });
      const interval = sessionInterval(s)!;
      expect(interval.day).toBe('2026-10-12');
      expect(Date.parse(interval.at)).toBe(Date.parse('2026-10-11T18:35:00.000Z'));
      expect(recordedMovement({ from: '2026-10-12', to: '2026-10-12' }, [], [s]).minutes).toBe(10);
      expect(recordedMovement({ from: '2026-10-11', to: '2026-10-11' }, [], [s]).minutes).toBe(0);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('recordedMovement', () => {
  it('adds sessions and walks across the week', () => {
    const sessions = [
      session({ id: 's1', date: '2026-10-06', guided: true, startedAt: '2026-10-06T01:30:00.000Z', durationSeconds: 3000 }),
      session({ id: 's2', date: '2026-10-08', guided: true, startedAt: '2026-10-08T01:30:00.000Z', durationSeconds: 1800 }),
    ];
    const walk = obs({ id: 'w1-d', kind: 'walkDuration', unit: 'min', value: 25, scope: 'sessionObserved', source: 'measured', coverageMs: 1_500_000, context: 'walk:w1', at: '2026-10-07T18:00:00.000+05:30' });
    const total = recordedMovement(week, [walk], sessions);
    expect(total.minutes).toBe(50 + 30 + 25);
    expect(total.flags).toEqual([]);
  });

  it('counts an activity once when it was recorded two ways', () => {
    const walk = obs({ id: 'w1-d', kind: 'walkDuration', unit: 'min', value: 25, scope: 'sessionObserved', source: 'measured', coverageMs: 1_500_000, context: 'walk:w1', at: '2026-10-07T18:00:00.000+05:30' });
    const sameWalk = obs({ id: 'w1-m', kind: 'movementMinutes', unit: 'min', value: 25, scope: 'sessionObserved', source: 'measured', coverageMs: 1_500_000, context: 'walk:w1', at: '2026-10-07T18:00:00.000+05:30' });
    const s = session({ id: 's1', date: '2026-10-06', guided: true, startedAt: '2026-10-06T01:30:00.000Z', durationSeconds: 3000 });
    const sameSession = obs({ id: 's1-m', kind: 'movementMinutes', unit: 'min', value: 50, scope: 'sessionObserved', source: 'measured', coverageMs: 3_000_000, context: 'session:s1', at: '2026-10-06T07:00:00.000+05:30' });
    const intervals = movementIntervals(week, [walk, sameWalk, sameSession], [s]);
    expect(intervals.map(i => i.id).sort()).toEqual(['s1-m', 'w1-m']);
    expect(recordedMovement(week, [walk, sameWalk, sameSession], [s]).minutes).toBe(75);
  });

  it('counts overlapping activities once and says so (D10)', () => {
    const a = obs({ id: 'a', kind: 'movementMinutes', unit: 'min', value: 30, scope: 'sessionObserved', coverageMs: 1_800_000, at: '2026-10-08T07:00:00.000+05:30' });
    const b = obs({ id: 'b', kind: 'movementMinutes', unit: 'min', value: 20, scope: 'sessionObserved', coverageMs: 1_200_000, at: '2026-10-08T07:15:00.000+05:30' });
    const total = recordedMovement(week, [a, b], []);
    expect(total.minutes).toBe(30);
    expect(total.flags.map(f => f.fault)).toContain('overlap');
  });

  it('never mixes in a whole-day total, and ignores other weeks', () => {
    const dayTotal = obs({ id: 'dt', kind: 'movementMinutes', unit: 'min', value: 45, scope: 'dayTotal' });
    const lastWeek = session({ id: 'old', date: '2026-10-04', guided: true, startedAt: '2026-10-04T01:30:00.000Z', durationSeconds: 3600 });
    expect(recordedMovement(week, [dayTotal], [lastWeek])).toEqual({ minutes: 0, enteredMinutes: 0, mayRepeat: false, counted: [], flags: [] });
  });

  it('says how much of the total was entered rather than measured: 3 measured + 3 added to a walk (J11)', () => {
    const shared = { kind: 'movementMinutes' as const, unit: 'min', scope: 'sessionObserved' as const, context: 'walk:w1' };
    const seen = obs({ ...shared, id: 'w1:s0', value: 2, source: 'measured', coverageMs: 120_000, at: '2026-10-08T07:00:00.000+05:30' });
    const added = obs({ ...shared, id: 'w1:g0', value: 3, source: 'manual', coverageMs: 180_000, at: '2026-10-08T07:02:00.000+05:30' });
    const later = obs({ ...shared, id: 'w1:s1', value: 1, source: 'measured', coverageMs: 60_000, at: '2026-10-08T07:05:00.000+05:30' });
    const total = recordedMovement(week, [seen, added, later], []);
    expect(total.minutes).toBe(6);
    expect(total.enteredMinutes).toBe(3);
  });

  it('counts every segment of one walk, deduplicating only copies of the same interval (F18)', () => {
    const shared = { unit: 'min', scope: 'sessionObserved' as const, source: 'measured' as const, context: 'walk:w5' };
    const first = obs({ ...shared, id: 'a', kind: 'walkDuration', value: 2, coverageMs: 120_000, at: '2026-10-08T07:00:00.000+05:30' });
    const second = obs({ ...shared, id: 'b', kind: 'walkDuration', value: 3, coverageMs: 180_000, at: '2026-10-08T07:10:00.000+05:30' });
    expect(recordedMovement(week, [first, second], []).minutes).toBe(5);
    // A movement record for the first segment covers that segment only.
    const firstMovement = obs({ ...shared, id: 'am', kind: 'movementMinutes', value: 2, coverageMs: 120_000, at: '2026-10-08T07:00:00.000+05:30' });
    expect(recordedMovement(week, [first, firstMovement, second], []).minutes).toBe(5);
  });

  it('splits a walk across midnight between the two days, and the two weeks (F17)', () => {
    const walk = obs({ id: 'm', kind: 'movementMinutes', unit: 'min', value: 3, scope: 'sessionObserved', source: 'measured', coverageMs: 180_000, context: 'walk:w6', at: '2026-10-11T23:59:00.000+05:30' });
    const sunday = recordedMovement({ from: '2026-10-11', to: '2026-10-11' }, [walk], []);
    const monday = recordedMovement({ from: '2026-10-12', to: '2026-10-12' }, [walk], []);
    expect(sunday.minutes).toBeCloseTo(1, 6);
    expect(monday.minutes).toBeCloseTo(2, 6);
    expect(recordedMovement(weekOf('2026-10-11'), [walk], []).minutes).toBeCloseTo(1, 6);
    expect(recordedMovement(weekOf('2026-10-12'), [walk], []).minutes).toBeCloseTo(2, 6);
  });

  it('keeps entered workout minutes as entered time on their day, never an invented interval that hides a walk (R01)', () => {
    // First set 09:00, finished 13:00, five active minutes entered; a measured walk 09:01 to 09:04 between.
    const workout = session({ id: 'w', date: '2026-10-08', guided: false, startedAt: '2026-10-08T03:30:00.000Z', completedAt: '2026-10-08T07:30:00.000Z', durationSeconds: 300 });
    const walk = obs({ id: 'walk', kind: 'movementMinutes', unit: 'min', value: 3, scope: 'sessionObserved', source: 'measured', coverageMs: 180_000, context: 'walk:x', at: '2026-10-08T09:01:00.000+05:30' });
    const total = recordedMovement(week, [walk], [workout]);
    expect(total.minutes).toBe(8);
    expect(total.enteredMinutes).toBe(5);
    expect(total.flags.map(f => f.fault)).not.toContain('overlap');
    expect(sessionInterval(workout)).toBeUndefined();
    // Said plainly: the entered minutes could include the walk, since the workout's time spans it.
    expect(total.mayRepeat).toBe(true);
    // On its recorded day only.
    expect(recordedMovement({ from: '2026-10-07', to: '2026-10-07' }, [walk], [workout]).minutes).toBe(0);
    expect(recordedMovement({ from: '2026-10-08', to: '2026-10-08' }, [walk], [workout]).minutes).toBe(8);
  });

  it('still places a guided session, whose active time the player measured', () => {
    const guided = session({ id: 'g', date: '2026-10-08', guided: true, startedAt: '2026-10-08T03:30:00.000Z', durationSeconds: 600 });
    expect(sessionInterval(guided)).toMatchObject({ value: 10, source: 'measured' });
    expect(recordedMovement(week, [], [guided])).toMatchObject({ minutes: 10, enteredMinutes: 0, mayRepeat: false });
  });

  it('shows whole minutes, rounded to the nearest, as a session’s own summary and its row do', () => {
    expect(wholeMinutes(29.99)).toBe(30);
    expect(wholeMinutes(30)).toBe(30);
    expect(wholeMinutes(0.4)).toBe(0);
    expect(wholeMinutes(38.5)).toBe(39);
  });

  it('gives one session the same minutes in its row, the weekly ring and Today (scan J2-10)', () => {
    // Full Body B with 2,312 s of active time; a 10-minute stretch that ran 598 s.
    for (const [seconds, shown] of [[2312, 39], [598, 10]] as const) {
      const one = session({ id: 'x', date: '2026-10-08', guided: true, startedAt: '2026-10-08T03:30:00.000Z', durationSeconds: seconds });
      expect(formatDuration(seconds)).toBe(`${shown} min`);
      expect(wholeMinutes(recordedMovement(week, [], [one]).minutes)).toBe(shown);
      // The session summary's own rule.
      expect(Math.round(seconds / 60)).toBe(shown);
    }
  });
});

describe('checkWeeklyGoal', () => {
  it('accepts whole minutes from 10 to 2,000', () => {
    expect(checkWeeklyGoal('150')).toEqual({ ok: true, minutes: 150 });
    expect(checkWeeklyGoal(' 10 ')).toEqual({ ok: true, minutes: 10 });
    expect(checkWeeklyGoal('2000')).toEqual({ ok: true, minutes: 2000 });
  });

  it('refuses empty, fractional, tiny or implausible goals in plain words', () => {
    expect(checkWeeklyGoal('')).toMatchObject({ ok: false });
    expect(checkWeeklyGoal('90.5')).toMatchObject({ ok: false, message: expect.stringMatching(/whole minutes/) });
    expect(checkWeeklyGoal('9')).toMatchObject({ ok: false });
    expect(checkWeeklyGoal('2001')).toMatchObject({ ok: false });
    expect(checkWeeklyGoal('-5')).toMatchObject({ ok: false });
  });
});
