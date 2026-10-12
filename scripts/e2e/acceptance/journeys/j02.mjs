/**
 * J02, P01: lossless upgrade and one resumable guided session
 * (codex-acceptance.md; basis D8, D11, D13, D28, D30; PLAN Tasks 1 and 5).
 */
import { MINUTE } from '../lib/env.mjs';
import { docs } from '../lib/harness.mjs';
import { C0, persona } from '../fixtures/personas.mjs';
import * as ui from '../lib/ui.mjs';
import * as move from '../lib/move.mjs';
import * as player from '../lib/player.mjs';

export const id = 'J02';
export const title = 'Lossless upgrade and one resumable guided session';
export const safety = false;

/** Paths where `actual` differs from `expected`, reading only what `expected` holds. */
export function subsetDiff(expected, actual, path = '') {
  if (expected === null || typeof expected !== 'object') {
    return Object.is(expected, actual) ? [] : [`${path || '(root)'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`];
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return [`${path}: expected an array, got ${JSON.stringify(actual)?.slice(0, 80)}`];
    const out = expected.length === actual.length ? [] : [`${path}: expected ${expected.length} items, got ${actual.length}`];
    expected.forEach((e, i) => out.push(...subsetDiff(e, actual[i], `${path}[${i}]`)));
    return out;
  }
  if (!actual || typeof actual !== 'object') return [`${path}: expected an object, got ${JSON.stringify(actual)?.slice(0, 80)}`];
  return Object.keys(expected).flatMap(k => subsetDiff(expected[k], actual[k], path ? `${path}.${k}` : k));
}

/** Exactly equal, both ways. */
const sameJson = (a, b) => subsetDiff(a, b).concat(subsetDiff(b, a));

/** The eight observations the P01 migration must produce (spec "Common v4 envelope", after C0). */
const MIGRATED = [
  { kind: 'glucose', value: 104, unit: 'mg/dL', context: 'checkIn:2026-09-25', timeUnknown: true },
  { kind: 'bloodPressureSystolic', value: 126, unit: 'mmHg', timeUnknown: true },
  { kind: 'bloodPressureDiastolic', value: 82, unit: 'mmHg', timeUnknown: true },
  { kind: 'backPain', value: 2, unit: '0-10', context: 'checkIn:2026-09-25', timeUnknown: true },
  { kind: 'legPain', value: 1, unit: '0-10', context: 'checkIn:2026-09-25', timeUnknown: true },
  { kind: 'weight', value: 78, unit: 'kg', timeUnknown: true },
  { kind: 'waist', value: 95, unit: 'cm', timeUnknown: true },
  { kind: 'backPain', value: 2, unit: '0-10', context: 'session:legacy-strength' },
];

/** Every check on the migrated record against the seed: returns problems. */
export function migratedProblems(seed, snap) {
  const problems = [];
  const d = docs(snap);
  const obs = snap.observations ?? [];
  if (obs.length !== 8) problems.push(`${obs.length} observations after migration, not 8: ${obs.map(o => `${o.kind}=${o.value}`).join(', ')}`);
  const left = [...obs];
  for (const want of MIGRATED) {
    const i = left.findIndex(o => Object.entries(want).every(([k, v]) => o[k] === v) && o.day === '2026-09-25');
    if (i < 0) problems.push(`no migrated ${want.kind} ${want.value} ${want.unit}${want.context ? ` (${want.context})` : ''}${want.timeUnknown ? ' with timeUnknown' : ''} on 25 September`);
    else left.splice(i, 1);
  }
  for (const o of obs) {
    if (o.source !== 'manual') problems.push(`${o.id} has source ${o.source}, not manual`);
    if (o.scope !== 'pointInTime') problems.push(`${o.id} has scope ${o.scope}`);
    if (['sleep', 'mood', 'steps', 'movementMinutes', 'walkDuration'].includes(o.kind)) problems.push(`a ${o.kind} observation was derived (${o.id})`);
  }
  const bpPairs = obs.filter(o => o.kind.startsWith('bloodPressure'));
  if (bpPairs.length === 2 && bpPairs[0].context !== bpPairs[1].context) problems.push(`the BP halves have different contexts: ${bpPairs.map(o => o.context).join(' / ')}`);
  for (const [name, want, got] of [
    ['personalRecords', seed.personalRecords, d.personalRecords],
    ['bodyMetrics', seed.bodyMetrics, d.bodyMetrics],
    ['focusOverrides', seed.focusOverrides, d.focusOverrides],
    ['checkIns', [C0], d.checkIns],
  ]) {
    const diff = sameJson(want, got);
    if (diff.length) problems.push(`${name} changed: ${diff.slice(0, 4).join('; ')}`);
  }
  const settingsDiff = subsetDiff(seed.settings, d.settings);
  if (settingsDiff.length) problems.push(`settings changed: ${settingsDiff.slice(0, 4).join('; ')}`);
  const profileDiff = subsetDiff(seed.profile, d.profile);
  if (profileDiff.length) problems.push(`profile changed: ${profileDiff.slice(0, 4).join('; ')}`);
  const legacy = (snap.sessions ?? []).find(s => s.id === 'legacy-strength');
  if (!legacy) problems.push('the legacy session is not in the sessions store');
  else {
    const diff = sameJson(seed.sessions[0], legacy);
    if (diff.length) problems.push(`the legacy session changed: ${diff.slice(0, 4).join('; ')}`);
  }
  return problems;
}

/** The record with revision and seq set aside, for before/after comparisons. */
export function comparable(snap) {
  const strip = o => { const { seq, ...rest } = o; void seq; return rest; };
  return {
    observations: (snap.observations ?? []).map(strip).sort((a, b) => a.id.localeCompare(b.id)),
    sessions: [...(snap.sessions ?? [])].sort((a, b) => a.id.localeCompare(b.id)),
    settings: (snap.settings ?? []).filter(r => r.key !== 'revision').sort((a, b) => a.key.localeCompare(b.key)),
    content: [...(snap['content-state'] ?? [])].sort((a, b) => String(a.key).localeCompare(String(b.key))),
  };
}

/** Track → 25 September → the session → its Workout Log: the sets and both notes. */
async function legacyInTrack(t) {
  const page = t.page;
  const main = page.getByRole('main');
  await ui.tab(page, 'Track');
  await ui.trackDay(page, '2026-09-25');
  const session = main.getByRole('link', { name: /^Upper A · Push & Row/ });
  await t.must(await session.count() === 1, `25 September does not list the legacy session once (${await session.count()})`);
  await ui.tap(session);
  await page.getByRole('heading', { level: 1, name: 'Upper A · Push & Row' }).waitFor();
  await t.checkpoint('legacy-session-record');
  await ui.tap(main.getByRole('link', { name: /^Sets and weights/ }));
  await page.waitForURL(/#\/track\/workout\/legacy-strength/);
  await page.getByRole('heading', { level: 1, name: 'Upper A · Push & Row' }).waitFor();
  await page.getByRole('heading', { level: 2, name: 'Notes' }).waitFor().catch(() => {});
  // Numbers and units are joined by no-break spaces on screen.
  const log = (await main.innerText()).replace(/[\u00a0\u202f]/g, ' ');
  await t.checkpoint('legacy-session-workout-log');
  return log;
}

async function assertLegacyLog(t, log) {
  await t.check(/Dumbbell Bench Press[\s\S]*12 reps · 20 kg/i.test(log), 'the Workout Log does not show the bench press set 12 × 20 kg');
  await t.check(/Face Pull[\s\S]*12 reps · 20 kg/i.test(log), 'the Workout Log does not show the face pull set 12 × 20 kg');
  await t.check(log.includes('Retain this session note'), 'the session note is not shown');
  await t.check(log.includes('Retain this exercise note'), 'the exercise note is not shown');
}

/** Answer the review the way step 3 says: no insulin, SU, SGLT2; metformin since 2019; no prior DKA. */
async function reviewMedicines(t) {
  const page = t.page;
  await t.goto('/you/profile');
  const review = page.getByRole('button', { name: /^Your health answers need a review/ });
  await t.must(await review.count() === 1, 'Profile & health offers no health review');
  await ui.tap(review);
  const d = page.getByRole('dialog', { name: 'Edit your answers' });
  await d.waitFor();
  const group = name => d.getByRole('radiogroup', { name, exact: true });
  await ui.tap(ui.radio(group('Insulin'), 'No insulin'));
  await ui.tap(ui.radio(group('Sulfonylurea or meglitinide? (e.g. gliclazide, glimepiride)'), 'No'));
  await ui.tap(ui.radio(group('An SGLT2 inhibitor, for diabetes, heart or kidney? (e.g. empagliflozin, dapagliflozin)'), 'No'));
  await ui.tap(ui.radio(group('Metformin?'), 'Yes'));
  const year = d.getByRole('spinbutton', { name: 'Year you started metformin (optional)', exact: true });
  await ui.type(year, '2019');
  if (await year.inputValue() !== '2019') {
    // Typed a digit at a time, as a phone keyboard does, the year never registers.
    await t.check(false, `“Year you started metformin” does not accept typing: after keying 2019 it reads “${await year.inputValue()}” (each partial value is rejected and the field resets)`);
    t.note('workaround: pasted the whole year at once (atomic fill) to carry on');
    await year.fill('2019');
  }
  await ui.tap(ui.radio(group('Ever had diabetic ketoacidosis (DKA), or been told your body makes too little insulin?'), 'No'));
  // The fixture's own explicit answers, which the review asks again.
  const extra = [];
  for (const [name, answer] of [['Beta-blocker? (e.g. bisoprolol, metoprolol)', 'No'], ['Diuretic or water pill?', 'No'], ['Has your care team told you to limit how much you drink?', 'No']]) {
    const g = group(name);
    if (await g.count() && !(await g.getByRole('radio', { checked: true }).count())) { await ui.tap(ui.radio(g, answer)); extra.push(`${name} ${answer}`); }
  }
  if (extra.length) t.note(`the review also required: ${extra.join('; ')}`);
  await t.checkpoint('health-review-answered');
  const save = ui.button(d, 'Save');
  await t.must(await save.isEnabled(), `Save stays disabled: ${(await d.getByRole('status').allInnerTexts()).join(' | ')}`);
  await ui.tap(save);
  await d.waitFor({ state: 'hidden' });
}

export const cases = [
  {
    name: 'main',
    async run(t) {
      const seed = persona('P01');
      const page = await t.open({ seed, route: '' });
      // The 3D demo renders in software here; under load a tap can wait well past 8 s.
      t.context.setDefaultTimeout(25000);
      const main = page.getByRole('main');
      let baseline;

      await t.step(1, 'Load P01 with its legacy history', async () => {
        await t.must(await t.route() === '/today', `the app opened ${await t.route()}, not Today (first-run setup repeated?)`);
        const text = await main.innerText();
        await t.check(/Week 3 of 12/.test(text), 'Today does not say “Week 3 of 12”');
        const card = main.getByRole('region').filter({ has: page.getByRole('heading', { level: 3 }) });
        const why = (await card.innerText()).match(/Why this\?\s*([^\n]+)/);
        await t.check(!!why && /session|training day|plan/i.test(why[1]), `no visible “Why this?” explaining the scheduled session (${why?.[1] ?? 'none'})`);
        const snap = await t.checkpoint('today-after-migration');
        for (const p of migratedProblems(seed, snap)) await t.check(false, p);
        baseline = comparable(snap);
        await assertLegacyLog(t, await legacyInTrack(t));
      });

      await t.step(2, 'Reload twice and revisit 25 September', async () => {
        await t.reload();
        await t.reload();
        const log = await legacyInTrack(t);
        await assertLegacyLog(t, log);
        const snap = await t.db();
        const now = comparable(snap);
        const diff = sameJson(baseline, now);
        await t.check(!diff.length, `the record changed across two reloads: ${diff.slice(0, 5).join('; ')}`);
        await t.check((docs(snap).checkIns ?? []).length === 1, `${(docs(snap).checkIns ?? []).length} check-ins after reloads, not 1`);
      });

      let progressAtExit;
      await t.step(4, 'Today’s primary action, normal answers with glucose blank, Start session', async () => {
        await ui.tab(page, 'Today');
        const entry = await move.enter(t, 'guided', 'today');
        await t.must(!!entry.sheet, `Today’s primary action did not open the check-in (${entry.route})`);
        await ui.answerCheckIn(t, entry.sheet, ui.normalAnswers('P01'));
        await page.waitForTimeout(400);
        await t.checkpoint('check-in-outcome');
        const start = ui.button(entry.sheet, 'Start session');
        await t.must(await start.count() === 1, `no permission-approved “Start session”: ${(await entry.sheet.innerText()).slice(0, 300)}`);
        await ui.tap(start);
        await page.waitForTimeout(600);
        await t.must((await t.route()).startsWith('/session'), `Start session opened ${await t.route()}`);
        await t.check(await move.checkInSheet(page).count() === 0, 'a second check-in opened for the same session');
        await t.check(!/Check again before you start|No session for now|Back to Today/.test(await main.innerText()), 'the player shows a second approval or a gate');
        await t.checkpoint('player-ready');
        const ready = player.control(page, 'Start');
        if (await ready.count()) t.note('the player opens on its own ready screen; its Start begins the run (not a second safety approval)');
        await player.begin(page);
        await t.check(await page.getByRole('navigation', { name: 'Main' }).count() === 0, 'the tab bar is shown inside the player');
        const w = await player.where(page);
        await t.check(!!w.title, 'no current step heading');
        await t.check(await player.caption(page).count() === 1, 'no caption line');
        await t.check(await main.getByLabel('Time left', { exact: true }).count() === 1 || await main.getByText(/^Step ends in \d+:\d\d$/).count() === 1, 'no timer');
        await t.check(await player.control(page, 'Pause').count() === 1, 'no Pause control');
        await t.check(await player.symptomStop(page).count() >= 1, `no symptom-stop control on the running player (controls: ${(await main.getByRole('button').evaluateAll(els => els.map(e => e.getAttribute('aria-label') || e.textContent.trim()))).join(', ')})`);
        await t.checkpoint('player-running');
      }, { input: 'normal current answers; BP 124/78 then 122/76 a minute apart; glucose blank' });

      await t.step(5, 'Next to the first strength set; 12 reps × 10 kg, done; Pause; Save and exit', async () => {
        const skipped = await player.nextUntil(page, w => /^Set 1 of \d+/.test(w.sub));
        const setTitle = (await player.where(page)).title;
        await player.setStepper(page, /Weight(?: \(find yours\))?/, 10, ' kg');
        await t.checkpoint('first-set-weight');
        await ui.tap(player.control(page, 'Done — next'));
        await page.waitForTimeout(300);
        await player.setStepper(page, /Reps/, 12);
        await t.checkpoint('rest-reps-logged');
        await ui.tap(player.control(page, 'Pause'));
        await page.waitForTimeout(300);
        const before = await player.progress(page);
        await t.must(!!before, 'no progress cache while the session is in progress');
        // Pause time does not auto-complete work.
        await t.advance(10 * MINUTE);
        const paused = await player.progress(page);
        await t.check(paused.state.index === before.state.index && paused.state.status === 'paused', `ten paused minutes moved the session from step ${before.state.index} to ${paused.state.index} (${paused.state.status})`);
        const completed = paused.state.logs.filter(l => l.completed);
        const setLog = paused.state.logs.find(l => l.kind === 'set' && l.completed && l.exerciseId);
        await t.check(completed.length === 1 && setLog?.reps === 12 && setLog?.weightKg === 10, `logged work after the pause: ${JSON.stringify(completed.map(l => ({ id: l.stepId, reps: l.reps, kg: l.weightKg })))}`);
        await t.check(skipped.every(s => true) && paused.state.logs.filter(l => l.skipped).every(l => !l.completed), 'a skipped step was logged as completed');
        t.note(`first strength set: ${setTitle}; ${skipped.length} steps skipped with Next`);
        await ui.tap(player.control(page, 'End session'));
        const leave = page.getByRole('dialog', { name: 'Leave the session?' });
        await leave.waitFor();
        await t.checkpoint('leave-dialog');
        await ui.tap(ui.button(leave, 'Save and exit'));
        await page.getByRole('heading', { level: 1, name: 'Today', exact: true }).waitFor();
        const card = main.getByRole('region').filter({ has: page.getByRole('heading', { level: 3 }) });
        const cardText = await card.innerText();
        await t.check(/Continue your session/.test(cardText) && await card.getByRole('button', { name: /^Continue$|continue$/ }).count() === 1, `Today does not offer Continue ahead of a new recommendation: ${cardText.replace(/\n/g, ' ⏎ ')}`);
        await t.checkpoint('today-continue');
        progressAtExit = await player.progress(page);
        await t.reload();
        const again = await player.progress(page);
        const same = again && again.plan.id === progressAtExit.plan.id && again.sessionId === progressAtExit.sessionId
          && again.plan.date === progressAtExit.plan.date && again.state.index === progressAtExit.state.index
          && JSON.stringify(again.state.logs) === JSON.stringify(progressAtExit.state.logs);
        await t.check(same, `reload changed the saved attempt: ${JSON.stringify({ before: progressAtExit && { id: progressAtExit.sessionId, i: progressAtExit.state.index }, after: again && { id: again.sessionId, i: again.state.index } })}`);
        const snap = await t.checkpoint('today-after-reload');
        const extra = (snap.observations ?? []).filter(o => !/^(checkIn|bodyMetric|bp|session)/.test(o.context ?? '') || o.kind === 'movementMinutes');
        t.note(`observations not from check-ins: ${extra.map(o => `${o.kind}:${o.context}`).join(', ') || 'none'}`);
      }, { input: 'Next × n; weight 10 kg; Done — next; reps 12; Pause; +10 min; End session → Save and exit' });

      let sessionId;
      await t.step(6, 'Continue, finish with the rest skipped, save the summary', async () => {
        const card = main.getByRole('region').filter({ has: page.getByRole('heading', { level: 3 }) });
        await ui.tap(card.getByRole('button'));
        await page.waitForTimeout(600);
        const sheet = move.checkInSheet(page);
        if (await sheet.count()) {
          t.note('Continue asked for the check-in again');
          await ui.tap(move.sheetStart(sheet));
        }
        await page.waitForURL(/#\/session/);
        await t.ready();
        await t.checkpoint('player-resumed');
        const w = await player.where(page);
        t.note(`resumed at “${w.title}” · ${w.sub}`);
        await ui.tap(player.control(page, 'End session'));
        const leave = page.getByRole('dialog', { name: 'Leave the session?' });
        await leave.waitFor();
        await ui.tap(ui.button(leave, 'Finish now'));
        await page.getByRole('heading', { level: 1, name: /complete$/ }).waitFor();
        await t.checkpoint('summary');
        const finish = page.getByRole('button', { name: /Save and finish/ });
        await ui.tap(finish);
        // The acknowledgment must follow the commit, never precede it.
        await page.getByText('Saved', { exact: true }).waitFor({ timeout: 8000 });
        const snap = await t.db();
        const fresh = (snap.sessions ?? []).filter(s => s.id !== 'legacy-strength');
        await t.check(fresh.length === 1, `${fresh.length} new sessions are stored when “Saved” shows`);
        const s = fresh[0];
        sessionId = s?.id;
        if (s) {
          const done = s.sets.filter(x => x.status === 'completed');
          await t.check(s.status === 'partial', `the attempt is stored as ${s.status}, not partial`);
          await t.check(done.length === 1 && done[0].actualReps === 12 && done[0].weight === 10, `completed sets: ${JSON.stringify(done.map(x => ({ ex: x.exerciseId, reps: x.actualReps, kg: x.weight })))}`);
          const others = s.sets.filter(x => x.status !== 'completed');
          await t.check(others.every(x => x.actualReps === null && x.weight === null), `an unperformed set carries actual reps or weight: ${JSON.stringify(others.filter(x => x.actualReps !== null || x.weight !== null))}`);
          await t.check(s.planId === progressAtExit?.plan.id && s.id === progressAtExit?.sessionId, `the saved session is not the same attempt (${s.id}/${s.planId} vs ${progressAtExit?.sessionId}/${progressAtExit?.plan.id})`);
        }
        const cache = await player.progress(page);
        await t.check(!cache || cache.state.status === 'done', 'the progress cache still holds an unfinished run after the save');
      }, { input: 'Continue; End session → Finish now; Save and finish' });

      await t.step(7, 'Reload Track, open that session, return to Today', async () => {
        await t.goto('/track');
        const row = main.getByRole('link', { name: /Full Body|Guided session/ }).filter({ hasNotText: /Upper A/ });
        await t.must(await row.count() === 1, `today’s Track lists ${await row.count()} new guided sessions, not 1`);
        const rowText = await row.innerText();
        await t.check(/Partial|Partly done/i.test(rowText) && !/Completed/i.test(rowText), `the attempt is not labelled partial in Track: ${rowText.replace(/\n/g, ' ')}`);
        await ui.tap(row);
        await page.waitForTimeout(500);
        const detail = await main.innerText();
        await t.checkpoint('new-session-record');
        await t.check(/Partial|Partly done/i.test(detail), 'the session record does not say it is partial');
        await t.check(!/(\d+) of \1 sets? done/.test(detail.replace(/1 of 1 set done/g, '')) || /1 of \d+ sets? done/.test(detail), `the record reads as all planned sets completed: ${detail.slice(0, 300)}`);
        await ui.tab(page, 'Today');
        const snap = await t.db();
        const sessions = snap.sessions ?? [];
        await t.check(sessions.length === 2 && sessions.some(s => s.id === sessionId), `${sessions.length} sessions stored (want the legacy one and ${sessionId})`);
        const legacy = sessions.find(s => s.id === 'legacy-strength');
        await t.check(!sameJson(seed.sessions[0], legacy).length, 'the legacy session changed');
        const prs = docs(snap).personalRecords ?? [];
        const bench = prs.find(p => p.exerciseId === 'dumbbell-bench-press');
        await t.check(!!bench && !sameJson(seed.personalRecords[0], bench).length, `the bench press PR changed: ${JSON.stringify(bench)}`);
        if (prs.length > 1) t.note(`personal records now: ${JSON.stringify(prs.map(p => `${p.exerciseId} ${p.weight}×${p.reps}`))}`);
        const movement = (snap.observations ?? []).filter(o => ['movementMinutes', 'walkDuration', 'steps'].includes(o.kind));
        await t.check(!movement.length, `movement observations were created: ${movement.map(o => `${o.kind}=${o.value} ${o.context}`).join(', ')}`);
        await t.checkpoint('today-end');
      });
    },
  },
  {
    name: 'health review variant',
    async run(t) {
      const seed = persona('P01', {
        patch: { profile: { needsHealthReview: true } },
        remove: ['profile.health.medicinesReviewed', 'profile.health.metformin', 'profile.health.metforminSince', 'profile.health.priorDkaOrInsulinDeficiency'],
      });
      const page = await t.open({ seed, route: '' });
      // The 3D demo renders in software here; under load a tap can wait well past 8 s.
      t.context.setDefaultTimeout(25000);
      const main = page.getByRole('main');

      await t.step(3, 'Attempt Guided session: a review hold; then review and the metformin-only branch', async () => {
        await t.must(await t.route() === '/today', `opened ${await t.route()}`);
        const todayText = await main.innerText();
        t.note(`Today with an unreviewed profile: ${todayText.split('\n').slice(2, 6).join(' | ')}`);
        const entry = await move.enter(t, 'guided', 'move');
        if (entry.sheet) {
          await ui.answerCheckIn(t, entry.sheet, ui.normalAnswers('P01'));
          await page.waitForTimeout(400);
        }
        const scope = entry.sheet ?? main;
        const text = (await scope.innerText()).replace(/\s+/g, ' ');
        await t.checkpoint('guided-attempt-unreviewed');
        await t.check(await scope.getByRole('button', { name: 'Start session', exact: true }).count() === 0, 'Start session is offered with an unreviewed health profile');
        await t.check(/health questions|medicine|health profile/i.test(text), `the refusal does not name the health/medicine review: ${text.slice(0, 240)}`);
        if (entry.sheet) await ui.tap(ui.button(entry.sheet, 'Close'));

        await reviewMedicines(t);
        await t.reload();
        const snap = await t.checkpoint('profile-after-review');
        const h = docs(snap).profile?.health ?? {};
        const want = { insulin: 'none', sulfonylureaOrMeglitinide: false, sglt2i: false, metformin: true, metforminSince: '2019', priorDkaOrInsulinDeficiency: false, medicinesReviewed: true };
        const bad = Object.entries(want).filter(([k, v]) => h[k] !== v);
        await t.check(!bad.length, `the reviewed health answers are not stored as given: ${bad.map(([k, v]) => `${k}=${JSON.stringify(h[k])} (want ${JSON.stringify(v)})`).join(', ')}`);
        await t.check(docs(snap).profile?.needsHealthReview !== true, 'the profile still needs a health review after saving it');

        // Today's check-in (normal answers, no glucose) now decides: either the
        // player opens, or the check-in shows its permission-approved Start.
        const again = await move.enter(t, 'guided', 'move');
        if (again.sheet) {
          if (await again.sheet.getByRole('heading', { name: 'Right now, any of these?' }).count()) await ui.answerCheckIn(t, again.sheet, ui.normalAnswers('P01'));
          await page.waitForTimeout(400);
          await t.checkpoint('guided-after-review');
          await t.check(await ui.button(again.sheet, 'Start session').count() === 1, `metformin-only with no glucose reading is not allowed to start: ${(await again.sheet.innerText()).replace(/\s+/g, ' ').slice(0, 300)}`);
        } else {
          await t.checkpoint('guided-after-review');
          const text = await main.innerText();
          await t.check((await t.route()).startsWith('/session') && await player.control(page, 'Start').count() === 1 && !/Back to Today/.test(text),
            `after the review the guided session does not open its player: ${await t.route()} ${text.replace(/\s+/g, ' ').slice(0, 200)}`);
          t.note('after the review, the morning’s check-in (no glucose reading) let the session open directly');
        }
      }, { input: 'variant: medicinesReviewed, metformin, metforminSince, priorDka omitted; needsHealthReview=true. Review: no insulin, no SU, no SGLT2, metformin yes since 2019, no prior DKA' });
    },
  },
];
