/**
 * Helpers for the glucose, freshness and ketone safety families (J09, J12,
 * J14): read what each movement entry answers, and what the record holds.
 *
 * Owned by these three journeys; the shared libraries stay untouched.
 */
import { docs } from './harness.mjs';
import * as ui from './ui.mjs';
import { checkInSheet, enter } from './move.mjs';

/**
 * A permission-approved start in the check-in sheet. Today's sheet says
 * "Continue to walk" / "Continue to stretch" (screens/today/model.ts
 * `startLabelFor`), which `move.sheetStart` does not list.
 */
export const START = /^(Start session|Start recovery session|Start stretch|Start walk|Continue|Continue session|Continue stretch|Continue to stretch|Continue to walk)$/;
const sheetStart = sheet => sheet.getByRole('button', { name: START });

export const TODAY = '2026-10-08';

/** The copy table in codex-acceptance.md, "Execution and pass criteria". */
export const TITLE = {
  emergency: 'Call emergency services now',
  today: 'No exercise today. Get medical advice today.',
  recheck: 'Check again before you start',
  adjust: 'Go ahead, with changes',
  reassure: 'Good to go',
};
export const noModeTitle = mode => `No ${{ guided: 'session', stretch: 'stretch', walk: 'walk' }[mode]} for now`;
export const isHoldTitle = (title, mode) => title === TITLE.recheck || title === noModeTitle(mode);
export const isRefusalTitle = (title, mode) => [TITLE.emergency, TITLE.today].includes(title) || isHoldTitle(title, mode);
export const isAllowedTitle = title => title === TITLE.adjust || title === TITLE.reassure;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();

/**
 * Each mode's own player address, as a bookmark or a typed link would open it.
 * Guided's is the programme session; the stretch link is a ten-minute Back &
 * hips routine.
 */
export const LINK = { guided: '/session', stretch: '/session?mode=stretch&focus=backHips&minutes=10', walk: '/walk/live?id=accept-direct-walk' };

/** The open check-in sheet, waiting for it to appear. */
export async function openSheet(t, mode, via = 'move') {
  let r = via === 'move' ? await enterFromMove(t, mode) : await enter(t, mode, via);
  if (r.refusedOnSetup && r.review) {
    // A setup refusing before any tap (S-15) offers today's check-in in place of Start.
    await ui.tap(ui.button(t.page.getByRole('main'), 'Review today’s check-in'));
    r = { sheet: checkInSheet(t.page), route: await t.route() };
  }
  if (r.direct) {
    // D35: outside the programme, Guided is only a way to join it, and Today's
    // check-in for it records answers but starts nothing. A case that needs a
    // check-in uses Stretch or Walk, or enrols the persona first.
    throw new Error('Guided session: this persona is not in the programme (D35), so there is no guided check-in to open');
  }
  if (r.refusedOnSetup) throw new Error(`${mode} refused on its setup screen before any check-in: ${r.text}`);
  if (!r.sheet) throw new Error(`${mode} via ${via} did not open the check-in; it went to ${r.route}`);
  await r.sheet.waitFor();
  return r.sheet;
}

/**
 * What the sheet shows after an answer: the outcome headline, the banner's
 * own text, whether a permission-approved Start is offered and whether the
 * form (rather than the outcome) is up.
 */
export async function readSheet(sheet) {
  await sheet.page().waitForTimeout(250);
  const banner = sheet.locator('section[role="alert"], section[role="status"]').filter({ has: sheet.page().locator('h2') });
  const title = (await banner.count()) ? flat(await banner.last().locator('h2').first().innerText()) : undefined;
  const bannerText = (await banner.count()) ? flat(await banner.last().innerText()) : '';
  const startLabels = await sheetStart(sheet).allInnerTexts();
  const submit = sheet.getByRole('button', { name: ui.SUBMIT, exact: true });
  const blocked = sheet.locator('p[aria-live="polite"]');
  return {
    title, bannerText, text: flat(await sheet.innerText()),
    start: startLabels.length > 0, startLabels,
    form: (await submit.count()) > 0,
    submitDisabled: (await submit.count()) ? await submit.isDisabled() : undefined,
    newReading: (await sheet.getByRole('button', { name: 'Enter a new reading', exact: true }).count()) > 0,
    blocked: (await blocked.count()) ? flat(await blocked.first().innerText()) : undefined,
  };
}

/**
 * A tab's root screen (through `ui.tab`, which taps again when the tab
 * returns to where it was left), then that screen's own heading.
 */
export async function tabTo(page, name, heading = name) {
  await ui.tab(page, name);
  await page.getByRole('heading', { level: 1, name: heading, exact: true }).waitFor({ timeout: 20000 });
  await page.waitForTimeout(200);
}

/** Close the check-in sheet if it is open. */
export async function closeSheet(t) {
  const sheet = checkInSheet(t.page);
  if (await sheet.count()) {
    await ui.tap(ui.button(sheet, 'Close'));
    await sheet.waitFor({ state: 'hidden' });
  }
}

/**
 * Open a mode from Move the way a person does. Unlike `move.enter`, a setup
 * screen that refuses on its own (Walk shows "No walk today" with no Start
 * walk button) is an answer, not a missing control.
 */
export async function enterFromMove(t, mode) {
  const page = t.page;
  const main = page.getByRole('main');
  await ui.tab(page, 'Move');
  await page.getByRole('heading', { level: 1, name: 'Move', exact: true }).waitFor();
  if (mode === 'guided') {
    const start = ui.row(main, 'Guided session');
    const join = ui.row(main, 'Guided session', 'link');
    await start.or(join).waitFor();
    if (await start.count()) {
      await ui.tap(start);
    } else {
      // Not in the programme: Move offers to join it rather than a session, so
      // the session is attempted through its own address (a direct player route).
      await t.goto('/session');
      return { route: await t.route(), direct: true };
    }
  } else {
    const name = mode === 'stretch' ? 'Stretch' : 'Walk';
    await ui.tap(ui.row(main, name, 'link'));
    await page.getByRole('heading', { level: 1, name, exact: true }).waitFor();
    await page.waitForTimeout(250);
    // A walk left in progress is offered back first; going back to it is a resume.
    const pending = main.getByRole('button', { name: /^(Return to walk|Review and save)$/ });
    if (mode === 'walk' && await pending.count()) {
      await ui.tap(pending);
      await page.waitForTimeout(600);
      return { route: await t.route(), pending: true };
    }
    const start = ui.button(main, mode === 'stretch' ? 'Start stretch' : 'Start walk');
    const review = ui.button(main, 'Review today’s check-in');
    // S-15: while the engine refuses, the setup shows the reason and offers the check-in instead of Start.
    await start.or(review).or(ui.button(main, 'Open your health profile')).first().waitFor({ timeout: 10000 }).catch(() => {});
    if (!(await start.count()) || await start.isDisabled()) {
      const status = main.locator('[role="status"]');
      const text = (await status.count()) ? flat(await status.first().innerText()) : flat(await main.innerText());
      const first = status.first().locator('p').first();
      const title = (await status.count()) && (await first.count()) ? flat(await first.innerText()) : undefined;
      return { refusedOnSetup: true, route: await t.route(), title, text, review: (await review.count()) > 0 };
    }
    await ui.tap(start);
  }
  await page.waitForTimeout(500);
  const sheet = checkInSheet(page);
  if (await sheet.count()) return { sheet, route: await t.route() };
  return { route: await t.route() };
}

/**
 * The answer a movement entry gives right now, without changing anything:
 * the sheet's outcome (submitting the saved answers again when the sheet
 * opens on its form), a setup or gate screen's refusal, or the mode itself.
 * `via` is an entry `move.enter` knows, or `link` for the mode's own player
 * address (`LINK`).
 */
export async function modeAnswer(t, mode, via = 'move', { resubmit = true } = {}) {
  await closeSheet(t);
  const page = t.page;
  let r;
  if (via === 'move') r = await enterFromMove(t, mode);
  else if (via === 'link') { await t.goto(LINK[mode]); r = { route: await t.route() }; }
  else r = await enter(t, mode, via);
  if (r.refusedOnSetup) {
    const setup = { title: r.title, text: r.text };
    if (r.review) {
      // The setup refused before any tap (S-15); its "Review today’s check-in" gives the check-in's own answer.
      await ui.tap(ui.button(page.getByRole('main'), 'Review today’s check-in'));
      const sheet = checkInSheet(page);
      await sheet.waitFor({ timeout: 15000 });
      const s = await readSheet(sheet);
      return { mode, via, where: 'sheet', route: r.route, ...s, allowed: s.start, setup };
    }
    return { mode, via, where: 'setup', route: r.route, title: r.title, bannerText: r.text, text: r.text, start: false, allowed: false, setup };
  }
  if (r.sheet) {
    let s = await readSheet(r.sheet);
    if (!s.title && s.form && resubmit && !s.submitDisabled) {
      await ui.tap(ui.button(r.sheet, ui.SUBMIT));
      s = { ...(await readSheet(r.sheet)), resubmitted: true };
    }
    return { mode, via, where: 'sheet', route: r.route, ...s, allowed: s.start };
  }
  // Straight through: a gate screen refuses with a banner; otherwise the mode is open.
  const main = page.getByRole('main');
  if (/^\/session/.test(r.route)) {
    // The player is a lazily loaded screen: wait until it has decided (Start, a gate, or a refusal).
    await page.waitForFunction(() => {
      const m = document.querySelector('main');
      if (!m) return false;
      if (m.querySelector('section[role="alert"] h2, section[role="status"] h2')) return true;
      return [...m.querySelectorAll('button')].some(b => /^(Start|Resume|Back to Today)$/.test(b.textContent.trim()));
    }, null, { timeout: 20000 }).catch(() => {});
  }
  const banner = main.locator('section[role="alert"], section[role="status"]').filter({ has: page.locator('h2') });
  const title = (await banner.count()) ? flat(await banner.last().locator('h2').first().innerText()) : undefined;
  const text = flat(await main.innerText().catch(() => ''));
  const playerStart = await main.getByRole('button', { name: /^(Start|Resume)$/ }).count();
  if (/^\/walk\/live/.test(r.route)) {
    // The live walk refuses in its own words ("This walk is on hold", or the emergency title).
    const held = page.getByText(/^(This walk is on hold|Call emergency services now)$/);
    const refusal = (await held.count()) ? flat(await held.first().innerText()) : undefined;
    const controls = await page.getByRole('button', { name: /^(Pause|Resume)$/ }).count();
    const answer = { mode, via, where: 'live walk', route: r.route, title: refusal, bannerText: refusal ? flat(await page.getByRole('main').innerText()) : '', text, pending: !!r.pending, start: !refusal && controls > 0, allowed: !refusal && controls > 0 };
    await leaveWalk(t);
    return answer;
  }
  if (r.route === '/walk') {
    // A walk address the controller would not start sends the person back to Walk.
    return { mode, via, where: 'route', route: r.route, title, bannerText: '', text, start: false, allowed: false, bounced: true };
  }
  return { mode, via, where: 'route', route: r.route, title, bannerText: title ? flat(await banner.last().innerText()) : '', text, start: !title && playerStart > 0, allowed: !title && playerStart > 0 };
}

/**
 * Leave a live walk a probe opened without recording anything: Finish, then
 * Done or Discard on the summary. The frozen clock means nothing was timed.
 */
export async function leaveWalk(t) {
  const page = t.page;
  if (!/^\/walk\/live/.test(await t.route())) return;
  const finish = page.getByRole('button', { name: /^(Finish|Finish and save)$/ });
  if (!(await finish.count())) return;
  await ui.tap(finish);
  const confirm = page.getByRole('dialog', { name: 'Finish walk' });
  if (await confirm.count()) await ui.tap(ui.button(confirm, 'Finish walk'));
  await page.waitForFunction(() => location.hash.startsWith('#/walk/summary'), null, { timeout: 8000 }).catch(() => {});
  const main = page.getByRole('main');
  const done = ui.button(main, 'Done');
  const discard = ui.button(main, 'Discard walk');
  if (await discard.count()) {
    await ui.tap(discard);
    await ui.tap(ui.button(page.getByRole('dialog', { name: 'Discard walk' }), 'Discard walk'));
  } else if (await done.count()) {
    await ui.tap(done);
  }
  await page.waitForTimeout(400);
}

/** Leave whatever full-screen task an entry opened, back to a tab. */
export async function backToTabs(t) {
  await closeSheet(t);
  if (/^\/(session|walk\/live)/.test(await t.route())) await t.goto('/today');
}

/** Every glucose observation, oldest first. */
export function glucoseObs(snap) {
  return (snap?.observations ?? []).filter(o => o.kind === 'glucose').sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

/** Today's stored check-in. */
export function checkInOn(snap, date = TODAY) {
  return (docs(snap).checkIns ?? []).find(c => c.date === date);
}

/** Observation kinds the registry knows; anything else is invented. */
export const KINDS = new Set(['glucose', 'bloodPressureSystolic', 'bloodPressureDiastolic', 'weight', 'waist', 'steps', 'walkDistance', 'walkDuration', 'movementMinutes', 'water', 'sleep', 'backPain', 'legPain', 'mood', 'hba1c', 'b12', 'vitaminD']);

export const brief = o => `${o.value} ${o.unit} at ${o.at} (${o.source}, ${o.scope}${o.context ? `, ${o.context}` : ''})`;

/** Local wall time HH:MM of an ISO instant in Asia/Kolkata. */
export function kolkata(iso) {
  return new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** A green readiness for a seeded check-in; the engine re-evaluates the answers anyway. */
export const GREEN = {
  outcome: 'green', modifiers: [], back: 'none', nerveFlag: false, reasons: [], actions: [],
  vigorousLocked: false, capHeavy: false, rpeOnly: false, notices: [], disposition: 'reassure',
};

/** Text that would mean the app is changing or dosing a medicine. */
export const MEDICINE_CHANGE = /\b(stop|skip|pause|hold|reduce|increase|double|halve|change|adjust)\b[^.]{0,40}\b(sglt2|empagliflozin|dapagliflozin|canagliflozin|insulin|metformin|gliclazide|glimepiride|sulfonylurea|medicine|medication|tablet|dose)\b|\b\d+\s?(units?|iu)\b|titrat/i;
