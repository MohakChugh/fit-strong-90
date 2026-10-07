/** Squat, hinge, lunge and leg-machine clips. */
import type { Clip, Keyframe, Pose } from '../types';
import { addPose } from '../clip';
import { ARMS_DOWN, hookLying, LIE_Y, rep, stance, STAND_Y } from './kit';

type Tempo = { lower: number; pauseBottom?: number; lift: number; pauseTop?: number };

/**
 * One rep through via poses: `down` runs start … bottom, `up` bottom … start (default: `down` reversed).
 * Keys ease out of the start and into the bottom, and pass through the vias without stalling.
 */
function pathRep(t: Tempo, down: Pose[], up: Pose[] = [...down].reverse()): { duration: number; keys: Keyframe[] } {
  const total = t.lower + (t.pauseBottom ?? 0) + t.lift + (t.pauseTop ?? 0);
  const a = t.lower / total, b = a + (t.pauseBottom ?? 0) / total, c = b + t.lift / total;
  const n = down.length - 1, m = up.length - 1;
  const ease = (i: number, of: number): Keyframe['ease'] => (of === 1 ? 'inOut' : i === of ? 'out' : i === 1 ? 'in' : 'linear');
  const keys: Keyframe[] = [{ t: 0, pose: down[0], depth: 0, ease: ease(m, m) }];
  for (let i = 1; i <= n; i++) keys.push({ t: (a * i) / n, pose: down[i], depth: i / n, ease: ease(i, n) });
  if (b > a) keys.push({ t: b, pose: up[0], depth: 1, ease: 'linear' });
  for (let i = 1; i <= m; i++) {
    const at = b + ((c - b) * i) / m;
    if (at < 1 - 1e-6) keys.push({ t: at, pose: up[i], depth: 1 - i / m, ease: ease(i, m) });
  }
  return { duration: total, keys };
}

/**
 * Concentric-first rep (bridges, curls, calf raises, step-ups): the session plays the lift first, so the clip
 * starts at the easy end and `path` runs start … squeeze, with depth 1 on the squeeze that it teaches.
 */
const liftFirst = (t: Tempo, path: Pose[], back?: Pose[]) =>
  pathRep({ lower: t.lift, pauseBottom: t.pauseTop, lift: t.lower, pauseTop: t.pauseBottom }, path, back);

/** Fault keys: the clip's keys with each pose changed by `f` (given the key's depth). */
const morph = (keys: Keyframe[], f: (pose: Pose, depth: number, i: number) => Pose): Keyframe[] =>
  keys.map((k, i) => ({ ...k, pose: f(k.pose, k.depth ?? 0, i) }));

/** Palms flat on the mat beside the hips, fingers towards the feet. */
const palmsDown = (z: number): Pose => ({
  handL: [0.27, 0.03, z], handR: [-0.27, 0.03, z], palmL: [0, -1, 0], palmR: [0, -1, 0], fingersL: [0, 0, 1], fingersR: [0, 0, 1],
  elbowPoleL: [1, 0, 0], elbowPoleR: [-1, 0, 0],
});

/** Glute bridge: lying with heels ~30 cm from the bottom; `up` lifts to a straight shoulder–hip–knee line. */
const bridge = (up: boolean, extra: Pose = {}): Pose => hookLying({
  footL: [0.12, 0, 0.5], footR: [-0.12, 0, 0.5], kneePoleL: [0.1, 1, 0.3], kneePoleR: [-0.1, 1, 0.3], ...palmsDown(0.15),
  ...(up ? { root: [0, 0.298, -0.04], rootRot: [-121, 0, 0], neck: [45, 0, 0] } : { root: [0, LIE_Y, 0], neck: [-12, 0, 0] }),
  ...extra,
});

/** Arms hanging straight under the shoulders, overhand grip on a bar (z: bar ahead of the shoulders, x: hands out). */
const hang = (z = 0, x = 0.03, y = -0.585): Pose => ({
  handSpace: 'shoulders', handL: [x, y, z], handR: [-x, y, z], palmL: [0, 0, -1], palmR: [0, 0, -1],
  fingersL: [0, -1, 0], fingersR: [0, -1, 0], gripL: 1, gripR: 1,
});
/** Locked-straight arms on a heavy bar, hands 24 cm either side of the midline. */
const pull = (z: number): Pose => hang(z, 0.026, -0.596);

const goblet = (extra: Pose = {}): Pose => ({
  ...stance(0.17, 14),
  handSpace: 'chest', handL: [0.05, 0.1, 0.24], handR: [-0.05, 0.1, 0.24], palmL: [-1, 0, 0], palmR: [1, 0, 0],
  fingersL: [0, 1, 0.3], fingersR: [0, 1, 0.3], elbowPoleL: [0.2, -1, 0.3], elbowPoleR: [-0.2, -1, 0.3], gripL: 0.9, gripR: 0.9,
  ...extra,
});

/** Hip thrust: upper back pivoting on a 42 cm bench edge (z −0.25), hands holding the bar over the hip crease. */
const THRUST: Record<'bottom' | 'mid' | 'top', Pose> = {
  bottom: { root: [0, 0.205, -0.01], rootRot: [-33, 0, 0], neck: [12, 0, 0] },
  mid: { root: [0, 0.37, 0.0], rootRot: [-61, 0, 0], neck: [22, 0, 0] },
  top: { root: [0, 0.515, 0], rootRot: [-90, 0, 0], neck: [32, 0, 0] },
};
const thrust = (at: keyof typeof THRUST, extra: Pose = {}): Pose => ({
  footL: [0.15, 0, 0.43], footR: [-0.15, 0, 0.43], footRotL: [0, 8, 0], footRotR: [0, -8, 0], kneePoleL: [0.1, 1, 0.2], kneePoleR: [-0.1, 1, 0.2],
  handSpace: 'pelvis', handL: [0.3, -0.08, 0.17], handR: [-0.3, -0.08, 0.17], palmL: [0, 0, -1], palmR: [0, 0, -1],
  fingersL: [0, -1, 0], fingersR: [0, -1, 0], elbowPoleL: [1, 0.3, 0.6], elbowPoleR: [-1, 0.3, 0.6], gripL: 1, gripR: 1,
  ...THRUST[at],
  ...extra,
});

/** Conventional deadlift: bar over mid-foot (z 0.08), full-size plates hold it 22.5 cm up. */
const DL = {
  top: { ...stance(0.12, 7), root: [0, 0.935, 0], ...pull(0.12) } as Pose,
  thigh: { ...stance(0.12, 7), root: [0, 0.918, -0.085], rootRot: [27, 0, 0], neck: [-8, 0, 0], ...pull(-0.03) } as Pose,
  knee: { ...stance(0.12, 7), root: [0, 0.887, -0.18], rootRot: [50, 0, 0], neck: [-12, 0, 0], ...pull(-0.092) } as Pose,
  shin: { ...stance(0.12, 7), root: [0, 0.74, -0.25], rootRot: [56, 0, 0], neck: [-15, 0, 0], ...pull(-0.028) } as Pose,
  floor: { ...stance(0.12, 7), root: [0, 0.607, -0.25], rootRot: [59, 0, 0], neck: [-18, 0, 0], ...pull(-0.045) } as Pose,
};

const DEADLIFT = pathRep({ lower: 2, pauseBottom: 1, lift: 2, pauseTop: 1 }, [DL.top, DL.thigh, DL.knee, DL.shin, DL.floor]);

/** Lockout faults: hips pushed through and the trunk leaning back, the bar kept on the thighs (shoulder-space hands). */
const LEAN_BODY: Pose = { root: [0, -0.005, 0.045], rootRot: [-4, 0, 0], lumbar: [-14, 0, 0], thoracic: [-4, 0, 0], neck: [-6, 0, 0] };
const LEAN_BACK: Pose = { ...LEAN_BODY, handL: [0, 0.04, 0.125], handR: [0, 0.04, 0.125] };
/** Fault keys: `delta` added to each key with a weight chosen from the key's depth. */
const faultKeys = (keys: Keyframe[], delta: Pose, weight: (depth: number) => number) =>
  morph(keys, (pose, depth) => addPose(pose, delta, weight(depth)));
/** Weights picked from a key's depth: the start position only, everything but it, and the middle of the lift. */
const atStart = (d: number) => (d < 0.01 ? 1 : 0);
const offStart = (d: number) => (d > 0.01 ? 1 : 0);
/** Peaks halfway through the movement (a fault that shows as the lift breaks away). */
const midWay = (d: number) => 4 * d * (1 - d);

/** Trap bar: neutral grip on the high handles beside the legs, in line with the ankle bones; the plates rest on 7.5 cm blocks. */
const trapGrip = (dz = 0): Pose => ({
  handSpace: 'shoulders', handL: [0.036, -0.596, dz], handR: [-0.036, -0.596, dz], palmL: [-1, 0, 0], palmR: [1, 0, 0],
  fingersL: [0, -1, 0], fingersR: [0, -1, 0], gripL: 1, gripR: 1,
});
const TB = {
  floor: { ...stance(0.12, 8), root: [0, 0.589, -0.27], rootRot: [44, 0, 0], neck: [-14, 0, 0], ...trapGrip() } as Pose,
  mid: { ...stance(0.12, 8), root: [0, 0.8, -0.14], rootRot: [24, 0, 0], neck: [-8, 0, 0], ...trapGrip() } as Pose,
  top: { ...stance(0.12, 8), root: [0, 0.935, 0], ...trapGrip() } as Pose,
};
const TRAP_BAR = pathRep({ lower: 2, pauseBottom: 1, lift: 2, pauseTop: 1 }, [TB.top, TB.mid, TB.floor]);

/** Kettlebell deadlift: both hands on the handle; the bell sits on a 16 cm block between the feet (grip 28 cm above it). */
const kbGrip = (dz: number, dy = -0.57): Pose => ({
  handSpace: 'shoulders', handL: [-0.169, dy, dz], handR: [0.169, dy, dz], palmL: [0, 0, -1], palmR: [0, 0, -1],
  fingersL: [0, -1, 0], fingersR: [0, -1, 0], gripL: 1, gripR: 1,
});
const KB = {
  floor: { ...stance(0.17, 12), root: [0, 0.721, -0.25], rootRot: [48, 0, 0], neck: [-14, 0, 0], ...kbGrip(-0.08) } as Pose,
  mid: { ...stance(0.17, 12), root: [0, 0.85, -0.13], rootRot: [26, 0, 0], neck: [-8, 0, 0], ...kbGrip(-0.01) } as Pose,
  top: { ...stance(0.17, 12), root: [0, 0.93, 0], ...kbGrip(0.09) } as Pose,
};
const KB_DEADLIFT = pathRep({ lower: 2, pauseBottom: 1, lift: 2, pauseTop: 1 }, [KB.top, KB.mid, KB.floor]);

/** A rack: uprights behind the lifter with rails cantilevered forward at height `pin` (the bar rests on them). */
const rack = (pin: number, postZ = -0.52, reach = 0.8) => [
  ...[-0.62, 0.62].map(x => ({ kind: 'box', pos: [x, 0, postZ], size: [0.07, 2.0, 0.07], pad: true }) as const),
  ...[-0.62, 0.62].map(x => ({ kind: 'box', pos: [x, pin - 0.03, postZ + reach / 2], size: [0.05, 0.03, reach], pad: true }) as const),
];
const RP = {
  pins: { ...stance(0.12, 7), root: [0, 0.85, -0.2], rootRot: [54, 0, 0], neck: [-12, 0, 0], ...pull(-0.07) } as Pose,
  thigh: DL.thigh,
  top: DL.top,
};
const RACK_PULL = pathRep({ lower: 2, pauseBottom: 1, lift: 2, pauseTop: 1 }, [RP.top, RP.thigh, RP.pins]);

/** Cable pull-through: facing away from a low pulley, rope held between the legs with long arms. */
const ropeHands = (dy: number, dz: number): Pose => ({
  handSpace: 'shoulders', handL: [-0.17, dy, dz], handR: [0.17, dy, dz], palmL: [-1, 0, 0], palmR: [1, 0, 0],
  fingersL: [0, -1, -0.2], fingersR: [0, -1, -0.2], gripL: 1, gripR: 1,
});
const CPT = {
  mid: { ...stance(0.17, 12), root: [0, 0.9, -0.1], rootRot: [30, 0, 0], neck: [-6, 0, 0], ...ropeHands(-0.567, -0.04) } as Pose,
  bottom: { ...stance(0.17, 12), root: [0, 0.86, -0.2], rootRot: [55, 0, 0], neck: [-10, 0, 0], ...ropeHands(-0.565, -0.15) } as Pose,
  top: { ...stance(0.17, 12), root: [0, 0.93, 0.01], ...ropeHands(-0.57, 0.06) } as Pose,
};
const PULL_THROUGH = pathRep({ lower: 2, pauseBottom: 1, lift: 1, pauseTop: 1 }, [CPT.top, CPT.mid, CPT.bottom]);

/**
 * Single-leg RDL standing on the LEFT leg: the dumbbell is in the opposite (right) hand and tracks the
 * front shin, the free hand hangs, and the right leg goes from a kickstand toe to reaching straight behind.
 */
const slrdlHands: Pose = {
  handSpace: 'shoulders', handL: [0.03, -0.57, 0.02], handR: [0.05, -0.594, 0.01], palmL: [-1, 0, 0.3], palmR: [1, 0, 0],
  fingersL: [0, -1, 0], fingersR: [0, -1, 0], gripL: 0.25, gripR: 1,
};
/** Back-leg foot target along the body line, aimed past full reach so the leg stays straight. */
const reachBack = (hipY: number, hipZ: number, pitch: number): Pose => {
  const a = ((pitch - 80) * Math.PI) / 180;
  return { footR: [-0.068, hipY + Math.sin(a) * 1.3, hipZ - Math.cos(a) * 1.3], footRotR: [pitch + 8, 0, 0], heelR: 0, kneePoleR: [0, -1, 0.2] };
};
const SLRDL = {
  top: { ...slrdlHands, root: [0.04, 0.925, 0], footL: [0.08, 0, 0.02], footRotL: [0, 5, 0], footR: [-0.1, 0, -0.16], footRotR: [0, -5, 0], heelR: 24, kneePoleR: [-0.05, 0, 1] } as Pose,
  // The back foot swings back on its toe before it leaves the floor, so the toe never scuffs through it.
  step: { ...slrdlHands, root: [0.04, 0.915, -0.04], rootRot: [16, 0, 0], neck: [-4, 0, 0], footL: [0.08, 0, 0.02], footRotL: [0, 5, 0], footR: [-0.085, 0.045, -0.46], footRotR: [-22, -5, 0], heelR: 0, kneePoleR: [-0.05, -0.4, 1] } as Pose,
  mid: { ...slrdlHands, root: [0.04, 0.9, -0.1], rootRot: [40, 0, 0], neck: [-5, 0, 0], footL: [0.08, 0, 0.02], footRotL: [0, 5, 0], ...reachBack(0.9, -0.09, 40) } as Pose,
  bottom: { ...slrdlHands, root: [0.04, 0.875, -0.2], rootRot: [74, 0, 0], neck: [-8, 0, 0], footL: [0.08, 0, 0.02], footRotL: [0, 5, 0], ...reachBack(0.878, -0.209, 74) } as Pose,
};

/** Bar across the upper back (traps), hands just outside the shoulders, in chest space so it rides the trunk. */
const backBar: Pose = {
  handSpace: 'chest', handL: [0.55, 0.21, -0.06], handR: [-0.55, 0.21, -0.06], palmL: [0, 0, 1], palmR: [0, 0, 1],
  fingersL: [1, 0.15, 0], fingersR: [-1, 0.15, 0], elbowPoleL: [0.6, -1, -0.4], elbowPoleR: [-0.6, -1, -0.4], gripL: 1, gripR: 1,
};
const SQ = {
  top: { ...stance(0.19, 14), ...backBar, root: [0, STAND_Y, 0] } as Pose,
  half: { ...stance(0.19, 14), ...backBar, root: [0, 0.71, -0.14], rootRot: [20, 0, 0], neck: [-10, 0, 0] } as Pose,
  bottom: { ...stance(0.19, 14), ...backBar, root: [0, 0.52, -0.2], rootRot: [32, 0, 0], neck: [-18, 0, 0] } as Pose,
};
const BB_SQUAT = pathRep({ lower: 3, lift: 2 }, [SQ.top, SQ.half, SQ.bottom]);

/** Goblet box squat: sits back onto a 46 cm box one short step behind, weight at the breastbone. */
const BOX_TOP = 0.46;
const GBS = {
  top: goblet({ root: [0, STAND_Y, 0] }),
  half: goblet({ root: [0, 0.72, -0.16], rootRot: [22, 0, 0], neck: [-10, 0, 0] }),
  sit: goblet({ root: [0, 0.535, -0.235], rootRot: [26, 0, 0], neck: [-14, 0, 0] }),
};
const BOX_SQUAT = pathRep({ lower: 3, pauseBottom: 1, lift: 2 }, [GBS.top, GBS.half, GBS.sit]);

// ---- Split stance and lunges (the LEFT leg is always the front/working leg) ------------------

/** Dumbbells hanging at the sides, arms long. */
const carry: Pose = {
  handSpace: 'shoulders', handL: [0.055, -0.585, 0.01], handR: [-0.055, -0.585, 0.01], palmL: [-1, 0, 0], palmR: [1, 0, 0],
  fingersL: [0, -1, 0], fingersR: [0, -1, 0], gripL: 1, gripR: 1,
};

/**
 * Split stance with the left foot forward and the right heel lifted: hips between the feet, front knee
 * over the middle toes. `back` is the rear foot's flat-ankle point, `heel` its heel raise.
 */
const split = (o: { y: number; z?: number; pitch?: number; heel: number; front?: number; back?: number; extra?: Pose }): Pose => ({
  ...ARMS_DOWN, root: [0, o.y, o.z ?? -0.02], rootRot: [o.pitch ?? 5, 0, 0],
  footL: [0.1, 0, o.front ?? 0.3], footRotL: [0, 4, 0], kneePoleL: [0.06, 0, 1],
  footR: [-0.1, 0, o.back ?? -0.62], footRotR: [0, -4, 0], heelR: o.heel, kneePoleR: [0, -1, 0.3],
  ...o.extra,
});
const SPLIT = {
  top: split({ y: 0.86, heel: 34 }),
  mid: split({ y: 0.67, z: -0.01, pitch: 8, heel: 54 }),
  bottom: split({ y: 0.5, z: 0, pitch: 10, heel: 66 }),
};
const SPLIT_SQUAT = pathRep({ lower: 3, pauseBottom: 1, lift: 2 }, [SPLIT.top, SPLIT.mid, SPLIT.bottom]);

/** Rear-foot-elevated: the top of the right foot rests laces-down on a 35 cm bench, so the rear ankle stays put. */
const RFE_BENCH = 0.35;
const rfe = (y: number, z: number, pitch: number): Pose => ({
  ...ARMS_DOWN, ...carry, root: [0, y, z], rootRot: [pitch, 0, 0],
  footL: [0.1, 0, 0.3], footRotL: [0, 4, 0], kneePoleL: [0.06, 0, 1],
  footR: [-0.145, RFE_BENCH + 0.078, -0.62], footRotR: [25, 180, 0], kneePoleR: [-0.05, -0.3, 1],
});
const RFE = { top: rfe(0.88, -0.02, 6), mid: rfe(0.7, -0.01, 9), bottom: rfe(0.53, 0, 11) };
const RFE_SPLIT = pathRep({ lower: 3, pauseBottom: 1, lift: 2 }, [RFE.top, RFE.mid, RFE.bottom]);
/** Step-up onto a 28 cm box with the left foot; the right foot starts on the floor behind. */
const STEP_H = 0.28;
const stepUp = (o: { y: number; z: number; pitch: number; backFoot: Pose }): Pose => ({
  ...ARMS_DOWN, ...carry, root: [0, o.y, o.z], rootRot: [o.pitch, 0, 0],
  footL: [0.11, STEP_H, 0.3], footRotL: [0, 4, 0], kneePoleL: [0.07, 0, 1], ...o.backFoot,
});
const STEP = {
  down: stepUp({ y: 0.89, z: -0.07, pitch: 10, backFoot: { footR: [-0.11, 0, -0.14], footRotR: [0, -4, 0], kneePoleR: [-0.07, 0, 1] } }),
  lean: stepUp({ y: 0.86, z: 0.04, pitch: 18, backFoot: { footR: [-0.11, 0, -0.14], footRotR: [0, -4, 0], heelR: 16, kneePoleR: [-0.07, 0, 1] } }),
  // The trailing foot clears the box before it lands beside the lead foot.
  swing: stepUp({ y: 1.05, z: 0.17, pitch: 10, backFoot: { footR: [-0.11, 0.46, 0.14], footRotR: [0, -4, 0], kneePoleR: [-0.07, 0, 1] } }),
  up: stepUp({ y: 1.16, z: 0.24, pitch: 5, backFoot: { footR: [-0.11, STEP_H, 0.44], footRotR: [0, -4, 0], kneePoleR: [-0.07, 0, 1] } }),
};
const STEP_UP = liftFirst({ lower: 2, lift: 2 }, [STEP.down, STEP.lean, STEP.swing, STEP.up]);

/** Reverse lunge: the right foot steps back onto its ball, the left stays planted. */
const REV = {
  stand: { ...ARMS_DOWN, ...carry, ...stance(0.1, 4), root: [0, STAND_Y, 0] } as Pose,
  // The rear foot travels back through the air: a foot on the floor must never slide along it.
  swing: split({ y: 0.9, z: -0.01, pitch: 5, heel: 0, back: -0.32, extra: { ...carry, footR: [-0.1, 0.1, -0.32], footRotR: [-30, -4, 0], kneePoleR: [-0.05, -0.6, 1] } }),
  step: split({ y: 0.84, z: -0.02, pitch: 6, heel: 42, extra: carry }),
  bottom: split({ y: 0.5, z: 0, pitch: 11, heel: 66, extra: carry }),
};
const REVERSE_LUNGE = pathRep({ lower: 2, lift: 2, pauseTop: 1 }, [REV.stand, REV.swing, REV.step, REV.bottom]);

/** Walking lunge: one step forward with the left leg, down to the rear knee, then back to standing. */
const WALK = {
  stand: { ...ARMS_DOWN, ...carry, ...stance(0.1, 4), root: [0, STAND_Y, 0] } as Pose,
  // The lead foot swings forward through the air; the stance slides back only while it is up, so
  // the figure stays centred without either foot scuffing along the floor.
  swing: split({ y: 0.93, z: -0.03, pitch: 6, heel: 0, back: -0.3, front: 0.18, extra: { ...carry, footL: [0.1, 0.12, 0.18], footRotL: [-18, 4, 0], kneePoleL: [0.06, 0.3, 1] } }),
  land: split({ y: 0.9, z: -0.04, pitch: 6, heel: 0, back: -0.56, front: 0.36, extra: { ...carry, footRotL: [-14, 4, 0] } }),
  bottom: split({ y: 0.5, z: 0.06, pitch: 10, heel: 66, back: -0.56, front: 0.36, extra: carry }),
};
const WALKING = pathRep({ lower: 2, lift: 1 }, [WALK.stand, WALK.swing, WALK.land, WALK.bottom]);

// ---- Calf raises ---------------------------------------------------------------------------

/**
 * Ball of the foot on the edge of a surface at height `y`, heel free. `heel` is the heel raise about
 * the ball (negative drops the heel below the edge); returns the ankle joint position it produces.
 */
const BALL_UP = 0.063, BALL_BACK = 0.125;
const ankleOf = (y: number, z: number, heel: number) => {
  const a = (heel * Math.PI) / 180;
  return { y: y + 0.008 + BALL_UP * Math.cos(a) + BALL_BACK * Math.sin(a), z: z + 0.125 - BALL_BACK * Math.cos(a) + BALL_UP * Math.sin(a) };
};
/** Hands resting on a rail in front at hip height. */
const onRail = (y: number, z: number, half = 0.3): Pose => ({
  handL: [half, y, z], handR: [-half, y, z], palmL: [0, -1, 0], palmR: [0, -1, 0], fingersL: [0, 0, 1], fingersR: [0, 0, 1],
  elbowPoleL: [1, -0.2, -0.6], elbowPoleR: [-1, -0.2, -0.6], gripL: 1, gripR: 1,
});
const STEP_TOP = 0.15, RAIL_Y = 1.12, RAIL_Z = 0.3;
/** Standing calf raise: hips ride straight up over the ankles, knees straight but soft. */
const calfRaise = (heel: number, extra: Pose = {}): Pose => {
  const a = ankleOf(STEP_TOP, 0.025, heel);
  return {
    ...onRail(RAIL_Y, RAIL_Z), root: [0, a.y + 0.858, a.z - 0.015],
    footL: [0.11, STEP_TOP, 0.025], footR: [-0.11, STEP_TOP, 0.025], footRotL: [0, 4, 0], footRotR: [0, -4, 0],
    heelL: heel, heelR: heel, kneePoleL: [0.06, 0, 1], kneePoleR: [-0.06, 0, 1], ...extra,
  };
};
const CALF_RAISE = liftFirst({ lower: 2, pauseBottom: 2, lift: 1, pauseTop: 1 }, [calfRaise(-26), calfRaise(8), calfRaise(42)]);

/** Single-leg calf raise on the left foot; the right knee is bent so that foot hangs behind. */
const slCalf = (heel: number, extra: Pose = {}): Pose => {
  const a = ankleOf(STEP_TOP, 0.025, heel);
  return {
    ...onRail(RAIL_Y, RAIL_Z, 0.26), root: [0.06, a.y + 0.858, a.z - 0.015],
    footL: [0.09, STEP_TOP, 0.025], footRotL: [0, 4, 0], heelL: heel, kneePoleL: [0.05, 0, 1],
    hipR: [-14, 2, 0], kneeR: 74, ankleR: [-26, 0], ...extra,
  };
};
const SL_CALF = liftFirst({ lower: 2, pauseBottom: 1, lift: 1, pauseTop: 1 }, [slCalf(-26), slCalf(8), slCalf(42)]);

// ---- Machines ------------------------------------------------------------------------------

/** Seated calf raise: hips on the bench, balls of the feet on a 12 cm plate, a dumbbell resting on each thigh. */
const SEAT_H = 0.46, PLATE_H = 0.12, PLATE_Z = 0.32;
const seatedCalf = (heel: number, extra: Pose = {}): Pose => {
  const a = ankleOf(PLATE_H, PLATE_Z, heel);
  return {
    root: [0, SEAT_H + 0.072, -0.05], footL: [0.15, PLATE_H, PLATE_Z], footR: [-0.15, PLATE_H, PLATE_Z],
    footRotL: [0, 8, 0], footRotR: [0, -8, 0], heelL: heel, heelR: heel, kneePoleL: [0.1, 0.9, 0.6], kneePoleR: [-0.1, 0.9, 0.6],
    handL: [0.14, a.y + 0.535, a.z + 0.02], handR: [-0.14, a.y + 0.535, a.z + 0.02], palmL: [0, -1, 0], palmR: [0, -1, 0],
    fingersL: [0, 0, 1], fingersR: [0, 0, 1], gripL: 0.8, gripR: 0.8, elbowPoleL: [1, -0.2, -0.5], elbowPoleR: [-1, -0.2, -0.5],
    ...extra,
  };
};
const SEATED_CALF = liftFirst({ lower: 2, pauseBottom: 2, lift: 1, pauseTop: 1 }, [seatedCalf(-22), seatedCalf(6), seatedCalf(40)]);

/** Lying leg curl: face down on the pad with the hips over the hump and the knees just off its end. */
const CURL_PAD = 0.5;
const lyingCurl = (knee: number, extra: Pose = {}): Pose => ({
  root: [0, CURL_PAD + 0.127, 0.03], rootRot: [88, 0, 0], neck: [-14, 0, 0],
  hipL: [-4, 3, 0], hipR: [-4, 3, 0], kneeL: knee, kneeR: knee, ankleL: [-12, 0], ankleR: [-12, 0],
  handL: [0.28, CURL_PAD + 0.03, 0.74], handR: [-0.28, CURL_PAD + 0.03, 0.74], palmL: [0, -1, 0], palmR: [0, -1, 0],
  fingersL: [0, 0, 1], fingersR: [0, 0, 1], gripL: 1, gripR: 1, elbowPoleL: [1, 0.4, -0.3], elbowPoleR: [-1, 0.4, -0.3],
  ...extra,
});
const LYING_CURL = liftFirst({ lower: 3, lift: 1, pauseTop: 1 }, [lyingCurl(12), lyingCurl(55), lyingCurl(95)]);

/** Seated leg curl: upright in the seat, thigh pad over the knees, heels curling down and back. */
const SEAT_CURL_H = 0.58;
const seatedCurl = (knee: number, extra: Pose = {}): Pose => ({
  root: [0, SEAT_CURL_H + 0.075, -0.16], rootRot: [-12, 0, 0], neck: [10, 0, 0],
  hipL: [76, 4, 0], hipR: [76, 4, 0], kneeL: knee, kneeR: knee, ankleL: [-8, 0], ankleR: [-8, 0],
  handL: [0.3, 0.72, 0.02], handR: [-0.3, 0.72, 0.02], palmL: [0, -1, 0], palmR: [0, -1, 0],
  fingersL: [0, 0, 1], fingersR: [0, 0, 1], gripL: 1, gripR: 1, elbowPoleL: [1, 0, -0.6], elbowPoleR: [-1, 0, -0.6],
  ...extra,
});
const SEATED_CURL = liftFirst({ lower: 3, lift: 1, pauseTop: 1 }, [seatedCurl(28), seatedCurl(62), seatedCurl(95)]);

/** 45° sled leg press: hips and back on the reclined seat, feet flat on the plate up the slope. */
const SLOPE = Math.SQRT1_2;
const legPress = (dist: number, extra: Pose = {}): Pose => ({
  root: [0, 0.42, -0.22], rootRot: [-46, 0, 0], neck: [10, 0, 0],
  footL: [0.17, 0.42 + dist * SLOPE, -0.22 + dist * SLOPE], footR: [-0.17, 0.42 + dist * SLOPE, -0.22 + dist * SLOPE],
  footRotL: [135, 0, 0], footRotR: [135, 0, 0], kneePoleL: [0.12, 0.7, -0.7], kneePoleR: [-0.12, 0.7, -0.7],
  shoulderL: [8, 34, 0], shoulderR: [8, 34, 0], elbowL: 44, elbowR: 44, gripL: 0.6, gripR: 0.6,
  ...extra,
});
const LEG_PRESS = pathRep({ lower: 3, lift: 2 }, [legPress(0.84), legPress(0.72), legPress(0.6)]);

/**
 * 45° back extension: ankles behind the rollers on the foot plate, thighs on the hip pad, the body a
 * straight line at 45°. `pitch` hinges the trunk at the hips; the legs stay on the slope.
 */
const EXT_U = { y: Math.SQRT1_2, z: Math.SQRT1_2 }, EXT_N = { y: Math.SQRT1_2, z: -Math.SQRT1_2 };
const EXT_FOOT = { y: 0.131 + 0.09 * EXT_U.y, z: -0.331 + 0.09 * EXT_U.z };
const backExt = (pitch: number, o: { dist?: number; off?: number; extra?: Pose } = {}): Pose => {
  const dist = o.dist ?? 0.85, off = o.off ?? 0.142;
  const ank = { y: EXT_FOOT.y + 0.05, z: EXT_FOOT.z - 0.05 };
  return {
    root: [0, ank.y + dist * EXT_U.y + off * EXT_N.y, ank.z + dist * EXT_U.z + off * EXT_N.z], rootRot: [pitch, 0, 0], neck: [-6, 0, 0],
    footL: [0.1, EXT_FOOT.y, EXT_FOOT.z], footR: [-0.1, EXT_FOOT.y, EXT_FOOT.z], footRotL: [-45, 0, 0], footRotR: [-45, 0, 0],
    kneePoleL: [0.06, -0.7, 0.7], kneePoleR: [-0.06, -0.7, 0.7],
    // Hands resting behind the hips.
    shoulderL: [-78, 4, 22], shoulderR: [-78, 4, 22], elbowL: 92, elbowR: 92, gripL: 0.4, gripR: 0.4,
    ...o.extra,
  };
};
const BACK_EXT = liftFirst({ lower: 2, lift: 2, pauseTop: 1 }, [backExt(100), backExt(72), backExt(45)]);

export const STRENGTH_LOWER: Clip[] = [
  {
    id: 'goblet-squat', view: 'threeQuarter',
    ...rep(
      goblet({ root: [0, STAND_Y, 0] }),
      goblet({ root: [0, 0.5, -0.19], rootRot: [30, 0, 0], neck: [-16, 0, 0] }),
      { lower: 3, pauseBottom: 1, lift: 2 },
    ),
    equipment: [{ kind: 'dumbbells', hands: 'goblet' }],
    mistakes: [
      { id: 'goblet-squat.pelvis-tucks-at-bottom', label: 'Pelvis tucks under', delta: { lumbar: [20, 0, 0], rootRot: [-12, 0, 0] }, highlight: ['lowerBack'] },
      { id: 'goblet-squat.knees-caving-in', label: 'Knees cave in', delta: { kneePoleL: [-0.26, 0, 0], kneePoleR: [0.26, 0, 0] }, highlight: ['adductors', 'quads'] },
      { id: 'goblet-squat.chest-drops', label: 'Chest drops forward', delta: { rootRot: [18, 0, 0], neck: [-8, 0, 0], handL: [0, -0.06, 0.12], handR: [0, -0.06, 0.12] }, highlight: ['lowerBack', 'upperBack'] },
    ],
  },
  {
    id: 'romanian-deadlift', view: 'threeQuarter',
    // The bar slides down the thighs (via a mid-thigh pose) to just below the knees.
    ...pathRep({ lower: 3, lift: 2, pauseTop: 1 }, [
      { ...stance(0.12, 5), ...pull(0.12), root: [0, STAND_Y, 0.01] },
      { ...stance(0.12, 5), ...pull(-0.07), root: [0, 0.91, -0.11], rootRot: [36, 0, 0], neck: [-6, 0, 0] },
      { ...stance(0.12, 5), ...pull(-0.135), root: [0, 0.88, -0.2], rootRot: [66, 0, 0], neck: [-8, 0, 0] },
    ]),
    equipment: [{ kind: 'barbell' }],
    mistakes: [
      { id: 'romanian-deadlift.reaching-for-the-floor', label: 'Reaching for the floor', delta: { spine: [26, 0, 0], lumbar: [10, 0, 0], neck: [16, 0, 0] }, highlight: ['lowerBack'] },
      { id: 'romanian-deadlift.bar-drifts-forward', label: 'Bar drifts away', delta: { handL: [0, 0.03, 0.15], handR: [0, 0.03, 0.15] }, highlight: ['lowerBack', 'deltsFront'] },
      { id: 'romanian-deadlift.locked-knees', label: 'Knees locked', delta: { root: [0, 0.07, 0.03], rootRot: [8, 0, 0] }, highlight: ['hamstrings', 'lowerBack'] },
    ],
  },
  {
    id: 'glute-bridge', view: 'side',
    ...liftFirst({ lower: 2, lift: 1, pauseTop: 2 }, [bridge(false), bridge(true)]),
    equipment: [{ kind: 'mat', pos: [0, 0, -0.1] }],
    mistakes: [
      { id: 'glute-bridge.over-arching', label: 'Over-arching at the top', delta: { root: [0, 0.065, 0.01], rootRot: [3, 0, 0], lumbar: [-15, 0, 0], spine: [-6, 0, 0], thoracic: [8, 0, 0], neck: [15, 0, 0] }, highlight: ['lowerBack'] },
      { id: 'glute-bridge.feet-too-far-away', label: 'Feet too far away', constant: true, delta: { footL: [0, 0, 0.19], footR: [0, 0, 0.19] }, highlight: ['hamstrings'] },
      { id: 'glute-bridge.pushing-through-toes', label: 'Pushing through the toes', delta: { heelL: 10, heelR: 10, root: [0, -0.01, 0.06] }, highlight: ['quads'] },
    ],
  },
  {
    id: 'hip-thrust', view: 'side',
    ...liftFirst({ lower: 2, lift: 1, pauseTop: 2 }, [thrust('bottom'), thrust('mid'), thrust('top')]),
    equipment: [{ kind: 'bench', pos: [0, 0, -0.4], yaw: 90, height: 0.42 }, { kind: 'barbell', plates: 0 }],
    mistakes: [
      { id: 'hip-thrust.arching-at-the-top', label: 'Arching at the top', delta: { root: [0, 0.065, 0], rootRot: [10, 0, 0], lumbar: [-18, 0, 0], spine: [-6, 0, 0], neck: [-45, 0, 0] }, highlight: ['lowerBack', 'neck'] },
      { id: 'hip-thrust.feet-too-far-away', label: 'Feet too far away', constant: true, delta: { footL: [0, 0, 0.17], footR: [0, 0, 0.17] }, highlight: ['hamstrings'] },
      { id: 'hip-thrust.knees-caving-in', label: 'Knees cave in', delta: { kneePoleL: [-0.24, 0, 0], kneePoleR: [0.24, 0, 0] }, highlight: ['adductors', 'gluteMed'] },
    ],
  },
  {
    id: 'deadlift', view: 'threeQuarter', ...DEADLIFT,
    equipment: [{ kind: 'barbell' }],
    mistakes: [
      // The pelvis tucks as the low back rounds, so the shoulders (and the bar) stay put.
      { id: 'deadlift.rounded-lower-back', label: 'Rounding the lower back', delta: { root: [0, 0.02, 0], lumbar: [30, 0, 0], rootRot: [-24, 0, 0], neck: [14, 0, 0], handL: [0, 0, 0.02], handR: [0, 0, 0.02] }, highlight: ['lowerBack'] },
      { id: 'deadlift.bar-drifts-forward', label: 'Bar drifts away from the legs', keys: faultKeys(DEADLIFT.keys, { root: [0, 0.025, 0], rootRot: [4, 0, 0], handL: [0, 0, 0.095], handR: [0, 0, 0.095] }, offStart), highlight: ['lowerBack', 'deltsFront'] },
      { id: 'deadlift.leaning-back-at-lockout', label: 'Leaning back at the top', keys: faultKeys(DEADLIFT.keys, LEAN_BACK, atStart), highlight: ['lowerBack'] },
    ],
  },
  {
    id: 'trap-bar-deadlift', view: 'threeQuarter', ...TRAP_BAR,
    equipment: [{ kind: 'trapBar' }, ...[-0.62, 0.62].map(x => ({ kind: 'box', pos: [x, 0, 0.04], size: [0.12, 0.075, 0.32] }) as const)],
    mistakes: [
      {
        // Feet 7.5 cm forward in the frame (the handles end up behind the ankles); off the floor the trunk pitches forward to chase the bar.
        id: 'trap-bar-deadlift.off-centre-stance', label: 'Standing off-centre', highlight: ['lowerBack'],
        keys: faultKeys(faultKeys(TRAP_BAR.keys, { footL: [0, 0, 0.075], footR: [0, 0, 0.075], root: [0, 0, 0.075], handL: [0, 0, -0.075], handR: [0, 0, -0.075] }, () => 1),
          { root: [0, 0.04, 0], rootRot: [8, 0, 0], handL: [0, 0, -0.04], handR: [0, 0, -0.04] }, d => d),
      },
      { id: 'trap-bar-deadlift.rounded-lower-back', label: 'Rounding the lower back', delta: { root: [0, 0.02, 0], lumbar: [25, 0, 0], rootRot: [-20, 0, 0], neck: [15, 0, 0] }, highlight: ['lowerBack'] },
      { id: 'trap-bar-deadlift.leaning-back-at-lockout', label: 'Leaning back at the top', keys: faultKeys(TRAP_BAR.keys, LEAN_BODY, atStart), highlight: ['lowerBack'] },
    ],
  },
  {
    id: 'kettlebell-deadlift', view: 'side', ...KB_DEADLIFT,
    equipment: [{ kind: 'kettlebell' }, { kind: 'box', pos: [0, 0, 0.19], size: [0.2, 0.16, 0.62] }],
    mistakes: [
      // Hips sink to knee height with an upright trunk; the arms bend to keep the hands on the handle.
      { id: 'kettlebell-deadlift.squatting-instead-of-hinging', label: 'Squatting the bell up', delta: { root: [0, -0.17, 0.06], rootRot: [-28, 0, 0], neck: [10, 0, 0], handL: [0, 0.038, 0.117], handR: [0, 0.038, 0.117] }, highlight: ['quads', 'lowerBack'] },
      { id: 'kettlebell-deadlift.rounded-lower-back', label: 'Rounding to reach the bell', delta: { root: [0, 0.072, 0], lumbar: [26, 0, 0], rootRot: [-12, 0, 0], neck: [16, 0, 0], handL: [0, 0, -0.02], handR: [0, 0, -0.02] }, highlight: ['lowerBack'] },
      { id: 'kettlebell-deadlift.bell-too-far-forward', label: 'Bell too far in front', delta: { rootRot: [10, 0, 0], handL: [0, 0.025, 0.25], handR: [0, 0.025, 0.25], heelL: 4, heelR: 4 }, highlight: ['lowerBack'] },
    ],
  },
  {
    id: 'rack-pull', view: 'threeQuarter', ...RACK_PULL,
    equipment: [{ kind: 'barbell' }, ...rack(0.49)],
    mistakes: [
      {
        // Rounds off the pins, then the knees re-bend at mid-thigh to rest the bar on the legs.
        id: 'rack-pull.overloading-and-hitching', label: 'Overloading and hitching', highlight: ['lowerBack'],
        keys: morph(RACK_PULL.keys, (pose, depth) => (depth > 0.9 ? pose
          : depth < 0.1 ? addPose(pose, { root: [0, 0.02, 0], lumbar: [22, 0, 0], rootRot: [-16, 0, 0], neck: [14, 0, 0] }, 1)
          : addPose(pose, { root: [0, -0.055, 0.03], rootRot: [-10, 0, 0], lumbar: [10, 0, 0], handL: [0, 0.01, -0.02], handR: [0, 0.01, -0.02] }, 1))),
      },
      { id: 'rack-pull.leaning-back-at-lockout', label: 'Leaning back at the top', keys: faultKeys(RACK_PULL.keys, { root: [0, -0.008, 0.06], rootRot: [-6, 0, 0], lumbar: [-18, 0, 0], thoracic: [-5, 0, 0], neck: [-8, 0, 0], handL: [0, 0.07, 0.145], handR: [0, 0.07, 0.145] }, atStart), highlight: ['lowerBack'] },
      {
        // No pause: the bar bounces off the pins and the trunk jolts forward with it.
        id: 'rack-pull.bouncing-off-the-pins', label: 'Bouncing off the pins', highlight: ['lowerBack'],
        keys: [
          { t: 0, pose: RP.pins, depth: 0, ease: 'out' },
          { t: 0.08, pose: addPose(RP.pins, { root: [0, -0.006, -0.006], rootRot: [3, 0, 0], lumbar: [3, 0, 0], handL: [0, -0.006, 0], handR: [0, -0.006, 0] }, 1), depth: 0, ease: 'linear' },
          { t: 0.18, pose: RP.thigh, depth: 0.5, ease: 'linear' },
          { t: 0.33, pose: RP.top, depth: 1, ease: 'out' },
          { t: 0.5, pose: RP.top, depth: 1, ease: 'linear' },
          { t: 0.67, pose: RP.thigh, depth: 0.5, ease: 'in' },
          { t: 0.83, pose: RP.pins, depth: 0, ease: 'in' },
        ],
      },
    ],
  },
  {
    id: 'cable-pull-through', view: 'side', ...PULL_THROUGH, ignoreForCamera: ['cable'],
    equipment: [{ kind: 'cable', anchor: [0, 0.12, -1.0], hands: 'both', handle: 'rope' }],
    mistakes: [
      { id: 'cable-pull-through.squatting-instead-of-hinging', label: 'Squatting, not hinging', delta: { root: [0, -0.21, 0.09], rootRot: [-34, 0, 0], neck: [8, 0, 0], handL: [0, -0.015, 0.13], handR: [0, -0.015, 0.13] }, highlight: ['quads'] },
      { id: 'cable-pull-through.rounded-lower-back', label: 'Rounding at the bottom', delta: { lumbar: [20, 0, 0], spine: [8, 0, 0], neck: [18, 0, 0], handL: [0, 0.023, -0.07], handR: [0, 0.023, -0.07] }, highlight: ['lowerBack'] },
      { id: 'cable-pull-through.pulling-with-arms', label: 'Pulling with the arms', keys: faultKeys(PULL_THROUGH.keys, { handL: [0, 0.16, 0.1], handR: [0, 0.16, 0.1], clavL: [10, 0], clavR: [10, 0] }, atStart), highlight: ['biceps', 'traps'] },
    ],
  },
  {
    // Standing on the left leg; the right leg reaches back.
    id: 'single-leg-rdl', view: 'side', sided: true,
    ...pathRep({ lower: 3, lift: 2, pauseTop: 1 }, [SLRDL.top, SLRDL.step, SLRDL.mid, SLRDL.bottom]),
    equipment: [{ kind: 'dumbbells', hands: 'R' }],
    mistakes: [
      { id: 'single-leg-rdl.hips-twisting-open', label: 'Hips twist open', delta: { rootRot: [0, -16, -10], rootTwist: -6, spine: [0, 0, -10], footRotR: [0, -30, 0] }, highlight: ['gluteMed', 'obliques'] },
      { id: 'single-leg-rdl.rounded-lower-back', label: 'Rounding to reach lower', delta: { root: [0, 0.03, 0], lumbar: [25, 0, 0], spine: [6, 0, 0], neck: [20, 0, 0] }, highlight: ['lowerBack'] },
      { id: 'single-leg-rdl.locked-standing-knee', label: 'Standing knee locked', delta: { root: [-0.012, 0.05, 0.045], rootRot: [-6, 0, 0] }, highlight: ['hamstrings', 'lowerBack'] },
    ],
  },
  {
    id: 'goblet-box-squat', view: 'threeQuarter', ...BOX_SQUAT,
    equipment: [{ kind: 'dumbbells', hands: 'goblet' }, { kind: 'box', pos: [0, 0, -0.45], size: [0.5, BOX_TOP, 0.42], pad: true }],
    mistakes: [
      {
        // The last stretch of the descent happens in a flash and the trunk jolts forward as the hips land.
        id: 'goblet-box-squat.dropping-onto-the-box', label: 'Dropping onto the box', highlight: ['lowerBack'],
        keys: [
          { t: 0, pose: GBS.top, depth: 0, ease: 'out' },
          { t: 0.33, pose: goblet({ root: [0, 0.655, -0.2], rootRot: [24, 0, 0], neck: [-12, 0, 0] }), depth: 0.6, ease: 'linear' },
          { t: 0.42, pose: addPose(GBS.sit, { rootRot: [10, 0, 0], root: [0, -0.012, 0] }, 1), depth: 1, ease: 'linear' },
          { t: 0.5, pose: GBS.sit, depth: 1, ease: 'out' },
          { t: 0.67, pose: GBS.half, depth: 0.5, ease: 'in' },
          { t: 0.83, pose: GBS.top, depth: 0, ease: 'out' },
        ],
      },
      { id: 'goblet-box-squat.rocking-on-the-box', label: 'Relaxing and rocking', delta: { root: [0, 0.012, -0.03], rootRot: [-14, 0, 0], lumbar: [20, 0, 0], neck: [10, 0, 0], footRotL: [-12, 0, 0], footRotR: [-12, 0, 0] }, highlight: ['lowerBack'] },
      // A 35 cm box: in the last stretch before the hips land the pelvis tucks and the low back rounds.
      {
        id: 'goblet-box-squat.box-too-low', label: 'Box too low', highlight: ['lowerBack'],
        delta: { root: [0, -0.105, 0.015], lumbar: [20, 0, 0], rootRot: [-10, 0, 0] },
        equipment: [{ kind: 'dumbbells', hands: 'goblet' }, { kind: 'box', pos: [0, 0, -0.45], size: [0.5, 0.35, 0.42], pad: true }],
      },
    ],
  },
  {
    id: 'barbell-squat', view: 'threeQuarter', ...BB_SQUAT,
    equipment: [{ kind: 'barbell' }, ...rack(1.26, -0.95, 0.5)],
    mistakes: [
      { id: 'barbell-squat.pelvis-tucks-at-bottom', label: 'Pelvis tucks under', delta: { lumbar: [25, 0, 0], rootRot: [-14, 0, 0] }, highlight: ['lowerBack'] },
      {
        // Out of the bottom the hips shoot up first and the trunk tips further forward: a good-morning.
        id: 'barbell-squat.hips-rising-first', label: 'Hips rise first', highlight: ['lowerBack', 'hamstrings'],
        keys: morph(BB_SQUAT.keys, (pose, depth, i) => (i > 2 && depth > 0.25 ? addPose(pose, { root: [0, 0.12, -0.05], rootRot: [18, 0, 0], neck: [-6, 0, 0] }, 1) : pose)),
      },
      { id: 'barbell-squat.knees-caving-in', label: 'Knees cave in', delta: { kneePoleL: [-0.26, 0, 0], kneePoleR: [0.26, 0, 0] }, highlight: ['adductors', 'gluteMed'] },
    ],
  },
  {
    // Left leg in front throughout.
    id: 'split-squat', view: 'side', sided: true, ...SPLIT_SQUAT,
    mistakes: [
      { id: 'split-squat.front-knee-caves', label: 'Front knee caves in', delta: { kneePoleL: [-0.32, 0, 0] }, highlight: ['adductors', 'gluteMed'] },
      { id: 'split-squat.tightrope-stance', label: 'Feet on a tightrope', constant: true, delta: { footR: [0.2, 0, 0], footL: [-0.01, 0, 0], root: [0.045, 0, 0], rootRot: [0, -10, 0], spine: [0, 6, 0] }, highlight: ['gluteMed', 'obliques'] },
      { id: 'split-squat.arched-lower-back', label: 'Arching the lower back', delta: { rootRot: [13, 0, 0], lumbar: [-16, 0, 0], spine: [-8, 0, 0], neck: [-6, 0, 0] }, highlight: ['lowerBack'] },
    ],
  },
  {
    // Left leg in front, right shin on the bench.
    id: 'rear-foot-elevated-split-squat', view: 'side', sided: true, ...RFE_SPLIT,
    equipment: [{ kind: 'bench', pos: [-0.145, 0, -0.78], height: RFE_BENCH, length: 0.5 }, { kind: 'dumbbells' }],
    mistakes: [
      { id: 'rear-foot-elevated-split-squat.arched-lower-back', label: 'Arching the lower back', delta: { rootRot: [13, 0, 0], lumbar: [-16, 0, 0], spine: [-6, 0, 0], neck: [-6, 0, 0] }, highlight: ['lowerBack'] },
      { id: 'rear-foot-elevated-split-squat.front-knee-caves', label: 'Front knee caves in', delta: { kneePoleL: [-0.32, 0, 0] }, highlight: ['adductors', 'gluteMed'] },
      // Shoving the bench with the rear foot: the body pops up while the front knee stays bent.
      { id: 'rear-foot-elevated-split-squat.pushing-off-back-foot', label: 'Pushing off the back foot', keys: faultKeys(RFE_SPLIT.keys, { root: [0, 0.05, 0.03], rootRot: [-3, 0, 0] }, midWay), highlight: ['quads', 'calves'] },
    ],
  },
  {
    // Left foot leads onto the box.
    id: 'step-up', view: 'side', sided: true, ...STEP_UP,
    equipment: [{ kind: 'step', pos: [0, 0, 0.42], height: STEP_H }, { kind: 'dumbbells' }],
    mistakes: [
      // The trailing foot pushes off the floor and the body bounces before the lead knee extends.
      {
        id: 'step-up.pushing-off-bottom-leg', label: 'Pushing off the bottom leg', highlight: ['calves'],
        keys: morph(STEP_UP.keys, (pose, depth, i) => (i > 0 && depth < 0.55 ? addPose(pose, { root: [0, 0.07, -0.02], heelR: 52, footL: [0, 0, 0.03] }, 1) : pose)),
      },
      { id: 'step-up.knee-caves', label: 'Knee caves in', keys: faultKeys(STEP_UP.keys, { kneePoleL: [-0.3, 0, 0] }, midWay), highlight: ['adductors', 'gluteMed'] },
      // A 52 cm box, above knee height: the thigh starts above level, the hip folds past 100° and the pelvis tucks.
      {
        id: 'step-up.box-too-high', label: 'Box too high', highlight: ['lowerBack', 'hipFlexors'],
        keys: faultKeys(STEP_UP.keys, { footL: [0, 0.24, 0], root: [0, -0.02, -0.1], rootRot: [14, 0, 0], lumbar: [18, 0, 0], footR: [0, 0, -0.12] }, atStart),
        equipment: [{ kind: 'step', pos: [0, 0, 0.42], height: 0.52 }, { kind: 'dumbbells' }],
      },
    ],
  },
  {
    // Left leg stays in front; the right steps back.
    id: 'reverse-lunge', view: 'side', sided: true, ...REVERSE_LUNGE,
    equipment: [{ kind: 'dumbbells' }],
    mistakes: [
      // The short step is set at the moment the foot lands, so it must not creep while the foot is down.
      { id: 'reverse-lunge.step-too-short', label: 'Stepping back too short', keys: faultKeys(REVERSE_LUNGE.keys, { footR: [0, 0, 0.17], root: [0, 0, 0.1], heelL: 9 }, offStart), highlight: ['quads'] },
      { id: 'reverse-lunge.front-knee-caves', label: 'Front knee caves in', delta: { kneePoleL: [-0.32, 0, 0] }, highlight: ['adductors', 'gluteMed'] },
      { id: 'reverse-lunge.torso-pitches-forward', label: 'Torso pitches forward', delta: { rootRot: [24, 0, 0], lumbar: [14, 0, 0], neck: [16, 0, 0], handL: [0, 0.05, 0.14], handR: [0, 0.05, 0.14] }, highlight: ['lowerBack'] },
    ],
  },
  {
    // One step per cycle, the left leg leading; the rear foot returns to standing so the clip loops.
    id: 'walking-lunges', view: 'side', sided: true, ...WALKING,
    equipment: [{ kind: 'dumbbells' }],
    mistakes: [
      { id: 'walking-lunges.tightrope-stance', label: 'Walking a tightrope', constant: true, delta: { footL: [-0.1, 0, 0], footR: [0.1, 0, 0], root: [0.04, 0, 0], rootRot: [0, -10, 0], spine: [0, 6, 0] }, highlight: ['gluteMed', 'obliques'] },
      // The rear knee drops the last few centimetres fast and strikes the floor.
      {
        id: 'walking-lunges.back-knee-slams', label: 'Back knee slams down', highlight: ['quads'],
        keys: morph(WALKING.keys, (pose, depth) => (depth > 0.95 ? addPose(pose, { root: [0, -0.048, 0.008] }, 1) : pose)),
      },
      { id: 'walking-lunges.torso-pitches-forward', label: 'Torso pitches forward', delta: { rootRot: [24, 0, 0], lumbar: [12, 0, 0], neck: [16, 0, 0], handL: [0, 0.04, 0.12], handR: [0, 0.04, 0.12] }, highlight: ['lowerBack'] },
    ],
  },
  {
    id: 'calf-raises', view: 'side', ...CALF_RAISE,
    equipment: [{ kind: 'step', pos: [0, 0, 0.32], height: STEP_TOP }, { kind: 'pullupBar', height: RAIL_Y, z: RAIL_Z }],
    mistakes: [
      {
        // Straight back up out of the stretch with no pause at the bottom.
        id: 'calf-raises.bouncing', label: 'Bouncing at the bottom', highlight: ['calves'],
        keys: [
          { t: 0, pose: calfRaise(-26), depth: 0, ease: 'linear' },
          { t: 0.1, pose: calfRaise(8), depth: 0.5, ease: 'linear' },
          { t: 0.2, pose: calfRaise(42), depth: 1, ease: 'out' },
          { t: 0.4, pose: calfRaise(42), depth: 1, ease: 'linear' },
          { t: 0.7, pose: calfRaise(8), depth: 0.5, ease: 'in' },
          { t: 0.9, pose: calfRaise(-26), depth: 0, ease: 'linear' },
        ],
      },
      {
        // Heels never drop below the step and rise only halfway: about 15° of ankle movement.
        id: 'calf-raises.half-reps', label: 'Half reps', highlight: ['calves'],
        keys: liftFirst({ lower: 2, pauseBottom: 2, lift: 1, pauseTop: 1 }, [calfRaise(2), calfRaise(9), calfRaise(17)]).keys,
      },
      { id: 'calf-raises.rolling-out', label: 'Rolling onto the little toes', delta: { footRotL: [0, 0, -13], footRotR: [0, 0, 13] }, highlight: ['calves', 'feet'] },
    ],
  },
  {
    // Standing on the left foot.
    id: 'single-leg-calf-raise', view: 'side', sided: true, ...SL_CALF,
    equipment: [{ kind: 'step', pos: [0, 0, 0.32], height: STEP_TOP }, { kind: 'pullupBar', height: RAIL_Y, z: RAIL_Z }],
    mistakes: [
      {
        // No pause in the stretch, and the knee flicks to help the rise.
        id: 'single-leg-calf-raise.bouncing', label: 'Bouncing out of the stretch', highlight: ['calves'],
        keys: [
          { t: 0, pose: slCalf(-26), depth: 0, ease: 'linear' },
          { t: 0.1, pose: slCalf(6, { kneePoleL: [0.05, 0, 1], root: [0.06, ankleOf(STEP_TOP, 0.025, 6).y + 0.8, ankleOf(STEP_TOP, 0.025, 6).z - 0.015] }), depth: 0.5, ease: 'linear' },
          { t: 0.2, pose: slCalf(42), depth: 1, ease: 'out' },
          { t: 0.45, pose: slCalf(42), depth: 1, ease: 'linear' },
          { t: 0.7, pose: slCalf(8), depth: 0.5, ease: 'in' },
          { t: 0.9, pose: slCalf(-26), depth: 0, ease: 'linear' },
        ],
      },
      { id: 'single-leg-calf-raise.leaning-on-rail', label: 'Leaning on the rail', constant: true, delta: { rootRot: [12, 0, 0], root: [0, -0.02, 0.05], spine: [0, -6, 0], clavL: [0, 8], clavR: [0, 8] }, highlight: ['forearms', 'biceps'] },
      { id: 'single-leg-calf-raise.rolling-out', label: 'Rolling onto the little toes', delta: { footRotL: [0, 0, -13] }, highlight: ['calves', 'feet'] },
    ],
  },
  {
    id: 'seated-calf-raise', view: 'side', ...SEATED_CALF,
    equipment: [
      { kind: 'bench', pos: [0, 0, -0.12], height: SEAT_H, length: 0.6 },
      { kind: 'box', pos: [0, 0, PLATE_Z + 0.26], size: [0.5, PLATE_H, 0.3] },
      { kind: 'dumbbells' },
    ],
    mistakes: [
      {
        // Straight out of the stretch with no pause at the bottom.
        id: 'seated-calf-raise.bouncing', label: 'Bouncing at the bottom', highlight: ['calves'],
        keys: [
          { t: 0, pose: seatedCalf(-22), depth: 0, ease: 'linear' },
          { t: 0.1, pose: seatedCalf(6), depth: 0.5, ease: 'linear' },
          { t: 0.2, pose: seatedCalf(40), depth: 1, ease: 'out' },
          { t: 0.4, pose: seatedCalf(40), depth: 1, ease: 'linear' },
          { t: 0.7, pose: seatedCalf(6), depth: 0.5, ease: 'in' },
          { t: 0.9, pose: seatedCalf(-22), depth: 0, ease: 'linear' },
        ],
      },
      {
        // Heels never drop below the plate: about 20° of ankle movement instead of 60.
        id: 'seated-calf-raise.half-reps', label: 'Half reps', highlight: ['calves'],
        keys: liftFirst({ lower: 2, pauseBottom: 2, lift: 1, pauseTop: 1 }, [seatedCalf(2), seatedCalf(10), seatedCalf(22)]).keys,
      },
      { id: 'seated-calf-raise.pushing-with-hands', label: 'Pushing with the hands', delta: { handL: [0, 0.055, 0], handR: [0, 0.055, 0], clavL: [6, 0], clavR: [6, 0] }, highlight: ['forearms', 'traps'] },
    ],
  },
  {
    id: 'lying-leg-curl', view: 'side', ...LYING_CURL,
    equipment: [
      { kind: 'bench', pos: [0, 0, 0.26], height: CURL_PAD, length: 1.1 },
      { kind: 'box', pos: [0, CURL_PAD, 0.02], size: [0.34, 0.02, 0.26], pad: true },
      { kind: 'pad', follow: 'ankles', roller: true, size: [0.3, 0.11, 0.11], offset: [0, 0.035, 0.075], material: 'steel' },
      { kind: 'machine', model: 'legCurl', pos: [0, 0, 0.1] },
    ],
    mistakes: [
      { id: 'lying-leg-curl.hips-lifting', label: 'Hips lift off the pad', keys: faultKeys(LYING_CURL.keys, { root: [0, 0.075, 0], rootRot: [-7, 0, 0], lumbar: [-16, 0, 0] }, d => Math.max(0, (d - 0.4) / 0.6)), highlight: ['lowerBack'] },
      {
        // Whipped up in under half a second, bouncing off the stop and jolting the hips.
        id: 'lying-leg-curl.swinging', label: 'Swinging the weight up', highlight: ['lowerBack', 'hamstrings'],
        keys: [
          { t: 0, pose: lyingCurl(12), depth: 0, ease: 'linear' },
          { t: 0.08, pose: lyingCurl(104, { root: [0, CURL_PAD + 0.157, 0.03], lumbar: [-10, 0, 0] }), depth: 1, ease: 'linear' },
          { t: 0.16, pose: lyingCurl(88), depth: 0.9, ease: 'out' },
          { t: 0.3, pose: lyingCurl(95), depth: 1, ease: 'linear' },
          { t: 0.6, pose: lyingCurl(55), depth: 0.5, ease: 'linear' },
          { t: 0.9, pose: lyingCurl(12), depth: 0, ease: 'linear' },
        ],
      },
      { id: 'lying-leg-curl.knees-off-pivot', label: 'Knees up on the bench', constant: true, delta: { root: [0, 0, 0.07] }, highlight: ['hamstrings'] },
    ],
  },
  {
    id: 'hamstring-curl', view: 'side', ...SEATED_CURL,
    equipment: [
      { kind: 'bench', pos: [0, 0, -0.16], height: SEAT_CURL_H, length: 0.5 },
      { kind: 'box', pos: [0, 0.602, -0.325], size: [0.42, 0.08, 0.52], pitch: 74, pad: true },
      { kind: 'box', pos: [0, 0.728, 0.12], size: [0.34, 0.07, 0.16], pad: true },
      { kind: 'pad', follow: 'ankles', roller: true, size: [0.3, 0.11, 0.11], offset: [0, -0.03, -0.075], material: 'steel' },
      { kind: 'machine', model: 'legCurl', pos: [0, 0, -0.1] },
    ],
    mistakes: [
      { id: 'hamstring-curl.knee-off-pivot', label: 'Knee ahead of the pivot', constant: true, delta: { root: [0, 0, 0.055] }, highlight: ['hamstrings'] },
      {
        // The first part of the curl is jerked through while the trunk rocks back and then forward.
        id: 'hamstring-curl.swinging', label: 'Swinging the weight', highlight: ['lowerBack'],
        keys: [
          { t: 0, pose: seatedCurl(28), depth: 0, ease: 'linear' },
          { t: 0.08, pose: seatedCurl(74, { rootRot: [-26, 0, 0], root: [0, SEAT_CURL_H + 0.075, -0.19] }), depth: 0.8, ease: 'linear' },
          { t: 0.2, pose: seatedCurl(95, { rootRot: [-2, 0, 0], root: [0, SEAT_CURL_H + 0.075, -0.13] }), depth: 1, ease: 'out' },
          { t: 0.4, pose: seatedCurl(95), depth: 1, ease: 'linear' },
          { t: 0.7, pose: seatedCurl(62), depth: 0.5, ease: 'linear' },
          { t: 0.9, pose: seatedCurl(28), depth: 0, ease: 'linear' },
        ],
      },
      { id: 'hamstring-curl.slumping', label: 'Slumping forward', constant: true, delta: { root: [0, 0.008, 0.03], rootRot: [7, 0, 0], spine: [24, 0, 0], thoracic: [8, 0, 0], neck: [22, 0, 0], kneeL: -10, kneeR: -10 }, highlight: ['lowerBack', 'upperBack'] },
    ],
  },
  {
    id: 'leg-press', view: 'side', ...LEG_PRESS,
    equipment: [
      { kind: 'box', pos: [0, 0.28, -0.2], size: [0.42, 0.06, 0.42], pad: true },
      { kind: 'box', pos: [0, 0.467, -0.523], size: [0.44, 0.08, 0.72], pitch: 45, pad: true },
      { kind: 'pad', follow: 'feet', size: [0.58, 0.2, 0.38], offset: [0, 0.095, 0.07], pitch: -135, material: 'frame' },
      // Rails up the 45° slope: the sled (the plate) travels along them, so it only lines up with the feet at the top.
      ...[-0.46, 0.46].map(x => ({ kind: 'box', pos: [x, 0.5, -0.1], size: [0.07, 0.07, 1.5], pitch: -45, pad: true }) as const),
      { kind: 'machine', model: 'legPress', pos: [0, 0, -0.1] },
    ],
    mistakes: [
      { id: 'leg-press.pelvis-tucks-at-bottom', label: 'Pelvis tucks at the bottom', delta: { root: [0, 0.028, -0.028], rootRot: [14, 0, 0], lumbar: [20, 0, 0], neck: [6, 0, 0] }, highlight: ['lowerBack'] },
      { id: 'leg-press.locking-the-knees', label: 'Knees snap straight', keys: faultKeys(LEG_PRESS.keys, { footL: [0, 0.05, 0.05], footR: [0, 0.05, 0.05] }, atStart), highlight: ['quads'] },
      { id: 'leg-press.knees-caving-in', label: 'Knees cave in', keys: faultKeys(LEG_PRESS.keys, { kneePoleL: [-0.34, 0, 0], kneePoleR: [0.34, 0, 0] }, midWay), highlight: ['adductors', 'gluteMed'] },
    ],
  },
  {
    id: 'back-extension-45', view: 'side', ...BACK_EXT,
    equipment: [{ kind: 'backExtensionBench', pos: [0, 0, 0] }],
    mistakes: [
      { id: 'back-extension-45.arching-at-the-top', label: 'Arching past straight', delta: { rootRot: [-20, 0, 0], lumbar: [-14, 0, 0], neck: [-24, 0, 0] }, highlight: ['lowerBack', 'neck'] },
      // Curling over the pad instead of hinging: the pelvis stays put and the spine rolls down.
      { id: 'back-extension-45.curling-over-the-pad', label: 'Curling over the pad', keys: faultKeys(BACK_EXT.keys, { rootRot: [-26, 0, 0], lumbar: [26, 0, 0], spine: [16, 0, 0], neck: [30, 0, 0] }, atStart), highlight: ['lowerBack', 'upperBack'] },
      // Sitting 7 cm lower on the frame puts the pad edge across the belly, so only the lumbar spine moves.
      { id: 'back-extension-45.pad-too-high', label: 'Pad set too high', keys: morph(BACK_EXT.keys, (pose, depth) => addPose(addPose(pose, { root: [0, -0.05, -0.05] }, 1), { rootRot: [-30, 0, 0], lumbar: [30, 0, 0], spine: [10, 0, 0], neck: [20, 0, 0] }, 1 - depth)), highlight: ['lowerBack'] },
    ],
  },
];
