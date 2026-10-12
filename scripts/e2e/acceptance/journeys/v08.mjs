/**
 * V-J08: look up a food (journey §17.1 V-J08, §14). Browse → search
 * "chapatti" → the food and the Guide card. Also a condition (sciatica) and a
 * word nothing has.
 */
import { persona } from '../fixtures/personas.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J08';
export const title = 'Look up a food in Browse';
export const safety = false;

const flat = s => s.replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ');

/** Browse, then the words typed into its search, as a person types them. */
async function searchBrowse(t, words) {
  const page = t.page;
  await ui.tab(page, 'Browse');
  const box = page.getByRole('main').getByRole('searchbox', { name: 'Search', exact: true });
  await ui.type(box, words);
  await page.waitForTimeout(300);
  return box;
}

export const cases = [
  {
    name: 'chapatti finds the food and the Guide card',
    async run(t) {
      const page = await t.open({ seed: persona('P01'), route: '/home' });
      const main = page.getByRole('main');
      await t.step(1, 'Browse → search “chapatti”', async () => {
        await searchBrowse(t, 'chapatti');
        await t.must(await ui.row(ui.section(main, 'Eat'), 'Roti, dal and sabzi', 'link').count() === 1, `Eat lists no “Roti, dal and sabzi”: ${flat(await main.innerText()).slice(0, 300)}`);
        await t.check(await ui.row(ui.section(main, 'Learn'), 'Rice, roti and millets', 'link').count() === 1, 'Learn lists no “Rice, roti and millets”');
        await t.check(!/These match some of them/.test(await main.innerText()), 'a full match is labelled partial');
        await t.checkpoint('browse-chapatti');
      }, { input: 'chapatti' });
      await t.step(2, 'Open the food; Back returns to Browse with the search kept', async () => {
        await ui.tap(ui.row(ui.section(main, 'Eat'), 'Roti, dal and sabzi', 'link'));
        await ui.heading(page, 'Roti, dal and sabzi');
        await t.check(await t.route() === '/hub/food/ideas/l-roti-dal-sabzi', `the food opened at ${await t.route()}`);
        await t.checkpoint('meal-from-browse');
        await ui.tap(ui.back(page, 'Browse'));
        await ui.heading(page, 'Browse');
        const box = main.getByRole('searchbox', { name: 'Search', exact: true });
        await t.check(await box.inputValue() === 'chapatti', `Back lost the search: “${await box.inputValue()}”`);
      });
      await t.step(3, 'Open the Guide card', async () => {
        await ui.tap(ui.row(ui.section(main, 'Learn'), 'Rice, roti and millets', 'link'));
        await ui.heading(page, 'Rice, roti and millets');
        await t.check(await t.route() === '/hub/learn/card/card-grains', `the card opened at ${await t.route()}`);
        await t.checkpoint('card-from-browse');
      });
    },
  },
  {
    name: 'sciatica finds Back & leg and the back answers',
    async run(t) {
      const page = await t.open({ seed: persona('P01'), route: '/home' });
      const main = page.getByRole('main');
      await t.step(1, 'Browse → search “sciatica”', async () => {
        await searchBrowse(t, 'sciatica');
        await t.check(await ui.row(ui.section(main, 'Check'), 'Back & leg', 'link').count() === 1, 'Check lists no Back & leg');
        await t.check(await ui.row(ui.section(main, 'Learn'), 'Moving with back pain', 'link').count() === 1, 'Learn lists no “Moving with back pain”');
        await t.checkpoint('browse-sciatica');
      }, { input: 'sciatica' });
      await t.step(2, 'Back & leg opens its hub, with Back named after Browse', async () => {
        await ui.tap(ui.row(ui.section(main, 'Check'), 'Back & leg', 'link'));
        await page.waitForFunction(() => location.hash.startsWith('#/hub/back'), null, { timeout: 10000 });
        // The address changes a moment before the hub replaces Browse on screen.
        await ui.heading(page, 'Back & leg');
        await t.check(await ui.back(page, 'Browse').count() === 1, 'the hub’s Back is not named Browse');
      });
    },
  },
  {
    name: 'a word nothing has says so',
    async run(t) {
      const page = await t.open({ seed: persona('P01'), route: '/home' });
      const main = page.getByRole('main');
      await t.step(1, 'Browse → search “xylophone”', async () => {
        await searchBrowse(t, 'xylophone');
        const text = flat(await main.innerText());
        await t.check(/Nothing matches “xylophone”\. Try another word, such as roti or walk\./.test(text), `no plain “nothing matches”: ${text.slice(0, 200)}`);
        await t.check(await ui.section(main, 'Move').count() === 0, 'groups are listed for a word nothing has');
        await t.checkpoint('browse-nothing');
      }, { input: 'xylophone' });
    },
  },
  {
    name: 'chapatti lists the roti to log, with its estimate only when estimates are on',
    async run(t) {
      // Allergies answered, as "No food allergies": Browse lists foods to log only once they're known (D115, the owner's rule).
      const page = await t.open({ seed: persona('P01', { patch: { profile: { food: { pattern: 'vegetarian', avoid: [], allergies: [], level: 'estimates', hardBefore: 'no' } } } }), route: '/home' });
      const main = page.getByRole('main');
      await t.step(1, 'Browse → “chapatti”: the roti under Eat, after the meal idea, with its estimate', async () => {
        await searchBrowse(t, 'chapatti');
        const names = (await ui.section(main, 'Eat').getByRole('link').allInnerTexts()).map(flat);
        const idea = names.findIndex(n => n.startsWith('Roti, dal and sabzi'));
        const food = names.findIndex(n => n.startsWith('Roti (whole-wheat)'));
        await t.must(food >= 0, `Eat lists no roti to log: ${JSON.stringify(names)}`);
        await t.check(idea >= 0 && idea < food, `the food is not after the meal idea: ${JSON.stringify(names)}`);
        await t.check(/Estimated \d+ kcal/.test(names[food]), `the roti row has no estimate: “${names[food]}”`);
        await t.checkpoint('browse-food-row');
      }, { input: 'chapatti' });
      await t.step(2, 'The row opens “Log a meal” at the roti’s portion', async () => {
        await ui.tap(ui.section(main, 'Eat').getByRole('link', { name: /^Roti \(whole-wheat\)/ }));
        await page.waitForFunction(() => location.hash.startsWith('#/hub/food/log'), null, { timeout: 10000 });
        const sheet = page.getByRole('dialog', { name: 'Log a meal' });
        await sheet.waitFor({ timeout: 10000 });
        await t.check(/Roti \(whole-wheat\)/.test(await sheet.innerText()), 'the sheet did not open at the roti');
        await t.checkpoint('browse-food-log');
      });
    },
  },
  {
    name: 'counts-free, the food row has no figure',
    async run(t) {
      const page = await t.open({ seed: persona('P01', { patch: { profile: { food: { pattern: 'vegetarian', avoid: [], allergies: [], level: 'meals' } } } }), route: '/home' });
      const main = page.getByRole('main');
      await t.step(1, 'Browse → “chapatti”: the roti with its portion, and no figure (B-11)', async () => {
        await searchBrowse(t, 'chapatti');
        const text = flat(await ui.section(main, 'Eat').innerText());
        await t.check(/Roti \(whole-wheat\)/.test(text), `Eat lists no roti: ${text}`);
        await t.check(!/kcal|carbs|Estimated/.test(text), `counts-free shows a figure: ${text}`);
        await t.checkpoint('browse-food-counts-free');
      }, { input: 'chapatti' });
    },
  },
  {
    name: 'allergies never answered, no food is listed to log',
    async run(t) {
      // Logs meals, but the food record's allergies were never answered: unknown, never "none" (the owner's rule).
      const page = await t.open({ seed: persona('P01', { patch: { profile: { food: { pattern: 'vegetarian', avoid: [], level: 'estimates', hardBefore: 'no' } } } }), route: '/home' });
      const main = page.getByRole('main');
      await t.step(1, 'Browse → “chapatti”: no food from the table to log while allergies are unknown (D115)', async () => {
        await searchBrowse(t, 'chapatti');
        const text = flat(await main.innerText());
        await t.check(!/Roti \(whole-wheat\)/.test(text), `Browse lists a food to log with allergies unknown: ${text.slice(0, 300)}`);
        await t.check(await main.locator('a[href*="/hub/food/log"]').count() === 0, 'a row opens “Log a meal” with allergies unknown');
        await t.checkpoint('browse-food-allergies-unknown');
      }, { input: 'chapatti' });
    },
  },
];
