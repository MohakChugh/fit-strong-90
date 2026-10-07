import { describe, it, expect } from 'vitest';
import { loadAdvice, manualDayPlan, swapOptions } from './manual';
import { buildSessionPlan } from '@/engine/session';
import { createDefaultProfile } from '@/profile/defaults';

const profile = createDefaultProfile({ weightKg: 80 });
const plan = (date: string, focusOverride?: Parameters<typeof buildSessionPlan>[0]['focusOverride']) =>
  buildSessionPlan({ profile, date, startDate: '2026-09-28', sessions: [], ...(focusOverride ? { focusOverride } : {}) });

describe('manualDayPlan', () => {
  it('logs the generated strength block with its sets, reps and rests', () => {
    const p = plan('2026-10-05');
    const day = manualDayPlan(p, true);
    expect(day.isRestDay).toBe(false);
    expect(day.label).toBe(p.label);
    expect(day.muscleGroup).toBe('lower');
    expect(day.exercises.map(e => e.exerciseId)).toEqual(p.exercises.map(e => e.exerciseId));
    for (const [i, e] of day.exercises.entries()) {
      const rx = p.exercises[i].rx;
      expect(e.sets).toBe(rx.sets);
      expect(e.restSeconds).toBe(rx.restSeconds);
      expect(e.reps).toBe(rx.holdSeconds ?? rx.carrySeconds ?? rx.targetReps);
      expect(e.notes.length).toBeGreaterThan(0);
    }
  });

  it('counts holds and carries in seconds', () => {
    const days = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'].map(d => manualDayPlan(plan(d), true));
    const timed = days.flatMap(d => d.exercises).filter(e => e.unit === 'seconds');
    expect(timed.length).toBeGreaterThan(0);
    for (const e of timed) expect(e.reps).toBeGreaterThanOrEqual(15);
  });

  it('treats a rest day as a rest day', () => {
    expect(manualDayPlan(plan('2026-10-11'), true).isRestDay).toBe(true);
  });

  it('follows a swapped focus', () => {
    expect(manualDayPlan(plan('2026-10-05', 'upperB'), true)).toMatchObject({ muscleGroup: 'upper', label: 'Upper B · Pull-Down & Press' });
  });
});

describe('swapOptions', () => {
  it('offers each training day once, in week order', () => {
    expect(swapOptions(profile).map(o => o.focus)).toEqual(['lowerA', 'upperA', 'lowerB', 'upperB', 'lowerC', 'upperC']);
  });

  it('still offers full-body workouts when no training days are set', () => {
    expect(swapOptions({ trainingDays: [] }).map(o => o.focus)).toEqual(['fullA', 'fullB', 'fullC']);
  });
});

describe('loadAdvice', () => {
  it('words each load note', () => {
    expect(loadAdvice({ kg: 40, note: 'increase' }, true)).toBe('Add a little: 40 kg.');
    expect(loadAdvice({ kg: null, note: 'firstTime' }, true)).toMatch(/First time/);
    expect(loadAdvice({ kg: null, note: 'bodyweight' }, false)).toBe('Bodyweight.');
  });

  it('converts the suggested kilograms for imperial users', () => {
    // Used to read "Add a little: 40 lbs." for a 40 kg suggestion.
    expect(loadAdvice({ kg: 40, note: 'increase' }, false)).toBe('Add a little: 88.2 lbs.');
  });
});
