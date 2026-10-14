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

/** v2's four tabs and each root's title (journey §5): Home's is its greeting. */
const TABS = [['Home', ui.HOME_TITLE], ['Trends', 'Trends'], ['Browse', 'Browse'], ['Me', 'Me']];
/** v1's other tabs, at their v2 places (`ui.legacyTab`): Move is the Workout hub, Track is Today's log, Guide the Learn hub. */
const PLACES = [['Move', 'Workout'], ['Track', 'Today’s log'], ['Guide', 'Learn']];
/** A shown title against a string (exact) or a pattern. */
const titled = (shown, want) => (want instanceof RegExp ? want.test(shown) : shown === want);
/** Me's sections (journey §16), each opened from Me and Back to it. The focus is Profile & health's Your movement now (Plan 5). */
const YOU_EDITORS = [
  ['Profile & health', /^Profile & health$/],
  ['Goals', /^Goals$/],
  ['Food', /^Food$/],
  ['Reminders', /^Reminders$/],
  ['Voice & demos', /^Voice & demos$/],
  ['Display', /^Display$/],
  ['Data', /^Data$/],
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
    const page = await t.open({ seed: persona('P01'), route: '/home', contextOptions: { serviceWorkers: 'allow' } });
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
      // Online warm-up: every root, the hubs v1's tabs became, the editors, a detail and the player's ready screen (v2 addresses, journey §19.2).
      for (const route of ['/hub/workout', '/hub/stretch', '/hub/workout/plan', '/hub/workout/exercises', '/hub/walk', '/day/today', '/trends', '/hub/learn', '/hub/learn/sources', '/browse', '/me', '/me/data', '/me/voice', '/session']) {
        await t.hash(route);
        await page.waitForTimeout(500);
      }
      await t.hash('/home');
      await t.checkpoint('online-warm');
      await t.context.setOffline(true);
      await t.reload();
      await t.check(ui.HOME_TITLE.test(await h1Text(page)), `offline reload shows “${await h1Text(page)}”, not Home`);
      await t.checkpoint('offline-today');
      for (const [tab, heading] of [...TABS, ...PLACES]) {
        if (Object.hasOwn(ui.LEGACY, tab)) await ui.legacyTab(page, tab);
        else await ui.tab(page, tab);
        await page.waitForTimeout(600);
        await t.check(!(await failedScreen(page)) && titled(await h1Text(page), heading), `offline ${tab} shows “${await h1Text(page)}”${await failedScreen(page) ? ' (the screen did not load)' : ''}`);
        await t.checkpoint(`offline-${tab.toLowerCase()}`);
      }
      // Authored guidance opens offline.
      await ui.legacyTab(page, 'Guide');
      const topic = main.getByRole('link').filter({ hasText: 'Vitamin B12' });
      if (await topic.count()) {
        await ui.tap(topic);
        await page.waitForTimeout(600);
        await t.check(!(await failedScreen(page)) && (await main.innerText()).length > 300, 'an authored Guide topic does not open offline');
        await t.checkpoint('offline-guide-topic');
      }
      // Me (v1's You) and its data screen report the truth about offline use.
      await ui.tab(page, 'Me');
      await ui.tap(ui.row(main, 'Data', 'link'));
      await page.waitForTimeout(500);
      const data = await main.innerText();
      await t.check(/Works offline[\s\S]{0,80}\bYes\b/.test(data), `Data does not say the app works offline while it does: ${data.replace(/\n/g, ' ⏎ ').slice(0, 300)}`);
      await t.checkpoint('offline-data');
      // An optional voice asset that was never downloaded: captions, and no claim of a voice.
      // The player's start screen is behind today's check-in, answered offline.
      await ui.tab(page, 'Home');
      await ui.tap(ui.rightNow(page).getByRole('button'));
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
    const page = await t.open({ seed: persona('P01'), route: '/home' });
    const main = page.getByRole('main');

    await t.step(2, 'Each root, Me and its sections, back to Home’s place; details from My Day and Move and Back', async () => {
      // v1's You button on each root is v2's Me tab, in the tab bar of every screen in the shell (journey §5).
      for (const [tab, heading] of TABS) {
        await ui.tab(page, tab);
        const shown = await ui.heading(page, heading);
        await t.check(titled(shown, heading), `${tab} tab shows “${shown}”`);
        await t.check(await ui.link(page.getByRole('navigation', { name: 'Main' }), 'Me').count() === 1, `${tab} has no Me tab`);
      }
      // v1's Move, Track and Guide tabs, at their v2 places.
      for (const [place, heading] of PLACES) {
        await ui.legacyTab(page, place);
        const shown = await ui.heading(page, heading);
        await t.check(shown === heading, `${place} (${ui.LEGACY[place].path}) shows “${shown}”`);
      }
      // Me from My Day on 25 September, through every editor, then Done back to that day.
      await ui.legacyTab(page, 'Track');
      await ui.trackDay(page, '2026-09-25');
      const trackRoute = await t.route();
      await ui.tab(page, 'Me');
      for (const [label, heading] of YOU_EDITORS) {
        await ui.tap(ui.row(main, label, 'link'));
        const opened = await ui.heading(page, heading);
        await t.check(heading.test(opened), `${label} opened “${opened}”`);
        await t.checkpoint(`you-${label.replace(/\W+/g, '-').toLowerCase()}`);
        await ui.tap(ui.back(page, 'Me'));
        const back = await ui.heading(page, 'Me');
        await t.check(back === 'Me', `Back from ${label} landed on “${back}”`);
      }
      // Me is a tab (journey §5, D63): Home's tab goes back to the place it was left, My Day on 25 September.
      await ui.tap(ui.link(page.getByRole('navigation', { name: 'Main' }), 'Home'));
      await waitRoute(page, trackRoute);
      await ui.heading(page, 'Today’s log');
      await t.check(await t.route() === trackRoute, `Home’s tab from Me returned to ${await t.route()}, not ${trackRoute}`);

      // A record detail from My Day keeps the day on return.
      const session = main.locator('a[href="#/track/session/legacy-strength"]');
      await t.must(await session.count() === 1, `25 September shows ${await session.count()} links to the legacy session: ${(await main.innerText()).slice(0, 300)}`);
      await ui.tap(session);
      await page.waitForFunction(() => location.hash.startsWith('#/track/session/'), null, { timeout: 10000 }).catch(() => {});
      await ui.heading(page, /./);
      const detailRoute = await t.route();
      await t.checkpoint('track-session-detail');
      await ui.tap(ui.back(page, 'Today’s log'));
      await waitRoute(page, trackRoute);
      await ui.heading(page, 'Today’s log');
      await t.check(await t.route() === trackRoute, `Back from ${detailRoute} returned to ${await t.route()}, not ${trackRoute}`);

      // Trends → a metric → Back keeps the view.
      await ui.trackDay(page, '2026-10-08');
      await ui.tap(ui.radio(main.getByRole('radiogroup', { name: 'Show' }), 'Measures'));
      await page.waitForTimeout(400);
      const trendsRoute = await t.route();
      // My Day's measure rows still link to v1's /track/metric/…, which goes on to the hub (journey §19.3).
      const metric = main.locator('a[href^="#/track/metric/weight"]');
      if (await metric.count() === 1) {
        await ui.tap(metric);
        await page.waitForFunction(() => location.hash.startsWith('#/hub/weight'), null, { timeout: 10000 }).catch(() => {});
        await t.checkpoint('metric-detail');
        await ui.tap(ui.back(page, 'Today’s log'));
        await waitRoute(page, trendsRoute);
        await t.check(await t.route() === trendsRoute, `Back from the weight detail returned to ${await t.route()}, not ${trendsRoute}`);
      } else {
        await t.check(false, 'Trends offers no weight metric to open');
      }

      // Move (the Workout hub): a filtered exercise list → detail → Back keeps the filter.
      await ui.legacyTab(page, 'Move');
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
      const back = ui.back(page, 'Today’s log');
      await t.check(await back.count() === 1, 'a cold-loaded session detail has no Back to Today’s log');
      if (await back.count() === 1) {
        await ui.tap(back);
        await page.waitForTimeout(500);
        await t.check((await t.route()).startsWith('/day/'), `Back from a cold detail went to ${await t.route()}`);
      }
      // A hub opened by a link goes Back to Home (journey §8.1, §19.1), not to v1's Move.
      for (const [route, heading] of [['/hub/stretch', 'Stretch'], ['/hub/walk', 'Walk']]) {
        await t.goto(route);
        await ui.heading(page, heading);
        const home = ui.back(page, 'Home');
        await t.check(await home.count() === 1, `a cold ${route} has no Back to Home`);
        if (await home.count() === 1) {
          await ui.tap(home);
          await waitRoute(page, '/home');
          await t.check(await t.route() === '/home', `Back from a cold ${route} went to ${await t.route()}, not Home`);
        }
      }
      // The session player stays full screen, and its exit goes back to where it was opened from.
      await t.goto('/session');
      await t.check(await page.getByRole('navigation', { name: 'Main' }).count() === 0, 'the session screen shows the tab bar');
      await t.checkpoint('session-full-screen');
      const exit = main.getByRole('button', { name: /^(Back|Back to Home)$/ });
      if (await exit.count()) {
        await ui.tap(exit);
        await page.waitForTimeout(500);
        await t.check(await t.route() === '/home', `leaving a cold-loaded session went to ${await t.route()}, not Home`);
      }
      // With no walk under way, the live address falls back to the walk's setup; a walk in progress is J10/J11's.
      await t.goto('/walk/live');
      const live = (await t.route()).startsWith('/walk/live');
      if (live) await t.check(await page.getByRole('navigation', { name: 'Main' }).count() === 0, 'the live walk screen shows the tab bar');
      // The walk's setup is the Walk hub, v1's /walk (journey §19.2).
      else await t.check(await t.route() === '/hub/walk' && await h1Text(page) === 'Walk', `a cold /walk/live with no walk went to ${await t.route()} (“${await h1Text(page)}”)`);
      await t.checkpoint('live-walk-cold');
    });
  },
};

/** v4's addresses, through v1's, to their v2 places with their query (journey §19.3, src/redirects.ts). */
const LEGACY = [
  ['/dashboard?from=bookmark', '/home?from=bookmark'],
  // v1's Workout Log is the Workout hub's log now (D51); its trend is Trends'.
  ['/workout?from=bookmark', '/hub/workout/log?from=bookmark'],
  ['/plan?from=bookmark', '/hub/workout/plan?from=bookmark'],
  // The old library opened an exercise by `?ex=`; the exercise's own page honours it.
  ['/library?ex=goblet-squat', ['/hub/workout/exercises?ex=goblet-squat', '/hub/workout/exercises/goblet-squat']],
  ['/progress?from=bookmark', '/day/today?from=bookmark'],
  ['/history?from=bookmark', '/day/today?from=bookmark'],
  ['/settings?from=bookmark', '/me?from=bookmark'],
  ['/profile?from=bookmark', '/me/profile?from=bookmark'],
];

/** Unknown children under every subtree: v2's, and v1's, whose addresses are now legacy ones. */
const UNKNOWN = ['/home/nope', '/hub/nope', '/hub/workout/nope', '/day/nope', '/trends/nope', '/browse/nope', '/me/nope',
  '/today/nope', '/move/nope', '/move/exercises/no-such-exercise', '/walk/nope', '/track/nope', '/track/session/no-such-session',
  '/track/workout/nope/deeper', '/guide/nope', '/guide/topic/no-such-topic', '/you/nope', '/session/nope', '/nope'];

const routes = {
  name: 'legacy and unknown routes, failed lazy screen',
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/home' });
    const main = page.getByRole('main');

    await t.step(3, 'Legacy hash routes with query strings', async () => {
      for (const [from, to] of LEGACY) {
        await t.goto(from);
        await page.waitForTimeout(400);
        // Home and My Day tidy their own sheet-opening parameters; the rest must arrive intact.
        const want = Array.isArray(to) ? to : [to];
        await t.check(want.includes(await t.route()), `${from} arrived at ${await t.route()}, not ${want.join(' or ')}`);
        await t.check(!(await failedScreen(page)) && (await h1(page).count()) >= 1, `${from} shows no screen`);
        const tabs = await page.getByRole('navigation', { name: 'Main' }).getByRole('link').allInnerTexts();
        await t.check(tabs.map(s => s.trim()).join('|') === 'Home|Trends|Browse|Me', `${from}: tab bar ${tabs.join('|')}`);
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
      // One lazy screen download fails: the Guide area's code, the Learn hub's, opened from Browse (v1's Guide tab).
      await ui.tab(page, 'Browse');
      const pattern = /\/src\/screens\/guide\/routes\.tsx/;
      t.allowConsole('screens/guide/routes.tsx');
      await page.route(pattern, r => r.abort());
      await ui.tap(ui.LEGACY.Guide.link(main));
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
      await t.check(await h1Text(page) === 'Learn', `after the download came back, Learn shows “${await h1Text(page)}”`);
      await ui.tab(page, 'Home');
      await t.check(ui.HOME_TITLE.test(await h1Text(page)), 'navigation is not usable after the recovery');
    });
  },
};

const storage = {
  name: 'storage unavailable at boot, then retry',
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/home' });
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
      // First-run setup is /setup in v2 (journey §19.2), v1's /welcome.
      await t.check(heading !== 'Welcome' && !/^\/(setup|welcome)/.test(await t.route()), `with storage unavailable the app shows first-run setup (“${heading}”, ${await t.route()})`);
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
        await t.check(after !== 'Welcome' && !/^\/(setup|welcome)/.test(await t.route()), `“Continue without saving” sends an existing person to first-run setup (“${after}”, ${await t.route()})`);
        await t.checkpoint('continue-without-saving');
      }
    });

    await t.step(6, 'Remove the fault and retry', async () => {
      await t.setFaults(null);
      await t.reload();
      await t.check(ui.HOME_TITLE.test(await h1Text(page)), `after the fault cleared the app shows “${await h1Text(page)}”, not Home`);
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
