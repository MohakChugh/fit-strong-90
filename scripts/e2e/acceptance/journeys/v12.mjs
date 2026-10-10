/**
 * V-J12, customise Home (journey §17.1, §7.6), then every category opens its
 * real hub (Plan 2). P02's default Home has Sleep and no Water or Labs (no
 * water habit, no diabetes), so Water is added before it is moved: Edit Home
 * → Sleep "Hide" → "+ Add" → Water "Add" → Water "Move up" → "+ Add" → Labs
 * "Add" → Done. The layout holds over a reload, and the Labs tile opens the
 * Labs hub.
 */
import { persona } from '../fixtures/personas.mjs';
import * as hub from '../lib/hub.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'VJ12';
export const title = 'Customise Home, and every category opens its hub';
export const safety = false;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();
const checkTiles = async page => (await page.getByRole('main').getByRole('region', { name: 'Check', exact: true }).getByRole('link').allInnerTexts()).map(s => flat(s).split(' ')[0]);

/** What shows that a hub is the real one (Plan 2), not v1's interim screen. */
const REAL = {
  Workout: { path: '/hub/workout', has: page => hub.card(page) },
  Stretch: { path: '/hub/stretch', has: page => hub.card(page) },
  Walk: { path: '/hub/walk', has: page => hub.card(page) },
  Steps: { path: '/hub/steps', has: page => ui.button(page.getByRole('main'), 'Add today’s steps') },
  Glucose: { path: '/hub/glucose', has: page => ui.button(page.getByRole('main'), 'Add reading') },
  'Blood pressure': { path: '/hub/bp', has: page => ui.button(page.getByRole('main'), 'Add reading') },
  'Back & leg': { path: '/hub/back', has: page => ui.button(page.getByRole('main'), 'Add reading') },
  Weight: { path: '/hub/weight', has: page => ui.button(page.getByRole('main'), 'Add reading') },
  Water: { path: '/hub/water', has: page => ui.button(page.getByRole('main'), 'Add water') },
  Sleep: { path: '/hub/sleep', has: page => ui.button(page.getByRole('main'), 'Add sleep') },
  Waist: { path: '/hub/waist', has: page => ui.button(page.getByRole('main'), 'Add reading') },
  Labs: { path: '/hub/labs', has: page => ui.button(page.getByRole('main'), 'Add a result') },
  Learn: { path: '/hub/learn', has: page => page.getByRole('main').getByRole('searchbox', { name: 'Search Learn' }) },
};

export const cases = [
  {
    name: 'hide, add, move up, add, done',
    async run(t) {
      const page = await t.open({ seed: persona('P02'), route: '/home' });
      const main = page.getByRole('main');
      const edit = async () => { await ui.tap(ui.row(main, 'Edit Home')); await main.getByRole('heading', { level: 2, name: 'Edit Home' }).waitFor(); };
      const add = async name => {
        await ui.tap(ui.button(main, 'Add a tile to Home'));
        const sheet = page.getByRole('dialog', { name: 'Add to Home' });
        await sheet.waitFor();
        await ui.tap(ui.button(sheet, `Add, ${name}`));
        // The sheet may stay open, saying "Added" (journey §7.6): close it if it does.
        if (await sheet.isVisible()) await ui.tap(ui.button(sheet, 'Close'));
        await sheet.waitFor({ state: 'hidden' });
      };

      await t.step(1, 'Edit Home: Sleep Hide, add Water, Water Move up, add Labs, Done', async () => {
        await t.must((await checkTiles(page)).includes('Sleep'), `P02’s Check tiles are ${JSON.stringify(await checkTiles(page))}, with no Sleep`);
        await edit();
        await ui.tap(ui.button(main, 'Hide, Sleep'));
        await add('Water');
        await ui.tap(ui.button(main, 'Move up, Water'));
        await add('Labs');
        await t.checkpoint('edit-home-done');
        // The Done at the end of the list (there is another beside the heading).
        await ui.tap(main.locator('button[data-flip="done"]'));
        await ui.heading(page, ui.HOME_TITLE);
      }, { input: 'Hide Sleep; Add Water; Move up Water; Add Labs; Done' });

      await t.step(2, 'Home keeps the layout, over a reload too', async () => {
        const want = ['Water', 'Weight', 'Labs'];
        await t.check(JSON.stringify(await checkTiles(page)) === JSON.stringify(want), `Check reads ${JSON.stringify(await checkTiles(page))}, not ${JSON.stringify(want)}`);
        await t.reload();
        await ui.heading(page, ui.HOME_TITLE);
        await t.check(JSON.stringify(await checkTiles(page)) === JSON.stringify(want), `after a reload Check reads ${JSON.stringify(await checkTiles(page))}`);
        await t.checkpoint('home-customised');
      });

      await t.step(3, 'The Labs tile opens the Labs hub, and Back returns Home', async () => {
        await hub.openHub(t, 'Labs', '/hub/labs');
        await t.check(await REAL.Labs.has(page).count() === 1, 'the Labs hub has no “Add a result”');
        await ui.tap(ui.back(page, 'Home'));
        await page.waitForFunction(() => location.hash.startsWith('#/home'), null, { timeout: 10000 });
      });
    },
  },
  {
    name: 'every category opens its real hub',
    async run(t) {
      const page = await t.open({ seed: persona('P01'), route: '/home' });
      await t.step(1, 'Browse → each category → its hub', async () => {
        for (const [title, { path, has }] of Object.entries(REAL)) {
          await ui.tab(page, 'Browse');
          await ui.tap(ui.row(page.getByRole('main'), title, 'link'));
          // During the push Browse stays on screen until the hub's code is in, and the hub's skeleton has its title too:
          // wait for the hub's own title with its content, as hub.openHub does.
          await page.waitForFunction(({ path, title, loading }) => location.hash.replace(/^#/, '').split('?')[0] === path
            && [...document.querySelectorAll('main h1')].some(h => h.textContent.trim() === title) && !document.querySelector(loading),
          { path, title, loading: ui.LOADING }, { timeout: 15000 }).catch(() => {});
          const h1 = flat(await page.getByRole('main').getByRole('heading', { level: 1 }).innerText());
          await t.check(await t.route() === path || (await t.route()).startsWith(`${path}?`), `${title} opened ${await t.route()}, not ${path}`);
          await t.check(h1 === title && await has(page).count() === 1, `${title}'s hub reads “${h1}” and lacks its own first action`);
        }
        await t.checkpoint('every-hub');
      });
    },
  },
];
