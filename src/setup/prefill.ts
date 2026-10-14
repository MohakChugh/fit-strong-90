/**
 * The answers a stored record already gives, for setup's pages: a v1 Welcome
 * left part-way (K-57), a restored backup that never finished setting up
 * (§6.4), and Me's chapters for someone set up in v1 (§16). Only what v1
 * asked: it asked about the eyes and feet only with diabetes, so without it
 * those chips stay unanswered rather than read back as "No" (contract H-DATA,
 * board D79), unless the record holds a value there: that is read back
 * whatever the diabetes answer, so a Save never files "No" over it (K5-02).
 * A medicine answer counts only when v1 counted it (`answeredOnOpen`).
 */
import type { UserSettings } from '@/types';
import type { MedicineAnswer, UserProfile } from '@/types/profile';
import { CHAPTER_IDS, type SetupAnswers, type Tri } from '@/types/setup';
import { deriveHealth } from '@/engine/health';
import { answeredOnOpen } from '@/components/profile/wizardSteps';
import { isEnrolled } from '@/health/recommend';
import { fluidRestriction } from '@/reminders/water';
import { sameValue } from '@/store/transfer';
import { profileFrom, put, settingsFrom } from './assemble';
import { fieldsOfChapter, keysOfChapter } from './fields';
import { SAFETY_CHAPTERS, type Ctx } from './graph';

type Kept = Pick<UserSettings, 'useMetric' | 'focus' | 'weeklyMovementGoalMinutes' | 'habits' | 'startDate'> & Partial<Pick<UserSettings, 'setup'>>;

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

  // 3. Your health, as v1's health step asked it. Eyes and feet: with diabetes, or a value the record holds (K5-02).
  const eyesHeld = h.retinopathy !== 'none_or_mild';
  const feetHeld = h.peripheralNeuropathy !== 'no' || h.footStatus !== 'healthy';
  a.conditions = {
    diabetes: h.diabetes === 'none' ? 'no' : 'yes',
    bp: h.hypertension === 'none' ? 'no' : h.hypertension === 'unsure' ? 'unsure' : 'yes',
    heart: h.heartOrVascularDisease ? 'yes' : 'no',
    kidney: h.kidneyDisease === 'none' ? 'no' : h.kidneyDisease === 'unsure' ? 'unsure' : 'yes',
    pain: p.pain.areas.length > 0 ? 'yes' : 'no',
    ...(d.diabetic || eyesHeld ? { eyes: !eyesHeld ? 'no' : h.retinopathy === 'unknown' ? 'unsure' : 'yes' } as const : {}),
    ...(d.diabetic || feetHeld ? {
      feet: !feetHeld ? 'no' : h.peripheralNeuropathy === 'unsure' && h.footStatus === 'healthy' ? 'unsure' : 'yes',
    } as const : {}),
  };
  if (h.diabetes !== 'none') a.diabetesType = h.diabetes;
  if (h.hypertension === 'treated') a.bpMedicine = 'yes';
  else if (h.hypertension === 'untreated') a.bpMedicine = 'no';
  else if (h.hypertension === 'unsure') a.bpMedicine = 'unsure';
  if (h.kidneyDisease !== 'none') a.kidneyTreatment = h.kidneyDisease === 'dialysis_or_transplant' ? 'yes' : 'no';
  // An answer v1 kept in its reminders is still the answer (`fluidRestriction`, reminders/water.ts).
  const fluid = fluidRestriction(p, s.habits);
  if (fluid !== undefined) a.fluidLimit = tri(fluid);
  if (eyesHeld) {
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
  // How insulin is taken is v2's question: read back only where the record says it, else asked (K5R-07; board D195).
  if (asked.has('insulin') && h.insulin !== 'none') {
    const how = h.insulin === 'automated_delivery' ? 'closedLoop' : h.insulin === 'unsure' ? 'unsure' : h.insulinRegimen;
    if (how) a.insulinHow = how;
  }
  if (d.hypoRisk) a.lowsRisk = h.highHypoRisk ? 'yes' : 'no';
  if (t?.glucoseStartMin !== undefined) { a.glucoseStartMin = t.glucoseStartMin; a.glucoseStartUnit = t.glucoseStartUnit ?? 'mg/dL'; }
  // Ketone testing: v1 asked it with type 1 or an SGLT2 medicine, so only there is its answer v1's (K5R-07).
  if (d.ketoneRisk && (h.diabetes === 'type1' || h.sglt2i)) a.ketoneTest = h.ketoneTest;
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
 * An unreviewed profile's health, medicine and pain values may be defaults
 * nobody gave, so they're asked again, never shown as answers (contract
 * H-DATA). So is whether the person exercises now: its default "Yes" would
 * skip the engine's light-work rule for the inactive (H5-11). The same rule
 * for setup and for Me's review (H5-10, K5-01).
 */
const UNREVIEWED: readonly (keyof SetupAnswers)[] = [...SAFETY_CHAPTERS.flatMap(keysOfChapter), 'active'];
const withoutClinical = (out: SetupAnswers): SetupAnswers => {
  for (const k of UNREVIEWED) delete out[k];
  return out;
};
function withoutUnreviewed(out: SetupAnswers, profile: UserProfile): SetupAnswers {
  return profile.needsHealthReview ? withoutClinical(out) : out;
}

/** What setup starts from when nothing was drafted: what the record already says (K-57, §6.4), less what an unreviewed profile can't vouch for. */
export function prefillAnswers(settings: Kept, profile: UserProfile | undefined): SetupAnswers {
  if (!profile) {
    const base = { metric: settings.useMetric, ...(settings.focus ? { focus: settings.focus } : {}) };
    // Setup answers a backup kept when its health or pain answers couldn't be read: the rest carry on, those are asked again (H5-17).
    const kept = settings.setup?.answers;
    return kept ? { ...base, ...withoutClinical(structuredClone(kept)) } : base;
  }
  return withoutUnreviewed(answersFromProfile(profile, settings), profile);
}

const read = (o: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((x, k) => (x !== null && typeof x === 'object' ? (x as Record<string, unknown>)[k] : undefined), o);

/**
 * The answers Me edits a chapter with (§16): the stored ones while, chapter
 * by chapter, they still give the record as it is. A chapter whose fields
 * were changed somewhere else since (a fluid limit set in Reminders, say)
 * takes what the record says now. So "Not sure" survives, and an edit made
 * elsewhere is never undone. An answer the stored ones lack keeps what the
 * record says (H5-01): a lost diabetes chip must not leave insulin added
 * later without its lows questions. A pending review asks its questions again.
 */
export function answersToEdit(stored: SetupAnswers | undefined, p: UserProfile, s: UserSettings, today: string, ctx: Ctx): SetupAnswers {
  const out: SetupAnswers = answersFromProfile(p, s);
  if (stored) {
    const profile = profileFrom(stored, p, today, ctx);
    const record = { profile, settings: { ...s, ...settingsFrom(stored, s, profile, today) } };
    const current = { profile: p, settings: s };
    for (const chapter of CHAPTER_IDS) {
      if (!fieldsOfChapter(chapter).every(path => sameValue(read(record, path), read(current, path)))) continue;
      for (const key of keysOfChapter(chapter)) if (stored[key] !== undefined) put(out, key, stored[key]);
    }
    if (stored.skippedPages) out.skippedPages = [...stored.skippedPages];
  }
  withoutUnreviewed(out, p);
  // Membership has one definition (D35): this answer always says what's true now.
  if (isEnrolled(s, p)) out.programme = 'joined';
  else if (out.programme === 'joined') delete out.programme;
  return out;
}
