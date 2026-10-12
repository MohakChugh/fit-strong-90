#!/usr/bin/env node
/**
 * Check that every 3D demo on screen starts moving by itself: an exercise's
 * page (deep link, the old library link, and a tap from the search), the
 * Workout Log's "How to do it", and the guided session and its info sheet.
 * Each check screenshots the demo a few times and fails if the frames match.
 *
 *   node scripts/e2e/autoplay.mjs [--url=http://127.0.0.1:49731/fit-strong-90/] [--viewports=430x932,320x568]
 *     [--runs=2] [--cpu=4] [--coalesce=300] [--motion=no-preference,reduce]
 *
 * Without --url it starts its own watch-free dev server and stops it after.
 * The owner persona is seeded as a v4 blob before the first app script runs,
 * so the real migration moves it into IndexedDB. Runs with and without
 * "reduce motion". --cpu slows the CPU like a phone, which is when timing bugs
 * show; --coalesce batches visibility updates like a busy phone.
 */
import { chromium } from 'playwright-core';
import os from 'node:os';
import { CHROMIUM_ARGS, findChromium } from './acceptance/lib/env.mjs';
import { seedInit } from './acceptance/lib/inpage.mjs';
import { devServer, stopServers } from './acceptance/lib/servers.mjs';
import { persona } from './acceptance/fixtures/personas.mjs';
import * as ui from './acceptance/lib/ui.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const BASE = args.url ?? await devServer(Number(args.port ?? 49735), os.tmpdir());
const VIEWPORTS = (args.viewports ?? '430x932').split(',').map(v => v.split('x').map(Number));
const RUNS = Number(args.runs ?? 2);
const CPU = Number(args.cpu ?? 4);
const COALESCE = Number(args.coalesce ?? 0);

const browser = await chromium.launch({ executablePath: findChromium(), chromiumSandbox: false, args: CHROMIUM_ARGS });

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
  // Let the page finish moving (sheets rising, the opened exercise scrolling into view).
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
      const ctx = await browser.newContext({
        viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
        reducedMotion: motion, locale: 'en-IN', timezoneId: 'Asia/Kolkata',
      });
      await ctx.addInitScript(seedInit, { blob: JSON.stringify(persona('P01')), extra: {}, guard: '__acceptance:seeded' });
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
      page.on('console', m => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
      const main = page.getByRole('main');
      const open = async route => {
        await page.goto(`${BASE}#${route}`, { waitUntil: 'domcontentloaded' });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => !!document.querySelector('h1'), null, { timeout: 30000 });
      };

      const check = async (name, act) => {
        let r;
        try {
          await act();
          r = await frames(page);
        } catch (e) {
          r = { distinct: 0, why: `could not get there: ${e.message.split('\n')[0]}` };
        }
        const mixed = await page.evaluate(() => { const n = window.__ioMixed; window.__ioMixed = 0; return n; }).catch(() => 0);
        // A late redraw or two of a still frame adds a distinct shot; a moving demo differs every time.
        const ok = r.distinct >= 4;
        checks++;
        if (!ok) failed++;
        console.log(`${ok ? 'ok  ' : 'FAIL'} ${w}x${h} ${motion.padEnd(13)} run ${run} ${name.padEnd(20)} ${r.why ?? `${r.distinct} distinct frames`}${mixed ? ` (${mixed} mixed visibility batch)` : ''}`);
      };

      await check('exercise link', () => open('/move/exercises/goblet-squat'));
      await check('old library link', () => open('/library?ex=goblet-squat'));
      await check('exercise from search', async () => {
        await open('/move/exercises');
        await ui.type(main.getByRole('searchbox'), 'Cat-Cow');
        await ui.tap(main.getByRole('link').filter({ hasText: /Cat-Cow/ }).first());
      });
      // Off screen a demo rests; back on screen it must start again by itself.
      await check('scroll away+back', async () => {
        await page.evaluate(() => window.scrollBy({ top: 3000, behavior: 'instant' }));
        await page.waitForTimeout(120);
        await page.evaluate(() => [...document.querySelectorAll('[aria-label^="3D demonstration"]')].at(-1)?.scrollIntoView({ block: 'center', behavior: 'instant' }));
      });
      await check('workout how-to', async () => {
        await open('/track/workout');
        await ui.tap(main.getByRole('button', { name: /^How to do it/ }).first());
        await page.getByRole('dialog').waitFor();
      });
      await check('session', async () => {
        await open('/today');
        await ui.tap(main.getByRole('region').filter({ has: page.getByRole('heading', { level: 3 }) }).getByRole('button'));
        const sheet = page.getByRole('dialog', { name: ui.CHECKIN });
        await ui.answerCheckIn({ advance: async () => page.waitForTimeout(10) }, sheet, ui.normalAnswers('P01', { bp: [[124, 78], [122, 76]], bpGapMs: 0 }));
        await ui.tap(sheet.getByRole('button', { name: /^Start session$/ }));
        await ui.tap(page.getByRole('button', { name: 'Start', exact: true }));
      });
      await check('session info', async () => {
        const info = page.getByRole('button', { name: 'How to do it' });
        for (let i = 0; i < 6 && await info.isDisabled(); i++) await page.getByRole('button', { name: 'Next' }).click();
        await info.click();
        await page.getByRole('dialog').waitFor();
      });
      if (problems.length) { failed++; console.error(`  ${problems.join('\n  ')}`); }
      await ctx.close();
    }
  }
}
await browser.close();
stopServers();
console.log(`${checks - failed}/${checks} checks passed`);
process.exit(failed ? 1 : 0);
