/**
 * M02: the hubs' own cases from the Plan 2 review (journey §4, §8; Codex's
 * H2 findings and Kiro's KH findings). Each case was written to fail on the
 * code the finding named, and passes once it is fixed.
 * - H2-01: a walk left running, then Unwell or a flare: the Walk hub offers
 *   no Carry on (§4.8), keeps Review and save, and nothing records. In
 *   Normal, Return to walk asks the gate at the tap, and its check-in opens
 *   on the hub (§4.1).
 * Synthetic personas only (fixtures/personas.mjs).
 */
import { persona } from '../fixtures/personas.mjs';
import * as g from '../lib/guide.mjs';
import * as hub from '../lib/hub.mjs';
import * as ui from '../lib/ui.mjs';
import * as walk from '../lib/walk.mjs';

export const id = 'M02';
export const title = 'Hubs after review: status before a walk carries on, and the hubs’ own fixes';
export const safety = false;

const flat = s => (s ?? '').replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ').trim();

/** P02 starts an ordinary walk from its hub, walks two minutes, and goes Home with it still open. */
async function walkLeftOpen(t) {
  const page = t.page;
  await walk.openSetup(t);
  await walk.start(t, ui.normalAnswers('P02'));
  await t.advance(2 * 60_000);
  // The live walk has no tab bar: leaving it is going back, which keeps the walk on the device.
  await t.hash('/home');
  await page.getByRole('heading', { level: 1, name: ui.HOME_TITLE }).waitFor();
  const stored = await walk.stored(page);
  await t.must(stored && stored.status !== 'finished', `the walk left open is not on the device: ${JSON.stringify(stored?.status)}`);
  return stored.id;
}

/** The Walk hub's card, opened from Home, as it reads now. */
async function walkCard(t) {
  await hub.open(t, 'walk');
  return flat(await hub.card(t.page).innerText());
}

/** No "Carry on" while the status refuses it: the card says why, and Review and save ends the walk, unrecorded since, at its summary. */
async function refusesCarryOn(t, status, says) {
  const page = t.page;
  const c = hub.card(page);
  const text = flat(await c.innerText());
  await t.check(await ui.button(c, 'Return to walk').count() === 0, `${status}: the Walk hub still offers “Return to walk”: ${text.slice(0, 240)}`);
  await t.check(says.test(text), `${status}: the card does not say why the walk can’t carry on: ${text.slice(0, 240)}`);
  const review = ui.button(c, 'Review and save');
  await t.must(await review.count() === 1, `${status}: the Walk hub offers no way to review and save the walk: ${text.slice(0, 240)}`);
  await ui.tap(review);
  await page.waitForFunction(() => location.hash.startsWith('#/walk/'), null, { timeout: 10000 }).catch(() => {});
  const route = await t.route();
  await t.check(route.startsWith('/walk/summary'), `${status}: Review and save went to ${route}, not the walk’s summary`);
  const stored = await walk.stored(page);
  await t.check(stored?.status === 'finished', `${status}: the walk is ${stored?.status} after Review and save, not finished`);
  await t.check(!(stored?.segments ?? []).some(s => s.end === undefined), `${status}: a segment is recording again: ${JSON.stringify(stored?.segments?.at(-1))}`);
}

const carryOnUnwell = {
  name: 'H2-01: a walk left open, then Unwell: no Carry on, Review and save',
  async run(t) {
    await t.open({ seed: persona('P02'), route: '/home' });
    await t.step(1, 'Walk hub → Start walk → check in → two minutes → Home, the walk still open', async () => {
      await walkLeftOpen(t);
    }, { input: 'P02, normal answers' });
    await t.step(2, 'How are you today? → Unwell', async () => {
      const sheet = await g.setStatus(t, 'Unwell');
      await sheet.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    });
    await t.step(3, 'Walk hub: no Return to walk; Review and save ends it at its summary', async () => {
      await walkCard(t);
      await t.checkpoint('h2-01-unwell');
      await refusesCarryOn(t, 'Unwell', /unwell/i);
    });
  },
};

const carryOnFlare = {
  name: 'H2-01: a walk left open, then a flare: only a stretch carries on',
  async run(t) {
    await t.open({ seed: persona('P02'), route: '/home' });
    await t.step(1, 'Walk hub → Start walk → check in → two minutes → Home, the walk still open', async () => {
      await walkLeftOpen(t);
    }, { input: 'P02, normal answers' });
    await t.step(2, 'How are you today? → Flare-up', async () => {
      const sheet = await g.setStatus(t, 'Flare-up');
      await sheet.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
      if (await sheet.isVisible()) await ui.tap(ui.button(sheet, 'Close'));
    });
    await t.step(3, 'Walk hub: no Return to walk; Review and save ends it at its summary', async () => {
      await walkCard(t);
      await t.checkpoint('h2-01-flare');
      await refusesCarryOn(t, 'Flare-up', /flare/i);
    });
  },
};

const carryOnGate = {
  name: 'H2-01: in Normal, Return to walk asks the gate at the tap',
  async run(t) {
    const page = await t.open({ seed: persona('P02'), route: '/home' });
    let walkId;
    await t.step(1, 'Walk hub → Start walk → check in → two minutes → Home, the walk still open', async () => {
      walkId = await walkLeftOpen(t);
    }, { input: 'P02, normal answers' });
    await t.step(2, 'The next morning, no check-in yet: Return to walk opens the check-in on the hub, then carries on', async () => {
      await t.setTime(Date.parse('2026-10-09T08:30:00+05:30'));
      await t.reload();
      const text = await walkCard(t);
      const back = ui.button(hub.card(page), 'Return to walk');
      await t.must(await back.count() === 1, `in Normal the Walk hub does not offer the walk back: ${text.slice(0, 240)}`);
      await ui.tap(back);
      await page.waitForTimeout(500);
      const sheet = page.getByRole('dialog', { name: ui.CHECKIN });
      await t.check(await sheet.count() === 1, `Return to walk did not ask the gate: no check-in opened, at ${await t.route()}`);
      await t.check((await t.route()).startsWith('/hub/walk'), `Return to walk left the hub before the check-in: ${await t.route()}`);
      if (await sheet.count()) {
        await ui.answerCheckIn(t, sheet, ui.normalAnswers('P02'));
        await t.checkpoint('h2-01-gate');
        await ui.tap(sheet.getByRole('button', { name: 'Carry on walking', exact: true }));
        await page.waitForURL(/#\/walk\/live/, { timeout: 10000 });
        await t.check((await walk.stored(page))?.id === walkId, 'the walk carried on is not the one left open');
      }
    }, { input: 'Thursday 9 October 08:30, normal answers' });
  },
};

export const cases = [carryOnUnwell, carryOnFlare, carryOnGate];
