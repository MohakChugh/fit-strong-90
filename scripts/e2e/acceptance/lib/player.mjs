/**
 * The guided and stretch player (src/pages/SessionPage.tsx): reading where it
 * is, stepping through it, and the progress cache it keeps in localStorage.
 * Every action is a tap on the player's own controls.
 */
import * as ui from './ui.mjs';

export const PROGRESS_KEY = { guided: 'fit-strong-90-guided', stretch: 'fit-strong-90-stretch' };

/** The player's main landmark. */
export const playerMain = page => page.getByRole('main');

/** The current step's heading and its subtitle line. */
export async function where(page) {
  const main = playerMain(page);
  const h1 = main.getByRole('heading', { level: 1 });
  const title = (await h1.innerText()).trim();
  const sub = (await main.locator('h1 + p').innerText().catch(() => '')).trim();
  return { title, sub };
}

/** A player control by its exact accessible name. */
export const control = (page, name) => playerMain(page).getByRole('button', { name, exact: true });

/** On the ready screen: the player's own Start. */
export async function begin(page) {
  const start = control(page, 'Start');
  await start.waitFor();
  await ui.tap(start);
  await control(page, 'Pause').waitFor();
}

/**
 * Tap Next until `done(where)` holds, recording each step passed. Returns the
 * list of steps skipped. Throws after `max` steps.
 */
export async function nextUntil(page, done, max = 60) {
  const passed = [];
  for (let i = 0; i < max; i++) {
    const w = await where(page);
    if (await done(w)) return passed;
    passed.push(w);
    await ui.tap(control(page, 'Next'));
    await page.waitForFunction(prev => {
      const h = document.querySelector('main h1');
      const p = h?.nextElementSibling;
      return !h || `${h.textContent}|${p?.textContent ?? ''}` !== prev;
    }, `${w.title}|${w.sub}`, { timeout: 5000 }).catch(() => {});
  }
  throw new Error(`the player never reached the wanted step after ${max} taps of Next`);
}

/** A Stepper's shown value (the text between its Less and More buttons). */
export async function stepperValue(page, more) {
  return (await more.locator('xpath=preceding-sibling::span[1]').innerText()).trim();
}

/**
 * Set a Stepper to a number by tapping More/Less. `label` is a regex matching
 * the stepper's label ("Weight (find yours)" turns into "Weight" once set).
 */
export async function setStepper(page, label, target, unit = '') {
  const main = playerMain(page);
  for (let i = 0; i < 80; i++) {
    const more = main.getByRole('button', { name: new RegExp(`^More ${label.source}$`) });
    const less = main.getByRole('button', { name: new RegExp(`^Less ${label.source}$`) });
    const shown = await stepperValue(page, more);
    const value = Number(shown.replace(/[^\d.]/g, ''));
    if (Math.abs(value - target) < 1e-9 && shown.endsWith(unit)) return shown;
    await ui.tap(value < target ? more : less);
    await page.waitForTimeout(60);
  }
  throw new Error(`the ${label.source} stepper never reached ${target}`);
}

/** The saved progress for a slot, parsed. */
export async function progress(page, slot = 'guided') {
  return page.evaluate(key => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, PROGRESS_KEY[slot]);
}

/** Step ends in m:ss, as milliseconds, or undefined. */
export async function stepRemainingMs(page) {
  const text = await playerMain(page).getByText(/^Step ends in \d+:\d\d$/).innerText().catch(() => '');
  const m = /(\d+):(\d\d)$/.exec(text);
  return m ? (Number(m[1]) * 60 + Number(m[2])) * 1000 : undefined;
}

/**
 * Something on the running player a person could use to report symptoms and
 * stop: the spec's "symptom-stop control". End session is leaving, not it.
 */
export function symptomStop(page) {
  // "I feel low" is the glucose path, not a general symptom stop, so it does not count.
  return playerMain(page).getByRole('button', { name: /symptom|stop|feel (unwell|wrong|faint|dizzy)|pain|something.?s wrong/i });
}

/** The caption line (the player's live region). */
export const caption = page => playerMain(page).locator('p[aria-live="polite"]');

/**
 * The check-in sheet's permission-approved Start, whatever the entry calls it
 * (move.sheetStart misses the chooser's "Continue to stretch"/"Continue to walk").
 */
export function sheetStart(sheet) {
  return sheet.getByRole('button', { name: /^(Start session|Start recovery session|Start stretch|Start walk|Continue|Continue session|Continue stretch|Continue to stretch|Continue to walk)$/ });
}
