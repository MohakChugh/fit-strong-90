#!/usr/bin/env node
/**
 * Screenshot app routes with a ready profile (no onboarding):
 *   node scripts/e2e/pages.mjs --url=http://127.0.0.1:5174/fit-strong-90/ --viewports=320x568,390x844 \
 *     --routes="library?ex=goblet-squat,workout,plan,settings" [--out=/tmp/fit-pages] [--wait=2500]
 * Each route is a hash path. Fails on page errors, console errors or horizontal overflow.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const BASE = args.url ?? 'http://127.0.0.1:5173/fit-strong-90/';
const VIEWPORTS = (args.viewports ?? '390x844').split(',').map(v => v.split('x').map(Number));
const ROUTES = (args.routes ?? 'dashboard').split(',');
const OUT = args.out ?? '/tmp/fit-pages';
const WAIT = Number(args.wait ?? 2500);

const exe = (() => {
  const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  const d = fs.readdirSync(cache).filter(x => x.startsWith('chromium_headless_shell-')).sort().reverse()[0];
  return path.join(cache, d, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell');
})();
const browser = await chromium.launch({ executablePath: exe, chromiumSandbox: false, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let failed = false;
for (const [w, h] of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const problems = [];
  page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const today = new Date();
    const start = new Date(today.getTime() - 9 * 864e5).toISOString().slice(0, 10);
    localStorage.setItem('fit-strong-90-data', JSON.stringify({
      version: 3,
      settings: { onboardingComplete: true, startDate: start, useMetric: true, currentWeight: 82, defaultRestSeconds: 90 },
      sessions: [], personalRecords: [], bodyMeasurements: [],
      profile: { weightKg: 82, pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left', worseWith: 'flexion' }, health: { diabetes: 'type2', glucoseMonitor: 'meter' } },
    }));
  });
  for (const r of ROUTES) {
    await page.goto(`${BASE}#/${r}`, { waitUntil: 'networkidle' });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(WAIT);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) problems.push(`horizontal overflow ${overflow}px on ${r}`);
    const file = path.join(OUT, `${w}x${h}`, `${r.replace(/[^a-z0-9]+/gi, '-')}.png`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.screenshot({ path: file });
    console.log(file);
  }
  if (problems.length) { failed = true; console.error(`${w}x${h}:\n  ${problems.join('\n  ')}`); }
  await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
