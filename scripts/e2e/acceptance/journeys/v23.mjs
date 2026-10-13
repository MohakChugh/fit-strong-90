/**
 * V-J23 (journey §17.2 #23, J§4.4): a severe first blood pressure with the
 * second left empty → the guidance at once, not after the guided minute; the
 * first reading is kept and acts alone. P01, Blood pressure hub, 186/98.
 */
import { persona } from '../fixtures/personas.mjs';
import { saveForm } from '../lib/data.mjs';
import * as hub from '../lib/hub.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J23';
export const title = 'A severe first blood pressure with an empty second: guidance at once, the first kept';
export const safety = true;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();
const halves = snap => (snap.observations ?? []).filter(o => o.kind.startsWith('bloodPressure') && o.day === '2026-10-08');

export const cases = [{
  name: '186/98, second empty',
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/home' });
    const main = page.getByRole('main');

    await t.step(1, 'BP hub → Add reading → 186/98 → Add a second reading, left empty', async () => {
      await hub.openHub(t, 'Blood pressure', '/hub/bp');
      await ui.tap(ui.button(main, 'Add reading'));
      const form = page.getByRole('dialog', { name: 'Blood pressure' });
      await form.waitFor({ timeout: 10000 });
      await ui.type(form.getByRole('textbox', { name: 'Top (systolic)', exact: true }), '186');
      await ui.type(form.getByRole('textbox', { name: 'Bottom (diastolic)', exact: true }), '98');
      await ui.tap(ui.button(form, 'Add a second reading'));
      await t.check(/Sit quietly\. Take the second reading in a minute\./.test(flat(await form.innerText())), 'the minute between readings is not guided');
      await t.checkpoint('first-severe');
    }, { input: '186/98; the second reading left empty' });

    await t.step(2, 'Save before the minute is up: the guidance now', async () => {
      const form = page.getByRole('dialog', { name: 'Blood pressure' });
      // No clock moves between the tap and the guidance: it never waits for the minute.
      await t.must(await saveForm(t, form) === 'guidance', 'a severe first reading saved without its guidance');
      const guidance = page.getByRole('dialog', { name: /^(Saved|What to do)$/ });
      const text = flat(await guidance.innerText());
      await t.checkpoint('severe-guidance');
      await t.check(/This reading is very high\./.test(text), `the guidance does not say “This reading is very high.”: ${text.slice(0, 300)}`);
      await guidance.getByText(/Saved on this device/).first().waitFor({ timeout: 10000 });
    });

    await t.step(3, 'The first reading is kept, whole and alone, and Home acts on it', async () => {
      const snap = await t.db();
      const h = halves(snap);
      await t.check(h.length === 2 && h.some(o => o.kind === 'bloodPressureSystolic' && o.value === 186) && h.some(o => o.kind === 'bloodPressureDiastolic' && o.value === 98),
        `stored: ${JSON.stringify(h.map(o => [o.kind, o.value]))}`);
      await t.check(new Set(h.map(o => o.context)).size === 1, 'the two numbers are not one reading');
      const guidance = page.getByRole('dialog', { name: /^(Saved|What to do)$/ });
      const now = ui.button(guidance, 'Yes, just now');
      if (await now.count()) await ui.tap(now);
      await ui.tap(ui.button(guidance, 'Done'));
      await ui.tab(page, 'Home');
      await t.check(!!(await hub.urgent(page)), 'Home shows no safety surface after a severe reading');
      await t.checkpoint('severe-home');
    });
  },
}];
