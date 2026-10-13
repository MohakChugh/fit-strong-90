/**
 * V-J07, see my week (journey §17.1): Trends → Your week → the Steps row →
 * Week bars against last week → back. P02, whose steps were entered at
 * 8 pm each evening for a fortnight. Then B-20's brief: on Monday from
 * 04:00, Home offers "Your week in brief"; it opens Trends at last week, and
 * once opened it isn't offered again.
 */
import { persona } from '../fixtures/personas.mjs';
import * as data from '../lib/data.mjs';
import * as g from '../lib/guide.mjs';
import { content } from '../lib/harness.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'VJ07';
export const title = 'See my week: Your week, then Steps against last week, and the brief on Monday';
export const safety = false;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();
const STEPS = [
  ['2026-09-28', 5000], ['2026-09-29', 6000], ['2026-09-30', 5800], ['2026-10-01', 6200], ['2026-10-02', 4000], ['2026-10-03', 8000], ['2026-10-04', 3500],
  ['2026-10-05', 6000], ['2026-10-06', 7000], ['2026-10-07', 5500],
];
const fortnight = () => data.transferDoc({
  observations: STEPS.map(([day, value]) => data.obs({ id: `v07-${day}`, kind: 'steps', value, scope: 'dayTotal', source: 'manual', at: `${day}T20:00:00.000+05:30` })),
});

export const cases = [{
  name: 'Trends → Your week → Steps → Week against last week → back',
  async run(t) {
    const page = await t.open({ seed: persona('P02'), route: '/home' });
    const main = page.getByRole('main');

    await t.step(1, 'Merge the fortnight of steps (the defined setup)', async () => {
      await data.importFixture(t, 'v07-steps.json', fortnight());
      const steps = (await t.db()).observations.filter(o => o.kind === 'steps');
      await t.must(steps.length === 10, `${steps.length} steps totals stored, not 10`);
    }, { input: 'steps entered at 8 pm each day, 28 September to 7 October' });

    await t.step(2, 'Trends: Your week says the week’s steps in words, and shows 8 weeks of rings', async () => {
      await g.tabTo(t, 'Trends');
      const card = main.getByRole('region', { name: /^Your week/ });
      await t.must(await card.count() === 1, 'Trends has no Your week');
      const text = flat(await card.innerText());
      await t.check(text.includes('This week') && text.includes('6,167 steps a day on average this week, from 3 days with steps.'), `Your week reads: ${text.slice(0, 300)}`);
      await t.check(!/great|well done|keep it up|better|worse/i.test(text), `Your week judges: ${text.slice(0, 300)}`);
      await t.check(await main.getByRole('radiogroup', { name: 'Week' }).getByRole('radio').count() === 8, 'Trends does not show 8 weekly rings');
      await t.checkpoint('vj07-your-week');
    });

    await t.step(3, 'The Steps row: Week first, a day on average, against the same days of last week', async () => {
      await ui.tap(main.getByRole('link', { name: /^Steps\b/ }));
      await ui.heading(page, 'Steps');
      await t.check(await t.route() === '/trends/steps', `the Steps row opened ${await t.route()}`);
      await t.check(await ui.radio(main.getByRole('radiogroup', { name: 'Period' }), 'Week').getAttribute('aria-checked') === 'true', 'the trend did not open on Week (B-10)');
      const text = flat(await main.innerText());
      for (const want of ['This week', 'A day on average · 3 days with steps', '6,167', 'Higher than last week · +417 steps a day', 'Mon–Thu vs last Mon–Thu', 'Last week', 'Average 6,167 steps a day']) {
        await t.check(text.includes(want), `the Steps trend does not show “${want}”: ${text.slice(0, 400)}`);
      }
      await t.check(await ui.button(main, 'Previous week').isEnabled() && await ui.button(main, 'Next week').isDisabled(), 'the pager does not read “Previous week” and “Next week”, with no week after this one');
      await t.checkpoint('vj07-steps-week');
    });

    await t.step(4, 'The arrow keys read each day against last week; Escape puts the choice down', async () => {
      const slider = main.getByRole('slider', { name: 'Steps, This week' });
      await slider.focus();
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      const said = await slider.getAttribute('aria-valuetext');
      await t.check(said === 'Tuesday, 6 October: 7,000 steps, entered at 8:00 pm. Last week: 6,000 steps.', `Tuesday reads “${said}”`);
      await t.check(flat(await main.innerText()).includes('Tuesday, 6 October: 7,000 steps, entered at 8:00 pm.'), 'the chosen day’s words are not shown above the chart');
      await t.checkpoint('vj07-tuesday');
      await page.keyboard.press('Escape');
      await t.check(await slider.getAttribute('aria-valuenow') === '0', 'Escape did not put the choice down');
    });

    await t.step(5, 'Show as list: the same days in a table', async () => {
      await ui.tap(ui.button(main, 'Show as list'));
      const table = main.getByRole('table', { name: 'Steps, This week' });
      await table.waitFor();
      const tuesday = flat(await table.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Tuesday, 6 October' }) }).innerText());
      await t.check(tuesday === 'Tuesday, 6 October 7,000 steps, entered at 8:00 pm 6,000 steps', `Tuesday’s row reads “${tuesday}”`);
      await t.checkpoint('vj07-list');
    });

    await t.step(6, 'Back to Trends', async () => {
      await ui.tap(ui.back(page, 'Trends'));
      await ui.heading(page, 'Trends');
      await t.check(await t.route() === '/trends', `Back went to ${await t.route()}, not /trends`);
    });
  },
}, {
  name: 'Your week in brief on Monday morning, until it’s opened (B-20)',
  async run(t) {
    const page = await t.open({ seed: persona('P02'), route: '/home', time: Date.parse('2026-10-12T04:05:00+05:30') });
    const main = page.getByRole('main');

    await t.step(1, 'Merge the fortnight of steps; Home offers Your week in brief', async () => {
      await data.importFixture(t, 'v07-steps.json', fortnight());
      await g.tabTo(t, 'Home');
      await t.must(await ui.row(main, 'Your week in brief', 'link').count() === 1, `Home does not offer the brief: ${flat(await main.innerText()).slice(0, 300)}`);
      await t.checkpoint('vj07-brief-offered');
    }, { input: 'Monday 12 October, 4:05 am' });

    await t.step(2, 'Open it: Trends at last week, in a few sentences, kept as seen', async () => {
      await ui.tap(ui.row(main, 'Your week in brief', 'link'));
      await ui.heading(page, 'Trends');
      await t.check(await t.route() === '/trends?week=2026-10-05', `the brief opened ${await t.route()}`);
      const card = flat(await main.getByRole('region', { name: /^Your week/ }).innerText());
      await t.check(card.includes('Last week') && card.includes('6,167 steps a day on average last week, from 3 days with steps.'), `last week’s brief reads: ${card.slice(0, 300)}`);
      // Opening it writes the week as seen as the tap navigates: wait for the write, never race it.
      const seen = await data.waitDb(t, snap => content(snap)['trends:weekBrief'] !== undefined, 'opening the brief did not keep it as seen').catch(() => null);
      await t.check(JSON.stringify(content(seen ?? await t.db())['trends:weekBrief']) === '["2026-10-05"]', `opening the brief kept ${JSON.stringify(content(seen ?? await t.db())['trends:weekBrief'])} as seen, not ["2026-10-05"]`);
      await t.checkpoint('vj07-brief-opened');
    });

    await t.step(3, 'Home no longer offers it this week', async () => {
      await g.tabTo(t, 'Home');
      await t.check(await ui.row(main, 'Your week in brief', 'link').count() === 0, 'Home still offers the brief after it was opened');
    });
  },
}];
