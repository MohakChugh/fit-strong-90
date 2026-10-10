/**
 * v2's hubs (journey §8; Plan 2), the way a person reaches them, and what a
 * movement hub's Right now card says. Home's tile for a category opens its
 * hub. Browse lists every category, for a tile Home doesn't show. The card is
 * a region named "Right now", with an h3 title, the gate's sentences in a
 * status region while it refuses, and at most one start-kind action. Every
 * start-kind action goes through the gate, so a tap opens the check-in when
 * one is due (§4.1, §4.2).
 */
import * as ui from './ui.mjs';

/** Each mode's hub. */
export const HUB = {
  guided: { title: 'Workout', path: '/hub/workout' },
  stretch: { title: 'Stretch', path: '/hub/stretch' },
  walk: { title: 'Walk', path: '/hub/walk' },
};

/**
 * Every label a card's start-kind action can have (journey §7.5, §8.4,
 * B-09); one shows at a time. "Start anyway" is the quiet start while Away or
 * Unwell, which still goes through the gate (L-04).
 */
export const START = /^(Start session|Start recovery session|Start rest-day mobility|Start stretch|Start walk|Start anyway|Check in & start|Check in & continue|Continue session|Continue stretch|I had \S+ at .+: walk now)$/;

/** Anything on a hub that would begin movement, the card's quiet "Just a walk" included: none may show while the gate refuses. */
export const STARTERS = /^(Start session|Start recovery session|Start rest-day mobility|Start stretch|Start walk|Start anyway|Check in & start|Check in & continue|Continue session|Continue stretch|Just a walk|I had \S+ at .+: walk now)$/;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();

/** The hub's Right now card. */
export const card = page => page.getByRole('main').getByRole('region', { name: 'Right now', exact: true });

/** The card's start-kind action, if it offers one. */
export const start = page => card(page).getByRole('button', { name: START });

/** Home's tile for a category. */
export const tile = (page, title) => ui.row(page.getByRole('main').getByRole('region', { name: 'What would you like to do?', exact: true }), title, 'link');

/** Home → the category's tile → its hub, or Browse → the category when Home doesn't show the tile. */
export async function openHub(t, title, path) {
  const page = t.page;
  await ui.tab(page, 'Home');
  if (await tile(page, title).count()) {
    await ui.tap(tile(page, title));
  } else {
    await ui.tab(page, 'Browse');
    await ui.tap(ui.row(page.getByRole('main'), title, 'link'));
  }
  const ok = await page.waitForFunction(({ path, title, loading }) => {
    const hash = location.hash.replace(/^#/, '').split('?')[0];
    const h1 = [...document.querySelectorAll('main h1')].map(h => h.textContent.trim());
    // The hub's skeleton has its title too: wait for its content (`ui.LOADING`).
    return hash === path && (h1.includes(title) || h1.includes('This screen didn’t load')) && !document.querySelector(loading);
  }, { path, title, loading: ui.LOADING }, { timeout: 15000 }).then(() => true, () => false);
  if (!ok) throw new Error(`Home → ${title} did not reach ${path} (at ${new URL(page.url()).hash || '/'})`);
  await page.waitForTimeout(250);
}

/** A movement hub, with its card up. */
export async function open(t, mode) {
  await openHub(t, HUB[mode].title, HUB[mode].path);
  await card(t.page).waitFor({ timeout: 15000 });
}

/**
 * What the card says while it offers no start-kind action, or undefined when
 * it offers one: its title, the gate's sentences, the card's whole text (its
 * title included, as v1 Walk's refusal had its heading in its text) and the
 * safe actions on offer (journey §7.5, §8.4).
 */
export async function refusal(page) {
  const c = card(page);
  await c.waitFor({ timeout: 15000 }).catch(() => {});
  if (await start(page).count()) return undefined;
  const h3 = c.getByRole('heading', { level: 3 });
  const status = c.getByRole('status');
  const has = async name => (await ui.button(c, name).count()) > 0;
  return {
    title: (await h3.count()) === 1 ? flat(await h3.innerText()) : undefined,
    reasons: (await status.count()) === 1 ? (await status.locator('p').allInnerTexts()).map(flat).filter(Boolean) : [],
    text: flat(await c.innerText()),
    // A way to today's check-in: "Review today’s check-in", or "Enter a new reading" while a re-check waits.
    review: (await has('Review today’s check-in')) || (await has('Enter a new reading')),
    recheck: await has('Enter a new reading'),
    profile: (await c.getByRole('button', { name: /^Answer the questions about your (health|medicines)$/ }).count()) > 0,
    stretchInstead: await has('Stretch instead'),
    join: await has('Join the 12-week programme'),
  };
}

/** Tap the card's start-kind action: the check-in sheet when one opened, and where the person is. */
export async function begin(t) {
  const page = t.page;
  await ui.tap(start(page));
  await page.waitForTimeout(500);
  const sheet = page.getByRole('dialog', { name: ui.CHECKIN });
  return (await sheet.count()) ? { sheet, route: await t.route() } : { route: await t.route() };
}

/** The shell's safety surface on this screen, when one stands (journey §4.7, B-02). */
export async function urgent(page) {
  const s = page.getByRole('main').locator('section[data-urgent-kind]');
  if ((await s.count()) !== 1) return undefined;
  return { kind: await s.getAttribute('data-urgent-kind'), headline: flat(await s.locator('h2').innerText()), text: flat(await s.innerText()) };
}
