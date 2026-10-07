import { describe, it, expect } from 'vitest';
import type { WorkoutSession } from '@/types';
import { createDefaultProfile } from '@/profile/defaults';
import { createSpeechSizer, exposureCounter } from './speech';

const session = (date: string, ids: string[], mobility: string[] = []): WorkoutSession => ({
  id: date, date, dayOfWeek: 'monday', muscleGroup: 'lower', phase: 'foundation', week: 2, status: 'completed',
  sets: ids.map((exerciseId, i) => ({ id: `${date}-${i}`, exerciseId, setNumber: 1, plannedReps: 8, actualReps: 8, weight: 20, status: 'completed' as const, rpe: null })),
  startedAt: null, completedAt: null, notes: '', totalVolume: 0,
  mobility: mobility.map(exerciseId => ({ exerciseId, seconds: 40 })),
});

describe('exposure counter', () => {
  it('counts one exposure per session, strength and mobility alike', () => {
    const seen = exposureCounter([
      session('2026-10-01', ['goblet-squat', 'goblet-squat'], ['cat-cow']),
      session('2026-10-02', ['goblet-squat'], ['cat-cow', 'cat-cow']),
    ]);
    expect(seen('goblet-squat')).toBe(2);
    expect(seen('cat-cow')).toBe(2);
    expect(seen('deadlift')).toBe(0);
  });
});

describe('speech sizer', () => {
  const profile = createDefaultProfile({});
  const sizer = createSpeechSizer(profile, []);

  it('gives a first exposure more time than a later one, within bounds', () => {
    const first = sizer.prepSeconds('cat-cow', null, 6);
    const later = createSpeechSizer(profile, Array.from({ length: 5 }, (_, i) => session(`2026-09-0${i + 1}`, [], ['cat-cow']))).prepSeconds('cat-cow', null, 6);
    expect(first).toBeGreaterThanOrEqual(later);
    expect(first).toBeLessThanOrEqual(18);
    expect(later).toBeGreaterThanOrEqual(6);
  });

  it('never returns less than the floor it is given', () => {
    expect(sizer.prepSeconds('cat-cow', null, 14)).toBeGreaterThanOrEqual(14);
    expect(sizer.setupSeconds('goblet-squat', undefined, 20)).toBeGreaterThanOrEqual(20);
  });

  it('respects the setup cap the time fitter applies', () => {
    const rx = { sets: 3, targetReps: 8, rir: 2, load: { kg: 20, note: 'same' } };
    expect(sizer.setupSeconds('trap-bar-deadlift', rx, 30, 45)).toBeLessThanOrEqual(45);
    expect(sizer.setupSeconds('trap-bar-deadlift', rx, 30, 100)).toBeLessThanOrEqual(100);
  });

  it('allows more time for a longer instruction', () => {
    const short = sizer.setupSeconds('calf-raises', undefined, 10);
    const long = sizer.setupSeconds('trap-bar-deadlift', { sets: 3, targetReps: 8, rir: 2, load: { kg: null, note: 'firstTime' } }, 10);
    expect(long).toBeGreaterThan(short);
  });

  it('sizes a recorded pack by its own measured pace, not the device rate', () => {
    const slow = createSpeechSizer(createDefaultProfile({ voice: { pack: 'af_nicole' } }), []);
    const quick = createSpeechSizer(createDefaultProfile({ voice: { pack: 'af_heart' } }), []);
    expect(slow.prepSeconds('cat-cow', null, 6)).toBeGreaterThanOrEqual(quick.prepSeconds('cat-cow', null, 6));
  });
});
