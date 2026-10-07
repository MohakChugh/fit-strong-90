/** Sampling, mirroring and fault blending for keyframed motion clips. */

import type { Clip, Ease, Equipment, Keyframe, Mistake, Pose, PoseKey } from './types';

/** Values that hold their last value instead of easing back to 0 when a key omits them. */
const HELD: ReadonlySet<PoseKey> = new Set<PoseKey>([
  'root', 'handSpace', 'footL', 'footR', 'footRotL', 'footRotR', 'kneePoleL', 'kneePoleR', 'kneeAimL', 'kneeAimR',
  'handL', 'handR', 'palmL', 'palmR', 'fingersL', 'fingersR', 'elbowPoleL', 'elbowPoleR',
]);

const ease = (e: Ease | undefined, t: number) => {
  switch (e) {
    case 'linear': return t;
    case 'in': return t * t;
    case 'out': return 1 - (1 - t) * (1 - t);
    case 'hold': return t < 1 ? 0 : 1;
    default: return t * t * (3 - 2 * t);
  }
};

type Val = number | readonly number[] | string;
const lerp = (a: Val | undefined, b: Val | undefined, t: number): Val | undefined => {
  if (a === undefined) return b;
  if (b === undefined) return a;
  if (typeof a === 'string' || typeof b === 'string') return t < 0.5 ? a : b;
  if (typeof a === 'number') return a + ((b as number) - a) * t;
  return a.map((x, i) => x + ((b as number[])[i] - x) * t);
};
const zero = (v: Val): Val => (typeof v === 'number' ? 0 : typeof v === 'string' ? v : v.map(() => 0));

export function blendPoses(a: Pose, b: Pose, t: number): Pose {
  const out: Record<string, Val | undefined> = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<PoseKey>;
  for (const k of keys) {
    const va = a[k] as Val | undefined;
    const vb = b[k] as Val | undefined;
    if (HELD.has(k)) out[k] = lerp(va, vb, t);
    else out[k] = lerp(va ?? (vb !== undefined ? zero(vb) : undefined), vb ?? (va !== undefined ? zero(va) : undefined), t);
  }
  return out as Pose;
}

/**
 * The direction the solver falls back on when a pose leaves one of these out
 * (see docs/motion/authoring.md). A delta on a direction the base pose omits
 * must grow from here, not from zero: the solver normalises directions, so any
 * weight above 0 over a zero base snaps straight to the delta's full strength.
 */
const DEFAULT_DIR: Partial<Record<PoseKey, readonly number[]>> = {
  // Knees over the toes; elbows back and a little out; palms to the midline, fingers hanging.
  kneePoleL: [0, 0, 1], kneePoleR: [0, 0, 1],
  elbowPoleL: [0.35, -0.2, -1], elbowPoleR: [-0.35, -0.2, -1],
  palmL: [-1, 0, 0], palmR: [1, 0, 0],
  fingersL: [0, -1, 0], fingersR: [0, -1, 0],
};

export function addPose(base: Pose, delta: Pose, w: number): Pose {
  if (!w) return base;
  const out: Record<string, Val | undefined> = { ...base };
  for (const k of Object.keys(delta) as PoseKey[]) {
    const d = delta[k] as Val;
    const v = (base[k] as Val | undefined) ?? DEFAULT_DIR[k] ?? zero(d);
    if (typeof v === 'string' || typeof d === 'string') continue;
    out[k] = typeof v === 'number' ? v + (d as number) * w : v.map((x, i) => x + (d as number[])[i] * w);
  }
  return out as Pose;
}

/**
 * Pose at `phase` (0–1) through the cycle. After the last key the cycle wraps
 * back to `loopFrom` when the clip has one — a held stretch loops from the
 * settled hold, so it must never blend back through the un-stretched key 0.
 */
export function sampleKeys(keys: Keyframe[], phase: number, loopFrom?: number): { pose: Pose; depth: number } {
  if (!keys.length) return { pose: {}, depth: 0 };
  const p = ((phase % 1) + 1) % 1;
  if (keys.length === 1) return { pose: keys[0].pose, depth: keys[0].depth ?? 0 };
  let i = keys.findIndex(k => k.t > p);
  if (i === -1) {
    if (loopFrom === undefined) i = keys.length; // wrap from the last key back to the first
    else {
      const a = keys[keys.length - 1];
      const b = sampleKeys(keys, loopFrom);
      const t = ease(keys.find(k => k.t >= loopFrom)?.ease, Math.min(1, Math.max(0, (p - a.t) / ((1 - a.t) || 1))));
      return { pose: blendPoses(a.pose, b.pose, t), depth: (a.depth ?? 0) + (b.depth - (a.depth ?? 0)) * t };
    }
  }
  const a = keys[(i - 1 + keys.length) % keys.length];
  const b = keys[i % keys.length];
  const span = ((b.t - a.t + 1) % 1) || 1;
  const local = (((p - a.t) + 1) % 1) / span;
  const t = ease(b.ease, Math.min(1, Math.max(0, local)));
  return { pose: blendPoses(a.pose, b.pose, t), depth: (a.depth ?? 0) + ((b.depth ?? 0) - (a.depth ?? 0)) * t };
}

/** How far into the hard part of the movement the cycle is at `phase` (0–1). */
export function sampleDepth(clip: Clip, phase: number): number {
  return sampleKeys(clip.keys, phase, clip.loopFrom).depth;
}

export function samplePose(clip: Clip, phase: number, mistake?: Mistake | null, weight = 1): Pose {
  if (mistake?.keys && weight > 0) {
    const good = sampleKeys(clip.keys, phase, clip.loopFrom).pose;
    const bad = sampleKeys(mistake.keys, phase, clip.loopFrom).pose;
    return blendPoses(good, bad, weight);
  }
  const { pose, depth } = sampleKeys(clip.keys, phase, clip.loopFrom);
  if (!mistake?.delta || weight <= 0) return pose;
  return addPose(pose, mistake.delta, weight * (mistake.constant ? 1 : depth));
}

const SWAP: [PoseKey, PoseKey][] = [
  ['clavL', 'clavR'], ['shoulderL', 'shoulderR'], ['elbowL', 'elbowR'], ['forearmL', 'forearmR'], ['wristL', 'wristR'],
  ['hipL', 'hipR'], ['kneeL', 'kneeR'], ['ankleL', 'ankleR'], ['toesL', 'toesR'], ['gripL', 'gripR'],
  ['footL', 'footR'], ['footRotL', 'footRotR'], ['heelL', 'heelR'], ['kneePoleL', 'kneePoleR'], ['kneeAimL', 'kneeAimR'],
  ['handL', 'handR'], ['palmL', 'palmR'], ['fingersL', 'fingersR'], ['elbowPoleL', 'elbowPoleR'],
];
const WORLD_VECTORS: ReadonlySet<PoseKey> = new Set<PoseKey>([
  'root', 'footL', 'footR', 'kneePoleL', 'kneePoleR', 'kneeAimL', 'kneeAimR', 'handL', 'handR', 'palmL', 'palmR', 'fingersL', 'fingersR', 'elbowPoleL', 'elbowPoleR',
]);

/** The same movement on the other side of the body (mirror through x = 0). */
export function mirrorPose(pose: Pose): Pose {
  const src = pose as Record<string, Val | undefined>;
  const out: Record<string, Val | undefined> = { ...src };
  for (const [l, r] of SWAP) { out[l] = src[r]; out[r] = src[l]; }
  for (const k of Object.keys(out) as PoseKey[]) {
    const v = out[k];
    if (v === undefined) { delete out[k]; continue; }
    if (WORLD_VECTORS.has(k)) out[k] = [-(v as number[])[0], (v as number[])[1], (v as number[])[2]];
    // Hand targets in chest/pelvis space mirror the same way: those frames are symmetric.
    else if (k === 'rootRot' || k === 'footRotL' || k === 'footRotR') out[k] = [(v as number[])[0], -(v as number[])[1], -(v as number[])[2]];
    else if (k === 'rootTwist') out[k] = -(v as number);
    else if (k === 'spine' || k === 'lumbar' || k === 'thoracic' || k === 'neck' || k === 'head') out[k] = [(v as number[])[0], -(v as number[])[1], -(v as number[])[2]];
  }
  return out as Pose;
}

export function mirrorClip(clip: Clip): Clip {
  const keys = (ks: Keyframe[]) => ks.map(k => ({ ...k, pose: mirrorPose(k.pose) }));
  const mirrorEquipment = (list: Equipment[]): Equipment[] => list.map(e => {
      const flip = <T extends readonly number[]>(p: T): T => [-p[0], ...p.slice(1)] as unknown as T;
      if ('pos' in e && e.pos) return { ...e, pos: flip(e.pos), ...('yaw' in e && e.yaw ? { yaw: -e.yaw } : {}) };
      if (e.kind === 'landmine') return { ...e, anchor: flip(e.anchor), hands: e.hands === 'L' ? 'R' : e.hands === 'R' ? 'L' : e.hands };
      if (e.kind === 'cable') return { ...e, anchor: flip(e.anchor), hands: e.hands === 'L' ? 'R' : e.hands === 'R' ? 'L' : e.hands };
      if (e.kind === 'dumbbells') return { ...e, hands: e.hands === 'L' ? 'R' : e.hands === 'R' ? 'L' : e.hands };
      if (e.kind === 'strap') return { ...e, foot: e.foot === 'L' ? 'R' : 'L' };
      if (e.kind === 'handle') return { ...e, hands: e.hands === 'L' ? 'R' : e.hands === 'R' ? 'L' : e.hands };
      return e;
  });
  return {
    ...clip,
    keys: keys(clip.keys),
    mistakes: clip.mistakes?.map(m => ({
      ...m,
      delta: m.delta && mirrorPose(m.delta),
      keys: m.keys && keys(m.keys),
      equipment: m.equipment && mirrorEquipment(m.equipment),
    })),
    equipment: clip.equipment && mirrorEquipment(clip.equipment),
    focus: clip.focus && [-clip.focus[0], clip.focus[1], clip.focus[2]],
    view: clip.view === 'side' ? 'otherSide' : clip.view === 'otherSide' ? 'side' : clip.view,
  };
}

/**
 * Where a rep's stages sit in the clip: start → hardest point (a), held
 * until b, back to the start by c. Null when the clip has no depth marks.
 */
export function repTimeline(clip: Clip): { a: number; b: number; c: number } | null {
  const ks = clip.keys;
  const i = ks.findIndex(k => (k.depth ?? 0) >= 0.99);
  if (i <= 0) return null;
  let j = i;
  while (j + 1 < ks.length && (ks[j + 1].depth ?? 0) >= 0.99) j++;
  const back = ks.slice(j + 1).find(k => (k.depth ?? 0) <= 0.01);
  return { a: ks[i].t, b: ks[j].t, c: back?.t ?? 1 };
}
