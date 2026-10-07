import { describe, it, expect } from 'vitest';
import type { WorkoutSession } from '@/types';
import type { LadderState } from '@/types/profile';
import { createDefaultProfile } from '@/profile/defaults';
import { getStrength } from '@/data/catalog';
import { prescribe, phaseFor, modeFor, affectedFirst, type DoseContext } from './dosage';
import { suggestLoad, startingLadder, updateLadder } from './progression';

const ctx = (over: Partial<DoseContext> = {}): DoseContext => ({
  phase: 'foundation', mode: 'normal', profile: createDefaultProfile(), modifiers: [], backAmber: false,
  caps: { notes: [] }, load: { kg: null, note: 'firstTime' }, ...over,
});
const meta = (id: string) => getStrength(id)!;

describe('phase and mode', () => {
  it.each([[1, 'foundation', 'normal'], [4, 'foundation', 'deload'], [6, 'hypertrophy', 'normal'], [8, 'hypertrophy', 'deload'], [10, 'strength', 'normal'], [12, 'strength', 'taper']] as const)(
    'week %i → %s / %s', (w, phase, mode) => {
      expect(phaseFor(w)).toBe(phase);
      expect(modeFor(w)).toBe(mode);
    });
});

describe('prescribe', () => {
  it('doses a Foundation main lift 3 × 8–10 with 3 reps in reserve and 120 s rest', () => {
    const rx = prescribe(meta('trap-bar-deadlift'), 'main', ctx());
    expect(rx).toMatchObject({ sets: 3, reps: [8, 10], rir: 3, restSeconds: 120, rampSets: 2 });
  });

  it('halves the sets and adds 2 reps in reserve on a deload week', () => {
    const rx = prescribe(meta('goblet-squat'), 'main', ctx({ mode: 'deload' }));
    expect(rx.sets).toBe(2);
    expect(rx.rir).toBe(5);
  });

  it('keeps spinal lifts at 5+ reps in the Strength phase below ladder level 4', () => {
    expect(prescribe(meta('trap-bar-deadlift'), 'main', ctx({ phase: 'strength' })).reps).toEqual([5, 8]);
    expect(prescribe(meta('deadlift'), 'main', ctx({ phase: 'strength' })).reps).toEqual([4, 6]);
  });

  it('applies hypertension caps: ≥ 3 reps in reserve, ≥ 6 reps and the exhale cue', () => {
    const rx = prescribe(meta('dumbbell-bench-press'), 'main', ctx({ phase: 'strength', caps: { notes: [], minRir: 3, minReps: 6, exhale: true } }));
    expect(rx.rir).toBeGreaterThanOrEqual(3);
    expect(rx.reps[0]).toBeGreaterThanOrEqual(6);
    expect(rx.caps.join(' ')).toMatch(/never hold your breath/i);
  });

  it('removes a set on a low-sleep day and adds a rep in reserve on amber back days', () => {
    expect(prescribe(meta('goblet-squat'), 'main', ctx({ modifiers: ['MINUS_SET'] })).sets).toBe(2);
    expect(prescribe(meta('goblet-squat'), 'main', ctx({ backAmber: true })).rir).toBe(4);
  });

  it('doses trunk work by holds and carries by time', () => {
    expect(prescribe(meta('side-plank'), 'trunk', ctx()).holdSeconds).toBe(20);
    expect(prescribe(meta('suitcase-carry'), 'carry', ctx()).carrySeconds).toBe(30);
  });

  it('caps holds at 30 seconds when required', () => {
    expect(prescribe(meta('plank'), 'trunk', ctx({ caps: { notes: [], maxHoldSeconds: 20 } })).holdSeconds).toBe(20);
  });

  it('starts unilateral work on the affected side', () => {
    expect(affectedFirst(createDefaultProfile({ pain: { sciaticaSide: 'right' } }))).toEqual(['right', 'left']);
    expect(prescribe(meta('split-squat'), 'secondary', ctx({ profile: createDefaultProfile({ pain: { sciaticaSide: 'left' } }) })).sideOrder).toEqual(['left', 'right']);
  });
});

function session(date: string, exerciseId: string, weight: number, reps: number[]): WorkoutSession {
  return {
    id: date, date, dayOfWeek: 'monday', muscleGroup: 'lower', phase: 'foundation', week: 1, status: 'completed',
    startedAt: null, completedAt: null, notes: '', totalVolume: 0,
    sets: reps.map((r, i) => ({ id: `${date}-${i}`, exerciseId, setNumber: i + 1, plannedReps: 10, actualReps: r, weight, status: 'completed', rpe: null })),
  };
}

describe('suggestLoad', () => {
  const rx = { reps: [8, 10] as [number, number] };

  it('asks a first-timer to find a weight and treats bodyweight moves as bodyweight', () => {
    expect(suggestLoad('goblet-squat', rx, [])).toEqual({ kg: null, note: 'firstTime' });
    expect(suggestLoad('push-ups', rx, [])).toEqual({ kg: null, note: 'bodyweight' });
  });

  it('adds weight to a non-spinal lift after one session at the top of the range', () => {
    const s = [session('2026-10-05', 'dumbbell-bench-press', 20, [10, 10, 10])];
    expect(suggestLoad('dumbbell-bench-press', rx, s)).toEqual({ kg: 22, note: 'increase' });
  });

  it('needs two sessions at the top for spinal (ladder) lifts', () => {
    const one = [session('2026-10-09', 'trap-bar-deadlift', 60, [10, 10, 10])];
    expect(suggestLoad('trap-bar-deadlift', rx, one).note).toBe('same');
    const two = [...one, session('2026-10-02', 'trap-bar-deadlift', 60, [10, 10, 10])];
    expect(suggestLoad('trap-bar-deadlift', rx, two)).toEqual({ kg: 62.5, note: 'increase' });
  });

  it('drops 5% after a set below the range and 10% after three stalled sessions', () => {
    expect(suggestLoad('goblet-squat', rx, [session('2026-10-09', 'goblet-squat', 24, [8, 7, 6])]).note).toBe('decrease');
    const stalled = ['2026-10-09', '2026-10-02', '2026-09-25'].map(d => session(d, 'goblet-squat', 24, [9, 9, 8]));
    expect(suggestLoad('goblet-squat', rx, stalled)).toEqual({ kg: 21.25, note: 'decrease' });
  });
});

describe('ladder', () => {
  const backPain = { areas: ['lowerBack', 'sciatica'] as const, worseWith: 'unknown' as const, preference: 'untested' as const };

  it('starts an unscreened back history at level 1, not 2 (spec §4.3)', () => {
    expect(startingLadder({ pain: { ...backPain, areas: [...backPain.areas] }, experience: 'intermediate' }))
      .toEqual({ hinge: 1, squat: 1, neuralGate: false });
  });

  it('unlocks level 2 only once the screen is passed, and drops to 0 for an irritable back', () => {
    const profile = { pain: { ...backPain, areas: [...backPain.areas] }, experience: 'intermediate' as const };
    expect(startingLadder(profile, { passed: true })).toEqual({ hinge: 2, squat: 2, neuralGate: false });
    expect(startingLadder(profile, { irritable: true })).toEqual({ hinge: 0, squat: 0, neuralGate: false });
  });

  it('leaves profiles with no back history where they were', () => {
    expect(startingLadder({ pain: { areas: [], worseWith: 'unknown', preference: 'untested' }, experience: 'beginner' }))
      .toEqual({ hinge: 2, squat: 2, neuralGate: true });
    expect(startingLadder({ pain: { areas: [], worseWith: 'unknown', preference: 'untested' }, experience: 'intermediate' }))
      .toEqual({ hinge: 3, squat: 3, neuralGate: true });
  });

  const withCheck = (date: string, answer: 'same' | 'worse'): WorkoutSession => ({ ...session(date, 'trap-bar-deadlift', 60, [8]), symptomChecks: { 'trap-bar-deadlift': answer } });
  const clean = ['2026-10-01', '2026-10-05', '2026-10-09', '2026-10-13'].map(d => withCheck(d, 'same'));

  it('promotes after 4 symptom-free exposures over at least 14 days', () => {
    expect(updateLadder({ hinge: 2, squat: 2, neuralGate: true, changedOn: '2026-09-28' }, clean, '2026-10-14').hinge).toBe(3);
  });

  it('promotes a ladder that has never moved, once the exposures span a fortnight', () => {
    const spread = ['2026-09-20', '2026-09-27', '2026-10-04', '2026-10-11'].map(d => withCheck(d, 'same'));
    expect(updateLadder({ hinge: 1, squat: 1, neuralGate: true }, spread, '2026-10-12').hinge).toBe(2);
    expect(updateLadder({ hinge: 1, squat: 1, neuralGate: true }, spread.slice(0, 3), '2026-10-12').hinge).toBe(1);
  });

  it('does not promote twice within 14 days', () => {
    expect(updateLadder({ hinge: 2, squat: 2, neuralGate: true, changedOn: '2026-10-05' }, clean, '2026-10-14').hinge).toBe(2);
  });

  it('counts one exposure per session, not one per checkpoint', () => {
    const twoChecks = (date: string): WorkoutSession => ({
      ...session(date, 'goblet-squat', 40, [10]),
      symptomChecks: { 'goblet-squat': 'same', 'leg-press': 'same' },
    });
    const ladder: LadderState = { hinge: 2, squat: 2, neuralGate: true, changedOn: '2026-09-20' };
    expect(updateLadder(ladder, [twoChecks('2026-10-10'), twoChecks('2026-10-11')], '2026-10-12').squat).toBe(2);
  });

  it('drops a level after a worse checkpoint', () => {
    expect(updateLadder({ hinge: 2, squat: 2, neuralGate: true }, [withCheck('2026-10-09', 'worse')], '2026-10-10').hinge).toBe(1);
  });

  it('moves the ladder once however often it is called that day', () => {
    const promoted = updateLadder({ hinge: 2, squat: 2, neuralGate: true, changedOn: '2026-09-28' }, clean, '2026-10-14');
    expect(updateLadder(promoted, clean, '2026-10-14')).toEqual(promoted);
    const demoted = updateLadder({ hinge: 2, squat: 2, neuralGate: true }, [withCheck('2026-10-09', 'worse')], '2026-10-10');
    expect(updateLadder(demoted, [withCheck('2026-10-09', 'worse')], '2026-10-10')).toEqual(demoted);
  });
});
