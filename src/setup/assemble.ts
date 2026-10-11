/**
 * From setup's answers to the record the engine reads (journey §6.3, as
 * corrected on the board, D76). The one place "Not sure" becomes "may have"
 * (§6.1). A field is set only from an answer that was given: with no answer
 * it keeps what it had, so a chapter not asked, or a v1 answer v2 hasn't
 * asked again, never turns into a "No".
 */
import type { AppData, UserSettings } from '@/types';
import type { HabitSettings } from '@/types/habits';
import type { FoodPreferences, HealthProfile, MedicineAnswer, PainProfile, UserProfile } from '@/types/profile';
import { CHAPTER_IDS, type ChapterId, type MedicineClass, type SetupAnswers, type SetupState, type Tri } from '@/types/setup';
import type { ObservationInput } from '@/health/observation';
import { bpMedicinesAsked, deriveHealth } from '@/engine/health';
import { startingLadder } from '@/engine/progression';
import { ladderAfterEdit } from '@/components/profile/wizardSteps';
import { createDefaultProfile } from '@/profile/defaults';
import { conditionBlock } from '@/reminders/water';
import { defaultHome, isHomeLayout } from '@/categories';
import { withJoinAnswers } from '@/programme/join';
import { withWeeklyGoal } from '@/screens/track/weeklyGoal';
import { sameValue } from '@/store/transfer';
import { diabetesOf, factsOf, has } from './facts';
import { REVIEW_ALSO, SAFETY_CHAPTERS, chapterComplete, pageDone, skippedChapters, type Ctx } from './graph';
import { setupStateOf } from './state';

const med = (t: Tri | undefined): MedicineAnswer => (t === 'yes' ? true : t === 'unsure' ? 'unsure' : false);

/** Sets an optional field, or removes it for `undefined`, so a stored record never holds an `undefined` key. */
export function put<T extends object, K extends keyof T>(target: T, key: K, value: T[K] | undefined): void {
  if (value === undefined) delete (target as Record<PropertyKey, unknown>)[key as PropertyKey];
  else target[key] = value;
}

/** The object without its `undefined` values, or `undefined` when nothing is left. */
export function compact<T extends object>(o: T): T | undefined {
  const kept = Object.entries(o).filter(([, v]) => v !== undefined);
  return kept.length > 0 ? (Object.fromEntries(kept) as T) : undefined;
}

const EYES: Record<NonNullable<SetupAnswers['eyeDisease']>, HealthProfile['retinopathy']> = {
  mild: 'none_or_mild', moderate: 'moderate', severe: 'severe_or_proliferative', unsure: 'unknown',
};
const CLASS_FIELD = {
  lowsTablet: 'sulfonylureaOrMeglitinide', gliflozin: 'sglt2i', metformin: 'metformin', betaBlocker: 'betaBlocker', diuretic: 'diuretic',
} as const satisfies Partial<Record<MedicineClass, keyof HealthProfile>>;
const DIABETES_CLASSES = ['insulin', 'lowsTablet', 'gliflozin', 'metformin'] as const;

export function healthFrom(a: SetupAnswers, base: HealthProfile, today: string): HealthProfile {
  const f = factsOf(a);
  const c = a.conditions ?? {};
  const next: HealthProfile = { ...base };

  // Chapter 3: each chip and its follow-ups.
  const diabetes = diabetesOf(a);
  if (diabetes !== undefined) next.diabetes = diabetes;
  if (c.bp !== undefined) {
    next.hypertension = !has(c.bp) ? 'none' : a.bpMedicine === 'yes' ? 'treated' : a.bpMedicine === 'no' && c.bp === 'yes' ? 'untreated' : 'unsure';
  }
  if (c.heart !== undefined) next.heartOrVascularDisease = has(c.heart);
  if (c.kidney !== undefined) {
    next.kidneyDisease = !has(c.kidney) ? 'none' : has(a.kidneyTreatment) ? 'dialysis_or_transplant' : c.kidney === 'unsure' ? 'unsure' : 'ckd';
  }
  if (a.fluidLimit !== undefined) next.fluidRestriction = med(a.fluidLimit);
  if (c.eyes !== undefined) {
    next.retinopathy = !has(c.eyes) ? 'none_or_mild' : has(a.eyeTreatment) ? 'recent_eye_treatment' : EYES[a.eyeDisease ?? 'unsure'];
  }
  if (c.feet !== undefined) {
    next.peripheralNeuropathy = !has(c.feet) || a.feetNumb === 'no' ? 'no' : a.feetNumb === 'yes' ? 'yes' : 'unsure';
    next.footStatus = !has(c.feet) ? 'healthy'
      : a.footWound === 'now' || a.footWound === 'unsure' ? 'current_wound_or_active_charcot'
      : a.footWound === 'past' ? 'past_ulcer_or_charcot' : 'healthy';
  }
  // A clinician's weight-bearing limit outranks the foot chip: only the limit, answered again, releases it (K-30; H5-03).
  if (f.footLimit) next.footStatus = 'current_wound_or_active_charcot';
  if (a.clearance !== undefined) next.clearance = a.clearance === 'moderate' || a.clearance === 'vigorous' ? a.clearance : 'none';
  if (a.targets !== undefined || a.glucoseStartMin !== undefined) {
    const targets = a.targets === 'yes';
    put(next, 'clinicianTargets', compact({
      glucoseStartMin: f.hypoRisk ? a.glucoseStartMin : undefined,
      glucoseStartUnit: f.hypoRisk && a.glucoseStartMin !== undefined ? a.glucoseStartUnit ?? a.glucoseUnit ?? 'mg/dL' : undefined,
      bpStopSystolic: targets && f.bp ? a.bpStopSystolic : undefined,
      hba1cPercent: targets && f.diabetic ? a.hba1cPercent : undefined,
    }));
    const permission = targets && f.bp ? a.bpPermission : undefined;
    const was = base.bpExercisePermission;
    const keptOn = permission && was && was.sys === permission.sys && was.dia === permission.dia ? was.recordedOn : undefined;
    put(next, 'bpExercisePermission', permission ? { ...permission, recordedOn: keptOn ?? today } : undefined);
  }

  // Chapter 4: medicines, whatever the diagnosis (A-06, K-05). "No regular medicines" answers each class No.
  if (a.regular !== undefined) {
    for (const [cls, field] of Object.entries(CLASS_FIELD) as [keyof typeof CLASS_FIELD, (typeof CLASS_FIELD)[keyof typeof CLASS_FIELD]][]) {
      const answer = a.regular === 'no' ? 'no' : a.classes?.[cls];
      if (answer !== undefined) next[field] = med(answer);
    }
    // An emptied year clears the stored one; a year not asked keeps it (H5-21).
    const since = a.metforminSince === undefined ? base.metforminSince : a.metforminSince || undefined;
    put(next, 'metforminSince', next.metformin === true ? since : undefined);
  }
  const insulinAnswer = a.regular === 'no' ? 'no' : a.classes?.insulin;
  if (insulinAnswer !== undefined || diabetes === 'type1') {
    const takesInsulin = has(insulinAnswer) || diabetes === 'type1';
    next.insulin = !takesInsulin ? 'none'
      : insulinAnswer === 'unsure' || a.insulinHow === undefined || a.insulinHow === 'unsure' ? 'unsure'
      : a.insulinHow === 'closedLoop' ? 'automated_delivery' : 'injections_or_pump';
    put(next, 'insulinRegimen', next.insulin === 'automated_delivery' ? 'pump'
      : next.insulin === 'injections_or_pump' && a.insulinHow !== undefined && a.insulinHow !== 'unsure' && a.insulinHow !== 'closedLoop' ? a.insulinHow
      : undefined);
  }
  if (a.lowsRisk !== undefined) next.highHypoRisk = has(a.lowsRisk);
  if (a.priorDka !== undefined) next.priorDkaOrInsulinDeficiency = med(a.priorDka);
  if (a.ketoneTest !== undefined) next.ketoneTest = a.ketoneTest;
  if (a.dizzy !== undefined) next.dizzyOnStandingOrAutonomicNeuropathy = has(a.dizzy);
  if (a.glucoseMonitor !== undefined) next.glucoseMonitor = a.glucoseMonitor;
  if (a.glucoseUnit !== undefined) next.glucoseUnit = a.glucoseUnit;
  if (a.bpCuff !== undefined) next.bpMonitor = a.bpCuff;

  // Chapter 6.
  if (a.active !== undefined) next.currentlyActive = a.active === 'yes';
  return next;
}

/**
 * Which reviews the answers earn. `medicinesReviewed` vouches for the diabetes
 * medicines, or without diabetes the "-gliflozin" alone; `bpMedicinesReviewed`
 * for the beta-blocker and the water tablet (`wizardSteps.answeredOnOpen`).
 * Each is earned only when every medicine it vouches for was answered.
 */
function reviewsOf(a: SetupAnswers, h: HealthProfile): { medicines: boolean; bp: boolean } {
  const given = (k: MedicineClass) => a.regular === 'no' || a.classes?.[k] !== undefined;
  return {
    medicines: deriveHealth(h).diabetic ? DIABETES_CLASSES.every(given) && a.priorDka !== undefined : given('gliflozin'),
    bp: given('betaBlocker') && given('diuretic'),
  };
}

export function painFrom(a: SetupAnswers, base: PainProfile): PainProfile {
  const chip = a.conditions?.pain;
  if (chip === undefined) return base;
  const next: PainProfile = { ...base };
  // A nerve damaged in the past is history, not pain now: no pain today keeps it (H5-19).
  if (a.neuroHistory !== undefined) next.neuroHistory = med(a.neuroHistory);
  if (chip === 'no') {
    next.areas = [];
    next.worseWith = 'unknown';
    put(next, 'sciaticaSide', undefined);
    return next;
  }
  if (a.painAreas !== undefined) next.areas = [...a.painAreas];
  const back = next.areas.includes('lowerBack') || next.areas.includes('sciatica');
  put(next, 'sciaticaSide', next.areas.includes('sciatica') ? a.sciaticaSide ?? base.sciaticaSide : undefined);
  next.worseWith = back ? a.worseWith ?? base.worseWith : 'unknown';
  return next;
}

/**
 * The food contract Plan 7 consumes, as chapter 7 answered it (board D82).
 * The chips and the person's own words are one answer: given, it replaces
 * both, and an empty list is kept as "No food allergies". What chapter 7
 * didn't ask stays.
 */
export function foodFrom(a: SetupAnswers, base: FoodPreferences | undefined): FoodPreferences | undefined {
  if (a.pattern === undefined) return base;
  const next: FoodPreferences = { ...base, pattern: a.pattern, avoid: base?.avoid ?? [] };
  if (a.allergies !== undefined) {
    next.allergies = [...a.allergies];
    put(next, 'customAllergies', a.customAllergies?.length ? [...a.customAllergies] : undefined);
  }
  if (a.foodLevel !== undefined) next.level = a.foodLevel;
  if (a.hardBefore !== undefined) next.hardBefore = a.hardBefore;
  return next;
}

/**
 * The profile the answers give, on top of `base` (the stored profile, if
 * any). Only the fields `chapters` own are worked out again (Me edits a
 * chapter at a time). A new profile from unfinished safety chapters stays
 * held (`needsHealthReview`).
 */
export function profileFrom(a: SetupAnswers, base: UserProfile | undefined, today: string, ctx: Ctx, chapters: readonly ChapterId[] = CHAPTER_IDS): UserProfile {
  const start = base ?? createDefaultProfile({ needsHealthReview: true });
  const on = (c: ChapterId) => chapters.includes(c);
  const next: UserProfile = structuredClone(start);

  if (on('about')) {
    if ('name' in a) put(next, 'name', a.name?.trim() || undefined);
    if ('birthYear' in a) put(next, 'birthYear', a.birthYear);
    if (a.figure !== undefined) put(next, 'figure', a.figure === 'either' ? undefined : a.figure);
    if ('heightCm' in a) put(next, 'heightCm', a.heightCm);
    if ('weightKg' in a) next.weightKg = a.weightKg ?? 0;
    if ('waistCm' in a) put(next, 'waistCm', a.waistCm);
  }
  if (on('health') || on('medicines') || on('backFeet') || on('movement')) {
    next.health = healthFrom(a, start.health, today);
    const reviews = on('medicines') && chapterComplete('medicines', a, ctx) ? reviewsOf(a, next.health) : { medicines: false, bp: false };
    if (reviews.medicines) next.health.medicinesReviewed = true;
    // A review vouches for the medicines asked then: diabetes added since needs them answered again (Review Focus 1).
    else if (deriveHealth(next.health).diabetic && !deriveHealth(start.health).diabetic) next.health.medicinesReviewed = false;
    if (reviews.bp && bpMedicinesAsked(next.health)) next.health.bpMedicinesReviewed = true;
    else if (bpMedicinesAsked(next.health) && !bpMedicinesAsked(start.health)) put(next.health, 'bpMedicinesReviewed', undefined);
  }
  // Your day and coach asks the fluid limit too, when water reminders go on: the engine reads it as Your health's (§6.3; H5-04).
  if (on('day') && a.fluidLimit !== undefined) next.health.fluidRestriction = med(a.fluidLimit);
  if (on('health') || on('backFeet')) next.pain = painFrom(a, start.pain);
  if (on('food')) put(next, 'food', foodFrom(a, start.food));
  if (on('day') && a.voice) next.voice = { ...start.voice, ...a.voice };
  // Only every safety chapter, complete, in one sitting, with whether they exercise now, clears a review (§6.1; H-DATA; H5-11).
  if (SAFETY_CHAPTERS.every(c => on(c) && chapterComplete(c, a, ctx)) && REVIEW_ALSO.every(id => pageDone(id, a, ctx))) next.needsHealthReview = false;
  next.ladder = base ? ladderAfterEdit(base, next, today) : startingLadder(next);
  return next;
}

/** The reminders chapter 8 turned on. Water needs a fluid limit answered "No" and no condition needing one (reminders/water.ts). */
export function habitsFrom(a: SetupAnswers, base: HabitSettings | undefined, profile: UserProfile): HabitSettings {
  const next: HabitSettings = { ...base };
  if (a.water) {
    const allowed = a.fluidLimit === 'no' && conditionBlock(profile) === undefined;
    next.water = { ...base?.water, enabled: a.water.on && allowed, glassMl: a.water.glassMl, everyMinutes: a.water.everyMinutes, from: a.water.from, to: a.water.to };
  }
  if (a.sitting) next.sittingBreak = { enabled: a.sitting.on, everyMinutes: a.sitting.everyMinutes, from: a.sitting.from, to: a.sitting.to };
  if (a.mealWalk) {
    const finish = a.mealFinish ?? base?.mealWalk?.finish;
    next.mealWalk = { enabled: a.mealWalk.on && !factsOf(a).footHeld, meals: [...a.mealWalk.meals], ...(finish ? { finish } : {}) };
  }
  if (a.quiet === 'none') delete next.quietHours;
  else if (a.quiet) next.quietHours = { ...a.quiet };
  if (a.delivery) next.inApp = a.delivery === 'app';
  return next;
}

/** The settings the answers set, for the chapters given. A weekly goal goes through Plan 2's dated goals (B-16). */
export function settingsFrom(a: SetupAnswers, base: UserSettings, profile: UserProfile, today: string, chapters: readonly ChapterId[] = CHAPTER_IDS): Partial<UserSettings> {
  const on = (c: ChapterId) => chapters.includes(c);
  const patch: Partial<UserSettings> = {};
  if (on('about')) {
    if (a.metric !== undefined) patch.useMetric = a.metric;
    if (a.weightKg !== undefined) patch.currentWeight = a.weightKg;
  }
  if (on('movement')) {
    if (a.focus !== undefined) patch.focus = a.focus;
    if (a.weeklyGoal !== undefined) Object.assign(patch, withWeeklyGoal(base, a.weeklyGoal === 'none' ? undefined : a.weeklyGoal, today));
  }
  if (on('day')) patch.habits = habitsFrom(a, base.habits, profile);
  return patch;
}

/** A dated reading for each body measure that changed (§18.1). A v1 weight with no date is never given one (B-16). */
export function measurementsFrom(a: SetupAnswers, before: Partial<Pick<UserProfile, 'weightKg' | 'heightCm' | 'waistCm'>> | undefined, at: string): ObservationInput[] {
  const changed = (value: number | undefined, was: number | undefined) => value !== undefined && Number.isFinite(value) && value > 0 && value !== was;
  const reading = (kind: 'weight' | 'height' | 'waist', value: number, unit: string): ObservationInput =>
    ({ kind, value, unit, scope: 'pointInTime', source: 'manual', at, context: 'profile' });
  return [
    ...(changed(a.weightKg, before?.weightKg || undefined) ? [reading('weight', a.weightKg!, 'kg')] : []),
    ...(changed(a.heightCm, before?.heightCm) ? [reading('height', a.heightCm!, 'cm')] : []),
    ...(changed(a.waistCm, before?.waistCm) ? [reading('waist', a.waistCm!, 'cm')] : []),
  ];
}

/**
 * "Start using FitStrong": the profile, the settings, completion and Home's
 * first tiles, as one record (§6.2, §5.1). Planned inside the write against
 * what is stored, it changes nothing once another tab has finished setup, or
 * when the stored draft is no longer the one Review showed (H5-09).
 */
export function completedSetup(data: AppData, a: SetupAnswers, now: string, ctx: Ctx & { hasSteps: boolean }): AppData {
  const prior = setupStateOf(data.settings, data.profile);
  if (prior.stage === 'done' || (prior.draft?.answers !== undefined && !sameValue(prior.draft.answers, a))) return data;
  const today = now.slice(0, 10);
  const profile = profileFrom(a, data.profile, today, ctx);
  const joined = a.programme === 'join' && a.join !== undefined;
  const setup: SetupState = {
    stage: 'done',
    answers: joined ? { ...a, programme: 'joined' } : a,
    completedAt: now,
    skipped: skippedChapters(a, ctx),
    ...(prior.declined ? { declined: prior.declined } : {}),
    ...(prior.upgraded ? { upgraded: true } : {}),
    ...(prior.newHomeSeen ? { newHomeSeen: true } : {}),
  };
  let next: AppData = { ...data, profile, settings: { ...data.settings, ...settingsFrom(a, data.settings, profile, today), onboardingComplete: true, setup } };
  if (joined) next = withJoinAnswers(next, a.join!);
  if (!isHomeLayout(next.settings.home)) {
    const home = defaultHome({ profile: next.profile!, settings: next.settings, hasSteps: ctx.hasSteps, backUnsure: a.conditions?.pain === 'unsure' });
    next = { ...next, settings: { ...next.settings, home } };
  }
  return next;
}

/** "Look around first" (§6.4): Home now, with every movement held; the answers so far wait in the draft, and what pages held goes (K5-05). */
export function lookedAround(data: AppData): AppData {
  const prior = setupStateOf(data.settings, data.profile);
  const { edits: _held, ...draft } = prior.draft ?? {};
  void _held;
  return { ...data, settings: { ...data.settings, onboardingComplete: true, setup: { ...prior, stage: 'lookAround', ...(prior.draft ? { draft } : {}) } } };
}
