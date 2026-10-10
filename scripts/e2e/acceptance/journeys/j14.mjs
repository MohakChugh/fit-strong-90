/**
 * J14, P04 variants: ketones independent of glucose.
 * SAFETY 6 of 10 (codex-acceptance.md; D28, D29(8), D30; E-KETONE,
 * E-DKA-SYMPTOM, T-KETONE, T-ILLNESS, H-LOW-KETONE).
 *
 * P04 with sglt2i=true and a blood ketone meter, combined with the basal
 * insulin and metformin it already takes. Every row is its own case. P04 is
 * not in the programme, so the rows run through Stretch and Walk (D35).
 */
import { persona } from '../fixtures/personas.mjs';
import { docs } from '../lib/harness.mjs';
import * as ui from '../lib/ui.mjs';
import * as sb from '../lib/safety-b.mjs';

export const id = 'J14';
export const title = 'Ketones independent of glucose';
export const safety = true;

/** The modes P04 can start (D35). */
const MODES = ['stretch', 'walk'];
const p04k = () => persona('P04', { patch: { profile: { health: { sglt2i: true, ketoneTest: 'blood' } } } });

/** What each expected answer must look like (spec copy table and the ketone table). */
async function expectAnswer(t, s, expect, mode, label) {
  const where = `${label} (${mode})`;
  if (expect === 'allowed') {
    await t.check(s.start && sb.isAllowedTitle(s.title), `${where}: refused (“${s.title}”) ${s.bannerText}`);
    return;
  }
  await t.check(!s.start, `${where}: a start is offered (${s.startLabels?.join(',') ?? s.where})`);
  if (expect === 'emergency') {
    await t.check(s.title === sb.TITLE.emergency, `${where}: “${s.title}”, not “${sb.TITLE.emergency}”`);
    await t.check(/No exercise today\./.test(s.bannerText ?? ''), `${where}: no “No exercise today.” with the emergency`);
    await t.check(!/Re-check at \d{1,2}:\d\d|in \d+ minutes?\./.test(s.bannerText ?? ''), `${where}: emergency help is shown with a countdown: ${s.bannerText}`);
  } else if (expect === 'today') {
    await t.check(s.title === sb.TITLE.today, `${where}: “${s.title}”, not “${sb.TITLE.today}”`);
    await t.check(/contact[^.]*(today|now)|urgent care now/i.test(s.bannerText ?? ''), `${where}: no clinical contact today/now: ${s.bannerText}`);
  } else if (expect === 'hold') {
    await t.check(sb.isHoldTitle(s.title, mode), `${where}: “${s.title}”, not a hold`);
    await t.check(/sick-day plan/i.test(s.bannerText ?? ''), `${where}: no existing sick-day plan: ${s.bannerText}`);
    await t.check(/2 hours/i.test(s.bannerText ?? ''), `${where}: no 2-hour re-check: ${s.bannerText}`);
  }
  await t.check(!sb.MEDICINE_CHANGE.test(s.bannerText ?? ''), `${where}: the answer changes or doses a medicine: “${(s.bannerText ?? '').match(sb.MEDICINE_CHANGE)?.[0]}”`);
}

async function otherModes(t, first, expect, label) {
  for (const mode of MODES.filter(m => m !== first)) {
    const a = await sb.modeAnswer(t, mode, 'move', { resubmit: false });
    if (expect === 'allowed') await t.check(a.allowed, `${label}: ${mode} refused (“${a.title}”) ${a.bannerText ?? ''}`);
    else {
      await t.check(!a.allowed && !a.start, `${label}: ${mode} was offered a start (${a.where} ${a.route})`);
      if (a.where === 'sheet' && a.title) await expectAnswer(t, a, expect, mode, label);
    }
    await sb.backToTabs(t);
  }
}

/** The stored ketone evidence: raw reading on the check-in, and no invented observation. */
async function storedKetones(t, want, glucoseTyped) {
  const snap = await t.db();
  const c = sb.checkInOn(snap);
  const k = c?.ketones;
  if (want.kind === 'blood') {
    await t.check(k?.kind === 'blood' && k.value === want.value && !!k.measuredAt, `check-in ketones: ${JSON.stringify(k)}, not blood ${want.value} with its time`);
  } else {
    await t.check(k?.kind === 'urine' && k.category === want.category && k.value === undefined, `check-in ketones: ${JSON.stringify(k)}, not the urine strip’s own category ${want.category} without a number`);
  }
  const invented = (snap.observations ?? []).filter(o => !sb.KINDS.has(o.kind) || /keton/i.test(`${o.kind} ${o.context ?? ''} ${o.unit}`));
  await t.check(!invented.length, `a ketone observation kind was invented: ${invented.map(o => `${o.kind} ${o.value} ${o.unit}`).join('; ')}`);
  const glucose = sb.glucoseObs(snap);
  await t.check(glucose.length === (glucoseTyped ? 1 : 0) && glucose.every(o => o.unit === 'mg/dL'), `glucose observations: ${glucose.map(sb.brief).join('; ')}`);
  return { snap, checkIn: c };
}

/** You → Profile & health → Edit health, set the answers and save. */
async function editHealth(t, answers) {
  const page = t.page;
  await ui.tab(page, 'Today');
  await ui.tap(page.getByRole('link', { name: /^You:/ }));
  await ui.tap(ui.row(page.getByRole('main'), 'Profile & health', 'link'));
  await page.getByRole('heading', { level: 1, name: 'Profile & health', exact: true }).waitFor();
  await ui.tap(ui.button(page.getByRole('main'), 'Edit health'));
  const dialog = page.getByRole('dialog', { name: 'Edit your answers' });
  await dialog.waitFor();
  for (const [group, choice] of answers) await ui.tap(ui.radio(dialog.getByRole('radiogroup', { name: group, exact: true }), choice));
  const save = ui.button(dialog, 'Save');
  await t.must(!(await save.isDisabled()), `Save stays disabled after ${answers.map(a => a.join(': ')).join('; ')}`);
  await ui.tap(save);
  await dialog.waitFor({ state: 'hidden' });
  await page.getByRole('main').getByText(/^Saved\. Today uses your new answers\.$/).waitFor();
}

/** One blood-ketone row: answer, then read every mode. */
function bloodRow({ name, step, glucose, ketones, expect, mode = 'stretch', news, after }) {
  return {
    name,
    async run(t) {
      await t.open({ seed: p04k(), route: '/today' });
      await t.step(step, `${glucose === null ? 'Glucose absent' : `Glucose ${glucose}`}, blood ketones ${ketones}${news ? `, ${news.join(', ')}` : ''}`, async () => {
        const sheet = await sb.openSheet(t, mode);
        await ui.answerCheckIn(t, sheet, ui.normalAnswers('P04', {
          glucose: glucose === null ? null : { value: String(glucose), unit: 'mg/dL' },
          ketones: { blood: String(ketones) },
          ...(news ? { news } : {}),
        }));
        const s = await sb.readSheet(sheet);
        await t.checkpoint(`ketones-${ketones}`);
        await expectAnswer(t, s, expect, mode, `ketones ${ketones}`);
        await storedKetones(t, { kind: 'blood', value: Number(ketones) }, glucose !== null);
        await sb.closeSheet(t);
        await otherModes(t, mode, expect, `ketones ${ketones}`);
      }, { input: `P04 + SGLT2, glucose ${glucose ?? 'absent'} mg/dL, blood ketones ${ketones} mmol/L${news ? `, ${news.join(', ')}` : ''}` });
      if (after) await after(t);
    },
  };
}

export const cases = [
  // ---- Step 1: emergency ketones whatever the glucose -----------------------
  bloodRow({ name: 'step 1: glucose 60 with blood ketones 3.0', step: 1, glucose: 60, ketones: '3.0', expect: 'emergency', mode: 'walk' }),
  bloodRow({ name: 'step 1: glucose 50 with blood ketones 3.0', step: 1, glucose: 50, ketones: '3.0', expect: 'emergency', mode: 'stretch' }),
  bloodRow({
    name: 'steps 1 and 6: glucose 110 with blood ketones 3.0, then a diagnosis edit',
    step: 1, glucose: 110, ketones: '3.0', expect: 'emergency',
    async after(t) {
      await t.step(6, 'Reload, change the diabetes diagnosis, try another mode', async () => {
        await t.reload();
        await editHealth(t, [['Diabetes', 'Type 1']]);
        const snap = await t.db();
        await t.check(docs(snap).profile?.health?.diabetes === 'type1', `diagnosis stored as ${docs(snap).profile?.health?.diabetes}`);
        await t.check(sb.checkInOn(snap)?.ketones?.value === 3, `the diagnosis edit changed the reported ketones: ${JSON.stringify(sb.checkInOn(snap)?.ketones)}`);
        for (const mode of ['stretch', 'walk']) {
          const a = await sb.modeAnswer(t, mode, 'move', { resubmit: false });
          await t.check(!a.allowed && a.title === sb.TITLE.emergency, `after the diagnosis edit ${mode} answers “${a.title}” (${a.where}), not the emergency`);
          await sb.backToTabs(t);
        }
        await t.checkpoint('after-diagnosis-edit');
      }, { input: 'Diabetes: Type 2 → Type 1; reported ketones 3.0 unchanged' });
    },
  }),
  bloodRow({ name: 'step 1: glucose absent with blood ketones 3.0', step: 1, glucose: null, ketones: '3.0', expect: 'emergency' }),

  // ---- Step 2: the blood ketone table, glucose 110, no other symptoms -------
  ...[
    ['0.59', 'allowed'], ['0.6', 'hold'], ['1.49', 'hold'], ['1.5', 'today'], ['2.99', 'today'], ['3.0', 'emergency'], ['3.01', 'emergency'],
  ].map(([k, expect]) => bloodRow({ name: `step 2: blood ketones ${k}`, step: 2, glucose: 110, ketones: k, expect, mode: 'walk' })),

  // ---- Step 3: urine strips, on their own scale ------------------------------
  ...['Moderate', 'Large'].map(category => ({
    name: `step 3: urine strip ${category}`,
    async run(t) {
      await t.open({ seed: p04k(), route: '/today' });
      await t.step(3, `Switch the profile to urine strips; choose ${category}`, async () => {
        await editHealth(t, [['Ketone testing', 'Urine strips']]);
        const snap = await t.db();
        await t.check(docs(snap).profile?.health?.ketoneTest === 'urine', `ketone test stored as ${docs(snap).profile?.health?.ketoneTest}`);
        const sheet = await sb.openSheet(t, 'stretch');
        await ui.answerCheckIn(t, sheet, ui.normalAnswers('P04', { ketones: { urine: category } }));
        const s = await sb.readSheet(sheet);
        await t.checkpoint(`urine-${category}`);
        await expectAnswer(t, s, 'emergency', 'stretch', `urine ${category}`);
        await storedKetones(t, { kind: 'urine', category: category.toLowerCase() }, true);
        await sb.closeSheet(t);
        await otherModes(t, 'stretch', 'emergency', `urine ${category}`);
      }, { input: `profile ketone testing: Urine strips; glucose 110; urine strip ${category}` });
    },
  })),

  // ---- Step 4: DKA symptoms with normal glucose and unknown ketones -------------
  {
    name: 'step 4: DKA symptoms with glucose 110 and ketones unknown',
    async run(t) {
      await t.open({ seed: p04k(), route: '/today' });
      await t.step(4, 'Report vomiting with tummy pain or deep breathing as the current DKA answer', async () => {
        const sheet = await sb.openSheet(t, 'walk');
        // Glucose typed first; the emergency answer is saved the moment it is ticked.
        await ui.answerCheckIn(t, sheet, { emergency: [], glucose: { value: '110', unit: 'mg/dL' }, submit: false });
        const right = ui.section(sheet, 'Right now, any of these?');
        const show = ui.button(right, 'Show the list again');
        if (await show.count()) await ui.tap(show);
        await ui.tap(ui.checkbox(right, ui.EMERGENCY.dka));
        const s = await sb.readSheet(sheet);
        await t.checkpoint('dka-symptoms');
        await expectAnswer(t, s, 'emergency', 'walk', 'DKA symptoms');
        await t.check(/ketoacidosis|DKA/i.test(s.bannerText), `the emergency does not name ketoacidosis: ${s.bannerText}`);
        const c = sb.checkInOn(await t.db());
        await t.check((c?.emergency ?? []).includes('dka') && c?.urgentSymptoms === true && !c?.ketones, `stored: ${JSON.stringify({ emergency: c?.emergency, urgent: c?.urgentSymptoms, ketones: c?.ketones })}`);
        await sb.closeSheet(t);
        await otherModes(t, 'walk', 'emergency', 'DKA symptoms');
      }, { input: 'glucose 110, ketones blank, “Vomiting with tummy pain, deep or unusual breathing, fruity breath, or very drowsy or confused”' });
    },
  },

  // ---- Step 5: positive ketones with illness ---------------------------------
  bloodRow({ name: 'step 5: ketones 0.6 and unwell', step: 5, glucose: 110, ketones: '0.6', news: [ui.NEWS.unwell], expect: 'today' }),
  bloodRow({ name: 'step 5: ketones 0.6 and vomiting', step: 5, glucose: 110, ketones: '0.6', news: [ui.NEWS.vomiting], expect: 'today' }),
  bloodRow({ name: 'step 5: ketones 0.6 and a high not falling', step: 5, glucose: 110, ketones: '0.6', news: [ui.NEWS.highNotFalling], expect: 'today' }),
  {
    name: 'step 5: ketones 0.6 and unwell, then DKA or confusion added',
    async run(t) {
      await t.open({ seed: p04k(), route: '/today' });
      await t.step(5, 'Unwell with positive ketones, then DKA/altered consciousness escalates at once', async () => {
        const sheet = await sb.openSheet(t, 'stretch');
        await ui.answerCheckIn(t, sheet, ui.normalAnswers('P04', { ketones: { blood: '0.6' }, news: [ui.NEWS.unwell] }));
        let s = await sb.readSheet(sheet);
        await expectAnswer(t, s, 'today', 'stretch', 'ketones 0.6 and unwell');
        await ui.tap(ui.button(sheet, 'Change answers'));
        const right = ui.section(sheet, 'Right now, any of these?');
        const show = ui.button(right, 'Show the list again');
        if (await show.count()) await ui.tap(show);
        await ui.tap(ui.checkbox(right, ui.EMERGENCY.dka));
        s = await sb.readSheet(sheet);
        await t.checkpoint('unwell-then-dka');
        await expectAnswer(t, s, 'emergency', 'stretch', 'unwell + DKA symptoms');
        await storedKetones(t, { kind: 'blood', value: 0.6 }, true);
      }, { input: 'glucose 110, ketones 0.6, unwell; then the DKA emergency answer' });
    },
  },

  // ---- Stored: a later, lower reading does not settle an earlier one ----------
  {
    name: 'stored: a newer ketone reading keeps the earlier significant result',
    async run(t) {
      await t.open({ seed: p04k(), route: '/today' });
      await t.step(2, 'Ketones 1.5, then a later 0.3', async () => {
        const sheet = await sb.openSheet(t, 'walk');
        await ui.answerCheckIn(t, sheet, ui.normalAnswers('P04', { ketones: { blood: '1.5' } }));
        let s = await sb.readSheet(sheet);
        await expectAnswer(t, s, 'today', 'walk', 'ketones 1.5');
        await t.advanceMinutes(30);
        await ui.tap(ui.button(sheet, 'Change answers'));
        await ui.answerCheckIn(t, sheet, { glucose: { value: '112', unit: 'mg/dL' }, ketones: { blood: '0.3' } });
        s = await sb.readSheet(sheet);
        await t.checkpoint('later-lower-ketones');
        await t.check(!s.start && (s.title === sb.TITLE.today || s.title === sb.TITLE.emergency), `a later 0.3 released the earlier 1.5: “${s.title}” ${s.bannerText}`);
        const c = sb.checkInOn(await t.db());
        await t.check(c?.ketones?.value === 0.3 && (c?.ketonesEarlier ?? []).some(k => k.kind === 'blood' && k.value === 1.5), `stored ketones: ${JSON.stringify({ ketones: c?.ketones, earlier: c?.ketonesEarlier })}`);
        await sb.closeSheet(t);
        await otherModes(t, 'walk', 'today', 'earlier 1.5, later 0.3');
      }, { input: 'blood ketones 1.5 at 09:00, then 0.3 (glucose 112) at 09:30' });
    },
  },
];
