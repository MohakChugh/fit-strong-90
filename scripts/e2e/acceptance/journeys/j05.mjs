/**
 * J05, P01: My Day, provenance, totals and local dates
 * (codex-acceptance.md; basis D10, D13, D14, D21; PLAN Task 6).
 *
 * The main case is the numbered sequence, all through the UI. The
 * supplementary rows enter through the app's canonical backup import
 * (You → Data & offline → Restore from a backup → Merge), as the spec allows
 * for observations v4 cannot represent, each in a fresh context.
 */
import { C0, LEGACY_SESSION, persona } from '../fixtures/personas.mjs';
import * as ui from '../lib/ui.mjs';
import * as data from '../lib/data.mjs';

export const id = 'J05';
export const title = 'My Day, provenance, totals and local dates';
export const safety = false;

const TODAY = '2026-10-08';
const text = async locator => (await locator.innerText()).replace(/[\u00a0\u202f]/g, ' ');
const flat = s => s.replace(/\s+/g, ' ');
/** A record's own row, by the real href the seeded UI gave it. */
const linkTo = (scope, href) => scope.locator(`a[href="${href.startsWith('#') ? href : `#${href}`}"]`);

/** Wait until the hash route satisfies `test` (a string or RegExp), up to `ms`; returns the route either way. */
async function waitRoute(t, test, ms = 15000) {
  const src = test instanceof RegExp ? { re: test.source, flags: test.flags } : { eq: test };
  await t.page.waitForFunction(w => {
    const r = location.hash.replace(/^#/, '') || '/';
    return w.re !== undefined ? new RegExp(w.re, w.flags).test(r) : r === w.eq;
  }, src, { timeout: ms }).catch(() => {});
  return t.route();
}

/** Tap a My Day view and wait for it to be the chosen one. */
async function view(page, name) {
  const option = ui.radio(page.getByRole('main').getByRole('radiogroup', { name: 'Show' }), name);
  await ui.tap(option);
  await page.waitForFunction(n => [...document.querySelectorAll('[role=radiogroup][aria-label="Show"] [role=radio]')].some(r => r.textContent.trim() === n && r.getAttribute('aria-checked') === 'true'), name, { timeout: 15000 });
  await page.waitForTimeout(150);
}

/** Day-total rows and record rows of the My Day timeline, as their visible text. */
async function dayRows(page) {
  const main = page.getByRole('main');
  const rows = await main.getByRole('link').all();
  const out = [];
  for (const r of rows) {
    const href = await r.getAttribute('href');
    if (!href || !/#\/track\/(reading|pressure|walk|session|workout|check-in)\//.test(href)) continue;
    out.push({ href: href.replace(/^#/, ''), text: flat(await text(r)) });
  }
  return out;
}

// ============================================================================
// The main sequence
// ============================================================================

async function sequence(t) {
  const page = await t.open({ seed: persona('P01'), route: '/track' });
  const main = page.getByRole('main');
  let stepsIds = [];

  await t.step(1, 'Track → Add → Steps 2000 for today, then 2500 for the same day', async () => {
    await data.logTotal(t, 'steps', 2000);
    await data.logTotal(t, 'steps', 2500);
    const snap = await t.checkpoint('steps-2000-then-2500');
    const steps = (snap.observations ?? []).filter(o => o.kind === 'steps');
    stepsIds = steps.map(o => o.id);
    await t.check(steps.length === 2 && steps.every(o => o.scope === 'dayTotal' && o.source === 'manual' && o.day === TODAY)
      && steps.map(o => o.value).sort((a, b) => a - b).join(',') === '2000,2500',
      `stored steps statements: ${JSON.stringify(steps.map(o => ({ v: o.value, scope: o.scope, source: o.source, day: o.day })))}`);
    const body = flat(await text(main));
    await t.check(/Steps[^]*?2,500 steps/.test(body) && !/4,500/.test(body), `My Day does not show the effective 2,500 steps (or shows 4,500): ${body.slice(0, 400)}`);
    // Both statements inspectable, each labelled Manual.
    await ui.tap(main.getByRole('link', { name: /^Steps .*2,500 steps$/ }));
    await page.getByRole('heading', { level: 1, name: 'Steps', exact: true }).waitFor();
    const detail = flat(await text(main));
    await t.check(/Other entries for this day/i.test(detail) && /2,000 steps/.test(detail), `the earlier 2,000 statement is not inspectable from the day total: ${detail.slice(0, 400)}`);
    await t.check((detail.match(/Manual entry/g) ?? []).length >= 2, `the statements are not both labelled Manual: ${detail.slice(0, 400)}`);
    await t.checkpoint('steps-detail');
    await ui.tap(main.getByRole('button', { name: /^Back to / }));
    await page.getByRole('heading', { level: 1, name: 'My Day', exact: true }).waitFor();
  }, { input: 'steps 2000 then 2500 for 2026-10-08' });

  await t.step(2, 'Add Water 250 ml, then 250 ml', async () => {
    await data.logWater(t, 250);
    await data.logWater(t, 250);
    const snap = await t.checkpoint('water-250-twice');
    const water = (snap.observations ?? []).filter(o => o.kind === 'water').sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
    await t.check(water.length === 2 && water.map(o => o.value).join(',') === '250,500' && water.every(o => o.scope === 'dayTotal' && o.source === 'manual'),
      `stored water statements (commit order): ${JSON.stringify(water.map(o => ({ v: o.value, scope: o.scope, seq: o.seq })))}`);
    const body = flat(await text(main));
    await t.check(/Water[^]*?500 ml/.test(body) && !/750 ml/.test(body), `My Day does not show the effective 500 ml water total: ${body.slice(0, 400)}`);
  }, { input: 'water 250 ml twice' });

  await t.step(3, 'Add Sleep 7.5 h, Weight 78 kg, Waist 90 cm, back pain 2, leg pain blank', async () => {
    const before = await t.db();
    const legBefore = (before.observations ?? []).filter(o => o.kind === 'legPain').length;
    await data.logTotal(t, 'sleep', '7.5');
    await data.logMeasure(t, 'weight', 78);
    await data.logMeasure(t, 'waist', 90);
    await data.logPain(t, { back: 2 });
    const snap = await t.checkpoint('sleep-weight-waist-pain');
    const today = (snap.observations ?? []).filter(o => o.day === TODAY);
    const one = kind => today.filter(o => o.kind === kind);
    await t.check(one('sleep').length === 1 && one('sleep')[0].value === 7.5 && one('sleep')[0].unit === 'h' && one('sleep')[0].scope === 'dayTotal' && one('sleep')[0].source === 'manual',
      `sleep: ${JSON.stringify(one('sleep'))}`);
    await t.check(one('weight').length === 1 && one('weight')[0].value === 78 && one('weight')[0].unit === 'kg' && one('weight')[0].scope === 'pointInTime',
      `weight: ${JSON.stringify(one('weight'))}`);
    await t.check(one('waist').length === 1 && one('waist')[0].value === 90 && one('waist')[0].unit === 'cm', `waist: ${JSON.stringify(one('waist'))}`);
    await t.check(one('backPain').length === 1 && one('backPain')[0].value === 2 && one('backPain')[0].unit === '0-10', `back pain: ${JSON.stringify(one('backPain'))}`);
    await t.check((snap.observations ?? []).filter(o => o.kind === 'legPain').length === legBefore, 'a blank leg pain created a leg-pain observation');
    const rows = await dayRows(page);
    for (const [title, value] of [['Sleep', '7.5 h'], ['Weight', '78.0 kg'], ['Waist', '90.0 cm'], ['Back pain', '2 of 10']]) {
      const row = rows.find(r => r.text.startsWith(title));
      await t.check(row && row.text.includes(value) && /Manual entry/.test(row.text), `My Day row for ${title} lacks its value ${value} or its source: ${row?.text ?? '(no row)'}`);
    }
    await t.check(!rows.some(r => r.text.startsWith('Leg pain')), 'My Day shows a leg-pain record nobody entered');
  }, { input: 'sleep 7.5 h; weight 78 kg; waist 90 cm; back pain 2; leg pain blank' });

  let firstGlucose;
  await t.step(4, 'Glucose 150 after a meal (meal 07:00, reading 08:30) and an untagged 150 at 08:40', async () => {
    await data.logGlucose(t, { value: 150, tag: 'After a meal', mealStart: '07:00', at: `${TODAY}T08:30` });
    await data.logGlucose(t, { value: 150, at: `${TODAY}T08:40` });
    const snap = await t.checkpoint('two-glucose');
    const g = (snap.observations ?? []).filter(o => o.kind === 'glucose' && o.day === TODAY);
    firstGlucose = g.find(o => o.tag === 'afterMeal');
    const untagged = g.find(o => o.tag === undefined);
    await t.must(firstGlucose && untagged, `the two readings were not both stored: ${JSON.stringify(g)}`);
    await t.check(firstGlucose.value === 150 && firstGlucose.unit === 'mg/dL' && firstGlucose.at.startsWith(`${TODAY}T08:30`) && firstGlucose.mealStartedAt?.startsWith(`${TODAY}T07:00`) && firstGlucose.source === 'manual',
      `after-meal reading stored as ${JSON.stringify(firstGlucose)}`);
    await t.check(untagged.at.startsWith(`${TODAY}T08:40`) && untagged.value === 150, `untagged reading stored as ${JSON.stringify(untagged)}`);
    // The after-meal reading's detail.
    await ui.tap(main.getByRole('link').filter({ hasText: 'After a meal' }).filter({ hasText: '150 mg/dL' }));
    await page.getByRole('heading', { level: 1, name: 'Glucose', exact: true }).waitFor();
    const detail = flat(await text(main));
    await t.check(/Meal started/.test(detail) && /90 min before/.test(detail), `the after-meal reading does not show its meal start and 90-minute interval: ${detail.slice(0, 400)}`);
    await t.check(/ADA/.test(detail) && /after meals/.test(detail), `the after-meal framework (ADA) is not named: ${detail.slice(0, 400)}`);
    await t.checkpoint('after-meal-detail');
    await ui.tap(main.getByRole('button', { name: /^Back to / }));
    await page.getByRole('heading', { level: 1, name: 'My Day', exact: true }).waitFor();
    // The untagged one.
    const plain = main.getByRole('link').filter({ hasText: /8:40|08:40/ }).filter({ hasText: '150 mg/dL' });
    const rowText = flat(await text(plain));
    await t.check(!/fasting|before a meal/i.test(rowText), `the untagged reading's row calls it fasting or premeal: ${rowText}`);
    await ui.tap(plain);
    await page.getByRole('heading', { level: 1, name: 'Glucose', exact: true }).waitFor();
    const untaggedDetail = flat(await text(main));
    await t.check(!/fasting/i.test(untaggedDetail), `the untagged reading is called fasting: ${untaggedDetail.slice(0, 400)}`);
    await t.check(!/above (the ADA|your clinician).{0,40}before meals|above.{0,30}(premeal|pre-meal)/i.test(untaggedDetail), `the untagged reading is judged against a premeal target: ${untaggedDetail.slice(0, 400)}`);
    await t.checkpoint('untagged-detail');
    await ui.tap(main.getByRole('button', { name: /^Back to / }));
    await page.getByRole('heading', { level: 1, name: 'My Day', exact: true }).waitFor();
  }, { input: 'glucose 150 mg/dL after a meal, meal 07:00, reading 08:30; glucose 150 at 08:40, no tag' });

  await t.step(5, 'Correct the first reading to 155, keeping its time; reload', async () => {
    await ui.tap(main.getByRole('link').filter({ hasText: 'After a meal' }).filter({ hasText: 'mg/dL' }));
    await page.getByRole('heading', { level: 1, name: 'Glucose', exact: true }).waitFor();
    await ui.tap(ui.row(main, 'Correct this'));
    const edit = page.getByRole('dialog', { name: 'Correct this record' });
    await edit.waitFor();
    await ui.type(edit.getByRole('textbox', { name: 'Value', exact: true }), '155');
    await ui.tap(ui.button(edit, 'Save correction'));
    await edit.waitFor({ state: 'hidden' });
    await t.reload();
    const snap = await t.checkpoint('after-correction-reload');
    const g = (snap.observations ?? []).filter(o => o.kind === 'glucose' && o.day === TODAY);
    const same = g.find(o => o.id === firstGlucose.id);
    await t.check(g.length === 2, `${g.length} glucose readings today after the correction (expected the same 2)`);
    await t.check(same && same.value === 155 && same.at === firstGlucose.at && same.tag === 'afterMeal' && same.mealStartedAt === firstGlucose.mealStartedAt
      && same.context === firstGlucose.context && same.source === 'manual' && typeof same.editedAt === 'string',
      `the corrected reading is ${JSON.stringify(same)}; it was ${JSON.stringify(firstGlucose)}`);
    const detail = flat(await text(main));
    await t.check(/155/.test(detail) && /Corrected/.test(detail) && /Meal started/.test(detail), `the corrected reading's detail lacks 155, its correction time or its meal context: ${detail.slice(0, 400)}`);
    await ui.tap(main.getByRole('button', { name: /^Back to / }));
    await page.getByRole('heading', { level: 1, name: 'My Day', exact: true }).waitFor();
  }, { input: 'correct 150 → 155' });

  await t.step(6, 'Trends, Back & leg, each record detail, and Back', async () => {
    // Trends: one row per measure, each opening one chart, Back to Trends.
    await view(page, 'Trends');
    await t.checkpoint('trends');
    const trendLinks = await main.getByRole('link').evaluateAll(as => as.map(a => ({ href: a.getAttribute('href'), text: a.innerText.replace(/\s+/g, ' ').trim() })).filter(a => /#\/track\/(metric|back)/.test(a.href ?? '')));
    await t.check(trendLinks.length >= 6, `Trends lists ${trendLinks.length} measures: ${JSON.stringify(trendLinks.map(l => l.text))}`);
    for (const l of trendLinks) {
      await t.check(!/NaN|undefined/.test(l.text), `Trends row reads “${l.text}”`);
      await ui.tap(linkTo(main, l.href));
      await waitRoute(t, /^\/track\/(metric|back)/);
      await page.waitForFunction(() => !/^My Day$/.test(document.querySelector('main h1')?.textContent?.trim() ?? 'My Day'), null, { timeout: 15000 });
      const title = (await main.getByRole('heading', { level: 1 }).innerText()).trim();
      const body = flat(await text(main));
      const charts = await main.locator('figure').count();
      await t.check(charts <= 1 || /Back & leg/.test(title), `${title} draws ${charts} charts on one screen`);
      // A chart's text equivalent: days without a record read as missing, never as zero.
      const zeroDays = await main.locator('figure table tbody tr').evaluateAll(rows => rows.map(r => r.innerText.replace(/\s+/g, ' ').trim()).filter(r => /(?<![\d.,])0 (steps|ml|h|min)\b/.test(r)));
      await t.check(zeroDays.length === 0, `${title}'s chart shows zero for days with nothing entered: ${zeroDays.slice(0, 3).join(' | ')}`);
      // No more figures than there are records: a filled gap would be a reading nobody took.
      const kind = { Glucose: 'glucose', Weight: 'weight', Waist: 'waist', Steps: 'steps', Water: 'water', Sleep: 'sleep' }[title];
      if (kind) {
        const cells = await main.locator('figure table tbody td').allInnerTexts();
        const values = cells.filter(c => /\d/.test(c) && !/Not entered|No reading|Invalid value/.test(c));
        const real = ((await t.db()).observations ?? []).filter(o => o.kind === kind);
        const most = ['steps', 'water', 'sleep'].includes(kind) ? new Set(real.map(o => o.day)).size : real.length;
        await t.check(values.length <= most, `${title}'s chart holds ${values.length} figures for ${most} recorded ${['steps', 'water', 'sleep'].includes(kind) ? 'days' : 'readings'}: ${values.join(', ')}`);
        await t.check(!cells.some(c => /Invalid value/.test(c)), `${title}'s chart holds an invalid value`);
      }
      if (!/Back & leg/.test(title) && !/Walking|movement/i.test(title)) {
        await t.check(/Manual entry|From your check-in|After a session|Imported|Measured/.test(body) || /Not entered/.test(body), `${title} shows no source label for its readings: ${body.slice(0, 300)}`);
      }
      await t.checkpoint(`metric-${title}`);
      await ui.tap(main.getByRole('button', { name: /^Back to / }));
      const back = await waitRoute(t, '/track?view=trends');
      await t.check(back === '/track?view=trends', `Back from ${title} went to ${back}, not to Trends (/track?view=trends)`);
      await page.getByRole('heading', { level: 1, name: 'My Day', exact: true }).waitFor();
    }
    // Back & leg, whether or not Trends listed it.
    if (!trendLinks.some(l => /#\/track\/back/.test(l.href))) {
      await t.check(false, 'Trends offers no way to Back & leg for a back and sciatica profile');
    }
    // Each record detail from today's timeline.
    await view(page, 'Timeline');
    const rows = await dayRows(page);
    for (const r of rows) {
      await ui.tap(linkTo(main, r.href));
      await waitRoute(t, r.href);
      await page.waitForFunction(() => !/^My Day$/.test(document.querySelector('main h1')?.textContent?.trim() ?? 'My Day'), null, { timeout: 15000 });
      const title = (await main.getByRole('heading', { level: 1 }).innerText().catch(() => '?')).trim();
      const body = flat(await text(main));
      if (!/workout|session/.test(r.href)) {
        await t.check(/Source|From your check-in|Your check-in/.test(body), `${title} (${r.href}) shows no source: ${body.slice(0, 200)}`);
      }
      await t.check(!/NaN|undefined|\[object Object\]/.test(body), `${title} shows a broken value: ${body.slice(0, 200)}`);
      const backButton = main.getByRole('button', { name: /^Back to / });
      await ui.tap(backButton);
      const back = await waitRoute(t, '/track');
      await t.check(back === '/track', `Back from ${title} went to ${back}, not today's My Day`);
      await page.getByRole('heading', { level: 1, name: 'My Day', exact: true }).waitFor();
    }
  });

  let workoutId;
  await t.step(7, 'Track → Add → Workout: first set 12 reps (or 20 s), 10 kg if offered; Done set; reload', async () => {
    const add = await data.openAdd(t);
    await ui.tap(ui.row(add, 'Workout'));
    await page.getByRole('heading', { name: 'Workout', exact: true }).waitFor();
    await t.must(!/^\/session/.test(await t.route()), `Workout opened the guided player (${await t.route()})`);
    const checkIn = main.getByRole('button', { name: /^(Check in|Update today’s check-in)$/ });
    if (await checkIn.count()) {
      await ui.tap(checkIn);
      const sheet = page.getByRole('dialog', { name: ui.CHECKIN });
      await sheet.waitFor();
      await ui.answerCheckIn(t, sheet, ui.normalAnswers('P01'));
      await ui.tap(sheet.getByRole('button', { name: 'Start logging', exact: true }));
      await sheet.waitFor({ state: 'hidden' });
    }
    const reps = main.getByRole('textbox', { name: /^Reps/ });
    const seconds = main.getByRole('textbox', { name: /^Seconds/ });
    const weight = main.getByRole('textbox', { name: 'Weight (kg)', exact: true });
    const timed = !(await reps.count()) && (await seconds.count()) > 0;
    await t.must((await reps.count()) + (await seconds.count()) === 1, 'the first offered set has neither a Reps nor a Seconds field');
    await ui.type(timed ? seconds : reps, timed ? '20' : '12');
    const weighted = (await weight.count()) > 0;
    if (weighted) await ui.type(weight, '10');
    t.note(`first set: ${timed ? 'timed (20 s)' : '12 reps'}${weighted ? ', 10 kg' : ', no weight field'}`);
    await t.checkpoint('workout-first-set');
    await ui.tap(ui.button(main, 'Done set'));
    // The record is written as each set is logged; wait for it to be durable, then reload.
    await data.waitDb(t, snap => (snap.sessions ?? []).some(s => s.id !== 'legacy-strength' && s.sets?.some(x => x.status === 'completed')), 'the logged set was never stored');
    await t.check(await main.getByRole('img', { name: 'Done' }).count() >= 1, 'no on-screen acknowledgement that the set was logged');
    await t.reload();
    const snap = await t.checkpoint('workout-after-reload');
    const fresh = (snap.sessions ?? []).filter(s => s.id !== 'legacy-strength');
    await t.must(fresh.length === 1, `${fresh.length} new sessions after logging one set and reloading`);
    workoutId = fresh[0].id;
    const done = fresh[0].sets.filter(s => s.status === 'completed');
    await t.check(done.length === 1 && done[0].actualReps === (timed ? 20 : 12) && done[0].weight === (weighted ? 10 : null),
      `completed sets after reload: ${JSON.stringify(done)}`);
    await t.check(fresh[0].sets.filter(s => s.status !== 'completed').every(s => s.actualReps === null || s.actualReps === undefined),
      'an unperformed set carries actual reps');
    await t.check(/^\/track\/workout/.test(await t.route()) && await main.getByRole('button', { name: /^Set 1 .*Done$/ }).count() >= 1,
      `after reload the Workout Log is not back on the same attempt with set 1 done (${await t.route()})`);
    await t.check(!(await page.getByRole('button', { name: /^(Start|Pause)$/ }).count()), 'a guided player control appeared');
  }, { input: 'reps 12 (or 20 s), weight 10 kg if offered' });

  await t.step(8, 'Finish workout, note “Manual acceptance set”, Save workout; open it from Track and return', async () => {
    await ui.tap(main.getByRole('button', { name: 'Finish workout', exact: true }));
    const finish = page.getByRole('dialog', { name: 'Finish workout' });
    await finish.waitFor();
    const summary = flat(await text(finish));
    await t.check(/1 of \d+/.test(summary) && /partly done/i.test(summary), `the finish sheet does not call this a partly done workout: ${summary.slice(0, 200)}`);
    await ui.type(finish.getByRole('textbox', { name: 'Notes (optional)', exact: true }), 'Manual acceptance set');
    await ui.tap(ui.button(finish, 'Save workout'));
    await page.waitForFunction(() => /#\/track\/workout\/./.test(location.hash), null, { timeout: 10000 });
    await t.ready();
    await t.check(/Saved on this device/.test(await text(main)), 'no save acknowledgement on the saved workout');
    await t.checkpoint('workout-saved');
    // From Track.
    await ui.tab(page, 'Track');
    await data.trackDay(page, TODAY);
    const row = linkTo(main, `/track/workout/${encodeURIComponent(workoutId)}`);
    await t.must(await row.count() === 1, `Track today has ${await row.count()} rows for the saved workout`);
    const rowText = flat(await text(row));
    await t.check(/Partly done/.test(rowText) && !/Completed/.test(rowText), `the Track row does not say partly done: ${rowText}`);
    await ui.tap(row);
    await page.waitForFunction(id => location.hash === `#/track/workout/${encodeURIComponent(id)}`, workoutId, { timeout: 15000 });
    await main.getByText(/^Sets done$/).waitFor({ timeout: 15000 });
    const detail = flat(await text(main));
    await t.check(/Sets done 1 of \d+/.test(detail) && /Partly done/.test(detail) && /Manual acceptance set/.test(detail) && /Not done/.test(detail),
      `the workout detail does not show 1 set done, partly done, the note and the sets not done: ${detail.slice(0, 500)}`);
    await t.check(/12 reps · 10 kg|20 s/.test(detail), `the detail does not show the exact set: ${detail.slice(0, 300)}`);
    await t.checkpoint('workout-detail');
    await t.reload();
    await t.check(await t.route() === `/track/workout/${encodeURIComponent(workoutId)}`, `reload moved to ${await t.route()}`);
    await ui.tap(main.getByRole('button', { name: /^Back to / }));
    const back = await waitRoute(t, /^\/track(\?|$)/);
    await t.check(back.startsWith('/track') && !back.includes('workout'), `Back from the workout went to ${back}`);
    await page.getByRole('heading', { level: 1, name: 'My Day', exact: true }).waitFor({ timeout: 15000 });
    await t.check(await data.trackDay(page, TODAY).then(h => h.includes('8 October')), 'Back did not return to the originating Track day');
    const snap = await t.checkpoint('after-workout-back');
    const sessions = snap.sessions ?? [];
    const mine = sessions.filter(s => s.id !== 'legacy-strength');
    await t.check(mine.length === 1 && mine[0].id === workoutId && mine[0].status === 'partial' && mine[0].notes === 'Manual acceptance set',
      `sessions after finishing: ${JSON.stringify(mine.map(s => ({ id: s.id, status: s.status, notes: s.notes })))}`);
    await t.check(mine[0]?.sets.filter(s => s.status === 'completed').length === 1, 'the saved workout does not hold exactly one completed set');
    // The legacy session and its embedded C0 are unchanged.
    const legacy = sessions.find(s => s.id === 'legacy-strength');
    await t.check(JSON.stringify(sortKeys(legacy)) === JSON.stringify(sortKeys({ ...LEGACY_SESSION, checkIn: C0 })), 'the legacy session changed');
    // The day's statements are histories, not sums; nothing measured was invented.
    const obs = snap.observations ?? [];
    await t.check(obs.filter(o => o.kind === 'steps').length === 2 && stepsIds.every(i => obs.some(o => o.id === i)), 'the two steps statements are not both kept');
    await t.check(!obs.some(o => ['walkDistance', 'walkDuration', 'movementMinutes'].includes(o.kind)), `movement was recorded without any being measured: ${obs.filter(o => ['walkDistance', 'walkDuration', 'movementMinutes'].includes(o.kind)).map(o => o.kind).join(', ')}`);
    await t.check(!obs.some(o => o.source === 'imported'), 'a typed fact is labelled imported');
  }, { input: 'notes “Manual acceptance set”' });
}

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => [k, sortKeys(v[k])]));
  return v;
}

// ============================================================================
// Supplementary rows: canonical backup fixtures
// ============================================================================

/** Import a fixture through Restore → Merge and check it arrived as it was. */
async function importFixture(t, name, doc) {
  const file = data.writeFixture(t, name, doc);
  const sheet = await data.chooseRestore(t, file);
  const preview = flat(await text(sheet));
  await t.check(/In this file/i.test(preview), `the restore preview did not appear: ${preview.slice(0, 200)}`);
  await data.merge(t, sheet);
  const outcome = flat(await text(sheet));
  await t.must(/Merged\./.test(outcome), `the merge did not complete: ${outcome.slice(0, 300)}`);
  await ui.tap(ui.button(sheet, 'Done'));
  await sheet.waitFor({ state: 'hidden' });
  const snap = await t.db();
  for (const o of doc.observations) {
    const got = (snap.observations ?? []).find(x => x.id === o.id);
    const { seq, ...want } = o;
    void seq;
    const { seq: s2, ...have } = got ?? {};
    void s2;
    await t.check(got && JSON.stringify(sortKeys(have)) === JSON.stringify(sortKeys(want)), `imported ${o.id} is stored as ${JSON.stringify(got)}, not as the file had it`);
  }
  return snap;
}

async function openDay(t, day) {
  await ui.tab(t.page, 'Track');
  await view(t.page, 'Timeline');
  await data.trackDay(t.page, day);
  return flat(await text(t.page.getByRole('main')));
}

const at = (time, day = TODAY) => `${day}T${time}.000+05:30`;

const fixtureCases = [
  {
    name: 'fixture: day steps 2500 and walk steps 300',
    async run(t) {
      await t.open({ seed: persona('P01'), route: '/today' });
      const doc = data.transferDoc({
        observations: [
          data.obs({ id: 'fx-steps-day', kind: 'steps', value: 2500, scope: 'dayTotal', source: 'manual', at: at('08:00:00') }),
          data.obs({ id: 'fx-walk-dur', kind: 'walkDuration', value: 10, scope: 'sessionObserved', source: 'measured', at: at('08:10:00'), coverageMs: 600000, context: 'walk:fx-walk' }),
          data.obs({ id: 'fx-walk-mov', kind: 'movementMinutes', value: 10, scope: 'sessionObserved', source: 'measured', at: at('08:10:00'), coverageMs: 600000, context: 'walk:fx-walk' }),
          data.obs({ id: 'fx-steps-walk', kind: 'steps', value: 300, scope: 'sessionObserved', source: 'measured', at: at('08:10:00'), coverageMs: 600000, context: 'walk:fx-walk' }),
        ],
      });
      await t.step(1, 'Import the day total and the walk’s measured steps', () => importFixture(t, 'steps-scopes.json', doc), { input: 'steps dayTotal manual 2500; walk sessionObserved measured 300 steps' });
      await t.step(2, 'The day total stays 2500, the walk keeps its own 300', async () => {
        const body = await openDay(t, TODAY);
        await t.checkpoint('day-with-walk-steps');
        await t.check(/Steps[^]*?2,500 steps/.test(body), `My Day's steps total is not 2,500: ${body.slice(0, 400)}`);
        await t.check(!/2,800/.test(body), `My Day shows 2,800 steps (day total plus the walk’s): ${body.slice(0, 400)}`);
        await t.check(/Walk[^]*?300 steps/.test(body), `the walk does not keep its own 300 measured steps: ${body.slice(0, 400)}`);
        await view(t.page, 'Trends');
        const trends = flat(await text(t.page.getByRole('main')));
        await t.check(/Steps[^]*?2,500 steps/.test(trends) && !/2,800/.test(trends), `Trends steps is not 2,500: ${trends.slice(0, 300)}`);
        await t.checkpoint('trends-steps');
      });
    },
  },
  {
    name: 'fixture: overlapping movement intervals',
    async run(t) {
      const page = await t.open({ seed: persona('P01'), route: '/today' });
      const main = page.getByRole('main');
      const walk = (w, start, minutes) => ['walkDuration', 'movementMinutes'].map(kind => data.obs({
        id: `fx-${w}-${kind}`, kind, value: minutes, scope: 'sessionObserved', source: 'measured', at: at(start), coverageMs: minutes * 60000, context: `walk:fx-${w}`,
      }));
      const doc = data.transferDoc({ observations: [...walk('a', '08:00:00', 10), ...walk('b', '08:05:00', 5)] });
      await t.step(1, 'Choose a weekly goal of 150 minutes, then import 10 min at 08:00 and 5 min at 08:05', async () => {
        await ui.tab(page, 'Today');
        await ui.tap(ui.row(main, 'Set a weekly goal'));
        const goal = page.getByRole('dialog', { name: 'Weekly movement goal' });
        await ui.type(goal.getByRole('textbox', { name: 'Minutes each week', exact: true }), '150');
        await ui.tap(ui.button(goal, 'Save goal'));
        await goal.waitFor({ state: 'hidden' });
        await importFixture(t, 'overlap.json', doc);
      }, { input: 'goal 150; walkDuration+movementMinutes 10 min at 08:00 and 5 min at 08:05' });
      await t.step(2, 'Overlap is explained; no 15-minute claim and no ring from it', async () => {
        const body = await openDay(t, TODAY);
        await t.checkpoint('overlap-day');
        await t.check(/overlap/i.test(body), `no overlap explanation on My Day: ${body.slice(0, 500)}`);
        const ring = await main.getByRole('button', { name: /^Recorded movement:/ }).getAttribute('aria-label').catch(() => null);
        await t.check(ring !== null && !/\b15 of 150\b/.test(ring), `the ring is built from the invalid sum: ${ring}`);
        await t.check(!/\b15 min(utes)?\b/.test(body) || /overlap/i.test(body.match(/.{0,80}\b15 min(utes)?\b.{0,80}/)?.[0] ?? ''), `My Day claims 15 minutes recorded: ${body.match(/.{0,80}\b15 min(utes)?\b.{0,80}/)?.[0]}`);
        await ui.tab(page, 'Today');
        const today = flat(await text(page.getByRole('main')));
        await t.check(!/\b15 (of 150 )?min/.test(today), `Today claims 15 minutes this week: ${today.match(/.{0,60}15.{0,60}/)?.[0]}`);
        await t.checkpoint('overlap-today');
        t.note(`ring: ${ring}`);
      });
    },
  },
  ...[
    { name: 'fixture: same-instant totals in one file, ids ascending', ids: ['fx-total-a', 'fx-total-b'], files: 1 },
    { name: 'fixture: same-instant totals in one file, ids descending', ids: ['fx-total-z', 'fx-total-a'], files: 1 },
    { name: 'fixture: same-instant totals in two commits, ids descending', ids: ['fx-total-z', 'fx-total-a'], files: 2 },
  ].map(row => ({
    name: row.name,
    async run(t) {
      await t.open({ seed: persona('P01'), route: '/today' });
      // As an export writes them: in commit order, each with its device's seq.
      const first = data.obs({ id: row.ids[0], kind: 'steps', value: 2000, scope: 'dayTotal', source: 'manual', at: at('08:00:00'), seq: 41 });
      const second = data.obs({ id: row.ids[1], kind: 'steps', value: 2500, scope: 'dayTotal', source: 'manual', at: at('08:00:00'), seq: 42 });
      await t.step(1, `Import 2000 then 2500 at the same instant (${row.files === 1 ? 'one file' : 'two files, 2000 first'})`, async () => {
        if (row.files === 1) await importFixture(t, 'same-instant.json', data.transferDoc({ observations: [first, second] }));
        else {
          await importFixture(t, 'same-instant-1.json', data.transferDoc({ observations: [first] }));
          await importFixture(t, 'same-instant-2.json', data.transferDoc({ observations: [second] }));
        }
      }, { input: `steps 2000 (${row.ids[0]}) then 2500 (${row.ids[1]}), both at ${at('08:00:00')}` });
      await t.step(2, 'The later statement, 2500, is the day total', async () => {
        const body = await openDay(t, TODAY);
        await t.checkpoint('same-instant-day');
        await t.check(/Steps[^]*?2,500 steps/.test(body), `the day total is not the later statement 2,500: ${body.match(/Steps.{0,80}/)?.[0] ?? body.slice(0, 300)}`);
        await t.check(!/4,500/.test(body), 'the two statements were added');
        const snap = await t.db();
        await t.check((snap.observations ?? []).filter(o => o.kind === 'steps').length === 2, 'both statements are not kept');
      });
    },
  })),
  {
    name: 'fixture: imported glucose 110 mg/dL and 6 mmol/L',
    async run(t) {
      await t.open({ seed: persona('P01'), route: '/today' });
      const doc = data.transferDoc({
        observations: [
          data.obs({ id: 'fx-glu-mg', kind: 'glucose', value: 110, unit: 'mg/dL', source: 'imported', at: at('08:00:00') }),
          data.obs({ id: 'fx-glu-mmol', kind: 'glucose', value: 6, unit: 'mmol/L', source: 'imported', at: at('08:30:00') }),
        ],
      });
      await t.step(1, 'Import the two readings', () => importFixture(t, 'two-units.json', doc), { input: 'glucose 110 mg/dL imported 08:00; 6 mmol/L imported 08:30' });
      await t.step(2, 'Each keeps its unit and source; no average, no unit swapped onto the other', async () => {
        const body = await openDay(t, TODAY);
        await t.checkpoint('two-units-day');
        const rows = (await dayRows(t.page)).filter(r => r.text.startsWith('Glucose'));
        await t.check(rows.length === 2, `My Day shows ${rows.length} glucose rows: ${JSON.stringify(rows.map(r => r.text))}`);
        await t.check(rows.some(r => /110 mg\/dL/.test(r.text)), `the 110 mg/dL reading is not shown as 110 mg/dL: ${JSON.stringify(rows.map(r => r.text))}`);
        await t.check(rows.some(r => /\b6(\.0)? mmol\/L|\b108 mg\/dL/.test(r.text)), `the 6 mmol/L reading is not shown as 6 mmol/L (or its exact 108 mg/dL): ${JSON.stringify(rows.map(r => r.text))}`);
        await t.check(!/\b58\b/.test(body) && !/\b6(\.0)? mg\/dL|\b110(\.0)? mmol\/L/.test(body), `a raw average or a swapped unit is shown: ${body.slice(0, 400)}`);
        await t.check(rows.every(r => /Imported/.test(r.text)), `the imported source is not shown on both: ${JSON.stringify(rows.map(r => r.text))}`);
        const snap = await t.db();
        const g = (snap.observations ?? []).filter(o => o.id.startsWith('fx-glu'));
        await t.check(g.length === 2 && g.every(o => o.source === 'imported') && g.find(o => o.id === 'fx-glu-mmol')?.unit === 'mmol/L' && g.find(o => o.id === 'fx-glu-mg')?.unit === 'mg/dL',
          `stored: ${JSON.stringify(g)}`);
        await view(t.page, 'Trends');
        const trends = flat(await text(t.page.getByRole('main')));
        await t.check(!/Glucose[^]{0,40}\b58\b/.test(trends), `Trends shows an averaged glucose: ${trends.slice(0, 200)}`);
      });
    },
  },
  {
    name: 'fixture: BP halves from two readings at one instant',
    async run(t) {
      await t.open({ seed: persona('P01'), route: '/today' });
      const half = (r, kind, value) => data.obs({ id: `fx-${r}:${kind}`, kind, value, unit: 'mmHg', source: 'manual', at: at('08:00:00'), context: `bp:fx-${r}` });
      const doc = data.transferDoc({
        observations: [
          half('a', 'bloodPressureSystolic', 130), half('a', 'bloodPressureDiastolic', 80),
          half('b', 'bloodPressureSystolic', 140), half('b', 'bloodPressureDiastolic', 90),
        ],
      });
      await t.step(1, 'Import A 130/80 and B 140/90 at the same instant', () => importFixture(t, 'bp-contexts.json', doc), { input: 'bp:fx-a 130/80, bp:fx-b 140/90, both 08:00' });
      await t.step(2, 'A and B are shown as themselves, never mixed', async () => {
        const body = await openDay(t, TODAY);
        await t.checkpoint('bp-day');
        await t.check(/130\/80 mmHg/.test(body) && /140\/90 mmHg/.test(body), `My Day does not show both 130/80 and 140/90: ${body.slice(0, 400)}`);
        await t.check(!/130\/90|140\/80/.test(body), `My Day mixes the halves: ${body.match(/1[34]0\/[89]0/g)}`);
        await view(t.page, 'Trends');
        const trends = flat(await text(t.page.getByRole('main')));
        await t.check(!/130\/90|140\/80/.test(trends), `Trends mixes the halves: ${trends.slice(0, 300)}`);
        await ui.tap(t.page.getByRole('main').getByRole('link', { name: /^Blood pressure/ }));
        await waitRoute(t, /^\/track\/metric/);
        await t.page.getByRole('heading', { level: 1, name: 'Blood pressure', exact: true }).waitFor();
        const detail = flat(await text(t.page.getByRole('main')));
        await t.check(!/130\/90|140\/80/.test(detail), `the blood pressure chart or list mixes the halves: ${detail.slice(0, 300)}`);
        await t.checkpoint('bp-metric');
      });
    },
  },
  {
    name: 'fixture: weights either side of local midnight, IST then New York',
    async run(t) {
      const NOW9 = Date.parse('2026-10-09T00:01:00+05:30');
      await t.open({ seed: persona('P01'), route: '/today', time: NOW9 });
      const doc = data.transferDoc({
        observations: [
          data.obs({ id: 'fx-w79', kind: 'weight', value: 79, unit: 'kg', source: 'manual', at: '2026-10-08T23:59:00.000+05:30' }),
          data.obs({ id: 'fx-w80', kind: 'weight', value: 80, unit: 'kg', source: 'manual', at: '2026-10-09T00:01:00.000+05:30' }),
        ],
      });
      let backup;
      await t.step(1, 'At 00:01 on 9 October, import 79 kg at 23:59 on the 8th and 80 kg at 00:01 on the 9th', () => importFixture(t, 'midnight.json', doc),
        { input: 'weight 79 at 2026-10-08T23:59+05:30, 80 at 2026-10-09T00:01+05:30; NOW 2026-10-09T00:01+05:30' });
      await t.step(2, 'Two local days in Kolkata', async () => {
        const nine = await openDay(t, '2026-10-09');
        await t.check(/Weight[^]*?80\.0 kg/.test(nine) && !/79\.0 kg/.test(nine), `9 October does not hold just the 80 kg reading: ${nine.slice(0, 300)}`);
        const eight = await openDay(t, '2026-10-08');
        await t.check(/Weight[^]*?79\.0 kg/.test(eight) && !/80\.0 kg/.test(eight), `8 October does not hold just the 79 kg reading: ${eight.slice(0, 300)}`);
        await t.checkpoint('midnight-ist');
        backup = await data.backup(t, { expectVia: 'download' });
      });
      await t.step(3, 'Reopen the same records in America/New_York: day keys stay 8 and 9 October', async () => {
        await t.context.close();
        const page = await t.open({ seed: null, route: '', time: NOW9, contextOptions: { timezoneId: 'America/New_York' } });
        const file = data.writeFixture(t, backup.name, backup.bytes);
        const sheet = await data.chooseRestore(t, file, { from: 'welcome' });
        await ui.tap(ui.button(sheet, 'Restore'));
        await data.restoredFromWelcome(t, sheet);
        const snap = await t.checkpoint('midnight-new-york');
        const w = Object.fromEntries((snap.observations ?? []).filter(o => o.id.startsWith('fx-w')).map(o => [o.id, o.day]));
        await t.check(w['fx-w79'] === '2026-10-08' && w['fx-w80'] === '2026-10-09', `stored day keys in New York: ${JSON.stringify(w)}`);
        const eight = await openDay(t, '2026-10-08');
        await t.check(/79\.0 kg/.test(eight), `New York's 8 October does not show the 79 kg reading: ${eight.slice(0, 300)}`);
        t.note(`New York 8 October shows: ${eight.match(/Weight.{0,60}/g)?.join(' | ')}`);
      });
    },
  },
  {
    name: 'fixture: two readings at the repeated 01:30 of a DST fall-back',
    async run(t) {
      await t.open({ seed: persona('P01'), route: '/today', time: Date.parse('2026-11-02T09:00:00-05:00'), contextOptions: { timezoneId: 'America/New_York' } });
      const doc = data.transferDoc({
        observations: [
          data.obs({ id: 'fx-dst-1', kind: 'glucose', value: 110, unit: 'mg/dL', source: 'manual', at: '2026-11-01T01:30:00.000-04:00' }),
          data.obs({ id: 'fx-dst-2', kind: 'glucose', value: 120, unit: 'mg/dL', source: 'manual', at: '2026-11-01T01:30:00.000-05:00' }),
        ],
      });
      await t.step(1, 'Import 110 at 01:30-04:00 and 120 at 01:30-05:00 on 1 November', () => importFixture(t, 'dst.json', doc), { input: 'glucose 110 @ 2026-11-01T01:30-04:00; 120 @ 2026-11-01T01:30-05:00 (America/New_York)' });
      await t.step(2, 'Two distinct readings on 1 November, the -04:00 one first', async () => {
        await openDay(t, '2026-11-01');
        await t.checkpoint('dst-day');
        const rows = (await dayRows(t.page)).filter(r => r.text.startsWith('Glucose'));
        await t.check(rows.length === 2, `1 November shows ${rows.length} glucose readings: ${JSON.stringify(rows.map(r => r.text))}`);
        await t.check(rows.length === 2 && /110 mg\/dL/.test(rows[0].text) && /120 mg\/dL/.test(rows[1].text), `the readings are not in chronological order: ${JSON.stringify(rows.map(r => r.text))}`);
        const snap = await t.db();
        const days = (snap.observations ?? []).filter(o => o.id.startsWith('fx-dst')).map(o => o.day);
        await t.check(days.length === 2 && days.every(d => d === '2026-11-01'), `stored day keys: ${JSON.stringify(days)}`);
      });
    },
  },
];

export const cases = [{ name: 'my day sequence', run: sequence }, ...fixtureCases];
