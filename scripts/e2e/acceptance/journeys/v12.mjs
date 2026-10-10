/**
 * V-J12: customise Home (journey §17.1 V-J12, §7.6, §14, §5.1; M17, M18).
 * Edit Home → Sleep "Hide" → Water "Move up" → "+ Add" → Labs "Add" → Done.
 * Browse's More adds and removes a tile, from the defaults when Home has
 * stored none yet, and a full group says so.
 */
import { docs } from '../lib/harness.mjs';
import { persona } from '../fixtures/personas.mjs';
import * as data from '../lib/data.mjs';
import * as g from '../lib/guide.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J12';
export const title = 'Customise Home';
export const safety = false;

/** A group's tiles on Home, in order, by category id. */
const tilesIn = (page, group) => page.getByRole('main').locator(`section[data-group="${group}"] li[data-tile]`).evaluateAll(els => els.map(e => e.dataset.tile));
const layoutOf = async t => docs(await t.db()).settings?.home;
const json = v => JSON.stringify(v);

/** P02 (no conditions) with Water second in Check, so it can move up. */
const LAID = { order: { move: ['workout', 'stretch', 'walk'], eat: ['food'], check: ['weight', 'water', 'sleep'], learn: ['learn'] }, hidden: [] };

const customise = {
  name: 'Edit Home: hide, move up, add from pick mode, Done',
  async run(t) {
    const page = await t.open({ seed: persona('P02', { patch: { settings: { home: LAID } } }), route: '/home' });
    const main = page.getByRole('main');
    await t.step(1, 'Edit Home → Sleep “Hide”', async () => {
      await ui.tap(ui.row(main, 'Edit Home'));
      await page.getByRole('heading', { level: 2, name: 'Edit Home', exact: true }).waitFor();
      await ui.tap(ui.button(main, 'Hide, Sleep'));
      await main.locator('section[data-flip="hidden"]').getByRole('button', { name: 'Show, Sleep', exact: true }).waitFor();
      // The Undo toast comes once the hide is stored, a moment after Hidden lists Sleep.
      const toast = page.getByText('Sleep hidden from Home', { exact: true });
      await toast.waitFor({ timeout: 5000 }).catch(() => {});
      await t.check(await toast.count() === 1, 'Hide offers no “Sleep hidden from Home” with Undo');
      await t.checkpoint('edit-home-sleep-hidden');
    });
    await t.step(2, 'Water “Move up”', async () => {
      await ui.tap(ui.button(main, 'Move up, Water'));
      await data.waitDb(t, s => json(docs(s).settings?.home?.order?.check) === '["water","weight"]', 'Check never became Water, Weight');
      await t.checkpoint('edit-home-water-up');
    });
    await t.step(3, '“+ Add” → pick mode → Labs “Add” → Done', async () => {
      await ui.tap(ui.button(main, 'Add a tile to Home'));
      const sheet = ui.sheet(page, 'Add to Home');
      await sheet.waitFor();
      await t.check(await ui.button(sheet, 'Added, Workout').count() === 1, 'pick mode does not mark Workout as on Home');
      await t.check(await sheet.getByText('Exercise library', { exact: true }).count() === 0, 'pick mode lists a shortcut (B-14)');
      await ui.tap(ui.button(sheet, 'Add, Labs'));
      await ui.button(sheet, 'Added, Labs').waitFor();
      await t.checkpoint('pick-labs-added');
      await ui.tap(ui.button(sheet, 'Done'));
      await sheet.waitFor({ state: 'hidden' });
    });
    await t.step(4, 'Done: Home shows Water, Weight, Labs, and Sleep is hidden; a reload keeps it', async () => {
      // Edit Home has a Done beside its heading and another at its end: the last is the end's.
      await ui.tap(main.getByRole('button', { name: 'Done', exact: true }).last());
      await page.getByRole('heading', { level: 2, name: 'What would you like to do?', exact: true }).waitFor();
      await t.check(json(await tilesIn(page, 'check')) === '["water","weight","labs"]', `Check shows ${json(await tilesIn(page, 'check'))}`);
      const home = await layoutOf(t);
      await t.check(json(home?.order?.check) === '["water","weight","labs"]' && json(home?.hidden) === '["sleep"]', `stored: ${json(home)}`);
      await t.reload();
      await t.check(json(await tilesIn(page, 'check')) === '["water","weight","labs"]', 'the layout did not survive a reload');
      await t.checkpoint('home-customised');
    });
  },
};

const browseMore = {
  name: 'Browse More adds and removes a tile, from the defaults before Home stored any',
  async run(t) {
    const page = await t.open({ seed: persona('P02'), route: '/browse' });
    const main = page.getByRole('main');
    await t.step(1, 'Browse → Waist “More” → Add to Home, before Home has stored a layout (Review Focus 1)', async () => {
      await t.must((await layoutOf(t)) === undefined, 'a layout was stored before Home was ever opened');
      await ui.tap(ui.button(main, 'More, Waist'));
      await ui.tap(page.getByRole('menuitem', { name: 'Add to Home', exact: true }));
      const snap = await data.waitDb(t, s => !!docs(s).settings?.home, 'Add to Home stored no layout');
      const order = docs(snap).settings.home.order;
      await t.check(json(order) === json({ move: ['workout', 'stretch', 'walk'], eat: ['food'], check: ['weight', 'sleep', 'waist'], learn: ['learn'] }), `not the defaults plus Waist: ${json(order)}`);
      await t.checkpoint('browse-waist-added');
    });
    await t.step(2, 'Home shows Waist at the end of Check', async () => {
      await ui.tab(page, 'Home');
      await t.check(json(await tilesIn(page, 'check')) === '["weight","sleep","waist"]', `Check shows ${json(await tilesIn(page, 'check'))}`);
    });
    await t.step(3, 'Browse → Waist “More” → Remove from Home: it is hidden, not deleted', async () => {
      await ui.tab(page, 'Browse');
      await ui.tap(ui.button(main, 'More, Waist'));
      await ui.tap(page.getByRole('menuitem', { name: 'Remove from Home', exact: true }));
      const snap = await data.waitDb(t, s => (docs(s).settings?.home?.hidden ?? []).includes('waist'), 'Remove from Home did not hide Waist');
      await t.check(json(docs(snap).settings.home.order.check) === '["weight","sleep"]', `Check after Remove: ${json(docs(snap).settings.home.order.check)}`);
      await ui.tab(page, 'Home');
      await t.check(!(await tilesIn(page, 'check')).includes('waist'), 'Home still shows Waist');
    });
  },
};

const fullGroup = {
  name: 'a full group says so in the menu',
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/browse' });
    await t.step(1, 'Browse → Sleep “More”: Check already holds 5', async () => {
      await ui.tap(ui.button(page.getByRole('main'), 'More, Sleep'));
      const item = page.getByRole('menuitem', { name: 'Check is full (5)', exact: true });
      await t.must(await item.count() === 1, 'the menu does not say Check is full');
      await t.check(await item.getAttribute('aria-disabled') === 'true' || await item.getAttribute('data-disabled') !== null, 'the full group’s item can be chosen');
      await t.check(await page.getByText('Hide a tile in Edit Home to make room.', { exact: true }).count() === 1, 'the menu does not say what to do');
      await t.checkpoint('browse-check-full');
      await ui.tap(page.getByRole('menuitem', { name: 'Close', exact: true }));
    });
  },
};

const offered = {
  name: 'a newly relevant category is offered in Me once',
  async run(t) {
    const page = await t.open({ seed: persona('P02'), route: '/home' });
    const main = page.getByRole('main');
    await t.step(1, 'Home lays its tiles out; Me offers nothing', async () => {
      await data.waitDb(t, s => !!docs(s).settings?.home, 'Home never stored its layout');
      await ui.tab(page, 'Me');
      await t.check(await ui.section(main, 'New for Home').count() === 0, 'Me offers a tile before anything changed');
    });
    await t.step(2, 'Reminders → Water → no fluid limit → Turn on', async () => {
      await g.openHabits(t);
      await ui.tap(main.getByRole('switch', { name: 'Water', exact: true }));
      const ws = page.getByRole('dialog', { name: 'Water' });
      await ws.waitFor();
      await ui.tap(ui.row(ws.getByRole('radiogroup', { name: 'Has your care team told you to limit how much you drink?' }), 'No, there is no limit', 'radio'));
      await ui.tap(ui.button(ws, 'Turn on'));
      await ws.waitFor({ state: 'hidden' });
    }, { input: 'water reminders on, no fluid limit' });
    await t.step(3, 'Me: “Add Water to Home?” → Add', async () => {
      await ui.tap(ui.back(page, 'Me'));
      await ui.heading(page, 'Me');
      const offer = ui.section(main, 'New for Home');
      await t.must(await offer.getByText('Add Water to Home?', { exact: true }).count() === 1, `Me does not offer Water: ${(await main.innerText()).slice(0, 300)}`);
      await t.checkpoint('me-offer-water');
      await ui.tap(ui.button(offer, 'Add, Water'));
      await page.getByText('Water added to Home', { exact: true }).waitFor();
      await t.check(await ui.section(main, 'New for Home').count() === 0, 'the offer stays after Add');
      const s = docs(await t.db()).settings;
      await t.check(s.home.order.check.includes('water') && json(s.homeOffered) === '["water"]', `after Add: Check ${json(s.home.order.check)}, offered ${json(s.homeOffered)}`);
    });
    await t.step(4, 'Home shows Water; hidden again, it is not offered again', async () => {
      await ui.tab(page, 'Home');
      await t.check((await tilesIn(page, 'check')).includes('water'), 'Home has no Water tile');
      await ui.tap(ui.row(main, 'Edit Home'));
      await ui.tap(ui.button(main, 'Hide, Water'));
      await ui.tap(main.getByRole('button', { name: 'Done', exact: true }).last());
      await ui.tab(page, 'Me');
      await t.check(await ui.section(main, 'New for Home').count() === 0, 'Water is offered again after it was hidden');
    });
  },
};

export const cases = [customise, browseMore, fullGroup, offered];
