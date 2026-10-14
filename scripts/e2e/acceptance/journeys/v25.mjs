/**
 * V-J25 (journey §17.2 #25, B-30): Away (and B-30's Unwell variant), then back
 * to Normal → no "Carry on" while paused → the plan-shift offer → accept or
 * decline. J07 steps 5–6 prove the offer's dates; this proves a run saved
 * while paused isn't offered until the status is Normal again (D118). P01,
 * paused since 5 October; the stretch is started with "Start anyway".
 */
import { persona } from '../fixtures/personas.mjs';
import * as g from '../lib/guide.mjs';
import { docs } from '../lib/harness.mjs';
import * as hub from '../lib/hub.mjs';
import * as mv from '../lib/move.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J25';
export const title = 'Away or Unwell, then Normal: no Carry on while paused, then the plan-shift offer';
export const safety = false;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();
const PAUSED = { away: 'Paused while you’re away', unwell: 'Paused while you’re unwell' };
const CARRY_ON = /^(Continue|Check in & continue)/;

function pausedCase(kind, accept) {
  return {
    name: `${kind}, then Normal, ${accept ? 'accepting' : 'declining'} the shift`,
    async run(t) {
      const page = await t.open({ seed: persona('P01', { patch: { settings: { statusPeriods: [{ kind, from: '2026-10-05' }] } } }), route: '/home' });
      const main = page.getByRole('main');

      await t.step(1, `The Stretch hub while ${kind}: paused, with Change status and Start anyway`, async () => {
        await hub.open(t, 'stretch');
        const card = hub.card(page);
        const text = flat(await card.innerText());
        await t.checkpoint(`stretch-${kind}`);
        await t.check(text.includes(PAUSED[kind]), `the card reads “${text.slice(0, 200)}”, not “${PAUSED[kind]}”`);
        await t.check(await ui.button(card, 'Change status').count() === 1 && await ui.button(card, 'Start anyway').count() === 1, `the paused card's actions: ${text.slice(0, 200)}`);
      });

      await t.step(2, 'Start anyway → the check-in → a stretch → End session → Save and exit', async () => {
        await ui.tap(ui.button(hub.card(page), 'Start anyway'));
        const sheet = mv.checkInSheet(page);
        await sheet.waitFor({ timeout: 10000 });
        await ui.answerCheckIn(t, sheet, ui.normalAnswers('P01'));
        await ui.tap(mv.sheetStart(sheet));
        await ui.tap(main.getByRole('button', { name: 'Start', exact: true }));
        await t.advance(30_000);
        await ui.tap(main.getByRole('button', { name: 'End session', exact: true }));
        await ui.tap(page.getByRole('button', { name: 'Save and exit', exact: true }));
        await page.waitForTimeout(800);
        await t.must(!!(await page.evaluate(() => localStorage.getItem('fit-strong-90-stretch'))), 'no resumable stretch was saved');
      }, { input: 'normal check-in; a stretch for 30 s, saved part-way' });

      await t.step(3, `Still ${kind}: no Carry on, on Home or a hub`, async () => {
        await ui.tab(page, 'Home');
        const right = flat(await ui.rightNow(page).innerText());
        await t.check(!/Continue/.test(right), `while ${kind}, Home offers to carry on: “${right.slice(0, 200)}”`);
        for (const mode of ['stretch', 'guided']) {
          await hub.open(t, mode);
          const labels = (await hub.card(page).getByRole('button').allInnerTexts()).map(flat);
          await t.check(!labels.some(l => CARRY_ON.test(l)), `while ${kind}, the ${mode} hub offers ${JSON.stringify(labels)}`);
        }
        await t.checkpoint(`no-carry-on-${kind}`);
      });

      await t.step(4, `Back to normal → the shift offer → ${accept ? 'Move my plan back 3 days' : 'Keep my plan as it is'}`, async () => {
        await g.setStatus(t, 'Normal');
        const status = page.getByRole('dialog', { name: 'Status' });
        const scope = (await status.count()) ? status : main;
        const offer = flat(await scope.innerText());
        await t.check(/Move my plan back 3 days/.test(offer) && /Keep my plan as it is/.test(offer), `no 3-day shift offered: ${offer.slice(0, 200)}`);
        await ui.tap(ui.button(scope, accept ? 'Move my plan back 3 days' : 'Keep my plan as it is'));
        await page.waitForTimeout(500);
        const snap = await t.checkpoint(`after-offer-${kind}`);
        await t.check(docs(snap).settings?.startDate === (accept ? '2026-09-27' : '2026-09-24'), `startDate is ${docs(snap).settings?.startDate}`);
      });

      await t.step(5, 'Normal again: the stretch carries on', async () => {
        await hub.open(t, 'stretch');
        const go = hub.start(page);
        await t.check(await go.count() === 1 && CARRY_ON.test(flat(await go.innerText())), `the Stretch hub offers ${flat(await hub.card(page).innerText()).slice(0, 200)}`);
        await t.checkpoint(`carry-on-${kind}`);
      });
    },
  };
}

export const cases = [pausedCase('away', true), pausedCase('unwell', false)];
