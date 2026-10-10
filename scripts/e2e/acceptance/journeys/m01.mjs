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

export const cases = [finishSettingUp];
