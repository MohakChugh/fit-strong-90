/**
 * V-J22 (journey §17.2 #22, J§4.5): a dangerous reading while storage fails →
 * the guidance shows at once, the write fails → "Try saving again". Nothing
 * says "Saved". With space again, one tap saves it once. P03 on a
 * sulfonylurea, Glucose hub, 52 mg/dL (a serious low).
 */
import { persona } from '../fixtures/personas.mjs';
import { saveForm } from '../lib/data.mjs';
import * as hub from '../lib/hub.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J22';
export const title = 'A dangerous reading while storage fails: the guidance at once, and no “Saved”';
export const safety = true;

const MARK = 'acceptance-injected';
const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();
const guidanceOf = page => page.getByRole('dialog', { name: /^(Saved|What to do)$/ });
const lows = snap => (snap.observations ?? []).filter(o => o.kind === 'glucose' && o.value === 52);

export const cases = [{
  name: 'glucose 52 with every observation write refused',
  async run(t) {
    const page = await t.open({ seed: persona('P03'), route: '/home' });
    const main = page.getByRole('main');
    t.allowConsole(MARK);

    await t.step(1, 'Storage fails; Glucose hub → Add reading → 52 → Save', async () => {
      await hub.openHub(t, 'Glucose', '/hub/glucose');
      await t.setPageFaults([{ op: 'put', store: 'observations', action: 'quotaDom' }]);
      await ui.tap(ui.button(main, 'Add reading'));
      const form = page.getByRole('dialog', { name: 'Glucose' });
      await form.waitFor({ timeout: 10000 });
      await ui.type(form.getByRole('textbox', { name: 'Reading', exact: true }), '52');
      await t.must(await saveForm(t, form) === 'guidance', 'a reading of 52 showed no guidance while its write failed');
    }, { input: 'Glucose 52 mg/dL; every observation write refused (quota)' });

    await t.step(2, 'The guidance at once; “Not saved” and “Try saving again”; never “Saved”', async () => {
      const guidance = guidanceOf(page);
      await guidance.getByText(/Not saved/).first().waitFor({ timeout: 10000 });
      const text = flat(await guidance.innerText());
      await t.checkpoint('low-unsaved');
      await t.check(/This is a serious low\. Treat it now\./.test(text), `the guidance does not say “This is a serious low. Treat it now.”: ${text.slice(0, 300)}`);
      await t.check(/15 ?g/.test(text), `the treatment steps are missing: ${text.slice(0, 300)}`);
      await t.check(!/Saved on this device/.test(text), 'the guidance says Saved while the write failed');
      await t.check(await ui.button(guidance, 'Try saving again').count() === 1, 'no “Try saving again”');
      await t.check((await t.faultLog()).some(f => f.store === 'observations'), 'the write fault never fired');
      await t.check(lows(await t.db()).length === 0, 'the reading was stored despite the fault');
    });

    await t.step(3, 'Space again: “Try saving again” saves it once', async () => {
      await t.setPageFaults(null);
      const guidance = guidanceOf(page);
      await ui.tap(ui.button(guidance, 'Try saving again'));
      await guidance.getByText(/Saved on this device/).first().waitFor({ timeout: 10000 });
      const snap = await t.checkpoint('low-saved');
      await t.check(lows(snap).length === 1, `the reading is stored ${lows(snap).length} times`);
    });
  },
}];
