/**
 * V-J28 (journey §17.2, §11.1, §11.5, K-22): Food with logging off → meal
 * ideas → turn logging on → the same hub.
 *
 * Cases:
 *   meals-only   P01 with logging off. The hub shows ideas and "Log what you eat"; "Meals only, no numbers" turns logging on in place.
 *   estimates    "With calorie and carb estimates": the screening question first; "Prefer not to say" recommends meals only; "With estimates anyway" keeps estimates.
 */
import { persona } from '../fixtures/personas.mjs';
import { docs } from '../lib/harness.mjs';
import * as food from '../lib/food.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J28';
export const title = 'Food with logging off, then on';

const LEVEL_SHEET = 'Log what you eat?';

/** The hub with logging off: three ideas for lunch, and the way in to logging. */
async function hubWithLoggingOff(t) {
  const main = await food.openHub(t);
  const ideas = food.group(main, 'Lunch · ideas for you');
  await t.check(await ideas.getByRole('link').count() === 3, `“Lunch · ideas for you” lists ${await ideas.getByRole('link').count()} ideas, not 3`);
  await t.check(await ui.row(main, 'Log a meal', 'link').count() === 0, 'Options offers “Log a meal” with logging off');
  return main;
}

const mealsOnly = {
  name: 'meals-only',
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/home', time: food.LUNCHTIME });

    await t.step(1, 'Food tile → the hub: meal ideas, and "Log what you eat"', async () => {
      const line = await food.tile(page).innerText();
      await t.check(/Meal ideas for you/.test(line), `the Food tile reads “${line.replace(/\s+/g, ' ')}”`);
      await hubWithLoggingOff(t);
    });

    await t.step(2, '"Log what you eat" → "Yes, meals only, no numbers": the same hub, now logging', async () => {
      const main = page.getByRole('main');
      await ui.tap(ui.row(main, 'Log what you eat'));
      const sheet = ui.sheet(page, LEVEL_SHEET);
      await sheet.waitFor();
      await ui.tap(sheet.getByRole('radio', { name: /^Yes, meals only, no numbers/ }));
      await sheet.waitFor({ state: 'hidden' });
      await t.check(await t.route() === '/hub/food', `turning logging on left the hub for ${await t.route()}`);
      await ui.row(main, 'Log what you ate', 'link').waitFor();
      await main.getByText('Nothing logged yet today', { exact: true }).waitFor();
      for (const option of ['Log a meal', 'Your usual meals', 'Quick add', 'Meal ideas', 'Sample week']) {
        await t.check(await ui.row(main, option, 'link').count() === 1, `Options lacks “${option}” (B-08)`);
      }
      await t.check(!food.FIGURES.test(await main.innerText()), 'the hub shows a figure while counts-free (B-11)');
      const kept = docs(await t.checkpoint('meals-only')).profile?.food;
      await t.check(kept?.level === 'meals' && kept.hardBefore === undefined, `stored food preferences: ${JSON.stringify(kept)}`);
    });
  },
};

const estimates = {
  name: 'estimates',
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/home', time: food.LUNCHTIME });

    await t.step(1, 'Estimates are asked for: the screening question comes first (K-22)', async () => {
      const main = await hubWithLoggingOff(t);
      await ui.tap(ui.row(main, 'Log what you eat'));
      const sheet = ui.sheet(page, LEVEL_SHEET);
      await sheet.waitFor();
      await ui.tap(sheet.getByRole('radio', { name: /^Yes, with calorie and carb estimates/ }));
      await sheet.getByText('Has food or weight ever been hard for you?', { exact: true }).waitFor();
      await t.check(await sheet.getByText('Your answer stays on this phone, and only changes what we suggest.', { exact: true }).count() === 1, 'the question doesn’t say what happens to the answer');
    });

    await t.step(2, '"Prefer not to say" recommends meals only; "With estimates anyway" keeps estimates', async () => {
      const sheet = ui.sheet(page, LEVEL_SHEET);
      await ui.tap(ui.button(sheet, 'Prefer not to say'));
      await sheet.getByText('Many people find it easier to log without numbers.', { exact: true }).waitFor();
      await t.check(await ui.button(sheet, 'Meals only, no numbers (recommended)').count() === 1, 'meals only is not offered as recommended');
      await ui.tap(ui.button(sheet, 'With estimates anyway'));
      await sheet.waitFor({ state: 'hidden' });
      await t.check(await t.route() === '/hub/food', `choosing estimates left the hub for ${await t.route()}`);
    });

    await t.step(3, 'The level and the answer are kept where setup keeps them (board D102), and estimates show', async () => {
      const main = page.getByRole('main');
      await ui.tap(ui.row(main, 'Log what you ate', 'link'));
      const sheet = food.logSheet(page);
      await sheet.waitFor();
      const common = food.group(sheet, 'Common Indian foods');
      await t.check(/Estimated \d/.test(await common.innerText()), 'Common Indian foods show no estimates with estimates on');
      await ui.tap(sheet.getByRole('button', { name: 'Close', exact: true }));
      await sheet.waitFor({ state: 'hidden' });
      const kept = docs(await t.checkpoint('estimates')).profile?.food;
      await t.check(kept?.level === 'estimates' && kept.hardBefore === 'preferNot', `stored food preferences: ${JSON.stringify(kept)}`);
    });
  },
};

export const cases = [mealsOnly, estimates];
