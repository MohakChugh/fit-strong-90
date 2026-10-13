/**
 * V-J27, the first days of trends (journey §17.2, §12.2): one reading → its
 * point shows at once; the comparison waits for 3 days with data in both
 * weeks, then appears, like for like; a lab result needs no daily data.
 * P03, from Monday 28 September, one glucose each morning at 9 am.
 */
import { persona } from '../fixtures/personas.mjs';
import * as data from '../lib/data.mjs';
import * as g from '../lib/guide.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'VJ27';
export const title = 'First days of trends: a point at once, a comparison after 3 days in both weeks, labs at once';
export const safety = false;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();
const IST = iso => Date.parse(`${iso}+05:30`);

/** The Glucose trend's words, opened from the Trends tab. */
async function glucoseWeek(t) {
  const main = t.page.getByRole('main');
  await g.tabTo(t, 'Trends');
  await ui.tap(main.getByRole('link', { name: /^Glucose\b/ }));
  await ui.heading(t.page, 'Glucose');
  return flat(await main.innerText());
}

export const cases = [{
  name: 'one reading, then 3 days in both weeks, then a lab result',
  async run(t) {
    const page = await t.open({ seed: persona('P03'), route: '/home', time: IST('2026-09-28T09:00:00') });
    const main = page.getByRole('main');

    await t.step(1, 'Monday 28 September: one reading, and its point shows at once', async () => {
      await data.logGlucose(t, { value: 118 });
      const text = await glucoseWeek(t);
      await t.check(text.includes('1 reading with a number') && text.includes('118'), `the first reading isn’t shown as the week’s average: ${text.slice(0, 300)}`);
      await t.check(text.includes('Comparisons start once there are 3 days with data in both weeks.'), `no early-days line: ${text.slice(0, 300)}`);
      await ui.tap(ui.button(main, 'Show as list'));
      const rows = await main.getByRole('table', { name: 'Glucose, This week' }).getByRole('row').count();
      await t.check(rows === 2, `the list has ${rows - 1} readings, not 1`);
      await t.checkpoint('vj27-one-reading');
    }, { input: 'glucose 118 mg/dL at 9:00 am' });

    await t.step(2, 'Tuesday and Wednesday: 112, then 115', async () => {
      for (const [day, value] of [['2026-09-29', 112], ['2026-09-30', 115]]) {
        await t.setTime(IST(`${day}T09:00:00`));
        await data.logGlucose(t, { value });
      }
    }, { input: 'glucose 112 and 115 mg/dL, each at 9:00 am' });

    await t.step(3, 'The next Monday and Tuesday: 124, then 122. Two days this week: still no comparison', async () => {
      for (const [day, value] of [['2026-10-05', 124], ['2026-10-06', 122]]) {
        await t.setTime(IST(`${day}T09:00:00`));
        await data.logGlucose(t, { value });
      }
      const text = await glucoseWeek(t);
      await t.check(text.includes('Comparisons start once there are 3 days with data in both weeks.') && !/Higher than|Lower than/.test(text), `a comparison appeared before 3 days in both weeks: ${text.slice(0, 300)}`);
    }, { input: 'glucose 124 and 122 mg/dL, each at 9:00 am' });

    await t.step(4, 'Wednesday 7 October: 120, and the comparison appears, Monday to Wednesday against Monday to Wednesday', async () => {
      await t.setTime(IST('2026-10-07T09:00:00'));
      await data.logGlucose(t, { value: 120 });
      const text = await glucoseWeek(t);
      await t.check(text.includes('Higher than last week · +7 mg/dL') && text.includes('Mon–Wed vs last Mon–Wed'), `the comparison isn’t Mon–Wed against Mon–Wed: ${text.slice(0, 400)}`);
      await t.check(text.includes('3 readings, all with a number') && text.includes('122'), `this week’s average isn’t 122 from 3 readings: ${text.slice(0, 300)}`);
      await t.checkpoint('vj27-compared');
    }, { input: 'glucose 120 mg/dL at 9:00 am' });

    await t.step(5, 'An HbA1c of 7.1%: Labs shows it at once, as the first result', async () => {
      await data.logLab(t, 'HbA1c', 7.1);
      await g.tabTo(t, 'Trends');
      await ui.tap(main.getByRole('link', { name: /^Labs\b/ }));
      await ui.heading(page, 'Labs');
      const text = flat(await main.innerText());
      await t.check(text.includes('7.1%') && text.includes('First result'), `Labs doesn’t show the first result: ${text.slice(0, 300)}`);
      await t.check(await ui.radio(main.getByRole('radiogroup', { name: 'Which result' }), 'HbA1c').getAttribute('aria-checked') === 'true', 'Labs did not open on HbA1c');
      await t.checkpoint('vj27-labs');
    }, { input: 'HbA1c 7.1%' });
  },
}];
