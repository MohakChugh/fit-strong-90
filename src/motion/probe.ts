/**
 * CPU skinning for checks without WebGL: where the body surface is for a
 * solved pose. Used by the clip tests and the authoring probe script.
 */

import { Vector3 } from 'three';
import type { CharacterData } from './character';
import type { Rig } from './rig';
import type { MuscleName } from './types';

/** Skinned vertex positions for the rig's current solve. */
export function skin(data: CharacterData, rig: Rig, out = new Float32Array(data.position.length)): Float32Array {
  const v = new Vector3();
  const acc = new Vector3();
  const t = new Vector3();
  for (let i = 0; i < data.position.length / 3; i++) {
    acc.set(0, 0, 0);
    for (let k = 0; k < 4; k++) {
      const w = data.skinWeight[i * 4 + k] / 255;
      if (!w) continue;
      const b = data.skinIndex[i * 4 + k];
      v.set(data.position[i * 3], data.position[i * 3 + 1], data.position[i * 3 + 2]).sub(rig.rest[b]);
      t.copy(v).applyQuaternion(rig.W[b]).add(rig.P[b]);
      acc.addScaledVector(t, w);
    }
    out[i * 3] = acc.x; out[i * 3 + 1] = acc.y; out[i * 3 + 2] = acc.z;
  }
  return out;
}

export interface SurfaceReport {
  /** Lowest point of the whole body (negative = below the floor). */
  minY: number;
  /** Lowest point per muscle region, for contact checks (glutes on the floor, heels down…). */
  regionMinY: Partial<Record<MuscleName | 'head', number>>;
}

/**
 * The same answer as `surface(skin(...))` but several times cheaper, because
 * only the vertical row of each bone's transform is evaluated. Use it for the
 * fine phase sweeps that look for a body part dipping through the floor.
 */
export function lowestY(data: CharacterData, rig: Rig): SurfaceReport {
  const n = rig.bones.length;
  const row = new Float64Array(n * 4);
  for (let b = 0; b < n; b++) {
    const { x, y, z, w } = rig.W[b];
    // Row 1 of the rotation matrix for that quaternion, then the constant term.
    const a = 2 * (x * y + w * z), c = 1 - 2 * (x * x + z * z), d = 2 * (y * z - w * x);
    const r = rig.rest[b];
    row[b * 4] = a; row[b * 4 + 1] = c; row[b * 4 + 2] = d;
    row[b * 4 + 3] = rig.P[b].y - (a * r.x + c * r.y + d * r.z);
  }
  const { position, skinIndex, skinWeight, muscle, muscles } = data;
  const regionMinY: Record<string, number> = {};
  let minY = Infinity;
  for (let i = 0; i < muscle.length; i++) {
    const px = position[i * 3], py = position[i * 3 + 1], pz = position[i * 3 + 2];
    let y = 0;
    for (let k = 0; k < 4; k++) {
      const wgt = skinWeight[i * 4 + k];
      if (!wgt) continue;
      const o = skinIndex[i * 4 + k] * 4;
      y += (wgt / 255) * (row[o] * px + row[o + 1] * py + row[o + 2] * pz + row[o + 3]);
    }
    if (y < minY) minY = y;
    const m = muscles[muscle[i]];
    const key = m === 'none' ? 'head' : m;
    if (!(key in regionMinY) || y < regionMinY[key]) regionMinY[key] = y;
  }
  return { minY, regionMinY };
}

export function surface(data: CharacterData, skinned: Float32Array): SurfaceReport {
  const regionMinY: Record<string, number> = {};
  let minY = Infinity;
  for (let i = 0; i < data.muscle.length; i++) {
    const y = skinned[i * 3 + 1];
    if (y < minY) minY = y;
    const m = data.muscles[data.muscle[i]];
    const key = m === 'none' ? 'head' : m;
    if (!(key in regionMinY) || y < regionMinY[key]) regionMinY[key] = y;
  }
  return { minY, regionMinY };
}
