import { describe, it, expect } from 'vitest';
import { weeklyPlan, getActiveExercisesForPhase, getPhaseInfo, getWorkoutsPerPhase, getDayPlan, getTrainingDays, getExerciseSetsAndReps } from '@/data/program';
import { getExerciseById, exercises } from '@/data/exercises';
import type { Phase } from '@/types';

describe('program <-> exercise data integrity', () => {
  it('every exercise referenced by the program exists in the library', () => {
    const missing: string[] = [];
    for (const day of weeklyPlan)
      for (const ex of day.exercises)
        if (!getExerciseById(ex.exerciseId)) missing.push(ex.exerciseId);
    expect(missing).toEqual([]);
  });

  it('module init did not leave program helpers undefined (circular-import guard)', () => {
    expect(typeof getPhaseInfo).toBe('function');
    expect(typeof getWorkoutsPerPhase).toBe('function');
    expect(getPhaseInfo(1).name).toBe('Foundation');
    expect(getWorkoutsPerPhase('strength')).toBe(24);
  });

  it('each phase yields a non-empty exercise list for every training day', () => {
    const phases: Phase[] = ['foundation', 'hypertrophy', 'strength'];
    for (const day of getTrainingDays())
      for (const phase of phases)
        expect(getActiveExercisesForPhase(day, phase).length).toBeGreaterThan(0);
  });

  it('active exercises always have sets > 0 and reps > 0', () => {
    const phases: Phase[] = ['foundation', 'hypertrophy', 'strength'];
    for (const day of weeklyPlan)
      for (const phase of phases)
        for (const ex of getActiveExercisesForPhase(day, phase)) {
          const { sets, reps } = getExerciseSetsAndReps(ex, phase);
          expect(sets).toBeGreaterThan(0);
          expect(reps).toBeGreaterThan(0);
        }
  });

  it('all 7 days resolve and exactly one is a rest day', () => {
    const days = weeklyPlan.map(d => getDayPlan(d.dayOfWeek));
    expect(days).toHaveLength(7);
    expect(days.filter(d => d.isRestDay)).toHaveLength(1);
  });

  it('exercise ids are unique', () => {
    const ids = exercises.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
