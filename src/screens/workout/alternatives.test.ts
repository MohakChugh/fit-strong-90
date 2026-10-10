import { describe, it, expect } from 'vitest';
import type { AppData } from '@/types';
import type { UserProfile } from '@/types/profile';
import { createDefaultProfile } from '@/profile/defaults';
import { planFor } from '@/hooks/useGuided';
import { getStrength } from '@/data/catalog';
import { findAlternative, plannerAlternatives, standsIn } from './alternatives';

const MONDAY = '2026-10-05';
const gym = createDefaultProfile({ weightKg: 80 });
/** A sciatica back early on the spinal-loading ladder: squat level 1. */
const sciatica = createDefaultProfile({
  weightKg: 80, pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left' }, ladder: { hinge: 1, squat: 1, neuralGate: false },
});

function setup(profile: UserProfile) {
  const data = { version: 4, settings: { startDate: '2026-09-28' }, sessions: [], bodyMetrics: [], personalRecords: [], checkIns: [], profile } as unknown as AppData;
  const build = (avoid: string[]) => planFor(data, { ...profile, dislikes: [...profile.dislikes, ...avoid] }, MONDAY);
  const plan = build([]);
  const ask = (slotId: string, inWorkout = true) => {
    const planned = plan.exercises.find(e => e.slotId === slotId)!.exerciseId;
    const others = plan.exercises.map(e => e.exerciseId).filter(id => id !== planned);
    return plannerAlternatives(build, { slotId, planned, avoid: [planned], inWorkout: inWorkout ? others : [] });
  };
  return { build, plan, ask };
}

describe("the planner's alternatives", () => {
  it('offers what the planner itself would put in the slot instead, dosed for today', () => {
    const alts = setup(gym).ask('lowerA.main');
    expect(alts.map(a => a.exerciseId)).toEqual(['goblet-box-squat', 'box-squat', 'glute-bridge']);
    // A main slot's dose: three working sets, with the same rest as the planned lift.
    expect(alts.map(a => a.target.sets)).toEqual([3, 3, 3]);
    expect(alts[0].target).toMatchObject({ reps: 9, restSeconds: 120, load: { note: 'firstTime' } });
  });

  it('never offers what the spinal-loading ladder rules out', () => {
    const { plan, ask } = setup(sciatica);
    expect(plan.exercises.find(e => e.slotId === 'lowerA.main')?.exerciseId).toBe('goblet-box-squat');
    const alts = ask('lowerA.main');
    expect(alts.length).toBeGreaterThan(0);
    for (const a of alts) expect(getStrength(a.exerciseId)?.ladder?.level ?? 0).toBeLessThanOrEqual(1);
    expect(alts.map(a => a.exerciseId)).not.toContain('goblet-squat');
    expect(alts.map(a => a.exerciseId)).not.toContain('barbell-squat');
    // A spinal slot keeps its back-symptom checkpoint whatever fills it.
    expect(alts.every(a => a.checkpoint)).toBe(true);
  });

  it('does not offer an exercise the workout already has', () => {
    const { ask } = setup(gym);
    expect(ask('lowerA.secondary').map(a => a.exerciseId)).toEqual(['goblet-box-squat', 'box-squat', 'glute-bridge']);
    // Asked without the rest of the workout in mind, the planner's next pick is the split squat already in it.
    expect(ask('lowerA.secondary', false).map(a => a.exerciseId)).toContain('split-squat');
  });

  it('does not offer a filler drill that trains something else', () => {
    // With squat level 1, the planner keeps a squat slot filled with an incline push-up as a last resort.
    const alts = setup(sciatica).ask('lowerA.main').map(a => a.exerciseId);
    expect(alts).not.toContain('incline-push-up');
    expect(alts).not.toContain('prone-y-t');
  });

  it('asks without touching the profile', () => {
    const { ask } = setup(gym);
    ask('lowerA.main');
    expect(gym.dislikes).toEqual([]);
  });

  it('finds the alternative a swap chose again, so a reload can restore it', () => {
    const { build } = setup(gym);
    expect(findAlternative(build, 'lowerA.main', 'goblet-squat', 'box-squat')).toMatchObject({ exerciseId: 'box-squat', target: { sets: 3 } });
    expect(findAlternative(build, 'lowerA.main', 'goblet-squat', 'deadlift')).toBeUndefined();
  });
});

describe('what stands in for what', () => {
  it('is what the slot ranks, moves the same way, or works the same muscles', () => {
    expect(standsIn('band-pull-apart', 'lateral-raises', ['lateral-raises', 'band-pull-apart'])).toBe(true);
    expect(standsIn('bird-dog', 'dead-bug', [])).toBe(true);
    expect(standsIn('knee-to-wall-rock', 'seated-calf-raise', [])).toBe(true);
    expect(standsIn('glute-bridge', 'goblet-squat', [])).toBe(true);
    expect(standsIn('incline-push-up', 'goblet-squat', [])).toBe(false);
    expect(standsIn('prone-y-t', 'seated-calf-raise', [])).toBe(false);
  });
});
