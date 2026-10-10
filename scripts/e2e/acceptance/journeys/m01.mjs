/**
 * M01: Me's own journeys (journey §16; Plan 4): Finish setting up, Goals,
 * Display, and Data's two confirmations. Browse, Home's tiles, calendar
 * copies and backups have their V-J journeys.
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

export const cases = [finishSettingUp, goals];
