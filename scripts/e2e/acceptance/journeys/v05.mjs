/**
 * V-J05, a blood pressure check day (journey §17.1): the BP tile says "Check
 * day" → the hub says when to check → Add reading → two readings with the
 * guided minute → saved → the hub shows them with NICE's reading of home
 * blood pressure. P01: treated, with a monitor, no full day in the last week.
 * This week then lists each reading with when it was measured and its
 * Morning or Evening, and a day of three condenses into a labelled detail
 * holding them all (journey §4.10; codex H2-04).
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
      await ui.tap(ui.button(form, 'Morning'));
      await t.checkpoint('bp-two-readings');
      await t.must(await saveForm(t, form) === 'closed', 'the two readings did not save');
    }, { input: '124/78, then 122/76 a minute later, Morning' });

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

    await t.step(4, 'This week: each reading with its time and Morning, and a third reading condenses the day into a labelled detail', async () => {
      // Every clinical value shows when it was measured and its context (journey §4.10; codex H2-04).
      const week = () => ui.section(main, 'This week');
      const day = flat(await week().innerText());
      await t.check(/Thursday, 8 October/.test(day) && day.includes('124/78 mmHg at 9:00 am, morning; 122/76 mmHg at 9:01 am, morning'), `This week reads: ${day.slice(0, 300)}`);
      await t.advance(60_000);
      await ui.tap(ui.button(main, 'Add reading'));
      const form = page.getByRole('dialog', { name: 'Blood pressure' });
      await form.waitFor({ timeout: 10000 });
      await ui.type(form.getByRole('textbox', { name: 'Top (systolic)', exact: true }), '118');
      await ui.type(form.getByRole('textbox', { name: 'Bottom (diastolic)', exact: true }), '74');
      await ui.tap(ui.button(form, 'Evening'));
      await t.must(await saveForm(t, form) === 'closed', 'the third reading did not save');
      const condensed = flat(await week().innerText());
      await t.check(/; and 1 more/.test(condensed) && /All 3 readings/.test(condensed), `a day of three readings does not condense with a way to all of them: ${condensed.slice(0, 300)}`);
      await ui.tap(week().getByText('All 3 readings', { exact: true }));
      const every = week().getByRole('list', { name: 'Every reading on Thursday, 8 October' });
      await t.must(await every.count() === 1, 'the condensed day has no labelled detail');
      const items = (await every.getByRole('listitem').allInnerTexts()).map(flat);
      await t.checkpoint('bp-week-detail');
      await t.check(items.length === 3 && items[0] === '124/78 mmHg at 9:00 am, morning' && items[2] === '118/74 mmHg at 9:02 am, evening', `the detail lists: ${JSON.stringify(items)}`);
    }, { input: '118/74, Evening' });
  },
}];
