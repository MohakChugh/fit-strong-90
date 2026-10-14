#!/usr/bin/env node
/**
 * Builds docs/demo from a recorded acceptance run (README.md, "Re-recording"):
 * each chapter is a 2-second title card, then its recorded pages, with the
 * voice clips the run played mixed in where they played, and captioned; then
 * the full film and the GIF previews.
 *
 *   node docs/demo/assemble.mjs [raw dir]      (default /tmp/fit-checks/demo/raw)
 *
 * Needs ffmpeg with libx264 (FFMPEG, default /opt/homebrew/bin/ffmpeg) and the
 * acceptance suite's headless Chromium, which draws the cards and captions.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const RAW = path.resolve(process.argv[2] ?? '/tmp/fit-checks/demo/raw');
const FFMPEG = process.env.FFMPEG ?? '/opt/homebrew/bin/ffmpeg';
const FFPROBE = process.env.FFPROBE ?? FFMPEG.replace(/ffmpeg$/, 'ffprobe');
const W = 428;
const H = 926;
const FPS = 25;
const CARD_S = 2;
const PART_CARD_S = 1.5;
const CRF = Number(process.env.CRF ?? 24);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'fit-demo-'));

const ink = {
  tint: 'oklch(0.5 0.1 199)', stretch: 'oklch(0.46 0.09 190)', workout: 'oklch(0.5 0.14 45)', walk: 'oklch(0.45 0.12 150)',
  food: 'oklch(0.5 0.11 70)', caution: 'oklch(0.52 0.13 65)', weight: 'oklch(0.46 0.1 215)',
};

/**
 * The story, in order. A part is one recorded page: `from` cuts its start at
 * the first change of screen after a step starts (`step: 2`), else at its first
 * frame that isn't blank; `to` ends it `plus` seconds after a step starts,
 * else it runs to its end; a `card` names a part that changes place or
 * journey within a chapter.
 */
const CHAPTERS = [
  {
    file: '01-set-up-once', title: 'Set up once', accent: ink.tint, gif: { part: 0, anchor: 'step:2', offset: 0, seconds: 9.8, speed: 2.4 },
    look: 'A fresh phone: one question a page, a backup offered at Review, then Home.', persona: 'P02’s answers, on a fresh iPhone',
    parts: [
      { video: 'V-J37__large-light__main.webm', journey: 'V-J37' },
      { video: 'V-J37__large-light__main__2.webm', journey: 'V-J37', card: { title: 'Then the Home Screen app', look: 'Restore the backup on page 1, and setup carries on at Review.' } },
    ],
  },
  {
    file: '02-the-first-morning', title: 'The first morning', accent: ink.stretch,
    look: 'Right now suggests the stretch and says why; the check-in, the stretch, then 10 more minutes on Home.', persona: 'P01',
    parts: [{ video: 'VJ01__large-light__right-now-check-in-stretch-home.webm', journey: 'VJ01' }],
  },
  {
    file: '03-a-guided-workout', title: 'A guided workout', accent: ink.workout, gif: { part: 0, anchor: 'clip:0', offset: -4.5, seconds: 9.8, speed: 1 },
    look: 'Tap Start and the coach says “Welcome.” at once: the voice works first time, with no refresh.', persona: 'P01, with the voice coach on',
    parts: [{ video: 'VJ06__large-light__workout-tile-session-back-to-the-workout-hub.webm', journey: 'VJ06' }],
  },
  {
    file: '04-after-lunch', title: 'After lunch', accent: ink.walk, gif: { part: 0, anchor: 'step:3', offset: -1, seconds: 9.8, speed: 1 },
    look: 'Right now offers the walk after lunch at its time; the coach marks ten minutes; saved, and counted on Home.', persona: 'P03 (V-J02) and P02 (V33)',
    parts: [
      { video: 'V02__large-light__a-walk-after-lunch.webm', journey: 'V-J02' },
      { video: 'V33__large-light__three-breaks-of-three-kinds.webm', journey: 'V33', to: { step: 2, plus: 1 }, card: { title: 'A first walk with GPS on', look: 'It asks before it starts: keep a record of your route on this phone (Yes), and map pictures under saved routes (No).' } },
    ],
  },
  {
    file: '05-a-usual-lunch-and-a-food', title: 'Log a usual lunch', accent: ink.food,
    look: '“Same as yesterday’s lunch”, saved in three taps, with no figures: Food and Today’s log count it.', persona: 'P01',
    parts: [
      { video: 'V-J03__large-light__usual-lunch.webm', journey: 'V-J03', from: { step: 2 } },
      { video: 'V-J08__large-light__chapatti-finds-the-food-and-the-guide-card.webm', journey: 'V-J08', card: { title: 'Look up a food', look: 'Browse finds “chapatti”: the food to eat and the Guide card, once allergies are answered.' } },
    ],
  },
  {
    file: '06-a-low', title: 'A low', accent: ink.caution, gif: { part: 0, anchor: 'start', offset: 0, seconds: 9.8, speed: 1 },
    look: 'Glucose 62: “This is a low. Treat it now.” Then Home, and every movement tile, waits for the re-check.', persona: 'P03, on a sulfonylurea',
    parts: [{ video: 'VJ04__large-light__glucose-62-at-9-00-am.webm', journey: 'VJ04' }],
  },
  {
    file: '07-see-my-week', title: 'See my week', accent: ink.walk,
    look: 'Your week in words, then Steps against last week, a day at a time, as a chart and as a list.', persona: 'P02, a fortnight of steps',
    parts: [{ video: 'VJ07__large-light__trends-your-week-steps-week-against-last-week-back.webm', journey: 'VJ07', from: { step: 2 } }],
  },
  {
    file: '08-customise-home', title: 'Customise Home', accent: ink.tint,
    look: 'Hide Sleep, add Water and Labs, move Water up: Home keeps it over a reload, and Labs opens its hub.', persona: 'P02',
    parts: [{ video: 'VJ12__large-light__hide-add-move-up-add-done.webm', journey: 'VJ12' }],
  },
  {
    file: '09-back-up-restore-and-undo', title: 'Back up and restore', accent: ink.weight,
    look: 'A backup made in Me → Data, then restored on a new phone from setup’s page 1, straight to Home.', persona: 'P01',
    parts: [
      { video: 'V-J11__large-light__finished-record.webm', journey: 'V-J11' },
      { video: 'V-J11__large-light__finished-record__2.webm', journey: 'V-J11', card: { title: 'A new phone', look: 'Restore from a backup on page 1: a preview of the file, then Home.' } },
      { video: 'V-J32__large-light__water-250-ml-twice-both-entries-deleted-one-undone-one-resto.webm', journey: 'V-J32', card: { title: 'Two deletes, Undo, Recently deleted', look: 'Both Undos stay; one brings its water back; Recently deleted restores the other.' } },
    ],
  },
];

// ---------------------------------------------------------------- tools

const run = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 });
const ffmpeg = args => run(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
const duration = file => Number(run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim());
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** The log the harness wrote beside a video, and this video's entry in it. */
function logOf(video) {
  for (const f of fs.readdirSync(RAW).filter(f => f.endsWith('.clips.json'))) {
    const log = JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));
    const entry = log.videos.find(v => v.file === video);
    if (entry) return { log, entry };
  }
  throw new Error(`no log names ${video} in ${RAW}`);
}

/** Small grey frames from `at` for `seconds`, to find where a screen starts. */
function frames(file, at, seconds) {
  const [w, h] = [16, 35];
  const raw = ffmpeg(['-ss', at.toFixed(3), '-t', String(seconds), '-i', file, '-vf', `scale=${w}:${h},format=gray`, '-f', 'rawvideo', '-']);
  return Array.from({ length: Math.floor(raw.length / (w * h)) }, (_, i) => raw.subarray(i * w * h, (i + 1) * w * h));
}

/** The first frame that isn't blank white (the page before the app draws), in seconds. */
function firstDrawn(file) {
  const i = frames(file, 0, 4).findIndex(f => f.some(px => px < 200));
  return Math.max(0, i) / FPS;
}

/** The first frame after `at` where the screen has changed from the one shown at `at`. */
function firstChange(file, at) {
  const shots = frames(file, at, 4);
  const diff = (a, b) => a.reduce((n, px, k) => n + Math.abs(px - b[k]), 0) / a.length;
  const i = shots.findIndex(f => diff(f, shots[0]) > 6);
  return at + Math.max(0, i) / FPS;
}

// ---------------------------------------------------------------- cards and captions

const CARD_CSS = `
  html, body { margin: 0; width: ${W}px; height: ${H}px; background: oklch(0.967 0.002 247); color: oklch(0.145 0 0);
    font-family: -apple-system, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  main { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; padding: 0 22px 40px; }
  .bar { width: 44px; height: 6px; border-radius: 3px; margin: 0 4px 18px; }
  .kicker { font-size: 13px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: oklch(0.52 0 0); margin: 0 4px 8px; }
  h1 { font-size: 34px; line-height: 1.12; font-weight: 700; letter-spacing: -.02em; margin: 0 4px 22px; }
  .card { background: #fff; border-radius: 16px; padding: 16px 18px 18px; }
  .label { font-size: 13px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 6px; }
  .card p { font-size: 17px; line-height: 1.42; margin: 0; }
  .foot { font-size: 13px; line-height: 1.45; color: oklch(0.52 0 0); margin: 18px 4px 0; }`;

const cardHtml = ({ kicker, title, look, foot, accent }) => `<!doctype html><meta charset="utf-8"><style>${CARD_CSS}</style>
  <main><div class="bar" style="background:${accent}"></div><div class="kicker">${esc(kicker)}</div><h1>${esc(title)}</h1>
  <div class="card"><div class="label" style="color:${accent}">What to look for</div><p>${esc(look)}</p></div>
  ${foot ? `<p class="foot">${foot}</p>` : ''}</main>`;

const CAPTION_CSS = `html, body { margin: 0; width: ${W}px; height: ${H}px; background: transparent; font-family: -apple-system, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  .pill { position: absolute; left: 50%; top: 640px; transform: translateX(-50%); max-width: 360px; display: flex; gap: 10px; align-items: center;
    background: rgba(10, 10, 10, .84); color: #fff; border-radius: 999px; padding: 11px 18px; font-size: 15px; line-height: 1.3; font-weight: 600; white-space: nowrap; }
  svg { flex: none; }`;
const SPEAKER = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>';
const captionHtml = line => `<!doctype html><meta charset="utf-8"><style>${CAPTION_CSS}</style><div class="pill">${SPEAKER}<span>Voice coach: “${esc(line)}”</span></div>`;

/** Draw every card and caption: PNGs at the film's size, captions on a transparent ground. */
async function draw(pages) {
  const { launch } = await import(pathToFileURL(path.join(REPO, 'scripts/e2e/acceptance/lib/env.mjs')).href);
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  for (const { html, file, transparent } of pages) {
    await page.setContent(html);
    await page.screenshot({ path: file, omitBackground: !!transparent });
  }
  await browser.close();
}

// ---------------------------------------------------------------- the voice

const { clipKey } = await import(pathToFileURL(path.join(REPO, 'scripts/voice/key.mjs')).href);
const LINES = new Map(JSON.parse(fs.readFileSync(path.join(REPO, 'scripts/voice/lines.json'), 'utf8')).map(s => [clipKey(s), s]));

/**
 * The clips a part plays, in its own time (s): each from its play to its end,
 * or to the moment the same element stopped or moved to another clip.
 */
function clipsOf(entry, from, length) {
  const events = entry.clips;
  const out = [];
  for (const [i, e] of events.entries()) {
    if (e.kind !== 'play' || !e.file) continue;
    const file = path.join(REPO, e.file);
    if (!fs.existsSync(file)) { console.warn(`  no clip file ${e.file}`); continue; }
    const next = events.slice(i + 1).find(x => x.element === e.element);
    const start = e.at / 1000 - from;
    const full = duration(file);
    const len = Math.min(full, next ? next.at / 1000 - from - start : full, length - start);
    if (start < 0 || len <= 0.05) continue;
    const key = path.basename(file, path.extname(file));
    out.push({ file, start, len, cut: len < full - 0.05, line: LINES.get(key) ?? '' });
  }
  return out;
}

// ---------------------------------------------------------------- build

const OUT = HERE;
const cards = [];
const plan = [];
for (const [ci, ch] of CHAPTERS.entries()) {
  const kicker = `FitStrong v2 · Chapter ${ci + 1} of ${CHAPTERS.length}`;
  const journeys = [...new Set(ch.parts.map(p => p.journey))];
  const foot = `Acceptance ${journeys.length > 1 ? 'journeys' : 'journey'} ${journeys.join(' and ')} · synthetic persona ${esc(ch.persona)}<br>Large light, 428 × 926, slowed for viewing`;
  const segments = [];
  const titleCard = path.join(TMP, `${ch.file}-card.png`);
  cards.push({ html: cardHtml({ kicker, title: ch.title, look: ch.look, foot, accent: ch.accent }), file: titleCard });
  segments.push({ kind: 'card', file: titleCard, length: CARD_S });
  for (const [pi, part] of ch.parts.entries()) {
    if (part.card) {
      const file = path.join(TMP, `${ch.file}-part${pi + 1}.png`);
      cards.push({ html: cardHtml({ kicker: `Chapter ${ci + 1} · part ${pi + 1}`, title: part.card.title, look: part.card.look, accent: ch.accent }), file });
      segments.push({ kind: 'card', file, length: PART_CARD_S });
    }
    const video = path.join(RAW, part.video);
    const { log, entry } = logOf(part.video);
    if (log.status !== 'pass') throw new Error(`${part.video}: its case did not pass (${log.status}); re-record it`);
    const stepAt = n => {
      const s = entry.steps.find(x => x.step === n);
      if (!s) throw new Error(`${part.video} has no step ${n}`);
      return s.at / 1000;
    };
    const from = part.from?.step ? firstChange(video, stepAt(part.from.step)) : firstDrawn(video);
    const length = (part.to ? stepAt(part.to.step) + (part.to.plus ?? 0) : duration(video)) - from;
    const clips = clipsOf(entry, from, length);
    for (const [k, c] of clips.entries()) {
      if (!c.line) continue;
      c.caption = path.join(TMP, `${ch.file}-p${pi}-c${k}.png`);
      cards.push({ html: captionHtml(c.line), file: c.caption, transparent: true });
    }
    segments.push({ kind: 'video', file: video, from, length, clips, stepAt });
  }
  plan.push({ ch, segments });
}
await draw(cards);

/** One chapter: cards and parts, each part's clips mixed onto silence and captioned, encoded once. */
function encode({ ch, segments }) {
  const args = [];
  const filters = [];
  const labels = [];
  let input = 0;
  for (const [si, s] of segments.entries()) {
    if (s.kind === 'card') {
      args.push('-loop', '1', '-framerate', String(FPS), '-t', String(s.length), '-i', s.file);
      filters.push(`[${input}:v]fps=${FPS},format=yuv420p,setsar=1[v${si}]`, `anullsrc=r=48000:cl=mono,atrim=0:${s.length}[a${si}]`);
      input++;
    } else {
      const v = input++;
      args.push('-i', s.file);
      let chain = `[${v}:v]trim=start=${s.from.toFixed(3)}:duration=${s.length.toFixed(3)},setpts=PTS-STARTPTS,fps=${FPS},pad=ceil(iw/2)*2:ceil(ih/2)*2,format=yuv420p,setsar=1`;
      // A touch shorter than its video: concat pads short audio with silence, so sound never runs ahead of picture.
      const mix = [`anullsrc=r=48000:cl=mono,atrim=0:${(s.length - 0.1).toFixed(3)}[base${si}]`];
      const parts = [`[base${si}]`];
      for (const [k, c] of s.clips.entries()) {
        const a = input++;
        args.push('-i', c.file);
        const fade = c.cut ? `,afade=t=out:st=${Math.max(0, c.len - 0.04).toFixed(3)}:d=0.04` : '';
        // The packs peak near -7 dBFS: 5 dB up for a film watched on a laptop.
        mix.push(`[${a}:a]aresample=48000,aformat=channel_layouts=mono,atrim=0:${c.len.toFixed(3)}${fade},volume=5dB,adelay=${Math.round(c.start * 1000)}:all=1[c${si}_${k}]`);
        parts.push(`[c${si}_${k}]`);
        if (!c.caption) continue;
        const img = input++;
        args.push('-i', c.caption);
        // Shown while the line plays, for at least a second and a half so it can be read.
        const end = Math.min(s.length, c.start + Math.max(c.len + 0.3, 1.6));
        filters.push(`${chain}[pre${si}_${k}]`);
        chain = `[pre${si}_${k}][${img}:v]overlay=0:0:enable='between(t,${c.start.toFixed(3)},${end.toFixed(3)})'`;
      }
      filters.push(`${chain}[v${si}]`);
      mix.push(`${parts.join('')}amix=inputs=${parts.length}:normalize=0:duration=first[a${si}]`);
      filters.push(...mix);
    }
    labels.push(`[v${si}][a${si}]`);
  }
  filters.push(`${labels.join('')}concat=n=${segments.length}:v=1:a=1[v][a]`);
  const out = path.join(OUT, `${ch.file}.mp4`);
  ffmpeg([...args, '-filter_complex', filters.join(';'), '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(CRF), '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '96k', '-ar', '48000', '-ac', '1', '-movflags', '+faststart', out]);
  return out;
}

/** Where a GIF starts in its chapter's film, in seconds. */
function gifStart({ segments }, gif) {
  let t = 0;
  let seen = -1;
  for (const s of segments) {
    if (s.kind === 'video' && ++seen === gif.part) {
      const [kind, n] = gif.anchor.split(':');
      if (kind === 'clip' && !s.clips[Number(n)]) throw new Error(`${path.basename(s.file)} played no voice clip ${n} to start a GIF at`);
      const at = kind === 'step' ? s.stepAt(Number(n)) - s.from : kind === 'clip' ? s.clips[Number(n)].start : 0;
      return Math.max(0, t + at + gif.offset);
    }
    t += s.length;
  }
  throw new Error(`no part ${gif.part}`);
}

const made = [];
for (const p of plan) {
  const film = encode(p);
  made.push(film);
  console.log(`${path.basename(film)}: ${duration(film).toFixed(1)} s, ${(fs.statSync(film).size / 1e6).toFixed(2)} MB`);
  if (p.ch.gif) {
    const g = p.ch.gif;
    const gif = path.join(OUT, `${p.ch.file}.gif`);
    const start = gifStart(p, g);
    ffmpeg(['-ss', start.toFixed(2), '-t', (g.seconds * g.speed).toFixed(2), '-i', film, '-vf',
      `setpts=PTS/${g.speed},fps=8,scale=320:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
      '-loop', '0', gif]);
    console.log(`${path.basename(gif)}: ${duration(gif).toFixed(1)} s from ${start.toFixed(1)} s at ${g.speed}×, ${(fs.statSync(gif).size / 1e6).toFixed(2)} MB`);
  }
}

// The full film: the chapters as they are, one after another.
const list = path.join(TMP, 'chapters.txt');
fs.writeFileSync(list, made.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n'));
const full = path.join(OUT, 'fitstrong-v2-journey.mp4');
ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', full]);
console.log(`${path.basename(full)}: ${duration(full).toFixed(1)} s, ${(fs.statSync(full).size / 1e6).toFixed(2)} MB`);
fs.rmSync(TMP, { recursive: true, force: true });
