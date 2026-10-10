/**
 * V-J15, a stop from a tile (journey §17.1, §4.7): the Stretch tile → its hub
 * → Check in & start → the check-in reports new leg weakness → the stop, and
 * the safety surface on every tab. The Stretch hub then shows the same stop,
 * with no start, while Learn and a reading hub still open and still add.
 * P01.
 */
import { persona } from '../fixtures/personas.mjs';
import * as hub from '../lib/hub.mjs';
import * as move from '../lib/move.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'VJ15';
export const title = 'A stop from a tile, on every tab, with Learn and readings still open';
export const safety = true;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();
const STOP = 'No exercise today. Get medical advice today.';

export const cases = [{
  name: 'new leg weakness in the Stretch check-in',
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/home' });
    const main = page.getByRole('main');

    await t.step(1, 'Stretch tile → hub → Check in & start → new leg weakness', async () => {
      await hub.open(t, 'stretch');
      const r = await hub.begin(t);
      await t.must(!!r.sheet, `Check in & start opened ${r.route}, not the check-in`);
      await ui.answerCheckIn(t, r.sheet, ui.normalAnswers('P01', { back: { pain: 3, leg: 4, reach: 'Below knee', flags: [ui.BACK_FLAG.newWeakness] } }));
      await page.waitForTimeout(600);
      const { title: outcome } = await move.outcome(page);
      await t.checkpoint('tile-stop-outcome');
      await t.check(outcome === STOP, `the check-in reads “${outcome}”, not “${STOP}”`);
      await t.check(await move.sheetStart(r.sheet).count() === 0, 'the check-in still offers a start');
      await ui.tap(ui.button(r.sheet, 'Close'));
    }, { input: 'normal answers, with back 3, leg 4 below the knee, and new foot drop or a leg getting weaker' });

    await t.step(2, 'The stop and the safety surface on every tab', async () => {
      for (const tab of ['Home', 'Trends', 'Browse', 'Me']) {
        await ui.tab(page, tab);
        const u = await hub.urgent(page);
        await t.check(!!u && u.kind === 'seekHelp' && u.headline === STOP, `${tab} shows ${u ? `“${u.headline}” (${u.kind})` : 'no safety surface'}`);
      }
      await t.checkpoint('tile-stop-tabs');
    });

    await t.step(3, 'The Stretch hub: the same stop, with no start', async () => {
      await hub.open(t, 'stretch');
      const r = await hub.refusal(page);
      await t.checkpoint('tile-stop-stretch-hub');
      await t.check(!!r && r.title === STOP, `the Stretch hub reads “${r?.title}”`);
      await t.check(!!r?.review, 'the stop offers no “Review today’s check-in” to put a mistaken answer right');
      const starts = (await main.getByRole('button').allInnerTexts()).map(flat).filter(l => hub.STARTERS.test(l));
      await t.check(starts.length === 0, `the Stretch hub offers ${JSON.stringify(starts)}`);
    });

    await t.step(4, 'Learn and a reading hub still open, and a reading can still be added', async () => {
      await hub.openHub(t, 'Learn', '/hub/learn');
      await t.check(await main.getByRole('searchbox', { name: 'Search Learn' }).count() === 1, 'Learn does not open during the stop');
      await hub.openHub(t, 'Glucose', '/hub/glucose');
      await ui.tap(ui.button(main, 'Add reading'));
      const form = page.getByRole('dialog', { name: 'Glucose' });
      await form.waitFor({ timeout: 10000 });
      await t.check(await form.getByRole('textbox', { name: 'Reading', exact: true }).count() === 1, 'the Glucose form does not open during the stop');
      await ui.tap(ui.button(form, 'Close'));
      await t.checkpoint('tile-stop-still-open');
    });
  },
}];
