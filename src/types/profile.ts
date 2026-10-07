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

/** Health facts from diabetes-hypertension-exercise.md §4. */
export interface HealthProfile {
  diabetes: 'none' | 'prediabetes' | 'type1' | 'type2' | 'other';
  insulin: 'none' | 'injections_or_pump' | 'automated_delivery';
  sulfonylureaOrMeglitinide: boolean;
  sglt2i: boolean;
  /** Impaired awareness of lows, or a severe low in the past 6 months. */
  highHypoRisk: boolean;
  hypertension: 'none' | 'treated' | 'untreated' | 'unsure';
  betaBlocker: boolean;
  diuretic: boolean;
  heartOrVascularDisease: boolean;
  kidneyDisease: 'none' | 'ckd' | 'dialysis_or_transplant' | 'unsure';
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
  clinicianTargets?: { glucoseStartMin?: number; bpStopSystolic?: number };
}

export interface PainProfile {
  areas: PainArea[];
  sciaticaSide?: Side;
  /** What the user reports makes it worse (onboarding question). */
  worseWith: 'flexion' | 'extension' | 'unknown';
  /** Confirmed directional preference: which direction eases symptoms. */
  preference: 'extension' | 'flexion' | 'none' | 'untested';
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
}
