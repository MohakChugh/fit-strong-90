import { describe, it, expect } from 'vitest';
import { createDefaultProfile, type ProfileInput } from '@/profile/defaults';
import type { MobilityDayType, Step } from '@/types/plan';
import { getMeta } from '@/data/catalog';
import { buildSessionPlan } from './session';
import { activeConditions } from './safety';
import { profileOnlyReadiness } from './readiness';
import { EQUIPMENT_BY_ACCESS } from '@/data/catalog';
import { totalSeconds } from './timing';
import { exposuresIn, mobilityBlock, regionsOf } from './mobility';

const DAY_TYPES: MobilityDayType[] = ['upperPush', 'upperPull', 'lowerSquat', 'lowerHinge', 'fullBody', 'core'];

function block(p: ProfileInput, dayType: MobilityDayType, budgetSeconds = 900) {
  const profile = createDefaultProfile(p);
  const readiness = profileOnlyReadiness(profile);
  return mobilityBlock({
    dayType, profile, readiness, conditions: activeConditions(profile, readiness),
    equipment: EQUIPMENT_BY_ACCESS[profile.equipment], week: 2, budgetSeconds, coverage: {}, idPrefix: 'm',
  });
}

const BACK: ProfileInput = { pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left', worseWith: 'flexion' } };

describe('mobility block', () => {
  // The spec gives mobility a fixed 15 minutes; the fitter must land on it exactly.
  for (const dayType of DAY_TYPES) {
    it(`${dayType} day fills its budget to the second`, () => {
      for (const p of [{}, BACK, { equipment: 'homeNone' } as ProfileInput]) {
        const steps = block(p, dayType);
        expect(totalSeconds(steps), `${dayType}`).toBe(900);
        expect(steps.some(s => s.kind === 'hold' || s.kind === 'drill')).toBe(true);
      }
    });
  }

  it('honours a shorter budget too', () => {
    expect(totalSeconds(block({}, 'lowerHinge', 600))).toBe(600);
  });

  it('never repeats a drill within one block', () => {
    for (const dayType of DAY_TYPES) {
      const ids = block(BACK, dayType).flatMap(s => (s.kind === 'hold' || s.kind === 'drill' ? [s.exerciseId] : []));
      expect(new Set(ids).size, dayType).toBe(ids.length);
    }
  });

  // Nerve symptoms rule out end-range hamstring tension; the calf swap keeps the region covered.
  it('swaps the straight-leg calf stretch when leg symptoms are active', () => {
    const flagged = createDefaultProfile(BACK);
    const readiness = { ...profileOnlyReadiness(flagged), nerveFlag: true, back: 'amber' as const };
    const steps = mobilityBlock({
      dayType: 'lowerHinge', profile: flagged, readiness, conditions: activeConditions(flagged, readiness),
      equipment: EQUIPMENT_BY_ACCESS.fullGym, week: 2, budgetSeconds: 900, coverage: {}, idPrefix: 'm',
    });
    const ids = steps.flatMap(s => (s.kind === 'hold' || s.kind === 'drill' ? [s.exerciseId] : []));
    expect(ids).not.toContain('supine-hamstring-stretch-strap');
    expect(ids.some(id => id.startsWith('sciatic-nerve-glide'))).toBe(true);
  });

  it('keeps the head above the heart when HEAD applies', () => {
    const profile = createDefaultProfile({ health: { retinopathy: 'severe_or_proliferative' } });
    const readiness = profileOnlyReadiness(profile);
    expect(readiness.modifiers).toContain('HEAD');
    for (const dayType of DAY_TYPES) {
      const steps = mobilityBlock({
        dayType, profile, readiness, conditions: activeConditions(profile, readiness),
        equipment: EQUIPMENT_BY_ACCESS.fullGym, week: 2, budgetSeconds: 900, coverage: {}, idPrefix: 'm',
      });
      const ids = steps.flatMap(s => (s.kind === 'hold' || s.kind === 'drill' ? [s.exerciseId] : []));
      expect(ids, dayType).not.toContain('childs-pose');
    }
  });

  it('counts region exposures from the steps it built', () => {
    const steps = block(BACK, 'lowerHinge');
    const ex = exposuresIn(steps);
    expect(Object.keys(ex).length).toBeGreaterThan(3);
    for (const [region, n] of Object.entries(ex)) {
      expect(n, region).toBeGreaterThan(0);
    }
  });

  it('gives every drill it plans at least one region', () => {
    for (const dayType of DAY_TYPES) {
      for (const s of block(BACK, dayType)) {
        if (s.kind !== 'hold' && s.kind !== 'drill') continue;
        expect(regionsOf(s.exerciseId).length, s.exerciseId).toBeGreaterThan(0);
      }
    }
  });
});

/**
 * The core template (rest-day and recovery sessions, and Stretch) follows the
 * same rules as the training-day deep slot: no long hold that tensions an
 * un-cleared sciatic nerve (gate G5), and no long holds on an irritable back.
 */
describe('core template safety guards', () => {
  const START = '2026-09-28'; // Monday; 2026-10-11 is a rest Sunday
  const UNCLEARED: ProfileInput = {
    pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left', worseWith: 'flexion' },
    ladder: { hinge: 2, squat: 2, neuralGate: false },
    flexibilityTargets: ['hamstrings', 'hipFlexors', 'thoracic'],
  };
  const day = { urgentSymptoms: false, emergency: [], news: [], energy: 4 as const };
  const tensionHolds = (steps: Step[]) => steps.filter(s => s.kind === 'hold' && (getMeta(s.exerciseId)?.flags.sciaticTension ?? 0) >= 2);

  it('holds no high-tension sciatic stretch on a rest day while the nerve gate is not cleared', () => {
    const plan = buildSessionPlan({ profile: createDefaultProfile(UNCLEARED), date: '2026-10-11', startDate: START, sessions: [] });
    expect(plan.kind).toBe('restDay');
    expect(tensionHolds(plan.steps)).toEqual([]);
  });

  it('holds no high-tension sciatic stretch in a recovery session while the nerve gate is not cleared', () => {
    const yesterday = { ...day, date: '2026-10-08', sleep: 'lt5' as const };
    const plan = buildSessionPlan({
      profile: createDefaultProfile(UNCLEARED), date: '2026-10-09', startDate: START, sessions: [],
      checkIn: { ...day, date: '2026-10-09', sleep: 'lt5' }, recentCheckIns: [yesterday],
    });
    expect(plan.kind).toBe('recovery');
    expect(tensionHolds(plan.steps)).toEqual([]);
  });

  it('drops the long flexibility-target holds on an irritable-back day', () => {
    const back: ProfileInput = { pain: { areas: ['lowerBack'] }, ladder: { neuralGate: true }, flexibilityTargets: ['hipFlexors', 'hamstrings'] };
    const plan = buildSessionPlan({
      profile: createDefaultProfile(back), date: '2026-10-11', startDate: START, sessions: [],
      checkIn: { ...day, date: '2026-10-11', sleep: 'gt7', back: { pain: 4, newNeuro: false, caudaEquinaFlag: false } },
    });
    expect(plan.readiness.back).toBe('amber');
    const deep = plan.steps.filter(s => s.kind === 'hold' && s.deep).map(s => (s as { exerciseId: string }).exerciseId);
    expect(deep).not.toContain('half-kneeling-hip-flexor-stretch');
    expect(deep).not.toContain('supine-hamstring-stretch-strap');
  });

  it('still fills its budget to the second once those holds are dropped', () => {
    const plan = buildSessionPlan({ profile: createDefaultProfile(UNCLEARED), date: '2026-10-11', startDate: START, sessions: [] });
    const mobility = plan.steps.filter(s => s.block === 'mobility' || s.block === 'intro');
    expect(totalSeconds(mobility)).toBe(900);
  });
});
