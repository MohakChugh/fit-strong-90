#!/usr/bin/env node
/**
 * The release acceptance suite (docs/reimagine/codex-acceptance.md, board D34).
 *
 *   npm run e2e:acceptance                       # every journey, all four projects
 *   npm run e2e:acceptance -- --only=J03,J04     # some journeys
 *   npm run e2e:acceptance -- --projects=small-dark --concurrency=2
 *   npm run e2e:acceptance -- --url=http://127.0.0.1:49731/fit-strong-90/   # an already-running server
 *
 * Without --url it starts its own watch-free dev server (so edits elsewhere
 * cannot reload a page mid-journey) and, for the journeys that need a service
 * worker or the production CSP, its own production build and preview. It
 * stops only the processes it started. Artifacts (screenshots, database
 * snapshots on failure, results.json, report.md) go to a temp directory
 * outside the repository, printed at the end.
 *
 * Exit code 0 only when every selected journey passes in every project.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PROJECTS, artifactRoot, launch } from './lib/env.mjs';
import { Case } from './lib/harness.mjs';
import { writeReport } from './lib/report.mjs';
import { devServer, previewServer, stopServers } from './lib/servers.mjs';
import { seedInit } from './lib/inpage.mjs';
import { persona } from './fixtures/personas.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)).map(([k, v]) => [k, v ?? 'true']));
const HERE = path.dirname(fileURLToPath(import.meta.url));

if (args.help) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 20).join('\n'));
  process.exit(0);
}

const only = args.only ? new Set(args.only.split(',').map(s => s.trim().toUpperCase())) : undefined;
const projects = args.projects ? PROJECTS.filter(p => args.projects.split(',').includes(p.id)) : PROJECTS;
const concurrency = Number(args.concurrency ?? 4);
const caseFilter = args.case ? new RegExp(args.case, 'i') : undefined;

// ---------------------------------------------------------------- journeys

const files = fs.readdirSync(path.join(HERE, 'journeys')).filter(f => /^[js]\d\d\.mjs$/.test(f)).sort();
const journeys = [];
for (const f of files) {
  const mod = await import(pathToFileURL(path.join(HERE, 'journeys', f)).href);
  if (only && !only.has(mod.id)) continue;
  journeys.push(mod);
}
if (!journeys.length) {
  console.error(`No journeys selected (${args.only ?? 'none found'}).`);
  process.exit(2);
}
if (args.list) {
  for (const j of journeys) console.log(`${j.id}${j.safety ? ' [SAFETY]' : ''}  ${j.title}  (${j.cases.length} case${j.cases.length === 1 ? '' : 's'})`);
  process.exit(0);
}

// ---------------------------------------------------------------- servers

const tasks = [];
for (const j of journeys) {
  for (const project of projects) {
    for (const c of j.cases) {
      if (caseFilter && !caseFilter.test(c.name)) continue;
      if (c.projects && !c.projects.includes(project.id)) continue;
      tasks.push({ j, c, project });
    }
  }
}

const root = artifactRoot(args.out);
const devPort = Number(args.port ?? 49731);
const previewPort = Number(args['preview-port'] ?? devPort + 1);
const devUrl = args.url ?? await devServer(devPort, root);
let previewUrl = args['preview-url'];
if (!previewUrl && tasks.some(task => task.c.preview)) {
  console.log('Building the production bundle for the preview server …');
  previewUrl = await previewServer(previewPort, root);
}
const origin = new URL(devUrl).origin;
const previewOrigin = previewUrl ? new URL(previewUrl).origin : undefined;

// ---------------------------------------------------------------- run

const browser = await launch();

/**
 * Load every area once before the first journey. A watch-free dev server
 * keeps serving the modules it has transformed, so this pins one snapshot of
 * the app for the whole run, and says so loudly if that snapshot is broken
 * (another agent mid-edit), rather than letting journeys fail on it one by one.
 */
async function warm(url) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
  await ctx.addInitScript(seedInit, { blob: JSON.stringify(persona('P01')), extra: {}, guard: '__acceptance:seeded' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  for (const r of ['/today', '/move', '/move/stretch', '/move/plan', '/move/exercises', '/walk', '/track', '/track/workout', '/track/back', '/guide', '/guide/meals', '/guide/sources', '/you', '/you/profile', '/you/habits', '/you/data', '/session']) {
    await page.goto(`${url}#${r}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!document.querySelector('h1'), null, { timeout: 60000 }).catch(() => errors.push(`${r}: no screen within 60 s`));
    if (await page.getByText('This screen didn’t load', { exact: true }).count()) errors.push(`${r}: the screen failed to load`);
  }
  await ctx.close();
  return errors;
}
if (args.warm !== 'false') {
  const problems = await warm(devUrl);
  if (problems.length) console.log(`WARNING: the app did not load cleanly before the run:\n  ${[...new Set(problems)].slice(0, 10).join('\n  ')}`);
  else console.log('Warm-up: every area loaded cleanly.');
}
console.log(`${tasks.length} cases: ${journeys.map(j => j.id).join(', ')} × ${projects.map(p => p.id).join(', ')} · concurrency ${concurrency}`);
console.log(`Artifacts: ${root}`);

const results = [];
const began = Date.now();
let next = 0;
const verbose = args.verbose !== undefined;
async function worker() {
  while (next < tasks.length) {
    const { j, c, project } = tasks[next++];
    const t = new Case({
      journey: j.id, name: c.name, project, browser, root,
      origin: c.preview ? previewOrigin : origin,
      log: verbose ? m => console.log(m) : m => { if (m.includes('FAIL')) console.log(m); },
    });
    try {
      if (c.preview && !previewOrigin) throw new Error('this case needs the production preview server');
      await c.run(t, { project, devUrl, previewUrl });
    } catch (e) {
      await t.fail(`journey error outside a step: ${String(e?.stack ?? e).split('\n').slice(0, 4).join(' | ')}`);
    }
    const r = await t.close();
    r.safety = !!j.safety;
    r.title = j.title;
    results.push(r);
    const mark = r.status === 'pass' ? 'pass' : r.status === 'pending' ? 'PEND' : 'FAIL';
    console.log(`${mark.padEnd(4)} ${j.id} ${project.id.padEnd(11)} ${c.name}${r.failures.length ? ` — ${r.failures.length} failure(s), first at step ${r.failures[0].step}: ${r.failures[0].message.slice(0, 140)}` : ''} (${Math.round(r.durationMs / 1000)}s)`);
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
await browser.close();
stopServers();

const elapsed = Date.now() - began;
const report = writeReport({ root, results, journeys, projects, elapsed, devUrl, previewUrl });
console.log(`\n${report.summary}\nReport: ${report.file}`);
// A case pending an agreed app change is reported, not failed.
process.exit(results.every(r => r.status !== 'fail') ? 0 : 1);
