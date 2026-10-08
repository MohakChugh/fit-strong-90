#!/usr/bin/env node
/**
 * Everything browser-driven, in order: the release acceptance suite, then the
 * three guards for past regressions (3D demos autoplay, every screen offline
 * from the service worker, the recorded voice on the first tap). Each starts
 * and stops its own servers. Arguments are passed to the acceptance suite.
 *
 *   npm run e2e
 *   npm run e2e -- --only=J03,J04
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const steps = [
  ['acceptance suite', path.join(here, 'acceptance/run.mjs'), process.argv.slice(2)],
  ['3D demos autoplay', path.join(here, 'autoplay.mjs'), []],
  ['offline from the service worker', path.join(here, 'offline.mjs'), []],
  ['recorded voice on the first tap', path.join(here, 'voice-start.mjs'), []],
];
const results = [];
for (const [name, file, argv] of steps) {
  console.log(`\n=== ${name}`);
  const r = spawnSync(process.execPath, [file, ...argv], { stdio: 'inherit' });
  results.push([name, r.status === 0]);
}
console.log('\n=== summary');
for (const [name, ok] of results) console.log(`${ok ? 'pass' : 'FAIL'}  ${name}`);
process.exit(results.every(([, ok]) => ok) ? 0 : 1);
