#!/usr/bin/env node
/**
 * Check that every screen opens offline after one online visit, served by the
 * service worker of a production build (a dev server has no worker):
 *
 *   node scripts/e2e/offline.mjs                       # builds to a temp dir and previews it itself
 *   node scripts/e2e/offline.mjs --url=http://127.0.0.1:49732/fit-strong-90/   # an existing `vite preview`
 *
 * Only Today is opened online, so a screen that works offline here does so
 * because the worker precached its code, not because it was visited. The
 * owner persona is seeded as a v4 blob before the first app script runs, so
 * the real migration moves it into IndexedDB.
 */
import { chromium } from 'playwright-core';
import os from 'node:os';
import { CHROMIUM_ARGS, findChromium } from './acceptance/lib/env.mjs';
import { seedInit } from './acceptance/lib/inpage.mjs';
import { previewServer, stopServers } from './acceptance/lib/servers.mjs';
import { persona } from './acceptance/fixtures/personas.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const BASE = args.url ?? await previewServer(Number(args.port ?? 49736), os.tmpdir());

// Every screen, and the heading it must show offline.
const SCREENS = [
  ['/today', /^Today$/], ['/move', /^Move$/], ['/move/stretch', /^Stretch$/], ['/move/plan', /plan|Week/i],
  ['/move/exercises', /exercise/i], ['/move/exercises/goblet-squat', /Goblet/i], ['/walk', /^Walk$/],
  ['/track', /^My Day$/], ['/track?view=trends', /^My Day$/], ['/track/back', /Back/i], ['/track/workout', /workout|Workout/i],
  ['/track/session/legacy-strength', /./], ['/guide', /^Guide$/], ['/guide/meals', /Meal/i], ['/guide/sources', /Sources/i],
  ['/you', /^You$/], ['/you/profile', /Profile/i], ['/you/habits', /Habits/i], ['/you/voice', /Voice/i],
  ['/you/appearance', /Appearance/i], ['/you/data', /Data & offline/], ['/session', /./],
];

const browser = await chromium.launch({ executablePath: findChromium(), chromiumSandbox: false, args: CHROMIUM_ARGS });
const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true, serviceWorkers: 'allow', locale: 'en-IN', timezoneId: 'Asia/Kolkata' });
await ctx.addInitScript(seedInit, { blob: JSON.stringify(persona('P01')), extra: {}, guard: '__acceptance:seeded' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
// Offline, an optional asset that was never downloaded (a voice pack) fails to load; that one
// resource failure is expected and named. Anything else is an error.
const failedRequests = [];
page.on('requestfailed', r => failedRequests.push(r.url()));
page.on('console', m => {
  if (m.type() !== 'error') return;
  const optional = /Failed to load resource: net::ERR_(FAILED|INTERNET_DISCONNECTED)/.test(m.text())
    && failedRequests.length > 0 && failedRequests.every(u => u.includes('/voice/'));
  if (!optional) errors.push(`${m.text()} ${failedRequests.slice(-1)[0] ?? ''}`);
});

await page.goto(`${BASE}#/today`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!document.querySelector('h1'), null, { timeout: 30000 });
await page.evaluate(() => navigator.serviceWorker.ready);
await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 20000 }).catch(() => {});
const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);

await ctx.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' });
let ok = controlled;
for (const [route, heading] of SCREENS) {
  await page.evaluate(r => { location.hash = r; }, route);
  await page.waitForTimeout(1200);
  const h1 = (await page.locator('h1').allInnerTexts()).map(s => s.trim()).join(' | ');
  const broken = await page.getByText('This screen didn’t load', { exact: true }).count();
  const seen = !broken && heading.test(h1);
  if (!seen) ok = false;
  console.log(`offline ${route.padEnd(32)} ${seen ? 'opens' : 'FAILED'} (${h1 || 'no heading'})`);
}
console.log(`service worker in control: ${controlled} | page errors: ${errors.length}`, errors.slice(0, 3));
if (failedRequests.length) console.log(`offline requests that failed (expected only for optional voice files): ${[...new Set(failedRequests)].join(', ')}`);
if (errors.length) ok = false;
console.log(ok ? 'offline ok' : 'OFFLINE FAILED');
await browser.close();
stopServers();
process.exit(ok ? 0 : 1);
