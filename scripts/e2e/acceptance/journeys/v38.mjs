/**
 * V-J38 (journey §17.2 #38, J§21.2, B-21; D106, D107, D120, D121): an app
 * update arriving during a walk → the task is preserved; nothing reloads by
 * itself, and the update applies when FitStrong opens again, or at the
 * person's own Restart on Home once nothing is under way; the next Home says
 * "Updated" until it is dismissed. The same for a typed form however it
 * closes and for a profile chapter being edited; another window holds the restart
 * back. Then B-21's two copies and an interrupted upgrade, and two real
 * releases served at one origin with their workers: one waiting while a
 * second window is open, a walk holding the restart, a release that fails to
 * install, a window keeping its own release's files, offline, and a first
 * visit taken over by its release's first worker; then storage lost while the
 * app runs, read-only. Storage full during a log is J17 steps 1–2 and V-J03's
 * refused save (D118).
 */
import { MINUTE } from '../lib/env.mjs';
import { docs } from '../lib/harness.mjs';
import * as data from '../lib/data.mjs';
import * as rec from '../lib/recovery.mjs';
import * as rel from '../lib/releases.mjs';
import * as ui from '../lib/ui.mjs';
import * as walk from '../lib/walk.mjs';
import { persona } from '../fixtures/personas.mjs';

export const id = 'V-J38';
export const title = 'An update waits for FitStrong’s windows, never reloads by itself, and two real releases hand over cleanly';
export const safety = false;

const READY = 'An update is ready. It applies the next time FitStrong opens.';
const CLOSE_OTHERS = 'Close FitStrong’s other windows to update now.';
const UPDATED = 'Updated. FitStrong is on its latest version.';
const RESTARTING = 'Restarting to update…';
// The storage notice's title, its details beside it in the same words for a screen reader (`StorageBanner`).
const STALE_TITLE = /^A newer version of FitStrong is open/;
const STALE = 'FitStrong is open somewhere else with a newer version. Close this window and open FitStrong again.';
const WORKERS = { contextOptions: { serviceWorkers: 'allow' } };
const walksIn = snap => new Set(walk.walkObservations(snap).filter(o => o.kind === 'walkDuration').map(o => o.context));
const homeTab = page => ui.link(page.getByRole('navigation', { name: 'Main' }), 'Home');
const restart = page => page.getByRole('main').getByRole('button', { name: 'Restart to update', exact: true });
const restarts = async page => (await rec.swMessages(page)).filter(m => m === 'restart').length;
const appCaches = async page => (await rel.cacheNames(page)).filter(n => n.startsWith('fitstrong-'));

/** Every reading and session from before still there, and nothing added but the walk's: an update keeps each record once (P8-21). */
function keptOnce(before, after) {
  const was = new Set((before.observations ?? []).map(o => o.id));
  const now = after.observations ?? [];
  const gone = [...was].filter(id => !now.some(o => o.id === id));
  const extra = now.filter(o => !was.has(o.id) && !o.context?.startsWith('walk:'));
  const sessions = (after.sessions ?? []).length - (before.sessions ?? []).length;
  return [...gone.map(id => `${id} is gone`), ...extra.map(o => `${o.id} (${o.kind}) appeared`), ...(sessions ? [`${sessions} sessions more`] : [])];
}

/** Browse → Glucose → Add reading, with `value` typed: a form with an answer, away from Home. */
async function typedOnHub(page, value) {
  const main = page.getByRole('main');
  if (!(await page.getByRole('heading', { level: 1, name: 'Glucose', exact: true }).count())) {
    await ui.tab(page, 'Browse');
    await ui.tap(main.getByRole('link', { name: 'Glucose', exact: true }));
    await ui.heading(page, 'Glucose');
  }
  await ui.tap(ui.button(main, 'Add reading'));
  const form = page.getByRole('dialog', { name: 'Glucose' });
  await form.waitFor({ timeout: 10000 });
  await ui.type(form.getByRole('textbox', { name: 'Reading', exact: true }), value);
  return form;
}

/** The phone locked, and opened again. */
async function lockAndReturn(page) {
  await page.evaluate(() => window.__acc.setVisibility('hidden'));
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__acc.setVisibility('visible'));
  await page.waitForTimeout(800);
}

export const cases = [
  {
    name: 'an update during a walk: nothing reloads, Home names it, and Restart waits for the walk',
    preview: true,
    async run(t) {
      const page = await t.open({ seed: persona('P03'), route: '/home', updates: true, visibility: true });
      const main = page.getByRole('main');

      await t.step(1, 'A walk under way, and a new version installed', async () => {
        await walk.openSetup(t);
        await walk.start(t, ui.normalAnswers('P03'));
        await rec.offerUpdate(page);
        await page.waitForTimeout(500);
      });

      await t.step(2, 'On screen and with the phone locked: nothing reloads, and nothing asks the new version to take over', async () => {
        await lockAndReturn(page);
        await walk.elapse(t, 2 * MINUTE);
        await t.check(await rec.loads(page) === 1, 'the page reloaded during the walk');
        await t.check(await restarts(page) === 0, 'the page asked the new version to take over during the walk');
        await t.checkpoint('walk-held-update');
      });

      await t.step(3, 'Home while the walk is still under way: the update named, with no Restart', async () => {
        // Within the running app: a reload is what this case proves never happens, and the driven worker's
        // waiting release lives in this document only.
        await t.hash('/home');
        await t.ready();
        await main.getByText(READY, { exact: true }).waitFor({ timeout: 10000 });
        await t.check(await restart(page).count() === 0, 'Home offers Restart while the walk is under way');
        await t.hash('/walk/live');
        await t.ready();
      });

      await t.step(4, 'The walk saved: Restart on Home; tapped, the page reloads once, and Home says Updated until it is dismissed', async () => {
        await walk.finish(t);
        await ui.tap(ui.button(main, 'Save walk'));
        await page.getByText('Saved on this device', { exact: true }).waitFor({ timeout: 10000 });
        await ui.tap(ui.button(main, 'Done'));
        await ui.tap(homeTab(page));
        await restart(page).waitFor({ timeout: 10000 });
        await t.check(await rec.loads(page) === 1, 'the page reloaded before Restart was tapped');
        const reloaded = page.waitForEvent('load', { timeout: 20000 });
        await ui.tap(restart(page));
        await reloaded;
        await t.ready();
        await t.check(await rec.loads(page) === 2, `the page loaded ${await rec.loads(page)} times`);
        await page.getByText(UPDATED, { exact: true }).waitFor({ timeout: 10000 });
        await t.advanceMinutes(5);
        await t.check(await page.getByText(UPDATED, { exact: true }).count() === 1, '“Updated” went on a timer (K8-03)');
        const snap = await t.checkpoint('updated-home');
        await t.check(walksIn(snap).size === 1, `the walk is saved ${walksIn(snap).size} times`);
        await ui.tap(ui.button(main, 'Dismiss'));
        await t.check(await page.getByText(UPDATED, { exact: true }).count() === 0, 'Dismiss left “Updated” on Home');
      });
    },
  },
  {
    name: 'a typed form away from Home, and a profile chapter being edited: nothing reloads under them, however they close or the phone locks',
    preview: true,
    async run(t) {
      const page = await t.open({ seed: persona('P01'), route: '/home', updates: true, visibility: true });
      const reading = form => form.getByRole('textbox', { name: 'Reading', exact: true });
      const stored = snap => (snap.observations ?? []).filter(o => o.kind === 'glucose' && [118, 119, 121, 124, 130].includes(o.value)).map(o => o.value);
      const nothingMoved = async how => {
        await page.waitForTimeout(1500);
        await t.check(await rec.loads(page) === 1, `${how}: the page reloaded`);
        await t.check(await restarts(page) === 0, `${how}: the page asked the new version to take over`);
      };

      await t.step(1, 'Browse → Glucose → Add reading → 118 typed; a new version installed; the phone locked and opened: nothing moves, and the answer stays', async () => {
        const form = await typedOnHub(page, '118');
        await rec.offerUpdate(page);
        await lockAndReturn(page);
        await nothingMoved('with the form open');
        await t.check(await reading(form).inputValue() === '118', `the typed answer is now “${await reading(form).inputValue()}”`);
        await t.checkpoint('form-open-update-waiting');
      }, { input: 'Glucose 118 typed, not saved' });

      await t.step(2, 'Closed with Close, with Escape and with a swipe down: nothing moves', async () => {
        let form = page.getByRole('dialog', { name: 'Glucose' });
        await ui.tap(ui.button(form, 'Close'));
        await form.waitFor({ state: 'hidden' });
        await nothingMoved('closed with Close');
        form = await typedOnHub(page, '119');
        await page.keyboard.press('Escape');
        await form.waitFor({ state: 'hidden' });
        await nothingMoved('closed with Escape');
        form = await typedOnHub(page, '121');
        await rec.dragSheetDown(page, form);
        await form.waitFor({ state: 'hidden', timeout: 5000 });
        await nothingMoved('closed with a swipe');
      }, { input: '119 and 121 typed, each closed unsaved' });

      await t.step(3, 'Saved: the one reading stored, and nothing moves', async () => {
        const form = await typedOnHub(page, '124');
        await t.must(await data.saveForm(t, form) === 'closed', 'the reading did not save');
        await nothingMoved('after Save');
        const snap = await t.checkpoint('saved-on-hub');
        await t.check(stored(snap).join(',') === '124', `stored: ${stored(snap).join(', ')}`);
      }, { input: 'Glucose 124 saved' });

      await t.step(4, 'Left by the browser’s Back with an answer typed: Browse, and nothing moves', async () => {
        const form = await typedOnHub(page, '130');
        await page.goBack();
        await form.waitFor({ state: 'hidden', timeout: 10000 });
        await ui.heading(page, 'Browse');
        await nothingMoved('left by Back');
      }, { input: '130 typed, then Back' });

      await t.step(5, 'Home: Restart offered; left untapped, with the phone locked and opened, nothing reloads (K8-10)', async () => {
        await ui.tap(homeTab(page));
        await restart(page).waitFor({ timeout: 10000 });
        await lockAndReturn(page);
        await nothingMoved('Restart left untapped');
        await t.checkpoint('restart-offered');
      });

      // Plan 5's chapters replaced the profile's edit cover: each chapter's Edit opens its own page, whose answers
      // change before its one Save. Reached within the running app: a reload is what this case proves never happens.
      await t.step(6, 'Me → Profile & health → a chapter’s Edit: an answer changed on its page, the phone locked and opened: nothing reloads, and the answer stays (K8-02)', async () => {
        await t.hash('/me/profile');
        await ui.heading(page, 'Profile & health');
        await ui.tap(page.getByRole('main').getByRole('link', { name: /^Edit / }).first());
        await page.waitForFunction(() => location.hash.includes('chapter='), null, { timeout: 10000 });
        const box = page.getByRole('main').getByRole('textbox').first();
        await ui.type(box, '7');
        const typed = await box.inputValue();
        await lockAndReturn(page);
        await nothingMoved('with a profile chapter’s answer changed');
        await t.check(await box.inputValue() === typed, `the chapter’s answer is now “${await box.inputValue()}”, not “${typed}”`);
        await t.checkpoint('profile-cover-held');
      }, { input: 'A profile answer changed, not saved' });
    },
  },
  {
    name: 'another window open: Home says to close it, and Restart only once this is the only one',
    preview: true,
    async run(t) {
      const page = await t.open({ seed: persona('P01'), route: '/home', updates: true, visibility: true });
      const main = page.getByRole('main');

      await t.step(1, 'A new version, with FitStrong open in another window: Close FitStrong’s other windows, and no Restart', async () => {
        await rec.setWindows(page, 2);
        await rec.offerUpdate(page);
        await main.getByText(CLOSE_OTHERS, { exact: true }).waitFor({ timeout: 10000 });
        await t.check((await rec.updateLine(page))?.text.startsWith(READY), 'the update line does not say an update is ready');
        await t.check(await restart(page).count() === 0, 'Restart is offered with another window open');
        await t.checkpoint('other-window');
      });

      await t.step(2, 'The other window closed, and back to the app: Restart', async () => {
        await rec.setWindows(page, 1);
        await lockAndReturn(page);
        await restart(page).waitFor({ timeout: 10000 });
        await t.check(await main.getByText(CLOSE_OTHERS, { exact: true }).count() === 0, 'Home still asks for other windows to close');
      });

      await t.step(3, 'Another window opened just before the tap: the worker says so, nothing reloads, and Home asks for it to be closed', async () => {
        await rec.setWindows(page, 2);
        await ui.tap(restart(page));
        await main.getByText(CLOSE_OTHERS, { exact: true }).waitFor({ timeout: 10000 });
        await page.waitForTimeout(1000);
        await t.check(await rec.loads(page) === 1, 'the page reloaded with another window open');
        await t.check(await restarts(page) === 1, `the page asked to restart ${await restarts(page)} times`);
        await t.check(await restart(page).count() === 0, 'Restart is still offered with another window open');
      });

      await t.step(4, 'A slow worker, and Restart tapped: “Restarting to update…” covers the app, real taps and keys under it do nothing, and when another window opens before it answers, the cover goes with nothing written (P8S-13)', async () => {
        await rec.setWindows(page, 1);
        await lockAndReturn(page);
        await restart(page).waitFor({ timeout: 10000 });
        await rec.setRestartDelay(page, 1500);
        const before = await t.checkpoint('before-slow-restart');
        await ui.tap(restart(page));
        const cover = page.getByRole('alertdialog', { name: RESTARTING });
        await cover.waitFor({ timeout: 5000 });
        // Real taps where the Browse tab is, and the keyboard: the cover takes them all.
        const browse = await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Browse' }).boundingBox();
        await page.mouse.click(browse.x + browse.width / 2, browse.y + browse.height / 2);
        await page.keyboard.press('Tab');
        await page.keyboard.press('Enter');
        await t.check(await page.evaluate(() => location.hash) === '#/home', 'a tap under the cover left Home');
        // Another window opens before the worker answers: it says no.
        await rec.setWindows(page, 2);
        await cover.waitFor({ state: 'hidden', timeout: 10000 });
        await main.getByText(CLOSE_OTHERS, { exact: true }).waitFor({ timeout: 10000 });
        await t.check(await rec.loads(page) === 1, 'the page reloaded though the worker said no');
        const diffs = data.sameSnapshot(before, await t.checkpoint('after-slow-restart'));
        await t.check(diffs.length === 0, `something was written under the cover: ${diffs.slice(0, 3).join(' | ')}`);
      });
    },
  },
  {
    name: 'a newer copy takes the database: this one says so and saves nothing; its upgrade given up, FitStrong opened again finds it where it was',
    async run(t) {
      const page = await t.open({ seed: persona('P01'), route: '/home' });
      let before;
      let saw = '';

      await t.step(1, 'Water 250 ml saved, at this build’s database version', async () => {
        await data.logWater(t, 250);
        before = await t.checkpoint('before-newer');
      });

      // One step for the whole wait (see "Reading the database while a newer tab is open").
      await t.step(2, 'A newer copy opens the database one version up, and gives the upgrade up as it begins: this one lets go at once, and says so in true words', async () => {
        const newer = await rec.newerTab(t, before.version + 1);
        try {
          await page.bringToFront();
          await page.getByText(STALE_TITLE).first().waitFor({ timeout: 15000 });
          await t.check(await page.getByText(STALE, { exact: false }).count() >= 1, 'the words don’t say to close this window and open FitStrong again');
          saw = (await newer.seen()).join(',');
        } finally {
          await newer.page.close();
        }
        await t.check(saw === 'upgrade,aborted', `the newer copy saw ${saw}`);
      });

      // Storage lost while the app runs keeps every screen, read-only, under the notice (D107, Codex P8S-04): only a
      // first open that can't reach the records shows the storage screen and its Try again. So the person does as
      // the notice says, and opens FitStrong again: the same fresh start that Try again is.
      await t.step(3, 'FitStrong opened again, as the notice says: one reload, the database where it was, every record kept, and a new entry saves', async () => {
        const reloaded = page.waitForEvent('load', { timeout: 20000 });
        await page.reload();
        await reloaded;
        await t.ready();
        const snap = await t.checkpoint('after-try-again');
        await t.check(snap.version === before.version, `the database is at version ${snap.version}, not ${before.version}`);
        const lost = keptOnce(before, snap);
        await t.check(lost.length === 0, `records not kept once: ${lost.slice(0, 5).join('; ')}`);
        await data.logWater(t, 250);
        await data.waitDb(t, s => (s.observations ?? []).filter(o => o.kind === 'water').length === 2, 'the second entry was not saved after Try again');
      });
    },
  },
  {
    name: 'two real releases: the new one waits while a second window is open, and applies the next time FitStrong opens',
    releases: true,
    async run(t, { releases }) {
      releases.use('A');
      const page = await t.open({ seed: persona('P01'), route: '/home', ...WORKERS });
      let before;
      let second;

      await t.step(1, 'Release A in charge of two windows', async () => {
        await rel.controlled(page);
        before = await t.checkpoint('release-a');
        second = await t.newPage();
        await second.goto(`${t.base}#/home`);
        await rel.controlled(second);
        await rel.mark(page);
        await rel.mark(second);
        await t.check(await rel.buildOf(page) === releases.build('A'), 'the first window doesn’t run release A');
      });

      await t.step(2, 'Release B deployed: it installs whole and waits; both windows say so, with Close FitStrong’s other windows, and neither reloads', async () => {
        releases.use('B');
        await t.must(await rel.installNext(page) === 'installed', 'release B did not install');
        for (const w of [page, second]) {
          await w.bringToFront();
          await w.getByText(CLOSE_OTHERS, { exact: true }).waitFor({ timeout: 20000 });
          await t.check(await restart(w).count() === 0, 'Restart is offered with another window open');
        }
        await page.waitForTimeout(3000);
        await t.check(await rel.hasWaiting(page), 'release B took over with a window of release A open');
        await t.check(await rel.sameDocument(page) && await rel.sameDocument(second), 'a window reloaded for a release that is waiting');
        await t.checkpoint('b-waiting', { page });
      });

      await t.step(3, 'Both windows closed, and FitStrong opened again: release B, its migration run at its start, every record kept once, and Updated on Home', async () => {
        await second.close();
        await page.goto('about:blank');
        await page.goto(`${t.base}#/home`);
        await t.ready();
        await t.check(await rel.buildOf(page) === releases.build('B'), 'FitStrong opened again isn’t release B');
        await t.check(JSON.stringify(await appCaches(page)) === JSON.stringify([releases.cache('B')]), `the caches left are ${JSON.stringify(await appCaches(page))}`);
        const snap = await t.checkpoint('release-b');
        await t.check(snap.version === before.version + 1, `the database is at version ${snap.version}, not ${before.version + 1}`);
        await t.check(docs(snap).schemaVersion === docs(before).schemaVersion + 1, `the schema is ${docs(snap).schemaVersion}`);
        const lost = keptOnce(before, snap);
        await t.check(lost.length === 0, `records not kept once: ${lost.slice(0, 5).join('; ')}`);
        await page.getByText(UPDATED, { exact: true }).waitFor({ timeout: 20000 });
      });
    },
  },
  {
    name: 'two real releases: FitStrong’s only window restarts onto the new one from Home, once its walk is saved',
    releases: true,
    async run(t, { releases }) {
      releases.use('A');
      const page = await t.open({ seed: persona('P03'), route: '/home', ...WORKERS });
      const main = page.getByRole('main');
      let before;
      let started;

      await t.step(1, 'Release A in charge; a walk under way', async () => {
        await rel.controlled(page);
        before = await t.checkpoint('release-a');
        await walk.openSetup(t);
        await walk.start(t, ui.normalAnswers('P03'));
        // The walk's own start, its check-in's readings among them: what the update must keep once.
        started = await t.checkpoint('walk-started');
        await rel.mark(page);
      });

      await t.step(2, 'Release B deployed: it installs and waits; the walk carries on; Home mid-walk names the update, with no Restart', async () => {
        releases.use('B');
        await t.must(await rel.installNext(page) === 'installed', 'release B did not install');
        await walk.elapse(t, MINUTE);
        await t.check(await rel.hasWaiting(page), 'release B took over during the walk');
        await t.check(await rel.sameDocument(page), 'the walking window reloaded during the walk');
        await t.goto('/home');
        await t.ready();
        await main.getByText(READY, { exact: true }).waitFor({ timeout: 20000 });
        await t.check(await restart(page).count() === 0, 'Restart is offered while the walk is under way');
        await t.goto('/walk/live');
        await t.ready();
      }, { input: 'release B deployed mid-walk' });

      await t.step(3, 'The walk saved; Restart on Home: one reload onto release B, the database and schema one up, the walk once, every record kept, and Updated', async () => {
        await walk.finish(t);
        await ui.tap(ui.button(main, 'Save walk'));
        await page.getByText('Saved on this device', { exact: true }).waitFor({ timeout: 10000 });
        await ui.tap(ui.button(main, 'Done'));
        await ui.tap(homeTab(page));
        await restart(page).waitFor({ timeout: 20000 });
        const reloaded = page.waitForEvent('load', { timeout: 30000 });
        await ui.tap(restart(page));
        await reloaded;
        await t.ready();
        await t.check(!(await rel.sameDocument(page)), 'Restart didn’t reload the window');
        await t.check(await rel.buildOf(page) === releases.build('B'), 'the window isn’t on release B after Restart');
        const snap = await t.checkpoint('release-b');
        await t.check(snap.version === before.version + 1, `the database is at version ${snap.version}`);
        await t.check(docs(snap).schemaVersion === docs(before).schemaVersion + 1, `the schema is ${docs(snap).schemaVersion}`);
        await t.check(walksIn(snap).size === 1, `the walk is saved ${walksIn(snap).size} times`);
        const lost = keptOnce(started, snap);
        await t.check(lost.length === 0, `records not kept once: ${lost.slice(0, 5).join('; ')}`);
        await page.getByText(UPDATED, { exact: true }).waitFor({ timeout: 20000 });
      });
    },
  },
  {
    name: 'two real releases: one that fails to install changes nothing, and the release in use works whole, offline too',
    releases: true,
    async run(t, { releases }) {
      releases.use('A');
      releases.broken('A', 'A2');
      const page = await t.open({ seed: persona('P01'), route: '/home', ...WORKERS });

      await t.step(1, 'Release A, its worker in charge', async () => {
        await rel.controlled(page);
        await rel.mark(page);
      });

      await t.step(2, 'A release with a file missing: its install fails, its cache goes, nothing is offered, and nothing reloads', async () => {
        releases.use('A2');
        await t.must(await rel.installNext(page) === 'redundant', 'a release with a missing file installed');
        await page.waitForTimeout(1500);
        await t.check(!(await rel.hasWaiting(page)), 'a broken release waits to take over');
        await t.check(!(await rel.cacheNames(page)).includes(releases.cache('A2')), 'the failed install left its cache behind (D120)');
        await t.check(await rel.sameDocument(page), 'the page reloaded for a release that never installed');
        await t.check(await rec.updateLine(page) === undefined, 'Home offers an update that never installed');
      });

      await t.step(3, 'Offline, release A opens a screen it hadn’t loaded, and saves', async () => {
        await t.context.setOffline(true);
        try {
          await t.goto('/me/data');
          await ui.heading(page, 'Data');
          await t.checkpoint('offline-unloaded-screen');
          await t.goto('/day/today');
          await data.logWater(t, 250);
          await data.waitDb(t, s => (s.observations ?? []).some(o => o.kind === 'water' && o.value === 250), 'release A could not save offline');
        } finally {
          await t.context.setOffline(false);
        }
        await t.check(await rel.buildOf(page) === releases.build('A'), 'the window left release A');
      });
    },
  },
  {
    name: 'two real releases: a window keeps its own release, its shell and unloaded screens, after a newer one installs, offline too',
    releases: true,
    async run(t, { releases }) {
      releases.use('A');
      const page = await t.open({ seed: persona('P03'), route: '/home', ...WORKERS });
      const main = page.getByRole('main');
      const entry = () => page.evaluate(() => document.querySelector('script[type="module"][src]')?.getAttribute('src'));

      await t.step(1, 'Release A in charge; a walk under way', async () => {
        await rel.controlled(page);
        await walk.openSetup(t);
        await walk.start(t, ui.normalAnswers('P03'));
      });

      await t.step(2, 'Release B, its files under names their own bytes give, installs and waits beside A', async () => {
        releases.use('B');
        await t.must(await rel.installNext(page) === 'installed', 'release B did not install');
        await t.check(await rel.hasWaiting(page), 'release B took over during the walk');
        const caches = (await appCaches(page)).sort();
        await t.check(JSON.stringify(caches) === JSON.stringify([releases.cache('A'), releases.cache('B')].sort()), `the caches are ${JSON.stringify(caches)}`);
      });

      await t.step(3, 'Offline: the walk’s summary, never loaded, opens from release A, the walk saves, and a reload brings release A’s own shell (P8R-10, P8R-12)', async () => {
        await t.context.setOffline(true);
        try {
          await walk.finish(t);
          await ui.tap(ui.button(main, 'Save walk'));
          await page.getByText('Saved on this device', { exact: true }).waitFor({ timeout: 10000 });
          await ui.tap(ui.button(main, 'Done'));
          await t.checkpoint('summary-offline');
          await t.reload();
          await t.ready();
          await t.check(await entry() === releases.entry('A'), `a reload brought another release’s shell: ${await entry()}`);
          await t.check(await rel.buildOf(page) === releases.build('A'), 'the window left release A');
        } finally {
          await t.context.setOffline(false);
        }
      });
    },
  },
  {
    name: 'two real releases: a first visit, taken over by its release’s first worker, holds a later release back while its walk goes on (P8S-11)',
    releases: true,
    async run(t, { releases }) {
      releases.use('A');
      // Release A's worker held back, as a slow line would, so the first visit is still its own when its walk
      // begins: served at once, a worker installs and takes the page over before the case's first look.
      releases.holdWorker();
      try {
        await firstVisit(t, releases);
      } finally {
        releases.releaseWorker();
      }
    },
  },
  {
    name: 'storage lost while FitStrong runs: every screen stays, read-only; a form keeps its answer, a low saved then still guides, and nothing is written (P8S-04)',
    async run(t) {
      const page = await t.open({ seed: persona('P03'), route: '/home' });
      const reading = form => form.getByRole('textbox', { name: 'Reading', exact: true });
      let before;
      let form;

      await t.step(1, 'Browse → Glucose → Add reading, 118 typed, not saved', async () => {
        before = await t.checkpoint('before-loss');
        form = await typedOnHub(page, '118');
      }, { input: 'Glucose 118 typed, not saved' });

      // One step for the whole wait (see "Reading the database while a newer tab is open").
      await t.step(2, 'A newer copy upgrades the database under it: the form, its answer and the screen stay, and the notice names the newer copy', async () => {
        const newer = await rec.newerTab(t, before.version + 1, { abort: false });
        try {
          await page.bringToFront();
          await page.getByText(STALE_TITLE).first().waitFor({ timeout: 15000 });
          await t.check(await form.isVisible(), 'the form went when the storage did');
          await t.check(await reading(form).inputValue() === '118', `the typed answer is now “${await reading(form).inputValue()}”`);
          // The tab bar is still drawn under the open form, which hides it from a screen reader while it is open.
          await t.check(await page.locator('nav[aria-label="Main"]').count() === 1, 'the app gave way to a storage screen');
        } finally {
          await newer.page.close();
        }
      });

      await t.step(3, 'The answer made 52 and saved: the low’s guidance and the safety surface, with no “Saved”, and nothing written', async () => {
        await ui.type(reading(form), '52');
        await t.must(await data.saveForm(t, form) === 'guidance', 'a reading of 52 showed no guidance');
        const guidance = page.getByRole('dialog', { name: /^(Saved|What to do)$/ });
        await t.check(await guidance.getByText(/Saved on this device/).count() === 0, 'the guidance says the reading was saved where nothing is saved');
        await t.check(await page.locator('[data-urgent-kind]').count() >= 1, 'the low isn’t on the safety surface');
        const snap = await t.checkpoint('read-only-low');
        await t.check(!(snap.observations ?? []).some(o => o.kind === 'glucose' && o.value === 52), 'the 52 was written from a read-only window');
        const diffs = data.sameSnapshot(before, snap);
        await t.check(diffs.length === 0, `the record changed: ${diffs.slice(0, 3).join(' | ')}`);
      }, { input: 'Glucose 52, saved in a read-only window' });
    },
  },
];

/** V-J38's ninth case, its worker held back by the case until step 2. */
async function firstVisit(t, releases) {
  const page = await t.open({ seed: persona('P03'), route: '/home', ...WORKERS });
  let before;

  await t.step(1, 'A first visit, which no worker controls yet, starts a walk at once', async () => {
    await t.check(!(await page.evaluate(() => !!navigator.serviceWorker.controller)), 'a worker controlled the first visit before any had installed');
    await rel.mark(page);
    await walk.openSetup(t);
    await walk.start(t, ui.normalAnswers('P03'));
    before = await t.checkpoint('first-visit-walking');
  }, { input: 'a walk started on a first visit' });

  await t.step(2, 'Release A’s first worker takes the page over, with no reload, the walk under way', async () => {
    releases.releaseWorker();
    await rel.controlled(page);
    await t.check(await rel.sameDocument(page), 'the first visit reloaded when its worker took it over');
    await t.check(await rel.buildOf(page) === releases.build('A'), 'the page doesn’t run release A');
  });

  await t.step(3, 'Release B deployed: it installs and waits behind the walking window; a new window opens on release A, the database untouched', async () => {
    releases.use('B');
    await t.must(await rel.installNext(page) === 'installed', 'release B did not install');
    await walk.elapse(t, MINUTE);
    await t.check(await rel.hasWaiting(page), 'release B took over with the first visit open');
    const second = await t.newPage();
    try {
      await second.goto(`${t.base}#/home`);
      await rel.controlled(second);
      await t.check(await rel.buildOf(second) === releases.build('A'), 'the new window opened on release B while release A’s walk went on');
      const snap = await t.checkpoint('second-window', { page: second });
      await t.check(snap.version === before.version, `the database moved to version ${snap.version} under the walk`);
    } finally {
      await second.close();
    }
  });

  await t.step(4, 'The walk carries on, and saves once, on release A', async () => {
    await t.check(await rel.sameDocument(page), 'the walking window reloaded');
    await walk.finish(t);
    await ui.tap(ui.button(page.getByRole('main'), 'Save walk'));
    await page.getByText('Saved on this device', { exact: true }).waitFor({ timeout: 10000 });
    const snap = await t.checkpoint('walk-saved');
    await t.check(walksIn(snap).size === 1, `the walk is saved ${walksIn(snap).size} times`);
    await t.check(snap.version === before.version, `the database is at version ${snap.version}`);
  });
}
