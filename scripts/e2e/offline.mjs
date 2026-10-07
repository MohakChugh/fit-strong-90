#!/usr/bin/env node
/**
 * Check the installed service worker serves the app with the network off:
 *   npx vite preview --port 4173   # a production build; dev has no worker
 *   node scripts/e2e/offline.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
const d = fs.readdirSync(cache).filter(x => x.startsWith('chromium_headless_shell-')).sort().reverse()[0];
const exe = path.join(cache, d, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell');
const b = await chromium.launch({ executablePath: exe, chromiumSandbox: false, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e)));
const BASE = 'http://127.0.0.1:4173/fit-strong-90/';
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  const start = new Date(Date.now() - 9 * 864e5).toISOString().slice(0, 10);
  localStorage.setItem('fit-strong-90-data', JSON.stringify({ version: 3, settings: { onboardingComplete: true, startDate: start, useMetric: true, currentWeight: 82 }, sessions: [], personalRecords: [], bodyMetrics: [], profile: { weightKg: 82 } }));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
// Only Today has been opened online: every other screen must still open offline.
const reg = await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => !!r?.active));
await ctx.setOffline(true);
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const text = await page.evaluate(() => document.body.innerText.slice(0, 120).replace(/\n/g, ' | '));
await page.screenshot({ path: '/tmp/fit-offline.png' });
const screen = async (route, expect) => {
  await page.evaluate(r => { location.hash = r; }, route);
  await page.waitForTimeout(2500);
  const t = await page.evaluate(() => document.body.innerText.replace(/\n/g, ' | '));
  const seen = expect.test(t);
  console.log(`offline ${route}: ${seen ? 'opens' : 'FAILED'} (${t.slice(0, 80)})`);
  return seen;
};
const library = await screen('#/library', /Showing \d+ of \d+/);
const session = await screen('#/session', /Start/);
const ok = reg && library && session && /Today|Start|Mon|Tue|Wed|Thu|Fri|Sat|Sun/.test(text) && errs.length === 0;
console.log(`service worker active: ${reg} | offline page: ${text} | page errors: ${errs.length}`, errs.slice(0, 2));
console.log(ok ? 'offline ok' : 'OFFLINE FAILED');
await b.close();
process.exit(ok ? 0 : 1);
