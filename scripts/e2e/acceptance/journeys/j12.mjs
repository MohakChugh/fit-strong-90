/**
 * J12, P04: missing/stale glucose, medicine certainty and regimen.
 * SAFETY 4 of 10 (codex-acceptance.md; D28, D29(5), D29(6), D30; H-DATA).
 *
 * Step 3's sub-minute boundary (exactly 08:30:00.000 against 08:29:59.999 at
 * NOW 09:00:00.000) uses the retained-reading fixture the spec allows: the
 * time picker exposes minutes only, so today's check-in is seeded with the
 * exact `measuredAt` and goes through the real migration.
 *
 * P04 is not in the programme, so its movement modes are Stretch and Walk
 * (D35: Guided is only a way to join). Direct-link checks use the stretch
 * player's own address.
 */
import { persona } from '../fixtures/personas.mjs';
import { docs } from '../lib/harness.mjs';
import * as ui from '../lib/ui.mjs';
import * as sb from '../lib/safety-b.mjs';

export const id = 'J12';
export const title = 'Missing/stale glucose, medicine certainty and regimen';
export const safety = true;

/** The modes P04 can start (D35). */
const MODES = ['stretch', 'walk'];
const STALE = /check your glucose within 30 minutes of starting/i;

const SU = 'Sulfonylurea or meglitinide? (e.g. gliclazide, glimepiride)';
const SGLT2 = 'An SGLT2 inhibitor, for diabetes, heart or kidney? (e.g. empagliflozin, dapagliflozin)';
const METFORMIN = 'Metformin?';
const DKA = 'Ever had diabetic ketoacidosis (DKA), or been told your body makes too little insulin?';

/** P04 with today's check-in already holding a reading taken at `measuredAt` (retained fixture). */
function withReading(measuredAt) {
  return persona('P04', {
    patch: {
      checkIns: [{
        date: sb.TODAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4,
        glucose: { value: 110, unit: 'mg/dL', measuredAt, source: 'meter' },
        readiness: sb.GREEN,
      }],
    },
  });
}

/** The fresh variant: type 2, untouched default medicine answers, never reviewed. */
function unreviewed() {
  return persona('P04', {
    patch: {
      profile: {
        needsHealthReview: true,
        health: { insulin: 'none', insulinRegimen: undefined, sulfonylureaOrMeglitinide: false, sglt2i: false, metformin: false, metforminSince: undefined, priorDkaOrInsulinDeficiency: false },
      },
    },
    remove: ['profile.health.medicinesReviewed'],
  });
}

async function refusedEverywhere(t, why, modes = MODES, { resubmit = true, title: want } = {}) {
  const answers = [];
  for (const mode of modes) {
    const a = await sb.modeAnswer(t, mode, 'move', { resubmit });
    answers.push(a);
    await t.check(!a.allowed && !a.start, `${why}: ${mode} was offered a start (${a.where} ${a.route}, “${a.title ?? ''}”)`);
    if (want) await t.check(a.title === undefined || want(a.title, mode), `${why}: ${mode} answered “${a.title}”`);
    await sb.backToTabs(t);
  }
  return answers;
}

/** You → Profile & health, as a person gets there. */
async function openProfile(t) {
  const page = t.page;
  await ui.tab(page, 'Today');
  await ui.tap(page.getByRole('link', { name: /^You:/ }));
  await page.getByRole('heading', { level: 1, name: 'You', exact: true }).waitFor();
  await ui.tap(ui.row(page.getByRole('main'), 'Profile & health', 'link'));
  await page.getByRole('heading', { level: 1, name: 'Profile & health', exact: true }).waitFor();
}

/** Edit the health answers (through the review row when the app asks for one) and save. */
async function editHealth(t, answers) {
  const page = t.page;
  await openProfile(t);
  const main = page.getByRole('main');
  const review = main.getByRole('button', { name: /^(Your health answers need a review|Medicines: not yet reviewed)/ });
  await ui.tap((await review.count()) ? review : ui.button(main, 'Edit health'));
  const dialog = page.getByRole('dialog', { name: 'Edit your answers' });
  await dialog.waitFor();
  for (const [group, choice] of answers) {
    await ui.tap(ui.radio(dialog.getByRole('radiogroup', { name: group, exact: true }), choice));
  }
  await t.checkpoint(`health-edit-${answers.map(a => a[1]).join('-').replace(/\W+/g, '-').slice(0, 40)}`);
  const save = ui.button(dialog, 'Save');
  await t.must(!(await save.isDisabled()), `Save stays disabled after answering ${answers.map(a => a.join(': ')).join('; ')}: ${(await dialog.innerText()).match(/Answer each[^\n]*/)?.[0] ?? ''}`);
  await ui.tap(save);
  await dialog.waitFor({ state: 'hidden' });
  await main.getByText(/^Saved\. Today uses your new answers\.$/).waitFor();
}

async function profileText(t) {
  return (await t.page.getByRole('main').innerText()).replace(/\s+/g, ' ');
}

/**
 * What the Guide says about diabetes for the current profile: the "Food &
 * diabetes" topic and every answer a search for "insulin" finds. The Guide has
 * no topic of its own for glucose monitoring (a search for "monitoring" finds
 * nothing), so this is where a regimen-specific explanation would have to be.
 */
async function guideDiabetes(t) {
  const page = t.page;
  const main = page.getByRole('main');
  const home = async () => {
    await sb.tabTo(page, 'Guide');
    // A search typed earlier is remembered; the topic list needs it cleared.
    const clear = main.getByRole('button', { name: 'Clear search', exact: true });
    if (await clear.count()) await ui.tap(clear);
  };
  await home();
  await ui.tap(ui.row(main, 'Food & diabetes', 'link'));
  await page.getByRole('heading', { level: 1, name: 'Food & diabetes', exact: true }).waitFor();
  await page.waitForTimeout(300);
  const topic = (await main.innerText()).replace(/\s+/g, ' ');
  await home();
  await page.getByRole('searchbox', { name: 'Search Guide' }).fill('insulin');
  await main.getByText(/^\d+ results?$/).waitFor();
  const results = (await main.innerText()).replace(/\s+/g, ' ');
  await ui.tap(main.getByRole('button', { name: 'Clear search', exact: true }));
  return `${topic} || ${results}`;
}

export const cases = [
  {
    name: 'steps 1, 2 and 4: no reading, a reading from 08:29, then one from now',
    async run(t) {
      await t.open({ seed: persona('P04'), route: '/today' });
      const page = t.page;

      await t.step(1, 'Each movement mode with known basal insulin and no glucose', async () => {
        const sheet = await sb.openSheet(t, 'stretch');
        await ui.answerCheckIn(t, sheet, ui.normalAnswers('P04', { glucose: null }));
        const s = await sb.readSheet(sheet);
        await t.checkpoint('no-reading');
        await t.check(s.title === sb.TITLE.recheck, `no reading with basal insulin: “${s.title}”, not “${sb.TITLE.recheck}”`);
        await t.check(!s.start, `a start is offered with no reading: ${s.startLabels.join(',')}`);
        await t.check(/What changes this/i.test(s.bannerText) && /glucose/i.test(s.bannerText), `no reason and release about the missing reading: ${s.bannerText}`);
        await t.check(!/recovery session|gentle|easy walk instead/i.test(s.text), `a runnable fallback is offered: ${s.text}`);
        await refusedEverywhere(t, 'no glucose reading', ['walk'], { title: (x) => x === sb.TITLE.recheck });
        const snap = await t.db();
        await t.check(sb.glucoseObs(snap).length === 0, `a glucose observation exists with no reading: ${sb.glucoseObs(snap).map(sb.brief)}`);
      }, { input: 'P04, normal answers, glucose left blank' });

      await t.step(2, 'Enter 110 measured 08:29 at NOW 09:00', async () => {
        const sheet = await sb.openSheet(t, 'walk');
        await ui.answerCheckIn(t, sheet, { glucose: { value: '110', unit: 'mg/dL', time: '08:29' } });
        const s = await sb.readSheet(sheet);
        await t.checkpoint('stale-0829');
        await t.check(s.title === sb.TITLE.recheck && !s.start, `a 31-minute-old reading with insulin is not held: “${s.title}” ${s.startLabels.join(',')}`);
        await t.check(STALE.test(s.bannerText), `no “check your glucose within 30 minutes of starting”: ${s.bannerText}`);
        await t.check(/31 minutes/.test(s.bannerText), `the reading’s age (31 minutes) is not stated: ${s.bannerText}`);
        let snap = await t.db();
        const obs = sb.glucoseObs(snap);
        await t.check(obs.length === 1 && obs[0].value === 110 && obs[0].at.startsWith(`${sb.TODAY}T08:29`), `stored reading: ${obs.map(sb.brief).join('; ')}`);
        await t.check(sb.kolkata(sb.checkInOn(snap)?.glucose?.measuredAt) === '08:29:00' && sb.checkInOn(snap)?.glucose?.source === 'meter',
          `check-in reading time/source: ${JSON.stringify(sb.checkInOn(snap)?.glucose)}`);
        // Reopening is not a new reading: the old one is not stamped fresh again.
        await sb.closeSheet(t);
        const reopened = await sb.modeAnswer(t, 'walk', 'move', { resubmit: false });
        await t.check(!reopened.start, `reopening the check-in released movement on the old reading (${reopened.where} “${reopened.title}”)`);
        await t.check(/Last reading: 110 mg\/dL at (?:08:29|8:29\s?am)\b/i.test(reopened.text) || STALE.test(reopened.text), `reopening does not say the last reading is too old: ${reopened.text.slice(0, 300)}`);
        await t.checkpoint('reopened');
        await sb.closeSheet(t);
        // The stretch player's own address gives the same answer.
        const gate = await sb.modeAnswer(t, 'stretch', 'link', { resubmit: false });
        await t.check(!gate.allowed && STALE.test(`${gate.bannerText} ${gate.text}`), `the stretch player link does not hold the 08:29 reading as stale: ${gate.where} “${gate.title}” ${gate.text?.slice(0, 200)}`);
        await sb.backToTabs(t);
        await t.reload();
        await refusedEverywhere(t, 'the 08:29 reading after a reload', ['stretch'], { resubmit: false });
        // Submitting the reopened answers again does not turn the old number into a new reading.
        const again = await sb.modeAnswer(t, 'walk', 'move', { resubmit: true });
        await t.check(!again.start, `resubmitting the reopened answers released movement: “${again.title}”`);
        await sb.closeSheet(t);
        snap = await t.db();
        await t.check(sb.glucoseObs(snap).filter(o => o.at.startsWith(`${sb.TODAY}T09:00`)).length === 0, `reopening or reloading stamped the old value as a new reading: ${sb.glucoseObs(snap).map(sb.brief).join('; ')}`);
      }, { input: '110 mg/dL, time measured 08:29' });

      await t.step(4, 'Enter a new 110 measured now', async () => {
        const sheet = await sb.openSheet(t, 'walk');
        await ui.answerCheckIn(t, sheet, { glucose: { value: '110', unit: 'mg/dL' } });
        const s = await sb.readSheet(sheet);
        await t.checkpoint('fresh-0900');
        await t.check(s.start && sb.isAllowedTitle(s.title), `a fresh 110 does not clear the freshness hold: “${s.title}” ${s.bannerText}`);
        const snap = await t.db();
        const obs = sb.glucoseObs(snap);
        await t.check(obs.some(o => o.value === 110 && o.at.startsWith(`${sb.TODAY}T08:29`)) && obs.some(o => o.value === 110 && o.at.startsWith(`${sb.TODAY}T09:00`)),
          `the 08:29 reading is not kept beside the new one: ${obs.map(sb.brief).join('; ')}`);
        const c = sb.checkInOn(snap);
        await t.check(sb.kolkata(c?.glucose?.measuredAt) === '09:00:00' && (c?.glucoseEarlier ?? []).some(g => sb.kolkata(g.measuredAt) === '08:29:00'),
          `check-in current and earlier readings: ${JSON.stringify({ glucose: c?.glucose, earlier: c?.glucoseEarlier })}`);
      }, { input: '110 mg/dL, measured now (09:00)' });
    },
  },

  {
    name: 'step 3: exactly thirty minutes (retained reading 08:30:00.000)',
    async run(t) {
      await t.open({ seed: withReading('2026-10-08T08:30:00.000+05:30'), route: '/today' });
      await t.step(3, 'A reading exactly 30 minutes old satisfies freshness; other restrictions still apply', async () => {
        t.note('retained reading fixture: today’s check-in seeded with glucose 110 mg/dL measuredAt 08:30:00.000 (the time picker has minutes only); clock frozen at 09:00:00.000');
        await t.goto('/today?checkin=walk');
        const sheet = t.page.getByRole('dialog', { name: ui.CHECKIN });
        await sheet.waitFor();
        const s = await sb.readSheet(sheet);
        await t.checkpoint('exactly-30');
        await t.check(s.start && sb.isAllowedTitle(s.title), `exactly 30 minutes is treated as stale: “${s.title}” ${s.bannerText}`);
        await t.check(!STALE.test(s.bannerText), `exactly 30 minutes shows the stale message: ${s.bannerText}`);
        await t.check(/carbohydrate/i.test(s.bannerText), `the insulin restrictions are missing from the allowed answer: ${s.bannerText}`);
        await sb.closeSheet(t);
        for (const mode of MODES) {
          const a = await sb.modeAnswer(t, mode);
          await t.check(a.allowed, `exactly 30 minutes refuses ${mode}: “${a.title}” ${a.bannerText ?? ''}`);
          await sb.backToTabs(t);
        }
      }, { input: 'retained check-in: 110 mg/dL measured 08:30:00.000; NOW 09:00:00.000' });
    },
  },

  {
    name: 'step 3: thirty minutes and 1 ms (retained reading 08:29:59.999)',
    async run(t) {
      await t.open({ seed: withReading('2026-10-08T08:29:59.999+05:30'), route: '/today' });
      await t.step(3, '30 minutes plus 1 ms does not satisfy freshness', async () => {
        t.note('retained reading fixture: glucose 110 mg/dL measuredAt 08:29:59.999; clock frozen at 09:00:00.000');
        await t.goto(sb.LINK.stretch);
        const main = t.page.getByRole('main');
        const banner = main.locator('section[role="alert"], section[role="status"]').filter({ has: t.page.locator('h2') });
        const title = (await banner.count()) ? (await banner.locator('h2').first().innerText()).trim() : undefined;
        const text = (await main.innerText()).replace(/\s+/g, ' ');
        await t.checkpoint('session-gate-1ms');
        await t.check(title === sb.TITLE.recheck, `the stretch player link opens on a reading 30 min 1 ms old: “${title ?? '(no gate)'}”`);
        await t.check(STALE.test(text), `no “check your glucose within 30 minutes of starting” on the gate: ${text.slice(0, 300)}`);
        await t.check(await main.getByRole('button', { name: /^(Start|Resume)$/ }).count() === 0, 'the player offers Start on a stale reading');
        await t.goto('/today');
        await refusedEverywhere(t, '30 min 1 ms', MODES, { resubmit: false });
      }, { input: 'retained check-in: 110 mg/dL measured 08:29:59.999; NOW 09:00:00.000' });
    },
  },

  {
    name: 'steps 5-8: unreviewed medicines, Not sure, metformin-only, then the insulin regimen',
    async run(t) {
      await t.open({ seed: unreviewed(), route: '/today' });
      const page = t.page;

      await t.step(5, 'Unreviewed profile: data hold in every mode even with glucose 110', async () => {
        const sheet = await sb.openSheet(t, 'stretch');
        await ui.answerCheckIn(t, sheet, ui.normalAnswers('P04'));
        const s = await sb.readSheet(sheet);
        await t.checkpoint('unreviewed-hold');
        await t.check(!s.start && sb.isRefusalTitle(s.title, 'stretch'), `an unreviewed profile with glucose 110 is allowed: “${s.title}”`);
        await t.check(/health questions|medicines|profile/i.test(s.bannerText), `the hold does not name the profile/medicine review: ${s.bannerText}`);
        await refusedEverywhere(t, 'unreviewed medicines', ['walk']);
        // Learn and past logging stay open.
        await sb.tabTo(page, 'Guide');
        await page.getByRole('main').getByRole('link', { name: /^Food & diabetes/ }).waitFor();
        await t.check((await page.getByRole('main').innerText()).length > 200, 'Guide is not readable during the data hold');
        await ui.tab(page, 'Track');
        await ui.tap(ui.header(page).getByRole('button', { name: 'Add a record', exact: true }));
        const add = page.getByRole('dialog', { name: 'Add' });
        await ui.tap(ui.row(add, 'Weight'));
        const weight = page.getByRole('dialog', { name: 'Weight' });
        await ui.type(weight.getByRole('textbox', { name: 'Weight', exact: true }), '78');
        await ui.tap(ui.row(weight, 'Time'));
        await ui.setDateTime(weight.getByLabel(/^Time/), '2026-10-07T20:00');
        await ui.tap(ui.button(weight, 'Save'));
        await weight.waitFor({ state: 'hidden' });
        const snap = await t.checkpoint('past-weight-logged');
        await t.check((snap.observations ?? []).some(o => o.kind === 'weight' && o.value === 78 && o.at.startsWith('2026-10-07T20:00') && o.source === 'manual'),
          `a past weight could not be logged during the hold: ${(snap.observations ?? []).filter(o => o.kind === 'weight').map(sb.brief)}`);
      }, { input: 'needsHealthReview, medicinesReviewed absent; glucose 110 mg/dL now; weight 78 kg for 7 October 20:00' });

      await t.step(6, 'Review medicines: Not sure for insulin; save and reload', async () => {
        await editHealth(t, [['Insulin', 'Not sure'], [SU, 'No'], [SGLT2, 'No'], [METFORMIN, 'No'], [DKA, 'No']]);
        await t.reload();
        await openProfile(t);
        const text = await profileText(t);
        await t.checkpoint('profile-not-sure');
        await t.check(/Insulin Not sure/.test(text), `the profile does not show Insulin “Not sure”: ${text.slice(0, 400)}`);
        const snap = await t.db();
        const h = docs(snap).profile?.health ?? {};
        await t.check(h.insulin === 'unsure', `insulin stored as ${JSON.stringify(h.insulin)}, not 'unsure'`);
        await t.check(h.medicinesReviewed === true && docs(snap).profile?.needsHealthReview !== true, `review state: ${JSON.stringify({ reviewed: h.medicinesReviewed, needs: docs(snap).profile?.needsHealthReview })}`);
        // Risk-dependent clearance: with insulin not known to be absent, a reading that is no longer fresh cannot clear anyone.
        const freshNow = await sb.modeAnswer(t, 'walk', 'move', { resubmit: false });
        t.note(`with insulin Not sure and the 09:00 reading still fresh, walk answers: ${freshNow.where} “${freshNow.title ?? ''}” allowed=${freshNow.allowed}`);
        await sb.backToTabs(t);
        await t.advanceMinutes(31);
        await refusedEverywhere(t, 'insulin Not sure and the reading 31 minutes old', MODES, { resubmit: false });
      }, { input: 'Insulin: Not sure; SU No; SGLT2 No; metformin No; DKA No; then 31 minutes later' });

      await t.step(7, 'Confirm metformin only and leave glucose absent', async () => {
        await editHealth(t, [['Insulin', 'No insulin'], [SU, 'No'], [SGLT2, 'No'], [METFORMIN, 'Yes'], [DKA, 'No']]);
        await t.goto('/today?checkin=walk');
        const sheet = page.getByRole('dialog', { name: ui.CHECKIN });
        await sheet.waitFor();
        let s = await sb.readSheet(sheet);
        if (!s.form) await ui.tap(ui.button(sheet, 'Change answers'));
        await ui.answerCheckIn(t, sheet, { glucose: { value: '' } });
        s = await sb.readSheet(sheet);
        await t.checkpoint('metformin-no-reading');
        await t.check(s.start && sb.isAllowedTitle(s.title), `metformin-only with no reading is held: “${s.title}” ${s.bannerText}`);
        await t.check(!/check your glucose|No glucose reading/i.test(s.bannerText), `a glucose reading is demanded of metformin-only: ${s.bannerText}`);
        const snap = await t.db();
        const h = docs(snap).profile?.health ?? {};
        await t.check(h.insulin === 'none' && h.sulfonylureaOrMeglitinide === false && h.sglt2i === false && h.metformin === true && h.priorDkaOrInsulinDeficiency === false && h.medicinesReviewed === true,
          `stored medicine answers: ${JSON.stringify({ insulin: h.insulin, su: h.sulfonylureaOrMeglitinide, sglt2i: h.sglt2i, metformin: h.metformin, dka: h.priorDkaOrInsulinDeficiency, reviewed: h.medicinesReviewed })}`);
        const guessed = Object.keys(h).filter(k => /dose|drug|brand|medicationName|medicineName/i.test(k));
        await t.check(!guessed.length, `medicine names or doses were stored: ${guessed.join(', ')}`);
        const c = sb.checkInOn(snap);
        await t.check(!c?.glucose, `the check-in still carries a current glucose: ${JSON.stringify(c?.glucose)}`);
        await sb.closeSheet(t);
        await ui.tab(page, 'Today');
        const today = (await page.getByRole('main').innerText()).replace(/\s+/g, ' ');
        await t.check(!/check (your )?glucose (every day|daily|each morning)|daily glucose|fasting check every/i.test(today), `Today sets a daily glucose task for metformin-only: ${today.slice(0, 300)}`);
        await t.checkpoint('today-metformin-only');
      }, { input: 'Insulin No; SU No; SGLT2 No; metformin Yes; DKA No; glucose cleared' });

      await t.step(8, 'Return to basal, then several injections a day; reload Profile & health and Guide', async () => {
        await editHealth(t, [['Insulin', 'Long-acting only']]);
        let snap = await t.db();
        await t.check(docs(snap).profile?.health?.insulinRegimen === 'basalOnly' && docs(snap).profile.health.insulin === 'injections_or_pump',
          `regimen after choosing long-acting only: ${JSON.stringify({ insulin: docs(snap).profile?.health?.insulin, regimen: docs(snap).profile?.health?.insulinRegimen })}`);
        const basalGuide = await guideDiabetes(t);
        await t.checkpoint('guide-basal');
        await editHealth(t, [['Insulin', 'Several injections a day']]);
        await t.reload();
        await openProfile(t);
        const text = await profileText(t);
        await t.checkpoint('profile-multiple-daily');
        await t.check(/Insulin Injections or pump, several (injections|times) a day/i.test(text), `Profile & health does not show the new regimen: ${text.match(/Insulin [^]*?(?=Sulfonylurea)/)?.[0] ?? text.slice(0, 300)}`);
        snap = await t.db();
        await t.check(docs(snap).profile?.health?.insulinRegimen === 'multipleDaily', `stored regimen ${docs(snap).profile?.health?.insulinRegimen}, not multipleDaily`);
        const multiGuide = await guideDiabetes(t);
        await t.checkpoint('guide-multiple-daily');
        const cadence = /before (meals|you eat)|bedtime|before (activity|exercise)|several (times|checks)|check(s|ing)? (more often|before)/i;
        await t.check(multiGuide !== basalGuide && cadence.test(multiGuide),
          `the monitoring explanation does not change for several injections a day (Guide “Food & diabetes” ${multiGuide === basalGuide ? 'is identical for both regimens' : 'has no before-meals/bedtime/activity checks'})`);
        await t.check(/care team|clinician/i.test(basalGuide), 'the basal-only explanation does not defer to the care-team plan');
        for (const [label, g] of [['basal', basalGuide], ['several injections', multiGuide]]) {
          await t.check(!sb.MEDICINE_CHANGE.test(g), `the ${label} Guide text gives a dose or titration: ${g.match(sb.MEDICINE_CHANGE)?.[0]}`);
          await t.check(!/\b(\d+|one|two|three|four|six|ten)\s*(to\s*\d+\s*)?(times|checks|tests) (a|per|each) day\b/i.test(g), `the ${label} Guide text sets a universal testing count: ${g.match(/\b(\d+|one|two|three|four|six|ten)\s*(to\s*\d+\s*)?(times|checks|tests) (a|per|each) day\b/i)?.[0]}`);
        }
      }, { input: 'Insulin: Long-acting only, then Several injections a day' });
    },
  },

  {
    name: 'H-DATA: the meter shows HI',
    async run(t) {
      await t.open({ seed: persona('P04'), route: '/today' });
      await t.step(1, 'HI is kept as a display result with no invented number', async () => {
        const sheet = await sb.openSheet(t, 'stretch');
        await ui.answerCheckIn(t, sheet, ui.normalAnswers('P04', { glucose: { display: 'HI' } }));
        const s = await sb.readSheet(sheet);
        await t.checkpoint('meter-hi');
        await t.check(!s.start && sb.isRefusalTitle(s.title, 'stretch'), `HI is allowed: “${s.title}”`);
        await t.check(/\bHI\b/.test(s.bannerText), `the answer does not refer to the HI display: ${s.bannerText}`);
        const snap = await t.db();
        const c = sb.checkInOn(snap);
        await t.check(c?.glucoseDisplay?.display === 'HI' && !c.glucose, `stored check-in: ${JSON.stringify({ glucose: c?.glucose, display: c?.glucoseDisplay })}`);
        await t.check(sb.glucoseObs(snap).length === 0, `a numeric glucose observation was invented for HI: ${sb.glucoseObs(snap).map(sb.brief)}`);
      }, { input: 'meter shows HI' });
    },
  },

  {
    name: 'H-DATA: the meter shows LO',
    async run(t) {
      await t.open({ seed: persona('P04'), route: '/today' });
      await t.step(1, 'LO is kept as a display result with no invented number', async () => {
        const sheet = await sb.openSheet(t, 'walk');
        await ui.answerCheckIn(t, sheet, ui.normalAnswers('P04', { glucose: { display: 'LO' } }));
        const s = await sb.readSheet(sheet);
        await t.checkpoint('meter-lo');
        await t.check(!s.start && (s.title === sb.TITLE.today || s.title === sb.TITLE.emergency), `LO is not treated as a severe low: “${s.title}”`);
        await t.check(!/\b\d+(\.\d+)?\s?mg\/dL\b(?! or above)/.test(s.bannerText.replace(/(under|below|from) \d+[^.]*mg\/dL/gi, '')), `a number is given for the LO reading: ${s.bannerText}`);
        const snap = await t.db();
        const c = sb.checkInOn(snap);
        await t.check(c?.glucoseDisplay?.display === 'LO' && !c.glucose, `stored check-in: ${JSON.stringify({ glucose: c?.glucose, display: c?.glucoseDisplay })}`);
        await t.check(sb.glucoseObs(snap).length === 0, `a numeric glucose observation was invented for LO: ${sb.glucoseObs(snap).map(sb.brief)}`);
      }, { input: 'meter shows LO' });
    },
  },

  {
    name: 'H-DATA: a reading in the wrong or an unusable unit must be corrected',
    async run(t) {
      await t.open({ seed: persona('P04'), route: '/today' });
      await t.step(1, 'A wrong unit or an unusable number cannot be submitted until corrected', async () => {
        const sheet = await sb.openSheet(t, 'stretch');
        await ui.answerCheckIn(t, sheet, ui.normalAnswers('P04', { glucose: { value: '110', unit: 'mmol/L' }, submit: false }));
        let s = await sb.readSheet(sheet);
        await t.checkpoint('suspect-unit');
        await t.check(/looks like mg\/dL/i.test(s.text), `110 mmol/L is not questioned: ${s.text.slice(0, 300)}`);
        await t.check(s.submitDisabled === true, 'a 110 mmol/L reading can be submitted without confirming the unit');
        const g = ui.section(sheet, 'Glucose');
        await ui.type(g.getByRole('textbox', { name: 'Glucose reading', exact: true }), '0');
        s = await sb.readSheet(sheet);
        await t.check(/can.t be used/i.test(s.text) && s.submitDisabled === true, `a reading of 0 is accepted: ${s.text.slice(0, 200)}`);
        await ui.type(g.getByRole('textbox', { name: 'Glucose reading', exact: true }), '110');
        await ui.tap(sheet.getByRole('button', { name: '110 mg/dL', exact: true }));
        await ui.tap(ui.button(sheet, ui.SUBMIT));
        s = await sb.readSheet(sheet);
        await t.checkpoint('unit-corrected');
        await t.check(s.start, `after correcting the unit the fresh 110 mg/dL is refused: “${s.title}” ${s.bannerText}`);
        const obs = sb.glucoseObs(await t.db());
        await t.check(obs.length === 1 && obs[0].value === 110 && obs[0].unit === 'mg/dL', `stored readings: ${obs.map(sb.brief).join('; ')}`);
      }, { input: '110 in mmol/L, then 0, then 110 confirmed as mg/dL' });
    },
  },

  {
    name: 'H-DATA: a normal sensor reading with shaky or sweaty symptoms',
    async run(t) {
      await t.open({ seed: persona('P04', { patch: { profile: { health: { glucoseMonitor: 'cgm' } } } }), route: '/today' });
      await t.step(1, 'Sensor 110 plus low symptoms needs meter confirmation', async () => {
        const sheet = await sb.openSheet(t, 'walk');
        await ui.answerCheckIn(t, sheet, ui.normalAnswers('P04', { news: [ui.NEWS.lowSymptoms] }));
        const s = await sb.readSheet(sheet);
        await t.checkpoint('sensor-low-symptoms');
        await t.check(!s.start && sb.isRefusalTitle(s.title, 'walk'), `sensor 110 with low symptoms is allowed: “${s.title}”`);
        await t.check(/meter|fingerstick|finger-prick/i.test(s.bannerText), `no meter confirmation asked for: ${s.bannerText}`);
        const c = sb.checkInOn(await t.db());
        await t.check(c?.glucose?.source === 'sensor' && (c.news ?? []).includes('lowSymptoms'), `stored: ${JSON.stringify({ glucose: c?.glucose, news: c?.news })}`);
      }, { input: 'CGM 110 mg/dL now; Shaky, sweaty or feeling a low coming on' });
    },
  },

  {
    name: 'H-DATA: a reading timed an hour ahead',
    async run(t) {
      await t.open({ seed: persona('P04'), route: '/today' });
      await t.step(1, 'A future timestamp is not a valid fresh check', async () => {
        const sheet = await sb.openSheet(t, 'stretch');
        await ui.answerCheckIn(t, sheet, ui.normalAnswers('P04', { glucose: { value: '110', unit: 'mg/dL', time: '10:00' }, submit: false }));
        let s = await sb.readSheet(sheet);
        await t.checkpoint('future-reading');
        if (s.submitDisabled) {
          await t.check(/later than now/i.test(s.blocked ?? s.text), `the future time is refused without saying why: ${s.blocked}`);
        } else {
          await ui.tap(ui.button(sheet, ui.SUBMIT));
          s = await sb.readSheet(sheet);
          await t.check(!s.start, `a reading timed 10:00 at 09:00 counts as fresh: “${s.title}”`);
        }
        const obs = sb.glucoseObs(await t.db());
        await t.check(!obs.some(o => o.at.startsWith(`${sb.TODAY}T10:00`)), `a reading timed in the future was stored: ${obs.map(sb.brief).join('; ')}`);
      }, { input: '110 mg/dL, time measured 10:00 at NOW 09:00' });
    },
  },
];
