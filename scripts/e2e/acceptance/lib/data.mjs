/**
 * Data journeys' helpers (J05, J18, J19): canonical backup files built from
 * the app's own format (src/store/transfer.ts), the Backup and Restore UI in
 * You → Data & offline, Quick Log in Track, and logical comparison of
 * database snapshots.
 *
 * Fixture files are written under the case's artifact directory, which is
 * outside the repository, and fed to the app through its own file chooser.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { docs } from './harness.mjs';
import * as ui from './ui.mjs';

export const FORMAT = 'fit-strong-health-record';

// ---------------------------------------------------------------- backup files

/** A canonical backup document. Omitted collections are written empty, as an export writes them. */
export function transferDoc(parts = {}) {
  return {
    format: FORMAT,
    version: 1,
    exportedAt: '2026-10-08T08:00:00.000+05:30',
    schemaVersion: 5,
    observations: [],
    sessions: [],
    checkIns: [],
    personalRecords: [],
    bodyMetrics: [],
    focusOverrides: {},
    contentState: [],
    ...parts,
  };
}

/** An observation as a file carries it: every field explicit, `day` from `at`. */
export function obs(fields) {
  const o = { scope: 'pointInTime', source: 'manual', ...fields };
  o.day = o.at.slice(0, 10);
  if (!o.unit) {
    o.unit = {
      glucose: 'mg/dL', bloodPressureSystolic: 'mmHg', bloodPressureDiastolic: 'mmHg', weight: 'kg', waist: 'cm', steps: 'steps',
      walkDistance: 'km', walkDuration: 'min', movementMinutes: 'min', water: 'ml', sleep: 'h', backPain: '0-10', legPain: '0-10',
      hba1c: '%', b12: 'pg/mL', vitaminD: 'ng/mL',
    }[o.kind];
  }
  return o;
}

/** Write a fixture file for the app's file chooser. `content` is a document, a string or bytes. */
export function writeFixture(t, name, content, { gzip = false } = {}) {
  const dir = path.join(t.dir, 'fixtures');
  fs.mkdirSync(dir, { recursive: true });
  let bytes = typeof content === 'string' ? Buffer.from(content) : Buffer.isBuffer(content) || content instanceof Uint8Array ? Buffer.from(content) : Buffer.from(JSON.stringify(content));
  if (gzip) bytes = zlib.gzipSync(bytes);
  const file = path.join(dir, name);
  fs.writeFileSync(file, bytes);
  return file;
}

/** A backup file's bytes, read back the way the app reads them (gzip by magic number). */
export function decodeBackup(bytes) {
  const buf = Buffer.from(bytes);
  const text = buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b ? zlib.gunzipSync(buf) : buf;
  return JSON.parse(text.toString('utf8'));
}

// ---------------------------------------------------------------- navigation

/** You → Data & offline, the way a person gets there. */
export async function openData(t) {
  const page = t.page;
  if (!/^\/you\/data/.test(await t.route())) {
    await ui.tab(page, 'Today');
    await ui.tap(page.getByRole('link', { name: /^You:/ }));
    await page.getByRole('heading', { level: 1, name: 'You', exact: true }).waitFor();
    await ui.tap(ui.row(page.getByRole('main'), 'Data & offline', 'link'));
  }
  await page.getByRole('heading', { level: 1, name: 'Data & offline', exact: true }).waitFor();
  return page.getByRole('main');
}

/**
 * Back up your record and hand the file over. Returns what left the app:
 * a download (`{ via: 'download', name, bytes }`), a captured share
 * (`{ via: 'share', name, type, bytes }`), or `{ via: 'none' }`.
 */
export async function backup(t, { expectVia, keepOpen = false } = {}) {
  const page = t.page;
  const main = await openData(t);
  await ui.tap(ui.row(main, 'Back up your record'));
  const sheet = page.getByRole('dialog', { name: 'Back up your record' });
  await sheet.waitFor();
  const button = sheet.getByRole('button', { name: /^(Download|Save or share)$/ });
  await button.waitFor({ state: 'visible', timeout: 15000 });
  const label = (await button.innerText()).trim();
  if (expectVia === 'download' && label !== 'Download') throw new Error(`the backup button says “${label}”, not Download`);
  if (expectVia === 'share' && label !== 'Save or share') throw new Error(`the backup button says “${label}”, not Save or share`);
  const fileLine = (await sheet.innerText()).match(/[\w.-]+\.json(\.gz)?, [\d,.]+ (KB|MB)/)?.[0];
  let result;
  if (label === 'Download') {
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), ui.tap(button)]);
    const file = await download.path();
    const bytes = fs.readFileSync(file);
    const name = download.suggestedFilename();
    fs.writeFileSync(path.join(t.dir, `downloaded-${name}`), bytes);
    result = { via: 'download', name, bytes };
  } else {
    await ui.tap(button);
    await page.waitForTimeout(400);
    const shares = await page.evaluate(() => window.__acc?.shares ?? []);
    const f = shares.at(-1)?.files?.[0];
    if (f?.bytes) {
      const bytes = Buffer.from(f.bytes);
      fs.writeFileSync(path.join(t.dir, `shared-${f.name}`), bytes);
      result = { via: 'share', name: f.name, type: f.type, bytes };
    } else {
      result = { via: 'none', shares };
    }
  }
  await page.waitForTimeout(500);
  // What the sheet said afterwards ("Downloaded…", "Done…", or nothing for a cancelled share), then close it.
  const said = (await sheet.innerText()).replace(/\s+/g, ' ');
  if (!keepOpen) {
    await ui.tap(ui.button(sheet, 'Close'));
    await sheet.waitFor({ state: 'hidden' });
  }
  return { ...result, label, fileLine, said, sheet };
}

/** Choose a file in Restore from a backup; returns the restore sheet. `from` is 'you' or 'welcome'. */
export async function chooseRestore(t, file, { from = 'you' } = {}) {
  const page = t.page;
  const main = from === 'you' ? await openData(t) : page.getByRole('main');
  const trigger = from === 'you' ? ui.row(main, 'Restore from a backup') : ui.button(main, 'Restore from a backup');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 10000 }), ui.tap(trigger)]);
  await chooser.setFiles(file);
  const sheet = page.getByRole('dialog', { name: 'Restore from a backup' });
  await sheet.waitFor({ timeout: 15000 });
  await page.waitForTimeout(300);
  return sheet;
}

/** Choose another file inside an open restore sheet that is showing a problem. */
export async function chooseAnother(t, sheet, file) {
  const [chooser] = await Promise.all([t.page.waitForEvent('filechooser', { timeout: 10000 }), ui.tap(ui.button(sheet, 'Choose another file'))]);
  await chooser.setFiles(file);
  await t.page.waitForTimeout(500);
}

/** Merge from an open restore preview, with the conflict choice if asked. Waits for the outcome. */
export async function merge(t, sheet, { takeFile = false } = {}) {
  if (takeFile) await ui.tap(sheet.getByRole('radio', { name: 'Use the file’s copy', exact: true }));
  await ui.tap(sheet.getByRole('button', { name: /^Merge into this / }));
  await waitOutcome(t, sheet);
}

/** Wait until the restore sheet shows a result (done or problem). */
export async function waitOutcome(t, sheet) {
  await t.page.waitForFunction(el => !/Restoring…|Merging…/.test(el?.innerText ?? '') && /Restored\.|Merged\.|Nothing was changed|cannot be read|could not be read|newer version|different app|not a health record/.test(el?.innerText ?? ''),
    await sheet.elementHandle(), { timeout: 15000 });
  await t.page.waitForTimeout(250);
}

// ---------------------------------------------------------------- Track

/** Open Quick Log's chooser from Track's own Add button (the one in the bar). */
export async function openAdd(t) {
  const page = t.page;
  if (!/^\/track(\?|$)/.test(await t.route())) await ui.tab(page, 'Track');
  await ui.tap(ui.header(page).getByRole('button', { name: 'Add a record', exact: true }));
  const add = page.getByRole('dialog', { name: 'Add' });
  await add.waitFor();
  return add;
}

/** Open one Quick Log form from the chooser. */
export async function openForm(t, label, title = label) {
  const add = await openAdd(t);
  await ui.tap(ui.row(add, label));
  const form = t.page.getByRole('dialog', { name: title });
  await form.waitFor();
  return form;
}

/**
 * Save a Quick Log form and wait for its outcome: the sheet closes, shows the
 * safety guidance (title "Saved" / "What to do"), or shows an error.
 */
export async function saveForm(t, form, label = 'Save') {
  const page = t.page;
  await ui.tap(form.getByRole('button', { name: label, exact: true }));
  const guidance = page.getByRole('dialog', { name: /^(Saved|What to do)$/ });
  const error = form.getByRole('alert');
  const outcome = await Promise.race([
    form.waitFor({ state: 'hidden', timeout: 10000 }).then(() => 'closed'),
    guidance.waitFor({ timeout: 10000 }).then(() => 'guidance'),
    error.waitFor({ timeout: 10000 }).then(() => 'error'),
  ]).catch(() => 'timeout');
  await page.waitForTimeout(300);
  if (outcome === 'error') throw new Error(`the ${label} did not save: ${(await error.innerText()).trim()}`);
  if (outcome === 'timeout') throw new Error(`nothing happened after ${label}`);
  // The guidance view renames the same sheet, so the old name vanishing is not proof it closed.
  if (await guidance.count()) return 'guidance';
  return outcome;
}

/** The day-total steps or sleep form: value, and a past day if given. */
export async function logTotal(t, kind, value, day) {
  const form = await openForm(t, kind === 'steps' ? 'Steps' : 'Sleep');
  await ui.type(form.getByRole('textbox', { name: kind === 'steps' ? 'Steps for the day' : 'Hours slept', exact: true }), String(value));
  if (day) {
    await ui.tap(ui.row(form, kind === 'steps' ? 'Day' : 'Woke up on'));
    await ui.setDate(form.getByLabel(kind === 'steps' ? /^Day/ : /^Woke up on/), day);
  }
  await saveForm(t, form);
}

/** Water: type the amount and tap its Add button. */
export async function logWater(t, ml) {
  const form = await openForm(t, 'Water');
  await ui.type(form.getByRole('textbox', { name: 'Amount to add', exact: true }), String(ml));
  await saveForm(t, form, `Add ${ml} ml`);
}

/** A glucose reading with optional tag, meal start and reading time (`YYYY-MM-DDTHH:MM`). */
export async function logGlucose(t, { value, unit, tag, mealStart, at }) {
  const form = await openForm(t, 'Glucose');
  if (unit) await ui.tap(ui.radio(form.getByRole('radiogroup', { name: 'Glucose unit' }), unit));
  await ui.type(form.getByRole('textbox', { name: 'Reading', exact: true }), String(value));
  if (tag) await ui.tap(form.getByRole('button', { name: tag, exact: true }));
  if (mealStart) await ui.setTime(form.getByLabel('Meal started at', { exact: true }), mealStart);
  if (at) {
    await ui.tap(ui.row(form, 'Time'));
    await ui.setDateTime(form.getByLabel('Time', { exact: true }), at);
  }
  await saveForm(t, form);
}

/** Weight or waist. */
export async function logMeasure(t, kind, value) {
  const label = kind === 'weight' ? 'Weight' : 'Waist';
  const form = await openForm(t, label);
  await ui.type(form.getByRole('textbox', { name: label, exact: true }), String(value));
  await saveForm(t, form);
}

/** Back and/or leg pain; `undefined` leaves a field blank. */
export async function logPain(t, { back, leg }) {
  const form = await openForm(t, 'Back & leg pain');
  if (back !== undefined) await ui.type(form.getByRole('textbox', { name: 'Back pain', exact: true }), String(back));
  if (leg !== undefined) await ui.type(form.getByRole('textbox', { name: 'Leg pain', exact: true }), String(leg));
  await saveForm(t, form);
}

/** A lab result. `lab` is the segmented label: HbA1c, Vitamin B12, Vitamin D. */
export async function logLab(t, lab, value, unit) {
  const form = await openForm(t, 'Lab result');
  await ui.tap(ui.radio(form.getByRole('radiogroup', { name: 'Which result' }), lab));
  if (unit) await ui.tap(ui.radio(form.getByRole('radiogroup', { name: `${lab} unit` }), unit));
  await ui.type(form.getByRole('textbox', { name: lab, exact: true }), String(value));
  await saveForm(t, form);
}

// ---------------------------------------------------------------- snapshots

const stripSeq = o => { if (!o || typeof o !== 'object') return o; const { seq, ...rest } = o; void seq; return rest; };

/** The logical record a snapshot holds: what a comparison should look at. */
export function logical(snap, { ignoreExportDate = false } = {}) {
  const d = docs(snap);
  const settings = d.settings === undefined ? undefined : structuredClone(d.settings);
  if (ignoreExportDate && settings?.habits) {
    // The record of backups itself (the date and the observation stamp it
    // covered): the spec's export-date exception, and what the app's own
    // backup comparison leaves out (src/screens/you/backupFile.ts settingsKey).
    delete settings.habits.lastExportAt;
    delete settings.habits.lastExportSeq;
    if (Object.keys(settings.habits).length === 0) delete settings.habits;
  }
  const content = {};
  for (const row of snap['content-state'] ?? []) content[row.key] = row.value;
  return {
    observations: Object.fromEntries((snap.observations ?? []).map(o => [o.id, stripSeq(o)])),
    sessions: Object.fromEntries((snap.sessions ?? []).map(s => [s.id, s])),
    settings,
    profile: d.profile,
    checkIns: d.checkIns ?? [],
    personalRecords: d.personalRecords ?? [],
    bodyMetrics: d.bodyMetrics ?? [],
    focusOverrides: d.focusOverrides ?? {},
    content,
  };
}

/** The logical record a backup document describes. */
export function logicalFromDoc(doc, { ignoreExportDate = false } = {}) {
  const settings = doc.settings === undefined ? undefined : structuredClone(doc.settings);
  if (ignoreExportDate && settings?.habits) {
    // The record of backups itself (the date and the observation stamp it
    // covered): the spec's export-date exception, and what the app's own
    // backup comparison leaves out (src/screens/you/backupFile.ts settingsKey).
    delete settings.habits.lastExportAt;
    delete settings.habits.lastExportSeq;
    if (Object.keys(settings.habits).length === 0) delete settings.habits;
  }
  return {
    observations: Object.fromEntries((doc.observations ?? []).map(o => [o.id, stripSeq(o)])),
    sessions: Object.fromEntries((doc.sessions ?? []).map(s => [s.id, s])),
    settings,
    profile: doc.profile,
    checkIns: doc.checkIns ?? [],
    personalRecords: doc.personalRecords ?? [],
    bodyMetrics: doc.bodyMetrics ?? [],
    focusOverrides: doc.focusOverrides ?? {},
    content: Object.fromEntries((doc.contentState ?? []).map(r => [r.key, r.value])),
  };
}

const canon = v => JSON.stringify(sortKeys(v));
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => [k, sortKeys(v[k])]));
  return v;
}

/** Differences between two logical records, as short lines; empty when equal. */
export function compareLogical(a, b, { label = ['expected', 'actual'] } = {}) {
  const out = [];
  for (const part of ['observations', 'sessions']) {
    const x = a[part] ?? {};
    const y = b[part] ?? {};
    for (const id of Object.keys(x)) {
      if (!(id in y)) out.push(`${part} ${id} only in ${label[0]}`);
      else if (canon(x[id]) !== canon(y[id])) out.push(`${part} ${id} differs: ${label[0]} ${canon(x[id]).slice(0, 160)} vs ${label[1]} ${canon(y[id]).slice(0, 160)}`);
    }
    for (const id of Object.keys(y)) if (!(id in x)) out.push(`${part} ${id} only in ${label[1]}`);
  }
  for (const part of ['settings', 'profile', 'checkIns', 'personalRecords', 'bodyMetrics', 'focusOverrides', 'content']) {
    if (canon(a[part]) !== canon(b[part])) out.push(`${part} differs: ${label[0]} ${canon(a[part]).slice(0, 200)} vs ${label[1]} ${canon(b[part]).slice(0, 200)}`);
  }
  return out;
}

/** Everything the snapshot holds, compared raw (revision included unless told otherwise). */
export function sameSnapshot(a, b, { ignore = [] } = {}) {
  const pick = s => {
    const rows = {};
    for (const store of ['observations', 'sessions', 'settings', 'content-state']) {
      rows[store] = (s?.[store] ?? []).filter(r => !(store === 'settings' && ignore.includes(r.key)))
        .map(r => canon(r)).sort();
    }
    return rows;
  };
  const x = pick(a);
  const y = pick(b);
  const diffs = [];
  for (const store of Object.keys(x)) {
    const only = (p, q) => p.filter(r => !q.includes(r));
    for (const r of only(x[store], y[store])) diffs.push(`- ${store} ${r.slice(0, 200)}`);
    for (const r of only(y[store], x[store])) diffs.push(`+ ${store} ${r.slice(0, 200)}`);
  }
  return diffs;
}

/** App-owned web storage keys: everything but the test namespace. */
export function appKeys(storage) {
  return Object.keys(storage.local).filter(k => !k.startsWith('__acceptance:')).sort();
}

/** Poll the database until `pred(snapshot)` holds, or fail with `message`. */
export async function waitDb(t, pred, message, timeout = 10000) {
  const until = Date.now() + timeout;
  let snap;
  while (Date.now() < until) {
    snap = await t.db();
    if (pred(snap)) return snap;
    await t.page.waitForTimeout(200);
  }
  throw new Error(message);
}

/**
 * After Restore on Welcome: the record lands, onboarding is complete, and
 * the app moves on to Today — possibly before the confirmation can be read,
 * which is noted rather than failed. Returns what was seen.
 */
export async function restoredFromWelcome(t, sheet) {
  const page = t.page;
  const today = page.getByRole('heading', { level: 1, name: 'Today', exact: true });
  const done = sheet.getByRole('button', { name: 'Done', exact: true });
  const problem = sheet.getByText(/Nothing was changed/);
  const seen = await Promise.race([
    done.waitFor({ timeout: 15000 }).then(() => 'done'),
    today.waitFor({ timeout: 15000 }).then(() => 'today'),
    problem.waitFor({ timeout: 15000 }).then(() => 'problem'),
  ]).catch(() => 'timeout');
  if (seen === 'problem') throw new Error(`the restore failed: ${(await sheet.innerText()).replace(/\s+/g, ' ').slice(0, 200)}`);
  if (seen === 'timeout') throw new Error('nothing happened after Restore');
  let confirmed = false;
  if (seen === 'done') {
    confirmed = /Restored\./.test(await sheet.innerText());
    await ui.tap(done);
  } else {
    t.note('Restore on Welcome moved straight to Today: the “Restored” confirmation was not left on screen');
  }
  await today.waitFor({ timeout: 15000 });
  await t.ready();
  return { seen, confirmed };
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * My Day to a calendar day, one Previous/Next tap at a time, waiting for the
 * day heading to change after each tap (so a slow render cannot cause an
 * extra tap and overshoot). Returns the day heading.
 */
export async function trackDay(page, ymd) {
  const main = page.getByRole('main');
  const [, wm, wd] = ymd.split('-').map(Number);
  const want = `${wd} ${MONTHS[wm - 1]}`;
  const read = async () => (await main.getByRole('heading', { level: 2 }).first().innerText()).replace(/\s+/g, ' ');
  // A view transition can leave the old screen up after the address has changed.
  await page.getByRole('heading', { level: 1, name: 'My Day', exact: true }).waitFor({ timeout: 15000 });
  for (let i = 0; i < 60; i++) {
    const heading = await read();
    if (new RegExp(`\\b${want}\\b`).test(heading)) return heading;
    const m = /(\d{1,2}) (January|February|March|April|May|June|July|August|September|October|November|December)/.exec(heading);
    if (!m) throw new Error(`My Day heading “${heading}” names no day`);
    const shown = MONTHS.indexOf(m[2]) * 31 + Number(m[1]);
    const target = (wm - 1) * 31 + wd;
    await ui.tap(main.getByRole('button', { name: target < shown ? /^Previous day/ : /^Next day/ }));
    // Read the heading the same way as above until it moves: one tap, one day.
    const until = Date.now() + 15000;
    while (Date.now() < until && (await read()) === heading) await page.waitForTimeout(100);
  }
  throw new Error(`My Day never reached ${want}`);
}
