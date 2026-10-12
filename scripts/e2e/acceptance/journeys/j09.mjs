/**
 * J09, P03 plus P01 controls: 70, 69.9, rescue and release.
 * SAFETY 3 of 10 (codex-acceptance.md; D28, D29(1), D29(3), D29(5), D30;
 * H-HYPO, H-PRE-LOW, T-HYPO-REVIEW; ADA 2026 Table 6.4, recommendation 6.15).
 *
 * Each independent sequence is its own case in a fresh context. Within a
 * sequence (low, rescue, re-check) the sheet stays open the way a person
 * waiting out the fifteen minutes would leave it, and the frozen clock is
 * moved deliberately.
 */
import { persona } from '../fixtures/personas.mjs';
import * as ui from '../lib/ui.mjs';
import * as sb from '../lib/safety-b.mjs';

export const id = 'J09';
export const title = '70, 69.9, rescue and release';
export const safety = true;

const MMOL_69_9 = '3.8833333333333337';
const OTHER_MODES = ['guided', 'stretch'];

/** Text that labels a reading as biochemical hypoglycaemia. */
const HYPO_LABEL = /hypoglyc|\bis a low\b|\ba low\b|severe low|level [12]\b|treat (it|the low|this low)/i;
const FIFTEEN_FIFTEEN = /15 ?g of fast-acting carbohydrate/i;
/** "Re-check at 09:15", in the device's 24-hour or 12-hour form ("9:15 am"). */
const RECHECK_0915 = /Re-check at (?:09:15|9:15\s?am)\b/i;
/** The answer without the low's treatment sentence (15 g, then re-check in 15 minutes). */
const untreated = text => text.replace(/[^.]*fast-acting carbohydrate[^.]*\./gi, '');
/** The answer without the rescue's branch for someone confused or unable to swallow, which calls for help. */
const unconditional = text => text.replace(/If you (?:feel confused|cannot swallow)[^]*?(?=General information|$)/i, '');

async function refusedEverywhere(t, modes, why) {
  for (const mode of modes) {
    const a = await sb.modeAnswer(t, mode);
    await t.check(!a.allowed && !a.start, `${why}: ${mode} was offered a start (${a.where} ${a.route}, “${a.title ?? ''}” ${a.startLabels?.join(',') ?? ''})`);
    await sb.backToTabs(t);
  }
}

async function trackShows(t, values, why) {
  await sb.tabTo(t.page, 'Track', 'My Day');
  await ui.trackDay(t.page, sb.TODAY);
  const text = (await t.page.getByRole('main').innerText()).replace(/\s+/g, ' ');
  for (const v of values) await t.check(v.test(text), `${why}: Track for today does not show ${v} (${text.slice(0, 300)})`);
  t.note(`Track today: ${(text.match(/Glucose [^·]+/g) ?? []).join(' · ')}`);
  await t.checkpoint('track-today');
}

/** Today's glucose observations and the check-in that holds them. */
async function stored(t) {
  const snap = await t.db();
  return { snap, obs: sb.glucoseObs(snap), checkIn: sb.checkInOn(snap) };
}

const sameMeasurement = (o, value, unit, hhmm) => o.value === value && o.unit === unit && o.source === 'manual'
  && o.scope === 'pointInTime' && o.at.startsWith(`${sb.TODAY}T${hhmm}`);

export const cases = [
  {
    name: 'step 1: P03 70 mg/dL before a walk',
    async run(t) {
      await t.open({ seed: persona('P03'), route: '/today' });
      await t.step(1, 'P03, pre-walk glucose exactly 70 mg/dL, fresh, no symptoms', async () => {
        const sheet = await sb.openSheet(t, 'walk');
        await ui.answerCheckIn(t, sheet, ui.normalAnswers('P03', { glucose: { value: '70', unit: 'mg/dL' } }));
        const s = await sb.readSheet(sheet);
        await t.checkpoint('70-outcome');
        await t.check(sb.isHoldTitle(s.title, 'walk'), `70 mg/dL with a sulfonylurea is not held: “${s.title}”`);
        await t.check(!s.start, `70 mg/dL with a sulfonylurea offers ${s.startLabels.join(', ')}`);
        await t.check(/\b90\b/.test(s.bannerText), `the hold does not name the 90 mg/dL start level: ${s.bannerText}`);
        await t.check(!HYPO_LABEL.test(s.bannerText), `70 mg/dL is labelled as hypoglycaemia: ${s.bannerText}`);
        await t.check(!FIFTEEN_FIFTEEN.test(s.bannerText), `a universal 15-15 treatment is given for 70 mg/dL: ${s.bannerText}`);
        await t.check(/exercise plan|plan sets|your plan/i.test(s.bannerText), `the release is not the existing exercise carbohydrate/monitoring plan: ${s.bannerText}`);
        const { obs, checkIn } = await stored(t);
        await t.check(obs.length === 1 && sameMeasurement(obs[0], 70, 'mg/dL', '09:00') && obs[0].context === `checkIn:${sb.TODAY}`,
          `stored glucose observations: ${obs.map(sb.brief).join('; ')}`);
        await t.check(checkIn?.glucose?.value === 70 && checkIn.glucose.unit === 'mg/dL' && checkIn.glucose.source === 'meter'
          && Date.parse(checkIn.glucose.measuredAt) === t.time, `check-in glucose: ${JSON.stringify(checkIn?.glucose)}`);
        await sb.closeSheet(t);
        await refusedEverywhere(t, OTHER_MODES, 'held below 90 for a sulfonylurea');
      }, { input: 'P03 glucose 70 mg/dL, meter, measured now; normal answers' });
    },
  },

  {
    name: 'step 2: P01 metformin-only 70 mg/dL control',
    async run(t) {
      await t.open({ seed: persona('P01'), route: '/today' });
      await t.step(2, 'Fresh P01 metformin-only control, 70 mg/dL, no symptoms', async () => {
        const sheet = await sb.openSheet(t, 'walk');
        await ui.answerCheckIn(t, sheet, ui.normalAnswers('P01', { glucose: { value: '70', unit: 'mg/dL' } }));
        const s = await sb.readSheet(sheet);
        await t.checkpoint('p01-70-outcome');
        await t.check(s.start && sb.isAllowedTitle(s.title), `metformin-only 70 mg/dL is refused: “${s.title}” ${s.bannerText}`);
        await t.check(!/start level|under 90|is a low|hypoglyc|15 ?g of fast-acting/i.test(s.bannerText),
          `an H-HYPO or H-PRE-LOW reason appears for metformin-only 70 mg/dL: ${s.bannerText}`);
        const { obs } = await stored(t);
        const today = obs.filter(o => o.day === sb.TODAY);
        // Timed when its first digit was typed (09:00), as the sheet's Time measured shows, not when the
        // sheet was saved after the BP minute (scan X2-15).
        await t.check(today.length === 1 && sameMeasurement(today[0], 70, 'mg/dL', '09:00'),
          `stored glucose today: ${today.map(sb.brief).join('; ')}`);
        await sb.closeSheet(t);
        for (const mode of OTHER_MODES) {
          const a = await sb.modeAnswer(t, mode);
          await t.check(a.allowed, `metformin-only 70 mg/dL refuses ${mode}: “${a.title}” ${a.bannerText ?? ''}`);
          await sb.backToTabs(t);
        }
      }, { input: 'P01 glucose 70 mg/dL; BP 124/78 then 122/76; back 0/0' });
    },
  },

  {
    name: 'steps 3-5 and 8: P03 69.9 as mmol/L, premature recheck, 65 at fifteen minutes',
    async run(t) {
      await t.open({ seed: persona('P03'), route: '/today' });
      let sheet;
      await t.step(3, `P03 switches to mmol/L and enters ${MMOL_69_9}`, async () => {
        sheet = await sb.openSheet(t, 'walk');
        await ui.answerCheckIn(t, sheet, ui.normalAnswers('P03', { glucose: { value: MMOL_69_9, unit: 'mmol/L' } }));
        const s = await sb.readSheet(sheet);
        await t.checkpoint('69.9-outcome');
        await t.check(sb.isHoldTitle(s.title, 'walk') && !s.start, `69.9 mg/dL is not refused: “${s.title}” ${s.startLabels.join(',')}`);
        await t.check(/\bis a low\b|54 to 69|level 1/i.test(s.bannerText), `69.9 mg/dL is not treated as a level 1 low (rounded to 70, or only “below start”): ${s.bannerText}`);
        await t.check(FIFTEEN_FIFTEEN.test(s.bannerText) || /\b15 g\b/.test(s.bannerText), `no 15 g fast-acting carbohydrate instruction: ${s.bannerText}`);
        await t.check(/re-?check in 15 minutes|15 minutes/i.test(s.bannerText), `no re-check in 15 minutes: ${s.bannerText}`);
        await t.check(RECHECK_0915.test(s.bannerText), `no re-check time 09:15 shown: ${s.bannerText}`);
        const { obs, checkIn } = await stored(t);
        await t.check(obs.length === 1 && obs[0].value === Number(MMOL_69_9) && obs[0].unit === 'mmol/L' && obs[0].at.startsWith(`${sb.TODAY}T09:00`),
          `the reading is not stored at its original precision and unit: ${obs.map(sb.brief).join('; ')}`);
        await t.check(checkIn?.glucose?.value === Number(MMOL_69_9) && checkIn.glucose.unit === 'mmol/L', `check-in glucose: ${JSON.stringify(checkIn?.glucose)}`);
      }, { input: `glucose ${MMOL_69_9} mmol/L, measured 09:00` });

      await t.step(4, 'Advance fourteen minutes; reuse the old number, then a premature normal re-check', async () => {
        await t.advanceMinutes(14);
        let s = await sb.readSheet(sheet);
        await t.check(!s.start, `the countdown tick alone released movement at 09:14: ${s.startLabels.join(',')}`);
        // Reuse: the saved reading, resubmitted untouched.
        await ui.tap(ui.button(sheet, 'Change answers'));
        const field = sheet.getByRole('textbox', { name: 'Glucose reading', exact: true });
        const shown = await field.inputValue();
        const submit = ui.button(sheet, ui.SUBMIT);
        if (await submit.isDisabled()) {
          t.note(`resubmitting the old reading (${shown}) is blocked: ${(await sheet.innerText()).match(/Enter your new glucose reading[^\n]*/)?.[0] ?? 'Submit disabled'}`);
        } else {
          await ui.tap(submit);
          s = await sb.readSheet(sheet);
          await t.check(!s.start, `resubmitting the old number released movement: ${s.title}`);
          await ui.tap(ui.button(sheet, 'Change answers'));
        }
        const before = (await stored(t)).obs.length;
        await t.check(before === 1, `resubmitting the old number duplicated the reading (${before} observations)`);
        await t.checkpoint('reuse-old-number');
        // A premature normal re-check, measured now (09:14).
        await ui.answerCheckIn(t, sheet, { glucose: { value: '110', unit: 'mg/dL' } });
        s = await sb.readSheet(sheet);
        await t.checkpoint('premature-recheck');
        await t.check(!s.start && sb.isHoldTitle(s.title, 'walk'), `a re-check 14 minutes after the low released movement: “${s.title}” ${s.bannerText}`);
        await t.check(/less than 15 minutes|check again at (?:09:15|9:15\s?am)|re-?check/i.test(s.bannerText), `the premature re-check is not explained: ${s.bannerText}`);
      }, { input: 'at 09:14: old reading resubmitted; then 110 mg/dL measured 09:14' });

      await t.step(5, 'Advance to fifteen minutes; measure 65 mg/dL', async () => {
        await t.advanceMinutes(1);
        await ui.tap((await ui.button(sheet, 'Enter a new reading').count()) ? ui.button(sheet, 'Enter a new reading') : ui.button(sheet, 'Change answers'));
        await ui.answerCheckIn(t, sheet, { glucose: { value: '65', unit: 'mg/dL' } });
        const s = await sb.readSheet(sheet);
        await t.checkpoint('65-at-fifteen');
        await t.check(!s.start, `still low at the 15-minute re-check offers ${s.startLabels.join(',')}`);
        await t.check(sb.isRefusalTitle(s.title, 'walk'), `the attempt is not ended: “${s.title}”`);
        await t.check(/tell your care team if lows keep happening/i.test(s.bannerText), `no “tell your care team if lows keep happening”: ${s.bannerText}`);
        await t.check(/15 ?g|treat/i.test(s.bannerText), `no direction to repeat the rescue: ${s.bannerText}`);
        // The rescue's own branch for someone confused or unable to swallow sends them for help; outside it, nothing does.
        await t.check(s.title !== sb.TITLE.emergency && !/emergency|call your local/i.test(unconditional(s.bannerText)), `a repeated level 1 low is escalated to an emergency: ${s.bannerText}`);
        await t.check(!/contact[^.]*today|today[^.]*contact/i.test(s.bannerText) && s.title !== sb.TITLE.today, `a repeated level 1 low mandates same-day contact: ${s.bannerText}`);
        const { obs, checkIn } = await stored(t);
        await t.check(obs.length === 3, `expected three distinct readings (69.9, 110, 65), found ${obs.map(sb.brief).join('; ')}`);
        await t.check(!!obs.find(o => o.value === Number(MMOL_69_9) && o.unit === 'mmol/L' && o.at.startsWith(`${sb.TODAY}T09:00`))
          && !!obs.find(o => sameMeasurement(o, 110, 'mg/dL', '09:14')) && !!obs.find(o => sameMeasurement(o, 65, 'mg/dL', '09:15')),
          `readings not each kept at their measurement time and unit: ${obs.map(sb.brief).join('; ')}`);
        const earlier = checkIn?.glucoseEarlier ?? [];
        await t.check(checkIn?.glucose?.value === 65 && earlier.some(g => g.value === Number(MMOL_69_9) && g.unit === 'mmol/L') && earlier.some(g => g.value === 110),
          `check-in current/earlier readings: ${JSON.stringify({ glucose: checkIn?.glucose, glucoseEarlier: earlier })}`);
        // The same measurement submitted again must not be recorded twice.
        await ui.tap(ui.button(sheet, 'Change answers'));
        const submit = ui.button(sheet, ui.SUBMIT);
        if (!(await submit.isDisabled())) await ui.tap(submit);
        const after = (await stored(t)).obs;
        await t.check(after.filter(o => o.value === 65).length === 1, `resubmitting 65 duplicated it: ${after.map(sb.brief).join('; ')}`);
      }, { input: '65 mg/dL measured 09:15' });

      await t.step(8, 'Change mode, reload and revisit Track', async () => {
        await sb.closeSheet(t);
        await refusedEverywhere(t, OTHER_MODES, 'after a low still under 70 at the re-check');
        for (const route of ['/session', '/walk/live']) {
          await t.goto(route);
          const offered = await t.page.getByRole('main').getByRole('button', { name: /^(Start|Resume|Pause|Finish walk)$/ }).count();
          await t.check(offered === 0, `the direct link ${route} offers movement after the attempt ended`);
          await t.checkpoint(`direct-${route.replace(/\W+/g, '-')}`);
        }
        await t.goto('/today');
        await t.reload();
        await refusedEverywhere(t, ['walk'], 'after reload');
        // Display rounding may differ from the clinical value (spec J13); the low must still read as a low.
        await trackShows(t, [/65\s?mg\/dL, Low/, /(69\.9|70) mg\/dL, Low|3\.9 mmol\/L/, /110 mg\/dL/], 'every reading remains in history');
        const { obs } = await stored(t);
        await t.check(obs.length === 3, `readings after reload: ${obs.map(sb.brief).join('; ')}`);
      });
    },
  },

  {
    name: 'step 3: an emergency answer during the re-check wait',
    async run(t) {
      await t.open({ seed: persona('P03'), route: '/today' });
      await t.step(3, 'The fifteen-minute timer must not delay emergency symptoms', async () => {
        const sheet = await sb.openSheet(t, 'walk');
        await ui.answerCheckIn(t, sheet, ui.normalAnswers('P03', { glucose: { value: MMOL_69_9, unit: 'mmol/L' } }));
        let s = await sb.readSheet(sheet);
        await t.check(RECHECK_0915.test(s.bannerText), `no countdown after the low: ${s.bannerText}`);
        await ui.tap(ui.button(sheet, 'Change answers'));
        const right = ui.section(sheet, 'Right now, any of these?');
        const show = ui.button(right, 'Show the list again');
        if (await show.count()) await ui.tap(show);
        await t.advance(5000);
        await ui.tap(ui.checkbox(right, ui.EMERGENCY.chest));
        s = await sb.readSheet(sheet);
        await t.checkpoint('emergency-during-wait');
        await t.check(s.title === sb.TITLE.emergency, `an emergency answer during the re-check wait shows “${s.title}”`);
        await t.check(/No exercise today\./.test(s.bannerText), `no “No exercise today.” with the emergency: ${s.bannerText}`);
        // No countdown before help: no time to re-check at, the call for help first, and no wait outside
        // the low's own treatment, which may stay for someone who can swallow (its re-check is the glucose's).
        const call = s.bannerText.search(/Call your local emergency number now/);
        const treat = s.bannerText.search(/fast-acting carbohydrate/i);
        const waits = untreated(s.bannerText).match(/\bin \d+ minutes?\b/gi);
        await t.check(!/Re-check at \d{1,2}:\d\d/i.test(s.bannerText) && !waits, `the emergency still shows a countdown: ${s.bannerText}`);
        await t.check(call >= 0 && (treat < 0 || call < treat), `the emergency does not lead with calling for help: ${s.bannerText}`);
        await t.check(!s.start, 'a start is offered with the emergency');
        const { checkIn } = await stored(t);
        await t.check(checkIn?.urgentSymptoms === true && (checkIn.emergency ?? []).includes('chest'), `stored emergency: ${JSON.stringify({ urgent: checkIn?.urgentSymptoms, emergency: checkIn?.emergency })}`);
      }, { input: `${MMOL_69_9} mmol/L, then chest pain while waiting` });
    },
  },

  {
    name: 'steps 6 and 8: P03 53.9 then 110 at fifteen minutes',
    async run(t) {
      await t.open({ seed: persona('P03'), route: '/today' });
      let sheet;
      await t.step(6, 'Initial 53.9 mg/dL, alert, then the fifteen-minute reading 110 and symptoms resolved', async () => {
        sheet = await sb.openSheet(t, 'walk');
        await ui.answerCheckIn(t, sheet, ui.normalAnswers('P03', { glucose: { value: '53.9', unit: 'mg/dL' } }));
        let s = await sb.readSheet(sheet);
        await t.checkpoint('53.9-outcome');
        await t.check(s.title === sb.TITLE.today || s.title === sb.TITLE.emergency, `53.9 mg/dL (level 2) is not a today review: “${s.title}”`);
        await t.check(/care team today|contact[^.]*today/i.test(s.bannerText), `no “contact your care team today” for a level 2 low: ${s.bannerText}`);
        await t.check(!s.start, `a level 2 low offers ${s.startLabels.join(',')}`);
        await t.advanceMinutes(15);
        const next = (await ui.button(sheet, 'Enter a new reading').count()) ? 'Enter a new reading' : 'Change answers';
        await ui.tap(ui.button(sheet, next));
        await ui.answerCheckIn(t, sheet, { glucose: { value: '110', unit: 'mg/dL' }, lowRecovered: true });
        s = await sb.readSheet(sheet);
        await t.checkpoint('110-after-level-2');
        await t.check(!s.start, `a normal re-check after a level 2 low restarted the attempt: ${s.startLabels.join(',')}`);
        await t.check(s.title === sb.TITLE.today || s.title === sb.TITLE.emergency, `the level 2 event was erased by the normal re-check: “${s.title}”`);
        await t.check(/care team today|contact[^.]*today/i.test(s.bannerText), `“contact your care team today” no longer shown after recovery: ${s.bannerText}`);
        const { obs, checkIn } = await stored(t);
        await t.check(obs.length === 2 && !!obs.find(o => sameMeasurement(o, 53.9, 'mg/dL', '09:00')) && !!obs.find(o => sameMeasurement(o, 110, 'mg/dL', '09:15')),
          `readings: ${obs.map(sb.brief).join('; ')}`);
        await t.check((checkIn?.glucoseEarlier ?? []).some(g => g.value === 53.9) && checkIn?.glucose?.value === 110, `check-in: ${JSON.stringify({ glucose: checkIn?.glucose, earlier: checkIn?.glucoseEarlier })}`);
      }, { input: '53.9 mg/dL at 09:00 (alert); 110 mg/dL at 09:15 with symptoms gone' });

      await t.step(8, 'Change mode, reload and revisit Track', async () => {
        await sb.closeSheet(t);
        await refusedEverywhere(t, OTHER_MODES, 'after a level 2 low');
        await t.reload();
        await refusedEverywhere(t, ['walk'], 'after reload');
        await trackShows(t, [/(53\.9|54) mg\/dL, Serious low/, /110 mg\/dL/], 'both readings remain in history');
      });
    },
  },

  {
    name: 'step 7: P03 69.9 then 95 at fifteen minutes, recovery answer false then true',
    async run(t) {
      await t.open({ seed: persona('P03'), route: '/today' });
      await t.step(7, 'Release only after a timed new reading, symptoms gone and the plan allowing exercise', async () => {
        const sheet = await sb.openSheet(t, 'walk');
        await ui.answerCheckIn(t, sheet, ui.normalAnswers('P03', { glucose: { value: '69.9', unit: 'mg/dL' } }));
        let s = await sb.readSheet(sheet);
        await t.check(!s.start && /\bis a low\b|54 to 69/i.test(s.bannerText), `69.9 mg/dL is not a refused level 1 low: “${s.title}” ${s.bannerText}`);
        await t.advanceMinutes(15);
        await ui.tap(ui.button(sheet, (await ui.button(sheet, 'Enter a new reading').count()) ? 'Enter a new reading' : 'Change answers'));
        await ui.answerCheckIn(t, sheet, { glucose: { value: '95', unit: 'mg/dL' }, lowRecovered: false });
        s = await sb.readSheet(sheet);
        await t.checkpoint('95-not-recovered');
        await t.check(!s.start, `95 mg/dL with the recovery answer left false released movement: ${s.startLabels.join(',')}`);
        await t.check(/symptoms have gone|care plan/i.test(s.bannerText), `the hold does not ask for recovery and plan permission: ${s.bannerText}`);
        await ui.tap(ui.button(sheet, 'Change answers'));
        await ui.answerCheckIn(t, sheet, { lowRecovered: true });
        s = await sb.readSheet(sheet);
        await t.checkpoint('95-recovered');
        await t.check(s.start && sb.isAllowedTitle(s.title), `a valid re-check with recovery and plan permission is still refused: “${s.title}” ${s.bannerText}`);
        const { obs, checkIn } = await stored(t);
        await t.check(obs.length === 2 && !!obs.find(o => sameMeasurement(o, 69.9, 'mg/dL', '09:00')) && !!obs.find(o => sameMeasurement(o, 95, 'mg/dL', '09:15')),
          `readings: ${obs.map(sb.brief).join('; ')}`);
        await t.check(checkIn?.lowRecovered === true && (checkIn.glucoseEarlier ?? []).some(g => g.value === 69.9), `check-in: ${JSON.stringify({ lowRecovered: checkIn?.lowRecovered, earlier: checkIn?.glucoseEarlier })}`);
      }, { input: '69.9 mg/dL at 09:00; 95 mg/dL at 09:15, recovery false, then true' });
    },
  },

  {
    name: 'stored: a past needed-help low is a today review, not present inability to swallow',
    async run(t) {
      await t.open({ seed: persona('P03'), route: '/today' });
      await t.step(1, 'Historical news lowSevere with a normal fresh reading', async () => {
        const sheet = await sb.openSheet(t, 'walk');
        await ui.answerCheckIn(t, sheet, ui.normalAnswers('P03', { lows: 'Needed help' }));
        const s = await sb.readSheet(sheet);
        await t.checkpoint('low-severe-history');
        await t.check(s.title === sb.TITLE.today, `a low that needed help in the last 24 hours is not a today review: “${s.title}”`);
        await t.check(!s.start, 'a start is offered after a severe low in the last 24 hours');
        await t.check(!/can.t swallow|cannot be treated by mouth|give nothing to eat or drink|not safe to swallow/i.test(s.bannerText),
          `a past level 3 low is reported as present inability to swallow: ${s.bannerText}`);
        const { checkIn } = await stored(t);
        await t.check((checkIn?.news ?? []).includes('lowSevere') && !(checkIn?.emergency ?? []).includes('lowCantTreat'), `stored: ${JSON.stringify({ news: checkIn?.news, emergency: checkIn?.emergency })}`);
      }, { input: 'glucose 110 mg/dL; Lows in the last 24 hours: Needed help' });
    },
  },
];
