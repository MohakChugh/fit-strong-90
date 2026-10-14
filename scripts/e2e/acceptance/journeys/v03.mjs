/**
 * V-J03 (journey §17.1, B-10, B-11, §4.5): log a usual lunch in three taps.
 *
 * Cases:
 *   usual-lunch   P01, meals only. Yesterday's lunch merged in. Food tile → "Same as yesterday’s lunch" → "Save meal".
 *   refused-save  The same, with the meals store refusing the first write: no "Lunch saved", the tray kept, then saved once.
 */
import { persona } from '../fixtures/personas.mjs';
import * as data from '../lib/data.mjs';
import * as food from '../lib/food.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J03';
export const title = 'Log a usual lunch';

const MEALS_ONLY = { patch: { profile: { food: { level: 'meals' } } } };
const TODAY = '2026-10-08';

const usualLunch = {
  name: 'usual-lunch',
  async run(t) {
    const page = await t.open({ seed: persona('P01', MEALS_ONLY), route: '/home', time: food.LUNCHTIME });

    await t.step(1, 'Yesterday’s lunch is on this phone, merged from a backup', async () => {
      await food.seedMeals(t, [food.USUAL_LUNCH]);
      await t.must(food.mealsOn(await t.db(), '2026-10-07').length === 1, 'yesterday’s lunch did not merge');
    });

    await t.step(2, 'Food tile → "Same as yesterday’s lunch" → "Save meal": three taps (B-10)', async () => {
      let taps = 0;
      const tap = async locator => { taps += 1; await ui.tap(locator); };
      const main = await food.openHub(t, tap);
      await tap(ui.row(main, 'Same as yesterday’s lunch', 'link'));
      const sheet = food.logSheet(page);
      await sheet.waitFor();
      const names = await food.trayNames(sheet);
      await t.check(names.join('|') === 'Roti (whole-wheat)|Toor dal|Dahi (curd)', `the tray holds ${names.join(', ')}`);
      await t.check(!food.FIGURES.test(await sheet.innerText()), 'the sheet shows a figure while counts-free (B-11)');
      await tap(ui.button(sheet, 'Save meal'));
      await food.toast(page, 'Lunch saved').waitFor();
      // "Lunch saved" only once it is stored (journey §4.5).
      const stored = food.mealsOn(await t.db(), TODAY);
      await t.check(stored.length === 1 && stored[0].meal === 'lunch' && stored[0].items.length === 3 && stored[0].level === 'meals',
        `stored for today: ${JSON.stringify(stored)}`);
      await t.check(taps === 3, `the usual lunch took ${taps} taps, not 3 (B-10)`);
      await sheet.waitFor({ state: 'hidden' });
    });

    await t.step(3, 'The Food tile counts it, and Today’s log lists it with no figure (B-11)', async () => {
      await ui.tab(page, 'Home');
      const line = await food.tile(page).innerText();
      await t.check(/1 meal logged today/.test(line), `the Food tile reads “${line.replace(/\s+/g, ' ')}”`);
      await ui.legacyTab(page, 'Track');
      await data.trackDay(page, TODAY);
      const row = ui.row(page.getByRole('main'), 'Lunch', 'link');
      const text = (await row.innerText()).replace(/\s+/g, ' ');
      await t.check(/Roti \(whole-wheat\) ×2 · Toor dal · Dahi \(curd\)/.test(text), `Today’s log’s lunch reads “${text}”`);
      await t.check(!food.FIGURES.test(text), `Today’s log shows a figure while counts-free: “${text}”`);
      await t.checkpoint('after-usual-lunch');
    });
  },
};

const refusedSave = {
  name: 'refused-save',
  async run(t) {
    const page = await t.open({ seed: persona('P01', MEALS_ONLY), route: '/home', time: food.LUNCHTIME });
    await food.seedMeals(t, [food.USUAL_LUNCH]);

    await t.step(1, 'The meals store refuses the first write: no "Lunch saved", and the tray stays', async () => {
      const main = await food.openHub(t);
      await ui.tap(ui.row(main, 'Same as yesterday’s lunch', 'link'));
      const sheet = food.logSheet(page);
      await sheet.waitFor();
      await t.setPageFaults([{ op: 'put', store: 'meals', action: 'abortAfterQueue', times: 1 }]);
      await ui.tap(ui.button(sheet, 'Save meal'));
      await sheet.getByText(/^That didn’t save\./).waitFor();
      await t.check(await food.toast(page, 'Lunch saved').count() === 0, '“Lunch saved” showed for a write that was refused');
      await t.check(food.mealsOn(await t.db(), TODAY).length === 0, 'a refused write left a meal stored');
      await t.check((await food.trayNames(sheet)).length === 3, 'the tray was lost when the write was refused');
    });

    await t.step(2, 'Save again: stored once', async () => {
      const sheet = food.logSheet(page);
      await ui.tap(ui.button(sheet, 'Save meal'));
      await food.toast(page, 'Lunch saved').waitFor();
      await t.check(food.mealsOn(await t.db(), TODAY).length === 1, 'the second save did not store exactly one meal');
    });
  },
};

export const cases = [usualLunch, refusedSave];
