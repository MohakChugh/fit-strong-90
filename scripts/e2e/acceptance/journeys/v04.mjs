/**
 * V-J04, a low (journey §17.1): the Glucose tile → its hub → Add reading →
 * 62 → "This is a low. Treat it now.", with v1's steps. Home then stands in
 * the re-check state, "Re-check at 9:15 am", and the Workout, Stretch and
 * Walk tiles read "Waiting for your re-check at 9:15 am". The Stretch hub
 * shows the gate's card with no start. P03, on a sulfonylurea, at 09:00.
 */
import { persona } from '../fixtures/personas.mjs';
import { saveForm } from '../lib/data.mjs';
import * as hub from '../lib/hub.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'VJ04';
export const title = 'A low entered in its hub, and every movement tile waiting for the re-check';
export const safety = true;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();
const WAITING = 'Waiting for your re-check at 9:15 am';

export const cases = [{
  name: 'Glucose 62 at 9:00 am',
  async run(t) {
    const page = await t.open({ seed: persona('P03'), route: '/home' });
    const main = page.getByRole('main');

    await t.step(1, 'Glucose tile → hub → Add reading opens the Glucose form at once', async () => {
      await hub.openHub(t, 'Glucose', '/hub/glucose');
      await ui.tap(ui.button(main, 'Add reading'));
      const form = page.getByRole('dialog', { name: 'Glucose' });
      await form.waitFor({ timeout: 10000 });
      await t.check(await form.getByRole('textbox', { name: 'Reading', exact: true }).count() === 1, 'Add reading did not open the Glucose form itself');
      await ui.type(form.getByRole('textbox', { name: 'Reading', exact: true }), '62');
      await t.must(await saveForm(t, form) === 'guidance', 'a reading of 62 saved without the low guidance');
    }, { input: 'Glucose 62 mg/dL, time Now' });

    await t.step(2, '"This is a low. Treat it now.", with the steps, until read', async () => {
      const guidance = page.getByRole('dialog', { name: /^(Saved|What to do)$/ });
      const text = flat(await guidance.innerText());
      await t.checkpoint('low-guidance');
      await t.check(text.includes('This is a low. Treat it now.'), `the guidance does not say “This is a low. Treat it now.”: ${text.slice(0, 200)}`);
      await t.check(/15 ?g/.test(text) && /15 minutes/.test(text), `the treat-and-re-check steps are missing: ${text.slice(0, 300)}`);
      const now = ui.button(guidance, 'Yes, just now');
      if (await now.count()) await ui.tap(now);
      await ui.tap(ui.button(guidance, 'Done'));
      await guidance.waitFor({ state: 'hidden' });
    });

    await t.step(3, 'Home: the re-check state, with its time', async () => {
      await ui.tab(page, 'Home');
      const u = await hub.urgent(page);
      await t.checkpoint('low-home');
      await t.must(!!u, 'Home shows no safety surface after a low');
      await t.check(u.kind === 'recheck' || u.kind === 'low', `the surface is “${u.kind}”, not the re-check`);
      await t.check(/Re-check at 9:15 am/.test(u.text), `the surface does not say “Re-check at 9:15 am”: ${u.text}`);
    });

    await t.step(4, 'Workout, Stretch and Walk tiles: waiting for the re-check', async () => {
      for (const name of ['Workout', 'Stretch', 'Walk']) {
        const tile = hub.tile(page, name);
        await t.must(await tile.count() === 1, `Home has no ${name} tile`);
        const text = flat(await tile.innerText());
        await t.check(text.includes(WAITING), `the ${name} tile reads “${text}”, not “${WAITING}”`);
      }
    });

    await t.step(5, 'The Stretch hub: the gate’s card, no start, and a new reading', async () => {
      await hub.open(t, 'stretch');
      const r = await hub.refusal(page);
      await t.checkpoint('low-stretch-hub');
      await t.must(!!r, 'the Stretch hub still offers a start during the re-check');
      await t.check(r.title === 'Check again before you start', `the card reads “${r.title}”`);
      await t.check(r.text.includes(WAITING), `the card does not say “${WAITING}”: ${r.text.slice(0, 200)}`);
      await t.check(r.recheck, 'the card offers no “Enter a new reading”');
      const starts = (await hub.card(page).getByRole('button').allInnerTexts()).map(flat).filter(l => hub.STARTERS.test(l));
      await t.check(starts.length === 0, `the card offers ${JSON.stringify(starts)}`);
    });
  },
}];
