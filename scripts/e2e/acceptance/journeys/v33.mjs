/**
 * V-J33, P02: weak GPS, a locked screen and midnight on one walk
 * (journey §17.2 #33; §9.3, F17, A-48, B-17, B-19). Each break makes its own
 * line or segment, nothing is joined across the gap, and each day is
 * credited with its own minutes. Synthetic persona only.
 */
import { persona } from '../fixtures/personas.mjs';
import * as ui from '../lib/ui.mjs';
import * as walk from '../lib/walk.mjs';

export const id = 'V33';
export const title = 'Weak GPS, a locked screen and midnight';
export const safety = false;

const SECOND = 1000;
const START = Date.parse('2026-10-08T23:50:00+05:30');
const HIDE = Date.parse('2026-10-08T23:54:00+05:30');
const SHOW = Date.parse('2026-10-08T23:56:00+05:30');
const MIDNIGHT = Date.parse('2026-10-09T00:00:00+05:30');

/** A fix now, then one every 10 s for `seconds`, from `from` to `to` degrees north on longitude 0, at `accuracy` metres. */
async function walkNorth(t, from, to, seconds, accuracy = 3) {
  const steps = seconds / 10;
  await walk.emit(t.page, from, 0, accuracy);
  for (let i = 1; i <= steps; i++) {
    await t.advance(10 * SECOND);
    await walk.emit(t.page, from + ((to - from) * i) / steps, 0, accuracy);
  }
}

export const cases = [{
  name: 'three breaks of three kinds',
  async run(t) {
    const page = await t.open({ seed: persona('P02'), route: '', time: START, sensors: { geo: 'grant', monotonic: 'wall' }, visibility: true });
    const main = page.getByRole('main');

    await t.step(1, 'A first walk at 11:50 pm, keeping its route', async () => {
      await walk.openSetup(t);
      await walk.emit(page, 0, 0);
      await ui.tap(walk.gpsSwitch(page));
      await page.waitForFunction(() => document.querySelector('[role="switch"][aria-checked="true"]') !== null, null, { timeout: 5000 });
      await walk.start(t, ui.normalAnswers('P02'), { keep: true, map: false });
      await t.check(t.asked.join(' | ') === 'Keep a record of your route on this phone? | Show map pictures under your saved routes?', `the first walk asked ${t.asked.join(' | ') || 'nothing'}`);
    });

    await t.step(2, 'Good signal, half a minute of weak signal, good again: two lines (B-17)', async () => {
      await walkNorth(t, 0, 0.001, 120); // 23:50:00 to 23:52:00
      await walkNorth(t, 0.0011, 0.0013, 30, 80); // weak fixes to 23:52:30
      const weak = (await main.innerText()).replace(/\s+/g, ' ');
      await t.check(/Weak GPS signal|No GPS signal/.test(weak), `the weak signal is not said: ${weak.slice(0, 300)}`);
      await walkNorth(t, 0.0015, 0.0025, 90); // 23:52:30 to 23:54:00
      await t.check(await walk.drawnLines(page) === 2, `the dropout did not break the line: ${await walk.drawnLines(page)} lines`);
      await t.checkpoint('two-lines');
    }, { input: 'a fix every 10 s; accuracy 3 m, then 80 m for 30 s, then 3 m' });

    await t.step(3, 'The screen locks at 11:54 pm for two minutes: a gap, not a line', async () => {
      await page.evaluate(() => window.__acc.setVisibility('hidden'));
      await page.waitForTimeout(200);
      // Nothing records while hidden, so one long step can't look like a clock change (B-19).
      await t.advance(120 * SECOND);
      await page.evaluate(() => window.__acc.setVisibility('visible'));
      await page.waitForTimeout(400);
      const text = (await main.innerText()).replace(/\s+/g, ' ');
      await t.check(/Recording paused while the app was away, for 2 min/.test(text), `no gap notice: ${text.slice(0, 300)}`);
      await ui.tap(ui.button(main, 'Continue walking'));
    }, { input: 'hidden at 23:54:00, visible at 23:56:00' });

    await t.step(4, 'Walking on through midnight: a new segment from 12:00 am, with no gap', async () => {
      await walkNorth(t, 0.003, 0.0048, 360); // 23:56:00 to 00:02:00
      await t.check(await walk.drawnLines(page) === 4, `the gap or midnight is drawn joined: ${await walk.drawnLines(page)} lines, not 4`);
      await t.check(await walk.timer(page) === '10:00', `the timer reads ${await walk.timer(page)}, not 10:00`);
      const live = await walk.stored(page);
      const ends = (live?.segments ?? []).map(s => s.endedBy ?? 'open');
      const days = (live?.segments ?? []).map(s => s.day);
      await t.check(ends.join() === 'hidden,midnight,open' && days.join() === '2026-10-08,2026-10-08,2026-10-09', `segments: ${JSON.stringify({ ends, days })}`);
      await t.checkpoint('after-midnight');
    });

    await t.step(5, 'Finish and save: each day credited with its own minutes (F17)', async () => {
      await walk.finish(t);
      const summary = (await main.innerText()).replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ');
      await t.check(/Time recorded 10:00/.test(summary) && /Not recorded .{0,80}?2 min/.test(summary), `the summary: ${summary.slice(0, 300)}`);
      const snap = await walk.save(t);
      const byDay = {};
      for (const o of walk.walkObservations(snap).filter(x => x.kind === 'walkDuration')) byDay[o.at.slice(0, 10)] = (byDay[o.at.slice(0, 10)] ?? 0) + o.value;
      await t.check(byDay['2026-10-08'] === 8 && byDay['2026-10-09'] === 2, `minutes by day: ${JSON.stringify(byDay)}`);
      const [route] = walk.routesIn(snap);
      const lines = route?.segments ?? [];
      await t.check(lines.length === 4, `the kept route has ${lines.length} lines, not 4`);
      await t.check(lines.every(l => l.end <= HIDE || l.start >= SHOW), 'a kept line crosses the time the screen was locked (A-48)');
      await t.check(lines[2]?.end <= MIDNIGHT && lines[3]?.start >= MIDNIGHT, 'midnight does not separate two lines');
    });

    await t.step(6, 'Today’s log lists the walk on the day it started (L-10)', async () => {
      await t.goto('/day/2026-10-08');
      const rows = main.getByRole('link', { name: /walk/i });
      await t.check(await rows.count() === 1 && /10 min/.test(await rows.innerText()), `the 8th lists ${await rows.count()} walks`);
      await t.goto('/day/2026-10-09');
      await t.check(await main.getByRole('link', { name: /walk/i }).count() === 0, 'the walk is listed again on the day it ended');
    });
  },
}];
