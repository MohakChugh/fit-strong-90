/**
 * S02 (journey §20.4 rule 1, board D122): every control a finger can reach,
 * on every screen and sheet S01's inventory visits, on the screens a task
 * runs on (Me's habit sheets, a walk with its stop sheet and its low
 * guidance, its record, a stretch's player and the low's reading screen, a
 * manual workout, a guided session's sets, the check-in on insulin), and on
 * Plan 8's own (an Undo, Recently deleted, a held reading's refusal, what a
 * backup can hold, your own foods and their edit sheet, Food's trend,
 * Browse's food rows, Home's update line, the error screen, after week 12,
 * and the storage screen a newer copy causes), at 100% and 200% text: at
 * least 48 × 48 CSS px, a main target at least 60 px tall, at least 12 px
 * between bezelled controls, none under one finger with another, words that
 * fit, and each screen's landmark and heading, but for the exceptions
 * `lib/targets.mjs` lists. Every finding fails the case, naming the screen,
 * the control and its measure.
 */
import { persona } from '../fixtures/personas.mjs';
import * as data from '../lib/data.mjs';
import * as food from '../lib/food.mjs';
import * as hub from '../lib/hub.mjs';
import * as mv from '../lib/move.mjs';
import * as rec from '../lib/recovery.mjs';
import * as sa from '../lib/safety-a.mjs';
import { collect, problems, structure, structureProblems } from '../lib/targets.mjs';
import * as ui from '../lib/ui.mjs';
import * as walk from '../lib/walk.mjs';
import { inventory } from './s01.mjs';

export const id = 'S02';
export const title = 'Every target at least 48 px, main targets 60 px, bezelled controls 12 px apart, none overlapping';
export const safety = false;

const AT = '2026-10-08T09:00:00.000+05:30';
// Allergies answered, none: Browse lists foods only once they are known (board D115).
const ESTIMATES = { patch: { profile: { food: { pattern: 'vegetarian', avoid: [], level: 'estimates', hardBefore: 'no', allergies: [] } } } };
const JULY = { patch: { settings: { startDate: '2026-07-17' } } };
const NEXT_DAY = Date.parse('2026-10-09T09:00:00+05:30');
const BHEL = { id: 'food-s02', name: 'Bhel puri', per: { qty: 1, unit: 'plate' }, kcal: 300, createdAt: AT, updatedAt: AT };

/** Every checkpoint the case takes measures its screen as well; each finding fails the case. */
function measuring(t) {
  const take = t.checkpoint.bind(t);
  t.checkpoint = async (name, options = {}) => {
    const snapshot = await take(name, options);
    const page = options.page ?? t.page;
    const found = [...problems(await page.evaluate(collect)), ...structureProblems(await page.evaluate(structure))];
    await t.check(found.length === 0, `${name}: ${found.slice(0, 6).join('; ')}${found.length > 6 ? `; and ${found.length - 6} more` : ''}`);
    return snapshot;
  };
}

/** A sheet, measured, then closed by its Close, or left by the answer named. */
async function sheetAt(t, name, open, leaveBy = 'Close') {
  const page = t.page;
  await open();
  const dialog = page.getByRole('dialog').first();
  await dialog.waitFor({ timeout: 10000 });
  await page.waitForTimeout(300);
  await t.checkpoint(name);
  await ui.tap(ui.button(dialog, leaveBy));
  await dialog.waitFor({ state: 'hidden' }).catch(() => {});
}

/** From a hub's start, through its check-in, onto the session's own screen. */
async function intoSession(t, mode, persona) {
  const page = t.page;
  await hub.open(t, mode);
  const { sheet } = await hub.begin(t);
  if (sheet) {
    await ui.answerCheckIn(t, sheet, ui.normalAnswers(persona));
    await ui.tap(mv.sheetStart(sheet));
  }
  await page.waitForURL(/#\/session/, { timeout: 15000 });
  await t.ready();
}

/** A walk from its hub, through its check-in and questions, live. */
async function intoWalk(t, persona, { keep = true } = {}) {
  const page = t.page;
  await hub.open(t, 'walk');
  await walk.emit(page, 12.97, 77.59);
  if (await walk.gpsSwitch(page).getAttribute('aria-checked') !== 'true') await ui.tap(walk.gpsSwitch(page));
  // The check-in when today has none yet, then the first walk's questions, as Plan 6's own start does.
  await walk.start(t, ui.normalAnswers(persona), { keep });
}

/**
 * Tap a control a standing toast may be over, as a person does: scrolled into the room above the toasts
 * first (the shell keeps room under the screen for them). At 200% text on a small phone that room is a
 * band no alignment of Playwright's own scrolling lands in.
 */
async function tapAboveToasts(locator) {
  await locator.waitFor();
  // Once the screen has settled: a screen just opened puts its own scroll back to the top.
  await locator.page().waitForTimeout(700);
  await locator.evaluate(el => {
    const toasts = [...document.querySelectorAll('#toasts [data-sonner-toast]')]
      .filter(t => t.getAttribute('data-visible') !== 'false' && t.getAttribute('data-removed') !== 'true');
    const top = Math.min(window.innerHeight, ...toasts.map(t => t.getBoundingClientRect().top));
    const r = el.getBoundingClientRect();
    if (r.bottom > top) window.scrollBy(0, r.bottom - top + 8);
  });
  await ui.tap(locator);
}

/** A serious reading's guidance, closed by its Close. */
async function closeGuidance(page) {
  const guidance = page.getByRole('dialog', { name: /^(Saved|What to do)$/ });
  if (!(await guidance.count())) return;
  await ui.tap(ui.button(guidance, 'Close'));
  await guidance.waitFor({ state: 'hidden' });
}

/** Records a backup would carry, merged in as Restore merges them (Plan 7's `seedMeals`, for any store). */
async function seedRecords(t, records) {
  const file = data.writeFixture(t, 'records.json', data.transferDoc({ schemaVersion: 6, stores: Object.keys(records), records }));
  const sheet = await data.chooseRestore(t, file);
  await data.merge(t, sheet);
  await ui.tap(ui.button(sheet, 'Done'));
  await sheet.waitFor({ state: 'hidden' });
}

/** The screens a task runs on, which S01's inventory doesn't open. */
async function tasks(t, { textScale } = {}) {
  const scale = textScale ? { textScale } : {};
  let page = await t.open({ seed: persona('P03'), route: '/me/reminders', sensors: { geo: 'grant' }, ...scale });
  let main = page.getByRole('main');

  await t.step(1, 'Me → Reminders, with its Water and Sitting breaks sheets', async () => {
    await ui.heading(page, 'Reminders');
    await t.checkpoint('reminders');
    for (const name of ['Water', 'Sitting breaks']) {
      await sheetAt(t, `habit-${name.toLowerCase().replace(/\W+/g, '-')}`, () => ui.tap(ui.row(main, name)));
    }
  });

  await t.step(2, 'A walk: its setup and picker, the live walk with its route, the stop sheet and its questions, paused, finishing, and its summary', async () => {
    await hub.open(t, 'walk');
    await t.checkpoint('walk-setup');
    await intoWalk(t, 'P03');
    for (let i = 1; i <= 6; i++) {
      await t.advance(10_000);
      await walk.emit(page, 12.97 + i * 0.0002, 77.59);
    }
    await page.waitForTimeout(1300);
    await t.checkpoint('walk-live');
    // Paused, and the Finish sheet, first: "I need to stop" ends the walk's recording, leaving only Finish and save.
    await ui.tap(ui.button(main, 'Pause'));
    await ui.button(main, 'Resume').waitFor({ timeout: 10000 });
    await t.checkpoint('walk-paused');
    await ui.tap(ui.button(main, 'Finish'));
    const finish = page.getByRole('dialog', { name: 'Finish walk' });
    await finish.waitFor();
    await t.checkpoint('walk-finish');
    await ui.tap(ui.button(finish, 'Keep walking'));
    await finish.waitFor({ state: 'hidden' });
    await ui.tap(ui.button(main, 'Resume'));
    await ui.button(main, 'Pause').waitFor({ timeout: 10000 });
    await sheetAt(t, 'walk-stop', () => ui.tap(ui.button(main, 'I need to stop')), 'Just need a rest');
    // Stopped: Finish and save; or, the rest answered, Finish and its sheet.
    const saveNow = ui.button(main, 'Finish and save');
    if (await saveNow.count()) await ui.tap(saveNow);
    else { await ui.tap(ui.button(main, 'Finish')); await ui.tap(ui.button(page.getByRole('dialog', { name: 'Finish walk' }), 'Finish walk')); }
    await page.getByRole('heading', { level: 1, name: 'Your walk' }).waitFor();
    await t.checkpoint('walk-summary');
    await ui.tap(ui.button(main, 'Save walk'));
    await page.getByText('Saved on this device', { exact: true }).waitFor({ timeout: 10000 });
    await t.checkpoint('walk-saved');
    await ui.tap(ui.button(main, 'Done'));
  }, { input: 'P03, a walk with its route kept' });

  await t.step(3, 'The walk’s record, with its route', async () => {
    await ui.legacyTab(page, 'Track');
    await ui.tap(ui.row(ui.section(main, 'Records'), 'Walk', 'link'));
    await ui.heading(page, 'Walk');
    await t.checkpoint('walk-detail');
  });

  await t.step(4, 'The walk’s low guidance, from “I feel low” on a walk under way (Plan 6’s open item)', async () => {
    await intoWalk(t, 'P03', { keep: false });
    await ui.tap(ui.button(main, 'I feel low'));
    await page.getByText(/Treat the low first|Glucose now/).first().waitFor({ timeout: 15000 });
    await t.checkpoint('walk-low-guidance');
  });

  await t.context.close();
  page = await t.open({ seed: persona('P03'), route: '/home', ...scale });
  main = page.getByRole('main');

  await t.step(5, 'A stretch: its start screen, the player, its exit sheet, and the low’s reading screen', async () => {
    await intoSession(t, 'stretch', 'P03');
    await t.checkpoint('session-start');
    await ui.tap(page.getByRole('button', { name: 'Start', exact: true }));
    await page.getByRole('button', { name: 'Pause', exact: true }).waitFor({ timeout: 10000 });
    await t.checkpoint('session-player');
    await ui.tap(page.getByRole('button', { name: 'End session', exact: true }));
    const keep = page.getByRole('button', { name: 'Keep going', exact: true });
    await keep.waitFor();
    await t.checkpoint('session-exit');
    await ui.tap(keep);
    await ui.tap(page.getByRole('button', { name: 'I feel low', exact: true }));
    await page.getByText('Treat the low first', { exact: true }).waitFor({ timeout: 15000 });
    await t.checkpoint('session-low');
  });

  await t.context.close();
  page = await t.open({ seed: persona('P01'), route: '/hub/workout/log', ...scale });

  await t.step(6, 'A manual workout, then a guided session at its first set', async () => {
    await t.checkpoint('workout-log');
    await intoSession(t, 'guided', 'P01');
    await ui.tap(page.getByRole('button', { name: 'Start', exact: true }));
    // Past the warm-up to a set: its weight and reps steppers.
    const done = page.getByRole('button', { name: /^Done — next$/ });
    for (let i = 0; i < 20 && !(await done.count()); i++) await ui.tap(page.getByRole('button', { name: 'Next', exact: true }));
    await t.must(await done.count() === 1, 'no set came up in the guided session');
    await t.checkpoint('session-set');
  });

  await t.context.close();
  page = await t.open({ seed: persona('P04'), route: '/home', ...scale });

  await t.step(7, 'The check-in on insulin, with its switch for rapid-acting insulin', async () => {
    await ui.tap(ui.rightNow(page).getByRole('button').first());
    const sheet = page.getByRole('dialog', { name: ui.CHECKIN });
    await sheet.waitFor({ timeout: 10000 });
    // "None of these" first: the readings, the glucose box among them, show once it is answered.
    await sa.noneRightNow(sheet);
    await t.must(await sheet.getByRole('switch', { name: 'Rapid-acting insulin in the last 2 hours' }).count() === 1, 'the check-in on insulin asks nothing about rapid-acting insulin');
    await t.checkpoint('check-in-insulin');
  });

  // Plan 6's report (added 2026-10-12): at 320 px and 200% text the shared safety surface widened a sheet past
  // the screen and cut its Close off, in every sheet that shows it.
  await t.step(8, 'A sheet with the safety surface standing over it: a low on insulin, then Me → Reminders → Water', async () => {
    const checkIn = page.getByRole('dialog', { name: ui.CHECKIN });
    if (await checkIn.count()) {
      await ui.tap(ui.button(checkIn, 'Close'));
      await checkIn.waitFor({ state: 'hidden' }).catch(() => {});
    }
    await t.goto('/day/today');
    await data.logGlucose(t, { value: 52 });
    await closeGuidance(page);
    await t.goto('/me/reminders');
    await ui.heading(page, 'Reminders');
    await sheetAt(t, 'sheet-with-surface', () => ui.tap(ui.row(page.getByRole('main'), 'Water')));
  }, { input: 'P04, glucose 52 mg/dL' });
}

/** Plan 8's own screens (Kiro K8-04), on the production build so Home's update line is there. */
async function ownScreens(t, { textScale } = {}) {
  const scale = textScale ? { textScale } : {};
  let page = await t.open({ seed: persona('P04', ESTIMATES), route: '/day/today', updates: true, ...scale });
  let main = page.getByRole('main');

  // Two Undos standing: at 200% text on a small phone they must not cover most of the screen together (M19).
  await t.step(1, 'Today’s log: two water entries deleted, their Undos standing, and Recently deleted', async () => {
    await data.logWater(t, 250);
    await data.logWater(t, 250);
    for (const said of ['Water 500 ml deleted', 'Water 250 ml deleted']) {
      await ui.tap(ui.row(ui.section(main, 'Day totals'), 'Water', 'link'));
      await tapAboveToasts(ui.row(main, 'Delete this entry'));
      await rec.toast(page, said).first().waitFor({ timeout: 10000 });
    }
    await t.checkpoint('undo-toast');
    await sheetAt(t, 'recently-deleted', () => ui.tap(ui.row(main, 'Recently deleted')));
  });

  await t.step(2, 'A 52 that holds movement, refused in place with It was a mistake', async () => {
    await data.logGlucose(t, { value: 52 });
    await closeGuidance(page);
    await ui.legacyTab(page, 'Track');
    await ui.tap(ui.section(main, 'Records').getByRole('link').filter({ hasText: '52' }).first());
    await ui.tap(ui.row(main, 'Delete this reading'));
    await page.getByRole('button', { name: 'It was a mistake', exact: true }).waitFor({ timeout: 10000 });
    await t.checkpoint('held-refusal');
  }, { input: 'Glucose 52 mg/dL, on insulin' });

  await t.step(3, 'Me → Data → What a backup can hold', async () => {
    await t.goto('/me/data');
    await sheetAt(t, 'backup-limits', () => ui.tap(ui.row(main, 'What a backup can hold')));
  });

  await t.step(4, 'Me → Food → Your own foods, and a food’s edit sheet', async () => {
    await seedRecords(t, { customFoods: [BHEL], meals: [food.meal('meal-s02', '2026-10-07T13:05:00.000+05:30', 'lunch', [food.ROTI, food.DAL], 'estimates')] });
    await t.goto('/me/food/own');
    await ui.heading(page, 'Your own foods');
    await t.checkpoint('own-foods');
    await sheetAt(t, 'own-food-edit', () => ui.tap(page.getByRole('button', { name: 'Edit Bhel puri', exact: true })));
  });

  await t.step(5, 'Food’s trend, and Browse’s food rows', async () => {
    await t.goto('/trends/food');
    await ui.heading(page, 'Food');
    await t.checkpoint('food-trend');
    await ui.tab(page, 'Browse');
    await ui.type(main.getByRole('searchbox').first(), 'dal');
    await main.getByText('Toor dal').first().waitFor({ timeout: 10000 });
    await t.checkpoint('browse-food');
  });

  await t.step(6, 'Home’s update line, with its Restart', async () => {
    await rec.offerUpdate(page);
    await ui.tab(page, 'Home');
    await page.getByRole('button', { name: 'Restart to update', exact: true }).waitFor({ timeout: 10000 });
    await t.checkpoint('update-line');
  });

  await t.step(7, 'The error screen, for a screen whose code can’t be fetched', async () => {
    const chunks = /\/fit-strong-90\/assets\/.+\.js$/;
    await page.route(chunks, route => route.abort());
    try {
      // Within the running app, as a tap does: the app's own code is loaded; the screen's, fetched now, fails.
      await t.hash('/hub/learn');
      await page.getByRole('heading', { name: 'This screen didn’t load' }).waitFor({ timeout: 15000 });
      await t.checkpoint('error-screen');
    } finally {
      await page.unroute(chunks);
    }
  });

  await t.context.close();
  page = await t.open({ seed: persona('P01', JULY), route: '/home', time: NEXT_DAY, ...scale });
  main = page.getByRole('main');

  await t.step(8, 'After week 12: Your plan’s two choices, and the restart sheet', async () => {
    await ui.tap(ui.button(ui.rightNow(page), 'Choose what’s next'));
    await ui.section(main, 'What next?').waitFor({ timeout: 10000 });
    await t.checkpoint('what-next');
    await sheetAt(t, 'restart-sheet', () => ui.tap(ui.row(ui.section(main, 'What next?'), 'Start the 12 weeks again')));
  });

  await t.step(9, 'A newer copy takes the database: the storage screen', async () => {
    const version = (await t.db()).version;
    const newer = await rec.newerTab(t, version + 1, { abort: false });
    try {
      await page.bringToFront();
      // The storage notice's title, its details beside it for a screen reader.
      await page.getByText(/^A newer version of FitStrong is open/).first().waitFor({ timeout: 15000 });
      await t.checkpoint('storage-newer');
    } finally {
      await newer.page.close();
    }
  });
}

export const cases = [
  { name: 'the inventory at normal text', run: t => { measuring(t); return inventory(t); } },
  { name: 'the inventory at 200% text', run: t => { measuring(t); return inventory(t, { textScale: 2 }); } },
  { name: 'the task screens at normal text', run: t => { measuring(t); return tasks(t); } },
  { name: 'the task screens at 200% text', run: t => { measuring(t); return tasks(t, { textScale: 2 }); } },
  { name: 'Plan 8’s own screens at normal text', preview: true, run: t => { measuring(t); return ownScreens(t); } },
  { name: 'Plan 8’s own screens at 200% text', preview: true, run: t => { measuring(t); return ownScreens(t, { textScale: 2 }); } },
];
