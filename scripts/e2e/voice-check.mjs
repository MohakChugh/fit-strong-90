#!/usr/bin/env node
/**
 * Prove a real session plays the RECORDED voice, not the device voice:
 * seeds a profile and today's check-in, starts the session, and counts
 * requests for voice clips.  Needs a dev server (default :5174).
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
const d = fs.readdirSync(cache).filter(x => x.startsWith('chromium_headless_shell-')).sort().reverse()[0];
const exe = path.join(cache, d, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell');
const b = await chromium.launch({ executablePath: exe, chromiumSandbox: false, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const audio = [];
page.on('request', r => { const u = r.url(); if (u.includes('/voice/')) audio.push(u.split('/voice/')[1]); });
const BASE = process.argv[2] ?? 'http://127.0.0.1:5174/fit-strong-90/';
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  const start = new Date(Date.now() - 9 * 864e5).toISOString().slice(0, 10);
  localStorage.setItem('fit-strong-90-data', JSON.stringify({ version: 3, settings: { onboardingComplete: true, startDate: start, useMetric: true, currentWeight: 82 }, sessions: [], personalRecords: [], bodyMetrics: [],
    profile: { weightKg: 82, pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left' }, health: { diabetes: 'type2' } },
    checkIns: [{ date: new Date().toISOString().slice(0, 10), urgentSymptoms: false, news: [], sleep: 'gt7', energy: 4, readiness: { outcome: 'green', modifiers: [], back: 0, nerveFlag: false, reasons: [], actions: [], vigorousLocked: false, capHeavy: false, rpeOnly: false, notices: [] } }] }));
});
// Hash navigation doesn't remount the app, so reload after seeding.
await page.reload({ waitUntil: 'networkidle' });
await page.goto(`${BASE}#/session?timescale=30`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
const label = await page.locator('text=/Voice:|Captions only/').first().textContent().catch(() => null);
await page.screenshot({ path: '/tmp/voice-start.png' });
const startBtn = page.getByRole('button', { name: /Start (the )?session|Start now|^Start/i }).first();
await startBtn.click({ timeout: 15000 }).catch(async () => {
  console.log('buttons:', await page.getByRole('button').allTextContents());
  throw new Error('no start button');
});
await page.waitForTimeout(9000);
const caption = await page.locator('[aria-live="polite"]').first().textContent().catch(() => '');
console.log('start screen voice:', JSON.stringify(label));
console.log('voice requests:', audio.length, '| manifest:', audio.filter(u => u.includes('manifest')).length, '| clips:', audio.filter(u => u.endsWith('.m4a')).length);
console.log('caption:', JSON.stringify((caption || '').slice(0, 90)));
await b.close();
