/**
 * J04, P01: severe individual BP and strict resting gate
 * (codex-acceptance.md, SAFETY 2 of 10; basis D28, D29(4), D30; E-BP, T-BP,
 * H-EXERCISE-BP).
 *
 * Every row starts from a fresh P01 with no earlier severe readings and
 * normal symptoms: glucose left blank, back and leg pain 0, reach Back, none
 * of the back changes or other news, sleep over 7 h, energy good. Only the
 * blood pressure differs.
 */
import { persona } from '../fixtures/personas.mjs';
import * as ui from '../lib/ui.mjs';
import * as s from '../lib/safety-a.mjs';

export const id = 'J04';
export const title = 'Severe individual BP and strict resting gate';
export const safety = true;

const REST = 'Sit quietly for 5 minutes first, then two readings a minute apart.';
const MODE_ENTRIES = [['guided', 'move'], ['stretch', 'move'], ['walk', 'move']];

/** Refusal headings that stop movement for a hold (or anything more conservative). */
const HOLD_OR_MORE = mode => [s.TITLE.hold(mode), s.TITLE.recheck, s.TITLE.today, s.TITLE.emergency, 'No walk today'];
const TODAY_ONLY = mode => [s.TITLE.today, 'No walk today'];

/**
 * The check-in with normal answers and these blood pressure readings, typed
 * a minute apart, in the mode's own sheet. Returns the sheet, after Submit
 * unless `submit: false`.
 */
async function bpCheckIn(t, mode, readings, { submit = true, before, afterBp } = {}) {
  const sheet = await s.openCheckIn(t, mode, 'move');
  await s.noneRightNow(sheet);
  const bp = ui.section(sheet, 'Blood pressure');
  await t.must(await bp.count() === 1, 'no Blood pressure section in the check-in for a profile with a home monitor');
  const footer = (await bp.innerText()).replace(/\s+/g, ' ');
  await t.check(footer.includes(REST), `the displayed rest instructions are missing before the readings: “${footer.slice(0, 160)}”`);
  if (before) await before(sheet);
  const shown = await s.typeBp(t, sheet, readings);
  if (afterBp) await afterBp(sheet, shown);
  if (!submit) return { sheet, shown };
  await s.setPain(sheet, { back: 0, leg: 0, reach: 'Back' });
  await s.noneSince(sheet);
  await s.noneElse(sheet);
  await s.sleepEnergy(sheet);
  await s.submit(sheet);
  await sheet.getByRole('status').or(sheet.getByRole('alert')).first().waitFor({ timeout: 5000 }).catch(() => {});
  return { sheet, shown };
}

/** Every mode refused with an acceptable heading; returns problems. */
async function modesRefused(t, accept, entries = MODE_ENTRIES) {
  const problems = await s.expectAllRefused(t, accept, entries, accept === TODAY_ONLY ? s.todayWording : undefined);
  for (const p of problems) await t.check(false, `not refused: ${p}`);
}

/** The day's blood pressure observations as pairs, and the check-in's raw readings. */
async function storedBp(t, wanted) {
  const snap = await t.db();
  const pairs = s.bpPairs(snap);
  const c = s.checkInOf(snap);
  const raw = (c?.bpReadings ?? []).map(r => `${r.sys}/${r.dia}`);
  const got = pairs.map(p => `${p.sys}/${p.dia}`).sort();
  const want = wanted.map(([a, b]) => `${a}/${b}`).sort();
  await t.check(JSON.stringify(got) === JSON.stringify(want), `stored BP pairs today are ${JSON.stringify(got)}, expected exactly ${JSON.stringify(want)}`);
  await t.check(pairs.every(p => p.dia !== undefined && p.source === 'manual' && p.scope === 'pointInTime'), `a BP half is orphaned or mislabelled: ${JSON.stringify(pairs)}`);
  for (const w of want) await t.check(raw.includes(w), `the check-in does not keep the raw reading ${w}: ${JSON.stringify(raw)}`);
  return { snap, pairs, c };
}

// ---------------------------------------------------------------- steps 1–4

const step1 = {
  name: 'step1-severe-then-normal',
  async run(t) {
    await s.open(t, persona('P01'));
    await t.step(1, 'Reading 1 190/80, a minute later Reading 2 120/80', async () => {
      const { sheet } = await bpCheckIn(t, 'guided', [[190, 80], [120, 80]]);
      const title = await s.outcomeTitle(sheet);
      await t.checkpoint('outcome');
      await t.check(HOLD_OR_MORE('guided').includes(title), `one severe raw reading did not refuse movement: “${title}” (the mean is 155/80)`);
      // Hold or today is acceptable for one asymptomatic severe reading, provided the next action is explicit.
      const said = (await sheet.innerText()).replace(/\s+/g, ' ');
      await t.check(/measure again|re-?check|contact your clinician today|medical advice today/i.test(said), `the refusal gives no explicit next action: “${said.slice(0, 220)}”`);
      await t.check(!(await s.surface(t)).start, 'a start is offered after a 190/80 reading');
      await modesRefused(t, HOLD_OR_MORE);
      await storedBp(t, [[190, 80], [120, 80]]);
    }, { input: 'P01; BP 190/80, then 120/80 one minute later; normal answers otherwise' });
  },
};

const step2 = {
  name: 'step2-two-severe-components',
  async run(t) {
    await s.open(t, persona('P01'));
    await t.step(2, 'Reading 1 190/80, Reading 2 150/121 a minute later, Submit', async () => {
      const { sheet } = await bpCheckIn(t, 'guided', [[190, 80], [150, 121]]);
      const title = await s.outcomeTitle(sheet);
      const text = (await sheet.innerText()).replace(/\s+/g, ' ');
      await t.checkpoint('outcome');
      await t.check(title === s.TITLE.today, `two severe readings (190/80, 150/121) gave “${title}”, not explicit advice today`);
      await t.check(/today/i.test(text) && /clinician|doctor|care team|medical advice/i.test(text), 'no explicit clinical direction for today');
      // Neither raw severe component may vanish from what the person is told, nor be misstated.
      await t.check(/\b190\b/.test(text) && /\b121\b/.test(text), `the explanation names ${[/\b190\b/.test(text) && '190', /\b121\b/.test(text) && '121'].filter(Boolean).join(' and ') || 'neither severe component'}, not both severe components (190 systolic, 121 diastolic): “${(text.match(/Your (top|bottom) number[^.]*\./) ?? [text.slice(0, 160)])[0]}”`);
      await modesRefused(t, TODAY_ONLY);
      const { snap } = await storedBp(t, [[190, 80], [150, 121]]);
      const bp = s.obsOn(snap).filter(o => o.kind.startsWith('bloodPressure'));
      await t.check(bp.length === 4, `${bp.length} BP observations today, not exactly four`);
      const mean = bp.filter(o => [170, 100.5, 101, 100].includes(o.value));
      await t.check(mean.length === 0, `the mean was stored as a measurement: ${mean.map(o => `${o.kind} ${o.value}`).join(', ')}`);
    }, { input: 'P01; BP 190/80 then 150/121 (≥1 minute later)' });
  },
};

const step3 = ([a, b], name) => ({
  name,
  async run(t) {
    await s.open(t, persona('P01'));
    await t.step(3, `Repeated severe reading ${a}/${b}, ${a}/${b}`, async () => {
      const { sheet } = await bpCheckIn(t, 'guided', [[a, b], [a, b]]);
      const title = await s.outcomeTitle(sheet);
      await t.checkpoint('outcome');
      await t.check(title === s.TITLE.today, `repeated ${a}/${b} gave “${title}”, not advice today (equality / OR must trigger it)`);
      await modesRefused(t, TODAY_ONLY);
      await storedBp(t, [[a, b], [a, b]]);
    }, { input: `P01; BP ${a}/${b} twice, a minute apart` });
  },
});

/** Symptoms with the first severe reading: emergency at once, without a second reading. */
const step4Switch = scenario => ({
  name: `step4-symptoms-${scenario}`,
  async run(t) {
    await s.open(t, persona('P01'));
    await t.step(4, `First severe reading, then “Symptoms with the high reading” (${scenario})`, async () => {
      const { sheet } = await bpCheckIn(t, 'guided', [[190, 80]], {
        submit: false,
        afterBp: async sheet => {
          const sw = sheet.getByRole('switch', { name: 'Symptoms with the high reading', exact: true });
          await t.must(await sw.count() === 1, 'no “Symptoms with the high reading” question beside a 190/80 reading');
          await ui.tap(sw);
        },
      });
      await sheet.getByRole('alert').filter({ hasText: s.TITLE.emergency }).waitFor({ timeout: 4000 }).catch(() => {});
      const title = await s.outcomeTitle(sheet);
      const text = (await sheet.innerText()).replace(/\s+/g, ' ');
      await t.checkpoint('emergency');
      await t.check(title === s.TITLE.emergency, `a severe reading with ${scenario} symptoms showed “${title}”, not the emergency, without a second reading`);
      for (const p of s.emergencyProblems(text)) await t.check(false, `emergency outcome: ${p}`);
      const c = s.checkInOf(await t.db());
      await t.check(c?.bpSymptoms === true && c?.readiness?.disposition === 'emergency', `stored bpSymptoms ${c?.bpSymptoms}, disposition ${c?.readiness?.disposition}`);
      await modesRefused(t, () => [s.TITLE.emergency]);
    }, { input: `P01; BP 190/80; symptoms switch on (${scenario})` });
  },
});

/** Unusual severe back pain through the back question, with the severe reading. */
const step4BackFlag = {
  name: 'step4-sudden-back-pain-flag',
  async run(t) {
    await s.open(t, persona('P01'));
    await t.step(4, 'First severe reading with “Sudden severe back pain…”', async () => {
      const sheet = await s.openCheckIn(t, 'guided', 'move');
      await s.noneRightNow(sheet);
      await s.typeBp(t, sheet, [[190, 80]]);
      await s.setPain(sheet, { back: 0, leg: 0, reach: 'Back' });
      await ui.tap(ui.checkbox(ui.section(sheet, 'Since your last check-in, any of these?'), ui.BACK_FLAG.suddenSevere));
      await s.noneElse(sheet);
      await s.sleepEnergy(sheet);
      await s.submit(sheet);
      const title = await s.outcomeTitle(sheet);
      await t.checkpoint('outcome');
      await t.check(title === s.TITLE.emergency, `190/80 with sudden severe back pain gave “${title}”, not the emergency`);
      await modesRefused(t, () => [s.TITLE.emergency]);
    }, { input: 'P01; BP 190/80; back change “Sudden severe back pain, or pain getting worse fast”' });
  },
};

// ---------------------------------------------------------------- step 5: gate variants × modes

const PERMISSION = { bpExercisePermission: { sys: 170, dia: 105, recordedOn: '2026-10-01' } };
const VARIANTS = [
  { id: '160-100', bp: [160, 100], expect: 'allow', note: 'no lower clinician limit' },
  { id: '161-80', bp: [161, 80], expect: 'hold' },
  { id: '120-101', bp: [120, 101], expect: 'hold' },
  { id: '160.1-80', bp: ['160.1', 80], expect: 'hold', decimal: true },
  { id: '120-100.1', bp: [120, '100.1'], expect: 'hold', decimal: true },
  { id: 'stop150-150-80', bp: [150, 80], expect: 'hold', health: { clinicianTargets: { bpStopSystolic: 150 } } },
  { id: 'permission-165-102', bp: [165, 102], expect: 'allow', health: PERMISSION },
  { id: 'permission-180-80', bp: [180, 80], expect: 'refuse', health: PERMISSION },
  { id: '120-120', bp: [120, 120], expect: 'refuse' },
  { id: '120-120-chest', bp: [120, 120], expect: 'emergency', chest: true },
];

const gateCase = (v, mode) => ({
  name: `step5-${v.id}-${mode}`,
  async run(t) {
    const seed = persona('P01', v.health ? { patch: { profile: { health: v.health } } } : {});
    await s.open(t, seed);
    const [a, b] = v.bp;
    await t.step(5, `Gate variant ${a}/${b} through ${mode}`, async () => {
      let shown;
      const { sheet } = await bpCheckIn(t, mode, [[a, b]], {
        submit: false,
        afterBp: async (_sheet, values) => { shown = values[0]; },
      });
      if (v.decimal && (shown[0] !== String(a) || shown[1] !== String(b))) {
        // Decimal readings are not accepted: the row applies only if they are. What matters then
        // is that the mangled entry cannot become a permission.
        t.note(`decimal BP not accepted: typed ${a}/${b}, the fields read ${shown[0]}/${shown[1]}`);
        await s.setPain(sheet, { back: 0, leg: 0, reach: 'Back' });
        await s.noneSince(sheet);
        await s.noneElse(sheet);
        await s.sleepEnergy(sheet);
        const submitButton = ui.button(sheet, ui.SUBMIT);
        const blocked = await submitButton.isDisabled();
        const why = (await sheet.locator('[aria-live="polite"]').allInnerTexts()).join(' ').trim();
        await t.checkpoint('decimal-entry');
        if (blocked) {
          t.note(`Submit blocked: “${why}”`);
        } else {
          await ui.tap(submitButton);
          await sheet.page().waitForTimeout(500);
          const title = await s.outcomeTitle(sheet);
          await t.check(HOLD_OR_MORE(mode).includes(title), `the mangled decimal entry ${shown[0]}/${shown[1]} produced “${title}”`);
        }
        return;
      }
      if (v.chest) await s.tickEmergency(sheet, ui.EMERGENCY.chest);
      else {
        await s.setPain(sheet, { back: 0, leg: 0, reach: 'Back' });
        await s.noneSince(sheet);
        await s.noneElse(sheet);
        await s.sleepEnergy(sheet);
        await s.submit(sheet);
      }
      await sheet.getByRole('status').or(sheet.getByRole('alert')).first().waitFor({ timeout: 5000 }).catch(() => {});
      const title = await s.outcomeTitle(sheet);
      const surf = await s.surface(t);
      await t.checkpoint('outcome');
      const text = surf.text;
      if (v.expect === 'allow') {
        await t.check([s.TITLE.adjust, s.TITLE.reassure].includes(title) && surf.start, `${a}/${b} (${v.note ?? v.id}) in ${mode}: “${title}”, start offered ${surf.start}; expected allowed with restrictions`);
        if (surf.start) {
          await ui.tap(sheet.getByRole('button', { name: /^(Start session|Start recovery session|Start stretch|Start walk|Continue|Continue to stretch|Continue to walk)$/ }));
          await t.page.waitForTimeout(800);
          const after = await s.surface(t);
          await t.checkpoint('after-start');
          await t.check(after.start || after.where === 'stretch setup' || after.where === 'walk setup', `the allowed start for ${mode} led to ${after.where} “${after.title ?? ''}” at ${after.route}`);
        }
      } else if (v.expect === 'emergency') {
        await t.check(title === s.TITLE.emergency, `120/120 with chest symptoms in ${mode}: “${title}”, not the emergency`);
        for (const p of s.emergencyProblems(text)) await t.check(false, `emergency outcome: ${p}`);
      } else {
        await t.check(HOLD_OR_MORE(mode).includes(title) && !surf.start, `${a}/${b} (${v.id}) in ${mode}: “${title}”, start offered ${surf.start}; expected every mode held`);
        await t.check(!/^(Go ahead|Good to go)/.test(title ?? ''), `${a}/${b} gave a reassuring result “${title}”`);
        if (v.id.startsWith('stop150')) await t.check(/150/.test(text) && /clinician/i.test(text), `the hold does not name the clinician’s 150 limit: “${text.slice(0, 200)}”`);
      }
      // The reading itself, stored once as a linked pair; never a mean.
      if (v.id !== '120-120' && v.id !== '120-120-chest') {
        const snap = await t.db();
        const pairs = s.bpPairs(snap).map(p => `${p.sys}/${p.dia}`);
        await t.check(pairs.length === 1 && pairs[0] === `${a}/${b}`, `stored BP pairs ${JSON.stringify(pairs)}, expected exactly ${a}/${b}`);
      }
    }, { input: `P01${v.health ? ` + ${JSON.stringify(v.health)}` : ''}; BP ${a}/${b}${v.chest ? ' + chest emergency' : ''}; ${mode} via Move` });
  },
});

// ---------------------------------------------------------------- step 6

const step6 = {
  name: 'step6-lower-reading-later',
  async run(t) {
    await s.open(t, persona('P01'));
    const page = t.page;
    await t.step(6, 'A refused 190/80; a lower reading as a new observation; reload; another mode', async () => {
      const { sheet } = await bpCheckIn(t, 'guided', [[190, 80]]);
      const first = await s.outcomeTitle(sheet);
      await t.must(HOLD_OR_MORE('guided').includes(first), `190/80 was not refused (“${first}”)`);
      await s.closeSheet(page);

      // A lower reading, entered as its own observation in Track.
      await ui.tab(page, 'Track');
      await ui.tap(ui.header(page).getByRole('button', { name: 'Add a record', exact: true }));
      await ui.tap(ui.row(page.getByRole('dialog', { name: 'Add' }), 'Blood pressure'));
      const form = page.getByRole('dialog', { name: 'Blood pressure' });
      await ui.type(form.getByRole('textbox', { name: /^Top/ }), '120');
      await ui.type(form.getByRole('textbox', { name: /^Bottom/ }), '80');
      await ui.tap(ui.button(form, 'Save'));
      await page.waitForTimeout(800);
      await t.checkpoint('lower-reading-saved');
      await s.closeSheet(page);
      const dialogs = page.getByRole('dialog');
      if (await dialogs.count()) await ui.tap(ui.button(dialogs, 'Close'));

      await t.reload();
      await s.backToTabs(t);
      const snap = await t.checkpoint('after-reload');
      const pairs = s.bpPairs(snap).map(p => `${p.sys}/${p.dia}`);
      await t.check(pairs.includes('190/80') && pairs.includes('120/80'), `after reload the day holds ${JSON.stringify(pairs)}; the earlier 190/80 must remain beside 120/80`);
      const c = s.checkInOf(snap);
      await t.check([...(c?.bpReadings ?? []), ...(c?.bpEarlier ?? [])].some(r => r.sys === 190 && r.dia === 80), 'the check-in no longer holds the severe 190/80');
      await modesRefused(t, HOLD_OR_MORE, [['stretch', 'move'], ['walk', 'move'], ['guided', 'direct']]);

      // The same lower number typed into the check-in instead: still not a release.
      const again = await s.openCheckIn(t, 'stretch', 'move');
      const change = ui.button(again, 'Change answers');
      if (await change.count()) await ui.tap(change);
      await s.noneRightNow(again);
      const bp = ui.section(again, 'Blood pressure');
      await ui.type(bp.getByRole('textbox', { name: 'Reading 1, top number', exact: true }), '120');
      await ui.type(bp.getByRole('textbox', { name: 'Reading 1, bottom number', exact: true }), '80');
      await s.submit(again);
      const title = await s.outcomeTitle(again);
      const snap2 = await t.checkpoint('check-in-replaced-reading');
      await t.check(HOLD_OR_MORE('stretch').includes(title), `replacing 190/80 with 120/80 in the check-in released movement: “${title}”`);
      const c2 = s.checkInOf(snap2);
      await t.check([...(c2?.bpEarlier ?? []), ...(c2?.bpReadings ?? [])].some(r => r.sys === 190 && r.dia === 80), `the replaced severe reading is gone from the check-in: ${JSON.stringify({ readings: c2?.bpReadings, earlier: c2?.bpEarlier })}`);
      await modesRefused(t, HOLD_OR_MORE, [['walk', 'move'], ['guided', 'move']]);
    }, { input: 'P01; BP 190/80; then Track BP 120/80; reload; then the check-in changed to 120/80' });
  },
};

export const cases = [
  step1,
  step2,
  step3([180, 80], 'step3-equality-180-80'),
  step3([140, 120], 'step3-or-140-120'),
  step4Switch('chest'),
  step4Switch('confusion'),
  step4Switch('unusual-severe-back-pain'),
  step4BackFlag,
  ...VARIANTS.flatMap(v => s.MODES.map(mode => gateCase(v, mode))),
  step6,
];
