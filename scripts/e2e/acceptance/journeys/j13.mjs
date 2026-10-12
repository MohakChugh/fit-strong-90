/**
 * J13, P04/P01: all glucose boundaries in both units
 * (codex-acceptance.md, SAFETY 5 of 10; basis D29(1), D30; H-PRE-LOW,
 * H-HIGH-UNCHECKED, H-T2-HIGH, E-EXTREME-GLUCOSE).
 *
 * Each value is one case with two sub-runs in fresh contexts: the reading
 * typed in mg/dL, then the unit switched and `String(mg / 18)` typed whole.
 * Both must give the same disposition, permission and release condition,
 * and each must store the reading at the precision and in the unit typed.
 * P04 rows are entered through Walk (P04 chose Move); P01 rows through the
 * guided session.
 */
import { persona } from '../fixtures/personas.mjs';
import * as ui from '../lib/ui.mjs';
import * as s from '../lib/safety-a.mjs';

export const id = 'J13';
export const title = 'All glucose boundaries in both units';
export const safety = true;

const PRIOR_DKA = { profile: { health: { priorDkaOrInsulinDeficiency: true } } };
const CLINICIAN = { profile: { health: { clinicianTargets: { glucoseStartMin: 5.6, glucoseStartUnit: 'mmol/L' } } } };
/** A start limit inside hypoglycaemia (63 mg/dL): it must never relax the low or emergency rules. */
const CLINICIAN_LOW = { profile: { health: { clinicianTargets: { glucoseStartMin: 3.5, glucoseStartUnit: 'mmol/L' } } } };

/**
 * Expectations, from the spec's table:
 *   level2      level 2 low: no session, contact today
 *   level1      level 1 low: rescue (15 g, re-check in 15 minutes) and hold
 *   prelow      not biochemical hypoglycaemia, but held below the start level
 *   clear       this rule does not fire: allowed (other restrictions may apply)
 *   ketoneHold  held pending usable ketones
 *   highHold    the strict >300 rule refuses the session; not the emergency
 *   emergency   ≥600: emergency, every mode refused
 */
const ROWS = [
  ['53.9', 'P04', null, 'level2'], ['54', 'P04', null, 'level1'], ['54.1', 'P04', null, 'level1'],
  ['69.9', 'P04', null, 'level1'], ['70', 'P04', null, 'prelow'], ['70.1', 'P04', null, 'prelow'],
  ['89.9', 'P04', null, 'prelow'], ['90', 'P04', null, 'clear'], ['90.1', 'P04', null, 'clear'],
  ['249.9', 'P04', PRIOR_DKA, 'clear'], ['250', 'P04', PRIOR_DKA, 'ketoneHold'], ['250.1', 'P04', PRIOR_DKA, 'ketoneHold'],
  ['299.9', 'P01', null, 'clear'], ['300', 'P01', null, 'clear'], ['300.1', 'P01', null, 'highHold'],
  ['599.9', 'P01', null, 'highHold'], ['600', 'P01', null, 'emergency'], ['600.1', 'P01', null, 'emergency'], ['601', 'P01', null, 'emergency'],
  ['100.7', 'P04', CLINICIAN, 'prelow', 'clinician 5.6 mmol/L'], ['100.9', 'P04', CLINICIAN, 'clear', 'clinician 5.6 mmol/L'],
  ['65', 'P04', CLINICIAN_LOW, 'level1', 'clinician 3.5 mmol/L'], ['600', 'P04', CLINICIAN_LOW, 'emergency', 'clinician 3.5 mmol/L'],
];

const mmol = mg => String(Number(mg) / 18);
const modeFor = who => (who === 'P04' ? 'walk' : 'guided');

/** The "What changes this" text of an outcome, if any. */
function releaseOf(text) {
  const m = /what changes this\s+(.*?)(?=\s+(?:now|before you start|today|general information)\b|$)/i.exec(text);
  return m?.[1]?.trim();
}

/** Normal current answers around one glucose reading (spec "Normal current answers"). */
async function glucoseCheckIn(t, who, mode, value, unit) {
  const sheet = await s.openCheckIn(t, mode, 'move');
  await s.noneRightNow(sheet);
  await t.must(await ui.section(sheet, 'Glucose').count() === 1, `no Glucose question for ${who}`);
  await s.typeGlucose(sheet, value, unit);
  if (await ui.section(sheet, 'Blood pressure').count()) await s.typeBp(t, sheet, [[124, 78], [122, 76]]);
  if (await ui.section(sheet, 'Back and legs').count()) {
    await s.setPain(sheet, { back: 0, leg: 0, reach: 'Back' });
    await s.noneSince(sheet);
  }
  await s.noneElse(sheet);
  await s.sleepEnergy(sheet);
  await t.checkpoint(`typed-${unit === 'mg/dL' ? 'mgdl' : 'mmol'}`);
  await s.submit(sheet);
  await sheet.getByRole('status').or(sheet.getByRole('alert')).first().waitFor({ timeout: 5000 }).catch(() => {});
  return sheet;
}

/** The outcome against the row's expectation. Returns a summary for the cross-unit comparison. */
async function judge(t, { mg, who, mode, expect, sheet, unit, value }) {
  const title = await s.outcomeTitle(sheet);
  const text = (await sheet.innerText()).replace(/\s+/g, ' ');
  const start = await sheet.getByRole('button', { name: /^(Start session|Start recovery session|Start stretch|Start walk|Continue|Continue to stretch|Continue to walk)$/ }).count() > 0;
  const tag = `${value} ${unit} (${who}, ${mode})`;
  const refusal = [s.TITLE.recheck, s.TITLE.hold(mode), s.TITLE.today];
  switch (expect) {
    case 'level2':
      await t.check(title === s.TITLE.today && !start, `${tag}: “${title}”, start ${start}; expected level 2 — no session, contact today`);
      await t.check(/contact your care team today/i.test(text), `${tag}: no “contact your care team today”`);
      break;
    case 'level1':
      await t.check(refusal.includes(title) && !start, `${tag}: “${title}”, start ${start}; expected a level 1 hold`);
      await t.check(/15 ?g/.test(text) && /re-?check in 15 minutes|wait 15 minutes, then re-?check/i.test(text), `${tag}: the rescue (15 g, re-check in 15 minutes) is not shown: “${text.slice(0, 240)}”`);
      await t.check(/\blow\b/i.test(text), `${tag}: the reading is not named a low`);
      break;
    case 'prelow':
      await t.check(refusal.includes(title) && !start, `${tag}: “${title}”, start ${start}; expected the pre-low hold`);
      await t.check(!/is a low|hypoglyc|from 54 to 69/i.test(text), `${tag}: labelled as biochemical hypoglycaemia: “${(text.match(/[^.]*(is a low|hypoglyc|from 54 to 69)[^.]*\./i) ?? [''])[0]}”`);
      await t.check(!/Take 15 ?g of fast-acting carbohydrate now/i.test(text), `${tag}: the universal 15 g treatment is given for a reading that is not a low`);
      break;
    case 'clear':
      await t.check([s.TITLE.adjust, s.TITLE.reassure].includes(title) && start, `${tag}: “${title}”, start ${start}; expected this rule not to fire`);
      break;
    case 'ketoneHold':
      await t.check(refusal.includes(title) && !start, `${tag}: “${title}”, start ${start}; expected a hold pending ketones`);
      await t.check(/ketone/i.test(text), `${tag}: the hold does not ask for ketones`);
      break;
    case 'highHold':
      await t.check(refusal.includes(title) && !start, `${tag}: “${title}”, start ${start}; expected the moderate/vigorous session refused`);
      await t.check(title !== s.TITLE.emergency, `${tag}: the ≥600 emergency fired below 600`);
      await t.check(!/(go for|take|try) (a|an) (light |gentle |easy )?walk|walk (it|this) off|walk to bring/i.test(text), `${tag}: a walk is prescribed to treat the high`);
      break;
    case 'emergency':
      await t.check(title === s.TITLE.emergency && !start, `${tag}: “${title}”, start ${start}; expected the emergency`);
      await t.check(!/can.t be used|cannot be used|measure again and enter/i.test(text), `${tag}: the extreme reading was treated as implausible`);
      for (const p of s.emergencyProblems(text)) await t.check(false, `${tag}: ${p}`);
      break;
    default:
      throw new Error(`unknown expectation ${expect}`);
  }
  return { title, start, release: releaseOf(text), text };
}

/** Step 3: Start and direct player navigation cannot get round a refusal; the entry is stored as typed. */
async function step3(t, { expect, mode, value, unit, start }) {
  if (start) {
    const sheet = s.checkInSheet(t.page);
    await ui.tap(sheet.getByRole('button', { name: /^(Start session|Start recovery session|Start stretch|Start walk|Continue|Continue to stretch|Continue to walk)$/ }));
    await t.page.waitForTimeout(800);
    const after = await s.surface(t);
    await t.checkpoint('after-start');
    await t.check(after.start || /setup/.test(after.where), `an allowed start for ${mode} led to ${after.where} at ${after.route}`);
  } else {
    const entries = expect === 'emergency' ? s.EVERY_ENTRY : [[mode, 'move'], ['guided', 'direct'], ['walk', 'walkLink'], ['stretch', 'stretchLink']];
    const accept = expect === 'emergency' ? () => [s.TITLE.emergency] : m => [...s.refusalTitles(m)];
    const problems = await s.expectAllRefused(t, accept, entries);
    for (const p of problems) await t.check(false, `refusal bypassed or changed: ${p}`);
  }
  // Persisted values: the original precision and unit.
  const snap = await t.checkpoint('persisted');
  const c = s.checkInOf(snap);
  const typed = Number(value);
  await t.check(c?.glucose?.value === typed && c?.glucose?.unit === unit, `the check-in stored glucose ${JSON.stringify(c?.glucose)}, not ${value} ${unit}`);
  const obs = s.obsOn(snap, 'glucose');
  await t.check(obs.length === 1 && obs[0].value === typed && obs[0].unit === unit && obs[0].source === 'manual' && obs[0].scope === 'pointInTime' && obs[0].context === 'checkIn:2026-10-08',
    `the glucose observation is ${JSON.stringify(obs.map(o => ({ value: o.value, unit: o.unit, source: o.source, scope: o.scope, context: o.context })))}, not exactly ${value} ${unit}, manual, point-in-time, checkIn:2026-10-08`);
}

const rowCase = ([mg, who, patch, expect, variant]) => ({
  name: `${mg}-${who}${variant ? `-${variant.replace(/[^a-z0-9.]+/gi, '-')}` : ''}`,
  async run(t) {
    const mode = modeFor(who);
    const seed = persona(who, patch ? { patch } : {});
    const runs = {};
    for (const [unit, value] of [['mg/dL', mg], ['mmol/L', mmol(mg)]]) {
      if (unit === 'mg/dL') await s.open(t, seed);
      else await s.fresh(t, seed);
      let summary;
      await t.step(`${unit === 'mg/dL' ? '1' : '2'}`, `${who}${variant ? ` (${variant})` : ''}: ${value} ${unit} through ${mode}`, async () => {
        const sheet = await glucoseCheckIn(t, who, mode, value, unit);
        summary = await judge(t, { mg, who, mode, expect, sheet, unit, value });
        await t.checkpoint(`outcome-${unit === 'mg/dL' ? 'mgdl' : 'mmol'}`);
        if (variant?.startsWith('clinician 5.6') && expect === 'prelow') {
          await t.check(/100\.8\s*mg\/dL|5\.6\s*mmol\/L/.test(summary.text), `the hold does not name the clinician’s limit (100.8 mg/dL or 5.6 mmol/L): “${summary.text.slice(0, 220)}”`);
          if (!/clinician|care team/i.test(summary.text)) t.note(`the limit is shown as “${(summary.text.match(/[^.]*100\.8[^.]*\./) ?? [''])[0].trim()}”, without saying it is the clinician’s`);
        }
      }, { input: `${who}${patch ? ` + ${JSON.stringify(patch.profile.health)}` : ''}; glucose ${value} ${unit}, meter, measured now; normal answers` });
      await t.step(3, `Start, direct navigation and the stored values (${unit})`, async () => {
        await t.must(!!summary, 'no outcome to act on');
        await step3(t, { expect, mode, value, unit, start: summary.start });
      });
      runs[unit] = summary;
    }
    await t.step('2 (compare)', 'Same disposition, permission and release in both units', async () => {
      const a = runs['mg/dL'];
      const b = runs['mmol/L'];
      await t.must(a && b, 'a unit run did not finish');
      await t.check(a.title === b.title && a.start === b.start, `mg/dL gave “${a.title}” (start ${a.start}), mmol/L gave “${b.title}” (start ${b.start})`);
      await t.check((a.release ?? '') === (b.release ?? ''), `the release condition differs: mg/dL “${a.release ?? '(none)'}”, mmol/L “${b.release ?? '(none)'}”`);
    });
  },
});

/** Step 4: an allowed stretch, then a new low reported through the in-session safety check. */
const step4 = {
  name: 'step4-stop-reading-during-stretch',
  async run(t) {
    await s.open(t, persona('P04'));
    const page = t.page;
    await t.step(4, 'P04 at 90 mg/dL: begin a stretch, then report 65 mg/dL through “I feel low”', async () => {
      const sheet = await glucoseCheckIn(t, 'P04', 'stretch', '90', 'mg/dL');
      const title = await s.outcomeTitle(sheet);
      await t.must([s.TITLE.adjust, s.TITLE.reassure].includes(title), `90 mg/dL did not allow the stretch: “${title}”`);
      await ui.tap(sheet.getByRole('button', { name: /^(Start stretch|Continue to stretch|Continue)$/ }));
      await page.getByRole('button', { name: 'Start', exact: true }).waitFor();
      await ui.tap(page.getByRole('button', { name: 'Start', exact: true }));
      await page.getByRole('button', { name: 'Pause', exact: true }).waitFor();
      await t.advance(30_000);
      await t.checkpoint('stretch-running');
      const low = page.getByRole('button', { name: 'I feel low', exact: true });
      await t.must(await low.count() === 1, 'no “I feel low” safety check in the running stretch for a person on insulin');
      await ui.tap(low);
      // The reading is asked for on a sheet-like dialog or, in newer builds, a full screen of its own.
      await page.getByText('Treat the low first', { exact: true }).waitFor({ timeout: 15000 });
      const dialog = page.getByRole('dialog');
      const where = (await dialog.count()) ? dialog : page.getByRole('main');
      await ui.type(where.getByRole('textbox', { name: 'Glucose now', exact: true }), '65');
      await t.checkpoint('low-reading-entered');
      await ui.tap(ui.button(where, 'Save this reading'));
      await page.waitForTimeout(1000);
      const after = await s.surface(t);
      const snap = await t.checkpoint('after-low-reading');
      await t.check(!after.start, `after reporting 65 mg/dL the stretch still offers movement (${after.where}, running controls present)`);
      const recomputed = (after.where === 'gate' && s.refusalTitles('stretch').includes(after.title))
        || (after.where === 'stop screen' && /is a low|No exercise|Start only when/i.test(after.text));
      await t.check(recomputed, `after reporting 65 mg/dL the screen is ${after.where} “${after.title ?? ''}”: permission was not recomputed into a refusal`);
      const c = s.checkInOf(snap);
      const earlier = (c?.glucoseEarlier ?? []).map(g => `${g.value} ${g.unit}`);
      await t.check(c?.glucose?.value === 65 && earlier.includes('90 mg/dL'), `the check-in holds glucose ${JSON.stringify(c?.glucose)} with earlier ${JSON.stringify(earlier)}`);
      const obs = s.obsOn(snap, 'glucose').map(o => o.value).sort((x, y) => x - y);
      await t.check(JSON.stringify(obs) === JSON.stringify([65, 90]), `glucose observations today: ${JSON.stringify(obs)}, expected the 90 and the 65`);
      const resumed = await s.attempt(t, 'stretch', 'stretchLink');
      await t.check(!resumed.start, `the stretch link restarts movement after the low (${resumed.where} “${resumed.title ?? ''}”)`);
    }, { input: 'P04; glucose 90 mg/dL at check-in; stretch started; 65 mg/dL entered through “I feel low”' });
  },
};

/**
 * A trustworthy extreme reading the generic plausibility check objects to:
 * 45 mmol/L looks like mg/dL, so the sheet asks. Confirmed, it is 810 mg/dL
 * and the emergency; unconfirmed, it can neither be submitted nor clear anything.
 */
const extremeConfirmed = {
  name: 'extreme-45-mmol-confirmed',
  async run(t) {
    await s.open(t, persona('P01'));
    const page = t.page;
    await t.step(3, 'P01: 45 mmol/L, which the sheet questions, then confirmed as mmol/L', async () => {
      const sheet = await s.openCheckIn(t, 'guided', 'move');
      await s.noneRightNow(sheet);
      await s.typeGlucose(sheet, '45', 'mmol/L');
      await s.typeBp(t, sheet, [[124, 78], [122, 76]]);
      await s.setPain(sheet, { back: 0, leg: 0, reach: 'Back' });
      await s.noneSince(sheet);
      await s.noneElse(sheet);
      await s.sleepEnergy(sheet);
      const submitButton = ui.button(sheet, ui.SUBMIT);
      await t.check(await submitButton.isDisabled(), 'an unconfirmed 45 mmol/L can be submitted as it stands');
      await t.checkpoint('unit-question');
      const really = sheet.getByRole('button', { name: '45 mmol/L, really', exact: true });
      await t.must(await really.count() === 1, 'no way to confirm the reading really is 45 mmol/L');
      await ui.tap(really);
      await s.submit(sheet);
      const title = await s.outcomeTitle(sheet);
      const snap = await t.checkpoint('confirmed-outcome');
      await t.check(title === s.TITLE.emergency, `a confirmed 45 mmol/L (810 mg/dL) gave “${title}”, not the emergency`);
      const c = s.checkInOf(snap);
      await t.check(c?.glucose?.value === 45 && c?.glucose?.unit === 'mmol/L' && c?.glucose?.unitConfirmed === true, `stored glucose ${JSON.stringify(c?.glucose)}`);
      const problems = await s.expectAllRefused(t, () => [s.TITLE.emergency]);
      for (const p of problems) await t.check(false, `not refused with the emergency: ${p}`);
      void page;
    }, { input: 'P01; glucose 45 mmol/L; “45 mmol/L, really”; normal answers' });
  },
};

export const cases = [...ROWS.map(rowCase), step4, extremeConfirmed];
