/**
 * V-J05, a blood pressure check day (journey §17.1): the BP tile says "Check
 * day" → the hub says when to check → Add reading → two readings with the
 * guided minute → saved → the hub shows them with NICE's reading of home
 * blood pressure. P01: treated, with a monitor, no full day in the last week.
 */
import { persona } from '../fixtures/personas.mjs';
import { saveForm } from '../lib/data.mjs';
import * as hub from '../lib/hub.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'VJ05';
export const title = 'A blood pressure check day, from the tile to the hub’s reading';
export const safety = false;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();

export const cases = [{
  name: 'two morning readings a minute apart',
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/home' });
    const main = page.getByRole('main');

    await t.step(1, 'The BP tile says "Check day"; its hub says when and how', async () => {
      const tile = hub.tile(page, 'Blood pressure');
      await t.must(await tile.count() === 1, 'P01’s Home has no Blood pressure tile');
      await t.check(flat(await tile.innerText()).includes('Check day'), `the BP tile does not say “Check day”: ${flat(await tile.innerText())}`);
      await hub.openHub(t, 'Blood pressure', '/hub/bp');
      const next = ui.section(main, 'When to check next');
      await t.must(await next.count() === 1, 'the BP hub has no “When to check next”');
      const text = flat(await next.innerText());
      await t.checkpoint('bp-check-day-hub');
      await t.check(/Blood pressure check day/.test(text) && /two readings/i.test(text) && /a minute apart/.test(text), `when to check next says: ${text.slice(0, 200)}`);
      await t.check(/European Society of Hypertension/.test(text), 'the check day does not name its source');
    });

    await t.step(2, 'Add reading → two readings, the second after the guided minute', async () => {
      await ui.tap(ui.button(main, 'Add reading'));
      const form = page.getByRole('dialog', { name: 'Blood pressure' });
      await form.waitFor({ timeout: 10000 });
      await ui.type(form.getByRole('textbox', { name: 'Top (systolic)', exact: true }), '124');
      await ui.type(form.getByRole('textbox', { name: 'Bottom (diastolic)', exact: true }), '78');
      await ui.tap(ui.button(form, 'Add a second reading'));
      await t.check(/Sit quietly\. Take the second reading in a minute\./.test(flat(await form.innerText())), 'the minute between readings is not guided');
      await t.advance(60_000);
      await page.waitForTimeout(400);
      const second = form.getByRole('group', { name: 'Second reading' });
      await ui.type(second.getByRole('textbox', { name: 'Top (systolic)', exact: true }), '122');
      await ui.type(second.getByRole('textbox', { name: 'Bottom (diastolic)', exact: true }), '76');
      await t.checkpoint('bp-two-readings');
      await t.must(await saveForm(t, form) === 'closed', 'the two readings did not save');
    }, { input: '124/78, then 122/76 a minute later' });

    await t.step(3, 'Saved: Latest, its time, and NICE’s reading of home blood pressure', async () => {
      const latest = ui.section(main, 'Latest');
      const text = flat(await latest.innerText());
      await t.checkpoint('bp-saved');
      await t.check(/122\/76 mmHg/.test(text) && /9:01 am/.test(text), `Latest reads: ${text.slice(0, 200)}`);
      const page_ = flat(await main.innerText());
      await t.check(/NICE judges home blood pressure on the average of readings over 4 to 7 days, not on one reading\./.test(page_), 'the hub does not say how NICE reads home blood pressure');
      const history = ui.section(main, 'History');
      await t.check(await history.getByRole('link').count() >= 1, 'History lists no reading');
      await t.check(/Saved on this device: Blood pressure/.test(page_), 'no confirmation that it saved on this device');
    });
  },
}];
