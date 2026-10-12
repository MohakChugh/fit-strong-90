/**
 * J03, P01/P06 and healthy controls: emergency precedence
 * (codex-acceptance.md, SAFETY 1 of 10; basis D28, D29(2), D30; E-CARDIAC,
 * E-CES, E-BILATERAL, E-HYPO, E-BP, E-DKA-SYMPTOM and E-OTHER).
 *
 * Cases:
 *   step1-<mode>      glucose 900 typed, then chest — Guided, Stretch, Walk separately (steps 1, 3, 6)
 *   row-<answer>      each emergency answer with glucose 110, BP 120/80, pain 0 (steps 2, 3, 6)
 *   p06-<answer>      the back emergencies for the non-diabetic sciatica persona
 *   control-<what>    nonemergency controls: faint and recovered, hot today, historical bilateral sciatica, a healthy profile
 *   step4-resume      a saved runnable session cannot mask a new emergency
 *   step5-profile     a saddle/bladder answer survives a profile edit that hides its question (steps 5, 6)
 */
import { persona } from '../fixtures/personas.mjs';
import { docs } from '../lib/harness.mjs';
import * as ui from '../lib/ui.mjs';
import * as s from '../lib/safety-a.mjs';

export const id = 'J03';
export const title = 'Emergency precedence';
export const safety = true;

/** Stored reason codes per answer (engine EMERGENCY table). */
const CODE = {
  chest: 'chest', stroke: 'stroke', breathless: 'breathless', collapse: 'collapse', bladderBowel: 'caudaEquina', saddle: 'caudaEquina',
  bothLegs: 'bothLegs', lowCantTreat: 'lowCantTreat', dka: 'dka', accident: 'accident', heatConfusion: 'heatConfusion',
};

const ORAL = /15 ?g|fast-acting carbohydrate|glucose tablets|juice|regular soda|tablespoon of sugar|then eat|eat something|sip/i;
const emergencyOnly = () => [s.TITLE.emergency];

/** The emergency as the sheet shows it, immediately, with nothing gentler beside it. */
async function expectEmergencyNow(t, sheet, flag) {
  await sheet.getByRole('alert').filter({ hasText: s.TITLE.emergency }).waitFor({ timeout: 4000 }).catch(() => {});
  const title = await s.outcomeTitle(sheet);
  await t.must(title === s.TITLE.emergency, `ticking “${ui.EMERGENCY[flag]}” showed “${title ?? '(no outcome)'}”, not “${s.TITLE.emergency}”, without Submit`);
  const text = (await sheet.innerText()).replace(/\s+/g, ' ');
  await t.check(text.includes('No exercise today.'), 'the emergency outcome does not say “No exercise today.”');
  for (const p of s.emergencyProblems(text)) await t.check(false, `emergency outcome for ${flag}: ${p}`);
  const starts = await sheet.getByRole('button', { name: /^(Start|Continue)/ }).allInnerTexts();
  await t.check(starts.length === 0, `a start is offered beside the emergency: ${starts.join(', ')}`);
  return text;
}

/** The stored record says what was answered (spec "Stored"). */
async function expectStoredEmergency(t, snap, flag) {
  const c = s.checkInOf(snap);
  await t.must(!!c, 'no check-in for 8 October was stored after the emergency answer');
  await t.check(c.emergency?.includes(flag), `stored emergency is ${JSON.stringify(c.emergency)}, missing ${flag}`);
  await t.check(c.urgentSymptoms === true, `stored urgentSymptoms is ${c.urgentSymptoms}`);
  await t.check(c.readiness?.disposition === 'emergency', `stored readiness disposition is ${c.readiness?.disposition}`);
  await t.check((c.readiness?.reasons ?? []).some(r => r.code === CODE[flag] && r.disposition === 'emergency'),
    `stored reasons ${JSON.stringify((c.readiness?.reasons ?? []).map(r => r.code))} lack the ${CODE[flag]} emergency`);
}

/** Nothing moved: no new session, no movement observations (spec "Stored"). */
async function expectNoActivity(t, snap, sessionsBefore) {
  const sessions = snap.sessions ?? [];
  await t.check(sessions.length === sessionsBefore, `${sessions.length - sessionsBefore} session(s) were created`);
  const moved = s.movementObs(snap);
  await t.check(moved.length === 0, `movement observations were recorded: ${moved.map(o => `${o.kind} ${o.value}`).join(', ')}`);
}

/** Step 3: every other mode and every direct link refused; Learn and past entry still reachable. */
async function step3(t) {
  await t.step(3, 'Close the sheet; attempt every mode, including direct links', async () => {
    await s.closeSheet(t.page);
    const problems = await s.expectAllRefused(t, emergencyOnly);
    await t.checkpoint('after-every-entry');
    for (const p of problems) await t.check(false, `not refused with the emergency: ${p}`);
    for (const p of await s.learnAndLogReachable(t)) await t.check(false, p);
    await t.checkpoint('learn-and-log');
  });
}

/** Step 6: reload; the flag and the refusal survive, and nothing moved. */
async function step6(t, flag, sessionsBefore, mode = 'guided') {
  await t.step(6, 'Reload after the save has committed', async () => {
    await t.reload();
    await s.backToTabs(t);
    await ui.tab(t.page, 'Today');
    const card = t.page.getByRole('main').getByRole('region').filter({ has: t.page.getByRole('heading', { level: 3 }) });
    const cardTitle = (await card.getByRole('heading', { level: 3 }).innerText()).trim();
    await t.check(cardTitle === s.TITLE.emergency, `after reload Today leads with “${cardTitle}”, not the emergency`);
    const snap = await t.checkpoint('today-after-reload');
    await expectStoredEmergency(t, snap, flag);
    await expectNoActivity(t, snap, sessionsBefore);
    const again = await s.attempt(t, mode, 'move');
    await t.check(!again.start && again.title === s.TITLE.emergency, `after reload ${mode} shows “${again.title}”, start offered ${again.start}`);
    await s.closeSheet(t.page);
  });
}

// ---------------------------------------------------------------- step 1: 900 then chest, per mode

const step1Case = mode => ({
  name: `step1-${mode}`,
  async run(t) {
    const seed = persona('P01');
    await s.open(t, seed);
    const page = t.page;
    let invalidShown = false;
    await t.step(1, `Open ${mode}; check-in: glucose 900 mg/dL, then the chest answer`, async () => {
      const sheet = await s.openCheckIn(t, mode, 'move');
      await t.checkpoint('check-in-open');
      await s.noneRightNow(sheet);
      const box = await s.typeGlucose(sheet, '900', 'mg/dL');
      invalidShown = (await box.getAttribute('aria-invalid')) === 'true'
        || await ui.section(sheet, 'Glucose').getByRole('alert').count() > 0;
      await t.checkpoint('glucose-900-typed');
      await s.tickEmergency(sheet, ui.EMERGENCY.chest);
      await expectEmergencyNow(t, sheet, 'chest');
      const snap = await t.checkpoint('emergency-shown');
      await expectStoredEmergency(t, snap, 'chest');
      const glucose = s.obsOn(snap, 'glucose');
      if (invalidShown) {
        await t.check(!glucose.some(o => o.value === 900), 'the glucose the sheet marked unusable (900 mg/dL) was stored as a valid point observation');
      } else {
        t.note(`900 mg/dL was not marked unusable by the sheet; stored glucose observations: ${glucose.map(o => `${o.value} ${o.unit} (${o.source}, ${o.scope})`).join(', ') || 'none'}`);
      }
      // Pain was never entered in this case: a stored 0 is a default reported as an answer.
      const zeros = [...s.obsOn(snap, 'backPain'), ...s.obsOn(snap, 'legPain')].filter(o => o.value === 0);
      await t.check(zeros.length === 0, `fabricated zero readings: ${zeros.map(o => `${o.kind} 0 (${o.context})`).join(', ')} were stored although no pain was entered`);
      const c = s.checkInOf(snap);
      if (c?.back) t.note(`stored check-in answers that were never given: back ${JSON.stringify({ pain: c.back.pain, legPain: c.back.legPain, reach: c.back.reach })}; sleep ${c.sleep}, energy ${c.energy}`);
      await expectNoActivity(t, snap, seed.sessions.length);
    }, { input: `${mode} via Move; None of these; glucose 900 mg/dL; then “${ui.EMERGENCY.chest}”` });
    await step3(t);
    await step6(t, 'chest', seed.sessions.length);
    void page;
  },
});

/**
 * The same, with a glucose entry the sheet itself rejects (a mmol/L number
 * that looks like mg/dL, or 0): the emergency must still appear at once, and
 * the rejected number must not be stored as a valid point observation.
 */
const invalidGlucoseCase = ({ name, value, unit }) => ({
  name,
  async run(t) {
    const seed = persona('P01');
    await s.open(t, seed);
    await t.step(1, `Guided; check-in: glucose ${value} ${unit} (rejected), then the chest answer`, async () => {
      const sheet = await s.openCheckIn(t, 'guided', 'move');
      await s.noneRightNow(sheet);
      const box = await s.typeGlucose(sheet, value, unit);
      const rejected = (await box.getAttribute('aria-invalid')) === 'true' || await ui.section(sheet, 'Glucose').getByRole('alert').count() > 0;
      const blocked = await ui.button(sheet, ui.SUBMIT).isDisabled();
      await t.checkpoint('rejected-glucose-typed');
      t.note(`glucose ${value} ${unit}: marked unusable ${rejected}, Submit disabled ${blocked}`);
      await t.must(rejected || blocked, `the sheet accepted ${value} ${unit} as a usable reading, so this case cannot test a bad entry`);
      await s.tickEmergency(sheet, ui.EMERGENCY.chest);
      await expectEmergencyNow(t, sheet, 'chest');
      const snap = await t.checkpoint('emergency-shown');
      await expectStoredEmergency(t, snap, 'chest');
      const glucose = s.obsOn(snap, 'glucose');
      await t.check(glucose.length === 0, `the rejected glucose was stored as a valid point observation: ${glucose.map(o => `${o.value} ${o.unit}`).join(', ')}`);
      const c = s.checkInOf(snap);
      await t.check(!c?.glucose, `the check-in stored the rejected reading as current glucose: ${JSON.stringify(c?.glucose)}`);
      const zeros = [...s.obsOn(snap, 'backPain'), ...s.obsOn(snap, 'legPain')].filter(o => o.value === 0);
      await t.check(zeros.length === 0, `fabricated zero readings: ${zeros.map(o => `${o.kind} 0 (${o.context})`).join(', ')} were stored although no pain was entered`);
      await expectNoActivity(t, snap, seed.sessions.length);
    }, { input: `P01; guided via Move; None of these; glucose ${value} ${unit}; then “${ui.EMERGENCY.chest}”` });
    await step6(t, 'chest', seed.sessions.length);
  },
});

// ---------------------------------------------------------------- step 2: each emergency answer

/**
 * One emergency answer, after the ordinary readings are already in the form:
 * glucose 110, BP 120/80, back and leg pain 0. `extra` adds the row's own
 * scenario (back pain with an accident, radiating pain, a low glucose).
 */
const rowCase = ({ name, who = 'P01', flag, glucose = '110', bp = [[120, 80]], pain = { back: 0, leg: 0, reach: 'Back' }, via = 'move', mode = 'guided', check }) => ({
  name,
  async run(t) {
    const seed = persona(who);
    await s.open(t, seed);
    await t.step(2, `Normal readings, then “${ui.EMERGENCY[flag]}”`, async () => {
      const sheet = await s.openCheckIn(t, mode, via);
      await s.noneRightNow(sheet);
      if (glucose !== null && await ui.section(sheet, 'Glucose').count()) await s.typeGlucose(sheet, glucose, 'mg/dL');
      if (bp && await ui.section(sheet, 'Blood pressure').count()) await s.typeBp(t, sheet, bp);
      if (pain) await s.setPain(sheet, pain);
      await t.checkpoint('readings-typed');
      await s.tickEmergency(sheet, ui.EMERGENCY[flag]);
      const text = await expectEmergencyNow(t, sheet, flag);
      const snap = await t.checkpoint('emergency-shown');
      await expectStoredEmergency(t, snap, flag);
      await expectNoActivity(t, snap, seed.sessions.length);
      if (check) await check(t, { sheet, text, snap });
    }, { input: `${who}; ${mode} via ${via}; None of these; glucose ${glucose ?? 'blank'}; BP ${bp?.map(r => r.join('/')).join(', ') ?? 'none'}; pain ${JSON.stringify(pain)}; then “${ui.EMERGENCY[flag]}”` });
    await step3(t);
    await step6(t, flag, seed.sessions.length, mode);
  },
});

const ROWS = [
  rowCase({ name: 'row-chest', flag: 'chest' }),
  rowCase({
    name: 'row-stroke', flag: 'stroke',
    check: async (t, { snap }) => {
      const c = s.checkInOf(snap);
      await t.check((c.bpReadings ?? []).some(r => r.sys === 120 && r.dia === 80), `the 120/80 reading was not kept beside the stroke answer: ${JSON.stringify(c.bpReadings)}`);
    },
  }),
  rowCase({ name: 'row-breathless', flag: 'breathless' }),
  rowCase({ name: 'row-collapse', flag: 'collapse' }),
  rowCase({ name: 'row-bladderBowel', flag: 'bladderBowel' }),
  rowCase({ name: 'row-saddle-genital-numbness', flag: 'saddle' }),
  // New sexual problems with back pain down a leg: the radiating pain is part of the scenario.
  rowCase({ name: 'row-saddle-sexual-radiating', flag: 'saddle', pain: { back: 4, leg: 5, reach: 'Below knee' } }),
  rowCase({ name: 'row-bothLegs', flag: 'bothLegs' }),
  ...[['110', 'glucose-110'], ['50', 'glucose-50'], [null, 'glucose-unknown']].map(([g, label]) => rowCase({
    name: `row-lowCantTreat-${label}`, flag: 'lowCantTreat', glucose: g,
    check: async (t, { text }) => {
      const oral = ORAL.exec(text.replace(/Give nothing to eat or drink if swallowing is not safe\.?/g, ''));
      await t.check(!oral, `an oral food/drink rescue instruction is shown beside “can’t treat by mouth” (glucose ${g ?? 'unknown'}): “${oral?.[0]}”`);
    },
  })),
  rowCase({ name: 'row-dka', flag: 'dka' }),
  rowCase({ name: 'row-accident-with-back-pain', flag: 'accident', pain: { back: 6, leg: 0, reach: 'Back' } }),
  rowCase({ name: 'row-heatConfusion', flag: 'heatConfusion' }),
];

/** The back emergencies for P06, who has no diabetes questions and an active flare-up. */
const P06_ROWS = ['bladderBowel', 'saddle', 'bothLegs'].map(flag => rowCase({
  name: `p06-${flag}`, who: 'P06', flag, glucose: null, bp: null, mode: 'stretch',
}));

// ---------------------------------------------------------------- controls

/** A nonemergency control: answered and submitted, it must not become the emergency. */
const controlCase = ({ name, who = 'P01', patch, news = [], expectAllowed, input }) => ({
  name,
  async run(t) {
    const seed = persona(who, patch ? { patch } : {});
    await s.open(t, seed);
    await t.step(2, `Control: ${input}`, async () => {
      const sheet = await s.openCheckIn(t, who === 'P01' ? 'guided' : 'stretch', 'move');
      await s.noneRightNow(sheet);
      if (await ui.section(sheet, 'Glucose').count()) await s.typeGlucose(sheet, '110', 'mg/dL');
      if (await ui.section(sheet, 'Blood pressure').count()) await s.typeBp(t, sheet, [[120, 80]]);
      if (await ui.section(sheet, 'Back and legs').count()) {
        await s.setPain(sheet, { back: 0, leg: (await sheet.getByLabel('Leg pain now', { exact: true }).count()) ? 0 : undefined, reach: (await sheet.getByRole('radiogroup', { name: 'How far down symptoms reach' }).count()) ? 'Back' : undefined });
        await s.noneSince(sheet);
      }
      const other = ui.section(sheet, 'Anything else today?');
      if (news.length) for (const label of news) await ui.tap(ui.checkbox(other, label));
      else await s.noneElse(sheet);
      await s.sleepEnergy(sheet);
      await s.submit(sheet);
      const title = await s.outcomeTitle(sheet);
      const snap = await t.checkpoint('control-outcome');
      await t.check(title !== s.TITLE.emergency, `the control (${input}) produced the emergency “${title}”`);
      const c = s.checkInOf(snap);
      await t.check(c && (c.emergency ?? []).length === 0 && c.urgentSymptoms === false, `the control stored emergency ${JSON.stringify(c?.emergency)}, urgentSymptoms ${c?.urgentSymptoms}`);
      if (expectAllowed !== undefined) {
        const starts = await sheet.getByRole('button', { name: /^(Start|Continue)/ }).count();
        await t.check((starts > 0) === expectAllowed, `control ${input}: start offered ${starts > 0}, expected ${expectAllowed} (outcome “${title}”)`);
      }
      t.note(`control ${input}: outcome “${title}”, disposition ${c?.readiness?.disposition}`);
    }, { input });
  },
});

const CONTROLS = [
  controlCase({ name: 'control-fainted-recovered', news: [ui.NEWS.fainted], input: 'fainted today and back to normal (not the collapse emergency)' }),
  controlCase({ name: 'control-hot-today', news: [ui.NEWS.hot], expectAllowed: true, input: '“Hot or humid today” alone (not heat confusion)' }),
  controlCase({
    name: 'control-historical-bilateral-sciatica', who: 'P06', patch: { profile: { pain: { sciaticaSide: 'both' } } },
    input: 'historical bilateral sciatica, no new loss in both legs',
  }),
  controlCase({ name: 'control-healthy-p02', who: 'P02', expectAllowed: true, input: 'a healthy profile with normal answers' }),
];

// ---------------------------------------------------------------- step 4: a saved session cannot mask it

const CHECK_IN_CONTROL = /check-?in|Review your check-in|Review today|Re-check|Change answers|symptom|I feel/i;

/**
 * A visible way back to today's check-in, searched where a person would look
 * once movement is allowed. Returns the control, ready to tap, or undefined.
 */
async function findCheckInControl(t) {
  const page = t.page;
  const main = page.getByRole('main');
  const look = async where => {
    const c = main.getByRole('button', { name: CHECK_IN_CONTROL }).or(main.getByRole('link', { name: CHECK_IN_CONTROL }));
    const n = await c.count();
    t.note(`check-in control search, ${where}: ${n ? (await c.allInnerTexts()).join(', ') : 'none'}`);
    return n === 1 ? { control: c, where } : undefined;
  };
  await ui.tab(page, 'Today');
  // Today's quiet "Today’s check-in" row, whose Update reopens the sheet in place, found by its own label:
  // other rows can name the check-in too (Blood pressure says "From your check-in").
  const row = ui.row(main, 'Today’s check-in');
  t.note(`check-in control search, Today: ${await row.count()} “Today’s check-in” row(s)`);
  if (await row.count() === 1) return { control: row, where: 'Today' };
  let hit = await look('Today');
  if (hit) return hit;
  await ui.tap(ui.button(main, 'Choose something else'));
  const chooser = page.getByRole('dialog');
  const inChooser = chooser.getByRole('button', { name: CHECK_IN_CONTROL });
  t.note(`check-in control search, chooser: ${(await inChooser.count()) ? (await inChooser.allInnerTexts()).join(', ') : 'none'}`);
  if (await inChooser.count() === 1) return { control: inChooser, where: 'chooser' };
  await ui.tap(ui.button(chooser, 'Close'));
  await ui.tab(page, 'Move');
  if ((hit = await look('Move'))) return hit;
  await t.goto('/move/stretch');
  if ((hit = await look('Stretch setup'))) return hit;
  await t.goto('/walk');
  if ((hit = await look('Walk setup'))) return hit;
  await t.goto('/session?resume=1');
  if ((hit = await look('player'))) return hit;
  await s.backToTabs(t);
  return undefined;
}

const step4 = {
  name: 'step4-resume',
  async run(t) {
    const seed = persona('P01');
    await s.open(t, seed);
    const page = t.page;
    const main = page.getByRole('main');
    await t.step(4, 'A saved runnable session, then a new emergency, then Continue and /session?resume=1', async () => {
      // A runnable plan saved the way J02 saves one: check in, start, move on, pause, Save and exit.
      const sheet = await s.openCheckIn(t, 'guided', 'today');
      await ui.answerCheckIn(t, sheet, ui.normalAnswers('P01'));
      const start = sheet.getByRole('button', { name: /^Start session$|^Start recovery session$/ });
      await start.waitFor({ timeout: 15000 }).catch(() => {});
      await t.must(await start.count() === 1, `normal answers did not offer Start session: ${(await sheet.innerText()).slice(0, 200)}`);
      await ui.tap(start);
      await page.getByRole('button', { name: 'Start', exact: true }).waitFor();
      await ui.tap(page.getByRole('button', { name: 'Start', exact: true }));
      await page.getByRole('button', { name: 'Pause', exact: true }).waitFor();
      await t.advance(20_000);
      await ui.tap(page.getByRole('button', { name: 'Next', exact: true }));
      await t.advance(5_000);
      await ui.tap(page.getByRole('button', { name: 'Pause', exact: true }));
      await ui.tap(page.getByRole('button', { name: 'End session', exact: true }));
      await ui.tap(page.getByRole('button', { name: 'Save and exit', exact: true }));
      await page.waitForTimeout(600);
      const saved = (await t.storage()).local['fit-strong-90-guided'];
      await t.must(!!saved, 'no saved guided progress after Save and exit');
      await ui.tab(page, 'Today');
      const resumeOffered = await main.getByRole('button', { name: /^Continue/ }).count();
      await t.checkpoint('today-with-saved-session');
      await t.check(resumeOffered > 0, 'Today does not offer Continue for the saved session');

      // Recording a new current emergency: the way to today's check-in once it allows movement.
      const found = await findCheckInControl(t);
      if (found) {
        await ui.tap(found.control);
      } else {
        await t.check(false, 'once today’s check-in allows movement, no visible control reopens it to record a new emergency: Today, Move, the chooser, Stretch and Walk setup and the paused player were searched; continued through the app’s own /today?checkin=guided link');
        await t.goto('/today?checkin=guided');
      }
      const again = s.checkInSheet(page);
      await again.waitFor();
      const change = ui.button(again, 'Change answers');
      if (await change.count()) await ui.tap(change);
      await s.tickEmergency(again, ui.EMERGENCY.chest);
      await expectEmergencyNow(t, again, 'chest');
      await s.closeSheet(page);
      const snap = await t.checkpoint('emergency-over-saved-session');
      await expectStoredEmergency(t, snap, 'chest');

      // Continue is replaced; the resume link is refused.
      await ui.tab(page, 'Today');
      const cont = main.getByRole('button', { name: /^Continue/ });
      if (await cont.count()) {
        await ui.tap(cont);
        const after = await s.surface(t);
        await t.check(!after.start && after.title === s.TITLE.emergency, `Today still offers Continue beside the emergency, and it led to ${after.where} “${after.title}” (start ${after.start})`);
        await s.closeSheet(page);
      }
      const resume = await s.attempt(t, 'guided', 'resume');
      await t.checkpoint('resume-link');
      await t.check(!resume.start && resume.title === s.TITLE.emergency, `/session?resume=1 → ${resume.where} “${resume.title}”, start offered ${resume.start}`);
      const kept = (await t.storage()).local['fit-strong-90-guided'];
      await t.check(!!kept, 'the logged progress was discarded when the emergency refused the resume');
      if (kept) {
        const before = JSON.parse(saved);
        const after = JSON.parse(kept);
        await t.check(after.state?.index === before.state?.index && after.plan?.id === before.plan?.id, `the saved progress changed: step ${before.state?.index} → ${after.state?.index}, plan ${before.plan?.id} → ${after.plan?.id}`);
      }
      await expectNoActivity(t, await t.db(), seed.sessions.length);
    }, { input: 'P01 normal check-in; guided session started, Next, Pause, Save and exit; then “Chest pain…”' });
  },
};

// ---------------------------------------------------------------- step 5: a hidden question keeps its answer

const step5 = {
  name: 'step5-profile-edit',
  async run(t) {
    const seed = persona('P01');
    await s.open(t, seed);
    const page = t.page;
    const main = page.getByRole('main');
    await t.step(5, 'Bladder answer; remove back and sciatica from the profile; reopen Change answers', async () => {
      const sheet = await s.openCheckIn(t, 'guided', 'move');
      await s.noneRightNow(sheet);
      await s.tickEmergency(sheet, ui.EMERGENCY.bladderBowel);
      await expectEmergencyNow(t, sheet, 'bladderBowel');
      await s.closeSheet(page);
      await t.checkpoint('bladder-saved');

      // Profile: no back or sciatica any more.
      await ui.tab(page, 'Today');
      await ui.tap(page.getByRole('link', { name: /^You:/ }));
      await ui.tap(ui.row(main, 'Profile & health', 'link'));
      await ui.tap(main.getByRole('button', { name: 'Edit back and legs', exact: true }));
      const group = page.getByRole('group', { name: 'Pain or past injury' }).getByRole('group', { name: 'Pain or past injury' });
      await group.waitFor();
      await ui.tap(ui.checkbox(group, 'None'));
      for (const area of ['Lower back', 'Sciatica']) {
        await t.must(await ui.checkbox(group, area).getAttribute('aria-checked') !== 'true', `${area} stayed ticked after choosing None`);
      }
      await t.checkpoint('profile-edit');
      await ui.tap(page.getByRole('button', { name: /^Save$/ }));
      await page.waitForTimeout(600);
      const snap0 = await t.db();
      await t.must((docs(snap0).profile?.pain?.areas ?? []).length === 0, `the profile still lists ${JSON.stringify(docs(snap0).profile?.pain?.areas)}`);

      // Reopen the check-in and its answers, without clearing the safety answer.
      const reopened = await s.openCheckIn(t, 'stretch', 'move');
      const opened = await s.outcomeTitle(reopened);
      await t.check(opened === s.TITLE.emergency, `after the profile edit the check-in opens on “${opened}”, not the emergency`);
      const change = ui.button(reopened, 'Change answers');
      await t.must(await change.count() === 1, 'no Change answers on the reopened check-in');
      await ui.tap(change);
      const right = ui.section(reopened, 'Right now, any of these?');
      const box = ui.checkbox(right, ui.EMERGENCY.bladderBowel);
      await t.check(await box.count() === 1 && await box.getAttribute('aria-checked') === 'true', 'Change answers no longer shows the bladder answer ticked after the back question was hidden');
      const banner = await s.outcomeTitle(reopened);
      await t.check(banner === s.TITLE.emergency, `Change answers shows “${banner}”, not the emergency, while the bladder answer stands`);
      await t.checkpoint('change-answers-after-edit');
      await s.closeSheet(page);
      const problems = await s.expectAllRefused(t, emergencyOnly);
      for (const p of problems) await t.check(false, `after the profile edit, not refused with the emergency: ${p}`);
      const snap = await t.checkpoint('after-edit-every-entry');
      await expectStoredEmergency(t, snap, 'bladderBowel');
    }, { input: '“Can’t pee, or new loss of bladder or bowel control”; profile pain areas → None; Change answers' });
    await step6(t, 'bladderBowel', seed.sessions.length);
  },
};

export const cases = [
  ...['guided', 'stretch', 'walk'].map(step1Case),
  invalidGlucoseCase({ name: 'step1-rejected-glucose-45-mmol', value: '45', unit: 'mmol/L' }),
  invalidGlucoseCase({ name: 'step1-rejected-glucose-0', value: '0', unit: 'mg/dL' }),
  ...ROWS,
  ...P06_ROWS,
  ...CONTROLS,
  step4,
  step5,
];
