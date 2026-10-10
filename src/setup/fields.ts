/**
 * The crosswalk (journey §6.3 as corrected, board D76): each health and pain
 * field, and the setup answers that set it. `Record`s over the profile's own
 * keys, so a field added to the profile without a question fails the build.
 */
import type { HealthProfile, PainProfile } from '@/types/profile';
import type { ChapterId, SetupAnswers } from '@/types/setup';
import { PAGES, chapterOf } from './graph';

export const HEALTH_SOURCES: Record<keyof HealthProfile, readonly (keyof SetupAnswers)[]> = {
  diabetes: ['conditions', 'diabetesType', 'classes'],
  insulin: ['classes', 'insulinHow'],
  insulinRegimen: ['insulinHow'],
  sulfonylureaOrMeglitinide: ['regular', 'classes'],
  sglt2i: ['regular', 'classes'],
  metformin: ['regular', 'classes'],
  metforminSince: ['metforminSince'],
  priorDkaOrInsulinDeficiency: ['priorDka'],
  medicinesReviewed: ['regular', 'classes'],
  highHypoRisk: ['lowsRisk'],
  hypertension: ['conditions', 'bpMedicine'],
  betaBlocker: ['regular', 'classes'],
  diuretic: ['regular', 'classes'],
  bpMedicinesReviewed: ['regular', 'classes'],
  heartOrVascularDisease: ['conditions'],
  kidneyDisease: ['conditions', 'kidneyTreatment'],
  fluidRestriction: ['fluidLimit'],
  retinopathy: ['conditions', 'eyeTreatment', 'eyeDisease'],
  peripheralNeuropathy: ['conditions', 'feetNumb'],
  footStatus: ['conditions', 'footWound', 'footRestriction'],
  dizzyOnStandingOrAutonomicNeuropathy: ['dizzy'],
  glucoseMonitor: ['glucoseMonitor'],
  glucoseUnit: ['glucoseUnit'],
  ketoneTest: ['ketoneTest'],
  bpMonitor: ['bpCuff'],
  currentlyActive: ['active'],
  clearance: ['clearance'],
  clinicianTargets: ['targets', 'bpStopSystolic', 'hba1cPercent', 'glucoseStartMin', 'glucoseStartUnit'],
  bpExercisePermission: ['targets', 'bpPermission'],
};

/** `preference` is learned, never asked (D77). */
export const PAIN_SOURCES: Record<keyof PainProfile, readonly (keyof SetupAnswers)[] | 'learned'> = {
  areas: ['conditions', 'painAreas'],
  sciaticaSide: ['sciaticaSide'],
  worseWith: ['worseWith'],
  neuroHistory: ['neuroHistory'],
  preference: 'learned',
};

/** Fields outside health and pain that each chapter's answers set. */
const OTHER_FIELDS: Record<ChapterId, readonly string[]> = {
  welcome: [],
  about: ['profile.name', 'profile.birthYear', 'profile.figure', 'profile.heightCm', 'profile.weightKg', 'profile.waistCm', 'settings.useMetric'],
  health: [],
  medicines: [],
  backFeet: [],
  movement: ['settings.focus', 'settings.weeklyMovementGoalMinutes'],
  food: ['profile.food'],
  day: ['settings.habits.water', 'settings.habits.sittingBreak', 'settings.habits.mealWalk', 'settings.habits.quietHours', 'settings.habits.inApp', 'profile.voice'],
};

export function keysOfChapter(chapter: ChapterId): (keyof SetupAnswers)[] {
  return [...new Set(PAGES.filter(p => chapterOf(p.id) === chapter).flatMap(p => p.sets))];
}

/** Every record path a chapter's answers can change: what an edit of it owns (§16). */
export function fieldsOfChapter(chapter: ChapterId): string[] {
  const keys = new Set<string>(keysOfChapter(chapter));
  const owns = (sources: readonly string[] | 'learned') => sources !== 'learned' && sources.some(k => keys.has(k));
  return [...new Set([
    ...OTHER_FIELDS[chapter],
    ...Object.entries(HEALTH_SOURCES).filter(([, s]) => owns(s)).map(([f]) => `profile.health.${f}`),
    ...Object.entries(PAIN_SOURCES).filter(([, s]) => owns(s)).map(([f]) => `profile.pain.${f}`),
  ])];
}
