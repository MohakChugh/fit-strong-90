import { describe, it, expect } from 'vitest';
import type { WorkoutSet } from '@/types';
import type { Group, Item, Target } from './model';
import { amountText, groupText, plannerSwapText, progressText, rampText, targetText } from './words';

const target = (over: Partial<Target> = {}): Target => ({ sets: 3, reps: 9, timed: false, perSide: false, rampSets: 0, caps: [], ...over });
const set = (n: number, status: WorkoutSet['status']): WorkoutSet =>
  ({ id: `s${n}`, exerciseId: 'x', setNumber: n, plannedReps: 9, actualReps: status === 'completed' ? 9 : null, weight: null, status, rpe: null });
const item = (key: string, exerciseId: string, statuses: WorkoutSet['status'][] = ['pending']): Item =>
  ({ key, exerciseId, target: target(), checkpoint: false, sets: statuses.map((s, i) => set(i + 1, s)) });

describe('the plan in words', () => {
  it('states sets, reps or seconds, and sides', () => {
    expect(targetText(target())).toBe('3 sets of 9 reps');
    expect(targetText(target({ range: [8, 10] }))).toBe('3 sets of 8–10 reps');
    expect(targetText(target({ sets: 1, reps: 30, timed: true }))).toBe('1 set of 30 s');
    expect(targetText(target({ sets: 2, reps: 20, timed: true, perSide: true }))).toBe('2 sets of 20 s each side');
    expect(amountText(target({ range: [8, 10] }))).toBe('8–10 reps');
    expect(amountText(target({ reps: 1 }))).toBe('1 rep');
    expect(amountText(target({ reps: 20, timed: true, perSide: true }))).toBe('20 s each side');
  });

  it('mentions warm-up sets only when the plan has them', () => {
    expect(rampText(target({ rampSets: 2 }))).toBe('Warm up first with 2 lighter sets, not logged.');
    expect(rampText(target({ rampSets: 1 }))).toBe('Warm up first with 1 lighter set, not logged.');
    expect(rampText(target())).toBeUndefined();
  });

  it("gives the planner's reason in its own sentence", () => {
    expect(plannerSwapText({ exerciseId: 'goblet-squat', plannerSwap: { from: 'barbell-squat', reason: 'unlocks at squat level 4' } }))
      .toBe('Goblet Squat instead of Barbell Back Squat: unlocks at squat level 4.');
    expect(plannerSwapText({ exerciseId: 'goblet-squat' })).toBeUndefined();
  });

  it('names the other exercises of a superset or circuit', () => {
    const items = [item('a', 'split-squat'), item('b', 'dead-bug'), item('c', 'bird-dog')];
    const pair: Group = { id: 'p', kind: 'superset', keys: ['a', 'b'], restBetween: 60, restAfterRound: 60 };
    expect(groupText(pair, items, 'a')).toBe('Superset with Dead Bug: one set of each in turn.');
    const circuit: Group = { ...pair, kind: 'circuit', keys: ['a', 'b', 'c'] };
    expect(groupText(circuit, items, 'b')).toBe('Circuit with Split Squat and Bird Dog: one set of each, then round again.');
  });

  it('says where an exercise stands', () => {
    expect(progressText(item('a', 'x', ['completed', 'pending', 'pending']))).toBe('Set 2 of 3');
    expect(progressText(item('a', 'x', ['completed', 'completed']))).toBe('All 2 sets done');
    expect(progressText(item('a', 'x', ['completed', 'skipped']))).toBe('1 of 2 sets done');
    expect(progressText(item('a', 'x', ['skipped', 'skipped']))).toBe('Skipped');
  });
});
