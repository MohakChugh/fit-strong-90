/**
 * Loads the coach character built by scripts/character/build.mjs and turns it
 * into a three.js SkinnedMesh with a muscle-highlight material.
 */

import {
  Bone, BufferAttribute, BufferGeometry, Color, MeshStandardMaterial, Skeleton, SkinnedMesh, Uint8BufferAttribute,
} from 'three';
import type { BoneDef, MuscleName } from './types';

export interface CharacterData {
  sex: 'male' | 'female';
  bones: BoneDef[];
  muscles: string[];
  regions: string[];
  position: Float32Array;
  index: Uint16Array | Uint32Array;
  skinIndex: Uint8Array;
  skinWeight: Uint8Array;
  muscle: Uint8Array;
  region: Uint8Array;
  /** Per vertex [shoes, shorts, top] signed distances in metres (> 0 inside). */
  garment: Float32Array;
}

const TYPES = { Float32: Float32Array, Uint16: Uint16Array, Uint32: Uint32Array, Uint8: Uint8Array, Int16: Int16Array } as const;

export function parseCharacter(buf: ArrayBuffer): CharacterData {
  const magic = new TextDecoder().decode(new Uint8Array(buf, 0, 4));
  if (magic !== 'FSC1') throw new Error('not a coach character file');
  const len = new DataView(buf).getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, len)));
  const base = 8 + len;
  // Clips are authored for the 1.73 m male build (head joint top at 1.7361 m); scale other builds to match.
  const k = 1.7361 / Math.max(...(header.bones as BoneDef[]).map(b => Math.max(b.head[1], b.tail[1])));
  const arr = (name: string) => {
    const a = header.arrays[name] as { offset: number; type: keyof typeof TYPES; length: number };
    return new TYPES[a.type](buf, base + a.offset, a.length);
  };
  const position = Float32Array.from(arr('position') as Float32Array, v => v * k);
  const scale = (p: BoneDef['head']): BoneDef['head'] => [p[0] * k, p[1] * k, p[2] * k];
  const bones = (header.bones as BoneDef[]).map(b => ({ ...b, head: scale(b.head), tail: scale(b.tail) }));
  return {
    sex: header.sex, bones, muscles: header.muscles, regions: header.regions,
    position, index: arr('index') as Uint16Array, skinIndex: arr('skinIndex') as Uint8Array,
    skinWeight: arr('skinWeight') as Uint8Array, muscle: arr('muscle') as Uint8Array, region: arr('region') as Uint8Array,
    garment: Float32Array.from(arr('garment') as Int16Array, v => v * header.garmentScale),
  };
}

const cache = new Map<string, Promise<CharacterData>>();
export function loadCharacter(url: string): Promise<CharacterData> {
  let p = cache.get(url);
  if (!p) {
    p = fetch(url).then(r => { if (!r.ok) throw new Error(`${r.status} ${url}`); return r.arrayBuffer(); }).then(parseCharacter);
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

export interface Palette {
  skin: string;
  shorts: string;
  top: string;
  shoes: string;
  eyes: string;
  work: string;
  stretch: string;
  fault: string;
}

export const DEFAULT_PALETTE: Palette = {
  skin: '#d8b9a0', shorts: '#26303d', top: '#3c4d63', shoes: '#e9edf2', eyes: '#3a2f2a',
  work: '#ff6a3d', stretch: '#2fb6f0', fault: '#ef3b3b',
};

export interface CharacterMesh {
  mesh: SkinnedMesh;
  bones: Bone[];
  /** Per-muscle highlight: >0 working, <0 stretching, NaN-free, −1…1. Index by muscle id. */
  highlight: Float32Array;
  /** Per-muscle fault tint 0…1. */
  fault: Float32Array;
  muscleId: (m: MuscleName) => number;
  setPulse: (v: number) => void;
  dispose: () => void;
}

export function buildCharacter(data: CharacterData, palette: Palette = DEFAULT_PALETTE): CharacterMesh {
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(data.position, 3));
  geo.setIndex(new BufferAttribute(data.index, 1));
  geo.setAttribute('skinIndex', new Uint8BufferAttribute(data.skinIndex, 4));
  geo.setAttribute('skinWeight', new Uint8BufferAttribute(data.skinWeight, 4, true));
  geo.setAttribute('muscle', new BufferAttribute(new Float32Array(data.muscle), 1));
  geo.setAttribute('region', new BufferAttribute(new Float32Array(data.region), 1));
  geo.setAttribute('garment', new BufferAttribute(data.garment, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  const bones = data.bones.map(b => { const bone = new Bone(); bone.name = b.name; return bone; });
  data.bones.forEach((b, i) => {
    const p = b.parent >= 0 ? data.bones[b.parent].head : [0, 0, 0];
    bones[i].position.set(b.head[0] - p[0], b.head[1] - p[1], b.head[2] - p[2]);
    if (b.parent >= 0) bones[b.parent].add(bones[i]);
  });

  const n = data.muscles.length;
  const highlight = new Float32Array(n);
  const fault = new Float32Array(n);
  const regionColors = data.regions.map(r => new Color(palette[r as keyof Palette] ?? palette.skin));
  const uniforms = {
    uHighlight: { value: highlight },
    uFault: { value: fault },
    uRegion: { value: regionColors },
    uWork: { value: new Color(palette.work) },
    uStretch: { value: new Color(palette.stretch) },
    uFaultColor: { value: new Color(palette.fault) },
    uPulse: { value: 0 },
  };
  const material = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0.0 });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute float muscle;
attribute float region;
attribute vec3 garment;
uniform float uHighlight[${n}];
uniform float uFault[${n}];
varying float vHi;
varying float vFault;
varying float vEye;
varying vec3 vGarment;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
int mi = int(muscle + 0.5);
vHi = uHighlight[mi];
vFault = uFault[mi];
vEye = region > 3.5 ? 1.0 : 0.0;
vGarment = garment;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec3 uWork;
uniform vec3 uStretch;
uniform vec3 uFaultColor;
uniform float uPulse;
uniform vec3 uRegion[${data.regions.length}];
varying float vHi;
varying float vFault;
varying float vEye;
varying vec3 vGarment;
float inside(float d) { float w = max(fwidth(d), 1e-4); return smoothstep(-w, w, d); }`)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `vec3 base = uRegion[0];
base = mix(base, uRegion[2], inside(vGarment.z));
base = mix(base, uRegion[1], inside(vGarment.y));
base = mix(base, uRegion[3], inside(vGarment.x));
base = mix(base, uRegion[4], vEye);
vec3 hiColor = vHi >= 0.0 ? uWork : uStretch;
float hi = clamp(abs(vHi), 0.0, 1.0) * (0.78 + 0.22 * uPulse);
base = mix(base, hiColor, hi * 0.7);
base = mix(base, uFaultColor, clamp(vFault, 0.0, 1.0) * (0.7 + 0.3 * uPulse));
vec4 diffuseColor = vec4( base, opacity );`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += hiColor * hi * 0.16 + uFaultColor * clamp(vFault, 0.0, 1.0) * 0.18;`);
  };

  const mesh = new SkinnedMesh(geo, material);
  mesh.add(bones[0]);
  bones[0].updateMatrixWorld(true);
  mesh.bind(new Skeleton(bones));
  mesh.castShadow = true;
  mesh.frustumCulled = false;

  const ids = Object.fromEntries(data.muscles.map((m, i) => [m, i]));
  return {
    mesh, bones, highlight, fault,
    muscleId: m => ids[m] ?? 0,
    setPulse: v => { uniforms.uPulse.value = v; },
    dispose: () => { geo.dispose(); material.dispose(); },
  };
}
