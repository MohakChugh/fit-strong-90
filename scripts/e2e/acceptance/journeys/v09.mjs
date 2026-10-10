/**
 * V-J09, back hurts more (journey §17.1, §4.7): the Back & leg tile → its hub
 * → Add reading → pain scores → Latest says them. Then how far it reaches,
 * and a red flag, through today's check-in, where the engine reads them
 * (D53) → the stop, everywhere: every tab shows the safety surface, and no
 * movement hub offers a start. P01.
 */
import { persona } from '../fixtures/personas.mjs';
import { saveForm } from '../lib/data.mjs';
import * as hub from '../lib/hub.mjs';
import * as move from '../lib/move.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'VJ09';
export const title = 'Back hurts more: pain scores in the hub, then a red flag stops movement everywhere';
export const safety = true;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();
const STOP = 'Call emergency services now';

export const cases = [{
  name: 'pain 6 and 5, then new loss of bladder control',
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/home' });
    const main = page.getByRole('main');

    await t.step(1, 'Back & leg tile → hub → Add reading → 6 and 5 → Latest', async () => {
      await hub.openHub(t, 'Back & leg', '/hub/back');
      await ui.tap(ui.button(main, 'Add reading'));
      const form = page.getByRole('dialog', { name: 'Back & leg pain' });
      await form.waitFor({ timeout: 10000 });
      await ui.type(form.getByRole('textbox', { name: 'Back pain', exact: true }), '6');
      await ui.type(form.getByRole('textbox', { name: 'Leg pain', exact: true }), '5');
      await saveForm(t, form);
      const latest = flat(await ui.section(main, 'Latest').innerText());
      await t.checkpoint('back-latest');
      await t.check(/Back pain 6 of 10 · Today · 9:00 am/.test(latest) && /Leg pain 5 of 10 · Today · 9:00 am/.test(latest), `Latest reads: ${latest}`);
    }, { input: 'Back pain 6, leg pain 5' });

    await t.step(2, 'How far it reaches, and a red flag: today’s check-in', async () => {
      await ui.tap(ui.row(main, 'How far it reaches, or new weakness'));
      const sheet = move.checkInSheet(page);
      await sheet.waitFor({ timeout: 10000 });
      await ui.answerCheckIn(t, sheet, { emergency: [ui.EMERGENCY.bladderBowel] });
      await page.waitForTimeout(600);
      const { title: outcome, text } = await move.outcome(page);
      await t.checkpoint('back-red-flag');
      await t.check(outcome === STOP, `the check-in reads “${outcome}”, not “${STOP}”`);
      await t.check(await move.sheetStart(sheet).count() === 0, 'the check-in still offers a start');
      await t.check(/emergency|help now/i.test(text), `no emergency direction: ${text.slice(0, 200)}`);
      await ui.tap(ui.button(sheet, 'Close'));
    }, { input: 'Right now: new loss of bladder or bowel control' });

    await t.step(3, 'The stop on every tab', async () => {
      for (const tab of ['Home', 'Trends', 'Browse', 'Me']) {
        await ui.tab(page, tab);
        const u = await hub.urgent(page);
        await t.checkpoint(`back-stop-${tab.toLowerCase()}`);
        await t.check(!!u && u.kind === 'emergency' && u.headline === STOP, `${tab} shows ${u ? `“${u.headline}” (${u.kind})` : 'no safety surface'}`);
      }
    });

    await t.step(4, 'Every movement hub: the same stop, with no start', async () => {
      for (const mode of ['guided', 'stretch', 'walk']) {
        await hub.open(t, mode);
        const r = await hub.refusal(page);
        await t.check(!!r && r.title === STOP, `the ${mode} hub reads “${r?.title}”${r ? '' : ' and offers a start'}`);
        const starts = (await main.getByRole('button').allInnerTexts()).map(flat).filter(l => hub.STARTERS.test(l));
        await t.check(starts.length === 0, `the ${mode} hub offers ${JSON.stringify(starts)}`);
      }
    });
  },
}];
