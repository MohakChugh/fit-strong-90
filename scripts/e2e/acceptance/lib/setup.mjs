/**
 * Setup, and Me's chapter editor, answered by their visible questions
 * (journey §6.2, §16; Plan 5). A journey says what the person answers, in
 * the words on screen; these find each control by its question and answer
 * it. Both places draw the same page views, so one map serves both.
 */
import * as ui from './ui.mjs';

export const REVIEW = 'Here’s what we’ll do for you';
export const ACKNOWLEDGEMENT = 'I understand this is general information, not medical advice. I will stop and get help for chest pain, faintness or severe breathlessness, and follow my care team’s medication plan.';

/** P07's answers (codex-acceptance J01): nothing to report, nothing turned on. */
export const P07 = {
  figure: 'Either', conditions: 'none', regular: 'No', glucoseMonitor: 'Neither', bpCuff: 'No',
  focus: 'Not sure yet', active: 'No, not like that', goal: 'No goal for now', programme: 'Not now',
  pattern: 'Vegetarian', allergies: 'none', level: 'No, meal ideas only',
};
/** P02 (V-J37): the same, leading with stretching. */
export const P02 = { ...P07, focus: 'Stretch more' };
/** "Not sure" wherever it's offered, after Diabetes "Not sure" and High blood pressure (V-J17). */
export const UNSURE = {
  ...P07,
  diabetesType: 'Not sure', bpMedicine: 'Not sure', clearance: 'Not sure', targets: 'Not sure',
  regular: 'Not sure', classes: 'unsure', insulinHow: 'Not sure', lowsRisk: 'Not sure', priorDka: 'Not sure', ketoneTest: 'No', dizzy: 'Not sure',
};

/**
 * A control by its label. A row with a detail line is named by both
 * ("Not sure yet Look around before you choose."), so when the exact name
 * finds nothing, the row holding the label's own text is taken.
 */
async function labelled(scope, role, label) {
  const byName = scope.getByRole(role, { name: label, exact: true });
  return (await byName.count()) ? byName : ui.row(scope, label, role);
}

/** A radio row in the group named by its question; nothing when no answer is given. */
export async function choose(scope, question, option) {
  if (option === undefined) return;
  await ui.tap(await labelled(scope.getByRole('radiogroup', { name: question, exact: true }), 'radio', option));
}

/** A checkbox by its name, ticked or not as asked: tapped only when it isn't already. */
export async function tick(scope, name, on = true) {
  const box = await labelled(scope, 'checkbox', name);
  if ((await box.getAttribute('aria-checked') === 'true') !== on) await ui.tap(box);
}

/** A field by its label, typed a key at a time, as a phone keyboard does. */
export async function fill(scope, label, text) {
  await ui.type(scope.getByLabel(label, { exact: true }), String(text));
}

const ticks = async (s, list, prefix) => {
  for (const [label, v] of Object.entries(list ?? {})) await tick(s, v === 'unsure' ? `${prefix}${label}` : label, v !== 'no');
};

/** Each page, by its heading, answered from `a`. A key left out leaves its question as it is. */
const PAGES = {
  'What should we call you?': async (s, a) => {
    if (a.name !== undefined) await fill(s, 'Name (optional)', a.name);
    if (a.year !== undefined) await fill(s, 'Year you were born (optional)', a.year);
    await choose(s, 'Are you 18 or over?', a.adult);
  },
  'Body for the exercise demos': (s, a) => choose(s, 'Body for the exercise demos', a.figure),
  'Your height and weight': async (s, a) => {
    await choose(s, 'Units', a.units);
    if (a.heightCm !== undefined) await fill(s, 'Height in cm', a.heightCm);
    if (a.weightKg !== undefined) await fill(s, 'Weight in kg', a.weightKg);
  },
  'Do you have any of these?': (s, a) => (a.conditions === 'none' ? tick(s, 'None of these') : ticks(s, a.conditions, 'Not sure: ')),
  'Which type of diabetes?': (s, a) => choose(s, 'Which type of diabetes?', a.diabetesType),
  'High blood pressure': (s, a) => choose(s, 'Do you take medicine for high blood pressure?', a.bpMedicine),
  'Heart, kidneys and fluids': async (s, a) => {
    await choose(s, 'Are you on dialysis, or have you had a kidney transplant?', a.kidneyTreatment);
    await choose(s, 'Has a doctor given you a fluid limit?', a.fluidLimit);
  },
  'Your eyes': async (s, a) => {
    await choose(s, 'Eye treatment or surgery in the last 3 months?', a.eyeTreatment);
    await choose(s, 'How bad is the eye disease from diabetes?', a.eyeDisease);
  },
  'Your feet': async (s, a) => {
    await choose(s, 'Numbness or loss of feeling in your feet?', a.feetNumb);
    await choose(s, 'A wound, an ulcer or a Charcot foot?', a.footWound);
  },
  'Exercise limits from a clinician': async (s, a) => {
    await choose(s, 'Has a clinician cleared you to exercise?', a.clearance);
    await choose(s, 'Has a clinician given you any limits or targets?', a.targets);
  },
  'Your medicines': (s, a) => choose(s, 'Do you take any regular medicines?', a.regular),
  'Do any of these apply?': async (s, a) => {
    if (a.classes === 'unsure') await tick(s, 'Not sure about any of these');
    else await ticks(s, a.classes, 'Not sure: ');
    if (a.metforminSince !== undefined) await fill(s, 'Year you started metformin (optional)', a.metforminSince);
  },
  'Insulin and lows': async (s, a) => {
    await choose(s, 'How do you take insulin?', a.insulinHow);
    await choose(s, 'A severe low in the last 6 months, or do you often not feel lows coming?', a.lowsRisk);
  },
  Ketones: async (s, a) => {
    await choose(s, 'Ever had diabetic ketoacidosis (DKA), or been told your body makes too little insulin?', a.priorDka);
    await choose(s, 'Can you test ketones?', a.ketoneTest);
  },
  'Standing up': (s, a) => choose(s, 'Do you get dizzy when you stand up?', a.dizzy),
  'What do you have at home?': async (s, a) => {
    await choose(s, 'Glucose meter or sensor', a.glucoseMonitor);
    await choose(s, 'Glucose unit', a.glucoseUnit);
    await choose(s, 'Home blood-pressure cuff', a.bpCuff);
  },
  'Where does it hurt?': async (s, a) => {
    if (a.areas === 'none') await tick(s, 'None of these right now');
    else for (const area of a.areas ?? []) await tick(s, area);
  },
  'Your back and leg': async (s, a) => {
    await choose(s, 'Which leg?', a.leg);
    await choose(s, 'What makes it worse?', a.worse);
  },
  'Nerves and feet': async (s, a) => {
    await choose(s, 'Has a doctor ever said a nerve in your back or leg was damaged?', a.neuro);
    await choose(s, 'Has a clinician told you to keep weight off a foot?', a.footRestriction);
  },
  'What would you most like to do?': async (s, a) => {
    await choose(s, 'What would you most like to do?', a.focus);
    await choose(s, 'Do you exercise now?', a.active);
  },
  'Your weekly goal': (s, a) => choose(s, 'Your weekly goal', a.goal),
  'Join the 12-week strength programme?': (s, a) => choose(s, 'Join the 12-week strength programme?', a.programme),
  'How do you eat?': (s, a) => choose(s, 'How do you eat?', a.pattern),
  // A page of its own, never skipped (K5-08).
  'Any food allergies?': async (s, a) => {
    if (a.allergies === 'none') await tick(s, 'No food allergies');
    else for (const x of a.allergies ?? []) await tick(s, x);
  },
  'Would you like to log what you eat?': async (s, a) => {
    await choose(s, 'Would you like to log what you eat?', a.level);
    await choose(s, 'Has food or weight ever been hard for you?', a.screen);
  },
  // Your day, a page at a time (K5-12): the journeys leave each reminder as it is.
  'Water reminders': async () => {},
  'Sitting breaks': async () => {},
  'After-meal walks': async () => {},
  'Quiet hours': async () => {},
  'When do you usually finish your meals?': async () => {},
  'Your voice coach': (s, a) => choose(s, 'Voice coach', a.voice),
};

/** Answer the page shown in `scope`, found by its heading. */
export async function answerPage(scope, heading, a) {
  const answer = PAGES[heading];
  if (!answer) throw new Error(`a setup page this helper doesn't know: “${heading}”`);
  await answer(scope, a);
}

const h1 = async page => (await page.getByRole('main').getByRole('heading', { level: 1 }).innerText()).trim();

/**
 * Answer setup a page at a time, from wherever it is, until `until` (Review
 * by default), with "Skip for now" on the pages `a.skip` names. `onPage`
 * looks at each page, `until` included, before it's answered. Returns the
 * headings seen. A page that won't move on is a failure that names it.
 */
export async function throughSetup(t, a, { until = REVIEW, checkpoint = false, onPage } = {}) {
  const page = t.page;
  const main = page.getByRole('main');
  const seen = [];
  for (let i = 0; i < 32; i++) {
    const heading = await h1(page);
    seen.push(heading);
    if (onPage) await onPage(heading);
    if (heading === until) return seen;
    if (checkpoint) await t.checkpoint(`setup-${heading.replace(/\W+/g, '-').toLowerCase()}`);
    if (heading === 'Welcome') {
      await ui.tap(ui.button(main, 'Get started'));
    } else if ((a.skip ?? []).includes(heading)) {
      await ui.tap(ui.button(main, 'Skip for now'));
    } else {
      await answerPage(main, heading, a);
      await ui.tap(ui.button(main, 'Next'));
    }
    await page.waitForFunction(was => document.querySelector('main h1')?.textContent?.trim() !== was, heading, { timeout: 10000 })
      .catch(() => { throw new Error(`setup stayed on “${heading}” after its answers (${seen.join(' → ')})`); });
  }
  throw new Error(`setup did not reach “${until}”: ${seen.join(' → ')}`);
}

/** Review: tick the acknowledgement, then Start using FitStrong; returns once Home is up. */
export async function startUsing(t) {
  const main = t.page.getByRole('main');
  await tick(main, ACKNOWLEDGEMENT);
  await ui.tap(ui.button(main, 'Start using FitStrong'));
  await t.page.getByRole('heading', { level: 1, name: ui.HOME_TITLE }).waitFor({ timeout: 15000 });
  await t.ready();
}

/** Me → Profile & health → Edit {title}, as a person gets there. Returns the main landmark. */
export async function openChapter(t, title) {
  const page = t.page;
  await ui.tab(page, 'Me');
  await ui.heading(page, 'Me');
  const main = page.getByRole('main');
  await ui.tap(ui.row(main, 'Profile & health', 'link'));
  await ui.heading(page, 'Profile & health');
  await ui.tap(ui.link(main, `Edit ${title}`));
  await ui.heading(page, title);
  return main;
}

/** The chapter editor's Save; waits for its confirmation unless the save is meant to fail. */
export async function save(t, { expectSaved = true } = {}) {
  const main = t.page.getByRole('main');
  await ui.tap(ui.button(main, 'Save'));
  if (expectSaved) await main.getByText('Saved. Home uses your new answers.', { exact: true }).waitFor({ timeout: 15000 });
}

/**
 * P01's review (codex-acceptance J02 step 3), in the review editor. A pending
 * review asks every safety question again, with nothing the record holds shown
 * as an answer (H5-10, K5-01), so each is answered as P01 would: type 2
 * diabetes, treated high blood pressure, and back pain with sciatica on the
 * left; metformin since 2019 and nothing else; no prior DKA.
 */
export async function reviewAsP01(main) {
  await tick(main, 'Diabetes');
  await tick(main, 'High blood pressure');
  await tick(main, 'Back pain, sciatica or other pain');
  await choose(main, 'Which type of diabetes?', 'Type 2');
  await choose(main, 'Do you take medicine for high blood pressure?', 'Yes');
  await choose(main, 'Has a clinician cleared you to exercise?', 'Yes, for vigorous exercise');
  await choose(main, 'Has a clinician given you any limits or targets?', 'No');
  await choose(main, 'Do you take any regular medicines?', 'Yes');
  await tick(main, 'Metformin');
  await fill(main, 'Year you started metformin (optional)', '2019');
  await choose(main, 'Ever had diabetic ketoacidosis (DKA), or been told your body makes too little insulin?', 'No');
  await choose(main, 'Do you get dizzy when you stand up?', 'No');
  await choose(main, 'Glucose meter or sensor', 'A glucose meter (finger-prick)');
  await choose(main, 'Glucose unit', 'mg/dL');
  await choose(main, 'Home blood-pressure cuff', 'Yes');
  await tick(main, 'Lower back');
  await tick(main, 'Sciatica (pain down the leg)');
  await choose(main, 'Which leg?', 'Left leg');
  await choose(main, 'What makes it worse?', 'Sitting or bending forward');
  await choose(main, 'Has a doctor ever said a nerve in your back or leg was damaged?', 'No');
  // The review asks this too (H5-11): its default "Yes" was never an answer.
  await choose(main, 'Do you exercise now?', 'Yes');
}
