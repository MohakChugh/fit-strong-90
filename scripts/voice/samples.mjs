// Render a short coaching passage in several Kokoro voices for comparison.
import { KokoroTTS } from 'kokoro-js';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import ffmpeg from 'ffmpeg-static';

const OUT = 'public/voice/samples';
const VOICES = (process.argv[2] ?? 'af_heart,af_nicole,af_bella,bf_emma').split(',');
const SPEED = Number(process.argv[3] ?? 0.82);
const LINES = [
  'Next, a figure four stretch for the deep muscles of your hip.',
  'Lie on your back, knees bent. Cross your left ankle over your right knee, and let the knee fall open.',
  'Breathe in through your nose for four. And out slowly for six, letting the stretch soften.',
  'You should feel this deep in the buttock. If anything tingles down your leg, ease off.',
];
const GAP_S = 0.75; // matches the app's pause between sentences

const t0 = Date.now();
const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'fp32', device: 'cpu' });
console.log('model loaded in', ((Date.now() - t0) / 1000).toFixed(1), 's');
fs.mkdirSync(OUT, { recursive: true });
for (const voice of VOICES) {
  const t = Date.now();
  const parts = [];
  for (const line of LINES) {
    const audio = await tts.generate(line, { voice, speed: SPEED });
    parts.push(audio.audio, new Float32Array(Math.round(audio.sampling_rate * GAP_S)));
  }
  const total = parts.reduce((n, p) => n + p.length, 0);
  const pcm = new Float32Array(total);
  let o = 0;
  for (const p of parts) { pcm.set(p, o); o += p.length; }
  const raw = `/tmp/sample-${voice}.f32`;
  fs.writeFileSync(raw, Buffer.from(pcm.buffer));
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'f32le', '-ar', '24000', '-ac', '1', '-i', raw, '-c:a', 'aac', '-b:a', '64k', `${OUT}/${voice}.m4a`]);
  console.log(voice, ((Date.now() - t) / 1000).toFixed(1), 's render,', (total / 24000).toFixed(1), 's audio');
}
