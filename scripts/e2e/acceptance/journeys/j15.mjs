/**
 * J15, P05: foot restriction applies to Walk (codex-acceptance.md, SAFETY 7
 * of 10; basis D28, D30; H-FOOT/EYE; ADA exercise statement 2016 Table 5 and
 * ACSM 2022 Table 5).
 *
 * Five independent rows, each in a fresh context:
 *   active ulcer        — steps 1–3 (P05 as specified; Stretch in step 3)
 *   active ulcer, Guided — step 3's Guided session, P05 seeded in the programme
 *   hot red swollen     — step 4 (healthy foot status, neuropathy yes)
 *   legacy green        — step 5 (a stored green readiness, foot facts kept)
 *   severe retinopathy  — step 6 (no current foot restriction; seeded in the programme)
 *
 * P05 is not in the programme, and outside it there is no guided session to
 * start (D35). The two rows that inspect the Guided session seed P05 enrolled
 * (fixtures ENROLLED), the spec's defined setup.
 */
import { MINUTE, NOW } from '../lib/env.mjs';
import { docs } from '../lib/harness.mjs';
import * as ui from '../lib/ui.mjs';
import * as mv from '../lib/move.mjs';
import { ENROLLED, persona } from '../fixtures/personas.mjs';
import { STARTERS, atSummary, buttonLabels, flagged, namesWith, openGuided, outcome, progress, stepRows, stepThrough, stretchPreview, walkRows, openApp } from '../lib/safety-c.mjs';

export const id = 'J15';
export const title = 'Foot restriction applies to Walk';
export const safety = true;

const WEIGHT_BEARING = namesWith('weightBearing: true');
const HEAD_DOWN = namesWith('headBelowHeart: true');
const STRAIN = new Set([...namesWith('valsalva: 2'), ...namesWith('isometricHold: 2'), ...namesWith('axialLoad: 2'), ...namesWith('overhead: true')]);
/** Cardio a home with no equipment cannot do, or that loads the feet. */
const NO_HOME_CARDIO = ['Incline Treadmill Walk', 'Elliptical', 'Brisk Walk', 'Recumbent Bike', 'Upright Bike', 'Rowing Machine'];

const FOOT_WORDS = /foot|feet/i;
const CARE = /clinician|doctor|healed|looked at|assess|care team/i;
const WORKAROUND = /easy walk|gentle walk|short walk|stroll|walk instead/i;

/** The walk is refused on the sheet: the headline, a foot reason and a care direction, and no way to start it. */
async function walkRefusedOnSheet(t, sheet, label) {
  const { title, text } = await outcome(t.page);
  await t.check(title === 'No walk for now' || /^No exercise today|^Call emergency/.test(title ?? ''), `${label}: the walk outcome reads “${title}”, not a refusal`);
  await t.check(FOOT_WORDS.test(text), `${label}: no foot-protection reason is given (${text.slice(0, 200)})`);
  await t.check(CARE.test(text), `${label}: no care direction is given (${text.slice(0, 200)})`);
  await t.check(!(await mv.sheetStart(sheet).count()), `${label}: the check-in still offers ${await mv.sheetStart(sheet).allInnerTexts()}`);
  const offers = (await buttonLabels(sheet)).filter(l => STARTERS.test(l) || WORKAROUND.test(l));
  await t.check(offers.length === 0, `${label}: the refused walk still offers ${JSON.stringify(offers)}`);
  await t.check(!WORKAROUND.test(text), `${label}: an “easy walk” style workaround is offered (${text.slice(0, 200)})`);
}

/** Walk from Move (answering the check-in when asked), then from Today's chooser. */
/**
 * Move → Walk. The setup screen either offers Start walk (which opens the
 * check-in) or, once today's answers already refuse it, says so itself.
 */
async function walkFromMove(t, answers, tag) {
  const page = t.page;
  const main = page.getByRole('main');
  await ui.tab(page, 'Move');
  await ui.tap(ui.row(main, 'Walk', 'link'));
  await page.getByRole('heading', { level: 1, name: 'Walk', exact: true }).waitFor();
  await page.waitForTimeout(300);
  const start = ui.button(main, 'Start walk');
  if (!(await start.count())) {
    const text = (await main.innerText()).replace(/\s+/g, ' ');
    await t.checkpoint(`${tag}-walk-setup-refused`);
    await t.check(/No walk|No walking/i.test(text) && FOOT_WORDS.test(text) && CARE.test(text), `the Walk setup has no Start walk and no clear refusal: ${text.slice(0, 240)}`);
    const offers = (await buttonLabels(main)).filter(l => STARTERS.test(l) || WORKAROUND.test(l));
    await t.check(offers.length === 0, `the refused Walk setup still offers ${JSON.stringify(offers)}`);
    return { text, title: /No walk[^.]*/.exec(text)?.[0] };
  }
  await ui.tap(start);
  await page.waitForTimeout(500);
  const sheet = mv.checkInSheet(page);
  await t.must(await sheet.count() === 1, `Move → Walk → Start walk opened ${await t.route()} without the check-in`);
  if (await sheet.getByRole('heading', { name: 'Right now, any of these?', exact: true }).count()) {
    await t.checkpoint(`${tag}-walk-check-in`);
    await ui.answerCheckIn(t, sheet, answers);
    await page.waitForTimeout(500);
  }
  await t.checkpoint(`${tag}-walk-refused-move`);
  await walkRefusedOnSheet(t, sheet, 'Move → Walk');
  const result = await outcome(page);
  await ui.tap(ui.button(sheet, 'Close'));
  await sheet.waitFor({ state: 'hidden' });
  await t.check(!/^\/walk\/live/.test(await t.route()), `Move → Walk reached ${await t.route()}`);
  return result;
}

async function walkBothWays(t, answers, tag) {
  const page = t.page;
  const moveOutcome = await walkFromMove(t, answers, tag);

  const fromToday = await mv.enter(t, 'walk', 'chooser');
  if (fromToday.sheet) {
    await t.checkpoint(`${tag}-walk-refused-today`);
    await walkRefusedOnSheet(t, fromToday.sheet, 'Today → Choose something else → Walk');
    await ui.tap(ui.button(fromToday.sheet, 'Close'));
    await fromToday.sheet.waitFor({ state: 'hidden' });
  } else {
    // Straight into Walk setup: its Start must still refuse.
    await t.check(!/^\/walk\/live/.test(fromToday.route), `Today → Walk went straight to ${fromToday.route}`);
    if (/^\/walk/.test(fromToday.route)) {
      await ui.tap(ui.button(page.getByRole('main'), 'Start walk'));
      const sheet = mv.checkInSheet(page);
      await t.check(await sheet.count() === 1, 'Today → Walk → Start walk opened no refusal');
      if (await sheet.count()) { await walkRefusedOnSheet(t, sheet, 'Today → Walk → Start walk'); await ui.tap(ui.button(sheet, 'Close')); }
    }
  }
  const snap = await t.db();
  await t.check(walkRows(snap).length === 0, `a refused walk left movement records: ${JSON.stringify(walkRows(snap).map(o => o.id))}`);
  await t.check(!(snap.sessions ?? []).some(s => /walk/i.test(`${s.planKind ?? ''} ${s.focus ?? ''}`)), 'a refused walk left a session');
  return moveOutcome;
}

/** The start screen of a player, as blocks: Mobility/Strength/Cardio with their detail lines. */
async function startScreenBlocks(page) {
  const main = page.getByRole('main');
  const text = await main.innerText();
  const block = name => {
    const m = new RegExp(`${name} · (\\d+) min\\n([^\\n]*)`).exec(text);
    return m ? { minutes: Number(m[1]), detail: m[2] } : undefined;
  };
  return { mobility: block('Mobility'), strength: block('Strength'), cardio: block('Cardio'), text };
}

/** Stretch: the preview must hold only work the restriction allows; it must not be refused outright. */
async function inspectStretch(t, { forbidden, label }) {
  const page = t.page;
  await t.goto('/move');
  await ui.tap(ui.row(page.getByRole('main'), 'Stretch', 'link'));
  await page.getByRole('heading', { level: 1, name: 'Stretch', exact: true }).waitFor();
  const names = await stretchPreview(page);
  await t.checkpoint(`${label}-stretch-preview`);
  await t.check(names.length > 0, `${label}: the Stretch preview lists no routine (${(await page.getByRole('main').innerText()).slice(0, 200)})`);
  const bad = flagged(names, forbidden);
  await t.check(bad.length === 0, `${label}: the Stretch routine includes ${JSON.stringify(bad)}`);
  return names;
}

/** After the check-in: Start, then run the player by time, recording what it shows. */
async function runStretch(t, label, forbidden) {
  const page = t.page;
  await ui.tap(ui.button(page.getByRole('main'), 'Start stretch'));
  await page.waitForTimeout(500);
  const sheet = mv.checkInSheet(page);
  if (await sheet.count()) {
    if (await sheet.getByRole('heading', { name: 'Right now, any of these?', exact: true }).count()) await ui.answerCheckIn(t, sheet, ui.normalAnswers('P05'));
    await page.waitForTimeout(400);
    const { title, text } = await outcome(page);
    await t.checkpoint(`${label}-stretch-outcome`);
    await t.check(title === 'Go ahead, with changes' || title === 'Good to go', `${label}: Stretch was refused (“${title}”); a walk restriction must not ban seated work. ${text.slice(0, 200)}`);
    const start = mv.sheetStart(sheet);
    if (!(await start.count())) return { ran: false };
    await ui.tap(start);
  }
  await page.waitForTimeout(800);
  const startText = await page.getByRole('main').innerText();
  const first = /Starts with ([^\n]+)/.exec(startText)?.[1] ?? '';
  await t.check(flagged([first], forbidden).length === 0, `${label}: the stretch player starts with ${first}`);
  await ui.tap(ui.button(page.getByRole('main'), 'Start'));
  await page.waitForTimeout(600);
  const plan = (await progress(page, 'stretch'))?.plan;
  const seen = [];
  for (let i = 0; i < 20; i++) {
    if (await atSummary(page)) break;
    const h = (await page.getByRole('main').getByRole('heading', { level: 1 }).innerText().catch(() => '')).trim();
    if (h && seen.at(-1) !== h) seen.push(h);
    await t.advance(MINUTE);
  }
  await t.checkpoint(`${label}-stretch-ran`);
  const bad = flagged(seen, forbidden);
  await t.check(bad.length === 0, `${label}: the stretch player ran ${JSON.stringify(bad)}`);
  return { ran: true, seen, plan };
}

/** Guided: the start screen and every step that settles on screen. */
async function inspectGuided(t, label, forbidden, { homeCardio = false } = {}) {
  const page = t.page;
  await t.goto('/move');
  const r = await openGuided(t);
  // The seeded enrolment did not take: Move offers only the way to join (D35).
  await t.must(!r.viaProgramme, `${label}: Move → Guided session opens the programme page, not a session, for the enrolled seed`);
  if (r.sheet) {
    if (await r.sheet.getByRole('heading', { name: 'Right now, any of these?', exact: true }).count()) await ui.answerCheckIn(t, r.sheet, ui.normalAnswers('P05'));
    await page.waitForTimeout(400);
    const { title, text } = await outcome(page);
    await t.checkpoint(`${label}-guided-outcome`);
    const start = mv.sheetStart(r.sheet);
    if (!(await start.count())) {
      // Refusing the whole session is acceptable only with a reason; a seated session is what the spec expects to be possible.
      t.note(`${label}: Guided session refused: “${title}” — ${text.slice(0, 160)}`);
      await ui.tap(ui.button(r.sheet, 'Close'));
      return { ran: false, title };
    }
    await ui.tap(start);
  }
  await page.waitForTimeout(800);
  const blocks = await startScreenBlocks(page);
  await t.checkpoint(`${label}-guided-start`);
  const named = [blocks.mobility?.detail ?? '', ...(blocks.strength?.detail ?? '').split(', '), blocks.cardio?.detail ?? ''].filter(Boolean);
  const bad = flagged(named, forbidden);
  await t.check(bad.length === 0, `${label}: the guided start screen promises ${JSON.stringify(bad)}`);
  if (homeCardio) {
    const cardioBad = NO_HOME_CARDIO.filter(n => (blocks.cardio?.detail ?? '').includes(n));
    await t.check(cardioBad.length === 0, `${label}: the guided session’s cardio is ${JSON.stringify(cardioBad)} (weight-bearing, or equipment a home without any lacks)`);
  }
  await ui.button(page.getByRole('main'), 'Start').click({ timeout: 20000 });
  const { seen, done } = await stepThrough(t, 140);
  await t.checkpoint(`${label}-guided-stepped`);
  const ran = flagged(seen, forbidden);
  await t.check(ran.length === 0, `${label}: the guided player put ${JSON.stringify(ran)} on screen`);
  if (homeCardio) {
    const cardioRan = seen.filter(s => NO_HOME_CARDIO.some(n => s.includes(n)));
    await t.check(cardioRan.length === 0, `${label}: the guided player ran cardio ${JSON.stringify(cardioRan)}`);
  }
  t.note(`${label}: guided steps shown (${done ? 'to the end' : 'stopped early'}): ${seen.join(' · ').slice(0, 900)}`);
  return { ran: true, seen, done };
}

/** A paused walk from earlier this morning, as the walk screen keeps it in the tab (fixture). */
const savedWalk = {
  version: 1, id: 'accwalk-0815-resume', plan: { kind: 'walk', gps: true, steps: false },
  startedAt: NOW - 45 * MINUTE, status: 'paused',
  segments: [{ start: NOW - 45 * MINUTE, end: NOW - 40 * MINUTE, endedBy: 'paused', distanceM: 0, gpsMs: 0, gpsFixes: 0, steps: 0, motion: false }],
  gaps: [], seenAt: NOW - 40 * MINUTE, saved: [],
};

export const cases = [
  {
    name: 'active ulcer',
    async run(t) {
      const page = await openApp(t, { seed: persona('P05'), route: '/today', sensors: { geo: 'grant' } });
      await t.step(1, 'Normal current answers, then Walk from Move and from Today', async () => {
        await t.checkpoint('today');
        await walkBothWays(t, ui.normalAnswers('P05'), 'ulcer');
      }, { input: 'P05 (neuropathy, current wound); normal current answers, glucose blank' });

      await t.step(2, 'A valid-looking /walk/live deep link and a saved walk resume', async () => {
        const before = await page.evaluate(() => window.__acc.calls.geolocation);
        await t.goto('/walk/live?id=acc0815-deeplink&gps=1');
        await page.waitForTimeout(800);
        await t.checkpoint('deep-link');
        const main = page.getByRole('main');
        const route = await t.route();
        const live = /^\/walk\/live/.test(route);
        const controls = (await buttonLabels(main)).filter(l => /^(Pause|Resume|Finish)$/.test(l));
        await t.check(!live || controls.length === 0, `the deep link opened a live walk with ${JSON.stringify(controls)} at ${route}`);
        await t.advance(MINUTE);
        let snap = await t.db();
        await t.check(walkRows(snap).length === 0, `the deep link recorded movement: ${JSON.stringify(walkRows(snap).map(o => o.id))}`);
        const stored = await page.evaluate(() => sessionStorage.getItem('fit-strong-walk'));
        await t.check(stored === null, `the deep link started a walk in progress: ${String(stored).slice(0, 160)}`);
        const geo = await page.evaluate(() => window.__acc.calls.geolocation);
        await t.check(geo === before, `GPS was started for a refused walk (${geo - before} location call(s))`);

        // A walk paused earlier this morning, kept in the tab as the walk screen keeps it.
        await page.evaluate(w => sessionStorage.setItem('fit-strong-walk', JSON.stringify(w)), savedWalk);
        await t.goto('/walk/live');
        await page.waitForTimeout(800);
        const text = await main.innerText();
        await t.checkpoint('saved-walk-resume');
        const resume = main.getByRole('button', { name: /^(Resume|Continue walking|I am fine: carry on walking)$/ });
        await t.check(!(await resume.count()), `the saved walk offers ${await resume.allInnerTexts()} to a protected foot`);
        await t.check(/on hold|No walk|No walking|not.*walk|foot/i.test(text), `the saved walk shows no refusal: ${text.slice(0, 240)}`);
        if (await resume.count()) {
          // Evidence of what Resume does, recorded above as a failure already.
          await ui.tap(resume);
          await t.advance(MINUTE);
          t.note(`after tapping ${await resume.allInnerTexts()}: ${(await main.innerText()).slice(0, 200)}`);
        }
        const timer = async () => (/(\d+:\d\d)/.exec(await main.getByRole('timer').innerText().catch(() => '')) ?? [])[1];
        const t1 = await timer();
        await t.advance(MINUTE);
        const t2 = await timer();
        await t.check(t1 === t2, `the saved walk’s timer moved from ${t1} to ${t2} while the foot needs protecting`);
        snap = await t.db();
        await t.check(walkRows(snap).length === 0, `the saved-walk resume recorded movement: ${JSON.stringify(walkRows(snap).map(o => `${o.kind}:${o.value}`))}`);
        const geo2 = await page.evaluate(() => window.__acc.calls.geolocation);
        await t.check(geo2 === before, `GPS was started for the refused saved walk (${geo2 - before} location call(s))`);
        // Leave the saved walk untouched for the record (Finish and save is the person's choice).
        await page.evaluate(() => sessionStorage.removeItem('fit-strong-walk'));
      }, { input: '/walk/live?id=acc0815-deeplink&gps=1; a paused walk from 08:15 in the tab' });

      await t.step(3, 'Stretch: only seated and floor work may run', async () => {
        await inspectStretch(t, { forbidden: WEIGHT_BEARING, label: 'ulcer' });
        const stretch = await runStretch(t, 'ulcer', WEIGHT_BEARING);
        if (stretch.ran) {
          await t.check(await atSummary(page), 'the stretch never reached its summary after 20 minutes');
          if (await atSummary(page)) {
            await ui.tap(page.getByRole('button', { name: /Save and finish/ }));
            await page.waitForTimeout(800);
          }
          const snap = await t.db();
          const stretchSessions = (snap.sessions ?? []).filter(s => s.planKind === 'stretch');
          await t.check(stretchSessions.length === 1, `the seated stretch recorded ${stretchSessions.length} stretch session(s)`);
          await t.check(stepRows(snap).length === 0, `the stretch recorded steps: ${JSON.stringify(stepRows(snap).map(o => o.value))}`);
          const mobility = stretchSessions[0]?.mobility ?? [];
          const loaded = mobility.filter(m => [...WEIGHT_BEARING].some(n => (m.exerciseId ?? '').replace(/-/g, ' ').includes(n.toLowerCase().replace(/-/g, ' '))));
          await t.check(loaded.length === 0, `the stretch session records weight-bearing work: ${JSON.stringify(loaded)}`);
        }
        const snap = await t.db();
        const health = docs(snap).profile?.health ?? {};
        await t.check(health.footStatus === 'current_wound_or_active_charcot' && health.peripheralNeuropathy === 'yes', `the foot facts changed: ${health.footStatus}/${health.peripheralNeuropathy}`);
      }, { input: 'Move → Stretch (10 min Back & hips)' });
    },
  },
  {
    name: 'active ulcer: guided session',
    async run(t) {
      t.note('defined setup: P05 seeded in the programme (settings.startDate 2026-09-24, training Mon/Thu/Sat), so Thursday has a guided session');
      const page = await openApp(t, { seed: persona('P05', { patch: ENROLLED }), route: '/today' });
      await t.step(3, 'Guided session: only seated and floor work may run', async () => {
        const guided = await inspectGuided(t, 'ulcer', WEIGHT_BEARING, { homeCardio: true });
        if (guided.ran) {
          await page.waitForTimeout(800);
          const snap = await t.db();
          const g = (snap.sessions ?? []).filter(s => s.planKind !== 'stretch' && s.date === '2026-10-08');
          const cardio = g.map(s => s.cardio).filter(Boolean);
          await t.check(cardio.every(c => !c.minutes || c.minutes === 0), `skipped cardio was recorded as done: ${JSON.stringify(cardio)}`);
          await t.check(stepRows(snap).length === 0, `the guided session recorded steps: ${JSON.stringify(stepRows(snap))}`);
        }
        const snap = await t.db();
        const health = docs(snap).profile?.health ?? {};
        await t.check(health.footStatus === 'current_wound_or_active_charcot' && health.peripheralNeuropathy === 'yes', `the foot facts changed: ${health.footStatus}/${health.peripheralNeuropathy}`);
      }, { input: 'P05 in the programme (defined setup); normal current answers; Move → Guided session' });
    },
  },
  {
    name: 'hot red swollen foot',
    async run(t) {
      await openApp(t, { seed: persona('P05', { patch: { profile: { health: { footStatus: 'healthy' } } } }), route: '/today' });
      await t.step(4, 'Healthy stored foot, neuropathy yes, a foot newly hot, red or swollen', async () => {
        const { text } = await walkBothWays(t, ui.normalAnswers('P05', { news: [ui.NEWS.hotSwollenFoot] }), 'hot-foot');
        await t.check(/clinician|doctor/i.test(text) && /promptly|today/i.test(text), `the refused walk does not advise prompt clinical assessment: ${text.slice(0, 240)}`);
        const snap = await t.db();
        const today = (docs(snap).checkIns ?? []).find(c => c.date === '2026-10-08');
        await t.check(!!today && today.news?.includes('hotSwollenFoot'), `the hot, red or swollen foot answer was not stored: ${JSON.stringify(today?.news)}`);
        const reasons = (today?.readiness?.reasons ?? []).map(r => r.message).join(' ');
        await t.check(/clinician|promptly|today/i.test(reasons), `the stored reason does not advise prompt clinical assessment: ${reasons.slice(0, 200)}`);
        const health = docs(snap).profile?.health ?? {};
        await t.check(health.footStatus === 'healthy' && health.peripheralNeuropathy === 'yes', `the foot facts changed: ${health.footStatus}/${health.peripheralNeuropathy}`);
        // Seated work is still open: a walk restriction is not a blanket ban.
        await inspectStretch(t, { forbidden: WEIGHT_BEARING, label: 'hot-foot' });
        await ui.tap(ui.button(t.page.getByRole('main'), 'Start stretch'));
        await t.page.waitForTimeout(500);
        const sheet = mv.checkInSheet(t.page);
        if (await sheet.count()) {
          const { title } = await outcome(t.page);
          await t.check(title === 'Go ahead, with changes' || title === 'Good to go', `Stretch was refused (“${title}”) for a foot that only rules out walking`);
          await t.checkpoint('hot-foot-stretch-outcome');
        }
      }, { input: `news: “${ui.NEWS.hotSwollenFoot}”; otherwise normal answers` });
    },
  },
  {
    name: 'legacy green readiness',
    async run(t) {
      const green = {
        date: '2026-10-08', urgentSymptoms: false, news: [], sleep: 'gt7', energy: 4,
        readiness: { outcome: 'green', modifiers: [], back: 'none', nerveFlag: false, reasons: [], actions: [], vigorousLocked: false, capHeavy: false, rpeOnly: false, notices: [] },
      };
      const page = await openApp(t, { seed: persona('P05', { patch: { checkIns: [green] } }), route: '/today' });
      await t.step(5, 'Only the stored readiness colour is green; the foot facts are kept', async () => {
        await t.checkpoint('today-green-seed');
        const today = await page.getByRole('main').innerText();
        await t.check(!/Good to go/i.test(today), 'Today calls a protected foot “Good to go”');
        await walkBothWays(t, ui.normalAnswers('P05'), 'green');
        await t.goto('/walk/live?id=acc0900-greenseed&gps=1');
        await page.waitForTimeout(800);
        const controls = (await buttonLabels(page.getByRole('main'))).filter(l => /^(Pause|Resume|Finish)$/.test(l));
        await t.check(!(/^\/walk\/live/.test(await t.route()) && controls.length), `the green record let /walk/live run: ${JSON.stringify(controls)}`);
        await t.checkpoint('green-deep-link');
        await inspectStretch(t, { forbidden: WEIGHT_BEARING, label: 'green' });
        const snap = await t.db();
        await t.check(walkRows(snap).length === 0, 'the green record let a walk be recorded');
      }, { input: 'stored check-in for 2026-10-08 with readiness.outcome green and no modifiers' });
    },
  },
  {
    name: 'severe retinopathy',
    async run(t) {
      // In the programme (defined setup) so there is a guided session to preview (D35).
      t.note('defined setup: P05 seeded in the programme (settings.startDate 2026-09-24, training Mon/Thu/Sat), so Thursday has a guided session');
      await openApp(t, { seed: persona('P05', { patch: { ...ENROLLED, profile: { health: { footStatus: 'healthy', retinopathy: 'severe_or_proliferative' } } } }), route: '/today' });
      await t.step(6, 'Severe or proliferative retinopathy, no current foot restriction: preview Stretch and Guided', async () => {
        const forbidden = new Set([...HEAD_DOWN, ...STRAIN]);
        const names = await inspectStretch(t, { forbidden, label: 'eye' });
        const text = await t.page.getByRole('main').innerText();
        await t.check(!/\d+\s*(°|degrees?)/.test(text), `the stretch restriction invents an angle: ${/[^\n]*\d+\s*(°|degrees?)[^\n]*/.exec(text)?.[0]}`);
        t.note(`eye: stretch routine ${names.join(', ')}`);
        const guided = await inspectGuided(t, 'eye', forbidden);
        if (guided.ran) {
          const main = await t.page.getByRole('main').innerText().catch(() => '');
          await t.check(!/\d+\s*(°|degrees?)/.test(main), 'the guided session invents an inversion angle');
        }
        const snap = await t.db();
        await t.check(docs(snap).profile?.health?.retinopathy === 'severe_or_proliferative', 'the eye fact changed');
      }, { input: 'retinopathy severe_or_proliferative, footStatus healthy, neuropathy yes' });
    },
  },
];
