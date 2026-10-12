/**
 * Shared steps for the check-in safety journeys J03, J04 and J13: opening
 * the check-in for a mode from each way into it, reading what the person is
 * shown (sheet, gate screen, walk refusal, player), and the evidence the
 * spec asks for in IndexedDB.
 *
 * Every attempt goes through the visible UI; a direct link is loaded cold,
 * as a bookmark or pasted address would be.
 */
import { docs } from './harness.mjs';
import * as ui from './ui.mjs';
import { reviewFromSetup, setupRefusal } from './move.mjs';

export const TODAY = '2026-10-08';
export const MODES = ['guided', 'stretch', 'walk'];
const NAME = { guided: 'session', stretch: 'stretch', walk: 'walk' };

/** The check-in's outcome headings (spec "Execution and pass criteria"). */
export const TITLE = {
  emergency: 'Call emergency services now',
  today: 'No exercise today. Get medical advice today.',
  recheck: 'Check again before you start',
  adjust: 'Go ahead, with changes',
  reassure: 'Good to go',
  hold: mode => `No ${NAME[mode]} for now`,
};

/** Headings that refuse movement, for a mode. */
export const refusalTitles = mode => [TITLE.emergency, TITLE.today, TITLE.recheck, TITLE.hold(mode), 'No walk today', 'No stretch today', 'No session today'];

export const STRETCH_LINK = '/session?mode=stretch&focus=backHips&minutes=10';
export const WALK_LINK = '/walk/live?id=accept-direct-walk';

// ---------------------------------------------------------------- database

export const checkInOf = (snap, date = TODAY) => (docs(snap).checkIns ?? []).find(c => c.date === date);
export const obsOn = (snap, kind, day = TODAY) => (snap?.observations ?? []).filter(o => o.day === day && (!kind || o.kind === kind));
const MOVEMENT_KINDS = ['walkDuration', 'movementMinutes', 'walkDistance', 'steps'];
export const movementObs = snap => (snap?.observations ?? []).filter(o => MOVEMENT_KINDS.includes(o.kind));
export const bpPairs = snap => {
  const sys = obsOn(snap, 'bloodPressureSystolic');
  const dia = obsOn(snap, 'bloodPressureDiastolic');
  return sys.map(s => ({ sys: s.value, dia: dia.find(d => d.context === s.context && d.at === s.at)?.value, context: s.context, at: s.at, source: s.source, scope: s.scope }));
};

// ---------------------------------------------------------------- contexts

/** The shared machine is slow: allow a control up to 15 s to appear before calling it missing. */
export function patience(t) {
  t.context.setDefaultTimeout(15000);
}

/** Open the app for a case, with the timeouts this machine needs. */
export async function open(t, seed, opts = {}) {
  await t.open({ seed, route: '/today', ...opts });
  patience(t);
}

/** A fresh context inside one case, for a sub-run that must not remember the last (spec rule 1). */
export async function fresh(t, seed, opts = {}) {
  if (t.context) await t.context.close().catch(() => {});
  await open(t, seed, opts);
}

// ---------------------------------------------------------------- the check-in

export const checkInSheet = page => page.getByRole('dialog', { name: ui.CHECKIN });

/**
 * Open today's check-in for `mode`, the way a person does from `via`:
 * `move` (Move → the mode → its Start), `today` (Today's primary action) or
 * `chooser` (Today → Choose something else → the mode). Throws when no
 * check-in opens: a missing way in is a failure.
 */
export async function openCheckIn(t, mode, via = 'move') {
  const page = t.page;
  const main = page.getByRole('main');
  await closeSheet(page);
  await backToTabs(t);
  if (via === 'move') {
    await ui.tab(page, 'Move');
    if (mode === 'guided') {
      await ui.tap(ui.row(main, 'Guided session'));
    } else {
      await ui.tap(ui.row(main, mode === 'stretch' ? 'Stretch' : 'Walk', 'link'));
      await page.getByRole('heading', { level: 1, name: mode === 'stretch' ? 'Stretch' : 'Walk', exact: true }).waitFor();
      const start = ui.button(main, mode === 'stretch' ? 'Start stretch' : 'Start walk');
      const review = ui.button(main, 'Review today’s check-in');
      if (await start.count()) await ui.tap(start);
      else if (await review.count()) await ui.tap(review);
      else throw new Error(`the ${mode} screen offers neither Start nor a way to today’s check-in`);
    }
  } else if (via === 'today') {
    await ui.tab(page, 'Today');
    const card = main.getByRole('region').filter({ has: page.getByRole('heading', { level: 3 }) });
    await ui.tap(card.getByRole('button'));
  } else if (via === 'chooser') {
    await ui.tab(page, 'Today');
    await ui.tap(ui.button(main, 'Choose something else'));
    await ui.tap(ui.row(page.getByRole('dialog'), { guided: 'Guided session', stretch: 'Stretch', walk: 'Walk' }[mode]));
  } else {
    throw new Error(`unknown entry ${via}`);
  }
  const sheet = checkInSheet(page);
  await sheet.waitFor({ timeout: 15000 });
  return sheet;
}

/** "Right now, any of these?" answered "None of these", so the readings can be typed. */
export async function noneRightNow(sheet) {
  const right = ui.section(sheet, 'Right now, any of these?');
  const none = ui.checkbox(right, 'None of these');
  if (await none.getAttribute('aria-checked') !== 'true') await ui.tap(none);
  return right;
}

/** The outcome banner (a status or alert section with its heading) has rendered. */
export async function waitOutcome(sheet, timeout = 10000) {
  const banner = sheet.locator('section[role="alert"], section[role="status"]').filter({ has: ui.pageOf(sheet).locator('h2') });
  await banner.last().waitFor({ timeout }).catch(() => {});
}

/** Tick an emergency answer after the list has been folded by "None of these". */
export async function tickEmergency(sheet, label) {
  const right = ui.section(sheet, 'Right now, any of these?');
  const again = ui.button(right, 'Show the list again');
  if (await again.count()) await ui.tap(again);
  await ui.tap(ui.checkbox(right, label));
  await waitOutcome(sheet);
}

export async function typeGlucose(sheet, value, unit = 'mg/dL') {
  const g = ui.section(sheet, 'Glucose');
  const unitButton = g.getByRole('button', { name: /^Unit: / });
  for (let i = 0; i < 2 && !(await unitButton.getAttribute('aria-label')).includes(`Unit: ${unit}.`); i++) await ui.tap(unitButton);
  if (!(await unitButton.getAttribute('aria-label')).includes(`Unit: ${unit}.`)) throw new Error(`the glucose unit would not change to ${unit}`);
  const box = g.getByRole('textbox', { name: 'Glucose reading', exact: true });
  await ui.type(box, value);
  const got = await box.inputValue();
  if (got !== String(value)) throw new Error(`the glucose box holds "${got}", not the typed "${value}"`);
  return box;
}

export async function typeBp(t, sheet, readings, { gapMs = 60_000 } = {}) {
  const bp = ui.section(sheet, 'Blood pressure');
  const shown = [];
  for (let i = 0; i < readings.length; i++) {
    const [s, d] = readings[i];
    if (i > 0 && gapMs) await t.advance(gapMs);
    const top = bp.getByRole('textbox', { name: `Reading ${i + 1}, top number`, exact: true });
    const bottom = bp.getByRole('textbox', { name: `Reading ${i + 1}, bottom number`, exact: true });
    await ui.type(top, String(s));
    await ui.type(bottom, String(d));
    shown.push([await top.inputValue(), await bottom.inputValue()]);
  }
  return shown;
}

/** Back and leg pain set explicitly (the spec's "pain 0" is an answer, not a default). */
export async function setPain(sheet, { back, leg, reach } = {}) {
  const s = ui.section(sheet, 'Back and legs');
  if (back !== undefined) await ui.setRange(s.getByLabel('Back pain now', { exact: true }), back);
  if (leg !== undefined) await ui.setRange(s.getByLabel('Leg pain now', { exact: true }), leg);
  if (reach) await ui.tap(ui.radio(s.getByRole('radiogroup', { name: 'How far down symptoms reach' }), reach));
}

export async function noneSince(sheet) {
  const since = ui.section(sheet, 'Since your last check-in, any of these?');
  const none = ui.checkbox(since, 'None of these');
  if (await none.getAttribute('aria-checked') !== 'true') await ui.tap(none);
}

export async function noneElse(sheet) {
  const other = ui.section(sheet, 'Anything else today?');
  const none = ui.checkbox(other, 'None of these');
  if (await none.getAttribute('aria-checked') !== 'true') await ui.tap(none);
}

export async function sleepEnergy(sheet) {
  await ui.tap(ui.radio(sheet.getByRole('radiogroup', { name: 'Sleep last night' }), 'Over 7 h'));
  await ui.tap(ui.radio(sheet.getByRole('radiogroup', { name: 'Energy' }), 'Good'));
}

export async function submit(sheet) {
  const b = ui.button(sheet, ui.SUBMIT);
  if (await b.isDisabled()) {
    const why = await sheet.locator('[aria-live="polite"]').allInnerTexts();
    throw new Error(`“${ui.SUBMIT}” is disabled: ${why.join(' ').trim()}`);
  }
  await ui.tap(b);
  await waitOutcome(sheet);
}

// ---------------------------------------------------------------- what is shown

/**
 * The outcome banner's heading in `scope` (sheet, gate screen). Local copy of
 * ui.outcomeTitle, whose `has:` filter is chained from the scope and so can
 * never match inside it.
 */
export async function outcomeTitle(scope) {
  const banner = scope.locator('section[role="alert"], section[role="status"]').filter({ has: ui.pageOf(scope).locator('h2') });
  const n = await banner.count();
  if (!n) return undefined;
  return (await banner.nth(n - 1).locator('h2').first().innerText()).trim();
}

const START_IN_SHEET = /^(Start session|Start recovery session|Start stretch|Start walk|Continue|Continue session|Continue stretch)$/;

/**
 * What the person is looking at after an attempt to move: the sheet's
 * outcome, a gate screen, the walk screen's own refusal, a setup screen, the
 * player's ready screen or active movement.
 */
export async function surface(t) {
  const page = t.page;
  await page.waitForTimeout(300);
  const route = await t.route();
  const sheet = checkInSheet(page);
  if (await sheet.count()) {
    const title = await outcomeTitle(sheet);
    const starts = await sheet.getByRole('button', { name: START_IN_SHEET }).allInnerTexts();
    return { where: 'sheet', route, title, text: (await sheet.innerText()).replace(/\s+/g, ' '), start: starts.length > 0, starts, form: !title };
  }
  const main = page.getByRole('main');
  const text = (await main.innerText().catch(() => '')).replace(/\s+/g, ' ');
  if (route.startsWith('/session')) {
    const title = await outcomeTitle(main);
    // The player's own stop screens (a low, a glucose check) refuse movement until a reading settles it.
    const h1 = (await main.getByRole('heading', { level: 1 }).allInnerTexts().catch(() => [])).map(x => x.trim());
    const stop = h1.find(x => /^(Treat the low first|Check your glucose)/.test(x));
    if (stop && !title) {
      const moving = await main.getByRole('button', { name: /^(Start|Resume|Pause|Next)$/ }).count();
      return { where: 'stop screen', route, title: stop, text, start: moving > 0 };
    }
    const ready = await main.getByRole('button', { name: /^(Start|Resume)$/ }).count();
    // "End session" ends movement; only Pause/Resume/Next mean it is running.
    const running = await main.getByRole('button', { name: /^(Pause|Resume|Next)$/ }).count();
    return { where: title ? 'gate' : running ? 'player' : 'session', route, title, text, start: !title && (ready > 0 || running > 0) };
  }
  if (route.startsWith('/walk/live')) {
    const live = await main.getByRole('button', { name: /^(Pause|Finish|Finish walk|Resume)$/ }).count();
    return { where: 'live walk', route, title: undefined, text, start: live > 0 };
  }
  if (route.startsWith('/walk')) {
    const status = main.getByRole('status').filter({ hasText: /Call emergency services now|No walk today/ });
    const title = (await status.count()) ? (await status.locator('p').first().innerText()).trim() : undefined;
    // The setup's own Start opens the check-in: it is not permission to move (spec).
    return { where: title ? 'walk refusal' : 'walk setup', route, title, text, start: false, setupStart: (await ui.button(main, 'Start walk').count()) > 0 };
  }
  const title = await outcomeTitle(main);
  return { where: route, route, title, text, start: false };
}

/** Close an open check-in sheet, if there is one. */
export async function closeSheet(page) {
  const sheet = checkInSheet(page);
  if (await sheet.count()) {
    await ui.tap(ui.button(sheet, 'Close'));
    await sheet.waitFor({ state: 'hidden' });
  }
}

/**
 * Try to move in `mode` from `via` and report what that led to. Entries:
 * move | chooser | today | direct (the mode's own address) | stretchLink |
 * walkLink | resume. A refusal anywhere is a result, not an error.
 */
export async function attempt(t, mode, via) {
  const page = t.page;
  const main = page.getByRole('main');
  let setup;
  await closeSheet(page);
  if (via === 'move' || via === 'chooser' || via === 'today') {
    await backToTabs(t);
    if (via === 'move') {
      await ui.tab(page, 'Move');
      if (mode === 'guided') {
        // Outside the programme the row is the way in to join it, not a session (D8).
        const join = ui.row(main, 'Guided session', 'link');
        if (await join.count()) {
          await ui.tap(join);
          await page.waitForTimeout(600);
          const offered = await page.getByRole('main').getByRole('button', { name: /^(Start|Start session|Resume)$/ }).count();
          return { mode, via, where: 'not offered', route: await t.route(), title: undefined, text: '', start: offered > 0 };
        }
        await ui.tap(ui.row(main, 'Guided session'));
      } else {
        await ui.tap(ui.row(main, mode === 'stretch' ? 'Stretch' : 'Walk', 'link'));
        await page.getByRole('heading', { level: 1, name: mode === 'stretch' ? 'Stretch' : 'Walk', exact: true }).waitFor();
        setup = await throughSetup(t, mode);
      }
    } else if (via === 'chooser') {
      await ui.tab(page, 'Today');
      await ui.tap(ui.button(main, 'Choose something else'));
      await ui.tap(ui.row(page.getByRole('dialog'), { guided: 'Guided session', stretch: 'Stretch', walk: 'Walk' }[mode]));
    } else {
      await ui.tab(page, 'Today');
      const card = main.getByRole('region').filter({ has: page.getByRole('heading', { level: 3 }) });
      await ui.tap(card.getByRole('button'));
    }
  } else if (via === 'direct') {
    await t.goto({ guided: '/session', stretch: '/move/stretch', walk: '/walk' }[mode]);
    if (mode !== 'guided') setup = await throughSetup(t, mode);
  } else if (via === 'stretchLink') {
    await t.goto(STRETCH_LINK);
  } else if (via === 'walkLink') {
    await t.goto(WALK_LINK);
    // Sent back to the setup: its Start is the next thing a person would try.
    if ((await t.route()).split('?')[0] === '/walk') setup = await throughSetup(t, 'walk');
  } else if (via === 'resume') {
    await t.goto('/session?resume=1');
  } else {
    throw new Error(`unknown entry ${via}`);
  }
  return { mode, via, ...(await settled(t)), ...(setup ? { setup } : {}) };
}

/**
 * On a Stretch or Walk setup: its Start, when it offers one. Otherwise the
 * setup has refused before any tap (scan S-15): keep that refusal, and open
 * the check-in through "Review today’s check-in", whose answer the attempt
 * then reports. Returns the setup's refusal, if any.
 */
async function throughSetup(t, mode) {
  const page = t.page;
  const refusal = await setupRefusal(page, mode);
  if (!refusal) {
    const start = ui.button(page.getByRole('main'), mode === 'stretch' ? 'Start stretch' : 'Start walk');
    if (await start.count() && !(await start.isDisabled())) await ui.tap(start);
    return undefined;
  }
  if (refusal.review) await reviewFromSetup(page);
  return refusal;
}

/**
 * The S-15 refusal on a setup: the reason on screen before any tap, and the
 * check-in that "Review today’s check-in" opens gives the same refusal.
 */
export function setupProblems(s) {
  const out = [];
  if (!s.setup) return out;
  if (!s.setup.text) out.push('the setup refuses with no reason on screen');
  if (s.setup.review) {
    if (s.where !== 'sheet') out.push(`“Review today’s check-in” opened no check-in (${s.where} at ${s.route})`);
    else if (s.setup.reasons[0] && !s.text.includes(s.setup.reasons[0])) out.push(`the setup’s refusal (“${s.setup.reasons[0].slice(0, 140)}”) is not in the check-in it opens (“${s.title}”)`);
  }
  return out;
}

/**
 * What the attempt led to, once it has led somewhere: a sheet, a gate, the
 * player, a live walk or the walk screen's refusal. A setup screen left
 * after its Start was tapped is reported as it stands after 12 s.
 */
export async function settled(t, ms = 12000) {
  const until = Date.now() + ms;
  let last;
  while (Date.now() < until) {
    last = await surface(t);
    const done = ['gate', 'player', 'live walk', 'walk refusal'].includes(last.where)
      || (last.where === 'sheet' && (last.title || last.form))
      || (last.where === 'session' && last.start);
    if (done) {
      // A sheet that has just opened may still be rendering its outcome.
      if (last.where === 'sheet' && !last.title) { await t.page.waitForTimeout(600); last = await surface(t); }
      return last;
    }
    await t.page.waitForTimeout(400);
  }
  return last;
}

/** The ways into each mode that step "attempt every other mode, including direct links" covers. */
export const EVERY_ENTRY = [
  ['guided', 'move'], ['stretch', 'move'], ['walk', 'move'],
  ['guided', 'direct'], ['stretch', 'direct'], ['stretch', 'stretchLink'], ['walk', 'walkLink'], ['guided', 'resume'],
];

/** Every entry refused, each with an acceptable heading. Returns the findings for the failure message. */
export async function expectAllRefused(t, accept, entries = EVERY_ENTRY, textCheck) {
  const problems = [];
  for (const [mode, via] of entries) {
    let s;
    try { s = await attempt(t, mode, via); } catch (e) { problems.push(`${mode} via ${via}: could not attempt (${String(e.message ?? e).split('\n')[0]})`); continue; }
    // A hold that needs a new reading reopens the questions with the reading cleared: no outcome, no Start.
    const recheckForm = s.where === 'sheet' && s.form && accept(mode).includes(TITLE.recheck);
    // Not enrolled: Move offers the programme to join, never a session to start.
    const notOffered = s.where === 'not offered';
    const ok = !s.start && (notOffered || recheckForm || (s.title !== undefined && accept(mode).includes(s.title)));
    t.note(`${mode} via ${via} → ${s.setup ? `setup refusal “${s.setup.title ?? s.setup.text.slice(0, 60)}”, then ` : ''}${s.where} (${s.route}): “${s.title ?? '(none)'}”, start ${s.start}`);
    for (const p of setupProblems(s)) problems.push(`${mode} via ${via}: ${p}`);
    const wording = ok && textCheck ? textCheck(mode, s) : undefined;
    if (wording) problems.push(`${mode} via ${via} → ${s.where}: ${wording}`);
    if (!ok) problems.push(`${mode} via ${via} → ${s.where} at ${s.route}: title “${s.title ?? '(none)'}”, start offered: ${s.start}${s.starts?.length ? ` (${s.starts.join(', ')})` : ''}`);
  }
  await closeSheet(t.page);
  return problems;
}

/**
 * A "today" refusal must say so wherever it is shown, with a clinical
 * direction, even where a setup screen uses its own heading (spec: direct
 * player or setup routes).
 */
export function todayWording(mode, surf) {
  if (!/today/i.test(surf.text) || !/clinician|doctor|care team|medical advice|urgent care/i.test(surf.text)) {
    return `the refusal (“${surf.title}”) does not say today with a clinical direction: “${surf.text.slice(0, 200)}”`;
  }
  return undefined;
}

/** Words that must never sit beside an emergency direction. */
export function emergencyProblems(text) {
  const out = [];
  if (!/emergency|help now/i.test(text)) out.push('no emergency / help now direction');
  if (/\b999\b|\b111\b|\bNHS\b/.test(text)) out.push('a UK care number');
  if (/Re-check at \d|in \d+ minutes?\./.test(text)) out.push('a countdown before help');
  if (/try stretching|stretch instead|gentle (walk|stretch|session)|recovery session/i.test(text)) out.push('a gentler workout offered');
  return out;
}

/** From a full-screen gate or player back to the tabbed app, the way the screen offers. */
export async function backToTabs(t) {
  const page = t.page;
  if (await page.getByRole('navigation', { name: 'Main' }).count()) return;
  const back = page.getByRole('button', { name: /^(Back to Today|Back)$/ });
  if (await back.count() === 1) {
    await ui.tap(back);
    await page.waitForTimeout(400);
  }
  if (!(await page.getByRole('navigation', { name: 'Main' }).count())) await t.goto('/today');
}

/** Learn and past-record entry are still there (J03 step 3). */
export async function learnAndLogReachable(t) {
  const page = t.page;
  const problems = [];
  await closeSheet(page);
  await backToTabs(t);
  await ui.tab(page, 'Guide');
  if (!(await page.getByRole('heading', { level: 1, name: 'Guide', exact: true }).count())) problems.push('Guide did not open');
  if ((await page.getByRole('main').innerText()).length < 200) problems.push('Guide has no readable content');
  await ui.tab(page, 'Track');
  await ui.tap(ui.header(page).getByRole('button', { name: 'Add a record', exact: true }));
  const add = page.getByRole('dialog', { name: 'Add' });
  await add.waitFor();
  await ui.tap(ui.row(add, 'Weight'));
  const form = page.getByRole('dialog', { name: 'Weight' });
  await form.waitFor();
  if (!(await ui.button(form, 'Save').count())) problems.push('the Weight form has no Save');
  await ui.tap(ui.button(form, 'Close'));
  await form.waitFor({ state: 'hidden' });
  return problems;
}
