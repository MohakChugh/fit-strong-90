/**
 * The answers a stored record already gives, for setup's pages: a v1 Welcome
 * left part-way (K-57), a restored backup that never finished setting up
 * (§6.4), and Me's chapters for someone set up in v1 (§16). Only what v1
 * asked: it asked about the eyes and feet only with diabetes, so without it
 * those chips stay unanswered rather than read back as "No" (contract H-DATA,
 * board D79); and a medicine answer counts only when v1 counted it
 * (`answeredOnOpen`).
 */
import type { UserSettings } from '@/types';
import type { MedicineAnswer, UserProfile } from '@/types/profile';
import { CHAPTER_IDS, type SetupAnswers, type Tri } from '@/types/setup';
import { deriveHealth } from '@/engine/health';
import { answeredOnOpen } from '@/components/profile/wizardSteps';
import { isEnrolled } from '@/health/recommend';
import { sameValue } from '@/store/transfer';
import { profileFrom, put, settingsFrom } from './assemble';
import { fieldsOfChapter, keysOfChapter } from './fields';
import { SAFETY_CHAPTERS, type Ctx } from './graph';

type Kept = Pick<UserSettings, 'useMetric' | 'focus' | 'weeklyMovementGoalMinutes' | 'habits' | 'startDate'>;

const tri = (v: MedicineAnswer | undefined): Tri | undefined => (v === true ? 'yes' : v === 'unsure' ? 'unsure' : v === false ? 'no' : undefined);

export function answersFromProfile(p: UserProfile, s: Kept): SetupAnswers {
  const h = p.health;
  const d = deriveHealth(h);
  const a: SetupAnswers = { metric: s.useMetric };

  // 2. About you: the person's own values.
  if (p.name !== undefined) a.name = p.name;
  if (p.birthYear !== undefined) a.birthYear = p.birthYear;
  if (p.figure) a.figure = p.figure;
  if (p.heightCm) a.heightCm = p.heightCm;
  if (p.weightKg > 0) a.weightKg = p.weightKg;
  if (p.waistCm) a.waistCm = p.waistCm;

  // 3. Your health, as v1's health step asked it.
  a.conditions = {
    diabetes: h.diabetes === 'none' ? 'no' : 'yes',
    bp: h.hypertension === 'none' ? 'no' : h.hypertension === 'unsure' ? 'unsure' : 'yes',
    heart: h.heartOrVascularDisease ? 'yes' : 'no',
    kidney: h.kidneyDisease === 'none' ? 'no' : h.kidneyDisease === 'unsure' ? 'unsure' : 'yes',
    pain: p.pain.areas.length > 0 ? 'yes' : 'no',
    ...(d.diabetic ? {
      eyes: h.retinopathy === 'none_or_mild' ? 'no' : h.retinopathy === 'unknown' ? 'unsure' : 'yes',
      feet: h.peripheralNeuropathy === 'no' && h.footStatus === 'healthy' ? 'no'
        : h.peripheralNeuropathy === 'unsure' && h.footStatus === 'healthy' ? 'unsure' : 'yes',
    } as const : {}),
  };
  if (h.diabetes !== 'none') a.diabetesType = h.diabetes;
  if (h.hypertension === 'treated') a.bpMedicine = 'yes';
  else if (h.hypertension === 'untreated') a.bpMedicine = 'no';
  else if (h.hypertension === 'unsure') a.bpMedicine = 'unsure';
  if (h.kidneyDisease !== 'none') a.kidneyTreatment = h.kidneyDisease === 'dialysis_or_transplant' ? 'yes' : 'no';
  if (h.fluidRestriction !== undefined) a.fluidLimit = tri(h.fluidRestriction);
  if (d.diabetic && h.retinopathy !== 'none_or_mild') {
    a.eyeTreatment = h.retinopathy === 'recent_eye_treatment' ? 'yes' : 'no';
    if (h.retinopathy !== 'recent_eye_treatment') a.eyeDisease = h.retinopathy === 'moderate' ? 'moderate' : h.retinopathy === 'severe_or_proliferative' ? 'severe' : 'unsure';
  }
  if (a.conditions.feet === 'yes' || a.conditions.feet === 'unsure') {
    a.feetNumb = h.peripheralNeuropathy === 'yes' ? 'yes' : h.peripheralNeuropathy === 'unsure' ? 'unsure' : 'no';
    a.footWound = h.footStatus === 'current_wound_or_active_charcot' ? 'now' : h.footStatus === 'past_ulcer_or_charcot' ? 'past' : 'no';
  }
  if (d.diabetic || h.heartOrVascularDisease || h.kidneyDisease !== 'none' || h.hypertension !== 'none') a.clearance = h.clearance;
  const t = h.clinicianTargets;
  if (t?.bpStopSystolic !== undefined) a.bpStopSystolic = t.bpStopSystolic;
  if (t?.hba1cPercent !== undefined) a.hba1cPercent = t.hba1cPercent;
  if (h.bpExercisePermission) a.bpPermission = { sys: h.bpExercisePermission.sys, dia: h.bpExercisePermission.dia };
  if (a.bpStopSystolic !== undefined || a.hba1cPercent !== undefined || a.bpPermission) a.targets = 'yes';

  // 4. Medicines: only those v1 counted as answered.
  const asked = answeredOnOpen(h);
  const classes: NonNullable<SetupAnswers['classes']> = {};
  if (asked.has('insulin')) classes.insulin = h.insulin === 'none' ? 'no' : h.insulin === 'unsure' ? 'unsure' : 'yes';
  if (asked.has('sulfonylurea')) classes.lowsTablet = tri(h.sulfonylureaOrMeglitinide);
  if (asked.has('sglt2i')) classes.gliflozin = tri(h.sglt2i);
  if (asked.has('metformin')) classes.metformin = tri(h.metformin);
  if (asked.has('betaBlocker')) classes.betaBlocker = tri(h.betaBlocker);
  if (asked.has('diuretic')) classes.diuretic = tri(h.diuretic);
  if (Object.keys(classes).length > 0) {
    a.classes = classes;
    if (Object.values(classes).some(v => v === 'yes' || v === 'unsure')) a.regular = 'yes';
  }
  if (h.metforminSince) a.metforminSince = h.metforminSince.slice(0, 4);
  if (asked.has('priorDka') && h.priorDkaOrInsulinDeficiency !== undefined) a.priorDka = tri(h.priorDkaOrInsulinDeficiency);
  if (asked.has('insulin') && h.insulin !== 'none') {
    a.insulinHow = h.insulin === 'automated_delivery' ? 'closedLoop' : h.insulin === 'unsure' ? 'unsure' : h.insulinRegimen ?? 'unsure';
  }
  if (d.hypoRisk) a.lowsRisk = h.highHypoRisk ? 'yes' : 'no';
  if (t?.glucoseStartMin !== undefined) { a.glucoseStartMin = t.glucoseStartMin; a.glucoseStartUnit = t.glucoseStartUnit ?? 'mg/dL'; }
  if (d.ketoneRisk) a.ketoneTest = h.ketoneTest;
  // "Anything else?", with dizziness, was asked of everyone.
  a.dizzy = h.dizzyOnStandingOrAutonomicNeuropathy ? 'yes' : 'no';
  if (d.diabetic) { a.glucoseMonitor = h.glucoseMonitor; a.glucoseUnit = h.glucoseUnit; }
  if (h.hypertension !== 'none') a.bpCuff = h.bpMonitor;

  // 5. Back and feet: v1's body step asked everyone.
  a.painAreas = [...p.pain.areas];
  if (p.pain.sciaticaSide) a.sciaticaSide = p.pain.sciaticaSide;
  if (p.pain.areas.some(x => x === 'lowerBack' || x === 'sciatica')) a.worseWith = p.pain.worseWith;
  if (p.pain.neuroHistory !== undefined) a.neuroHistory = tri(p.pain.neuroHistory);

  // 6. Movement.
  if (s.focus) a.focus = s.focus;
  a.active = h.currentlyActive ? 'yes' : 'no';
  if (s.weeklyMovementGoalMinutes !== undefined) a.weeklyGoal = s.weeklyMovementGoalMinutes;
  if (isEnrolled(s, p)) a.programme = 'joined';

  // 7. Food (the contract Plan 7 consumes, board D82).
  if (p.food) {
    a.pattern = p.food.pattern;
    if (p.food.allergies) a.allergies = [...p.food.allergies];
    if (p.food.customAllergies) a.customAllergies = [...p.food.customAllergies];
    if (p.food.level) a.foodLevel = p.food.level;
    if (p.food.hardBefore) a.hardBefore = p.food.hardBefore;
  }

  // 8. Your day and coach.
  const hb = s.habits;
  if (hb?.water) a.water = { on: hb.water.enabled, glassMl: hb.water.glassMl, everyMinutes: hb.water.everyMinutes, from: hb.water.from, to: hb.water.to };
  if (hb?.sittingBreak) a.sitting = { on: hb.sittingBreak.enabled, everyMinutes: hb.sittingBreak.everyMinutes, from: hb.sittingBreak.from, to: hb.sittingBreak.to };
  if (hb?.mealWalk) {
    a.mealWalk = { on: hb.mealWalk.enabled, meals: [...hb.mealWalk.meals] };
    if (hb.mealWalk.finish) a.mealFinish = { ...hb.mealWalk.finish };
  }
  if (hb?.quietHours) a.quiet = { ...hb.quietHours };
  if (hb?.inApp !== undefined) a.delivery = hb.inApp ? 'app' : 'calendar';
  a.voice = { muted: p.voice.muted, ...(p.voice.pack ? { pack: p.voice.pack } : {}) };
  return a;
}

/**
 * What setup starts from when nothing was drafted: what the record already
 * says (K-57, §6.4). An unreviewed profile's health, medicine and pain values
 * may be defaults nobody gave, so setup asks those again (contract H-DATA).
 */
export function prefillAnswers(settings: Kept, profile: UserProfile | undefined): SetupAnswers {
  if (!profile) return { metric: settings.useMetric, ...(settings.focus ? { focus: settings.focus } : {}) };
  const out = answersFromProfile(profile, settings);
  if (profile.needsHealthReview) for (const c of SAFETY_CHAPTERS) for (const k of keysOfChapter(c)) delete out[k];
  return out;
}

const read = (o: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((x, k) => (x !== null && typeof x === 'object' ? (x as Record<string, unknown>)[k] : undefined), o);

/**
 * The answers Me edits a chapter with (§16): the stored ones while, chapter
 * by chapter, they still give the record as it is. A chapter whose fields
 * were changed somewhere else since (a fluid limit set in Reminders, say)
 * takes what the record says now. So "Not sure" survives, and an edit made
 * elsewhere is never undone.
 */
export function answersToEdit(stored: SetupAnswers | undefined, p: UserProfile, s: UserSettings, today: string, ctx: Ctx): SetupAnswers {
  const out: SetupAnswers = answersFromProfile(p, s);
  if (stored) {
    const profile = profileFrom(stored, p, today, ctx);
    const record = { profile, settings: { ...s, ...settingsFrom(stored, s, profile, today) } };
    const current = { profile: p, settings: s };
    for (const chapter of CHAPTER_IDS) {
      if (!fieldsOfChapter(chapter).every(path => sameValue(read(record, path), read(current, path)))) continue;
      for (const key of keysOfChapter(chapter)) put(out, key, stored[key]);
    }
    if (stored.skippedPages) out.skippedPages = [...stored.skippedPages];
  }
  // Membership has one definition (D35): this answer always says what's true now.
  if (isEnrolled(s, p)) out.programme = 'joined';
  else if (out.programme === 'joined') delete out.programme;
  return out;
}
