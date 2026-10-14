/**
 * V-J31 (journey §17.2, A-22, B-12): correct a meal from 10 days ago. It is
 * saved with its history, and no incident is resolved: an urgent low stays
 * urgent, and no reading or check-in changes.
 */
import { persona } from '../fixtures/personas.mjs';
import * as data from '../lib/data.mjs';
import * as food from '../lib/food.mjs';
import { docs } from '../lib/harness.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J31';
export const title = 'Correct a meal from 10 days ago';

const ESTIMATES = { patch: { profile: { food: { pattern: 'vegetarian', avoid: [], level: 'estimates', hardBefore: 'no' } } } };
const DAY = '2026-09-28';
const OLD_LUNCH = food.meal('meal-seed-0928', `${DAY}T13:05:00.000+05:30`, 'lunch', [food.ROTI, food.DAL], 'estimates');

/** The shell's urgent surface (journey §4.7). */
const urgent = page => page.locator('section[data-urgent-kind]');

const correctOldMeal = {
  name: 'ten-days-ago',
  async run(t) {
    // P04 takes insulin: carbs show as ranges (K-22).
    const page = await t.open({ seed: persona('P04', ESTIMATES), route: '/home' });
    let before;

    await t.step(1, 'A lunch from 28 September is on this phone; a low makes today urgent', async () => {
      await food.seedMeals(t, [OLD_LUNCH]);
      await data.logGlucose(t, { value: 62 });
      // A low: its guidance shows at once (as v1), and the shell keeps the urgent state.
      const guidance = page.getByRole('dialog', { name: /^(Saved|What to do)$/ });
      await guidance.waitFor();
      await ui.tap(ui.button(guidance, 'Close'));
      await ui.tab(page, 'Home');
      await urgent(page).first().waitFor();
      before = await t.checkpoint('before-correction');
      await t.must(food.mealsOn(before, DAY).length === 1, 'the 28 September lunch did not merge');
    });

    await t.step(2, 'Today’s log → 28 September → Lunch → dal ×1½ → Save: "Lunch updated"', async () => {
      await ui.legacyTab(page, 'Track');
      await data.trackDay(page, DAY);
      await ui.tap(ui.row(page.getByRole('main'), 'Lunch', 'link'));
      const sheet = food.logSheet(page);
      await sheet.waitFor();
      await t.check(await page.getByRole('dialog', { name: 'Edit lunch', exact: true }).count() === 1, 'the meal didn’t open as “Edit lunch”');
      const dal = food.trayItem(sheet, 'Toor dal');
      await ui.tap(dal.getByRole('button', { name: 'More', exact: true }));
      await t.check(/1½ katoris \(≈ 225 g\)/.test(await dal.innerText()), `the dal reads “${(await dal.innerText()).replace(/\s+/g, ' ')}”`);
      await t.check(/about [\d–]+ g carbs/.test(await sheet.innerText()), 'carbs aren’t shown as a range with insulin (K-22)');
      await ui.tap(ui.button(sheet, 'Save meal'));
      await food.toast(page, 'Lunch updated').waitFor();
      await sheet.waitFor({ state: 'hidden' });
    });

    await t.step(3, 'Saved with its history; nothing else changed, and the low is still urgent', async () => {
      const after = await t.checkpoint('after-correction');
      const [lunch] = food.mealsOn(after, DAY);
      await t.check(lunch?.id === OLD_LUNCH.id && lunch.items.find(i => i.foodId === 'toor-dal')?.count === 1.5, `the corrected lunch: ${JSON.stringify(lunch)}`);
      await t.check(lunch?.edits?.length === 1 && JSON.stringify(lunch.edits[0].items) === JSON.stringify(OLD_LUNCH.items) && typeof lunch.editedAt === 'string',
        `its history: ${JSON.stringify(lunch?.edits)}`);
      await t.check(food.mealsOn(after, '2026-10-08').length === 0, 'the correction made a meal today');
      // The readings, the low among them, and the check-ins are untouched.
      await t.check(JSON.stringify(after.observations) === JSON.stringify(before.observations), 'correcting a meal changed a reading');
      await t.check(JSON.stringify(docs(after).checkIns) === JSON.stringify(docs(before).checkIns), 'correcting a meal changed a check-in');
      const row = (await ui.row(page.getByRole('main'), 'Lunch', 'link').innerText()).replace(/\s+/g, ' ');
      await t.check(/Toor dal ×1½/.test(row), `Today’s log’s lunch reads “${row}”`);
      await ui.tab(page, 'Home');
      await t.check(await urgent(page).count() > 0, 'correcting a meal resolved the urgent low');
      // Food's trend (Plan 8, D114): 28 September in September's list, "Estimated", the corrected figure, "in logged foods".
      // Rounded as the app rounds a day's energy: to the whole kcal (`totalsOf`), then to the nearest 10 (`kcalText`).
      const kcal = Math.round(lunch.items.reduce((sum, i) => sum + (i.kcal ?? 0), 0));
      const want = `Estimated ${(Math.round(kcal / 10) * 10).toLocaleString('en-IN')} kcal in logged foods`;
      await t.goto(`/trends/food?period=month&at=${DAY}`);
      await ui.heading(page, 'Food');
      const main = page.getByRole('main');
      await ui.tap(ui.button(main, 'Show as list'));
      // A table, or at 320 px a block a day (Plan 3's H3-17): only the one shown is in the accessibility tree, both named so.
      const list = main.getByRole('table', { name: 'Food, September' }).or(main.getByRole('list', { name: 'Food, September' }));
      await list.waitFor();
      const day = list.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Monday, 28 September' }) })
        .or(list.getByRole('listitem').filter({ hasText: 'Monday, 28 September' }));
      const listed = (await day.innerText()).replace(/\s+/g, ' ');
      await t.check(listed.includes(want), `28 September in Food’s trend reads “${listed}”, not “${want}”`);
      const text = (await main.innerText()).replace(/\s+/g, ' ');
      await t.check(/Shown as logged, with no comparison to another period\./.test(text) && !/Highest|Higher than|Lower than/.test(text), `Food’s trend compares or ranks: ${text.slice(0, 300)}`);
      await t.checkpoint('food-trend-september');
    });

    await t.step(4, 'The meal opens again with its earlier version listed', async () => {
      await ui.legacyTab(page, 'Track');
      await data.trackDay(page, DAY);
      await ui.tap(ui.row(page.getByRole('main'), 'Lunch', 'link'));
      const sheet = food.logSheet(page);
      await sheet.waitFor();
      const history = await food.group(sheet, 'Earlier versions').innerText();
      await t.check(/Roti \(whole-wheat\) ×2 · Toor dal/.test(history), `“Earlier versions” reads ${history.replace(/\s+/g, ' ')}`);
      await ui.tap(sheet.getByRole('button', { name: 'Close', exact: true }));
    });
  },
};

export const cases = [correctOldMeal];
