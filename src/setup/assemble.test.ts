import { describe, expect, it } from 'vitest';
import type { AppData } from '@/types';
import { PERMISSION_TEXT, permission } from '@/engine/permission';
import { deriveHealth, glucoseStartMin, profileGaps, profileRules, sglt2Unknown } from '@/engine/health';
import { createDefaultProfile } from '@/profile/defaults';
import { CURRENT_VERSION, migrateData } from '@/services/storage';
import { weeklyGoalOn } from '@/screens/track/weeklyGoal';
import { completedSetup, foodFrom, habitsFrom, lookedAround, measurementsFrom, profileFrom } from './assemble';
import { COMPLEX, FOOT_WOUND, GLIFLOZIN_NO_DIABETES, INSULIN_NO_DIABETES, JOIN, MINIMAL, NO_CLASSES, NO_CONDITIONS, UNSURE, withC, withMeds } from './fixtures';

const TODAY = '2026-10-10';
const NOW = '2026-10-10T09:00:00.000+05:30';
const CTX = { thisYear: 2026 };
const fresh = (): AppData => migrateData({ version: CURRENT_VERSION } as AppData);

describe('"Not sure" is "may have", through the engine itself (journey §6.1)', () => {
  const p = profileFrom(UNSURE, undefined, TODAY, CTX);

  it('stores the conservative value for every "Not sure"', () => {
    expect(p.health).toMatchObject({
      diabetes: 'other', insulin: 'unsure', sulfonylureaOrMeglitinide: 'unsure', sglt2i: 'unsure', metformin: 'unsure',
      betaBlocker: 'unsure', diuretic: 'unsure', priorDkaOrInsulinDeficiency: 'unsure', hypertension: 'unsure',
      heartOrVascularDisease: true, fluidRestriction: 'unsure', highHypoRisk: true, dizzyOnStandingOrAutonomicNeuropathy: true, clearance: 'none',
    });
  });

  it('and the engine reads it as "may have"', () => {
    const d = deriveHealth(p.health);
    expect(d).toMatchObject({ diabetic: true, hypoRisk: true, ketoneRisk: true, onBpMeds: true });
    expect(profileRules(p).vigorousLocked).toBe(true);
    expect(glucoseStartMin(p.health)).toBe(145);
  });

  it('leaves no profile gap: every safety question was answered (Not sure is an answer)', () => {
    expect(profileGaps(p)).toMatchObject({ healthUnreviewed: false, medicinesUnknown: false });
    const walk = permission({ profile: p, now: new Date(NOW) }, 'walk');
    expect(walk.reasons).toContain(PERMISSION_TEXT.noCheckIn);
    expect(walk.reasons).not.toContain(PERMISSION_TEXT.healthUnreviewed);
  });
});

describe('"Not sure" where it is now offered (K5-09; board D151)', () => {
  const health = (a: Parameters<typeof withC>[1], c: Parameters<typeof withC>[0]) => profileFrom(withC(c, a), undefined, TODAY, CTX).health;

  it('reads each as the stricter value', () => {
    expect(health({ kidneyTreatment: 'unsure', fluidLimit: 'no', clearance: 'none' }, { kidney: 'yes' }).kidneyDisease).toBe('dialysis_or_transplant');
    expect(health({ eyeTreatment: 'unsure', clearance: 'none' }, { eyes: 'yes' }).retinopathy).toBe('recent_eye_treatment');
    expect(health({ feetNumb: 'no', footWound: 'unsure', footRestriction: 'no' }, { feet: 'yes' }).footStatus).toBe('current_wound_or_active_charcot');
    expect(health({ feetNumb: 'no', footWound: 'no', footRestriction: 'unsure' }, { feet: 'yes' }).footStatus).toBe('current_wound_or_active_charcot');
  });

  it('a limit not ruled out holds walks whatever the foot chip says, as Yes does (H5-03)', () => {
    expect(health({ footRestriction: 'unsure' }, { feet: 'no' }).footStatus).toBe('current_wound_or_active_charcot');
  });
});

describe('medicines whatever the diagnosis (A-06, K-05)', () => {
  it('insulin with diabetes "No" is diabetes that can go low (Review Focus 3, D78)', () => {
    const p = profileFrom(INSULIN_NO_DIABETES, undefined, TODAY, CTX);
    expect(p.health.diabetes).toBe('other');
    expect(deriveHealth(p.health).hypoRisk).toBe(true);
    expect(glucoseStartMin(p.health)).toBe(90);
    expect(profileGaps(p).medicinesUnknown).toBe(false);
  });

  it('a "-gliflozin" without diabetes is a ketone risk, answered and reviewed', () => {
    const p = profileFrom(GLIFLOZIN_NO_DIABETES, undefined, TODAY, CTX);
    expect(p.health).toMatchObject({ diabetes: 'none', sglt2i: true, medicinesReviewed: true, ketoneTest: 'none' });
    expect(deriveHealth(p.health).ketoneRisk).toBe(true);
    expect(sglt2Unknown(p.health)).toBe(false);
  });

  it('"No regular medicines" answers every class No, and counts as reviewed', () => {
    const p = profileFrom(MINIMAL, undefined, TODAY, CTX);
    expect(p.health).toMatchObject({ insulin: 'none', sulfonylureaOrMeglitinide: false, sglt2i: false, metformin: false, betaBlocker: false, diuretic: false, medicinesReviewed: true });
    expect(sglt2Unknown(p.health)).toBe(false);
  });

  it('asks the diabetes medicines again when diabetes is added later; an old review never vouches for them (Review Focus 1)', () => {
    const before = profileFrom(GLIFLOZIN_NO_DIABETES, undefined, TODAY, CTX);
    const edited = profileFrom({ ...GLIFLOZIN_NO_DIABETES, conditions: { ...NO_CONDITIONS, diabetes: 'yes' }, diabetesType: 'type2' }, before, TODAY, CTX, ['health']);
    expect(edited.health.medicinesReviewed).toBe(false);
    expect(profileGaps(edited).medicinesUnknown).toBe(true);
  });

  it('vouches for the blood-pressure medicines only when both were answered', () => {
    const bp = withC({ bp: 'yes' }, { bpMedicine: 'yes', regular: 'yes', dizzy: 'no' });
    expect(profileFrom({ ...bp, classes: { ...NO_CLASSES } }, undefined, TODAY, CTX).health.bpMedicinesReviewed).toBe(true);
    expect(profileFrom({ ...bp, classes: { metformin: 'yes' } }, undefined, TODAY, CTX).health.bpMedicinesReviewed).toBeUndefined();
  });
});

describe('gaps stay gaps (journey §6.1)', () => {
  it('a new profile from unfinished safety chapters is held, never read as "No"', () => {
    const p = profileFrom({ conditions: { ...NO_CONDITIONS } }, undefined, TODAY, CTX);
    expect(p.needsHealthReview).toBe(true);
    expect(profileGaps(p).healthUnreviewed).toBe(true);
  });

  it('a chapter not edited keeps what it had', () => {
    const p = profileFrom(COMPLEX, undefined, TODAY, CTX);
    const renamed = profileFrom({ ...COMPLEX, name: 'Asha K' }, p, TODAY, CTX, ['about']);
    expect(renamed.name).toBe('Asha K');
    expect(renamed.health).toEqual(p.health);
    expect(renamed.pain).toEqual(p.pain);
    expect(renamed.food).toEqual(p.food);
  });
});

describe('back, feet and food', () => {
  it('back pain and sciatica set the areas and the leg; no pain clears them, and keeps the nerve history (H5-19)', () => {
    const p = profileFrom(COMPLEX, undefined, TODAY, CTX);
    expect(p.pain).toMatchObject({ areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left', worseWith: 'flexion', neuroHistory: false });
    const none = profileFrom({ ...COMPLEX, conditions: { ...COMPLEX.conditions, pain: 'no' } }, p, TODAY, CTX);
    expect(none.pain).toEqual({ areas: [], worseWith: 'unknown', preference: p.pain.preference, neuroHistory: false });
  });

  it('a past nerve injury stays when there is no pain now, and its question sets it without pain (H5-19)', () => {
    const injured = createDefaultProfile({ pain: { areas: ['sciatica'], sciaticaSide: 'left', worseWith: 'flexion', neuroHistory: true } });
    expect(profileFrom(withC({ pain: 'no' }), injured, TODAY, CTX).pain.neuroHistory).toBe(true);
    expect(profileFrom(withC({ pain: 'no' }, { neuroHistory: 'unsure' }), createDefaultProfile(), TODAY, CTX).pain.neuroHistory).toBe('unsure');
  });

  it('a wound now, or a clinician’s limit, holds walking (K-30)', () => {
    expect(profileFrom(FOOT_WOUND, undefined, TODAY, CTX).health.footStatus).toBe('current_wound_or_active_charcot');
    const limit = profileFrom({ ...FOOT_WOUND, footWound: 'no', footRestriction: 'yes' }, undefined, TODAY, CTX);
    expect(limit.health.footStatus).toBe('current_wound_or_active_charcot');
  });

  it('stores the pattern, the allergies as given, the logging level and the screening answer, and keeps the foods left out (board D82)', () => {
    expect(foodFrom({ pattern: 'jain', allergies: ['peanut'], customAllergies: ['brinjal'], foodLevel: 'meals', hardBefore: 'yes' }, { pattern: 'vegetarian', avoid: ['bhindi'], region: 'north' }))
      .toEqual({ pattern: 'jain', avoid: ['bhindi'], region: 'north', allergies: ['peanut'], customAllergies: ['brinjal'], level: 'meals', hardBefore: 'yes' });
    // "No food allergies" is an answer, and is kept as one.
    expect(foodFrom({ pattern: 'vegan', allergies: [] }, undefined)).toEqual({ pattern: 'vegan', avoid: [], allergies: [] });
    expect(foodFrom({}, undefined)).toBeUndefined();
  });

  it('answering the allergy question replaces the own words kept; leaving it unanswered keeps them', () => {
    const base = { pattern: 'vegan' as const, avoid: [], allergies: ['milk' as const], customAllergies: ['kiwi'] };
    expect(foodFrom({ pattern: 'vegan', allergies: [] }, base)).toEqual({ pattern: 'vegan', avoid: [], allergies: [] });
    expect(foodFrom({ pattern: 'vegetarian' }, base)).toEqual({ ...base, pattern: 'vegetarian' });
  });

  it('turns water on only with a fluid limit answered "No" and no condition needing one', () => {
    const ok = profileFrom(COMPLEX, undefined, TODAY, CTX);
    expect(habitsFrom(COMPLEX, undefined, ok).water?.enabled).toBe(true);
    const kidneyAnswers = { ...COMPLEX, conditions: { ...COMPLEX.conditions, kidney: 'yes' as const }, kidneyTreatment: 'no' as const };
    expect(habitsFrom(kidneyAnswers, undefined, profileFrom(kidneyAnswers, undefined, TODAY, CTX)).water?.enabled).toBe(false);
    const held = profileFrom({ ...FOOT_WOUND, mealWalk: { on: true, meals: ['lunch'] } }, undefined, TODAY, CTX);
    expect(habitsFrom({ ...FOOT_WOUND, mealWalk: { on: true, meals: ['lunch'] } }, undefined, held).mealWalk?.enabled).toBe(false);
  });
});

describe('weight, height and waist are dated readings (journey §18.1; B-16; Review Focus 2)', () => {
  it('records a changed value, and never an unchanged or undated one', () => {
    expect(measurementsFrom(COMPLEX, undefined, NOW).map(o => [o.kind, o.value, o.unit, o.context])).toEqual([
      ['weight', 68, 'kg', 'profile'], ['height', 158, 'cm', 'profile'],
    ]);
    expect(measurementsFrom(COMPLEX, createDefaultProfile({ weightKg: 68, heightCm: 158 }), NOW)).toEqual([]);
    expect(measurementsFrom({ weightKg: 70 }, createDefaultProfile({ weightKg: 0 }), NOW)).toHaveLength(1);
    expect(measurementsFrom({}, createDefaultProfile({ weightKg: 78 }), NOW)).toEqual([]);
  });
});

describe('finishing, and looking around first', () => {
  it('finishing stores the profile, the answers, completion and Home’s first tiles in one record', () => {
    const done = completedSetup(fresh(), COMPLEX, NOW, { ...CTX, hasSteps: false });
    expect(done.settings).toMatchObject({ onboardingComplete: true, focus: 'stretch', weeklyMovementGoalMinutes: 90, useMetric: true });
    expect(weeklyGoalOn(done.settings, TODAY)).toBe(90);
    expect(done.settings.setup).toEqual({ stage: 'done', answers: COMPLEX, completedAt: NOW, skipped: [] });
    expect(done.settings.home?.order.check).toEqual(expect.arrayContaining(['glucose', 'bp', 'back']));
    expect(done.profile?.needsHealthReview).toBe(false);
    expect(done.settings.startDate).toBe('');
  });

  it('joins the programme when setup said Yes, and remembers it as joined', () => {
    const done = completedSetup(fresh(), { ...COMPLEX, programme: 'join', join: JOIN }, NOW, { ...CTX, hasSteps: false });
    expect(done.settings.startDate).toBe(JOIN.startDate);
    expect(done.profile?.trainingDays).toEqual(JOIN.days);
    expect(done.settings.setup?.answers?.programme).toBe('joined');
  });

  it('"No goal for now" ends a goal from next Monday (B-16); a skipped chapter waits in Me', () => {
    const before = fresh();
    before.settings = { ...before.settings, weeklyMovementGoalMinutes: 150 };
    const done = completedSetup(before, { ...MINIMAL, foodLevel: undefined, skippedPages: ['food.logging'] }, NOW, { ...CTX, hasSteps: false });
    expect(done.settings.weeklyMovementGoalMinutes).toBeUndefined();
    expect(weeklyGoalOn(done.settings, TODAY)).toBe(150);
    expect(weeklyGoalOn(done.settings, '2026-10-12')).toBeUndefined();
    expect(done.settings.setup?.skipped).toEqual(['food']);
  });

  it('keeps what Me was told “Not now”, and the upgrade flags', () => {
    const before = fresh();
    before.settings = { ...before.settings, setup: { declined: ['food'] } };
    expect(completedSetup(before, MINIMAL, NOW, { ...CTX, hasSteps: false }).settings.setup?.declined).toEqual(['food']);
  });

  it('Back & leg for "Not sure" about pain (journey §5.1)', () => {
    const unsurePain = withC({ pain: 'unsure' }, { painAreas: [], neuroHistory: 'no', clearance: 'none' });
    expect(completedSetup(fresh(), unsurePain, NOW, { ...CTX, hasSteps: false }).settings.home?.order.check).toContain('back');
  });

  it('looking around keeps the draft, writes no profile, and opens Home (§6.4)', () => {
    const data = fresh();
    data.settings = { ...data.settings, setup: { stage: 'open', skipped: [], draft: { at: 'about.figure', answers: { name: 'Asha' } } } };
    const after = lookedAround(data);
    expect(after.settings.onboardingComplete).toBe(true);
    expect(after.settings.setup).toEqual({ stage: 'lookAround', skipped: [], draft: { at: 'about.figure', answers: { name: 'Asha' } } });
    expect(after.profile).toBeUndefined();
  });
});

describe('each answer maps to v1’s own value (journey §6.3, board D76)', () => {
  const h = (a: Parameters<typeof profileFrom>[0], base?: Parameters<typeof profileFrom>[1]) => profileFrom(a, base, TODAY, CTX).health;

  it('reads blood pressure, kidneys, eyes and feet as v1 stored them, "Not sure" kept as not sure', () => {
    expect(h(withC({ bp: 'yes' }, { bpMedicine: 'yes' })).hypertension).toBe('treated');
    expect(h(withC({ bp: 'yes' }, { bpMedicine: 'no' })).hypertension).toBe('untreated');
    // Not sure about high blood pressure stays not sure, medicine or no medicine.
    expect(h(withC({ bp: 'unsure' }, { bpMedicine: 'no' })).hypertension).toBe('unsure');
    expect(h(withC({ kidney: 'yes' }, { kidneyTreatment: 'no' })).kidneyDisease).toBe('ckd');
    expect(h(withC({ kidney: 'unsure' }, { kidneyTreatment: 'no' })).kidneyDisease).toBe('unsure');
    expect(h(withC({ eyes: 'yes' }, { eyeTreatment: 'no' })).retinopathy).toBe('unknown');
    expect(h(withC({ eyes: 'yes' }, { eyeTreatment: 'no', eyeDisease: 'severe' })).retinopathy).toBe('severe_or_proliferative');
    expect(h(withC({ feet: 'yes' }, { feetNumb: 'no', footWound: 'past', footRestriction: 'no' })).footStatus).toBe('past_ulcer_or_charcot');
  });

  it('keeps a clinician’s numbers only where they apply, and a permission’s first date', () => {
    expect(h(withC({ bp: 'yes' }, { bpMedicine: 'yes', targets: 'no', glucoseStartMin: 100, bpStopSystolic: 170 })).clinicianTargets).toBeUndefined();
    expect(h(withC({ bp: 'yes' }, { bpMedicine: 'yes', targets: 'yes', bpStopSystolic: 170 })).clinicianTargets).toEqual({ bpStopSystolic: 170 });
    const answers = withC({ bp: 'yes' }, { bpMedicine: 'yes', targets: 'yes', bpPermission: { sys: 170, dia: 105 } });
    const base = createDefaultProfile({ health: { hypertension: 'treated', bpExercisePermission: { sys: 170, dia: 105, recordedOn: '2026-09-01' } } });
    expect(h(answers, base).bpExercisePermission).toEqual({ sys: 170, dia: 105, recordedOn: '2026-09-01' });
    expect(h(answers).bpExercisePermission).toEqual({ sys: 170, dia: 105, recordedOn: TODAY });
  });

  it('reads insulin from type 1, or as not sure until how it’s taken is known', () => {
    expect(h({ conditions: { ...NO_CONDITIONS, diabetes: 'yes' }, diabetesType: 'type1' }).insulin).toBe('unsure');
    const t2 = withC({ diabetes: 'yes' }, { diabetesType: 'type2', regular: 'yes' });
    expect(h({ ...t2, classes: { ...NO_CLASSES, insulin: 'unsure' }, insulinHow: 'basalOnly' }).insulin).toBe('unsure');
    expect(h({ ...t2, classes: { ...NO_CLASSES, insulin: 'yes' } }).insulin).toBe('unsure');
    expect(h({ ...t2, classes: { ...NO_CLASSES, insulin: 'yes' }, insulinHow: 'basalOnly' })).toMatchObject({ insulin: 'injections_or_pump', insulinRegimen: 'basalOnly' });
  });

  it('clears the stored metformin year when the field is emptied, and keeps it when the year isn’t asked (H5-21)', () => {
    const base = profileFrom(withMeds({ metformin: 'yes' }, { metforminSince: '2019' }), undefined, TODAY, CTX);
    expect(base.health.metforminSince).toBe('2019');
    expect(profileFrom(withMeds({ metformin: 'yes' }, { metforminSince: '' }), base, TODAY, CTX).health.metforminSince).toBeUndefined();
    expect(profileFrom(withMeds({ metformin: 'yes' }), base, TODAY, CTX).health.metforminSince).toBe('2019');
    expect(profileFrom(withMeds({ metformin: 'yes' }, { metforminSince: '2021' }), base, TODAY, CTX).health.metforminSince).toBe('2021');
  });

  it('keeps the year metformin was started only while metformin is taken', () => {
    const base = createDefaultProfile({ health: { metformin: true, metforminSince: '2019' } });
    expect(h(withMeds({ metformin: 'no' }, { metforminSince: '2019' }), base).metforminSince).toBeUndefined();
    expect(h(withMeds({ metformin: 'yes' }), base).metforminSince).toBe('2019');
  });

  it('vouches for the blood-pressure medicines only when both were answered, and not again when blood pressure comes back', () => {
    const bp = withC({ bp: 'yes' }, { bpMedicine: 'yes', regular: 'yes', dizzy: 'no' });
    expect(h({ ...bp, classes: { betaBlocker: 'yes' } }).bpMedicinesReviewed).toBeUndefined();
    const reviewed = profileFrom({ ...bp, classes: { ...NO_CLASSES } }, undefined, TODAY, CTX);
    const noBp = profileFrom({ ...bp, classes: { ...NO_CLASSES }, conditions: { ...NO_CONDITIONS } }, reviewed, TODAY, CTX, ['health']);
    expect(noBp.health.bpMedicinesReviewed).toBe(true);
    expect(profileFrom({ ...bp, classes: { ...NO_CLASSES } }, noBp, TODAY, CTX, ['health']).health.bpMedicinesReviewed).toBeUndefined();
  });

  it('keeps the leg and what makes it worse only for back pain or sciatica', () => {
    expect(profileFrom({ ...COMPLEX, painAreas: ['lowerBack'] }, undefined, TODAY, CTX).pain.sciaticaSide).toBeUndefined();
    expect(profileFrom({ ...COMPLEX, painAreas: ['knee'] }, undefined, TODAY, CTX).pain.worseWith).toBe('unknown');
  });

  it('stores the name trimmed, and "Either" as no figure', () => {
    const base = createDefaultProfile({ figure: 'male' });
    expect(profileFrom({ ...MINIMAL, name: '  Asha ' }, base, TODAY, CTX)).toMatchObject({ name: 'Asha' });
    expect(profileFrom({ ...MINIMAL, name: '   ' }, base, TODAY, CTX).name).toBeUndefined();
    expect(profileFrom({ ...MINIMAL, figure: 'either' }, base, TODAY, CTX).figure).toBeUndefined();
  });

  it('turns water off while a fluid limit is not ruled out', () => {
    const p = profileFrom(MINIMAL, undefined, TODAY, CTX);
    const water = { on: true, glassMl: 250, everyMinutes: 120, from: '09:00', to: '21:00' };
    expect(habitsFrom({ ...MINIMAL, water, fluidLimit: 'unsure' }, undefined, p).water?.enabled).toBe(false);
    expect(habitsFrom({ ...MINIMAL, water, fluidLimit: 'no' }, undefined, p).water?.enabled).toBe(true);
  });

  it('keeps a Home the person already laid out, and the ladder they earned', () => {
    const before = fresh();
    const home = { order: { move: ['walk' as const], eat: [], check: [], learn: [] }, hidden: [] };
    before.settings = { ...before.settings, home };
    expect(completedSetup(before, MINIMAL, NOW, { ...CTX, hasSteps: false }).settings.home).toEqual(home);
    const earned = createDefaultProfile({ ladder: { hinge: 4, squat: 3, neuralGate: true } });
    expect(profileFrom(MINIMAL, earned, TODAY, CTX).ladder).toEqual(earned.ladder);
  });
});
