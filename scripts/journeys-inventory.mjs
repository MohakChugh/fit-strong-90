#!/usr/bin/env node
/**
 * Every J and V journey in the acceptance suite exactly once, by its
 * normalised id (board D105, D121; Codex P8-27): J01–J20 and V-J01–V-J42.
 * Exits 1 on any missing or doubled id, so a release can't go ahead short of
 * one or with two journeys claiming the same.
 *
 *   node scripts/journeys-inventory.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { norm } from './e2e/acceptance/lib/ids.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'e2e/acceptance/journeys');
const pad = n => String(n).padStart(2, '0');
const want = [...Array.from({ length: 20 }, (_, i) => `J${pad(i + 1)}`), ...Array.from({ length: 42 }, (_, i) => `V${pad(i + 1)}`)];

const found = [];
for (const file of fs.readdirSync(DIR).filter(f => /^[jmpsv]\d\d\.mjs$/.test(f)).sort()) {
  const { id } = await import(pathToFileURL(path.join(DIR, file)).href);
  found.push({ file, id: norm(id) });
}
const missing = want.filter(w => !found.some(f => f.id === w));
const twice = [...new Set(found.map(f => f.id))].filter(id => found.filter(f => f.id === id).length > 1);

for (const id of twice) console.error(`${id} is claimed by ${found.filter(f => f.id === id).map(f => f.file).join(' and ')}.`);
if (missing.length) console.error(`Missing: ${missing.join(', ')}.`);
if (missing.length || twice.length) process.exit(1);
console.log(`All of J01–J20 and V-J01–V-J42 are in the suite, each once (${found.length} journeys in all).`);
