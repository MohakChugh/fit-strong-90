/**
 * Helpers for J15–J17 (fork C): the exercise catalogue's own safety flags,
 * reading what a player actually runs, and the movement evidence a refusal
 * must leave untouched.
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO } from './env.mjs';
import * as ui from './ui.mjs';

/**
 * Exercise names whose catalogue entry carries `flag` (e.g. `weightBearing:
 * true`, `headBelowHeart: true`, `valsalva: 2`). Read from the catalogue
 * source, so the test follows the app's own classification rather than a
 * copy of it. Every catalogue entry is one line.
 */
export function namesWith(flagSource) {
  const out = new Set();
  for (const f of ['mobility.ts', 'strength.ts', 'cardio.ts']) {
    const text = fs.readFileSync(path.join(REPO, 'src/data/catalog', f), 'utf8');
    for (const line of text.split('\n')) {
      if (!line.includes(flagSource)) continue;
      const m = /name:\s*(['"])(.+?)\1/.exec(line);
      if (m) out.add(m[2].replace(/\\'/g, "'"));
    }
  }
  return out;
}

/** Ids, rather than names, for the same flag. */
export function idsWith(flagSource) {
  const out = new Set();
  for (const f of ['mobility.ts', 'strength.ts', 'cardio.ts']) {
    const text = fs.readFileSync(path.join(REPO, 'src/data/catalog', f), 'utf8');
    for (const line of text.split('\n')) {
      if (!line.includes(flagSource)) continue;
      const m = /id:\s*'([a-z0-9-]+)'/.exec(line);
      if (m) out.add(m[1]);
    }
  }
  return out;
}

/** Names from a list that the catalogue gives a flag. */
export const flagged = (names, set) => names.filter(n => [...set].some(s => n.toLowerCase().includes(s.toLowerCase())));

/** The Stretch setup screen's "In this routine" rows: exercise names. */
export async function stretchPreview(page) {
  const group = ui.section(page.getByRole('main'), 'In this routine');
  if (!(await group.count())) return [];
  const rows = await group.locator('span.whitespace-normal').allInnerTexts();
  return rows.map(s => s.trim()).filter(Boolean);
}

/** Walk records in a database snapshot. */
export const walkRows = snap => (snap?.observations ?? []).filter(o => /^walk:/.test(o.context ?? '') || ['walkDuration', 'walkDistance', 'movementMinutes'].includes(o.kind));

/** Steps day totals or session steps. */
export const stepRows = snap => (snap?.observations ?? []).filter(o => o.kind === 'steps');

/** The player's progress cache (guided or stretch slot). */
export async function progress(page, slot) {
  return page.evaluate(k => { try { return JSON.parse(localStorage.getItem(k) ?? 'null'); } catch { return null; } }, slot === 'stretch' ? 'fit-strong-90-stretch' : 'fit-strong-90-guided');
}

/** The h1 of the player, trimmed. */
export async function playerTitle(page) {
  const h = page.getByRole('main').getByRole('heading', { level: 1 });
  return (await h.count()) ? (await h.first().innerText()).trim() : '';
}

/**
 * Step through a running player with Next, recording each step that stays on
 * screen (a step the player refuses is skipped by the player itself before it
 * settles). Stops at the summary or after `max` steps.
 */
export async function stepThrough(t, max = 120) {
  const page = t.page;
  const seen = [];
  for (let i = 0; i < max; i++) {
    await page.waitForTimeout(450);
    // One task per step: read the title and press Next in the page itself. The
    // 3D demo renders in software here and can starve the page of the frames
    // Playwright's actionability checks wait for; the tap is the same button.
    const r = await page.evaluate(() => {
      const main = document.querySelector('main');
      if ([...document.querySelectorAll('button')].some(b => /Save and finish/.test(b.textContent ?? ''))) return { done: true };
      const title = main?.querySelector('h1')?.textContent?.trim() ?? '';
      const next = main?.querySelector('button[aria-label="Next"]');
      if (!next || next.disabled) return { title, stuck: true };
      next.click();
      return { title };
    });
    if (r.done) return { seen, done: true };
    if (r.title && seen.at(-1) !== r.title) seen.push(r.title);
    if (r.stuck) return { seen, done: false };
  }
  return { seen, done: false };
}

/** Labels of every button on screen, for "no ordinary start" checks. */
export async function buttonLabels(scope) {
  const out = [];
  for (const b of await scope.getByRole('button').all()) {
    const name = ((await b.getAttribute('aria-label')) || (await b.innerText().catch(() => ''))).replace(/\s+/g, ' ').trim();
    if (name) out.push(name);
  }
  return out;
}

/** Labels that would start or resume movement. */
export const STARTERS = /^(Start|Start walk|Start stretch|Start session|Start recovery session|Resume|Continue|Continue walking|Continue session|Continue stretch|Check in & (start|stretch|walk)|I am fine: carry on walking|Keep going|Keep walking)$/;

/**
 * The outcome headline and text on screen: the check-in sheet when it is
 * open, else the main landmark (a gate screen). `ui.outcomeTitle` builds its
 * `has` filter from the scope, which never matches inside a section; this
 * builds it from the page.
 */
export async function outcome(page) {
  const sheet = page.getByRole('dialog', { name: ui.CHECKIN });
  const scope = (await sheet.count()) ? sheet : page.getByRole('main');
  const banner = scope.locator('section[role="alert"], section[role="status"]').filter({ has: page.locator('h2') });
  let title;
  if (await banner.count()) title = (await banner.last().locator('h2').first().innerText()).trim();
  const text = (await scope.innerText().catch(() => '')).replace(/\s+/g, ' ');
  return { title, text, scope };
}

/** The summary screen of a player: the Save and finish button is on screen. */
export const atSummary = async page => (await page.getByRole('button', { name: /Save and finish/ }).count()) > 0;

/**
 * `t.open`, with action timeouts suited to a loaded machine: the 3D demos
 * render in software here, which can stall a page for seconds. A control
 * that is genuinely missing still fails, just later.
 */
export async function openApp(t, opts) {
  const page = await t.open(opts);
  t.context.setDefaultTimeout(45000);
  return page;
}

/**
 * Into the guided session from Move. Enrolled, the row starts it (through the
 * check-in). Not enrolled, the row is the 12-week programme's page instead,
 * and since D35 nothing outside the programme starts the session, so this
 * returns `viaProgramme` with that page's text and no sheet. A case about
 * the session itself enrols its persona first.
 */
export async function openGuided(t) {
  const page = t.page;
  const main = page.getByRole('main');
  await ui.tab(page, 'Move');
  const start = ui.row(main, 'Guided session');
  const programme = ui.row(main, 'Guided session', 'link');
  const sheet = page.getByRole('dialog', { name: ui.CHECKIN });
  // Either the start row or the programme link, once the lazily loaded screen is in.
  await start.or(programme).waitFor({ timeout: 30000 });
  if (await start.count()) {
    await ui.tap(start);
    await page.waitForTimeout(500);
    if (await sheet.count()) return { sheet, route: await t.route(), viaProgramme: false };
    return { route: await t.route(), viaProgramme: false };
  }
  await ui.tap(programme);
  await page.getByRole('heading', { level: 1, name: 'Your plan', exact: true }).waitFor();
  const programmeText = (await main.innerText()).replace(/\s+/g, ' ');
  return { route: await t.route(), viaProgramme: true, programmeText };
}
