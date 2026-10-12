/**
 * V-J38 (journey §17.2 #38, J§21.2, B-21; D106, D107, D120, D121): two real
 * releases served at one origin with their workers. One waiting while a
 * second window is open, and applying the next time FitStrong opens; a walk
 * holding the restart back, then Restart on Home; a release that fails to
 * install; a window keeping its own release's files, offline; and a first
 * visit taken over by its release's first worker. These are V-J38's fifth to
 * ninth cases, Task 2's worker's own, run as soon as Task 2 is in; Task 15
 * adds its other cases (an update during a walk on the driven worker, typed
 * forms, another window, a newer copy, storage lost while running).
 *
 * Until Task 3 reads VITE_ACCEPTANCE_SUCCESSOR, B is built from the same code
 * as A: its worker is numbered after A's, so it installs and waits and takes
 * over as a later release, but its bytes are A's, so its database and schema
 * stay where they were and Home has no new release to call "Updated". Those
 * checks are pending until the two releases differ, and then run as written.
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
const WORKERS = { contextOptions: { serviceWorkers: 'allow' } };
const walksIn = snap => new Set(walk.walkObservations(snap).filter(o => o.kind === 'walkDuration').map(o => o.context));
const homeTab = page => ui.link(page.getByRole('navigation', { name: 'Main' }), 'Home');
const restart = page => page.getByRole('main').getByRole('button', { name: 'Restart to update', exact: true });
const appCaches = async page => (await rel.cacheNames(page)).filter(n => n.startsWith('fitstrong-'));

/** B is the successor build (D121) once its bytes are a release of their own, which Task 3 makes them. */
const successorWaits = releases => releases.build('A') === releases.build('B');
const SUCCESSOR = 'Task 3’s successor build: B’s database and schema one up, and “Updated” on Home, wait until B is built from other bytes than A (VITE_ACCEPTANCE_SUCCESSOR)';

/** Every reading and session from before still there, and nothing added but the walk's: an update keeps each record once (P8-21). */
function keptOnce(before, after) {
  const was = new Set((before.observations ?? []).map(o => o.id));
  const now = after.observations ?? [];
  const gone = [...was].filter(id => !now.some(o => o.id === id));
  const extra = now.filter(o => !was.has(o.id) && !o.context?.startsWith('walk:'));
  const sessions = (after.sessions ?? []).length - (before.sessions ?? []).length;
  return [...gone.map(id => `${id} is gone`), ...extra.map(o => `${o.id} (${o.kind}) appeared`), ...(sessions ? [`${sessions} sessions more`] : [])];
}

export const cases = [
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
        const lost = keptOnce(before, snap);
        await t.check(lost.length === 0, `records not kept once: ${lost.slice(0, 5).join('; ')}`);
        if (successorWaits(releases)) t.pending(SUCCESSOR);
        else {
          await t.check(snap.version === before.version + 1, `the database is at version ${snap.version}, not ${before.version + 1}`);
          await t.check(docs(snap).schemaVersion === docs(before).schemaVersion + 1, `the schema is ${docs(snap).schemaVersion}`);
          await page.getByText(UPDATED, { exact: true }).waitFor({ timeout: 20000 });
        }
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
        await t.check(walksIn(snap).size === 1, `the walk is saved ${walksIn(snap).size} times`);
        const lost = keptOnce(started, snap);
        await t.check(lost.length === 0, `records not kept once: ${lost.slice(0, 5).join('; ')}`);
        if (successorWaits(releases)) t.pending(SUCCESSOR);
        else {
          await t.check(snap.version === before.version + 1, `the database is at version ${snap.version}`);
          await t.check(docs(snap).schemaVersion === docs(before).schemaVersion + 1, `the schema is ${docs(snap).schemaVersion}`);
          await page.getByText(UPDATED, { exact: true }).waitFor({ timeout: 20000 });
        }
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
      // Release A's worker held back, as a slow line would, so the first visit is still its own when its walk begins.
      releases.holdWorker();
      try {
        await firstVisit(t, releases);
      } finally {
        releases.releaseWorker();
      }
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
