/**
 * Poses the coach skeleton from anatomical joint angles and IK targets.
 *
 * Every bone rests with an identity rotation (only offsets), so a bone's
 * world rotation W poses it. Each bone also has a neutral rotation N taking
 * the rest A-pose segment to anatomical standing: arms by the sides with the
 * thumbs forward, legs straight under the hips. Joint angles rotate a
 * segment's anatomical frame A relative to its parent's, and W = A · N.
 */

import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { BoneDef, Pose } from './types';

const DEG = Math.PI / 180;
const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const NX = new Vector3(-1, 0, 0);
const NY = new Vector3(0, -1, 0);

const SIDES = [['L', 'l', 1], ['R', 'r', -1]] as const;
const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'] as const;
/** Grip curl per phalanx (degrees at grip 1). */
const CURL: Record<(typeof FINGERS)[number], [number, number, number]> = {
  thumb: [18, 28, 30], index: [62, 88, 52], middle: [66, 90, 52], ring: [68, 90, 50], pinky: [70, 86, 48],
};
const SPINE_SPLIT = { flex: [0.45, 0.3, 0.25], side: [0.4, 0.3, 0.3], twist: [0.15, 0.35, 0.5] };

const v3 = (a: readonly number[]) => new Vector3(a[0], a[1], a[2]);

/** Rotation taking a1 → b1 exactly and a2 → b2 as closely as possible. */
export function lookRotation(a1: Vector3, a2: Vector3, b1: Vector3, b2: Vector3, out = new Quaternion()): Quaternion {
  const basis = (p: Vector3, s: Vector3) => {
    const e1 = p.clone().normalize();
    const e2 = s.clone().addScaledVector(e1, -s.dot(e1));
    if (e2.lengthSq() < 1e-10) e2.copy(Math.abs(e1.y) < 0.9 ? Y : Z).addScaledVector(e1, -(Math.abs(e1.y) < 0.9 ? e1.y : e1.z));
    e2.normalize();
    return new Matrix4().makeBasis(e1, e2, new Vector3().crossVectors(e1, e2));
  };
  const m = basis(b1, b2).multiply(basis(a1, a2).transpose());
  return out.setFromRotationMatrix(m);
}

const euler = new Euler();
/** Joint rotation applied twist first, then abduction, then flexion. */
function joint(x: number, z: number, y: number, out: Quaternion): Quaternion {
  return out.setFromEuler(euler.set(x * DEG, y * DEG, z * DEG, 'XZY'));
}

export class Rig {
  readonly bones: BoneDef[];
  readonly index: Record<string, number>;
  readonly rest: Vector3[];
  readonly neutral: Quaternion[];
  /** Outputs of `solve`: anatomical frames, world rotations and joint positions. */
  readonly A: Quaternion[];
  readonly W: Quaternion[];
  readonly P: Vector3[];
  /** Pelvis height when standing tall with straight legs. */
  readonly standHeight: number;
  private readonly fingerAxis = new Map<number, Vector3>();
  private readonly gripOffset: Record<'L' | 'R', Vector3> = { L: new Vector3(), R: new Vector3() };
  private readonly done: boolean[];

  constructor(bones: BoneDef[]) {
    this.bones = bones;
    this.index = Object.fromEntries(bones.map((b, i) => [b.name, i]));
    this.rest = bones.map(b => v3(b.head));
    this.neutral = bones.map(() => new Quaternion());
    this.A = bones.map(() => new Quaternion());
    this.W = bones.map(() => new Quaternion());
    this.P = bones.map(b => v3(b.head));
    this.done = bones.map(() => false);

    const dir = (name: string) => v3(this.def(name).tail).sub(v3(this.def(name).head)).normalize();
    for (const [, s, sign] of SIDES) {
      const ab = (deg: number) => new Vector3(sign * Math.sin(deg * DEG), -Math.cos(deg * DEG), 0);
      this.neutral[this.i(`thigh_${s}`)].setFromUnitVectors(dir(`thigh_${s}`), ab(2));
      this.neutral[this.i(`calf_${s}`)].setFromUnitVectors(dir(`calf_${s}`), NY);
      this.neutral[this.i(`upperarm_${s}`)].setFromUnitVectors(dir(`upperarm_${s}`), ab(6));
      const wrist = v3(this.def(`hand_${s}`).head);
      const thumb = v3(this.def(`thumb_01_${s}`).head).sub(wrist);
      lookRotation(dir(`lowerarm_${s}`), thumb, ab(6), Z, this.neutral[this.i(`lowerarm_${s}`)]);
      const knuckles = v3(this.def(`middle_01_${s}`).head).sub(wrist);
      const nHand = lookRotation(knuckles, thumb, ab(6), Z, this.neutral[this.i(`hand_${s}`)]);
      // Neutral hand frame: fingers down, palm towards the midline.
      const palm = new Vector3(-sign, 0, 0);
      for (const f of FINGERS) for (let k = 1; k <= 3; k++) {
        const i = this.i(`${f}_0${k}_${s}`);
        this.neutral[i].copy(nHand);
        const d = v3(this.bones[i].tail).sub(v3(this.bones[i].head)).applyQuaternion(nHand).normalize();
        const axis = f === 'thumb'
          ? new Vector3().crossVectors(d, palm.clone().add(new Vector3(0, -0.6, 0))).normalize()
          : new Vector3().crossVectors(d, palm).normalize();
        this.fingerAxis.set(i, axis);
      }
      // Palm centre relative to the wrist, in the neutral hand frame.
      this.gripOffset[sign > 0 ? 'L' : 'R'].copy(knuckles.applyQuaternion(nHand).multiplyScalar(0.72)).addScaledVector(palm, 0.022);
    }
    const legLen = (s: string) =>
      v3(this.def(`calf_${s}`).head).distanceTo(v3(this.def(`thigh_${s}`).head)) + v3(this.def(`foot_${s}`).head).distanceTo(v3(this.def(`calf_${s}`).head));
    const pelvis = this.def('pelvis');
    this.standHeight = this.def('foot_l').head[1] + legLen('l') * Math.cos(2 * DEG) + (pelvis.head[1] - this.def('thigh_l').head[1]);
  }

  private def(name: string): BoneDef {
    const b = this.bones[this.index[name]];
    if (!b) throw new Error(`no bone ${name}`);
    return b;
  }
  i(name: string): number {
    const i = this.index[name];
    if (i === undefined) throw new Error(`no bone ${name}`);
    return i;
  }

  /** World position of a bone's head after `solve`. */
  joint(name: string): Vector3 {
    return this.P[this.i(name)];
  }

  /** Palm centre (where a handle sits) after `solve`. */
  grip(side: 'L' | 'R'): Vector3 {
    const h = this.i(side === 'L' ? 'hand_l' : 'hand_r');
    return this.gripOffset[side].clone().applyQuaternion(this.A[h]).add(this.P[h]);
  }

  /** Axis of a handle held in the hand (index finger → little finger) after `solve`. */
  handAxis(side: 'L' | 'R'): Vector3 {
    return Z.clone().applyQuaternion(this.A[this.i(side === 'L' ? 'hand_l' : 'hand_r')]);
  }

  /**
   * World point a pose's hand target asks for, whatever `handSpace` it names
   * (after `solve`, which places the shoulder, chest and pelvis frames).
   */
  handTarget(side: 'L' | 'R', pose: Pose): Vector3 | null {
    const h = pose[`hand${side}`];
    if (!h) return null;
    if (pose.handSpace === 'shoulders') return v3(h).add(this.P[this.i(side === 'L' ? 'upperarm_l' : 'upperarm_r')]);
    const space = pose.handSpace === 'chest' ? this.i('spine_03') : pose.handSpace === 'pelvis' ? this.i('pelvis') : -1;
    return space < 0 ? v3(h) : v3(h).applyQuaternion(this.A[space]).add(this.P[space]);
  }

  solve(pose: Pose): void {
    const { A, W, P, rest, neutral, bones, done } = this;
    done.fill(false);
    const root = this.i('Root');
    A[root].identity(); W[root].identity(); P[root].set(0, 0, 0); done[root] = true;
    const pel = this.i('pelvis');
    const rr = pose.rootRot ?? [0, 0, 0];
    A[pel].setFromEuler(euler.set(rr[0] * DEG, rr[1] * DEG, rr[2] * DEG, 'YXZ'));
    if (pose.rootTwist) A[pel].multiply(new Quaternion().setFromAxisAngle(Y, pose.rootTwist * DEG));
    W[pel].copy(A[pel]);
    if (pose.root) P[pel].set(pose.root[0], pose.root[1], pose.root[2]);
    else P[pel].set(0, this.standHeight, rest[pel].z);
    done[pel] = true;

    const q = new Quaternion();
    const tmp = new Vector3();
    for (let i = 0; i < bones.length; i++) {
      const p = bones[i].parent;
      if (p >= 0 && i !== pel) P[i].copy(tmp.subVectors(rest[i], rest[p]).applyQuaternion(W[p]).add(P[p]));
      if (done[i]) {
        // Solved by IK earlier in this pass (or the root/pelvis): only its world rotation is left.
        if (i !== root && i !== pel) W[i].multiplyQuaternions(A[i], neutral[i]);
        continue;
      }
      const name = bones[i].name;
      const side = name.endsWith('_l') ? 'L' : name.endsWith('_r') ? 'R' : '';
      const sign = side === 'R' ? -1 : 1;
      const base = side ? name.slice(0, -2) : name;

      if (base === 'thigh' && pose[`foot${side as 'L' | 'R'}`]) { this.leg(side as 'L' | 'R', pose); }
      else if (base === 'thigh' && pose[`kneeAim${side as 'L' | 'R'}`]) {
        const k = v3(pose[`kneeAim${side as 'L' | 'R'}`]!).sub(P[i]);
        const calf = this.i(`calf_${side.toLowerCase()}`);
        const u1 = new Vector3().subVectors(rest[calf], rest[i]).applyQuaternion(neutral[i]);
        lookRotation(u1, X, k, X.clone().applyQuaternion(A[pel]), A[i]);
        done[i] = true;
      }
      else if (base === 'upperarm' && pose[`hand${side as 'L' | 'R'}`]) { this.arm(side as 'L' | 'R', pose); }
      if (done[i]) { W[i].multiplyQuaternions(A[i], neutral[i]); continue; }

      let r: Quaternion | null = null;
      const k = (name === 'spine_01' ? 0 : name === 'spine_02' ? 1 : 2);
      switch (base) {
        case 'spine_01': case 'spine_02': case 'spine_03': {
          const s = pose.spine ?? [0, 0, 0];
          const extra = k === 0 ? pose.lumbar : k === 2 ? pose.thoracic : undefined;
          const f = s[0] * SPINE_SPLIT.flex[k] + (extra?.[0] ?? 0);
          const sb = s[1] * SPINE_SPLIT.side[k] + (extra?.[1] ?? 0);
          const tw = s[2] * SPINE_SPLIT.twist[k] + (extra?.[2] ?? 0);
          r = joint(f, -sb, tw, q);
          break;
        }
        case 'neck_01': if (pose.neck) r = joint(pose.neck[0], -pose.neck[1], pose.neck[2], q); break;
        case 'head': if (pose.head) r = joint(pose.head[0], -pose.head[1], pose.head[2], q); break;
        case 'clavicle': { const c = pose[`clav${side as 'L' | 'R'}`]; if (c) r = joint(0, sign * c[0], -sign * c[1], q); break; }
        case 'upperarm': { const s = pose[`shoulder${side as 'L' | 'R'}`]; if (s) r = joint(-s[0], sign * s[1], sign * s[2], q); break; }
        case 'lowerarm': {
          const e = pose[`elbow${side as 'L' | 'R'}`] ?? 0; const pr = pose[`forearm${side as 'L' | 'R'}`] ?? 0;
          if (e || pr) r = joint(-e, 0, -sign * pr, q);
          break;
        }
        case 'hand': { const w = pose[`wrist${side as 'L' | 'R'}`]; if (w) r = joint(-w[1], -sign * w[0], 0, q); break; }
        case 'thigh': { const h = pose[`hip${side as 'L' | 'R'}`]; if (h) r = joint(-h[0], sign * h[1], sign * h[2], q); break; }
        case 'calf': { const kn = pose[`knee${side as 'L' | 'R'}`]; if (kn) r = joint(kn, 0, 0, q); break; }
        case 'foot': { const a = pose[`ankle${side as 'L' | 'R'}`]; if (a) r = joint(-a[0], -sign * a[1], 0, q); break; }
        case 'ball': { const t = pose[`toes${side as 'L' | 'R'}`]; if (t) r = joint(-t, 0, 0, q); break; }
        default: {
          const axis = this.fingerAxis.get(i);
          const grip = pose[`grip${side as 'L' | 'R'}`];
          if (axis && grip) {
            const f = FINGERS.find(n => base.startsWith(n))!;
            const seg = Number(base.slice(-1)) - 1;
            r = q.setFromAxisAngle(axis, CURL[f][seg] * grip * DEG);
          }
        }
      }
      A[i].copy(A[p]);
      if (r) A[i].multiply(r);
      W[i].multiplyQuaternions(A[i], neutral[i]);
      done[i] = true;
    }
  }

  /** Two-bone leg IK onto a flat (or heel-raised) foot. */
  private leg(side: 'L' | 'R', pose: Pose) {
    const s = side.toLowerCase();
    const { A, P, rest, neutral, done } = this;
    const thigh = this.i(`thigh_${s}`), calf = this.i(`calf_${s}`), foot = this.i(`foot_${s}`), ball = this.i(`ball_${s}`);
    const fr = pose[`footRot${side}`] ?? [0, 0, 0];
    const flat = new Quaternion().setFromEuler(euler.set(fr[0] * DEG, fr[1] * DEG, fr[2] * DEG, 'YXZ'));
    const heel = pose[`heel${side}`] ?? 0;
    const aFoot = flat.clone();
    if (heel) aFoot.multiply(new Quaternion().setFromAxisAngle(X, heel * DEG));
    const f = pose[`foot${side}`]!;
    const toBall = new Vector3().subVectors(rest[ball], rest[foot]);
    const ankleFlat = new Vector3(0, rest[foot].y, 0).applyQuaternion(flat).add(v3(f));
    const ballFlat = toBall.clone().applyQuaternion(flat).add(ankleFlat);
    const T = heel ? ballFlat.clone().sub(toBall.clone().applyQuaternion(aFoot)) : ankleFlat;

    const H = P[thigh];
    const u1 = new Vector3().subVectors(rest[calf], rest[thigh]).applyQuaternion(neutral[thigh]);
    const u2 = new Vector3().subVectors(rest[foot], rest[calf]).applyQuaternion(neutral[calf]);
    const pole = pose[`kneePole${side}`]
      ? v3(pose[`kneePole${side}`]!)
      : Z.clone().applyQuaternion(A[this.i('pelvis')]).add(Z.clone().applyQuaternion(flat)).normalize();
    const { k, h } = twoBone(H, T, u1.length(), u2.length(), pole);
    lookRotation(u1, X, k.clone().sub(H), h, A[thigh]);
    lookRotation(u2, X, T.clone().sub(k), h, A[calf]);
    A[foot].copy(aFoot);
    const toes = pose[`toes${side}`] ?? 0;
    if (heel) A[ball].copy(flat);
    else A[ball].copy(aFoot);
    if (toes) A[ball].multiply(new Quaternion().setFromAxisAngle(X, -toes * DEG));
    done[thigh] = done[calf] = done[foot] = done[ball] = true;
  }

  /** Two-bone arm IK onto a palm target, with the forearm twist shared with the wrist. */
  private arm(side: 'L' | 'R', pose: Pose) {
    const s = side.toLowerCase();
    const sign = side === 'L' ? 1 : -1;
    const { A, P, rest, neutral, done } = this;
    const ua = this.i(`upperarm_${s}`), la = this.i(`lowerarm_${s}`), hand = this.i(`hand_${s}`);
    // Directions may ride on the trunk: express them in the world first ('shoulders' keeps world axes).
    const space = pose.handSpace === 'chest' ? this.i('spine_03') : pose.handSpace === 'pelvis' ? this.i('pelvis') : -1;
    const toWorld = (v: Vector3) => (pose.handSpace === 'shoulders' || space < 0 ? v : v.applyQuaternion(A[space]));
    const fingers = toWorld(v3(pose[`fingers${side}`] ?? [0, -1, 0]));
    const palm = toWorld(v3(pose[`palm${side}`] ?? [-sign, 0, 0]));
    const aHand = lookRotation(NY, new Vector3(-sign, 0, 0), fingers, palm);
    const T = this.handTarget(side, pose)!.sub(this.gripOffset[side].clone().applyQuaternion(aHand));
    const S = P[ua];
    const u1 = new Vector3().subVectors(rest[la], rest[ua]).applyQuaternion(neutral[ua]);
    const u2 = new Vector3().subVectors(rest[hand], rest[la]).applyQuaternion(neutral[la]);
    const chest = A[this.i('spine_03')];
    const pole = pose[`elbowPole${side}`] ? toWorld(v3(pose[`elbowPole${side}`]!)) : new Vector3(sign * 0.35, -0.2, -1).applyQuaternion(chest).normalize();
    const { k, h } = twoBone(S, T, u1.length(), u2.length(), pole);
    lookRotation(u1, NX, k.clone().sub(S), h, A[ua]);
    const aFore = lookRotation(u2, NX, T.clone().sub(k), h);
    // Share the pronation between forearm and wrist so neither end pinches. The twist is taken
    // about the forearm's own long axis, so sharing it cannot slide the wrist off its IK target.
    const rel = aFore.clone().invert().multiply(aHand);
    const ax = u2.clone().normalize();
    const along = rel.x * ax.x + rel.y * ax.y + rel.z * ax.z;
    const tw = new Quaternion(ax.x * along, ax.y * along, ax.z * along, rel.w).normalize();
    A[la].copy(aFore).multiply(new Quaternion().slerpQuaternions(new Quaternion(), tw, 0.5));
    A[hand].copy(aHand);
    done[ua] = done[la] = done[hand] = true;
  }
}

/**
 * Knee/elbow position for a two-bone chain from `a` reaching `t`, bending
 * towards `pole`, and the hinge axis of that bend.
 */
function twoBone(a: Vector3, t: Vector3, l1: number, l2: number, pole: Vector3) {
  const d = new Vector3().subVectors(t, a);
  const dist = Math.min(Math.max(d.length(), Math.abs(l1 - l2) + 1e-4), l1 + l2 - 1e-5);
  const dn = d.normalize();
  const perp = pole.clone().addScaledVector(dn, -pole.dot(dn));
  if (perp.lengthSq() < 1e-8) perp.copy(Math.abs(dn.z) < 0.9 ? Z : Y).addScaledVector(dn, -(Math.abs(dn.z) < 0.9 ? dn.z : dn.y));
  perp.normalize();
  const cosA = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const k = a.clone().addScaledVector(dn, l1 * cosA).addScaledVector(perp, l1 * sinA);
  // Matches the neutral hinge: +X for a knee bending forward, −X for an elbow bending back.
  const h = new Vector3().crossVectors(perp, dn).normalize();
  return { k, h };
}
