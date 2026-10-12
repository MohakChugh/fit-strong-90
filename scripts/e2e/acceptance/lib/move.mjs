/**
 * The ways into a movement mode (Guided, Stretch, Walk) and what stands at
 * the door: the shared check-in sheet, a gate screen, or the mode itself.
 *
 * Entry points, as a person reaches them:
 *   move     — Move tab → the mode's row → its Start button
 *   chooser  — Today → Choose something else → the mode's row
 *   today    — Today's primary action (whatever the recommendation offers)
 *   direct   — a deep link loaded cold: /session, /move/stretch, /walk/live
 */
import * as ui from './ui.mjs';

export const MODES = ['guided', 'stretch', 'walk'];
const CHOOSER_ROW = { guided: 'Guided session', stretch: 'Stretch', walk: 'Walk' };
const DIRECT = { guided: '/session', stretch: '/move/stretch', walk: '/walk/live' };

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
    await ui.tab(page, 'Move');
    if (mode === 'guided') {
      // A button that starts the session, or — for someone not in the programme — a link to join it.
      const asButton = ui.row(main, 'Guided session');
      await ui.tap((await asButton.count()) ? asButton : ui.row(main, 'Guided session', 'link'));
    } else {
      await ui.tap(ui.row(main, mode === 'stretch' ? 'Stretch' : 'Walk', 'link'));
      await page.getByRole('heading', { level: 1, name: mode === 'stretch' ? 'Stretch' : 'Walk', exact: true }).waitFor();
      // The setup screen may itself refuse (no Start), or offer to return to a walk under way;
      // either way the caller asserts what it shows.
      const start = ui.button(main, mode === 'stretch' ? 'Start stretch' : 'Start walk');
      await page.waitForTimeout(300);
      if (await start.count()) await ui.tap(start);
    }
  } else if (via === 'chooser') {
    await ui.tab(page, 'Today');
    await ui.tap(ui.button(main, 'Choose something else'));
    await ui.tap(ui.row(page.getByRole('dialog'), CHOOSER_ROW[mode]));
  } else if (via === 'today') {
    await ui.tab(page, 'Today');
    const card = main.getByRole('region').filter({ has: page.getByRole('heading', { level: 3 }) });
    await ui.tap(card.getByRole('button'));
  } else if (via === 'direct') {
    await t.goto(DIRECT[mode]);
    const start = ui.button(main, 'Start stretch');
    if (mode === 'stretch' && await start.count()) await ui.tap(start);
  } else {
    throw new Error(`unknown entry ${via}`);
  }
  await page.waitForTimeout(500);
  const sheet = checkInSheet(page);
  if (await sheet.count()) return { sheet, route: await t.route() };
  return { route: await t.route() };
}

/**
 * What a Stretch or Walk setup shows while the engine refuses movement (scan
 * S-15): no Start, the reason on screen before any tap (Walk under its own
 * heading), and "Review today’s check-in" to open the check-in with the same
 * answer, or "Open your health profile" when health answers are missing.
 * Undefined when the setup offers its Start instead.
 */
export async function setupRefusal(page, mode) {
  const main = page.getByRole('main');
  const start = ui.button(main, mode === 'stretch' ? 'Start stretch' : 'Start walk');
  const review = ui.button(main, 'Review today’s check-in');
  const profile = ui.button(main, 'Open your health profile');
  await start.or(review).or(profile).first().waitFor({ timeout: 15000 }).catch(() => {});
  if (await start.count()) return undefined;
  const status = main.getByRole('status').first();
  const lines = (await status.count())
    ? (await status.locator('p').allInnerTexts()).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
    : [];
  const text = (await status.count()) ? (await status.innerText()).replace(/\s+/g, ' ').trim() : '';
  // Walk heads its refusal ("Call emergency services now", "No walk today"); Stretch's line is the reason itself.
  const title = mode === 'walk' ? lines[0] : undefined;
  const reasons = mode === 'walk' ? lines.slice(1) : [text].filter(Boolean);
  return {
    text, title, reasons,
    review: (await review.count()) > 0,
    profile: (await profile.count()) > 0,
    stretchInstead: (await ui.button(main, 'Stretch instead').count()) > 0,
  };
}

/** A refusing setup's "Review today’s check-in": the check-in sheet it opens. */
export async function reviewFromSetup(page) {
  await ui.tap(ui.button(page.getByRole('main'), 'Review today’s check-in'));
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
