import { describe, expect, it } from 'vitest';
import type { HealthProfile, PainProfile } from '@/types/profile';
import type { SetupAnswers } from '@/types/setup';
import { bpMedicinesAsked, deriveHealth } from '@/engine/health';
import { createDefaultProfile } from '@/profile/defaults';
import { profileFrom } from './assemble';
import { HEALTH_SOURCES, PAIN_SOURCES, fieldsOfChapter } from './fields';
import {
  COMPLEX, EVERYTHING, FOOT_WOUND, GLIFLOZIN_NO_DIABETES, INSULIN_NO_DIABETES, MINIMAL, NO_CLASSES, NO_CONDITIONS, UNSURE, withC, withMeds,
} from './fixtures';
import { PAGES, missingPages, pathFor } from './graph';

const TODAY = '2026-10-10';
const CTX = { thisYear: 2026 };
type Probe = { answers: SetupAnswers; vary: SetupAnswers };

const T2 = { diabetesType: 'type2' } as const;
const ON_INSULIN = withC({ diabetes: 'yes' }, { ...T2, regular: 'yes', classes: { ...NO_CLASSES, insulin: 'yes' }, insulinHow: 'basalOnly' });
const FEET = withC({ feet: 'yes' }, { feetNumb: 'no', footWound: 'no', footRestriction: 'no' });
const BP_TARGETS = withC({ bp: 'yes' }, { bpMedicine: 'yes', targets: 'yes' });

/**
 * For each engine field (journey §6.3 as corrected, D76): answers that put its
 * question on the path, and a change of answer that must change the field.
 * A `Record` over `HealthProfile`'s own keys, so a field added to the profile
 * without a question fails the build (A-07, K-05).
 */
const HEALTH_PROBES: Record<keyof HealthProfile, Probe> = {
  diabetes: { answers: withC({ diabetes: 'yes' }, T2), vary: { diabetesType: 'type1' } },
  insulin: { answers: ON_INSULIN, vary: { insulinHow: 'closedLoop' } },
  insulinRegimen: { answers: ON_INSULIN, vary: { insulinHow: 'multipleDaily' } },
  sulfonylureaOrMeglitinide: { answers: withMeds({}), vary: { classes: { ...NO_CLASSES, lowsTablet: 'yes' } } },
  sglt2i: { answers: withMeds({}), vary: { classes: { ...NO_CLASSES, gliflozin: 'unsure' } } },
  metformin: { answers: withMeds({}), vary: { classes: { ...NO_CLASSES, metformin: 'yes' } } },
  metforminSince: { answers: withMeds({ metformin: 'yes' }), vary: { metforminSince: '2019' } },
  priorDkaOrInsulinDeficiency: { answers: withC({ diabetes: 'yes' }, { ...T2, priorDka: 'no' }), vary: { priorDka: 'yes' } },
  medicinesReviewed: { answers: withMeds({}), vary: { classes: undefined } },
  highHypoRisk: { answers: withC({ diabetes: 'yes' }, { ...T2, regular: 'yes', classes: { ...NO_CLASSES, lowsTablet: 'yes' }, lowsRisk: 'no' }), vary: { lowsRisk: 'unsure' } },
  hypertension: { answers: withC({ bp: 'yes' }, { bpMedicine: 'yes' }), vary: { bpMedicine: 'no' } },
  betaBlocker: { answers: withMeds({}), vary: { classes: { ...NO_CLASSES, betaBlocker: 'unsure' } } },
  diuretic: { answers: withMeds({}), vary: { classes: { ...NO_CLASSES, diuretic: 'yes' } } },
  bpMedicinesReviewed: { answers: withC({ bp: 'yes' }, { bpMedicine: 'yes', regular: 'yes', classes: { ...NO_CLASSES }, dizzy: 'no' }), vary: { classes: undefined } },
  heartOrVascularDisease: { answers: MINIMAL, vary: { conditions: { ...NO_CONDITIONS, heart: 'unsure' } } },
  kidneyDisease: { answers: withC({ kidney: 'yes' }, { kidneyTreatment: 'no', fluidLimit: 'no' }), vary: { kidneyTreatment: 'yes' } },
  fluidRestriction: { answers: withC({ heart: 'yes' }, { fluidLimit: 'no' }), vary: { fluidLimit: 'unsure' } },
  retinopathy: { answers: withC({ eyes: 'yes' }, { eyeTreatment: 'no', eyeDisease: 'mild' }), vary: { eyeTreatment: 'yes' } },
  peripheralNeuropathy: { answers: FEET, vary: { feetNumb: 'unsure' } },
  footStatus: { answers: FEET, vary: { footRestriction: 'yes' } },
  dizzyOnStandingOrAutonomicNeuropathy: { answers: withC({ bp: 'yes' }, { bpMedicine: 'yes', dizzy: 'no' }), vary: { dizzy: 'yes' } },
  // The unit is its own field, with its own probe below: only the monitor answer sets the monitor (D76).
  glucoseMonitor: { answers: MINIMAL, vary: { glucoseMonitor: 'cgm' } },
  glucoseUnit: { answers: { ...MINIMAL, glucoseMonitor: 'meter', glucoseUnit: 'mg/dL' }, vary: { glucoseUnit: 'mmol/L' } },
  ketoneTest: { answers: GLIFLOZIN_NO_DIABETES, vary: { ketoneTest: 'blood' } },
  bpMonitor: { answers: MINIMAL, vary: { bpCuff: true } },
  currentlyActive: { answers: MINIMAL, vary: { active: 'no' } },
  clearance: { answers: withC({ heart: 'yes' }, { fluidLimit: 'no', clearance: 'none' }), vary: { clearance: 'vigorous' } },
  clinicianTargets: { answers: BP_TARGETS, vary: { bpStopSystolic: 170 } },
  bpExercisePermission: { answers: BP_TARGETS, vary: { bpPermission: { sys: 170, dia: 105 } } },
};

const PAIN_PROBES: Record<Exclude<keyof PainProfile, 'preference'>, Probe> = {
  areas: { answers: withC({ pain: 'yes' }, { painAreas: ['knee'], neuroHistory: 'no' }), vary: { painAreas: ['calf'] } },
  sciaticaSide: { answers: withC({ pain: 'yes' }, { painAreas: ['sciatica'], sciaticaSide: 'left', worseWith: 'flexion', neuroHistory: 'no' }), vary: { sciaticaSide: 'both' } },
  worseWith: { answers: withC({ pain: 'yes' }, { painAreas: ['lowerBack'], worseWith: 'flexion', neuroHistory: 'no' }), vary: { worseWith: 'extension' } },
  neuroHistory: { answers: withC({ pain: 'yes' }, { painAreas: ['knee'], neuroHistory: 'no' }), vary: { neuroHistory: 'unsure' } },
};

function probe(read: (a: SetupAnswers) => unknown, sources: readonly (keyof SetupAnswers)[], { answers, vary }: Probe) {
  const after = { ...answers, ...vary };
  const varied = Object.keys(vary) as (keyof SetupAnswers)[];
  expect(varied.every(k => sources.includes(k)), `${varied.join(', ')} not among its sources ${sources.join(', ')}`).toBe(true);
  const asking = PAGES.filter(p => p.sets.some(k => varied.includes(k))).map(p => p.id);
  expect(asking.some(id => pathFor(after).includes(id)), `none of ${asking.join(', ')} is on the path`).toBe(true);
  expect(read(after)).not.toEqual(read(answers));
}

describe('every engine field is set by a question on the path (journey §6.3; A-07; K-05)', () => {
  for (const [field, p] of Object.entries(HEALTH_PROBES) as [keyof HealthProfile, Probe][]) {
    it(`health.${field}`, () => probe(a => profileFrom(a, undefined, TODAY, CTX).health[field], HEALTH_SOURCES[field], p));
  }
  for (const [field, p] of Object.entries(PAIN_PROBES) as [Exclude<keyof PainProfile, 'preference'>, Probe][]) {
    it(`pain.${field}`, () => probe(a => profileFrom(a, undefined, TODAY, CTX).pain[field], PAIN_SOURCES[field] as readonly (keyof SetupAnswers)[], p));
  }

  it('every source answer is set by some page', () => {
    for (const sources of [...Object.values(HEALTH_SOURCES), ...Object.values(PAIN_SOURCES)]) {
      if (sources === 'learned') continue;
      for (const k of sources) expect(PAGES.some(p => p.sets.includes(k)), k).toBe(true);
    }
  });

  it('never sets pain.preference, the direction the engine reads as confirmed (D77)', () => {
    expect(PAIN_SOURCES.preference).toBe('learned');
    const base = createDefaultProfile({ pain: { areas: ['lowerBack'], worseWith: 'flexion', preference: 'extension' } });
    expect(profileFrom({ ...COMPLEX, helps: ['archingBack'] }, base, TODAY, CTX).pain.preference).toBe('extension');
  });

  it('gives each chapter its own fields to own', () => {
    expect(fieldsOfChapter('medicines')).toEqual(expect.arrayContaining(['profile.health.sglt2i', 'profile.health.insulin', 'profile.health.diabetes']));
    expect(fieldsOfChapter('about')).toEqual(expect.arrayContaining(['profile.weightKg', 'settings.useMetric']));
    expect(fieldsOfChapter('backFeet')).toEqual(expect.arrayContaining(['profile.pain.areas', 'profile.health.footStatus']));
  });
});

describe('each question is asked whenever the engine reads its field (B-06 conditional paths)', () => {
  const PERSONAS: Record<string, SetupAnswers> = {
    MINIMAL, COMPLEX, EVERYTHING, FOOT_WOUND, GLIFLOZIN_NO_DIABETES, INSULIN_NO_DIABETES, UNSURE,
    kidney: withC({ kidney: 'unsure' }, { kidneyTreatment: 'no', fluidLimit: 'unsure', clearance: 'none' }),
    heart: withC({ heart: 'yes' }, { fluidLimit: 'no', clearance: 'none', dizzy: 'no' }),
    prediabetes: withC({ diabetes: 'yes' }, { diabetesType: 'prediabetes' }),
    type1: withC({ diabetes: 'yes' }, { diabetesType: 'type1', insulinHow: 'pump', lowsRisk: 'no', priorDka: 'no', ketoneTest: 'blood', clearance: 'none', targets: 'no', dizzy: 'no' }),
  };
  for (const [name, a] of Object.entries(PERSONAS)) {
    it(name, () => {
      const h = profileFrom(a, undefined, TODAY, CTX).health;
      const d = deriveHealth(h);
      const path = pathFor(a);
      expect(missingPages(a, CTX)).toEqual([]);
      if (d.ketoneRisk || d.diabetic) expect(path).toContain('medicines.ketones');
      if (d.hypoRisk) expect(path).toContain('medicines.lows');
      if (bpMedicinesAsked(h)) expect(path.includes('medicines.which') || a.regular === 'no').toBe(true);
      if (d.diabetic || h.heartOrVascularDisease || h.kidneyDisease !== 'none' || h.hypertension !== 'none') expect(path).toContain('health.limits');
      if (d.onBpMeds || h.heartOrVascularDisease || d.diabetic) expect(path).toContain('medicines.standing');
      if (h.kidneyDisease !== 'none' || h.heartOrVascularDisease) expect(path).toContain('health.fluid');
    });
  }
});
