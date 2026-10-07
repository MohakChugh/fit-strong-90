#!/usr/bin/env node
/**
 * The coach's voice must start on the first Start tap, the way a phone allows
 * audio: each audio element needs its own tap (Chromium's user-gesture policy,
 * like iOS). Checks:
 *   - a quick tap, while the voice pack is still arriving over a slow network
 *   - a normal tap, after the pack has loaded
 *   - a reload mid-session, then Resume
 * A run passes when recorded clips actually play and the "tap to turn the
 * voice back on" prompt never shows.
 *   node scripts/e2e/voice-start.mjs [--url=http://127.0.0.1:5173/fit-strong-90/] [--delay=2500]
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const BASE = args.url ?? 'http://127.0.0.1:5173/fit-strong-90/';
const DELAY = Number(args.delay ?? 2500);

const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
const d = fs.readdirSync(cache).filter(x => x.startsWith('chromium_headless_shell-')).sort().reverse()[0];
const browser = await chromium.launch({
  executablePath: path.join(cache, d, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell'),
  chromiumSandbox: false,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=user-gesture-required'],
});

const today = new Date().toISOString().slice(0, 10);
const seed = {
  version: 3,
  settings: { onboardingComplete: true, startDate: new Date(Date.now() - 9 * 864e5).toISOString().slice(0, 10), useMetric: true, currentWeight: 82 },
  sessions: [], personalRecords: [], bodyMetrics: [],
  profile: { weightKg: 82, pain: { areas: ['lowerBack'] }, health: { diabetes: 'none' } },
  checkIns: [{ date: today, urgentSymptoms: false, news: [], sleep: 'gt7', energy: 4, readiness: { outcome: 'green', modifiers: [], back: 0, nerveFlag: false, reasons: [], actions: [], vigorousLocked: false, capHeavy: false, rpeOnly: false, notices: [] } }],
};

async function run(name, { delayManifest, tapAfterVoiceLoads, reloadAndResume }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  // Record every play() and whether the browser allowed it.
  await ctx.addInitScript(() => {
    window.__plays = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      const src = this.currentSrc || this.src || '';
      const kind = src.startsWith('data:') ? 'unlock' : 'clip';
      const p = play.call(this);
      p.then(() => window.__plays.push({ kind, ok: true }), e => window.__plays.push({ kind, ok: false, err: e?.name }));
      return p;
    };
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  if (delayManifest) {
    // Slow only the first fetch: after a reload the phone has the pack cached.
    let first = true;
    await page.route(/\/voice\/[^/]+\/manifest\.json/, async r => {
      if (first) { first = false; await new Promise(res => setTimeout(res, DELAY)); }
      await r.continue();
    });
  }
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(s => localStorage.setItem('fit-strong-90-data', JSON.stringify(s)), seed);
  await page.reload({ waitUntil: 'networkidle' });

  // Today → Start → the session's own Start, by client-side navigation as a person would.
  await page.getByRole('button', { name: 'Start session' }).click();
  const start = page.getByRole('button', { name: /^Start$/ });
  await start.waitFor();
  if (tapAfterVoiceLoads) await page.getByText(/^Voice: /).waitFor({ timeout: 10000 });
  await start.click();
  await page.waitForTimeout(DELAY + 4000);

  if (reloadAndResume) {
    await page.reload({ waitUntil: 'networkidle' });
    await page.evaluate(() => { window.__plays = []; });
    await page.getByRole('button', { name: 'Resume' }).click();
    await page.waitForTimeout(6000);
  }

  const plays = await page.evaluate(() => window.__plays);
  const blockedPrompt = await page.getByRole('button', { name: /turn the coach.s voice back on/ }).count();
  const clipsPlayed = plays.filter(p => p.kind === 'clip' && p.ok).length;
  const refused = plays.filter(p => !p.ok).map(p => `${p.kind}:${p.err}`);
  const ok = clipsPlayed > 0 && blockedPrompt === 0 && errors.length === 0;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(26)} clips played ${clipsPlayed}, refused [${refused.join(', ')}], voice prompt ${blockedPrompt ? 'shown' : 'hidden'}${errors.length ? `, errors: ${errors.join('; ')}` : ''}`);
  await ctx.close();
  return ok;
}

const results = [
  await run('quick tap, slow voice pack', { delayManifest: true }),
  await run('tap after the voice loads', { tapAfterVoiceLoads: true }),
  await run('reload, then Resume', { delayManifest: true, reloadAndResume: true }),
];
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
