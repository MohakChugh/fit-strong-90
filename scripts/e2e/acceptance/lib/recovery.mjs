/**
 * Plan 8's recovery journeys' helpers (journey §17.2): toasts and their Undo,
 * Recently deleted, the earphone buttons, a driven worker, a second tab
 * running a newer build, and a sheet closed by a swipe.
 */
import * as ui from './ui.mjs';

/** A toast on screen holding this text. */
export const toast = (page, text) => page.locator('#toasts [data-sonner-toast]').filter({ hasText: text });

/** Every toast's words. */
export const toasts = async page => (await page.locator('#toasts [data-sonner-toast]').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim());

/** Undo, on the toast holding this text. */
export async function undoIn(page, text) {
  await ui.tap(toast(page, text).getByRole('button', { name: 'Undo', exact: true }));
}

/** Today's log → Recently deleted; its sheet. */
export async function openRecentlyDeleted(t) {
  await ui.tap(ui.row(t.page.getByRole('main'), 'Recently deleted'));
  const sheet = t.page.getByRole('dialog', { name: 'Recently deleted' });
  await sheet.waitFor();
  return sheet;
}

/** Press an earphone or lock-screen button; false when the app handles none for it. */
export const media = (page, action) => page.evaluate(a => {
  const handler = window.__acc.media?.[a];
  if (!handler) return false;
  handler({ action: a });
  return true;
}, action);

/** Keep the handler the app has set now, to press after the app has let it go (V-J21). False when there is none. */
export const captureMedia = (page, action) => page.evaluate(a => {
  window.__acc.captured = window.__acc.media?.[a];
  return typeof window.__acc.captured === 'function';
}, action);

/** Press the kept handler, as a stray earphone press would. */
export const pressCaptured = page => page.evaluate(() => window.__acc.captured?.({ action: 'play' }));

export const offerUpdate = page => page.evaluate(() => window.__acc.sw.offerUpdate());
/** How many windows of FitStrong the driven worker counts from now on. */
export const setWindows = (page, n) => page.evaluate(count => { window.__acc.sw.windows = count; }, n);
/** How long the driven worker takes to answer a restart from now on (P8S-13). */
export const setRestartDelay = (page, ms) => page.evaluate(delay => { window.__acc.sw.restartDelayMs = delay; }, ms);
export const swMessages = page => page.evaluate(() => [...window.__acc.sw.messages]);
export const loads = page => page.evaluate(() => window.__acc.sw.loads);

/** Home's update line (Task 2's `UpdateRow`): its words, and its button's, or nothing. */
export async function updateLine(page) {
  const main = page.getByRole('main');
  const line = main.getByRole('status').filter({ hasText: /An update is ready|Updated\. FitStrong/ });
  if (!(await line.count())) return undefined;
  // Only the update line has these on Home.
  const button = main.getByRole('button', { name: /^(Restart to update|Dismiss)$/ });
  return { text: (await line.first().innerText()).replace(/\s+/g, ' ').trim(), button: (await button.count()) ? (await button.first().innerText()).trim() : undefined };
}

/**
 * A second tab running a newer build (B-21): it opens the app's database at
 * `version`. With `abort`, it gives the upgrade up as it begins, so the
 * database stays at this build's version for the reload that follows: an
 * interrupted upgrade. `seen()` is what it met, in order: `blocked`,
 * `upgrade`, `aborted` or `opened`.
 *
 * While it waits, no other open of the database can finish, `t.db()` and
 * `t.checkpoint()` (and so `t.step`'s own snapshot) included. Call none of
 * them until `seen()` has gone past `blocked`.
 */
export async function newerTab(t, version, { abort = true } = {}) {
  const tab = await t.newPage();
  await tab.goto(`${t.base}manifest.webmanifest`);
  await tab.evaluate(([v, giveUp]) => {
    window.__newer = [];
    const open = window.__acc?.orig?.open ?? IDBFactory.prototype.open;
    const req = open.call(indexedDB, 'fit-strong', v);
    req.onblocked = () => window.__newer.push('blocked');
    req.onupgradeneeded = () => {
      window.__newer.push('upgrade');
      if (giveUp) req.transaction.abort();
    };
    req.onsuccess = () => {
      window.__newer.push('opened');
      req.result.close();
    };
    req.onerror = e => {
      e.preventDefault();
      window.__newer.push(req.error?.name === 'AbortError' ? 'aborted' : `error:${req.error?.name}`);
    };
  }, [version, abort]);
  return { page: tab, seen: () => tab.evaluate(() => [...window.__newer]) };
}

/** Close a sheet the way a finger does: a swipe down from its title bar (Sheet.tsx's `useSwipeToDismiss`). */
export async function dragSheetDown(page, sheet) {
  const box = await sheet.getByRole('heading').first().boundingBox();
  if (!box) throw new Error('the sheet has no title to drag');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 420, { steps: 12 });
  await page.mouse.up();
}
