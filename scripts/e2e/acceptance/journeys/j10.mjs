/**
 * J10, P03: after-meal walk with location denied
 * (codex-acceptance.md; basis D14, D18, D24, D26).
 */
import { MINUTE, NOW } from '../lib/env.mjs';
import { persona } from '../fixtures/personas.mjs';
import * as ui from '../lib/ui.mjs';
import * as walk from '../lib/walk.mjs';

export const id = 'J10';
export const title = 'After-meal walk with location denied';
export const safety = false;

const MEAL_AT = NOW - 20 * MINUTE; // 08:40 IST

export const cases = [{
  name: 'after breakfast, location denied',
  async run(t) {
    const page = await t.open({ seed: persona('P03'), route: '', sensors: { geo: 'deny' } });
    const main = page.getByRole('main');
    let walkId;

    await t.step(1, 'Move → Walk; After a meal, Breakfast, started 20 minutes ago', async () => {
      await walk.openSetup(t);
      const kinds = main.getByRole('radiogroup', { name: 'What kind of walk' });
      await t.check(await ui.row(kinds, 'Just a walk', 'radio').getAttribute('aria-checked') === 'true', 'the walk does not start as “Just a walk”: a meal is assumed');
      await t.check(!(await main.getByLabel('Meal', { exact: true }).count()), 'meal questions show before “After a meal” is chosen');
      await ui.tap(ui.row(kinds, 'After a meal', 'radio'));
      const meal = main.getByLabel('Meal', { exact: true });
      await meal.waitFor();
      const preselected = await meal.evaluate(el => el.options[el.selectedIndex]?.text);
      // The spec: no meal assumed from the clock. A meal already chosen before
      // the person picks one is the clock's guess.
      await t.check(!preselected || /choose|select/i.test(preselected), `the meal is preselected as “${preselected}” from the time of day before any choice`);
      await meal.selectOption({ label: 'Breakfast' });
      await main.getByLabel('Started', { exact: true }).selectOption({ label: '20 minutes ago' });
      const text = (await main.innerText()).replace(/\s+/g, ' ');
      await t.check(/10 minutes/.test(text) && /Reynolds/.test(text) && /2016/.test(text), 'the after-meal suggestion does not name Reynolds 2016 with its 10 minutes');
      await t.check(/Research, not a promise/.test(text), 'no “Research, not a promise” framing');
      await t.check(await main.getByLabel(/^Target/).evaluate(el => el.options[el.selectedIndex]?.text) === '10 min', 'the suggested 10-minute target is not offered');
      await t.checkpoint('walk-setup-after-breakfast');
    }, { input: 'After a meal; Breakfast; Started 20 minutes ago (08:40)' });

    await t.step(2, 'Count location calls, then opt in and deny', async () => {
      const before = await walk.calls(page);
      await t.check(before.geolocation === 0 && !before.permissionsQuery.includes('geolocation'), `location was asked before opting in: ${JSON.stringify(before)}`);
      const steps = walk.stepsSwitch(page);
      await t.check(await steps.getAttribute('aria-checked') === 'false', 'Count steps is on');
      const gps = walk.gpsSwitch(page);
      await ui.tap(gps);
      await page.waitForTimeout(400);
      const after = await walk.calls(page);
      await t.check(after.geolocation === 1, `the opt-in made ${after.geolocation} location calls, not 1`);
      await t.check(await gps.getAttribute('aria-checked') === 'false', 'distance and pace stays on after a denial');
      const text = (await main.innerText()).replace(/\s+/g, ' ');
      await t.check(/timed only/i.test(text), `no timed-only explanation after the denial: ${text.slice(0, 300)}`);
      // Real time, not the test clock: the walk must start at NOW, 20 minutes after the meal.
      await page.waitForTimeout(2000);
      const later = await walk.calls(page);
      await t.check(later.geolocation === 1, `location keeps being asked (${later.geolocation} calls)`);
      await t.check(await ui.button(main, 'Start walk').isEnabled(), 'Start walk is not available after the denial');
      await t.checkpoint('walk-location-denied');
    }, { input: 'Measure distance and pace → permission denied; Count steps off' });

    await t.step(3, 'Glucose 110 and normal answers; start; two foreground minutes', async () => {
      await walk.start(t, ui.normalAnswers('P03'));
      await t.checkpoint('walk-live-start');
      // Foreground: visible, a minute at a time.
      await t.advance(MINUTE);
      await t.advance(MINUTE);
      await t.check(await walk.timer(page) === '2:00', `the timer reads ${await walk.timer(page)}, not 2:00`);
      const text = (await main.innerText()).replace(/[\u00a0\u202f]/g, ' ');
      await t.check(/Not measured/.test(text), `distance and pace do not read “Not measured”: ${text.replace(/\n/g, ' ⏎ ').slice(0, 300)}`);
      await t.check(!/0\.00\s*km|0 km|0:00\s*min\/km/.test(text), 'a zero distance or zero pace is shown');
      const c = await walk.calls(page);
      await t.check(c.geolocation === 1, `the walk asked for location again (${c.geolocation} calls)`);
      const live = await walk.stored(page);
      walkId = live?.id;
      await t.check(!!live && live.plan.kind === 'afterMeal' && live.plan.meal?.which === 'breakfast' && live.plan.meal?.startedAt === MEAL_AT,
        `the live walk does not carry the meal: ${JSON.stringify(live?.plan)}`);
      await t.checkpoint('walk-live-2-minutes');
    }, { input: 'glucose 110 mg/dL meter, now; +60 s; +60 s' });

    await t.step(4, 'Finish, Finish walk, Save walk, Done', async () => {
      await walk.finish(t);
      await t.checkpoint('walk-summary');
      const summary = (await main.innerText()).replace(/[\u00a0\u202f]/g, ' ');
      await t.check(/After breakfast/.test(summary) && /8:40/.test(summary), `the summary does not show the meal and its start: ${summary.replace(/\n/g, ' ⏎ ').slice(0, 300)}`);
      await t.check(!/Saved on this/.test(summary), '“Saved” shows before saving');
      const atAck = await walk.save(t);
      const saved = walk.walkObservations(atAck);
      await t.check(saved.length === 2, `when “Saved on this device” shows, ${saved.length} walk observations are stored, not 2`);
      await t.checkpoint('walk-saved');
      await ui.tap(ui.button(main, 'Done'));
      await page.getByRole('heading', { level: 1, name: 'Today', exact: true }).waitFor();
      const today = (await main.innerText()).replace(/\s+/g, ' ');
      t.note(`Today after the walk: ${today.slice(0, 200)}`);
      await t.goto('/track');
      const rows = main.getByRole('link', { name: /walk/i });
      await t.check(await rows.count() === 1, `today’s Track lists ${await rows.count()} walks`);
      const row = (await rows.innerText()).replace(/\s+/g, ' ');
      await t.check(/after (a meal|breakfast)/i.test(row) && /2 min/.test(row), `the walk row is not a two-minute after-meal walk: ${row}`);
      await t.checkpoint('track-walk-row');
    });

    await t.step(5, 'Reload Track and open the walk', async () => {
      await t.reload();
      const rows = main.getByRole('link', { name: /walk/i });
      await t.must(await rows.count() === 1, `after reload Track lists ${await rows.count()} walks`);
      await ui.tap(rows);
      await page.waitForTimeout(500);
      const detail = (await main.innerText()).replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ');
      await t.checkpoint('walk-record');
      await t.check(/\b2 min\b/.test(detail) && /breakfast/i.test(detail) && /8:40/.test(detail), `the walk record is not the two-minute after-breakfast walk with its meal start: ${detail.slice(0, 300)}`);
      await t.check((await t.route()).includes(walkId ?? '§'), `the record’s address ${await t.route()} is not walk ${walkId}`);
      const snap = await t.db();
      const obs = walk.walkObservations(snap);
      const ctx = `walk:${walkId}`;
      const dur = obs.filter(o => o.kind === 'walkDuration');
      const mov = obs.filter(o => o.kind === 'movementMinutes');
      await t.check(obs.length === 2 && dur.length === 1 && mov.length === 1, `walk observations: ${obs.map(o => o.kind).join(', ')}`);
      for (const o of obs) {
        const bad = [];
        if (o.value !== 2) bad.push(`value ${o.value}`);
        if (o.unit !== 'min') bad.push(`unit ${o.unit}`);
        if (o.scope !== 'sessionObserved') bad.push(`scope ${o.scope}`);
        if (o.source !== 'measured') bad.push(`source ${o.source}`);
        if (o.coverageMs !== 120000) bad.push(`coverage ${o.coverageMs}`);
        if (o.context !== ctx) bad.push(`context ${o.context}`);
        if (o.at !== '2026-10-08T09:00:00.000+05:30') bad.push(`at ${o.at}`);
        if (o.tag !== 'afterMeal' || !o.mealStartedAt || Date.parse(o.mealStartedAt) !== MEAL_AT) bad.push(`meal ${o.tag}/${o.mealStartedAt}`);
        await t.check(!bad.length, `${o.kind}: ${bad.join(', ')}`);
      }
      const others = (snap.observations ?? []).filter(o => ['walkDistance', 'steps'].includes(o.kind) || (o.kind === 'movementMinutes' && o.scope === 'dayTotal'));
      await t.check(!others.length, `the walk also created ${others.map(o => `${o.kind} ${o.scope}`).join(', ')}`);
      const web = await t.storage();
      const leaks = [...walk.positionsIn(snap, 'db'), ...walk.positionsIn(web, 'web')];
      await t.check(!leaks.length, `positions stored: ${leaks.slice(0, 5).join(', ')}`);
      await t.check(!/calorie|kcal/i.test(detail), 'the walk record shows calories');
    });
  },
}];
