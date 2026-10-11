/**
 * J01, P07: Look around first without accidental enrolment
 * (codex-acceptance.md; basis D4, D6, D8, D16, D23).
 */
import { docs } from '../lib/harness.mjs';
import * as ui from '../lib/ui.mjs';
import * as mv from '../lib/move.mjs';
import * as setup from '../lib/setup.mjs';

export const id = 'J01';
export const title = 'Look around first without accidental enrolment';
export const safety = false;

const CHOOSER = ['Stretch', 'Walk', 'Guided session', 'Log something', 'Learn'];

export const cases = [{
  name: 'look around first',
  async run(t) {
    const page = t.page ?? await t.open({ seed: null, route: '' });
    const main = page.getByRole('main');

    await t.step(1, 'Fresh context at the app root: setup’s page 1', async () => {
      await t.must(await t.route() === '/setup', `the app root opened ${await t.route()}, not setup`);
      await t.must(await main.getByRole('heading', { level: 1, name: 'Welcome', exact: true }).count() === 1, 'no Welcome heading');
      const text = (await main.innerText()).replace(/\s+/g, ' ');
      await t.check(text.includes('Your health, in one place.'), 'no “Your health, in one place.”');
      await t.check(/Your records are stored on this (device|iPhone|iPad)\./.test(text), 'no privacy line (B-24)');
      await t.check(/Clearing this browser’s data would delete it|Installing helps/.test(text), 'no line on keeping data here (§6.5)');
      for (const name of ['Get started', 'Restore from a backup', 'Look around first']) await t.check(await ui.button(main, name).count() === 1, `no “${name}”`);
      await t.check(await ui.row(main, 'Display').count() === 1, 'no Display row (A-66)');
      const calls = await page.evaluate(() => window.__acc.calls);
      await t.check(calls.geolocation === 0 && calls.notification === 0 && calls.motion === 0
        && !calls.permissionsQuery.some(n => ['geolocation', 'notifications', 'accelerometer', 'gyroscope'].includes(n)),
        `a permission or sensor was requested on page 1: ${JSON.stringify(calls)}`);
      await t.checkpoint('setup-page-1');
    });

    await t.step(2, 'Look around first, then reload at the next checkpoint', async () => {
      await ui.tap(ui.button(main, 'Look around first'));
      await page.getByRole('heading', { level: 1, name: ui.HOME_TITLE }).waitFor();
      await t.reload();
      await page.getByRole('heading', { level: 1, name: ui.HOME_TITLE }).waitFor();
      const d = docs(await t.checkpoint('after-look-around-reload'));
      await t.check(d.settings?.setup?.stage === 'lookAround' && d.settings?.onboardingComplete === true && !d.profile,
        `after Look around first: ${JSON.stringify({ setup: d.settings?.setup, onboarded: d.settings?.onboardingComplete, profile: !!d.profile })}`);
      const persist = await page.evaluate(async () => ({ calls: window.__acc.calls.persist ?? null, granted: await navigator.storage?.persisted?.() }));
      await t.check(persist.calls === null || persist.calls > 0 || persist.granted === true, `navigator.storage.persist() was never attempted (${JSON.stringify(persist)})`);
    }, { input: 'Look around first' });

    await t.step(3, 'Home: four tabs, Finish setting up, no start date', async () => {
      const tabs = page.getByRole('navigation', { name: 'Main' }).getByRole('link');
      await t.check((await tabs.allInnerTexts()).map(s => s.trim()).join('|') === 'Home|Trends|Browse|Me', `tabs are ${(await tabs.allInnerTexts()).join('|')}`);
      const card = ui.rightNow(page);
      const text = (await card.innerText()).replace(/\s+/g, ' ');
      await t.check(/Finish setting up/.test(text), `Right now does not say Finish setting up: ${text.slice(0, 200)}`);
      await t.check(await card.getByRole('button', { name: 'Carry on setting up' }).count() + await card.getByRole('link', { name: 'Carry on setting up' }).count() === 1,
        'no “Carry on setting up”');
      const snap = await t.checkpoint('home-first');
      await t.check(!docs(snap).settings?.startDate, `startDate was set to ${docs(snap).settings?.startDate}`);
    });

    await t.step(4, 'Something else: five rows in fixed order', async () => {
      const opener = ui.button(main, 'Something else');
      await ui.tap(opener);
      const sheet = page.getByRole('dialog');
      await sheet.waitFor();
      const rows = await sheet.getByRole('button').filter({ hasNot: page.getByText('Close', { exact: true }) }).all();
      const labels = [];
      for (const r of rows) {
        const label = (await r.locator('span.block').first().innerText().catch(() => '')).trim();
        if (label && label !== 'Close') labels.push(label);
      }
      await t.check(labels.join('|') === CHOOSER.join('|'), `chooser rows are ${JSON.stringify(labels)}, not ${JSON.stringify(CHOOSER)}`);
      await t.check(!/\bAsk\b|assistant|chat/i.test(await sheet.innerText()), 'the chooser offers an Ask/assistant/chat row');
      await t.check(await sheet.getByRole('textbox').count() === 0, 'the chooser has a text composer');
      await t.checkpoint('chooser');
      await ui.tap(ui.button(sheet, 'Close'));
      await sheet.waitFor({ state: 'hidden' });
      await page.waitForTimeout(300);
      const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
      await t.check(focused === 'Something else', `closing the chooser left focus on “${focused}”, not its opener`);
    });

    await t.step(5, 'Learn, return, then Log something: steps 2000 for 7 October', async () => {
      await ui.tap(ui.button(main, 'Something else'));
      await ui.tap(ui.row(page.getByRole('dialog'), 'Learn'));
      await page.getByRole('heading', { level: 1, name: 'Learn', exact: true }).waitFor();
      // Its skeleton has the title too: read the hub once its content is in.
      await ui.loaded(page);
      await t.check((await main.innerText()).length > 200, 'Guide has no readable content');
      await t.checkpoint('guide');
      await ui.tap(ui.link(page.getByRole('navigation', { name: 'Main' }), 'Home'));
      await page.getByRole('heading', { level: 1, name: ui.HOME_TITLE }).waitFor();
      await ui.tap(ui.button(main, 'Something else'));
      await ui.tap(ui.row(page.getByRole('dialog'), 'Log something'));
      await page.waitForTimeout(600);
      // v1's Track is v2's Today's log, /day/today (journey §13).
      await t.check((await t.route()).startsWith('/day/'), `Log something opened ${await t.route()}, not Today’s log`);
      const add = page.getByRole('dialog', { name: 'Add' });
      await add.waitFor();
      await ui.tap(ui.row(add, 'Steps'));
      const steps = page.getByRole('dialog', { name: 'Steps' });
      await ui.type(steps.getByRole('textbox', { name: 'Steps for the day', exact: true }), '2000');
      await ui.tap(ui.row(steps, 'Day'));
      await ui.setDate(steps.getByLabel(/^Day/), '2026-10-07');
      await t.checkpoint('steps-form');
      await ui.tap(ui.button(steps, 'Save'));
      await steps.waitFor({ state: 'hidden' });
      const snap = await t.checkpoint('after-steps-save');
      const obs = snap.observations ?? [];
      const steps7 = obs.filter(o => o.kind === 'steps');
      await t.check(steps7.length === 1 && steps7[0].value === 2000 && steps7[0].day === '2026-10-07' && steps7[0].scope === 'dayTotal' && steps7[0].source === 'manual',
        `steps observations: ${JSON.stringify(steps7.map(o => ({ v: o.value, day: o.day, scope: o.scope, source: o.source })))}`);
      // The record for 7 October, as shown.
      await ui.trackDay(page, '2026-10-07');
      const day7 = await main.innerText();
      await t.check(/2,?000/.test(day7) && /Manual/i.test(day7), `7 October does not show 2000 steps labelled Manual: ${day7.slice(0, 300)}`);
      await t.checkpoint('track-7-october');
      await ui.trackDay(page, '2026-10-08');
      const dayToday = await main.innerText();
      await t.checkpoint('track-today');
      await ui.tap(ui.radio(main.getByRole('radiogroup', { name: 'Show' }), 'Trends'));
      await page.waitForTimeout(400);
      const trends = await main.innerText();
      const notEntered = /Steps[^\n]*\n?[^\n]*Not entered/.test(dayToday) || /Steps\n(?:[^\n]*\n)?Not entered/.test(trends);
      await t.check(notEntered, `no screen says today’s steps are “Not entered”. My Day today: “${dayToday.replace(/\n/g, ' ⏎ ').slice(0, 160)}”; Trends: “${(trends.split('Steps')[1] ?? '').replace(/\n/g, ' ⏎ ').slice(0, 120)}”`);
      await t.checkpoint('trends-today');
    }, { input: 'steps 2000 for 2026-10-07' });

    await t.step(6, 'Stretch held; Carry on setting up; P07’s answers; Start using; Stretch → the check-in', async () => {
      await ui.tab(page, 'Home');
      const held = await mv.enter(t, 'stretch', 'move');
      const heldText = (await (held.sheet ?? main).innerText()).replace(/\s+/g, ' ');
      await t.check(!held.sheet || await mv.sheetStart(held.sheet).count() === 0, 'Stretch offered a Start before the health questions');
      await t.check(/health questions|setting up/i.test(heldText), `the hold does not say the health questions come first: ${heldText.slice(0, 200)}`);
      if (held.sheet) await ui.tap(ui.button(held.sheet, 'Close'));
      await ui.tab(page, 'Home');
      const carryOn = ui.rightNow(page).getByRole('button', { name: 'Carry on setting up' }).or(ui.rightNow(page).getByRole('link', { name: 'Carry on setting up' }));
      await ui.tap(carryOn);
      await ui.heading(page, 'Welcome');
      await setup.throughSetup(t, setup.P07);
      await t.checkpoint('review');
      await setup.startUsing(t);
      const again = await mv.enter(t, 'stretch', 'move');
      await t.must(!!again.sheet, `Stretch opened no check-in after setup (${again.route})`);
      await ui.answerCheckIn(t, again.sheet, ui.normalAnswers('P07'));
      await t.checkpoint('stretch-permission');
      await t.check(await mv.sheetStart(again.sheet).count() === 1, `no permission-approved start after setup: ${(await again.sheet.innerText()).replace(/\s+/g, ' ').slice(0, 300)}`);
    }, { input: 'P07’s answers; normal current answers' });

    await t.step(7, 'Cancel before active movement, reload, open Me', async () => {
      const sheet = page.getByRole('dialog', { name: ui.CHECKIN });
      if (await sheet.count()) await ui.tap(ui.button(sheet, 'Close'));
      await t.reload();
      await ui.tab(page, 'Me');
      await page.getByRole('heading', { level: 1, name: 'Me', exact: true }).waitFor();
      const snap = await t.checkpoint('me-after-reload');
      const d = docs(snap);
      await t.check(await main.getByRole('heading', { name: /^Finish setting up/ }).count() === 0, 'Me still has Finish setting up after a whole run');
      await t.check(d.settings?.focus === 'explore', `focus is ${d.settings?.focus}`);
      await t.check(!d.settings?.startDate, `startDate is ${JSON.stringify(d.settings?.startDate)}, not empty`);
      await t.check(d.settings?.setup?.stage === 'done' && typeof d.settings?.setup?.completedAt === 'string', `settings.setup: ${JSON.stringify(d.settings?.setup).slice(0, 200)}`);
      await t.check((snap.sessions ?? []).length === 0, `${(snap.sessions ?? []).length} session(s) were created`);
      await t.check(!!d.profile && d.profile.health?.diabetes === 'none' && d.profile.health?.hypertension === 'none' && (d.profile.pain?.areas ?? []).length === 0,
        `the profile does not reflect the answers: ${JSON.stringify(d.profile?.health ?? null).slice(0, 200)}`);
      const kinds = (snap.observations ?? []).map(o => o.kind);
      await t.check(kinds.every(k => k === 'steps'), `observations other than the entered steps exist: ${kinds.join(', ')}`);
    });
  },
}];
