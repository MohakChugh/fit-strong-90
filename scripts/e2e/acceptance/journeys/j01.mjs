/**
 * J01, P07: Explore first without accidental enrolment
 * (codex-acceptance.md; basis D4, D6, D8, D16, D23).
 */
import { docs } from '../lib/harness.mjs';
import * as ui from '../lib/ui.mjs';
import * as mv from '../lib/move.mjs';

export const id = 'J01';
export const title = 'Explore first without accidental enrolment';
export const safety = false;

const CHOOSER = ['Stretch', 'Walk', 'Guided session', 'Log something', 'Learn'];

/** Answer P07's first-movement questions in the shared profile wizard, whichever steps it shows. */
export async function answerWizardP07(t) {
  const page = t.page;
  // First run shows the wizard as a screen; from You it opens as a cover (a dialog) over Profile & health.
  const cover = page.getByRole('dialog', { name: 'Edit your answers' });
  const main = (await cover.count()) ? cover : page.getByRole('main');
  for (let guard = 0; guard < 6; guard++) {
    const heading = (await main.getByRole('heading', { level: 1 }).innerText()).trim();
    if (heading === 'Your body') {
      await ui.tap(ui.checkbox(main.getByRole('group', { name: 'Pain or past injury' }).getByRole('group', { name: 'Pain or past injury' }), 'None'));
      if (await ui.checkbox(main, 'None').getAttribute('aria-checked') === 'false') await ui.tap(ui.checkbox(main, 'None'));
    } else if (heading === 'Your health') {
      await ui.tap(ui.radio(main.getByRole('radiogroup', { name: 'Diabetes' }), 'None'));
      await ui.tap(ui.radio(main.getByRole('radiogroup', { name: 'High blood pressure' }), 'None'));
      const other = main.getByRole('group', { name: 'Anything else?' }).getByRole('group', { name: 'Anything else?' });
      if (await ui.checkbox(other, 'None').getAttribute('aria-checked') !== 'true') await ui.tap(ui.checkbox(other, 'None'));
      for (const q of await main.getByRole('radiogroup').all()) {
        const name = await q.getAttribute('aria-label');
        if (/^An SGLT2|limit how much you drink/.test(name ?? '')) await ui.tap(ui.radio(q, 'No'));
      }
    } else if (/^(Before you start|Your plan)$/.test(heading)) {
      const boxes = main.getByRole('checkbox');
      for (const box of await boxes.all()) if (await box.getAttribute('aria-checked') !== 'true' && !(await box.isChecked().catch(() => false))) await ui.tap(box);
      const finish = main.getByRole('button', { name: /^(Save my answers|Save|Build my plan)$/ });
      await ui.tap(finish);
      return;
    } else {
      return;
    }
    await ui.tap(ui.button(main, 'Continue'));
    await page.waitForTimeout(300);
  }
}

export const cases = [{
  name: 'explore first',
  async run(t) {
    const page = t.page ?? await t.open({ seed: null, route: '' });
    const main = page.getByRole('main');

    await t.step(1, 'Fresh context at the app root', async () => {
      await t.must(await t.route() === '/welcome', `the app root opened ${await t.route()}, not the welcome screen`);
      await t.must(await main.getByRole('heading', { level: 1, name: 'Welcome', exact: true }).count() === 1, 'no Welcome heading');
      await t.check(await main.getByText('What would you like more of?', { exact: true }).count() === 1, 'no “What would you like more of?”');
      for (const label of ['Build strength', 'Stretch comfortably', 'Move more']) {
        await t.check(await ui.row(main, label).count() === 1, `no “${label}” choice`);
      }
      await t.check(await ui.button(main, 'Explore first').count() === 1, 'no “Explore first” choice');
      await t.check(/stays on this (device|iPhone|iPad)[^.]*\.\s*There is no account, and nothing is sent anywhere/.test(await main.innerText()), 'no local-only explanation on Welcome');
      const calls = await page.evaluate(() => window.__acc.calls);
      await t.check(calls.geolocation === 0 && calls.notification === 0 && calls.motion === 0
        && !calls.permissionsQuery.some(n => ['geolocation', 'notifications', 'accelerometer', 'gyroscope'].includes(n)),
        `a permission or sensor was requested on Welcome: ${JSON.stringify(calls)}`);
      await t.checkpoint('welcome');
    });

    await t.step(2, 'Explore first, then reload at the next checkpoint', async () => {
      await ui.tap(ui.button(main, 'Explore first'));
      await page.waitForTimeout(500);
      const nextRoute = await t.route();
      await t.reload();
      const snap = await t.checkpoint('after-explore-first-reload');
      await t.check(docs(snap).settings?.focus === 'explore', `settings.focus is ${JSON.stringify(docs(snap).settings?.focus)}, not 'explore'`);
      await t.check(await t.route() === nextRoute, `reload moved from ${nextRoute} to ${await t.route()}`);
      const persist = await page.evaluate(async () => ({ calls: window.__acc.calls.persist ?? null, granted: await navigator.storage?.persisted?.() }));
      await t.check(persist.calls === null || persist.calls > 0 || persist.granted === true, `navigator.storage.persist() was never attempted (${JSON.stringify(persist)})`);
      t.note(`after Explore first the app opened ${nextRoute}; navigator.storage.persist: ${JSON.stringify(persist)}`);
    }, { input: 'Explore first' });

    let explanationSeen = false;
    await t.step(3, 'Continue to Today without enrolling or giving a medical history', async () => {
      // The spec allows browsing Guide and entering a past fact before any medical wizard.
      const onWizard = /^\/welcome\/health/.test(await t.route());
      if (onWizard) {
        const skip = main.getByRole('button', { name: /skip|not now|later|explore|without|look around/i });
        const links = main.getByRole('link', { name: /skip|not now|later|explore|without|look around/i });
        const way = (await skip.count()) + (await links.count());
        await t.check(way > 0, `Explore first leads straight into the medical wizard (${await t.route()}, heading “${(await main.getByRole('heading', { level: 1 }).innerText()).trim()}”) with no way to reach Today without answering it`);
        if (way > 0) await ui.tap((await skip.count()) ? skip : links);
        else {
          // Recorded above; continue through the wizard with P07's own answers so the later steps can still be exercised.
          t.note('continued through the forced wizard with P07’s first-movement answers to exercise steps 4–7');
          await answerWizardP07(t);
        }
        await page.waitForFunction(() => !location.hash.startsWith('#/welcome/health'), null, { timeout: 10000 });
        await t.ready();
      }
      // The keep/installation step, wherever it comes.
      for (let i = 0; i < 3 && /^\/welcome/.test(await t.route()); i++) {
        const body = await main.innerText();
        if (/Home Screen|this browser|Back it up|backup/i.test(body)) explanationSeen = true;
        await t.checkpoint(`welcome-${(await t.route()).replace(/\W+/g, '-')}`);
        const go = main.getByRole('button', { name: /^(Start|Continue in Safari for now|Continue)$/ });
        if (!(await go.count())) break;
        const from = await t.route();
        await ui.tap(go);
        await page.waitForFunction(r => location.hash.replace(/^#/, '') !== r, from, { timeout: 10000 });
        await t.ready();
      }
      await t.check(explanationSeen, 'no Home Screen installation, storage or backup explanation was shown before Today');
      await page.getByRole('heading', { level: 1, name: 'Today', exact: true }).waitFor();
      const tabs = page.getByRole('navigation', { name: 'Main' }).getByRole('link');
      await t.check((await tabs.allInnerTexts()).map(s => s.trim()).join('|') === 'Today|Move|Track|Guide', `tabs are ${(await tabs.allInnerTexts()).join('|')}`);
      await t.check(await page.getByRole('link', { name: /^You/ }).count() === 1, 'no root You button on Today');
      const snap = await t.checkpoint('today-first');
      await t.check(!docs(snap).settings?.startDate, `startDate was set to ${docs(snap).settings?.startDate}`);
    });

    await t.step(4, 'Choose something else: five rows in fixed order', async () => {
      const opener = ui.button(main, 'Choose something else');
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
      await t.check(focused === 'Choose something else', `closing the chooser left focus on “${focused}”, not its opener`);
    });

    await t.step(5, 'Learn, return, then Log something: steps 2000 for 7 October', async () => {
      await ui.tap(ui.button(main, 'Choose something else'));
      await ui.tap(ui.row(page.getByRole('dialog'), 'Learn'));
      await page.getByRole('heading', { level: 1, name: 'Guide', exact: true }).waitFor();
      await t.check((await main.innerText()).length > 200, 'Guide has no readable content');
      await t.checkpoint('guide');
      await ui.tap(ui.link(page.getByRole('navigation', { name: 'Main' }), 'Today'));
      await page.getByRole('heading', { level: 1, name: 'Today', exact: true }).waitFor();
      await ui.tap(ui.button(main, 'Choose something else'));
      await ui.tap(ui.row(page.getByRole('dialog'), 'Log something'));
      await page.waitForTimeout(600);
      await t.check((await t.route()).startsWith('/track'), `Log something opened ${await t.route()}, not Track`);
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

    await t.step(6, 'Move → Stretch → Start: safety questions before movement', async () => {
      const startStretch = async () => {
        await ui.tab(page, 'Move');
        await ui.tap(ui.row(main, 'Stretch', 'link'));
        await ui.heading(page, 'Stretch');
        // While the health questions are unanswered the setup refuses before any tap (scan S-15):
        // no Start, the reason on screen, and "Review today’s check-in" in its place.
        const refusal = await mv.setupRefusal(page, 'stretch');
        if (refusal) {
          await t.checkpoint('stretch-setup-refused');
          await t.check(/health questions|profile/i.test(refusal.text), `the refusing Stretch setup does not say the health questions come first: “${refusal.text.slice(0, 200)}”`);
          await t.check(refusal.review, 'the refusing Stretch setup offers no “Review today’s check-in”');
          if (refusal.review) await mv.reviewFromSetup(page);
        } else {
          await ui.tap(ui.button(main, 'Start stretch'));
        }
        await page.waitForTimeout(600);
      };
      await startStretch();
      // Whatever comes first (profile questions or the check-in), it must come before movement.
      const route = await t.route();
      await t.check(!/^\/session/.test(route) || await page.getByRole('button', { name: 'Start', exact: true }).count() > 0,
        `Start stretch went straight into movement at ${route}`);
      const sheet = page.getByRole('dialog', { name: ui.CHECKIN });
      if (/^\/you\/profile|^\/welcome/.test(route)) {
        await answerWizardP07(t);
      } else if (await sheet.count()) {
        await t.checkpoint('stretch-check-in');
        await ui.answerCheckIn(t, sheet, ui.normalAnswers('P07'));
        await t.checkpoint('stretch-outcome');
        const body = (await sheet.innerText()).replace(/\s+/g, ' ');
        if (/health questions in your profile/i.test(body)) {
          // Refused until the questions are answered — but are the questions themselves offered here?
          const toQuestions = sheet.getByRole('button', { name: /question|profile|health/i }).or(sheet.getByRole('link', { name: /question|profile|health/i }));
          await t.check(await toQuestions.count() > 0, `the relevant health questions do not appear before movement: the check-in only says “${body.slice(0, 160)}”, with no way to the questions from it (only “Change answers” and Close)`);
          await ui.tap(ui.button(sheet, 'Close'));
          t.note('continued through You → Profile & health → Answer the questions with P07’s first-movement answers');
          await ui.tab(page, 'Today');
          await ui.tap(page.getByRole('link', { name: /^You:/ }));
          await ui.heading(page, 'You');
          await ui.tap(ui.row(main, 'Profile & health', 'link'));
          await ui.heading(page, 'Profile & health');
          await t.checkpoint('profile-not-set-up');
          await ui.tap(ui.button(main, 'Answer the questions'));
          await page.waitForTimeout(500);
          await answerWizardP07(t);
          await page.waitForFunction(() => !/Your body|Your health|Before you start/.test(document.querySelector('main h1')?.textContent ?? ''), null, { timeout: 15000 }).catch(() => {});
          await t.checkpoint('profile-answered');
          const answered = await t.db();
          await t.check(!!docs(answered).profile, 'answering the profile questions stored no profile');
          await startStretch();
        }
        const again = page.getByRole('dialog', { name: ui.CHECKIN });
        if (await again.count() && await ui.button(again, ui.SUBMIT).count()) await ui.answerCheckIn(t, again, ui.normalAnswers('P07'));
        await t.checkpoint('stretch-permission');
        // Permission shows as the sheet's own Start, or — when today's check-in already allows it —
        // the stretch's ready screen, where movement begins only on its Start.
        const sheetStart = (await again.count()) ? await again.getByRole('button', { name: /^Start stretch$|^Continue/ }).count() : 0;
        const ready = /^\/session/.test(await t.route()) && await page.getByRole('button', { name: 'Start', exact: true }).count() === 1
          && await page.getByRole('button', { name: 'Pause', exact: true }).count() === 0;
        await t.check(sheetStart === 1 || ready,
          `no permission-approved start after the first-movement and normal answers: ${(await (await again.count() ? again : main).innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300)}`);
      } else {
        await t.check(false, `Start stretch opened neither the questions nor the check-in (${route})`);
      }
    }, { input: 'P07 first-movement answers; normal current answers' });

    await t.step(7, 'Cancel before active movement, reload, open You', async () => {
      const sheet = page.getByRole('dialog', { name: ui.CHECKIN });
      if (await sheet.count()) await ui.tap(ui.button(sheet, 'Close'));
      // Leaving the stretch's ready screen before its Start is cancelling before movement.
      if (/^\/session/.test(await t.route())) await ui.tap(page.getByRole('button', { name: 'Back', exact: true }));
      await t.reload();
      await ui.tab(page, 'Today');
      await ui.tap(page.getByRole('link', { name: /^You:/ }));
      await page.getByRole('heading', { level: 1, name: 'You', exact: true }).waitFor();
      const snap = await t.checkpoint('you-after-reload');
      const d = docs(snap);
      await t.check(d.settings?.focus === 'explore', `focus is ${d.settings?.focus}`);
      await t.check(!d.settings?.startDate, `startDate is ${JSON.stringify(d.settings?.startDate)}, not empty`);
      await t.check((snap.sessions ?? []).length === 0, `${(snap.sessions ?? []).length} session(s) were created`);
      await t.check(!!d.profile && d.profile.health?.diabetes === 'none' && d.profile.health?.hypertension === 'none'
        && (d.profile.pain?.areas ?? []).length === 0, `the profile does not reflect the explicit answers: ${JSON.stringify(d.profile?.health ?? null).slice(0, 200)}`);
      const kinds = (snap.observations ?? []).map(o => o.kind);
      await t.check(kinds.every(k => k === 'steps'), `observations other than the entered steps exist: ${kinds.join(', ')}`);
      const checkIns = d.checkIns ?? [];
      t.note(`check-ins stored: ${checkIns.length}`);
    });
  },
}];
