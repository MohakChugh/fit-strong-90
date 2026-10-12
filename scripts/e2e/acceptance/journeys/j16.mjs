/**
 * J16, P06: flare, deterioration and neurological red flags
 * (codex-acceptance.md, SAFETY 8 of 10; basis D25, D28, D29(7), D30; A-BACK,
 * T-NEURO, T-BACK, E-CES and E-BILATERAL).
 *
 * Every independent row is its own case (fresh context). P06 has an active
 * flare from today and yesterday's check-in (back 3, leg 2, reach thigh).
 * P06 is not in the programme, so its modes are Stretch and Walk (D35); the
 * Guided row of step 6 seeds P06 enrolled, the spec's defined setup.
 */
import { MINUTE } from '../lib/env.mjs';
import { docs } from '../lib/harness.mjs';
import * as ui from '../lib/ui.mjs';
import * as mv from '../lib/move.mjs';
import { ENROLLED, persona } from '../fixtures/personas.mjs';
import { STARTERS, buttonLabels, openGuided, outcome, walkRows, openApp } from '../lib/safety-c.mjs';

export const id = 'J16';
export const title = 'Flare, deterioration and neurological red flags';
export const safety = true;

const TODAY = 'No exercise today. Get medical advice today.';
/** The modes P06 can start: not in the programme, Guided is only a way to join it (D35). */
const MODES = ['stretch', 'walk'];
const EMERGENCY = 'Call emergency services now';
const STOP_WORDS = /stop that movement|symptom|feel worse|getting worse|I need to stop|stop now|pain|tingl|numb/i;
const INVENTED = /20 ?%|\+ ?500|500 (more )?steps|(safe|acceptable) (pain|level|threshold)|pain (score )?(of |under |below )?\d+ (or less )?(is|means) (safe|fine)/i;

/** P06's answers for one row: low pain, reach and flags as given; no emergency, nothing else. */
const answers = ({ pain = 1, leg = 1, reach = 'Foot', flags = [], news = [], emergency = [] } = {}) => ({
  emergency, back: { pain, leg, reach, flags }, news, sleep: 'Over 7 h', energy: 'Good',
});

/**
 * Enter a mode from Move. Walk setup may refuse on its own screen once
 * today's answers rule walking out, with no Start walk to tap.
 */
async function enterMode(t, mode) {
  const page = t.page;
  const main = page.getByRole('main');
  if (mode === 'guided') {
    // Only an enrolled persona has a guided session to start (D35).
    const g = await openGuided(t);
    if (g.viaProgramme) throw new Error('Guided session: P06 is not in the programme, so Move offers only the way to join it (D35)');
    return g;
  }
  if (mode !== 'walk') return mv.enter(t, mode, 'move');
  await ui.tab(page, 'Move');
  await ui.tap(ui.row(main, 'Walk', 'link'));
  await page.getByRole('heading', { level: 1, name: 'Walk', exact: true }).waitFor();
  await page.waitForTimeout(300);
  const start = ui.button(main, 'Start walk');
  if (!(await start.count())) return { route: await t.route(), setupRefusal: true };
  await ui.tap(start);
  await page.waitForTimeout(500);
  const sheet = mv.checkInSheet(page);
  return (await sheet.count()) ? { sheet, route: await t.route() } : { route: await t.route() };
}

/** Open the check-in for a mode from Move (or Today when Walk setup refuses) and answer it. */
async function checkInVia(t, mode, a, tag) {
  let r = await enterMode(t, mode);
  if (r.setupRefusal) {
    await t.hash(`/today?checkin=${mode}`);
    r = { sheet: mv.checkInSheet(t.page), route: await t.route() };
    await r.sheet.waitFor({ timeout: 30000 });
  }
  await t.must(!!r.sheet, `${mode}: no check-in opened (${r.route})`);
  await toQuestions(r.sheet);
  await t.checkpoint(`${tag}-check-in`);
  await ui.answerCheckIn(t, r.sheet, a);
  await t.page.waitForTimeout(600);
  await t.checkpoint(`${tag}-outcome`);
  return { sheet: r.sheet, ...(await outcome(t.page)) };
}

/**
 * Every mode is refused with this headline; nothing offers to start. While
 * the engine refuses, each setup refuses before any tap (scan S-15): no
 * Start, the reason on screen, and "Review today’s check-in" opens the
 * check-in with the same refusal.
 */
async function allModesRefused(t, headline, tag) {
  const page = t.page;
  const direction = headline === EMERGENCY ? 'emergency' : 'today';
  for (const mode of MODES) {
    await t.goto('/today');
    const r = await enterMode(t, mode);
    if (r.sheet) {
      // The setup offered its Start, and only the check-in behind it refused.
      await t.check(false, `${tag}: the ${mode} setup still offers its Start before any tap while today’s answers refuse`);
      const seen = await outcome(page);
      const offers = (await buttonLabels(r.sheet)).filter(l => STARTERS.test(l));
      await t.check(offers.length === 0, `${tag}: ${mode} still offers ${JSON.stringify(offers)}`);
      await t.check(seen.title === headline || seen.text.includes(headline), `${tag}: ${mode} reads “${seen.title}”, not “${headline}”`);
      await ui.tap(ui.button(r.sheet, 'Close'));
      continue;
    }
    const main = page.getByRole('main');
    const refusal = await mv.setupRefusal(page, mode);
    const text = refusal?.text || (await main.innerText()).replace(/\s+/g, ' ');
    const offers = (await buttonLabels(main)).filter(l => STARTERS.test(l));
    await t.check(offers.length === 0 && !/^\/walk\/live|^\/session/.test(r.route), `${tag}: ${mode} opened ${r.route} offering ${JSON.stringify(offers)}`);
    // The setup's own words carry the same care direction (spec, outcome table).
    const same = headline === EMERGENCY ? /emergency|help now/i.test(text) : /today/i.test(text) && /doctor|clinician|medical|care team/i.test(text);
    await t.check(same, `${tag}: the ${mode} setup refuses without the ${direction} direction on screen: ${text.slice(0, 200)}`);
    await t.check(!!refusal?.review, `${tag}: the refusing ${mode} setup offers no “Review today’s check-in”`);
    if (refusal?.review) {
      const sheet = await mv.reviewFromSetup(page);
      const seen = await outcome(page);
      await t.check(seen.title === headline || seen.text.includes(headline), `${tag}: ${mode}’s “Review today’s check-in” reads “${seen.title}”, not “${headline}”`);
      await t.check(!(await mv.sheetStart(sheet).count()), `${tag}: ${mode}’s check-in offers ${await mv.sheetStart(sheet).allInnerTexts()}`);
      await ui.tap(ui.button(sheet, 'Close'));
    }
  }
  // A direct link to the player is refused too.
  await t.goto('/session?mode=stretch&focus=backHips&minutes=10');
  const gate = await outcome(page);
  await t.check(!(await page.getByRole('button', { name: 'Start', exact: true }).count()), `${tag}: the stretch player link still offers Start`);
  await t.check(gate.text.includes(headline) || gate.title === headline, `${tag}: the stretch player link reads “${gate.title}”`);
  await t.checkpoint(`${tag}-direct-player`);
}

/** The report a player offers while moving, if any: anything named for symptoms other than ending the session. */
async function symptomStop(page) {
  const main = page.getByRole('main');
  const all = await main.getByRole('button').all();
  for (const b of all) {
    const name = ((await b.getAttribute('aria-label')) ?? (await b.innerText())).trim();
    if (/^(End session|Previous|Next|Pause|Resume|Add 15 seconds|Unmute voice|Mute voice|How to do it|I feel low)$/.test(name)) continue;
    if (STOP_WORDS.test(name)) return b;
  }
  return undefined;
}

/** Wait for the check-in to show either its questions or its outcome, then make sure the questions are up. */
async function toQuestions(sheet) {
  const questions = sheet.getByRole('heading', { name: 'Right now, any of these?', exact: true });
  const change = ui.button(sheet, 'Change answers');
  await questions.or(change).waitFor({ timeout: 30000 });
  if (await change.count()) await ui.tap(change);
  await questions.waitFor();
}

/** Report through the check-in, from wherever the person is, then come back. */
async function reportByCheckIn(t, mode, a) {
  // `?checkin=` opens the sheet when Today mounts, so come to Today from elsewhere.
  if (/^\/today/.test(await t.route())) await t.hash('/move');
  await t.hash(`/today?checkin=${mode}`);
  const sheet = mv.checkInSheet(t.page);
  // Leaving a full-screen player for Today can take seconds here: the view
  // transition snapshots a software-rendered 3D canvas.
  await sheet.waitFor({ timeout: 30000 });
  await toQuestions(sheet);
  await ui.answerCheckIn(t, sheet, a);
  await t.page.waitForTimeout(600);
  const result = { ...(await outcome(t.page)), start: (await mv.sheetStart(sheet).count()) > 0 };
  await ui.tap(ui.button(sheet, 'Close'));
  return result;
}

/** Back & leg in Track: pain, reach and flags survive; no diagnosis or promised recovery date. */
async function backLegSurvives(t, { pain, leg, flagWords }) {
  const page = t.page;
  await t.goto('/track/back');
  const text = (await page.getByRole('main').innerText()).replace(/\s+/g, ' ');
  await t.checkpoint('back-and-leg');
  await t.check(new RegExp(`Back pain ${pain} of 10`).test(text), `Back & leg does not show today’s back pain ${pain}: ${text.slice(0, 300)}`);
  if (leg !== undefined) await t.check(new RegExp(`Leg pain ${leg} of 10`).test(text), `Back & leg does not show today’s leg pain ${leg}`);
  await t.check(!/nerve damage|recover(ed|y)? (by|within|in \d)|will (heal|recover)|cure/i.test(text), `Back & leg makes a diagnosis or promises recovery: ${/[^.]*(nerve damage|recover|heal|cure)[^.]*/i.exec(text)?.[0]}`);
  const snap = await t.db();
  const today = (docs(snap).checkIns ?? []).find(c => c.date === '2026-10-08');
  for (const w of flagWords ?? []) await t.check(!!today?.back?.[w] || (today?.emergency ?? []).includes(w), `the check-in lost ${w}: ${JSON.stringify(today?.back)}`);
  const obs = (snap.observations ?? []).filter(o => o.day === '2026-10-08' && o.context === 'checkIn:2026-10-08');
  const bp = obs.find(o => o.kind === 'backPain');
  await t.check(bp?.value === pain && bp.scope === 'pointInTime' && bp.source === 'manual', `back pain ${pain} is not a manual point observation: ${JSON.stringify(bp)}`);
  if (leg !== undefined) {
    const lp = obs.find(o => o.kind === 'legPain');
    await t.check(lp?.value === leg, `leg pain ${leg} is not its own observation: ${JSON.stringify(lp)}`);
  }
  return { text, today };
}

/** Rows that end in "today" or "emergency", each in its own context. */
function redFlagCase(name, step, a, headline, extra) {
  return {
    name,
    async run(t) {
      await openApp(t, { seed: persona('P06'), route: '/today' });
      await t.step(step, name, async () => {
        const r = await checkInVia(t, 'stretch', a, 'red-flag');
        await t.check(r.title === headline, `outcome is “${r.title}”, not “${headline}”: ${r.text.slice(0, 260)}`);
        await t.check(!INVENTED.test(r.text), `the outcome invents a rule: ${INVENTED.exec(r.text)?.[0]}`);
        if (headline === EMERGENCY) await t.check(/No exercise today/.test(r.text), 'the emergency does not say “No exercise today.”');
        await ui.tap(ui.button(r.sheet, 'Close'));
        await allModesRefused(t, headline, name);
        const snap = await t.db();
        await t.check(walkRows(snap).length === 0 && (snap.sessions ?? []).length === 0, 'a refused case recorded movement or a session');
        if (extra) await extra(t, snap);
      }, { input: JSON.stringify(a) });
    },
  };
}

const footDrop = ui.BACK_FLAG.newWeakness;

/** The "Right now" list folds to its answer once "None of these" is chosen; open it again to add one. */
async function tickEmergency(sheet, label) {
  const right = ui.section(sheet, 'Right now, any of these?');
  const again = ui.button(right, 'Show the list again');
  if (await again.count()) await ui.tap(again);
  await ui.tap(ui.checkbox(right, label));
}

export const cases = [
  {
    name: 'flare then adjust',
    async run(t) {
      const page = await openApp(t, { seed: persona('P06'), route: '/today' });
      await t.step(1, 'Today with the active Flare-up status', async () => {
        const main = page.getByRole('main');
        const text = (await main.innerText()).replace(/\s+/g, ' ');
        await t.checkpoint('today-flare');
        await t.check(/gentle|rest/i.test(text) && /flare/i.test(text), `Today does not offer gentle or no movement for the flare, with its reason: ${text.slice(0, 300)}`);
        await t.check(/Why this\?/.test(text), 'no visible reason on Today');
        await t.check(!/Week \d+ of 12|programme|don.t break|make up/i.test(text), `Today shows programme pressure during a flare: ${/[^.]*(Week \d+ of 12|programme|make up)[^.]*/i.exec(text)?.[0]}`);
        await t.check(!INVENTED.test(text), `Today claims a pain score proves safety: ${INVENTED.exec(text)?.[0]}`);
        const prompts = await main.getByRole('button', { name: /^Add \d+ ml$/ }).count();
        await t.check(prompts === 0, 'a habit prompt shows during the flare');
      });
      await t.step(2, 'Pain 1, reach Foot, walking or sitting newly harder; no weakness or emergency', async () => {
        const before = docs(await t.db()).profile?.ladder;
        const r = await checkInVia(t, 'stretch', answers({ flags: [ui.BACK_FLAG.worseFunction] }), 'adjust');
        await t.check(r.title === 'Go ahead, with changes', `outcome is “${r.title}”, not “Go ahead, with changes”: ${r.text.slice(0, 260)}`);
        await t.check(/no progression/i.test(r.text), `the outcome does not withhold progression: ${r.text.slice(0, 300)}`);
        await t.check(/felt fine|tolerated|previously/i.test(r.text), `the outcome does not keep to previously tolerated activity: ${r.text.slice(0, 300)}`);
        await t.check(/stop (anything|what)|provok/i.test(r.text), `the outcome does not say to stop provoking activity: ${r.text.slice(0, 300)}`);
        await t.check(!INVENTED.test(r.text), `the outcome invents a rule: ${INVENTED.exec(r.text)?.[0]}`);
        await t.check(await mv.sheetStart(r.sheet).count() === 1, 'no gentle start is offered after an adjust');
        const snap = await t.db();
        const after = docs(snap).profile?.ladder;
        await t.check(after?.hinge <= before?.hinge && after?.squat <= before?.squat, `the loading ladder moved up: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
        const today = (docs(snap).checkIns ?? []).find(c => c.date === '2026-10-08');
        await t.check(today?.back?.reach === 'foot' && today?.back?.worseFunction === true && today?.back?.pain === 1 && today?.back?.legPain === 1,
          `the check-in does not keep reach and function separately: ${JSON.stringify(today?.back)}`);
        await ui.tap(ui.button(r.sheet, 'Close'));
      }, { input: 'back 1, leg 1, reach Foot, “Walking or sitting is harder than after your last session”' });
      await t.step(8, 'Reload Track → Back & leg, then attempt another mode', async () => {
        await t.reload();
        await backLegSurvives(t, { pain: 1, leg: 1, flagWords: ['worseFunction'] });
        await t.goto('/today');
        // Walk, the other mode P06 can start (D35).
        const r = await enterMode(t, 'walk');
        if (r.sheet) {
          const o = await outcome(page);
          await t.check(/no progression/i.test(o.text) || !(await mv.sheetStart(r.sheet).count()), `Walk ignores today’s worse function: ${o.text.slice(0, 200)}`);
          await ui.tap(ui.button(r.sheet, 'Close'));
        }
      });
    },
  },
  {
    name: 'foot drop',
    async run(t) {
      await openApp(t, { seed: persona('P06'), route: '/today' });
      await t.step(3, 'Same low pain, new foot drop or a leg getting weaker', async () => {
        const r = await checkInVia(t, 'stretch', answers({ flags: [footDrop] }), 'foot-drop');
        await t.check(r.title === TODAY, `outcome is “${r.title}”, not “${TODAY}”: ${r.text.slice(0, 260)}`);
        await t.check(/today/i.test(r.text) && /doctor|clinician|checked/i.test(r.text), 'no assessment today is advised');
        await t.check(!/recovery session|Start recovery/i.test(r.text), 'a recovery session is still offered');
        await ui.tap(ui.button(r.sheet, 'Close'));
        await allModesRefused(t, TODAY, 'foot drop');
      }, { input: 'back 1, leg 1, reach Foot, “New foot drop or foot dragging, or a leg getting weaker”' });
      await t.step(8, 'Reload Track → Back & leg, then attempt another mode', async () => {
        await t.reload();
        await backLegSurvives(t, { pain: 1, leg: 1, flagWords: ['newWeakness'] });
        await allModesRefused(t, TODAY, 'foot drop after reload');
      });
    },
  },
  {
    name: 'foot drop with pain 0',
    async run(t) {
      await openApp(t, { seed: persona('P06'), route: '/today' });
      await t.step(3, 'Pain 0 cannot clear a reported foot drop', async () => {
        const r = await checkInVia(t, 'stretch', answers({ pain: 0, leg: 0, reach: 'Back', flags: [footDrop] }), 'foot-drop-0');
        await t.check(r.title === TODAY, `with pain 0 the foot drop reads “${r.title}”, not “${TODAY}”`);
        await ui.tap(ui.button(r.sheet, 'Close'));
        await allModesRefused(t, TODAY, 'foot drop, pain 0');
      }, { input: 'back 0, leg 0, reach Back, foot drop' });
    },
  },
  ...[
    { name: 'weakness worse over hours', add: async sheet => { await ui.tap(ui.checkbox(ui.section(sheet, 'Since your last check-in, any of these?'), ui.BACK_FLAG.weaknessFast)); await ui.tap(ui.button(sheet, ui.SUBMIT)); }, word: 'weaknessFast' },
    { name: 'new bilateral weakness', add: sheet => tickEmergency(sheet, ui.EMERGENCY.bothLegs), word: 'bothLegs' },
    { name: 'bladder or bowel', add: sheet => tickEmergency(sheet, ui.EMERGENCY.bladderBowel), word: 'bladderBowel' },
    { name: 'saddle numbness', add: sheet => tickEmergency(sheet, ui.EMERGENCY.saddle), word: 'saddle' },
  ].map(row => ({
    name: row.name,
    async run(t) {
      const page = await openApp(t, { seed: persona('P06'), route: '/today' });
      await t.step(4, `Foot drop, then add: ${row.name}`, async () => {
        const first = await checkInVia(t, 'stretch', answers({ flags: [footDrop] }), 'escalate-base');
        await t.check(first.title === TODAY, `the foot drop alone reads “${first.title}”`);
        await ui.tap(ui.button(first.sheet, 'Change answers'));
        await row.add(first.sheet);
        await page.waitForTimeout(700);
        const r = await outcome(page);
        await t.checkpoint('escalated');
        await t.check(r.title === EMERGENCY, `adding ${row.name} reads “${r.title}”, not “${EMERGENCY}”: ${r.text.slice(0, 260)}`);
        await t.check(/No exercise today/.test(r.text), 'the emergency does not say “No exercise today.”');
        await t.check(!/1 ?(out )?of 10|pain is low|sciatica.*(known|usual)/i.test(r.text), 'the emergency is softened by the low pain or the known sciatica');
        await ui.tap(ui.button(first.sheet, 'Close'));
        await allModesRefused(t, EMERGENCY, row.name);
        const snap = await t.db();
        const today = (docs(snap).checkIns ?? []).find(c => c.date === '2026-10-08');
        await t.check(today?.urgentSymptoms === true || today?.back?.weaknessFast === true, `the emergency is not stored: ${JSON.stringify({ e: today?.emergency, u: today?.urgentSymptoms })}`);
        await t.check(today?.back?.[row.word] === true || (today?.emergency ?? []).includes(row.word), `${row.word} is not on the stored check-in`);
      }, { input: `back 1, leg 1, reach Foot, foot drop, then ${row.name}` });
    },
  })),
  redFlagCase('fever with back pain', 5, answers({ flags: [ui.BACK_FLAG.feverish] }), TODAY, async (t, snap) => {
    const today = (docs(snap).checkIns ?? []).find(c => c.date === '2026-10-08');
    await t.check(today?.back?.feverish === true, 'the fever answer was not stored');
    await t.check(!(snap.observations ?? []).some(o => /temp/i.test(o.kind)), 'a temperature was fabricated');
  }),
  redFlagCase('sudden severe back pain', 5, answers({ flags: [ui.BACK_FLAG.suddenSevere] }), TODAY),
  ...['stretch', 'walk', 'guided'].map(mode => ({
    name: `symptom stop during ${mode}`,
    async run(t) {
      // Defined setup for the Guided row: P06 seeded in the programme (ENROLLED), since only an enrolled person has a guided session (D35).
      const seed = mode === 'guided' ? persona('P06', { patch: ENROLLED }) : persona('P06');
      if (mode === 'guided') t.note('defined setup: P06 seeded in the programme (settings.startDate 2026-09-24, training Mon/Thu/Sat), so Thursday has a guided session');
      const page = await openApp(t, { seed, route: '/today', sensors: { geo: 'deny' } });
      const main = page.getByRole('main');
      await t.step(6, `Start a permitted gentle ${mode}, then stop it for new distal spread, then new foot drop`, async () => {
        const r = await checkInVia(t, mode, answers({ reach: 'Thigh' }), `${mode}-permitted`);
        await t.must(await mv.sheetStart(r.sheet).count() === 1, `${mode} is not permitted for the gentle case: “${r.title}” ${r.text.slice(0, 200)}`);
        await ui.tap(mv.sheetStart(r.sheet));
        await page.waitForTimeout(800);
        if (mode === 'walk') {
          if (/^\/walk$/.test(await t.route())) await ui.tap(ui.button(main, 'Start walk'));
          await page.waitForTimeout(800);
          await t.must(/^\/walk\/live/.test(await t.route()), `Start walk opened ${await t.route()}`);
        } else {
          await ui.button(main, 'Start').click({ timeout: 20000 });
        }
        await t.advance(MINUTE);
        await t.checkpoint(`${mode}-moving`);

        // The visible symptom-stop control, while moving.
        const stop = mode === 'walk' ? ui.button(main, 'I need to stop') : await symptomStop(page);
        const hasStop = mode === 'walk' ? (await stop.count()) === 1 : !!stop;
        await t.check(hasStop, `no visible symptom-stop control while the ${mode} is running (controls: ${JSON.stringify(await buttonLabels(main))})`);
        let reportable = false;
        if (hasStop) {
          await ui.tap(stop);
          await page.waitForTimeout(500);
          const dialog = page.getByRole('dialog');
          const text = (await dialog.innerText().catch(() => '')).replace(/\s+/g, ' ');
          await t.checkpoint(`${mode}-stop-control`);
          const options = await dialog.getByRole('checkbox').count() + await dialog.getByRole('radio').count();
          reportable = options > 0 && /further down|spread/i.test(text) && /foot drop|weak/i.test(text);
          await t.check(reportable, `the ${mode}’s stop control cannot record new distal spread or new foot drop: ${text.slice(0, 260)}`);
          const running = await main.getByRole('button', { name: 'Pause', exact: true }).count();
          await t.check(!running || mode !== 'walk', `stopping did not pause the ${mode}`);
          if (reportable) {
            await ui.tap(dialog.getByRole('checkbox', { name: /further down/i }));
            await ui.tap(dialog.getByRole('button').filter({ hasNotText: /^Close$/ }).last());
            await page.waitForTimeout(600);
          } else if (await dialog.count()) {
            // Leave the stop sheet open as a person would close it.
            const close = dialog.getByRole('button', { name: 'Close', exact: true });
            if (await close.count()) await ui.tap(close);
          }
        }
        // Distal spread through the shared check-in (the only route if the player has none).
        if (!reportable) t.note(`${mode}: reported through the check-in because the stop control has no symptom answers`);
        const spread = await reportByCheckIn(t, mode, answers({ reach: 'Foot', flags: [] }));
        // Progression withheld in words, or this mode refused for today, which is stronger: the walk
        // that provoked the spread ends rather than continuing without progression.
        const refused = !spread.start && (spread.title === TODAY || spread.title === EMERGENCY || /^No (walk|stretch|session) for now$/.test(spread.title ?? ''));
        await t.check(/no progression|further/i.test(spread.text) || refused,
          `distal spread neither blocks progression nor refuses ${mode}: “${spread.title}” ${spread.text.slice(0, 200)}`);
        // New foot drop ends exercise and directs today care, during activity and on Resume.
        const drop = await reportByCheckIn(t, mode, answers({ reach: 'Foot', flags: [footDrop] }));
        await t.check(drop.title === TODAY, `new foot drop reads “${drop.title}”, not “${TODAY}”`);
        await t.checkpoint(`${mode}-after-foot-drop`);
        if (mode === 'walk') {
          await t.hash('/walk/live');
          await page.waitForTimeout(600);
          const resume = main.getByRole('button', { name: /^(Resume|Continue walking|I am fine: carry on walking)$/ });
          await t.check(!(await resume.count()), `the walk still offers ${await resume.allInnerTexts()} after foot drop`);
          const text = await main.innerText();
          await t.check(/on hold|No exercise today|today/i.test(text), `the live walk does not show the refusal after foot drop: ${text.slice(0, 200)}`);
        } else {
          await t.hash(mode === 'stretch' ? '/session?mode=stretch&focus=backHips&minutes=10' : '/session?resume=1');
          await page.waitForTimeout(800);
          const text = (await main.innerText()).replace(/\s+/g, ' ');
          await t.check(!(await main.getByRole('button', { name: /^(Start|Resume|Keep going)$/ }).count()), `the ${mode} player still offers to carry on after foot drop`);
          await t.check(text.includes(TODAY) || /today/i.test(text), `the ${mode} player does not show the today direction after foot drop: ${text.slice(0, 200)}`);
        }
        await t.checkpoint(`${mode}-resume-refused`);
        const snap = await t.db();
        const today = (docs(snap).checkIns ?? []).find(c => c.date === '2026-10-08');
        await t.check(today?.back?.newWeakness === true && today?.back?.reach === 'foot', `the stop answers did not survive: ${JSON.stringify(today?.back)}`);
      }, { input: `${mode}: gentle start (back 1, leg 1, reach Thigh), then spread to Foot, then foot drop` });
    },
  })),
  {
    name: 'dizzy with normal BP',
    async run(t) {
      await openApp(t, { seed: persona('P06', { patch: { profile: { health: { bpMonitor: true } } } }), route: '/today' });
      await t.step(7, 'Dizzy or faint on standing or when active, BP 110/70', async () => {
        const r = await checkInVia(t, 'stretch', { ...answers({ reach: 'Thigh' }), bp: [[110, 70]], news: [ui.NEWS.dizzy] }, 'dizzy');
        await t.check(r.title !== 'Good to go' && r.title !== 'Go ahead, with changes', `dizziness with a normal-looking BP still allows movement: “${r.title}”`);
        await t.check(/sit|lie/i.test(r.text), `no safe sit or lie direction: ${r.text.slice(0, 260)}`);
        await t.check(!(await mv.sheetStart(r.sheet).count()), 'a start is still offered while dizzy');
      }, { input: 'BP 110/70; “Dizzy or faint on standing or when active”' });
    },
  },
  {
    name: 'dizzy with a fluid limit',
    async run(t) {
      await openApp(t, { seed: persona('P06', { patch: { profile: { health: { bpMonitor: true, fluidRestriction: true } } } }), route: '/today' });
      await t.step(7, 'Dizzy with BP 110/70 and a prescribed fluid limit', async () => {
        const r = await checkInVia(t, 'stretch', { ...answers({ reach: 'Thigh' }), bp: [[110, 70]], news: [ui.NEWS.dizzy] }, 'dizzy-fluid');
        await t.check(!(await mv.sheetStart(r.sheet).count()), 'a start is still offered while dizzy');
        await t.check(/sit|lie/i.test(r.text), 'no safe sit or lie direction');
        await t.check(!/\bdrink\b|have a drink|sip (water|fluids)|extra fluids/i.test(r.text), `a fluid instruction is given despite the fluid limit: ${/[^.]*(drink|sip|fluids)[^.]*/i.exec(r.text)?.[0]}`);
      }, { input: 'fluidRestriction true; BP 110/70; dizzy' });
    },
  },
  redFlagCase('collapse without recovery', 7, { ...answers({ reach: 'Thigh' }), emergency: [ui.EMERGENCY.collapse] }, EMERGENCY),
  {
    name: 'historical bilateral sciatica control',
    async run(t) {
      const page = await openApp(t, { seed: persona('P06', { patch: { profile: { pain: { sciaticaSide: 'both' } } } }), route: '/today' });
      await t.step(4, 'Historical bilateral sciatica, no new bilateral loss: not an emergency; unanswered leg pain makes no zero', async () => {
        const r = await enterMode(t, 'stretch');
        await t.must(!!r.sheet, 'no check-in opened');
        // Back pain answered, leg pain deliberately left untouched.
        await ui.answerCheckIn(t, r.sheet, { emergency: [], back: { pain: 1, reach: 'Thigh', flags: [] }, news: [], sleep: 'Over 7 h', energy: 'Good' });
        await page.waitForTimeout(600);
        const o = await outcome(page);
        await t.checkpoint('bilateral-history');
        await t.check(o.title !== EMERGENCY && o.title !== TODAY, `historical bilateral sciatica alone reads “${o.title}”`);
        const snap = await t.db();
        const leg = (snap.observations ?? []).filter(x => x.kind === 'legPain' && x.day === '2026-10-08');
        await t.check(leg.length === 0, `an unanswered leg pain was stored as ${JSON.stringify(leg.map(x => x.value))}`);
        await ui.tap(ui.button(r.sheet, 'Close'));
      }, { input: 'sciaticaSide both; back 1, leg untouched, reach Thigh, no flags' });
      await t.step(8, 'Sciatica education: weeks to months, recurrence possible, no cure promised', async () => {
        await t.goto('/guide/topic/back');
        const main = page.getByRole('main');
        const cards = await main.getByRole('link').filter({ hasNotText: /^Guide$/ }).all();
        let text = '';
        const hrefs = [];
        for (const c of cards) hrefs.push(await c.getAttribute('href'));
        for (const h of hrefs.filter(Boolean)) {
          await t.goto(h.replace(/^#/, ''));
          text += ` ${(await main.innerText()).replace(/\s+/g, ' ')}`;
        }
        await t.checkpoint('sciatica-education');
        await t.check(/weeks (to|or) months|several weeks|months/i.test(text), 'no sciatica education says improvement often takes weeks to months');
        await t.check(/come back|recur|return/i.test(text), 'no sciatica education says it can come back');
        await t.check(!/\bcures?\b|guarantee/i.test(text), `the education promises a cure: ${/[^.]*(cure|guarantee)[^.]*/i.exec(text)?.[0]}`);
      });
    },
  },
];
