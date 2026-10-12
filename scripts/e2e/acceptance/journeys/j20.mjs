/**
 * J20, P07/P01: offline shell, navigation and boot recovery
 * (codex-acceptance.md; basis D4, D7, D13, D16, D23, D24).
 *
 * Step 1 runs against the production preview (service worker and CSP);
 * the rest against the dev server.
 */
import { docs, diffDb } from '../lib/harness.mjs';
import { persona } from '../fixtures/personas.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'J20';
export const title = 'Offline shell, navigation and boot recovery';
export const safety = false;
export const needs = ['preview'];

const TABS = [['Today', 'Today'], ['Move', 'Move'], ['Track', 'My Day'], ['Guide', 'Guide']];
const YOU_EDITORS = [
  ['Profile & health', /^Profile & health$|^Profile$/],
  ['Food preferences', /^Food preferences$/],
  ['What you’d like more of', /^What you’d like more of$/],
  ['Habits & reminders', /^Habits & reminders$/],
  ['Voice & demos', /^Voice & demos$/],
  ['Appearance', /^Appearance$/],
  ['Data & offline', /^Data & offline$/],
];

const h1 = page => page.getByRole('heading', { level: 1 });
const h1Text = async page => (await h1(page).allInnerTexts()).map(s => s.trim()).join(' | ');
/** Wait (bounded) for the logical route to become `want`; the caller asserts. */
const waitRoute = (page, want) => page.waitForFunction(w => location.hash.replace(/^#/, '') === w, want, { timeout: 10000 }).catch(() => {});
const failedScreen = async page => (await page.getByText('This screen didn’t load', { exact: true }).count()) > 0;

/** Record CSP violations, which a meta-tag policy reports as events. */
function cspInit() {
  window.__acc = window.__acc || {};
  window.__acc.csp = [];
  document.addEventListener('securitypolicyviolation', e => window.__acc.csp.push(`${e.violatedDirective} ${e.blockedURI}`));
}

const offline = {
  name: 'offline after one online visit (production build)',
  preview: true,
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/today', contextOptions: { serviceWorkers: 'allow' } });
    await t.context.addInitScript(cspInit);
    await t.reload();
    const main = page.getByRole('main');

    await t.step(1, 'Warm, wait for service-worker control, go offline, reload, visit every tab', async () => {
      const csp = await page.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content') ?? '');
      await t.check(/default-src 'self'/.test(csp) && /connect-src 'self'/.test(csp), `the production page has no restrictive CSP: ${csp.slice(0, 120)}`);
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 20000 }).catch(() => {});
      if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) await t.reload();
      await t.must(await page.evaluate(() => !!navigator.serviceWorker.controller), 'the service worker never took control of the page');
      // Online warm-up: every root, the editors, a detail and the player's ready screen.
      for (const route of ['/move', '/move/stretch', '/move/plan', '/move/exercises', '/walk', '/track', '/track?view=trends', '/guide', '/guide/sources', '/you', '/you/data', '/you/voice', '/session']) {
        await t.hash(route);
        await page.waitForTimeout(500);
      }
      await t.hash('/today');
      await t.checkpoint('online-warm');
      await t.context.setOffline(true);
      await t.reload();
      await t.check(await h1Text(page) === 'Today', `offline reload shows “${await h1Text(page)}”, not Today`);
      await t.checkpoint('offline-today');
      for (const [tab, heading] of TABS) {
        await ui.tab(page, tab);
        await page.waitForTimeout(600);
        await t.check(!(await failedScreen(page)) && (await h1Text(page)) === heading, `offline ${tab} shows “${await h1Text(page)}”${await failedScreen(page) ? ' (the screen did not load)' : ''}`);
        await t.checkpoint(`offline-${tab.toLowerCase()}`);
      }
      // Authored guidance opens offline.
      await ui.tab(page, 'Guide');
      const topic = main.getByRole('link').filter({ hasText: 'Vitamin B12' });
      if (await topic.count()) {
        await ui.tap(topic);
        await page.waitForTimeout(600);
        await t.check(!(await failedScreen(page)) && (await main.innerText()).length > 300, 'an authored Guide topic does not open offline');
        await t.checkpoint('offline-guide-topic');
      }
      // You and its data screen report the truth about offline use.
      await ui.tab(page, 'Today');
      await ui.tap(page.getByRole('link', { name: /^You:/ }));
      await ui.tap(ui.row(main, 'Data & offline', 'link'));
      await page.waitForTimeout(500);
      const data = await main.innerText();
      await t.check(/Works offline[\s\S]{0,80}\bYes\b/.test(data), `Data & offline does not say the app works offline while it does: ${data.replace(/\n/g, ' ⏎ ').slice(0, 300)}`);
      await t.checkpoint('offline-data');
      // An optional voice asset that was never downloaded: captions, and no claim of a voice.
      // The player's start screen is behind today's check-in, answered offline.
      await ui.tab(page, 'Today');
      await ui.tap(main.getByRole('region').filter({ has: page.getByRole('heading', { level: 3 }) }).getByRole('button'));
      const sheet = page.getByRole('dialog', { name: ui.CHECKIN });
      await sheet.waitFor();
      await ui.answerCheckIn(t, sheet, ui.normalAnswers('P01'));
      await ui.tap(sheet.getByRole('button', { name: /^Start session$/ }));
      await page.getByRole('button', { name: 'Start', exact: true }).waitFor();
      const unmute = main.getByRole('button', { name: 'Unmute', exact: true });
      if (await unmute.count()) {
        await ui.tap(unmute);
        await page.waitForTimeout(2500);
      }
      const voiceLine = (await main.innerText()).split('\n').find(l => /^Voice:|^Captions only/.test(l.trim())) ?? '';
      const voiceRequests = t.requests.filter(r => r.url.includes('/voice/'));
      t.note(`offline session start screen voice line: “${voiceLine}”; voice requests attempted: ${voiceRequests.length}`);
      // Truthful: captions, or the phone's own voice by name — never the recorded pack, which was never downloaded.
      await t.check(/captions/i.test(voiceLine) || (/^Voice: /.test(voiceLine) && !/Heart/.test(voiceLine)),
        `offline, with the recorded voice pack never downloaded, the start screen says “${voiceLine}”`);
      await t.checkpoint('offline-session-start');
      const violations = await page.evaluate(() => window.__acc.csp ?? []);
      await t.check(violations.length === 0, `CSP violations: ${violations.join('; ')}`);
      await t.context.setOffline(false);
    });
  },
};

const navigation = {
  name: 'navigation, origins and full-screen tasks',
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/today' });
    const main = page.getByRole('main');

    await t.step(2, 'Each root, You and its editors, Done; details from Track and Move and Back', async () => {
      for (const [tab, heading] of TABS) {
        await ui.tab(page, tab);
        const shown = await ui.heading(page, heading);
        await t.check(shown === heading, `${tab} tab shows “${shown}”`);
        await t.check(await page.getByRole('link', { name: /^You:/ }).count() === 1, `${tab} has no root You button`);
      }
      // You from Track on 25 September, through every editor, then Done back to that day.
      await ui.tab(page, 'Track');
      await ui.trackDay(page, '2026-09-25');
      const trackRoute = await t.route();
      await ui.tap(page.getByRole('link', { name: /^You:/ }));
      await h1(page).filter({ hasText: 'You' }).waitFor();
      for (const [label, heading] of YOU_EDITORS) {
        await ui.tap(ui.row(main, label, 'link'));
        const opened = await ui.heading(page, heading);
        await t.check(heading.test(opened), `${label} opened “${opened}”`);
        await t.checkpoint(`you-${label.replace(/\W+/g, '-').toLowerCase()}`);
        await ui.tap(ui.back(page, 'You'));
        const back = await ui.heading(page, 'You');
        await t.check(back === 'You', `Back from ${label} landed on “${back}”`);
      }
      await ui.tap(ui.header(page).getByRole('button', { name: 'Done', exact: true }));
      await waitRoute(page, trackRoute);
      await ui.heading(page, 'My Day');
      await t.check(await t.route() === trackRoute, `Done from You returned to ${await t.route()}, not ${trackRoute}`);

      // A record detail from Track keeps the day on return.
      const session = main.locator('a[href="#/track/session/legacy-strength"]');
      await t.must(await session.count() === 1, `25 September shows ${await session.count()} links to the legacy session: ${(await main.innerText()).slice(0, 300)}`);
      await ui.tap(session);
      await page.waitForFunction(() => location.hash.startsWith('#/track/session/'), null, { timeout: 10000 }).catch(() => {});
      await ui.heading(page, /./);
      const detailRoute = await t.route();
      await t.checkpoint('track-session-detail');
      await ui.tap(ui.back(page, 'My Day'));
      await waitRoute(page, trackRoute);
      await ui.heading(page, 'My Day');
      await t.check(await t.route() === trackRoute, `Back from ${detailRoute} returned to ${await t.route()}, not ${trackRoute}`);

      // Trends → a metric → Back keeps the view.
      await ui.trackDay(page, '2026-10-08');
      await ui.tap(ui.radio(main.getByRole('radiogroup', { name: 'Show' }), 'Trends'));
      await page.waitForTimeout(400);
      const trendsRoute = await t.route();
      const metric = main.locator('a[href^="#/track/metric/weight"]');
      if (await metric.count() === 1) {
        await ui.tap(metric);
        await page.waitForFunction(() => location.hash.startsWith('#/track/metric/'), null, { timeout: 10000 }).catch(() => {});
        await t.checkpoint('metric-detail');
        await ui.tap(ui.back(page, 'My Day'));
        await waitRoute(page, trendsRoute);
        await t.check(await t.route() === trendsRoute, `Back from the weight detail returned to ${await t.route()}, not ${trendsRoute}`);
      } else {
        await t.check(false, 'Trends offers no weight metric to open');
      }

      // Move: a filtered exercise list → detail → Back keeps the filter.
      await ui.tab(page, 'Move');
      await ui.tap(ui.row(main, 'Find an exercise', 'link'));
      await ui.heading(page, 'Find an exercise');
      const search = main.getByRole('searchbox');
      await t.must(await search.count() === 1, 'Find an exercise has no search box');
      await ui.type(search, 'cat');
      await page.waitForTimeout(500);
      const listRoute = await t.route();
      const result = ui.row(main, 'Cat-Cow', 'link');
      await t.must(await result.count() === 1, `searching “cat” lists ${await result.count()} Cat-Cow links`);
      await ui.tap(result);
      await ui.heading(page, 'Cat-Cow');
      await t.checkpoint('exercise-detail');
      await ui.tap(ui.back(page, 'Exercises'));
      await waitRoute(page, listRoute);
      await ui.heading(page, 'Find an exercise');
      await t.check(await t.route() === listRoute && await search.inputValue() === 'cat', `Back from the exercise lost its filter: ${await t.route()} with “${await search.inputValue().catch(() => '')}”`);

      // Direct entry to a detail has a parent to go back to.
      await t.goto('/track/session/legacy-strength');
      await t.checkpoint('direct-session-detail');
      const back = ui.back(page, 'My Day');
      await t.check(await back.count() === 1, 'a cold-loaded session detail has no Back to My Day');
      if (await back.count() === 1) {
        await ui.tap(back);
        await page.waitForTimeout(500);
        await t.check((await t.route()).startsWith('/track'), `Back from a cold detail went to ${await t.route()}`);
      }
      // The session player stays full screen, and its exit goes back to where it was opened from.
      await t.goto('/session');
      await t.check(await page.getByRole('navigation', { name: 'Main' }).count() === 0, 'the session screen shows the tab bar');
      await t.checkpoint('session-full-screen');
      const exit = main.getByRole('button', { name: /^(Back|Back to Today)$/ });
      if (await exit.count()) {
        await ui.tap(exit);
        await page.waitForTimeout(500);
        await t.check(await t.route() === '/today', `leaving a cold-loaded session went to ${await t.route()}, not Today`);
      }
      // With no walk under way, the live address falls back to the walk's setup; a walk in progress is J10/J11's.
      await t.goto('/walk/live');
      const live = (await t.route()).startsWith('/walk/live');
      if (live) await t.check(await page.getByRole('navigation', { name: 'Main' }).count() === 0, 'the live walk screen shows the tab bar');
      else await t.check(await t.route() === '/walk' && await h1Text(page) === 'Walk', `a cold /walk/live with no walk went to ${await t.route()} (“${await h1Text(page)}”)`);
      await t.checkpoint('live-walk-cold');
    });
  },
};

const LEGACY = [
  ['/dashboard?from=bookmark', '/today?from=bookmark'],
  ['/workout?from=bookmark', '/track/workout?from=bookmark'],
  ['/plan?from=bookmark', '/move/plan?from=bookmark'],
  // The old library opened an exercise by `?ex=`; the exercise's own page honours it.
  ['/library?ex=goblet-squat', ['/move/exercises?ex=goblet-squat', '/move/exercises/goblet-squat']],
  ['/progress?from=bookmark', '/track?from=bookmark'],
  ['/history?from=bookmark', '/track?from=bookmark'],
  ['/settings?from=bookmark', '/you?from=bookmark'],
  ['/profile?from=bookmark', '/you/profile?from=bookmark'],
];

const UNKNOWN = ['/today/nope', '/move/nope', '/move/exercises/no-such-exercise', '/walk/nope', '/track/nope', '/track/session/no-such-session',
  '/track/workout/nope/deeper', '/guide/nope', '/guide/topic/no-such-topic', '/you/nope', '/session/nope', '/nope'];

const routes = {
  name: 'legacy and unknown routes, failed lazy screen',
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/today' });
    const main = page.getByRole('main');

    await t.step(3, 'Legacy hash routes with query strings', async () => {
      for (const [from, to] of LEGACY) {
        await t.goto(from);
        await page.waitForTimeout(400);
        // Today and Track tidy their own sheet-opening parameters; the rest must arrive intact.
        const want = Array.isArray(to) ? to : [to];
        await t.check(want.includes(await t.route()), `${from} arrived at ${await t.route()}, not ${want.join(' or ')}`);
        await t.check(!(await failedScreen(page)) && (await h1(page).count()) >= 1, `${from} shows no screen`);
        const tabs = await page.getByRole('navigation', { name: 'Main' }).getByRole('link').allInnerTexts();
        await t.check(tabs.map(s => s.trim()).join('|') === 'Today|Move|Track|Guide', `${from}: tab bar ${tabs.join('|')}`);
      }
      await t.goto('/dashboard?checkin=1');
      await page.waitForTimeout(600);
      await t.check(await page.getByRole('dialog', { name: ui.CHECKIN }).count() === 1, `/dashboard?checkin=1 did not open the check-in (route ${await t.route()})`);
      await t.checkpoint('legacy-dashboard-checkin');
    });

    await t.step(4, 'Unknown children under every subtree; one lazy screen fails', async () => {
      for (const route of UNKNOWN) {
        await t.goto(route);
        await page.waitForTimeout(500);
        const heading = await h1Text(page);
        const text = (await main.innerText().catch(() => '')).trim();
        await t.check(heading.length > 0 && text.length > 20, `${route} → ${await t.route()} shows an empty screen (heading “${heading}”)`);
        const full = /^\/(session|walk\/live)/.test(await t.route());
        if (!full) {
          const nav = await page.getByRole('navigation', { name: 'Main' }).getByRole('link').count();
          await t.check(nav === 4, `${route} → ${await t.route()} has no usable tab bar (${nav} tabs)`);
        }
      }
      await t.checkpoint('unknown-route');
      // One lazy screen download fails: the Guide area's code.
      await ui.tab(page, 'Today');
      const pattern = /\/src\/screens\/guide\/routes\.tsx/;
      t.allowConsole('screens/guide/routes.tsx');
      await page.route(pattern, r => r.abort());
      await ui.tap(ui.link(page.getByRole('navigation', { name: 'Main' }), 'Guide'));
      await page.waitForTimeout(1500);
      await t.check(await failedScreen(page), `a failed Guide download shows “${await h1Text(page)}” rather than a recovery screen`);
      await t.check(await page.getByRole('navigation', { name: 'Main' }).getByRole('link').count() === 4, 'the tab bar went away with the failed screen');
      await t.checkpoint('lazy-failure');
      await page.unroute(pattern);
      const retry = main.getByRole('button', { name: 'Try again', exact: true });
      await t.must(await retry.count() === 1, 'the failed screen offers no Try again');
      await ui.tap(retry);
      await page.waitForTimeout(1500);
      if (await failedScreen(page)) {
        await ui.tap(main.getByRole('button', { name: 'Reload the app', exact: true }));
        await t.ready();
      }
      await t.check(await h1Text(page) === 'Guide', `after the download came back, Guide shows “${await h1Text(page)}”`);
      await ui.tab(page, 'Today');
      await t.check(await h1Text(page) === 'Today', 'navigation is not usable after the recovery');
    });
  },
};

const storage = {
  name: 'storage unavailable at boot, then retry',
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/today' });
    const main = page.getByRole('main');
    let before;
    let blob;

    await t.step(5, 'IndexedDB opening unavailable, reload', async () => {
      before = await t.checkpoint('before-fault');
      blob = (await t.storage()).local['fit-strong-90-data'];
      await t.setFaults([{ op: 'open', action: 'throwUnknown' }]);
      t.allowConsole('acceptance-injected');
      await t.reload();
      const heading = await h1Text(page);
      await t.check(heading !== 'Welcome' && !/^\/welcome/.test(await t.route()), `with storage unavailable the app shows first-run setup (“${heading}”, ${await t.route()})`);
      await t.check(/storing data|can’t open|Try again/i.test(await main.innerText()), `no storage-unavailable state: ${(await main.innerText()).slice(0, 200)}`);
      await t.check(await main.getByRole('button', { name: 'Try again', exact: true }).count() === 1, 'no Try again on the storage-unavailable screen');
      const during = await t.checkpoint('storage-unavailable');
      await t.check(diffDb(before, during) === '(no database change)', `the stored record changed while storage was unavailable: ${diffDb(before, during)}`);
      await t.check((await t.storage()).local['fit-strong-90-data'] === blob, 'the legacy v4 blob changed');
      // Going on without saving must not present the saved person as new.
      const goOn = main.getByRole('button', { name: 'Continue without saving', exact: true });
      if (await goOn.count()) {
        await ui.tap(goOn);
        await page.waitForTimeout(800);
        const after = await h1Text(page);
        await t.check(after !== 'Welcome' && !/^\/welcome/.test(await t.route()), `“Continue without saving” sends an existing person to first-run setup (“${after}”, ${await t.route()})`);
        await t.checkpoint('continue-without-saving');
      }
    });

    await t.step(6, 'Remove the fault and retry', async () => {
      await t.setFaults(null);
      await t.reload();
      await t.check(await h1Text(page) === 'Today', `after the fault cleared the app shows “${await h1Text(page)}”, not Today`);
      const after = await t.checkpoint('after-retry');
      const changes = diffDb(before, after);
      await t.check(changes === '(no database change)', `the record did not come back exactly: ${changes}`);
      const dark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      await t.check(dark === (t.project.scheme === 'dark'), `appearance is ${dark ? 'dark' : 'light'} in a ${t.project.scheme} project`);
      await t.check(docs(after).settings?.onboardingComplete === true, 'onboarding state was lost');
    });
  },
};

export const cases = [offline, navigation, routes, storage];
