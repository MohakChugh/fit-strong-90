/**
 * V-J29 (journey §17.2, A-17, B-12, B-13): unknown nutrients, and an allergy.
 * A peanut allergy keeps poha out of the ideas, and logging still finds it,
 * with a warning. Your own food with no values stays unknown. The partial
 * total says "in logged foods" and counts what has no estimate.
 */
import { persona } from '../fixtures/personas.mjs';
import * as food from '../lib/food.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J29';
export const title = 'Unknown nutrients and an allergy';

const PEANUT_ESTIMATES = { patch: { profile: { food: { level: 'estimates', hardBefore: 'no', allergies: ['peanut'] } } } };

const unknownAndAllergy = {
  name: 'bhel-puri-and-peanuts',
  async run(t) {
    // 09:00: breakfast by the sheet's clock.
    const page = await t.open({ seed: persona('P01', PEANUT_ESTIMATES), route: '/home' });

    await t.step(1, 'The peanut allergy leaves poha out of the ideas, on the hub and on Meal ideas (B-13)', async () => {
      const main = await food.openHub(t);
      const ideas = await food.group(main, 'Breakfast · ideas for you').innerText();
      await t.check(!/poha/i.test(ideas), `the hub offers poha to a person allergic to peanuts: ${ideas}`);
      await ui.tap(ui.row(main, 'Meal ideas', 'link'));
      await page.getByRole('heading', { level: 1, name: 'Meal ideas', exact: true }).waitFor();
      const breakfast = await food.group(page.getByRole('main'), 'Breakfast').innerText();
      await t.check(!/Vegetable poha/.test(breakfast), 'Meal ideas offers “Vegetable poha” to a person allergic to peanuts');
      await ui.tap(ui.back(page, 'Food'));
      await page.getByRole('heading', { level: 1, name: 'Food', exact: true }).waitFor();
    });

    await t.step(2, '"bhel puri" isn’t in the table: added as your own food, with no values, it has "No estimate"', async () => {
      await ui.tap(ui.row(page.getByRole('main'), 'Log what you ate', 'link'));
      const sheet = food.logSheet(page);
      await sheet.waitFor();
      await ui.type(sheet.getByRole('searchbox', { name: 'Search foods' }), 'bhel puri');
      await ui.tap(ui.row(sheet, 'Add “bhel puri” as your own food'));
      await sheet.getByRole('heading', { name: 'Your own food', exact: true }).waitFor();
      await ui.tap(ui.button(sheet, 'Add to meal'));
      const own = await food.trayItem(sheet, 'bhel puri').innerText();
      await t.check(/No estimate/.test(own) && !/\b0 kcal\b/.test(own), `your own food reads “${own.replace(/\s+/g, ' ')}”, not “No estimate” (A-17)`);
    });

    await t.step(3, 'Poha can still be logged, with its warning (B-13); roti is added with its "+"', async () => {
      const sheet = food.logSheet(page);
      await ui.type(sheet.getByRole('searchbox', { name: 'Search foods' }), 'poha');
      const results = await food.group(sheet, 'Results').innerText();
      await t.check(/Vegetable poha/.test(results) && /Contains peanut, which you listed as an allergy/.test(results),
        `search for poha shows: ${results.replace(/\s+/g, ' ')}`);
      await ui.type(sheet.getByRole('searchbox', { name: 'Search foods' }), 'roti');
      await ui.tap(food.addButton(sheet, 'Roti (whole-wheat)'));
      const names = await food.trayNames(sheet);
      await t.check(names.join('|') === 'bhel puri|Roti (whole-wheat)', `the tray holds ${names.join(', ')}`);
    });

    await t.step(4, 'Save: "Breakfast saved"; the total is labelled partial, and the unknown counted (A-17, B-12)', async () => {
      const sheet = food.logSheet(page);
      await ui.tap(ui.button(sheet, 'Save meal'));
      await food.toast(page, 'Breakfast saved').waitFor();
      const snap = await t.checkpoint('saved');
      const [saved] = food.mealsOn(snap, '2026-10-08');
      const own = (snap.customFoods ?? [])[0];
      await t.check(saved?.items?.length === 2 && saved.items[0].kind === 'custom' && saved.items[0].kcal === undefined && saved.items[0].carbsG === undefined,
        `the stored meal: ${JSON.stringify(saved)}`);
      await t.check(own?.name === 'bhel puri' && own.kcal === undefined && own.carbsG === undefined, `the stored own food: ${JSON.stringify(own)}`);
      const today = await food.region(page, 'Today').innerText();
      await t.check(/Estimated \d[\d,]* kcal · (about )?[\d–]+ g carbs in logged foods/.test(today), `Today has no partial total: ${today.replace(/\s+/g, ' ')}`);
      await t.check(/1 item has no estimate/.test(today), `Today doesn’t count the unknown item: ${today.replace(/\s+/g, ' ')}`);
    });
  },
};

export const cases = [unknownAndAllergy];
