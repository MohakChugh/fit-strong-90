#!/usr/bin/env node
/**
 * End-to-end journey with screenshots (spec §12).
 *
 *   npm run dev            # in another terminal
 *   npm run e2e -- --viewports=320x568,390x844 --scale=40
 *
 * Fresh profile → wizard → Today → check-in → full guided session at
 * `--scale`× speed → summary → saved to history. Fails on page errors,
 * console errors or horizontal overflow. Screenshots: /tmp/fit-e2e/<viewport>/.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const BASE = args.url ?? process.env.E2E_URL ?? 'http://127.0.0.1:5173/fit-strong-90/';
const VIEWPORTS = (args.viewports ?? '320x568').split(',').map(v => v.split('x').map(Number));
const SCALE = Number(args.scale ?? 40);
// `?timescale` is a dev-only switch, so a production build (vite preview) runs the
// session in real time. Pass --skipSession to screenshot everything but the run.
const SKIP_SESSION = 'skipSession' in args;
const OUT = args.out ?? '/tmp/fit-e2e';

function findChromium() {
  if (process.env.PW_EXE) return process.env.PW_EXE;
  const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  const dirs = fs.existsSync(cache) ? fs.readdirSync(cache) : [];
  const shells = dirs.filter(d => d.startsWith('chromium_headless_shell-')).sort().reverse();
  for (const d of shells) {
    const sub = fs.readdirSync(path.join(cache, d)).find(x => x.startsWith('chrome-headless-shell'));
    if (sub) return path.join(cache, d, sub, 'chrome-headless-shell');
  }
  return undefined;
}

const failures = [];
const browser = await chromium.launch({ headless: true, executablePath: findChromium(), chromiumSandbox: false, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

for (const [w, h] of VIEWPORTS) {
  const dir = path.join(OUT, `${w}x${h}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const problems = [];
  page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
  let n = 0;
  const shot = async (name, opts = {}) => {
    await page.waitForTimeout(opts.wait ?? 350);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) problems.push(`horizontal overflow ${overflow}px on ${name}`);
    await page.screenshot({ path: path.join(dir, `${String(++n).padStart(2, '0')}-${name}.png`), fullPage: !!opts.full });
  };
  const click = async (name, opts) => { await page.getByRole('button', { name, exact: false, ...opts }).first().click(); };

  try {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await shot('welcome');

    await click('Get started');
    await page.getByLabel('Body weight').fill('82');
    await shot('wizard-1', { full: true });
    await click('Continue');

    await page.getByRole('checkbox', { name: 'Lower back' }).click();
    await page.getByRole('checkbox', { name: 'Sciatica' }).click();
    await page.getByRole('radio', { name: 'Left' }).click();
    await page.getByRole('radio', { name: 'Sitting or bending forward' }).click();
    await shot('wizard-2', { full: true });
    await click('Continue');

    await page.getByRole('radiogroup', { name: 'Diabetes' }).getByRole('radio', { name: 'Type 2' }).click();
    await page.getByRole('radio', { name: 'Injections or pump' }).click();
    await page.getByRole('radiogroup', { name: 'Glucose monitoring' }).getByRole('radio', { name: 'Meter' }).click();
    await page.getByRole('radiogroup', { name: 'High blood pressure' }).getByRole('radio', { name: 'Treated', exact: true }).click();
    await page.getByRole('radiogroup', { name: /Has a clinician cleared/ }).getByRole('radio', { name: 'For moderate' }).click();
    await shot('wizard-3', { full: true });
    await click('Continue');

    await shot('wizard-4-summary', { full: true });
    await page.getByRole('checkbox').last().check();
    await click('Build my plan');
    await page.waitForURL(/dashboard/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await shot('today', { full: true });

    await click('Preview today');
    await shot('today-preview', { full: true });

    await click('Check in & start');
    await shot('checkin', { wait: 600 });
    await page.getByLabel(/Glucose now/).fill('140');
    await shot('checkin-filled', { full: true });
    await click('See today');
    await shot('checkin-outcome', { wait: 500 });

    // Run the session itself at speed.
    // ?timescale only works on a dev server; a production build runs in real time.
    if (SKIP_SESSION) {
      console.log(`${w}x${h}: ${n} screenshots, ${problems.length} problems (session run skipped)`);
      if (problems.length) failures.push(...problems.map(p => `${w}x${h}: ${p}`));
      await ctx.close();
      continue;
    }
    await page.goto(`${BASE}#/session?timescale=${SCALE}`, { waitUntil: 'networkidle' });
    await shot('session-start');
    await click('Start');
    const realSeconds = Math.ceil(3700 / SCALE) + 10;
    const every = Math.max(2, Math.floor(realSeconds / 28));
    for (let t = 0; t < realSeconds; t += every) {
      await page.waitForTimeout(every * 1000);
      if (await page.getByRole('heading', { name: 'Session complete' }).count()) break;
      // The glucose check before cardio waits for an answer, as a person gives it.
      const glucoseOk = page.getByRole('button', { name: /Glucose is fine/ });
      if (await glucoseOk.count()) await glucoseOk.click();
      const title = (await page.locator('h1').first().textContent().catch(() => 'step')) ?? 'step';
      await shot(`run-${t}s-${title.replace(/[^a-z0-9]+/gi, '-').slice(0, 30)}`, { wait: 50 });
    }
    await page.getByRole('heading', { name: 'Session complete' }).waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: '2', exact: true }).click().catch(() => {});
    await shot('summary');
    await click('Save and finish');
    await page.waitForURL(/dashboard/, { timeout: 10000 });
    await shot('today-after', { full: true });
    await page.goto(`${BASE}#/history`, { waitUntil: 'networkidle' });
    await shot('history', { full: true });
  } catch (e) {
    problems.push(`step failed: ${e.message.split('\n')[0]}`);
    await page.screenshot({ path: path.join(dir, `${String(++n).padStart(2, '0')}-FAILED.png`) }).catch(() => {});
  }

  fs.writeFileSync(path.join(dir, 'problems.txt'), problems.join('\n'));
  if (problems.length) failures.push(...problems.map(p => `${w}x${h}: ${p}`));
  console.log(`${w}x${h}: ${n} screenshots, ${problems.length} problems`);
  await ctx.close();
}

await browser.close();
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('journey ok');
