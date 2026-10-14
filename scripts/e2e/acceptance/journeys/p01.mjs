/**
 * PERF01 (motion §7, board D117): the performance budget's parts a browser
 * can check. At most two blurred surfaces at once, each a bar or a sheet's
 * header and none larger than a fifth of the screen. At most one animated
 * shared element in a view transition, beyond the page and the stationary
 * navigation snapshots (B-27), Today's log with two walks included. The live
 * route redrawn no more than once for each second measured, on the page's own
 * clock, while fixes it accepts arrive ten times a second, by a check first
 * shown to fail a faster drawing. The 3D demo's own WebGL drawing stopping
 * while the app is hidden and while the demo is off screen (Codex P8-25,
 * P8-26). Frames, Low Power Mode and a warm phone are the device checklist's
 * (Task 17). One project: none of this depends on size or colour.
 */
import { persona } from '../fixtures/personas.mjs';
import { busiestSecond, withinRedrawBudget } from '../lib/budget.mjs';
import * as hub from '../lib/hub.mjs';
import * as ui from '../lib/ui.mjs';
import * as walk from '../lib/walk.mjs';

export const id = 'PERF01';
export const title = 'The performance budget’s automated parts';
export const safety = false;

/** Snapshots that stay put in a transition (`index.css`'s `animation: none`): the shell, the tab bar, the screen's header. */
const STATIONARY = ['app-shell', 'app-nav', 'app-header'];

/** Every surface on screen drawn over a blur: how much of the screen it covers, and whether it is a bar or a sheet's header. */
const blurred = page => page.evaluate(() => {
  const screen = innerWidth * innerHeight;
  return [...document.querySelectorAll('body *')].flatMap(el => {
    const s = getComputedStyle(el);
    const filter = s.backdropFilter || s.webkitBackdropFilter;
    if (!filter || filter === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return [];
    const r = el.getBoundingClientRect();
    const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
    const h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
    if (w === 0 || h === 0) return [];
    let pinned = false;
    for (let at = el; at && !pinned; at = at.parentElement) pinned = ['fixed', 'sticky'].includes(getComputedStyle(at).position);
    const header = !!el.closest('[data-slot="sheet-content"] > :first-child');
    const what = el.getAttribute('aria-label') || `${el.tagName.toLowerCase()}.${String(el.className).split(/\s+/).slice(0, 3).join('.')}`;
    return [{ what, share: (w * h) / screen, bar: (pinned && w >= innerWidth * 0.85) || header }];
  });
});

/** What breaks motion §7's "at most two blurred surfaces at once, all small: the tab bar or nav bar, plus a sheet header". */
function overBlur(found) {
  const problems = found.length > 2 ? [`${found.length} blurred surfaces: ${found.map(f => f.what).join(', ')}`] : [];
  for (const f of found) {
    if (f.share > 0.2) problems.push(`${f.what} blurs ${Math.round(f.share * 100)}% of the screen`);
    if (!f.bar) problems.push(`${f.what} is blurred, and is neither a bar nor a sheet’s header`);
  }
  return problems;
}

/** Every view transition, with the animated names on each side: the page and the stationary snapshots left out. */
function vtProbe(stationary) {
  const acc = (window.__acc = window.__acc || {});
  acc.vt = [];
  const native = document.startViewTransition?.bind(document);
  if (!native) return;
  const named = () => [...document.querySelectorAll('body *')]
    .map(el => getComputedStyle(el).viewTransitionName)
    .filter(n => n && n !== 'none' && !stationary.includes(n));
  document.startViewTransition = update => {
    const before = named();
    const run = typeof update === 'function' ? update : update?.update;
    const wrapped = async () => {
      await run?.();
      acc.vt.push({ before, after: named() });
    };
    return native(update && typeof update === 'object' ? { ...update, update: wrapped } : wrapped);
  };
}

/** A walk with location on and its route kept: north along longitude 0, a fix every 10 s for a minute. */
async function routeWalk(t, fromLat, during) {
  const page = t.page;
  await walk.openSetup(t);
  await walk.emit(page, fromLat, 0);
  if (await walk.gpsSwitch(page).getAttribute('aria-checked') !== 'true') await ui.tap(walk.gpsSwitch(page));
  await walk.start(t, ui.normalAnswers('P03'), { keep: true });
  for (let i = 1; i <= 6; i++) {
    await t.advance(10_000);
    await walk.emit(page, fromLat + i * 0.0002, 0);
  }
  if (during) await during(fromLat + 0.0012);
  await page.waitForTimeout(1200);
  await walk.finish(t);
  await ui.tap(ui.button(page.getByRole('main'), 'Save walk'));
  await page.getByText('Saved on this device', { exact: true }).waitFor({ timeout: 10000 });
  await ui.tap(ui.button(page.getByRole('main'), 'Done'));
  await page.waitForTimeout(500);
}

/**
 * A drawing changed ten times a second, measured the way the live route is:
 * the budget check must refuse it, or it proves nothing (P8-25).
 */
const fastDrawing = page => page.evaluate(() => new Promise(resolve => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  svg.append(line);
  document.body.append(svg);
  const times = [];
  new MutationObserver(() => { times.push(performance.now()); }).observe(svg, { attributes: true, subtree: true });
  let i = 0;
  const id = setInterval(() => {
    i += 1;
    line.setAttribute('d', `M0 0 L${i} ${i}`);
    if (i < 20) return;
    clearInterval(id);
    setTimeout(() => {
      svg.remove();
      resolve({ times });
    }, 50);
  }, 100);
}));

/**
 * The live route under a burst (P8-25, P8R-15): five fixes delivered within
 * half a second of the page's own time, each stamped two seconds after the
 * last on the GPS's clock and 5.6 m further north (2.8 m/s, a brisk walk),
 * so the walk's filter (25 m accuracy, 5 m moved, 3 m/s, 10 s ahead at most)
 * accepts every one and each moves the route: five changes to draw in half a
 * second. Every redraw of the drawing is timed, so the check is on the
 * busiest second, and `grew` is what the drawing holds once it has caught up.
 */
const routeBurst = (page, from) => page.evaluate(async lat => {
  const svg = document.querySelector('svg[role="img"][aria-label="Your route so far"]');
  const points = () => [...svg.querySelectorAll('path')].reduce((n, p) => n + ((p.getAttribute('d') ?? '').match(/[ML]/g)?.length ?? 0), 0);
  const before = points();
  const times = [];
  const observer = new MutationObserver(() => { times.push(performance.now()); });
  observer.observe(svg, { attributes: true, childList: true, subtree: true });
  const stamped = Date.now();
  for (let i = 1; i <= 5; i++) {
    await new Promise(r => setTimeout(r, 80));
    window.__acc.emitPosition({ lat: lat + i * 0.0000504, lon: 0, accuracy: 3, timestamp: stamped + i * 2000 });
  }
  await new Promise(r => setTimeout(r, 2200));
  observer.disconnect();
  return { times, grew: points() - before };
}, from);

const lastVt = page => page.evaluate(() => window.__acc.vt.at(-1));
const drawsIn = (page, ms) => page.evaluate(async wait => {
  const at = window.__acc.draws;
  await new Promise(r => setTimeout(r, wait));
  return window.__acc.draws - at;
}, ms);

export const cases = [{
  name: 'blur, shared elements, the live route and the 3D demo',
  projects: ['large-light'],
  async run(t) {
    const page = await t.open({ seed: persona('P03'), route: '/home', sensors: { geo: 'grant' }, visibility: true, draws: true });
    await t.context.addInitScript(vtProbe, STATIONARY);
    await t.reload();
    const main = page.getByRole('main');
    const blurHolds = async where => {
      const problems = overBlur(await blurred(page));
      await t.check(problems.length === 0, `${where}: ${problems.join('; ')}`);
    };

    await t.step(1, 'Blur: Home and a hub scrolled under their bars, and a sheet open, each within the budget', async () => {
      await page.mouse.wheel(0, 2000);
      await page.waitForTimeout(400);
      await blurHolds('Home, scrolled');
      await hub.open(t, 'stretch');
      await page.mouse.wheel(0, 2000);
      await page.waitForTimeout(400);
      await blurHolds('the Stretch hub, scrolled');
      await ui.tab(page, 'Home');
      await ui.tap(main.getByRole('button', { name: /^How are you today\? / }));
      await page.getByRole('dialog', { name: 'Status' }).waitFor();
      await page.waitForTimeout(400);
      await blurHolds('with a sheet open');
      await ui.tap(ui.button(page.getByRole('dialog', { name: 'Status' }), 'Close'));
    });

    await t.step(2, 'A tile’s morph animates one shared element', async () => {
      await ui.tap(hub.tile(page, 'Walk'));
      await ui.heading(page, 'Walk');
      const vt = await lastVt(page);
      await t.check(!!vt && vt.before.length <= 1 && vt.after.length <= 1, `the morph named ${JSON.stringify(vt)}`);
    });

    await t.step(3, 'The live route: five changes in half a second, redrawn at most once in any second, by a check that refuses a faster drawing', async () => {
      const fast = await fastDrawing(page);
      await t.must(fast.times.length >= 15 && !withinRedrawBudget(fast.times), `the budget check let ${busiestSecond(fast.times)} redraws within a second pass`);
      await routeWalk(t, 0, async lat => {
        await t.must(await page.locator('svg[role="img"][aria-label="Your route so far"]').count() === 1, 'the live walk draws no route: nothing to measure');
        const live = await routeBurst(page, lat);
        t.note(`the live route: ${live.times.length} redraws, at most ${busiestSecond(live.times)} within a second, ${live.grew} points more`);
        await t.must(live.grew >= 4, `the burst grew the route by ${live.grew} points: its fixes weren’t accepted, so nothing was measured`);
        await t.check(live.times.length >= 1 && withinRedrawBudget(live.times), `the live route redrew ${busiestSecond(live.times)} times within one second`);
      });
      await routeWalk(t, 0.01);
    });

    await t.step(4, 'Today’s log with two route thumbnails: opening one walk names that one alone', async () => {
      await ui.legacyTab(page, 'Track');
      await t.check((await page.evaluate(() => [...document.querySelectorAll('svg')].filter(el => getComputedStyle(el).viewTransitionName.startsWith('route-')).length)) === 0,
        'Today’s log names its route thumbnails at rest');
      await ui.tap(ui.section(main, 'Records').getByRole('link', { name: /Walk/ }).first());
      await ui.heading(page, 'Walk');
      const vt = await lastVt(page);
      await t.check(!!vt && vt.before.length <= 1 && vt.after.length <= 1, `opening a walk named ${JSON.stringify(vt)}`);
      await t.checkpoint('walk-detail-morph');
    });

    await t.step(5, 'The 3D demo: drawing while shown, none while the app is hidden or the demo is off screen; its page blurs only its bars', async () => {
      await t.goto('/hub/workout/exercises/goblet-squat');
      const demo = page.locator('[role="img"][aria-label^="3D demonstration"]').first();
      await demo.waitFor({ timeout: 30000 });
      await page.waitForTimeout(1500);
      const shown = await drawsIn(page, 1000);
      await t.must(shown > 5, `the demo made ${shown} draw calls in a second while shown: it can’t be measured here`);
      await blurHolds('the exercise’s page');
      await page.evaluate(() => window.__acc.setVisibility('hidden'));
      await page.waitForTimeout(500);
      const hidden = await drawsIn(page, 1000);
      await page.evaluate(() => window.__acc.setVisibility('visible'));
      await page.waitForTimeout(500);
      // A short screen, scrolled to the end, takes the demo out of view while it stays mounted.
      await page.setViewportSize({ width: t.project.width, height: 360 });
      await page.mouse.move(t.project.width / 2, 200);
      await page.mouse.wheel(0, 6000);
      await page.waitForTimeout(800);
      const box = await demo.boundingBox();
      await t.must(!!box && box.y + box.height <= 0, `the demo is still in view after scrolling: ${JSON.stringify(box)}`);
      const off = await drawsIn(page, 1000);
      await page.setViewportSize({ width: t.project.width, height: t.project.height });
      t.note(`3D demo draw calls in a second: ${shown} shown, ${hidden} hidden, ${off} off screen`);
      await t.check(hidden === 0, `the demo made ${hidden} draw calls in a second while the app was hidden`);
      await t.check(off === 0, `the demo made ${off} draw calls in a second while off screen`);
    });
  },
}];
