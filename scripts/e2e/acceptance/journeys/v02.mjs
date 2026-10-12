/**
 * V-J02, P03: after lunch, from Home's Right now to a saved walk and back
 * (journey §17.1 #2; B-01, B-09; motion M10, M12). Right now states the
 * time and starts the walk itself: the check-in, then the live walk, with
 * no screen in between (K-32). Synthetic persona only.
 */
import { MINUTE } from '../lib/env.mjs';
import { persona } from '../fixtures/personas.mjs';
import { sheetStart } from '../lib/player.mjs';
import * as ui from '../lib/ui.mjs';
import * as walk from '../lib/walk.mjs';

export const id = 'V02';
export const title = 'After lunch, from Right now to a saved walk';
export const safety = false;

const AT = Date.parse('2026-10-08T13:40:00+05:30');
const LUNCH = Date.parse('2026-10-08T13:10:00+05:30');
// The habit of a walk after lunch, and the voice on, so the start's tap is seen unlocking its audio (B-01).
const SEED = persona('P03', { patch: { settings: { habits: { mealWalk: { enabled: true, meals: ['lunch'], finish: { lunch: '13:10' } } } }, profile: { voice: { muted: false } } } });

export const cases = [{
  name: 'a walk after lunch',
  async run(t) {
    // The walk counts its time on the monotonic clock, run with the frozen wall clock (H6-09).
    const page = await t.open({ seed: SEED, route: '/home', time: AT, sensors: { monotonic: 'wall' } });
    const main = page.getByRole('main');

    await t.step(1, 'Home at 1:40 pm: Right now offers the walk after lunch, with the time stated', async () => {
      const card = ui.rightNow(page);
      await t.must(await card.count() === 1, 'there is no Right now card');
      const text = (await card.innerText()).replace(/\s+/g, ' ');
      await t.check(/A walk after lunch/.test(text), `Right now is not the walk after lunch: ${text.slice(0, 200)}`);
      await t.must(await card.getByRole('button', { name: /^I had lunch at 1:10\s?pm: walk now$/i }).count() === 1, `Right now does not state the time: ${text.slice(0, 200)}`);
      await t.checkpoint('right-now-after-lunch');
    });

    await t.step(2, 'Tap it, check in, Start walk: the live walk, with no screen in between', async () => {
      await page.evaluate(() => { window.__hashes = []; addEventListener('hashchange', () => window.__hashes.push(location.hash)); });
      await ui.tap(ui.rightNow(page).getByRole('button', { name: /^I had lunch at/i }));
      await page.waitForTimeout(400);
      const sheet = page.getByRole('dialog', { name: ui.CHECKIN });
      await t.must(await sheet.count() === 1, 'the tap did not open the check-in');
      await ui.answerCheckIn(t, sheet, ui.normalAnswers('P03'));
      await page.waitForTimeout(400);
      await ui.tap(sheetStart(sheet));
      // Location and steps are off for this walk: the first walk has nothing to ask (journey §9.1).
      t.asked = await walk.answerQuestions(t);
      await t.check(t.asked.length === 0, `the walk asked ${t.asked.join(' | ')}`);
      await page.waitForURL(/#\/walk\/live/, { timeout: 10000 });
      await t.ready();
      const hashes = await page.evaluate(() => window.__hashes);
      await t.check(!hashes.some(h => h.startsWith('#/hub/')), `the walk passed through ${hashes.join(' → ')}: K-32 has no hub step`);
      const unlock = (await walk.played(page)).find(p => p.src.startsWith('data:audio/wav'));
      await t.check(unlock?.during === 'click', `audio was not unlocked inside the Start tap (B-01): ${JSON.stringify(unlock)}`);
      // The walk is kept in the tab once the live screen has started it: under load, a moment after the screen is in.
      await page.waitForFunction(key => !!sessionStorage.getItem(key), walk.WALK_KEY, { timeout: 10000 }).catch(() => {});
      const live = await walk.stored(page);
      await t.check(live?.plan.kind === 'afterMeal' && live.plan.meal?.which === 'lunch' && live.plan.meal.startedAt === LUNCH && live.plan.meal.basis === 'had',
        `the walk does not carry lunch had at 1:10 pm: ${JSON.stringify(live?.plan)}`);
      await t.checkpoint('live-after-lunch');
    }, { input: 'tap “I had lunch at 1:10 pm: walk now”; normal answers, glucose 110 mg/dL now; Start walk' });

    await t.step(3, 'Ten minutes, a minute at a time: the timer, and the ten-minute cue on its own', async () => {
      const before = (await walk.played(page)).length;
      await walk.elapse(t, 10 * MINUTE);
      await page.waitForTimeout(1500);
      await t.check(await walk.timer(page) === '10:00', `the timer reads ${await walk.timer(page)}, not 10:00`);
      const heard = (await walk.played(page)).slice(before);
      await t.check(heard.length > 0 && heard.every(p => p.during === null), `no cue played by itself at ten minutes: ${JSON.stringify(heard)}`);
      await t.check(await walk.cueHeard(page, 'Ten minutes of walking.'), `the clip played was not “Ten minutes of walking.”: ${JSON.stringify(heard)}`);
      await t.checkpoint('ten-minutes');
    }, { input: '+60 s ten times' });

    await t.step(4, 'Finish and save: after lunch, had at 1:10 pm, never “started”', async () => {
      await walk.finish(t);
      const summary = (await main.innerText()).replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ');
      await t.checkpoint('summary-after-lunch');
      await t.check(/After lunch/.test(summary) && /Had at 1:10\s?pm/i.test(summary) && /When you had the meal/.test(summary), `the summary does not say lunch was had at 1:10 pm: ${summary.slice(0, 300)}`);
      await t.check(!/Started 1:10/i.test(summary), 'the summary calls the time lunch was had its start (B-09)');
      const snap = await walk.save(t);
      const dur = walk.walkObservations(snap).filter(o => o.kind === 'walkDuration');
      await t.check(dur.length === 1 && dur[0].value === 10 && dur[0].tag === 'afterMeal' && dur[0].mealStartedAt === undefined && /which you had at 1:10/.test(dur[0].note ?? ''),
        `walkDuration: ${JSON.stringify(dur.map(o => [o.value, o.tag, o.mealStartedAt, o.note]))}`);
    });

    await t.step(5, 'Done: back to Home, where the walk counts and Right now moves on (M12)', async () => {
      await ui.tap(ui.button(main, 'Done'));
      await page.getByRole('heading', { level: 1, name: ui.HOME_TITLE }).waitFor();
      await t.check((await t.route()).startsWith('/home'), `Done went to ${await t.route()}, not Home`);
      const home = (await main.innerText()).replace(/\s+/g, ' ');
      await t.check(/\b10 min moved this week/.test(home), `This week does not count the walk: ${home.slice(0, 300)}`);
      const card = (await ui.rightNow(page).innerText()).replace(/\s+/g, ' ');
      await t.check(!/A walk after lunch/.test(card), `Right now still offers the walk after lunch: ${card.slice(0, 200)}`);
      await t.checkpoint('home-after-walk');
    });
  },
}];
