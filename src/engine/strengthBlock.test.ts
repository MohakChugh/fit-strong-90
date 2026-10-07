import { describe, it, expect } from 'vitest';
import type { PlannedExercise, Prescription, SlotRole } from '@/types/plan';
import { fitStrength } from './strengthBlock';
import { totalSeconds } from './timing';
import type { Slot } from './templates';

const rx = (over: Partial<Prescription> = {}): Prescription => ({
  sets: 3, reps: [8, 10], targetReps: 8, rir: 3, restSeconds: 120,
  tempo: { lower: 3, pauseBottom: 0, lift: 1, pauseTop: 0 }, rampSets: 2,
  load: { kg: 60, note: 'same' }, caps: [], ...over,
});

const ex = (exerciseId: string, slotId: string, role: SlotRole, sets: number): PlannedExercise =>
  ({ exerciseId, slotId, role, rx: rx({ sets, ...(role === 'main' ? {} : { rampSets: 0, restSeconds: 60 }) }) });

/** Lower C: heavy hinge, then a squat accessory and two isolations. */
const SLOTS: Slot[] = [
  { id: 'main', role: 'main', candidates: ['trap-bar-deadlift'], spinal: true },
  { id: 'squat', role: 'secondary', candidates: ['goblet-squat'], spinal: true },
  { id: 'curl', role: 'isolation', candidates: ['lying-leg-curl'] },
  { id: 'calf', role: 'isolation', candidates: ['seated-calf-raise'] },
];

const fit = (exercises: PlannedExercise[], budgetSeconds: number) =>
  fitStrength(exercises, { slots: SLOTS, backProfile: true, budgetSeconds, nextTitle: 'Incline walk' });

const setsOf = (r: ReturnType<typeof fit>, slotId: string) => r.exercises.find(e => e.slotId === slotId)?.rx.sets;

describe('fitStrength budget', () => {
  it('never adds sets to the main lift or a spinal slot, even with minutes to spare', () => {
    const planned = [
      ex('trap-bar-deadlift', 'main', 'main', 3),
      ex('goblet-squat', 'squat', 'secondary', 2),
      ex('lying-leg-curl', 'curl', 'isolation', 2),
    ];
    const r = fit(planned, 1920);
    expect(setsOf(r, 'main')).toBe(3);
    expect(setsOf(r, 'squat')).toBe(2);
    expect(setsOf(r, 'curl')).toBe(2);
  });

  it('keeps a deload at half the sets instead of growing past them (spec §4.3)', () => {
    const deload = [
      ex('trap-bar-deadlift', 'main', 'main', 2),
      ex('goblet-squat', 'squat', 'secondary', 1),
      ex('lying-leg-curl', 'curl', 'isolation', 1),
    ];
    const r = fit(deload, 1920);
    expect(setsOf(r, 'main')).toBe(2);
    expect(setsOf(r, 'squat')).toBe(1);
    expect(setsOf(r, 'curl')).toBe(1);
    // A deload must never carry more main-lift volume than a normal week.
    const normal = fit([
      ex('trap-bar-deadlift', 'main', 'main', 3),
      ex('goblet-squat', 'squat', 'secondary', 2),
      ex('lying-leg-curl', 'curl', 'isolation', 2),
    ], 1920);
    expect(setsOf(r, 'main')!).toBeLessThan(setsOf(normal, 'main')!);
  });

  it('spends spare time on the closing transition, and still fills the budget', () => {
    const r = fit([ex('trap-bar-deadlift', 'main', 'main', 2)], 1920);
    expect(r.steps.at(-1)).toMatchObject({ kind: 'talk', topic: 'transition' });
    expect(totalSeconds(r.steps)).toBe(1920);
  });

  it('cuts accessory work when over budget and may restore it, never above the prescription', () => {
    const planned = [
      ex('trap-bar-deadlift', 'main', 'main', 4),
      ex('goblet-squat', 'squat', 'secondary', 3),
      ex('lying-leg-curl', 'curl', 'isolation', 3),
      ex('seated-calf-raise', 'calf', 'isolation', 3),
    ];
    const r = fit(planned, 1200);
    expect(setsOf(r, 'main')).toBe(4);
    for (const e of r.exercises) {
      const asked = planned.find(p => p.slotId === e.slotId)!.rx.sets;
      expect(e.rx.sets, e.slotId).toBeLessThanOrEqual(asked);
    }
  });
});
