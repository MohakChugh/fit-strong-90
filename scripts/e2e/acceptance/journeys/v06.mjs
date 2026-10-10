/**
 * V-J06, a guided workout (journey §17.1, B-30): the Workout tile → Right
 * now, today's session in the tile's own words → Check in & start → the
 * check-in → the player → its summary → back where it was started from, the
 * Workout hub. P01, in the programme, on a training day.
 */
import { persona } from '../fixtures/personas.mjs';
import * as hub from '../lib/hub.mjs';
import * as move from '../lib/move.mjs';
import * as player from '../lib/player.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'VJ06';
export const title = 'A guided workout from its hub, back to the hub';
export const safety = false;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();

export const cases = [{
  name: 'Workout tile → session → back to the Workout hub',
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/home' });
    let tileWords = '';

    await t.step(1, 'The Workout tile and its hub say the same session', async () => {
      tileWords = flat(await hub.tile(page, 'Workout').innerText());
      await hub.open(t, 'guided');
      const card = hub.card(page);
      const heading = flat(await card.getByRole('heading', { level: 3 }).innerText());
      await t.checkpoint('workout-hub');
      await t.check(heading.length > 0 && tileWords.includes(heading.split(' · ')[0]), `the hub's Right now (“${heading}”) is not the tile's session (“${tileWords}”)`);
      await t.check(await hub.start(page).count() === 1 && flat(await hub.start(page).innerText()) === 'Check in & start', `the hub's start reads “${await hub.start(page).allInnerTexts()}”`);
    });

    await t.step(2, 'Check in & start → the check-in → the player', async () => {
      const r = await hub.begin(t);
      await t.must(!!r.sheet, `Check in & start opened ${r.route}, not the check-in`);
      await ui.answerCheckIn(t, r.sheet, ui.normalAnswers('P01'));
      await t.must(await move.sheetStart(r.sheet).count() === 1, `the check-in does not allow the session: ${(await move.outcome(page)).title}`);
      await ui.tap(move.sheetStart(r.sheet));
      await page.waitForURL(/#\/session/, { timeout: 15000 });
      await player.begin(page);
      await t.checkpoint('workout-player');
    }, { input: 'normal answers; BP 124/78, then 122/76' });

    await t.step(3, 'End early → the summary → Save and finish → the Workout hub', async () => {
      await ui.tap(player.control(page, 'End session'));
      const leave = page.getByRole('dialog', { name: 'Leave the session?' });
      await leave.waitFor();
      await ui.tap(ui.button(leave, 'Finish now'));
      await page.getByRole('heading', { level: 1, name: /complete$/ }).waitFor();
      await t.checkpoint('workout-summary');
      await ui.tap(page.getByRole('button', { name: /Save and finish/ }));
      await page.getByText('Saved', { exact: true }).waitFor({ timeout: 8000 });
      await page.waitForFunction(() => location.hash.replace(/^#/, '').split('?')[0] === '/hub/workout', null, { timeout: 15000 }).catch(() => {});
      await t.check(await t.route() === '/hub/workout', `after the summary the app went to ${await t.route()}, not back to the Workout hub (B-30)`);
      const history = ui.section(page.getByRole('main'), 'History');
      await t.check(await history.getByRole('link').count() >= 1, 'the Workout hub’s History does not list the session');
    });
  },
}];
