import { describe, it, expect } from 'vitest';
import type { WorkoutSession, WorkoutSet } from '@/types';
import { bodyweightExercise, dayText, durationText, exerciseLogs, sessionTitle, setLine, sourceLabel, timedExercise, totals } from './summary';

const set = (id: string, exerciseId: string, over: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id, exerciseId, setNumber: 1, plannedReps: 10, actualReps: 10, weight: 20, status: 'completed', rpe: null, ...over,
});

const session = (sets: WorkoutSet[], over: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id: 's', date: '2026-10-05', dayOfWeek: 'monday', muscleGroup: 'lower', phase: 'foundation', week: 1, status: 'completed', sets,
  startedAt: '2026-10-05T18:00:00.000Z', completedAt: '2026-10-05T18:47:00.000Z', notes: '', totalVolume: 0, ...over,
});

describe('what the planner doses in seconds', () => {
  it("is the planner's own holds and carries, and nothing else", () => {
    for (const id of ['plank', 'side-plank', 'farmer-carry', 'suitcase-carry']) expect(timedExercise(id)).toBe(true);
    // A curl-up has a ten-second pause, but it is dosed in reps.
    for (const id of ['goblet-squat', 'mcgill-curl-up', 'dead-bug', 'not-an-exercise']) expect(timedExercise(id)).toBe(false);
  });
});

describe('what is lifted with a weight', () => {
  it("follows the planner's load rule", () => {
    expect(bodyweightExercise('dead-bug')).toBe(true);
    expect(bodyweightExercise('push-ups')).toBe(true);
    expect(bodyweightExercise('goblet-squat')).toBe(false);
    expect(bodyweightExercise('lat-pulldown')).toBe(false);
  });
});

describe('a record in words', () => {
  it('is named for its programme day, or what an older version called it', () => {
    expect(sessionTitle({ focus: 'lowerA', muscleGroup: 'lower' })).toBe('Lower A · Squat');
    expect(sessionTitle({ guided: true, muscleGroup: 'mobility' })).toBe('Guided session');
    expect(sessionTitle({ muscleGroup: 'back' })).toBe('Back workout');
    expect(sessionTitle({ focus: 'lowerA', guided: true, muscleGroup: 'lower', planKind: 'stretch' })).toBe('Stretch');
    expect(sessionTitle({ focus: 'lowerA', guided: true, muscleGroup: 'lower', planKind: 'recovery' })).toBe('Recovery session');
    expect(sessionTitle({ focus: 'lowerA', guided: true, muscleGroup: 'lower', planKind: 'full' })).toBe('Lower A · Squat');
  });

  it('says where its numbers came from', () => {
    expect(sourceLabel({ guided: true })).toBe('Guided session');
    expect(sourceLabel({})).toBe('Logged by you');
  });

  it('writes each set in the user unit', () => {
    const opts = { timed: false, guided: false, useMetric: true };
    expect(setLine(set('a', 'goblet-squat'), opts)).toBe('10 reps · 20 kg');
    expect(setLine(set('a', 'goblet-squat', { weight: 50 }), { ...opts, useMetric: false })).toBe('10 reps · 110.2 lbs');
    expect(setLine(set('a', 'push-ups', { weight: null, actualReps: 1 }), opts)).toBe('1 rep');
    expect(setLine(set('a', 'goblet-squat', { status: 'skipped' }), opts)).toBe('Skipped');
    expect(setLine(set('a', 'goblet-squat', { status: 'pending', actualReps: null, weight: null }), opts)).toBe('Not done');
  });

  it('shows the effort an older version recorded for a set', () => {
    expect(setLine(set('a', 'goblet-squat', { rpe: 7 }), { timed: false, guided: false, useMetric: true })).toBe('10 reps · 20 kg · effort 7 of 10');
  });

  it("writes a hold's seconds, and no number at all for a guided hold, whose count is not seconds", () => {
    const plank = set('a', 'plank', { actualReps: 30, weight: null });
    expect(setLine(plank, { timed: true, guided: false, useMetric: true })).toBe('30 s');
    expect(setLine({ ...plank, actualReps: 7 }, { timed: true, guided: true, useMetric: true })).toBe('Done');
    expect(setLine(set('c', 'farmer-carry', { actualReps: 40, weight: 24 }), { timed: true, guided: false, useMetric: true })).toBe('40 s · 24 kg');
  });

  it("puts each exercise's sets together, even when a superset stored them in turn", () => {
    const logs = exerciseLogs(session([set('1', 'split-squat'), set('2', 'dead-bug'), set('3', 'split-squat'), set('4', 'dead-bug')]));
    expect(logs.map(l => [l.exerciseId, l.sets.map(s => s.id)])).toEqual([['split-squat', ['1', '3']], ['dead-bug', ['2', '4']]]);
    expect(logs[0].name).toBe('Split Squat');
  });

  it("keeps a loaded carry's seconds out of the weight lifted, which is weight × reps", () => {
    // 20 kg carried for 30 s is not 600 kg lifted.
    const s = session([set('1', 'goblet-squat'), set('2', 'suitcase-carry', { actualReps: 30, weight: 20 })]);
    expect(totals(s).volumeKg).toBe(200);
    expect(totals(session([set('2', 'farmer-carry', { actualReps: 40, weight: 24 })])).volumeKg).toBe(0);
  });

  it('totals what was done, keeping held seconds out of the rep count', () => {
    const s = session([set('1', 'goblet-squat'), set('2', 'goblet-squat', { status: 'pending', actualReps: null, weight: null }), set('3', 'plank', { actualReps: 30, weight: null })]);
    // A workout logged by hand has the clock span it was open, not active time, unless the person gave one.
    expect(totals(s)).toEqual({ done: 2, total: 3, reps: 10, volumeKg: 200, span: { from: s.startedAt, to: s.completedAt } });
    expect(totals({ ...s, durationSeconds: 0 }).activeSeconds).toBeUndefined();
    expect(totals({ ...s, durationSeconds: 1500 }).activeSeconds).toBe(1500);
    expect(totals({ ...s, startedAt: null }).span).toBeUndefined();
    // The guided player measures its own active time.
    expect(totals({ ...s, guided: true, durationSeconds: 3500 })).toMatchObject({ activeSeconds: 3500 });
    expect(totals({ ...s, guided: true, durationSeconds: 3500 }).span).toBeUndefined();
  });

  it('says how long in plain words', () => {
    expect(durationText(20)).toBe('Under a minute');
    expect(durationText(2820)).toBe('47 min');
    expect(durationText(3600)).toBe('1 h');
    expect(durationText(3900)).toBe('1 h 5 min');
  });

  it('names the day, with the year once it is not this year', () => {
    // The punctuation is the locale's; the parts are what matter.
    expect(dayText('2026-10-08', '2026-10-08', 'en-GB')).toBe('Thursday 8 October');
    expect(dayText('2025-10-08', '2026-10-08', 'en-GB')).toMatch(/^Wednesday,? 8 October 2025$/);
  });
});
