/**
 * M02: the hubs' own cases from the Plan 2 review (journey §4, §8; Codex's
 * H2 findings and Kiro's KH findings). Each case was written to fail on the
 * code the finding named, and passes once it is fixed.
 * - H2-01: a walk left running, then Unwell or a flare: the Walk hub offers
 *   no Carry on (§4.8), keeps Review and save, and nothing records. In
 *   Normal, Return to walk asks the gate at the tap, and its check-in opens
 *   on the hub (§4.1).
 * - H2-06: an Add link reaches a hub that is already open: its own form
 *   opens and the address lets the link go; another metric's opens none.
 * - H2-07: the steps form's Paste is at least 48 by 48, and grows with
 *   the text size (§20.4 rule 1).
 * - KH-02: the Steps hub while walking is held for the feet: no walking
 *   advice and no step goal, the hold in words, and a total still saves.
 * - KH-11: Back & leg's emergency signs in body text and normal ink,
 *   before History.
 * Synthetic personas only (fixtures/personas.mjs).
 */
import { persona } from '../fixtures/personas.mjs';
import { saveForm } from '../lib/data.mjs';
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

const addWhileOpen = {
  name: 'H2-06: an Add link reaches a hub that is already open',
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/hub/bp' });
    const query = async () => new URL(page.url()).hash.split('?')[1] ?? '';
    await t.step(1, 'Blood pressure open → its own Add link: the form opens, and the link is let go', async () => {
      await ui.heading(page, 'Blood pressure');
      await t.hash('/hub/bp?add=bloodPressure');
      const form = page.getByRole('dialog', { name: 'Blood pressure' });
      await form.waitFor({ timeout: 5000 }).catch(() => {});
      await t.check(await form.count() === 1, 'the open Blood pressure hub ignored its own Add link');
      await t.check(!/(^|&)add=/.test(await query()), `the address keeps the link: ?${await query()}`);
      await t.checkpoint('h2-06-bp-form');
      if (await form.count()) {
        await ui.tap(ui.button(form, 'Close'));
        await form.waitFor({ state: 'hidden' });
      }
    });
    await t.step(2, 'The same link again opens it again; another metric’s link opens no form here', async () => {
      await t.hash('/hub/bp?add=bloodPressure');
      const form = page.getByRole('dialog', { name: 'Blood pressure' });
      await form.waitFor({ timeout: 5000 }).catch(() => {});
      await t.check(await form.count() === 1, 'the second Add link opened no form');
      if (await form.count()) {
        await ui.tap(ui.button(form, 'Close'));
        await form.waitFor({ state: 'hidden' });
      }
      await t.hash('/hub/bp?add=glucose');
      await page.waitForTimeout(500);
      await t.check(await page.getByRole('dialog').count() === 0, 'another metric’s link opened a form on the Blood pressure hub');
      await t.check(!/(^|&)add=/.test(await query()), `the address keeps another metric’s link: ?${await query()}`);
    });
    await t.step(3, 'Steps open → its Add link: the steps form opens', async () => {
      await t.goto('/hub/steps');
      await ui.heading(page, 'Steps');
      await t.hash('/hub/steps?add=steps');
      const form = page.getByRole('dialog', { name: 'Steps' });
      await form.waitFor({ timeout: 5000 }).catch(() => {});
      await t.check(await form.count() === 1, 'the open Steps hub ignored its Add link');
      await t.check(!/(^|&)add=/.test(await query()), `the address keeps the link: ?${await query()}`);
    });
  },
};

/** A control's box on screen, in CSS pixels. */
const box = async locator => (await locator.boundingBox()) ?? { width: 0, height: 0 };

const pasteTarget = {
  name: 'H2-07: Paste is a 48 px target that grows with the text',
  async run(t) {
    for (const [n, scale] of [[1, 1], [2, 2]]) {
      await t.step(n, `Steps → Add today’s steps at ${scale * 100}% text: Paste is at least ${48 * scale} px each way`, async () => {
        if (n > 1) await t.context.close();
        const page = await t.open({ seed: persona('P01'), route: '/hub/steps', ...(scale > 1 ? { textScale: scale } : {}) });
        await ui.heading(page, 'Steps');
        await ui.tap(ui.button(page.getByRole('main'), 'Add today’s steps'));
        const form = page.getByRole('dialog', { name: 'Steps' });
        await form.waitFor();
        const paste = ui.button(form, 'Paste');
        await t.must(await paste.count() === 1, 'the steps form has no Paste');
        const b = await box(paste);
        if (n === 1) await t.checkpoint('h2-07-paste');
        await t.check(b.width >= 48 * scale - 0.5 && b.height >= 48 * scale - 0.5, `Paste is ${b.width.toFixed(1)} × ${b.height.toFixed(1)} px at ${scale * 100}% text`);
      });
    }
  },
};

const stepsFootHold = {
  name: 'KH-02: the Steps hub while walking is held for the feet',
  async run(t) {
    // P05: an open foot wound, so Walk is held and Home shows no Steps (L-09); Browse still lists it.
    const page = await t.open({ seed: persona('P05'), route: '/home' });
    const main = page.getByRole('main');
    await t.step(1, 'Browse → Steps: the hold in words, no walking advice and no step goal', async () => {
      await hub.openHub(t, 'Steps', '/hub/steps');
      const text = flat(await main.innerText());
      await t.checkpoint('kh-02-steps-held');
      await t.check(text.includes('Walking is on hold for your feet'), `the Steps hub does not say walking is held: ${text.slice(0, 300)}`);
      await t.check(!/building up gradually is what WHO advises/.test(text), 'the Steps hub gives walking advice while walking is held (K-12)');
      await t.check(await ui.row(main, 'Daily step goal').count() === 0, 'the Steps hub offers a step goal while walking is held');
    });
    await t.step(2, 'Add today’s steps → 1,200 → Save: a total still saves', async () => {
      await ui.tap(ui.button(main, 'Add today’s steps'));
      const form = page.getByRole('dialog', { name: 'Steps' });
      await form.waitFor();
      await ui.type(form.getByRole('textbox', { name: 'Steps for the day', exact: true }), '1200');
      await t.must(await saveForm(t, form) === 'closed', 'the total did not save');
      const today = flat(await ui.section(main, 'Today').innerText());
      await t.check(today.includes('1,200 steps'), `Today reads: ${today}`);
    }, { input: '1200' });
  },
};

const backSigns = {
  name: 'KH-11: Back & leg’s emergency signs, readable and before History',
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/hub/back' });
    await t.step(1, 'The signs are body text in normal ink, above History', async () => {
      await ui.heading(page, 'Back & leg');
      const read = await page.evaluate(() => {
        const main = document.querySelector('main');
        const intro = [...main.querySelectorAll('p')].find(p => p.textContent.startsWith('A pain number never rules out an emergency.'));
        const sign = intro?.parentElement?.querySelector('li');
        const history = [...main.querySelectorAll('h2')].find(h => h.textContent.trim() === 'History');
        const ink = getComputedStyle(main.querySelector('h1')).color;
        const px = el => (el ? parseFloat(getComputedStyle(el).fontSize) : 0);
        return {
          found: !!intro && !!sign && !!history,
          introPx: px(intro), signPx: px(sign), bodyPx: parseFloat(getComputedStyle(document.documentElement).fontSize) * 17 / 16,
          normalInk: !!sign && getComputedStyle(sign).color === ink && getComputedStyle(intro).color === ink,
          beforeHistory: !!intro && !!history && !!(intro.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING),
        };
      });
      await t.checkpoint('kh-11-back-signs');
      await t.must(read.found, 'Back & leg has no emergency signs or no History');
      await t.check(read.introPx >= read.bodyPx - 0.5 && read.signPx >= read.bodyPx - 0.5, `the signs are ${read.introPx} and ${read.signPx} px, under body text (${read.bodyPx} px)`);
      await t.check(read.normalInk, 'the signs are in muted ink');
      await t.check(read.beforeHistory, 'the signs come after History');
    });
  },
};

export const cases = [carryOnUnwell, carryOnFlare, carryOnGate, addWhileOpen, pasteTarget, stepsFootHold, backSigns];
