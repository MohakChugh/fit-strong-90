/**
 * Gym props built from primitives (no asset files). Hand-held props follow
 * the solved grip points every frame; the rest are placed once.
 */

import {
  Box3, BoxGeometry, BufferGeometry, CylinderGeometry, Group, Line, LineBasicMaterial, Mesh, MeshStandardMaterial,
  Quaternion, SphereGeometry, TorusGeometry, Vector3, type Object3D,
} from 'three';
import type { Rig } from './rig';
import type { Equipment, Pose } from './types';

const steel = new MeshStandardMaterial({ color: 0xa7b0ba, metalness: 0.85, roughness: 0.32 });
const rubber = new MeshStandardMaterial({ color: 0x22262c, metalness: 0.05, roughness: 0.75 });
const pad = new MeshStandardMaterial({ color: 0x2c3138, metalness: 0.0, roughness: 0.6 });
const frameMat = new MeshStandardMaterial({ color: 0x59636f, metalness: 0.55, roughness: 0.45 });
const wood = new MeshStandardMaterial({ color: 0xc19a71, metalness: 0.0, roughness: 0.7 });
const matMat = new MeshStandardMaterial({ color: 0x5b8f95, metalness: 0.0, roughness: 0.9 });
const wallMat = new MeshStandardMaterial({ color: 0xe7e2dc, metalness: 0.0, roughness: 0.95, transparent: true, opacity: 0.55 });
/** Pillows, towels and cushions: soft and light, so they read as cloth. */
const cloth = new MeshStandardMaterial({ color: 0xece4d9, metalness: 0.0, roughness: 0.95 });
const cableMat = new LineBasicMaterial({ color: 0x1f2328 });
const bandMat = new LineBasicMaterial({ color: 0x3fa35b, linewidth: 2 });

export interface EquipmentRig {
  group: Group;
  /** Placed props' world bounds, tagged so the camera can ignore tall frames. */
  bounds: { kind: Equipment['kind']; box: Box3 }[];
  update: (rig: Rig, pose: Pose) => void;
  dispose: () => void;
}

const UP = new Vector3(0, 1, 0);
const tmpQ = new Quaternion();

function cyl(r: number, len: number, mat: MeshStandardMaterial, seg = 20): Mesh {
  const m = new Mesh(new CylinderGeometry(r, r, len, seg), mat);
  m.castShadow = true;
  return m;
}
function box(w: number, h: number, d: number, mat: MeshStandardMaterial): Mesh {
  const m = new Mesh(new BoxGeometry(w, h, d), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
/** Point an object's local Y axis along `dir`, centred at `at`. */
function orient(o: Object3D, at: Vector3, dir: Vector3) {
  o.position.copy(at);
  o.quaternion.copy(tmpQ.setFromUnitVectors(UP, dir.clone().normalize()));
}

function barbell(plates = 1): Group {
  const g = new Group();
  g.add(cyl(0.014, 2.2, steel, 16));
  for (const s of [-1, 1]) {
    const sleeve = cyl(0.025, 0.42, steel, 16);
    sleeve.position.y = s * 0.88;
    g.add(sleeve);
    for (let k = 0; k < plates; k++) {
      const plate = cyl(0.225, 0.045, rubber, 40);
      plate.position.y = s * (0.72 + k * 0.05);
      g.add(plate);
    }
  }
  return g;
}

function dumbbell(): Group {
  const g = new Group();
  g.add(cyl(0.017, 0.15, steel, 14));
  for (const s of [-1, 1]) {
    const head = cyl(0.055, 0.07, rubber, 6);
    head.position.y = s * 0.11;
    g.add(head);
  }
  return g;
}

function kettlebell(): Group {
  const g = new Group();
  const bell = new Mesh(new SphereGeometry(0.11, 24, 18), rubber);
  bell.position.y = -0.17;
  bell.castShadow = true;
  const handle = new Mesh(new TorusGeometry(0.065, 0.012, 10, 24, Math.PI), steel);
  handle.rotation.z = Math.PI;
  handle.position.y = -0.03;
  g.add(bell, handle);
  return g;
}

export function buildEquipment(list: Equipment[]): EquipmentRig {
  const group = new Group();
  const bounds: { kind: Equipment['kind']; box: Box3 }[] = [];
  const updates: ((rig: Rig, pose: Pose) => void)[] = [];
  const disposables: BufferGeometry[] = [];
  let placing: Equipment['kind'] = 'mat';
  const place = (o: Object3D) => { group.add(o); o.updateMatrixWorld(true); bounds.push({ kind: placing, box: new Box3().setFromObject(o) }); };

  for (const e of list) {
    placing = e.kind;
    switch (e.kind) {
      case 'barbell': {
        const bar = barbell(e.plates ?? 1);
        group.add(bar);
        updates.push(rig => {
          const l = rig.grip('L'), r = rig.grip('R');
          orient(bar, l.clone().add(r).multiplyScalar(0.5), l.clone().sub(r));
        });
        break;
      }
      case 'trapBar': {
        const g = new Group();
        const ring = new Mesh(new TorusGeometry(0.42, 0.016, 8, 6), steel);
        ring.rotation.x = Math.PI / 2;
        g.add(ring);
        for (const s of [-1, 1]) {
          const plate = cyl(0.225, 0.045, rubber, 40);
          plate.rotation.z = Math.PI / 2;
          plate.position.x = s * 0.62;
          const sleeve = cyl(0.025, 0.3, steel, 12);
          sleeve.rotation.z = Math.PI / 2;
          sleeve.position.x = s * 0.6;
          g.add(plate, sleeve);
        }
        group.add(g);
        updates.push(rig => {
          const l = rig.grip('L'), r = rig.grip('R');
          g.position.copy(l.add(r).multiplyScalar(0.5));
        });
        break;
      }
      case 'dumbbells': {
        if (e.hands === 'goblet') {
          // One dumbbell held upright by its top plate, between both palms.
          const d = dumbbell();
          group.add(d);
          updates.push(rig => {
            const mid = rig.grip('L').add(rig.grip('R')).multiplyScalar(0.5);
            const up = new Vector3(0, 1, 0).applyQuaternion(rig.A[rig.i('spine_03')]);
            orient(d, mid.addScaledVector(up, -0.09), up);
          });
          break;
        }
        for (const side of ['L', 'R'] as const) {
          if (e.hands && e.hands !== 'both' && e.hands !== side) continue;
          const d = dumbbell();
          group.add(d);
          updates.push(rig => orient(d, rig.grip(side), rig.handAxis(side)));
        }
        break;
      }
      case 'kettlebell': {
        const k = kettlebell();
        group.add(k);
        updates.push(rig => {
          const l = rig.grip('L'), r = rig.grip('R');
          k.position.copy(l.add(r).multiplyScalar(0.5));
        });
        break;
      }
      case 'bench': {
        const g = new Group();
        const h = e.height ?? 0.44, len = e.length ?? 1.2;
        const seat = box(0.3, 0.06, len, pad);
        seat.position.y = h - 0.03;
        g.add(seat);
        if (e.incline) {
          // The back pad hinges at the seat's head end (−z) and rises backwards,
          // so the shoulders end up higher than the hips.
          const bl = len * 0.6;
          const a = (e.incline * Math.PI) / 180;
          const hinge = -len / 2;
          const back = box(0.3, 0.06, bl, pad);
          back.position.set(0, h - 0.03 + Math.sin(a) * bl / 2, hinge - Math.cos(a) * bl / 2);
          // +a keeps the pad's near end down at the seat and lifts its far end,
          // so a reclining body is supported all the way up.
          back.rotation.x = a;
          g.add(back);
        }
        for (const z of [-len / 2 + 0.12, len / 2 - 0.12]) {
          const leg = box(0.05, h - 0.06, 0.05, frameMat);
          leg.position.set(0, (h - 0.06) / 2, z);
          const foot = box(0.36, 0.03, 0.06, frameMat);
          foot.position.set(0, 0.015, z);
          g.add(leg, foot);
        }
        g.position.set(...e.pos);
        g.rotation.y = ((e.yaw ?? 0) * Math.PI) / 180;
        place(g);
        break;
      }
      case 'box': case 'step': {
        const size = e.kind === 'box' ? e.size : [0.9, e.height, 0.36] as const;
        const mats = { wood, pad, frame: frameMat, steel, cloth };
        const b = box(size[0], size[1], size[2], e.kind === 'box' ? mats[e.material ?? (e.pad ? 'pad' : 'wood')] : wood);
        const g = new Group();
        b.position.y = size[1] / 2;
        g.add(b);
        g.position.set(e.pos[0], e.pos[1], e.pos[2]);
        g.rotation.set((((e.kind === 'box' ? e.pitch : 0) ?? 0) * Math.PI) / 180, (((e.kind === 'box' ? e.yaw : 0) ?? 0) * Math.PI) / 180, 0, 'YXZ');
        place(g);
        break;
      }
      case 'chair': {
        const g = new Group();
        const h = e.height ?? 0.46;
        const seat = box(0.44, 0.04, 0.42, wood);
        seat.position.y = h - 0.02;
        const back = box(0.44, 0.42, 0.03, wood);
        back.position.set(0, h + 0.23, -0.2);
        g.add(seat, back);
        for (const [x, z] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) {
          const leg = box(0.03, h - 0.04, 0.03, frameMat);
          leg.position.set(x, (h - 0.04) / 2, z);
          g.add(leg);
        }
        g.position.set(...e.pos);
        g.rotation.y = ((e.yaw ?? 0) * Math.PI) / 180;
        place(g);
        break;
      }
      case 'foamRoller': {
        const r = cyl(0.075, 0.9, matMat, 24);
        r.rotation.z = Math.PI / 2;
        const g = new Group();
        g.add(r);
        g.position.set(e.pos[0], e.pos[1] + 0.075, e.pos[2]);
        g.rotation.y = ((e.yaw ?? 0) * Math.PI) / 180;
        place(g);
        break;
      }
      case 'pullupBar': {
        const g = new Group();
        const bar = cyl(0.016, 1.2, steel, 16);
        bar.rotation.z = Math.PI / 2;
        bar.position.y = e.height;
        g.add(bar);
        for (const s of [-1, 1]) {
          const post = box(0.06, e.height + 0.1, 0.06, frameMat);
          post.position.set(s * 0.62, (e.height + 0.1) / 2, 0);
          g.add(post);
        }
        g.position.z = e.z ?? 0;
        place(g);
        break;
      }
      case 'dowel': {
        const d = cyl(0.014, e.attach === 'back' ? 1.25 : 1.4, wood, 12);
        group.add(d);
        updates.push(rig => {
          if (e.attach === 'hands') { const l = rig.grip('L'), r = rig.grip('R'); orient(d, l.clone().add(r).multiplyScalar(0.5), l.sub(r)); return; }
          // Resting on the back of the head, between the shoulder blades and on the tailbone.
          const back = new Vector3(0, 0, -1).applyQuaternion(rig.A[rig.i('spine_03')]);
          const top = rig.joint('head').clone().addScaledVector(back, 0.1);
          const bottom = rig.joint('pelvis').clone().addScaledVector(new Vector3(0, 0, -1).applyQuaternion(rig.A[rig.i('pelvis')]), 0.13);
          orient(d, top.clone().add(bottom).multiplyScalar(0.5), top.sub(bottom));
        });
        break;
      }
      case 'landmine': {
        const bar = cyl(0.025, 1.9, steel, 14);
        const plate = cyl(0.17, 0.05, rubber, 32);
        group.add(bar, plate);
        const anchor = new Vector3(...e.anchor);
        updates.push(rig => {
          const hands = e.hands === 'L' ? rig.grip('L') : e.hands === 'R' ? rig.grip('R')
            : rig.grip('L').add(rig.grip('R')).multiplyScalar(0.5);
          const dir = hands.clone().sub(anchor).normalize();
          orient(bar, anchor.clone().addScaledVector(dir, 0.95), dir);
          orient(plate, anchor.clone().addScaledVector(dir, hands.distanceTo(anchor) - 0.12), dir);
        });
        break;
      }
      case 'backExtensionBench': {
        const g = new Group();
        const frame = box(0.12, 0.08, 1.15, frameMat);
        frame.position.set(0, 0.55, 0);
        frame.rotation.x = -Math.PI / 4;
        const hip = box(0.4, 0.1, 0.24, pad);
        hip.position.set(0, 0.86, 0.28);
        hip.rotation.x = -Math.PI / 4;
        const foot = box(0.36, 0.03, 0.22, frameMat);
        foot.position.set(0, 0.12, -0.32);
        foot.rotation.x = -Math.PI / 4;
        // Uprights and a base, so the frame stands on the floor.
        const base = box(0.42, 0.04, 0.9, frameMat);
        base.position.y = 0.02;
        const post = box(0.1, 0.84, 0.1, frameMat);
        post.position.set(0, 0.42, 0.1);
        g.add(frame, hip, foot, base, post);
        g.position.set(...e.pos);
        place(g);
        break;
      }
      case 'mat': {
        const m = box(0.62, 0.008, 1.85, matMat);
        m.castShadow = false;
        m.position.set(e.pos?.[0] ?? 0, 0.004, e.pos?.[2] ?? 0);
        m.rotation.y = ((e.yaw ?? 0) * Math.PI) / 180;
        place(m);
        break;
      }
      case 'wall': {
        const w = box(2.4, 2.4, 0.04, wallMat);
        w.position.set(e.x ?? 0, 1.2, e.z);
        w.rotation.y = ((e.yaw ?? 0) * Math.PI) / 180;
        w.castShadow = false;
        place(w);
        break;
      }
      case 'cable': {
        const col = box(0.12, Math.max(0.4, e.anchor[1] + 0.05), 0.12, frameMat);
        col.position.set(e.anchor[0], Math.max(0.4, e.anchor[1] + 0.05) / 2, e.anchor[2] + (e.anchor[2] >= 0 ? 0.08 : -0.08));
        const pulley = new Mesh(new TorusGeometry(0.04, 0.012, 8, 20), steel);
        pulley.position.set(...e.anchor);
        place(col);
        group.add(pulley);
        for (const side of ['L', 'R'] as const) {
          if (e.hands && e.hands !== 'both' && e.hands !== side) continue;
          if (e.hands === 'both' && e.handle !== 'single' && side === 'R') continue;
          const geo = new BufferGeometry().setFromPoints([new Vector3(...e.anchor), new Vector3(...e.anchor)]);
          disposables.push(geo);
          const line = new Line(geo, cableMat);
          const handle = cyl(0.016, e.handle === 'bar' ? 0.5 : 0.13, rubber, 10);
          group.add(line, handle);
          updates.push(rig => {
            const hand = e.hands === 'both' && e.handle !== 'single' ? rig.grip('L').add(rig.grip('R')).multiplyScalar(0.5) : rig.grip(side);
            geo.setFromPoints([new Vector3(...e.anchor), hand]);
            orient(handle, hand, e.hands === 'both' && e.handle !== 'single' ? rig.grip('L').sub(rig.grip('R')) : rig.handAxis(side));
          });
        }
        break;
      }
      case 'handle': {
        // A short bar, or a rope with two falls, held in the hands.
        const len = e.length ?? 0.26;
        const grip = cyl(0.015, len, rubber, 10);
        group.add(grip);
        if (e.rope) {
          const geo = new BufferGeometry().setFromPoints([new Vector3(), new Vector3(), new Vector3()]);
          disposables.push(geo);
          const rope = new Line(geo, new LineBasicMaterial({ color: 0x3c3c3c }));
          group.add(rope);
          updates.push(rig => {
            const l = rig.grip('L'), r = rig.grip('R');
            const top = l.clone().add(r).multiplyScalar(0.5).add(new Vector3(0, 0.1, 0));
            geo.setFromPoints([l, top, r]);
          });
        }
        updates.push(rig => {
          if (e.hands === 'L' || e.hands === 'R') { orient(grip, rig.grip(e.hands), rig.handAxis(e.hands)); return; }
          const l = rig.grip('L'), r = rig.grip('R');
          orient(grip, l.clone().add(r).multiplyScalar(0.5), l.sub(r));
        });
        break;
      }
      case 'pad': {
        const size = e.size ?? [0.3, 0.1, 0.1];
        const m = { pad, frame: frameMat, steel }[e.material ?? 'pad'];
        const o = new Vector3(...(e.offset ?? [0, 0, 0]));
        const mesh = e.roller ? cyl(size[1] / 2, size[0], m, 16) : box(size[0], size[1], size[2], m);
        mesh.rotation.set(((e.pitch ?? 0) * Math.PI) / 180, ((e.yaw ?? 0) * Math.PI) / 180, e.roller ? Math.PI / 2 : 0, 'YXZ');
        group.add(mesh);
        const bones: Record<typeof e.follow, [string, string]> = {
          ankles: ['foot_l', 'foot_r'], knees: ['calf_l', 'calf_r'], thighs: ['thigh_l', 'thigh_r'],
          feet: ['ball_l', 'ball_r'], hands: ['hand_l', 'hand_r'],
        };
        const [bl, br] = bones[e.follow];
        updates.push(rig => {
          mesh.position.copy(rig.joint(bl)).add(rig.joint(br)).multiplyScalar(0.5).add(o);
        });
        break;
      }
      case 'kneePad': {
        const p = box(0.34, 0.07, 0.26, pad);
        group.add(p);
        updates.push(rig => {
          const l = rig.joint('calf_l'), r = rig.joint('calf_r');
          p.position.copy(l).add(r).multiplyScalar(0.5).add(new Vector3(0, 0.055, 0));
          p.quaternion.identity();
        });
        break;
      }
      case 'strap': {
        const geo = new BufferGeometry().setFromPoints([new Vector3(), new Vector3(), new Vector3()]);
        disposables.push(geo);
        const line = new Line(geo, new LineBasicMaterial({ color: 0x8a6f4d }));
        group.add(line);
        updates.push(rig => {
          const ball = rig.joint(e.foot === 'L' ? 'ball_l' : 'ball_r').clone();
          const sole = new Vector3(0, -0.03, 0).applyQuaternion(rig.A[rig.i(e.foot === 'L' ? 'foot_l' : 'foot_r')]).add(ball);
          geo.setFromPoints([rig.grip('L'), sole, rig.grip('R')]);
        });
        break;
      }
      case 'band': {
        const geo = new BufferGeometry().setFromPoints([new Vector3(), new Vector3()]);
        disposables.push(geo);
        const line = new Line(geo, bandMat);
        group.add(line);
        updates.push(rig => {
          if (e.between === 'knees') geo.setFromPoints([rig.joint('calf_l').clone(), rig.joint('calf_r').clone()]);
          else if (e.between === 'hands' || !e.anchor) geo.setFromPoints([rig.grip('L'), rig.grip('R')]);
          else geo.setFromPoints([new Vector3(...e.anchor), e.hands === 'R' ? rig.grip('R') : rig.grip('L')]);
        });
        break;
      }
      case 'treadmill': {
        const deck = box(0.75, 0.16, 1.9, pad);
        deck.position.set(0, 0.08, 0.05);
        const belt = box(0.55, 0.01, 1.8, rubber);
        belt.position.set(0, 0.165, 0.05);
        const g = new Group();
        g.add(deck, belt);
        for (const s of [-1, 1]) {
          const post = box(0.05, 1.05, 0.05, frameMat);
          post.position.set(s * 0.34, 0.6, 0.85);
          post.rotation.x = -0.15;
          g.add(post);
        }
        const consoleBox = box(0.72, 0.08, 0.3, frameMat);
        consoleBox.position.set(0, 1.12, 0.95);
        g.add(consoleBox);
        g.rotation.x = -((e.incline ?? 0) * Math.PI) / 180;
        place(g);
        break;
      }
      case 'bike': case 'rower': case 'elliptical': case 'machine': {
        // A simple frame suggesting the machine; the figure carries the detail.
        const g = new Group();
        const base = box(0.5, 0.06, 1.3, frameMat);
        base.position.y = 0.03;
        g.add(base);
        if (e.kind === 'bike') {
          const seat = box(0.22, 0.06, 0.28, pad);
          seat.position.set(0, e.recumbent ? 0.52 : 0.92, e.recumbent ? -0.45 : -0.2);
          const post = box(0.05, e.recumbent ? 0.48 : 0.88, 0.05, frameMat);
          post.position.set(0, (e.recumbent ? 0.48 : 0.88) / 2, seat.position.z);
          const crank = new Mesh(new TorusGeometry(0.17, 0.012, 8, 24), steel);
          crank.rotation.y = Math.PI / 2;
          crank.position.set(0, e.recumbent ? 0.42 : 0.32, e.recumbent ? 0.45 : 0.18);
          const bars = box(0.5, 0.04, 0.04, frameMat);
          bars.position.set(0, e.recumbent ? 0.62 : 1.1, e.recumbent ? -0.25 : 0.42);
          g.add(seat, post, crank, bars);
        } else if (e.kind === 'rower') {
          base.scale.set(0.5, 1, 1.9);
          const seat = box(0.3, 0.06, 0.3, pad);
          seat.position.set(0, 0.32, 0);
          const fly = cyl(0.25, 0.12, frameMat, 28);
          fly.rotation.z = Math.PI / 2;
          fly.position.set(0, 0.4, 1.1);
          g.add(seat, fly);
        } else if (e.kind === 'elliptical') {
          const mast = box(0.08, 1.3, 0.08, frameMat);
          mast.position.set(0, 0.65, 0.6);
          g.add(mast);
        }
        if ('pos' in e && e.pos) g.position.set(...e.pos);
        place(g);
        break;
      }
    }
  }

  return {
    group, bounds,
    update: (rig, pose) => updates.forEach(u => u(rig, pose)),
    dispose: () => {
      disposables.forEach(g => g.dispose());
      group.traverse(o => { if (o instanceof Mesh) o.geometry.dispose(); });
    },
  };
}
