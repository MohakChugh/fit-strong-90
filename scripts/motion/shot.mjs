#!/usr/bin/env node
/**
 * Screenshot the dev motion lab (needs `npx vite` running).
 *   node scripts/motion/shot.mjs "clip=stand&views=front,side,back" /tmp/m/stand.png [width] [height]
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [query = 'clip=stand', out = '/tmp/motion/shot.png', w = '1200', h = '700'] = process.argv.slice(2);
const exe = path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell');
const browser = await chromium.launch({ executablePath: exe, chromiumSandbox: false, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
const errors = [];
page.on('console', m => { if (m.type() === 'error' || (process.env.DEBUG && m.type() !== 'debug')) errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => errors.push(String(e)));
await page.goto(`http://127.0.0.1:5173/fit-strong-90/motion-lab.html?${query}`);
await page.waitForFunction(() => window.__labReady === true || document.body.dataset.error, null, { timeout: 60000 });
await page.waitForTimeout(400);
const labError = await page.evaluate(() => document.body.dataset.error);
if (labError) errors.push(`lab: ${labError}`);
fs.mkdirSync(path.dirname(out), { recursive: true });
await page.screenshot({ path: out });
if (errors.length) console.error(errors.join('\n'));
console.log(out);
await browser.close();
