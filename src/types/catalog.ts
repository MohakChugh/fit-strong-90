/**
 * Exercise catalogue types: engine metadata (what the planner needs to pick
 * and dose an exercise safely) and coaching content (what the coach says and
 * shows). Both are keyed by the same kebab-case exercise id.
 */

import type { Difficulty, MuscleGroup } from './index';

/** Movement patterns used to fill plan slots. */
export type Pattern =
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'hPush'
  | 'hPull'
  | 'vPush'
  | 'vPull'
  | 'carry'
  | 'antiExtension'
  | 'antiRotation'
  | 'antiLateral'
  | 'rotation'
  | 'kneeFlexion'
  | 'calf'
  | 'biceps'
  | 'triceps'
  | 'sideDelt'
  | 'rearDelt'
  | 'chestFly'
  | 'backExtension';

/** Equipment a movement needs. All listed items are required. */
export type EquipmentTag =
  | 'barbell'
  | 'trapBar'
  | 'dumbbells'
  | 'kettlebell'
  | 'bench'
  | 'cable'
  | 'machine'
  | 'pullupBar'
  | 'landmine'
  | 'backExtensionBench'
  | 'bands'
  | 'mat'
  | 'foamRoller'
  | 'strap'
  | 'chair'
  | 'wall'
  | 'dowel'
  | 'box'
  | 'treadmill'
  | 'bike'
  | 'recumbentBike'
  | 'elliptical'
  | 'rower';

/** Body regions tracked by the mobility coverage ledger. */
export type MobilityRegion =
  | 'neck'
  | 'thoracic'
  | 'shoulders'
  | 'chest'
  | 'lats'
  | 'armsWrists'
  | 'torso'
  | 'lowerBack'
  | 'hipFlexors'
  | 'glutes'
  | 'adductors'
  | 'hamstrings'
  | 'quads'
  | 'calves';

export const MOBILITY_REGIONS: MobilityRegion[] = [
  'neck', 'thoracic', 'shoulders', 'chest', 'lats', 'armsWrists', 'torso',
  'lowerBack', 'hipFlexors', 'glutes', 'adductors', 'hamstrings', 'quads', 'calves',
];

/**
 * Safety flags, graded where the severity changes the rule (spec §4.8, §5.3).
 * Absent means "not applicable".
 */
export interface SafetyFlags {
  /** SF: 1 = only if technique fails, 2 = by design (e.g. crunch). */
  spinalFlexion?: 1 | 2;
  /** AX: 2 = bar on the back, heavy pulls, standing presses. */
  axialLoad?: 1 | 2;
  /** LM: hinge / shear demand on the lumbar spine. */
  lumbarMoment?: 1 | 2;
  /** LR: lumbar twisting under load. */
  loadedRotation?: true;
  /** LE: end-range lumbar extension under load. */
  loadedExtension?: true;
  /** VR: 2 = heavy multi-joint lower body or near failure. */
  valsalva?: 1 | 2;
  /** HB: head below the heart. */
  headBelowHeart?: true;
  /** HI: jumps, running. */
  highImpact?: true;
  /** NTs: sciatic tension (hip flexion + knee extension). */
  sciaticTension?: 1 | 2;
  /** NTf: femoral tension (hip extension + knee flexion). */
  femoralTension?: 1 | 2;
  /** DH: loaded deep hip flexion (proximal hamstring tendon). */
  deepHipFlexionLoaded?: true;
  /** BD: balance demand. */
  balance?: 1 | 2;
  /** OH: overhead load. */
  overhead?: true;
  /**
   * IH: 1 = brief end-range pause inside a rep (dead bug, bird dog, Pallof
   * press), 2 = the drill *is* a sustained brace (plank, side plank, the
   * 10-second McGill curl-up). Only grade 2 counts as an isometric for the
   * proliferative-retinopathy rule (spec §4.6, §4.8).
   */
  isometricHold?: 1 | 2;
  /** SX: seated flexed posture. */
  seatedFlexion?: true;
  /** Direction-specific mobility: end-range spinal flexion. */
  endRangeFlexion?: true;
  /** Direction-specific mobility: end-range spinal extension. */
  endRangeExtension?: true;
  /** Standing / weight-bearing (blocked by the FOOT modifier). */
  weightBearing?: true;
}

export type LadderTrack = 'hinge' | 'squat';
export type LadderLevel = 0 | 1 | 2 | 3 | 4;

/** Engine metadata for a strength exercise. */
export interface ExerciseMeta {
  id: string;
  name: string;
  kind: 'strength';
  /** Legacy category used by the Library and History pages. */
  category: MuscleGroup;
  patterns: Pattern[];
  equipment: EquipmentTag[];
  /** Alternative equipment sets; any one of them also satisfies the exercise. */
  equipmentAlt?: EquipmentTag[][];
  level: Difficulty;
  /** Minimum spinal-loading level required, when the exercise loads the spine. */
  ladder?: { track: LadderTrack; level: LadderLevel };
  unilateral: boolean;
  supersetEligible: boolean;
  /** Seconds to set up the station when moving to this exercise. */
  setupSeconds: number;
  regressionId?: string;
  progressionId?: string;
  flags: SafetyFlags;
  /** Retired ids stay so history still resolves; the planner never picks them. */
  retired?: boolean;
  /** For retired duplicates: the id whose content replaces this one. */
  aliasOf?: string;
}

export type MobilityMode = 'hold' | 'reps' | 'slider' | 'breathing' | 'activation';

/** Engine metadata for a stretch, mobility, breathing or activation drill. */
export interface MobilityMeta {
  id: string;
  name: string;
  kind: 'mobility';
  regions: MobilityRegion[];
  mode: MobilityMode;
  /** Default dose; the mobility builder scales holds by phase and slot. */
  dose: {
    holdSeconds?: number;
    sets: number;
    reps?: number;
    secondsPerRep?: number;
    sides: 'each' | 'affectedFirst' | 'none';
  };
  flags: SafetyFlags;
  /** Back/sciatica status from the research. */
  status: 'ok' | 'modify' | 'avoidWhenIrritable' | 'excluded';
  /** Used instead on irritable days or with a nerve flag. */
  irritableSwap?: string;
  /** Performed lying or kneeling on the floor (grouped; staged rising applies). */
  floor: boolean;
  equipment: EquipmentTag[];
  retired?: boolean;
  aliasOf?: string;
}

export type CardioModality =
  | 'treadmill-walk'
  | 'brisk-walking'
  | 'stationary-bike'
  | 'recumbent-bike'
  | 'elliptical'
  | 'rowing-machine';

/** Engine metadata for a cardio modality. */
export interface CardioMeta {
  id: CardioModality;
  name: string;
  kind: 'cardio';
  equipment: EquipmentTag[];
  flags: SafetyFlags;
  /** Suitable for interval work. */
  intervals: boolean;
  /** Minimum hinge level before this modality is offered (rowing). */
  ladder?: { track: LadderTrack; level: LadderLevel };
}

export type CatalogMeta = ExerciseMeta | MobilityMeta | CardioMeta;

/** One incorrect-form demo: what goes wrong, why it matters, how to fix it. */
export interface CoachingMistake {
  /** Short label, e.g. "Rounding the lower back". */
  mistake: string;
  /** What it risks, e.g. "Loads the discs and can flare sciatica". */
  risk: string;
  /** The correction cue, e.g. "Push your hips back and keep your chest proud". */
  fix: string;
  /** Animation clip id for the incorrect-form demo: `${exerciseId}.${slug}`. */
  clip: string;
  /** Precise wrong body position for the animator: joint, direction, roughly how many degrees. */
  pose: string;
}

/** Everything the coach says and shows for one exercise, stretch or cardio protocol. */
export interface Coaching {
  id: string;
  name: string;
  /** One plain-language sentence: what this is and what it does. Opens the narration. */
  summary: string;
  muscles: { primary: string[]; secondary: string[] };
  /** Human-readable equipment, e.g. "Trap bar (hex bar) and plates". */
  equipment: string;
  /** How to recognise and set up the station, incl. machine adjustments. Read during transitions. */
  setup: string[];
  /** 4–7 short imperative steps a calm voice coach reads aloud. */
  steps: string[];
  /** Strength: seconds per phase of one rep. */
  tempo?: { lower: number; pauseBottom: number; lift: number; pauseTop: number };
  /** Mobility: default dose. */
  dosage?: {
    holdSeconds?: number;
    sets?: number;
    reps?: number;
    secondsPerRep?: number;
    sides: 'each' | 'affectedFirst' | 'none';
  };
  /** When to inhale, exhale and brace. Never breath-holding. */
  breathing: string;
  /** Where the user should feel it. */
  feel: string;
  /** What they should not feel, and what to do if they do. */
  shouldNotFeel: string;
  /** Why it is in the plan, 1–2 sentences. */
  why: string;
  mistakes: CoachingMistake[];
  backSafety: {
    status: 'ok' | 'modify' | 'avoidWhenIrritable' | 'excluded';
    note: string;
    regression?: string;
  };
  /** 3–5 short cues spoken during the set or hold. */
  cues: string[];
  /** YouTube search queries (never URLs). */
  youtube: { tutorial: string; mistakes: string };
  sources: string[];
}
