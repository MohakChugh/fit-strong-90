import { describe, expect, it } from 'vitest';
import type { AppData } from '@/types';
import type { Mode } from '@/types/checkin';
import type { HealthProfile, UserProfile } from '@/types/profile';
import type { SetupAnswers } from '@/types/setup';
import { deriveHealth, glucoseStartMin, profileGaps } from '@/engine/health';
import { permission } from '@/engine/permission';
import { createDefaultProfile } from '@/profile/defaults';
import { CURRENT_VERSION, migrateData } from '@/services/storage';
import { deviceClinical, walkInput, walkRefusal } from '@/walk/gate';
import { lookedAround } from './assemble';
import type { SetupSession } from './draft';
import { gateProfile, stricterHealth, stricterPain } from './effective';
import { NO_CONDITIONS } from './fixtures';

const NOW = new Date('2026-10-10T09:00:00+05:30');
const MODES: readonly Mode[] = ['guided', 'stretch', 'walk'];
const NONE: SetupSession = { unsaved: false, entered: false, answers: {} };
const fresh = (): AppData => migrateData({ version: CURRENT_VERSION } as AppData);
/** Held for the profile gap in every mode: the hold no check-in can answer (`profileGaps`). */
const held = (p: UserProfile) => profileGaps(p).healthUnreviewed && MODES.every(mode => !permission({ profile: p, now: NOW }, mode).allowed);

/** v1 stored health before its last Welcome step: a reviewed profile on a record that never finished setting up. */
const REVIEWED = createDefaultProfile({ weightKg: 70, needsHealthReview: false, health: { medicinesReviewed: true, bpMedicinesReviewed: true, clearance: 'vigorous' } });
const WOUND: SetupAnswers = { conditions: { ...NO_CONDITIONS, feet: 'yes' }, feetNumb: 'yes', footWound: 'now' };
const partway = (answers: SetupAnswers): AppData => {
  const data = fresh();
  return { ...data, profile: REVIEWED, settings: { ...data.settings, onboardingComplete: false, setup: { stage: 'open', draft: { at: 'health.feet', answers } } } };
};

describe('the profile every gate reads while setup is unfinished (H5-05; board D161)', () => {
  it('a v1 record left part-way is held for the profile gap, with the draft’s stricter answers counting at once', () => {
    const data = partway(WOUND);
    expect(held(REVIEWED)).toBe(false);
    const p = gateProfile(data, NOW, NONE);
    expect(p.needsHealthReview).toBe(true);
    expect(p.health.footStatus).toBe('current_wound_or_active_charcot');
    expect(held(p)).toBe(true);
  });

  it('so it is after Look around first', () => {
    const looked = lookedAround(partway(WOUND));
    expect(looked.settings.setup?.stage).toBe('lookAround');
    const p = gateProfile(looked, NOW, NONE);
    expect(p.needsHealthReview).toBe(true);
    expect(p.health.footStatus).toBe('current_wound_or_active_charcot');
    expect(held(p)).toBe(true);
  });

  it('a draft’s answer looser than the record’s never loosens it', () => {
    const data = partway({ conditions: { ...NO_CONDITIONS }, regular: 'no' });
    const onInsulin = { ...REVIEWED, health: { ...REVIEWED.health, diabetes: 'type2' as const, insulin: 'injections_or_pump' as const } };
    const p = gateProfile({ ...data, profile: onInsulin }, NOW, NONE);
    expect(p.health.diabetes).toBe('type2');
    expect(deriveHealth(p.health).hypoRisk).toBe(true);
  });

  it('answers kept this session only count as a draft’s do (B-07)', () => {
    const data = partway({});
    const p = gateProfile(data, NOW, { unsaved: true, entered: true, answers: WOUND, at: 'review' });
    expect(p.health.footStatus).toBe('current_wound_or_active_charcot');
    expect(p.needsHealthReview).toBe(true);
  });

  it('a completed v1 upgrade is read as it is', () => {
    const data = fresh();
    const upgraded = { ...data, profile: REVIEWED, settings: { ...data.settings, onboardingComplete: true } };
    expect(gateProfile(upgraded, NOW, NONE)).toBe(REVIEWED);
  });

  it('the walk’s gate reads the same profile', () => {
    const data = partway(WOUND);
    const clinical = deviceClinical({ profile: data.profile, settings: data.settings, checkIns: [] });
    expect(clinical.profile.needsHealthReview).toBe(true);
    expect(walkRefusal(walkInput(clinical, NOW), 'start')).toBeDefined();
  });
});

/** For each health field: a looser and a stricter value, or 'newer' where neither is a hold (the newer answer wins). */
const FIELDS: Record<keyof HealthProfile, { looser: Partial<HealthProfile>; stricter: Partial<HealthProfile> } | 'newer'> = {
  diabetes: { looser: { diabetes: 'type2' }, stricter: { diabetes: 'type1' } },
  insulin: { looser: { insulin: 'none' }, stricter: { insulin: 'unsure' } },
  insulinRegimen: 'newer',
  sulfonylureaOrMeglitinide: { looser: { sulfonylureaOrMeglitinide: false }, stricter: { sulfonylureaOrMeglitinide: 'unsure' } },
  sglt2i: { looser: { sglt2i: false }, stricter: { sglt2i: true } },
  metformin: { looser: { metformin: false }, stricter: { metformin: true } },
  metforminSince: 'newer',
  priorDkaOrInsulinDeficiency: { looser: { priorDkaOrInsulinDeficiency: false }, stricter: { priorDkaOrInsulinDeficiency: 'unsure' } },
  medicinesReviewed: { looser: { medicinesReviewed: true }, stricter: { medicinesReviewed: false } },
  highHypoRisk: { looser: { highHypoRisk: false }, stricter: { highHypoRisk: true } },
  hypertension: { looser: { hypertension: 'treated' }, stricter: { hypertension: 'untreated' } },
  betaBlocker: { looser: { betaBlocker: false }, stricter: { betaBlocker: 'unsure' } },
  diuretic: { looser: { diuretic: false }, stricter: { diuretic: true } },
  bpMedicinesReviewed: { looser: { bpMedicinesReviewed: true }, stricter: { bpMedicinesReviewed: false } },
  heartOrVascularDisease: { looser: { heartOrVascularDisease: false }, stricter: { heartOrVascularDisease: true } },
  kidneyDisease: { looser: { kidneyDisease: 'ckd' }, stricter: { kidneyDisease: 'dialysis_or_transplant' } },
  fluidRestriction: { looser: { fluidRestriction: false }, stricter: { fluidRestriction: 'unsure' } },
  retinopathy: { looser: { retinopathy: 'moderate' }, stricter: { retinopathy: 'recent_eye_treatment' } },
  peripheralNeuropathy: { looser: { peripheralNeuropathy: 'no' }, stricter: { peripheralNeuropathy: 'unsure' } },
  footStatus: { looser: { footStatus: 'past_ulcer_or_charcot' }, stricter: { footStatus: 'current_wound_or_active_charcot' } },
  dizzyOnStandingOrAutonomicNeuropathy: { looser: { dizzyOnStandingOrAutonomicNeuropathy: false }, stricter: { dizzyOnStandingOrAutonomicNeuropathy: true } },
  glucoseMonitor: 'newer',
  glucoseUnit: 'newer',
  ketoneTest: 'newer',
  bpMonitor: 'newer',
  currentlyActive: { looser: { currentlyActive: true }, stricter: { currentlyActive: false } },
  clearance: { looser: { clearance: 'vigorous' }, stricter: { clearance: 'none' } },
  clinicianTargets: { looser: { clinicianTargets: { glucoseStartMin: 80, bpStopSystolic: 180 } }, stricter: { clinicianTargets: { glucoseStartMin: 120, bpStopSystolic: 160 } } },
  bpExercisePermission: { looser: { bpExercisePermission: { sys: 170, dia: 105 } }, stricter: {} },
};

const NEWER: Partial<Record<keyof HealthProfile, [Partial<HealthProfile>, Partial<HealthProfile>]>> = {
  insulinRegimen: [{ insulinRegimen: 'basalOnly' }, { insulinRegimen: 'pump' }],
  metforminSince: [{ metforminSince: '2019' }, { metforminSince: '2021' }],
  glucoseMonitor: [{ glucoseMonitor: 'none' }, { glucoseMonitor: 'cgm' }],
  glucoseUnit: [{ glucoseUnit: 'mg/dL' }, { glucoseUnit: 'mmol/L' }],
  ketoneTest: [{ ketoneTest: 'none' }, { ketoneTest: 'blood' }],
  bpMonitor: [{ bpMonitor: false }, { bpMonitor: true }],
};

describe('two profiles as one, never looser than either (H5-05, H5-08)', () => {
  const h = (x: Partial<HealthProfile>): HealthProfile => createDefaultProfile({ health: { diabetes: 'type2', insulin: 'injections_or_pump', ...x } }).health;
  for (const [field, rule] of Object.entries(FIELDS) as [keyof HealthProfile, (typeof FIELDS)[keyof HealthProfile]][]) {
    it(`health.${field}`, () => {
      if (rule === 'newer') {
        const [was, now] = NEWER[field]!;
        expect(stricterHealth(h(was), h(now))[field]).toEqual(h(now)[field]);
        return;
      }
      const want = h(rule.stricter)[field];
      expect(stricterHealth(h(rule.looser), h(rule.stricter))[field], 'stored looser').toEqual(want);
      expect(stricterHealth(h(rule.stricter), h(rule.looser))[field], 'newer looser').toEqual(want);
    });
  }

  it('starts exercise at the higher glucose figure, the usual one where the care team’s is lower', () => {
    const usual = h({ highHypoRisk: true });
    const lower = h({ highHypoRisk: true, clinicianTargets: { glucoseStartMin: 100 } });
    expect(glucoseStartMin(stricterHealth(usual, lower))).toBe(145);
    expect(glucoseStartMin(stricterHealth(lower, usual))).toBe(145);
  });

  it('keeps every pain area either names, and both legs where they differ', () => {
    const left = { areas: ['sciatica' as const], sciaticaSide: 'left' as const, worseWith: 'flexion' as const, preference: 'untested' as const };
    const right = { areas: ['knee' as const, 'sciatica' as const], sciaticaSide: 'right' as const, worseWith: 'flexion' as const, preference: 'untested' as const, neuroHistory: 'unsure' as const };
    expect(stricterPain(left, right)).toMatchObject({ areas: ['sciatica', 'knee'], sciaticaSide: 'both', neuroHistory: 'unsure' });
    expect(stricterPain(right, { ...left, areas: [] })).toMatchObject({ areas: ['knee', 'sciatica'], sciaticaSide: 'right' });
  });

  it('keeps the medicines asked again when either says so', () => {
    const answered = h({ medicinesReviewed: true, sulfonylureaOrMeglitinide: false, sglt2i: false });
    const reopened = { ...answered, medicinesReviewed: false };
    expect(stricterHealth(answered, reopened).medicinesReviewed).toBe(false);
    expect(stricterHealth(reopened, answered).medicinesReviewed).toBe(false);
  });
});
