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

import { isDay } from '@/health/observation';

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
  calendarExport: recordOf(oneOf(...HABITS), shape({ at: text, until: day, events: num(0, 1000), titles: listOf(text) }, ['at', 'until', 'events', 'titles'])),
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
  dailyStepsGoal: num(0, 200000),
  dailyStepsGoalHistory: listOf(shape({ from: day, goal: num(0, 200000) }, ['from'])),
  habits: HABIT_SPEC,
  statusPeriods: listOf(shape({ kind: oneOf('flare', 'unwell', 'away'), from: day, to: day, planShift: oneOf('moved', 'kept') }, ['kind', 'from'])),
  walkDefaults: shape({ gps: bool, steps: bool }, ['gps', 'steps']),
  // List by list: one that cannot be read must not take the others with it,
  // or an older backup could bring back what they keep deleted (D-06, R5-01).
  deleted: { observations: listOf(text), sessions: listOf(text), readings: listOf(text) },
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
  voice: shape({
    pack: text, voiceURI: text, voiceName: text, rate: num(0.1, 4),
    verbosity: oneOf('auto', 'detailed', 'standard', 'minimal'), mode: oneOf('coach', 'overMusic'), muted: bool, checked: bool,
  }),
  figure: oneOf('male', 'female'),
  needsHealthReview: bool,
  food: shape({ pattern: oneOf('vegetarian', 'eggetarian', 'nonVegetarian', 'vegan'), avoid: listOf(text), region: oneOf('north', 'south', 'east', 'west', 'mixed') },
    ['pattern', 'avoid']),
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

export function readSettings(doc: Record<string, unknown>): { settings: Record<string, unknown>; unreadable: string[] } {
  const { kept, unreadable } = read(doc, SETTINGS_SPEC, 'settings.');
  return { settings: kept, unreadable };
}

export function readProfile(doc: Record<string, unknown>): { profile?: Record<string, unknown>; unreadable: string[] } {
  if (doc.health !== undefined && !HEALTH(doc.health)) return { unreadable: ['profile.health'] };
  if (doc.pain !== undefined && !PAIN(doc.pain)) return { unreadable: ['profile.pain'] };
  const { kept, unreadable } = read(doc, PROFILE_SPEC, 'profile.');
  return { profile: kept, unreadable };
}
