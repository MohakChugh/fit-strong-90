import { describe, expect, it } from 'vitest';
import type { Readiness } from '@/types/checkin';
import type { HealthProfile, PainProfile, UserProfile } from '@/types/profile';
import { createDefaultProfile } from '@/profile/defaults';
import { candidatesOf, planningProfile, readinessAcross } from './candidates';
import { profileOnlyReadiness } from './readiness';

const KNOWN: Partial<HealthProfile> = { medicinesReviewed: true, bpMedicinesReviewed: true, currentlyActive: true, clearance: 'vigorous', fluidRestriction: false };
const base = createDefaultProfile({ weightKg: 70, needsHealthReview: false, health: KNOWN });
const BASE_R: Readiness = profileOnlyReadiness(base);
const two = (stored: UserProfile, pending: UserProfile): UserProfile => ({ ...pending, candidates: [stored, pending] });
/** Which of the two the engine plans with, each read with `readinessOf`. */
const chosen = (stored: UserProfile, pending: UserProfile, readinessOf: (p: UserProfile) => Readiness = () => BASE_R) => {
  const p = planningProfile(two(stored, pending), readinessOf);
  return p === undefined ? 'none' : p.health === pending.health && p.pain === pending.pain && p.ladder === pending.ladder ? 'pending' : 'stored';
};
const health = (h: Partial<HealthProfile>): UserProfile => ({ ...base, health: { ...base.health, ...h } });
const pain = (x: Partial<PainProfile>): UserProfile => ({ ...base, pain: { ...base.pain, ...x } });

describe('which candidate a plan comes from: the one at least as strict as every other (board D168)', () => {
  it('one alone, or none carried: the profile itself', () => {
    expect(candidatesOf(base)).toEqual([base]);
    expect(planningProfile(base, () => BASE_R)).toBe(base);
  });

  it('of two the same, the newer', () => {
    expect(chosen(base, { ...base, health: { ...base.health } })).toBe('pending');
  });

  // Readiness the same for both: each of the profile's own facts decides by itself.
  const STRICTER: [string, UserProfile, UserProfile][] = [
    ['a closed nerve gate (H5R-05)', { ...base, ladder: { ...base.ladder, neuralGate: true } }, { ...base, ladder: { ...base.ladder, neuralGate: false } }],
    ['a lower hinge level', { ...base, ladder: { ...base.ladder, hinge: 2 } }, { ...base, ladder: { ...base.ladder, hinge: 1 } }],
    ['a lower squat level', { ...base, ladder: { ...base.ladder, squat: 2 } }, { ...base, ladder: { ...base.ladder, squat: 1 } }],
    ['a direction that makes the back worse (H5R-06)', pain({ areas: ['lowerBack'], worseWith: 'unknown' }), pain({ areas: ['lowerBack'], worseWith: 'flexion' })],
    ['lows with no meter (H5R-08)', health({ diabetes: 'type2', insulin: 'injections_or_pump', glucoseMonitor: 'meter' }), health({ diabetes: 'type2', insulin: 'injections_or_pump', glucoseMonitor: 'none' })],
    ['a fluid limit', health({ fluidRestriction: false }), health({ fluidRestriction: 'unsure' })],
    ['a pain area more', pain({ areas: ['knee'] }), pain({ areas: ['knee', 'calf'] })],
    ['no direction leaned on', pain({ areas: ['lowerBack'], preference: 'flexion' }), pain({ areas: ['lowerBack'], preference: 'untested' })],
    ['a higher glucose to start', health({ diabetes: 'type2', insulin: 'injections_or_pump', highHypoRisk: false }), health({ diabetes: 'type2', insulin: 'injections_or_pump', highHypoRisk: true })],
    ['a lower blood pressure to stop', health({ clinicianTargets: { bpStopSystolic: 180 } }), health({ clinicianTargets: { bpStopSystolic: 160 } })],
    ['no clinician’s blood-pressure permission', health({ bpExercisePermission: { sys: 170, dia: 105 } }), health({})],
    ['ketones that matter', health({ sglt2i: false }), health({ sglt2i: true })],
    ['blood pressure that may be high', health({ hypertension: 'none' }), health({ hypertension: 'unsure' })],
    ['the health review still to do', base, { ...base, health: { ...base.health }, needsHealthReview: true }],
  ];
  for (const [what, looser, stricter] of STRICTER) {
    it(`plans with ${what}, whichever is newer`, () => {
      expect(chosen(looser, stricter)).toBe('pending');
      expect(chosen(stricter, looser)).toBe('stored');
    });
  }

  it('where each holds something the other doesn’t, neither: no plan (H5R-06, H5R-07)', () => {
    expect(chosen(pain({ areas: ['lowerBack'], worseWith: 'flexion' }), pain({ areas: ['lowerBack'], worseWith: 'extension' }))).toBe('none');
    expect(chosen(pain({ areas: ['knee'] }), pain({ areas: ['calf'] }))).toBe('none');
  });

  // The profiles the same: the day's readiness decides.
  const r = (x: Partial<Readiness>): Readiness => ({ ...BASE_R, ...x });
  const READINESS: [string, Readiness, Readiness][] = [
    ['a more serious disposition', r({ disposition: 'adjust' }), r({ disposition: 'hold' })],
    ['a more serious outcome', r({ outcome: 'green' }), r({ outcome: 'recovery' })],
    ['a back worse today', r({ back: 'green' }), r({ back: 'amber' })],
    ['a modifier more', r({ modifiers: [] }), r({ modifiers: ['COOL'] })],
    ['a mode refused', r({ refusedModes: [] }), r({ refusedModes: ['walk'] })],
    ['a reason more', r({ reasons: [] }), r({ reasons: [{ code: 'x', message: 'x', outcome: 'amber' }] })],
    ['something to do first', r({ actions: [] }), r({ actions: ['Take 15 g of fast-acting carbohydrate now.'] })],
    ['a reading unresolved', r({ unresolved: [] }), r({ unresolved: ['severeLow'] })],
    ['a longer wait to re-check', r({ recheckMinutes: 0 }), r({ recheckMinutes: 15 })],
    ['heavy lifts capped', r({ capHeavy: false }), r({ capHeavy: true })],
    ['leg symptoms', r({ nerveFlag: false }), r({ nerveFlag: true })],
    ['effort by feel, not heart rate', r({ rpeOnly: false }), r({ rpeOnly: true })],
    ['a reading awaited', r({ awaitingReading: false }), r({ awaitingReading: true })],
  ];
  for (const [what, looser, stricter] of READINESS) {
    it(`plans with ${what}`, () => {
      const stored = { ...base, health: { ...base.health } };
      const pending = { ...base, health: { ...base.health } };
      expect(chosen(stored, pending, p => (p.health === pending.health ? stricter : looser))).toBe('pending');
      expect(chosen(stored, pending, p => (p.health === pending.health ? looser : stricter))).toBe('stored');
    });
  }

  it('the day’s readiness: the planning candidate’s, or with none the most serious', () => {
    const stored = pain({ areas: ['lowerBack'], worseWith: 'flexion' });
    const pending = pain({ areas: ['lowerBack'], worseWith: 'extension' });
    const serious = r({ disposition: 'hold' });
    expect(readinessAcross(two(stored, pending), p => (p.pain === pending.pain ? serious : BASE_R))).toBe(serious);
  });
});
