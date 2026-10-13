/**
 * V-J21 (journey §17.2 #21): a low during a session → its guidance left by
 * its own way out → Resume and earphone Play stay held until the release.
 * P04, on insulin, at 90 mg/dL, runs a stretch; "I feel low" and 65 mg/dL
 * hold it. Earphone Play on the guidance, and a stray press of the handler
 * kept from before it was left, move nothing: the run's saved progress stays
 * where it was. A re-check 15 minutes later reads 110 mg/dL with the symptoms
 * gone, and Play moves the run again. J13 step 4 proves the hold itself.
 */
import { persona } from '../fixtures/personas.mjs';
import * as hub from '../lib/hub.mjs';
import * as rec from '../lib/recovery.mjs';
import * as s from '../lib/safety-a.mjs';
import * as sb from '../lib/safety-b.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J21';
export const title = 'A low in a session holds Resume and earphone Play until the release';
export const safety = true;

const flat = x => (x ?? '').replace(/\s+/g, ' ').trim();
const LOW = 'Treat the low first';
const BUTTONS = ['play', 'pause', 'nexttrack', 'previoustrack'];
/** The player moving: the controls only a running player has. */
const running = page => page.getByRole('main').getByRole('button', { name: /^(Pause|Next)$/ });
const handlers = page => page.evaluate(() => Object.keys(window.__acc.media ?? {}));
/** Where the stretch is, as it saved itself (src/session/persistence.ts). */
const progress = page => page.evaluate(() => {
  const raw = localStorage.getItem('fit-strong-90-stretch');
  if (!raw) return null;
  const { state } = JSON.parse(raw);
  return { status: state.status, index: state.index, activeMs: state.activeMs ?? 0 };
});
const same = (a, b) => !!a && !!b && a.status === b.status && a.index === b.index && a.activeMs === b.activeMs;

export const cases = [{
  name: 'stretch, 65 mg/dL, then 110 mg/dL',
  async run(t) {
    const page = await t.open({ seed: persona('P04'), route: '/home', media: true });
    let held;

    await t.step(1, 'P04 at 90 mg/dL: a stretch running, with earphone buttons', async () => {
      const sheet = await s.openCheckIn(t, 'stretch', 'move');
      await s.noneRightNow(sheet);
      await s.typeGlucose(sheet, '90', 'mg/dL');
      if (await ui.section(sheet, 'Blood pressure').count()) await s.typeBp(t, sheet, [[124, 78], [122, 76]]);
      if (await ui.section(sheet, 'Back and legs').count()) {
        await s.setPain(sheet, { back: 0, leg: 0, reach: 'Back' });
        await s.noneSince(sheet);
      }
      await s.noneElse(sheet);
      await s.sleepEnergy(sheet);
      await s.submit(sheet);
      await ui.tap(sheet.getByRole('button', { name: /^(Start stretch|Continue to stretch|Continue)$/ }));
      await ui.tap(page.getByRole('button', { name: 'Start', exact: true }));
      await page.getByRole('button', { name: 'Pause', exact: true }).waitFor();
      await t.advance(30_000);
      await t.must((await handlers(page)).includes('play'), `the session set no earphone Play: ${(await handlers(page)).join(', ')}`);
      await t.checkpoint('stretch-running');
    }, { input: 'P04, glucose 90 mg/dL, a stretch started' });

    await t.step(2, '“I feel low” → 65 mg/dL: the guidance stays, and earphone Play on it moves nothing', async () => {
      await ui.tap(page.getByRole('button', { name: 'I feel low', exact: true }));
      await page.getByText(LOW, { exact: true }).waitFor({ timeout: 15000 });
      await ui.type(page.getByRole('textbox', { name: 'Glucose now', exact: true }), '65');
      await ui.tap(page.getByRole('button', { name: 'Save this reading', exact: true }));
      await page.waitForTimeout(1000);
      await t.must(await page.getByText(LOW, { exact: true }).count() === 1, 'the low’s guidance left the screen after 65 mg/dL');
      held = await progress(page);
      await t.must(held?.status === 'paused', `the stretch saved itself as ${JSON.stringify(held)}, not paused`);
      await t.must(await rec.media(page, 'play'), 'the held session has no earphone Play to press: the hold can’t be shown to hold');
      await t.advance(10_000);
      const after = await progress(page);
      await t.checkpoint('held-after-play');
      await t.check(same(held, after), `earphone Play moved the run: ${JSON.stringify(held)} → ${JSON.stringify(after)}`);
      await t.check(await running(page).count() === 0, 'the player runs after earphone Play');
      await t.check(await page.getByText(LOW, { exact: true }).count() === 1, 'earphone Play took the guidance off the screen');
      // The session's own Resume, as a finger might find it (K8-13): absent, or it moves nothing.
      const resume = page.getByRole('main').getByRole('button', { name: 'Resume', exact: true });
      if (await resume.count()) {
        await ui.tap(resume.first());
        await t.advance(10_000);
        await t.check(same(held, await progress(page)), 'the session’s own Resume moved the run while the low holds');
      }
      await t.check(await running(page).count() === 0, 'the player runs after Resume');
    }, { input: 'I feel low; 65 mg/dL; earphone Play; Resume, if it is there' });

    await t.step(3, '“Leave, and come back later”: the guidance closes, its earphone buttons go, and a stray press moves nothing', async () => {
      await t.must(await rec.captureMedia(page, 'play'), 'no earphone Play to keep before leaving');
      const leave = page.getByRole('button', { name: 'Leave, and come back later', exact: true });
      await t.must(await leave.count() === 1, 'the low’s guidance has no way to leave it and come back');
      await ui.tap(leave);
      await page.waitForFunction(() => !location.hash.startsWith('#/session'), null, { timeout: 15000 });
      await t.ready();
      const left = (await handlers(page)).filter(a => BUTTONS.includes(a));
      await t.check(left.length === 0, `the session’s earphone buttons outlived it: ${left.join(', ')}`);
      await rec.pressCaptured(page);
      await t.advance(10_000);
      const after = await progress(page);
      await t.check(same(held, after), `a stray earphone press moved the run after it was left: ${JSON.stringify(held)} → ${JSON.stringify(after)}`);
      // The resume link a bookmark or Carry on gives (K8-13): still held, the run where it was.
      await t.goto('/session?resume=1');
      await t.ready();
      await t.advance(10_000);
      await t.check(same(held, await progress(page)), 'the resume link moved the run while the low holds');
      await t.check(await running(page).count() === 0, 'the resume link runs the player while the low holds');
      // The session's own screen has no tab bar: its way out is its gate's Back to Today.
      await ui.tap(page.getByRole('button', { name: 'Back to Today', exact: true }));
      await hub.open(t, 'stretch');
      await t.check(!!(await hub.refusal(page)), 'the Stretch hub offers a start while the low holds');
      const starts = (await hub.card(page).getByRole('button').allInnerTexts()).map(flat).filter(l => hub.STARTERS.test(l));
      await t.check(starts.length === 0, `the Stretch hub offers ${JSON.stringify(starts)}`);
      await t.checkpoint('left-and-held');
    }, { input: 'Leave, and come back later; the earphones’ Play pressed again; /session?resume=1' });

    await t.step(4, 'Fifteen minutes on: 110 mg/dL, the symptoms gone → released, and Play moves the session again', async () => {
      await t.advanceMinutes(15);
      const sheet = await sb.openSheet(t, 'stretch');
      // A re-check that is due opens the sheet on its form; one opened on its outcome asks for it first.
      for (const name of ['Enter a new reading', 'Change answers']) {
        if (await ui.button(sheet, name).count()) {
          await ui.tap(ui.button(sheet, name));
          break;
        }
      }
      // The symptoms gone: today's answers changed as the hold asks ("change today’s answers once you feel normal"),
      // so "Feeling like a low is coming", which "I feel low" answered, is no longer ticked.
      await ui.answerCheckIn(t, sheet, { glucose: { value: '110', unit: 'mg/dL' }, lowRecovered: true, news: [] });
      const answer = await sb.readSheet(sheet);
      await t.checkpoint('released');
      await t.must(answer.start, `110 mg/dL with the symptoms gone does not release the stretch: “${answer.title}” ${answer.bannerText}`);
      await ui.tap(sheet.getByRole('button', { name: sb.START }).first());
      await page.waitForURL(/#\/session/, { timeout: 15000 });
      await t.ready();
      await page.getByRole('main').getByRole('button', { name: /^(Start|Resume)$/ }).first().waitFor({ timeout: 15000 });
      await t.must(await rec.media(page, 'play'), 'the released session has no earphone Play');
      await page.getByRole('button', { name: 'Pause', exact: true }).waitFor({ timeout: 10000 });
      await t.advance(6_000);
      const moving = await progress(page);
      await t.check(moving?.status === 'running', `after the release, Play left the run ${JSON.stringify(moving)}`);
      await t.checkpoint('play-after-release');
    }, { input: '110 mg/dL at 9:15 am, symptoms gone' });
  },
}];
