/**
 * The fixed facts every journey runs under (docs/reimagine/codex-acceptance.md,
 * "Execution and pass criteria"): the four projects, the frozen NOW, the
 * browser and where artifacts go.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
export const BASE_PATH = '/fit-strong-90/';

/** Thursday 8 October 2026, 09:00 IST: Week 3 of 12 for a 24 September start. */
export const NOW_ISO = '2026-10-08T09:00:00+05:30';
export const NOW = Date.parse(NOW_ISO);
export const MINUTE = 60_000;

export const PROJECTS = [
  { id: 'large-light', label: 'Large light', width: 430, height: 932, scheme: 'light' },
  { id: 'large-dark', label: 'Large dark', width: 430, height: 932, scheme: 'dark' },
  { id: 'small-light', label: 'Small light', width: 320, height: 568, scheme: 'light' },
  { id: 'small-dark', label: 'Small dark', width: 320, height: 568, scheme: 'dark' },
];

/** The headless shell Playwright installed, newest first (copied from scripts/e2e/journey.mjs). */
export function findChromium() {
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

export const CHROMIUM_ARGS = ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

export function launch() {
  return chromium.launch({ headless: true, executablePath: findChromium(), chromiumSandbox: false, args: CHROMIUM_ARGS });
}

/** Artifacts live outside the repository (spec rule 5). */
export function artifactRoot(explicit) {
  const root = explicit ?? path.join(os.tmpdir(), 'fit-acceptance', new Date().toISOString().replace(/[:.]/g, '-'));
  if (path.resolve(root).startsWith(REPO)) throw new Error(`Artifacts must live outside the repository, not in ${root}`);
  fs.mkdirSync(root, { recursive: true });
  return root;
}
