import { describe, it, expect } from 'vitest';
import type { AppData, PersonalRecord, WorkoutSession, WorkoutSet } from '@/types';
import { createDefaultProfile } from '@/profile/defaults';
import { buildSessionPlan } from '@/engine/session';
import { createRunner, initialState } from '@/session/runner';
import { asItStands, newBests, withActiveMinutes, withEditedSet, withoutWorkout, withWorkout, withWorkoutChanged } from './records';

const set = (id: string, over: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id, exerciseId: 'goblet-squat', setNumber: 1, plannedReps: 10, actualReps: 10, weight: 20, status: 'completed', rpe: null, ...over,
});

const session = (id: string, date: string, sets: WorkoutSet[], over: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id, date, dayOfWeek: 'monday', muscleGroup: 'lower', phase: 'foundation', week: 1, status: 'completed', sets,
  startedAt: `${date}T18:00:00.000Z`, completedAt: `${date}T18:50:00.000Z`, notes: '', totalVolume: 0, focus: 'lowerA', ...over,
});

const record = (exerciseId: string, weight: number, reps: number, date: string): PersonalRecord =>
  ({ exerciseId, weight, reps, date, volume: weight * reps });

const back = createDefaultProfile({ weightKg: 80, pain: { areas: ['lowerBack'] }, ladder: { hinge: 2, squat: 2 } });

const data = (sessions: WorkoutSession[], personalRecords: PersonalRecord[] = [], profile = back): AppData => ({
  version: 4, settings: {} as AppData['settings'], sessions, bodyMetrics: [], personalRecords, checkIns: [], profile,
});

describe('saving a workout', () => {
  it('is one record however often it is saved, and its sets count once', () => {
    const s = session('w1', '2026-10-05', [set('a', { weight: 24 }), set('b', { weight: 22 })]);
    const once = withWorkout(data([]), s);
    const twice = withWorkout(once, s);
    expect(twice.sessions).toHaveLength(1);
    expect(twice.personalRecords).toEqual([record('goblet-squat', 24, 10, '2026-10-05')]);
    expect(twice.personalRecords).toEqual(once.personalRecords);
  });

  it('keeps the newest workout first', () => {
    const d = withWorkout(data([session('old', '2026-09-28', [set('x')])]), session('new', '2026-10-05', [set('y')]));
    expect(d.sessions.map(s => s.id)).toEqual(['new', 'old']);
  });

  it("steps the spinal-loading ladder down when a checkpoint says worse, as the guided session does", () => {
    const s = session('w1', '2026-10-05', [set('a')], { symptomChecks: { 'goblet-squat': 'worse' } });
    expect(withWorkout(data([]), s).profile?.ladder).toMatchObject({ squat: 1, changedOn: '2026-10-05' });
  });

  it('leaves the ladder alone without checkpoint answers, and while a workout is still going', () => {
    expect(withWorkout(data([]), session('w1', '2026-10-05', [set('a')])).profile?.ladder).toEqual(back.ladder);
    const going = session('w1', '2026-10-05', [set('a')], { status: 'in_progress', symptomChecks: { 'goblet-squat': 'worse' } });
    expect(withWorkout(data([]), going).profile?.ladder).toEqual(back.ladder);
  });

  it('saves an abandoned workout as it stands, without inventing when it ended', () => {
    const left = session('w1', '2026-10-01', [set('a'), set('b', { status: 'pending', actualReps: null, weight: null }), set('c', { status: 'pending' })],
      { status: 'in_progress', completedAt: null, totalVolume: 0 });
    expect(asItStands(left)).toMatchObject({ status: 'partial', completedAt: null, totalVolume: 200 });
    const nothing = { ...left, sets: left.sets.map(x => ({ ...x, status: 'skipped' as const })) };
    expect(asItStands(nothing).status).toBe('skipped');
  });
});

describe('active time added afterwards', () => {
  it('is the minutes the person gives, and none when they take them away', () => {
    const d = data([session('w1', '2026-10-05', [set('a')], { durationSeconds: 0 })]);
    expect(withActiveMinutes(d, 'w1', 40).sessions[0].durationSeconds).toBe(2400);
    expect(withActiveMinutes(withActiveMinutes(d, 'w1', 40), 'w1', null).sessions[0].durationSeconds).toBe(0);
  });

  it("never rewrites the time a guided session measured", () => {
    const d = data([session('g1', '2026-10-05', [set('a')], { guided: true, durationSeconds: 3500 })]);
    expect(withActiveMinutes(d, 'g1', 10)).toBe(d);
  });
});

describe('loaded carries', () => {
  const carry = (id: string, weight: number, seconds: number) =>
    set(id, { exerciseId: 'suitcase-carry', weight, actualReps: seconds, plannedReps: 30 });

  it('are no part of the weight lifted or the personal records, which count reps', () => {
    const s = session('w1', '2026-10-05', [set('a', { weight: 20 }), carry('c', 20, 30)], { totalVolume: 800 });
    const d = withWorkout(data([], [record('suitcase-carry', 20, 30, '2026-09-28')]), s);
    expect(d.sessions[0].totalVolume).toBe(200);
    // A carry record made by an older version, from seconds taken as reps, goes once the carry is logged again.
    expect(d.personalRecords).toEqual([record('goblet-squat', 20, 10, '2026-10-05')]);
  });

  it('stay out of the stored weight lifted when a set is corrected or a workout is saved as it stands', () => {
    const d = withWorkout(data([]), session('w1', '2026-10-05', [set('a', { weight: 20 }), carry('c', 20, 30)]));
    expect(withEditedSet(d, 'w1', 'c', { weightKg: 24, reps: 40 }).sessions[0].totalVolume).toBe(200);
    expect(withEditedSet(d, 'w1', 'c', { weightKg: 24, reps: 40 }).personalRecords).toEqual([record('goblet-squat', 20, 10, '2026-10-05')]);
    expect(asItStands(session('w2', '2026-10-01', [carry('c', 20, 30)], { status: 'in_progress' })).totalVolume).toBe(0);
  });

  it('are not called a new best set', () => {
    const before = session('e', '2026-09-28', [carry('c1', 16, 30)]);
    const now = session('n', '2026-10-05', [carry('c2', 24, 40)]);
    expect(newBests(now, [before, now], [])).toEqual([]);
  });
});

describe('correcting a set', () => {
  it('moves the volume and the record with the edit', () => {
    const d = withWorkout(data([]), session('w1', '2026-10-05', [set('a', { weight: 24 }), set('b', { weight: 20 })]));
    const edited = withEditedSet(d, 'w1', 'a', { weightKg: 18 });
    expect(edited.sessions[0].totalVolume).toBe(380);
    expect(edited.personalRecords).toEqual([record('goblet-squat', 20, 10, '2026-10-05')]);
  });

  it("re-derives a manual record's status when a set is marked not done", () => {
    const d = data([session('w1', '2026-10-05', [set('a'), set('b'), set('c', { status: 'skipped' })])]);
    const less = withEditedSet(d, 'w1', 'b', { done: false });
    expect(less.sessions[0].sets[1]).toMatchObject({ status: 'pending', actualReps: null, weight: null });
    expect(less.sessions[0].status).toBe('partial');
    expect(withEditedSet(less, 'w1', 'b', { done: true, reps: 8, weightKg: 20 }).sessions[0].status).toBe('completed');
  });

  it("leaves a guided record's status to the guided session's own rule", () => {
    // By the manual rule one set of three is partly done; the guided rule also weighed its stretching and cardio.
    const d = data([session('g1', '2026-10-05', [set('a'), set('b'), set('c')], { guided: true })]);
    const edited = withEditedSet(withEditedSet(d, 'g1', 'a', { done: false }), 'g1', 'b', { done: false });
    expect(edited.sessions[0].sets.filter(x => x.status === 'completed')).toHaveLength(1);
    expect(edited.sessions[0].status).toBe('completed');
  });
});

describe('deleting a workout', () => {
  it('takes away the records its sets set, and falls back to the next best', () => {
    const d = withWorkout(withWorkout(data([]), session('early', '2026-09-28', [set('a', { weight: 20 })])),
      session('best', '2026-10-05', [set('b', { weight: 30 })]));
    expect(d.personalRecords).toEqual([record('goblet-squat', 30, 10, '2026-10-05')]);
    const after = withoutWorkout(d, 'best');
    expect(after.sessions.map(s => s.id)).toEqual(['early']);
    expect(after.personalRecords).toEqual([record('goblet-squat', 20, 10, '2026-09-28')]);
  });

  it('drops a record no workout supports any more, but keeps an imported one', () => {
    const imported = record('deadlift', 120, 5, '2025-12-01');
    const d = withWorkout(data([], [imported]), session('only', '2026-10-05', [set('a', { weight: 30 })]));
    const after = withoutWorkout(d, 'only');
    expect(after.sessions).toEqual([]);
    expect(after.personalRecords).toEqual([imported]);
  });

  it('does nothing for a workout that is not there', () => {
    const d = data([session('w1', '2026-10-05', [set('a')])]);
    expect(withoutWorkout(d, 'gone')).toBe(d);
  });
});

describe('new best sets', () => {
  const earlier = session('e', '2026-09-28', [set('e1', { weight: 22 })]);

  it('names a set that beats everything before it, with what it beat', () => {
    const now = session('n', '2026-10-05', [set('n1', { weight: 24 }), set('n2', { weight: 24, actualReps: 8 })]);
    expect(newBests(now, [earlier, now], [])).toEqual([
      { exerciseId: 'goblet-squat', weight: 24, reps: 10, previous: { weight: 22, reps: 10 } },
    ]);
  });

  it('does not call a first ever set, a tie or a lighter set a new best', () => {
    const first = session('n', '2026-10-05', [set('n1', { weight: 24 })]);
    expect(newBests(first, [first], [])).toEqual([]);
    const tie = session('t', '2026-10-05', [set('t1', { weight: 22 })]);
    expect(newBests(tie, [earlier, tie], [])).toEqual([]);
  });

  it('measures against what came before it only, including an imported record', () => {
    const now = session('n', '2026-10-05', [set('n1', { weight: 24 })]);
    const later = session('l', '2026-10-12', [set('l1', { weight: 40 })]);
    expect(newBests(now, [later, now, earlier], [])).toHaveLength(1);
    expect(newBests(now, [now], [record('goblet-squat', 30, 10, '2026-01-01')])).toEqual([]);
    expect(newBests(now, [now], [record('goblet-squat', 30, 10, '2026-11-01')])).toEqual([]);
  });

  it('orders two workouts on one day by when they began', () => {
    const morning = session('m', '2026-10-05', [set('m1', { weight: 20 })], { startedAt: '2026-10-05T06:00:00.000Z' });
    const evening = session('v', '2026-10-05', [set('v1', { weight: 25 })], { startedAt: '2026-10-05T18:00:00.000Z' });
    expect(newBests(evening, [morning, evening], [])).toHaveLength(1);
    expect(newBests(morning, [morning, evening], [])).toEqual([]);
  });

  it('ignores sets not done and sets with no weight', () => {
    const now = session('n', '2026-10-05', [set('n1', { weight: 50, status: 'skipped' }), set('n2', { weight: null })]);
    expect(newBests(now, [earlier, now], [])).toEqual([]);
  });
});

describe('changing the day’s workout', () => {
  const MONDAY = '2026-10-05';

  it('keeps the change for that date only, and choosing the scheduled workout drops it', () => {
    const changed = withWorkoutChanged(data([]), { date: MONDAY, focus: 'upperB', scheduled: 'lowerA' }, null, 'unused');
    expect(changed.focusOverrides).toEqual({ [MONDAY]: 'upperB' });
    const back2 = withWorkoutChanged({ ...changed, focusOverrides: { ...changed.focusOverrides, '2026-10-06': 'lowerC' } },
      { date: MONDAY, focus: 'lowerA', scheduled: 'lowerA' }, null, 'unused');
    expect(back2.focusOverrides).toEqual({ '2026-10-06': 'lowerC' });
  });

  it("banks that day's unfinished guided progress first, so the guided session starts the new workout", () => {
    const plan = buildSessionPlan({ profile: back, date: MONDAY, startDate: '2026-09-28', sessions: [] });
    const runner = createRunner(plan);
    let state = runner.reduce(initialState(plan), { type: 'start', now: 0 });
    state = runner.reduce(runner.reduce(state, { type: 'tick', now: 400_000 }), { type: 'pause', now: 400_000 });
    const saved = { plan, state, savedAt: 0, clockAt: 400_000 };
    const changed = withWorkoutChanged(data([]), { date: MONDAY, focus: 'upperB', scheduled: 'lowerA' }, saved, 'banked-1');
    expect(changed.sessions).toMatchObject([{ id: 'banked-1', guided: true, date: MONDAY, status: 'partial' }]);
    // Another day's progress is not this day's to bank.
    const other = withWorkoutChanged(data([]), { date: '2026-10-06', focus: 'lowerB', scheduled: 'upperA' }, saved, 'banked-2');
    expect(other.sessions).toEqual([]);
  });
});
