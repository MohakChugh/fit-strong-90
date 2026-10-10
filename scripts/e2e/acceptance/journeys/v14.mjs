/**
 * V-J14, set a flare (journey §17.1), with B-30's resume case.
 * - Flare-up → Home: Workout "Gentle only today" and Stretch "Gentle
 *   stretch", as are their hubs. Back to Normal two days later → the offer to
 *   move the plan, as v1.
 * - B-30: a Normal stretch saved part-way, then a flare, then Continue → what
 *   is left follows the gentler routine: nothing the flare leaves out runs.
 * P01, whose back history makes a flare change the routine (D36).
 */
import { persona } from '../fixtures/personas.mjs';
import * as g from '../lib/guide.mjs';
import * as hub from '../lib/hub.mjs';
import * as move from '../lib/move.mjs';
import * as player from '../lib/player.mjs';
import { stretchPreview } from '../lib/safety-c.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'VJ14';
export const title = 'Set a flare: the gentler words and routine everywhere, and a saved stretch resumed gentler';
export const safety = false;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();
const IST = s => Date.parse(`${s}+05:30`);

/** Flare-up from Home's status row, then the sheet closed, whatever it offered. */
async function flare(t) {
  const sheet = await g.setStatus(t, 'Flare-up');
  await sheet.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  if (await sheet.isVisible()) await ui.tap(ui.button(sheet, 'Close'));
  await sheet.waitFor({ state: 'hidden' });
}

export const cases = [
  {
    name: 'flare words, then back to normal',
    async run(t) {
      const page = await t.open({ seed: persona('P01'), route: '/home' });
      const main = page.getByRole('main');

      await t.step(1, 'How are you today? → Flare-up', async () => {
        await flare(t);
        await t.checkpoint('flare-set');
      });

      await t.step(2, 'Home: Workout "Gentle only today", Stretch "Gentle stretch"', async () => {
        await ui.tab(page, 'Home');
        await t.check(flat(await hub.tile(page, 'Workout').innerText()).includes('Gentle only today'), `the Workout tile reads “${flat(await hub.tile(page, 'Workout').innerText())}”`);
        await t.check(flat(await hub.tile(page, 'Stretch').innerText()).includes('Gentle stretch'), `the Stretch tile reads “${flat(await hub.tile(page, 'Stretch').innerText())}”`);
      });

      await t.step(3, 'Their hubs say the same, with the flare-adjusted options', async () => {
        await hub.open(t, 'guided');
        const w = flat(await hub.card(page).innerText());
        await t.check(w.includes('Gentle only today'), `the Workout hub does not say “Gentle only today”: ${w.slice(0, 200)}`);
        await hub.open(t, 'stretch');
        const s = flat(await hub.card(page).innerText());
        await t.checkpoint('flare-stretch-hub');
        await t.check(s.includes('Gentle stretch') && s.includes('Your back is in a flare-up, so this is the gentler routine.'), `the Stretch hub reads: ${s.slice(0, 240)}`);
      });

      await t.step(4, 'Two days later, Back to normal: the offer to move the plan', async () => {
        await t.setTime(IST('2026-10-10T09:00:00'));
        await t.reload();
        await g.setStatus(t, 'Normal');
        const offer = flat(await page.getByRole('dialog', { name: 'Status' }).innerText().catch(() => main.innerText()));
        await t.checkpoint('flare-back-to-normal');
        await t.check(/Move my plan back \d+ days?/.test(offer) && /Keep my plan as it is/.test(offer), `returning offers no plan shift: ${offer.slice(0, 200)}`);
      });
    },
  },
  {
    name: 'B-30: a stretch saved before the flare resumes gentler',
    async run(t) {
      const page = await t.open({ seed: persona('P01'), route: '/home' });
      let normal = [];

      await t.step(1, 'Normal: the Stretch hub’s Hips & legs, 15 minutes, Check in & start, two steps, Save and exit', async () => {
        await hub.open(t, 'stretch');
        // For P01's back history, Hips & legs at 15 minutes holds a movement a flare leaves out (Task 7);
        // the hub's default, Back & hips at 10, holds none, so the resume would have nothing to refuse.
        const main = page.getByRole('main');
        await ui.tap(ui.radio(main.getByRole('radiogroup', { name: 'Area' }), 'Hips & legs'));
        await ui.tap(ui.radio(main.getByRole('radiogroup', { name: 'Length' }), '15 min'));
        await page.waitForTimeout(300);
        normal = await stretchPreview(page);
        await t.must(normal.length > 0, 'the Stretch hub lists no routine');
        const r = await hub.begin(t);
        if (r.sheet) {
          await ui.answerCheckIn(t, r.sheet, ui.normalAnswers('P01'));
          await ui.tap(move.sheetStart(r.sheet));
        }
        await page.waitForURL(/#\/session/, { timeout: 15000 });
        await player.begin(page);
        for (let i = 0; i < 2; i++) await t.advance(((await player.stepRemainingMs(page)) ?? 0) + 300);
        await ui.tap(player.control(page, 'End session'));
        const leave = page.getByRole('dialog', { name: 'Leave the session?' });
        await leave.waitFor();
        await ui.tap(ui.button(leave, 'Save and exit'));
        await page.waitForFunction(() => location.hash.startsWith('#/hub/stretch'), null, { timeout: 15000 });
        await t.checkpoint('b30-saved');
      }, { input: 'Hips & legs, 15 min; normal answers; two steps; End session → Save and exit' });

      await t.step(2, 'Flare-up; the Stretch hub offers to continue, with the gentler routine listed', async () => {
        await flare(t);
        await hub.open(t, 'stretch');
        const c = flat(await hub.card(page).innerText());
        await t.check(/Continue your stretch/.test(c) && await hub.start(page).count() === 1, `the Stretch hub does not offer to continue during the flare: ${c.slice(0, 200)}`);
      });

      await t.step(3, 'Continue: nothing the flare leaves out runs', async () => {
        const gentle = await stretchPreview(page);
        const leftOut = normal.filter(n => !gentle.includes(n));
        t.note(`left out by the flare: ${JSON.stringify(leftOut)}`);
        const r = await hub.begin(t);
        if (r.sheet) await ui.tap(move.sheetStart(r.sheet));
        await page.waitForURL(/#\/session/, { timeout: 15000 });
        const resume = player.control(page, 'Resume').or(player.control(page, 'Start'));
        if (await resume.count()) await ui.tap(resume);
        const { seen } = await player.runStretchToEnd(t);
        await t.checkpoint('b30-resumed');
        const ran = seen.filter(s => leftOut.includes(s));
        await t.check(ran.length === 0, `after the flare the resumed stretch still ran ${JSON.stringify(ran)} (B-30)`);
        await t.check(seen.filter(s => normal.includes(s)).every(s => gentle.includes(s)), `a movement outside the gentler routine ran: ${JSON.stringify(seen)}`);
      });
    },
  },
];
