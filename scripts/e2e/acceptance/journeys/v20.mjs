/**
 * V-J20, P02: the first walk, with location refused and motion allowed
 * (journey §17.2 #20; §9.1, K-29, B-01, B-24). Time and steps, "No route"
 * said plainly, and the step card before the system's question, which is
 * asked from the tap that starts the walk. Synthetic persona only.
 */
import { persona } from '../fixtures/personas.mjs';
import { sheetStart } from '../lib/player.mjs';
import * as hub from '../lib/hub.mjs';
import * as ui from '../lib/ui.mjs';
import * as walk from '../lib/walk.mjs';

export const id = 'V20';
export const title = 'First walk with location refused and motion allowed';
export const safety = false;

const stepsIn = text => Number((text.match(/([\d,]+)\s*steps?\b/) ?? [, 'NaN'])[1].replace(/,/g, ''));

export const cases = [{
  name: 'time and steps, no route',
  async run(t) {
    const page = await t.open({ seed: persona('P02'), route: '', sensors: { geo: 'deny', motion: 'grant', monotonic: 'wall' } });
    const main = page.getByRole('main');

    await t.step(1, 'Walk hub: location refused; Count steps on, and the sensor not asked yet', async () => {
      await walk.openSetup(t);
      await ui.tap(walk.gpsSwitch(page));
      await page.waitForTimeout(400);
      await t.check(await walk.gpsSwitch(page).getAttribute('aria-checked') === 'false', 'distance and pace stays on after the refusal');
      await t.check(/Walk without location: this walk is timed only/.test(await main.innerText()), 'no “Walk without location” after the refusal (journey §9.4)');
      await ui.tap(walk.stepsSwitch(page));
      await page.waitForTimeout(300);
      await t.check(await walk.stepsSwitch(page).getAttribute('aria-checked') === 'true', 'Count steps did not turn on');
      await t.check((await walk.calls(page)).motionRequests.length === 0, 'motion was asked for before the step card (K-29)');
      await t.checkpoint('setup-no-location');
    }, { input: 'Measure distance and pace → denied; Count steps on' });

    await t.step(2, 'Start walk; check in; the step card; motion asked from its tap', async () => {
      await ui.tap(hub.start(page));
      const sheet = page.getByRole('dialog', { name: ui.CHECKIN });
      await sheet.waitFor();
      await ui.answerCheckIn(t, sheet, ui.normalAnswers('P02'));
      await page.waitForTimeout(400);
      await ui.tap(sheetStart(sheet));
      const card = page.getByRole('dialog', { name: 'Counting steps' });
      await card.waitFor({ timeout: 10000 });
      await t.check((await card.innerText()).includes('FitStrong counts steps only while it’s open on the screen.'), 'the step card does not say it in B-24’s words');
      await t.check((await walk.calls(page)).motionRequests.length === 0, 'motion was asked for before the step card was answered');
      await t.checkpoint('step-card');
      await ui.tap(ui.button(card, 'Start walk'));
      await page.waitForURL(/#\/walk\/live/, { timeout: 10000 });
      await t.ready();
      const requests = (await walk.calls(page)).motionRequests;
      await t.check(requests.length === 1 && requests[0] === 'click', `motion was not asked for once, inside the tap (B-01): ${JSON.stringify(requests)}`);
    });

    await t.step(3, 'A minute of walking at two steps a second', async () => {
      for (let i = 0; i < 6; i++) {
        await page.evaluate(() => window.__acc.emitGait({ seconds: 10 }));
        await t.advance(10_000);
      }
      await page.waitForTimeout(1300);
      const text = (await main.innerText()).replace(/[\u00a0\u202f]/g, ' ');
      const n = stepsIn(text);
      await t.check(n >= 100 && n <= 130, `the live walk counts ${n} steps for 120 taken`);
      await t.check(await walk.timer(page) === '1:00', `the timer reads ${await walk.timer(page)}, not 1:00`);
      await t.check(await page.locator('svg[aria-label="Your route so far"]').count() === 0, 'a route drawing shows on a walk without location');
      await t.checkpoint('live-steps');
    }, { input: 'gait at 2 Hz for 10 s, then +10 s, six times' });

    await t.step(4, 'Finish and save: time and steps, “No route” said plainly, and no position anywhere', async () => {
      await walk.finish(t);
      const summary = (await main.innerText()).replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ');
      await t.checkpoint('summary-no-route');
      await t.check(/No route: location was off for this walk\./.test(summary), `the summary does not say why there is no route: ${summary.slice(0, 300)}`);
      await t.check(/Counted while the screen was on: 1 of 1 min/.test(summary), `the steps’ coverage is not stated: ${summary.slice(0, 300)}`);
      await t.check(!/\bDistance\b/.test(summary), 'a distance row shows on a walk without location');
      const snap = await walk.save(t);
      const steps = walk.walkObservations(snap).filter(o => o.kind === 'steps');
      await t.check(steps.length === 1 && steps[0].value >= 100 && steps[0].value <= 130 && steps[0].scope === 'sessionObserved', `steps: ${JSON.stringify(steps.map(o => [o.value, o.scope]))}`);
      const leaks = [...walk.positionsIn(snap, 'db'), ...walk.positionsIn(await t.storage(), 'web')];
      await t.check(walk.routesIn(snap).length === 0 && !leaks.length, `a position was kept: ${leaks.slice(0, 4).join(', ')}`);
    });
  },
}];
