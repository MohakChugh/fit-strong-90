/**
 * Walk setup, the live walk and its summary (src/screens/walk/*), driven by
 * taps; GPS fixes come from the test geolocation in lib/inpage.mjs, stamped
 * with the page's own (frozen, test-driven) clock.
 */
import zlib from 'node:zlib';
import fs from 'node:fs';
import * as ui from './ui.mjs';
import { sheetStart } from './player.mjs';

export const WALK_KEY = 'fit-strong-walk';

/** Move → Walk, to the setup screen. */
export async function openSetup(t) {
  const page = t.page;
  await ui.tab(page, 'Move');
  await ui.tap(ui.row(page.getByRole('main'), 'Walk', 'link'));
  await page.getByRole('heading', { level: 1, name: 'Walk', exact: true }).waitFor();
}

/** The setup's switches. */
export const gpsSwitch = page => page.getByRole('main').getByRole('switch', { name: /^Measure distance and pace/ });
export const stepsSwitch = page => page.getByRole('main').getByRole('switch', { name: /^Count steps/ });

/** Geolocation and permission calls the page has made so far. */
export const calls = page => page.evaluate(() => ({ ...window.__acc.calls, permissionsQuery: [...window.__acc.calls.permissionsQuery] }));

/** A fix delivered to every active watcher; returns how many watchers took it. */
export const emit = (page, lat, lon = 0, accuracy = 3) => page.evaluate(p => window.__acc.emitPosition(p), { lat, lon, accuracy });

/** Tap Start walk; answer the check-in if it opens; land on the live walk. */
export async function start(t, answers) {
  const page = t.page;
  await ui.tap(ui.button(page.getByRole('main'), 'Start walk'));
  await page.waitForTimeout(400);
  const sheet = page.getByRole('dialog', { name: ui.CHECKIN });
  if (await sheet.count()) {
    await ui.answerCheckIn(t, sheet, answers);
    await page.waitForTimeout(400);
    await t.checkpoint('walk-check-in-outcome');
    const go = sheetStart(sheet);
    await t.must(await go.count() === 1, `the check-in does not allow the walk: ${(await sheet.innerText()).replace(/\s+/g, ' ').slice(0, 300)}`);
    await ui.tap(go);
  }
  await page.waitForURL(/#\/walk\/live/);
  await t.ready();
}

/** The walk timer as shown (m:ss). */
export async function timer(page) {
  return (await page.getByRole('timer').locator('[aria-hidden="true"]').innerText()).trim();
}

/** The walk in progress, as stored in sessionStorage. */
export const stored = page => page.evaluate(key => { const raw = sessionStorage.getItem(key); return raw ? JSON.parse(raw) : null; }, WALK_KEY);

/** Finish → confirm Finish walk → the summary. */
export async function finish(t) {
  const page = t.page;
  await ui.tap(ui.button(page.getByRole('main'), 'Finish'));
  const confirm = page.getByRole('dialog', { name: 'Finish walk' });
  await confirm.waitFor();
  await ui.tap(ui.button(confirm, 'Finish walk'));
  await page.waitForURL(/#\/walk\/summary/);
  await page.getByRole('heading', { level: 1, name: 'Your walk' }).waitFor();
}

/** Save walk, and the moment "Saved on this device" shows: is the walk in the database? */
export async function save(t) {
  const page = t.page;
  await ui.tap(ui.button(page.getByRole('main'), 'Save walk'));
  await page.getByText('Saved on this device', { exact: true }).waitFor({ timeout: 10000 });
  return t.db();
}

/** The walk's observations, by context. */
export function walkObservations(snap) {
  return (snap.observations ?? []).filter(o => o.context?.startsWith('walk:'));
}

/** Any position anywhere: keys or strings that look like coordinates. */
export function positionsIn(value, path = '') {
  const found = [];
  const KEY = /^(lat|lon|lng|latitude|longitude|coords?|coordinates|positions?|lastPosition|fixes)$/i;
  // A route or track is a list of points, or an encoded one. A plain object by
  // that name is searched for coordinates instead: the navigation history
  // keeps each tab's screen under the tab's name, and the Track tab is `track`.
  const SEQUENCE = /^(route|track)$/i;
  const visit = (v, p) => {
    if (v === null || v === undefined) return;
    if (typeof v === 'string') {
      if (/"(lat|lon|latitude|longitude)"\s*:/.test(v)) found.push(`${p} (a string holding coordinates)`);
      else if (v.length > 2 && (v.startsWith('{') || v.startsWith('['))) { try { visit(JSON.parse(v), `${p}<json>`); } catch { /* not JSON */ } }
      return;
    }
    if (Array.isArray(v)) { v.forEach((x, i) => visit(x, `${p}[${i}]`)); return; }
    if (typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        const plainObject = x !== null && typeof x === 'object' && !Array.isArray(x);
        if (KEY.test(k) || (SEQUENCE.test(k) && x !== null && x !== undefined && !plainObject)) found.push(`${p}.${k}`);
        visit(x, `${p}.${k}`);
      }
    }
  };
  visit(value, path);
  return found;
}

/** You → Data & offline → Back up your record → Download; the decoded backup. */
export async function exportBackup(t) {
  const page = t.page;
  await t.goto('/you/data');
  await ui.tap(ui.row(page.getByRole('main'), 'Back up your record'));
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: /^(Download|Save or share)$/ }).waitFor({ timeout: 15000 });
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    ui.tap(sheet.getByRole('button', { name: /^(Download|Save or share)$/ })),
  ]);
  const file = await download.path();
  let bytes = fs.readFileSync(file);
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = zlib.gunzipSync(bytes);
  return { name: download.suggestedFilename(), doc: JSON.parse(bytes.toString('utf8')) };
}
