/**
 * A tiny 2D skeletal rig for exercise form animations.
 *
 * Rather than hand-authoring 45 SVG files, each exercise is described as two
 * or three *poses* (start / mid / end). A pose is a set of joint angles, which
 * forward-kinematics resolves into joint positions. The renderer then draws a
 * filled silhouette through those joints and CSS-interpolates between poses.
 *
 * Why angles rather than raw coordinates: limbs stay the correct length in
 * every pose automatically. Interpolating raw coordinates makes limbs stretch
 * and shrink, which reads as broken rather than athletic.
 *
 * Coordinate space is a 100x100 viewBox with y increasing downward (SVG
 * convention). Angles are in degrees, measured clockwise from straight down,
 * so 0 = limb hanging down, 90 = pointing right (anatomical neutral).
 */

export interface Pose {
  /** Hip position — the root of the skeleton. */
  hip: { x: number; y: number };
  /** Torso lean from vertical. 0 = upright, positive = leaning forward. */
  torso: number;
  /** Head tilt relative to the torso. */
  head?: number;
  /** Shoulder-to-elbow angle. */
  upperArm: number;
  /** Elbow-to-wrist angle, relative to the upper arm. */
  foreArm: number;
  /** Hip-to-knee angle. */
  thigh: number;
  /** Knee-to-ankle angle, relative to the thigh. */
  shin: number;
  /** Optional second limb set, for exercises with visible asymmetry. */
  farUpperArm?: number;
  farForeArm?: number;
  farThigh?: number;
  farShin?: number;
}

export interface ResolvedJoints {
  hip: Point;
  chest: Point;
  neck: Point;
  head: Point;
  shoulder: Point;
  elbow: Point;
  wrist: Point;
  knee: Point;
  ankle: Point;
  farElbow: Point;
  farWrist: Point;
  farKnee: Point;
  farAnkle: Point;
}

export interface Point {
  x: number;
  y: number;
}

// Segment lengths, in viewBox units. Roughly human proportion.
const LEN = {
  torso: 22,
  neck: 4,
  head: 6,
  upperArm: 13,
  foreArm: 12,
  thigh: 16,
  shin: 15,
} as const;

/** Project a point along an angle. 0deg points straight down (+y). */
function project(from: Point, angleDeg: number, length: number): Point {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: from.x + Math.sin(rad) * length,
    y: from.y + Math.cos(rad) * length,
  };
}

/**
 * Resolve a pose into absolute joint positions via forward kinematics.
 *
 * Child angles are additive with their parent so a pose can be described in
 * terms a coach would use ("elbow bent 90 degrees from the upper arm") rather
 * than in absolute world angles.
 */
export function resolvePose(pose: Pose): ResolvedJoints {
  const hip = pose.hip;

  // Torso runs upward from the hip, so the angle is inverted (180 - lean).
  const chest = project(hip, 180 - pose.torso, LEN.torso * 0.55);
  const neck = project(hip, 180 - pose.torso, LEN.torso);
  const head = project(neck, 180 - pose.torso + (pose.head ?? 0), LEN.head);

  // Shoulders sit at the top of the torso.
  const shoulder = project(hip, 180 - pose.torso, LEN.torso * 0.92);

  const elbow = project(shoulder, pose.upperArm, LEN.upperArm);
  const wrist = project(elbow, pose.upperArm + pose.foreArm, LEN.foreArm);

  const knee = project(hip, pose.thigh, LEN.thigh);
  const ankle = project(knee, pose.thigh + pose.shin, LEN.shin);

  const farUpper = pose.farUpperArm ?? pose.upperArm;
  const farFore = pose.farForeArm ?? pose.foreArm;
  const farElbow = project(shoulder, farUpper, LEN.upperArm);
  const farWrist = project(farElbow, farUpper + farFore, LEN.foreArm);

  const farThighAngle = pose.farThigh ?? pose.thigh;
  const farShinAngle = pose.farShin ?? pose.shin;
  const farKnee = project(hip, farThighAngle, LEN.thigh);
  const farAnkle = project(farKnee, farThighAngle + farShinAngle, LEN.shin);

  return {
    hip, chest, neck, head, shoulder, elbow, wrist,
    knee, ankle, farElbow, farWrist, farKnee, farAnkle,
  };
}

/** Format a point for an SVG attribute. */
export function pt(p: Point): string {
  return `${round(p.x)},${round(p.y)}`;
}

export function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Equipment drawn behind or around the figure. Kept declarative so an
 * exercise definition stays data rather than JSX.
 */
export type Prop =
  | { kind: 'barbell'; grip: 'wrist' | 'farWrist'; width?: number }
  | { kind: 'dumbbell'; grip: 'wrist' | 'farWrist' }
  | { kind: 'bench'; y: number; x?: number; width?: number; incline?: number }
  | { kind: 'floor'; y: number }
  | { kind: 'machineFrame'; x: number; y: number; w: number; h: number }
  | { kind: 'cableStack'; x: number; topY: number; attachTo: 'wrist' | 'farWrist' }
  | { kind: 'pullupBar'; y: number }
  | { kind: 'ball'; grip: 'wrist' | 'farWrist'; r?: number }
  | { kind: 'mat'; y: number }
  | { kind: 'treadmill'; y: number }
  | { kind: 'bike'; y: number }
  | { kind: 'foamRoller'; x: number; y: number };

export interface ExerciseAnimation {
  /** Poses cycled through, in order. Two or three reads best. */
  poses: Pose[];
  /** Equipment drawn for this exercise. */
  props: Prop[];
  /** Seconds for one full rep cycle. Slower for heavy compounds. */
  duration: number;
  /** Muscle regions that highlight on the contraction beat. */
  emphasis: EmphasisRegion[];
  /** Which pose index is peak contraction, for timing the muscle glow. */
  contractionIndex?: number;
  /** Optional viewBox override for exercises that need more room. */
  viewBox?: string;
}

/** Regions that can glow to show the muscle being worked. */
export type EmphasisRegion =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'
  | 'cardio';
