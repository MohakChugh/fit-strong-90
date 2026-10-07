import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Vector3 } from 'three';
import { parseCharacter } from '../character';
import { Rig } from '../rig';
import { mirrorClip, sampleKeys, samplePose } from '../clip';
import { lowestY, skin } from '../probe';
import { EXERCISE_CLIPS, getClip } from '.';
import { getCoaching } from '@/data/coaching';
import { CATALOG, getMeta } from '@/data/catalog';
import type { Clip, Equipment, Mistake, Pose, PoseKey, Vec3 } from '../types';

const buf = fs.readFileSync('public/models/coach-male.bin');
const data = parseCharacter(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const rig = new Rig(data.bones);
const PHASES = Array.from({ length: 8 }, (_, i) => i / 8);
/** Floor sweep: a coarse grid, then a finer pass around its lowest point (dips are a few % of a cycle wide). */
const FLOOR_GRID = 16;
const FLOOR_REFINE = 8;

/** How close a solved hand has to get to the target the pose asks for. */
const REACH = 0.03;
/** The body may sink this far into the floor (shoes and soft tissue). */
const FLOOR = -0.025;
/** A body resting on a pad or seat sits within this of its top. */
const CONTACT = 0.02;
/** A pillow or towel is soft, so a head may settle this far into one — but not through it. */
const SOFT = 0.03;
/** A foot bearing weight beside another planted foot may not slide further than this. */
const PLANTED = 0.03;
/** Every fault has to move the figure's surface at least this far, or nobody can see it. */
const VISIBLE = 0.03;

/**
 * Generous anatomical ranges per pose field and component: anything outside is a joint the body
 * cannot make, whatever the clip meant to show. IK-driven limbs are checked by `bend` below.
 */
const LIMITS: Partial<Record<PoseKey, [number, number][]>> = {
  spine: [[-55, 70], [-40, 40], [-65, 65]],
  lumbar: [[-35, 40], [-25, 25], [-25, 25]],
  thoracic: [[-30, 40], [-25, 25], [-35, 35]],
  neck: [[-70, 65], [-35, 35], [-35, 35]],
  head: [[-40, 45], [-25, 25], [-25, 25]],
  clavL: [[-25, 25], [-25, 25]], clavR: [[-25, 25], [-25, 25]],
  shoulderL: [[-90, 200], [-50, 130], [-90, 90]], shoulderR: [[-90, 200], [-50, 130], [-90, 90]],
  elbowL: [[-5, 160]], elbowR: [[-5, 160]],
  forearmL: [[-100, 100]], forearmR: [[-100, 100]],
  wristL: [[-75, 75], [-30, 30]], wristR: [[-75, 75], [-30, 30]],
  hipL: [[-40, 125], [-30, 60], [-50, 60]], hipR: [[-40, 125], [-30, 60], [-50, 60]],
  kneeL: [[-5, 162]], kneeR: [[-5, 162]],
  ankleL: [[-72, 32], [-20, 20]], ankleR: [[-72, 32], [-20, 20]],
  toesL: [[-30, 70]], toesR: [[-30, 70]],
  heelL: [[-30, 80]], heelR: [[-30, 80]],
  rootTwist: [[-95, 95]],
  gripL: [[0, 1]], gripR: [[0, 1]],
};
/** Ceiling on the angle a hinge closes to, whether FK or IK put it there. */
const BEND = 163;

/** Every way a clip can be shown: correct, each fault, both sides. */
function variants(clip: Clip): [string, Clip, Mistake | null][] {
  const out: [string, Clip, Mistake | null][] = [[clip.id, clip, null]];
  for (const m of clip.mistakes ?? []) out.push([m.id, clip, m]);
  if (clip.sided) out.push([`${clip.id} (right)`, mirrorClip(clip), null]);
  return out;
}

function solveAt(clip: Clip, phase: number, mistake: Mistake | null): Pose {
  const pose = samplePose(clip, phase, mistake, 1);
  rig.solve(pose);
  return pose;
}

/** Angle closed at a joint, from the two segments either side of it. */
function bend(a: string, b: string, c: string): number {
  const u = rig.joint(b).clone().sub(rig.joint(a)).normalize();
  const v = rig.joint(c).clone().sub(rig.joint(b)).normalize();
  return (Math.acos(Math.min(1, Math.max(-1, u.dot(v)))) * 180) / Math.PI;
}

/** Joint positions for the current solve. */
const joints = () => rig.P.map(p => p.clone());
const spread = (a: Vector3[], b: Vector3[]) => a.reduce((m, p, i) => Math.max(m, p.distanceTo(b[i])), 0);

/** Lowest point of the body over the cycle, found on a coarse grid and then refined around it. */
function lowestOverCycle(clip: Clip, m: Mistake | null): { y: number; at: number } {
  let y = Infinity, at = 0;
  for (let i = 0; i < FLOOR_GRID; i++) {
    const ph = i / FLOOR_GRID;
    rig.solve(samplePose(clip, ph, m, 1));
    const v = lowestY(data, rig).minY;
    if (v < y) { y = v; at = ph; }
  }
  for (let i = 1; i < FLOOR_REFINE; i++) {
    const ph = at - 1 / FLOOR_GRID + (2 * i) / (FLOOR_GRID * FLOOR_REFINE);
    rig.solve(samplePose(clip, ph, m, 1));
    const v = lowestY(data, rig).minY;
    if (v < y) { y = v; at = ph; }
  }
  return { y, at };
}

/** A flat top a body part rests on: a mat, a pillow or towel, a bench or chair seat. */
interface Support {
  what: string;
  kind: 'mat' | 'pillow' | 'seat';
  /** Height of the top, its centre and half-extents, and its turn about Y. */
  y: number; x: number; z: number; hx: number; hz: number; yaw: number;
}
/** Sizes here mirror the meshes `buildEquipment` makes in equipment.ts. */
function supports(e: Equipment): Support[] {
  const s = (what: string, kind: Support['kind'], y: number, pos: Vec3 | undefined, hx: number, hz: number, yaw = 0): Support[] =>
    [{ what, kind, y, x: pos?.[0] ?? 0, z: pos?.[2] ?? 0, hx, hz, yaw }];
  if (e.kind === 'mat') return s('mat', 'mat', 0.008, e.pos, 0.31, 0.925, e.yaw);
  if (e.kind === 'box' && e.material === 'cloth') return s(`pillow at z ${e.pos[2]}`, 'pillow', e.pos[1] + e.size[1], e.pos, e.size[0] / 2, e.size[2] / 2, e.yaw);
  if (e.kind === 'bench') return s('bench', 'seat', e.height ?? 0.44, e.pos, 0.15, (e.length ?? 1.2) / 2, e.yaw);
  if (e.kind === 'chair') return s('chair', 'seat', e.height ?? 0.46, e.pos, 0.22, 0.21, e.yaw);
  return [];
}

/** Lowest skinned point of `region` (or of anything) over a support's footprint; Infinity when nothing is over it. */
function overSupport(sk: Float32Array, p: Support, region?: string): number {
  const c = Math.cos(-p.yaw * Math.PI / 180), si = Math.sin(-p.yaw * Math.PI / 180);
  let lo = Infinity;
  for (let v = 0; v < data.muscle.length; v++) {
    if (region && data.muscles[data.muscle[v]] !== region) continue;
    const dx = sk[v * 3] - p.x, dz = sk[v * 3 + 2] - p.z;
    if (Math.abs(dx * c + dz * si) > p.hx || Math.abs(-dx * si + dz * c) > p.hz) continue;
    if (sk[v * 3 + 1] < lo) lo = sk[v * 3 + 1];
  }
  return lo;
}

describe('motion clips', () => {
  it('ids are unique and belong to the catalogue', () => {
    const ids = EXERCISE_CLIPS.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(getMeta(id), id).toBeTruthy();
  });

  it('every live catalogue exercise has a clip, and retired ids follow their alias', () => {
    for (const meta of CATALOG) {
      const retired = 'retired' in meta && meta.retired;
      if (!retired) expect(getClip(meta.id), `${meta.id} has no clip`).toBeTruthy();
      else if ('aliasOf' in meta && meta.aliasOf) expect(getClip(meta.id)?.id, `${meta.id} alias`).toBe(meta.aliasOf);
    }
  });

  it('sampling an empty key list is harmless', () => {
    expect(sampleKeys([], 0.5)).toEqual({ pose: {}, depth: 0 });
  });

  for (const clip of EXERCISE_CLIPS) {
    describe(clip.id, () => {
      it('has ordered keys inside one cycle and a sane duration', () => {
        expect(clip.keys.length).toBeGreaterThan(0);
        expect(clip.keys[0].t).toBe(0);
        clip.keys.forEach((k, i) => {
          expect(k.t).toBeGreaterThanOrEqual(0);
          expect(k.t).toBeLessThan(1);
          if (i) expect(k.t).toBeGreaterThan(clip.keys[i - 1].t);
        });
        expect(clip.duration).toBeGreaterThan(0.5);
        expect(clip.duration).toBeLessThan(40);
        if (clip.loopFrom !== undefined) {
          expect(clip.loopFrom).toBeGreaterThan(0);
          // The loop has to land on the settled hold, inside the keys it wraps between.
          expect(clip.loopFrom).toBeLessThan(clip.keys[clip.keys.length - 1].t);
        }
      });

      it('shows every coaching mistake, and only those', () => {
        const coaching = getCoaching(clip.id);
        expect(coaching, 'coaching record').toBeTruthy();
        const want = (coaching?.mistakes ?? []).map(m => m.clip).sort();
        expect((clip.mistakes ?? []).map(m => m.id).sort()).toEqual(want);
      });

      for (const [name, c, mistake] of variants(clip)) {
        it(`${name}: reaches its targets, stays on the floor and keeps its joints real`, () => {
          for (const ph of PHASES) {
            const pose = solveAt(c, ph, mistake);
            for (const p of rig.P) expect(Number.isFinite(p.x + p.y + p.z), `${name} @${ph} NaN`).toBe(true);
            // Hand IK in every frame, not just world space: an out-of-reach target mutes the pose it meant to show.
            for (const side of ['L', 'R'] as const) {
              const target = rig.handTarget(side, pose);
              if (target) expect(rig.grip(side).distanceTo(target), `${name} @${ph} hand ${side} reach`).toBeLessThan(REACH);
            }
            for (const [key, ranges] of Object.entries(LIMITS) as [PoseKey, [number, number][]][]) {
              const v = pose[key];
              if (v === undefined) continue;
              const parts = typeof v === 'number' ? [v] : (v as readonly number[]);
              parts.forEach((x, i) => {
                const [lo, hi] = ranges[Math.min(i, ranges.length - 1)];
                expect(x, `${name} @${ph} ${key}[${i}] out of range`).toBeGreaterThanOrEqual(lo);
                expect(x, `${name} @${ph} ${key}[${i}] out of range`).toBeLessThanOrEqual(hi);
              });
            }
            for (const [what, a, b, d] of [
              ['knee L', 'thigh_l', 'calf_l', 'foot_l'], ['knee R', 'thigh_r', 'calf_r', 'foot_r'],
              ['elbow L', 'upperarm_l', 'lowerarm_l', 'hand_l'], ['elbow R', 'upperarm_r', 'lowerarm_r', 'hand_r'],
            ] as const) {
              expect(bend(a, b, d), `${name} @${ph} ${what} folded past the joint's range`).toBeLessThan(BEND);
            }
          }
          const low = lowestOverCycle(c, mistake);
          expect(low.y, `${name} @${low.at.toFixed(3)} below the floor`).toBeGreaterThan(FLOOR);
        });

        it(`${name}: keeps a planted foot planted`, () => {
          const N = 48;
          const poses = Array.from({ length: N }, (_, i) => samplePose(c, i / N, mistake, 1));
          let lo = Infinity, hi = -Infinity, worst = 0, at = 0;
          for (let i = 0; i <= N; i++) {
            const a = poses[i % N], b = poses[(i + 1) % N];
            // Both feet on an unchanged surface: whatever moves the ground moves both, so the
            // distance between them must hold. One foot sliding against the other is skating.
            const down = a.footL && a.footR && b.footL && b.footR
              && Math.abs(a.footL[1] - b.footL[1]) < 1e-9 && Math.abs(a.footR[1] - b.footR[1]) < 1e-9;
            if (!down) { lo = Infinity; hi = -Infinity; continue; }
            const sep = Math.hypot(a.footL![0] - a.footR![0], a.footL![2] - a.footR![2]);
            lo = Math.min(lo, sep); hi = Math.max(hi, sep);
            if (hi - lo > worst) { worst = hi - lo; at = i / N; }
          }
          expect(worst, `${name}: a planted foot slid by @${at.toFixed(3)}`).toBeLessThan(PLANTED);
        });
      }

      const props = (clip.equipment ?? []).flatMap(supports);
      if (props.length) {
        it('rests on its mat, pillow and seat without sinking into them', () => {
          /**
           * Gap from each support's top to the nearest part of the body resting on it: the
           * buttocks for a seat (the legs hang in front of it), the lowest part over a pillow,
           * the whole body for the mat.
           */
          const gaps = (c: Clip, mistake: Mistake | null, list: Support[]) => {
            const out = list.map(() => Infinity);
            for (let i = 0; i < 6; i++) {
              rig.solve(samplePose(c, i / 6, mistake, 1));
              const sk = skin(data, rig);
              list.forEach((p, j) => {
                const g = p.kind === 'mat' ? lowestY(data, rig).minY - p.y
                  : (p.kind === 'seat' ? overSupport(sk, p, 'glutes') : overSupport(sk, p)) - p.y;
                out[j] = Math.min(out[j], g);
              });
            }
            return out;
          };
          // Whether the figure uses each support at all is settled by the correct form: a chair it
          // only holds on to, or props its feet on, is not something it has to sit on.
          const used = gaps(clip, null, props);
          const sits = (p: Support, g: number) => p.kind !== 'seat' || Math.abs(g) < 0.06;
          props.forEach((p, j) => {
            if (!sits(p, used[j])) return;
            expect(used[j], `${clip.id}: ${p.what} not in contact`).toBeLessThan(CONTACT);
            if (p.kind === 'pillow') expect(used[j], `${clip.id}: ${p.what} squashed flat`).toBeGreaterThan(-SOFT);
          });
          for (const [name, c, mistake] of variants(clip)) {
            const list = c === clip ? props : (c.equipment ?? []).flatMap(supports);
            // A fault may lift a part off its support — that is often the fault — but never sink through
            // it. (How far the body may settle into the 8 mm mat is the floor check's business.)
            gaps(c, mistake, list).forEach((g, j) => {
              if (list[j].kind === 'mat' || !sits(list[j], used[j])) return;
              expect(g, `${name}: ${list[j].what} passed through`).toBeGreaterThan(list[j].kind === 'pillow' ? -SOFT : -CONTACT);
            });
          }
        });
      }

      it('loops without a jump', () => {
        // The biggest frame-to-frame step inside the cycle, as the speed to judge the wrap against.
        const dt = 1 / (30 * clip.duration);
        const last = clip.keys[clip.keys.length - 1].t;
        let inside = 0;
        let prev = (rig.solve(samplePose(clip, 0)), joints());
        for (let p = dt; p < last; p += dt) {
          rig.solve(samplePose(clip, p));
          const now = joints();
          inside = Math.max(inside, spread(prev, now));
          prev = now;
        }
        // Then the frames that span the wrap. (Faults re-use the clip's keys and its wrap, and a
        // few of them are deliberate jolts, so the correct form is what sets the bar here.)
        let seam = 0, at = 0;
        let was = (rig.solve(samplePose(clip, last - dt)), joints());
        for (let p = last; p < 1 + 2 * dt; p += dt) {
          // What the viewer plays: past 1 the cycle restarts at `loopFrom` when the clip has one.
          const q = p >= 1 ? (clip.loopFrom !== undefined ? clip.loopFrom + (p - 1) : p - 1) : p;
          rig.solve(samplePose(clip, q));
          const now = joints();
          const step = spread(was, now);
          if (step > seam) { seam = step; at = q; }
          was = now;
        }
        // The wrap is just another frame: it may not move more than the movement itself does.
        expect(seam, `${clip.id}: jumps at the loop seam @${at.toFixed(3)} (${(inside * 100).toFixed(1)} cm/frame elsewhere)`)
          .toBeLessThan(inside * 1.8 + 0.005);
      });

      /** Skinned body for the correct clip, shared by the fault checks below. */
      let correct: Float32Array[] | null = null;
      const FAULT_PHASES = 6;
      for (const m of clip.mistakes ?? []) {
        it(`${m.id}: is visible`, () => {
          correct ??= Array.from({ length: FAULT_PHASES }, (_, i) => {
            rig.solve(samplePose(clip, i / FAULT_PHASES));
            return skin(data, rig, new Float32Array(data.position.length));
          });
          let worst = 0;
          for (let i = 0; i < FAULT_PHASES; i++) {
            rig.solve(samplePose(clip, i / FAULT_PHASES, m, 1));
            const bad = skin(data, rig);
            const good = correct[i];
            for (let v = 0; v < bad.length; v += 3) {
              const d = Math.hypot(good[v] - bad[v], good[v + 1] - bad[v + 1], good[v + 2] - bad[v + 2]);
              if (d > worst) worst = d;
            }
          }
          expect(worst, `${m.id} moves nothing a viewer could see`).toBeGreaterThan(VISIBLE);
        });
      }
    });
  }
});

