/**
 * V-J32 (journey §17.2 #32, B-04, B-05; D112, D119): two deletes in a row →
 * both Undo toasts stay, stacked → Undo the first → it returns under a fresh
 * id, its deletion record kept (B-05 supersedes "removed") → the day's total
 * is right. Leaving ends the other toast; Recently deleted still has it, and
 * its restore keeps the total right. And a serious low can't be deleted or
 * corrected while it holds the walk: refused in place, nothing changed, until
 * "It was a mistake" answers it as typed wrongly; then it goes with its Undo,
 * and comes back still answered (A-05, Codex P8-01, P8R-01, Kiro K8-07).
 * P01's water at 9:00 and 9:01; P03's 52 mg/dL, on a sulfonylurea.
 */
import { persona } from '../fixtures/personas.mjs';
import * as data from '../lib/data.mjs';
import { content, docs } from '../lib/harness.mjs';
import * as hub from '../lib/hub.mjs';
import * as rec from '../lib/recovery.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J32';
export const title = 'Two deletes in a row, one Undo, and Recently deleted; a serious low can’t be deleted while it holds';
export const safety = true;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();
const waterOf = snap => (snap.observations ?? []).filter(o => o.kind === 'water').sort((a, b) => a.at.localeCompare(b.at));
const lowsOf = snap => (snap.observations ?? []).filter(o => o.kind === 'glucose' && o.value === 52);
const REFUSED = 'This reading is keeping movement on hold, so it can’t be changed or removed yet. If it was typed wrongly, choose ‘It was a mistake’.';
const MISTAKE = 'It was a mistake';

export const cases = [
  {
    name: 'water 250 ml twice, both entries deleted, one undone, one restored',
    async run(t) {
      const page = await t.open({ seed: persona('P01'), route: '/day/today' });
      const main = page.getByRole('main');
      const waterRow = () => ui.row(ui.section(main, 'Day totals'), 'Water', 'link');
      let ids = [];

      const deleteCounting = async said => {
        await ui.tap(waterRow());
        await ui.heading(page, 'Water');
        await ui.tap(ui.row(main, 'Delete this entry'));
        await page.getByRole('heading', { level: 1, name: 'My Day', exact: true }).waitFor({ timeout: 15000 });
        await rec.toast(page, said).waitFor({ timeout: 10000 });
      };

      await t.step(1, 'Water 250 ml, and 250 ml more a minute later: 500 ml for the day', async () => {
        await data.logWater(t, 250);
        await t.advanceMinutes(1);
        await data.logWater(t, 250);
        const water = waterOf(await t.db());
        ids = water.map(o => o.id);
        await t.must(water.map(o => o.value).join(',') === '250,500', `water statements: ${water.map(o => o.value).join(', ')}`);
        await t.check(/500 ml/.test(flat(await waterRow().innerText())), 'the day total is not 500 ml');
      }, { input: 'Water 250 ml at 9:00, 250 ml more at 9:01' });

      await t.step(2, 'Delete the 500 ml entry, then the 250 ml one: each at once, each with its Undo', async () => {
        await deleteCounting('Water 500 ml deleted');
        await t.check(/250 ml/.test(flat(await waterRow().innerText())), 'after the 500 ml goes, the day does not count the 250 ml');
        await deleteCounting('Water 250 ml deleted');
        const shown = await rec.toasts(page);
        await t.checkpoint('two-undos');
        await t.check(shown.some(s => s.startsWith('Water 500 ml deleted')) && shown.some(s => s.startsWith('Water 250 ml deleted')), `both Undo toasts are not standing: ${JSON.stringify(shown)}`);
        const snap = await t.db();
        await t.check(waterOf(snap).length === 0, 'a water entry is still stored');
        await t.check(ids.every(id => (docs(snap).settings?.deleted?.observations ?? []).includes(id)), 'a deletion was not recorded (D-06)');
      });

      await t.step(3, 'Undo the 500 ml: back under a fresh id, its deletion record kept, said in its own toast; the other Undo still standing', async () => {
        await rec.undoIn(page, 'Water 500 ml deleted');
        await rec.toast(page, 'Water 500 ml restored').waitFor({ timeout: 10000 });
        await t.check(await rec.toast(page, 'Water 250 ml deleted').count() === 1, 'restoring one ended the other Undo (B-04)');
        const snap = await t.checkpoint('undo-500');
        const water = waterOf(snap);
        await t.check(water.length === 1 && water[0].value === 500 && water[0].restoredFrom === ids[1] && water[0].id !== ids[1], `after Undo: ${JSON.stringify(water.map(o => [o.id, o.value, o.restoredFrom]))}`);
        await t.check((docs(snap).settings?.deleted?.observations ?? []).includes(ids[1]), 'the original’s deletion record went (B-05)');
        await t.check(/500 ml/.test(flat(await waterRow().innerText())), 'the day total is not 500 ml after Undo');
        // Said until it is closed or its screen is left, never on a timer (K8-03).
        await t.advanceMinutes(5);
        await t.check(await rec.toast(page, 'Water 500 ml restored').count() === 1, '“Water 500 ml restored” went on a timer');
      });

      await t.step(4, 'Leave Today’s log: the remaining Undo ends; Recently deleted brings the 250 ml back, and 500 ml still counts', async () => {
        await ui.tab(page, 'Home');
        // Ended at the tab switch, it leaves as every toast does: its fade is a moment, not a timer.
        await rec.toast(page, 'Water 250 ml deleted').waitFor({ state: 'detached', timeout: 2000 }).catch(() => {});
        await t.check(await rec.toast(page, 'Water 250 ml deleted').count() === 0, 'the Undo outlived its screen (B-04)');
        await ui.legacyTab(page, 'Track');
        const sheet = await rec.openRecentlyDeleted(t);
        await t.checkpoint('recently-deleted');
        await ui.tap(sheet.getByRole('button', { name: 'Restore Water 250 ml', exact: true }));
        await sheet.getByText('Water 250 ml restored.', { exact: true }).waitFor({ timeout: 10000 });
        await ui.tap(ui.button(sheet, 'Close'));
        const snap = await t.checkpoint('restored-250');
        const water = waterOf(snap);
        await t.check(water.map(o => o.value).join(',') === '250,500' && water.every(o => o.restoredFrom), `after Restore: ${JSON.stringify(water.map(o => [o.value, o.restoredFrom]))}`);
        await t.check(/500 ml/.test(flat(await waterRow().innerText())), 'restoring the earlier entry changed the day total (Review Focus 2)');
      });
    },
  },
  {
    name: 'a serious low can’t be deleted or corrected while it holds; answered as typed wrongly, it goes, and comes back still answered (D119)',
    async run(t) {
      const page = await t.open({ seed: persona('P03'), route: '/home' });
      const main = page.getByRole('main');
      const SAID = 'Glucose 52 mg/dL';
      let first;

      const walkHeld = async when => {
        await hub.open(t, 'walk');
        const starts = (await hub.card(page).getByRole('button').allInnerTexts()).map(flat).filter(l => hub.STARTERS.test(l));
        await t.check(starts.length === 0, `${when}: the Walk hub offers ${JSON.stringify(starts)}`);
      };
      const openLow = async () => {
        await ui.legacyTab(page, 'Track');
        await ui.tap(ui.section(main, 'Records').getByRole('link').filter({ hasText: '52' }).first());
        await ui.heading(page, 'Glucose');
      };

      await t.step(1, 'Glucose hub → Add reading → 52: the serious low’s guidance, and the walk held', async () => {
        await hub.openHub(t, 'Glucose', '/hub/glucose');
        await ui.tap(ui.button(main, 'Add reading'));
        const form = page.getByRole('dialog', { name: 'Glucose' });
        await form.waitFor({ timeout: 10000 });
        await ui.type(form.getByRole('textbox', { name: 'Reading', exact: true }), '52');
        await t.must(await data.saveForm(t, form) === 'guidance', 'a reading of 52 showed no guidance');
        const guidance = page.getByRole('dialog', { name: /^(Saved|What to do)$/ });
        await guidance.getByText(/Saved on this device/).first().waitFor({ timeout: 10000 });
        await ui.tap(ui.button(guidance, 'Close'));
        await guidance.waitFor({ state: 'hidden' });
        await walkHeld('after the low');
        const snap = await t.checkpoint('low-saved');
        await t.must(lowsOf(snap).length === 1, `the 52 mg/dL reading is stored ${lowsOf(snap).length} times`);
        first = lowsOf(snap)[0].id;
      }, { input: 'Glucose 52 mg/dL' });

      await t.step(2, 'Delete this reading: refused in place, in words, with nothing deleted, no Undo and nothing in Recently deleted', async () => {
        await openLow();
        await ui.tap(ui.row(main, 'Delete this reading'));
        await main.getByText(REFUSED, { exact: true }).waitFor({ timeout: 10000 });
        await t.check(await main.getByRole('button', { name: MISTAKE, exact: true }).count() === 1, 'the refusal offers no “It was a mistake”');
        await t.check(await rec.toast(page, `${SAID} deleted`).count() === 0, 'an Undo was offered for a delete that was refused');
        const snap = await t.checkpoint('delete-refused');
        await t.check(lowsOf(snap).length === 1 && lowsOf(snap)[0].id === first, 'the 52 is not as it was');
        await t.check(!Object.keys(content(snap)).some(k => k.startsWith('recent:')), 'a refused delete left an entry in Recently deleted');
      });

      await t.step(3, 'Corrected to 152 instead: refused the same way, in the sheet; the 52 stays, and the walk is held', async () => {
        await ui.tap(ui.row(main, 'Correct this'));
        const sheet = page.getByRole('dialog').first();
        await sheet.waitFor({ timeout: 10000 });
        await ui.type(sheet.getByRole('textbox', { name: 'Value', exact: true }), '152');
        await ui.tap(ui.button(sheet, 'Save correction'));
        await sheet.getByText(REFUSED, { exact: true }).waitFor({ timeout: 10000 });
        await t.checkpoint('correction-refused');
        await t.check(lowsOf(await t.db()).length === 1, 'the correction went through');
        await ui.tap(ui.button(sheet, 'Close'));
        await walkHeld('after the refused correction');
      }, { input: '52 corrected to 152' });

      await t.step(4, 'It was a mistake: answered as typed wrongly, the delete goes through at once, with its Undo, and the walk is no longer held by the low', async () => {
        await openLow();
        await ui.tap(ui.row(main, 'Delete this reading'));
        await ui.tap(main.getByRole('button', { name: MISTAKE, exact: true }));
        await page.getByRole('heading', { level: 1, name: 'My Day', exact: true }).waitFor({ timeout: 15000 });
        await rec.toast(page, `${SAID} deleted`).waitFor({ timeout: 10000 });
        const snap = await t.checkpoint('answered-and-deleted');
        await t.check(lowsOf(snap).length === 0, 'the 52 is still stored after its answer and delete');
        // Check-ins are the settings store's `checkIns` document.
        const answers = (docs(snap).checkIns ?? []).flatMap(c => c.resolutions ?? []);
        await t.check(answers.some(a => a.resolution === 'mistake' && a.readings.some(id => id.includes('52'))), `no answer names the 52 as typed wrongly: ${JSON.stringify(answers)}`);
        await hub.open(t, 'walk');
        const refusal = (await hub.refusal(page))?.text ?? '';
        await t.check(!/52|low/i.test(refusal), `the Walk hub still holds for the low: ${refusal}`);
      });

      // A restore never lifts a hold (D119). The 52 brought back is again the day's latest reading, which every
      // rule reads as now, answered or not, as v1 reads a check-in's current reading: the walk is held again.
      // Once a later reading comes after it, its answer settles it, and only its answer does: the answer names
      // what was measured, not the row, so the copy under its fresh id is still answered.
      await t.step(5, 'Its Undo ended with the screen; Recently deleted brings the 52 back under a fresh id, still answered: held again while it is the latest reading, and settled by its answer once a later one comes', async () => {
        await ui.legacyTab(page, 'Track');
        const sheet = await rec.openRecentlyDeleted(t);
        // A clinical row's Restore names when the reading was measured too (F-data-03, J§4.10).
        await ui.tap(sheet.getByRole('button', { name: new RegExp(`^Restore ${SAID}, measured today at `) }));
        await sheet.getByText(`${SAID} restored.`, { exact: true }).waitFor({ timeout: 10000 });
        await ui.tap(ui.button(sheet, 'Close'));
        const snap = await t.checkpoint('restored-answered');
        await t.check(lowsOf(snap).length === 1 && lowsOf(snap)[0].restoredFrom === first && lowsOf(snap)[0].id !== first, `after Restore: ${JSON.stringify(lowsOf(snap).map(o => [o.id, o.restoredFrom]))}`);
        const answers = (docs(snap).checkIns ?? []).flatMap(c => c.resolutions ?? []);
        await t.check(answers.some(a => a.resolution === 'mistake' && a.readings.some(id => id.includes('52'))), `the restore took the 52’s answer away: ${JSON.stringify(answers)}`);
        await hub.open(t, 'walk');
        const held = (await hub.refusal(page))?.text ?? '';
        await t.check(/52|low/i.test(held), `the restored 52, the latest reading again, doesn’t hold the walk: ${held}`);
        await t.advanceMinutes(10);
        await data.logGlucose(t, { value: 120 });
        await hub.open(t, 'walk');
        const refusal = (await hub.refusal(page))?.text ?? '';
        await t.check(!/52|low/i.test(refusal), `the restored 52, answered as typed wrongly, still holds the walk after a later reading: ${refusal}`);
        await t.checkpoint('answered-and-earlier');
      }, { input: 'Restore Glucose 52 mg/dL; 10 minutes on, glucose 120 mg/dL' });
    },
  },
];
