/** Core, carry and cardio clips. */
import type { Clip, Equipment, Keyframe, Pose, Vec3 } from '../types';
import { kneel, LIE_Y, quadruped, rep, stance, STAND_Y, supine } from './kit';

// ---- Shared helpers --------------------------------------------------------

const DEG = Math.PI / 180;
const norm = (a: Vec3): Vec3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const add = (a: Vec3, b: Vec3, k = 1): Vec3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mix = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** Rotate about X by `deg` (the pitch direction: + tips +Y towards +Z). */
const pitchV = (v: Vec3, deg: number): Vec3 => { const c = Math.cos(deg * DEG), s = Math.sin(deg * DEG); return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c]; };
const smooth = (a: number, b: number, t: number) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
/** A machine frame part (metal). */
const part = (pos: Vec3, size: Vec3, more: { pitch?: number } = {}): Equipment => ({ kind: 'box', pos, size, material: 'frame', ...more });
/** An upholstered part: a seat, a backrest or a pedal the body rests on. */
const soft = (pos: Vec3, size: Vec3, more: { pitch?: number } = {}): Equipment => ({ kind: 'box', pos, size, material: 'pad', ...more });

/**
 * Shoulder joints for a pose that only bends forward and back (no twist or
 * side-bend, clavicles neutral): lets world hand targets stay within reach.
 */
function shoulders(root: Vec3, pitch: number, spine = 0, lumbar = 0, thoracic = 0): [Vec3, Vec3] {
  const a1 = pitch + spine * 0.45 + lumbar, a2 = a1 + spine * 0.3, a3 = a2 + spine * 0.25 + thoracic;
  const s3 = add(add(add(root, pitchV([0, 0.084, -0.031], pitch)), pitchV([0, 0.057, 0.008], a1)), pitchV([0, 0.058, -0.008], a2));
  return [add(s3, pitchV([0.214, 0.242, 0.046], a3)), add(s3, pitchV([-0.214, 0.242, 0.046], a3))];
}

/** A settled hold that breathes: `hold` at `from`, then gentle inhale/exhale keys, ending on `hold` so it loops from `from`. */
function breathe(from: number, hold: Pose, inhale: Pose, breaths = 3): Keyframe[] {
  const keys: Keyframe[] = [];
  const span = (0.998 - from) / breaths;
  for (let b = 0; b < breaths; b++) {
    keys.push({ t: from + b * span, pose: hold, depth: 1 });
    keys.push({ t: from + (b + 0.45) * span, pose: inhale, depth: 1 });
  }
  keys.push({ t: 0.998, pose: hold, depth: 1 });
  return keys;
}

/**
 * Both hands on one short handle at `at`, arms reaching along `reach`: fingers
 * along the arms, palms facing each other across the handle (thumbs up).
 */
function twoHands(at: Vec3, reach: Vec3, gap = 0.085): Pose {
  const d = norm(reach);
  const p = norm(cross(d, [0, 1, 0]));
  return {
    handL: add(at, p, -gap / 2), handR: add(at, p, gap / 2), palmL: p, palmR: [-p[0], -p[1], -p[2]],
    fingersL: d, fingersR: d, gripL: 1, gripR: 1,
  };
}

// ---- Walking ---------------------------------------------------------------

interface GaitOpts {
  /** How far each foot travels under the body while it is planted (about one step), m. */
  stride?: number;
  /** Walking surface height (floor 0, treadmill belt 0.17). */
  floor?: number;
  /** Pelvis tilt forward, degrees. */
  lean?: number;
  /** Toes-up angle as the heel strikes, degrees. */
  toeUp?: number;
  /** Half the distance between the feet. */
  width?: number;
  /** Moves the whole walker along z. */
  shift?: number;
  /** Feet placed this much further back under the hips (−) or ahead (+). */
  trail?: number;
  /** Longest hip-to-ankle distance on a planted leg (0.862 keeps the knee soft, ~11°). */
  reach?: number;
  /** Strides in one clip cycle. */
  cycles?: number;
  /** Arms for the swing phase: cos(2πu) = 1 when the left heel strikes. */
  arms?: (c: number, u: number) => Pose;
  extra?: (c: number, u: number) => Pose;
}

/**
 * Walking in place (or on a belt): each foot lands heel first with the toes up,
 * rolls flat, slides back under the hips, peels off heel first and swings
 * through. The pelvis is lowest in double support and capped so a planted leg
 * never has to reach further than it can; it turns, tilts and shifts a little
 * over the stance leg, with the chest counter-rotating.
 */
function gait(o: GaitOpts = {}): Keyframe[] {
  const S = o.stride ?? 0.6, floor = o.floor ?? 0, up0 = o.toeUp ?? 10, w = o.width ?? 0.1, cycles = o.cycles ?? 1;
  const n = 16 * cycles, lmax = o.reach ?? 0.862, shift = o.shift ?? 0, trail = o.trail ?? 0;
  const foot = (phase: number) => {
    const p = ((phase % 1) + 1) % 1;
    if (p < 0.6) return { z: S / 2 - (p / 0.6) * S, lift: 0, up: up0 * Math.max(0, 1 - p / 0.1), heel: p > 0.38 ? 40 * ((p - 0.38) / 0.22) ** 1.6 : 0, down: true };
    const s = (p - 0.6) / 0.4;
    return { z: -S / 2 + S * (0.5 - 0.5 * Math.cos(Math.PI * s)), lift: 0.055 * Math.sin(Math.PI * s), up: s > 0.6 ? (up0 * (s - 0.6)) / 0.4 : 0, heel: s < 0.35 ? 40 * (1 - s / 0.35) : 0, down: false };
  };
  // Ankle joint for a foot state: toes up pivot under the ankle; a raised heel pivots on the ball.
  const ankle = (f: ReturnType<typeof foot>, x: number, z: number): Vec3 => f.heel
    ? [x, f.lift + 0.008 + 0.141 * Math.sin((26.6 + f.heel) * DEG), z + 0.126 - 0.141 * Math.cos((26.6 + f.heel) * DEG)]
    : [x, f.lift + 0.0011 * f.up + 0.071 * Math.cos(f.up * DEG), z - 0.071 * Math.sin(f.up * DEG)];
  const keys: Keyframe[] = [];
  for (let k = 0; k < n; k++) {
    const t = k / n, u = (t * cycles) % 1, c = Math.cos(2 * Math.PI * u), sn = Math.sin(2 * Math.PI * u);
    const l = foot(u), r = foot(u + 0.5);
    const zl = shift + trail + l.z, zr = shift + trail + r.z, rx = 0.012 * sn;
    let ry = 0.94 - 0.04 * (0.5 + 0.5 * Math.cos(4 * Math.PI * (u - 0.02)));
    for (const [f, x, z] of [[l, w, zl], [r, -w, zr]] as const) {
      if (!f.down) continue;
      const a = ankle(f, x, z), dx = rx + Math.sign(x) * 0.108 - a[0], dz = shift - 0.01 - a[2];
      ry = Math.min(ry, a[1] + Math.sqrt(Math.max(0, lmax * lmax - dx * dx - dz * dz)) + 0.006);
    }
    const pose: Pose = {
      root: [rx, floor + ry, shift], rootRot: [o.lean ?? 2, -4 * c, 3 * sn], spine: [0, 0, 6 * c],
      footL: [w, floor + l.lift + 0.0011 * l.up, zl], footR: [-w, floor + r.lift + 0.0011 * r.up, zr],
      footRotL: [-l.up, 6, 0], footRotR: [-r.up, -6, 0], heelL: l.heel, heelR: r.heel,
      ...(o.arms ? o.arms(c, u) : { shoulderL: [-18 * c, 7, 0], shoulderR: [18 * c, 7, 0], elbowL: 24 - 10 * c, elbowR: 24 + 10 * c, gripL: 0.35, gripR: 0.35 }),
      ...o.extra?.(c, u),
    };
    keys.push({ t, pose, ease: 'linear', depth: 1 });
  }
  return keys;
}

/** Treadmill belt height. */
const TREAD = 0.17;
/** Side handrails, ~0.9 m above the belt, running back from the console posts. */
const TREAD_RAILS: Equipment[] = [part([0.36, 1.06, 0.56], [0.04, 0.04, 0.46]), part([-0.36, 1.06, 0.56], [0.04, 0.04, 0.46])];
/** Hands gripping the front of the rails with the elbows locked. */
const RAIL_GRIP: Pose = {
  handL: [0.36, 1.115, 0.72], handR: [-0.36, 1.115, 0.72], palmL: [0, -1, 0], palmR: [0, -1, 0], fingersL: [0, -0.3, 1], fingersR: [0, -0.3, 1],
  gripL: 1, gripR: 1, elbowPoleL: [1, -0.2, -1], elbowPoleR: [-1, -0.2, -1],
};

/** Brisk-walk arms: elbows bent ~85°, swinging from the shoulders, opposite to the legs. */
const briskArms = (c: number): Pose => ({
  shoulderL: [-28 * c, 8, 0], shoulderR: [28 * c, 8, 0], elbowL: 84 - 6 * c, elbowR: 84 + 6 * c, gripL: 0.45, gripR: 0.45,
});

/** A weight hanging straight under the shoulder in a neutral grip (`z` swings it forward). */
const hangingWeight = (side: 'L' | 'R', z = 0): Pose => side === 'L'
  ? { handL: [0.035, -0.585, z], palmL: [-1, 0, 0], fingersL: [0, -1, 0], gripL: 1 }
  : { handR: [-0.035, -0.585, z], palmR: [1, 0, 0], fingersR: [0, -1, 0], gripR: 1 };

/** Suitcase carry with the weight in the LEFT hand; the free arm swings a little. */
const suitcaseArms = (c: number, z = 0): Pose => ({
  handSpace: 'shoulders', ...hangingWeight('L', z), shoulderR: [15 * c, 9, 0], elbowR: 20 + 8 * c, gripR: 0.35,
});
const farmerArms: Pose = { handSpace: 'shoulders', ...hangingWeight('L'), ...hangingWeight('R'), clavL: [-3, -4], clavR: [-3, -4] };

/** Stooping to the weights with straight knees and a rounded back (the farmer-carry pickup fault). */
const stoop: Pose = {
  ...farmerArms, root: [0, 0.89, -0.17], rootRot: [85, 0, 0], lumbar: [28, 0, 0], thoracic: [24, 0, 0], neck: [22, 0, 0],
  ...stance(0.12, 6, 0.02),
};
const standCarry: Pose = { ...farmerArms, root: [0, STAND_Y, 0], rootRot: [1, 0, 0], ...stance(0.12, 6, 0.02) };

// ---- Bird dog --------------------------------------------------------------

/**
 * Bird dog for the left leg (and right arm). The reaching hand stays on an IK
 * target the whole way (mat → mid-air → long reach) and the kneeling leg hands
 * over to FK at a pose where both agree, so neither pops nor dips through the mat.
 */
const birdDogArm = (at: Vec3, fingers: Vec3): Pose => ({ handR: at, palmR: [1, 0, 0], fingersR: fingers, gripR: 1, elbowPoleR: [-0.6, -0.5, -1] });
/** Kneeling leg in FK, matching what the `kneel` IK target gives: the handover is invisible. */
const KNEE_DOWN: Pose = { kneeAimL: undefined, hipL: [84, 0, 0], kneeL: 90, ankleL: [-62, 0] };
const birdDogDown: Pose = quadruped(KNEE_DOWN);
const birdDogLift: Pose = quadruped({
  kneeAimL: undefined, hipL: [58, 0, 0], kneeL: 74, ankleL: [-30, 0],
  ...birdDogArm([-0.25, 0.26, 0.76], [-0.05, -0.5, 0.86]),
});
const birdDogOut: Pose = quadruped({
  root: [0.01, 0.475, 0], kneeAimL: undefined, hipL: [-6, 0, 0], kneeL: 4, ankleL: [12, 0],
  ...birdDogArm([-0.286, 0.505, 1.029], [-0.07, 0, 1]), neck: [-8, 0, 0],
});

// ---- Pallof press ----------------------------------------------------------

/** Cable on the figure's LEFT, chest high, about 1.15 m away. */
const PALLOF_ANCHOR: Vec3 = [1.15, 1.21, 0.18];
/** Clasped hands on the handle (left hand on top), thumbs up, `z` in front of the breastbone. */
const pallofHands = (z: number, extra: Pose = {}): Pose => ({
  handL: [0.018, 1.22, z], handR: [-0.018, 1.18, z], palmL: [-1, 0, 0], palmR: [1, 0, 0],
  fingersL: [-0.25, 0, 1], fingersR: [0.25, 0, 1], gripL: 1, gripR: 1,
  elbowPoleL: [0.35, -1, -0.2], elbowPoleR: [-0.35, -1, -0.2], ...extra,
});
const pallof = (z: number, extra: Pose = {}): Pose => ({ root: [0, STAND_Y, 0], ...stance(0.15, 6, 0.01), ...pallofHands(z), ...extra });

// ---- Cable chop --------------------------------------------------------------

/** High pulley at about head height, on the figure's LEFT, one long step away. */
const CHOP_ANCHOR: Vec3 = [1.0, 1.72, 0.2];
const CHOP_FEET: Pose = { footL: [0.24, 0, 0.02], footR: [-0.24, 0, 0.02], footRotL: [0, 12, 0], footRotR: [0, -8, 0] };
const CHOP_HIGH: Vec3 = [0.44, 1.56, 0.2];
const CHOP_LOW: Vec3 = [-0.27, 0.92, 0.22];
/** Start: weight on the near (left) leg, hips and chest turned to the pulley, arms long. */
const chopStart = (extra: Pose = {}): Pose => ({
  root: [0.05, STAND_Y - 0.005, 0], rootRot: [0, 20, 0], thoracic: [0, 0, 18], ...CHOP_FEET,
  ...twoHands(CHOP_HIGH, sub(CHOP_ANCHOR, CHOP_HIGH)), elbowPoleL: [0.3, -1, -0.6], elbowPoleR: [-0.3, -1, -0.6], ...extra,
});
/** The punched-down finish of a yank: arms long again but the hips never turned, so the hands stay nearer the midline. */
const yankEnd: Pose = {
  root: [-0.02, STAND_Y - 0.01, 0], rootRot: [0, 0, 0], thoracic: [0, 0, -16], clavL: [12, 0], clavR: [12, 0], ...CHOP_FEET,
  ...twoHands([-0.2, 1.0, 0.3], [-0.3, -0.85, 0.42]), elbowPoleL: [0.5, -0.3, -1], elbowPoleR: [-0.5, -0.3, -1],
};

/** Rounded, stooped version of the finish: the hands reach below the far knee with the knees nearly straight. */
const chopStooped: Pose = {
  root: [-0.07, 0.9, -0.09], rootRot: [62, -26, 0], lumbar: [25, 0, 0], spine: [14, 0, 0], thoracic: [0, 0, -8], neck: [20, 0, 0],
  ...CHOP_FEET, ...twoHands([-0.27, 0.42, 0.44], [-0.05, -0.9, 0.42]), elbowPoleL: [0.5, -0.3, -1], elbowPoleR: [-0.5, -0.3, -1],
};

/** Finish beside the far (right) hip: the left heel has lifted and pivoted, so the hips turned with the chest. */
const chopEnd = (extra: Pose = {}): Pose => ({
  root: [-0.07, STAND_Y - 0.015, 0.01], rootRot: [0, -30, 0], thoracic: [0, 0, -14], ...CHOP_FEET,
  footL: [0.24, 0, 0.022], footRotL: [0, -16, 0], heelL: 34,
  ...twoHands(CHOP_LOW, [-0.25, -0.9, 0.3]), elbowPoleL: [0.4, -0.3, -1], elbowPoleR: [-0.2, -0.3, -1], ...extra,
});

// ---- Cable crunch ----------------------------------------------------------

/** Rope on a high pulley in front, the stack ~45 cm ahead of the knees. */
const CRUNCH_ANCHOR: Vec3 = [0, 2.05, 0.6];
/** Kneeling tall facing the stack, rope ends held beside the head (wrists at the temples). */
const crunch = (flex: number, extra: Pose = {}): Pose => ({
  ...kneel(0), kneeL: 95, kneeR: 95, ankleL: [-63, 0], ankleR: [-63, 0],
  root: [0, 0.485, -0.035], rootRot: [10, 0, 0], spine: [flex, 0, 0], neck: [6 + flex * 0.12, 0, 0],
  handSpace: 'chest', handL: [0.1, 0.43, 0.12], handR: [-0.1, 0.43, 0.12], palmL: [-0.9, 0, -0.4], palmR: [0.9, 0, -0.4],
  fingersL: [0, 0.7, 0.7], fingersR: [0, 0.7, 0.7], elbowPoleL: [0.3, -0.4, 1], elbowPoleR: [-0.3, -0.4, 1], gripL: 1, gripR: 1,
  ...extra,
});

// ---- Hanging knee raise ----------------------------------------------------

const BAR_Y = 2.2;
/** Palm-centre line under the bar (overhand grip) that the body pivots about. */
const BAR: Vec3 = [0, BAR_Y - 0.015, -0.02];
const hang = (extra: Pose = {}): Pose => ({
  root: [0, 1.162, 0], handL: [0.27, BAR[1], BAR[2]], handR: [-0.27, BAR[1], BAR[2]], palmL: [0, 0, 1], palmR: [0, 0, 1],
  fingersL: [0, 1, 0], fingersR: [0, 1, 0], gripL: 1, gripR: 1, elbowPoleL: [0.4, 0, -1], elbowPoleR: [-0.4, 0, -1],
  clavL: [-4, 0], clavR: [-4, 0], hipL: [4, 2, 0], hipR: [4, 2, 0], kneeL: 10, kneeR: 10, ankleL: [-20, 0], ankleR: [-20, 0],
  ...extra,
});
/** The hanging body turned `deg` about the bar as one piece (+ swings the feet back). */
function swingAbout(pose: Pose, deg: number): Pose {
  const r = pose.root ?? [0, 1, 0], rr = pose.rootRot ?? [0, 0, 0];
  return { ...pose, root: add(BAR, pitchV(sub(r, BAR), deg)), rootRot: [rr[0] + deg, rr[1], rr[2]] };
}
/** Knees at hip height, pelvis curled up slightly; the body settles ~4° about the bar to keep its balance. */
const hangTop = (extra: Pose = {}): Pose => swingAbout(hang({ rootRot: [-8, 0, 0], lumbar: [8, 0, 0], hipL: [95, 2, 0], hipR: [95, 2, 0], kneeL: 92, kneeR: 92, ankleL: [-12, 0], ankleR: [-12, 0], ...extra }), 4);

// ---- Russian twist ---------------------------------------------------------

/** Sitting on the mat, leaning back ~40° with a long spine, heels down, a light weight held at the chest. */
const twistSeat = (extra: Pose = {}): Pose => ({
  root: [0, 0.115, 0], rootRot: [-38, 0, 0], neck: [8, 0, 0],
  footL: [0.13, 0, 0.56], footR: [-0.13, 0, 0.56], footRotL: [0, 8, 0], footRotR: [0, -8, 0], kneePoleL: [0.15, 1, 0], kneePoleR: [-0.15, 1, 0],
  handSpace: 'chest', handL: [0.075, 0.17, 0.28], handR: [-0.075, 0.17, 0.28], palmL: [-1, 0, 0], palmR: [1, 0, 0],
  fingersL: [0, 0.6, 0.8], fingersR: [0, 0.6, 0.8], gripL: 0.85, gripR: 0.85, elbowPoleL: [0.6, -1, 0], elbowPoleR: [-0.6, -1, 0],
  ...extra,
});
/** Chest turned `deg` to the left (− right), ribs and weight together; mostly through the upper back. */
const twisted = (deg: number, extra: Pose = {}): Pose => twistSeat({ spine: [0, 0, deg * 0.75], thoracic: [0, 0, deg * 0.4], ...extra });
/** Hands carried round the chest by `deg` while the chest stays square (`drop` lowers them towards the floor). */
function swungHands(deg: number, drop = 0, r = 0.29): Pose {
  const s = Math.sin(deg * DEG), c = Math.cos(deg * DEG), m: Vec3 = [r * s, 0.17 - drop, r * c], p: Vec3 = [c, 0, -s];
  return { handL: add(m, p, 0.075), handR: add(m, p, -0.075), palmL: [-c, 0, s], palmR: [c, 0, -s], fingersL: norm([s, 0.6, c]), fingersR: norm([s, 0.6, c]) };
}
const twistKeys = (turn: (side: 1 | -1) => Pose, mid: Pose = twistSeat()): Keyframe[] => [
  { t: 0, pose: mid, depth: 0 }, { t: 0.2, pose: turn(1), depth: 1 }, { t: 0.4, pose: mid, depth: 0 },
  { t: 0.5, pose: mid, depth: 0 }, { t: 0.7, pose: turn(-1), depth: 1 }, { t: 0.9, pose: mid, depth: 0 },
];

// ---- Pedalling -------------------------------------------------------------

interface Crank { cy: number; cz: number; r: number; width: number }
/** Foot IK with the sole under the ball of the foot on the pedal at `q`, the foot pitched `pitch` (+ toes down). */
function onPedal(q: Vec3, pitch: number, side: 'L' | 'R'): Pose {
  const a = pitch * DEG, fwd: Vec3 = [0, -Math.sin(a), Math.cos(a)], up: Vec3 = [0, Math.cos(a), Math.sin(a)];
  const f = add(add(q, up, 0.015), fwd, -0.126);
  return side === 'L' ? { footL: f, footRotL: [pitch, 0, 0] } : { footR: f, footRotR: [pitch, 0, 0] };
}
/**
 * One crank revolution: pedals 180° apart on a circle in the YZ plane, φ = 0 at
 * the top and moving forward; `pitch(φ)` is the foot angle through the stroke.
 */
function pedalling(k: Crank, base: Pose, pitch: (phi: number) => number, extra?: (phi: number) => Pose, n = 16): Keyframe[] {
  const keys: Keyframe[] = [];
  const at = (a: number, x: number): Vec3 => [x, k.cy + k.r * Math.cos(a), k.cz + k.r * Math.sin(a)];
  for (let i = 0; i < n; i++) {
    const phi = (2 * Math.PI * i) / n;
    keys.push({ t: i / n, ease: 'linear', depth: 1, pose: {
      ...base, ...onPedal(at(phi, k.width), pitch(phi), 'L'), ...onPedal(at(phi + Math.PI, -k.width), pitch(phi + Math.PI), 'R'), ...extra?.(phi),
    } });
  }
  return keys;
}
/** Ankle angle through an upright pedal stroke: near level at the top, toes ~20° down at the bottom. */
const uprightPitch = (phi: number) => 13 - 7.5 * Math.cos(phi) - 4 * Math.sin(phi);

/** Upright bike prop: crank centre and radius from the 'bike' frame, whose saddle top is 0.95 and bar top 1.12. */
const BIKE: Crank = { cy: 0.32, cz: 0.18, r: 0.17, width: 0.1 };
/** The bike plus the stem that carries its handlebar; `saddleUp` raises the saddle for a setup fault. */
const bikeRig = (saddleUp = 0, extra: Equipment[] = []): Equipment[] => [
  { kind: 'bike' }, part([0, 0.06, 0.42], [0.05, 1.02, 0.05]),
  ...(saddleUp ? [part([0, 0.95, -0.2], [0.06, saddleUp, 0.06]), soft([0, 0.95 + saddleUp, -0.2], [0.24, 0.06, 0.3])] : []),
  ...extra,
];
/** A second, lower handlebar: what a rider slumps over when the bars sit below saddle height. */
const LOW_BARS: Equipment[] = [part([0, 0.84, 0.44], [0.42, 0.035, 0.035]), part([0.21, 0.84, 0.42], [0.035, 0.035, 0.06]), part([-0.21, 0.84, 0.42], [0.035, 0.035, 0.06])];
/** Sitting on the saddle (top 0.95), hinged ~20° forward from the hips with a long spine, light hands on the bars. */
const bikeRider = (saddleUp = 0, extra: Pose = {}): Pose => ({
  root: [0, 1.03 + saddleUp, -0.262], rootRot: [20, 0, 0], neck: [-14, 0, 0],
  handL: [0.2, 1.135, 0.415], handR: [-0.2, 1.135, 0.415], palmL: [0, -1, 0], palmR: [0, -1, 0],
  fingersL: [0, -0.45, 0.9], fingersR: [0, -0.45, 0.9], gripL: 0.55, gripR: 0.55, elbowPoleL: [0.5, -0.3, -1], elbowPoleR: [-0.5, -0.3, -1],
  ...extra,
});

/**
 * Recumbent bike built from blocks: seat top 0.52, backrest reclined 22°, side
 * handles, crank housing ahead. `dz` slides the seat along its rail (− is further
 * from the pedals), so a seat set wrong is a prop change, not a pose change.
 */
const REC: Crank = { cy: 0.4, cz: 0.33, r: 0.17, width: 0.1 };
const SEAT_Z = -0.37;
const recumbentRig = (dz = 0): Equipment[] => {
  const z = SEAT_Z + dz;
  return [
    part([0, 0, -0.05], [0.16, 0.08, 1.35]), part([0, 0.08, z], [0.1, 0.36, 0.1]), part([0, 0.4, z], [0.6, 0.04, 0.04]),
    soft([0, 0.44, z], [0.44, 0.08, 0.4]), soft([0, 0.5, z - 0.18], [0.44, 0.62, 0.08], { pitch: -22 }),
    part([0.29, 0.44, z], [0.03, 0.14, 0.03]), part([-0.29, 0.44, z], [0.03, 0.14, 0.03]),
    part([0.29, 0.58, z + 0.06], [0.035, 0.035, 0.3]), part([-0.29, 0.58, z + 0.06], [0.035, 0.035, 0.3]),
    part([0, 0.08, REC.cz], [0.1, 0.08, 0.2]), part([0, 0.16, REC.cz], [0.08, 0.48, 0.48]),
    part([0, 0.64, REC.cz + 0.12], [0.06, 0.42, 0.06]), part([0, 1.03, REC.cz + 0.12], [0.32, 0.05, 0.2], { pitch: -35 }),
  ];
};
/**
 * Reclined against the backrest with the hips all the way back, hands resting on
 * the side handles. `dz` follows the seat; `slide` pushes the pelvis forward off
 * the backrest (what happens when the pedals are too far away).
 */
const recRider = (dz = 0, slide = 0, extra: Pose = {}): Pose => ({
  root: [0, 0.6, SEAT_Z - 0.04 + dz + slide], rootRot: [-22, 0, 0], neck: [12, 0, 0],
  handL: [0.29, 0.615, SEAT_Z + 0.04 + dz], handR: [-0.29, 0.615, SEAT_Z + 0.04 + dz],
  palmL: [0, -1, 0], palmR: [0, -1, 0], fingersL: [0, 0, 1], fingersR: [0, 0, 1],
  gripL: 0.35, gripR: 0.35, elbowPoleL: [0.6, -0.2, -1], elbowPoleR: [-0.6, -0.2, -1], ...extra,
});
/** Foot roughly square to the shin, pushing through the whole foot. */
const recPitch = (phi: number) => -58 - 8 * Math.sin(phi);

// ---- Elliptical ------------------------------------------------------------

/** Console, fixed handles and the rear drive housing added to the 'elliptical' frame. */
/** Pedal top: the long foot platforms sit at the bottom of the foot path, so the feet ride on them. */
const ELL_PEDAL = 0.2;
const ELLIPTICAL: Equipment[] = [
  { kind: 'elliptical' }, part([0, 1.42, 0.56], [0.4, 0.06, 0.24], { pitch: -30 }),
  part([0.18, 1.22, 0.45], [0.035, 0.035, 0.24]), part([-0.18, 1.22, 0.45], [0.035, 0.035, 0.24]), part([0, 1.22, 0.56], [0.4, 0.035, 0.035]),
  part([0, 0.06, -0.62], [0.34, 0.34, 0.3]),
  soft([0.1, ELL_PEDAL - 0.06, -0.04], [0.14, 0.04, 0.58]), soft([-0.1, ELL_PEDAL - 0.06, -0.04], [0.14, 0.04, 0.58]),
];
/** Hands resting lightly on the fixed handles. */
const ELL_HANDS: Pose = {
  handL: [0.18, 1.27, 0.44], handR: [-0.18, 1.27, 0.44], palmL: [0, -1, 0], palmR: [0, -1, 0], fingersL: [0, -0.2, 1], fingersR: [0, -0.2, 1],
  gripL: 0.4, gripR: 0.4, elbowPoleL: [0.5, -0.5, -1], elbowPoleR: [-0.5, -0.5, -1],
};
/**
 * One elliptical stride: each foot (flat on its pedal) travels a tilted oval,
 * back along the low side while it pushes, forward along the high side.
 */
function ellipticalStride(o: { heel?: number; lift?: number; hands?: Pose; trunk?: Pose; caving?: boolean } = {}): Keyframe[] {
  const keys: Keyframe[] = [];
  // A long, shallow oval along the pedal: 44 cm of travel, rising ~3 cm as the foot comes forward.
  const at = (th: number, x: number): Vec3 => [x, ELL_PEDAL + 0.015 * (1 + Math.cos(th)) - 0.018 * Math.sin(th), -0.04 + 0.18 * Math.cos(th)];
  const push = (a: number) => Math.max(0, Math.sin(a));
  for (let i = 0; i < 16; i++) {
    const u = i / 16, th = 2 * Math.PI * u, c = Math.cos(th), s = Math.sin(th);
    keys.push({ t: u, ease: 'linear', depth: 1, pose: {
      root: [0, 1.095 + 0.008 * Math.cos(2 * th) + (o.lift ?? 0), -0.03], rootRot: [2, -3 * c, 2 * s], spine: [0, 0, 4 * c], neck: [-4, 0, 0],
      footL: at(th, 0.1), footR: at(th + Math.PI, -0.1), footRotL: [-6 * c, 4, 0], footRotR: [6 * c, -4, 0], heelL: o.heel ?? 0, heelR: o.heel ?? 0,
      ...(o.caving ? { kneePoleL: [-0.3 * push(th), 0, 1], kneePoleR: [0.3 * push(th + Math.PI), 0, 1], hipL: [0, 0, -10 * push(th)], hipR: [0, 0, -10 * push(th + Math.PI)] } : {}),
      ...ELL_HANDS, ...o.hands, ...o.trunk,
    } });
  }
  return keys;
}

// ---- Rowing ----------------------------------------------------------------

/** Rower additions: footplates, the seat rail and its slide, a handle with a strap back to the fan. */
const ROW_CHAIN: Vec3 = [0, 0.5, 0.86];
const ROWER: Equipment[] = [
  { kind: 'rower' }, soft([0.1, 0.17, 0.66], [0.13, 0.02, 0.3], { pitch: -45 }), soft([-0.1, 0.17, 0.66], [0.13, 0.02, 0.3], { pitch: -45 }),
  part([0, 0.22, 0.05], [0.12, 0.07, 1.6]), part([0, 0.06, -0.72], [0.1, 0.16, 0.06]), soft([0, 0.29, -0.08], [0.3, 0.06, 0.6]),
  { kind: 'handle', length: 0.44 }, { kind: 'band', anchor: ROW_CHAIN, hands: 'L' },
];
const ROW_SEAT_Y = 0.445;
/** Feet strapped to the plates (sole on the plate, 45°). */
const ROW_FEET: Pose = {
  footL: [0.1, 0.142, 0.604], footR: [-0.1, 0.142, 0.604], footRotL: [-45, 0, 0], footRotR: [-45, 0, 0], kneePoleL: [0.1, 1, 0.3], kneePoleR: [-0.1, 1, 0.3],
};
interface StrokeOpts {
  catchZ?: number; finishZ?: number; catchLean?: number; finishLean?: number;
  /** Extra [spine, lumbar, thoracic] flexion (+) or arch (−) at the catch and at the finish. */
  catchBend?: Vec3; finishBend?: Vec3;
  /** Bend the arms before the seat moves (the arms-first fault). */
  armsEarly?: boolean;
  /** Handle height at the finish above the seat (lower ribs ≈ 0.26). */
  finishHigh?: number;
  elbowsHigh?: boolean;
  /** How far the hands reach at the catch, m from the shoulder. */
  reach?: number;
}
/**
 * One stroke: the drive is legs, then body swing, then arms (finishing at the
 * lower ribs); the recovery reverses it, arms, body, then knees.
 */
function rowStroke(o: StrokeOpts = {}): Keyframe[] {
  const T = [0, 0.04, 0.08, 0.12, 0.16, 0.2, 0.24, 0.28, 0.32, 0.36, 0.42, 0.48, 0.55, 0.62, 0.7, 0.78, 0.86, 0.93];
  const catchZ = o.catchZ ?? 0.19, finishZ = o.finishZ ?? -0.265, cl = o.catchLean ?? 24, fl = o.finishLean ?? -12;
  const cb = o.catchBend ?? [0, 0, 0], fb = o.finishBend ?? [0, 0, 0], reach = o.reach ?? 0.565;
  return T.map(t => {
    const legs = t <= 0.36 ? smooth(o.armsEarly ? 0.08 : 0, o.armsEarly ? 0.26 : 0.22, t) : 1 - smooth(0.58, 1, t);
    const body = t <= 0.36 ? smooth(o.armsEarly ? 0.16 : 0.1, o.armsEarly ? 0.3 : 0.28, t) : 1 - smooth(0.45, 0.62, t);
    const arms = t <= 0.36 ? (o.armsEarly ? 0.65 * smooth(0, 0.08, t) + 0.35 * smooth(0.26, 0.36, t) : smooth(0.2, 0.36, t)) : 1 - smooth(0.36, 0.5, t);
    const root: Vec3 = [0, ROW_SEAT_Y, catchZ + (finishZ - catchZ) * legs];
    const lean = cl + (fl - cl) * body, bend = mix(cb, fb, body);
    const [shL, shR] = shoulders(root, lean, bend[0], bend[1], bend[2]);
    const straight = (sh: Vec3, x: number): Vec3 => { const h = add(sh, norm(sub([x, ROW_CHAIN[1], ROW_CHAIN[2]], sh)), reach); return [x, h[1], Math.min(h[2], 0.78)]; };
    const ribs = (x: number): Vec3 => add(root, pitchV([x, o.finishHigh ?? 0.26, 0.31], lean + bend[0] + bend[1]));
    const hand = (sh: Vec3, x: number) => mix(straight(sh, x), ribs(x * 0.8), arms);
    const heel = 22 * (1 - smooth(0, 0.35, legs));
    const pose: Pose = {
      root, rootRot: [lean, 0, 0], spine: [bend[0], 0, 0], lumbar: [bend[1], 0, 0], thoracic: [bend[2], 0, 0], neck: [4 - lean * 0.55, 0, 0],
      ...ROW_FEET, heelL: heel, heelR: heel,
      handL: hand(shL, 0.21), handR: hand(shR, -0.21), palmL: [0, -1, 0.25], palmR: [0, -1, 0.25], fingersL: [0, -0.25, 1], fingersR: [0, -0.25, 1],
      gripL: 0.75, gripR: 0.75,
      elbowPoleL: o.elbowsHigh ? [0.9, 0.5, -0.5] : [0.5, -0.5, -1], elbowPoleR: o.elbowsHigh ? [-0.9, 0.5, -0.5] : [-0.5, -0.5, -1],
    };
    return { t, pose, ease: 'linear' as const, depth: 1 };
  });
}

// ---- Forearm plank ---------------------------------------------------------

/** Forearm plank: elbows under the shoulders, forearms flat, toes tucked, shoulder, hip and ankle joints in one line. */
const PLANK_ARMS: Pose = {
  handL: [0.13, 0.012, 0.77], handR: [-0.13, 0.012, 0.77], palmL: [0, -1, 0], palmR: [0, -1, 0],
  fingersL: [-0.15, 0, 1], fingersR: [0.15, 0, 1], elbowPoleL: [0.15, -1, 0], elbowPoleR: [-0.15, -1, 0], gripL: 0.05, gripR: 0.05,
};
const plank = (extra: Pose = {}): Pose => ({
  root: [0, 0.228, 0], rootRot: [80.5, 0, 0], neck: [-10, 0, 0],
  footL: [0.1, 0, -1.03], footR: [-0.1, 0, -1.03], heelL: 76, heelR: 76,
  ...PLANK_ARMS, ...extra,
});
/** Prone on the forearms with the toes tucked, hips on the mat: where the lift starts. */
const plankDown = plank({ root: [0, 0.118, 0], rootRot: [67, 0, 0] });
const plankIn = plank({ root: [0, 0.230, 0], thoracic: [-1.5, 0, 0] });

// ---- Side plank -----------------------------------------------------------

/**
 * Side plank on the knees, lying on the LEFT forearm: elbow under the
 * shoulder, knees bent 90°, top hand on the hip, a straight line from the
 * head to the knees.
 */
const sidePlank = (extra: Pose = {}): Pose => ({
  root: [0, 0.29, 0], rootRot: [0, 0, -65], neck: [0, 0, 0],
  hipL: [0, -9.5, 0], hipR: [0, -11.5, 0], kneeL: 90, kneeR: 90, ankleL: [-45, 15], ankleR: [-25, 0],
  handL: [0.49, 0.035, 0.37], palmL: [0, -1, 0], fingersL: [0, 0, 1], elbowPoleL: [0, -1, 0], gripL: 0.15,
  shoulderR: [0, 35, -30], elbowR: 95, forearmR: 30, gripR: 0.3,
  ...extra,
});
/** Hips resting on the mat, propped on the same forearm (the waist side-bends): where the lift starts. */
const sidePlankDown = sidePlank({ root: [0, 0.19, 0], rootRot: [0, 0, -72], spine: [0, -26, 0], hipL: [0, -17, 0], hipR: [0, -2.5, 0] });
const sidePlankIn = sidePlank({ root: [0, 0.292, 0], thoracic: [-1.5, 0, 0] });

// ---- McGill curl-up -------------------------------------------------------

/** Lying on the back, right knee bent, left leg straight, hands under the small of the back, elbows on the mat. */
const curl = (lift: number, extra: Pose = {}): Pose => supine({
  footR: [-0.12, 0, 0.6], kneePoleR: [0, 1, 0], hipL: [0, 4, 0], kneeL: 2,
  handL: [0.065, 0.024, -0.12], handR: [-0.065, 0.024, -0.12], palmL: [0, -1, 0], palmR: [0, -1, 0],
  fingersL: [-0.8, 0, 0.6], fingersR: [0.8, 0, 0.6], elbowPoleL: [1, -0.1, 0], elbowPoleR: [-1, -0.1, 0],
  thoracic: [lift, 0, 0], spine: [lift * 0.2, 0, 0],
  ...extra,
});

// ---- Dead bug ------------------------------------------------------------

/** Dead bug for the LEFT leg (and right arm): arms up, hips and knees at 90°, lower back resting on the mat. */
const bugStart = (extra: Pose = {}): Pose => supine({
  hipL: [90, 0, 0], hipR: [90, 0, 0], kneeL: 90, kneeR: 90, ankleL: [-12, 0], ankleR: [-12, 0],
  shoulderL: [90, 6, 0], shoulderR: [90, 6, 0], elbowL: 4, elbowR: 4, gripL: 0.25, gripR: 0.25,
  ...extra,
});
const bugOut = (extra: Pose = {}): Pose => bugStart({ hipL: [7, 0, 0], kneeL: 5, ankleL: [-20, 0], shoulderR: [172, 6, 0], ...extra });
/** The jolt at each change of direction when rushing: the lower back lifts ~2 cm and the trunk shakes. */
const JOLT: Pose = { lumbar: [-9, 0, 0], rootRot: [-84, 0, 0], root: [0, LIE_Y + 0.014, 0], neck: [12, 0, 0] };
/** Rushing: four reps in the time of one, dropping in ~0.7 s and bouncing at both ends. */
const bugRushed: Keyframe[] = [0, 1, 2, 3].flatMap(r => {
  const t = r / 4;
  return [
    { t, pose: bugStart() },
    { t: t + 0.088, pose: bugOut(), ease: 'in' as const },
    { t: t + 0.11, pose: bugOut({ ...JOLT, hipL: [16, 0, 0] }), ease: 'out' as const },
    { t: t + 0.2, pose: bugStart(), ease: 'in' as const },
    { t: t + 0.222, pose: bugStart({ ...JOLT, hipL: [96, 0, 0], shoulderR: [84, 6, 0] }), ease: 'out' as const },
  ];
});

export const CORE_CARDIO: Clip[] = [
  {
    id: 'bird-dog', view: 'side', sided: true, duration: 14,
    keys: [
      { t: 0, pose: quadruped(), depth: 0 },
      // Hand and knee leave the mat first, then the arm and leg reach long; the return mirrors it.
      { t: 0.03, pose: birdDogDown, depth: 0 },
      { t: 0.09, pose: birdDogLift, depth: 0.45 },
      { t: 0.17, pose: birdDogOut, depth: 1 },
      { t: 0.5, pose: { ...birdDogOut, ankleL: [16, 0] }, depth: 1 },
      { t: 0.83, pose: birdDogOut, depth: 1 },
      { t: 0.91, pose: birdDogLift, depth: 0.45 },
      { t: 0.97, pose: birdDogDown, depth: 0 },
    ],
    equipment: [{ kind: 'mat', pos: [0, 0, 0.1] }],
    mistakes: [
      { id: 'bird-dog.leg-too-high', label: 'Leg lifted too high', delta: { rootRot: [6, 0, 0], hipL: [-24, 0, 0], lumbar: [-12, 0, 0] }, highlight: ['lowerBack'] },
      { id: 'bird-dog.hip-rotation', label: 'Hip opens up', delta: { rootTwist: 12, spine: [0, 0, -10], hipL: [-5, 0, 22], root: [0, -0.004, 0] }, highlight: ['obliques', 'gluteMed'] },
      { id: 'bird-dog.head-up', label: 'Head lifted', delta: { neck: [-26, 0, 0] }, highlight: ['neck'] },
    ],
  },
  {
    id: 'treadmill-walk', view: 'side', duration: 1.15, keys: gait({ floor: TREAD }),
    equipment: [{ kind: 'treadmill' }, ...TREAD_RAILS],
    mistakes: [
      { id: 'treadmill-walk.holding-rails', label: 'Holding the rails', keys: gait({ floor: TREAD, lean: 20, stride: 0.45, shift: 0.14, trail: -0.12, arms: () => RAIL_GRIP }), highlight: ['lowerBack', 'forearms'] },
      { id: 'treadmill-walk.bending-at-waist', label: 'Bending at the waist', keys: gait({ floor: TREAD, lean: 22, stride: 0.72, extra: () => ({ lumbar: [10, 0, 0], neck: [18, 0, 0] }) }), highlight: ['lowerBack'] },
      { id: 'treadmill-walk.overstriding', label: 'Overstriding', keys: gait({ floor: TREAD, stride: 0.82, toeUp: 22, reach: 0.8655 }), highlight: ['hamstrings', 'shins'] },
    ],
  },
  {
    // Lift off the mat into one long line, then a breathing 10 s hold (loops from the settled hold).
    id: 'plank', view: 'side', duration: 12, loopFrom: 0.12,
    keys: [{ t: 0, pose: plankDown, depth: 0 }, ...breathe(0.12, plank(), plankIn)],
    equipment: [{ kind: 'mat', pos: [0, 0, -0.1] }],
    mistakes: [
      { id: 'plank.hips-sag', label: 'Hips sagging', delta: { root: [0, -0.07, 0], rootRot: [6, 0, 0], lumbar: [-18, 0, 0] }, highlight: ['lowerBack'] },
      { id: 'plank.hips-pike', label: 'Hips piked up', delta: { root: [0, 0.17, -0.03], rootRot: [23, 0, 0] }, highlight: ['deltsFront', 'hipFlexors'] },
      { id: 'plank.head-drop', label: 'Head dropping', delta: { neck: [30, 0, 0] }, highlight: ['neck'] },
    ],
  },
  {
    // Left side down (lying on the left forearm); lift, then a breathing 10 s hold.
    id: 'side-plank', view: 'front', sided: true, duration: 12, loopFrom: 0.12,
    keys: [{ t: 0, pose: sidePlankDown, depth: 0 }, ...breathe(0.12, sidePlank(), sidePlankIn)],
    equipment: [{ kind: 'mat', pos: [0, 0, 0.06], yaw: 90 }],
    mistakes: [
      { id: 'side-plank.hips-sag', label: 'Hips sagging', delta: { root: [0, -0.07, 0], rootRot: [0, 0, -4], spine: [0, -14, 0], hipL: [0, -6, 0], hipR: [0, 3, 0] }, highlight: ['obliques', 'lowerBack'] },
      { id: 'side-plank.rolling-forward', label: 'Rolling forward', delta: { rootTwist: 18, hipL: [0, 0, -18], hipR: [0, 0, 18], clavR: [0, 12] }, highlight: ['obliques'] },
      { id: 'side-plank.elbow-misplaced', label: 'Elbow out of place', delta: { handL: [0, 0, 0.08], root: [0, -0.015, 0], clavL: [12, 0], hipL: [0, -2.5, 0] }, highlight: ['deltsSide', 'traps'] },
    ],
  },
  {
    // Rise 2 s, hold 10 s breathing, lower 2 s, rest 3 s.
    id: 'mcgill-curl-up', view: 'side', duration: 17,
    keys: [
      { t: 0, pose: curl(0), depth: 0 },
      { t: 2 / 17, pose: curl(14), depth: 1 },
      { t: 5 / 17, pose: curl(15), depth: 1 },
      { t: 8 / 17, pose: curl(14), depth: 1 },
      { t: 10.5 / 17, pose: curl(15), depth: 1 },
      { t: 12 / 17, pose: curl(14), depth: 1 },
      { t: 14 / 17, pose: curl(0), depth: 0 },
    ],
    equipment: [{ kind: 'mat', pos: [0, 0, 0.06] }],
    mistakes: [
      { id: 'mcgill-curl-up.flat-back', label: 'Lower back flattened', delta: { rootRot: [-11, 0, 0], lumbar: [14, 0, 0], hipL: [-11, 0, 0], thoracic: [8, 0, 0], root: [0, -0.012, 0.02] }, highlight: ['lowerBack'] },
      { id: 'mcgill-curl-up.chin-to-chest', label: 'Chin to chest', delta: { neck: [36, 0, 0], thoracic: [-14, 0, 0], spine: [-2.8, 0, 0] }, highlight: ['neck'] },
      { id: 'mcgill-curl-up.too-high', label: 'Sitting up too high', delta: { lumbar: [20, 0, 0], spine: [8, 0, 0], thoracic: [6, 0, 0] }, highlight: ['lowerBack', 'hipFlexors'] },
    ],
  },
  {
    // Left leg lowers with the right arm reaching overhead: out 3 s, pause 1 s, back 3 s, pause 1 s.
    id: 'dead-bug', view: 'side', sided: true, duration: 8,
    keys: [
      { t: 0, pose: bugStart(), depth: 0 },
      { t: 3 / 8, pose: bugOut(), depth: 1 },
      { t: 4 / 8, pose: bugOut(), depth: 1 },
      { t: 7 / 8, pose: bugStart(), depth: 0 },
    ],
    equipment: [{ kind: 'mat', pos: [0, 0, -0.05] }],
    mistakes: [
      { id: 'dead-bug.back-arch', label: 'Lower back arching', delta: { lumbar: [-12, 0, 0], rootRot: [8, 0, 0], root: [0, 0.012, 0], hipL: [3, 0, 0] }, highlight: ['lowerBack'] },
      { id: 'dead-bug.ribs-flare', label: 'Ribs flaring', delta: { rootRot: [6, 0, 0], thoracic: [-10, 0, 0], shoulderR: [7, 0, 0], hipL: [6, 0, 0] }, highlight: ['abs', 'obliques'] },
      { id: 'dead-bug.rushing', label: 'Rushing', keys: bugRushed, highlight: ['lowerBack', 'abs'] },
    ],
  },
  {
    // Side on to a cable on the figure's LEFT: press out 2 s, hold 3 s resisting the pull, return 2 s
    // (rep(): the first movement is the press).
    id: 'pallof-press', view: 'threeQuarter', sided: true, ignoreForCamera: ['cable'],
    ...rep(pallof(0.2), pallof(0.548), { lower: 2, pauseBottom: 3, lift: 2 }),
    equipment: [{ kind: 'cable', anchor: PALLOF_ANCHOR, hands: 'both', handle: 'rope' }],
    mistakes: [
      { id: 'pallof-press.rotating-to-stack', label: 'Turning toward the cable', delta: { spine: [0, 0, 14], handL: [0.13, 0, -0.03], handR: [0.13, 0, -0.03], rootTwist: 5 }, highlight: ['obliques', 'lowerBack'] },
      { id: 'pallof-press.hip-shift', label: 'Hips shifting out', delta: { root: [-0.075, -0.008, 0], spine: [0, 11, 0], footRotL: [0, -4, 0], handL: [-0.02, 0, -0.012], handR: [-0.02, 0, -0.012] }, highlight: ['obliques', 'gluteMed'] },
      { id: 'pallof-press.shrug-bent-arms', label: 'Shrugging with bent arms', delta: { clavL: [11, 0], clavR: [11, 0], handL: [0, 0.03, -0.05], handR: [0, 0.03, -0.05] }, highlight: ['traps', 'neck'] },
    ],
  },
  {
    // High-to-low chop, cable on the figure's LEFT: chop 2 s, pause 1 s beside the far hip, return 3 s, pause 1 s.
    id: 'cable-chop', view: 'threeQuarter', sided: true, ignoreForCamera: ['cable'],
    ...rep(chopStart(), chopEnd(), { lower: 2, pauseBottom: 1, lift: 3, pauseTop: 1 }),
    equipment: [{ kind: 'cable', anchor: CHOP_ANCHOR, hands: 'both', handle: 'rope' }],
    mistakes: [
      {
        id: 'cable-chop.lower-back-twist', label: 'Twisting from the lower back', highlight: ['lowerBack', 'obliques'],
        keys: rep(
          chopStart({ root: [0.03, STAND_Y - 0.005, 0], rootRot: [0, 0, 0], lumbar: [0, 0, 12], thoracic: [0, 0, 22] }),
          chopEnd({ root: [-0.03, STAND_Y - 0.01, 0], rootRot: [0, 0, 0], ...CHOP_FEET, heelL: 0, lumbar: [0, 0, -18], thoracic: [0, 0, -27] }),
          { lower: 2, pauseBottom: 1, lift: 3, pauseTop: 1 }).keys,
      },
      {
        id: 'cable-chop.rounded-back', label: 'Rounding at the bottom', highlight: ['lowerBack'],
        keys: rep(chopStart(), chopStooped, { lower: 2, pauseBottom: 1, lift: 3, pauseTop: 1 }).keys,
      },
      {
        id: 'cable-chop.yanking-arms', label: 'Yanking with the arms', highlight: ['deltsFront', 'traps'],
        keys: [
          { t: 0, pose: chopStart({ rootRot: [0, 0, 0], thoracic: [0, 0, 26] }) },
          { t: 0.12, pose: chopStart({ rootRot: [0, 0, 0], thoracic: [0, 0, 10], clavL: [12, 0], clavR: [12, 0], ...twoHands([0.12, 1.3, 0.26], [0.3, 0.5, 0.8]), elbowPoleL: [0.6, -0.6, -0.4], elbowPoleR: [-0.2, -0.8, -0.5] }) },
          { t: 0.19, pose: yankEnd, ease: 'in' },
          { t: 2 / 7 + 0.05, pose: yankEnd },
          { t: 6 / 7, pose: chopStart({ rootRot: [0, 0, 0], thoracic: [0, 0, 26] }) },
        ],
      },
    ],
  },
  {
    // Kneeling crunch: curl 2 s, pause 1 s, uncurl 2 s (hips stay still).
    id: 'cable-crunch', view: 'side', ignoreForCamera: ['cable'],
    ...rep(crunch(0), crunch(52), { lower: 2, pauseBottom: 1, lift: 2 }),
    equipment: [{ kind: 'cable', anchor: CRUNCH_ANCHOR, hands: 'both', handle: 'single' }, { kind: 'mat', pos: [0, 0, -0.15] }],
    mistakes: [
      { id: 'cable-crunch.hip-hinge', label: 'Hinging at the hips', delta: { root: [0, -0.045, -0.2], rootRot: [8, 0, 0], kneeL: 25, kneeR: 25, spine: [-44, 0, 0], neck: [-5, 0, 0] }, highlight: ['hipFlexors'] },
      { id: 'cable-crunch.arm-pull', label: 'Pulling with the arms', delta: { handL: [-0.02, -0.11, 0.2], handR: [0.02, -0.11, 0.2] }, highlight: ['triceps', 'lats'] },
      {
        id: 'cable-crunch.jerking', label: 'Jerking the stack', highlight: ['lowerBack', 'abs'],
        keys: [0, 0.5].flatMap(t => [
          { t, pose: crunch(0) },
          { t: t + 0.09, pose: crunch(62), ease: 'in' as const },
          { t: t + 0.14, pose: crunch(60) },
          { t: t + 0.24, pose: crunch(0), ease: 'in' as const },
          { t: t + 0.28, pose: crunch(-10, { handL: [0.1, 0.48, 0.14], handR: [-0.1, 0.48, 0.14] }), ease: 'out' as const },
          { t: t + 0.33, pose: crunch(5) },
          { t: t + 0.38, pose: crunch(0) },
        ]),
      },
    ],
  },
  {
    // Hanging from a bar: knees up 2 s, pause 1 s, lower 2 s, pause still 1 s.
    id: 'hanging-knee-raise', view: 'threeQuarter',
    ...rep(hang(), hangTop(), { lower: 2, pauseBottom: 1, lift: 2, pauseTop: 1 }),
    equipment: [{ kind: 'pullupBar', height: BAR_Y }],
    mistakes: [
      {
        id: 'hanging-knee-raise.swinging', label: 'Swinging', highlight: ['deltsRear', 'lowerBack'],
        keys: Array.from({ length: 18 }, (_, i) => {
          const t = i / 18, w = Math.sin(2 * Math.PI * 3 * t), kick = Math.max(0, w);
          return { t, ease: 'linear' as const, pose: swingAbout(hang({ hipL: [20 + 75 * kick, 2, 0], hipR: [20 + 75 * kick, 2, 0], kneeL: 25 + 65 * kick, kneeR: 25 + 65 * kick, lumbar: [-6 * Math.max(0, -w), 0, 0] }), -24 * w) };
        }),
      },
      {
        id: 'hanging-knee-raise.arching-bottom', label: 'Arching at the bottom', highlight: ['lowerBack', 'hipFlexors'],
        keys: rep(
          hang({ rootRot: [8, 0, 0], lumbar: [-13, 0, 0], hipL: [-15, 2, 0], hipR: [-15, 2, 0], kneeL: 18, kneeR: 18 }), hangTop(),
          { lower: 2, pauseBottom: 1, lift: 2, pauseTop: 1 }).keys,
      },
      {
        id: 'hanging-knee-raise.dropping-legs', label: 'Dropping the legs', highlight: ['lowerBack'],
        keys: [
          { t: 0, pose: hang() }, { t: 2 / 6, pose: hangTop() }, { t: 3 / 6, pose: hangTop() },
          { t: 3.45 / 6, pose: swingAbout(hang({ hipL: [-4, 2, 0], hipR: [-4, 2, 0] }), 3), ease: 'in' },
          { t: 3.9 / 6, pose: swingAbout(hang(), 13) }, { t: 4.45 / 6, pose: swingAbout(hang(), -9) },
          { t: 5.0 / 6, pose: swingAbout(hang(), 6) }, { t: 5.5 / 6, pose: swingAbout(hang(), -3) },
        ],
      },
    ],
  },
  {
    // Turn left 2 s, back through the middle 2 s, pause 1 s, then the same to the right.
    id: 'russian-twist', view: 'threeQuarter', duration: 10,
    keys: twistKeys(side => twisted(30 * side)),
    equipment: [{ kind: 'mat', pos: [0, 0, 0.05] }, { kind: 'dumbbells', hands: 'goblet' }],
    mistakes: [
      { id: 'russian-twist.rounded-back', label: 'Rounded back', constant: true, delta: { rootRot: [-14, 0, 0], lumbar: [26, 0, 0], thoracic: [8, 0, 0], clavL: [0, 12], clavR: [0, 12], neck: [6, 0, 0] }, highlight: ['lowerBack'] },
      { id: 'russian-twist.arms-only', label: 'Only the arms move', keys: twistKeys(side => twistSeat(swungHands(45 * side))), highlight: ['deltsFront', 'obliques'] },
      {
        id: 'russian-twist.fast-twisting', label: 'Fast, jerky twisting', highlight: ['lowerBack', 'obliques'],
        keys: Array.from({ length: 20 }, (_, i) => {
          const side = i % 2 === 0 ? 1 : -1;
          return { t: i / 20, pose: twisted(40 * side, swungHands(12 * side, 0.2, 0.3)) };
        }),
      },
    ],
  },
  {
    // Short, smooth steps with the weight in the LEFT hand.
    id: 'suitcase-carry', view: 'front', sided: true, duration: 1.1,
    keys: gait({ stride: 0.5, lean: 1, arms: c => suitcaseArms(c) }),
    equipment: [{ kind: 'dumbbells', hands: 'L' }],
    mistakes: [
      { id: 'suitcase-carry.leaning-to-weight', label: 'Leaning toward the weight', constant: true, delta: { spine: [0, 13, 0], clavL: [-3, 0] }, highlight: ['obliques', 'lowerBack'] },
      { id: 'suitcase-carry.leaning-away', label: 'Leaning away from the weight', constant: true, delta: { spine: [0, -10, 0], shoulderR: [0, 20, 0] }, highlight: ['obliques'] },
      { id: 'suitcase-carry.twisting-steps', label: 'Twisting with each step', keys: gait({ stride: 0.5, lean: 1, arms: c => suitcaseArms(c, -0.08 * c), extra: c => ({ spine: [0, 0, 14 * c] }) }), highlight: ['obliques', 'lowerBack'] },
    ],
  },
  {
    // Four short, quick strides, standing tall with the weights still at the sides.
    id: 'farmer-carry', view: 'side', duration: 4,
    keys: gait({ stride: 0.5, cycles: 4, lean: 1, arms: () => farmerArms }),
    equipment: [{ kind: 'dumbbells', hands: 'both' }],
    mistakes: [
      {
        id: 'farmer-carry.rounded-pickup', label: 'Rounding to pick up', highlight: ['lowerBack'],
        keys: [{ t: 0, pose: standCarry }, { t: 0.4, pose: stoop }, { t: 0.6, pose: stoop }, { t: 0.95, pose: standCarry }],
      },
      { id: 'farmer-carry.shrugged-shoulders', label: 'Shoulders shrugged', constant: true, delta: { clavL: [17, 14], clavR: [17, 14], thoracic: [10, 0, 0], neck: [-8, 0, 0] }, highlight: ['traps', 'upperBack'] },
      { id: 'farmer-carry.leaning-back', label: 'Leaning back', constant: true, delta: { rootRot: [-5, 0, 0], lumbar: [-10, 0, 0], root: [0, 0, 0.05] }, highlight: ['lowerBack'] },
    ],
  },
  {
    // About 110 steps a minute: tall, eyes ahead, elbows bent and swinging, heel to toe.
    id: 'brisk-walking', view: 'side', duration: 1.1,
    keys: gait({ stride: 0.62, toeUp: 12, arms: briskArms }),
    mistakes: [
      { id: 'brisk-walking.head-down', label: 'Looking down', constant: true, delta: { neck: [38, 0, 0], thoracic: [10, 0, 0] }, highlight: ['neck', 'upperBack'] },
      { id: 'brisk-walking.overstriding', label: 'Overstriding', keys: gait({ stride: 0.82, toeUp: 22, reach: 0.8655, arms: briskArms }), highlight: ['hamstrings', 'shins'] },
      { id: 'brisk-walking.slumped', label: 'Slumping', constant: true, delta: { thoracic: [17, 0, 0], neck: [-14, 0, 0], clavL: [0, 12], clavR: [0, 12] }, highlight: ['upperBack', 'neck'] },
    ],
  },
  {
    // Easy cadence, ~75 rpm.
    id: 'stationary-bike', view: 'side', duration: 0.8,
    keys: pedalling(BIKE, bikeRider(), uprightPitch),
    equipment: bikeRig(),
    mistakes: [
      {
        // The saddle is raised 3.5 cm on its post: the knee straightens to ~10° at the bottom, the toes
        // reach down for the pedal and the pelvis rocks ~8° onto each reaching side.
        id: 'stationary-bike.saddle-too-high', label: 'Saddle too high', highlight: ['hamstrings', 'lowerBack'],
        equipment: bikeRig(0.035),
        keys: pedalling(BIKE, bikeRider(0.035), phi => uprightPitch(phi) + 12 * Math.max(0, -Math.cos(phi)),
          phi => ({ rootRot: [20, 0, -8 * Math.sin(phi)] })),
      },
      {
        // Low bars are a setup fault: the clip's props gain a second bar below saddle height and the rider rounds down onto it.
        id: 'stationary-bike.slumped-back', label: 'Slumped over low bars', highlight: ['lowerBack', 'upperBack'],
        equipment: bikeRig(0, LOW_BARS),
        keys: pedalling(BIKE, bikeRider(0, {
          rootRot: [4, 0, 0], lumbar: [34, 0, 0], thoracic: [18, 0, 0], neck: [26, 0, 0], clavL: [0, 10], clavR: [0, 10],
          handL: [0.2, 0.875, 0.44], handR: [-0.2, 0.875, 0.44], fingersL: [0, -0.7, 0.7], fingersR: [0, -0.7, 0.7],
        }), uprightPitch),
      },
      { id: 'stationary-bike.gripping-hard', label: 'Gripping the bars hard', constant: true, delta: { gripL: 0.45, gripR: 0.45, clavL: [12, 0], clavR: [12, 0], wristL: [-20, 0], wristR: [-20, 0] }, highlight: ['forearms', 'traps'] },
    ],
  },
  {
    // Easy cadence, ~70 rpm, back supported.
    id: 'recumbent-bike', view: 'side', duration: 0.86,
    keys: pedalling(REC, recRider(), recPitch),
    equipment: recumbentRig(),
    mistakes: [
      {
        // The seat itself is slid 7 cm back down its rail, so the knee locks out and the pelvis slides forward off the backrest.
        id: 'recumbent-bike.seat-too-far', label: 'Seat too far away', highlight: ['hamstrings', 'calves'],
        equipment: recumbentRig(-0.115),
        keys: pedalling(REC, recRider(-0.115, 0.05, { rootRot: [-17, 0, 0] }), phi => recPitch(phi) + 16 * Math.max(0, Math.sin(phi))),
      },
      {
        // Seat slid 9 cm towards the pedals: the thighs come up to the belly and the lower back rounds off the backrest.
        id: 'recumbent-bike.seat-too-close', label: 'Seat too close', highlight: ['lowerBack', 'quads'],
        equipment: recumbentRig(0.09),
        keys: pedalling(REC, recRider(0.09, 0, { root: [0, 0.59, SEAT_Z + 0.05], rootRot: [-39, 0, 0], lumbar: [20, 0, 0], neck: [20, 0, 0] }), recPitch),
      },
      {
        id: 'recumbent-bike.gripping-hard', label: 'Gripping the handles hard', highlight: ['forearms', 'traps'],
        keys: pedalling(REC, recRider(0, 0, { handL: [0.29, 0.615, SEAT_Z + 0.2], handR: [-0.29, 0.615, SEAT_Z + 0.2], gripL: 1, gripR: 1, clavL: [15, 12], clavR: [15, 12], thoracic: [6, 0, 0] }), recPitch),
      },
    ],
  },
  {
    // Easy stride, ~60 strides a minute, hands light on the fixed handles.
    id: 'elliptical', view: 'threeQuarter', duration: 1,
    keys: ellipticalStride(),
    equipment: ELLIPTICAL,
    mistakes: [
      { id: 'elliptical.leaning-on-handles', label: 'Leaning on the handles', keys: ellipticalStride({ hands: { handL: [0.18, 1.27, 0.56], handR: [-0.18, 1.27, 0.56], gripL: 1, gripR: 1 }, trunk: { root: [0, 1.1, -0.1], rootRot: [20, 0, 0], spine: [9, 0, 0], clavL: [12, 0], clavR: [12, 0] } }), highlight: ['lowerBack', 'forearms'] },
      { id: 'elliptical.on-toes', label: 'Up on the toes', keys: ellipticalStride({ heel: 26, lift: 0.045 }), highlight: ['calves', 'feet'] },
      { id: 'elliptical.knees-caving', label: 'Knees caving in', keys: ellipticalStride({ caving: true }), highlight: ['adductors', 'quads'] },
    ],
  },
  {
    // ~22 strokes a minute: drive (legs, body, arms) in about a third of the stroke, slow recovery.
    id: 'rowing-machine', view: 'side', duration: 2.7, ignoreForCamera: ['cable'],
    keys: rowStroke(),
    equipment: ROWER,
    mistakes: [
      { id: 'rowing-machine.rounded-catch', label: 'Rounding at the front', keys: rowStroke({ catchZ: 0.26, catchLean: 12, catchBend: [8, 22, 10], reach: 0.585 }), highlight: ['lowerBack'] },
      { id: 'rowing-machine.big-layback', label: 'Leaning back too far', keys: rowStroke({ finishLean: -34, finishBend: [0, -15, -6], finishHigh: 0.33, elbowsHigh: true }), highlight: ['lowerBack', 'deltsRear'] },
      { id: 'rowing-machine.arms-first', label: 'Pulling with the arms first', keys: rowStroke({ armsEarly: true }), highlight: ['biceps', 'upperBack'] },
    ],
  },
];
