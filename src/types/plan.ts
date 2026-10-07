/**
 * The daily session plan the engine builds and the runner executes
 * (spec §5, §6.1). Steps expand into deterministic segments, so the planned
 * duration and the runner's timeline always agree.
 */

import type { Phase } from './index';
import type { Readiness } from './checkin';
import type { CardioModality } from './catalog';

export type DayFocus =
  | 'lowerA'
  | 'upperA'
  | 'lowerB'
  | 'upperB'
  | 'lowerC'
  | 'upperC'
  | 'upper'
  | 'lower'
  | 'push'
  | 'pull'
  | 'legs'
  | 'fullA'
  | 'fullB'
  | 'fullC'
  | 'activeRecovery'
  | 'rest';

/** Which mobility template a day uses (back-sciatica-mobility.md §5). */
export type MobilityDayType =
  | 'upperPush'
  | 'upperPull'
  | 'lowerSquat'
  | 'lowerHinge'
  | 'fullBody'
  | 'core';

export type Block = 'intro' | 'mobility' | 'strength' | 'cardio' | 'wrapUp';

export type PlanMode = 'normal' | 'deload' | 'taper';

export interface Tempo {
  lower: number;
  pauseBottom: number;
  lift: number;
  pauseTop: number;
}

export type SlotRole = 'main' | 'secondary' | 'isolation' | 'trunk' | 'carry';

export type Side = 'left' | 'right';

export interface LoadSuggestion {
  /** Suggested working weight; null for bodyweight or first-time "find your weight". */
  kg: number | null;
  note: 'firstTime' | 'same' | 'increase' | 'decrease' | 'bodyweight';
}

export interface Prescription {
  sets: number;
  /** Target rep range. */
  reps: [number, number];
  /** Reps the runner paces and counts. */
  targetReps: number;
  /** Reps in reserve at the end of each set. */
  rir: number;
  restSeconds: number;
  tempo: Tempo;
  /** Warm-up (ramp) sets before the working sets. */
  rampSets: number;
  /** Isometric items: hold time per set (per side when unilateral). */
  holdSeconds?: number;
  /** Carries: walking time per side. */
  carrySeconds?: number;
  load: LoadSuggestion;
  /** Unilateral work: affected side first. */
  sideOrder?: Side[];
  /** Human-readable caps applied by safety rules, e.g. "Stop 3 reps short of failure". */
  caps: string[];
}

export interface PlannedExercise {
  exerciseId: string;
  slotId: string;
  role: SlotRole;
  rx: Prescription;
  /** Exercises sharing a pair id alternate set by set. */
  pairId?: string;
  /** The default exercise this replaced, when a safety rule swapped it. */
  swappedFrom?: string;
  reason?: string;
}

export type SegmentKind =
  | 'talk'
  | 'prep'
  | 'hold'
  | 'switch'
  | 'rep'
  | 'work'
  | 'rest'
  | 'cardio'
  | 'checkpoint';

export type RepPhase = 'lower' | 'pauseBottom' | 'lift' | 'pauseTop';

/** A timed sub-phase of a step. The UI shows it and the narrator speaks to it. */
export interface Segment {
  kind: SegmentKind;
  seconds: number;
  /** Short UI label, e.g. "Left side", "Hold 2 of 2", "Rep 3". */
  label: string;
  side?: Side;
  /** 1-based hold or set index within the step. */
  set?: number;
  of?: number;
  rep?: number;
  repPhase?: RepPhase;
  breath?: 'in' | 'out';
  /** Cardio intensity band. */
  intensity?: CardioIntensity;
}

export type CardioIntensity = 'easy' | 'zone2' | 'tempo' | 'fast' | 'cooldown';

interface StepBase {
  /** Unique within the plan. */
  id: string;
  block: Block;
  title: string;
}

export interface TalkStep extends StepBase {
  kind: 'talk';
  topic: 'welcome' | 'blockIntro' | 'transition' | 'wrapUp';
  seconds: number;
  /** Exercise the user moves to next (transitions). */
  nextExerciseId?: string;
}

export interface HoldStep extends StepBase {
  kind: 'hold';
  exerciseId: string;
  holdSeconds: number;
  sets: number;
  sides: Side[] | null;
  prepSeconds: number;
  switchSeconds: number;
  /** Deep-hold slot (longer static hold on a non-prime mover). */
  deep: boolean;
  /** Safety cues earned by this drill's flags, spoken as it starts. */
  caps?: string[];
}

export interface DrillStep extends StepBase {
  kind: 'drill';
  exerciseId: string;
  /** Safety cues earned by this drill's flags, spoken as it starts. */
  caps?: string[];
  reps: number;
  secondsPerRep: number;
  sets: number;
  sides: Side[] | null;
  prepSeconds: number;
  switchSeconds: number;
  /** Breathing drills pace inhale / exhale instead of reps. */
  breathing?: { inhale: number; exhale: number };
}

export interface SetupStep extends StepBase {
  kind: 'setup';
  exerciseId: string;
  seconds: number;
}

export interface SetStep extends StepBase {
  kind: 'set';
  exerciseId: string;
  /** 1-based working-set number; ramp sets count separately. */
  set: number;
  of: number;
  ramp: boolean;
  reps: number;
  tempo: Tempo;
  sides: Side[] | null;
  holdSeconds?: number;
  carrySeconds?: number;
  load: LoadSuggestion;
  rir: number;
  pairId?: string;
  prepSeconds: number;
}

export interface RestStep extends StepBase {
  kind: 'rest';
  seconds: number;
  /** Id of the step that follows the rest. */
  nextStepId?: string;
}

export interface CardioStep extends StepBase {
  kind: 'cardio';
  exerciseId: CardioModality;
  parts: { seconds: number; intensity: CardioIntensity; label: string }[];
}

export interface CheckpointStep extends StepBase {
  kind: 'checkpoint';
  question: 'backSymptoms' | 'glucose';
  seconds: number;
  exerciseId?: string;
}

export type Step =
  | TalkStep
  | HoldStep
  | DrillStep
  | SetupStep
  | SetStep
  | RestStep
  | CardioStep
  | CheckpointStep;

export interface CardioPlan {
  modality: CardioModality;
  format: 'zone2' | 'intervals' | 'tempo' | 'easy';
  seconds: number;
}

export interface SessionPlan {
  id: string;
  /** YYYY-MM-DD the plan was built for. */
  date: string;
  week: number;
  phase: Phase;
  mode: PlanMode;
  focus: DayFocus;
  /** e.g. "Lower C · Hinge". */
  label: string;
  mobilityDayType: MobilityDayType;
  readiness: Readiness;
  kind: 'full' | 'recovery' | 'restDay' | 'none';
  steps: Step[];
  exercises: PlannedExercise[];
  cardio: CardioPlan | null;
  /** Seconds from the start at which each block begins. */
  blockStarts: Partial<Record<Block, number>>;
  totalSeconds: number;
  /** Why today's plan differs from the default, shown to the user. */
  changes: string[];
  warnings: string[];
}

/** Per-step result recorded by the runner. */
export interface StepLog {
  stepId: string;
  exerciseId?: string;
  kind: Step['kind'];
  completed: boolean;
  skipped?: boolean;
  /** Strength sets. */
  reps?: number;
  weightKg?: number | null;
  /** Checkpoint answers. */
  answer?: string;
  at: number;
}
