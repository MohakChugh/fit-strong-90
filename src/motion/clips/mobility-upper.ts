/** Neck, thoracic, chest, shoulder, lat, arm and torso mobility clips. */
import type { Clip, Ease, Equipment, Pose, Vec3 } from '../types';
import { KNEEL_Y, kneel, prone, quadruped, rep, seated, standing, supine } from './kit';

const cat: Pose = quadruped({ rootRot: [72, 0, 0], spine: [30, 0, 0], neck: [22, 0, 0] });
const cow: Pose = quadruped({ rootRot: [97, 0, 0], spine: [-20, 0, 0], neck: [-18, 0, 0] });

/** Chair seat height; the chair sits under the figure so the seat ends a hand's width behind the knees. */
const SEAT = 0.46;
const CHAIR: Equipment = { kind: 'chair', pos: [0, 0, -0.02] };
/** Sitting tall on the chair, hands resting on the thighs. */
const sit = (extra: Pose = {}): Pose => seated(SEAT, {
  root: [0, SEAT + 0.065, -0.05],
  handL: [0.13, 0.615, 0.17], handR: [-0.13, 0.615, 0.17], palmL: [0, -1, 0], palmR: [0, -1, 0], fingersL: [0, -0.2, 1], fingersR: [0, -0.2, 1],
  elbowPoleL: [0.35, -0.2, -1], elbowPoleR: [-0.35, -0.2, -1],
  ...extra,
});

/** Chin tuck: the head glides straight back (lower neck extends, upper neck flexes) with the gaze level. */
const TUCK: Pose = { neck: [-13, 0, 0], head: [13, 0, 0] };

/** Alternating keys from t0 up to t1 every `dt`: a small bounce between pose a and pose b. */
const bounces = (t0: number, t1: number, dt: number, a: Pose, aExtra: Pose, b: Pose, bExtra: Pose) => {
  const out: { t: number; pose: Pose; ease: 'inOut' }[] = [];
  for (let k = 1, t = t0 + dt; t < t1 + 1e-6; k++, t += dt) out.push({ t: Math.min(t, t1), pose: { ...(k % 2 ? a : b), ...(k % 2 ? aExtra : bExtra) }, ease: 'inOut' });
  return out;
};

/** Upper trap stretch: left hand holds the left seat edge, head tips right, nose forward. */
const trap = (neckSide: number, headSide: number, shoulderDrop: number, chest = 0): Pose => sit({
  handL: [0.24, 0.44, 0], palmL: [-1, 0, 0], fingersL: [0, -1, 0], gripL: 0.65, elbowPoleL: [0.3, 0, -1],
  clavL: [shoulderDrop, 0], neck: [0, neckSide, 0], head: [0, headSide, 0], thoracic: [-chest, 0, 0],
});
/** The right hand over the top of the head, cupping its left side (palm down on the skull). */
const pullHand = (at: Vec3): Pose => ({
  handR: at, palmR: [-0.14, -0.99, 0.07], fingersR: [1, -0.2, 0], elbowPoleR: [-1, 0.5, 0.2], gripR: 0.3,
});

/** Levator stretch: left hand holds the back of the seat; right hand on the thigh unless given. */
const lev = (neck: Vec3, head: Vec3, hand: Pose = {}, shoulderDrop = -4): Pose => sit({
  handL: [0.24, 0.44, -0.15], palmL: [-1, 0, 0], fingersL: [0, -1, 0], gripL: 0.65, elbowPoleL: [0.4, 0, -1],
  clavL: [shoulderDrop, -2], neck, head, ...hand,
});
/** On its way up to the head, clear of the chest. */
const HAND_UP: Pose = { handR: [-0.24, 1.2, 0.1], palmR: [1, 0, -0.2], fingersR: [0.1, 1, 0.2], elbowPoleR: [-1, -0.6, 0.2] };
/** The right palm resting on the back of the crown, for its weight only. */
const restHand = (at: Vec3, palm: Vec3): Pose => ({
  handR: at, palmR: palm, fingersR: [0.707, 0, 0.707], elbowPoleR: [-1, 0.2, 0.4], gripR: 0.2,
});

/** Calm breathing on the chair, hands resting on the belly: b 0 breathed out … 1 breathed in; belly 0 keeps it still. */
const calm = (b: number, belly = 1): Pose => sit({
  handL: [0.065, 0.638, 0.08 + 0.02 * b * belly], handR: [-0.065, 0.638, 0.08 + 0.02 * b * belly],
  palmL: [0, 0, -1], palmR: [0, 0, -1], fingersL: [-0.7, -0.7, 0], fingersR: [0.7, -0.7, 0], gripL: 0.15, gripR: 0.15,
  thoracic: [-0.7 * b, 0, 0], lumbar: [-1.6 * b * belly, 0, 0],
});

/** Right hand hanging by the side, as a chest-space target (where ARMS_DOWN puts it), so it can travel to a contact. */
const R_DOWN: Pose = { handR: [-0.317, -0.338, 0.136], palmR: [1, 0, 0], fingersR: [0, -1, 0], elbowPoleR: [-0.35, -0.2, -1] };

/** Cross-body stretch: left arm across the chest (FK), right hand holding just above its elbow (chest space). */
const across = (flex: number, adduct: number, hold: Vec3, palm: Vec3, extra: Pose = {}): Pose => standing({
  handSpace: 'chest', shoulderL: [flex, -adduct, 0], elbowL: 15, clavL: [0, 3],
  handR: hold, palmR: palm, fingersR: [0, 1, 0], elbowPoleR: [-0.4, -1, 0.2], gripR: 0.6, ...extra,
});

/** Overhead triceps: left elbow up at the ceiling with the hand down between the shoulder blades (FK); the right hand presses just above that elbow (chest space). */
const overhead = (flex: number, elbow: number, press: Vec3, palm: Vec3, extra: Pose = {}): Pose => standing({
  handSpace: 'chest', shoulderL: [flex, 2, -80], elbowL: elbow, clavL: [0, 0],
  handR: press, palmR: palm, fingersR: [0.55, 0.62, 0.55], elbowPoleR: [-1, 0.15, -0.5], gripR: 0.55, ...extra,
});

const add = (a: Vec3, b: Vec3, k = 1): Vec3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: Vec3): Vec3 => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };
/** Palm-centre target for a wrist at `w` with this palm and finger direction (the rig's grip offset). */
const palmFrom = (w: Vec3, palm: Vec3, fingers: Vec3): Vec3 => add(add(w, fingers, 0.08), palm, 0.014);

/** Both hands hanging by the sides as world targets (where ARMS_DOWN puts them), so they can travel to a hold. */
const HANDS_DOWN: Pose = {
  handL: [0.317, 0.791, 0.104], handR: [-0.317, 0.791, 0.104], palmL: [-1, 0, 0], palmR: [1, 0, 0], fingersL: [0, -1, 0], fingersR: [0, -1, 0],
  elbowPoleL: [0.35, -0.2, -1], elbowPoleR: [-0.35, -0.2, -1],
};

/** Wrist stretch: the left arm long in front and toward the midline (wrist at W, elbow soft but straight). */
const W: Vec3 = [0.025, 1.264, 0.482];
const FORE = unit([W[0] - 0.214, W[1] - 1.371, W[2] - 0.015]);
/** The left hand bent `deg` at the wrist, palm up (flexor stretch) or palm down (extensor stretch); the right palm presses on it. */
const wrist = (palmUp: boolean, deg: number, elbowBend = false): Pose => {
  const up = unit(add([0, 1, 0], FORE, -FORE[1]));
  const p0: Vec3 = palmUp ? up : [-up[0], -up[1], -up[2]];
  const r = (deg * Math.PI) / 180, c = Math.cos(r), sn = Math.sin(r);
  // Palm up, extension tips the fingers to the floor; palm down, flexion does.
  const fingers = unit(add([FORE[0] * c, FORE[1] * c, FORE[2] * c], palmUp ? [-p0[0], -p0[1], -p0[2]] : p0, sn));
  const palm = unit(add([p0[0] * c, p0[1] * c, p0[2] * c], FORE, palmUp ? sn : -sn));
  // A 38° elbow bend brings the wrist 2.2 cm closer to the shoulder.
  const hand = palmFrom(elbowBend ? add(W, FORE, -0.022) : W, palm, fingers);
  // The right palm presses on the left palm (palm up, palms facing) or on the back of the hand (palm down), never the fingertips.
  const pressPalm: Vec3 = palmUp ? [-palm[0], -palm[1], -palm[2]] : palm;
  const press = add(add(hand, palm, palmUp ? -0.015 : -0.03), fingers, 0.02);
  return standing({
    // On a straight arm the elbow pole only sets the forearm twist: these keep the hand on its target.
    handL: hand, palmL: palm, fingersL: fingers, elbowPoleL: elbowBend ? [0.4, -1, -0.3] : palmUp ? [-1, -0.3, 0] : [1, -0.3, 0],
    handR: press, palmR: pressPalm, fingersR: unit(add([0.7, -0.7, 0], pressPalm, -dot([0.7, -0.7, 0], pressPalm))),
    elbowPoleR: [-0.5, -1, 0], clavR: [0, 16], gripR: 0.3,
  });
};

/** Side bend to the left: the left hand slides down the outside of the thigh, the right hand rests on the hip (pelvis space). */
const sideBend = (bend: number, slide: number, extra: Pose = {}): Pose => standing({
  ...stanceHip, handSpace: 'pelvis',
  handL: [0.2, -0.13 - slide, 0.02], palmL: [-1, 0, 0], fingersL: [0, -1, 0.1], elbowPoleL: [0.4, 0, -1],
  handR: [-0.17, 0.06, 0.02], palmR: [1, 0, 0], fingersR: [0, -0.3, 1], elbowPoleR: [-1, 0, -0.4], gripR: 0.2,
  spine: [0, bend, 0], neck: [0, -bend * 0.25, 0], ...extra,
});
const stanceHip: Pose = { footL: [0.12, 0, 0.02], footR: [-0.12, 0, 0.02], footRotL: [0, 6, 0], footRotR: [0, -6, 0] };

/** Thread the needle, left arm: the right hand stays planted; poles keep both hands on their targets. */
const needle = (extra: Pose): Pose => quadruped({ elbowPoleL: [0.6, 0, -1], elbowPoleR: [-0.6, 0, -1], ...extra });
const NEEDLE_UP = needle({
  spine: [0, 0, 40], thoracic: [0, 0, 10], neck: [-12, 0, 30],
  handL: [0.2, 1.27, 0.42], palmL: [0, 0, 1], fingersL: [0, 1, 0], elbowPoleL: [1, 0, -0.3],
});
/** Threaded under: back of the left hand on the mat past the right hand, left shoulder and head lowered, hips square. */
const threaded = (twist: number, reach: number, extra: Pose = {}): Pose => needle({
  rootRot: [90, 0, 0], spine: [18, 0, twist], thoracic: [0, 0, twist * 0.2], neck: [0, 0, twist * 0.32],
  handL: [-0.3 - reach, 0.045, 0.42], palmL: [0, 1, 0], fingersL: [-1, 0, 0], elbowPoleL: [0, 0, -1], ...extra,
});

/**
 * Open book, lying on the RIGHT side so the LEFT (top) arm opens: head toward −X on a pillow, knees bent and
 * stacked over a cushion, bottom arm resting forward on the mat. Rolled a little past vertical (roll 84) so the
 * shoulder rests while the head still reaches the pillow. `twist` + turns the chest open toward the ceiling.
 */
const book = (twist: number, arm: Vec3, extra: Pose = {}): Pose => ({
  root: [0, 0.205, 0], rootRot: [0, 0, 84], spine: [0, 0, twist], thoracic: [0, 0, Math.max(0, twist) * 0.25],
  hipL: [88, -3, 0], hipR: [92, -3, 0], kneeL: 92, kneeR: 92, ankleL: [-12, 0], ankleR: [-12, 0],
  // Bottom arm long on the mat, palm up; the top arm sweeps with the chest (FK, so it arcs).
  handR: [-0.44, 0.05, 0.46], palmR: [0, 1, 0], fingersR: [0, 0, 1], elbowPoleR: [0, 1, 0],
  shoulderL: arm, elbowL: 8, neck: [0, Math.max(0, twist) * 0.2, 0], ...extra,
});
const BOOK_SHUT = book(-8, [86, -4, 0], { wristL: [-10, 0] });
const BOOK_UP = book(14, [88, 34, 0]);
const BOOK_OPEN = book(38, [90, 78, 0]);
const BOOK_SETTLED = book(42, [90, 96, 0]);
const BOOK_PROPS: Equipment[] = [
  { kind: 'mat', pos: [-0.15, 0, 0.2], yaw: 90 },
  // Pillow under the head, and a cushion between the stacked knees.
  { kind: 'box', pos: [-0.66, 0, 0.05], size: [0.34, 0.18, 0.4], material: 'pad' },
  { kind: 'box', pos: [0.1, 0.15, 0.4], size: [0.3, 0.1, 0.24], material: 'pad' },
];

/** Face down with the forehead resting 6.5 cm up (on a rolled towel or stacked hands), nose clear, chest on the mat. */
const faceDown = (extra: Pose = {}): Pose => prone({ root: [0, 0.118, 0], thoracic: [-3, 0, 0], clavL: [3, 0], clavR: [3, 0], neck: [-26, 0, 0], head: [20, 0, 0], ...extra });
/** Prone Y-T: straight arms with thumbs up, hands on the mat (lift 0) or just off it (lift 1); shoulder blades set back and down. */
const yt = (deg: number, lift: number): Pose => {
  const r = (deg * Math.PI) / 180, reach = 0.578 - 0.006 * lift;
  const out = Math.sin(r), up = Math.cos(r);
  return faceDown({
    handL: [0.214 + reach * out, 0.07 + 0.05 * lift, 0.44 + reach * up], handR: [-0.214 - reach * out, 0.07 + 0.05 * lift, 0.44 + reach * up],
    fingersL: [out, 0, up], fingersR: [-out, 0, up], palmL: [-up, 0, out], palmR: [up, 0, out],
    elbowPoleL: [0, -1, 0.4], elbowPoleR: [0, -1, 0.4], clavL: [-3 * lift, -6 * lift], clavR: [-3 * lift, -6 * lift],
  });
};
/** Arms sliding on the mat between Y and T along the arc (small steps keep them straight), easing in and out. */
const slide = (t0: number, t1: number, from: number, to: number, n = 4) => Array.from({ length: n }, (_, i) => ({
  t: t0 + ((t1 - t0) * (i + 1)) / n, pose: yt(from + ((to - from) * (i + 1)) / n, 0), depth: 0,
  ease: (i === 0 ? 'in' : i === n - 1 ? 'out' : 'linear') as Ease,
}));
/** Rolled towel under the forehead. */
const TOWEL: Equipment = { kind: 'box', pos: [0, 0, 0.74], size: [0.3, 0.055, 0.09], material: 'cloth' };

/** Crocodile breathing: forehead on stacked hands, elbows wide, legs relaxed with the toes turned out. b 0 breathed out … 1 in. */
const croc = (b: number): Pose => faceDown({
  root: [0, 0.118 + 0.01 * b, 0], lumbar: [5 * b, 0, 0], thoracic: [-6 - 4.5 * b, 0, 0], neck: [-38, 0, 0], head: [36, 0, 0],
  handL: [0.02, 0.015, 0.75], palmL: [0, -1, 0], fingersL: [-1, 0, 0.15], elbowPoleL: [1, 0.3, 0],
  handR: [-0.02, 0.045, 0.75], palmR: [0, -1, 0], fingersR: [1, 0, 0.15], elbowPoleR: [-1, 0.3, 0],
  hipL: [0, 4, 12], hipR: [0, 4, 12],
});

/**
 * Knee rolls: hook lying, knees and feet together, arms out wide, head on a small pillow. `pel` turns the pelvis
 * (+ drops the knees to the left; in supine + lifts the right hip), `chest` counter-turns the trunk to keep the
 * shoulders down. The pelvis rolls on its edge, so it rises a little and the trunk tips back to keep the upper back down.
 */
const kneeRoll = (pel: number, chest: number, extra: Pose = {}): Pose => {
  const k = Math.abs(pel) / 42, side = Math.sign(pel), feet = Math.min(1, Math.abs(pel) / 42) * 30 + Math.max(0, Math.abs(pel) - 42) * 0.9;
  return supine({
    root: [0, 0.1 + 0.028 * k, 0], rootRot: [-90 - 4 * k, 0, 0], rootTwist: pel, spine: [0, 0, chest], neck: [6 + 3 * k, 0, 0],
    footL: [0.06, 0.012 * feet / 30, 0.62], footR: [-0.06, 0.012 * feet / 30, 0.62], footRotL: [0, 0, -side * feet], footRotR: [0, 0, -side * feet],
    kneePoleL: [0.75 * side, side ? 0.6 : 1, 0], kneePoleR: [0.75 * side, side ? 0.6 : 1, 0],
    handL: [0.75, 0.04, -0.27], handR: [-0.75, 0.04, -0.27], palmL: [0, 1, 0], palmR: [0, 1, 0], fingersL: [0.95, 0, 0.3], fingersR: [-0.95, 0, 0.3],
    elbowPoleL: [0, 1, 0.3], elbowPoleR: [0, 1, 0.3], ...extra,
  });
};
const PILLOW: Equipment = { kind: 'box', pos: [0, 0, -0.68], size: [0.36, 0.055, 0.26], pad: true };

/** 90/90 breathing: on the back, calves resting on a chair seat (hips and knees at 90°), right hand on the chest, left on the belly. */
const ninety = (b: number, extra: Pose = {}): Pose => ({
  root: [0, 0.1, 0], rootRot: [-90, 0, 0], neck: [-10, 0, 0],
  hipL: [90, 0, 0], hipR: [90, 0, 0], kneeL: 90, kneeR: 90, ankleL: [-12, 0], ankleR: [-12, 0],
  handSpace: 'chest',
  handL: [0.04, -0.079, 0.172 + 0.022 * b], palmL: [0, 0, -1], fingersL: [-1, 0, 0], elbowPoleL: [1, 0, -1],
  handR: [-0.04, 0.131, 0.178], palmR: [0, 0, -1], fingersR: [1, 0, 0], elbowPoleR: [-1, 0, -1],
  thoracic: [-0.6 * b, 0, 0], lumbar: [-1.8 * b, 0, 0], ...extra,
});
const NINETY_CHAIR: Equipment = { kind: 'chair', pos: [0, 0, 0.25], yaw: 180, height: 0.42 };

/** Foam roller across the lower tips of the shoulder blades; hips on the mat, feet flat, hands cradling the head, elbows in. */
const ROLLER_Z = -0.31;
const onRoller = (extra: Pose): Pose => ({
  root: [0, 0.092, 0], neck: [10, 0, 0],
  footL: [0.13, 0, 0.42], footR: [-0.13, 0, 0.42], kneePoleL: [0, 1, 0.3], kneePoleR: [0, 1, 0.3],
  shoulderL: [145, 30, -60], shoulderR: [145, 30, -60], elbowL: 115, elbowR: 115, ...extra,
});
/** Curled halfway up (breathing in) and draped back over the roller (breathing out): the mid back stays on the roller. */
const ROLLER_UP = onRoller({ rootRot: [-67, 0, 0], spine: [4, 0, 0], thoracic: [8, 0, 0] });
const ROLLER_DRAPE = onRoller({ rootRot: [-66, 0, 0], lumbar: [10, 0, 0], thoracic: [-14, 0, 0] });

/** Band pull-apart: palms down on a light band at shoulder height, elbows soft; `open` 0 arms forward … 1 band at the chest. */
const pullApart = (open: number, extra: Pose = {}): Pose => {
  const x = 0.2 + 0.46 * open, z = 0.55 - 0.33 * open;
  return standing({
    handL: [x, 1.33, z], handR: [-x, 1.33, z], palmL: [0, -1, 0], palmR: [0, -1, 0], fingersL: [0, 0, 1], fingersR: [0, 0, 1],
    elbowPoleL: [0.3, -1, -0.3], elbowPoleR: [-0.3, -1, -0.3], gripL: 0.8, gripR: 0.8,
    clavL: [-2 * open, -10 * open], clavR: [-2 * open, -10 * open], ...extra,
  });
};

/** Band row from an anchor at chest height: neutral grip, chin gently tucked; `pull` 0 arms long … 1 hands at the lower ribs. */
const ROW_ANCHOR: Vec3 = [0, 1.22, 1.0];
const row = (pull: number, extra: Pose = {}): Pose => {
  const x = 0.12 + 0.05 * pull, y = 1.22 - 0.17 * pull, z = 0.56 - 0.42 * pull;
  return standing({
    handL: [x, y, z], handR: [-x, y, z], palmL: [-1, 0, 0], palmR: [1, 0, 0], fingersL: [0, -0.2, 1], fingersR: [0, -0.2, 1],
    elbowPoleL: [0.25, -0.4, -1], elbowPoleR: [-0.25, -0.4, -1], gripL: 0.9, gripR: 0.9,
    clavL: [-3 * pull, -12 * pull], clavR: [-3 * pull, -12 * pull], neck: [4, 0, 0], head: [-4, 0, 0], ...extra,
  });
};

/** Wall slide: head, upper back and pelvis on the wall (plane z = WALL_Z), backs of the forearms and hands on it; `up` 0 goalpost … 1 top. */
const WALL_Z = -0.137;
const wallSlide = (up: number, extra: Pose = {}): Pose => {
  const x = 0.46 - 0.12 * up, y = 1.7 + 0.22 * up;
  return standing({
    root: [0, 0.92, -0.04], rootRot: [-2, 0, 0], neck: [-4, 0, 0], footL: [0.13, 0, 0.15], footR: [-0.13, 0, 0.15],
    handL: [x, y, WALL_Z + 0.037], handR: [-x, y, WALL_Z + 0.037], palmL: [0, 0, 1], palmR: [0, 0, 1], fingersL: [0.15, 1, 0], fingersR: [-0.15, 1, 0],
    elbowPoleL: [0, -1, 0.4], elbowPoleR: [0, -1, 0.4], clavL: [-2, -4], clavR: [-2, -4], ...extra,
  });
};

/** Doorway pec stretch: forearms on the door frame (jambs at x ±0.5, front faces at DOOR_Z), elbows just below shoulder height, small split stance. */
const DOOR_Z = 0.07;
const doorway = (lean: number, extra: Pose = {}): Pose => standing({
  root: [0, 0.925, 0.015 + 0.09 * lean], rootRot: [3 * lean, 0, 0], neck: [-3 * lean, 0, 0],
  footL: [0.12, 0, 0.17], footR: [-0.12, 0, -0.1], footRotL: [0, 8, 0], footRotR: [0, -8, 0],
  handL: [0.475, 1.6, DOOR_Z - 0.016], handR: [-0.475, 1.6, DOOR_Z - 0.016], palmL: [0, 0, 1], palmR: [0, 0, 1], fingersL: [0, 1, 0], fingersR: [0, 1, 0],
  elbowPoleL: [0, -1, 0.4], elbowPoleR: [0, -1, 0.4], clavL: [-2, 0], clavR: [-2, 0], ...extra,
});
const DOOR_FRAME: Equipment[] = [
  { kind: 'box', pos: [0.53, 0, DOOR_Z + 0.06], size: [0.08, 2.1, 0.12] },
  { kind: 'box', pos: [-0.53, 0, DOOR_Z + 0.06], size: [0.08, 2.1, 0.12] },
  { kind: 'box', pos: [0, 2.1, DOOR_Z + 0.06], size: [1.14, 0.1, 0.12] },
];

/** Hands flat on a bench or box top of height h, just wider than the shoulders, fingers forward. */
const onEdge = (h: number, z: number, half = 0.22): Pose => ({
  handL: [half, h + 0.015, z], handR: [-half, h + 0.015, z], palmL: [0, -1, 0], palmR: [0, -1, 0], fingersL: [0, 0, 1], fingersR: [0, 0, 1],
  elbowPoleL: [0.75, 0.15, -1], elbowPoleR: [-0.75, 0.15, -1],
});
/** Incline push-up on a 0.6 m box: one straight line from head to heels, feet back on the balls, elbows angled back. */
const BOX_H = 0.6;
const incline = (root: Vec3, pitch: number, extra: Pose = {}): Pose => ({
  root, rootRot: [pitch, 0, 0], neck: [-4, 0, 0],
  footL: [0.11, 0, -0.9], footR: [-0.11, 0, -0.9], heelL: 40, heelR: 40, kneePoleL: [0, -1, 1], kneePoleR: [0, -1, 1],
  ...onEdge(BOX_H, 0.52), ...extra,
});

/**
 * Scapular push-up at the wall (the gentlest level, and the one that spares the lower back): hands flat on the
 * wall at chest height, feet a step back, one line from head to heels, arms straight. Only the shoulder blades
 * move: together and the chest sinks toward the wall, or wide with the upper back gently rounded.
 */
const SCAP_WALL_Z = 0.62;
const scapPush = (set: number, extra: Pose = {}): Pose => ({
  root: [0, 0.8 - 0.01 * set, -0.08 - 0.06 * set], rootRot: [20 - set, 0, 0], neck: [-2, 0, 0],
  footL: [0.12, 0, -0.42], footR: [-0.12, 0, -0.42], kneePoleL: [0, 0, 1], kneePoleR: [0, 0, 1],
  handL: [0.22, 1.3, SCAP_WALL_Z - 0.015], handR: [-0.22, 1.3, SCAP_WALL_Z - 0.015], palmL: [0, 0, 1], palmR: [0, 0, 1],
  fingersL: [0, 1, 0], fingersR: [0, 1, 0], elbowPoleL: [0.8, -1, -0.4], elbowPoleR: [-0.8, -1, -0.4],
  clavL: [0, 16 * set - 4], clavR: [0, 16 * set - 4], thoracic: [7 * set - 1, 0, 0], ...extra,
});


/**
 * Kneeling lat stretch: kneeling on a mat facing a chair, straight arms on the seat. `back` 0 upright with the
 * hips over the knees … 1 hips settled back toward the heels, armpits sinking. The arms stay straight, so the
 * shoulders travel on an arc around the hands.
 */
const latSeat = (back: number, extra: Pose = {}): Pose => ({
  root: [0, 0.44 - 0.06 * back, -0.2 - 0.1 * back], rootRot: [55 + 30 * back, 0, 0], neck: [-6, 0, 0],
  kneeAimL: [0.11, KNEEL_Y, -0.02], kneeAimR: [-0.11, KNEEL_Y, -0.02], kneeL: 115 + 15 * back, kneeR: 115 + 15 * back,
  ankleL: [-58, 0], ankleR: [-58, 0],
  handL: [0.19, SEAT + 0.015, 0.74], handR: [-0.19, SEAT + 0.015, 0.74], palmL: [0, -1, 0], palmR: [0, -1, 0], fingersL: [0, 0, 1], fingersR: [0, 0, 1],
  elbowPoleL: [0.4, 1, -0.6], elbowPoleR: [-0.4, 1, -0.6], ...extra,
});

/**
 * Standing lat stretch for the LEFT side: the left hand holds an upright at x 0.42, the hips sit back and
 * slightly away from it, spine long and knees soft. `back` 0 upright … 1 settled hinge.
 */
const UPRIGHT_X = 0.42;
const rackLat = (back: number, extra: Pose = {}): Pose => standing({
  root: [0, 0.928 - 0.068 * back, 0.03 - 0.41 * back], rootRot: [4 + 46 * back, -8 * back, 0], spine: [0, -6 * back, 0], neck: [-4 * back, 0, 0],
  footL: [0.14, 0, -0.08], footR: [-0.14, 0, -0.08], footRotL: [0, 8, 0], footRotR: [0, -8, 0], kneePoleL: [0.1, 0, 1], kneePoleR: [-0.1, 0, 1],
  handL: [UPRIGHT_X, 1.15, 0.4], palmL: [-1, 0, -0.2], fingersL: [0, 1, -0.2], elbowPoleL: [0, -1, 0.5], gripL: 0.95,
  shoulderR: [24 * back, 8, 0], elbowR: 30 * back, ...extra,
});
const UPRIGHT: Equipment = { kind: 'box', pos: [UPRIGHT_X + 0.06, 0, 0.46], size: [0.08, 2.1, 0.08] };

/** Hanging from a bar at 2.14 m with the feet lightly on a box: `down` 1 relaxed hang (shoulders at the ears) … 0 blades drawn down. */
const BAR_Y = 2.14, STEP_H = 0.3;
const scapHang = (down: number, extra: Pose = {}): Pose => ({
  root: [0, 1.122 - 0.042 * down, 0.02], rootRot: [2, 0, 0], neck: [2, 0, 0],
  handL: [0.21, BAR_Y, 0], handR: [-0.21, BAR_Y, 0], palmL: [0, 0, 1], palmR: [0, 0, 1], fingersL: [-0.25, 1, 0], fingersR: [0.25, 1, 0],
  elbowPoleL: [0.5, -1, -0.2], elbowPoleR: [-0.5, -1, -0.2], gripL: 1, gripR: 1,
  clavL: [9 * down - 3, 0], clavR: [9 * down - 3, 0], thoracic: [2 * down - 1, 0, 0],
  footL: [0.12, STEP_H, 0.12], footR: [-0.12, STEP_H, 0.12], heelL: 30, heelR: 30, kneePoleL: [0.1, 0, 1], kneePoleR: [-0.1, 0, 1], ...extra,
});

/** Legs swinging off the box with the lower back arched: `z` where the feet swing to, `lift` the jerk upward. */
const swing = (z: number, lift: number): Pose => scapHang(0.4, {
  root: [0, 1.105 + lift, -0.02], rootRot: [-2, 0, 0], lumbar: [-20, 0, 0], thoracic: [-3, 0, 0],
  footL: [0.12, 0.38 + Math.max(0, z) * 0.3, z], footR: [-0.12, 0.38 + Math.max(0, z) * 0.3, z],
  footRotL: [z > 0 ? -25 : 10, 0, 0], footRotR: [z > 0 ? -25 : 10, 0, 0], heelL: 0, heelR: 0,
});

/** Biceps wall stretch, LEFT arm: the left palm flat on a wall behind, thumb down, chest turning away. */
// The `wall` prop only faces ±Z, so for this side-on stretch the wall is a slab to the figure's left.
const BICEPS_WALL_X = 0.56;
const BICEPS_WALL: Equipment = { kind: 'box', pos: [BICEPS_WALL_X + 0.06, 0, -0.18], size: [0.12, 2.3, 0.9] };
const bicepsWall = (turn: number, extra: Pose = {}): Pose => standing({
  root: [0, 0.93, 0], rootRot: [0, -16 * turn, 0], spine: [0, 0, -14 * turn], neck: [0, 0, 8 * turn],
  footL: [0.14, 0, 0.04], footR: [-0.14, 0, -0.04], footRotL: [0, 20, 0], footRotR: [0, -6, 0],
  handL: [BICEPS_WALL_X - 0.015, 1.3, -0.1], palmL: [1, 0, 0], fingersL: [0, 0, -1], elbowPoleL: [1, -0.6, 0.3],
  clavL: [-3, -6], shoulderR: [6, 8, 0], elbowR: 10, ...extra,
});

export const MOBILITY_UPPER: Clip[] = [
  {
    id: 'cat-cow', view: 'side', duration: 6,
    keys: [
      { t: 0, pose: quadruped(), depth: 0 },
      { t: 0.25, pose: cat, depth: 1 },
      { t: 0.5, pose: quadruped(), depth: 0 },
      { t: 0.75, pose: cow, depth: 1 },
    ],
    equipment: [{ kind: 'mat', pos: [0, 0, 0.1] }],
    mistakes: [
      {
        id: 'cat-cow.deep-sag-head-back', label: 'Sagging and head thrown back', highlight: ['lowerBack', 'neck'],
        keys: [
          { t: 0, pose: quadruped() }, { t: 0.25, pose: cat }, { t: 0.5, pose: quadruped() },
          { t: 0.75, pose: { ...cow, rootRot: [121, 0, 0], spine: [-46, 0, 0], lumbar: [-10, 0, 0], neck: [-34, 0, 0] } },
        ],
      },
      {
        id: 'cat-cow.forcing-end-range', label: 'Forcing the end range', highlight: ['lowerBack'],
        keys: [
          { t: 0, pose: quadruped() },
          { t: 0.25, pose: { ...cat, ...kneel(0.005, 0.11, 18), root: [0, 0.44, -0.13], rootRot: [62, 0, 0], spine: [52, 0, 0], lumbar: [12, 0, 0], neck: [36, 0, 0] } },
          { t: 0.5, pose: quadruped() }, { t: 0.75, pose: cow },
        ],
      },
    ],
  },
  {
    id: 'chin-tuck', view: 'side', duration: 10,
    // Glide back and hold while breathing out (6 s), slide forward to rest while breathing in (4 s).
    keys: [
      { t: 0, pose: sit({ neck: [3, 0, 0], head: [-3, 0, 0], thoracic: [-1, 0, 0] }), depth: 0 },
      { t: 0.18, pose: sit(TUCK), depth: 1 },
      { t: 0.6, pose: sit({ ...TUCK, thoracic: [0.8, 0, 0] }), depth: 1 },
      { t: 0.78, pose: sit({ neck: [3, 0, 0], head: [-3, 0, 0], thoracic: [-0.4, 0, 0] }), depth: 0 },
    ],
    equipment: [CHAIR],
    mistakes: [
      { id: 'chin-tuck.chin-nods-down', label: 'Nodding the chin down', delta: { neck: [15, 0, 0], head: [10, 0, 0] }, highlight: ['neck'] },
      { id: 'chin-tuck.head-tips-back', label: 'Tipping the head back', delta: { neck: [13, 0, 0], head: [-28, 0, 0] }, highlight: ['neck'] },
    ],
  },
  {
    // Left upper trapezius: the left hand holds the seat edge and the head tips to the right.
    id: 'upper-trap-stretch', view: 'front', sided: true, duration: 15, loopFrom: 0.3,
    keys: [
      { t: 0, pose: trap(0, 0, -3), depth: 0 },
      { t: 0.3, pose: trap(-18, -9, -5), depth: 0.85 },
      { t: 0.7, pose: trap(-20, -10, -7, 0.8), depth: 1 },
      { t: 0.99, pose: trap(-18, -9, -5), depth: 0.85 },
    ],
    equipment: [CHAIR],
    mistakes: [
      { id: 'upper-trap-stretch.head-rotates', label: 'Head turns while tilting', delta: { neck: [0, 0, -14], head: [0, 0, -12] }, highlight: ['neck'] },
      {
        id: 'upper-trap-stretch.hand-pulls-head', label: 'Hand pulls the head down', highlight: ['neck', 'traps'],
        keys: [
          { t: 0, pose: trap(0, 0, -3) },
          { t: 0.18, pose: { ...trap(-14, -7, -4), ...pullHand([-0.2, 1.36, 0.08]) } },
          { t: 0.3, pose: { ...trap(-28, -14, -3), ...pullHand([-0.03, 1.265, -0.014]) } },
          ...bounces(0.3, 0.99, 0.05, trap(-31, -16, -3), pullHand([-0.044, 1.263, -0.014]), trap(-28, -14, -3), pullHand([-0.03, 1.265, -0.014])),
        ],
      },
    ],
  },
  {
    // Left levator scapulae: the left hand holds the back of the seat, the head turns right, then nods.
    id: 'levator-scapulae-stretch', view: 'threeQuarter', sided: true, duration: 15, loopFrom: 0.3,
    keys: [
      { t: 0, pose: lev([0, 0, 0], [0, 0, 0]), depth: 0 },
      { t: 0.1, pose: lev([0, -4, -28], [0, 0, -16]), depth: 0.3 },
      { t: 0.2, pose: lev([10, -14, -28], [24, -4, -16], HAND_UP), depth: 0.7 },
      { t: 0.3, pose: lev([10, -14, -28], [24, -4, -16], restHand([-0.071, 1.305, 0.036], [0.2, -0.96, -0.2]), -6), depth: 0.85 },
      { t: 0.7, pose: lev([12, -15, -28], [27, -4, -16], restHand([-0.08, 1.298, 0.051], [0.24, -0.93, -0.27]), -8), depth: 1 },
      { t: 0.99, pose: lev([10, -14, -28], [24, -4, -16], restHand([-0.071, 1.305, 0.036], [0.2, -0.96, -0.2]), -6), depth: 0.85 },
    ],
    equipment: [CHAIR],
    mistakes: [
      {
        id: 'levator-scapulae-stretch.wrong-head-turn', label: 'Head turned the wrong way', highlight: ['neck', 'traps'],
        keys: [
          { t: 0, pose: lev([0, 0, 0], [0, 0, 0]) },
          { t: 0.1, pose: lev([0, 4, 28], [0, 0, 16]) },
          { t: 0.2, pose: lev([10, 14, 28], [24, 4, 16], HAND_UP) },
          { t: 0.3, pose: lev([10, 14, 28], [24, 4, 16], restHand([0.071, 1.305, 0.036], [-0.2, -0.96, -0.2]), -6) },
          { t: 0.7, pose: lev([12, 15, 28], [27, 4, 16], restHand([0.08, 1.298, 0.051], [-0.24, -0.93, -0.27]), -8) },
          { t: 0.99, pose: lev([10, 14, 28], [24, 4, 16], restHand([0.071, 1.305, 0.036], [-0.2, -0.96, -0.2]), -6) },
        ],
      },
      {
        id: 'levator-scapulae-stretch.hand-cranks-head', label: 'Hand cranks the head down', highlight: ['neck', 'traps'],
        keys: [
          { t: 0, pose: lev([0, 0, 0], [0, 0, 0]) },
          { t: 0.1, pose: lev([0, -4, -28], [0, 0, -16]) },
          { t: 0.2, pose: lev([10, -14, -28], [24, -4, -16], HAND_UP) },
          { t: 0.3, pose: lev([13, -14, -28], [29, -4, -16], restHand([-0.078, 1.296, 0.06], [0.24, -0.92, -0.32]), -6) },
          ...bounces(0.3, 0.99, 0.05,
            lev([15, -14, -28], [32, -4, -16], restHand([-0.081, 1.288, 0.074], [0.26, -0.88, -0.39]), -6),
            {}, lev([13, -14, -28], [29, -4, -16], restHand([-0.078, 1.296, 0.06], [0.24, -0.92, -0.32]), -6), {}),
        ],
      },
    ],
  },
  {
    id: 'box-breathing', view: 'threeQuarter', duration: 10,
    // No-hold version: in through the nose for 4 s, out for 6 s, straight into the next breath.
    keys: [
      { t: 0, pose: calm(0), depth: 0 },
      { t: 0.4, pose: calm(1), depth: 1 },
    ],
    equipment: [CHAIR],
    mistakes: [
      {
        id: 'box-breathing.breath-held', label: 'Holding the breath', highlight: ['neck', 'traps', 'abs'],
        keys: [
          { t: 0, pose: calm(0) },
          { t: 0.3, pose: calm(1) },
          { t: 0.36, pose: { ...calm(1), clavL: [5, 0], clavR: [5, 0], lumbar: [3, 0, 0], neck: [4, 0, 0], head: [-4, 0, 0], gripL: 0.35, gripR: 0.35 } },
          { t: 0.8, pose: { ...calm(1), clavL: [5, 0], clavR: [5, 0], lumbar: [3, 0, 0], neck: [4, 0, 0], head: [-4, 0, 0], gripL: 0.35, gripR: 0.35 }, ease: 'linear' },
          { t: 0.9, pose: calm(0) },
        ],
      },
      {
        id: 'box-breathing.over-breathing', label: 'Big, fast chest breaths', highlight: ['neck', 'traps', 'chest'],
        keys: [0, 1, 2].flatMap(i => [
          { t: i / 3, pose: calm(0, 0) },
          { t: i / 3 + 0.14, pose: { ...calm(0, 0), clavL: [8, 0], clavR: [8, 0], thoracic: [-6, 0, 0], neck: [2, 0, 0], head: [-2, 0, 0] } },
        ]),
      },
    ],
  },
  {
    // Left shoulder: the left arm is drawn across the chest by the right hand, held just above the elbow.
    id: 'cross-body-shoulder-stretch', view: 'front', sided: true, duration: 15, loopFrom: 0.3,
    keys: [
      { t: 0, pose: standing({ handSpace: 'chest', ...R_DOWN }), depth: 0 },
      { t: 0.14, pose: across(78, 12, [0.2, 0.17, 0.27], [-0.9, 0.2, -0.4]), depth: 0.4 },
      { t: 0.3, pose: across(80, 40, [0.137, 0.213, 0.248], [-0.794, 0, -0.607]), depth: 0.85 },
      { t: 0.7, pose: across(80, 45, [0.121, 0.214, 0.24], [-0.739, 0.013, -0.673], { thoracic: [1, 0, 0] }), depth: 1 },
      { t: 0.99, pose: across(80, 40, [0.137, 0.213, 0.248], [-0.794, 0, -0.607]), depth: 0.85 },
    ],
    mistakes: [
      {
        id: 'cross-body-shoulder-stretch.pulling-forearm', label: 'Pulling the forearm, elbow straight', highlight: ['deltsRear', 'triceps'],
        keys: [
          { t: 0, pose: standing({ handSpace: 'chest', ...R_DOWN }) },
          { t: 0.14, pose: across(78, 12, [0.2, 0.17, 0.27], [-0.9, 0.2, -0.4], { elbowL: 0 }) },
          { t: 0.3, pose: across(80, 45, [-0.072, 0.177, 0.436], [-0.739, 0.013, -0.673], { elbowL: 0, gripR: 0.9 }) },
          { t: 0.7, pose: across(80, 45, [-0.072, 0.177, 0.436], [-0.739, 0.013, -0.673], { elbowL: 0, gripR: 0.9 }) },
          { t: 0.99, pose: across(80, 45, [-0.072, 0.177, 0.436], [-0.739, 0.013, -0.673], { elbowL: 0, gripR: 0.9 }) },
        ],
      },
      {
        id: 'cross-body-shoulder-stretch.shoulder-hikes', label: 'Shoulder hikes, arm too high', highlight: ['traps', 'deltsFront'],
        keys: [
          { t: 0, pose: standing({ handSpace: 'chest', ...R_DOWN }) },
          { t: 0.14, pose: across(90, 12, [0.2, 0.2, 0.27], [-0.9, 0.2, -0.4], { clavL: [4, 3] }) },
          { t: 0.3, pose: across(105, 45, [0.118, 0.291, 0.238], [-0.722, -0.013, -0.692], { clavL: [8, 3] }) },
          { t: 0.7, pose: across(105, 45, [0.118, 0.291, 0.238], [-0.722, -0.013, -0.692], { clavL: [8, 3] }) },
          { t: 0.99, pose: across(105, 45, [0.118, 0.291, 0.238], [-0.722, -0.013, -0.692], { clavL: [8, 3] }) },
        ],
      },
    ],
  },
  {
    // Left triceps: the left hand drops behind the neck and the right hand presses lightly above the left elbow.
    id: 'overhead-triceps-stretch', view: 'threeQuarter', sided: true, duration: 15, loopFrom: 0.3,
    keys: [
      { t: 0, pose: standing({ handSpace: 'chest', ...R_DOWN }), depth: 0 },
      { t: 0.12, pose: standing({ handSpace: 'chest', ...R_DOWN, shoulderL: [168, 4, -30], elbowL: 30 }), depth: 0.3 },
      { t: 0.3, pose: overhead(172, 150, [0.199, 0.493, 0.094], [0.709, -0.044, -0.704]), depth: 0.85 },
      { t: 0.7, pose: overhead(176, 155, [0.2, 0.496, 0.078], [0.689, -0.091, -0.719], { thoracic: [0.8, 0, 0] }), depth: 1 },
      { t: 0.99, pose: overhead(172, 150, [0.199, 0.493, 0.094], [0.709, -0.044, -0.704]), depth: 0.85 },
    ],
    mistakes: [
      { id: 'overhead-triceps-stretch.ribs-flare', label: 'Ribs flare, back arches', delta: { lumbar: [-12, 0, 0], thoracic: [-4, 0, 0], neck: [8, 0, 0] }, highlight: ['lowerBack', 'abs'] },
      {
        id: 'overhead-triceps-stretch.elbow-forced-back', label: 'Elbow forced behind the head', highlight: ['triceps', 'lats', 'neck'],
        keys: [
          { t: 0, pose: standing({ handSpace: 'chest', ...R_DOWN }) },
          { t: 0.12, pose: standing({ handSpace: 'chest', ...R_DOWN, shoulderL: [168, 4, -30], elbowL: 30 }) },
          { t: 0.3, pose: overhead(196, 155, [0.2, 0.5, 0.0], [0.6, -0.3, -0.74], { neck: [12, 0, 0], gripR: 0.7 }) },
          { t: 0.7, pose: overhead(196, 155, [0.2, 0.5, 0.0], [0.6, -0.3, -0.74], { neck: [12, 0, 0], gripR: 0.7 }) },
          { t: 0.99, pose: overhead(196, 155, [0.2, 0.5, 0.0], [0.6, -0.3, -0.74], { neck: [12, 0, 0], gripR: 0.7 }) },
        ],
      },
    ],
  },
  {
    // Left forearm: palm-up hold for the wrist flexors, then palm-down hold for the extensors.
    id: 'wrist-flexor-extensor-stretch', view: 'side', sided: true, duration: 20, loopFrom: 0.15,
    keys: [
      { t: 0, pose: standing(HANDS_DOWN), depth: 0 },
      { t: 0.08, pose: wrist(true, 10), depth: 0.3 },
      { t: 0.15, pose: wrist(true, 62), depth: 0.85 },
      { t: 0.3, pose: wrist(true, 70), depth: 1 },
      { t: 0.42, pose: wrist(true, 62), depth: 0.85 },
      { t: 0.5, pose: wrist(false, 15), depth: 0.3 },
      { t: 0.58, pose: wrist(false, 60), depth: 0.85 },
      { t: 0.73, pose: wrist(false, 68), depth: 1 },
      { t: 0.85, pose: wrist(false, 60), depth: 0.85 },
      { t: 0.93, pose: wrist(true, 15), depth: 0.3 },
      { t: 0.99, pose: wrist(true, 62), depth: 0.85 },
    ],
    mistakes: [
      {
        id: 'wrist-flexor-extensor-stretch.elbow-bent', label: 'Elbow bent', highlight: ['forearms'],
        keys: [
          { t: 0, pose: standing(HANDS_DOWN) }, { t: 0.08, pose: wrist(true, 10, true) }, { t: 0.15, pose: wrist(true, 62, true) },
          { t: 0.3, pose: wrist(true, 70, true) }, { t: 0.42, pose: wrist(true, 62, true) }, { t: 0.5, pose: wrist(false, 15, true) },
          { t: 0.58, pose: wrist(false, 60, true) }, { t: 0.73, pose: wrist(false, 68, true) }, { t: 0.85, pose: wrist(false, 60, true) },
          { t: 0.93, pose: wrist(true, 15, true) }, { t: 0.99, pose: wrist(true, 62, true) },
        ],
      },
      {
        id: 'wrist-flexor-extensor-stretch.wrist-yanked', label: 'Wrist yanked back', highlight: ['forearms'],
        keys: [
          { t: 0, pose: standing(HANDS_DOWN) }, { t: 0.08, pose: wrist(true, 10) }, { t: 0.15, pose: wrist(true, 84) },
          ...bounces(0.15, 0.45, 0.03, wrist(true, 92), {}, wrist(true, 82), {}),
          { t: 0.5, pose: wrist(false, 15) }, { t: 0.58, pose: wrist(false, 60) }, { t: 0.73, pose: wrist(false, 68) },
          { t: 0.85, pose: wrist(false, 60) }, { t: 0.93, pose: wrist(true, 15) }, { t: 0.99, pose: wrist(true, 84) },
        ],
      },
    ],
  },
  {
    // Bends to the left: the left hand slides down the left thigh (the right side of the trunk lengthens).
    id: 'standing-side-bend', view: 'front', sided: true, duration: 10,
    // Breathe out sliding down and pausing (6 s), breathe in rising back to tall (4 s).
    keys: [
      { t: 0, pose: sideBend(0, 0), depth: 0 },
      { t: 0.45, pose: sideBend(30, 0.16), depth: 1 },
      { t: 0.6, pose: sideBend(31, 0.17), depth: 1 },
    ],
    mistakes: [
      {
        id: 'standing-side-bend.trunk-drifts-forward', label: 'Leaning forward', highlight: ['lowerBack'],
        keys: [
          { t: 0, pose: sideBend(0, 0) },
          { t: 0.45, pose: sideBend(30, 0.18, { spine: [17, 30, 0], handL: [0.18, -0.31, 0.09], neck: [-8, -7, 0] }) },
          { t: 0.6, pose: sideBend(31, 0.19, { spine: [17, 31, 0], handL: [0.18, -0.32, 0.09], neck: [-8, -7, 0] }) },
        ],
      },
      {
        id: 'standing-side-bend.hips-slide-out', label: 'Hips slide out to the side', highlight: ['lowerBack', 'gluteMed'],
        keys: [
          { t: 0, pose: sideBend(0, 0) },
          { t: 0.45, pose: sideBend(30, 0.16, { root: [-0.08, 0.925, 0], rootRot: [0, 0, -4], spine: [0, 34, 0] }) },
          { t: 0.6, pose: sideBend(31, 0.17, { root: [-0.08, 0.925, 0], rootRot: [0, 0, -4], spine: [0, 35, 0] }) },
        ],
      },
    ],
  },
  {
    // Left arm threads under the body (rotation through the mid back); the right hand stays planted.
    id: 'thread-the-needle', view: 'threeQuarter', sided: true, duration: 10,
    // Breathe in reaching up and opening (4 s), out threading under and settling (6 s).
    keys: [
      { t: 0, pose: needle({}), depth: 0 },
      // The hand swings out as it lifts: straight from the mat to overhead would fold the elbow shut.
      { t: 0.17, pose: needle({ spine: [0, 0, 18], handL: [0.46, 0.8, 0.5], palmL: [-0.3, 0, 1], fingersL: [0.2, 1, 0], elbowPoleL: [1, -0.3, -0.5] }), depth: 0.15 },
      { t: 0.32, pose: NEEDLE_UP, depth: 0.3 },
      { t: 0.44, pose: needle({ spine: [6, 0, 10], handL: [0.3, 0.32, 0.46], palmL: [-1, 0, 0], fingersL: [0, -1, 0], elbowPoleL: [1, 0, -0.5] }), depth: 0.5 },
      { t: 0.54, pose: needle({ rootRot: [86, 0, 0], spine: [10, 0, -15], neck: [0, 0, -5], handL: [0.02, 0.06, 0.42], palmL: [0, 1, 0], fingersL: [-1, 0, 0], elbowPoleL: [0, 0, -1] }), depth: 0.7 },
      { t: 0.7, pose: threaded(-42, 0), depth: 0.9 },
      { t: 0.86, pose: threaded(-46, 0.04, { root: [0, 0.468, 0] }), depth: 1 },
    ],
    equipment: [{ kind: 'mat', pos: [0, 0, 0.1] }],
    mistakes: [
      {
        id: 'thread-the-needle.hips-shift', label: 'Hips shift and twist', highlight: ['lowerBack', 'obliques'],
        keys: [
          { t: 0, pose: needle({}) },
          { t: 0.17, pose: needle({ spine: [0, 0, 18], handL: [0.46, 0.8, 0.5], palmL: [-0.3, 0, 1], fingersL: [0.2, 1, 0], elbowPoleL: [1, -0.3, -0.5] }) },
          { t: 0.32, pose: NEEDLE_UP },
          { t: 0.44, pose: needle({ spine: [6, 0, 10], handL: [0.3, 0.32, 0.46], palmL: [-1, 0, 0], fingersL: [0, -1, 0], elbowPoleL: [1, 0, -0.5] }) },
          { t: 0.54, pose: needle({ rootRot: [86, 0, 0], spine: [10, 0, -15], neck: [0, 0, -5], handL: [0.02, 0.06, 0.42], palmL: [0, 1, 0], fingersL: [-1, 0, 0], elbowPoleL: [0, 0, -1] }) },
          { t: 0.7, pose: threaded(-42, 0, { root: [0.06, 0.47, 0], rootTwist: -12, spine: [18, 0, -22], thoracic: [0, 0, -2], lumbar: [0, 0, -14] }) },
          { t: 0.86, pose: threaded(-46, 0.04, { root: [0.065, 0.468, 0], rootTwist: -13, spine: [18, 0, -22], thoracic: [0, 0, -2], lumbar: [0, 0, -15] }) },
        ],
      },
      { id: 'thread-the-needle.low-back-sags', label: 'Lower back sags', delta: { rootRot: [17, 0, 0], lumbar: [-17, 0, 0], root: [0, -0.01, 0] }, highlight: ['lowerBack'] },
    ],
  },
  {
    // Lying on the RIGHT side so the LEFT (top) arm opens the book with the chest; the knees stay stacked.
    id: 'open-book', view: 'front', sided: true, duration: 10,
    // Breathe in opening (4 s), out letting the shoulder settle (3 s), then close slowly.
    keys: [
      { t: 0, pose: BOOK_SHUT, depth: 0 },
      { t: 0.2, pose: BOOK_UP, depth: 0.4 },
      { t: 0.4, pose: BOOK_OPEN, depth: 0.85 },
      { t: 0.7, pose: BOOK_SETTLED, depth: 1 },
    ],
    equipment: BOOK_PROPS,
    mistakes: [
      {
        id: 'open-book.knee-slides-back', label: 'Top knee slides back', highlight: ['lowerBack', 'obliques'],
        // The pelvis rolls back with the arm and the top knee slides off the bottom one, so the twist falls into the lower back.
        keys: [
          { t: 0, pose: BOOK_SHUT }, { t: 0.2, pose: BOOK_UP },
          { t: 0.4, pose: book(38, [90, 78, 0], { rootTwist: 24, hipL: [66, -3, 0], lumbar: [0, 0, -10] }) },
          { t: 0.7, pose: book(42, [90, 96, 0], { rootTwist: 27, hipL: [62, -3, 0], lumbar: [0, 0, -12] }) },
        ],
      },
      { id: 'open-book.arm-forced-down', label: 'Arm forced to the floor', delta: { shoulderL: [-6, 26, 0], clavL: [0, -8] }, highlight: ['deltsFront', 'chest'] },
    ],
  },
  {
    id: 'prone-y-t', view: 'threeQuarter', duration: 12,
    // Y: lift on the breath out, pause, lower on the breath in; slide to T and repeat.
    keys: [
      { t: 0, pose: yt(40, 0), depth: 0 },
      { t: 0.12, pose: yt(40, 1), depth: 1 },
      { t: 0.22, pose: yt(40, 1), depth: 1 },
      { t: 0.34, pose: yt(40, 0), depth: 0 },
      ...slide(0.34, 0.5, 40, 90),
      { t: 0.62, pose: yt(90, 1), depth: 1 },
      { t: 0.72, pose: yt(90, 1), depth: 1 },
      { t: 0.84, pose: yt(90, 0), depth: 0 },
      ...slide(0.84, 0.99, 90, 40, 3),
    ],
    equipment: [{ kind: 'mat', pos: [0, 0, 0.1] }, TOWEL],
    mistakes: [
      { id: 'prone-y-t.back-arches', label: 'Chest lifts, back arches', delta: { lumbar: [-17, 0, 0], neck: [-6, 0, 0] }, highlight: ['lowerBack'] },
      { id: 'prone-y-t.shrugging', label: 'Shrugging toward the ears', delta: { clavL: [13, 5], clavR: [13, 5], root: [0, 0.016, 0] }, highlight: ['traps', 'neck'] },
    ],
  },
  {
    id: 'crocodile-breathing', view: 'side', duration: 10,
    // In through the nose for 4 s (belly into the mat, waist and lower back rise), out for 6 s; no holds.
    keys: [
      { t: 0, pose: croc(0), depth: 0 },
      { t: 0.4, pose: croc(1), depth: 1 },
    ],
    equipment: [{ kind: 'mat', pos: [0, 0, 0.1] }],
    mistakes: [
      { id: 'crocodile-breathing.head-lifts', label: 'Head lifted to look forward', constant: true, delta: { neck: [-26, 0, 0] }, highlight: ['neck'] },
      { id: 'crocodile-breathing.back-arches', label: 'Back arches, buttocks clench', delta: { lumbar: [-13, 0, 0], root: [0, -0.004, 0] }, highlight: ['lowerBack', 'glutes'] },
    ],
  },
  {
    id: 'supine-twist', view: 'front', duration: 20,
    // Breathe out lowering the knees to one side and pausing (6 s), in bringing them back (4 s); then the other side.
    keys: [
      { t: 0, pose: kneeRoll(0, 0), depth: 0 },
      { t: 0.2, pose: kneeRoll(42, -40), depth: 1 },
      { t: 0.3, pose: kneeRoll(42, -40), depth: 1 },
      { t: 0.5, pose: kneeRoll(0, 0), depth: 0 },
      { t: 0.7, pose: kneeRoll(-42, 40), depth: 1 },
      { t: 0.8, pose: kneeRoll(-42, 40), depth: 1 },
    ],
    equipment: [{ kind: 'mat', pos: [0, 0, -0.1] }, PILLOW],
    mistakes: [
      {
        id: 'supine-twist.shoulder-lifts', label: 'Opposite shoulder lifts', highlight: ['lowerBack', 'obliques'],
        keys: [
          { t: 0, pose: kneeRoll(0, 0) }, { t: 0.2, pose: kneeRoll(42, -20) }, { t: 0.3, pose: kneeRoll(42, -20) },
          { t: 0.5, pose: kneeRoll(0, 0) }, { t: 0.7, pose: kneeRoll(-42, 20) }, { t: 0.8, pose: kneeRoll(-42, 20) },
        ],
      },
      {
        id: 'supine-twist.knees-flop', label: 'Knees flop to the floor', highlight: ['lowerBack', 'obliques'],
        keys: [
          { t: 0, pose: kneeRoll(0, 0) }, { t: 0.07, pose: kneeRoll(80, -60), ease: 'in' }, { t: 0.3, pose: kneeRoll(80, -60) },
          { t: 0.5, pose: kneeRoll(0, 0) }, { t: 0.57, pose: kneeRoll(-80, 60), ease: 'in' }, { t: 0.8, pose: kneeRoll(-80, 60) },
        ],
      },
    ],
  },
  {
    id: 'diaphragmatic-breathing-90-90', view: 'side', duration: 10,
    // In through the nose for 4 s (belly hand rises, chest hand still), out through pursed lips for 6 s; no holds.
    keys: [
      { t: 0, pose: ninety(0), depth: 0 },
      { t: 0.4, pose: ninety(1), depth: 1 },
    ],
    equipment: [{ kind: 'mat', pos: [0, 0, -0.25] }, NINETY_CHAIR],
    mistakes: [
      { id: 'diaphragmatic-breathing-90-90.ribs-flare', label: 'Ribs flare, back arches', delta: { rootRot: [7, 0, 0], lumbar: [-7, 0, 0], thoracic: [-3, 0, 0], neck: [6, 0, 0], hipL: [-7, 0, 0], hipR: [-7, 0, 0] }, highlight: ['lowerBack', 'abs'] },
      {
        id: 'diaphragmatic-breathing-90-90.forced-exhale', label: 'Forcing the breath out, then holding', highlight: ['abs', 'neck', 'traps'],
        keys: [
          { t: 0, pose: ninety(0) },
          { t: 0.4, pose: ninety(1) },
          { t: 0.68, pose: ninety(-0.6, { spine: [4, 0, 0], thoracic: [3, 0, 0], clavL: [3, 0], clavR: [3, 0], gripL: 0.3, gripR: 0.3 }) },
          { t: 0.92, pose: ninety(-0.6, { spine: [4, 0, 0], thoracic: [3, 0, 0], clavL: [3, 0], clavR: [3, 0], gripL: 0.3, gripR: 0.3 }), ease: 'linear' },
        ],
      },
    ],
  },
  {
    id: 'foam-roller-thoracic-extension', view: 'side', duration: 6,
    // Breathe out draping the upper back over the roller (3 s), breathe in curling halfway up (3 s).
    keys: [
      { t: 0, pose: ROLLER_UP, depth: 0 },
      { t: 0.5, pose: ROLLER_DRAPE, depth: 1 },
    ],
    equipment: [{ kind: 'mat', pos: [0, 0, -0.2] }, { kind: 'foamRoller', pos: [0, 0, ROLLER_Z] }],
    mistakes: [
      {
        id: 'foam-roller-thoracic-extension.roller-under-low-back', label: 'Roller under the lower back', highlight: ['lowerBack'],
        keys: [
          { t: 0, pose: onRoller({ root: [0, 0.185, -0.16], rootRot: [-78, 0, 0], lumbar: [-8, 0, 0], thoracic: [6, 0, 0] }) },
          { t: 0.5, pose: onRoller({ root: [0, 0.19, -0.16], rootRot: [-72, 0, 0], lumbar: [-24, 0, 0], thoracic: [0, 0, 0] }) },
        ],
      },
      { id: 'foam-roller-thoracic-extension.head-hangs-back', label: 'Head hangs back', delta: { neck: [-36, 0, 0], shoulderL: [-55, 45, 60], shoulderR: [-55, 45, 60], elbowL: -95, elbowR: -95 }, highlight: ['neck'] },
    ],
  },
  {
    id: 'band-pull-apart', view: 'threeQuarter', duration: 4,
    // Breathe out sweeping the band apart (2 s), in returning slowly with a little tension (2 s).
    keys: [
      { t: 0, pose: pullApart(0), depth: 0 },
      { t: 0.45, pose: pullApart(1), depth: 1 },
      { t: 0.55, pose: pullApart(1), depth: 1 },
    ],
    equipment: [{ kind: 'band', between: 'hands' }],
    mistakes: [
      { id: 'band-pull-apart.ribs-flare', label: 'Ribs flare, back arches', delta: { lumbar: [-12, 0, 0], thoracic: [-3, 0, 0], handL: [-0.02, 0.02, 0.03], handR: [0.02, 0.02, 0.03] }, highlight: ['lowerBack', 'abs'] },
      { id: 'band-pull-apart.shoulders-shrug', label: 'Shoulders shrugging', delta: { clavL: [9, 4], clavR: [9, 4] }, highlight: ['traps', 'neck'] },
    ],
  },
  {
    id: 'band-row', view: 'side', duration: 4,
    // Breathe out pulling to the lower ribs and squeezing (1.5 s), pause, breathe in as the arms straighten (2 s).
    keys: [
      { t: 0, pose: row(0), depth: 0 },
      { t: 0.38, pose: row(1), depth: 1 },
      { t: 0.5, pose: row(1), depth: 1 },
    ],
    equipment: [
      { kind: 'box', pos: [0, 0, ROW_ANCHOR[2] + 0.04], size: [0.08, 2.0, 0.08] },
      { kind: 'band', anchor: ROW_ANCHOR, hands: 'L' }, { kind: 'band', anchor: ROW_ANCHOR, hands: 'R' },
    ],
    ignoreForCamera: ['box'],
    mistakes: [
      { id: 'band-row.leaning-back', label: 'Leaning back to pull', delta: { rootRot: [-7, 0, 0], spine: [-5, 0, 0], lumbar: [-6, 0, 0], handL: [0, 0.04, -0.1], handR: [0, 0.04, -0.1] }, highlight: ['lowerBack'] },
      { id: 'band-row.shrugging', label: 'Shrugging, chin poking', delta: { clavL: [11, 12], clavR: [11, 12], neck: [10, 0, 0], head: [-14, 0, 0] }, highlight: ['traps', 'neck'] },
    ],
  },
  {
    id: 'scapular-wall-slide', view: 'threeQuarter', duration: 6,
    // Breathe out sliding up (3 s), in sliding down and drawing the elbows toward the sides (3 s).
    keys: [
      { t: 0, pose: wallSlide(0), depth: 0 },
      { t: 0.5, pose: wallSlide(1), depth: 1 },
    ],
    equipment: [{ kind: 'wall', z: WALL_Z - 0.02 }], ignoreForCamera: ['wall'],
    mistakes: [
      { id: 'scapular-wall-slide.low-back-arches', label: 'Lower back arches off the wall', delta: { rootRot: [7, 0, 0], lumbar: [-16, 0, 0], thoracic: [-2, 0, 0] }, highlight: ['lowerBack'] },
      { id: 'scapular-wall-slide.shoulders-shrug', label: 'Shoulders shrug at the top', delta: { clavL: [10, 4], clavR: [10, 4] }, highlight: ['traps', 'neck'] },
    ],
  },
  {
    id: 'doorway-pec-stretch', view: 'threeQuarter', duration: 14, loopFrom: 0.28,
    // Lean in gently, then hold and breathe: 4 s in, 6 s out, the chest opening a little more on each breath out.
    keys: [
      { t: 0, pose: doorway(0), depth: 0 },
      { t: 0.28, pose: doorway(0.85), depth: 0.85 },
      { t: 0.7, pose: doorway(1, { thoracic: [1, 0, 0] }), depth: 1 },
      { t: 0.99, pose: doorway(0.85), depth: 0.85 },
    ],
    equipment: DOOR_FRAME, ignoreForCamera: ['box'],
    mistakes: [
      {
        id: 'doorway-pec-stretch.low-back-arches', label: 'Hips drift through, back arches', highlight: ['lowerBack'],
        keys: [
          { t: 0, pose: doorway(0) },
          { t: 0.28, pose: doorway(0.85, { root: [0, 0.925, 0.19], lumbar: [-17, 0, 0], thoracic: [-4, 0, 0], rootRot: [-2, 0, 0] }) },
          { t: 0.7, pose: doorway(1, { root: [0, 0.925, 0.21], lumbar: [-18, 0, 0], thoracic: [-4, 0, 0], rootRot: [-2, 0, 0] }) },
          { t: 0.99, pose: doorway(0.85, { root: [0, 0.925, 0.19], lumbar: [-17, 0, 0], thoracic: [-4, 0, 0], rootRot: [-2, 0, 0] }) },
        ],
      },
      {
        id: 'doorway-pec-stretch.elbows-too-high', label: 'Elbows too high, deep lean', highlight: ['deltsFront', 'chest'],
        keys: [
          { t: 0, pose: doorway(0, { handL: [0.47, 1.8, DOOR_Z - 0.016], handR: [-0.47, 1.8, DOOR_Z - 0.016] }) },
          { t: 0.28, pose: doorway(1.6, { handL: [0.47, 1.8, DOOR_Z - 0.016], handR: [-0.47, 1.8, DOOR_Z - 0.016] }) },
          { t: 0.7, pose: doorway(1.75, { handL: [0.47, 1.8, DOOR_Z - 0.016], handR: [-0.47, 1.8, DOOR_Z - 0.016] }) },
          { t: 0.99, pose: doorway(1.6, { handL: [0.47, 1.8, DOOR_Z - 0.016], handR: [-0.47, 1.8, DOOR_Z - 0.016] }) },
        ],
      },
    ],
  },
  {
    id: 'incline-push-up', view: 'side',
    // Breathe in lowering the chest toward the edge (2 s), out pushing the box away (2 s).
    ...rep(incline([0, 0.7, -0.25], 44), incline([0, 0.62, -0.159], 52), { lower: 2, lift: 2 }),
    equipment: [{ kind: 'box', pos: [0, 0, 0.68], size: [0.9, BOX_H, 0.4] }],
    mistakes: [
      { id: 'incline-push-up.hips-sag', label: 'Hips sagging', constant: true, delta: { root: [0, -0.09, 0.07], lumbar: [-17, 0, 0] }, highlight: ['lowerBack', 'abs'] },
      { id: 'incline-push-up.elbows-flare', label: 'Elbows flaring out wide', delta: { elbowPoleL: [0.6, 1.1, 1], elbowPoleR: [-0.6, 1.1, 1] }, highlight: ['deltsFront', 'chest'] },
    ],
  },
  {
    id: 'scapular-push-up', view: 'side',
    // Breathe in as the chest sinks and the blades draw together (2 s), out pushing the wall away to spread them (2 s).
    ...rep(scapPush(1), scapPush(0), { lower: 2, lift: 2 }),
    equipment: [{ kind: 'wall', z: SCAP_WALL_Z + 0.02 }], ignoreForCamera: ['wall'],
    mistakes: [
      { id: 'scapular-push-up.elbows-bend', label: 'Bending the elbows', delta: { root: [0, -0.005, 0.05] }, highlight: ['triceps', 'chest'] },
      { id: 'scapular-push-up.hips-sag', label: 'Hips sagging toward the wall', constant: true, delta: { root: [0, -0.03, 0.05], rootRot: [6, 0, 0], lumbar: [-17, 0, 0] }, highlight: ['lowerBack', 'abs'] },
    ],
  },
  {
    id: 'kneeling-lat-stretch', view: 'side', duration: 14, loopFrom: 0.28,
    // Sit the hips back on the breath out, then hold and breathe: the armpits sink a little lower each time.
    keys: [
      { t: 0, pose: latSeat(0), depth: 0 },
      { t: 0.28, pose: latSeat(0.9), depth: 0.85 },
      { t: 0.7, pose: latSeat(1, { thoracic: [1, 0, 0] }), depth: 1 },
      { t: 0.99, pose: latSeat(0.9), depth: 0.85 },
    ],
    equipment: [{ kind: 'mat', pos: [0, 0, -0.2] }, { kind: 'chair', pos: [0, 0, 0.92], yaw: 180, height: SEAT }],
    mistakes: [
      {
        id: 'kneeling-lat-stretch.pelvis-tucks', label: 'Pelvis tucks, lower back rounds',
        // Sitting back too far: the pelvis tips under and the lumbar spine rounds (the body shifts forward to keep the hands on the seat).
        delta: { lumbar: [26, 0, 0], neck: [10, 0, 0], rootRot: [-8, 0, 0], root: [0, 0, 0.05] }, highlight: ['lowerBack'],
      },
      { id: 'kneeling-lat-stretch.chest-sags', label: 'Chest sags into an arch', delta: { lumbar: [-17, 0, 0], thoracic: [-8, 0, 0], neck: [-14, 0, 0], root: [0, 0, 0.05] }, highlight: ['lowerBack'] },
    ],
  },
  {
    // Left lat: the left hand holds the upright, the hips sit back and away from it.
    id: 'standing-rack-lat-stretch', view: 'front', sided: true, duration: 14, loopFrom: 0.28,
    keys: [
      { t: 0, pose: rackLat(0), depth: 0 },
      { t: 0.28, pose: rackLat(0.9), depth: 0.85 },
      { t: 0.7, pose: rackLat(1, { thoracic: [1, 0, 0] }), depth: 1 },
      { t: 0.99, pose: rackLat(0.9), depth: 0.85 },
    ],
    equipment: [UPRIGHT], ignoreForCamera: ['box'],
    mistakes: [
      {
        id: 'standing-rack-lat-stretch.back-rounds', label: 'Lower back rounds', highlight: ['lowerBack'],
        keys: [
          { t: 0, pose: rackLat(0) },
          { t: 0.28, pose: rackLat(0.9, { lumbar: [25, 0, 0], neck: [10, 0, 0], root: [0, 0.86, -0.36] }) },
          { t: 0.7, pose: rackLat(1, { lumbar: [27, 0, 0], neck: [12, 0, 0], root: [0, 0.85, -0.4] }) },
          { t: 0.99, pose: rackLat(0.9, { lumbar: [25, 0, 0], neck: [10, 0, 0], root: [0, 0.86, -0.36] }) },
        ],
      },
      {
        id: 'standing-rack-lat-stretch.knees-locked', label: 'Knees locked straight', highlight: ['hamstrings', 'lowerBack'],
        keys: [
          { t: 0, pose: rackLat(0) },
          { t: 0.28, pose: rackLat(0.9, { root: [0, 0.9, -0.34], rootRot: [74, -8, 0], footL: [0.14, 0, 0.06], footR: [-0.14, 0, 0.06] }) },
          { t: 0.7, pose: rackLat(1, { root: [0, 0.9, -0.36], rootRot: [76, -8, 0], footL: [0.14, 0, 0.06], footR: [-0.14, 0, 0.06] }) },
          { t: 0.99, pose: rackLat(0.9, { root: [0, 0.9, -0.34], rootRot: [74, -8, 0], footL: [0.14, 0, 0.06], footR: [-0.14, 0, 0.06] }) },
        ],
      },
    ],
  },
  {
    id: 'scapular-pull-up', view: 'front', duration: 4,
    // Breathe out drawing the blades down (the body rises a little), pause, breathe in back to the gentle hang.
    keys: [
      { t: 0, pose: scapHang(1), depth: 0 },
      { t: 0.38, pose: scapHang(0), depth: 1 },
      { t: 0.5, pose: scapHang(0), depth: 1 },
    ],
    equipment: [{ kind: 'pullupBar', height: BAR_Y, z: 0 }, { kind: 'step', pos: [0, 0, 0.3], height: STEP_H }], ignoreForCamera: ['pullupBar'],
    mistakes: [
      { id: 'scapular-pull-up.elbows-bend', label: 'Bending the elbows', delta: { root: [0, 0.042, 0.01], clavL: [7, 0], clavR: [7, 0] }, highlight: ['biceps', 'traps'] },
      {
        id: 'scapular-pull-up.back-arches', label: 'Swinging and arching the back', highlight: ['lowerBack', 'hipFlexors'],
        // The feet leave the box and swing, the lower back arches and the body jerks upward.
        keys: [
          { t: 0, pose: swing(0.3, 0.03) },
          { t: 0.25, pose: swing(-0.22, 0.01) },
          { t: 0.5, pose: swing(0.3, 0.03) },
          { t: 0.75, pose: swing(-0.22, 0.01) },
        ],
      },
    ],
  },
  {
    // Left biceps: the left palm stays on the wall behind while the chest turns away from it.
    id: 'biceps-wall-stretch', view: 'threeQuarter', sided: true, duration: 12, loopFrom: 0.3,
    keys: [
      { t: 0, pose: bicepsWall(0), depth: 0 },
      { t: 0.3, pose: bicepsWall(0.85), depth: 0.85 },
      { t: 0.7, pose: bicepsWall(1, { thoracic: [0, 0, -1] }), depth: 1 },
      { t: 0.99, pose: bicepsWall(0.85), depth: 0.85 },
    ],
    equipment: [BICEPS_WALL], ignoreForCamera: ['box'],
    mistakes: [
      { id: 'biceps-wall-stretch.shoulder-rolls-forward', label: 'Shoulder rolls forward', delta: { clavL: [6, 14] }, highlight: ['deltsFront', 'traps'] },
      {
        id: 'biceps-wall-stretch.hand-too-high', label: 'Hand too high, turning too far', highlight: ['biceps', 'deltsFront'],
        keys: [
          { t: 0, pose: bicepsWall(0, { handL: [BICEPS_WALL_X - 0.015, 1.6, -0.1] }) },
          { t: 0.3, pose: bicepsWall(1.6, { handL: [BICEPS_WALL_X - 0.015, 1.6, -0.1], clavL: [2, -4] }) },
          { t: 0.7, pose: bicepsWall(1.75, { handL: [BICEPS_WALL_X - 0.015, 1.6, -0.1], clavL: [2, -4] }) },
          { t: 0.99, pose: bicepsWall(1.6, { handL: [BICEPS_WALL_X - 0.015, 1.6, -0.1], clavL: [2, -4] }) },
        ],
      },
    ],
  },
];
