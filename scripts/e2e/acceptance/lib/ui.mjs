/**
 * Locators by accessible name and the check-in answers every journey gives.
 *
 * Locators are strict: an ambiguous one throws, which is a test failure, and
 * nothing here takes "the first match" to hide that (spec "Execution").
 * Repeated controls such as "None of these" are scoped to their named section.
 */

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const exact = s => new RegExp(`^\\s*${esc(s)}\\s*$`);

/** The grouped-list section whose header is exactly `heading`. */
export function section(scope, heading) {
  // Filters take a locator relative to the element, so it is built from the page.
  return scope.locator('section').filter({ has: pageOf(scope).getByRole('heading', { name: heading, exact: true }) });
}

/** The page a locator belongs to (or the page itself). */
export const pageOf = scope => (typeof scope.page === 'function' ? scope.page() : scope);

/** The open sheet (a dialog) with this title, or any open sheet. */
export function sheet(page, title) {
  return title ? page.getByRole('dialog', { name: title }) : page.getByRole('dialog');
}

/** A row's own button or link, found by its exact visible label (spec: rows whose name includes a subtitle). */
export function row(scope, label, role = 'button') {
  return scope.getByRole(role).filter({ has: pageOf(scope).getByText(label, { exact: true }) });
}

/** The screen's own header bar (Back, title, trailing buttons). */
export function header(page) {
  return page.locator('main div.sticky.top-0');
}

/** A screen's Back button to `label` (named "Back to <label>", or just "<label>" on older builds). */
export function back(page, label) {
  return header(page).getByRole('button', { name: new RegExp(`^(Back to )?${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) });
}

export const button = (scope, name, opts = {}) => scope.getByRole('button', { name, exact: true, ...opts });
export const link = (scope, name, opts = {}) => scope.getByRole('link', { name, exact: true, ...opts });
export const radio = (scope, name, opts = {}) => scope.getByRole('radio', { name, exact: true, ...opts });
export const checkbox = (scope, name, opts = {}) => scope.getByRole('checkbox', { name, exact: true, ...opts });

/** Tap like a person: bring it on screen first, then a touch tap where supported. */
export async function tap(locator) {
  await locator.waitFor({ state: 'visible' });
  await locator.scrollIntoViewIfNeeded();
  await locator.click();
}

/** Type into a field as a person would: clear it, then key in the characters. */
export async function type(locator, text) {
  await locator.waitFor({ state: 'visible' });
  await locator.scrollIntoViewIfNeeded();
  await locator.click();
  await locator.press('ControlOrMeta+a');
  await locator.press('Backspace');
  if (text !== '') await locator.pressSequentially(String(text), { delay: 10 });
}

/** A native 0–10 range: Home, then the arrow key, so React sees real input events. */
export async function setRange(locator, value) {
  await locator.waitFor({ state: 'visible' });
  await locator.scrollIntoViewIfNeeded();
  await locator.focus();
  await locator.press('Home');
  for (let i = 0; i < value; i++) await locator.press('ArrowRight');
  const now = Number(await locator.inputValue());
  if (now !== value) throw new Error(`range ${await locator.getAttribute('id')} is ${now}, not ${value}`);
}

/**
 * Native date and time inputs are set the way their native picker sets them:
 * one complete value at once. Typing segment by segment passes through empty
 * intermediate values, which a picker never produces (and which some fields
 * here answer by closing the input).
 */
async function pick(locator, value) {
  await locator.waitFor({ state: 'visible' });
  await locator.scrollIntoViewIfNeeded();
  await locator.fill(value);
  const got = await locator.inputValue();
  if (got !== value) throw new Error(`the field reads "${got}", not ${value}`);
}

/** `HH:MM` into a native time input. */
export const setTime = (locator, hhmm) => pick(locator, hhmm);
/** `YYYY-MM-DD` into a native date input. */
export const setDate = (locator, ymd) => pick(locator, ymd);
/** `YYYY-MM-DDTHH:MM` into a native datetime-local input. */
export const setDateTime = (locator, value) => pick(locator, value);

// ---------------------------------------------------------------- check-in

export const CHECKIN = 'Check-in';
export const SUBMIT = 'See today’s plan';

export const EMERGENCY = {
  chest: 'Chest pain or pressure, or a racing heartbeat at rest',
  stroke: 'Face drooping, arm or leg weakness, slurred speech, or a sudden change in vision',
  breathless: 'Severe breathlessness that is new',
  collapse: 'Collapsed and not back to normal',
  bladderBowel: 'Can’t pee, or new loss of bladder or bowel control',
  saddle: 'New numbness around the genitals or bottom, or new sexual problems with back pain down a leg',
  bothLegs: 'New weakness or numbness in both legs',
  lowCantTreat: 'A low that can’t be treated by mouth: too drowsy or confused, or can’t swallow safely',
  dka: 'Vomiting with tummy pain, deep or unusual breathing, fruity breath, or very drowsy or confused',
  accident: 'Injured in a serious accident, such as a fall or a crash',
  heatConfusion: 'Confused or hard to wake in the heat',
};

export const BACK_FLAG = {
  newWeakness: 'New foot drop or foot dragging, or a leg getting weaker',
  newSensory: 'New or worse tingling or numbness, with no weakness',
  feverish: 'Back pain with fever, shivering or feeling unwell',
  suddenSevere: 'Sudden severe back pain, or pain getting worse fast',
  worseFunction: 'Walking or sitting is harder than after your last session',
  weaknessFast: 'It is getting worse over hours or days',
};

export const NEWS = {
  unwell: 'Unwell, feverish or shivery',
  vomiting: 'Vomiting, or can’t keep fluids down',
  highNotFalling: 'A high glucose that won’t come down with your usual plan',
  lowSymptoms: 'Shaky, sweaty or feeling a low coming on',
  dizzy: 'Dizzy or faint on standing or when active',
  fainted: 'Fainted today, and back to normal now',
  footProblem: 'A new blister or sore on a foot',
  hotSwollenFoot: 'A foot that is newly hot, red or swollen',
  steroid: 'Steroid tablets or an injection in the last 3 days',
  hot: 'Hot or humid today',
  unusualFatigue: 'Unusually tired or breathless with everyday things',
};

/**
 * Answer the check-in sheet. Every field named in `a` must exist; a missing
 * control throws (a failure, not a skip). Unnamed fields are left as they are.
 *
 *   emergency: [] for "None of these", or EMERGENCY labels to tick (then it stops: the answer saves at once)
 *   glucose: { value: '110', unit?: 'mg/dL'|'mmol/L', time?: 'HH:MM' }   (omit to leave blank)
 *   ketones: { blood: '0.6' } | { urine: 'Moderate' }
 *   bp: [[sys, dia], [sys, dia]] — the second typed one minute later (t.advance)
 *   bpSymptoms: true
 *   back: { pain, leg, reach: 'Back'|'Buttock'|'Thigh'|'Below knee'|'Foot', flags: [] | [BACK_FLAG labels] }
 *   news: [] | [NEWS labels], lows: 'None'|'One'|'Two or more'|'Needed help'
 *   lowRecovered: true
 *   sleep: 'Over 7 h', energy: 'Good'
 *   submit: true (default) taps "See today’s plan"
 */
export async function answerCheckIn(t, dialog, a = {}) {
  const right = section(dialog, 'Right now, any of these?');
  if (a.emergency?.length) {
    for (const label of a.emergency) await tap(checkbox(right, label));
    return;
  }
  if (a.emergency) await tap(checkbox(right, 'None of these'));

  if (a.glucose) {
    const g = section(dialog, 'Glucose');
    const unit = a.glucose.unit ?? 'mg/dL';
    const unitButton = g.getByRole('button', { name: /^Unit: / });
    for (let i = 0; i < 2 && !(await unitButton.getAttribute('aria-label')).includes(`Unit: ${unit}.`); i++) await tap(unitButton);
    if (!(await unitButton.getAttribute('aria-label')).includes(`Unit: ${unit}.`)) throw new Error(`glucose unit would not change to ${unit}`);
    if (a.glucose.value !== undefined) await type(g.getByRole('textbox', { name: 'Glucose reading', exact: true }), a.glucose.value);
    if (a.glucose.time) await setTime(g.getByLabel('Time measured', { exact: true }), a.glucose.time);
    if (a.glucose.display) {
      const ask = g.getByRole('button', { name: 'Meter shows HI or LO?', exact: true });
      if (await ask.count()) await tap(ask);
      await tap(radio(g.getByRole('radiogroup', { name: 'What the meter shows' }), a.glucose.display));
    }
  }
  if (a.ketones?.blood !== undefined) await type(dialog.getByRole('textbox', { name: 'Blood ketones, mmol/L', exact: true }), a.ketones.blood);
  if (a.ketones?.urine) await tap(radio(dialog.getByRole('radiogroup', { name: 'Urine ketone strip' }), a.ketones.urine));
  if (a.lowRecovered !== undefined) {
    const s = dialog.getByRole('switch', { name: 'Symptoms gone, and your care plan allows exercise after a treated low', exact: true });
    if ((await s.getAttribute('aria-checked') === 'true') !== a.lowRecovered) await tap(s);
  }

  if (a.bp) {
    const bp = section(dialog, 'Blood pressure');
    for (let i = 0; i < a.bp.length; i++) {
      const [s, d] = a.bp[i];
      if (i > 0 && a.bpGapMs !== 0) await t.advance(a.bpGapMs ?? 60_000);
      await type(bp.getByRole('textbox', { name: `Reading ${i + 1}, top number`, exact: true }), s);
      await type(bp.getByRole('textbox', { name: `Reading ${i + 1}, bottom number`, exact: true }), d);
    }
  }
  if (a.bpSymptoms !== undefined) {
    const s = dialog.getByRole('switch', { name: 'Symptoms with the high reading', exact: true });
    if ((await s.getAttribute('aria-checked') === 'true') !== a.bpSymptoms) await tap(s);
  }

  if (a.back) {
    const back = section(dialog, 'Back and legs');
    if (a.back.pain !== undefined) await setRange(back.getByLabel('Back pain now', { exact: true }), a.back.pain);
    if (a.back.leg !== undefined) await setRange(back.getByLabel('Leg pain now', { exact: true }), a.back.leg);
    if (a.back.reach) await tap(radio(back.getByRole('radiogroup', { name: 'How far down symptoms reach' }), a.back.reach));
    if (a.back.flags) {
      const since = section(dialog, 'Since your last check-in, any of these?');
      if (!a.back.flags.length) {
        const none = checkbox(since, 'None of these');
        if (await none.getAttribute('aria-checked') !== 'true') await tap(none);
      }
      for (const label of a.back.flags) await tap(checkbox(since, label));
    }
  }

  if (a.news) {
    const other = section(dialog, 'Anything else today?');
    if (!a.news.length) {
      const none = checkbox(other, 'None of these');
      if (await none.getAttribute('aria-checked') !== 'true') await tap(none);
    }
    for (const label of a.news) await tap(checkbox(other, label));
  }
  if (a.lows) await tap(radio(dialog.getByRole('radiogroup', { name: 'Lows in the last 24 hours' }), a.lows));

  if (a.sleep) await tap(radio(dialog.getByRole('radiogroup', { name: 'Sleep last night' }), a.sleep));
  if (a.energy) await tap(radio(dialog.getByRole('radiogroup', { name: 'Energy' }), a.energy));

  if (a.submit !== false) {
    await tap(button(dialog, SUBMIT));
    // The save is asynchronous: wait for the outcome to replace the form before anyone reads it.
    await dialog.locator('section[role="alert"], section[role="status"]').filter({ has: pageOf(dialog).locator('h2') })
      .first().waitFor({ timeout: 10000 }).catch(() => {});
  }
}

/** The normal current answers for a persona (spec "Normal current answers"). */
export function normalAnswers(persona, over = {}) {
  const diabeticMeter = persona === 'P03' || persona === 'P04';
  const back = persona === 'P01' || persona === 'P06';
  return {
    emergency: [],
    ...(diabeticMeter ? { glucose: { value: '110', unit: 'mg/dL' } } : {}),
    ...(persona === 'P01' ? { bp: [[124, 78], [122, 76]] } : {}),
    ...(back ? { back: { pain: 0, leg: 0, reach: 'Back', flags: [] } } : {}),
    news: [],
    sleep: 'Over 7 h',
    energy: 'Good',
    ...over,
  };
}

/** The outcome banner's heading (an h2 inside the sheet or gate). */
export async function outcomeTitle(scope) {
  const banner = scope.locator('section[role="alert"], section[role="status"]').filter({ has: pageOf(scope).locator('h2') });
  if (!(await banner.count())) return undefined;
  return (await banner.last().locator('h2').first().innerText()).trim();
}

/** Visible text of the scope, one line per block. */
export async function text(scope) {
  return (await scope.innerText()).replace(/\s+\n/g, '\n');
}

// ---------------------------------------------------------------- navigation

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "8 October" for 2026-10-08, the way My Day names a day. */
export const dayName = ymd => { const [, m, d] = ymd.split('-').map(Number); return `${d} ${MONTHS[m - 1]}`; };

const TAB_PATH = { Today: '/today', Move: '/move', Track: '/track', Guide: '/guide' };
const TAB_TITLE = { Today: 'Today', Move: 'Move', Track: 'My Day', Guide: 'Guide' };

/**
 * A tab's root screen, the way a person gets there; returns once that screen
 * (or its failure screen) is up. Tabs keep their place, as iOS does (scan
 * S-18): a tab returns to the screen it was left on, and tapping the selected
 * tab again pops it to its root. So a first tap that settles elsewhere in the
 * tab is followed by a second.
 */
export async function tab(page, name) {
  const target = link(page.getByRole('navigation', { name: 'Main' }), name);
  await tap(target);
  if (await tabSettled(page, name) === 'elsewhere') {
    await tap(target);
    await tabSettled(page, name);
  }
  await page.waitForTimeout(150);
}

/**
 * Where a tab tap has settled: `root` (the tab's own screen), `elsewhere`
 * (the tab is selected and another of its screens has held still for half a
 * second), or `timeout`.
 */
async function tabSettled(page, name, ms = 15000) {
  const want = { p: TAB_PATH[name] ?? '/', title: TAB_TITLE[name] ?? name, label: name };
  const until = Date.now() + ms;
  let last;
  let still = 0;
  while (Date.now() < until) {
    const s = await page.evaluate(({ p, title, label }) => {
      const hash = location.hash.replace(/^#/, '');
      const h1 = [...document.querySelectorAll('main h1')].map(h => h.textContent.trim());
      const inTab = hash === p || hash.startsWith(`${p}/`) || hash.startsWith(`${p}?`);
      if (inTab && (h1.includes(title) || h1.includes('This screen didn’t load'))) return { root: true };
      const selected = [...document.querySelectorAll('nav[aria-label="Main"] a[aria-current="page"]')].some(a => a.textContent.trim() === label);
      return { root: false, selected, key: h1.length ? `${hash}|${h1.join('|')}` : '' };
    }, want).catch(() => ({ root: false, selected: false, key: '' }));
    if (s.root) return 'root';
    if (s.selected && s.key) {
      still = s.key === last ? still + 1 : 0;
      last = s.key;
      if (still >= 5) return 'elsewhere';
    } else {
      still = 0;
      last = undefined;
    }
    await page.waitForTimeout(100);
  }
  return 'timeout';
}

/** Wait until the screen's level-1 heading matches (a string or RegExp); returns the heading text. */
export async function heading(page, want, timeout = 15000) {
  const re = want instanceof RegExp ? want : exact(want);
  await page.waitForFunction(src => {
    const r = new RegExp(src.source, src.flags);
    return [...document.querySelectorAll('h1')].some(h => r.test(h.textContent.trim()));
  }, { source: re.source, flags: re.flags }, { timeout }).catch(() => {});
  return (await page.getByRole('heading', { level: 1 }).allInnerTexts()).map(s => s.trim()).join(' | ');
}

/** Move My Day to a calendar day with its Previous/Next day buttons, and return the day heading. */
export async function trackDay(page, ymd) {
  const main = page.getByRole('main');
  const want = dayName(ymd);
  const [, wm, wd] = ymd.split('-').map(Number);
  const read = async () => (await main.getByRole('heading', { level: 2 }).first().innerText()).replace(/\s+/g, ' ');
  // A view transition can leave the old screen up after the address has changed.
  await page.getByRole('heading', { level: 1, name: 'My Day', exact: true }).waitFor({ timeout: 15000 });
  for (let i = 0; i < 60; i++) {
    const heading = await read();
    if (new RegExp(`\\b${want}\\b`).test(heading)) return heading;
    const m = /(\d{1,2}) (January|February|March|April|May|June|July|August|September|October|November|December)/.exec(heading);
    if (!m) throw new Error(`My Day heading “${heading}” names no day`);
    const shown = MONTHS.indexOf(m[2]) * 31 + Number(m[1]);
    const target = (wm - 1) * 31 + wd;
    await tap(main.getByRole('button', { name: target < shown ? /^Previous day/ : /^Next day/ }));
    // One tap, one day: wait for the heading to move before deciding again.
    const until = Date.now() + 15000;
    while (Date.now() < until && (await read()) === heading) await page.waitForTimeout(100);
  }
  throw new Error(`My Day never reached ${want}`);
}
