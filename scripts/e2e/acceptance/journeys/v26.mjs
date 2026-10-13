/**
 * V-J26, partial steps (journey §17.2, §9.6): 6,050 entered at midday → a
 * FitStrong walk after it → "at least", with both sources, in Trends and on
 * Home → a final total in the evening → it replaces the earlier one and
 * isn't added to it. P02. The walk arrives as the walk screen writes one,
 * merged through Restore: the walk itself is Plan 6's.
 */
import { persona } from '../fixtures/personas.mjs';
import * as data from '../lib/data.mjs';
import * as g from '../lib/guide.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'VJ26';
export const title = 'Partial steps: at least, with both sources, then replaced by the final total';
export const safety = false;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();
const at = time => `2026-10-08T${time}:00.000+05:30`;
const walk = () => data.transferDoc({
  observations: [
    ...['walkDuration', 'movementMinutes'].map(kind => data.obs({ id: `v26-walk-${kind}`, kind, value: 20, scope: 'sessionObserved', source: 'measured', at: at('15:00'), coverageMs: 1_200_000, context: 'walk:v26-walk' })),
    data.obs({ id: 'v26-walk-steps', kind: 'steps', value: 1250, scope: 'sessionObserved', source: 'measured', at: at('15:00'), coverageMs: 1_200_000, context: 'walk:v26-walk' }),
  ],
});

/** Today in the Steps trend, as VoiceOver hears it: End chooses the last day so far. */
async function todayInSteps(t) {
  const main = t.page.getByRole('main');
  await g.tabTo(t, 'Trends');
  await ui.tap(main.getByRole('link', { name: /^Steps\b/ }));
  await ui.heading(t.page, 'Steps');
  const slider = main.getByRole('slider', { name: 'Steps, This week' });
  await slider.focus();
  await t.page.keyboard.press('End');
  return slider.getAttribute('aria-valuetext');
}

export const cases = [{
  name: 'entered at midday, a walk after it, then the final total',
  async run(t) {
    const page = await t.open({ seed: persona('P02'), route: '/home' });
    const main = page.getByRole('main');

    await t.step(1, 'At 12:05, enter 6,050 steps for today', async () => {
      await t.setTime(Date.parse(at('12:05')));
      await data.logTotal(t, 'steps', 6050);
      const stored = (await t.db()).observations.filter(o => o.kind === 'steps' && o.scope === 'dayTotal');
      await t.must(stored.length === 1 && stored[0].value === 6050 && stored[0].at.startsWith('2026-10-08T12:05'), `the total is stored as ${JSON.stringify(stored)}`);
    }, { input: '6,050 steps at 12:05 pm' });

    await t.step(2, 'At 3:30 pm, a FitStrong walk from 3:00 pm with 1,250 steps (the defined setup)', async () => {
      await t.setTime(Date.parse(at('15:30')));
      await data.importFixture(t, 'v26-walk.json', walk());
    }, { input: 'a 20-minute walk at 3:00 pm, 1,250 steps' });

    await t.step(3, 'Trends: today is at least 7,300, with both sources; Home says the same', async () => {
      const said = await todayInSteps(t);
      await t.check(said === 'Thursday, 8 October: at least 7,300 steps, 6,050 entered at 12:05 pm + 1,250 in walks after 12:05 pm. Last week: Not entered.', `today reads “${said}”`);
      const text = flat(await main.innerText());
      await t.check(text.includes('1 day shows at least the steps counted'), `the trend doesn’t say today is a lower bound: ${text.slice(0, 300)}`);
      await t.checkpoint('vj26-at-least');
      await g.tabTo(t, 'Home');
      const home = flat(await main.innerText());
      await t.check(home.includes('at least 7,300') && home.includes('6,050 entered at 12:05 pm + 1,250 in walks after 12:05 pm'), `Home’s steps line: ${home.match(/Steps today[^)]{0,120}/)?.[0] ?? 'none'}`);
    });

    await t.step(4, 'At 9 pm, enter the final 9,800: it replaces the total, and the walk isn’t added to it', async () => {
      await t.setTime(Date.parse(at('21:00')));
      await data.logTotal(t, 'steps', 9800);
      const said = await todayInSteps(t);
      await t.check(said === 'Thursday, 8 October: 9,800 steps, entered at 9:00 pm. Last week: Not entered.', `today reads “${said}”`);
      await t.check(!flat(await main.innerText()).includes('11,050'), 'the walk was added to the final total');
      const totals = (await t.db()).observations.filter(o => o.kind === 'steps' && o.scope === 'dayTotal').map(o => o.value).sort((a, b) => a - b);
      await t.check(JSON.stringify(totals) === '[6050,9800]', `the stored statements are ${JSON.stringify(totals)}: both are kept, and the later one counts`);
      await t.checkpoint('vj26-final');
    }, { input: '9,800 steps at 9:00 pm' });
  },
}];
