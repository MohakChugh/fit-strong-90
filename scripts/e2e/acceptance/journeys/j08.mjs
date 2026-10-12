/**
 * J08, P02: a complete Stretch product without a strength plan
 * (codex-acceptance.md; basis D6, D8, D21, D24; PLAN Task 5).
 */
import { MINUTE } from '../lib/env.mjs';
import { docs } from '../lib/harness.mjs';
import { persona } from '../fixtures/personas.mjs';
import * as ui from '../lib/ui.mjs';
import * as move from '../lib/move.mjs';
import * as player from '../lib/player.mjs';

export const id = 'J08';
export const title = 'A complete Stretch product without a strength plan';
export const safety = false;

const PROGRAMME = /Week \d+ of 12|phase|Total lifted|personal record|sessions this week|12-week programme/i;

/** The stretch setup screen: area and length, and nothing of a strength programme. */
async function assertSetup(t, label) {
  const page = t.page;
  const main = page.getByRole('main');
  await page.getByRole('heading', { level: 1, name: 'Stretch', exact: true }).waitFor();
  await t.check(await main.getByRole('radiogroup', { name: 'Area' }).count() === 1, `${label}: no area (focus) choice`);
  await t.check(await main.getByRole('radiogroup', { name: 'Length' }).count() === 1, `${label}: no length choice`);
  const text = await main.innerText();
  await t.check(!PROGRAMME.test(text), `${label}: the stretch setup shows programme or gym content: ${text.match(PROGRAMME)?.[0]}`);
  await t.checkpoint(`stretch-setup-${label}`);
}

/** Choose the ten-minute routine and start it; returns once the player runs. */
async function startTen(t) {
  const page = t.page;
  const main = page.getByRole('main');
  await ui.tap(ui.radio(main.getByRole('radiogroup', { name: 'Length' }), '10 min'));
  await ui.tap(ui.button(main, 'Start stretch'));
  await page.waitForTimeout(500);
  const sheet = move.checkInSheet(page);
  if (await sheet.count()) {
    await ui.answerCheckIn(t, sheet, ui.normalAnswers('P02'));
    await page.waitForTimeout(400);
    await ui.tap(player.sheetStart(sheet));
  }
  await page.waitForURL(/#\/session\?mode=stretch/);
  await t.ready();
}

/** The running player shows a demo, a caption, its controls and a symptom stop. */
async function assertRunning(t, label) {
  const page = t.page;
  const main = page.getByRole('main');
  await t.check(await page.getByRole('navigation', { name: 'Main' }).count() === 0, `${label}: the tab bar shows in the player`);
  await t.check(await main.getByRole('img', { name: /^3D demonstration/ }).count() === 1, `${label}: no demo on the running stretch`);
  // The first line is cued a moment after Start; the frozen clock has to move for it.
  await t.advance(1500);
  const cap = (await player.caption(page).innerText().catch(() => '')).trim();
  await t.check(await player.caption(page).count() === 1 && cap.length > 1 && cap !== '…', `${label}: no caption (“${cap}”)`);
  await t.check(await player.control(page, 'Pause').count() === 1, `${label}: no Pause control`);
  await t.check(await player.symptomStop(page).count() >= 1, `${label}: no symptom-stop control on the running stretch (controls: ${(await main.getByRole('button').evaluateAll(els => els.map(e => e.getAttribute('aria-label') || e.textContent.trim()))).join(', ')})`);
}

/**
 * Let each timed step run to its end: advance the clock by what the step has
 * left, so the runner completes it itself. Returns the running time advanced.
 */
async function runToEnd(t, maxSteps = 30) {
  const page = t.page;
  let ran = 0;
  for (let i = 0; i < maxSteps; i++) {
    if (await page.getByRole('heading', { level: 1, name: /complete$/ }).count() && !(await player.control(page, 'Pause').count())) return ran;
    const left = await player.stepRemainingMs(page);
    if (left === undefined) {
      if (await page.getByRole('heading', { level: 1, name: /^(Stretch|Session) complete$/ }).count()) return ran;
      throw new Error(`no step timer on “${(await player.where(page)).title}”`);
    }
    const before = await player.where(page);
    await t.advance(left + 300);
    ran += left + 300;
    await page.waitForTimeout(150);
    const after = await page.getByRole('heading', { level: 1 }).innerText().catch(() => '');
    if (after.trim() === before.title && (await player.stepRemainingMs(page)) !== undefined) {
      // The tick that lands after the boundary may need one more beat.
      await t.advance(300);
      ran += 300;
    }
  }
  throw new Error('the stretch never reached its end');
}

const save = async t => {
  const page = t.page;
  await page.getByRole('heading', { level: 1, name: 'Stretch complete' }).waitFor();
  await t.checkpoint('stretch-summary');
  await ui.tap(page.getByRole('button', { name: /Save and finish/ }));
  await page.getByText('Saved', { exact: true }).waitFor({ timeout: 8000 });
};

export const cases = [
  {
    name: 'main',
    async run(t) {
      const page = await t.open({ seed: persona('P02'), route: '' });
      // The 3D demo renders in software here; under load a tap can wait well past 8 s.
      t.context.setDefaultTimeout(25000);
      const main = page.getByRole('main');
      let pauseCheck;
      let ranMs = 0;

      await t.step(1, 'Choose something else → Stretch; again via Move → Stretch', async () => {
        await t.must(await t.route() === '/today', `opened ${await t.route()}`);
        const entry = await move.enter(t, 'stretch', 'chooser');
        if (entry.sheet) {
          // The shared gate: no diabetes or blood-pressure readings for P02.
          const sheetText = await entry.sheet.innerText();
          await t.check(!(await entry.sheet.getByRole('textbox', { name: /Glucose|Reading 1/ }).count()), 'the stretch check-in asks P02 for glucose or BP readings');
          await t.checkpoint('stretch-check-in');
          t.note(`chooser → Stretch opened the check-in first (${sheetText.split('\n')[0]})`);
          await ui.answerCheckIn(t, entry.sheet, ui.normalAnswers('P02'));
          await page.waitForTimeout(400);
          await t.checkpoint('stretch-check-in-outcome');
          const go = player.sheetStart(entry.sheet);
          await t.must(await go.count() === 1, `no way on from the stretch check-in: ${(await entry.sheet.innerText()).slice(0, 200)}`);
          await ui.tap(go);
        }
        await assertSetup(t, 'chooser');
        // Move → Stretch, to the setup (not its Start).
        await ui.tab(page, 'Move');
        await ui.tap(ui.row(main, 'Stretch', 'link'));
        await assertSetup(t, 'move');
      });

      await t.step(2, 'Ten-minute routine, normal answers, Start stretch', async () => {
        if (!(await t.route()).startsWith('/move/stretch')) await t.goto('/move/stretch');
        await startTen(t);
        await t.checkpoint('stretch-ready');
        await player.begin(page);
        await assertRunning(t, 'running');
        await t.checkpoint('stretch-running');
      }, { input: 'normal current answers, no glucose or BP; 10 min Back & hips' });

      await t.step(3, 'Pause for two minutes, reload, resume at the saved step', async () => {
        // Into the routine a little, so there is a step to come back to.
        await ui.tap(player.control(page, 'Next'));
        await page.waitForTimeout(200);
        await t.advance(20_000);
        ranMs += 20_000;
        await ui.tap(player.control(page, 'Pause'));
        const before = await player.progress(page, 'stretch');
        await t.must(!!before, 'no stretch progress cache while running');
        await t.advance(2 * MINUTE);
        await t.reload();
        await t.checkpoint('stretch-after-reload');
        const after = await player.progress(page, 'stretch');
        const resume = player.control(page, 'Resume');
        await t.must(await resume.count() === 1, `after reload the stretch does not offer Resume: ${(await main.innerText()).slice(0, 200)}`);
        await t.check(after.sessionId === before.sessionId && after.plan.id === before.plan.id && after.state.index === before.state.index,
          `reload changed the attempt: ${JSON.stringify({ before: [before.sessionId, before.state.index], after: [after.sessionId, after.state.index] })}`);
        await t.check((after.state.activeMs ?? 0) <= (before.state.activeMs ?? 0) + 1000, `the paused two minutes were counted as stretching (activeMs ${before.state.activeMs} → ${after.state.activeMs})`);
        const w = await player.where(page);
        await ui.tap(resume);
        await page.waitForTimeout(200);
        const again = await player.where(page);
        await t.check(again.title === w.title, `resume moved from “${w.title}” to “${again.title}”`);
        pauseCheck = before.sessionId;
      }, { input: 'Next; +20 s; Pause; +2 min; reload; Resume' });

      await t.step(4, 'Run each timed step to completion; save', async () => {
        ranMs += await runToEnd(t);
        await save(t);
        const summaryText = await main.innerText().catch(() => '');
        await t.check(!/programme|Session complete|Week \d+ of 12/i.test(summaryText), `the stretch summary talks about the strength programme: ${summaryText.slice(0, 200)}`);
        const snap = await t.checkpoint('after-stretch-save');
        const sessions = snap.sessions ?? [];
        await t.check(sessions.length === 1, `${sessions.length} sessions stored, not 1`);
        const s = sessions[0];
        if (s) {
          await t.check(s.planKind === 'stretch', `the session's planKind is ${s.planKind}, not stretch`);
          await t.check(s.id === pauseCheck, `the saved session ${s.id} is not the attempt ${pauseCheck}`);
          await t.check(s.status === 'completed', `the stretch is stored as ${s.status}`);
          await t.check(!(s.sets ?? []).some(x => x.status === 'completed'), 'the stretch session holds completed strength sets');
          const secs = s.durationSeconds ?? 0;
          await t.check(Math.abs(secs - ranMs / 1000) <= 5, `recorded duration ${secs} s is not the ${Math.round(ranMs / 1000)} s actually run (pause excluded)`);
          await t.check((s.mobility ?? []).length > 0, 'no mobility work recorded');
        }
        const obs = snap.observations ?? [];
        const movement = obs.filter(o => o.kind === 'movementMinutes');
        await t.check(movement.length <= 1, `${movement.length} movement observations for one stretch`);
        await t.check(!obs.some(o => ['steps', 'glucose', 'bloodPressureSystolic', 'bloodPressureDiastolic'].includes(o.kind)), `the stretch created ${obs.map(o => o.kind).join(', ')}`);
        await t.check(!docs(snap).settings?.startDate, `startDate became ${docs(snap).settings?.startDate}`);
      });

      await t.step(5, 'Track and the saved record; reload Today', async () => {
        await page.waitForURL(/#\/(today|move)/, { timeout: 8000 }).catch(() => {});
        await t.goto('/track');
        const rowLink = main.getByRole('link', { name: /stretch/i });
        await t.must(await rowLink.count() === 1, `today’s Track lists ${await rowLink.count()} stretch records`);
        const rowText = await rowLink.innerText();
        await t.check(!/Partly done|Partial/i.test(rowText), `the finished stretch reads as partial: ${rowText}`);
        await ui.tap(rowLink);
        await page.waitForTimeout(400);
        const detail = await main.innerText();
        await t.checkpoint('stretch-record');
        await t.check(!/Week \d+ of 12|Sets done/i.test(detail), `the stretch record reads as a programme workout: ${detail.slice(0, 200)}`);
        await t.goto('/today');
        const card = main.getByRole('region').filter({ has: page.getByRole('heading', { level: 3 }) });
        const cardText = (await card.innerText()).replace(/\n/g, ' ⏎ ');
        await t.checkpoint('today-after-stretch');
        await t.check(!/Week \d+ of 12|Full Body|strength programme|Build my plan/i.test(cardText), `Today pushes the strength programme after a stretch: ${cardText}`);
        t.note(`Today after the stretch: ${cardText}`);
        const snap = await t.db();
        await t.check(!docs(snap).settings?.startDate, 'startDate is no longer empty');
        await t.check((snap.sessions ?? []).length === 1, `${(snap.sessions ?? []).length} sessions after reload`);
      });
    },
  },
  ...[
    { name: 'no wake lock, no voice', caps: { wakeLock: 'absent', speech: 'absent' }, voice: 'blocked' },
    { name: 'wake lock rejected, no voice', caps: { wakeLock: 'reject', speech: 'absent' }, voice: 'blocked' },
    { name: 'reduced motion', caps: undefined, reducedMotion: 'reduce' },
  ].map(v => ({
    name: v.name,
    async run(t) {
      const page = await t.open({
        seed: persona('P02'), route: '/move/stretch',
        ...(v.caps ? { capabilities: v.caps } : {}),
        ...(v.reducedMotion ? { reducedMotion: v.reducedMotion } : {}),
      });
      // The 3D demo renders in software here; under load a tap can wait well past 8 s.
      t.context.setDefaultTimeout(25000);
      // Count vibration: the player must never require it.
      await t.context.addInitScript(() => {
        window.__vibrations = 0;
        const real = navigator.vibrate?.bind(navigator);
        navigator.vibrate = (...a) => { window.__vibrations += 1; return real ? real(...a) : true; };
      });
      await t.reload();
      if (v.voice === 'blocked') {
        // Only the voice packs under public/voice, never the app's own src/voice modules.
        await page.route(/\/fit-strong-90\/voice\//, r => r.abort());
        // The only resource failures here are the voice files this case refuses.
        t.allowConsole('Failed to load resource: net::ERR_FAILED');
      }
      const main = page.getByRole('main');

      await t.step(6, `Stretch with ${v.name}: captions, controls and timers stay usable`, async () => {
        await assertSetup(t, v.name);
        await startTen(t);
        if (v.voice === 'blocked') {
          // Ask for the voice the device cannot give: captions must carry on.
          const unmute = player.control(page, 'Unmute');
          if (await unmute.count()) await ui.tap(unmute);
        }
        await player.begin(page);
        await assertRunning(t, v.name);
        const first = await player.where(page);
        const capBefore = (await player.caption(page).innerText()).trim();
        const leftBefore = await player.stepRemainingMs(page);
        await t.advance(5000);
        // Read once the screen has caught up with the clock (slow under load).
        let leftAfter = await player.stepRemainingMs(page);
        for (let i = 0; i < 20 && leftAfter === leftBefore; i++) { await page.waitForTimeout(250); leftAfter = await player.stepRemainingMs(page); }
        await t.check(leftBefore !== undefined && leftAfter !== undefined && leftAfter < leftBefore, `the step timer does not count down (${leftBefore} → ${leftAfter})`);
        await ui.tap(player.control(page, 'Pause'));
        await t.check(await player.control(page, 'Resume').count() === 1, 'Pause does not offer Resume');
        await ui.tap(player.control(page, 'Resume'));
        await ui.tap(player.control(page, 'Next'));
        await page.waitForTimeout(250);
        const second = await player.where(page);
        const capAfter = (await player.caption(page).innerText()).trim();
        await t.check(second.title !== first.title, 'Next did not move to the next step');
        await t.check(capAfter.length > 1 && capAfter !== capBefore, `the caption did not follow the step (“${capBefore.slice(0, 40)}” → “${capAfter.slice(0, 40)}”)`);
        await t.checkpoint(`running-${v.name}`);
        const vibrations = await page.evaluate(() => window.__vibrations);
        t.note(`vibrate calls during the run: ${vibrations}`);
        const errors = t.console.filter(c => /pageerror/.test(c.text));
        await t.check(!errors.length, `the page threw: ${errors.map(e => e.text).join(' | ').slice(0, 200)}`);
        if (v.reducedMotion) {
          const running = await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getTiming?.().iterations === Infinity).length);
          t.note(`endless animations running under reduced motion: ${running}`);
          await t.check(await player.control(page, 'Pause').count() === 1, 'the demo has no pause control under reduced motion');
        }
        // Finish the attempt, and the record says it was a stretch.
        await ui.tap(player.control(page, 'End session'));
        const leave = page.getByRole('dialog', { name: 'Leave the session?' });
        await leave.waitFor();
        await ui.tap(ui.button(leave, 'Finish now'));
        await save(t);
        const snap = await t.checkpoint(`saved-${v.name}`);
        const s = (snap.sessions ?? [])[0];
        await t.check((snap.sessions ?? []).length === 1 && s?.planKind === 'stretch', `stored sessions: ${JSON.stringify((snap.sessions ?? []).map(x => [x.planKind, x.status]))}`);
        if (v.caps?.wakeLock) {
          const wake = await page.evaluate(() => typeof navigator.wakeLock);
          t.note(`navigator.wakeLock in this case: ${wake}`);
        }
        void main;
      }, { input: JSON.stringify(v) });
    },
  })),
];
