/**
 * V-J16, P02: offline (journey §17.1 #16; §9.4, M14, B-23), on the production
 * build with its service worker. After one online visit every hub and Trends
 * opens offline; a check-in and a walk on the plain grid are recorded and
 * saved; and only map pictures, and a voice never downloaded, say they need a
 * connection. Synthetic persona only; map tiles are answered locally.
 */
import { persona } from '../fixtures/personas.mjs';
import * as ui from '../lib/ui.mjs';
import * as walk from '../lib/walk.mjs';

export const id = 'V16';
export const title = 'Offline: every hub, Trends, a check-in and a walk';
export const safety = false;
export const needs = ['preview'];

const HUBS = ['workout', 'stretch', 'walk', 'steps', 'food', 'glucose', 'bp', 'back', 'weight', 'water', 'sleep', 'waist', 'labs', 'learn'];
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const failed = async page => (await page.getByText('This screen didn’t load', { exact: true }).count()) > 0;

/** Record CSP violations, which a meta-tag policy reports as events. */
function cspInit() {
  window.__acc = window.__acc || {};
  window.__acc.csp = [];
  document.addEventListener('securitypolicyviolation', e => window.__acc.csp.push(`${e.violatedDirective} ${e.blockedURI}`));
}

async function walkNorth(t, from, to, seconds) {
  const steps = seconds / 10;
  await walk.emit(t.page, from, 0);
  for (let i = 1; i <= steps; i++) {
    await t.advance(10_000);
    await walk.emit(t.page, from + ((to - from) * i) / steps, 0);
  }
}

export const cases = [{
  name: 'offline after one online visit (production build)',
  preview: true,
  async run(t) {
    // The voice on, so a voice never downloaded says it needs a connection.
    const seed = persona('P02', { patch: { profile: { voice: { muted: false } } } });
    const page = await t.open({ seed, route: '/home', sensors: { geo: 'grant', monotonic: 'wall' }, contextOptions: { serviceWorkers: 'allow' } });
    await t.context.addInitScript(cspInit);
    await t.reload();
    // The map pictures this phone says Yes to below (B-23, D91): the one kind of request allowed off the device.
    t.allowRequests(/^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/);
    const tiles = [];
    await t.context.route('https://tile.openstreetmap.org/**', route => {
      tiles.push(route.request().url());
      return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    });
    const main = page.getByRole('main');

    await t.step(1, 'Online once: the service worker takes the page; every hub and Trends is visited', async () => {
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 20000 }).catch(() => {});
      if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) await t.reload();
      await t.must(await page.evaluate(() => !!navigator.serviceWorker.controller), 'the service worker never took control of the page');
      for (const route of [...HUBS.map(h => `/hub/${h}`), '/trends', '/me/data', '/home']) {
        await t.hash(route);
        await page.waitForTimeout(500);
      }
    });

    await t.step(2, 'Offline: every hub and Trends opens', async () => {
      await t.context.setOffline(true);
      await t.reload();
      // Playwright's offline emulation survives a reload for requests, but the reloaded page reads navigator.onLine as true until it is set again.
      await t.context.setOffline(false);
      await t.context.setOffline(true);
      await t.check(await page.evaluate(() => navigator.onLine) === false, 'the page does not know it is offline');
      for (const route of [...HUBS.map(h => `/hub/${h}`), '/trends']) {
        await t.hash(route);
        await page.waitForTimeout(600);
        const h1 = (await page.getByRole('heading', { level: 1 }).allInnerTexts()).join(' | ');
        // A hub may open on its first-use sheet (Food asks "Your food"), its title behind it: open all the same.
        const dialog = page.getByRole('dialog').first();
        const sheet = (await page.getByRole('dialog').count()) ? await dialog.locator('h2').first().innerText({ timeout: 2000 }).catch(() => '') : '';
        const shown = h1 || sheet;
        await t.check(!(await failed(page)) && shown.length > 0, `offline ${route} shows “${shown}”${await failed(page) ? ' (the screen did not load)' : ''}`);
        if (sheet && !h1) await ui.tap(ui.button(dialog, 'Close'));
      }
      await t.checkpoint('offline-hubs');
    });

    await t.step(3, 'Offline: check in, and walk with location on the plain grid', async () => {
      await t.hash('/hub/walk');
      await ui.heading(page, 'Walk');
      await walk.emit(page, 0, 0);
      await ui.tap(walk.gpsSwitch(page));
      await page.waitForFunction(() => document.querySelector('[role="switch"][aria-checked="true"]') !== null, null, { timeout: 5000 });
      await walk.start(t, ui.normalAnswers('P02'), { keep: true, map: true });
      // The voice pack was never downloaded, so it says it needs a connection; a cached one plays.
      const cached = await page.evaluate(async () => !!(await caches.match(new URL('voice/af_heart/manifest.json', document.baseURI).href)));
      await page.waitForTimeout(1000);
      const text = (await main.innerText()).replace(/\s+/g, ' ');
      if (!cached) await t.check(/Voice cues need a connection\./.test(text), `the voice never downloaded doesn’t say it needs a connection: ${text.slice(0, 300)}`);
      else t.note('the voice manifest was cached, so its cues can play offline');
      await walkNorth(t, 0, 0.001, 60);
      await t.check(await walk.drawnLines(page) === 1 && tiles.length === 0, `offline, the walk is not drawn on the plain grid alone (${await walk.drawnLines(page)} lines, ${tiles.length} tiles)`);
      await t.checkpoint('offline-walk');
    });

    await t.step(4, 'Offline: finish and save; the route drawn, map pictures said to need a connection', async () => {
      await walk.finish(t);
      await page.waitForTimeout(800);
      const summary = (await main.innerText()).replace(/\s+/g, ' ');
      await t.check(/Map pictures unavailable\. Needs a connection\./.test(summary), `the summary does not say map pictures need a connection: ${summary.slice(0, 300)}`);
      await t.check(await walk.drawnLines(page, 'Your route') === 1 && tiles.length === 0, 'offline, a map picture was asked for, or the route is not drawn');
      const snap = await walk.save(t);
      await t.check(walk.walkObservations(snap).length > 0 && walk.routesIn(snap).length === 1, 'the walk or its route was not saved offline');
      const violations = await page.evaluate(() => window.__acc.csp ?? []);
      await t.check(violations.length === 0, `CSP violations: ${violations.join('; ')}`);
    });

    await t.step(5, 'Back online: the saved walk’s detail shows its map pictures, credited', async () => {
      await t.context.setOffline(false);
      await t.goto('/day/today');
      await ui.tap(main.getByRole('link', { name: /walk/i }));
      await page.waitForTimeout(1000);
      await t.check(tiles.length > 0 && tiles.length <= 9, `online, the detail asked for ${tiles.length} tiles`);
      await t.check(await page.getByRole('link', { name: '© OpenStreetMap contributors', exact: true }).count() === 1, 'the map has no visible credit');
      await t.check(!/Needs a connection/.test(await main.innerText()), 'online, the detail still says it needs a connection');
    });
  },
}];
