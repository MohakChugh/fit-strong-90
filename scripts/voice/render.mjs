#!/usr/bin/env node
/**
 * Render the coach's voice pack with Kokoro-82M (Apache-2.0), locally.
 *
 *   npx tsx --tsconfig tsconfig.app.json scripts/voice/catalog.ts   # 1. list every spoken sentence
 *   node scripts/voice/render.mjs --voice=af_heart --speed=0.82      # 2. render (incremental)
 *
 * Output: public/voice/<voice>/<key>.m4a (AAC, mono, 24 kHz) + manifest.json
 * with each clip's duration, so the app can schedule speech exactly.
 * Only changed or new sentences are rendered on later runs.
 */
import { KokoroTTS } from 'kokoro-js';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ffmpeg from 'ffmpeg-static';

const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const VOICE = args.voice ?? 'af_heart';
const SPEED = Number(args.speed ?? 0.82);
const BITRATE = args.bitrate ?? '40k';
const OUT = path.join('public/voice', VOICE);
const SR = 24000;

import { clipKey } from './key.mjs';

/** Trim leading/trailing near-silence, keeping a soft 60 ms edge. */
function trim(pcm) {
  const thr = 0.006;
  let a = 0, b = pcm.length - 1;
  while (a < b && Math.abs(pcm[a]) < thr) a++;
  while (b > a && Math.abs(pcm[b]) < thr) b--;
  const pad = Math.round(SR * 0.06);
  return pcm.subarray(Math.max(0, a - pad), Math.min(pcm.length, b + pad));
}

/** Words Kokoro reads awkwardly, spelled the way they are said. */
const SAY = [
  [/\bmg\/dL\b/g, 'milligrams per decilitre'],
  [/\bmmol\/L\b/g, 'millimoles'],
  [/\b90\/90\b/g, 'ninety ninety'],
  [/\bfigure-4\b/gi, 'figure four'],
  [/\bRDL\b/g, 'Romanian deadlift'],
];
const speakable = t => SAY.reduce((s, [re, to]) => s.replace(re, to), t);

const lines = JSON.parse(fs.readFileSync('scripts/voice/lines.json', 'utf8'));
fs.mkdirSync(OUT, { recursive: true });
const manifestPath = path.join(OUT, 'manifest.json');
const manifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  : { voice: VOICE, engine: 'kokoro-82m', speed: SPEED, format: 'm4a', lines: {} };
if (manifest.speed !== SPEED) { manifest.lines = {}; manifest.speed = SPEED; }

const todo = lines.filter(l => !manifest.lines[clipKey(l)] || !fs.existsSync(path.join(OUT, `${clipKey(l)}.m4a`)));
console.log(`${lines.length} lines, ${todo.length} to render with ${VOICE} at speed ${SPEED}`);
if (todo.length === 0) { finish(); process.exit(0); }

const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'fp32', device: 'cpu' });
const t0 = Date.now();
// A render can hang under heavy CPU contention (it blocks the event loop, so no
// in-process timer helps); scripts/voice/render-all.sh restarts stalled runs.
let audioSeconds = 0;
for (const [i, line] of todo.entries()) {
  const key = clipKey(line);
  const out = await tts.generate(speakable(line), { voice: VOICE, speed: SPEED });
  const pcm = trim(out.audio);
  const enc = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'f32le', '-ar', String(SR), '-ac', '1', '-i', 'pipe:0',
    '-c:a', 'aac', '-b:a', BITRATE, '-movflags', '+faststart', path.join(OUT, `${key}.m4a`)], { input: Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength), timeout: 30_000 });
  if (enc.status !== 0) { console.error('ffmpeg failed for', line, enc.stderr?.toString()); continue; }
  manifest.lines[key] = Math.round((pcm.length / SR) * 1000);
  audioSeconds += pcm.length / SR;
  if (i % 10 === 0 || i === todo.length - 1) {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    const el = (Date.now() - t0) / 1000;
    console.log(`${i + 1}/${todo.length} · ${Math.round(audioSeconds)} s audio · ${el.toFixed(0)} s elapsed · ETA ${Math.round((el / (i + 1)) * (todo.length - i - 1))} s`);
  }
}
finish();
console.log('done');

/** Drop clips no longer spoken, save the manifest and list the rendered packs for the app. */
function finish() {
  const keep = new Set(lines.map(clipKey));
  for (const f of fs.readdirSync(OUT)) if (f.endsWith('.m4a') && !keep.has(f.slice(0, -4))) fs.unlinkSync(path.join(OUT, f));
  for (const k of Object.keys(manifest.lines)) if (!keep.has(k)) delete manifest.lines[k];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  const packs = fs.readdirSync('public/voice').filter(d => fs.existsSync(path.join('public/voice', d, 'manifest.json'))).sort();
  fs.writeFileSync('public/voice/index.json', JSON.stringify({ packs }));
  const words = lines.reduce((t, l) => t + (manifest.lines[clipKey(l)] ? l.split(/\s+/).length : 0), 0);
  const ms = Object.values(manifest.lines).reduce((t, d) => t + d, 0);
  console.log(`${VOICE}: ${Object.keys(manifest.lines).length} clips, ${Math.round(words / (ms / 60000))} words per minute`);
}
