/**
 * Motion clips for the 3D coach. World frame: metres, Y up, the figure starts
 * facing +Z with its left side towards +X, and the floor is y = 0.
 *
 * Angles are degrees and anatomical: positive means flexion, abduction,
 * external rotation, dorsiflexion, elevation, protraction, a left side-bend
 * or a left twist, whichever side the joint is on.
 */

export type Vec3 = readonly [number, number, number];
export type Vec2 = readonly [number, number];

export interface BoneDef {
  name: string;
  parent: number;
  head: Vec3;
  tail: Vec3;
}

export interface Pose {
  /** Pelvis joint position. Defaults to standing height over the origin. */
  root?: Vec3;
  /** Pelvis orientation [pitch (forward tilt), yaw (turn left), roll (left hip up)]. */
  rootRot?: Vec3;
  /** Extra turn of the pelvis about its own long axis, applied last (lying or on all fours: + lifts the left hip). */
  rootTwist?: number;
  /** Whole-trunk [flex, side-bend left, twist left], spread over the three spine bones. */
  spine?: Vec3;
  /** Extra lumbar-only motion (e.g. a rounded lower back). */
  lumbar?: Vec3;
  /** Extra upper-back-only motion (e.g. thoracic extension). */
  thoracic?: Vec3;
  neck?: Vec3;
  head?: Vec3;
  /** [elevation, protraction] */
  clavL?: Vec2;
  clavR?: Vec2;
  /** [flex, abduction, external rotation] — used when the hand has no target. */
  shoulderL?: Vec3;
  shoulderR?: Vec3;
  elbowL?: number;
  elbowR?: number;
  /** Pronation (palm turns back from the neutral thumb-forward position). */
  forearmL?: number;
  forearmR?: number;
  /** [flexion towards the palm, radial deviation] */
  wristL?: Vec2;
  wristR?: Vec2;
  /** [flex, abduction, external rotation] — used when the foot has no target. */
  hipL?: Vec3;
  hipR?: Vec3;
  kneeL?: number;
  kneeR?: number;
  /** [dorsiflexion, inversion] */
  ankleL?: Vec2;
  ankleR?: Vec2;
  toesL?: number;
  toesR?: number;
  /** 0 open hand … 1 closed grip */
  gripL?: number;
  gripR?: number;

  /** IK: point on a surface under the ankle of a flat foot, [x, surfaceY, z]. */
  footL?: Vec3;
  footR?: Vec3;
  /** Foot orientation in the world [pitch, yaw (toes turn left), roll]. */
  footRotL?: Vec3;
  footRotR?: Vec3;
  /** Heel raise in degrees, pivoting on the ball of the foot. */
  heelL?: number;
  heelR?: number;
  kneePoleL?: Vec3;
  kneePoleR?: Vec3;
  /**
   * Kneeling: aim the thigh so the knee joint lands on this point (the joint
   * centre sits ~6.5 cm above the floor). Knee and ankle angles stay FK.
   */
  kneeAimL?: Vec3;
  kneeAimR?: Vec3;

  /** IK: palm centre (where a bar or handle sits). */
  handL?: Vec3;
  handR?: Vec3;
  /** Direction the palm faces and the fingers point (before the grip curls them). */
  palmL?: Vec3;
  palmR?: Vec3;
  fingersL?: Vec3;
  fingersR?: Vec3;
  elbowPoleL?: Vec3;
  elbowPoleR?: Vec3;
  /**
   * Frame for the hand targets, palm/finger directions and elbow poles:
   * 'world' (default), 'chest' (origin at the upper spine, moves with the
   * trunk), 'pelvis', or 'shoulders' (world axes, origin at each shoulder
   * joint, so hanging arms stay under the shoulders whatever the trunk does).
   */
  handSpace?: 'world' | 'chest' | 'pelvis' | 'shoulders';
}

export type PoseKey = keyof Pose;

export type Ease = 'inOut' | 'linear' | 'in' | 'out' | 'hold';

export interface Keyframe {
  /** 0–1 through the cycle. */
  t: number;
  pose: Pose;
  /** Easing into this key from the previous one. */
  ease?: Ease;
  /** 0 at the start position … 1 at the hardest point; scales mistake deltas. */
  depth?: number;
}

export interface Mistake {
  /** Matches `CoachingMistake.clip` (`${exerciseId}.${slug}`). */
  id: string;
  label: string;
  /** Added to every key, scaled by the key's depth (or 1 when `constant`). */
  delta?: Pose;
  constant?: boolean;
  /** Full replacement keys, when a delta can't express the fault. */
  keys?: Keyframe[];
  /** Replaces the clip's equipment, for setup faults (a bench at the wrong angle). */
  equipment?: Equipment[];
  /** Body parts to tint red while the fault plays. */
  highlight: MuscleName[];
}

export type MuscleName =
  | 'neck' | 'traps' | 'deltsFront' | 'deltsSide' | 'deltsRear' | 'chest' | 'biceps' | 'triceps' | 'forearms'
  | 'abs' | 'obliques' | 'lats' | 'upperBack' | 'lowerBack' | 'glutes' | 'gluteMed' | 'hipFlexors' | 'quads'
  | 'hamstrings' | 'adductors' | 'calves' | 'shins' | 'feet' | 'hands';

export type CameraView = 'side' | 'front' | 'threeQuarter' | 'back' | 'otherSide' | 'top';

export type Equipment =
  | { kind: 'barbell'; plates?: number }
  | { kind: 'dumbbells'; hands?: 'both' | 'L' | 'R' | 'goblet' }
  /** A short bar or V/rope handle held in the hands; `length` across the grip. */
  | { kind: 'handle'; length?: number; rope?: boolean; hands?: 'both' | 'L' | 'R' }
  /** A strap or towel from both hands to the sole of one foot. */
  | { kind: 'strap'; foot: 'L' | 'R' }
  | { kind: 'kettlebell' }
  | { kind: 'trapBar' }
  /** Flat or incline bench. `incline` tilts the back pad up about the seat's near end. */
  | { kind: 'bench'; pos: Vec3; yaw?: number; incline?: number; height?: number; length?: number }
  /** A block (plyo box, seat or back pad). `pos` is the centre of its base; `pitch` tilts it about X. */
  | { kind: 'box'; pos: Vec3; size: Vec3; yaw?: number; pitch?: number; pad?: boolean; material?: 'wood' | 'pad' | 'frame' | 'steel' | 'cloth' }
  /** A pad that rides on the knees (assisted pull-up and dip machines). */
  | { kind: 'kneePad' }
  /**
   * A pad, roller or plate that follows a body part: a leg-curl ankle roller,
   * a leg-press foot plate, a thigh pad. `size` defaults to a small roller.
   */
  | { kind: 'pad'; follow: 'ankles' | 'knees' | 'thighs' | 'feet' | 'hands'; size?: Vec3; offset?: Vec3; roller?: boolean; pitch?: number; yaw?: number; material?: 'pad' | 'frame' | 'steel' }
  | { kind: 'chair'; pos: Vec3; yaw?: number; height?: number }
  | { kind: 'foamRoller'; pos: Vec3; yaw?: number }
  /** Horizontal bar across X at this height and depth. */
  | { kind: 'pullupBar'; height: number; z?: number }
  /** A stick held between the hands, or lying along the back (head, upper back, tailbone). */
  | { kind: 'dowel'; attach: 'hands' | 'back' }
  /** Barbell from a floor pivot at `anchor` up through the hands. */
  | { kind: 'landmine'; anchor: Vec3; hands?: 'both' | 'L' | 'R' }
  | { kind: 'backExtensionBench'; pos: Vec3 }
  | { kind: 'mat'; pos?: Vec3; yaw?: number }
  /** A wall or doorway panel. `yaw` turns it, so it can face along ±X too. */
  | { kind: 'wall'; z: number; yaw?: number; x?: number }
  | { kind: 'cable'; anchor: Vec3; hands?: 'both' | 'L' | 'R'; handle?: 'rope' | 'single' | 'bar' }
  | { kind: 'band'; anchor?: Vec3; hands?: 'both' | 'L' | 'R'; between?: 'hands' | 'knees' }
  | { kind: 'step'; pos: Vec3; height: number }
  | { kind: 'treadmill'; incline?: number }
  | { kind: 'bike'; recumbent?: boolean }
  | { kind: 'rower' }
  | { kind: 'elliptical' }
  | { kind: 'machine'; model: 'legPress' | 'legCurl' | 'legExtension' | 'latPulldown' | 'seatedRow' | 'chestPress' | 'shoulderPress' | 'pecDeck'; pos?: Vec3 };

export interface Clip {
  id: string;
  /** Seconds per cycle at normal speed. */
  duration: number;
  keys: Keyframe[];
  /** Clips are authored for the left side; the viewer mirrors for the right. */
  sided?: boolean;
  view?: CameraView;
  equipment?: Equipment[];
  mistakes?: Mistake[];
  /** Where to look: defaults to the figure's bounding box over the cycle. */
  focus?: Vec3;
  /** Holds: after the first pass, loop from this phase (the settled stretch) instead of 0. */
  loopFrom?: number;
  /** Props to ignore when framing the shot (tall cable columns, walls). */
  ignoreForCamera?: Equipment['kind'][];
}
