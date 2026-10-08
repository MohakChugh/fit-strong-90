#!/usr/bin/env node
/**
 * The coach's RECORDED voice must start on the first Start tap, the way a
 * phone allows audio: each audio element needs its own tap (Chromium's
 * user-gesture policy, like iOS). Checks:
 *   - a quick tap, while the voice pack is still arriving over a slow network
 *   - a normal tap, after the pack has loaded
 *   - a reload mid-session, then Resume
 * A run passes when recorded clips actually play and the "tap to turn the
 * voice back on" prompt never shows.
 *
 *   node scripts/e2e/voice-start.mjs [--url=http://127.0.0.1:49731/fit-strong-90/] [--delay=2500]
 *
 * Without --url it starts its own watch-free dev server and stops it after.
 * The owner persona (voice on) is seeded as a v4 blob before the first app
 * script runs, then checks in through the real check-in sheet.
 */
import { chromium } from 'playwright-core';
import os from 'node:os';
import { findChromium } from './acceptance/lib/env.mjs';
import { seedInit } from './acceptance/lib/inpage.mjs';
import { devServer, stopServers } from './acceptance/lib/servers.mjs';
import { persona } from './acceptance/fixtures/personas.mjs';
import * as ui from './acceptance/lib/ui.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const BASE = args.url ?? await devServer(Number(args.port ?? 49737), os.tmpdir());
const DELAY = Number(args.delay ?? 2500);

const browser = await chromium.launch({
  executablePath: findChromium(),
  chromiumSandbox: false,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=user-gesture-required'],
});

const seed = persona('P01', { patch: { profile: { voice: { muted: false } } } });

async function run(name, { delayManifest, tapAfterVoiceLoads, reloadAndResume }) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true, locale: 'en-IN', timezoneId: 'Asia/Kolkata' });
  await ctx.addInitScript(seedInit, { blob: JSON.stringify(seed), extra: {}, guard: '__acceptance:seeded' });
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
  await page.goto(`${BASE}#/today`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { level: 1, name: 'Today' }).waitFor({ timeout: 30000 });

  // Today → check in → Start session → the player's own Start, as a person would.
  const main = page.getByRole('main');
  await ui.tap(main.getByRole('region').filter({ has: page.getByRole('heading', { level: 3 }) }).getByRole('button'));
  const sheet = page.getByRole('dialog', { name: ui.CHECKIN });
  await ui.answerCheckIn({ advance: async () => {} }, sheet, ui.normalAnswers('P01', { bpGapMs: 0 }));
  await ui.tap(sheet.getByRole('button', { name: /^Start session$/ }));
  const start = page.getByRole('button', { name: /^Start$/ });
  await start.waitFor();
  if (tapAfterVoiceLoads) await page.getByText(/^Voice: /).waitFor({ timeout: 10000 });
  await start.click();
  await page.waitForTimeout(DELAY + 4000);

  if (reloadAndResume) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { window.__plays = []; });
    await page.getByRole('button', { name: 'Resume' }).click({ timeout: 20000 });
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

const results = [];
for (const [name, opts] of [
  ['quick tap, slow voice pack', { delayManifest: true }],
  ['tap after the voice loads', { tapAfterVoiceLoads: true }],
  ['reload, then Resume', { delayManifest: true, reloadAndResume: true }],
]) {
  try { results.push(await run(name, opts)); } catch (e) {
    console.log(`FAIL ${name.padEnd(26)} could not get there: ${e.message.split('\n')[0]}`);
    results.push(false);
  }
}
await browser.close();
stopServers();
process.exit(results.every(Boolean) ? 0 : 1);
