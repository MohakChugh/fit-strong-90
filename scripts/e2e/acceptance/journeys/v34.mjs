/**
 * V-J34, P02: a crash while a walk and its route are being saved
 * (journey §17.2 #34; §9.4, §18.3, A-55; B-05, B-23; Review Focus 2). The
 * save fails as one transaction, the app closes, and Home's row saves the
 * walk once: no duplicate, no orphan. Then "Erase all routes" leaves no
 * coordinate anywhere. Synthetic persona only; map tiles are answered
 * locally, so the suite never depends on OpenStreetMap.
 */
import { MINUTE } from '../lib/env.mjs';
import { persona } from '../fixtures/personas.mjs';
import * as ui from '../lib/ui.mjs';
import * as walk from '../lib/walk.mjs';

export const id = 'V34';
export const title = 'A crash while saving a route, and erasing every route';
export const safety = false;

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

async function walkNorth(t, from, to, seconds) {
  const steps = seconds / 10;
  await walk.emit(t.page, from, 0);
  for (let i = 1; i <= steps; i++) {
    await t.advance(10_000);
    await walk.emit(t.page, from + ((to - from) * i) / steps, 0);
  }
}

export const cases = [{
  name: 'saved once after a crash, then erased',
  async run(t) {
    let page = await t.open({ seed: persona('P02'), route: '', sensors: { geo: 'grant', monotonic: 'wall' } });
    // The map pictures this phone says Yes to below (B-23, D91): the one kind of request allowed off the device.
    t.allowRequests(/^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/);
    const tiles = [];
    await t.context.route('https://tile.openstreetmap.org/**', route => {
      tiles.push({ url: route.request().url(), referer: route.request().headers().referer ?? '' });
      return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    });
    let id;

    await t.step(1, 'A first walk keeping its route, with map pictures on: three minutes', async () => {
      await walk.openSetup(t);
      await walk.emit(page, 0, 0);
      await ui.tap(walk.gpsSwitch(page));
      await page.waitForFunction(() => document.querySelector('[role="switch"][aria-checked="true"]') !== null, null, { timeout: 5000 });
      await walk.start(t, ui.normalAnswers('P02'), { keep: true, map: true });
      await walkNorth(t, 0, 0.002, 180);
      id = (await walk.stored(page))?.id;
      await t.check(tiles.length === 0, `a map picture was requested during the live walk (D18): ${tiles.length}`);
    });

    await t.step(2, 'Finish: the route drawn, with only the view’s tiles under it and the credit shown', async () => {
      await walk.finish(t);
      await page.waitForTimeout(1000);
      await t.check(await walk.drawnLines(page, 'Your route') === 1, 'the summary does not draw the route');
      await t.check(tiles.length > 0 && tiles.length <= 9 && tiles.every(x => /^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/.test(x.url)), `tiles: ${JSON.stringify(tiles.map(x => x.url))}`);
      const origin = new URL(t.base).origin;
      await t.check(tiles.every(x => x.referer.startsWith(origin)), `a tile went without the page’s Referer (B-23): ${JSON.stringify(tiles.map(x => x.referer))}`);
      const credit = page.getByRole('link', { name: '© OpenStreetMap contributors', exact: true });
      await t.check(await credit.count() === 1 && (await credit.getAttribute('href')) === 'https://www.openstreetmap.org/copyright', 'the map has no visible credit link');
      await t.checkpoint('summary-with-map');
    });

    await t.step(3, 'Save, and the save fails part-way: nothing half-written, the journal keeps the walk', async () => {
      t.allowConsole(/acceptance-injected/);
      await t.setPageFaults([{ op: 'put', store: 'routes', action: 'abortAfterQueue', times: 1 }]);
      await ui.tap(ui.button(page.getByRole('main'), 'Save walk'));
      await page.getByText('This walk did not save.', { exact: false }).waitFor({ timeout: 10000 });
      const snap = await t.db();
      await t.check(walk.walkObservations(snap).length === 0 && walk.routesIn(snap).length === 0, 'part of the walk was written');
      const kept = walk.journalsIn(snap);
      await t.check(kept.length === 1 && kept[0].id === id && (kept[0].route?.length ?? 0) === 1, `the journal does not keep the walk and its route: ${JSON.stringify(kept.map(e => [e.id, e.route?.length]))}`);
    }, { input: 'fault: abort the save transaction at the route’s write, once' });

    await t.step(4, 'The app closes; three minutes later Home offers the walk', async () => {
      await t.advance(3 * MINUTE);
      await page.close();
      page = t.page = await t.newPage();
      await page.goto(`${t.base}#/home`, { waitUntil: 'domcontentloaded' });
      await t.ready();
      await t.must(await page.getByText('Your walk today was interrupted at 3 min. Save it?', { exact: true }).count() === 1, `Home does not offer the walk: ${(await page.getByRole('main').innerText()).slice(0, 300)}`);
      await t.checkpoint('home-recovery-row');
    });

    await t.step(5, 'Save, tapped twice: one walk, one route, no journal left', async () => {
      const save = ui.button(page.getByRole('main'), 'Save');
      await save.click();
      await save.click({ timeout: 1000 }).catch(() => {});
      await page.getByText('Walk saved.', { exact: true }).waitFor({ timeout: 10000 });
      const snap = await t.db();
      const obs = walk.walkObservations(snap);
      await t.check(obs.length > 0 && new Set(obs.map(o => o.id)).size === obs.length && obs.every(o => o.context === `walk:${id}`), `the walk’s records: ${JSON.stringify(obs.map(o => o.id))}`);
      const routes = walk.routesIn(snap);
      await t.check(routes.length === 1 && routes[0].walkId === id, `routes: ${JSON.stringify(routes.map(r => r.walkId))}`);
      await t.check(walk.journalsIn(snap).length === 0, 'a journal is left after the save');
      await t.reload();
      await t.check(await page.getByText(/was interrupted at/).count() === 0, 'Home still offers the saved walk');
      await t.goto('/day/today');
      await t.check(await page.getByRole('main').getByRole('link', { name: /walk/i }).count() === 1, 'Today’s log does not list the walk once');
    });

    await t.step(6, 'Me → Data → Erase all routes: the walk stays, and no coordinate is left anywhere (B-05)', async () => {
      await t.goto('/me/data');
      const main = page.getByRole('main');
      await ui.tap(ui.row(main, 'Erase all routes'));
      const sheet = page.getByRole('dialog', { name: 'Erase all routes?' });
      await sheet.waitFor();
      await ui.tap(ui.button(sheet, 'Erase routes'));
      await page.waitForTimeout(600);
      const snap = await t.db();
      await t.check(walk.routesIn(snap).length === 0 && walk.walkObservations(snap).length > 0, 'the routes or the walk are wrong after erasing');
      const leaks = [...walk.positionsIn(snap, 'db'), ...walk.positionsIn(await t.storage(), 'web')];
      await t.check(!leaks.length, `coordinates left after erasing: ${leaks.slice(0, 6).join(', ')}`);
      await t.checkpoint('routes-erased');
    });
  },
}];
