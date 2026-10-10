/**
 * M01: Me's own journeys (journey §16; Plan 4): Finish setting up, Goals,
 * Display, and Data's two confirmations. Browse, Home's tiles, calendar
 * copies and backups have their V-J journeys. Codex's Plan 4 review adds:
 * - H4-04: a row's answer the device refuses leaves the row, with what
 *   happened and a way to try again (§4.5). In memory only the answer is
 *   refused the same way (meRows.test.ts); an existing person can't reach
 *   memory mode here, since the app offers only Try again then.
 * - H4-06: Goals and Me left open from Sunday into Monday: the week's goal
 *   changes at midnight, and a change that has begun is no longer pending.
 * - H4-07: the device's Reduce Motion changed while Display is open: the
 *   switch follows at once, and never claims the device set it after it
 *   stopped.
 * - KH-17: About's "Sources and licences" names the licences of what the
 *   app is built from, as well as Learn's sources.
 */
import { docs } from '../lib/harness.mjs';
import { persona } from '../fixtures/personas.mjs';
import * as data from '../lib/data.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'M01';
export const title = 'Me: Finish setting up, Goals, Display and Data';
export const safety = false;

const flat = s => s.replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ');

const finishSettingUp = {
  name: 'finish setting up, and Not now',
  async run(t) {
    const page = await t.open({ seed: persona('P02', { patch: { profile: { needsHealthReview: true } } }), route: '/me' });
    const main = page.getByRole('main');
    await t.step(1, 'Me starts with the chapter to finish, which opens where its answers are', async () => {
      const group = ui.section(main, 'Finish setting up · 1 short chapter');
      await t.must(await group.count() === 1, `Me has no “Finish setting up”: ${flat(await main.innerText()).slice(0, 300)}`);
      const row = ui.row(group, 'Your health', 'link');
      await t.check(/Your health answers need a review/.test(flat(await row.innerText())), 'the row does not say why');
      await t.checkpoint('me-finish');
      await ui.tap(row);
      await ui.heading(page, 'Profile & health');
      await t.check(await main.getByRole('button', { name: /^Your health answers need a review/ }).count() === 1, 'Profile & health offers no review');
      await ui.tap(ui.back(page, 'Me'));
      await ui.heading(page, 'Me');
    });
    await t.step(2, 'Not now: the row goes, and stays gone', async () => {
      await ui.tap(ui.button(main, 'Not now, Your health'));
      await page.waitForTimeout(300);
      await t.check(await ui.section(main, 'Finish setting up · 1 short chapter').count() === 0, 'the row stays after Not now');
      await t.reload();
      await t.check(await main.getByRole('heading', { name: /^Finish setting up/ }).count() === 0, 'the row came back after a reload');
      await t.check(JSON.stringify(docs(await t.db()).settings?.setup?.declined) === '["health"]', 'Not now was not stored');
    });
  },
};

const goals = {
  name: 'goals: a weekly change waits for Monday; the steps goal keeps its history',
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/me' });
    const main = page.getByRole('main');
    const ring = async () => (await page.getByRole('main').getByRole('img', { name: /^Moved this week:/ }).getAttribute('aria-label')) ?? '';
    const setGoal = async (row, field, value) => {
      await ui.tap(ui.row(main, row));
      const sheet = ui.sheet(page, row);
      await ui.type(sheet.getByRole('textbox', { name: field, exact: true }), String(value));
      await ui.tap(ui.button(sheet, 'Save goal'));
      await sheet.waitFor({ state: 'hidden' });
    };
    await t.step(1, 'Me → Goals: a first weekly goal of 150 counts this week', async () => {
      await ui.tap(ui.row(main, 'Goals', 'link'));
      await ui.heading(page, 'Goals');
      await t.check(/Weekly movement goal No goal/.test(flat(await main.innerText())), 'the weekly goal does not start empty');
      await setGoal('Weekly movement goal', 'Minutes each week', 150);
      await t.check(/Weekly movement goal 150 min a week/.test(flat(await main.innerText())), 'Goals does not show 150 min a week');
      await ui.tab(page, 'Home');
      await t.check(/ of 150 minutes$/.test(await ring()), `Home’s ring reads “${await ring()}”`);
    }, { input: 'weekly goal 150 min on Thursday 8 October' });
    await t.step(2, 'Change it to 120 on Thursday: it waits for Monday', async () => {
      await t.goto('/me/goals');
      await setGoal('Weekly movement goal', 'Minutes each week', 120);
      const text = flat(await main.innerText());
      await t.check(/Weekly movement goal 150 min a week/.test(text), 'this week lost its goal');
      await t.check(/From Monday 12 October: 120 min a week\. This week keeps 150 min\./.test(text), `Goals does not say the change waits: ${text.slice(0, 400)}`);
      await t.checkpoint('goals-pending');
    }, { input: 'weekly goal 120 min' });
    await t.step(3, 'Monday 12 October: Home and Goals read 120, and the history lists both', async () => {
      await t.setTime(Date.parse('2026-10-12T09:00:00+05:30'));
      await t.goto('/home');
      await t.check(/ of 120 minutes$/.test(await ring()), `Monday’s ring reads “${await ring()}”`);
      await t.goto('/me/goals');
      const text = flat(await main.innerText());
      await t.check(/Weekly movement goal 120 min a week/.test(text), 'Goals does not show 120 on Monday');
      await t.check(/120 min a week From 12 Oct 2026 150 min a week From 5 Oct 2026/.test(text), `the weekly history: ${text.slice(0, 500)}`);
    });
    await t.step(4, 'Steps: 6,000 on Monday, 7,000 on Tuesday; each day keeps its own', async () => {
      await setGoal('Daily steps goal', 'Steps a day', 6000);
      await t.setTime(Date.parse('2026-10-13T09:00:00+05:30'));
      await t.goto('/me/goals');
      await setGoal('Daily steps goal', 'Steps a day', 7000);
      const text = flat(await main.innerText());
      await t.check(/Daily steps goal 7,000 steps a day/.test(text), 'Goals does not show 7,000');
      await t.check(/7,000 steps a day From 13 Oct 2026 6,000 steps a day From 12 Oct 2026/.test(text), `the steps history: ${text.slice(0, 500)}`);
      await t.checkpoint('goals-history');
    }, { input: 'steps goal 6000 on 12 October, 7000 on 13 October' });
  },
};

const display = {
  name: 'display settings apply at once and hold',
  async run(t) {
    const page = await t.open({ seed: persona('P02'), route: '/me/display' });
    const main = page.getByRole('main');
    const root = () => page.evaluate(() => ({
      dark: document.documentElement.classList.contains('dark'),
      font: getComputedStyle(document.documentElement).fontSize,
      motion: document.documentElement.dataset.reduceMotion !== undefined,
      glass: document.documentElement.dataset.glass ?? '',
    }));
    const size = () => main.getByRole('radiogroup', { name: 'Text size' });
    await t.step(1, 'Theme: Dark, Light, then Automatic', async () => {
      const theme = main.getByRole('radiogroup', { name: 'Theme' });
      await ui.tap(ui.row(theme, 'Dark', 'radio'));
      await page.waitForTimeout(400);
      await t.check((await root()).dark, 'Dark did not darken the page');
      await ui.tap(ui.row(theme, 'Light', 'radio'));
      await page.waitForTimeout(400);
      await t.check(!(await root()).dark, 'Light left the page dark');
      await ui.tap(ui.row(theme, 'Automatic', 'radio'));
      await page.waitForTimeout(400);
      await t.check((await root()).dark === (t.project.scheme === 'dark'), 'Automatic does not follow the device');
      await t.check(docs(await t.db()).settings?.theme === 'system', 'Automatic was not stored');
    });
    await t.step(2, 'Text size: Largest applies at once, and Home takes one column', async () => {
      await ui.tap(ui.row(size(), 'Largest', 'radio'));
      await page.waitForTimeout(300);
      await t.check((await root()).font === '32px', `Largest set the root to ${(await root()).font}`);
      await t.check(docs(await t.db()).settings?.display?.textScale === 2, 'Largest was not stored');
      await t.checkpoint('display-largest');
      await ui.tab(page, 'Home');
      const cols = await page.getByRole('main').locator('section[data-group="move"] ul').getAttribute('class');
      await t.check(/\bgrid-cols-1\b/.test(cols ?? ''), `Home’s tiles keep “${cols}” at 200% text`);
    });
    await t.step(3, 'Reduce motion and Reduce transparency', async () => {
      await t.goto('/me/display');
      await ui.tap(main.getByRole('switch', { name: 'Reduce motion', exact: true }));
      await ui.tap(main.getByRole('switch', { name: 'Reduce transparency', exact: true }));
      await page.waitForTimeout(300);
      const r = await root();
      await t.check(r.motion && r.glass === 'solid', `the page is not reduced: ${JSON.stringify(r)}`);
      const d = docs(await t.db()).settings?.display ?? {};
      await t.check(d.reduceMotion === true && d.reduceTransparency === true, `stored: ${JSON.stringify(d)}`);
    });
    await t.step(4, 'A reload keeps everything; Standard gives back the device’s size', async () => {
      await t.reload();
      const r = await root();
      await t.check(r.font === '32px' && r.motion && r.glass === 'solid', `after a reload: ${JSON.stringify(r)}`);
      await ui.tap(ui.row(size(), 'Standard', 'radio'));
      await page.waitForTimeout(300);
      await t.check((await root()).font === '16px', `Standard left the root at ${(await root()).font}`);
      await t.checkpoint('display-standard');
    });
  },
};

const systemMotion = {
  name: 'the device’s Reduce Motion comes first',
  async run(t) {
    const page = await t.open({ seed: persona('P02'), route: '/me/display', reducedMotion: 'reduce' });
    await t.step(1, 'Reduce motion is on, and says the device set it', async () => {
      const main = page.getByRole('main');
      const sw = main.getByRole('switch', { name: 'Reduce motion', exact: true });
      await t.check(await sw.getAttribute('aria-checked') === 'true', 'the switch is off while the device reduces motion');
      await t.check(/On, because this device’s Reduce Motion is on\./.test(flat(await main.innerText())), 'the row does not say the device set it');
      await t.checkpoint('display-system-motion');
    });
  },
};

const deleteTwice = {
  name: 'Delete everything asks twice',
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/me/data' });
    const main = page.getByRole('main');
    await t.step(1, 'Delete everything → the first answer erases nothing → Keep my record', async () => {
      const before = await t.db();
      await ui.tap(ui.row(main, 'Delete everything on this device'));
      const sheet = ui.sheet(page, 'Delete everything');
      await ui.tap(ui.button(sheet, 'Delete everything'));
      await ui.button(sheet, 'Erase all').waitFor();
      await t.checkpoint('delete-second-ask');
      await t.check(data.sameSnapshot(before, await t.db()).length === 0, 'the first confirmation changed the record');
      await ui.tap(ui.button(sheet, 'Keep my record'));
      await sheet.waitFor({ state: 'hidden' });
      await t.check(data.sameSnapshot(before, await t.db()).length === 0, 'Keep my record changed the record');
      await t.check(await t.route() === '/me/data', `Keep my record left Data for ${await t.route()}`);
    });
  },
};

const refusedAnswers = {
  name: 'H4-04: an answer the device refuses keeps its row, with why and Try again',
  async run(t) {
    const page = await t.open({ seed: persona('P02', { patch: { profile: { needsHealthReview: true } } }), route: '/me' });
    const main = page.getByRole('main');
    const group = () => ui.section(main, 'Finish setting up · 1 short chapter');
    t.allowConsole('acceptance-injected');
    await t.step(1, 'Not now, with the settings write refused: the row stays, and says it did not save', async () => {
      await t.must(await group().count() === 1, `Me has no “Finish setting up”: ${flat(await main.innerText()).slice(0, 300)}`);
      await t.setPageFaults([{ op: 'put', store: 'settings', match: { key: 'settings' }, action: 'quotaDom' }]);
      await ui.tap(ui.button(main, 'Not now, Your health'));
      await page.waitForTimeout(800);
      await t.checkpoint('h4-04-refused');
      await t.check(await group().count() === 1 && await ui.row(group(), 'Your health', 'link').count() === 1, 'the row went though the device refused the answer');
      const alert = group().getByRole('alert');
      await t.check(await alert.count() === 1 && /That did not save\./.test(flat(await alert.innerText())), 'the row does not say the answer did not save');
      await t.check(await ui.button(group(), 'Not now, Your health').count() === 1, 'no Not now to try again');
    });
    await t.step(2, 'Try again once the device stores: the row goes, and stays gone', async () => {
      await t.setPageFaults(null);
      await ui.tap(ui.button(main, 'Not now, Your health'));
      await page.waitForTimeout(800);
      await t.check(await group().count() === 0, 'the row stays after its answer was stored');
      await t.reload();
      await t.check(await main.getByRole('heading', { name: /^Finish setting up/ }).count() === 0, 'the row came back after a reload');
      await t.check(JSON.stringify(docs(await t.db()).settings?.setup?.declined) === '["health"]', 'Not now was not stored');
    });
  },
};

const goalsAtMidnight = {
  name: 'H4-06: Goals and Me left open from Sunday into Monday',
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/me/goals' });
    const main = page.getByRole('main');
    const setGoal = async value => {
      await ui.tap(ui.row(main, 'Weekly movement goal'));
      const sheet = ui.sheet(page, 'Weekly movement goal');
      await ui.type(sheet.getByRole('textbox', { name: 'Minutes each week', exact: true }), String(value));
      await ui.tap(ui.button(sheet, 'Save goal'));
      await sheet.waitFor({ state: 'hidden' });
    };
    await t.step(1, 'Thursday: a first goal of 150, then 120, which waits for Monday', async () => {
      await ui.heading(page, 'Goals');
      await setGoal(150);
      await setGoal(120);
      await t.check(/From Monday 12 October: 120 min a week\. This week keeps 150 min\./.test(flat(await main.innerText())), 'the change does not wait for Monday');
    }, { input: '150, then 120, on Thursday 8 October' });
    await t.step(2, 'Sunday 23:59, Goals open; the clock passes midnight: Monday’s goal is 120, and nothing is pending', async () => {
      await t.setTime(Date.parse('2026-10-11T23:59:30+05:30'));
      await t.goto('/me/goals');
      await t.check(/Weekly movement goal 150 min a week/.test(flat(await main.innerText())), 'Sunday does not keep 150');
      await t.advance(60_000);
      const text = flat(await main.innerText());
      await t.checkpoint('h4-06-goals-monday');
      await t.check(/Weekly movement goal 120 min a week/.test(text), `Goals still reads last week’s goal after midnight: ${text.slice(0, 300)}`);
      await t.check(!/From Monday 12 October/.test(text), 'Goals still calls Monday’s goal pending after midnight');
    });
    await t.step(3, 'Me open across the next midnight: its Goals row follows the clock too', async () => {
      await t.setTime(Date.parse('2026-10-18T23:59:30+05:30'));
      await setGoal(90);
      await ui.tap(ui.back(page, 'Me'));
      await ui.heading(page, 'Me');
      const row = () => ui.row(main, 'Goals', 'link');
      await t.check(/120 min a week/.test(flat(await row().innerText())), `Sunday’s Me reads: ${flat(await row().innerText())}`);
      await t.advance(60_000);
      await t.check(/90 min a week/.test(flat(await row().innerText())), `Me’s Goals row still reads last week’s goal after midnight: ${flat(await row().innerText())}`);
    }, { input: '90 on Sunday 18 October, 23:59' });
  },
};

const liveMotion = {
  name: 'H4-07: the device’s Reduce Motion changed while Display is open',
  async run(t) {
    const page = await t.open({ seed: persona('P02'), route: '/me/display', reducedMotion: 'reduce' });
    const main = page.getByRole('main');
    const sw = () => main.getByRole('switch', { name: 'Reduce motion', exact: true });
    const says = async () => /On, because this device’s Reduce Motion is on\./.test(flat(await main.innerText()));
    await t.step(1, 'The device reduces motion: the switch is on, the device’s doing', async () => {
      await t.check(await sw().getAttribute('aria-checked') === 'true' && await says(), 'the switch does not start on, by the device');
    });
    await t.step(2, 'The device stops reducing motion, Display still open: the switch is the app’s own again', async () => {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.waitForTimeout(400);
      await t.checkpoint('h4-07-device-off');
      await t.check(!(await says()), 'Display still says the device’s Reduce Motion is on after it stopped');
      await t.check(await sw().getAttribute('aria-checked') === 'false', 'the switch still reads on after the device stopped reducing motion');
      await t.check(!(await sw().isDisabled()) && await sw().getAttribute('aria-disabled') !== 'true', 'the switch is still disabled after the device stopped reducing motion');
    });
    await t.step(3, 'And on again: the device’s doing once more', async () => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForTimeout(400);
      await t.check(await sw().getAttribute('aria-checked') === 'true' && await says(), 'the switch does not follow the device turning Reduce Motion on');
    });
  },
};

const licences = {
  name: 'KH-17: Sources and licences names the licences',
  async run(t) {
    const page = await t.open({ seed: persona('P02'), route: '/me' });
    const main = page.getByRole('main');
    await t.step(1, 'Me → About → Sources and licences: the figure, the voice and the maps, each with its licence', async () => {
      await ui.tap(ui.row(main, 'Sources and licences', 'link'));
      await ui.heading(page, 'Sources');
      const group = ui.section(main, 'Licences');
      await t.must(await group.count() === 1, `Sources and licences has no Licences: ${flat(await main.innerText()).slice(-400)}`);
      const text = flat(await group.innerText());
      await t.checkpoint('kh-17-licences');
      await t.check(/The coach figure.*MakeHuman \(MPFB2\).*CC0 1\.0/.test(text), `the figure’s licence: ${text}`);
      await t.check(/The coach’s voice.*Kokoro-82M.*Apache License 2\.0/.test(text), `the voice’s licence: ${text}`);
      await t.check(/Map pictures.*© OpenStreetMap contributors.*Open Database Licence \(ODbL\)/.test(text), `the maps’ licence: ${text}`);
    });
  },
};

export const cases = [finishSettingUp, goals, display, systemMotion, deleteTwice, refusedAnswers, goalsAtMidnight, liveMotion, licences];
