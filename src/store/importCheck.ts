/**
 * The settings and the profile in an import file, read field by field (D-08).
 *
 * Records are each checked whole before an import writes anything; these two
 * documents were only checked to be objects, so a file whose `statusPeriods`
 * was a word, or whose reminders were not an object, restored "fine" and then
 * broke Today and Habits on every launch. Each known field is held to its
 * type here. One that fails is left out, by name, so the preview can say so
 * and the restore needs the same explicit choice as an unreadable record.
 * Fields this build does not know are kept as they are.
 *
 * Health and pain answers are the exception: a profile with one of those
 * unreadable is left out whole. Filling the gap with a default would state
 * an answer — "no foot wound", "no sciatica" — that nobody gave; without the
 * profile, the app asks the questions again before anyone moves.
 */

import { CATEGORIES, isHomeLayout } from '@/categories';
import { isDay } from '@/health/observation';
import { isTextScale } from '@/lib/textSize';
import { ALLERGEN_IDS } from '@/types/profile';
import { CHAPTER_IDS, CONDITION_IDS, MEDICINE_CLASSES, PAGE_IDS } from '@/types/setup';
import { NAME_MAX, OWN_ALLERGIES_MAX, OWN_ALLERGY_LENGTH_MAX } from '@/setup/limits';
import { RECORD_STORES } from './records';

type Check = (x: unknown) => boolean;

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const oneOf = (...values: readonly unknown[]): Check => x => values.includes(x);
const bool: Check = x => typeof x === 'boolean';
const text: Check = x => typeof x === 'string';
const day: Check = x => typeof x === 'string' && isDay(x);
const clock: Check = x => typeof x === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(x);
const num = (min: number, max: number): Check => x => typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;
const medicine: Check = x => typeof x === 'boolean' || x === 'unsure';
const listOf = (item: Check): Check => x => Array.isArray(x) && x.every(item);
const recordOf = (key: Check, value: Check): Check => x => isRecord(x) && Object.entries(x).every(([k, v]) => key(k) && value(v));
/** A sub-document, all or nothing: every field it has passes, and the required ones are there. */
const shape = (fields: Record<string, Check>, required: readonly string[] = []): Check => x =>
  isRecord(x) && required.every(k => x[k] !== undefined)
  && Object.entries(x).every(([k, v]) => v === undefined || !(k in fields) || fields[k](v));

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const MEALS = ['breakfast', 'lunch', 'dinner'] as const;
const HABITS = ['water', 'sittingBreak', 'mealWalk'] as const;

/** A document's checks: each field a check, or a nested document read field by field in turn. */
interface Spec { [field: string]: Check | Spec }

const HABIT_SPEC: Spec = {
  water: shape({ enabled: bool, glassMl: num(1, 5000), dailyGoalMl: num(0, 20000), everyMinutes: num(1, 1440), from: clock, to: clock },
    ['enabled', 'glassMl', 'everyMinutes', 'from', 'to']),
  sittingBreak: shape({ enabled: bool, everyMinutes: num(1, 1440), from: clock, to: clock }, ['enabled', 'everyMinutes', 'from', 'to']),
  mealWalk: shape({ enabled: bool, meals: listOf(oneOf(...MEALS)), finish: recordOf(oneOf(...MEALS), clock) }, ['enabled', 'meals']),
  quietHours: shape({ from: clock, to: clock }, ['from', 'to']),
  fluidLimit: medicine,
  inApp: bool,
  lastExportAt: text,
  lastExportSeq: num(0, Number.MAX_SAFE_INTEGER),
  lastExportVia: oneOf('share', 'download'),
  lastCheckedExportAt: text,
  calendarExport: recordOf(oneOf(...HABITS), shape({ at: text, until: day, events: num(0, 1000), titles: listOf(text), minutes: listOf(num(0, 1439)) }, ['at', 'until', 'events', 'titles'])),
};

const PAIN_AREAS = ['lowerBack', 'sciatica', 'neck', 'shoulder', 'hip', 'knee', 'hamstring', 'calf'] as const;
const PATTERNS = ['vegetarian', 'eggetarian', 'nonVegetarian', 'vegan', 'jain'] as const;
const tri = oneOf('yes', 'no', 'unsure');
const habitWindow = shape({ on: bool, everyMinutes: num(1, 1440), from: clock, to: clock }, ['on', 'everyMinutes', 'from', 'to']);
/** The voice coach's settings: the profile's, and setup's answer (a part of them). */
const VOICE: Check = shape({
  pack: text, voiceURI: text, voiceName: text, rate: num(0.1, 4),
  verbosity: oneOf('auto', 'detailed', 'standard', 'minimal'), mode: oneOf('coach', 'overMusic'), muted: bool, checked: bool,
});
/** Allergies a chip names: the canonical ids (B-13, board D82). */
const ALLERGIES: Check = listOf(oneOf(...ALLERGEN_IDS));
/** Allergies in the person's own words (Plan 7, B-13). */
const CUSTOM_ALLERGIES: Check = x => Array.isArray(x) && x.length <= OWN_ALLERGIES_MAX && x.every(a => typeof a === 'string' && a.trim() !== '' && a.length <= OWN_ALLERGY_LENGTH_MAX);
/** A name, as setup takes it (H5-18). */
const NAME: Check = x => typeof x === 'string' && x.length <= NAME_MAX;

/** Each setup answer a file may hold, by its type (journey §18.1). One that fails is left out by name; unknown ones are kept. */
const ANSWER_SPEC: Spec = {
  name: NAME, birthYear: num(1900, 2100), adult: bool,
  figure: oneOf('male', 'female', 'either'), metric: bool, heightCm: num(50, 260), weightKg: num(10, 400), waistCm: num(30, 250),
  conditions: recordOf(oneOf(...CONDITION_IDS), tri), diabetesType: oneOf('type1', 'type2', 'prediabetes', 'other', 'unsure'),
  bpMedicine: tri, kidneyTreatment: tri, fluidLimit: tri, eyeTreatment: tri,
  eyeDisease: oneOf('mild', 'moderate', 'severe', 'unsure'), feetNumb: tri, footWound: oneOf('now', 'past', 'no', 'unsure'),
  clearance: oneOf('none', 'moderate', 'vigorous', 'unsure'), targets: tri, bpStopSystolic: num(90, 250),
  bpPermission: shape({ sys: num(90, 250), dia: num(50, 150) }, ['sys', 'dia']), hba1cPercent: num(4, 15),
  regular: tri, classes: recordOf(oneOf(...MEDICINE_CLASSES), tri), metforminSince: x => typeof x === 'string' && (x === '' || /^\d{4}$/.test(x)),
  insulinHow: oneOf('basalOnly', 'multipleDaily', 'pump', 'closedLoop', 'unsure'), lowsRisk: tri, glucoseStartMin: num(3, 300),
  glucoseStartUnit: oneOf('mg/dL', 'mmol/L'), priorDka: tri, ketoneTest: oneOf('none', 'urine', 'blood'), dizzy: tri,
  glucoseMonitor: oneOf('none', 'meter', 'cgm'), glucoseUnit: oneOf('mg/dL', 'mmol/L'), bpCuff: bool,
  painAreas: listOf(oneOf(...PAIN_AREAS)), sciaticaSide: oneOf('left', 'right', 'both'), worseWith: oneOf('flexion', 'extension', 'unknown'),
  helps: listOf(oneOf('moving', 'lying', 'heat', 'bendingForward', 'archingBack')), neuroHistory: tri, footRestriction: tri,
  focus: oneOf('stretch', 'move', 'strength', 'explore'), active: oneOf('yes', 'no'), weeklyGoal: x => x === 'none' || num(0, 10080)(x),
  programme: oneOf('join', 'notNow', 'joined'),
  join: shape({
    experience: oneOf('beginner', 'intermediate', 'advanced'), equipment: oneOf('fullGym', 'homeDumbbells', 'homeNone'),
    days: listOf(oneOf(...DAYS)), minutes: oneOf(45, 60, 75), startDate: day,
  }, ['experience', 'equipment', 'days', 'minutes', 'startDate']),
  pattern: oneOf(...PATTERNS), allergies: ALLERGIES, customAllergies: CUSTOM_ALLERGIES, foodLevel: oneOf('ideas', 'meals', 'estimates'),
  hardBefore: oneOf('yes', 'no', 'preferNot'),
  water: shape({ on: bool, glassMl: num(1, 5000), everyMinutes: num(1, 1440), from: clock, to: clock }, ['on', 'glassMl', 'everyMinutes', 'from', 'to']),
  sitting: habitWindow, mealWalk: shape({ on: bool, meals: listOf(oneOf(...MEALS)) }, ['on', 'meals']),
  mealFinish: recordOf(oneOf(...MEALS), clock), quiet: x => x === 'none' || shape({ from: clock, to: clock }, ['from', 'to'])(x),
  delivery: oneOf('app', 'calendar'), voice: VOICE,
  // `day.reminders` was Your day's one page until it was split (K5-12): a backup from before keeps its skipped pages.
  skippedPages: listOf(oneOf(...PAGE_IDS, 'day.reminders')),
};

/** Setup's state, field by field (Review Focus 5): a draft at a page this build lacks loses only its page, never its answers. */
const SETUP_SPEC: Spec = {
  stage: oneOf('open', 'lookAround', 'done'),
  draft: { at: oneOf(...PAGE_IDS), answers: ANSWER_SPEC },
  answers: ANSWER_SPEC,
  completedAt: text,
  skipped: listOf(oneOf(...CHAPTER_IDS)),
  declined: listOf(oneOf(...CHAPTER_IDS)),
  upgraded: bool,
  newHomeSeen: bool,
};

const SETTINGS_SPEC: Spec = {
  startDate: x => x === '' || day(x),
  currentWeight: num(0, 1000),
  targetGoal: text,
  defaultRestSeconds: num(0, 3600),
  useMetric: bool,
  theme: oneOf('light', 'dark', 'system'),
  onboardingComplete: bool,
  gymDays: recordOf(oneOf(...DAYS), text),
  warmupEnabled: bool,
  cooldownEnabled: bool,
  defaultWarmupExercises: listOf(text),
  defaultCooldownExercises: listOf(text),
  supersetRestSeconds: num(0, 3600),
  focus: oneOf('strength', 'stretch', 'move', 'explore'),
  weeklyMovementGoalMinutes: num(0, 10080),
  weeklyMovementGoalHistory: listOf(shape({ from: x => x === '' || day(x), goal: num(1, 10080) }, ['from'])),
  dailyStepsGoal: num(0, 200000),
  dailyStepsGoalHistory: listOf(shape({ from: day, goal: num(0, 200000) }, ['from'])),
  habits: HABIT_SPEC,
  statusPeriods: listOf(shape({ kind: oneOf('flare', 'unwell', 'away'), from: day, to: day, planShift: oneOf('moved', 'kept') }, ['kind', 'from'])),
  walkDefaults: shape({ gps: bool, steps: bool }, ['gps', 'steps']),
  // Whole or not at all: a tile this build has no hub for would leave Home unable to draw.
  home: isHomeLayout,
  homeOffered: listOf(oneOf(...CATEGORIES.map(c => c.id))),
  // Field by field, answer by answer: what can be read is kept, and setup resumes from it.
  setup: SETUP_SPEC,
  display: shape({ reduceMotion: bool, reduceTransparency: bool, textScale: x => isTextScale(x) }),
  // Read, but never taken as this phone's answers: an import keeps this device's own (B-26, `withDeviceConsent`).
  walk: shape({ saveRoutes: oneOf(true, false, 'unasked'), map: oneOf('on', 'off', 'unasked'), stepCardSeen: bool }, ['saveRoutes', 'map']),
  // List by list: one that cannot be read must not take the others with it,
  // or an older backup could bring back what they keep deleted (D-06, R5-01).
  deleted: { observations: listOf(text), sessions: listOf(text), readings: listOf(text), records: recordOf(oneOf(...RECORD_STORES), listOf(text)) },
};

const HEALTH: Check = shape({
  diabetes: oneOf('none', 'prediabetes', 'type1', 'type2', 'other'),
  insulin: oneOf('none', 'injections_or_pump', 'automated_delivery', 'unsure'),
  insulinRegimen: oneOf('basalOnly', 'multipleDaily', 'pump'),
  sulfonylureaOrMeglitinide: medicine,
  sglt2i: medicine,
  metformin: medicine,
  metforminSince: text,
  priorDkaOrInsulinDeficiency: medicine,
  medicinesReviewed: bool,
  highHypoRisk: bool,
  hypertension: oneOf('none', 'treated', 'untreated', 'unsure'),
  betaBlocker: medicine,
  diuretic: medicine,
  bpMedicinesReviewed: bool,
  heartOrVascularDisease: bool,
  kidneyDisease: oneOf('none', 'ckd', 'dialysis_or_transplant', 'unsure'),
  fluidRestriction: medicine,
  retinopathy: oneOf('none_or_mild', 'moderate', 'severe_or_proliferative', 'recent_eye_treatment', 'unknown'),
  peripheralNeuropathy: oneOf('no', 'yes', 'unsure'),
  footStatus: oneOf('healthy', 'past_ulcer_or_charcot', 'current_wound_or_active_charcot'),
  dizzyOnStandingOrAutonomicNeuropathy: bool,
  glucoseMonitor: oneOf('none', 'meter', 'cgm'),
  glucoseUnit: oneOf('mg/dL', 'mmol/L'),
  ketoneTest: oneOf('none', 'urine', 'blood'),
  bpMonitor: bool,
  currentlyActive: bool,
  clearance: oneOf('none', 'moderate', 'vigorous'),
  clinicianTargets: shape({ glucoseStartMin: num(0, 1000), glucoseStartUnit: oneOf('mg/dL', 'mmol/L'), bpStopSystolic: num(0, 400), hba1cPercent: num(0, 30) }),
  bpExercisePermission: shape({ sys: num(0, 400), dia: num(0, 300), recordedOn: day }, ['sys', 'dia']),
});

const PAIN: Check = shape({
  areas: listOf(oneOf('lowerBack', 'sciatica', 'neck', 'shoulder', 'hip', 'knee', 'hamstring', 'calf')),
  sciaticaSide: oneOf('left', 'right', 'both'),
  worseWith: oneOf('flexion', 'extension', 'unknown'),
  preference: oneOf('extension', 'flexion', 'none', 'untested'),
  neuroHistory: medicine,
});

const PROFILE_SPEC: Spec = {
  version: oneOf(1),
  weightKg: num(0, 700),
  heightCm: num(0, 300),
  birthYear: num(1900, 2100),
  experience: oneOf('beginner', 'intermediate', 'advanced'),
  trainingDays: listOf(oneOf(...DAYS)),
  sessionMinutes: oneOf(45, 60, 75),
  equipment: oneOf('fullGym', 'homeDumbbells', 'homeNone'),
  goals: listOf(oneOf('strong', 'lean', 'flexible', 'athletic', 'painFreeBack')),
  ladder: shape({ hinge: oneOf(0, 1, 2, 3, 4), squat: oneOf(0, 1, 2, 3, 4), neuralGate: bool, changedOn: day }),
  flexibilityTargets: listOf(text),
  dislikes: listOf(text),
  restDayMobility: bool,
  voice: VOICE,
  figure: oneOf('male', 'female'),
  needsHealthReview: bool,
  name: NAME,
  waistCm: num(0, 300),
  // All or nothing (D-08): an unreadable allergy must not leave the rest standing as "no allergies".
  food: shape({
    pattern: oneOf(...PATTERNS),
    avoid: listOf(text),
    region: oneOf('north', 'south', 'east', 'west', 'mixed'),
    allergies: ALLERGIES,
    level: oneOf('ideas', 'meals', 'estimates'),
    hardBefore: oneOf('yes', 'no', 'preferNot'),
    customAllergies: CUSTOM_ALLERGIES,
    careTeamTargets: shape({ kcal: num(1, 10000), carbsG: num(1, 2000), setOn: day }, ['setOn']),
    logReminder: shape({ meal: oneOf(...MEALS), at: clock }, ['meal', 'at']),
  }, ['pattern', 'avoid']),
};

/** The document with every field that fails its check left out, and those fields' names. */
function read(doc: Record<string, unknown>, spec: Spec, path: string): { kept: Record<string, unknown>; unreadable: string[] } {
  const kept: Record<string, unknown> = {};
  const unreadable: string[] = [];
  for (const [field, value] of Object.entries(doc)) {
    const check = spec[field];
    if (check === undefined || value === undefined) {
      kept[field] = value;
    } else if (typeof check === 'function') {
      if (check(value)) kept[field] = value;
      else unreadable.push(`${path}${field}`);
    } else if (isRecord(value)) {
      const inner = read(value, check, `${path}${field}.`);
      kept[field] = inner.kept;
      unreadable.push(...inner.unreadable);
    } else {
      unreadable.push(`${path}${field}`);
    }
  }
  return { kept, unreadable };
}

/**
 * Setup's half-typed page answers (`draft.edits`, H5-16) stay on the device
 * they were typed on: never given, they are never restored, so a restore
 * never draws them over its own answers (H5-07).
 */
function withoutHeld(doc: Record<string, unknown>): Record<string, unknown> {
  const setup = doc.setup;
  if (!isRecord(setup) || !isRecord(setup.draft) || !('edits' in setup.draft)) return doc;
  const { edits: _held, ...draft } = setup.draft;
  void _held;
  return { ...doc, setup: { ...setup, draft } };
}

export function readSettings(doc: Record<string, unknown>): { settings: Record<string, unknown>; unreadable: string[] } {
  const { kept, unreadable } = read(withoutHeld(doc), SETTINGS_SPEC, 'settings.');
  return { settings: kept, unreadable };
}

export function readProfile(doc: Record<string, unknown>): { profile?: Record<string, unknown>; unreadable: string[] } {
  if (doc.health !== undefined && !HEALTH(doc.health)) return { unreadable: ['profile.health'] };
  if (doc.pain !== undefined && !PAIN(doc.pain)) return { unreadable: ['profile.pain'] };
  const { kept, unreadable } = read(doc, PROFILE_SPEC, 'profile.');
  return { profile: kept, unreadable };
}
