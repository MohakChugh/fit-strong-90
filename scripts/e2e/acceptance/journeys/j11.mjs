/**
 * J11, P03: foreground coverage, background gap and reload
 * (codex-acceptance.md; basis D10, D18, D24; vision section 9).
 *
 * Positions come from the test geolocation, stamped with the page's frozen
 * clock, which moves only when the journey moves it. Visibility is the init
 * shim that changes `document.visibilityState` and fires `visibilitychange`.
 *
 * Fixes arrive every 10 s while walking. iOS delivers one about every second
 * on the move, and the app treats more than 20 s without a fix as lost signal
 * (`GPS.lostAfterMs` in src/walk/gps.ts, re-audit F15), so sparser fixtures
 * would test signal loss rather than walking. The one deliberate silence
 * longer than 20 s is the lost-signal case (step 8).
 */
import { MINUTE } from '../lib/env.mjs';
import { persona } from '../fixtures/personas.mjs';
import * as ui from '../lib/ui.mjs';
import * as walk from '../lib/walk.mjs';

export const id = 'J11';
export const title = 'Foreground coverage, background gap and reload';
export const safety = false;

const SECOND = 1000;
/** Time between fixes while walking: inside the 20 s lost-signal rule with room to spare. */
const STEP = 10 * SECOND;
const near = (got, want, tol) => typeof got === 'number' && Math.abs(got - want) <= tol;
/** A stored segment's GPS distance: its runs' sum (older builds kept one `distanceM`). */
const segDist = s => (typeof s?.distanceM === 'number' ? s.distanceM : (s?.gps ?? []).reduce((a, r) => a + r.distanceM, 0));
/** Runs of signal that measured something (two fixes at different times). */
const measured = s => (s?.gps ?? []).filter(r => r.end > r.start);

/** Setup: plain walk, GPS on (granted), steps off; check in; start. */
async function startGpsWalk(t) {
  const page = t.page;
  await walk.openSetup(t);
  // A first position exists, so asking for one is answered rather than timing out.
  await walk.emit(page, 0, 0);
  await ui.tap(walk.gpsSwitch(page));
  await page.waitForFunction(() => document.querySelector('[role="switch"][aria-checked="true"]') !== null, null, { timeout: 5000 });
  await t.check(await walk.stepsSwitch(page).getAttribute('aria-checked') === 'false', 'Count steps is on');
  await walk.start(t, ui.normalAnswers('P03'));
}

/**
 * Walk north along longitude 0: a fix now at `fromLat`, then one every 10 s
 * until `seconds` have passed, ending at `toLat`. Returns how many watchers
 * took the first fix.
 */
async function walkNorth(t, fromLat, toLat, seconds) {
  const page = t.page;
  const steps = seconds / (STEP / SECOND);
  const taken = await walk.emit(page, fromLat);
  for (let i = 1; i <= steps; i++) {
    await t.advance(STEP);
    await walk.emit(page, fromLat + ((toLat - fromLat) * i) / steps);
  }
  // Let the walk's own once-a-second tick store the last fix, in real time:
  // the wall clock stays where the last fix left it.
  await page.waitForTimeout(1300);
  return taken;
}

/** Seconds 0 to 120, latitude 0 to 0.001 on the equator (~111.2 m), a fix every 10 s. */
async function firstSegment(t) {
  await t.check(await walkNorth(t, 0, 0.001, 120) >= 1, 'no location watcher took the first fix');
}

/** Seconds 300 to 360, latitude 1 to 1.001 (~111.2 m), a fix every 10 s. */
const secondSegment = t => walkNorth(t, 1, 1.001, 60);

export const cases = [
  {
    name: 'hidden gap, continue walking',
    async run(t) {
      const page = await t.open({ seed: persona('P03'), route: '', sensors: { geo: 'grant' }, visibility: true, capabilities: { share: 'absent' } });
      const main = page.getByRole('main');
      let id0;

      await t.step(1, 'A permitted GPS walk: fixes at 0, 60 and 120 s', async () => {
        await startGpsWalk(t);
        await firstSegment(t);
        await t.check(await walk.timer(page) === '2:00', `after two observed minutes the timer reads ${await walk.timer(page)}`);
        const text = (await main.innerText()).replace(/\s+/g, ' ');
        await t.check(/GPS estimate|measured by GPS/i.test(text), `the GPS figures are not labelled as GPS estimates: ${text.slice(0, 300)}`);
        await t.check(!/exact|turn-by-turn|all day/i.test(text), 'the walk claims exact navigation or all-day walking');
        const live = await walk.stored(page);
        id0 = live?.id;
        await t.check(near(segDist(live?.segments?.[0]), 111.2, 3), `segment 1 distance ${segDist(live?.segments?.[0])} m, not about 111 m`);
        await t.checkpoint('gps-walk-2-minutes');
      }, { input: 'a fix every 10 s from 0 to 120 s, latitude 0 to 0.001, longitude 0, accuracy 3 m' });

      await t.step(2, 'Hidden at 120 s; +180 s; a far-away position while hidden', async () => {
        await t.check(await page.locator('canvas').count() === 0, 'a WebGL canvas is on screen while tracking');
        await t.check(await page.evaluate(() => window.__acc.setVisibility('hidden')) === 'hidden', 'the page did not become hidden');
        await page.waitForTimeout(200);
        await t.advance(180 * SECOND);
        const taken = await walk.emit(page, 0.5, 0.5);
        await t.check(taken === 0, `a location watcher was still running while hidden (${taken})`);
        const live = await walk.stored(page);
        const s0 = live?.segments?.[0];
        await t.check(live?.status === 'away' && s0?.end !== undefined && s0.end - s0.start === 120 * SECOND, `recording did not stop at 120 s: ${JSON.stringify({ status: live?.status, s0 })}`);
        await t.check(near(segDist(s0), 111.2, 3) && live.segments.length === 1, `the hidden position changed the walk: ${JSON.stringify(live?.segments)}`);
      }, { input: 'visibility hidden at 120 s; +180 s; fix (0.5,0.5) while hidden' });

      await t.step(3, 'Visible at 300 s, Continue walking; fixes at 300/330/360 s', async () => {
        await page.evaluate(() => window.__acc.setVisibility('visible'));
        await page.waitForTimeout(400);
        const text = (await main.innerText()).replace(/\s+/g, ' ');
        await t.check(/Recording paused while the app was away, for 3 min/.test(text), `no explicit gap notice on return: ${text.slice(0, 300)}`);
        await t.checkpoint('gap-notice');
        await ui.tap(ui.button(main, 'Continue walking'));
        await secondSegment(t);
        await t.check(await walk.timer(page) === '3:00', `the timer reads ${await walk.timer(page)}, not 3:00`);
        const live = await walk.stored(page);
        const total = (live?.segments ?? []).reduce((a, x) => a + segDist(x), 0);
        await t.check(live?.segments?.length === 2 && near(segDist(live.segments[1]), 111.2, 3), `segment 2 is not a separate ~111 m: ${JSON.stringify(live?.segments)}`);
        await t.check(total < 300, `the ~111 km between the gap’s ends was added (${Math.round(total)} m)`);
        await t.checkpoint('second-segment');
      }, { input: 'visible at 300 s; Continue walking; a fix every 10 s from 300 to 360 s, latitude 1 to 1.001' });

      await t.step(4, 'Finish and save without adding the away time', async () => {
        await walk.finish(t);
        const summary = (await main.innerText()).replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ');
        await t.checkpoint('summary');
        await t.check(/Time recorded 3:00/.test(summary), `the summary does not record 3:00: ${summary.slice(0, 200)}`);
        await t.check(/Not recorded .{0,80}?3 min/.test(summary), `the three unobserved minutes are not shown as not recorded: ${summary.slice(0, 400)}`);
        await t.check(/Distance .{0,140}?0\.22 km/.test(summary), `the distance is not about 0.22 km: ${summary.slice(0, 400)}`);
        const snap = await walk.save(t);
        const obs = walk.walkObservations(snap);
        const ctx = `walk:${id0}`;
        const by = k => obs.filter(o => o.kind === k).sort((a, b) => a.at.localeCompare(b.at));
        const dur = by('walkDuration');
        const mov = by('movementMinutes');
        const dist = by('walkDistance');
        await t.check(obs.every(o => o.context === ctx && o.source === 'measured' && o.scope === 'sessionObserved'), `walk observations are not all measured, session-observed, ${ctx}: ${obs.map(o => `${o.kind}/${o.source}/${o.context}`).join(', ')}`);
        await t.check(dur.length === 2 && dur.map(o => o.coverageMs).join() === '120000,60000' && dur.map(o => o.value).join() === '2,1', `walkDuration: ${JSON.stringify(dur.map(o => [o.value, o.coverageMs]))}`);
        await t.check(mov.length === 2 && mov.map(o => o.coverageMs).join() === '120000,60000', `movementMinutes: ${JSON.stringify(mov.map(o => [o.value, o.coverageMs]))}`);
        await t.check(dist.length === 2 && dist.every(o => near(o.value, 0.111, 0.003)) && near(dist.reduce((a, o) => a + o.value, 0), 0.222, 0.006),
          `walkDistance: ${JSON.stringify(dist.map(o => o.value))}`);
        await t.check(obs.length === 6, `${obs.length} walk observations, not 6`);
        await ui.tap(ui.button(main, 'Done'));
        await page.getByRole('heading', { level: 1, name: 'Today', exact: true }).waitFor();
        const today = (await main.innerText()).replace(/\s+/g, ' ');
        const week = today.match(/(\d+) min of movement recorded this week/);
        await t.check(week?.[1] === '3', `this week’s movement reads ${week?.[0] ?? today.slice(0, 160)}, not 3 min`);
      });

      await t.step(7, 'Reload; no position in any store, web storage or the backup', async () => {
        await t.reload();
        const snap = await t.db();
        const web = await t.storage();
        const leaks = [...walk.positionsIn(snap, 'db'), ...walk.positionsIn(web, 'web')];
        await t.check(!leaks.length, `positions stored: ${leaks.slice(0, 6).join(', ')}`);
        const backup = await walk.exportBackup(t);
        const inBackup = walk.positionsIn(backup.doc, 'backup');
        await t.check(!inBackup.length, `positions in the backup ${backup.name}: ${inBackup.slice(0, 6).join(', ')}`);
        const json = JSON.stringify(backup.doc);
        await t.check(!/0\.0005|1\.0005|"lat"|"lon"/.test(json), 'the backup holds the walk’s coordinates');
        await t.checkpoint('after-backup');
      });
    },
  },
  {
    name: 'reload while paused',
    async run(t) {
      const page = await t.open({ seed: persona('P03'), route: '', sensors: { geo: 'grant' }, visibility: true });
      const main = page.getByRole('main');

      await t.step(5, 'Pause after the first segment, reload, wait a minute, resume with a far-away fix', async () => {
        await startGpsWalk(t);
        await firstSegment(t);
        await ui.tap(ui.button(main, 'Pause'));
        await page.waitForTimeout(200);
        const before = await walk.stored(page);
        await t.reload();
        await t.checkpoint('after-reload-paused');
        await t.must((await t.route()).startsWith('/walk/live'), `after reload the walk is not open (${await t.route()})`);
        await t.advance(MINUTE);
        const resume = ui.button(main, 'Resume');
        await t.must(await resume.count() === 1, `no Resume after the reload: ${(await main.innerText()).slice(0, 200)}`);
        await ui.tap(resume);
        await walk.emit(page, 1, 0);
        await t.advance(10 * SECOND);
        const after = await walk.stored(page);
        await t.check(after?.id === before?.id, `the reload made a new walk (${before?.id} → ${after?.id})`);
        const s0 = after?.segments?.[0];
        await t.check(s0 && s0.end - s0.start === 120 * SECOND && near(segDist(s0), 111.2, 3), `the first segment changed: ${JSON.stringify(s0)}`);
        await t.check(after?.segments?.length === 2 && after.segments[1].start - s0.end >= MINUTE, `the reload interval became part of a segment: ${JSON.stringify(after?.segments)}`);
        await t.check(near(segDist(after?.segments?.[1]), 0, 0.5), `the far-away fix added distance (${segDist(after?.segments?.[1])} m)`);
        await t.check(await walk.timer(page) === '2:10', `the timer reads ${await walk.timer(page)}, not 2:10 (2:00 + 10 s)`);
        await t.checkpoint('resumed-after-reload');
        await walk.finish(t);
        const snap = await walk.save(t);
        const obs = walk.walkObservations(snap);
        const ids = new Set(obs.map(o => o.context));
        await t.check(ids.size === 1 && ids.has(`walk:${before?.id}`), `observations belong to ${[...ids].join(', ')}`);
        const dur = obs.filter(o => o.kind === 'walkDuration').map(o => o.coverageMs).sort((a, b) => b - a);
        await t.check(dur.join() === '120000,10000', `segment coverage ${dur.join()}, not 120000,10000`);
      }, { input: 'a fix every 10 s from 0 to 120 s; Pause; reload; +60 s; Resume; fix (1,0); +10 s' });
    },
  },
  {
    name: 'lost signal while visible',
    async run(t) {
      const page = await t.open({ seed: persona('P03'), route: '', sensors: { geo: 'grant' }, visibility: true });
      const main = page.getByRole('main');

      await t.step(8, 'A fix every 10 s for 60 s, 30 s of silence while visible, then fixes resume further on', async () => {
        await startGpsWalk(t);
        await t.check(await walkNorth(t, 0, 0.0005, 60) >= 1, 'no location watcher took the first fix');
        // 30 s with no fix at all and the page in front: the signal is lost, not the walk.
        await t.advance(25 * SECOND);
        const silent = (await main.innerText()).replace(/\s+/g, ' ');
        await t.check(/No GPS signal|Distance is not being measured/.test(silent), `25 s without a fix, the live walk does not say the signal is lost: ${silent.slice(0, 300)}`);
        await t.checkpoint('gps-signal-lost');
        await t.advance(5 * SECOND);
        // Fixes resume at 90 s, 55.6 m beyond the last one: the two ends of the silence say nothing about the route.
        await walkNorth(t, 0.001, 0.0013, 30);
        await t.check(await walk.timer(page) === '2:00', `the timer reads ${await walk.timer(page)}, not 2:00: time in front of the person counts while GPS is lost`);
        const live = await walk.stored(page);
        const s0 = live?.segments?.[0];
        const runs = measured(s0);
        await t.check(live?.segments?.length === 1, `the lost signal split the walk into ${live?.segments?.length} segments`);
        await t.check(runs.length === 2 && near(runs[0].distanceM, 55.6, 2) && near(runs[1].distanceM, 33.4, 2),
          `GPS runs are not ~55.6 m then ~33.4 m: ${JSON.stringify(s0?.gps)}`);
        await t.check(near(segDist(s0), 89.0, 3), `the distance is ${Math.round(segDist(s0))} m, not about 89 m (bridging the silence would give about 145 m)`);
        await walk.finish(t);
        const summary = (await main.innerText()).replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ');
        await t.checkpoint('summary-after-lost-signal');
        // The row reads "Distance", its note, then the value.
        await t.check(/Distance\b[^]{0,200}?\b0\.09 km/.test(summary) && /signal dropped out|may be short/i.test(summary),
          `the summary does not show about 0.09 km, marked as possibly short: ${summary.slice(0, 400)}`);
        const snap = await walk.save(t);
        const obs = walk.walkObservations(snap);
        const by = k => obs.filter(o => o.kind === k).sort((a, b) => a.at.localeCompare(b.at));
        const dist = by('walkDistance');
        await t.check(dist.length === 2 && dist.map(o => o.value).join() === '0.056,0.033' && dist.map(o => o.coverageMs).join() === '60000,30000',
          `walkDistance: ${JSON.stringify(dist.map(o => [o.value, o.coverageMs]))}, not one per run (0.056 km over 60000 ms, 0.033 km over 30000 ms)`);
        const dur = by('walkDuration');
        await t.check(dur.length === 1 && dur[0].value === 2 && dur[0].coverageMs === 120000, `walkDuration: ${JSON.stringify(dur.map(o => [o.value, o.coverageMs]))}, not one 2-minute record over 120000 ms`);
      }, { input: 'a fix every 10 s from 0 to 60 s (latitude 0 to 0.0005); no fix from 60 to 90 s, page visible; a fix every 10 s from 90 to 120 s (latitude 0.001 to 0.0013)' });
    },
  },
  {
    name: 'add the away time',
    async run(t) {
      const page = await t.open({ seed: persona('P03'), route: '', sensors: { geo: 'grant' }, visibility: true, capabilities: { share: 'absent' } });
      const main = page.getByRole('main');

      await t.step(6, 'Explicitly add the three-minute away interval', async () => {
        await startGpsWalk(t);
        await firstSegment(t);
        await page.evaluate(() => window.__acc.setVisibility('hidden'));
        await page.waitForTimeout(200);
        await t.advance(180 * SECOND);
        await page.evaluate(() => window.__acc.setVisibility('visible'));
        await page.waitForTimeout(400);
        const add = main.getByRole('button', { name: /^I kept walking: add 3 min$/ });
        await t.must(await add.count() === 1, `no way to add the away time: ${(await main.innerText()).replace(/\s+/g, ' ').slice(0, 300)}`);
        await ui.tap(add);
        const text = (await main.innerText()).replace(/\s+/g, ' ');
        await t.check(/Added 3 min as time you entered/.test(text), `adding the gap is not acknowledged as entered time: ${text.slice(0, 200)}`);
        await t.checkpoint('away-time-added');
        await ui.tap(ui.button(main, 'Done'));
        await secondSegment(t);
        await walk.finish(t);
        const summary = (await main.innerText()).replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ');
        await t.checkpoint('summary-with-added-time');
        await t.check(/Time recorded 3:00/.test(summary) && /Time you added .{0,80}?3 min/.test(summary), `the summary does not keep 3 measured and 3 added minutes apart: ${summary.slice(0, 400)}`);
        const snap = await walk.save(t);
        const obs = walk.walkObservations(snap);
        const manual = obs.filter(o => o.source === 'manual');
        const measured = obs.filter(o => o.source === 'measured');
        await t.check(manual.length === 2 && manual.every(o => ['walkDuration', 'movementMinutes'].includes(o.kind) && o.value === 3 && o.coverageMs === 180000),
          `manual gap observations: ${JSON.stringify(manual.map(o => [o.kind, o.value, o.coverageMs]))}`);
        await t.check(!manual.some(o => o.kind === 'walkDistance') && !obs.some(o => o.kind === 'walkDistance' && o.source !== 'measured'), 'distance was invented for the added time');
        await t.check(measured.filter(o => o.kind === 'walkDuration').map(o => o.coverageMs).sort((a, b) => b - a).join() === '120000,60000', 'the measured segments are not 120000 and 60000 ms');
        await ui.tap(ui.button(main, 'Done'));
        await t.goto('/track');
        const row = main.getByRole('link', { name: /walk/i });
        await t.must(await row.count() === 1, `Track lists ${await row.count()} walks`);
        const rowText = (await row.innerText()).replace(/\s+/g, ' ');
        await ui.tap(row);
        await page.waitForTimeout(400);
        const detail = (await main.innerText()).replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ');
        await t.checkpoint('walk-record-added');
        await t.check(/3 min/.test(detail) && /added|entered by you|you added/i.test(detail), `the record does not show 3 measured + 3 added minutes: ${rowText} | ${detail.slice(0, 300)}`);
        await t.check(!/\b6 min\b/.test(rowText) || /added/i.test(rowText), `Track shows 6 minutes without saying 3 were added: ${rowText}`);
        await ui.tab(page, 'Today');
        const today = (await main.innerText()).replace(/\s+/g, ' ');
        const week = today.match(/(\d+) min of movement recorded this week/);
        await t.check(week && week[1] !== '9' && (week[1] === '3' || /added|manual/i.test(today)), `this week’s movement reads ${week?.[0] ?? 'nothing'}`);
        const web = await t.storage();
        const leaks = [...walk.positionsIn(await t.db(), 'db'), ...walk.positionsIn(web, 'web')];
        await t.check(!leaks.length, `positions stored: ${leaks.slice(0, 6).join(', ')}`);
      }, { input: 'as the main case, then “I kept walking: add 3 min”' });
    },
  },
];
