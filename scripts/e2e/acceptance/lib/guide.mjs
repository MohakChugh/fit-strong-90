/**
 * Helpers for J06 and J07: entries through Track → Add, record details, a
 * short timed walk, Today's Status sheet, the habit sheets, and a reader for
 * the calendar file. Every mutation goes through the interface.
 */
import fs from 'node:fs';
import * as ui from './ui.mjs';
import * as move from './move.mjs';

/** Track → Add a record → one form. Returns the form's sheet. */
export async function openAdd(t, kindLabel) {
  const page = t.page;
  if (!(await t.route()).startsWith('/track')) await tabTo(t, 'Track');
  await ui.tap(ui.header(page).getByRole('button', { name: 'Add a record', exact: true }));
  const add = page.getByRole('dialog', { name: 'Add' });
  await add.waitFor();
  await ui.tap(ui.row(add, kindLabel));
  const form = page.getByRole('dialog');
  await form.waitFor();
  return form;
}

/** Wait for a Quick Log form to close after Save, or fail with what it said instead. */
async function saved(t, form, what) {
  try {
    await form.waitFor({ state: 'hidden', timeout: 8000 });
  } catch {
    throw new Error(`${what} did not save: ${(await form.innerText()).replace(/\s+/g, ' ').slice(0, 240)}`);
  }
  await t.page.waitForTimeout(300);
}

/**
 * A lab result through Track → Add → Lab result. `lab` is the radio label
 * (HbA1c, Vitamin B12, Vitamin D); `day` is the Date of test, today when absent.
 */
export async function addLab(t, lab, value, { unit, day } = {}) {
  const form = await openAdd(t, 'Lab result');
  await ui.tap(ui.radio(form.getByRole('radiogroup', { name: 'Which result' }), lab));
  if (unit) await ui.tap(ui.radio(form.getByRole('radiogroup', { name: `${lab} unit` }), unit));
  await ui.type(form.getByRole('textbox', { name: lab, exact: true }), value);
  if (day) {
    await ui.tap(ui.row(form, 'Date of test'));
    await ui.setDate(form.getByLabel(/^Date of test/), day);
  }
  await ui.tap(ui.button(form, 'Save'));
  await saved(t, form, `${lab} ${value}`);
}

/** Weight or waist through Track → Add. */
export async function addMeasure(t, kindLabel, value) {
  const form = await openAdd(t, kindLabel);
  const box = form.getByRole('textbox');
  if (await box.count() !== 1) throw new Error(`the ${kindLabel} form has ${await box.count()} text fields`);
  await ui.type(box, value);
  await ui.tap(ui.button(form, 'Save'));
  await saved(t, form, `${kindLabel} ${value}`);
}

/** Steps for a day through Track → Add → Steps. */
export async function addSteps(t, value, day) {
  const form = await openAdd(t, 'Steps');
  await ui.type(form.getByRole('textbox', { name: 'Steps for the day', exact: true }), value);
  if (day) {
    await ui.tap(ui.row(form, 'Day'));
    await ui.setDate(form.getByLabel(/^Day/), day);
  }
  await ui.tap(ui.button(form, 'Save'));
  await saved(t, form, `steps ${value}`);
}

/** Open a record on the My Day timeline by its exact title, and wait for its screen. */
export async function openRecord(t, title) {
  const page = t.page;
  const main = page.getByRole('main');
  await ui.tap(ui.row(main, title, 'link'));
  await page.getByRole('heading', { level: 1, name: title, exact: true }).waitFor();
  await page.waitForTimeout(250);
}

/** The interpretation box on a record or metric screen: its text, framework line included. */
export async function interpretationText(page) {
  const main = page.getByRole('main');
  const boxes = main.locator('div.rounded-xl').filter({ hasText: 'General information, not medical advice.' });
  const texts = [];
  for (const b of await boxes.all()) texts.push((await b.innerText()).replace(/\s+/g, ' ').trim());
  return texts.join(' | ');
}

/** The stored observations of one kind. */
export const ofKind = (snap, kind) => (snap?.observations ?? []).filter(o => o.kind === kind);

/**
 * A timed walk of `minutes` through Move → Walk: the check-in with the
 * persona's normal answers, Start walk, foreground minutes on the test clock,
 * Finish, Save walk, Done.
 */
export async function timedWalk(t, persona, minutes) {
  const page = t.page;
  const r = await move.enter(t, 'walk', 'move');
  if (r.sheet) {
    await ui.answerCheckIn(t, r.sheet, ui.normalAnswers(persona));
    await page.waitForTimeout(400);
    const start = move.sheetStart(r.sheet);
    if (!(await start.count())) throw new Error(`the check-in did not allow a walk: ${(await r.sheet.innerText()).replace(/\s+/g, ' ').slice(0, 300)}`);
    await ui.tap(start);
  }
  await page.waitForFunction(() => location.hash.startsWith('#/walk/live'), null, { timeout: 10000 });
  await page.getByRole('timer').waitFor();
  for (let i = 0; i < minutes; i++) await t.advance(60_000);
  await ui.tap(ui.button(page.getByRole('main'), 'Finish'));
  const confirm = page.getByRole('dialog', { name: 'Finish walk' });
  await confirm.waitFor();
  await ui.tap(ui.button(confirm, 'Finish walk'));
  await page.getByRole('heading', { level: 1, name: 'Your walk', exact: true }).waitFor();
  await ui.tap(ui.button(page.getByRole('main'), 'Save walk'));
  await page.getByText('Saved on this', { exact: false }).waitFor({ timeout: 10000 });
  await ui.tap(ui.button(page.getByRole('main'), 'Done'));
  await page.waitForTimeout(500);
}

/** Today → Status row → a status → its apply button. Returns the sheet (still open when an offer follows). */
export async function setStatus(t, label) {
  const page = t.page;
  if (await t.route() !== '/today') await tabTo(t, 'Today');
  await ui.tap(ui.row(page.getByRole('main'), 'Status'));
  const sheet = page.getByRole('dialog', { name: 'Status' });
  await sheet.waitFor();
  // Each status is a radio row whose name carries its meaning too: find it by its exact label.
  await ui.tap(ui.row(sheet.getByRole('radiogroup', { name: 'Status' }), label, 'radio'));
  const apply = sheet.getByRole('button', { name: label === 'Normal' ? /^(Back to normal|Done)$/ : new RegExp(`^(Set to ${label}|Done)$`) });
  await ui.tap(apply);
  await page.waitForTimeout(600);
  return sheet;
}

/** You → Habits & reminders, from anywhere. */
export async function openHabits(t) {
  const page = t.page;
  await tabTo(t, 'Today');
  await ui.tap(page.getByRole('link', { name: /^You:/ }));
  await ui.tap(ui.row(page.getByRole('main'), 'Habits & reminders', 'link'));
  await page.getByRole('heading', { level: 1, name: 'Habits & reminders', exact: true }).waitFor();
}

/** A row-button on the Habits screen by its exact label (the switch beside it is separate). */
export async function openHabitSheet(t, label, title = label) {
  const page = t.page;
  await ui.tap(ui.row(page.getByRole('main'), label));
  const sheet = page.getByRole('dialog', { name: title });
  await sheet.waitFor();
  return sheet;
}

/** Sitting breaks: every N minutes from–until, then Turn on / Save. */
export async function setSittingBreaks(t, every, from, to) {
  const sheet = await openHabitSheet(t, 'Sitting breaks');
  await ui.tap(ui.radio(sheet.getByRole('radiogroup', { name: 'Remind me every' }), `${every} min`));
  await ui.setTime(sheet.getByLabel('From', { exact: true }), from);
  await ui.setTime(sheet.getByLabel('Until', { exact: true }), to);
  await ui.tap(sheet.getByRole('button', { name: /^(Turn on|Save)$/ }));
  await sheet.waitFor({ state: 'hidden' });
}

/** Walk after meals: exactly these meals, with their finish times. */
export async function setMealWalk(t, meals) {
  const sheet = await openHabitSheet(t, 'Walk after meals');
  const group = sheet.getByRole('group', { name: 'After which meals?' });
  for (const name of ['Breakfast', 'Lunch', 'Dinner']) {
    const box = ui.checkbox(group, name);
    const on = (await box.getAttribute('aria-checked')) === 'true';
    if (on !== Object.hasOwn(meals, name)) await ui.tap(box);
  }
  for (const [name, time] of Object.entries(meals)) await ui.setTime(sheet.getByLabel(name, { exact: true }), time);
  await ui.tap(sheet.getByRole('button', { name: /^(Turn on|Save)$/ }));
  await sheet.waitFor({ state: 'hidden' });
}

/** Quiet hours on, from–until. */
export async function setQuietHours(t, from, to) {
  const sheet = await openHabitSheet(t, 'Quiet hours');
  const toggle = sheet.getByRole('switch', { name: 'Quiet hours', exact: true });
  if ((await toggle.getAttribute('aria-checked')) !== 'true') await ui.tap(toggle);
  await ui.setTime(sheet.getByLabel('From', { exact: true }), from);
  await ui.setTime(sheet.getByLabel('Until', { exact: true }), to);
  await ui.tap(ui.button(sheet, 'Save'));
  await sheet.waitFor({ state: 'hidden' });
}

/** The reminder banners on screen right now (the app shows at most one). */
export async function banners(page) {
  const list = page.getByRole('region', { name: 'Reminder' });
  const out = [];
  for (const b of await list.all()) out.push((await b.innerText()).replace(/\s+/g, ' ').trim());
  return out;
}

/** Answer the banner on screen with one of its buttons. */
export async function answerBanner(page, label) {
  await ui.tap(page.getByRole('region', { name: 'Reminder' }).getByRole(label === 'Start a walk' ? 'link' : 'button', { name: new RegExp(`^${label}`) }));
  await page.waitForTimeout(300);
}

/** Parse an iCalendar file into events (unfolded, unescaped enough to assert on). */
export function parseIcs(text) {
  const lines = text.replace(/\r\n[ \t]/g, '').split(/\r\n/).filter(Boolean);
  const events = [];
  let ev = null;
  let alarm = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { ev = { alarms: [] }; continue; }
    if (line === 'END:VEVENT') { events.push(ev); ev = null; continue; }
    if (line === 'BEGIN:VALARM') { alarm = {}; continue; }
    if (line === 'END:VALARM') { ev?.alarms.push(alarm); alarm = null; continue; }
    const i = line.indexOf(':');
    const key = line.slice(0, i).split(';')[0];
    const value = line.slice(i + 1).replace(/\\n/g, '\n').replace(/\\([,;\\])/g, '$1');
    if (alarm) alarm[key] = value;
    else if (ev) ev[key] = value;
  }
  return { lines, events, crlf: /\r\n/.test(text) && !/[^\r]\n/.test(text) };
}

/** Catch a download started by `act`, returning its name and text. */
export async function download(t, act) {
  const [file] = await Promise.all([t.page.waitForEvent('download', { timeout: 10000 }), act()]);
  const path = await file.path();
  return { name: file.suggestedFilename(), text: fs.readFileSync(path, 'utf8') };
}

const TAB_PATH = { Today: '/today', Move: '/move', Track: '/track', Guide: '/guide' };
const TAB_TITLE = { Today: 'Today', Move: 'Move', Track: 'My Day', Guide: 'Guide' };

/**
 * A tab's root screen, waiting until it is up: the address is the tab's and
 * the screen's title is the tab's. `ui.tab` taps again when the tab returns
 * to where it was left.
 */
export async function tabTo(t, name) {
  const page = t.page;
  await ui.tab(page, name);
  await page.waitForFunction(p => location.hash.replace(/^#/, '').split('?')[0] === p, TAB_PATH[name], { timeout: 10000 });
  await page.getByRole('main').getByRole('heading', { level: 1, name: TAB_TITLE[name], exact: true }).waitFor();
  await page.waitForTimeout(150);
}
