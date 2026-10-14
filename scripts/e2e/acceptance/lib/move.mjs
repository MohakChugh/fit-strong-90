/**
 * The ways into a movement mode (Guided, Stretch, Walk) and what stands at
 * the door: the shared check-in sheet, a gate screen, or the mode itself.
 *
 * Entry points, as a person reaches them (v1's names, at their v2 places):
 *   move     — the mode's hub from Home (`hub.open`) → its start
 *   chooser  — Home → Something else → the mode's row
 *   today    — Home's Right now card, v1 Today's primary action (whatever the recommendation offers)
 *   direct   — a deep link loaded cold: /session, /hub/stretch, /walk/live
 */
import * as hub from './hub.mjs';
import * as ui from './ui.mjs';

export const MODES = ['guided', 'stretch', 'walk'];
const CHOOSER_ROW = { guided: 'Guided session', stretch: 'Stretch', walk: 'Walk' };
const DIRECT = { guided: '/session', stretch: '/hub/stretch', walk: '/walk/live' };

/** The check-in sheet, if it is open. */
export const checkInSheet = page => page.getByRole('dialog', { name: ui.CHECKIN });

/**
 * Open a mode from an entry point and tap its Start where there is one.
 * Returns where that left the person: `{ sheet }` when the check-in opened,
 * `{ route }` otherwise (a setup screen, a gate, the player or the live walk).
 */
export async function enter(t, mode, via = 'move') {
  const page = t.page;
  const main = page.getByRole('main');
  if (via === 'move') {
    // v1's Move → mode → Start is now Home's tile for the mode → its hub's start (Plan 2).
    await hub.open(t, mode);
    // A card that refuses offers no start: the caller reads what it says (`setupRefusal`).
    if (await hub.start(page).count()) await ui.tap(hub.start(page));
  } else if (via === 'chooser') {
    await ui.tab(page, 'Home');
    await ui.tap(ui.button(main, 'Something else'));
    await ui.tap(ui.row(page.getByRole('dialog'), CHOOSER_ROW[mode]));
  } else if (via === 'today') {
    await ui.tab(page, 'Home');
    await ui.tap(ui.rightNow(page).getByRole('button'));
  } else if (via === 'direct') {
    await t.goto(DIRECT[mode]);
    if (mode === 'stretch' && await hub.start(page).count()) await ui.tap(hub.start(page));
  } else {
    throw new Error(`unknown entry ${via}`);
  }
  await page.waitForTimeout(500);
  const sheet = checkInSheet(page);
  if (await sheet.count()) return { sheet, route: await t.route() };
  return { route: await t.route() };
}

/**
 * What a movement hub's card shows while the engine refuses (journey §8.4):
 * no start, the gate's headline and sentences on screen before any tap, and
 * the safe actions on offer (`hub.refusal`). Undefined when the card offers
 * its start instead.
 */
export async function setupRefusal(page, mode) {
  return hub.refusal(page);
}

/**
 * A refusing card's way to today's check-in: "Review today’s check-in", or
 * "Enter a new reading" while a re-check waits. Returns the sheet it opens.
 */
export async function reviewFromSetup(page) {
  const c = hub.card(page);
  const review = ui.button(c, 'Review today’s check-in');
  await ui.tap((await review.count()) ? review : ui.button(c, 'Enter a new reading'));
  const sheet = checkInSheet(page);
  await sheet.waitFor({ timeout: 15000 });
  await page.waitForTimeout(400);
  return sheet;
}

/** The Start button the check-in shows once it allows the mode, if any. */
export function sheetStart(sheet) {
  return sheet.getByRole('button', { name: /^(Start session|Start recovery session|Start stretch|Start walk|Continue|Continue session|Continue stretch|Continue to stretch|Continue to walk)$/ });
}

/**
 * Whether movement is on offer anywhere on screen right now: a sheet Start,
 * the player's own Start/Resume, or a running walk's controls.
 */
export async function movementOffered(page) {
  const sheet = checkInSheet(page);
  if (await sheet.count() && await sheetStart(sheet).count()) return 'sheet start';
  const main = page.getByRole('main');
  // Walk setup's "Start walk" only opens the check-in, so it is not movement on offer.
  if (await main.getByRole('button', { name: /^(Start|Resume|Continue walking)$/ }).count()) {
    const label = await main.getByRole('button', { name: /^(Start|Resume|Continue walking)$/ }).allInnerTexts();
    return `button ${label.join(',').trim()}`;
  }
  if (await main.getByRole('button', { name: /^(Pause|Finish walk|Finish)$/ }).count()) return 'active movement controls';
  return undefined;
}

/** The outcome headline on screen (sheet or gate), and its full text. */
export async function outcome(page) {
  const sheet = checkInSheet(page);
  const scope = (await sheet.count()) ? sheet : page.getByRole('main');
  return { title: await ui.outcomeTitle(scope), text: (await scope.innerText().catch(() => '')).replace(/\s+/g, ' ') };
}
