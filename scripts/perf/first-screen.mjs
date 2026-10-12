#!/usr/bin/env node
/**
 * The first screen's JavaScript (board D117): the entry script and every
 * module the built index.html preloads, gzipped as a server would send them,
 * against the size recorded when Plan 8 began. `--record` writes the size;
 * otherwise the run fails past the budget's margin.
 *
 *   npm run build && npm run perf:first-screen -- --record
 *   npm run build && npm run perf:first-screen
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIST = path.join(ROOT, 'dist');
const BUDGET = path.join(ROOT, 'scripts/perf/budget.json');
const BASE = '/fit-strong-90/';
const MARGIN = 1.1;

const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const urls = [
  ...[...html.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"/g)].map(m => m[1]),
  ...[...html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g)].map(m => m[1]),
];
const files = [...new Set(urls)].map(u => path.join(DIST, u.startsWith(BASE) ? u.slice(BASE.length) : u.replace(/^\//, '')));
if (files.length === 0) throw new Error('dist/index.html names no module script: run npm run build first');
const bytes = files.reduce((total, file) => total + zlib.gzipSync(fs.readFileSync(file), { level: 9 }).length, 0);
const kib = n => `${(n / 1024).toFixed(1)} KiB`;

if (process.argv.includes('--record')) {
  const budget = { firstScreenGzipBytes: bytes, recordedOn: new Date().toISOString().slice(0, 10), files: files.length, margin: MARGIN };
  fs.writeFileSync(BUDGET, `${JSON.stringify(budget, null, 2)}\n`);
  console.log(`Recorded the first screen: ${kib(bytes)} gzipped, in ${files.length} files.`);
} else {
  const budget = JSON.parse(fs.readFileSync(BUDGET, 'utf8'));
  const limit = Math.round(budget.firstScreenGzipBytes * budget.margin);
  console.log(`The first screen: ${kib(bytes)} gzipped, in ${files.length} files. Budget ${kib(limit)}: ${kib(budget.firstScreenGzipBytes)} on ${budget.recordedOn}, plus 10%.`);
  if (bytes > limit) {
    console.error('Over the first screen’s budget (board D117).');
    process.exit(1);
  }
}
