/**
 * V-J01, the first morning (journey §17.1): diabetes, blood pressure and back
 * pain. Launch → Home → Right now "Check in & stretch", with its reason →
 * the check-in, with two blood pressure readings a minute apart → Go ahead →
 * the stretch player → its summary → Home, where the week has 10 more
 * minutes and "Stretched 1 day". P01 with stretching as the stated focus and
 * not in the programme, so Right now's suggestion is the stretch.
 */
import { persona } from '../fixtures/personas.mjs';
import * as move from '../lib/move.mjs';
import * as player from '../lib/player.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'VJ01';
export const title = 'The first morning: check in, stretch, and see the week move';
export const safety = false;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();
const moved = text => Number(/(\d+) min moved this week/.exec(text)?.[1] ?? 0);

export const cases = [{
  name: 'Right now → check-in → stretch → Home',
  async run(t) {
    const page = await t.open({ seed: persona('P01', { patch: { settings: { startDate: '', focus: 'stretch' } } }), route: '' });
    const main = page.getByRole('main');
    let before = 0;

    await t.step(1, 'Launch: Home, with Right now offering the stretch and its reason', async () => {
      await t.must(/^\/home/.test(await t.route()), `launch opened ${await t.route()}, not Home`);
      const card = ui.rightNow(page);
      await t.must(await card.count() === 1, 'Home has no Right now card');
      const text = flat(await card.innerText());
      await t.check(/stretch/i.test(text) && /Why this\?/.test(text), `Right now does not suggest a stretch with its reason: ${text.slice(0, 200)}`);
      await t.check(await card.getByRole('button', { name: 'Check in & stretch', exact: true }).count() === 1, `Right now's button is not "Check in & stretch": ${text.slice(0, 200)}`);
      before = moved(flat(await main.innerText()));
      await t.checkpoint('first-morning-home');
    });

    await t.step(2, 'Tap it: the check-in, two readings a minute apart, then Go ahead', async () => {
      await ui.tap(ui.rightNow(page).getByRole('button', { name: 'Check in & stretch', exact: true }));
      const sheet = move.checkInSheet(page);
      await sheet.waitFor({ timeout: 15000 });
      await ui.answerCheckIn(t, sheet, ui.normalAnswers('P01'));
      const { title: outcome } = await move.outcome(page);
      await t.checkpoint('first-morning-outcome');
      await t.check(outcome === 'Good to go' || outcome === 'Go ahead, with changes', `the check-in reads “${outcome}”, not Go ahead`);
      await t.must(await move.sheetStart(sheet).count() === 1, 'the check-in offers no way on to the stretch');
      await ui.tap(move.sheetStart(sheet));
      await page.waitForURL(/#\/session/, { timeout: 15000 });
    }, { input: 'normal answers; BP 124/78, then 122/76 a minute later' });

    await t.step(3, 'The stretch player, to its summary, saved', async () => {
      await player.begin(page);
      const { ran } = await player.runStretchToEnd(t);
      t.note(`the stretch ran ${Math.round(ran / 60000)} min on the test clock`);
      await t.checkpoint('first-morning-summary');
      await player.saveStretch(t);
    });

    await t.step(4, 'Home: 10 more minutes this week, and "Stretched 1 day"', async () => {
      await page.waitForFunction(() => location.hash.startsWith('#/home'), null, { timeout: 15000 });
      await ui.heading(page, ui.HOME_TITLE);
      const text = flat(await main.innerText());
      const after = moved(text);
      await t.checkpoint('first-morning-week');
      // The routine is 10 minutes; whole minutes are counted, so the change is 10 within a minute's rounding.
      await t.check(Math.abs(after - before - 10) <= 1, `the week moved from ${before} to ${after} min, not by 10`);
      await t.check(/Stretched 1 day\b/.test(text), `Home does not say “Stretched 1 day”: ${text.match(/Stretch[^.]{0,40}/)?.[0] ?? 'nothing'}`);
    });
  },
}];
