#!/usr/bin/env node
/**
 * Check that every 3D demo on screen starts moving by itself: the Library
 * sheet (deep link and tap), the Workout accordion, and the guided session.
 * Each check screenshots the demo a few times and fails if the frames match.
 *   node scripts/e2e/autoplay.mjs [--url=http://127.0.0.1:5174/fit-strong-90/] [--viewports=390x844,320x568]
 *     [--runs=3] [--cpu=4] [--coalesce=300] [--motion=no-preference,reduce]
 * Runs with and without "reduce motion". --cpu slows the CPU like a phone, which
 * is when timing bugs show; --coalesce batches visibility updates like a busy phone.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const BASE = args.url ?? 'http://127.0.0.1:5174/fit-strong-90/';
const VIEWPORTS = (args.viewports ?? '390x844').split(',').map(v => v.split('x').map(Number));
const RUNS = Number(args.runs ?? 3);
const CPU = Number(args.cpu ?? 4);
const COALESCE = Number(args.coalesce ?? 0);

const exe = (() => {
  const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  const d = fs.readdirSync(cache).filter(x => x.startsWith('chromium_headless_shell-')).sort().reverse()[0];
  return path.join(cache, d, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell');
})();
const browser = await chromium.launch({ executablePath: exe, chromiumSandbox: false, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

/** The demo on screen: its box, and whether the 3D canvas has replaced the placeholder. */
const demo = page => page.evaluate(() => {
  const host = [...document.querySelectorAll('[aria-label^="3D demonstration"]')].at(-1);
  if (!host) return null;
  const root = host.parentElement, r = root.getBoundingClientRect();
  return { ready: !!host.querySelector('canvas') && !root.querySelector(':scope > .bg-background'), x: r.x, y: r.y, width: r.width, height: r.height };
});

/** Distinct frames among a few screenshots of the demo, taken without scrolling it. */
async function frames(page) {
  const deadline = Date.now() + 30000;
  let d = await demo(page);
  while (!d?.ready && Date.now() < deadline) { await page.waitForTimeout(150); d = await demo(page); }
  if (!d?.ready) return { distinct: 0, why: d ? 'never left the placeholder' : 'no demo' };
  // Let the page finish moving (panels folding, scrolling the opened exercise into view).
  for (let prev = null, i = 0; i < 16 && d && d.y !== prev?.y; i++) { prev = d; await page.waitForTimeout(250); d = await demo(page); }
  if (!d) return { distinct: 0, why: 'demo went away' };
  const vp = page.viewportSize();
  const clip = { x: Math.max(0, d.x), y: Math.max(0, d.y), width: Math.min(d.width, vp.width - Math.max(0, d.x)), height: Math.min(d.y + d.height, vp.height) - Math.max(0, d.y) };
  if (clip.height < 8) return { distinct: 0, why: 'off screen' };
  await page.waitForTimeout(900);
  const shots = new Set();
  for (let i = 0; i < 5; i++) { shots.add((await page.screenshot({ clip })).toString('base64')); await page.waitForTimeout(400); }
  return { distinct: shots.size };
}

let failed = 0, checks = 0;
for (const [w, h] of VIEWPORTS) {
  for (const motion of (args.motion ?? 'no-preference,reduce').split(',')) {
    for (let run = 1; run <= RUNS; run++) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: motion });
      // A busy phone delivers several intersection entries for one element in one
      // batch, oldest first. --coalesce=ms forces that; mixed batches are counted.
      await ctx.addInitScript(ms => {
        const IO = window.IntersectionObserver;
        window.__ioMixed = 0;
        window.IntersectionObserver = class extends IO {
          constructor(cb, o) {
            let queue = [], timer = 0;
            const deliver = (es, obs) => { if (new Set(es.map(e => e.isIntersecting)).size > 1) window.__ioMixed++; cb(es, obs); };
            super((es, obs) => {
              if (!ms) return deliver(es, obs);
              queue.push(...es);
              clearTimeout(timer);
              timer = setTimeout(() => { const batch = queue; queue = []; deliver(batch, obs); }, ms);
            }, o);
          }
        };
      }, COALESCE);
      const page = await ctx.newPage();
      const problems = [];
      page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));
      await page.goto(BASE, { waitUntil: 'networkidle' });
      await page.evaluate(() => {
        const start = new Date(Date.now() - 9 * 864e5).toISOString().slice(0, 10);
        localStorage.setItem('fit-strong-90-data', JSON.stringify({
          version: 3,
          settings: { onboardingComplete: true, startDate: start, useMetric: true, currentWeight: 82, defaultRestSeconds: 90 },
          sessions: [], personalRecords: [], bodyMeasurements: [],
          profile: { weightKg: 82, pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left', worseWith: 'flexion' }, health: { diabetes: 'type2', glucoseMonitor: 'meter' } },
        }));
      });
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });

      const check = async (name, act) => {
        await act();
        const r = await frames(page);
        const mixed = await page.evaluate(() => { const n = window.__ioMixed; window.__ioMixed = 0; return n; });
        // A late redraw or two of a still frame adds a distinct shot; a moving demo differs every time.
        const ok = r.distinct >= 4;
        checks++;
        if (!ok) failed++;
        console.log(`${ok ? 'ok  ' : 'FAIL'} ${w}x${h} ${motion.padEnd(13)} run ${run} ${name.padEnd(18)} ${r.why ?? `${r.distinct} distinct frames`}${mixed ? ` (${mixed} mixed visibility batch)` : ''}`);
      };
      // Bring the control comfortably on screen first, as a person would before tapping:
      // Playwright's own scrolling retries under the fixed bottom bar and moves the page mid-tap.
      const tap = async target => { await target.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' })); await target.click(); };
      const open = async route => { await page.goto(`${BASE}#/${route}`, { waitUntil: 'networkidle' }); await page.reload({ waitUntil: 'networkidle' }); };

      await check('library link', () => open('library?ex=goblet-squat'));
      await check('library tap', async () => {
        await page.keyboard.press('Escape');
        await page.locator('[data-slot="sheet-content"]').waitFor({ state: 'detached' });
        await page.getByRole('button', { name: /Cat-cow/i }).first().click();
      });
      await check('workout expand', async () => {
        await open('workout');
        await tap(page.locator('[data-slot="accordion-trigger"]').first());
      });
      // Off screen a demo rests; back on screen it must start again by itself.
      await check('scroll away+back', async () => {
        await page.evaluate(() => window.scrollBy({ top: 3000, behavior: 'instant' }));
        await page.waitForTimeout(120);
        await page.evaluate(() => [...document.querySelectorAll('[aria-label^="3D demonstration"]')].at(-1)?.scrollIntoView({ block: 'center', behavior: 'instant' }));
      });
      // Opening the next exercise closes the one above it; its demo must still end up on screen.
      await check('workout next', async () => {
        await tap(page.locator('[data-slot="accordion-trigger"]').nth(1));
        await page.waitForTimeout(900);
      });
      await check('how-to link', async () => {
        await page.getByRole('link', { name: 'How to do it' }).last().click();
        await page.locator('[data-slot="sheet-content"]').waitFor();
      });
      await check('session', async () => {
        await open('session');
        await page.getByRole('button', { name: 'Start', exact: false }).first().click();
      });
      await check('session info', async () => {
        const info = page.getByRole('button', { name: 'How to do it' });
        for (let i = 0; i < 4 && await info.isDisabled(); i++) await page.getByRole('button', { name: 'Next' }).click();
        await info.click();
        await page.locator('[data-slot="sheet-content"]').waitFor();
      });
      if (problems.length) { failed++; console.error(`  ${problems.join('\n  ')}`); }
      await ctx.close();
    }
  }
}
await browser.close();
console.log(`${checks - failed}/${checks} checks passed`);
process.exit(failed ? 1 : 0);
