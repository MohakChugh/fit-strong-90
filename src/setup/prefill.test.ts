import { describe, expect, it } from 'vitest';
import type { AppData, UserSettings } from '@/types';
import { createDefaultProfile } from '@/profile/defaults';
import { CURRENT_VERSION, migrateData } from '@/services/storage';
import { profileFrom } from './assemble';
import { editedRecord, editorState } from './edit';
import { keysOfChapter } from './fields';
import { UNSURE } from './fixtures';
import { SAFETY_CHAPTERS, pageDone } from './graph';
import { answersFromProfile, answersToEdit, prefillAnswers } from './prefill';

const TODAY = '2026-10-10';
const CTX = { thisYear: 2026 };
const S: UserSettings = { ...migrateData({ version: CURRENT_VERSION } as AppData).settings, useMetric: true, startDate: '2026-09-24', focus: 'strength' };
const recordOf = (profile: AppData['profile'], settings: UserSettings = S): AppData =>
  ({ ...migrateData({ version: CURRENT_VERSION } as AppData), profile, settings: { ...settings, onboardingComplete: true } });

/** P01 of codex-acceptance.md, as v1 stored it. */
const P01 = createDefaultProfile({
  weightKg: 78, heightCm: 175, birthYear: 1982, figure: 'male', experience: 'beginner', trainingDays: ['monday', 'thursday', 'saturday'],
  sessionMinutes: 45, equipment: 'fullGym', goals: ['strong', 'flexible', 'painFreeBack'],
  pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left', worseWith: 'flexion', preference: 'extension' },
  health: {
    diabetes: 'type2', metformin: true, metforminSince: '2019', glucoseMonitor: 'meter', hypertension: 'treated', bpMonitor: true,
    sulfonylureaOrMeglitinide: false, sglt2i: false, priorDkaOrInsulinDeficiency: false, medicinesReviewed: true, clearance: 'vigorous',
  },
  food: { pattern: 'vegetarian', avoid: [], region: 'north' },
  voice: { muted: true, checked: true },
  needsHealthReview: false,
});

describe('answers v1 already gave (K-57; journey §6.4, §16)', () => {
  it('reads P01 back as the answers v1 asked', () => {
    const a = answersFromProfile(P01, S);
    expect(a).toMatchObject({
      conditions: { diabetes: 'yes', bp: 'yes', heart: 'no', kidney: 'no', pain: 'yes', eyes: 'no', feet: 'no' },
      diabetesType: 'type2', bpMedicine: 'yes', regular: 'yes',
      classes: { insulin: 'no', lowsTablet: 'no', gliflozin: 'no', metformin: 'yes' }, metforminSince: '2019', priorDka: 'no',
      glucoseMonitor: 'meter', glucoseUnit: 'mg/dL', bpCuff: true, dizzy: 'no', clearance: 'vigorous', active: 'yes',
      painAreas: ['lowerBack', 'sciatica'], sciaticaSide: 'left', worseWith: 'flexion',
      focus: 'strength', programme: 'joined', pattern: 'vegetarian', voice: { muted: true, pack: 'af_heart' },
    });
    // v1 never asked "something else", nor the BP medicines without their review flag.
    expect(a.conditions?.other).toBeUndefined();
    expect(a.classes?.betaBlocker).toBeUndefined();
  });

  it('gives back exactly the profile it came from: reading it changes nothing (§6.6)', () => {
    expect(profileFrom(answersFromProfile(P01, S), P01, TODAY, CTX)).toEqual(P01);
  });

  it('reads back the food contract’s answers, and gives back the same food (board D82)', () => {
    const food = { pattern: 'jain' as const, avoid: ['mushrooms'], allergies: ['peanut' as const], customAllergies: ['brinjal'], level: 'estimates' as const, hardBefore: 'yes' as const };
    const p = { ...P01, food };
    expect(answersFromProfile(p, S)).toMatchObject({ pattern: 'jain', allergies: ['peanut'], customAllergies: ['brinjal'], foodLevel: 'estimates', hardBefore: 'yes' });
    expect(profileFrom(answersFromProfile(p, S), p, TODAY, CTX).food).toEqual(food);
  });

  it('reads back only what v1 asked, "Not sure" as not sure', () => {
    expect(answersFromProfile(createDefaultProfile({ health: { hypertension: 'unsure' } }), S).conditions?.bp).toBe('unsure');
    const none = answersFromProfile(createDefaultProfile({ health: { medicinesReviewed: true }, pain: { areas: ['knee'], worseWith: 'flexion' } }), S);
    // v1 asked about monitors with diabetes, the cuff with high blood pressure, and what makes it worse with back pain.
    expect([none.glucoseMonitor, none.bpCuff, none.worseWith]).toEqual([undefined, undefined, undefined]);
    // A clinician's numbers are the answer "Yes" to limits or targets.
    const withNumbers = createDefaultProfile({ health: { hypertension: 'treated', clinicianTargets: { bpStopSystolic: 170 } } });
    expect(answersFromProfile(withNumbers, S)).toMatchObject({ targets: 'yes', bpStopSystolic: 170 });
  });

  it('never answers eyes or feet for someone v1 never asked (board D79)', () => {
    const noDiabetes = createDefaultProfile({ health: { medicinesReviewed: true } });
    const a = answersFromProfile(noDiabetes, S);
    expect(a.conditions?.eyes).toBeUndefined();
    expect(a.conditions?.feet).toBeUndefined();
    expect(pageDone('health.conditions', a, CTX)).toBe(false);
  });

  it('a migrated, unreviewed profile reads what it kept, but no medicine never answered', () => {
    const migrated = createDefaultProfile({ needsHealthReview: true, health: { diabetes: 'type2' } });
    const a = answersFromProfile(migrated, S);
    expect(a.conditions?.diabetes).toBe('yes');
    expect(a.classes).toBeUndefined();
    expect(a.regular).toBeUndefined();
  });

  it('gives setup none of an unreviewed profile’s health answers: they may be defaults nobody gave (H-DATA)', () => {
    const a = prefillAnswers(S, createDefaultProfile({ needsHealthReview: true, figure: 'female', health: { diabetes: 'type2' } }));
    expect(a.figure).toBe('female');
    expect(a.conditions).toBeUndefined();
    expect(a.painAreas).toBeUndefined();
    expect(a.glucoseMonitor).toBeUndefined();
  });

  it('carries a fluid-limit answer v1 kept in its reminders, as the water rules still read it (reminders/water.ts)', () => {
    const habits = { ...S.habits, fluidLimit: true };
    expect(answersFromProfile(P01, { ...S, habits }).fluidLimit).toBe('yes');
    expect(answersFromProfile(P01, { ...S, habits: { ...S.habits, fluidLimit: false } }).fluidLimit).toBe('no');
    // The profile's own answer, where there is one, comes first.
    expect(answersFromProfile({ ...P01, health: { ...P01.health, fluidRestriction: 'unsure' } }, { ...S, habits }).fluidLimit).toBe('unsure');
    expect(answersFromProfile(P01, S).fluidLimit).toBeUndefined();
  });

  it('a v1 Welcome left part-way fills in its focus (K-57)', () => {
    expect(prefillAnswers({ ...S, focus: 'stretch' }, undefined)).toEqual({ metric: true, focus: 'stretch' });
  });
});

describe('the answers Me edits with (§16)', () => {
  const p = profileFrom(UNSURE, undefined, TODAY, CTX);

  it('keeps "Not sure" while the profile still says what those answers gave', () => {
    const a = answersToEdit(UNSURE, p, S, TODAY, CTX);
    expect(a.conditions?.diabetes).toBe('unsure');
    expect(a.classes?.insulin).toBe('unsure');
  });

  it('an edit made elsewhere wins, for the chapters that own the field only', () => {
    const elsewhere = { ...p, health: { ...p.health, fluidRestriction: true as const } };
    const a = answersToEdit(UNSURE, elsewhere, S, TODAY, CTX);
    expect(a.fluidLimit).toBe('yes');
    expect(a.conditions?.diabetes).toBe('yes');
    expect(a.classes?.insulin).toBe('unsure');
  });

  // A type 1 profile still waiting for its review: severe lows, dizziness and ketones below are defaults nobody gave.
  const unreviewed = createDefaultProfile({
    needsHealthReview: true,
    health: { diabetes: 'type1', insulin: 'injections_or_pump', medicinesReviewed: true, priorDkaOrInsulinDeficiency: false, clinicianTargets: { hba1cPercent: 7 } },
  });

  it('a pending review opens with none of its health, medicine or pain values as answers (H5-10, K5-01; H-DATA)', () => {
    for (const stored of [undefined, answersFromProfile(unreviewed, S)]) {
      const a = answersToEdit(stored, unreviewed, S, TODAY, CTX);
      for (const c of SAFETY_CHAPTERS) for (const k of keysOfChapter(c)) expect(a[k], `${k}, stored ${stored ? 'answers' : 'none'}`).toBeUndefined();
    }
  });

  it('a pending review is never cleared by a Save that answered only what the old editor asked (H5-10, K5-01)', () => {
    const opened = answersToEdit(undefined, unreviewed, S, TODAY, CTX);
    // The home cuff was all the old editor left unanswered here.
    const state = editorState(SAFETY_CHAPTERS, { ...opened, bpCuff: false }, opened, CTX);
    expect(state.blocking).toContain('health.conditions');
    const after = editedRecord(recordOf(unreviewed), { chapters: state.chapters, opened, answers: state.committed, skipped: state.left }, TODAY, CTX);
    // Cleared, it would vouch for the default "no severe lows", which starts a type 1 at 90 instead of 145 mg/dL.
    expect(after.profile?.needsHealthReview).toBe(true);
  });

  it('says what’s true of the programme now (D35)', () => {
    expect(answersToEdit({ ...UNSURE, programme: 'joined' }, p, { ...S, startDate: '' }, TODAY, CTX).programme).toBeUndefined();
    // Even where the rest of the movement answers still hold.
    const left = { ...S, startDate: '' };
    expect(answersToEdit({ ...answersFromProfile(p, left), programme: 'joined' }, p, left, TODAY, CTX).programme).toBeUndefined();
  });
});
