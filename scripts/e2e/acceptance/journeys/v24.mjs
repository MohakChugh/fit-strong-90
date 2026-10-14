/**
 * V-J24 with B-30's historical case (journey §17.2, §4.10): a glucose of 62
 * measured yesterday at 9:30 pm, entered today at 9 am. The guidance asks
 * when it was taken and words it as past; the record keeps its measured
 * time; Trends shows it at that time, named Low, never in the present
 * tense; and the safety surface on Trends is Home's, whatever Home's is.
 * P03, on a sulfonylurea.
 */
import { persona } from '../fixtures/personas.mjs';
import * as data from '../lib/data.mjs';
import * as g from '../lib/guide.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'VJ24';
export const title = 'Yesterday’s low, entered today: its own time, past-tense words, and the same safety surface on Trends';
export const safety = true;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();
/** The shell's urgent decision, as `UrgentProvider` puts it on the document (or none). */
const urgentKind = page => page.evaluate(() => document.documentElement.dataset.urgent ?? null);

export const cases = [{
  name: 'yesterday’s low in the guidance, the record and Trends',
  async run(t) {
    const page = await t.open({ seed: persona('P03'), route: '/home' });
    const main = page.getByRole('main');
    let home = null;

    await t.step(1, 'Enter 62 mg/dL measured yesterday at 9:30 pm, and say it was earlier', async () => {
      const form = await data.openForm(t, 'Glucose');
      await ui.type(form.getByRole('textbox', { name: 'Reading', exact: true }), '62');
      await ui.tap(ui.row(form, 'Time'));
      await ui.setDateTime(form.getByLabel('Time', { exact: true }), '2026-10-07T21:30');
      await t.must(await data.saveForm(t, form) === 'guidance', 'a low gave no guidance');
      const dialog = page.getByRole('dialog', { name: /^(Saved|What to do)$/ });
      // Only the questions the guidance asks: when it was taken, then, if it must be settled, whether it has been.
      for (const answer of ['No, it was earlier', 'No, not yet']) {
        const b = ui.button(dialog, answer);
        if (await b.count()) {
          await ui.tap(b);
          await page.waitForTimeout(300);
        }
      }
      const said = flat(await dialog.innerText());
      await t.check(/That was a low\./.test(said) && !/This is a low|Treat it now/.test(said), `the guidance for yesterday’s low isn’t in the past tense: ${said.slice(0, 300)}`);
      await t.checkpoint('vj24-guidance');
      await ui.tap(ui.button(dialog, 'Done'));
      await dialog.waitFor({ state: 'hidden' });
      const stored = (await t.db()).observations.find(o => o.kind === 'glucose' && o.value === 62);
      await t.must(stored?.day === '2026-10-07' && stored.at.startsWith('2026-10-07T21:30'), `the reading is stored at ${stored?.at}, not when it was measured`);
    }, { input: 'glucose 62 mg/dL, time 7 October 9:30 pm; "No, it was earlier"' });

    await t.step(2, 'Home’s safety surface, as it stands', async () => {
      await g.tabTo(t, 'Home');
      home = await urgentKind(page);
      t.note(`Home's urgent state: ${home ?? 'none'}`);
    });

    await t.step(3, 'Trends: the same surface; Your week counts the low in the past tense, or is paused beside the decision', async () => {
      await g.tabTo(t, 'Trends');
      await t.check(await urgentKind(page) === home, `Trends’ urgent state is ${await urgentKind(page)}, Home’s ${home}`);
      const card = flat(await main.getByRole('region', { name: /^Your week/ }).innerText());
      await t.check(home === null
        ? card.includes('1 glucose reading was below 70 mg/dL this week.')
        : card.includes('Your week’s summary returns once today’s safety advice has passed.'), `Your week reads: ${card.slice(0, 300)}`);
      await t.checkpoint('vj24-trends');
    });

    await t.step(4, 'The Glucose trend: the reading at its measured time, named Low, nothing in the present tense', async () => {
      await ui.tap(main.getByRole('link', { name: /^Glucose\b/ }));
      await ui.heading(page, 'Glucose');
      await t.check(await urgentKind(page) === home, `the Glucose trend’s urgent state is ${await urgentKind(page)}, Home’s ${home}`);
      await ui.tap(ui.button(main, 'Show as list'));
      const row = flat(await main.getByRole('table', { name: 'Glucose, This week' }).getByRole('row')
        .filter({ has: page.getByRole('rowheader', { name: 'Wednesday, 7 October' }) }).innerText());
      await t.check(row === 'Wednesday, 7 October 62 mg/dL at 9:30 pm Low', `the list row reads “${row}”`);
      const text = flat(await main.innerText());
      await t.check(/Below 70 mg\/dL 1\b/.test(text), `the stats don’t count 1 below 70 mg/dL: ${text.slice(0, 400)}`);
      // The trend is the record: what happened, never what to do now. The banner above it is the shell's.
      const chart = flat(await main.getByRole('region', { name: 'Glucose chart' }).innerText());
      await t.check(!/\b(is low|treat it|right now|now)\b/i.test(chart), `the chart speaks in the present tense: ${chart.slice(0, 300)}`);
      await t.checkpoint('vj24-glucose');
    });
  },
}];
