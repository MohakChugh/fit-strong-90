/**
 * V-J30 (journey §17.2, B-10, B-08): a usual lunch, one portion adjusted,
 * then Save; the taps counted apart from V-J03's three. Also the first-time
 * path, and a shaky double tap on Save (Review Focus 1).
 *
 * Cases:
 *   adjusted-usual  Food tile → "Same as yesterday’s lunch" → roti's "More" → "Save meal": four taps.
 *   first-time      Food tile → "Log what you ate" → type "roti" → "Add" → type "dal" → "Add" → "Save meal": five taps and two words.
 *   double-tap      "Save meal" tapped twice at once: one meal.
 */
import { persona } from '../fixtures/personas.mjs';
import * as food from '../lib/food.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J30';
export const title = 'Adjust a usual lunch; log a first meal';

const MEALS_ONLY = { patch: { profile: { food: { level: 'meals' } } } };
const TODAY = '2026-10-08';

/** A tap counter over `ui.tap`. */
function counted() {
  const c = { n: 0, tap: async locator => { c.n += 1; await ui.tap(locator); } };
  return c;
}

const adjustedUsual = {
  name: 'adjusted-usual',
  async run(t) {
    const page = await t.open({ seed: persona('P01', MEALS_ONLY), route: '/home', time: food.LUNCHTIME });
    await food.seedMeals(t, [food.USUAL_LUNCH]);

    await t.step(1, 'Usual lunch, one more roti, Save: four taps (B-10)', async () => {
      const c = counted();
      const main = await food.openHub(t, c.tap);
      await c.tap(ui.row(main, 'Same as yesterday’s lunch', 'link'));
      const sheet = food.logSheet(page);
      await sheet.waitFor();
      const roti = food.trayItem(sheet, 'Roti (whole-wheat)');
      await c.tap(roti.getByRole('button', { name: 'More', exact: true }));
      await t.check(/3 rotis \(≈ 120 g\)/.test(await roti.innerText()), `the roti reads “${(await roti.innerText()).replace(/\s+/g, ' ')}” after More`);
      await c.tap(ui.button(sheet, 'Save meal'));
      await food.toast(page, 'Lunch saved').waitFor();
      const [saved] = food.mealsOn(await t.db(), TODAY);
      await t.check(saved?.items?.find(i => i.foodId === 'roti')?.count === 3, `the stored lunch: ${JSON.stringify(saved)}`);
      await t.check(c.n === 4, `adjusting a usual lunch took ${c.n} taps, not 4`);
      t.note(`taps: ${c.n} (V-J03's usual lunch is 3)`);
    });
  },
};

const firstTime = {
  name: 'first-time',
  async run(t) {
    const page = await t.open({ seed: persona('P01', MEALS_ONLY), route: '/home', time: food.LUNCHTIME });

    await t.step(1, 'Two foods found by typing and added with "+": five taps', async () => {
      const c = counted();
      const main = await food.openHub(t, c.tap);
      await c.tap(ui.row(main, 'Log what you ate', 'link'));
      const sheet = food.logSheet(page);
      await sheet.waitFor();
      const search = sheet.getByRole('searchbox', { name: 'Search foods' });
      await ui.type(search, 'roti');
      await c.tap(food.addButton(sheet, 'Roti (whole-wheat)'));
      await ui.type(search, 'dal');
      await c.tap(food.addButton(sheet, 'Toor dal'));
      const names = await food.trayNames(sheet);
      await t.check(names.join('|') === 'Roti (whole-wheat)|Toor dal', `the tray holds ${names.join(', ')}`);
      await c.tap(ui.button(sheet, 'Save meal'));
      await food.toast(page, 'Lunch saved').waitFor();
      const [saved] = food.mealsOn(await t.db(), TODAY);
      await t.check(saved?.items?.map(i => `${i.foodId}×${i.count}`).join('|') === 'roti×1|toor-dal×1', `the stored lunch: ${JSON.stringify(saved)}`);
      await t.check(c.n === 5, `the first-time path took ${c.n} taps, not 5`);
      t.note(`taps: ${c.n}, plus typing "roti" and "dal"`);
    });
  },
};

const doubleTap = {
  name: 'double-tap',
  async run(t) {
    const page = await t.open({ seed: persona('P01', MEALS_ONLY), route: '/home', time: food.LUNCHTIME });
    await food.seedMeals(t, [food.USUAL_LUNCH]);

    await t.step(1, 'A shaky double tap on "Save meal" saves one meal (Review Focus 1)', async () => {
      const main = await food.openHub(t);
      await ui.tap(ui.row(main, 'Same as yesterday’s lunch', 'link'));
      const sheet = food.logSheet(page);
      await sheet.waitFor();
      await ui.button(sheet, 'Save meal').dblclick();
      await food.toast(page, 'Lunch saved').waitFor();
      await page.waitForTimeout(500);
      const today = food.mealsOn(await t.checkpoint('after-double-tap'), TODAY);
      await t.check(today.length === 1, `a double tap stored ${today.length} meals`);
    });
  },
};

export const cases = [adjustedUsual, firstTime, doubleTap];
