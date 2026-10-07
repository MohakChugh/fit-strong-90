/** Push, pull and arm clips. */
import type { Clip, Equipment, Pose, PoseKey, Vec3 } from '../types';
import { rep, stance, STAND_Y } from './kit';

/** Lying on a flat bench (pad top 0.44 m), feet flat on the floor. */
const onBench = (extra: Pose = {}): Pose => ({
  root: [0, 0.545, 0], rootRot: [-90, 0, 0], neck: [4, 0, 0],
  footL: [0.27, 0, 0.5], footR: [-0.27, 0, 0.5], footRotL: [0, 20, 0], footRotR: [0, -20, 0], kneePoleL: [0.3, 1, 0.4], kneePoleR: [-0.3, 1, 0.4],
  clavL: [0, -6], clavR: [0, -6],
  ...extra,
});
/** Dumbbells in chest space: palms towards the feet, elbows ~45° from the body. */
const press = (y: number, z: number, half: number): Pose => ({
  handSpace: 'chest', handL: [half, y, z], handR: [-half, y, z], palmL: [0, -1, 0], palmR: [0, -1, 0],
  fingersL: [0, 0, 1], fingersR: [0, 0, 1], elbowPoleL: [1, -0.7, -0.4], elbowPoleR: [-1, -0.7, -0.4], gripL: 1, gripR: 1,
});

// ---- Arm chains -------------------------------------------------------------

/** Upper arm, forearm, wrist-to-palm-centre (along the fingers) and palm offset, in metres. */
const UA = 0.25, FA = 0.2675, GRIP = 0.0806, PALM = 0.0135;
/** The left shoulder joint in chest space. */
const SHOULDER: Vec3 = [0.214, 0.242, 0.046];

const add = (a: Vec3, b: Vec3, k = 1): Vec3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: Vec3): Vec3 => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };
const mx = (a: Vec3): Vec3 => [-a[0], a[1], a[2]];

interface Arm { hand: Vec3; palm: Vec3; fingers: Vec3; pole: Vec3 }

/**
 * Left-arm IK targets from segment directions: upper arm along `ua`, forearm
 * along `fa`, palm facing `palm`; fingers follow the forearm (neutral wrist)
 * unless given. The elbow pole reproduces the bend exactly.
 */
function limb(ua: Vec3, fa: Vec3, palm: Vec3, o: { from?: Vec3; fingers?: Vec3; pole?: Vec3 } = {}): Arm {
  const s = o.from ?? SHOULDER;
  const e = add(s, unit(ua), UA), w = add(e, unit(fa), FA);
  const f = unit(o.fingers ?? fa);
  const p = unit(add(palm, f, -dot(palm, f)));
  const sw = unit(add(w, s, -1));
  const bend = add(unit(ua), sw, -dot(unit(ua), sw));
  return { hand: add(add(w, f, GRIP), p, PALM), palm: p, fingers: f, pole: o.pole ?? (Math.hypot(...bend) > 1e-3 ? unit(bend) : [0, 0, -1]) };
}

const mirror = (a: Arm): Arm => ({ hand: mx(a.hand), palm: mx(a.palm), fingers: mx(a.fingers), pole: mx(a.pole) });

/** Both hands in `space`: the left arm as given, the right its mirror image unless given. */
const arms = (space: Pose['handSpace'], l: Arm, r?: Arm, grip = 1): Pose => ({
  handSpace: space, handL: l.hand, handR: r?.hand ?? mx(l.hand), palmL: l.palm, palmR: r?.palm ?? mx(l.palm),
  fingersL: l.fingers, fingersR: r?.fingers ?? mx(l.fingers), elbowPoleL: l.pole, elbowPoleR: r?.pole ?? mx(l.pole), gripL: grip, gripR: grip,
});

/** Numeric difference a − b of two poses: a fault's extreme pose as a mistake delta. */
function diff(a: Pose, b: Pose): Pose {
  const out: Record<string, number | number[]> = {};
  for (const k of Object.keys(a) as PoseKey[]) {
    const x = a[k] as unknown, y = b[k] as unknown;
    if (typeof x === 'number') out[k] = x - ((y as number | undefined) ?? 0);
    else if (Array.isArray(x)) out[k] = x.map((n: number, i) => n - ((y as number[] | undefined)?.[i] ?? 0));
  }
  return out as Pose;
}

/** One rep that starts at rest and works first (pulls, raises, curls): the hardest point is the contracted end. */
const work = (start: Pose, top: Pose, t: { lower: number; lift: number; pauseTop?: number; pauseBottom?: number }) =>
  rep(start, top, { lower: t.lift, pauseBottom: t.pauseTop, lift: t.lower, pauseTop: t.pauseBottom });

const standTall = (extra: Pose = {}): Pose => ({ root: [0, STAND_Y, 0], ...stance(0.12, 8), ...extra });

// ---- Seats and pads -----------------------------------------------------------

/** Seat-top height of benches and machine seats. */
const SEAT = 0.46;
/** Sitting on a seat whose top is at h: pelvis over the seat at z (glutes sink ~1 cm), feet flat in front. */
const sit = (extra: Pose = {}, o: { h?: number; z?: number; half?: number; feet?: number; toe?: number } = {}): Pose => ({
  root: [0, (o.h ?? SEAT) + 0.072, o.z ?? -0.05], ...stance(o.half ?? 0.15, o.toe ?? 10, o.feet ?? 0.42), ...extra,
});
/** A short padded seat on legs, its top at h, centred at z. */
const seatPad = (z: number, length = 0.42, h = SEAT): Equipment => ({ kind: 'bench', pos: [0, 0, z], length, height: h });
/** A padded backrest leaning back `recline`° from vertical, the lower edge of its front face at (y, z). */
function backrest(y: number, z: number, recline: number, len = 0.75, width = 0.3, thick = 0.07): Equipment {
  const r = (recline * Math.PI) / 180;
  return { kind: 'box', pos: [0, y - (Math.sin(r) * thick) / 2, z - (Math.cos(r) * thick) / 2], size: [width, len, thick], pitch: -recline, material: 'pad' };
}

/** An adjustable bench: a seat and a back pad reclined `recline`° from vertical, propped on a post. */
function adjustable(recline: number, padZ: number, len = 0.95): Equipment[] {
  const r = (recline * Math.PI) / 180, s = len * 0.62, t = 0.07;
  return [
    seatPad(0.1), backrest(SEAT, padZ, recline, len),
    { kind: 'box', pos: [0, 0, padZ - s * Math.sin(r) - t * Math.cos(r)], size: [0.06, SEAT + s * Math.cos(r) - t * Math.sin(r), 0.06], material: 'frame' },
  ];
}
/**
 * A pad rising towards +Z at `incline`° to rest the chest (or the soles) on, with
 * the lower edge of its upper face at (y, z). An upright at `postZ` carries it on
 * a short arm, clear of the legs; without one the pad sits on a riser.
 */
function chestPad(y: number, z: number, incline: number, len: number, width = 0.3, postZ?: number, thick = 0.07): Equipment[] {
  const i = (incline * Math.PI) / 180, p = Math.PI / 2 - i;
  const pad: Equipment = { kind: 'box', pos: [0, y - (Math.sin(p) * thick) / 2, z + (Math.cos(p) * thick) / 2], size: [width, len, thick], pitch: 90 - incline, material: 'pad' };
  if (postZ === undefined) return [pad, { kind: 'box', pos: [0, 0, z + 0.06], size: [width, Math.max(0.04, y - thick * Math.cos(i) - 0.01), 0.2], material: 'frame' }];
  // Cantilever: a short arm back from an upright that stands beyond the feet.
  const hz = z + Math.cos(i) * len, hy = y + Math.sin(i) * len - 0.09;
  return [
    pad,
    { kind: 'box', pos: [0, hy, (hz + postZ) / 2], size: [0.08, 0.05, postZ - hz + 0.1], material: 'frame' },
    { kind: 'box', pos: [0, 0, postZ], size: [0.1, hy, 0.1], material: 'frame' },
  ];
}

// ---- Standing dumbbell, barbell and cable work ---------------------------------

const latDown = limb([0.18, -1, 0.06], [0.16, -1, 0.27], [-1, 0, 0]);
/** Elbows level with the shoulders, ~30° forward of the side, wrists just below the elbows. */
const latTop = limb([0.865, -0.035, 0.5], [0.8, -0.24, 0.55], [0, -1, 0]);
const latJug = limb([0.837, 0.259, 0.483], [0.8, 0.1, 0.55], [0, -0.7, -0.7]);
const latHigh = limb([0.84, 0.2, 0.5], [0.8, 0.02, 0.55], [0, -1, 0]);

const hammerDown = limb([0.1, -1, 0.02], [0.08, -1, 0.12], [-1, 0, 0]);
const hammerTop = limb([0.08, -1, 0.12], [0.05, 0.786, 0.618], [-1, 0, 0]);
const hammerDrift = limb([0.3, -0.85, 0.5], [-0.05, 0.95, 0.3], [-1, 0, 0]);
/** Radial deviation: the fingers tip 20° towards the thumb. */
const hammerCocked = limb([0.08, -1, 0.12], [0.05, 0.786, 0.618], [-1, 0, 0], { fingers: [0.05, 0.95, 0.31] });
const splitStance: Pose = { footL: [0.12, 0, 0.12], footR: [-0.12, 0, -0.1], footRotL: [0, 6, 0], footRotR: [0, -6, 0] };

const curlDown = limb([0.05, -1, 0.1], [0.04, -1, 0.16], [0, 0, 1]);
const curlTop = limb([0.05, -1, 0.18], [0.04, 0.72, 0.7], [0, 0.7, -0.72]);
const curlChin = limb([0.05, -0.75, 0.66], [0.02, 0.97, 0.25], [0, 0.25, -0.97]);
const curlLocked = limb([0.05, -1, 0.1], [0.05, -1, 0.1], [0, 0, 1], { pole: [0, 0, -1] });

const pushTop = limb([0.06, -1, 0.1], [-0.4, 0.35, 0.85], [-1, 0, 0]);
const pushDown = limb([0.03, -1, 0.04], [0.05, -1, 0.1], [-0.6, 0, -0.8]);
const pushDrift = limb([0.1, -0.82, 0.57], [-0.32, 0.72, 0.62], [-1, 0, 0]);
const pushFlareTop = limb([0.62, -0.79, 0.1], [-0.6, 0.2, 0.78], [-0.5, -0.8, 0]);
const pushFlareDown = limb([0.3, -0.94, 0.12], [-0.12, -1, 0.3], [-0.4, 0, -0.9], { pole: [1, 0.2, -0.3] });
const pushHunchTop = limb([0.06, -0.85, 0.5], [-0.4, 0.71, 0.59], [-1, 0, 0]);
const pushHunchDown = limb([0.03, -0.79, 0.62], [0.05, -0.74, 0.67], [-0.6, -0.5, -0.6]);
const pushHunch: Pose = { root: [0, 0.9, -0.07], rootRot: [12, 0, 0], spine: [26, 0, 0], clavL: [0, 12], clavR: [0, 12] };

const faceStart = limb([-0.1, 0.1, 1], [-0.18, 0.12, 1], [-0.5, -0.85, 0]);
const faceEnd = limb([0.95, 0, 0.1], [-0.67, 0.72, 0.15], [0, 0, 1]);
const faceLow = limb([0.7, -0.7, 0.25], [-0.55, 0.45, 0.7], [0, 0, 1]);
const faceStance: Pose = { footL: [0.12, 0, 0.16], footR: [-0.12, 0, -0.14], footRotL: [0, 6, 0], footRotR: [0, -6, 0] };

const flyOpen = limb([1, -0.25, 0.05], [0.883, -0.25, 0.469], [0, 0, 1]);
const flyClosed = limb([-0.05, -0.25, 1], [-0.45, -0.25, 0.86], [-1, 0, 0]);
const flyBent = limb([0.85, -0.3, -0.25], [0.15, -0.05, 1], [-0.6, 0, 0.8]);
const flyPressed = limb([-0.1, -0.2, 1], [-0.18, -0.2, 1], [-1, 0, 0]);
const flyBehind = limb([0.7, -0.25, -0.7], [0.96, -0.25, -0.25], [0, 0, 1]);
const flyStance: Pose = { root: [0, 0.92, 0.02], rootRot: [10, 0, 0], footL: [0.13, 0, 0.2], footR: [-0.13, 0, -0.14], footRotL: [0, 6, 0], footRotR: [0, -6, 0] };

// ---- Seated presses, extensions and curls --------------------------------------

/** Dumbbells at ear height, upper arms ~30° forward of the side, forearms vertical, palms facing. */
const dspDown = limb([0.847, -0.208, 0.489], [-0.05, 1, 0.03], [-1, 0, 0]);
const dspUp = limb([0.12, 0.98, 0.15], [0, 1, 0.08], [-1, 0, 0]);
/** Elbows pulled back in line with the shoulders (palms forward). */
const dspBack = limb([0.886, -0.208, -0.413], [0, 1, -0.02], [0, 0, 1]);
const pressRecline: Pose = { rootRot: [-8, 0, 0], neck: [-6, 0, 0], head: [5, 0, 0] };
const slumpBack: Pose = { root: [0, 0, 0.1], rootRot: [-4, 0, 0], lumbar: [-14, 0, 0], thoracic: [4, 0, 0], neck: [16, 0, 0] };

const arnDown = limb([0.067, -0.643, 0.763], [-0.05, 1, -0.05], [0, 0, -1]);
const arnMid = limb([0.903, -0.087, 0.421], [-0.05, 1, 0.05], [-1, 0, 0.15]);
const arnUp = limb([0.12, 0.98, 0.12], [0, 1, 0.06], [0, 0, 1]);
/** Wrist-only twist: forearms turn while the elbows stay forward and low. */
const arnTurned = limb([0.067, -0.643, 0.763], [-0.05, 1, -0.05], [-1, 0, 0]);
const arnFront = limb([0.067, -0.643, 0.763], [-0.05, 1, -0.05], [0, 0, 1]);
const arnFrontUp = limb([0.05, 0.88, 0.47], [0, 1, 0.25], [0, 0, 1]);
const arnSnap = limb([0.98, 0.0, 0.18], [-0.1, 1, 0.1], [-0.6, 0, 0.8]);

/** Both palms under the top plate; elbows forward, close to the head. */
const oteUp = limb([-0.28, 0.95, 0.16], [-0.32, 0.94, 0.12], [0, 1, 0], { fingers: [0, 0.15, -1] });
const oteDown = limb([-0.22, 0.95, 0.2], [-0.35, -0.2, -0.9], [0, 1, 0], { fingers: [-0.1, 0.1, -1] });
const oteFlare = limb([0.55, 0.8, 0.15], [-0.75, -0.15, -0.65], [0, 1, 0], { fingers: [-0.3, 0.1, -1] });
const oteBowed = limb([-0.22, 0.95, 0.3], [-0.35, -0.35, -0.85], [0, 1, 0], { fingers: [-0.1, 0, -1] });

const sccDown = limb([0.12, -1, 0], [0.12, -1, 0.1], [0, 0, 1]);
const sccUp = limb([0.1, -1, 0.08], [0.04, 0.72, 0.7], [0, 0.7, -0.72]);
const sccForward = limb([0.1, -0.78, 0.62], [0.02, 0.98, -0.1], [0, -0.1, -1]);
/** Left hand down at the left handle by the floor while the trunk rounds and leans towards it (chest space of that pose). */
const sccGrab: Arm = { hand: [0.49, -0.16, 0.39], palm: [-0.6, -0.3, 0.2], fingers: [0.51, -0.67, 0.54], pole: [0.4, 0.3, -1] };
const sccReach: Pose = { rootRot: [10, 0, 0], spine: [32, 18, 0], lumbar: [8, 0, 0], clavL: [-8, 14], ...arms('chest', sccGrab, mirror(sccDown)) };

/** Seated press base: back and head on a pad reclined 8°, feet wide. */
const seatedPress = (a: Arm, extra: Pose = {}): Pose => sit({ ...pressRecline, ...arms('chest', a), ...extra }, { half: 0.2, toe: 14 });
/** Fixed machine handles in world space, palms facing in (neutral grip). */
const handles = (half: number, y: number, z: number, fingers: Vec3, pole: Vec3): Pose => ({
  handSpace: 'world', handL: [half, y, z], handR: [-half, y, z], palmL: [-1, 0, 0], palmR: [1, 0, 0],
  fingersL: fingers, fingersR: fingers, elbowPoleL: pole, elbowPoleR: mx(pole), gripL: 1, gripR: 1,
});

// ---- Bench work: lying, inclined and chest-supported ------------------------------

/** Skull crushers: upper arms vertical over the shoulders, palms facing; the elbows bend to lower the dumbbells beside the forehead. */
const skullUp = limb([-0.03, 0, 1], [-0.03, 0.06, 1], [-1, 0, 0]);
const skullDown = limb([-0.03, 0, 1], [-0.05, 0.96, -0.28], [-1, 0, 0]);
const skullFlare = limb([0.6, 0, 0.8], [-0.5, 0.8, -0.3], [-1, 0, 0]);
/** Elbows collapsed into full flexion, the dumbbells right at the head. */
const skullCrash = limb([-0.03, 0, 1], [-0.05, 0.8, -0.6], [-1, 0, 0]);
const skullNear = limb([-0.03, 0, 1], [-0.05, 0.99, -0.12], [-1, 0, 0]);

/** World up in chest space for a trunk reclined `r`° from vertical (chest +Y runs up the spine, +Z out of the chest). */
const upAt = (r: number): Vec3 => [0, Math.cos((r * Math.PI) / 180), Math.sin((r * Math.PI) / 180)];
const PRESS_PALM: Vec3 = [-0.42, -0.785, 0.453];
/** Incline press on a pad reclined `r`° from vertical: dumbbells straight up over the shoulders, then down beside the upper chest. */
const inclineUp = (r: number): Arm => limb([0.04, upAt(r)[1], upAt(r)[2]], [-0.06, upAt(r)[1], upAt(r)[2]], PRESS_PALM);
const inclineDown = (r: number): Arm => limb([0.7, -0.5, -0.5], upAt(r), PRESS_PALM);
const inclineFlared = limb([0.95, 0.05, -0.32], [-0.1, 0.5, 0.86], [-0.2, -0.85, 0.48]);
const inclineHead: Pose = { neck: [-10, 0, 0], head: [6, 0, 0] };
const pressSeat = (r: number, a: Arm, extra: Pose = {}): Pose =>
  sit({ root: [0, 0.56, -0.02], rootRot: [-r, 0, 0], ...inclineHead, ...arms('chest', a), ...extra }, { half: 0.2, feet: 0.5, toe: 14 });

/** Incline curl, shoulders space (world axes): arms hang straight down whatever the pad angle, then curl with the elbows still. */
const icurlDown = limb([0.05, -1, 0], [0.04, -1, 0.05], [-1, 0, 0], { from: [0, 0, 0] });
const icurlUp = limb([0.05, -1, 0], [0.02, 0.643, 0.766], [0, 0.766, -0.643], { from: [0, 0, 0] });
const icurlSwing = limb([0.05, -0.788, 0.616], [0.02, 0.98, 0.2], [0, 0.2, -0.98], { from: [0, 0, 0] });
const curlSeat = (r: number, a: Arm): Pose =>
  sit({ root: [0, 0.55, -0.04], rootRot: [-r, 0, 0], ...inclineHead, ...arms('shoulders', a) }, { half: 0.18, feet: 0.5 });

/** Chest-supported row, shoulders space: hanging, then elbows just past the ribs with the forearms vertical. */
const rowHang = limb([0.04, -1, 0], [0.03, -1, 0.04], [-1, 0, 0], { from: [0, 0, 0] });
const rowTop = limb([0.29, -0.33, -0.9], [-0.05, -1, 0.05], [-1, 0, 0], { from: [0, 0, 0] });
/** On the pad: trunk pitched forward 50° (pad at 40°), feet planted behind. */
const onPad = (extra: Pose = {}): Pose => ({
  root: [0, 0.79, -0.05], rootRot: [50, 0, 0], neck: [-8, 0, 0], ...stance(0.15, 6, -0.42), ...extra,
});

/** Rear-delt fly, shoulders space: soft elbows; arms open to shoulder height, hands in line with the ears. */
const rdfDown = limb([0.2, -1, 0], [0, -1, 0.02], [-1, 0, 0], { from: [0, 0, 0] });
const rdfTop = limb([1, -0.05, 0.12], [0.97, -0.25, 0.1], [0, -1, 0], { from: [0, 0, 0] });
const rdfHips = limb([0.707, -0.54, -0.455], [0.68, -0.6, -0.42], [0, -1, 0], { from: [0, 0, 0] });
const rdfBent = limb([1, -0.05, 0.1], [0.05, -1, 0.05], [-1, 0, 0], { from: [0, 0, 0] });
/** Sitting astride the bench, chest resting on the pad in front, feet flat either side. */
const onSteepPad = (extra: Pose = {}): Pose => ({
  root: [0, 0.57, -0.12], rootRot: [42, 0, 0], neck: [-6, 0, 0],
  footL: [0.2, 0, 0.26], footR: [-0.2, 0, 0.26], footRotL: [0, 14, 0], footRotR: [0, -14, 0], kneePoleL: [0.35, 0.6, 1], kneePoleR: [-0.35, 0.6, 1], ...extra,
});

// ---- Seated cable pulls ----------------------------------------------------------

/** Lat pulldown, chest space (trunk leaning back 12°): arms up towards the pulley, bar to the top of the chest. */
const pullUp = limb([0.1, 0.74, 0.66], [0.06, 0.75, 0.66], [-0.05, -0.66, 0.75], { from: [0.212, 0.268, 0.046] });
const pullDown: Arm = { hand: [0.25, 0.27, 0.17], palm: [0, 0, 1], fingers: [0, 1, 0], pole: [0.4, -1, -0.3] };
const pullNeck: Arm = { hand: [0.25, 0.34, -0.1], palm: [0, 0.2, 1], fingers: [0, 1, -0.2], pole: [1, -0.3, 0] };
const latSeat = (extra: Pose = {}): Pose => sit({ rootRot: [-12, 0, 0], ...extra }, { half: 0.17, feet: 0.4 });

/** Seated cable row, chest space: arms long with the shoulder blades spread, then the V handle to the upper belly. */
const rowLong = limb([-0.25, -0.2, 0.95], [-0.28, -0.2, 0.94], [-1, 0, 0], { from: [0.21, 0.242, 0.086] });
const rowIn: Arm = { hand: [0.055, 0.02, 0.21], palm: [-1, 0, 0], fingers: [-0.25, 0, 1], pole: [0.3, -0.4, -1] };
/** Sitting on the row bench with the feet on the plate (soles pitched 50° toes-up). */
const rowSeat = (extra: Pose = {}): Pose => ({
  root: [0, 0.42 + 0.072, -0.15], footL: [0.13, 0.2, 0.4], footR: [-0.13, 0.2, 0.4], footRotL: [-50, 6, 0], footRotR: [-50, -6, 0],
  kneePoleL: [0.15, 1, 0.3], kneePoleR: [-0.15, 1, 0.3], ...extra,
});

// ---- Assisted tower and floor work ---------------------------------------------------

/** Kneeling on the assisted tower's pad, shins back. The pad rides up and down with the knees, so it is not drawn. */
const kneeling: Pose = { hipL: [8, 3, 0], hipR: [8, 3, 0], kneeL: 106, kneeR: 106, ankleL: [-40, 0], ankleR: [-40, 0] };
const BAR = 2.25;
/** Overhand grip on the tower's bar, a little wider than the shoulders. */
const barGrip = (pole: Vec3): Pose => ({
  handSpace: 'world', handL: [0.27, BAR, 0.05], handR: [-0.27, BAR, 0.05], palmL: [0, 0, 1], palmR: [0, 0, 1],
  fingersL: [0, 1, 0], fingersR: [0, 1, 0], elbowPoleL: pole, elbowPoleR: mx(pole), gripL: 1, gripR: 1,
});
const hang = (extra: Pose = {}): Pose => ({ root: [0, BAR - 1.025, 0.03], rootRot: [-3, 0, 0], clavL: [-4, 0], clavR: [-4, 0], ...kneeling, ...barGrip([0.4, -0.3, 0.6]), ...extra });
const chinUp = (extra: Pose = {}): Pose => ({ root: [0, BAR - 0.57, 0.0], rootRot: [-10, 0, 0], neck: [-6, 0, 0], ...kneeling, ...barGrip([0.4, -1, 0.1]), ...extra });

const DIP = 1.15;
/** Neutral grip on the dip handles, palms facing in. */
const dipGrip = (pole: Vec3): Pose => ({
  handSpace: 'world', handL: [0.25, DIP, 0.08], handR: [-0.25, DIP, 0.08], palmL: [-1, 0, 0], palmR: [1, 0, 0],
  fingersL: [0, -1, 0.15], fingersR: [0, -1, 0.15], elbowPoleL: pole, elbowPoleR: mx(pole), gripL: 1, gripR: 1,
});
const dipTop = (extra: Pose = {}): Pose => ({ root: [0, DIP + 0.17, 0.03], rootRot: [8, 0, 0], clavL: [-4, 0], clavR: [-4, 0], ...kneeling, ...dipGrip([0.2, 0, -1]), ...extra });
const dipLow = (extra: Pose = {}): Pose => ({ root: [0, DIP - 0.1, 0.07], rootRot: [18, 0, 0], clavL: [-2, 2], clavR: [-2, 2], ...kneeling, ...dipGrip([0.25, 0.3, -1]), ...extra });
const dipBars: Equipment[] = [
  { kind: 'kneePad' },
  ...[0.25, -0.25].flatMap((x): Equipment[] => [
    { kind: 'box', pos: [x, DIP - 0.014, 0.1], size: [0.028, 0.028, 0.5], material: 'steel' },
    { kind: 'box', pos: [x * 1.25, 0, 0.36], size: [0.06, DIP + 0.02, 0.06], material: 'frame' },
  ]),
];

/** High plank: hands under the shoulders, slightly wider; on the toes, elbows ~45° from the torso. */
const plankBase = (extra: Pose = {}): Pose => ({
  neck: [-6, 0, 0], footL: [0.09, 0, -0.88], footR: [-0.09, 0, -0.88], heelL: 72, heelR: 72,
  handSpace: 'world', handL: [0.23, 0.015, 0.52], handR: [-0.23, 0.015, 0.52], palmL: [0, -1, 0], palmR: [0, -1, 0],
  fingersL: [0, 0, 1], fingersR: [0, 0, 1], elbowPoleL: [0.85, 0.42, -0.4], elbowPoleR: [-0.85, 0.42, -0.4], ...extra,
});
/**
 * Plank with the shoulder joints at height `shoulder`: one straight line from the
 * toes through the hips to the head (the ankle sits at y 0.149 over the planted toes).
 */
const plankAt = (shoulder: number, extra: Pose = {}): Pose => {
  const sin = (shoulder - 0.149) / 1.306, cos = Math.sqrt(1 - sin * sin);
  return plankBase({ root: [0, 0.149 + 0.866 * sin, -0.727 + 0.866 * cos], rootRot: [90 - (Math.asin(sin) * 180) / Math.PI, 0, 0], ...extra });
};

// ---- Unilateral work (authored for the left arm) ---------------------------------------

/** One-arm row base: right knee and right hand on the bench, left foot planted back and out; back flat, shoulders level. */
const rowBench = (extra: Pose = {}): Pose => ({
  root: [0, 0.9, -0.12], rootRot: [77, 0, 0], neck: [-12, 0, 0],
  kneeAimR: [-0.13, 0.505, -0.1], kneeR: 95, ankleR: [-62, 0],
  footL: [0.28, 0, -0.25], footRotL: [0, 15, 0], kneePoleL: [0.3, 0.2, 1],
  handSpace: 'world', handR: [-0.19, 0.455, 0.36], palmR: [0, -1, 0], fingersR: [0, 0, 1], elbowPoleR: [-0.3, 0, -1], gripR: 0, gripL: 1,
  ...extra,
});
/** The working (left) arm in world space from that pose's left shoulder: hanging straight, or elbow pulled just past the body. */
const rowArm = (sh: Vec3, up: boolean): Pose => {
  const a = up ? limb([0.15, 0.25, -0.95], [0, -1, 0.05], [-1, 0, 0], { from: sh }) : limb([0.035, -1, 0], [0.03, -1, 0.04], [-1, 0, 0], { from: sh });
  return { handL: a.hand, palmL: a.palm, fingersL: a.fingers, elbowPoleL: a.pole };
};
/** Left-shoulder positions measured from the solved poses (flat back, twisted open, rounded). */
const ROW_SH: Vec3 = [0.214, 0.985, 0.313], TWIST_SH: Vec3 = [0.207, 1.091, 0.288], ROUND_SH: Vec3 = [0.214, 0.838, 0.293];

/** Half-kneeling, left knee down on a pad and the right foot forward with the knee at a right angle; trunk tall. */
const halfKneel = (extra: Pose = {}): Pose => ({
  root: [0, 0.51, -0.02], kneeAimL: [0.1, 0.08, -0.02], kneeL: 92, ankleL: [-62, 0],
  footR: [-0.14, 0, 0.44], footRotR: [0, -6, 0], kneePoleR: [-0.1, 0.3, 1], hipL: [0, 0, 0],
  shoulderR: [6, 10, 0], elbowR: 12, gripL: 1, ...extra,
});
/** The bar end at the front of the left shoulder (elbow under the hand), then pressed up and forward to a straight arm. */
const LANDMINE: Vec3 = [0.08, 0.03, 1.7];
const mineLow: Pose = { handSpace: 'world', handL: [0.18, 0.99, 0.14], palmL: [-1, 0, -0.056], fingersL: [-0.026, 0.883, 0.469], elbowPoleL: [0.2, -1, 0.1] };
const mineHigh: Pose = { handSpace: 'world', handL: [0.14, 1.37, 0.4], palmL: [-0.998, -0.072, -0.1], fingersL: [-0.12, 0.756, 0.653], elbowPoleL: [0.5, -0.6, -0.2], clavL: [0, 12] };

export const STRENGTH_UPPER: Clip[] = [
  {
    id: 'dumbbell-bench-press', view: 'threeQuarter',
    ...rep(onBench(press(0.24, 0.6, 0.2)), onBench(press(0.13, 0.17, 0.25)), { lower: 3, lift: 2 }),
    equipment: [{ kind: 'bench', pos: [0, 0, -0.25], length: 1.25 }, { kind: 'dumbbells' }],
    mistakes: [
      { id: 'dumbbell-bench-press.flared-elbows', label: 'Elbows flared out', delta: { elbowPoleL: [0, 0.75, 0], elbowPoleR: [0, 0.75, 0], handL: [0.04, 0.09, 0], handR: [-0.04, 0.09, 0] }, highlight: ['deltsFront', 'chest'] },
      { id: 'dumbbell-bench-press.big-arch', label: 'Big lower-back arch', constant: true, delta: { lumbar: [-14, 0, 0], root: [0, 0.05, 0] }, highlight: ['lowerBack'] },
      { id: 'dumbbell-bench-press.dumping', label: 'Dropping the weights out wide', delta: { handL: [0.28, 0.02, -0.12], handR: [-0.28, 0.02, -0.12], spine: [0, 0, 18] }, highlight: ['deltsFront', 'chest'] },
    ],
  },
  {
    id: 'lateral-raises', view: 'threeQuarter',
    ...work(standTall({ rootRot: [3, 0, 0], ...arms('chest', latDown) }), standTall({ rootRot: [3, 0, 0], ...arms('chest', latTop) }), { lower: 3, lift: 2, pauseTop: 1 }),
    equipment: [{ kind: 'dumbbells' }],
    mistakes: [
      {
        id: 'lateral-raises.swinging', label: 'Swinging the weights up', highlight: ['lowerBack'],
        keys: [
          { t: 0, pose: standTall({ rootRot: [3, 0, 0], ...arms('chest', latDown) }) },
          { t: 0.1, pose: standTall({ root: [0, 0.9, -0.05], rootRot: [16, 0, 0], ...arms('chest', latDown) }) },
          { t: 0.26, pose: standTall({ root: [0, STAND_Y, 0.02], rootRot: [-6, 0, 0], lumbar: [-8, 0, 0], ...arms('chest', latHigh) }), ease: 'out' },
          { t: 0.5, pose: standTall({ root: [0, STAND_Y, 0.02], rootRot: [-5, 0, 0], lumbar: [-7, 0, 0], ...arms('chest', latTop) }) },
        ],
      },
      { id: 'lateral-raises.shrugging', label: 'Shrugging the shoulders', delta: { clavL: [13, 0], clavR: [13, 0], handL: [0, 0.045, 0], handR: [0, 0.045, 0], neck: [-4, 0, 0] }, highlight: ['traps', 'neck'] },
      { id: 'lateral-raises.jug-pour', label: 'Too high, thumbs down', delta: diff(arms('chest', latJug), arms('chest', latTop)), highlight: ['deltsFront', 'deltsSide'] },
    ],
  },
  {
    id: 'hammer-curl', view: 'threeQuarter',
    ...work(standTall({ ...splitStance, ...arms('chest', hammerDown) }), standTall({ ...splitStance, ...arms('chest', hammerTop) }), { lower: 3, lift: 2, pauseTop: 1 }),
    equipment: [{ kind: 'dumbbells' }],
    mistakes: [
      { id: 'hammer-curl.body-swing', label: 'Swinging the body', delta: { root: [0, 0, 0.05], rootRot: [-7, 0, 0], lumbar: [-9, 0, 0] }, highlight: ['lowerBack'] },
      { id: 'hammer-curl.elbows-drifting', label: 'Elbows drift forward', delta: diff(arms('chest', hammerDrift), arms('chest', hammerTop)), highlight: ['deltsFront'] },
      { id: 'hammer-curl.bent-wrists', label: 'Wrists bent', delta: diff(arms('chest', hammerCocked), arms('chest', hammerTop)), highlight: ['forearms'] },
    ],
  },
  {
    id: 'barbell-curl', view: 'side',
    ...work(standTall(arms('chest', curlDown)), standTall(arms('chest', curlTop)), { lower: 3, lift: 2, pauseTop: 1 }),
    equipment: [{ kind: 'barbell', plates: 0 }],
    mistakes: [
      {
        id: 'barbell-curl.body-swing', label: 'Swinging the body', highlight: ['lowerBack'],
        keys: [
          { t: 0, pose: standTall(arms('chest', curlDown)) },
          { t: 0.1, pose: standTall({ root: [0, 0.9, -0.06], rootRot: [18, 0, 0], ...arms('chest', curlDown) }) },
          { t: 0.3, pose: standTall({ root: [0, STAND_Y, 0.05], rootRot: [-8, 0, 0], lumbar: [-10, 0, 0], ...arms('chest', curlTop) }), ease: 'out' },
          { t: 0.5, pose: standTall({ root: [0, STAND_Y, 0.05], rootRot: [-8, 0, 0], lumbar: [-10, 0, 0], ...arms('chest', curlTop) }) },
        ],
      },
      { id: 'barbell-curl.elbows-forward', label: 'Elbows drift forward', delta: diff(arms('chest', curlChin), arms('chest', curlTop)), highlight: ['deltsFront'] },
      {
        id: 'barbell-curl.dropping-the-bar', label: 'Dropping the bar', highlight: ['biceps', 'forearms'],
        keys: [
          { t: 0, pose: standTall(arms('chest', curlLocked)) },
          { t: 0.333, pose: standTall(arms('chest', curlTop)) },
          { t: 0.5, pose: standTall(arms('chest', curlTop)), ease: 'linear' },
          { t: 0.62, pose: standTall(arms('chest', curlLocked)), ease: 'in' },
        ],
      },
    ],
  },
  {
    id: 'rope-pushdown', view: 'side',
    ...work(standTall({ rootRot: [3, 0, 0], ...arms('chest', pushTop) }), standTall({ rootRot: [3, 0, 0], ...arms('chest', pushDown) }), { lower: 3, lift: 2, pauseTop: 1 }),
    equipment: [{ kind: 'cable', anchor: [0, 2.05, 0.5], hands: 'both', handle: 'rope' }, { kind: 'handle', rope: true, length: 0.06 }],
    ignoreForCamera: ['cable'],
    mistakes: [
      {
        id: 'rope-pushdown.leaning-over', label: 'Leaning over the rope', highlight: ['lowerBack', 'upperBack'],
        keys: work(standTall({ ...pushHunch, ...arms('chest', pushHunchTop) }), standTall({ ...pushHunch, ...arms('chest', pushHunchDown) }), { lower: 3, lift: 2, pauseTop: 1 }).keys,
      },
      {
        id: 'rope-pushdown.elbows-drifting', label: 'Elbows drift forward', highlight: ['deltsFront'],
        keys: work(standTall({ rootRot: [3, 0, 0], ...arms('chest', pushDrift) }), standTall({ rootRot: [3, 0, 0], ...arms('chest', pushDown) }), { lower: 3, lift: 2, pauseTop: 1 }).keys,
      },
      {
        id: 'rope-pushdown.elbows-flaring', label: 'Elbows flare out', highlight: ['deltsSide', 'triceps'],
        keys: work(standTall({ rootRot: [3, 0, 0], ...arms('chest', pushFlareTop) }), standTall({ rootRot: [3, 0, 0], ...arms('chest', pushFlareDown) }), { lower: 3, lift: 2, pauseTop: 1 }).keys,
      },
    ],
  },
  {
    id: 'face-pull', view: 'threeQuarter',
    ...work(standTall({ ...faceStance, ...arms('chest', faceStart) }), standTall({ ...faceStance, ...arms('chest', faceEnd) }), { lower: 3, lift: 2, pauseTop: 1 }),
    equipment: [{ kind: 'cable', anchor: [0, 1.62, 1.0], hands: 'both', handle: 'rope' }, { kind: 'handle', rope: true, length: 0.06 }],
    ignoreForCamera: ['cable'],
    mistakes: [
      { id: 'face-pull.leaning-back', label: 'Leaning back', delta: { root: [0, 0, 0.06], rootRot: [-10, 0, 0], lumbar: [-15, 0, 0] }, highlight: ['lowerBack'] },
      { id: 'face-pull.dropped-elbows', label: 'Elbows dropped', delta: diff(arms('chest', faceLow), arms('chest', faceEnd)), highlight: ['deltsRear', 'upperBack'] },
      { id: 'face-pull.head-poke', label: 'Head pokes forward', delta: { neck: [28, 0, 0], head: [-30, 0, 0], thoracic: [4, 0, 0] }, highlight: ['neck'] },
    ],
  },
  {
    id: 'cable-fly', view: 'threeQuarter',
    ...work(standTall({ ...flyStance, ...arms('chest', flyOpen) }), standTall({ ...flyStance, ...arms('chest', flyClosed) }), { lower: 3, lift: 2, pauseTop: 1 }),
    equipment: [
      { kind: 'cable', anchor: [0.95, 1.52, -0.22], hands: 'L', handle: 'single' },
      { kind: 'cable', anchor: [-0.95, 1.52, -0.22], hands: 'R', handle: 'single' },
    ],
    ignoreForCamera: ['cable'],
    mistakes: [
      {
        id: 'cable-fly.pressing', label: 'Pressing, not hugging', highlight: ['triceps', 'deltsFront'],
        keys: [
          { t: 0, pose: standTall({ ...flyStance, ...arms('chest', flyOpen) }) },
          { t: 0.18, pose: standTall({ ...flyStance, ...arms('chest', flyBent) }) },
          { t: 0.333, pose: standTall({ ...flyStance, ...arms('chest', flyPressed) }) },
          { t: 0.5, pose: standTall({ ...flyStance, ...arms('chest', flyPressed) }), ease: 'linear' },
          { t: 0.75, pose: standTall({ ...flyStance, ...arms('chest', flyBent) }) },
        ],
      },
      {
        id: 'cable-fly.over-stretch', label: 'Opening too far', highlight: ['chest', 'deltsFront'],
        keys: [
          { t: 0, pose: standTall({ ...flyStance, ...arms('chest', flyBehind) }) },
          { t: 0.333, pose: standTall({ ...flyStance, ...arms('chest', flyClosed) }) },
          { t: 0.5, pose: standTall({ ...flyStance, ...arms('chest', flyClosed) }), ease: 'linear' },
        ],
      },
      { id: 'cable-fly.hunching', label: 'Hunching forward', constant: true, delta: { spine: [26, 0, 0], thoracic: [10, 0, 0], clavL: [0, 12], clavR: [0, 12], neck: [14, 0, 0] }, highlight: ['upperBack', 'lowerBack'] },
    ],
  },
  {
    id: 'dumbbell-shoulder-press', view: 'threeQuarter',
    ...rep(sit({ ...pressRecline, ...arms('chest', dspUp) }, { half: 0.22, toe: 15 }), sit({ ...pressRecline, ...arms('chest', dspDown) }, { half: 0.22, toe: 15 }), { lower: 3, lift: 2 }),
    equipment: [seatPad(0.06), backrest(SEAT, -0.13, 8, 0.82), { kind: 'dumbbells' }],
    mistakes: [
      { id: 'dumbbell-shoulder-press.leaning-back', label: 'Leaning back', constant: true, delta: slumpBack, highlight: ['lowerBack'] },
      { id: 'dumbbell-shoulder-press.elbows-back', label: 'Elbows behind the body', delta: diff(arms('chest', dspBack), arms('chest', dspDown)), highlight: ['deltsFront', 'deltsSide'] },
      { id: 'dumbbell-shoulder-press.drifting-dumbbells', label: 'Dumbbells drift wide', constant: true, delta: { handL: [0.12, -0.02, 0], handR: [-0.12, -0.02, 0] }, highlight: ['deltsSide', 'triceps'] },
    ],
  },
  {
    id: 'arnold-press', view: 'threeQuarter', duration: 5,
    keys: [
      { t: 0, pose: seatedPress(arnUp), depth: 0 },
      { t: 0.3, pose: seatedPress(arnMid), depth: 0.5, ease: 'in' },
      { t: 0.6, pose: seatedPress(arnDown), depth: 1, ease: 'out' },
      { t: 0.8, pose: seatedPress(arnMid), depth: 0.5, ease: 'in' },
    ],
    equipment: [seatPad(0.06), backrest(SEAT, -0.13, 8, 0.82), { kind: 'dumbbells' }],
    mistakes: [
      { id: 'arnold-press.leaning-back', label: 'Leaning back off the pad', constant: true, delta: slumpBack, highlight: ['lowerBack'] },
      {
        id: 'arnold-press.wrist-only-twist', label: 'Twisting only the wrists', highlight: ['deltsFront', 'forearms'],
        keys: [
          { t: 0, pose: seatedPress(arnFrontUp) },
          { t: 0.3, pose: seatedPress(arnFront) },
          { t: 0.45, pose: seatedPress(arnTurned) },
          { t: 0.6, pose: seatedPress(arnDown) },
          { t: 0.68, pose: seatedPress(arnTurned) },
          { t: 0.76, pose: seatedPress(arnFront) },
        ],
      },
      {
        id: 'arnold-press.jerky-rotation', label: 'Jerking through the turn', highlight: ['deltsSide', 'deltsRear'],
        keys: [
          { t: 0, pose: seatedPress(arnUp) },
          { t: 0.3, pose: seatedPress(arnMid), ease: 'in' },
          { t: 0.6, pose: seatedPress(arnDown), ease: 'out' },
          { t: 0.66, pose: seatedPress(arnSnap), ease: 'in' },
          { t: 0.7, pose: seatedPress(arnMid, { handL: add(arnMid.hand, [0.03, 0.03, -0.03]), handR: mx(add(arnMid.hand, [-0.03, 0.01, 0.03])) }) },
          { t: 0.74, pose: seatedPress(arnMid, { handL: add(arnMid.hand, [-0.02, 0.01, 0.02]), handR: mx(add(arnMid.hand, [0.02, 0.03, -0.02])) }) },
          { t: 0.8, pose: seatedPress(arnMid) },
        ],
      },
    ],
  },
  {
    id: 'overhead-tricep-extension', view: 'side',
    ...rep(sit({ rootRot: [-4, 0, 0], ...arms('chest', oteUp) }), sit({ rootRot: [-4, 0, 0], ...arms('chest', oteDown) }), { lower: 3, lift: 2 }),
    equipment: [seatPad(0.06), backrest(SEAT, -0.13, 4, 0.44), { kind: 'dumbbells', hands: 'goblet' }],
    mistakes: [
      { id: 'overhead-tricep-extension.arching', label: 'Arching, ribs flared', delta: { rootRot: [22, 0, 0], lumbar: [-22, 0, 0] }, highlight: ['lowerBack'] },
      { id: 'overhead-tricep-extension.elbows-flaring', label: 'Elbows flare out', delta: diff(arms('chest', oteFlare), arms('chest', oteDown)), highlight: ['deltsSide', 'triceps'] },
      { id: 'overhead-tricep-extension.head-bowed', label: 'Head bowed', delta: { ...diff(arms('chest', oteBowed), arms('chest', oteDown)), neck: [25, 0, 0] }, highlight: ['neck'] },
    ],
  },
  {
    id: 'seated-cable-curl', view: 'threeQuarter',
    ...work(sit({ rootRot: [-5, 0, 0], ...arms('chest', sccDown) }), sit({ rootRot: [-5, 0, 0], ...arms('chest', sccUp) }), { lower: 3, lift: 2, pauseTop: 1 }),
    equipment: [
      seatPad(0.06), backrest(SEAT, -0.135, 5, 0.75),
      { kind: 'cable', anchor: [0.45, 0.12, -0.02], hands: 'L', handle: 'single' }, { kind: 'cable', anchor: [-0.45, 0.12, -0.02], hands: 'R', handle: 'single' },
    ],
    ignoreForCamera: ['cable'],
    mistakes: [
      {
        id: 'seated-cable-curl.rocking', label: 'Rocking to swing the weight', highlight: ['lowerBack'],
        keys: [
          { t: 0, pose: sit({ rootRot: [12, 0, 0], spine: [6, 0, 0], ...arms('chest', sccDown) }) },
          { t: 0.333, pose: sit({ root: [0, SEAT + 0.072, -0.01], rootRot: [-12, 0, 0], lumbar: [-15, 0, 0], ...arms('chest', sccUp) }), ease: 'out' },
          { t: 0.5, pose: sit({ root: [0, SEAT + 0.072, -0.01], rootRot: [-12, 0, 0], lumbar: [-15, 0, 0], ...arms('chest', sccUp) }), ease: 'linear' },
        ],
      },
      { id: 'seated-cable-curl.elbows-forward', label: 'Elbows drift forward', delta: diff(arms('chest', sccForward), arms('chest', sccUp)), highlight: ['deltsFront'] },
      {
        id: 'seated-cable-curl.rounding-to-handles', label: 'Rounding down to the handles', highlight: ['lowerBack'],
        keys: [
          { t: 0, pose: sit({ rootRot: [-5, 0, 0], ...arms('chest', sccDown) }) },
          { t: 0.35, pose: sit(sccReach) },
          { t: 0.65, pose: sit(sccReach), ease: 'linear' },
        ],
      },
    ],
  },
  {
    id: 'machine-shoulder-press', view: 'threeQuarter',
    ...rep(
      sit({ rootRot: [-5, 0, 0], neck: [-6, 0, 0], head: [5, 0, 0], ...handles(0.27, 1.53, 0.03, [0, 1, 0], [0.6, -0.3, 0.4]) }, { half: 0.18 }),
      sit({ rootRot: [-5, 0, 0], neck: [-6, 0, 0], head: [5, 0, 0], ...handles(0.31, 1.19, 0.0, [0, 1, 0.1], [0.6, -1, 0.5]) }, { half: 0.18 }),
      { lower: 3, lift: 2 },
    ),
    equipment: [
      { kind: 'machine', model: 'shoulderPress', pos: [0, 0, -0.6] }, seatPad(0.06), backrest(SEAT, -0.135, 5, 0.95),
      { kind: 'cable', anchor: [0.34, 1.32, -0.36], hands: 'L', handle: 'single' }, { kind: 'cable', anchor: [-0.34, 1.32, -0.36], hands: 'R', handle: 'single' },
    ],
    ignoreForCamera: ['cable'],
    mistakes: [
      {
        id: 'machine-shoulder-press.arching', label: 'Arching off the pad', highlight: ['lowerBack'],
        keys: rep(
          sit({ root: [0, SEAT + 0.072, -0.02], rootRot: [8, 0, 0], lumbar: [-20, 0, 0], thoracic: [-4, 0, 0], ...handles(0.27, 1.53, 0.03, [0, 1, 0], [0.6, -0.3, 0.4]) }, { half: 0.18 }),
          sit({ rootRot: [-5, 0, 0], neck: [-6, 0, 0], head: [5, 0, 0], ...handles(0.31, 1.19, 0.0, [0, 1, 0.1], [0.6, -1, 0.5]) }, { half: 0.18 }),
          { lower: 3, lift: 2 },
        ).keys,
      },
      { id: 'machine-shoulder-press.seat-too-low', label: 'Handles start too low', delta: { handL: [0, -0.32, 0.02], handR: [0, -0.32, 0.02], elbowPoleL: [0, -0.5, 0], elbowPoleR: [0, -0.5, 0] }, highlight: ['deltsFront'] },
      {
        id: 'machine-shoulder-press.flared-elbows', label: 'Elbows flared straight out', highlight: ['deltsSide', 'deltsFront'],
        keys: rep(
          sit({ rootRot: [-5, 0, 0], neck: [-6, 0, 0], head: [5, 0, 0], ...handles(0.36, 1.52, -0.08, [0, 1, 0], [1, -0.2, -0.1]) }, { half: 0.18 }),
          sit({ rootRot: [-5, 0, 0], neck: [-6, 0, 0], head: [5, 0, 0], ...handles(0.45, 1.3, -0.09, [0, 1, 0], [1, -0.5, -0.1]), palmL: [0, 0, 1], palmR: [0, 0, 1] }, { half: 0.18 }),
          { lower: 3, lift: 2 },
        ).keys,
      },
    ],
  },
  {
    id: 'machine-chest-press', view: 'threeQuarter',
    ...rep(
      sit({ rootRot: [-10, 0, 0], ...handles(0.21, 0.88, 0.45, [0, 0, 1], [0.7, -0.6, -0.3]) }, { half: 0.17 }),
      sit({ rootRot: [-10, 0, 0], ...handles(0.24, 0.87, 0.14, [0, 0, 1], [0.7, -0.7, -0.3]) }, { half: 0.17 }),
      { lower: 3, lift: 2 },
    ),
    equipment: [
      { kind: 'machine', model: 'chestPress', pos: [0, 0, -0.6] }, seatPad(0.06), backrest(SEAT, -0.13, 10, 0.85),
      { kind: 'cable', anchor: [0.44, 1.5, -0.28], hands: 'L', handle: 'single' }, { kind: 'cable', anchor: [-0.44, 1.5, -0.28], hands: 'R', handle: 'single' },
    ],
    ignoreForCamera: ['cable'],
    mistakes: [
      { id: 'machine-chest-press.seat-too-low', label: 'Seat too low', constant: true, delta: { handL: [0, 0.09, 0], handR: [0, 0.09, 0], elbowPoleL: [0.3, 1.2, 0], elbowPoleR: [-0.3, 1.2, 0], clavL: [9, 0], clavR: [9, 0] }, highlight: ['deltsFront', 'traps'] },
      { id: 'machine-chest-press.too-deep', label: 'Starting too deep', delta: { handL: [0.1, 0, -0.2], handR: [-0.1, 0, -0.2], elbowPoleL: [0.3, 0, -0.4], elbowPoleR: [-0.3, 0, -0.4] }, highlight: ['chest', 'deltsFront'] },
      { id: 'machine-chest-press.arching', label: 'Arching off the pad', constant: true, delta: { root: [0, 0.02, 0.01], rootRot: [18, 0, 0], lumbar: [-20, 0, 0], thoracic: [-4, 0, 0] }, highlight: ['lowerBack'] },
    ],
  },
  {
    id: 'skull-crushers', view: 'threeQuarter',
    ...rep(onBench(arms('chest', skullUp)), onBench(arms('chest', skullDown)), { lower: 3, lift: 2 }),
    equipment: [{ kind: 'bench', pos: [0, 0, -0.25], length: 1.25 }, { kind: 'dumbbells' }],
    mistakes: [
      { id: 'skull-crushers.elbows-flaring', label: 'Elbows flare out', delta: diff(arms('chest', skullFlare), arms('chest', skullDown)), highlight: ['triceps', 'deltsRear'] },
      {
        id: 'skull-crushers.dropping-the-bar', label: 'Dropping it towards the face', highlight: ['triceps', 'neck'],
        keys: [
          { t: 0, pose: onBench(arms('chest', skullUp)) },
          { t: 0.5, pose: onBench(arms('chest', skullNear)) },
          { t: 0.55, pose: onBench(arms('chest', skullCrash)), ease: 'in' },
          { t: 0.62, pose: onBench(arms('chest', skullCrash)), ease: 'linear' },
        ],
      },
      { id: 'skull-crushers.arched-back', label: 'Arching the back', constant: true, delta: { lumbar: [-16, 0, 0], root: [0, 0.04, 0], thoracic: [-4, 0, 0] }, highlight: ['lowerBack'] },
    ],
  },
  {
    id: 'incline-dumbbell-press', view: 'threeQuarter',
    ...rep(pressSeat(60, inclineUp(60)), pressSeat(60, inclineDown(60)), { lower: 3, lift: 2 }),
    equipment: [...adjustable(60, -0.03), { kind: 'dumbbells' }],
    mistakes: [
      {
        // The pad really is at 50° from the floor, so the press path turns overhead.
        id: 'incline-dumbbell-press.bench-too-steep', label: 'Bench set too steep', highlight: ['deltsFront'],
        equipment: [...adjustable(40, -0.06), { kind: 'dumbbells' }],
        keys: rep(pressSeat(40, inclineUp(40)), pressSeat(40, inclineDown(40)), { lower: 3, lift: 2 }).keys,
      },
      { id: 'incline-dumbbell-press.flared-elbows', label: 'Elbows flared to the neck', delta: diff(arms('chest', inclineFlared), arms('chest', inclineDown(60))), highlight: ['deltsFront', 'chest'] },
      { id: 'incline-dumbbell-press.slide-and-arch', label: 'Sliding down and arching', constant: true, delta: { root: [0, 0, 0.07], rootRot: [8, 0, 0], lumbar: [-17, 0, 0], neck: [12, 0, 0] }, highlight: ['lowerBack'] },
    ],
  },
  {
    id: 'incline-dumbbell-curl', view: 'side',
    ...work(curlSeat(40, icurlDown), curlSeat(40, icurlUp), { lower: 3, lift: 2, pauseTop: 1 }),
    equipment: [...adjustable(40, -0.085), { kind: 'dumbbells' }],
    mistakes: [
      { id: 'incline-dumbbell-curl.elbows-forward', label: 'Elbows swing forward', delta: diff(arms('shoulders', icurlSwing), arms('shoulders', icurlUp)), highlight: ['deltsFront'] },
      { id: 'incline-dumbbell-curl.shoulders-off-pad', label: 'Shoulders lift off the pad', delta: { clavL: [4, 14], clavR: [4, 14], thoracic: [10, 0, 0], neck: [18, 0, 0], head: [-22, 0, 0] }, highlight: ['deltsFront', 'neck'] },
      {
        // The pad really is at 30° from the floor, so the hanging arms end up far behind the torso.
        id: 'incline-dumbbell-curl.bench-too-flat', label: 'Bench set too flat', highlight: ['deltsFront', 'biceps'],
        equipment: [...adjustable(60, -0.052), { kind: 'dumbbells' }],
        keys: work(curlSeat(60, icurlDown), curlSeat(60, icurlUp), { lower: 3, lift: 2, pauseTop: 1 }).keys,
      },
    ],
  },
  {
    id: 'chest-supported-row', view: 'side',
    ...work(onPad({ clavL: [0, 10], clavR: [0, 10], ...arms('shoulders', rowHang) }), onPad({ clavL: [0, -8], clavR: [0, -8], ...arms('shoulders', rowTop) }), { lower: 3, lift: 2, pauseTop: 1 }),
    equipment: [...chestPad(0.771, 0.122, 38, 0.4, 0.3, 0.62), { kind: 'dumbbells' }],
    mistakes: [
      { id: 'chest-supported-row.chest-off-pad', label: 'Chest lifts off the pad', delta: { lumbar: [-15, 0, 0], thoracic: [-6, 0, 0], neck: [-18, 0, 0] }, highlight: ['lowerBack', 'neck'] },
      { id: 'chest-supported-row.neck-crane', label: 'Craning the neck', constant: true, delta: { neck: [-22, 0, 0], head: [-10, 0, 0] }, highlight: ['neck'] },
      { id: 'chest-supported-row.pad-too-far', label: 'Rounding to reach', constant: true, delta: { root: [0, 0.08, -0.01], spine: [20, 0, 0], neck: [-15, 0, 0], clavL: [0, 12], clavR: [0, 12], footL: [0, 0, 0.06], footR: [0, 0, 0.06] }, highlight: ['upperBack', 'lowerBack'] },
    ],
  },
  {
    id: 'rear-delt-fly', view: 'threeQuarter',
    ...work(onSteepPad(arms('shoulders', rdfDown)), onSteepPad(arms('shoulders', rdfTop)), { lower: 3, lift: 2, pauseTop: 1 }),
    equipment: [seatPad(-0.26, 0.46, 0.5), ...chestPad(0.66, 0.14, 50, 0.3, 0.3, 0.58), { kind: 'dumbbells' }],
    mistakes: [
      { id: 'rear-delt-fly.chest-off-pad', label: 'Chest lifts off the pad', delta: { lumbar: [-15, 0, 0], thoracic: [-6, 0, 0], neck: [-18, 0, 0] }, highlight: ['lowerBack', 'neck'] },
      { id: 'rear-delt-fly.elbows-to-hips', label: 'Elbows sweep to the hips', delta: diff(arms('shoulders', rdfHips), arms('shoulders', rdfTop)), highlight: ['lats', 'deltsRear'] },
      { id: 'rear-delt-fly.bending-elbows', label: 'Bending the elbows', delta: diff(arms('shoulders', rdfBent), arms('shoulders', rdfTop)), highlight: ['biceps', 'deltsRear'] },
    ],
  },
  {
    id: 'lat-pulldown', view: 'side',
    ...work(latSeat({ clavL: [8, 0], clavR: [8, 0], ...arms('chest', pullUp) }), latSeat({ clavL: [-5, -3], clavR: [-5, -3], ...arms('chest', pullDown) }), { lower: 3, lift: 2, pauseTop: 1 }),
    equipment: [
      seatPad(0.0, 0.4), { kind: 'box', pos: [0, 0.597, 0.28], size: [0.55, 0.09, 0.12], material: 'pad' }, { kind: 'box', pos: [0, 0.617, 0.38], size: [0.06, 0.05, 0.16], material: 'frame' },
      { kind: 'cable', anchor: [0, 2.08, 0.38], hands: 'both' }, { kind: 'handle', length: 1.0 },
    ],
    ignoreForCamera: ['cable'],
    mistakes: [
      {
        id: 'lat-pulldown.leaning-back', label: 'Leaning back and swinging', highlight: ['lowerBack'],
        keys: [
          { t: 0, pose: latSeat({ clavL: [8, 0], clavR: [8, 0], ...arms('chest', pullUp) }) },
          { t: 0.333, pose: latSeat({ rootRot: [-30, 0, 0], lumbar: [-15, 0, 0], ...arms('chest', pullDown) }), ease: 'out' },
          { t: 0.5, pose: latSeat({ rootRot: [-30, 0, 0], lumbar: [-15, 0, 0], ...arms('chest', pullDown) }), ease: 'linear' },
          { t: 0.8, pose: latSeat({ rootRot: [4, 0, 0], clavL: [8, 0], clavR: [8, 0], ...arms('chest', pullUp) }) },
        ],
      },
      { id: 'lat-pulldown.behind-the-neck', label: 'Bar behind the neck', delta: { ...diff(arms('chest', pullNeck), arms('chest', pullDown)), neck: [28, 0, 0] }, highlight: ['deltsFront', 'neck'] },
      { id: 'lat-pulldown.shrugging', label: 'Shrugging the shoulders', constant: true, delta: { clavL: [13, 0], clavR: [13, 0], handL: [0, 0.045, 0], handR: [0, 0.045, 0] }, highlight: ['traps', 'neck'] },
    ],
  },
  {
    id: 'seated-cable-row', view: 'side',
    ...work(rowSeat({ clavL: [0, 12], clavR: [0, 12], ...arms('chest', rowLong) }), rowSeat({ clavL: [0, -8], clavR: [0, -8], ...arms('chest', rowIn) }), { lower: 3, lift: 2, pauseTop: 1 }),
    equipment: [
      { kind: 'bench', pos: [0, 0, -0.3], length: 1.0, height: 0.42 }, ...chestPad(0.108, 0.32, 50, 0.32, 0.5),
      { kind: 'cable', anchor: [0, 0.42, 0.8], hands: 'both' }, { kind: 'handle', length: 0.2 },
    ],
    ignoreForCamera: ['cable'],
    mistakes: [
      {
        id: 'seated-cable-row.rounded-reach', label: 'Rounding forward on the return', highlight: ['lowerBack'],
        keys: work(rowSeat({ rootRot: [8, 0, 0], spine: [18, 0, 0], lumbar: [12, 0, 0], neck: [15, 0, 0], clavL: [0, 16], clavR: [0, 16], ...arms('chest', rowLong) }), rowSeat({ clavL: [0, -8], clavR: [0, -8], ...arms('chest', rowIn) }), { lower: 3, lift: 2, pauseTop: 1 }).keys,
      },
      {
        id: 'seated-cable-row.leaning-back', label: 'Rowing with the back', highlight: ['lowerBack'],
        keys: work(rowSeat({ rootRot: [12, 0, 0], clavL: [0, 12], clavR: [0, 12], ...arms('chest', rowLong) }), rowSeat({ rootRot: [-14, 0, 0], lumbar: [-14, 0, 0], clavL: [0, -8], clavR: [0, -8], ...arms('chest', rowIn) }), { lower: 3, lift: 2, pauseTop: 1 }).keys,
      },
      { id: 'seated-cable-row.locked-knees', label: 'Knees locked straight', constant: true, delta: { root: [0, 0, -0.17], rootRot: [-15, 0, 0], lumbar: [20, 0, 0] }, highlight: ['lowerBack', 'hamstrings'] },
    ],
  },
  {
    id: 'assisted-pull-up', view: 'threeQuarter',
    ...work(hang(), chinUp(), { lower: 3, lift: 2, pauseTop: 1 }),
    equipment: [{ kind: 'pullupBar', height: BAR, z: 0.05 }, { kind: 'kneePad' }],
    mistakes: [
      {
        id: 'assisted-pull-up.kipping', label: 'Swinging and kicking up', highlight: ['lowerBack', 'hipFlexors'],
        keys: [
          { t: 0, pose: hang({ root: [0, BAR - 1.008, -0.09], hipL: [38, 3, 0], hipR: [38, 3, 0], lumbar: [8, 0, 0], rootRot: [8, 0, 0] }) },
          { t: 0.14, pose: hang({ root: [0, BAR - 0.9, 0.12], hipL: [-5, 3, 0], hipR: [-5, 3, 0], kneeL: 70, kneeR: 70, lumbar: [-10, 0, 0], rootRot: [-10, 0, 0], ...barGrip([0.4, -0.6, 0.4]) }), ease: 'in' },
          { t: 0.28, pose: chinUp({ hipL: [-5, 3, 0], hipR: [-5, 3, 0], lumbar: [-10, 0, 0], rootRot: [-14, 0, 0] }), ease: 'out' },
          { t: 0.5, pose: chinUp() },
          { t: 0.85, pose: hang({ root: [0, BAR - 0.999, -0.12], hipL: [30, 3, 0], hipR: [30, 3, 0], lumbar: [8, 0, 0], rootRot: [12, 0, 0] }) },
        ],
      },
      { id: 'assisted-pull-up.arched-reach', label: 'Arching to reach the bar', delta: { lumbar: [-20, 0, 0], thoracic: [-4, 0, 0], neck: [16, 0, 0], head: [-30, 0, 0] }, highlight: ['lowerBack', 'neck'] },
      {
        id: 'assisted-pull-up.shrugged-hang', label: 'Hanging with shrugged shoulders', highlight: ['traps', 'neck'],
        keys: work(hang({ root: [0, BAR - 1.075, 0.04], clavL: [15, 0], clavR: [15, 0], neck: [14, 0, 0], head: [-8, 0, 0] }), chinUp(), { lower: 3, lift: 2, pauseTop: 1 }).keys,
      },
    ],
  },
  {
    id: 'assisted-dips', view: 'side',
    ...rep(dipTop(), dipLow(), { lower: 3, lift: 2 }),
    equipment: dipBars,
    mistakes: [
      { id: 'assisted-dips.too-deep', label: 'Sinking too deep', delta: { root: [0, -0.1, 0.03], rootRot: [6, 0, 0], clavL: [0, 14], clavR: [0, 14] }, highlight: ['deltsFront', 'chest'] },
      { id: 'assisted-dips.flared-elbows', label: 'Elbows flare out', delta: { elbowPoleL: [1.4, 0, 0.8], elbowPoleR: [-1.4, 0, 0.8] }, highlight: ['deltsFront', 'chest'] },
      { id: 'assisted-dips.arched-back', label: 'Arching on the pad', constant: true, delta: { rootRot: [8, 0, 0], lumbar: [-17, 0, 0], thoracic: [-4, 0, 0] }, highlight: ['lowerBack'] },
    ],
  },
  {
    id: 'push-ups', view: 'threeQuarter',
    ...rep(plankAt(0.558), plankAt(0.205), { lower: 3, lift: 2 }),
    equipment: [{ kind: 'mat', pos: [0, 0, -0.1] }],
    ignoreForCamera: ['mat'],
    mistakes: [
      { id: 'push-ups.sagging-hips', label: 'Hips sagging', constant: true, delta: { root: [0, -0.07, 0], rootRot: [8, 0, 0], lumbar: [-18, 0, 0] }, highlight: ['lowerBack', 'abs'] },
      { id: 'push-ups.flared-elbows', label: 'Elbows flared in a T', constant: true, delta: { handL: [0.12, 0, 0.18], handR: [-0.12, 0, 0.18], elbowPoleL: [0.6, 0.6, 0.8], elbowPoleR: [-0.6, 0.6, 0.8] }, highlight: ['deltsFront', 'chest'] },
      { id: 'push-ups.head-drop', label: 'Head dropping first', delta: { neck: [36, 0, 0], root: [0, 0.05, 0], rootRot: [-4, 0, 0] }, highlight: ['neck'] },
    ],
  },
  {
    // Sided: the left arm rows; the right knee and hand rest on the bench.
    id: 'one-arm-dumbbell-row', view: 'side', sided: true,
    ...work(rowBench(rowArm(ROW_SH, false)), rowBench(rowArm(ROW_SH, true)), { lower: 3, lift: 2, pauseTop: 1 }),
    equipment: [{ kind: 'bench', pos: [-0.15, 0, 0], length: 1.2 }, { kind: 'dumbbells', hands: 'L' }],
    mistakes: [
      { id: 'one-arm-dumbbell-row.torso-twist', label: 'Twisting the torso open', delta: { spine: [0, 0, 25], rootTwist: 4, ...diff(rowArm(TWIST_SH, true), rowArm(ROW_SH, true)) }, highlight: ['obliques', 'lowerBack'] },
      { id: 'one-arm-dumbbell-row.rounded-back', label: 'Rounded back, head up', constant: true, delta: { lumbar: [17, 0, 0], thoracic: [10, 0, 0], neck: [-30, 0, 0], handL: add(ROUND_SH, ROW_SH, -1) }, highlight: ['lowerBack', 'neck'] },
      {
        id: 'one-arm-dumbbell-row.leg-heave', label: 'Heaving with the legs', highlight: ['lowerBack', 'quads'],
        keys: [
          { t: 0, pose: rowBench(rowArm(ROW_SH, false)) },
          { t: 0.1, pose: rowBench({ root: [0, 0.87, -0.12], rootRot: [74, 0, 0], ...rowArm(ROW_SH, false) }) },
          { t: 0.18, pose: rowBench({ root: [0, 0.915, -0.12], rootRot: [80, 0, 0], ...rowArm(ROW_SH, false) }), ease: 'out' },
          { t: 0.26, pose: rowBench(rowArm(ROW_SH, true)), ease: 'out' },
          { t: 0.5, pose: rowBench(rowArm(ROW_SH, true)), ease: 'linear' },
        ],
      },
    ],
  },
  {
    // Sided: the left arm presses with the left knee down.
    id: 'landmine-press', view: 'threeQuarter', sided: true,
    ...work(halfKneel(mineLow), halfKneel(mineHigh), { lower: 3, lift: 2 }),
    equipment: [{ kind: 'box', pos: [0.1, 0, -0.08], size: [0.3, 0.04, 0.42], material: 'pad' }, { kind: 'landmine', anchor: LANDMINE, hands: 'L' }],
    mistakes: [
      { id: 'landmine-press.arching', label: 'Arching the lower back', delta: { rootRot: [8, 0, 0], lumbar: [-17, 0, 0], thoracic: [-3, 0, 0] }, highlight: ['lowerBack'] },
      { id: 'landmine-press.twisting', label: 'Twisting to drive the bar', delta: { rootRot: [0, -7, 0], spine: [0, 0, -20], handL: [-0.08, -0.02, 0.06] }, highlight: ['obliques', 'lowerBack'] },
      { id: 'landmine-press.pressing-across', label: 'Pressing across the body', delta: { handL: [-0.24, -0.04, -0.02], elbowPoleL: [0.3, 0, 0] }, highlight: ['deltsFront', 'chest'] },
    ],
  },
];
