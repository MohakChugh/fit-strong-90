/**
 * V-J19, P04: the decision lapses during the first walk's questions
 * (journey §17.2 #19; §4.1, B-01; Review Focus 5). A fresh reading starts the
 * questions; 31 minutes later the last answer's tap asks the gate again, and
 * "Check glucose first" shows in place of a walk. The answer given is kept,
 * so the next Start asks nothing twice. Synthetic persona only.
 */
import { MINUTE } from '../lib/env.mjs';
import { persona } from '../fixtures/personas.mjs';
import { sheetStart } from '../lib/player.mjs';
import * as hub from '../lib/hub.mjs';
import * as ui from '../lib/ui.mjs';
import * as walk from '../lib/walk.mjs';

export const id = 'V19';
export const title = 'The decision lapses during the first walk’s questions';
export const safety = true;

const KEEP = 'Keep a record of your route on this phone?';

export const cases = [{
  name: 'thirty-one minutes over the route question',
  async run(t) {
    const page = await t.open({ seed: persona('P04'), route: '', sensors: { geo: 'grant', monotonic: 'wall' } });

    await t.step(1, 'Walk hub: location on; Start walk; check in with 110 now; the first question', async () => {
      await walk.openSetup(t);
      await walk.emit(page, 12.97, 77.59);
      await ui.tap(walk.gpsSwitch(page));
      await page.waitForFunction(() => document.querySelector('[role="switch"][aria-checked="true"]') !== null, null, { timeout: 5000 });
      await ui.tap(hub.start(page));
      const sheet = page.getByRole('dialog', { name: ui.CHECKIN });
      await sheet.waitFor();
      await ui.answerCheckIn(t, sheet, ui.normalAnswers('P04'));
      await page.waitForTimeout(400);
      await ui.tap(sheetStart(sheet));
      await page.getByRole('dialog', { name: KEEP }).waitFor({ timeout: 10000 });
      await t.check(!(await t.route()).startsWith('/walk/live'), 'the walk started before the question was answered');
      await t.checkpoint('first-question');
    }, { input: 'glucose 110 mg/dL meter, now (09:00)' });

    await t.step(2, 'Thirty-one minutes pass with the question open', async () => {
      await walk.elapse(t, 31 * MINUTE);
      await t.must(await page.getByRole('dialog', { name: KEEP }).count() === 1, 'the question went away by itself');
    }, { input: '+31 min (09:31)' });

    await t.step(3, '“No, don’t keep routes”: the gate’s new answer, and no walk', async () => {
      await ui.tap(ui.button(page.getByRole('dialog', { name: KEEP }), 'No, don’t keep routes'));
      await page.waitForTimeout(600);
      const held = page.getByRole('dialog', { name: 'Check glucose first' });
      await t.must(await held.count() === 1, `no “Check glucose first”: ${(await t.visible()).slice(0, 300)}`);
      const text = (await held.innerText()).replace(/\s+/g, ' ');
      await t.check(/within 30 minutes/.test(text), `the reason is not shown: ${text.slice(0, 300)}`);
      await t.check(await ui.button(held, 'Check in').count() === 1, 'no “Check in” on the refusal');
      await t.check(!(await t.route()).startsWith('/walk/live') && (await walk.stored(page)) === null, 'a walk started on a stale reading');
      await t.checkpoint('check-glucose-first');
    });

    await t.step(4, 'Check in with 112: Start walk goes straight to the walk, and asks nothing twice', async () => {
      await ui.tap(ui.button(page.getByRole('dialog', { name: 'Check glucose first' }), 'Check in'));
      const again = page.getByRole('dialog', { name: ui.CHECKIN });
      await again.waitFor();
      await t.check(/Last reading: 110 mg\/dL/.test(await again.innerText()), 'the check-in does not ask for a new reading after the old one');
      await ui.answerCheckIn(t, again, ui.normalAnswers('P04', { glucose: { value: '112', unit: 'mg/dL' } }));
      await page.waitForTimeout(400);
      await ui.tap(sheetStart(again));
      const asked = await walk.answerQuestions(t);
      await t.check(asked.length === 0, `the walk asked again: ${asked.join(' | ')}`);
      await page.waitForURL(/#\/walk\/live/, { timeout: 10000 });
      await t.ready();
      // Kept in the tab once the live screen has started it: under load, a moment after the screen is in.
      await page.waitForFunction(key => !!sessionStorage.getItem(key), walk.WALK_KEY, { timeout: 10000 }).catch(() => {});
      const live = await walk.stored(page);
      await t.check(live && live.plan.gps === true && live.plan.keepRoute === undefined, `the walk does not follow the answer given: ${JSON.stringify(live?.plan)}`);
      await t.checkpoint('walk-after-recheck');
    }, { input: 'glucose 112 mg/dL meter, now (09:31)' });
  },
}];
