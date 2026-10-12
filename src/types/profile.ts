/**
 * The user profile: schedule, goals, pain history and the health facts that
 * change exercise rules. Stored only on the device (spec §10.2).
 */

import type { DayOfWeek, Difficulty } from './index';
import type { LadderLevel, MobilityRegion } from './catalog';

export type PainArea =
  | 'lowerBack'
  | 'sciatica'
  | 'neck'
  | 'shoulder'
  | 'hip'
  | 'knee'
  | 'hamstring'
  | 'calf';

export type Side = 'left' | 'right' | 'both';

export type EquipmentAccess = 'fullGym' | 'homeDumbbells' | 'homeNone';

export type Goal = 'strong' | 'lean' | 'flexible' | 'athletic' | 'painFreeBack';

export type SessionMinutes = 45 | 60 | 75;

/**
 * A medicine answer. `'unsure'` is kept as it was said, so the profile can
 * show it, and every safety rule treats it as yes.
 */
export type MedicineAnswer = boolean | 'unsure';

/** Health facts from diabetes-hypertension-exercise.md §4 and clinical-tracking-protocols.md. */
export interface HealthProfile {
  diabetes: 'none' | 'prediabetes' | 'type1' | 'type2' | 'other';
  /** `'unsure'` is treated as insulin. */
  insulin: 'none' | 'injections_or_pump' | 'automated_delivery' | 'unsure';
  /** How insulin is taken, when it is. Sets the monitoring cadence; never a dose. */
  insulinRegimen?: 'basalOnly' | 'multipleDaily' | 'pump';
  sulfonylureaOrMeglitinide: MedicineAnswer;
  sglt2i: MedicineAnswer;
  /** Metformin. With `metforminSince`, drives the vitamin B12 check cadence (ADA 3.10). */
  metformin?: MedicineAnswer;
  /** When metformin was started, as `YYYY` or `YYYY-MM`. */
  metforminSince?: string;
  /** Has had diabetic ketoacidosis, or been told the body makes too little insulin (contract H-HIGH-UNCHECKED). */
  priorDkaOrInsulinDeficiency?: MedicineAnswer;
  /**
   * The medicine answers above were actually given. Absent on every profile
   * saved before this question existed, which reads as "not yet reviewed":
   * an untouched default must never look like "no insulin" (contract H-DATA).
   */
  medicinesReviewed?: boolean;
  /** Impaired awareness of lows, or a severe low in the past 6 months. */
  highHypoRisk: boolean;
  hypertension: 'none' | 'treated' | 'untreated' | 'unsure';
  /** `'unsure'` is treated as taking it. */
  betaBlocker: MedicineAnswer;
  /** `'unsure'` is treated as taking it. */
  diuretic: MedicineAnswer;
  /**
   * The blood-pressure medicine answers above were actually given. Absent on
   * every profile saved before this question existed, which reads as "not yet
   * reviewed": an untouched default must never look like "no beta-blocker"
   * (contract H-DATA).
   */
  bpMedicinesReviewed?: boolean;
  heartOrVascularDisease: boolean;
  kidneyDisease: 'none' | 'ckd' | 'dialysis_or_transplant' | 'unsure';
  /**
   * A fluid limit the care team prescribed, for any reason (kidney, heart failure,
   * other). Generic "drink more" advice and water reminders are withheld when
   * true or unsure. Absent means not asked yet (Codex re-audit F13).
   */
  fluidRestriction?: MedicineAnswer;
  retinopathy: 'none_or_mild' | 'moderate' | 'severe_or_proliferative' | 'recent_eye_treatment' | 'unknown';
  peripheralNeuropathy: 'no' | 'yes' | 'unsure';
  footStatus: 'healthy' | 'past_ulcer_or_charcot' | 'current_wound_or_active_charcot';
  dizzyOnStandingOrAutonomicNeuropathy: boolean;
  glucoseMonitor: 'none' | 'meter' | 'cgm';
  glucoseUnit: 'mg/dL' | 'mmol/L';
  ketoneTest: 'none' | 'urine' | 'blood';
  bpMonitor: boolean;
  /** ≥ 30 min moderate activity on ≥ 3 days a week for ≥ 3 months (ACSM). */
  currentlyActive: boolean;
  clearance: 'none' | 'moderate' | 'vigorous';
  clinicianTargets?: {
    /** The lowest glucose the care team says exercise may start at, in `glucoseStartUnit`. */
    glucoseStartMin?: number;
    /** Unit of `glucoseStartMin`. Absent means mg/dL, the only unit older profiles used. */
    glucoseStartUnit?: 'mg/dL' | 'mmol/L';
    /** A resting systolic at or above which the clinician says not to exercise. */
    bpStopSystolic?: number;
    /** The HbA1c the care team set, in %. ADA's <7% applies when absent; many people are rightly set a looser one. */
    hba1cPercent?: number;
  };
  /**
   * A clinician has said exercise is fine with resting readings up to this
   * level. It lifts the app's above-160/100 hold only; a severe reading
   * (180/120 or higher) still stops every session.
   */
  bpExercisePermission?: { sys: number; dia: number; recordedOn?: string };
}

export interface PainProfile {
  areas: PainArea[];
  sciaticaSide?: Side;
  /** What the user reports makes it worse (onboarding question). */
  worseWith: 'flexion' | 'extension' | 'unknown';
  /** Confirmed directional preference: which direction eases symptoms. */
  preference: 'extension' | 'flexion' | 'none' | 'untested';
  /**
   * v2: a doctor once said a nerve in the back or leg was damaged (foot drop,
   * say). Read by Home's default tiles and the summary only: the engine reads
   * today's symptoms instead (D29(2), board D77). `'unsure'` is kept as it was said.
   */
  neuroHistory?: MedicineAnswer;
}

export interface LadderState {
  hinge: LadderLevel;
  squat: LadderLevel;
  /** G5 cleared: straight-leg raise and kickstand hinge don't reproduce leg symptoms. */
  neuralGate: boolean;
  /** Date (YYYY-MM-DD) of the last promotion or demotion. */
  changedOn?: string;
}

export interface VoiceSettings {
  /** Pre-recorded neural voice pack id (public/voice/<pack>/). */
  pack?: string;
  voiceURI?: string;
  voiceName?: string;
  /** Speech rate, 0.8–1.1. */
  rate: number;
  verbosity: 'auto' | 'detailed' | 'standard' | 'minimal';
  /** Coach mode pauses music; overMusic mixes with it. */
  mode: 'coach' | 'overMusic';
  muted: boolean;
  /** Set after the first-session voice check. */
  checked: boolean;
}

export interface UserProfile {
  version: 1;
  weightKg: number;
  heightCm?: number;
  birthYear?: number;
  experience: Difficulty;
  trainingDays: DayOfWeek[];
  sessionMinutes: SessionMinutes;
  equipment: EquipmentAccess;
  goals: Goal[];
  pain: PainProfile;
  health: HealthProfile;
  ladder: LadderState;
  /** 2–3 regions to prioritise for flexibility this 12-week block. */
  flexibilityTargets: MobilityRegion[];
  /** Exercise ids the user swapped away from; the planner avoids them. */
  dislikes: string[];
  restDayMobility: boolean;
  voice: VoiceSettings;
  /** Body shown in the 3D form demos. */
  figure?: 'male' | 'female';
  /** Set after migration until the user completes the health screen. */
  needsHealthReview?: boolean;
  /** Asked the first time meal ideas are opened, not during exercise setup. */
  food?: FoodPreferences;
  /** v2: what to call the person, on screen only. The voice coach never says it (journey §6.2). */
  name?: string;
  /** v2: the latest waist in cm. Each change is also a dated `waist` reading (journey §18.1). */
  waistCm?: number;
  /**
   * Only on the profile a gate reads, while answers are on their way (setup
   * unfinished, a save in Me pending or refused): every profile the person
   * might have, each run through the engine (`engine/candidates.ts`; board
   * D168). Never stored.
   */
  candidates?: readonly UserProfile[];
}

/**
 * The canonical allergens (journey §11.5, B-13; board D82): a chip stores one
 * of these ids, and anything else is the person's own words. Plan 7 gives
 * each its aliases (`src/food/allergens.ts`).
 */
export const ALLERGEN_IDS = ['peanut', 'treeNut', 'milk', 'egg', 'wheat', 'soy', 'sesame', 'fish', 'shellfish', 'mustard'] as const;
export type AllergenId = (typeof ALLERGEN_IDS)[number];

/** How a person eats (journey §6.2 chapter 7). Jain is vegetarian, with no honey and no root vegetables or bulbs. */
export type FoodPattern = 'vegetarian' | 'eggetarian' | 'nonVegetarian' | 'vegan' | 'jain';

/** What meal ideas may include, and how much the person logs. Never inferred: only what the person said. */
export interface FoodPreferences {
  /** `jain` (journey §6.2 chapter 7): vegetarian, with no honey and no root vegetables or bulbs (board D82). */
  pattern: FoodPattern;
  /** Foods to leave out of meal ideas, in the person's own words (v1's "Leave out"). */
  avoid: string[];
  /** Optional regional leaning for meal examples. */
  region?: 'north' | 'south' | 'east' | 'west' | 'mixed';
  /**
   * v2 (B-13): the allergies a chip names, as canonical ids. An empty list is
   * the answer "No food allergies". The person's own words are `customAllergies`.
   */
  allergies?: AllergenId[];
  /**
   * v2 (journey §11.1): meal ideas only, meals with no numbers (counts-free,
   * B-11), or meals with calorie and carb estimates. Absent reads as `ideas`.
   */
  level?: 'ideas' | 'meals' | 'estimates';
  /**
   * v2 (K-22): the answer to "Has food or weight ever been hard for you?",
   * asked before estimates are chosen and kept on this device (board D82,
   * Plan 7's D102). "Yes" or "Prefer not to say" recommends meals only.
   */
  hardBefore?: 'yes' | 'no' | 'preferNot';
  /**
   * v2 (B-13): allergies the chips don't name, in the person's own words
   * ("brinjal"). Read through the aliases, so "groundnuts" still counts as
   * peanut; anything else is matched by word against every ingredient.
   */
  customAllergies?: string[];
  /** A daily target the person's care team gave them (journey §11.5). The app never suggests one. */
  careTeamTargets?: { kcal?: number; carbsG?: number; setOn: string };
  /** One daily reminder to log a meal, with estimates only (journey §7.4, A-73; board D103). Absent: off. */
  logReminder?: { meal: 'breakfast' | 'lunch' | 'dinner'; at: string };
}
