/** Lower-back, glute, hip, hamstring, quad and calf mobility clips. */
import type { Clip, Equipment, Keyframe, Pose, Vec2, Vec3 } from '../types';
import { hookLying, KNEEL_Y, LIE_Y, palmsFlat, prone, quadruped, rep, seated, STAND_Y, stance, supine } from './kit';

// Small vector maths for putting hands and feet on the body. Rotations match the rig:
// rootRot is Euler YXZ, joint angles are XZY (see rig.ts).
const D = Math.PI / 180;
const add = (a: Vec3, b: Vec3, k = 1): Vec3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const rx = ([x, y, z]: Vec3, d: number): Vec3 => [x, y * Math.cos(d * D) - z * Math.sin(d * D), y * Math.sin(d * D) + z * Math.cos(d * D)];
const ry = ([x, y, z]: Vec3, d: number): Vec3 => [x * Math.cos(d * D) + z * Math.sin(d * D), y, -x * Math.sin(d * D) + z * Math.cos(d * D)];
const rz = ([x, y, z]: Vec3, d: number): Vec3 => [x * Math.cos(d * D) - y * Math.sin(d * D), x * Math.sin(d * D) + y * Math.cos(d * D), z];

/** Hip joints relative to the pelvis joint, and segment lengths (metres). */
const HIP: Record<'L' | 'R', Vec3> = { L: [0.108, -0.006, -0.01], R: [-0.108, -0.006, -0.01] };
const THIGH = 0.422;
const SHIN = 0.4465;

/** FK leg in the pelvis frame: knee and ankle joints for hip [flex, abd, extRot] and knee flexion. */
function leg(side: 'L' | 'R', hip: Vec3, knee: number) {
  const s = side === 'L' ? 1 : -1;
  const r = (v: Vec3) => rx(rz(ry(v, s * hip[2]), s * hip[1]), -hip[0]);
  const thigh = r([s * Math.sin(2 * D), -Math.cos(2 * D), 0]);
  const shin = r(rx([0, -1, 0], knee));
  const k = add(HIP[side], thigh, THIGH);
  return {
    knee: k, ankle: add(k, shin, SHIN), thigh, shin,
    /** Back of the thigh and the leg's outward side. */
    back: r([0, 0, -1]), out: r([s, 0, 0]), front: r(rx([0, 0, 1], knee)),
    along: (f: number) => add(HIP[side], thigh, THIGH * f),
    belowKnee: (d: number) => add(k, shin, d),
  };
}

/**
 * Both hands clasped behind the left thigh (fraction `at` from hip to knee), in the pelvis
 * frame so they ride the leg: left hand on the outer side, right hand on the inner side.
 */
function holdThigh(hip: Vec3, knee: number, at = 0.8, reach = 0.075): Pose {
  const l = leg('L', hip, knee);
  const c = add(l.along(at), l.back, reach);
  const palm = add([0, 0, 0], l.back, -1);
  return {
    handSpace: 'pelvis', handL: add(c, l.out, 0.035), handR: add(c, l.out, -0.035), palmL: palm, palmR: palm,
    fingersL: add([0, 0, 0], l.out, -1), fingersR: l.out, gripL: 0.55, gripR: 0.55, elbowPoleL: [1, 0.1, -0.6], elbowPoleR: [-1, 0.1, -0.6],
  };
}

/** Pelvis-frame point → world, for a pelvis at `root` turned by `rootRot`. */
const toWorld = (v: Vec3, root: Vec3, rootRot: Vec3): Vec3 => add(root, ry(rx(rz(v, rootRot[2]), rootRot[0]), rootRot[1]));
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vec3): Vec3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * Foot IK for a foot off the floor: the target and footRot that put the ankle joint at `ankle`
 * with the toes along `toes` and the top of the foot facing `top` (world).
 */
function footAt(side: 'L' | 'R', ankle: Vec3, toes: Vec3, top: Vec3): Pose {
  const t = norm(toes), u = norm(add(top, t, -dot(top, t))), x = cross(u, t);
  const rot: Vec3 = [Math.asin(-t[1]) / D, Math.atan2(t[0], t[2]) / D, Math.atan2(x[1], u[1]) / D];
  return side === 'L' ? { footL: add(ankle, u, -0.071), footRotL: rot } : { footR: add(ankle, u, -0.071), footRotR: rot };
}

/**
 * Lying on the back with the pelvis tilted: > 0 rolls it back (the lower back flattens into
 * the mat), < 0 forward (the lower back lifts into an arch). The spine bends the other way,
 * spread over its three bones, so the ribs and shoulders stay level on the mat.
 */
const spineFor = (tilt: number): Pose => tilt >= 0
  ? { spine: [tilt * 1.33, 0, 0], thoracic: [-tilt * 0.33, 0, 0] }
  : { spine: [tilt * 2, 0, 0], lumbar: [tilt * 0.3, 0, 0], thoracic: [-tilt * 1.3, 0, 0] };

/** Lying hook position for the tilt drill: feet flat, knees up, hands resting on the hip bones. */
const tiltBase = (tilt: number, extra: Pose = {}): Pose => hookLying({
  // The pelvis rocks on the sacrum: it rises a little as it rolls back.
  root: [0, LIE_Y + tilt * (tilt > 0 ? 0.0006 : 0.00045), 0], rootRot: [-90 - tilt, 0, 0], ...spineFor(tilt), neck: [8, 0, 0],
  handSpace: 'pelvis', handL: [0.135, 0.05, 0.12], handR: [-0.135, 0.05, 0.12], palmL: [-0.3, 0, -1], palmR: [0.3, 0, -1],
  fingersL: [-0.6, -0.6, 0.2], fingersR: [0.6, -0.6, 0.2], gripL: 0.15, gripR: 0.15,
  // Elbows rest on the mat: counter-turn their pole against the tilt.
  elbowPoleL: rx([1, 0.18, -1], tilt * 2.6), elbowPoleR: rx([-1, 0.18, -1], tilt * 2.6),
  ...extra,
});

/** Left leg raised with a strap round the foot, both hands holding the strap. */
const strapLeg = (hip: number, knee: number, extra: Pose = {}): Pose => supine({
  hipL: [hip, 0, 0], kneeL: knee, ankleL: [-5, 0],
  shoulderL: [75, 4, 0], shoulderR: [75, -4, 0], elbowL: 25, elbowR: 25, gripL: 1, gripR: 1,
  ...extra,
});

/** Neutral → flattened (out-breath) → pause → small arch (in-breath) → back to neutral. */
const tiltKeys = (flat = tiltBase(7), arch = tiltBase(-13)): Keyframe[] => [
  // Neutral keeps a small natural arch: the flattening closes it, the arch opens it.
  { t: 0, pose: tiltBase(-3), depth: 0 },
  { t: 0.45, pose: flat, depth: 1 },
  { t: 0.55, pose: flat, depth: 1, ease: 'linear' },
  { t: 0.85, pose: arch, depth: 0.5 },
];

/** On the back, other foot planted, hugging the left knee in by the back of the thigh. */
const kneeHug = (hip: number, knee: number, extra: Pose = {}, at = 0.62): Pose => hookLying({
  // The knee draws in toward the middle of the chest; the shoulders ease forward to reach.
  footL: undefined, hipL: [hip, -4, 0], kneeL: knee, ankleL: [-18, 0], neck: [8, 0, 0], clavL: [0, 10], clavR: [0, 16], thoracic: [0, 0, 5],
  ...holdThigh([hip, -4, 0], knee, at), ...extra,
});

/**
 * Hands either side of a thigh, fingers wrapped round behind it (pelvis frame): the reach
 * that lets the head stay down with the thigh near vertical.
 */
function cradleThigh(hip: Vec3, at = 0.62, side: 'L' | 'R' = 'L'): Pose {
  const l = leg(side, hip, 0);
  const c = add(l.along(at), l.back, 0.02);
  const outer = add(c, l.out, 0.075), inner = add(c, l.out, -0.075), inward = add([0, 0, 0], l.out, -1);
  const [hL, hR, pL, pR] = side === 'L' ? [outer, inner, inward, l.out] : [inner, outer, l.out, inward];
  return {
    handSpace: 'pelvis', handL: hL, handR: hR, palmL: pL, palmR: pR, fingersL: l.back, fingersR: l.back, gripL: 0.5, gripR: 0.5,
    elbowPoleL: [1, 0.1, -0.6], elbowPoleR: [-1, 0.1, -0.6],
  };
}

/** Both hands clasped on the front of the left shin, `d` below the knee joint (pelvis frame). */
function holdShin(hip: Vec3, knee: number, d = 0.09): Pose {
  const l = leg('L', hip, knee);
  const c = add(l.belowKnee(d), l.front, 0.06);
  const palm = add([0, 0, 0], l.front, -1);
  return {
    handSpace: 'pelvis', handL: add(c, l.out, 0.03), handR: add(c, l.out, -0.03), palmL: palm, palmR: palm,
    fingersL: add([0, 0, 0], l.out, -1), fingersR: l.out, gripL: 0.6, gripR: 0.6, elbowPoleL: [1, 0.1, -0.6], elbowPoleR: [-1, 0.1, -0.6],
  };
}

/** Supine glide: left thigh held still near vertical, the knee and ankle move; other foot planted. */
const glide = (knee: number, ankle: number, extra: Pose = {}, hip = 86): Pose => hookLying({
  footL: undefined, hipL: [hip, -2, 0], kneeL: knee, ankleL: [ankle, 0], neck: [8, 0, 0], clavL: [0, 6], clavR: [0, 8],
  ...cradleThigh([hip, -2, 0]), ...extra,
});

/** Active knee extension: left thigh held vertical, other leg long, head resting on the mat. */
const ake = (knee: number, ankle = -20, extra: Pose = {}, hip = 90): Pose => supine({
  hipL: [hip, -2, 0], kneeL: knee, ankleL: [ankle, 0], neck: [-9, 0, 0], head: [-7, 0, 0], clavL: [0, 6], clavR: [0, 8],
  ...cradleThigh([hip, -2, 0]), ...extra,
});

/**
 * Supine figure-4 for the left buttock: the left ankle crossed just above the right knee
 * (foot flexed, knee falling open), the right thigh drawn in at `hipR`. `tilt` rolls the
 * pelvis back and `lift` raises it (the fault). Hands on the mat, or cradling the right thigh.
 */
function fig4(hipR: number, kneeR: number, o: { tilt?: number; lift?: number; hands?: 'belly' | 'thigh'; at?: number; ankleR?: number; extra?: Pose } = {}): Pose {
  const tilt = o.tilt ?? 0;
  const root: Vec3 = [0, LIE_Y + (o.lift ?? 0), 0], rootRot: Vec3 = [-90 - tilt, 0, 0];
  const r = leg('R', [hipR, 0, 0], kneeR);
  const rot = (v: Vec3) => ry(rx(rz(v, 0), rootRot[0]), 0);
  const ankle = toWorld(add(add(r.along(0.86), r.back, -0.1), r.out, 0.02), root, rootRot);
  const toes = rot(add(r.thigh, r.back, -0.75)), top = rot([1, 0, 0]);
  // The left hand reaches through the gap of the "4" from the belly, the right one round the outside.
  const hands: Pose = o.hands === 'thigh' ? cradleThigh([hipR, 0, 0], o.at ?? 0.55, 'R') : {
    handSpace: 'pelvis', handL: [0.08, 0.2, 0.135], handR: [-0.1, 0.22, 0.135], palmL: [0, 0, -1], palmR: [0, 0, -1],
    fingersL: [-0.5, -0.85, 0], fingersR: [0.5, -0.85, 0], elbowPoleL: [1, 0, -0.6], elbowPoleR: [-1, 0, -0.6], gripL: 0.15, gripR: 0.15,
  };
  return supine({
    root, rootRot, ...spineFor(tilt), neck: [8, 0, 0], clavL: [0, 6], clavR: [0, 8],
    hipR: [hipR, 0, 0], kneeR, ankleR: [o.ankleR ?? -20, 0],
    ...footAt('L', ankle, toes, top), kneePoleL: [1, 0.45, 0.35],
    ...hands, ...o.extra,
  });
}

/**
 * Prone press-up: hands planted beside the shoulders, the pelvis heavy on the mat.
 * `up` 0 lying flat … 1 at the top; the lower back does the bending.
 */
const press = (up: number, extra: Pose = {}): Pose => prone({
  // The pelvis tips a little as the back arches; the hips extend to keep the legs flat.
  root: [0, 0.122, 0], rootRot: [88 - 8 * up, 0, 0], hipL: [-2 - 8 * up, 0, 0], hipR: [-2 - 8 * up, 0, 0],
  lumbar: [-22 * up, 0, 0], spine: [-10 * up, 0, 0], thoracic: [-4 * up, 0, 0], neck: [-6 + 6 * up, 0, 0],
  handL: [0.27, 0.022, 0.4], handR: [-0.27, 0.022, 0.4], palmL: [0, -1, 0], palmR: [0, -1, 0], fingersL: [0, 0, 1], fingersR: [0, 0, 1],
  elbowPoleL: [0.5, 0.6, -1], elbowPoleR: [-0.5, 0.6, -1],
  ...extra,
});

/** The press with the pelvis lifted 4 cm and a stiff lower back; knees and shins stay on the mat. */
const hipsUp: Pose = {
  root: [0, 0.162, 0], rootRot: [70, 0, 0], hipL: [-11, 0, 0], hipR: [-11, 0, 0], kneeL: 10, kneeR: 10,
  lumbar: [-8, 0, 0], spine: [-6, 0, 0], thoracic: [-2, 0, 0],
};

/** Chair seat height. */
const SEAT = 0.46;

/** Seated glide: left leg free (FK; these angles put its foot flat), hands on the seat beside the hips. */
const chairGlide = (knee: number, ankle: Vec2 | null, neck: number, extra: Pose = {}): Pose => seated(SEAT, {
  root: [0, SEAT + 0.065, -0.05], footL: undefined, hipL: [89, 6, 3], kneeL: knee, ankleL: ankle ?? [-7, -3], neck: [neck, 0, 0],
  handL: [0.19, SEAT + 0.026, -0.1], handR: [-0.19, SEAT + 0.026, -0.1], palmL: [0, -1, 0], palmR: [0, -1, 0],
  fingersL: [0.25, 0, 1], fingersR: [-0.25, 0, 1], elbowPoleL: [0.3, 0, -1], elbowPoleR: [-0.3, 0, -1],
  ...extra,
});
const KNEE_BENT = 81;

/**
 * Seated figure-4 for the left buttock: right foot planted, left ankle resting just above the
 * right knee (foot flexed, sole facing right), left knee opening out. `hinge` tips the pelvis
 * and the long spine forward together from the hips.
 */
const crossSit = (hinge: number, extra: Pose = {}): Pose => seated(SEAT, {
  // The pelvis rolls forward over the sit bones as it hinges, so the hips drop a little and move forward.
  root: [0, SEAT + 0.065 - hinge * 0.0002, -0.07 + hinge * 0.0012], rootRot: [hinge, 0, 0], lumbar: [-3, 0, 0], neck: [-hinge * 0.4, 0, 0],
  footR: [-0.15, 0, 0.4], footRotR: [0, -6, 0],
  ...footAt('L', [-0.17, 0.62, 0.3], [0.22, 0.12, 1], [1, 0.25, -0.2]), kneePoleL: [1, -0.25, 0.35],
  // Left hand rests on the crossed knee, right hand on the shin just above the ankle.
  handL: [0.25, 0.575, 0.31 + hinge * 0.0012], handR: [-0.09, 0.672, 0.3], palmL: [-0.2, -1, 0], palmR: [0, -1, 0],
  fingersL: [0.5, 0, 1], fingersR: [-0.2, 0, 1], elbowPoleL: [0.6, -0.3, -1], elbowPoleR: [-0.5, -0.5, -1], gripL: 0.3, gripR: 0.4,
  ...extra,
});

/**
 * Child's pose with the knees wide: `k` is the knee bend (90 on all fours … 150 sitting on the heels).
 * The hips travel back on the arc of the thighs; arms reach forward, forehead rests on the cushion.
 */
function child(k: number, o: { half?: number; pitch?: number; spine?: number; lumbar?: number; neck?: number; handZ?: number } = {}): Pose {
  const half = o.half ?? 0.2, lean = k - 90, thigh = Math.sqrt(THIGH * THIGH - (half - 0.108) ** 2);
  // Keys interpolate the hips in a straight line, which would cut the corner of this arc and
  // push the shins into the floor, so sit the hips a little inside it and keep the keys close.
  return quadruped({
    root: [0, KNEEL_Y - 0.008 + thigh * Math.cos(lean * D), 0.005 - thigh * Math.sin(lean * D)],
    rootRot: [o.pitch ?? 92, 0, 0], spine: [o.spine ?? 12, 0, 0], lumbar: [o.lumbar ?? 4, 0, 0], neck: [o.neck ?? 6, 0, 0],
    kneeAimL: [half, KNEEL_Y, 0.005], kneeAimR: [-half, KNEEL_Y, 0.005], kneeL: k, kneeR: k, ankleL: [-62, 8], ankleR: [-62, 8],
    ...palmsFlat(0.2, o.handZ ?? 0.7, 0.008), elbowPoleL: [0.4, 1, 0], elbowPoleR: [-0.4, 1, 0],
  });
}

/** Knee cushion top for the kneeling hip-flexor stretch. */
const CUSHION = 0.04;

/**
 * Half-kneeling on the left knee (cushion under it), right foot forward. `shift` moves the hips
 * forward (metres); `tuck` tilts the pelvis back with the lower back following so the trunk stays
 * tall. The left knee stays planted and the shin flat as the thigh extends.
 */
function halfKneel(shift: number, tuck: number, extra: Pose = {}): Pose {
  // The hips ride the arc of the kneeling thigh, so the back knee stays on its cushion.
  const hipZ = shift, hipY = KNEEL_Y + CUSHION + 0.008 + Math.sqrt(0.415 ** 2 - (hipZ - KNEE_Z) ** 2);
  const ext = Math.atan2(hipZ - KNEE_Z, hipY - (KNEEL_Y + CUSHION)) / D; // left thigh behind vertical
  return {
    root: [0, hipY, hipZ], rootRot: [-tuck, 0, 0], lumbar: [tuck, 0, 0], neck: [2, 0, 0],
    kneeAimL: [0.11, KNEEL_Y + CUSHION, KNEE_Z], kneeL: 90 - ext - 4, ankleL: [-68, 0],
    footR: [-0.12, 0, 0.44], footRotR: [0, -4, 0],
    // Right hand on the chair back beside the front knee; left arm relaxed.
    handR: [-0.32, 0.925, 0.3], palmR: [0, -1, 0], fingersR: [-0.3, 0, 1], elbowPoleR: [-0.7, -0.5, -0.6], gripR: 0.5,
    shoulderL: [6, 8, 0], elbowL: 12,
    ...extra,
  };
}
const KNEE_Z = -0.02;

/**
 * All fours with the left leg straight out to the side, whole foot flat and toes forward.
 * `back` 0 … 1 rocks the hips back toward the right heel on a long, neutral spine.
 */
function rockBack(back: number, extra: Pose = {}): Pose {
  // The right hip rides the arc of the kneeling thigh; the chest dips a little so the hands stay planted.
  const z = -0.26 * back, lean = Math.asin((0.005 - z) / THIGH) / D;
  return quadruped({
    root: [0.015 * back, KNEEL_Y + 0.008 + THIGH * Math.cos(lean * D), z], rootRot: [84 + 2 * back, 0, 0],
    // Long spine and a level gaze: the trunk must not collapse as the hips travel back.
    neck: [-2, 0, 0], head: [-4, 0, 0], thoracic: [-3, 0, 0],
    ...palmsFlat(0.2, 0.43, 0.014), elbowPoleL: [0.5, 0.3, -1], elbowPoleR: [-0.5, 0.3, -1],
    kneeAimL: undefined, footL: [0.72, 0, 0.0], footRotL: [0, 0, 0], kneePoleL: [0, 0.35, 1],
    kneeAimR: [-0.11, KNEEL_Y, 0.005], kneeR: 90 + lean, ankleR: [-62, 0],
    ...extra,
  });
}

/** Wall panel centre and the palm plane just in front of it. */
const WALL_Z = 0.64;
const WALL: Equipment = { kind: 'wall', z: WALL_Z };

/** Both palms flat on the wall at `y`, shoulder width apart. */
const wallHands = (y = 1.33): Pose => ({
  handL: [0.22, y, WALL_Z - 0.05], handR: [-0.22, y, WALL_Z - 0.05], palmL: [0, 0, 1], palmR: [0, 0, 1],
  fingersL: [0, 1, 0], fingersR: [0, 1, 0], elbowPoleL: [0.7, -1, -0.4], elbowPoleR: [-0.7, -1, -0.4], gripL: 0.08, gripR: 0.08,
});

/**
 * Split stance facing the wall with both feet pointing straight ahead, hands on the wall.
 * The left leg is the back one (`zb`), the right the front one (`zf`); `heel` lifts the back heel.
 */
const wallStance = (py: number, pz: number, lean: number, o: { zb?: number; zf?: number; heel?: number; handY?: number; extra?: Pose } = {}): Pose => ({
  root: [0, py, pz], rootRot: [lean, 0, 0], neck: [-lean * 0.5, 0, 0],
  footL: [0.1, 0, o.zb ?? -0.33], footR: [-0.12, 0, o.zf ?? 0.28], footRotL: [0, 0, 0], footRotR: [0, 0, 0],
  kneePoleL: [0, 0.1, 1], kneePoleR: [0, 0.1, 1], ...(o.heel ? { heelL: o.heel } : {}),
  ...wallHands(o.handY), ...o.extra,
});

/** Knee-to-wall rock: the left foot is in front, a hand's width from the wall; `f` 0 back … 1 knee at the wall. */
const rockToWall = (f: number, extra: Pose = {}): Pose => ({
  root: [0, 0.88 - 0.135 * f, 0.06 + 0.26 * f], rootRot: [6 - 2 * f, 0, 0], neck: [-4 + 6 * f, 0, 0],
  footL: [0.1, 0, 0.32], footR: [-0.12, 0, -0.16], footRotL: [0, 0, 0], footRotR: [0, 0, 0],
  kneePoleL: [0, 0, 1], kneePoleR: [0, 0.1, 1],
  ...wallHands(1.3), ...extra,
});

/** Box-squat stance: feet a little wider than the hips, toes turned out, arms reaching forward to balance. */
const boxSquat = (py: number, pz: number, pitch: number, extra: Pose = {}): Pose => ({
  root: [0, py, pz], rootRot: [pitch, 0, 0], neck: [-pitch * 0.45, 0, 0], ...stance(0.17, 12),
  handSpace: 'chest', handL: [0.17, -0.08, 0.5], handR: [-0.17, -0.08, 0.5], palmL: [0, -1, 0], palmR: [0, -1, 0],
  fingersL: [0, 0, 1], fingersR: [0, 0, 1], elbowPoleL: [0.4, -1, -0.3], elbowPoleR: [-0.4, -1, -0.3], gripL: 0.15, gripR: 0.15,
  ...extra,
});

/** Box top height for the squat: high enough that the lower back stays neutral. */
const BOX_TOP = 0.42;

/**
 * Dowel hinge: `lean` is the trunk's forward tilt. Knees stay soft, the spine neutral, and the
 * stick keeps its three points (head, upper back, tailbone). Hands hold it behind the neck and
 * at the small of the back, in chest space so they ride the trunk.
 */
const dowelHinge = (lean: number, kneeBend: number, extra: Pose = {}): Pose => ({
  root: [0, STAND_Y + 0.015 - 0.0008 * lean - 0.0016 * kneeBend, -0.004 * lean], rootRot: [lean, 0, 0], neck: [-lean * 0.75, 0, 0],
  ...stance(0.14, 8), kneePoleL: [0.15, 0.1, 1], kneePoleR: [-0.15, 0.1, 1],
  // The upper hand reaches over the shoulder, the lower one up behind the back, both gripping the stick.
  handSpace: 'chest', handL: [0.055, 0.25, -0.045], handR: [-0.055, -0.195, -0.1], palmL: [0, 0, 1], palmR: [0, 0, -1],
  fingersL: [0, -1, 0], fingersR: [0, -0.7, 0.7], elbowPoleL: [1, 0.3, -0.4], elbowPoleR: [-1, -0.6, -0.3], gripL: 0.8, gripR: 0.8,
  ...extra,
});

/**
 * 90/90 sitting on the floor, propped on the hands behind. `sw` sweeps the knees: 0 feet flat in
 * the middle, +1 knees down to the left (left leg in front on its outer side, right leg behind on
 * its inner side), −1 to the right. The feet pivot on the floor, so nothing swings through it.
 */
function hipSwitch(sw: number, extra: Pose = {}): Pose {
  const k = Math.abs(sw), m = 1 - k, side = Math.sign(sw) || 1;
  // Ankles slide along the floor from in front of the hips to their 90/90 places as the knees drop.
  const lift = 0.1 * k * m; // the feet skim the floor as they pivot round
  const front: Vec3 = [side * (0.26 * m + 0.1 * k), 0.071 * m + 0.062 * k + lift, 0.42 * m + 0.5 * k];
  const back: Vec3 = [side * (-0.26 * m - 0.503 * k), 0.071 * m + 0.05 * k + lift, 0.42 * m - 0.442 * k];
  const fAim = (p: Vec3, toes: Vec3, top: Vec3) => [p, toes, top] as const;
  const [fl, tl, ul] = fAim(front, [side * (0.24 * m - 0.84 * k), -0.06 * k, 0.97 * m + 0.55 * k], [side * 0.55 * k, m + 0.04 * k, 0.84 * k]);
  const [fr, tr, ur] = fAim(back, [side * (-0.24 * m - 0.89 * k), -0.06 * k, 0.97 * m - 0.44 * k], [side * -0.45 * k, m + 0.03 * k, 0.9 * k]);
  return {
    root: [0, 0.084, 0], rootRot: [-14, 0, 0], neck: [4, 0, 0], spine: [0, 0, -sw * 4],
    ...footAt(side > 0 ? 'L' : 'R', fl, tl, ul), ...footAt(side > 0 ? 'R' : 'L', fr, tr, ur),
    // The knees ride out to the sweeping side as they come down; the ankles do the rest.
    kneePoleL: [side * 0.9 * k, m + 0.2 * k, 0.4 * m], kneePoleR: [side * -0.6 * k, m + 0.2 * k, 0.4 * m],
    // Hands flat on the mat behind the hips, taking some of the weight.
    handL: [0.3, 0.025, -0.21], handR: [-0.3, 0.025, -0.21], palmL: [0, -1, 0], palmR: [0, -1, 0],
    fingersL: [0.3, 0, 1], fingersR: [-0.3, 0, 1], elbowPoleL: [0.8, -0.2, -1], elbowPoleR: [-0.8, -0.2, -1],
    ...extra,
  };
}

/** The hip switch done slumped: hands off the floor on the thighs, back rounded, knees barely turning. */
const slump = (sw: number): Pose => hipSwitch(sw, {
  rootRot: [-30, 0, 0], spine: [26, 0, -sw * 4], lumbar: [8, 0, 0], neck: [16, 0, 0],
  handL: [0.2, 0.42, 0.26], handR: [-0.2, 0.42, 0.26], palmL: [0, -1, 0], palmR: [0, -1, 0],
  fingersL: [0, -0.2, 1], fingersR: [0, -0.2, 1], elbowPoleL: [1, -0.3, -0.6], elbowPoleR: [-1, -0.3, -0.6],
});

/**
 * Reverse lunge on the left leg (it steps back, so its hip flexor and side are stretched).
 * `d` 0 standing … 1 at the bottom of the lunge; `reach` raises the left arm overhead;
 * `tilt` is the pelvic tuck (negative arches the lower back).
 */
/** Rear foot clear of the floor, toes down, half way back. */
const STEP_AIR: Pose = { footL: [0.12, 0.1, -0.22], footRotL: [-26, 4, 0], heelL: 0 };
const revLunge = (d: number, reach = 0, tuck = 8, extra: Pose = {}): Pose => ({
  root: [0, STAND_Y - 0.15 * d, -0.09 * d], rootRot: [4 * d - tuck * 0.35 * d, 0, 0], lumbar: [tuck * 0.5 * d, 0, 0],
  footL: [0.12, 0, 0.02 - 0.48 * d], footR: [-0.12, 0, 0.02 + 0.19 * d], footRotL: [0, 4, 0], footRotR: [0, -6, 0],
  heelL: 40 * d, kneePoleL: [0.05, 0.1, 1], kneePoleR: [-0.04, 0.1, 1],
  // The left arm reaches overhead on the stretch; the right stays by the side.
  shoulderL: [10 + 158 * reach, 8 + 6 * reach, 0], elbowL: 14 - 8 * reach, shoulderR: [6, 8, 0], elbowR: 12,
  gripL: 0.15, gripR: 0.15, neck: [-2 * reach, 0, 0],
  ...extra,
});

/**
 * One lateral band step toward the left: `k` 0 … 0.5 the lead (left) foot steps out, 0.5 … 1 the
 * right foot follows. The whole stance slides back by the step, so one cycle loops seamlessly with
 * the figure centred. Knees stay soft and pressed out against the band; the trunk stays tall.
 */
function bandStep(k: number, o: { lean?: number; cave?: number } = {}): Pose {
  const lead = Math.min(1, k * 2), follow = Math.max(0, k * 2 - 1), step = 0.24, drift = step * k;
  const lx = 0.13 + step * lead - drift, rx = -0.13 + step * follow - drift;
  const air = (f: number) => (f > 0.02 && f < 0.98 ? 0.055 * Math.sin(f * Math.PI) : 0);
  const airL = air(lead), airR = air(follow);
  const lean = o.lean ?? 0;
  return {
    // The weight stays over the standing foot: during the lead step that is the right one.
    root: [airL ? -0.05 : airR ? 0.05 : 0, STAND_Y - 0.075, 0], rootRot: [8, 0, lean * (airL ? 1 : -1)],
    spine: [0, lean * 1.1 * (airL ? -1 : 1), 0],
    footL: [lx, airL, 0.02], footR: [rx, airR, 0.02],
    footRotL: [0, 2 + (o.cave ? 13 : 0), 0], footRotR: [0, -2 - (o.cave ? 13 : 0), 0],
    kneePoleL: [0.3 - (o.cave ?? 0), 0.1, 1], kneePoleR: [-0.3 + (o.cave ?? 0), 0.1, 1],
    // Hands lightly on the hips, trunk tall.
    handSpace: 'pelvis', handL: [0.17, 0.08, 0.02], handR: [-0.17, 0.08, 0.02], palmL: [-1, 0, 0], palmR: [1, 0, 0],
    fingersL: [-0.3, -0.3, 0.9], fingersR: [0.3, -0.3, 0.9], elbowPoleL: [0.8, -0.3, -1], elbowPoleR: [-0.8, -0.3, -1], gripL: 0.2, gripR: 0.2,
  };
}

/**
 * Marching on the spot: `t` 0 … 1 lifts the left knee then the right, arms swinging in opposition.
 * The feet stay over their own spot and land flat; `high` scales the knee lift.
 */
function march(t: number, o: { high?: number; lean?: number; stamp?: boolean } = {}): Pose {
  const high = o.high ?? 1, lean = o.lean ?? 3;
  // One lift per leg per cycle; a stamping march drops the foot from the top instead of lowering it.
  const rise = (p: number) => {
    const f = ((p % 1) + 1) % 1;
    if (f >= 0.5) return 0;
    const u = f * 2;
    return o.stamp ? (u < 0.75 ? Math.sin((u / 0.75) * Math.PI * 0.5) : Math.max(0, 1 - (u - 0.75) * 8)) : Math.sin(u * Math.PI);
  };
  const l = rise(t), r = rise(t + 0.5);
  const swing = Math.sin(t * 2 * Math.PI);
  const fwd = o.stamp ? 0.2 : 0.02;
  const foot = (lift: number, x: number): Vec3 => [x, 0.26 * high * lift, 0.02 + fwd * lift];
  return {
    root: [0, STAND_Y - 0.015 - 0.01 * (l + r) - (o.stamp ? 0.02 * Math.max(0, 1 - 10 * Math.min(l, r)) * 0 : 0), 0],
    rootRot: [lean, 2.5 * swing, 1.5 * (r - l)], lumbar: [lean < 0 ? lean * 1.4 : 0, 0, 0],
    footL: foot(l, 0.11), footR: foot(r, -0.11),
    footRotL: [-26 * l, 4, 0], footRotR: [-26 * r, -4, 0],
    kneePoleL: [0.12, 0.2, 1], kneePoleR: [-0.12, 0.2, 1],
    shoulderL: [-22 * swing + 10, 7, 0], shoulderR: [22 * swing + 10, 7, 0], elbowL: 34 + 10 * swing, elbowR: 34 - 10 * swing,
    gripL: 0.35, gripR: 0.35, neck: [-2, 0, 0],
  };
}

/** A pillow under the head when lying on the back, and a taller one for side-lying. */
const PILLOW = { kind: 'box', pos: [0, 0, -0.68], size: [0.42, 0.065, 0.3], material: 'cloth' } as const;
const SIDE_PILLOW = { kind: 'box', pos: [0, 0, -0.68], size: [0.3, 0.19, 0.24], material: 'cloth' } as const;

/**
 * Pelvis joint height lying on the side: the shoulder is the widest point, so this is set by it
 * and a few degrees of side-bend bring the hip down to the mat too.
 */
const SIDE_Y = 0.222;

/**
 * Side-lying quad stretch on the RIGHT side, the left (top) leg stretched. `pull` 0 … 1 eases the
 * top hip into extension and deepens the knee bend while the left hand holds that ankle; `drift`
 * flexes the top hip (the fault). The bottom knee rests forward on the mat for balance, the bottom
 * arm lies on the mat in front of the chest and the head rests on the pillow.
 *
 * Rolled onto the side by `rootTwist` −90, the pelvis's own tilt axis points at the ceiling, so
 * `rootRot`'s roll tilts the pelvis and an equal lumbar flexion holds the trunk still: `tuck` is a
 * real tailbone tuck, and a negative tuck arches the lower back (the other fault). The trunk also
 * rotates back a little, which is what lets the hand reach the ankle at all.
 */
function sideQuad(pull: number, tuck = 7, extra: Pose = {}, drift = 0): Pose {
  const hip: Vec3 = [-13 - 9 * pull + drift, 0, 0], knee = 134 + 6 * pull;
  const roll = 16 + 6 * pull;
  const l = leg('L', hip, knee);
  // The hand wraps the back of the ankle, palm against it, fingers across towards the inner side.
  const grip = add(add(l.belowKnee(SHIN - 0.01), l.front, -0.055), l.out, 0.015);
  return {
    root: [0, SIDE_Y, 0], rootRot: [-90, 0, -tuck], rootTwist: -90,
    lumbar: [tuck, 0, roll * 0.25], spine: [0, 5, roll * 0.5], thoracic: [-5 - 3 * pull, 0, roll * 0.25],
    hipL: hip, kneeL: knee, ankleL: [-16, 0],
    hipR: [40, 0, 0], kneeR: 78, ankleR: [-14, 0],
    clavL: [0, -8],
    handSpace: 'pelvis', handL: grip, palmL: l.front, fingersL: add([0, 0, 0], l.out, -1),
    elbowPoleL: [0.3, 1, -0.5], gripL: 0.8,
    shoulderR: [95, 6, 10], elbowR: 80, forearmR: 10, gripR: 0.2,
    ...extra,
  };
}

export const MOBILITY_LOWER: Clip[] = [
  {
    // Left leg: the hamstring being stretched.
    id: 'supine-hamstring-stretch-strap', view: 'side', sided: true, duration: 12, loopFrom: 0.35,
    keys: [
      // 'hold' on the first key: the loop wraps to loopFrom without easing back to the start pose.
      { t: 0, pose: strapLeg(80, 85), depth: 0, ease: 'hold' },
      { t: 0.2, pose: strapLeg(66, 8), depth: 0.6 },
      { t: 0.35, pose: strapLeg(68, 8), depth: 0.8 },
      { t: 0.68, pose: strapLeg(76, 8), depth: 1 },
      { t: 0.99, pose: strapLeg(68, 8), depth: 0.8 },
    ],
    equipment: [{ kind: 'mat', pos: [0, 0, -0.1] }, { kind: 'strap', foot: 'L' }],
    mistakes: [
      { id: 'supine-hamstring-stretch-strap.ankle-pulled-up', label: 'Ankle yanked up, knee locked', delta: { ankleL: [24, 0], kneeL: -8 }, highlight: ['calves'] },
      { id: 'supine-hamstring-stretch-strap.pelvis-curls', label: 'Pelvis curls up', delta: { rootRot: [-12, 0, 0], lumbar: [12, 0, 0], hipR: [20, 0, 0], root: [0, 0.03, 0] }, highlight: ['lowerBack'] },
    ],
  },
  {
    // Breathe out and flatten (6 s), pause, breathe in into a small arch, finish in neutral.
    id: 'pelvic-tilt', view: 'side', duration: 10, keys: tiltKeys(),
    equipment: [{ kind: 'mat', pos: [0, 0, -0.1] }, PILLOW],
    mistakes: [
      {
        id: 'pelvic-tilt.lifts-into-bridge', label: 'Lifting into a bridge', highlight: ['lowerBack', 'glutes'],
        keys: tiltKeys(tiltBase(7, { root: [0, 0.152, 0.012], rootRot: [-100, 0, 0], neck: [17, 0, 0] })),
      },
      {
        id: 'pelvic-tilt.big-arch', label: 'Arching too far', highlight: ['lowerBack'],
        // The arch opens 10 degrees further than the drill asks and the ribs flare up with it.
        keys: tiltKeys(undefined, tiltBase(-26, { neck: [6, 0, 0] })),
      },
    ],
  },
  {
    // Left knee hugged in (the affected side). Hold: ease in, then breathe.
    id: 'knee-to-chest', view: 'side', sided: true, duration: 15, loopFrom: 0.333,
    keys: [
      { t: 0, pose: kneeHug(104, 100, { clavR: [0, 22], thoracic: [0, 0, 8] }, 0.54), depth: 0, ease: 'hold' },
      { t: 0.333, pose: kneeHug(106, 104, { rootRot: [-93, 0, 0], spine: [4, 0, 0] }), depth: 0.8 },
      { t: 0.733, pose: kneeHug(111, 106, { rootRot: [-94, 0, 0], spine: [5, 0, 0] }), depth: 1 },
      { t: 0.99, pose: kneeHug(106, 104, { rootRot: [-93, 0, 0], spine: [4, 0, 0] }), depth: 0.8 },
    ],
    equipment: [{ kind: 'mat', pos: [0, 0, -0.1] }, PILLOW],
    mistakes: [
      {
        id: 'knee-to-chest.pulling-shin', label: 'Pulling on the shin', highlight: ['quads', 'lowerBack'],
        keys: [
          { t: 0, pose: kneeHug(104, 100, { clavR: [0, 22], thoracic: [0, 0, 8] }, 0.54), ease: 'hold' },
          { t: 0.333, pose: kneeHug(112, 135, { rootRot: [-95, 0, 0], spine: [6, 0, 0], ...holdShin([112, -4, 0], 135) }) },
          { t: 0.733, pose: kneeHug(116, 138, { rootRot: [-96, 0, 0], spine: [7, 0, 0], ...holdShin([116, -4, 0], 138) }) },
          { t: 0.99, pose: kneeHug(112, 135, { rootRot: [-95, 0, 0], spine: [6, 0, 0], ...holdShin([112, -4, 0], 135) }) },
        ],
      },
      {
        // The pelvis rolls back on the sacrum: the tailbone lifts and the lumbar spine rounds.
        id: 'knee-to-chest.tailbone-lifts', label: 'Tailbone lifting high', highlight: ['lowerBack'],
        delta: { rootRot: [-26, 0, 0], root: [0, 0.05, 0.01], spine: [32, 0, 0], thoracic: [-6, 0, 0], neck: [-4, 0, 0] },
      },
    ],
  },
  {
    // Left leg (the affected side): a slider, never a stretch. Knee straightens as the toes point away,
    // bends as they come back, two seconds each way.
    id: 'sciatic-nerve-glide-supine', view: 'side', sided: true, duration: 4,
    keys: [
      { t: 0, pose: glide(88, 12), depth: 0 },
      { t: 0.5, pose: glide(28, -32), depth: 1 },
    ],
    equipment: [{ kind: 'mat', pos: [0, 0, -0.1] }, PILLOW],
    mistakes: [
      {
        // A tensioner instead of a slider: hip pulled to 110°, knee locked, ankle pulled up.
        id: 'sciatic-nerve-glide-supine.thigh-pulled-too-far', label: 'Thigh pulled in, knee locked', highlight: ['hamstrings', 'calves'],
        keys: [{ t: 0, pose: glide(88, 12) }, { t: 0.5, pose: glide(0, 16, {}, 110) }],
      },
      {
        id: 'sciatic-nerve-glide-supine.head-lifts', label: 'Head and shoulders lifting', highlight: ['neck', 'abs'], constant: true,
        delta: { spine: [3, 0, 0], thoracic: [24, 0, 0], neck: [12, 0, 0], clavL: [0, 8], clavR: [0, 8] },
      },
    ],
  },
  {
    // Left leg. Straighten slowly to the first mild pull (out-breath), bend back (in-breath).
    id: 'active-knee-extension', view: 'side', sided: true, duration: 4,
    keys: [
      { t: 0, pose: ake(90), depth: 0 },
      { t: 0.5, pose: ake(26), depth: 1 },
    ],
    equipment: [{ kind: 'mat', pos: [0, 0, -0.1] }],
    mistakes: [
      { id: 'active-knee-extension.ankle-pulled-up', label: 'Ankle pulled up', delta: { ankleL: [36, 0] }, highlight: ['calves', 'hamstrings'] },
      {
        // Snaps straight in under a second, the thigh drifting off vertical, then lowers.
        id: 'active-knee-extension.kicking', label: 'Kicking the knee straight', highlight: ['hamstrings', 'quads'],
        keys: [
          { t: 0, pose: ake(90) },
          { t: 0.18, pose: ake(0, -20, {}, 79), ease: 'in' },
          { t: 0.5, pose: ake(0, -20, {}, 78) },
          { t: 0.8, pose: ake(70, -20, {}, 85) },
        ],
      },
    ],
  },
  {
    // Left ankle crossed over the right knee: the left buttock is stretched. Hold, then breathe.
    id: 'supine-figure-4', view: 'threeQuarter', sided: true, duration: 15, loopFrom: 0.333,
    keys: [
      { t: 0, pose: fig4(34.5, 69.5, { ankleR: -55 }), depth: 0, ease: 'hold' },
      { t: 0.16, pose: fig4(82, 88, { hands: 'thigh', at: 0.5, ankleR: -30 }), depth: 0.5 },
      { t: 0.333, pose: fig4(90, 90, { hands: 'thigh' }), depth: 0.8 },
      { t: 0.733, pose: fig4(96, 90, { hands: 'thigh', tilt: 1 }), depth: 1 },
      { t: 0.99, pose: fig4(90, 90, { hands: 'thigh' }), depth: 0.8 },
    ],
    equipment: [{ kind: 'mat', pos: [0, 0, -0.1] }, PILLOW],
    mistakes: [
      {
        // Thigh hauled in: the pelvis curls up off the mat and the lower back rounds.
        id: 'supine-figure-4.tailbone-lifts', label: 'Tailbone lifting', highlight: ['lowerBack'],
        keys: [
          { t: 0, pose: fig4(34.5, 69.5, { ankleR: -55 }), ease: 'hold' },
          { t: 0.16, pose: fig4(86, 88, { hands: 'thigh', at: 0.5, ankleR: -30, tilt: 6, lift: 0.012 }) },
          { t: 0.333, pose: fig4(110, 92, { hands: 'thigh', tilt: 17, lift: 0.024 }) },
          { t: 0.733, pose: fig4(114, 92, { hands: 'thigh', tilt: 19, lift: 0.027 }) },
          { t: 0.99, pose: fig4(110, 92, { hands: 'thigh', tilt: 17, lift: 0.024 }) },
        ],
      },
      {
        // Straining for a thigh that is too far away: head and shoulders curl up, breath held.
        id: 'supine-figure-4.head-lifts', label: 'Head lifting, breath held', highlight: ['neck', 'abs'],
        keys: [
          { t: 0, pose: fig4(34.5, 69.5, { ankleR: -55 }), ease: 'hold' },
          { t: 0.16, pose: fig4(72, 86, { hands: 'thigh', at: 0.62, ankleR: -30, extra: { thoracic: [16, 0, 0], neck: [24, 0, 0] } }) },
          { t: 0.333, pose: fig4(78, 88, { hands: 'thigh', at: 0.68, extra: { spine: [3, 0, 0], thoracic: [22, 0, 0], neck: [30, 0, 0], clavL: [0, 16], clavR: [0, 18] } }) },
          { t: 0.99, pose: fig4(78, 88, { hands: 'thigh', at: 0.68, extra: { spine: [3, 0, 0], thoracic: [22, 0, 0], neck: [30, 0, 0], clavL: [0, 16], clavR: [0, 18] } }) },
        ],
      },
    ],
  },
  {
    // Press up and let the back sag (6 s out-breath), lower (4 s in-breath); the hips stay down.
    id: 'prone-press-up', view: 'side', duration: 10,
    keys: [
      { t: 0, pose: press(0), depth: 0 },
      { t: 0.4, pose: press(1), depth: 1 },
      { t: 0.6, pose: press(1, { lumbar: [-26, 0, 0], root: [0, 0.12, 0] }), depth: 1 },
    ],
    equipment: [{ kind: 'mat', pos: [0, 0, 0.1] }],
    mistakes: [
      {
        // The pelvis rides up with the chest: the bend comes from the hips, not the lower back.
        id: 'prone-press-up.hips-lift', label: 'Hips lifting off the floor', highlight: ['glutes', 'lowerBack'],
        keys: [
          { t: 0, pose: press(0) },
          { t: 0.4, pose: press(1, hipsUp) },
          { t: 0.6, pose: press(1, hipsUp) },
        ],
      },
      { id: 'prone-press-up.head-thrown-back', label: 'Head thrown back', delta: { neck: [-32, 0, 0], head: [-6, 0, 0] }, highlight: ['neck'] },
    ],
  },
  {
    // Left leg (the affected side). Slider, two reps per cycle: knee straightens as the toes point
    // and the eyes look up; knee bends as the chin drops. Never held.
    id: 'sciatic-nerve-glide-seated', view: 'side', sided: true, duration: 8,
    keys: [
      { t: 0, pose: chairGlide(KNEE_BENT, null, 12), depth: 0 },
      { t: 0.25, pose: chairGlide(24, [-34, 0], -20), depth: 1 },
      { t: 0.5, pose: chairGlide(KNEE_BENT, null, 12), depth: 0 },
      { t: 0.75, pose: chairGlide(24, [-34, 0], -20), depth: 1 },
    ],
    equipment: [{ kind: 'chair', pos: [0, 0, -0.02] }],
    mistakes: [
      {
        // Slump as the knee straightens: pelvis rolls back, trunk rounds, chin to chest (the slump test).
        id: 'sciatic-nerve-glide-seated.slumping', label: 'Slumping as the knee straightens', highlight: ['lowerBack', 'neck', 'hamstrings'],
        delta: { rootRot: [-10, 0, 0], root: [0, 0, 0.02], hipL: [-10, 0, 0], spine: [20, 0, 0], lumbar: [6, 0, 0], neck: [42, 0, 0] },
      },
      {
        // A tensioner: knee locked, ankle pulled up, held still.
        id: 'sciatic-nerve-glide-seated.toes-pulled-up', label: 'Toes pulled up and held', highlight: ['calves', 'hamstrings'],
        keys: [
          { t: 0, pose: chairGlide(KNEE_BENT, null, 12) },
          { t: 0.15, pose: chairGlide(4, [18, 0], 0) },
          { t: 0.85, pose: chairGlide(4, [18, 0], 0), ease: 'linear' },
        ],
      },
    ],
  },
  {
    // Left ankle crossed over the right knee: the left buttock is stretched. Sit tall, hinge, breathe.
    id: 'seated-piriformis-stretch', view: 'threeQuarter', sided: true, duration: 15, loopFrom: 0.333,
    keys: [
      { t: 0, pose: crossSit(0), depth: 0, ease: 'hold' },
      { t: 0.333, pose: crossSit(24), depth: 0.8 },
      { t: 0.733, pose: crossSit(28), depth: 1 },
      { t: 0.99, pose: crossSit(24), depth: 0.8 },
    ],
    equipment: [{ kind: 'chair', pos: [0, 0, -0.08] }],
    mistakes: [
      {
        // Rounding over instead of hinging: pelvis rolls back, back and neck curl forward.
        id: 'seated-piriformis-stretch.slumping', label: 'Slumping, back rounded', highlight: ['lowerBack', 'upperBack', 'neck'],
        delta: { rootRot: [-16, 0, 0], root: [0, 0.004, -0.02], spine: [26, 0, 0], lumbar: [8, 0, 0], neck: [31, 0, 0] },
      },
      {
        // The hand shoves the crossed knee down and the shoulder drops with it.
        id: 'seated-piriformis-stretch.forcing-knee', label: 'Pushing the knee down', highlight: ['glutes', 'adductors'],
        delta: { kneePoleL: [0, -0.45, 0], handL: [-0.05, -0.125, 0], clavL: [-12, 0], spine: [0, 6, 0], elbowPoleL: [0.4, 0.6, 0] },
      },
    ],
  },
  {
    // Hips back only as far as is easy, forehead supported; the hips sink a touch on each out-breath.
    id: 'childs-pose', view: 'side', duration: 15, loopFrom: 0.333,
    keys: [
      { t: 0, pose: child(92, { pitch: 82, spine: 0, lumbar: 0, neck: -6, handZ: 0.5 }), depth: 0, ease: 'hold' },
      { t: 0.14, pose: child(112, { pitch: 84, spine: 6, neck: 0, handZ: 0.6 }), depth: 0.4 },
      { t: 0.333, pose: child(132, { pitch: 86, handZ: 0.66 }), depth: 0.8 },
      { t: 0.733, pose: child(136, { pitch: 84, spine: 13, handZ: 0.66 }), depth: 1 },
      { t: 0.99, pose: child(132, { pitch: 86, handZ: 0.66 }), depth: 0.8 },
    ],
    equipment: [{ kind: 'mat', pos: [0, 0, 0.1] }, { kind: 'box', pos: [0, 0, 0.36], size: [0.3, 0.09, 0.26], material: 'pad' }],
    mistakes: [
      {
        // No support: the hips stay high and the head hangs, chin tucked hard.
        id: 'childs-pose.head-hanging', label: 'Head hanging, chin tucked', highlight: ['neck'],
        keys: [
          { t: 0, pose: child(92, { pitch: 82, spine: 0, lumbar: 0, neck: -6, handZ: 0.5 }), ease: 'hold' },
          { t: 0.333, pose: child(116, { pitch: 87, spine: 10, neck: 45, handZ: 0.66 }) },
          { t: 0.733, pose: child(118, { pitch: 83, spine: 11, neck: 47, handZ: 0.66 }) },
          { t: 0.99, pose: child(116, { pitch: 84, spine: 10, neck: 45, handZ: 0.66 }) },
        ],
      },
      {
        // Knees together and the hips forced down onto the heels: knees squeezed, lower back at end range.
        id: 'childs-pose.hips-forced-to-heels', label: 'Hips forced onto the heels', highlight: ['lowerBack', 'quads'],
        keys: [
          { t: 0, pose: child(92, { pitch: 82, spine: 0, lumbar: 0, neck: -6, handZ: 0.5 }), ease: 'hold' },
          { t: 0.1, pose: child(112, { half: 0.17, pitch: 74, spine: 11, lumbar: 4, neck: -4, handZ: 0.54 }) },
          { t: 0.18, pose: child(132, { half: 0.14, pitch: 65, spine: 19, lumbar: 8, neck: -8, handZ: 0.55 }) },
          { t: 0.26, pose: child(148, { half: 0.12, pitch: 57, spine: 26, lumbar: 12, neck: -11, handZ: 0.56 }) },
          { t: 0.333, pose: child(158, { half: 0.11, pitch: 52, spine: 30, lumbar: 14, neck: -12, handZ: 0.56 }) },
          { t: 0.733, pose: child(159, { half: 0.11, pitch: 51, spine: 31, lumbar: 15, neck: -12, handZ: 0.56 }) },
          { t: 0.99, pose: child(158, { half: 0.11, pitch: 52, spine: 30, lumbar: 14, neck: -12, handZ: 0.56 }) },
        ],
      },
    ],
  },
  {
    // Left knee down: the front of the left hip is stretched. Tuck, squeeze, shift a little, breathe.
    id: 'half-kneeling-hip-flexor-stretch', view: 'side', sided: true, duration: 15, loopFrom: 0.333,
    keys: [
      { t: 0, pose: halfKneel(0, 0), depth: 0, ease: 'hold' },
      { t: 0.15, pose: halfKneel(0, 9), depth: 0.4 },
      { t: 0.333, pose: halfKneel(0.05, 9), depth: 0.8 },
      { t: 0.733, pose: halfKneel(0.065, 10), depth: 1 },
      { t: 0.99, pose: halfKneel(0.05, 9), depth: 0.8 },
    ],
    equipment: [
      { kind: 'mat', pos: [0, 0, 0.1] }, { kind: 'box', pos: [0.11, 0, -0.06], size: [0.22, CUSHION, 0.24], material: 'cloth' },
      { kind: 'chair', pos: [-0.52, 0, 0.36], yaw: -90 },
    ],
    mistakes: [
      {
        // Pelvis tips forward instead of tucking: the lower back arches and the ribs flare.
        id: 'half-kneeling-hip-flexor-stretch.back-arches', label: 'Arching the lower back', highlight: ['lowerBack'],
        delta: { rootRot: [20, 0, 0], lumbar: [-20, 0, 0], thoracic: [-6, 0, 0], neck: [4, 0, 0] },
      },
      {
        // Lunging: hips drive well forward and drop, front knee shoots past the toes, pelvis still tipped forward.
        id: 'half-kneeling-hip-flexor-stretch.over-lunge', label: 'Lunging too far forward', highlight: ['lowerBack', 'quads'],
        keys: [
          { t: 0, pose: halfKneel(0, 0), ease: 'hold' },
          { t: 0.15, pose: halfKneel(0.05, -6) },
          { t: 0.333, pose: halfKneel(0.25, -12) },
          { t: 0.733, pose: halfKneel(0.27, -13) },
          { t: 0.99, pose: halfKneel(0.25, -12) },
        ],
      },
    ],
  },
  {
    // Left leg out to the side: the left inner thigh is stretched. Rock back (out-breath), return.
    id: 'adductor-rock-back', view: 'threeQuarter', sided: true, duration: 5,
    keys: [
      { t: 0, pose: rockBack(0), depth: 0 },
      { t: 0.6, pose: rockBack(1), depth: 1 },
    ],
    equipment: [{ kind: 'mat', pos: [0.15, 0, 0.1] }],
    mistakes: [
      {
        // Rocked past the end of hip range: the pelvis tucks under and the lower back rounds.
        id: 'adductor-rock-back.back-rounds', label: 'Lower back rounding', highlight: ['lowerBack'],
        keys: [
          { t: 0, pose: rockBack(0) },
          { t: 0.6, pose: rockBack(1.35, { rootRot: [68, 0, 0], spine: [24, 0, 0], lumbar: [8, 0, 0], neck: [12, 0, 0] }) },
        ],
      },
      {
        // The straight leg rolls in: kneecap toward the floor, foot onto its inner edge.
        id: 'adductor-rock-back.leg-rolls-in', label: 'Straight leg rolling in', highlight: ['adductors', 'quads'],
        delta: { footRotL: [0, -34, -22], kneePoleL: [0, -0.7, 0] },
      },
    ],
  },
  {
    // Left leg behind: its calf is the one being stretched. Lean in as one piece, heel heavy.
    id: 'wall-calf-stretch', view: 'side', sided: true, duration: 15, loopFrom: 0.333,
    keys: [
      { t: 0, pose: wallStance(0.88, 0.012, 8, { handY: 1.3 }), depth: 0, ease: 'hold' },
      { t: 0.333, pose: wallStance(0.862, 0.05, 16, { handY: 1.3 }), depth: 0.8 },
      { t: 0.733, pose: wallStance(0.857, 0.057, 17.5, { handY: 1.3 }), depth: 1 },
      { t: 0.99, pose: wallStance(0.862, 0.05, 16, { handY: 1.3 }), depth: 0.8 },
    ],
    equipment: [WALL], ignoreForCamera: ['wall'],
    mistakes: [
      { id: 'wall-calf-stretch.heel-lifts', label: 'Back heel lifting', delta: { heelL: 9, root: [0, 0, 0.03] }, highlight: ['calves'] },
      {
        // The hips sag toward the wall and the lower back arches, breaking the head-to-heel line.
        id: 'wall-calf-stretch.hips-sag', label: 'Hips sagging, back arching', highlight: ['lowerBack'],
        delta: { root: [0, -0.02, 0.07], rootRot: [-9, 0, 0], lumbar: [-15, 0, 0], thoracic: [-4, 0, 0], neck: [-8, 0, 0] },
      },
    ],
  },
  {
    // Left leg behind: its lower calf and Achilles are stretched. Both knees bend, hips sink straight down.
    id: 'soleus-stretch', view: 'side', sided: true, duration: 15, loopFrom: 0.333,
    keys: [
      { t: 0, pose: wallStance(0.9, 0.02, 4, { zb: -0.2, zf: 0.22 }), depth: 0, ease: 'hold' },
      { t: 0.333, pose: wallStance(0.82, 0.03, 6, { zb: -0.2, zf: 0.22 }), depth: 0.8 },
      { t: 0.733, pose: wallStance(0.808, 0.032, 6, { zb: -0.2, zf: 0.22 }), depth: 1 },
      { t: 0.99, pose: wallStance(0.82, 0.03, 6, { zb: -0.2, zf: 0.22 }), depth: 0.8 },
    ],
    equipment: [WALL], ignoreForCamera: ['wall'],
    mistakes: [
      // Pushing the hips forward over the back foot instead of sinking: the heel peels off as they travel.
      { id: 'soleus-stretch.heel-lifts', label: 'Back heel lifting', delta: { heelL: 8, root: [0, 0.015, 0.05] }, highlight: ['calves'] },
      {
        // The back knee stays nearly straight and the body leans in instead of sinking.
        id: 'soleus-stretch.knee-straight', label: 'Back knee barely bending', highlight: ['calves'],
        keys: [
          { t: 0, pose: wallStance(0.9, 0.02, 4, { zb: -0.2, zf: 0.22 }), ease: 'hold' },
          { t: 0.333, pose: wallStance(0.9, 0.1, 16, { zb: -0.2, zf: 0.22 }) },
          { t: 0.733, pose: wallStance(0.898, 0.105, 17, { zb: -0.2, zf: 0.22 }) },
          { t: 0.99, pose: wallStance(0.9, 0.1, 16, { zb: -0.2, zf: 0.22 }) },
        ],
      },
    ],
  },
  {
    // Left leg in front: its ankle does the rocking. Heel stays down, knee over the middle toes.
    id: 'knee-to-wall-rock', view: 'side', sided: true, duration: 3,
    keys: [
      { t: 0, pose: rockToWall(0), depth: 0 },
      { t: 0.5, pose: rockToWall(1), depth: 1 },
    ],
    equipment: [WALL], ignoreForCamera: ['wall'],
    mistakes: [
      // Driving the knee on past the wall: the heel peels off and the whole body travels forward with it.
      { id: 'knee-to-wall-rock.heel-lifts', label: 'Front heel lifting', delta: { heelL: 8, root: [0, 0.01, 0.05] }, highlight: ['calves'] },
      { id: 'knee-to-wall-rock.knee-caves', label: 'Knee caving inward', delta: { kneePoleL: [-0.26, 0, 0], footRotL: [0, -6, -7] }, highlight: ['calves', 'gluteMed'] },
    ],
  },
  {
    // Hips back and down to a light touch on the box (2.5 s), settle, then stand (2 s).
    id: 'box-squat', view: 'threeQuarter',
    ...rep(
      boxSquat(STAND_Y, 0, 4),
      boxSquat(0.49, -0.2, 28),
      { lower: 2.5, pauseBottom: 0.5, lift: 2 },
    ),
    equipment: [{ kind: 'box', pos: [0, 0, -0.4], size: [0.52, BOX_TOP, 0.4], material: 'pad' }],
    mistakes: [
      {
        // At box contact the pelvis tucks under, the lower back rounds and the chest collapses.
        id: 'box-squat.back-rounds', label: 'Lower back rounding', highlight: ['lowerBack'],
        delta: { rootRot: [-13, 0, 0], root: [0, -0.015, 0], lumbar: [21, 0, 0], spine: [12, 0, 0], neck: [10, 0, 0] },
      },
      {
        // The last stretch of the descent is a free fall: the hips drop, the trunk rocks back, toes lift.
        id: 'box-squat.dropping', label: 'Dropping onto the box', highlight: ['lowerBack', 'glutes'],
        keys: [
          { t: 0, pose: boxSquat(STAND_Y, 0, 4) },
          { t: 0.38, pose: boxSquat(0.69, -0.1, 20) },
          { t: 0.44, pose: boxSquat(0.49, -0.22, 13, { footRotL: [-8, 12, 0], footRotR: [-8, -12, 0] }), ease: 'in' },
          { t: 0.6, pose: boxSquat(0.49, -0.22, 13, { footRotL: [-8, 12, 0], footRotR: [-8, -12, 0] }), ease: 'linear' },
        ],
      },
    ],
  },
  {
    // Hips back like closing a car door (in-breath), then drive them forward to stand tall (out-breath).
    id: 'dowel-hinge', view: 'side',
    ...rep(
      dowelHinge(2, 4),
      dowelHinge(62, 16),
      { lower: 2.5, lift: 2, pauseTop: 0.5 },
    ),
    equipment: [{ kind: 'dowel', attach: 'back' }],
    mistakes: [
      {
        // At about 60 degrees of lean the lower back rounds and the tailbone leaves the stick.
        id: 'dowel-hinge.back-rounds', label: 'Back rounding off the stick', highlight: ['lowerBack'],
        delta: { rootRot: [-14, 0, 0], lumbar: [24, 0, 0], spine: [10, 0, 0], neck: [10, 0, 0] },
      },
      {
        // Squatting instead of hinging: the knees travel forward and the hips drop, trunk upright.
        id: 'dowel-hinge.squatting', label: 'Squatting, not hinging', highlight: ['quads'],
        keys: [
          { t: 0, pose: dowelHinge(2, 4) },
          { t: 0.5, pose: dowelHinge(10, 4, { root: [0, 0.715, 0.07] }) },
          { t: 0.6, pose: dowelHinge(10, 4, { root: [0, 0.715, 0.07] }), ease: 'linear' },
        ],
      },
    ],
  },
  {
    // Knees sweep like wipers: down to one side (out-breath), up through the middle, down to the other.
    id: 'ninety-ninety-hip-switch', view: 'threeQuarter', duration: 10,
    keys: [
      { t: 0, pose: hipSwitch(0), depth: 0 },
      { t: 0.125, pose: hipSwitch(0.5), depth: 0.5 },
      { t: 0.25, pose: hipSwitch(1), depth: 1 },
      { t: 0.375, pose: hipSwitch(0.5), depth: 0.5 },
      { t: 0.5, pose: hipSwitch(0), depth: 0 },
      { t: 0.625, pose: hipSwitch(-0.5), depth: 0.5 },
      { t: 0.75, pose: hipSwitch(-1), depth: 1 },
      { t: 0.875, pose: hipSwitch(-0.5), depth: 0.5 },
    ],
    equipment: [{ kind: 'mat', pos: [0, 0, 0.05], yaw: 90 }],
    mistakes: [
      {
        // Hands come off the floor, the trunk slumps and the pelvis tucks, so the knees barely turn.
        id: 'ninety-ninety-hip-switch.back-rounds', label: 'Lower back rounding', highlight: ['lowerBack'],
        keys: [
          { t: 0, pose: slump(0) }, { t: 0.125, pose: slump(0.2) }, { t: 0.25, pose: slump(0.35) }, { t: 0.375, pose: slump(0.2) },
          { t: 0.5, pose: slump(0) }, { t: 0.625, pose: slump(-0.2) }, { t: 0.75, pose: slump(-0.35) }, { t: 0.875, pose: slump(-0.2) },
        ],
      },
      {
        // The back leg's sit bone peels off the floor and the trunk leans away from the knees.
        id: 'ninety-ninety-hip-switch.sit-bone-lifts', label: 'Back sit bone lifting', highlight: ['obliques', 'gluteMed'],
        delta: { root: [0, 0.03, 0], rootRot: [0, 0, -9], spine: [0, -20, 0], handL: [0.07, 0.05, 0.08], handR: [0.06, 0.02, 0.07] },
      },
    ],
  },
  {
    // Lying on the right side, left (top) leg stretched: tail tucked, knees level, knee eased back.
    id: 'side-lying-quad-stretch', view: 'side', sided: true, duration: 15, loopFrom: 0.333,
    keys: [
      { t: 0, pose: sideQuad(0, 2), depth: 0, ease: 'hold' },
      { t: 0.333, pose: sideQuad(0.8), depth: 0.8 },
      { t: 0.733, pose: sideQuad(0.9), depth: 1 },
      { t: 0.99, pose: sideQuad(0.8), depth: 0.8 },
    ],
    equipment: [{ kind: 'mat', pos: [0, 0, -0.1] }, SIDE_PILLOW],
    mistakes: [
      {
        // Instead of tucking, the pelvis tips the other way and the lumbar spine arches into it
        // (equal and opposite, so the trunk above it stays put) while the ribs flare.
        id: 'side-lying-quad-stretch.back-arches', label: 'Lower back arching', highlight: ['lowerBack'],
        delta: { rootRot: [0, 0, 21], lumbar: [-21, 0, 0], thoracic: [-5, 0, 0] },
      },
      {
        // The top hip flexes, so the knee drifts forward of the body line instead of easing back.
        id: 'side-lying-quad-stretch.thigh-drifts-forward', label: 'Top thigh drifting forward', highlight: ['hipFlexors', 'quads'],
        keys: [
          { t: 0, pose: sideQuad(0, 2), ease: 'hold' },
          { t: 0.333, pose: sideQuad(0.8, 7, {}, 20) },
          { t: 0.733, pose: sideQuad(0.9, 7, {}, 22) },
          { t: 0.99, pose: sideQuad(0.8, 7, {}, 20) },
        ],
      },
    ],
  },
  {
    // Left leg steps back (the side being stretched): lower, tuck, reach up, then push back to standing.
    id: 'reverse-lunge-overhead-reach', view: 'side', sided: true, duration: 6,
    keys: [
      { t: 0, pose: revLunge(0), depth: 0 },
      // Mid-step the rear foot is in the air: it travels back without scuffing along the floor.
      { t: 0.15, pose: revLunge(0.5, 0, 8, STEP_AIR), depth: 0.4 },
      { t: 0.3, pose: revLunge(1), depth: 0.8 },
      { t: 0.5, pose: revLunge(1, 1), depth: 1 },
      { t: 0.62, pose: revLunge(1, 1), depth: 1, ease: 'linear' },
      { t: 0.74, pose: revLunge(1), depth: 0.8 },
      { t: 0.82, pose: revLunge(0.5, 0, 8, STEP_AIR), depth: 0.4 },
      { t: 0.93, pose: revLunge(0), depth: 0 },
    ],
    mistakes: [
      {
        // Reaching from the lower back: the pelvis tips forward, the lumbar arches and the ribs flare.
        id: 'reverse-lunge-overhead-reach.back-arches', label: 'Arching the lower back', highlight: ['lowerBack'],
        delta: { rootRot: [16, 0, 0], lumbar: [-20, 0, 0], thoracic: [-7, 0, 0], neck: [-6, 0, 0] },
      },
      {
        // The front knee drops inward past the big toe and the hips twist that way.
        id: 'reverse-lunge-overhead-reach.knee-caves', label: 'Front knee caving inward', highlight: ['gluteMed', 'quads'],
        delta: { kneePoleR: [0.34, 0, 0], rootTwist: -9, footRotR: [0, 8, 6] },
      },
    ],
  },
  {
    // Stepping toward the left: the left foot leads and the right follows, band tension kept.
    id: 'band-walk', view: 'front', sided: true, duration: 2,
    keys: [
      { t: 0, pose: bandStep(0), depth: 0, ease: 'linear' },
      { t: 0.25, pose: bandStep(0.25), depth: 1, ease: 'linear' },
      { t: 0.5, pose: bandStep(0.5), depth: 1, ease: 'linear' },
      { t: 0.75, pose: bandStep(0.75), depth: 1, ease: 'linear' },
    ],
    equipment: [{ kind: 'band', between: 'knees' }],
    mistakes: [
      {
        // The trunk rocks over the standing leg and the pelvis hitches up on the stepping side.
        id: 'band-walk.trunk-leans', label: 'Leaning the trunk side to side', highlight: ['obliques', 'gluteMed'],
        keys: [0, 0.25, 0.5, 0.75].map(t => ({ t, pose: bandStep(t, { lean: 17 }), ease: 'linear' as const })),
      },
      {
        // The band wins: both knees fall inward and the feet turn out.
        id: 'band-walk.knees-cave', label: 'Knees caving inward', highlight: ['gluteMed', 'adductors'],
        keys: [0, 0.25, 0.5, 0.75].map(t => ({ t, pose: bandStep(t, { cave: 0.44 }), ease: 'linear' as const })),
      },
    ],
  },
  {
    // Gentle marching on the spot: one knee then the other, arms swinging, landing softly.
    id: 'march-in-place', view: 'threeQuarter', duration: 2,
    keys: Array.from({ length: 16 }, (_, i) => ({ t: i / 16, pose: march(i / 16), ease: 'linear' as const, depth: 1 })),
    mistakes: [
      {
        // The knees go above hip height by leaning the trunk back and arching the lower back.
        id: 'march-in-place.leaning-back', label: 'Leaning back to lift the knees', highlight: ['lowerBack', 'hipFlexors'],
        keys: Array.from({ length: 16 }, (_, i) => ({ t: i / 16, pose: march(i / 16, { high: 1.5, lean: -12 }), ease: 'linear' as const })),
      },
      {
        // Each foot drops from the top onto a stiff knee and lands flat with a jolt.
        id: 'march-in-place.stamping', label: 'Stamping the feet down', highlight: ['shins', 'calves'],
        keys: Array.from({ length: 16 }, (_, i) => ({ t: i / 16, pose: march(i / 16, { stamp: true, high: 0.8 }), ease: 'linear' as const })),
      },
    ],
  },
];
