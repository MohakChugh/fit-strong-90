/**
 * Building blocks for clip authors. Positions are metres for the 1.73 m
 * figure (Y up, facing +Z, left = +X, floor y = 0); see docs/motion/authoring.md.
 */

import type { Keyframe, Pose, Vec3 } from '../types';

/** Pelvis height standing with soft knees (straight legs ≈ 0.945). */
export const STAND_Y = 0.93;
/** Pelvis joint height lying on the back or front on a mat. */
export const LIE_Y = 0.1;

/** Feet flat, `half` metres either side of the midline, toes turned out. */
export const stance = (half = 0.13, toeOut = 10, z = 0.02): Pose => ({
  footL: [half, 0, z], footR: [-half, 0, z], footRotL: [0, toeOut, 0], footRotR: [0, -toeOut, 0],
});

export const ARMS_DOWN: Pose = { shoulderL: [4, 6, 0], shoulderR: [4, 6, 0], elbowL: 8, elbowR: 8 };

export const standing = (extra: Pose = {}): Pose => ({ root: [0, STAND_Y, 0], ...stance(), ...ARMS_DOWN, ...extra });

/** Palms flat on a surface at height y, fingers pointing +Z (the palm centre sits 1.5 cm above the surface). */
export const palmsFlat = (half: number, z: number, y = 0): Pose => ({
  handL: [half, y + 0.015, z], handR: [-half, y + 0.015, z], palmL: [0, -1, 0], palmR: [0, -1, 0], fingersL: [0, 0, 1], fingersR: [0, 0, 1],
});

/** Knee joint centre height when kneeling on a mat. */
export const KNEEL_Y = 0.065;

/**
 * Kneeling contact for both knees at z = kneeZ. `shinTilt`: knee flexion
 * that keeps the shin flat when the thigh leans back by `lean` degrees.
 */
export const kneel = (kneeZ = 0, half = 0.11, lean = 0): Pose => ({
  kneeAimL: [half, KNEEL_Y, kneeZ], kneeAimR: [-half, KNEEL_Y, kneeZ], kneeL: 90 + lean, kneeR: 90 + lean,
  ankleL: [-62, 0], ankleR: [-62, 0],
});

/** On hands and knees: hands under shoulders, knees under hips, back flat, gaze down. */
export const quadruped = (extra: Pose = {}): Pose => ({
  root: [0, 0.475, 0], rootRot: [82, 0, 0], ...kneel(0.005), ...palmsFlat(0.19, 0.46), neck: [-10, 0, 0], ...extra,
});

/** Lying on the back, head towards −Z; legs straight unless overridden. */
export const supine = (extra: Pose = {}): Pose => ({
  root: [0, LIE_Y, 0], rootRot: [-90, 0, 0], neck: [6, 0, 0], ankleL: [-25, 0], ankleR: [-25, 0],
  shoulderL: [0, 14, 0], shoulderR: [0, 14, 0], ...extra,
});

/** Supine with knees bent and feet flat, hip-width. */
export const hookLying = (extra: Pose = {}): Pose => supine({
  footL: [0.12, 0, 0.72], footR: [-0.12, 0, 0.72], kneePoleL: [0, 1, 0], kneePoleR: [0, 1, 0], ...extra,
});

/** Lying face down, head towards +Z. */
export const prone = (extra: Pose = {}): Pose => ({
  root: [0, LIE_Y + 0.01, 0], rootRot: [90, 0, 0], neck: [-8, 0, 0], ankleL: [-40, 0], ankleR: [-40, 0],
  shoulderL: [0, 14, 0], shoulderR: [0, 14, 0], ...extra,
});

/** Sitting on a seat of height h (top of the seat), feet flat in front. */
export const seated = (h = 0.46, extra: Pose = {}): Pose => ({
  root: [0, h + 0.06, -0.05], ...stance(0.15, 8, 0.42), ...ARMS_DOWN, ...extra,
});

/** Keys for one rep: start → hardest point at t = lowerEnd → pause → back to start. */
export function rep(start: Pose, bottom: Pose, timing: { lower: number; pauseBottom?: number; lift: number; pauseTop?: number }): { duration: number; keys: Keyframe[] } {
  const total = timing.lower + (timing.pauseBottom ?? 0) + timing.lift + (timing.pauseTop ?? 0);
  const a = timing.lower / total;
  const b = a + (timing.pauseBottom ?? 0) / total;
  const c = b + timing.lift / total;
  const keys: Keyframe[] = [{ t: 0, pose: start, depth: 0 }, { t: a, pose: bottom, depth: 1 }];
  if (b > a) keys.push({ t: b, pose: bottom, depth: 1, ease: 'linear' });
  if (c < 1 - 1e-6) keys.push({ t: c, pose: start, depth: 0 });
  return { duration: total, keys };
}

export const v = (x: number, y: number, z: number): Vec3 => [x, y, z];
