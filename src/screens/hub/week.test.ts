import { describe, expect, it } from 'vitest';
import type { WorkoutSession } from '@/types';
import { newObservation } from '@/health/observation';
import { DEFAULT_PREFS } from '@/screens/track/format';
import { goalLine, modeWeek, movementHistory } from './week';

// Thursday 8 October 2026; the week runs from Monday 5 to Sunday 11 October.
const TODAY = '2026-10-08';
const session = (over: Partial<WorkoutSession>): WorkoutSession => ({
  id: 's', date: '2026-10-06', dayOfWeek: 'tuesday', muscleGroup: 'fullBody', phase: 'foundation', week: 1,
  status: 'completed', sets: [], startedAt: '2026-10-06T07:30:00+05:30', ...over,
} as WorkoutSession);
const stretch = session({ id: 'st1', planKind: 'stretch', planId: 'stretch:2026-10-06:backHips:10:green:', guided: true });
const walk = [
  newObservation({ id: 'w1d', kind: 'walkDuration', value: 12, unit: 'min', scope: 'sessionObserved', source: 'measured', at: '2026-10-07T07:40:00.000+05:30', context: 'walk:w1', coverageMs: 720000 }),
  newObservation({ id: 'w1m', kind: 'movementMinutes', value: 12, unit: 'min', scope: 'sessionObserved', source: 'measured', at: '2026-10-07T07:40:00.000+05:30', context: 'walk:w1', coverageMs: 720000 }),
];

describe('modeWeek (journey §8.2, This week)', () => {
  it('stretch: the days with a stretch, a status day, and days still to come, Monday first', () => {
    const days = modeWeek({ mode: 'stretch', today: TODAY, sessions: [stretch], observations: [], statusPeriods: [{ kind: 'flare', from: '2026-10-05', to: '2026-10-05' }] });
    expect(days.map(d => d.letter)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
    expect(days[0]).toMatchObject({ name: 'Monday', state: 'status', words: 'Flare-up' });
    expect(days[1]).toMatchObject({ state: 'done', words: 'Stretched' });
    expect(days[2]).toMatchObject({ state: 'none', words: 'No stretch' });
    expect(days[3]).toMatchObject({ today: true, future: false });
    expect(days[4]).toMatchObject({ future: true, words: 'Still to come' });
  });

  it('walk: the minutes walked on the day the walk started', () => {
    const days = modeWeek({ mode: 'walk', today: TODAY, sessions: [], observations: walk });
    expect(days[2]).toMatchObject({ state: 'done', words: '12 min walked' });
    expect(days[1].words).toBe('No walk');
  });

  it('walk: a walk across midnight puts each part’s minutes on its own day, once (codex H2-03, F17)', () => {
    const at = (day: string, time: string) => `${day}T${time}.000+05:30`;
    const part = (id: string, start: string, minutes: number, source: 'measured' | 'manual' = 'measured') =>
      newObservation({ id, kind: 'walkDuration', value: minutes, unit: 'min', scope: 'sessionObserved', source, at: start, context: 'walk:w9', coverageMs: minutes * 60_000 });
    // Split at midnight by the live screen: 20 minutes before, 15 after.
    const split = modeWeek({ mode: 'walk', today: TODAY, sessions: [], observations: [part('a', at('2026-10-06', '23:40:00'), 20), part('b', at('2026-10-07', '00:00:00'), 15)] });
    expect(split[1]).toMatchObject({ state: 'done', words: '20 min walked' });
    expect(split[2]).toMatchObject({ state: 'done', words: '15 min walked' });
    // One part that runs past midnight is shared between the two days at midnight.
    const spanning = modeWeek({ mode: 'walk', today: TODAY, sessions: [], observations: [part('c', at('2026-10-06', '23:50:00'), 20)] });
    expect([spanning[1].words, spanning[2].words]).toEqual(['10 min walked', '10 min walked']);
    // Two records of the same time are one walk's minutes, not two; time the person added is not "walked".
    const twice = modeWeek({ mode: 'walk', today: TODAY, sessions: [], observations: [part('d', at('2026-10-06', '08:00:00'), 20), part('e', at('2026-10-06', '08:05:00'), 10), part('f', at('2026-10-06', '09:00:00'), 5, 'manual')] });
    expect(twice[1].words).toBe('20 min walked');
  });

  it('workout outside the programme: a day with a recorded workout is done', () => {
    const days = modeWeek({ mode: 'guided', today: TODAY, sessions: [session({ id: 'g1', planKind: 'full', guided: true })], observations: [] });
    expect(days[1]).toMatchObject({ state: 'done', words: 'Done' });
    expect(days[2].words).toBe('No workout');
  });

  it('workout in the programme: the week as Your plan counts it, rest days marked', () => {
    const programme = [
      { date: '2026-10-05', day: 'monday', isToday: false, focus: 'upperA', status: 'done' },
      { date: '2026-10-06', day: 'tuesday', isToday: false, focus: 'rest', status: 'rest' },
    ] as Parameters<typeof modeWeek>[0]['programme'];
    const days = modeWeek({ mode: 'guided', today: TODAY, sessions: [], observations: [], programme });
    expect(days[0]).toMatchObject({ state: 'done', words: 'Done' });
    expect(days[1]).toMatchObject({ state: 'rest', words: 'Rest' });
  });
});

describe('goalLine (D31, B-16)', () => {
  it('reads against the week’s goal, or plainly with none', () => {
    expect(goalLine(64, 150)).toEqual({ text: '64 of 150 min this week', reached: false });
    expect(goalLine(150, 150).reached).toBe(true);
    expect(goalLine(64, undefined)).toEqual({ text: '64 min moved this week', reached: false });
  });
});

describe('movementHistory (journey §8.2, History)', () => {
  it('stretches, newest first, each opening its own record', () => {
    const older = { ...stretch, id: 'st0', date: '2026-10-01', startedAt: '2026-10-01T07:30:00+05:30' };
    const rows = movementHistory('stretch', [older, stretch, session({ id: 'g1', planKind: 'full', guided: true })], [], DEFAULT_PREFS, TODAY);
    expect(rows.map(r => r.key)).toEqual(['session:st1', 'session:st0']);
    expect(rows[0]).toMatchObject({ label: 'Back & hips · 10 min', ref: { type: 'session', id: 'st1' } });
    expect(rows[0].detail).toMatch(/^Tue 6 Oct · Completed/);
  });

  it('walks: one row a walk, with its minutes', () => {
    const rows = movementHistory('walk', [], walk, DEFAULT_PREFS, TODAY);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ key: 'walk:w1', label: '12 min', ref: { type: 'walk', id: 'w1' } });
  });

  it('workouts: programme sessions only, never a stretch, and a hand-logged one opens the Workout Log', () => {
    const logged = session({ id: 'm1', guided: false, planKind: 'full' });
    const rows = movementHistory('guided', [stretch, logged], [], DEFAULT_PREFS, TODAY);
    expect(rows.map(r => r.ref)).toEqual([{ type: 'workout', id: 'm1' }]);
  });
});

describe('each hub counts only its own mode', () => {
  const programme = [
    { date: '2026-10-05', day: 'monday', isToday: false, focus: 'upperA', status: 'partial' },
    { date: '2026-10-06', day: 'tuesday', isToday: false, focus: 'upperA', status: 'recovery' },
  ] as Parameters<typeof modeWeek>[0]['programme'];

  it('the programme’s week is Workout’s alone, and a partly done or recovery day is done', () => {
    const guided = modeWeek({ mode: 'guided', today: TODAY, sessions: [], observations: [], programme });
    expect(guided[0]).toMatchObject({ state: 'done', words: 'Partly done' });
    expect(guided[1]).toMatchObject({ state: 'done', words: 'Recovery session instead' });
    expect(modeWeek({ mode: 'stretch', today: TODAY, sessions: [], observations: [], programme })[0].words).toBe('No stretch');
  });

  it('a stretch is no workout and no walk; a walk is no stretch; a skipped session is nothing done', () => {
    const skipped = session({ id: 'g2', planKind: 'full', guided: true, status: 'skipped', date: '2026-10-07' });
    const guided = modeWeek({ mode: 'guided', today: TODAY, sessions: [stretch, skipped], observations: [] });
    expect(guided[1].words).toBe('No workout');
    expect(guided[2].words).toBe('No workout');
    expect(modeWeek({ mode: 'walk', today: TODAY, sessions: [stretch], observations: [] })[1].words).toBe('No walk');
    expect(modeWeek({ mode: 'stretch', today: TODAY, sessions: [], observations: walk })[2].words).toBe('No stretch');
  });

  it('History leaves out a session never started, and puts the newest walk first', () => {
    const unstarted = { ...stretch, id: 'st9', status: 'not_started' as const };
    expect(movementHistory('stretch', [unstarted], [], DEFAULT_PREFS, TODAY)).toEqual([]);
    const later = [
      newObservation({ id: 'w2d', kind: 'walkDuration', value: 20, unit: 'min', scope: 'sessionObserved', source: 'measured', at: '2026-10-08T07:10:00.000+05:30', context: 'walk:w2', coverageMs: 1200000 }),
    ];
    expect(movementHistory('walk', [], [...walk, ...later], DEFAULT_PREFS, TODAY).map(r => r.key)).toEqual(['walk:w2', 'walk:w1']);
  });
});
