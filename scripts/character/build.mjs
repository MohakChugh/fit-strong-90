#!/usr/bin/env node
/**
 * Build the coach character from MakeHuman / MPFB2 assets, which are CC0 1.0
 * (base mesh, macro targets, the 53-bone "game_engine" rig and its weights;
 * see https://github.com/makehumancommunity/mpfb2/blob/master/LICENSE.md §C).
 * No Blender needed: shaping, joint placement and skin weights are done here.
 *
 *   node scripts/character/build.mjs --sex=male     # → public/models/coach-male.bin
 *   node scripts/character/build.mjs --sex=female   # → public/models/coach-female.bin
 *
 * Downloads are cached in scripts/character/.cache (git-ignored).
 *
 * File layout (little-endian): "FSC1", u32 header length, header JSON, padding
 * to 4 bytes, then the arrays listed in header.arrays at their byte offsets.
 * Units are metres, Y up, the figure faces +Z, its left side is +X, feet at y = 0.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const SEX = args.sex === 'female' ? 'female' : 'male';
const CACHE = 'scripts/character/.cache';
const OUT = `public/models/coach-${SEX}.bin`;
const SRC = 'https://raw.githubusercontent.com/makehumancommunity/mpfb2/master/src/mpfb/data';

/** MakeHuman macro sliders (0–1): a young, lean, athletic build. */
const SHAPE = { male: { muscle: 0.74, weight: 0.4, proportions: 1 }, female: { muscle: 0.66, weight: 0.4, proportions: 1 } }[SEX];

async function cached(rel) {
  const file = path.join(CACHE, path.basename(rel));
  if (!fs.existsSync(file)) {
    const res = await fetch(`${SRC}/${rel}`);
    if (!res.ok) throw new Error(`${res.status} for ${rel}`);
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return file;
}
const json = async rel => JSON.parse(fs.readFileSync(await cached(rel), 'utf8'));

// ---------------------------------------------------------------- base mesh
const objText = fs.readFileSync(await cached('3dobjs/base.obj'), 'utf8');
const V = [];
const faces = []; // [group, [v...]]
let group = '';
for (const line of objText.split('\n')) {
  if (line.startsWith('v ')) V.push(line.split(/\s+/).slice(1, 4).map(Number));
  else if (line.startsWith('g ')) group = line.slice(2).trim();
  else if (line.startsWith('f ')) faces.push([group, line.trim().split(/\s+/).slice(1).map(t => Number(t.split('/')[0]) - 1)]);
}
const groups = await json('mesh_metadata/basemesh_vertex_groups.json');
const groupVerts = name => groups[name].flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i));

// ---------------------------------------------------------------- shape targets
/** Linear blend weights for one macro slider: [lowName, highName, lowEnd, highEnd]. */
function blend(value, parts) {
  for (const [lo, hi, a, b] of parts) if (value >= a && value <= b) {
    const t = (value - a) / (b - a);
    return { [lo]: 1 - t, [hi]: t };
  }
  throw new Error(`no part for ${value}`);
}
const muscle = blend(SHAPE.muscle, [['minmuscle', 'averagemuscle', 0, 0.5], ['averagemuscle', 'maxmuscle', 0.5, 1]]);
const weight = blend(SHAPE.weight, [['minweight', 'averageweight', 0, 0.5], ['averageweight', 'maxweight', 0.5, 1]]);
const ideal = Math.max(0, (SHAPE.proportions - 0.5) / 0.5);

const targets = [];
for (const [m, wm] of Object.entries(muscle)) for (const [w, ww] of Object.entries(weight)) {
  if (wm * ww < 1e-4) continue;
  // The average/average universal target is the base mesh itself, so there is no file for it.
  if (m !== 'averagemuscle' || w !== 'averageweight') targets.push([`macrodetails/universal-${SEX}-young-${m}-${w}.target.gz`, wm * ww]);
  if (ideal > 0) targets.push([`macrodetails/proportions/${SEX}-young-${m}-${w}-idealproportions.target.gz`, wm * ww * ideal]);
}
for (const race of ['caucasian', 'african', 'asian']) targets.push([`macrodetails/${race}-${SEX}-young.target.gz`, 1 / 3]);

for (const [rel, w] of targets) {
  let text;
  try { text = zlib.gunzipSync(fs.readFileSync(await cached(rel))).toString('utf8'); }
  catch (e) { console.warn(`skip ${rel}: ${e.message}`); continue; }
  for (const line of text.split('\n')) {
    const p = line.trim().split(/\s+/);
    if (p.length !== 4 || line.startsWith('#')) continue;
    const v = V[Number(p[0])];
    v[0] += w * Number(p[1]); v[1] += w * Number(p[2]); v[2] += w * Number(p[3]);
  }
}

// ---------------------------------------------------------------- skeleton
const rig = await json('rigs/standard/rig.game_engine.json');
const mean = idx => idx.reduce((s, i) => [s[0] + V[i][0], s[1] + V[i][1], s[2] + V[i][2]], [0, 0, 0]).map(c => c / idx.length);
const locate = spec => spec.strategy === 'CUBE' ? mean(groupVerts(spec.cube_name))
  : spec.strategy === 'MEAN' ? mean(spec.vertex_indices)
    : spec.strategy === 'VERTEX' ? V[spec.vertex_index].slice()
      : (() => { throw new Error(`strategy ${spec.strategy}`); })();
const groundY = mean(groupVerts('joint-ground'))[1];
const toMetres = p => [p[0] * 0.1, (p[1] - groundY) * 0.1, p[2] * 0.1];

const order = [];
const visit = name => { if (order.includes(name)) return; if (rig[name].parent) visit(rig[name].parent); order.push(name); };
Object.keys(rig).forEach(visit);
const bones = order.map(name => ({
  name, parent: rig[name].parent ? order.indexOf(rig[name].parent) : -1,
  head: toMetres(locate(rig[name].head)).map(r4), tail: toMetres(locate(rig[name].tail)).map(r4),
}));
function r4(x) { return Math.round(x * 1e4) / 1e4; }

// ---------------------------------------------------------------- geometry
const KEEP = new Set(['body', 'helper-l-eye', 'helper-r-eye']);
const used = new Map(); // old vertex → new
const tris = [];
for (const [g, f] of faces) {
  if (!KEEP.has(g)) continue;
  const ids = f.map(v => { if (!used.has(v)) used.set(v, used.size); return used.get(v); });
  for (let i = 1; i + 1 < ids.length; i++) tris.push(ids[0], ids[i], ids[i + 1]);
}
const n = used.size;
const oldOf = new Array(n);
used.forEach((nu, old) => { oldOf[nu] = old; });
const position = new Float32Array(n * 3);
oldOf.forEach((old, i) => position.set(toMetres(V[old]), i * 3));

// ---------------------------------------------------------------- skin weights (top 4)
const W = (await json('rigs/standard/weights.game_engine.json')).weights;
const perVertex = Array.from({ length: n }, () => []);
for (const [bone, list] of Object.entries(W)) {
  const b = order.indexOf(bone);
  for (const [old, w] of list) { const i = used.get(old); if (i !== undefined && w > 0.01) perVertex[i].push([b, w]); }
}
const skinIndex = new Uint8Array(n * 4);
const skinWeight = new Uint8Array(n * 4);
const headIdx = order.indexOf('head');
perVertex.forEach((list, i) => {
  if (list.length === 0) list.push([headIdx, 1]);
  list.sort((a, b) => b[1] - a[1]);
  const top = list.slice(0, 4);
  const sum = top.reduce((s, [, w]) => s + w, 0);
  let left = 255;
  top.forEach(([b, w], k) => {
    const q = k === top.length - 1 ? left : Math.round((w / sum) * 255);
    skinIndex[i * 4 + k] = b; skinWeight[i * 4 + k] = q; left -= q;
  });
});

// ---------------------------------------------------------------- muscle map and clothing
export const MUSCLES = ['none', 'neck', 'traps', 'deltsFront', 'deltsSide', 'deltsRear', 'chest', 'biceps', 'triceps', 'forearms',
  'abs', 'obliques', 'lats', 'upperBack', 'lowerBack', 'glutes', 'gluteMed', 'hipFlexors', 'quads', 'hamstrings',
  'adductors', 'calves', 'shins', 'feet', 'hands'];
const M = Object.fromEntries(MUSCLES.map((m, i) => [m, i]));
const REGIONS = ['skin', 'shorts', 'top', 'shoes', 'eyes'];
const R = Object.fromEntries(REGIONS.map((r, i) => [r, i]));

const byName = Object.fromEntries(bones.map(b => [b.name, b]));
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** Where a vertex sits relative to a bone: s along it (0 head → 1 tail) and the radial offset. */
function frame(p, bone) {
  const ax = sub(bone.tail, bone.head);
  const len2 = dot(ax, ax);
  const d = sub(p, bone.head);
  const s = dot(d, ax) / len2;
  const o = [d[0] - s * ax[0], d[1] - s * ax[1], d[2] - s * ax[2]];
  return { s, o, r: Math.hypot(...o) || 1e-6 };
}
const waistY = byName.pelvis.head[1] + 0.055;
const muscleId = new Uint8Array(n);
const region = new Uint8Array(n);
const garment = new Int16Array(n * 3);
const eyeVerts = new Set([...groupVerts('helper-l-eye'), ...groupVerts('helper-r-eye')]);
const boneIdx = Object.fromEntries(bones.map((b, i) => [b.name, i]));
/** Total skin weight a vertex gives to bones whose names start with one of `prefixes`. */
function weightOf(i, prefixes) {
  let w = 0;
  for (let k = 0; k < 4; k++) if (prefixes.some(p => bones[skinIndex[i * 4 + k]].name.startsWith(p))) w += skinWeight[i * 4 + k] / 255;
  return w;
}
const neck = byName.neck_01.head;

for (let i = 0; i < n; i++) {
  const p = [position[i * 3], position[i * 3 + 1], position[i * 3 + 2]];
  if (eyeVerts.has(oldOf[i])) { region[i] = R.eyes; continue; }
  const bone = bones[skinIndex[i * 4]];
  const side = bone.name.endsWith('_l') ? 1 : bone.name.endsWith('_r') ? -1 : Math.sign(p[0]) || 1;
  const base = bone.name.replace(/_[lr]$/, '');
  const { s, o, r } = frame(p, bone);
  const front = o[2] / r;          // +1 facing forward
  const out = (o[0] * side) / r;   // +1 facing away from the midline
  const ax = Math.abs(p[0]);
  let m = M.none;
  switch (base) {
    case 'neck_01': m = front < -0.2 && s < 0.45 ? M.traps : M.neck; break;
    case 'clavicle':
      m = s > 0.72 ? (front > 0.35 ? M.deltsFront : front < -0.35 ? M.deltsRear : M.deltsSide) : front > 0.15 ? M.chest : M.traps;
      break;
    case 'upperarm':
      m = s < 0.3 ? (front > 0.4 ? M.deltsFront : front < -0.4 ? M.deltsRear : M.deltsSide) : front >= 0 ? M.biceps : M.triceps;
      break;
    case 'lowerarm': m = M.forearms; break;
    case 'spine_03': m = front > 0.2 ? M.chest : front < -0.2 ? (ax < 0.06 ? M.upperBack : M.lats) : M.lats; break;
    case 'spine_02':
      m = front > 0.25 ? (ax < 0.075 ? M.abs : M.obliques) : front < -0.25 ? (ax < 0.055 ? (s < 0.5 ? M.lowerBack : M.upperBack) : M.lats) : M.obliques;
      break;
    case 'spine_01': m = front > 0.25 ? (ax < 0.075 ? M.abs : M.obliques) : front < -0.2 ? (ax < 0.08 ? M.lowerBack : M.obliques) : M.obliques; break;
    case 'pelvis':
      m = front < -0.1 ? (p[1] < byName.pelvis.head[1] + 0.02 ? M.glutes : M.lowerBack)
        : front > 0.3 ? (ax < 0.07 ? M.abs : M.hipFlexors) : (p[1] > byName.thigh_l.head[1] - 0.02 ? M.gluteMed : M.glutes);
      break;
    case 'thigh': m = front < -0.15 ? (s < 0.12 ? M.glutes : M.hamstrings) : out < -0.55 ? M.adductors : (out > 0.6 && s < 0.25 ? M.gluteMed : M.quads); break;
    case 'calf': m = front < -0.1 ? M.calves : out < -0.8 ? M.calves : M.shins; break;
    case 'foot': case 'ball': m = M.feet; break;
    default: if (/^(hand|thumb|index|middle|ring|pinky)/.test(base)) m = M.hands;
  }
  muscleId[i] = m;

  // Clothing as signed distance fields (metres, > 0 inside the garment). The
  // shader thresholds them per pixel, so hems are clean lines on any topology.
  const legS = frame(p, byName[side > 0 ? 'thigh_l' : 'thigh_r']).s;
  const thighLen = Math.hypot(...sub(byName.thigh_l.tail, byName.thigh_l.head));
  const ua = byName[side > 0 ? 'upperarm_l' : 'upperarm_r'];
  const armDir = sub(ua.tail, ua.head);
  const armLen = Math.hypot(...armDir);
  const armS = dot(sub(p, ua.head), armDir) / (armLen * armLen);
  const axisPt = [ua.head[0] + armS * armDir[0], ua.head[1] + armS * armDir[1], ua.head[2] + armS * armDir[2]];
  const armR = Math.hypot(...sub(p, axisPt));
  const frontSide = p[2] > neck[2] - 0.02;
  const neckline = neck[1] - 0.035 - (frontSide ? 0.05 * Math.max(0, 1 - (ax / 0.09) ** 2) : 0);
  const lowerArm = weightOf(i, ['lowerarm', 'hand', 'thumb', 'index', 'middle', 'ring', 'pinky']) > 0.3;
  const outsideArm = Math.max(armR - (armS < 0.15 ? 0.074 : 0.09), (-0.16 - armS) * armLen);
  const shoes = weightOf(i, ['foot', 'ball', 'calf']) > 0.5 ? 0.095 - p[1] : -1;
  const shorts = lowerArm || weightOf(i, ['upperarm']) > 0.5 ? -1 : Math.min(waistY - p[1], (0.38 - legS) * thighLen);
  const top = lowerArm || weightOf(i, ['head']) > 0.5 ? -1 : Math.min(p[1] - waistY, neckline - p[1], outsideArm);
  garment[i * 3] = Math.round(Math.max(-3, Math.min(3, shoes)) * 1e4);
  garment[i * 3 + 1] = Math.round(Math.max(-3, Math.min(3, shorts)) * 1e4);
  garment[i * 3 + 2] = Math.round(Math.max(-3, Math.min(3, top)) * 1e4);
}

// ---------------------------------------------------------------- write
const index = n < 65536 ? new Uint16Array(tris) : new Uint32Array(tris);
const arrays = { position, index, skinIndex, skinWeight, muscle: muscleId, region, garment };
const header = { version: 2, garmentScale: 1e-4, sex: SEX, source: 'MakeHuman/MPFB2 assets, CC0 1.0', vertexCount: n, bones, muscles: MUSCLES, regions: REGIONS, arrays: {} };
let offset = 0;
const chunks = [];
for (const [name, arr] of Object.entries(arrays)) {
  const pad = (4 - (offset % 4)) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad; }
  header.arrays[name] = { offset, type: arr.constructor.name.replace('Array', ''), length: arr.length };
  chunks.push(Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength));
  offset += arr.byteLength;
}
let headerBuf = Buffer.from(JSON.stringify(header));
headerBuf = Buffer.concat([headerBuf, Buffer.alloc((4 - ((8 + headerBuf.length) % 4)) % 4, 0x20)]);
const prefix = Buffer.alloc(8);
prefix.write('FSC1', 0, 'ascii');
prefix.writeUInt32LE(headerBuf.length, 4);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.concat([prefix, headerBuf, ...chunks]));

const hist = MUSCLES.map((m, k) => `${m}:${muscleId.filter(x => x === k).length}`).join(' ');
const height = Math.max(...Array.from({ length: n }, (_, i) => position[i * 3 + 1]));
console.log(`${OUT}: ${n} vertices, ${tris.length / 3} triangles, ${bones.length} bones, height ${height.toFixed(3)} m, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB (gzip ${(zlib.gzipSync(fs.readFileSync(OUT), { level: 9 }).length / 1024).toFixed(0)} KB)`);
console.log(hist);
