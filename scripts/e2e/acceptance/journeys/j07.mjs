/**
 * J07, P01: user goals, rest, status and reminders
 * (codex-acceptance.md; basis D15, D19, D25, D26, D27, D31).
 *
 * Cases: goals and rest (steps 1, 2, 4 in sequence), the steps-goal history
 * (step 3, from 7 October — the goal lives in Track's Steps detail; until
 * that control ships its checks are reported as pending, not failed), Away
 * with the shift declined and accepted
 * (steps 5–6, from 5 October), habit prompts (step 7), the calendar file
 * (step 8), and water with a fluid limit and with kidney disease (step 9).
 */
import { docs } from '../lib/harness.mjs';
import { persona } from '../fixtures/personas.mjs';
import * as ui from '../lib/ui.mjs';
import * as g from '../lib/guide.mjs';

export const id = 'J07';
export const title = 'User goals, rest, status and reminders';
export const safety = false;

const IST = s => Date.parse(`${s}+05:30`);
const flat = s => s.replace(/\s+/g, ' ').trim();

/** Today's "Your day" weekly ring, as its accessible name says it. */
async function todayRing(page) {
  const ring = page.getByRole('main').getByRole('img', { name: /^Recorded movement this week:/ });
  return (await ring.count()) ? ring.getAttribute('aria-label') : undefined;
}

/** Open the weekly goal sheet from Today's "Set a weekly goal" row, or the ring. */
async function openGoalFromToday(t) {
  const page = t.page;
  await g.tabTo(t, 'Today');
  const main = page.getByRole('main');
  const row = ui.row(main, 'Set a weekly goal');
  if (await row.count()) await ui.tap(row);
  else await ui.tap(main.getByRole('img', { name: /^Recorded movement this week:/ }));
  const sheet = page.getByRole('dialog', { name: 'Weekly movement goal' });
  await sheet.waitFor();
  return sheet;
}

/**
 * The daily steps goal in Track's Steps detail (D27 as superseded in part:
 * optional, no default, and changing it never re-scores past days). Reached
 * the way a person does: Track → Trends → Steps, falling back to the detail's
 * own address when Trends offers no Steps card yet. Returns the control, or
 * nothing when it is not built yet.
 */
const STEPS_GOAL = /(steps?\b.*\bgoal|\bgoal\b.*\bsteps?|daily goal)/i;
async function stepsGoalControl(t) {
  const page = t.page;
  const main = page.getByRole('main');
  await g.tabTo(t, 'Track');
  await ui.tap(ui.radio(main.getByRole('radiogroup', { name: 'Show' }), 'Trends'));
  await page.waitForTimeout(300);
  const card = main.locator('a[href^="#/track/metric/steps"]');
  if (await card.count() === 1) await ui.tap(card);
  else await t.goto('/track/metric/steps');
  await page.waitForFunction(() => location.hash.startsWith('#/track/metric/steps'), null, { timeout: 10000 }).catch(() => {});
  // The Steps title itself: during the push the old My Day h1 is still on screen.
  await page.getByRole('heading', { level: 1, name: 'Steps', exact: true }).waitFor();
  const control = main.getByRole('button', { name: STEPS_GOAL }).or(main.getByRole('link', { name: STEPS_GOAL }));
  const n = await control.count();
  if (n > 1) throw new Error(`Track’s Steps detail has ${n} controls that look like the steps goal; the locator is ambiguous`);
  return n === 1 ? control : undefined;
}

/** Open the steps goal and save `value`; returns what the field showed first. */
async function setStepsGoal(t, control, value) {
  const page = t.page;
  await ui.tap(control);
  const dialog = page.getByRole('dialog');
  const scope = (await dialog.count()) ? dialog : page.getByRole('main');
  const field = scope.getByRole('textbox').or(scope.getByRole('spinbutton'));
  await t.must(await field.count() === 1, `the steps goal shows ${await field.count()} input fields, not one`);
  const before = await field.inputValue();
  await ui.type(field, String(value));
  await ui.tap(scope.getByRole('button', { name: /^(Save|Set goal|Set|Done)\b/ }));
  await page.waitForTimeout(400);
  return before;
}

// ---------------------------------------------------------------- goals and rest

async function goalsAndRest(t) {
  const page = await t.open({ seed: persona('P01'), route: '/today' });
  const main = page.getByRole('main');

  await t.step(1, 'Open Track before choosing a goal; open Weekly movement goal', async () => {
    await g.tabTo(t, 'Track');
    const track = flat(await main.innerText());
    await t.checkpoint('track-before-goal');
    await t.check(!/\bof \d+ minutes\b/.test(track) && (await main.getByRole('img', { name: /Recorded movement/ }).count()) === 0, `Track shows a ring target before any goal was chosen: ${track.slice(0, 200)}`);
    const onTrack = await ui.row(main, 'Set a weekly movement goal').count();
    await t.check(onTrack === 1, 'Track offers no way to open the Weekly movement goal on a day with no records (it is reachable only from Today)');
    const sheet = onTrack ? (await ui.tap(ui.row(main, 'Set a weekly movement goal')), page.getByRole('dialog', { name: 'Weekly movement goal' })) : await openGoalFromToday(t);
    await sheet.waitFor();
    const field = sheet.getByRole('textbox', { name: 'Minutes each week' });
    await t.check(await field.inputValue() === '', `the goal field is pre-filled with “${await field.inputValue()}”`);
    const text = flat(await sheet.innerText());
    await t.check(/each week/.test(text) && !/each day|daily ring|a day\b/.test(text), 'the movement goal is not presented as weekly');
    await t.check(!/recorded (movement|minutes)[^.]*(all|always|guarantee)[^.]*moderate/i.test(text), 'recorded minutes are promised to be moderate aerobic activity');
    await ui.tap(ui.button(sheet, 'Use WHO’s suggestion: 150 minutes'));
    await t.check(await field.inputValue() === '150', 'the WHO suggestion did not fill the field');
    await t.checkpoint('goal-sheet-suggestion');
    const before = docs(await t.db()).settings?.weeklyMovementGoalMinutes;
    await t.check(before === undefined, `the WHO suggestion was saved without Save: ${before}`);
    await ui.tap(ui.button(sheet, 'Close'));
    await sheet.waitFor({ state: 'hidden' });
    const after = docs(await t.db()).settings?.weeklyMovementGoalMinutes;
    await t.check(after === undefined, `closing the sheet kept a goal of ${after}`);
  });

  await t.step(2, 'Save a weekly goal of 20; record a five-minute timed walk; reload', async () => {
    const sheet = await openGoalFromToday(t);
    await ui.type(sheet.getByRole('textbox', { name: 'Minutes each week' }), '20');
    await ui.tap(ui.button(sheet, 'Save goal'));
    await sheet.waitFor({ state: 'hidden' });
    await t.check(docs(await t.db()).settings?.weeklyMovementGoalMinutes === 20, 'the goal of 20 was not stored');
    await g.timedWalk(t, 'P01', 5);
    await t.reload();
    await g.tabTo(t, 'Today');
    const ring = await todayRing(page);
    await t.checkpoint('today-5-of-20');
    await t.check(ring === 'Recorded movement this week: 5 of 20 minutes', `Today’s ring reads “${ring}”, not 5 of 20 minutes`);
    await g.tabTo(t, 'Track');
    const trackRing = await main.getByRole('button', { name: /^Recorded movement:/ }).getAttribute('aria-label').catch(() => undefined);
    await t.checkpoint('track-5-of-20');
    await t.check(/^Recorded movement: 5 of 20 minutes this week/.test(trackRing ?? ''), `Track’s ring reads “${trackRing}”`);
    const snap = await t.db();
    const walk = (snap.observations ?? []).filter(o => o.context?.startsWith('walk:'));
    const kinds = walk.map(o => `${o.kind}:${o.value}`).sort().join(',');
    await t.check(kinds === 'movementMinutes:5,walkDuration:5', `the walk stored ${kinds}`);
    await t.check(docs(snap).settings?.weeklyMovementGoalMinutes === 20, `the goal changed to ${docs(snap).settings?.weeklyMovementGoalMinutes}`);
  }, { input: 'goal 20 min/week; a 5-minute timed walk' });

  await t.step(4, 'Move the clock to the scheduled rest Sunday, 11 October', async () => {
    await t.setTime(IST('2026-10-11T09:00:00'));
    await t.reload();
    await g.tabTo(t, 'Today');
    const today = flat(await main.innerText());
    await t.checkpoint('today-rest-sunday');
    await t.check(/Sunday, 11 October/.test(today), `Today does not show Sunday 11 October: ${today.slice(0, 80)}`);
    const bad = [['a broken streak', /streak/i], ['a missed day or ring', /missed|behind|catch up|make up|make-up/i], ['a daily ring', /today’s ring|daily ring|close your ring/i]]
      .filter(([, re]) => re.test(today)).map(([n]) => n);
    await t.check(bad.length === 0, `the rest day shows ${bad.join(', ')}: ${today.slice(0, 300)}`);
    const card = flat(await main.getByRole('region').first().innerText());
    await t.check(!/Full Body|strength session|Upper|Lower/.test(card) || /rest/i.test(card), `the rest Sunday recommends a strength session: “${card.slice(0, 200)}”`);
    await t.check(/rest/i.test(card), `rest is not presented as part of the plan: “${card.slice(0, 200)}”`);
    await t.check(await main.getByRole('region').filter({ has: page.getByRole('heading', { level: 3 }) }).count() <= 1, 'more than one recommendation on the rest day');
    const ring = await todayRing(page);
    await t.check(ring === 'Recorded movement this week: 5 of 20 minutes', `the weekly ring on Sunday reads “${ring}”`);
  });
}

// ---------------------------------------------------------------- the steps goal (step 3)

async function stepsGoal(t) {
  const page = await t.open({ seed: persona('P01'), route: '/today', time: IST('2026-10-07T09:00:00') });
  const PENDING = 'Track’s Steps detail has no daily steps goal yet (agreed app change: optional, no default, changing it never re-scores past days)';

  await t.step(3, 'On 7 October choose a steps goal of 2500 and log 2000 steps; on 8 October change it to 3000; reopen 7 October', async () => {
    const first = await stepsGoalControl(t);
    await t.checkpoint('steps-detail-7-october');
    if (first) {
      const shown = await setStepsGoal(t, first, 2500);
      await t.check(shown === '', `the steps goal is not optional with no default: its field first showed “${shown}”`);
    } else {
      t.pending(PENDING);
    }
    // Log from My Day itself: the Steps detail is a pushed screen.
    await g.tabTo(t, 'Track');
    await g.addSteps(t, '2000');
    await t.checkpoint('steps-7-october');
    await t.setTime(IST('2026-10-08T09:00:00'));
    await t.reload();
    const second = first ? await stepsGoalControl(t) : undefined;
    if (first) {
      await t.must(!!second, 'the steps goal chosen on 7 October has no control on 8 October');
      await setStepsGoal(t, second, 3000);
    }
    await g.tabTo(t, 'Track');
    // The day's own steps against its goal are on Timeline; Trends (left chosen by the goal's way in) summarises the week.
    await ui.tap(ui.radio(page.getByRole('main').getByRole('radiogroup', { name: 'Show' }), 'Timeline'));
    await ui.trackDay(page, '2026-10-07');
    const day7 = flat(await page.getByRole('main').innerText());
    await t.checkpoint('track-7-october-later');
    await t.check(/2,?000/.test(day7), `7 October no longer shows its 2,000 steps: ${day7.slice(0, 200)}`);
    if (first) {
      // The earlier day keeps the goal it was chosen against; a later change never re-scores it.
      await t.check(/2,?500|80\s*%/.test(day7) && !/3,?000/.test(day7), `7 October is not shown against its own chosen 2,500 (80%): ${day7.slice(0, 200)}`);
    }
    const snap = await t.db();
    const steps = g.ofKind(snap, 'steps');
    await t.check(steps.length === 1 && steps[0].value === 2000 && steps[0].day === '2026-10-07' && steps[0].source === 'manual', `stored steps: ${JSON.stringify(steps.map(o => [o.value, o.day, o.source]))}`);
    if (first) {
      const settings = JSON.stringify(docs(snap).settings ?? {});
      await t.check(/2500/.test(settings) && /3000/.test(settings), `the steps goal history is not kept: settings hold ${settings.slice(0, 300)}`);
    }
  }, { input: 'steps goal 2500 on 7 Oct; 2000 steps on 7 Oct; goal 3000 on 8 Oct' });

  await t.step('3b', 'The steps suggestion has its study source and is neither a minimum nor a WHO prescription', async () => {
    await g.tabTo(t, 'Guide');
    const main = page.getByRole('main');
    await ui.type(main.getByRole('searchbox', { name: 'Search Guide' }), 'steps');
    await ui.tap(ui.row(main, 'How many steps a day?', 'link'));
    await page.getByRole('heading', { level: 1, name: 'How many steps a day?' }).waitFor();
    const card = flat(await main.innerText());
    await t.checkpoint('steps-card');
    await t.check(/7,000/.test(card) && /Ding|Lancet Public Health/.test(card), 'the ~7,000 suggestion does not name its Ding 2025 source');
    // No floor near 4,000 is expected: D27 is superseded in part (content audit F15).
    await t.check(/WHO’s guidelines are written in minutes/.test(card) && !/WHO (recommends|says)[^.]*steps/i.test(card), 'the steps suggestion is presented as a WHO prescription');
  });
}

// ---------------------------------------------------------------- Away and the plan shift (steps 5–6)

function awayCase(accept) {
  return {
    name: accept ? 'Away, shift accepted' : 'Away, shift declined',
    async run(t) {
      const page = await t.open({ seed: persona('P01'), route: '/today', time: IST('2026-10-05T09:00:00') });
      const main = page.getByRole('main');

      await t.step(5, 'On 5 October set Status Away; on 8 October select Back to normal', async () => {
        await g.openHabits(t);
        await g.setSittingBreaks(t, 30, '09:00', '18:00');
        await g.tabTo(t, 'Today');
        const sheet = await g.setStatus(t, 'Away');
        await sheet.waitFor({ state: 'hidden' });
        let snap = await t.checkpoint('today-away');
        await t.check(JSON.stringify(docs(snap).settings?.statusPeriods) === JSON.stringify([{ kind: 'away', from: '2026-10-05' }]), `stored status: ${JSON.stringify(docs(snap).settings?.statusPeriods)}`);
        const card = flat(await main.getByRole('region').first().innerText());
        await t.check(!/Full Body|strength|Upper|Lower|Check in & start/.test(card), `while Away, Today still pushes a session: “${card.slice(0, 200)}”`);
        // Quiet habits while Away: the 09:30 sitting break of 6 October must not show.
        await t.setTime(IST('2026-10-06T09:30:30'));
        await t.check((await g.banners(page)).length === 0, `a reminder showed while Away: ${(await g.banners(page)).join(' | ')}`);
        await t.checkpoint('away-6-october');
        await t.setTime(IST('2026-10-08T09:00:00'));
        await t.reload();
        snap = await t.db();
        await t.check(docs(snap).settings?.startDate === '2026-09-24', `startDate changed to ${docs(snap).settings?.startDate} while Away`);
        await g.setStatus(t, 'Normal');
        const status = page.getByRole('dialog', { name: 'Status' });
        snap = await t.checkpoint('back-to-normal-offer');
        const periods = docs(snap).settings?.statusPeriods ?? [];
        await t.check(periods.length === 1 && periods[0].kind === 'away' && periods[0].from === '2026-10-05' && periods[0].to === '2026-10-07',
          `Away history is ${JSON.stringify(periods)}, not 5 to 7 October`);
        await t.check(docs(snap).settings?.startDate === '2026-09-24', `startDate moved without confirmation: ${docs(snap).settings?.startDate}`);
        const offer = flat(await status.innerText().catch(() => main.innerText()));
        await t.check(/Move my plan back 3 days/.test(offer) && /Keep my plan as it is/.test(offer), `returning offers no 3-day shift: ${offer.slice(0, 200)}`);
      }, { input: 'Status Away on 2026-10-05; Back to normal on 2026-10-08' });

      await t.step(6, accept ? 'Accept the shift of the three paused days; reload' : 'Decline the shift; reload', async () => {
        const status = page.getByRole('dialog', { name: 'Status' });
        const scope = (await status.count()) ? status : main;
        await ui.tap(ui.button(scope, accept ? 'Move my plan back 3 days' : 'Keep my plan as it is'));
        await page.waitForTimeout(500);
        await t.reload();
        const snap = await t.checkpoint('after-answer');
        const d = docs(snap);
        await t.check(d.settings?.startDate === (accept ? '2026-09-27' : '2026-09-24'), `startDate is ${d.settings?.startDate}`);
        await t.check(d.settings?.statusPeriods?.[0]?.planShift === (accept ? 'moved' : 'kept'), `the answer was not recorded: ${JSON.stringify(d.settings?.statusPeriods)}`);
        const session = (snap.sessions ?? []).find(s => s.id === 'legacy-strength');
        await t.check(session?.date === '2026-09-25' && (d.checkIns ?? []).some(c => c.date === '2026-09-25'), 'a historical session or check-in date moved');
        await g.tabTo(t, 'Today');
        const today = flat(await main.innerText());
        await t.check(!/Move my plan back/.test(today), 'the shift is offered again after it was answered');
        await t.check(new RegExp(`Week ${accept ? 2 : 3} of 12`).test(today), `the plan week reads “${today.match(/Week \d+ of 12/)?.[0]}”, not Week ${accept ? 2 : 3} of 12`);
        await t.check(!/missed/i.test(today), 'the paused days are counted as missed');
      });
    },
  };
}

// ---------------------------------------------------------------- habit prompts (step 7)

async function configureHabits(t) {
  await g.openHabits(t);
  await g.setSittingBreaks(t, 30, '09:00', '18:00');
  await g.setMealWalk(t, { Dinner: '20:30' });
  await g.setQuietHours(t, '22:00', '07:00');
}

/**
 * Where reminders are read. A waiting reminder floats above the tab bar on
 * every screen but Today; Today shows one inline only when it is the top
 * prompt (a due check can come first), and otherwise counts it on the app
 * badge. So the floating banner is read on Move, Today is checked for at most
 * one prompt, and the badge (recorded, as an installed app would show it)
 * must count what is waiting.
 */
async function habitPrompts(t) {
  const page = await t.open({ seed: persona('P01'), route: '/today', capabilities: { badge: 'record' } });
  const badge = () => page.evaluate(() => (window.__acc.badge ?? []).at(-1) ?? 0);
  const onMove = () => g.tabTo(t, 'Move');

  await t.step(7, 'Sitting breaks every 30 min 09:00–18:00, walk after Dinner, quiet hours 22:00–07:00; advance to due times', async () => {
    await configureHabits(t);
    let snap = await t.checkpoint('habits-set');
    const h = docs(snap).settings?.habits ?? {};
    await t.check(h.sittingBreak?.enabled && h.sittingBreak.everyMinutes === 30 && h.sittingBreak.from === '09:00' && h.sittingBreak.to === '18:00', `sitting breaks stored as ${JSON.stringify(h.sittingBreak)}`);
    await t.check(h.mealWalk?.enabled && JSON.stringify(h.mealWalk.meals) === '["dinner"]' && h.mealWalk.finish?.dinner === '20:30', `meal walk stored as ${JSON.stringify(h.mealWalk)}`);
    await t.check(h.quietHours?.from === '22:00' && h.quietHours?.to === '07:00', `quiet hours stored as ${JSON.stringify(h.quietHours)}`);
    const before = { obs: snap.observations?.length ?? 0, sessions: snap.sessions?.length ?? 0 };

    // 09:30: one sitting-break reminder, floating on Move, counted on the badge, at most one prompt on Today.
    await onMove();
    await t.setTime(IST('2026-10-08T09:30:30'));
    let shown = await g.banners(page);
    await t.checkpoint('prompt-0930-move');
    // The sitting-break reminder, by what it asks ("stand up", "breaks up sitting"), at its time.
    await t.check(shown.length === 1 && /stand up|sitting/i.test(shown[0]) && /09:30|9:30/.test(shown[0]), `at 09:30 the banner on Move shows ${JSON.stringify(shown)}`);
    await t.check(await badge() === 1, `with one reminder waiting the app badge reads ${await badge()}`);
    await g.tabTo(t, 'Today');
    const onToday = await page.getByRole('main').getByRole('region', { name: 'Reminder' }).count();
    await t.check(onToday <= 1, `Today shows ${onToday} reminders at once`);
    await t.checkpoint('prompt-0930-today');
    await onMove();
    shown = await g.banners(page);
    await t.must(shown.length === 1, `back on Move the waiting reminder is not shown (${JSON.stringify(shown)})`);
    await g.answerBanner(page, 'Done');
    await t.check(await badge() === 0, `after answering, the app badge reads ${await badge()}`);
    snap = await t.db();
    await t.check((snap.observations?.length ?? 0) === before.obs && (snap.sessions?.length ?? 0) === before.sessions, 'completing a prompt created a measurement or a session');

    // 13:30: at most one prompt, and none for a meal that was not chosen.
    await t.setTime(IST('2026-10-08T13:30:30'));
    shown = await g.banners(page);
    await t.checkpoint('prompt-1330');
    await t.check(shown.length <= 1, `more than one prompt at once: ${JSON.stringify(shown)}`);
    await t.check(!shown.some(x => /lunch|breakfast/i.test(x)), `a walk prompt for an unchosen meal: ${JSON.stringify(shown)}`);
    for (let i = 0; i < 3 && (await g.banners(page)).length; i++) await g.answerBanner(page, 'Later');

    // 20:30: the walk after dinner, the one meal chosen.
    await t.setTime(IST('2026-10-08T20:30:30'));
    const seen = [];
    for (let i = 0; i < 4; i++) {
      const now = await g.banners(page);
      if (!now.length) break;
      await t.check(now.length <= 1, `more than one prompt at once: ${JSON.stringify(now)}`);
      seen.push(now[0]);
      if (/after dinner/i.test(now[0])) { await t.checkpoint('prompt-dinner'); await g.answerBanner(page, 'Later'); break; }
      await g.answerBanner(page, 'Later');
    }
    await t.check(seen.some(x => /after dinner/i.test(x)), `no dinner walk prompt at 20:30: ${JSON.stringify(seen)}`);

    // Quiet hours: a reminder moved into them does not show, or wait on the badge.
    await g.openHabits(t);
    await g.setMealWalk(t, { Dinner: '22:15' });
    await onMove();
    await t.setTime(IST('2026-10-08T22:15:30'));
    shown = await g.banners(page);
    await t.checkpoint('quiet-2215');
    await t.check(shown.length === 0, `a prompt showed in quiet hours: ${JSON.stringify(shown)}`);
    await t.check(await badge() === 0, `in quiet hours the app badge reads ${await badge()}`);

    // A status other than Normal silences them too.
    const sheet = await g.setStatus(t, 'Unwell');
    await sheet.waitFor({ state: 'hidden' });
    await onMove();
    await t.setTime(IST('2026-10-09T09:30:30'));
    shown = await g.banners(page);
    await t.checkpoint('unwell-0930');
    await t.check(shown.length === 0, `a prompt showed while Unwell: ${JSON.stringify(shown)}`);
    await t.check(await badge() === 0, `while Unwell the app badge reads ${await badge()}`);
  }, { input: 'sitting 30 min 09:00–18:00; meal walk Dinner 20:30 (later 22:15); quiet 22:00–07:00; Unwell from 8 Oct; reminders read on Move, answered Done or Later' });
}

// ---------------------------------------------------------------- the calendar file (step 8)

async function calendar(t) {
  const page = await t.open({ seed: persona('P01'), route: '/today', capabilities: { share: 'absent' } });

  await t.step(8, 'Add to Calendar: download the .ics, then disable banners', async () => {
    await configureHabits(t);
    // A habit turned on and then off must stay out of the file.
    const water = page.getByRole('main').getByRole('switch', { name: 'Water', exact: true });
    await ui.tap(water);
    const ws = page.getByRole('dialog', { name: 'Water' });
    await ws.waitFor();
    await ui.tap(ui.row(ws.getByRole('radiogroup', { name: 'Has your care team told you to limit how much you drink?' }), 'No, there is no limit', 'radio'));
    await ui.tap(ui.button(ws, 'Turn on'));
    await ws.waitFor({ state: 'hidden' });
    await ui.tap(water);
    await page.waitForTimeout(300);
    const habits = docs(await t.db()).settings?.habits;
    await t.check(habits?.water && habits.water.enabled === false, `water was not turned off again: ${JSON.stringify(habits?.water)}`);

    const cal = await g.openHabitSheet(t, 'Add to Calendar');
    const text = flat(await cal.innerText());
    await t.checkpoint('calendar-sheet');
    await t.check(/remind you even when this app is closed/.test(text), 'the sheet does not explain that Calendar delivers when the app is closed');
    const file = await g.download(t, () => ui.tap(ui.button(cal, 'Add to Calendar')));
    await page.waitForTimeout(300);
    const notice = flat(await cal.innerText());
    await t.checkpoint('calendar-downloaded');
    await t.check(file.name.endsWith('.ics'), `the file is ${file.name}`);
    await t.check(!/added to (your )?Calendar|imported|now in your calendar/i.test(notice.replace(/Adds these reminders to your Calendar/, '')), `the app claims the import succeeded: ${notice.slice(-200)}`);
    await t.check(/Open the file to add/.test(notice), `no honest download note: ${notice.slice(-160)}`);

    const ics = g.parseIcs(file.text);
    const sit = ics.events.filter(e => e.SUMMARY === 'Stand up and move');
    const walks = ics.events.filter(e => /^Walk after/.test(e.SUMMARY ?? ''));
    const waters = ics.events.filter(e => /water/i.test(e.SUMMARY ?? ''));
    const times = sit.map(e => e.DTSTART.slice(-6, -2)).sort();
    const minutes = times.map(x => Number(x.slice(0, 2)) * 60 + Number(x.slice(2)));
    const evenly = minutes.every((m, i) => i === 0 || m - minutes[i - 1] === 30);
    // The file must hold the schedule the sheet states: “N a day, first to last”.
    const stated = /Sitting breaks (\d+) a day, ([\d:]+ ?[ap]m) to ([\d:]+ ?[ap]m)/i.exec(text);
    const clock = m => { const h = Math.floor(m / 60); return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };
    await t.check(evenly && minutes[0] >= 9 * 60 && minutes.at(-1) <= 18 * 60 && minutes.at(-1) >= 17 * 60 + 30,
      `sitting events at ${times.join(',')}: not every 30 minutes within 09:00–18:00`);
    await t.check(!!stated && Number(stated[1]) === times.length && stated[2].toLowerCase() === clock(minutes[0]) && stated[3].toLowerCase() === clock(minutes.at(-1)),
      `the file’s ${times.length} sitting events (${clock(minutes[0])}–${clock(minutes.at(-1))}) do not match the schedule the sheet states: “${stated?.[0] ?? text.slice(0, 160)}”`);
    await t.check(walks.length === 1 && walks[0].SUMMARY === 'Walk after dinner' && /T203000$/.test(walks[0].DTSTART), `walk events: ${JSON.stringify(walks.map(w => [w.SUMMARY, w.DTSTART]))}`);
    await t.check(waters.length === 0, `the turned-off water habit is in the file (${waters.length} events)`);
    // D-01: each event repeats daily until an end date (renewed by a new file),
    // so a stale export cannot remind forever.
    await t.check(ics.events.every(e => /^FREQ=DAILY;UNTIL=\d{8}T\d{6}$/.test(e.RRULE ?? '') && e.RRULE.slice(17, 25) > (e.DTSTART ?? '').slice(0, 8)
      && e.alarms.length === 1 && e.alarms[0].ACTION === 'DISPLAY' && e.alarms[0].TRIGGER === 'PT0S'),
      'an event lacks its daily repeat, its end date or its alert');
    await t.check(new Set(ics.events.map(e => e.UID)).size === ics.events.length, 'event UIDs repeat');
    await t.check(!/mg\/dL|mmol|mmHg|\bkg\b|HbA1c|type 2|metformin|\b104\b|126\/82|glucose reading/i.test(file.text), 'the calendar file contains health readings or conditions');
    await t.check(ics.crlf, 'the calendar file does not use CRLF line ends');

    await ui.tap(ui.button(cal, 'Close'));
    await cal.waitFor({ state: 'hidden' });
    const habitsPage = flat(await page.getByRole('main').innerText());
    await t.check(/cannot remind you once it is closed/.test(habitsPage) && !/push notification|we will notify|background/i.test(habitsPage), 'the Habits screen promises delivery while closed');
    await ui.tap(page.getByRole('main').getByRole('switch', { name: 'Banners in the app', exact: true }));
    await page.waitForTimeout(300);
    await t.check(docs(await t.db()).settings?.habits?.inApp === false, 'turning banners off was not stored');
    await g.tabTo(t, 'Today');
    await t.setTime(IST('2026-10-08T09:30:30'));
    const shown = await g.banners(page);
    await t.checkpoint('banners-off-0930');
    await t.check(shown.length === 0, `a banner showed with banners off: ${JSON.stringify(shown)}`);
  }, { input: 'habits as step 7; water on (no limit) then off; Add to Calendar; banners off' });
}

// ---------------------------------------------------------------- water and fluid limits (step 9)

const FORBIDDEN_FLUID = /replace (all )?(of )?(your |the )?(urine|fluid) loss|add (more )?salt|extra salt|(change|stop|skip|reduce) (your )?(diuretic|water pill)/i;

function waterCase(kidney) {
  return {
    name: kidney ? 'water reminders: kidney disease' : 'water reminders: fluid limit',
    async run(t) {
      const seed = persona('P01', kidney ? { patch: { profile: { health: { kidneyDisease: 'ckd' } } } } : {});
      const page = await t.open({ seed, route: '/today', capabilities: { share: 'absent' } });
      const main = page.getByRole('main');
      let seen = '';

      await t.step(9, kidney ? 'Kidney disease: water reminders are withheld' : 'Enable water reminders, then answer “Yes, I have a fluid limit”', async () => {
        await g.openHabits(t);
        const water = main.getByRole('switch', { name: 'Water', exact: true });
        if (kidney) {
          await t.check(await water.isDisabled(), 'the water switch can be turned on with kidney disease');
          const row = flat(await ui.row(main, 'Water').innerText());
          await t.check(/kidney/i.test(row), `the Water row does not say why it is off: ${row}`);
          const sheet = await g.openHabitSheet(t, 'Water');
          seen += flat(await sheet.innerText());
          await t.checkpoint('water-sheet-kidney');
          await t.check(/Water reminders are off/.test(seen), 'the Water sheet still offers reminders with kidney disease');
          await ui.tap(ui.button(sheet, 'Close'));
          await sheet.waitFor({ state: 'hidden' });
        } else {
          await ui.tap(water);
          const sheet = page.getByRole('dialog', { name: 'Water' });
          await sheet.waitFor();
          await ui.tap(ui.row(sheet.getByRole('radiogroup', { name: 'Has your care team told you to limit how much you drink?' }), 'Yes, I have a fluid limit', 'radio'));
          seen += flat(await sheet.innerText());
          await t.checkpoint('water-sheet-limit');
          await ui.tap(ui.button(sheet, 'Save'));
          await sheet.waitFor({ state: 'hidden' });
          const snap = await t.db();
          await t.check(docs(snap).profile?.health?.fluidRestriction === true, `the fluid limit was stored as ${docs(snap).profile?.health?.fluidRestriction}`);
          await t.check(!docs(snap).settings?.habits?.water?.enabled, `water reminders are on despite the limit: ${JSON.stringify(docs(snap).settings?.habits?.water)}`);
          await t.check(await water.isDisabled() && (await water.getAttribute('aria-checked')) !== 'true', 'the water switch is still on or can be turned on');
        }
        // The calendar file must leave water out too: give it something else to hold.
        await g.setSittingBreaks(t, 60, '09:00', '18:00');
        const cal = await g.openHabitSheet(t, 'Add to Calendar');
        const file = await g.download(t, () => ui.tap(ui.button(cal, 'Add to Calendar')));
        const ics = g.parseIcs(file.text);
        await t.checkpoint('calendar-no-water');
        await t.check(ics.events.length > 0 && !ics.events.some(e => /water/i.test(e.SUMMARY ?? '') || /water/i.test(e.UID ?? '')), `the calendar file has water events: ${ics.events.map(e => e.SUMMARY).join(', ')}`);
        await ui.tap(ui.button(cal, 'Close'));
        await cal.waitFor({ state: 'hidden' });

        // Today: no generic water prompt, at a time one would be due.
        await g.tabTo(t, 'Today');
        await t.setTime(IST('2026-10-08T11:00:30'));
        const today = flat(await main.innerText());
        await t.checkpoint('today-no-water');
        await t.check(!/Water today|Add \d+ ml|glass of water/i.test(today), `a water prompt shows on Today: ${today.match(/Water today[^]*?ml/)?.[0] ?? ''}`);
        seen += today;
        // Reminders float on every screen but Today: none of them may be water.
        await g.tabTo(t, 'Move');
        const banners = await g.banners(page);
        await t.check(!banners.some(b => /water|glass/i.test(b)), `a water reminder floats on Move: ${banners.join(' | ')}`);
        // The sitting break the calendar needed is due now too; answer it so it is out of the way.
        for (let i = 0; i < 3 && (await g.banners(page)).length; i++) await g.answerBanner(page, 'Later');

        // What the Guide says about water now.
        await g.tabTo(t, 'Guide');
        await ui.type(main.getByRole('searchbox', { name: 'Search Guide' }), 'water');
        await page.waitForTimeout(300);
        await ui.tap(ui.row(main, 'Water', 'link'));
        await page.getByRole('heading', { level: 1, name: 'Water', exact: true }).waitFor();
        const topic = flat(await main.innerText());
        seen += topic;
        await t.checkpoint('guide-water-topic');
        await t.check(/Fluid limits/.test(topic), 'the Water topic does not lead with fluid limits for this person');
        for (const link of await main.getByRole('link').all()) {
          const name = (await link.getAttribute('aria-label')) ?? (await link.innerText());
          if (/^(How much water\?|Fluid limits)/.test(name.trim())) {
            await ui.tap(link);
            await page.waitForTimeout(300);
            seen += flat(await main.innerText());
            await ui.tap(ui.header(page).getByRole('button', { name: /^Back/ }));
            await page.waitForTimeout(300);
          }
        }
        await t.check(!FORBIDDEN_FLUID.test(seen), `an instruction to replace all urine losses, add salt or change a diuretic appears: “${seen.match(FORBIDDEN_FLUID)?.[0]}”`);

        await t.goto('/you/profile');
        const profile = flat(await main.innerText());
        await t.checkpoint('profile-fluid');
        await t.check(kidney ? /Kidney/i.test(profile) : /Fluid limit from your care team Yes/.test(profile), `Profile & health does not show the answer: ${profile.match(/Fluid limit[^]{0,40}/)?.[0] ?? profile.slice(0, 120)}`);
      }, { input: kidney ? 'kidneyDisease ckd (seed); sitting breaks 60 min for the calendar' : 'Water → “Yes, I have a fluid limit”; sitting breaks 60 min for the calendar' });
    },
  };
}

export const cases = [
  { name: 'goals and rest', run: goalsAndRest },
  { name: 'steps goal history', run: stepsGoal },
  awayCase(false),
  awayCase(true),
  { name: 'habit prompts', run: habitPrompts },
  { name: 'calendar file', run: calendar },
  waterCase(false),
  waterCase(true),
];
