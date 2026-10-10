/**
 * Target bands and interpretation, each with the framework it comes from.
 *
 * Every number here is from docs/research/clinical-tracking-protocols.md, and
 * every sentence names its source: two frameworks that disagree (NICE and ADA
 * on blood pressure, RSSDI and ICMR-NIN on BMI) are named side by side rather
 * than blended into a consensus nobody published.
 *
 * Interpretation judges the value itself — in the display unit, unrounded —
 * against the bounds the framework publishes in that unit (ADA states
 * 80–130 mg/dL *and* 4.4–7.2 mmol/L). The figure beside a label is then shown
 * so it never crosses a bound it is judged against (`displayBoundaries`, and
 * `safeDecimals` in units.ts): 179.9 pg/mL is a deficiency, shown as 179.9,
 * never as a "180" in the next band (acceptance J06). HbA1c alone is judged
 * as labs report it, the convention the testing cadence shares. The safety
 * escalation compares unrounded mg/dL too (D29), and lives in escalation.ts.
 */

import type { ObservationTag } from '@/health/observation';
import { HBA1C_CADENCE_CITATION, clinicianHba1cGoal } from '@/health/cadence';
import { fluidRestriction, waterBlock } from '@/reminders/water';
import type { HabitSettings } from '@/types/habits';
import type { HealthProfile, UserProfile } from '@/types/profile';
import { EXTREME_GLUCOSE_MGDL, HYPO_LEVEL_1_MGDL, HYPO_LEVEL_2_MGDL } from './escalation';
import {
  CM_PER_IN, KG_PER_LB, MGDL_PER_MMOL, PMOL_PER_PG_B12, convert, decimalsFor, formatNumber, glucoseMgdl, roundTo,
  type Boundary, type GlucoseUnit, type LengthUnit, type MassUnit,
} from './units';

export type Tone = 'default' | 'caution' | 'stop';

export interface Interpretation {
  text: string;
  tone: Tone;
  /** The guideline, as a person would look it up. */
  framework: string;
}

/** What a chart draws for reference, in the chart's own unit. */
export interface Reference {
  band?: { from: number; to: number; label: string };
  target?: { value: number; label: string };
  framework: string;
}

/**
 * A clinician's own targets. When present they replace the defaults, and the
 * label says whose target it is. Glucose values are in mg/dL.
 */
export interface TargetOverrides {
  glucoseBeforeMeal?: { min: number; max: number };
  glucoseAfterMealMax?: number;
  pressureHome?: { systolic: number; diastolic: number };
  hba1cBelowPercent?: number;
}

/**
 * The care team's own goals, where the profile holds them: the same validated
 * HbA1c goal the testing cadence uses (`clinicianHba1cGoal`), so the chart,
 * its note and the reading's own screen never judge a result against a
 * different goal from the one that set the next test (F04).
 */
export function clinicianOverrides(profile: UserProfile | undefined): TargetOverrides | undefined {
  const hba1c = profile ? clinicianHba1cGoal(profile) : undefined;
  return hba1c !== undefined ? { hba1cBelowPercent: hba1c } : undefined;
}

const ADA_GLUCOSE = 'ADA Standards of Care 2026, Table 6.3';
const ADA_LOWS = 'ADA Standards of Care 2026, Table 6.4';
const CLINICIAN = 'Set by your clinician';

// ============================================================================
// Glucose
// ============================================================================

/** The three groups a glucose reading is judged in. Fasting uses the before-meal target. */
export type GlucoseGroup = 'beforeMeal' | 'afterMeal' | 'other';

export function glucoseGroup(tag: ObservationTag | undefined): GlucoseGroup {
  if (tag === 'fasting' || tag === 'beforeMeal') return 'beforeMeal';
  if (tag === 'afterMeal') return 'afterMeal';
  return 'other';
}

/** ADA publishes each bound in both units; these are its own figures, not conversions. */
const BEFORE_MEAL = { 'mg/dL': { min: 80, max: 130 }, 'mmol/L': { min: 4.4, max: 7.2 } } as const;
const AFTER_MEAL_MAX = { 'mg/dL': 180, 'mmol/L': 10.0 } as const;
/** How ADA writes the low boundaries in each unit (Table 6.4). */
const LOW_1_SHOWN = { 'mg/dL': '70 mg/dL', 'mmol/L': '3.9 mmol/L' } as const;
const LOW_2_SHOWN = { 'mg/dL': '54 mg/dL', 'mmol/L': '3.0 mmol/L' } as const;

function inUnit(mgdl: number, unit: GlucoseUnit): number {
  return unit === 'mg/dL' ? mgdl : mgdl / MGDL_PER_MMOL;
}

/** A glucose figure at its reading precision, without the unit. */
function figure(value: number, unit: GlucoseUnit): string {
  return formatNumber(value, decimalsFor('glucose', unit));
}

function beforeMealBounds(unit: GlucoseUnit, overrides?: TargetOverrides): { min: number; max: number; label: string; framework: string } {
  const own = overrides?.glucoseBeforeMeal;
  if (own) {
    return { min: inUnit(own.min, unit), max: inUnit(own.max, unit), label: 'Your clinician’s target before meals', framework: CLINICIAN };
  }
  return { ...BEFORE_MEAL[unit], label: 'ADA target before meals', framework: ADA_GLUCOSE };
}

function afterMealBound(unit: GlucoseUnit, overrides?: TargetOverrides): { max: number; label: string; framework: string } {
  const own = overrides?.glucoseAfterMealMax;
  if (own !== undefined) {
    return { max: inUnit(own, unit), label: 'Your clinician’s limit after meals', framework: CLINICIAN };
  }
  return { max: AFTER_MEAL_MAX[unit], label: 'ADA limit after meals', framework: ADA_GLUCOSE };
}

/** What a glucose chart draws for one group. Nothing for "other": ADA sets no target there. */
export function glucoseReference(group: GlucoseGroup, unit: GlucoseUnit, overrides?: TargetOverrides): Reference | undefined {
  if (group === 'beforeMeal') {
    const b = beforeMealBounds(unit, overrides);
    return { band: { from: b.min, to: b.max, label: b.label }, framework: b.framework };
  }
  if (group === 'afterMeal') {
    const a = afterMealBound(unit, overrides);
    return { target: { value: a.max, label: a.label }, framework: a.framework };
  }
  return undefined;
}

/**
 * Minutes from the start of the meal to the reading. ADA times the after-meal
 * peak from the first mouthful, 1 to 2 hours on.
 */
export function minutesAfterMealStart(at: string, mealStartedAt: string): number {
  return Math.round((Date.parse(at) - Date.parse(mealStartedAt)) / 60_000);
}

/**
 * One glucose reading, judged against the target for its time of day.
 * `value` is in `unit`, the unit it is being shown in.
 *
 * The low and extreme labels use the escalation's own test — unrounded mg/dL,
 * the contract's operators — so a reading the escalation calls a low is never
 * labelled anything else here. Targets use the shown figure (see top of file).
 */
export function interpretGlucose(
  value: number,
  unit: GlucoseUnit,
  tag: ObservationTag | undefined,
  timing: { at?: string; mealStartedAt?: string } = {},
  overrides?: TargetOverrides,
): Interpretation {
  const mg = glucoseMgdl(value, unit);
  if (mg >= EXTREME_GLUCOSE_MGDL) {
    return { text: 'Extremely high: at this level ADA guidance is to get emergency care.', tone: 'stop', framework: 'ADA Standards of Care 2026, Table 16.1' };
  }
  if (mg < HYPO_LEVEL_2_MGDL) {
    return { text: `A serious low (ADA level 2): under ${LOW_2_SHOWN[unit]}.`, tone: 'stop', framework: ADA_LOWS };
  }
  if (mg < HYPO_LEVEL_1_MGDL) {
    return { text: `A low (ADA level 1): under ${LOW_1_SHOWN[unit]}.`, tone: 'caution', framework: ADA_LOWS };
  }

  const group = glucoseGroup(tag);

  if (group === 'beforeMeal') {
    const b = beforeMealBounds(unit, overrides);
    const where = value < b.min ? 'Below' : value > b.max ? 'Above' : 'Within';
    const whose = b.framework === CLINICIAN ? 'your clinician’s target before meals' : 'the ADA target before meals';
    return { text: `${where} ${whose}, ${figure(b.min, unit)} to ${figure(b.max, unit)} ${unit}.`, tone: 'default', framework: b.framework };
  }

  if (group === 'afterMeal') {
    const a = afterMealBound(unit, overrides);
    const whose = a.framework === CLINICIAN ? 'your clinician’s limit after meals' : 'the ADA limit after meals';
    const limit = `${figure(a.max, unit)} ${unit}`;
    const verdict = value < a.max ? `Under ${whose}, ${limit}.` : `At or above ${whose}, ${limit}.`;
    let timingNote = ' The meal’s start time was not recorded; the limit is for 1 to 2 hours after it.';
    if (timing.at && timing.mealStartedAt) {
      const minutes = minutesAfterMealStart(timing.at, timing.mealStartedAt);
      timingNote = minutes >= 60 && minutes <= 120
        ? ` Taken ${minutes} minutes after the meal started.`
        : ` Taken ${minutes} minutes after the meal started; the limit is for 1 to 2 hours after it, so this is only a rough comparison.`;
    }
    return { text: verdict + timingNote, tone: 'default', framework: a.framework };
  }

  if (tag === undefined) {
    return { text: 'No time of day was recorded, so this reading is not compared with a target.', tone: 'default', framework: ADA_GLUCOSE };
  }
  return { text: 'ADA does not set a target for readings at this time.', tone: 'default', framework: ADA_GLUCOSE };
}

// ============================================================================
// Blood pressure
// ============================================================================

export interface PressureReference {
  systolic: number;
  diastolic: number;
  label: string;
  framework: string;
  /** How the threshold is meant to be used, said once beside the chart. */
  note: string;
}

/**
 * The age that decides a target, from a birth year alone: the younger of the
 * two ages the person could be. Someone born in 1946 is 79 or 80 in 2026, and
 * the looser target for 80 and over must not reach a 79-year-old a year early.
 */
export function ageForTargets(birthYear: number | undefined, current: string): number | undefined {
  return birthYear === undefined ? undefined : Number(current.slice(0, 4)) - birthYear - 1;
}

/**
 * The home threshold to draw. NICE NG136 uses 135/85 at home (not the clinic's
 * 140/90). For people 80 and over who are treated, NICE's home target is
 * under 145/85. A clinician's own figure replaces both.
 */
export function pressureReference(
  age: number | undefined,
  hypertension: HealthProfile['hypertension'] | undefined,
  overrides?: TargetOverrides,
): PressureReference {
  const note = 'NICE judges home blood pressure on the average of readings over 4 to 7 days, not on one reading.';
  const own = overrides?.pressureHome;
  if (own) {
    return { systolic: own.systolic, diastolic: own.diastolic, label: `Your clinician’s target, under ${own.systolic}/${own.diastolic}`, framework: CLINICIAN, note };
  }
  if (age !== undefined && age >= 80 && hypertension === 'treated') {
    return { systolic: 145, diastolic: 85, label: 'NICE home target for 80 and over, under 145/85', framework: 'NICE NG136, recommendations 1.4.21 and 1.4.22', note };
  }
  return { systolic: 135, diastolic: 85, label: 'NICE home threshold, 135/85', framework: 'NICE NG136, recommendations 1.2.8 and 1.4.20', note };
}

/** Only a severe reading gets a verdict on its own; NICE's thresholds are for averages. */
export function interpretPressure(systolic: number, diastolic: number): Interpretation | undefined {
  if (systolic >= 180 || diastolic >= 120) {
    return { text: 'Very high: a top number of 180 or more, or a bottom number of 120 or more, needs a re-check and a call to your doctor today.', tone: 'stop', framework: 'NICE NG136, recommendation 1.5.1' };
  }
  return undefined;
}

// ============================================================================
// Weight, BMI and waist
// ============================================================================

export type BmiCategory = 'underweight' | 'healthy' | 'overweight' | 'obesity';

/** BMI from kilograms and centimetres, unrounded (ICMR-NIN 2024, Guideline 9). */
export function bmiOf(weightKg: number, heightCm: number): number | undefined {
  if (!(weightKg > 0) || !(heightCm > 0)) return undefined;
  const metres = heightCm / 100;
  return weightKg / (metres * metres);
}

/**
 * BMI to one decimal, cut rather than rounded. RSSDI's bounds are one-decimal
 * (18, 23, 25), and cutting keeps the shown figure on the same side of a
 * bound as the unrounded value: 22.97 shows as 22.9, in the healthy range,
 * never as a "23.0" in the healthy range.
 */
export function bmiShown(bmi: number): number {
  return Math.floor(bmi * 10 + 1e-9) / 10;
}

/**
 * RSSDI-ESI 2020, Indian adults: under 18, 18 to 22.9, 23 to 24.9, 25 or more.
 * (18.5 is the WHO and ICMR-NIN lower bound, not RSSDI's; the Guide sets the
 * two side by side.)
 */
export function rssdiCategory(bmi: number): BmiCategory {
  if (bmi < 18) return 'underweight';
  if (bmi < 23) return 'healthy';
  if (bmi < 25) return 'overweight';
  return 'obesity';
}

const RSSDI = 'RSSDI-ESI 2020 Indian cut-offs';

export function interpretBmi(bmi: number): Interpretation {
  const phrase: Record<BmiCategory, string> = {
    underweight: 'below the healthy range (under 18)',
    healthy: 'in the healthy range (18 to 22.9)',
    overweight: 'in the overweight range (23 to 24.9)',
    obesity: 'in the obesity range (25 or more)',
  };
  return {
    text: `BMI ${formatNumber(bmiShown(bmi), 1)}: ${phrase[rssdiCategory(bmi)]} on the Indian cut-offs.`,
    tone: 'default',
    framework: RSSDI,
  };
}

/** Said with any BMI, so no single framework is shown as the only answer. */
export const BMI_FRAMEWORKS_NOTE =
  'ICMR-NIN 2024 uses over 23 to 27.5 for overweight and above 27.5 for obesity. WHO’s international cut-offs, 25 and 30, can understate risk for Indian adults. BMI alone does not describe your health.';

/** The weights that give a BMI of 18 to under 23 (RSSDI) at this height, in the chart's unit. */
export function healthyWeightBand(heightCm: number, unit: MassUnit): Reference | undefined {
  if (!(heightCm > 0)) return undefined;
  const m2 = (heightCm / 100) ** 2;
  const toUnit = (kg: number) => (unit === 'kg' ? kg : kg / KG_PER_LB);
  return {
    band: { from: toUnit(18 * m2), to: toUnit(23 * m2), label: 'Weight for a BMI of 18 to 22.9' },
    framework: RSSDI,
  };
}

const waistCm = (cm: number, unit: LengthUnit) => (unit === 'cm' ? `${cm} cm` : `${formatNumber(cm / CM_PER_IN, 1)} in`);

/** Waist has no single line without knowing sex, which the profile does not hold; both are stated. */
export function waistNote(unit: LengthUnit): Interpretation {
  return {
    text: `On the Indian cut-offs, abdominal risk rises at ${waistCm(90, unit)} or more for men and ${waistCm(80, unit)} or more for women.`,
    tone: 'default',
    framework: RSSDI,
  };
}

/**
 * Said with the waist note, as BMI's is: ICMR-NIN 2024 (Guideline 9) draws
 * the same lines strictly, so the two differ only at the line itself.
 */
export function waistFrameworksNote(unit: LengthUnit): string {
  return `ICMR-NIN 2024 uses more than ${waistCm(90, unit)} for men and more than ${waistCm(80, unit)} for women, so a waist exactly at the line meets RSSDI’s cut-off but not NIN’s.`;
}

// ============================================================================
// Lab results
// ============================================================================

const ADA_HBA1C = 'ADA Standards of Care 2026, recommendation 6.3a';

export function hba1cReference(unit: '%' | 'mmol/mol', overrides?: TargetOverrides): Reference {
  const own = overrides?.hba1cBelowPercent;
  if (own !== undefined) {
    const value = unit === '%' ? own : roundTo(convert('hba1c', own, '%', 'mmol/mol'), 0);
    return { target: { value, label: `Your clinician’s goal, under ${unit === '%' ? `${own}%` : `${value} mmol/mol`}` }, framework: CLINICIAN };
  }
  return unit === '%'
    ? { target: { value: 7, label: 'ADA goal for many adults, under 7%' }, framework: ADA_HBA1C }
    : { target: { value: 53, label: 'ADA goal for many adults, under 53 mmol/mol' }, framework: ADA_HBA1C };
}

export function interpretHba1c(value: number, unit: '%' | 'mmol/mol', overrides?: TargetOverrides): Interpretation {
  const ref = hba1cReference(unit, overrides);
  const goal = ref.target!.value;
  const shown = roundTo(value, decimalsFor('hba1c', unit));
  const figure = unit === '%' ? `${formatNumber(goal, Number.isInteger(goal) ? 0 : 1)}%` : `${goal} mmol/mol`;
  const whose = ref.framework === CLINICIAN ? 'your clinician’s goal' : 'the ADA goal for many adults';
  if (shown < goal) {
    return {
      text: `Under ${figure}, ${whose}.${ref.framework === CLINICIAN ? '' : ' Your clinician may set a different goal for you.'}`,
      tone: 'default',
      framework: ref.framework,
    };
  }
  return {
    text: `At or above ${figure}, ${whose}. It is a long-term measure to review with your clinician, not an emergency.`,
    tone: 'default',
    framework: ref.framework,
  };
}

/** Where the HbA1c testing cadence comes from — the words Today cites (health/cadence.ts). */
export const HBA1C_CADENCE_SOURCE = HBA1C_CADENCE_CITATION;

/** ADA recommendation 6.2. */
export const HBA1C_CADENCE =
  'ADA suggests testing at least twice a year when stable, and about every 3 months when not at goal or after a treatment change.';

const NICE_B12 = 'NICE NG239, Table 1';

/** B12 in pg/mL (= ng/L, NICE's unit), unrounded. */
function b12Canonical(value: number, unit: 'pg/mL' | 'pmol/L'): number {
  return unit === 'pg/mL' ? value : value / PMOL_PER_PG_B12;
}

export function b12Reference(unit: 'pg/mL' | 'pmol/L'): Reference {
  const value = unit === 'pg/mL' ? 350 : 350 * PMOL_PER_PG_B12;
  return {
    target: { value, label: unit === 'pg/mL' ? '350, above which NICE says deficiency is unlikely' : 'about 258, above which NICE says deficiency is unlikely' },
    framework: NICE_B12,
  };
}

/**
 * Total serum B12 against NICE NG239: under 180 ng/L confirmed deficiency,
 * 180 to 350 indeterminate (350 itself included), above 350 unlikely.
 */
export function interpretB12(value: number, unit: 'pg/mL' | 'pmol/L'): Interpretation {
  const pg = b12Canonical(value, unit);
  const scale = unit === 'pg/mL' ? 'pg/mL' : 'pg/mL (about 133 and 258 pmol/L)';
  const lab = ' Your lab’s own reference range comes first.';
  if (pg < 180) {
    return { text: `Under 180 ${scale}: NICE treats this as deficiency. Talk to your clinician.${lab}`, tone: 'caution', framework: NICE_B12 };
  }
  if (pg <= 350) {
    return { text: `Between 180 and 350 ${scale}: NICE calls this indeterminate, and your clinician may check further.${lab}`, tone: 'default', framework: NICE_B12 };
  }
  return { text: `Above 350 ${scale}: NICE says deficiency is unlikely.${lab}`, tone: 'default', framework: NICE_B12 };
}

const ODS_D = 'NIH Office of Dietary Supplements, Vitamin D, Table 1';

/** NIH ODS publishes both scales: 12/20/50 ng/mL and 30/50/125 nmol/L. */
const VITD = { 'ng/mL': { deficient: 12, adequate: 20, high: 50 }, 'nmol/L': { deficient: 30, adequate: 50, high: 125 } } as const;

export function vitaminDReference(unit: 'ng/mL' | 'nmol/L'): Reference {
  const b = VITD[unit];
  return { band: { from: b.adequate, to: b.high, label: 'NIH’s adequate range for most people' }, framework: ODS_D };
}

/** 25(OH)D against NIH ODS: the high band overrides "adequate", so 60 ng/mL is never simply reassuring. */
export function interpretVitaminD(value: number, unit: 'ng/mL' | 'nmol/L'): Interpretation {
  const b = VITD[unit];
  if (value < b.deficient) {
    return { text: `Under ${b.deficient} ${unit}: NIH links this to a risk of deficiency. Talk to your clinician.`, tone: 'caution', framework: ODS_D };
  }
  if (value < b.adequate) {
    return { text: `${b.deficient} to under ${b.adequate} ${unit}: generally inadequate, by NIH’s figures.`, tone: 'default', framework: ODS_D };
  }
  if (value <= b.high) {
    return { text: `${b.adequate} to ${b.high} ${unit}: adequate for most people, by NIH’s figures.`, tone: 'default', framework: ODS_D };
  }
  return { text: `Above ${b.high} ${unit}: NIH notes possible harm at this level. Review any supplements with your clinician.`, tone: 'caution', framework: ODS_D };
}

// ============================================================================
// Habits
// ============================================================================

/**
 * Whether general water advice must give way: a fluid limit, an unsure answer,
 * a condition that can need one, or health answers not yet reviewed. The same
 * rule the water reminders follow (`waterBlock`, reminders/water.ts), so Track
 * never encourages what reminders have been silenced for (F05).
 */
export function waterAdviceBlocked(profile: UserProfile | undefined, habits: HabitSettings | undefined): boolean {
  return waterBlock(profile, habits) !== undefined;
}

/**
 * Water: a person's own goal, never a default prescription. ICMR-NIN's general
 * figure is given only when nothing calls for a fluid limit; otherwise the
 * care team's plan comes first and no amount is suggested (clinical
 * protocols, Hydration; NIH NIDDK on fluids in kidney disease).
 */
export function waterNote(profile: UserProfile | undefined, habits: HabitSettings | undefined): Interpretation {
  const limit = fluidRestriction(profile, habits);
  const framework = 'Your care team’s fluid advice comes first (NIH NIDDK)';
  if (limit === true) {
    return { text: 'Your care team has asked you to limit fluids: follow the plan they gave you. The app does not suggest an amount.', tone: 'default', framework };
  }
  if (limit === 'unsure') {
    return { text: 'Ask your care team whether you should limit fluids before aiming for any amount. The app does not suggest one.', tone: 'default', framework };
  }
  if (waterBlock(profile, habits) !== undefined) {
    return { text: 'Some conditions, such as kidney disease or heart failure, need a fluid limit, so how much to drink is for your care team to advise. The app does not suggest an amount.', tone: 'default', framework };
  }
  return {
    text: 'ICMR-NIN describes about 2 litres a day from all drinks for a healthy adult. Heat, activity and illness change what you need.',
    tone: 'default',
    framework: 'ICMR-NIN Dietary Guidelines for Indians 2024',
  };
}

export const STEPS_NOTE: Interpretation = {
  text: 'No guideline sets a required daily step count. Starting small and building up gradually is what WHO advises.',
  tone: 'default',
  framework: 'WHO 2020 physical activity guidelines',
};

/**
 * The thresholds a shown value of `kind`, in `unit`, is judged against, for
 * showing it without crossing one (`safeDecimals`): the glucose lows and
 * extreme (judged in unrounded mg/dL), the ADA targets in the unit, and the
 * B12 and vitamin D bands. HbA1c is judged as shown, so it needs none.
 */
export function displayBoundaries(kind: string, unit: string): Boundary[] {
  if (kind === 'glucose') {
    const perMgdl = unit === 'mmol/L' ? 1 / MGDL_PER_MMOL : 1;
    const g: GlucoseUnit = unit === 'mmol/L' ? 'mmol/L' : 'mg/dL';
    return [
      { value: HYPO_LEVEL_2_MGDL * perMgdl, op: 'lt' },
      { value: HYPO_LEVEL_1_MGDL * perMgdl, op: 'lt' },
      { value: EXTREME_GLUCOSE_MGDL * perMgdl, op: 'lt' },
      { value: BEFORE_MEAL[g].min, op: 'lt' },
      { value: BEFORE_MEAL[g].max, op: 'le' },
      { value: AFTER_MEAL_MAX[g], op: 'lt' },
    ];
  }
  if (kind === 'b12') {
    const per = unit === 'pmol/L' ? PMOL_PER_PG_B12 : 1;
    return [{ value: 180 * per, op: 'lt' }, { value: 350 * per, op: 'le' }];
  }
  if (kind === 'vitaminD' && (unit === 'ng/mL' || unit === 'nmol/L')) {
    const b = VITD[unit];
    return [{ value: b.deficient, op: 'lt' }, { value: b.adequate, op: 'lt' }, { value: b.high, op: 'le' }];
  }
  return [];
}

/** Every interpretive line carries this, near the line itself. */
export const NOT_ADVICE = 'General information, not medical advice.';
