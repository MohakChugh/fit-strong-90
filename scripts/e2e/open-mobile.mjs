#!/usr/bin/env node
/**
 * Open the app in a real (headed) browser window emulating a phone, to try it
 * by hand: touch, a phone-sized screen, sound and the GPU for the 3D demos.
 *   node scripts/e2e/open-mobile.mjs [--device="iPhone 15"] [--url=http://127.0.0.1:5173/fit-strong-90/]
 * Close the window to end. A fresh profile each time, so it starts at onboarding.
 */
import { chromium, devices } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const URL = args.url ?? 'http://127.0.0.1:5173/fit-strong-90/';
const device = devices[args.device ?? 'iPhone 15'];
if (!device) throw new Error(`Unknown device "${args.device}". Try "iPhone 15", "iPhone SE", "Pixel 7".`);

// Playwright's bundled Chromium (headed); fall back to the system Chrome.
const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
const bundled = fs.existsSync(cache)
  ? fs.readdirSync(cache).filter(d => /^chromium-\d+$/.test(d)).sort().reverse()
    .map(d => path.join(cache, d, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'))
    .find(p => fs.existsSync(p))
  : undefined;
const executablePath = bundled ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const browser = await chromium.launch({
  headless: false,
  executablePath,
  // Let the coach's voice play without a click first, as an installed app would after Start.
  args: ['--autoplay-policy=no-user-gesture-required', `--window-size=${device.viewport.width + 20},${device.viewport.height + 120}`],
});
const context = await browser.newContext({ ...device });
const page = await context.newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded' });
console.log(`Opened ${URL} as ${args.device ?? 'iPhone 15'} (${device.viewport.width}×${device.viewport.height}). Close the window to finish.`);
await new Promise(resolve => browser.on('disconnected', resolve));
