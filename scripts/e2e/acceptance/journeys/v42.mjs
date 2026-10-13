/**
 * V-J42 (journey §17.2 #42, D116): an upgraded person in programme week 12 →
 * the twelve weeks finish → Stretch and Walk carry on → "What next?", chosen
 * explicitly, from a button that says "Choose what’s next" (Kiro K8-05). Nothing is invented after week 12. Whether a guided session
 * opens is decided once, when it opens (Codex P8-19): `?resume=1` with
 * nothing saved, or with progress past its 18 hours, opens the choice; real
 * progress opens; a run under way at midnight stays until it is saved; and
 * week 12's last session finished, then the next day, in one run (K8-15).
 * P01, a v1 record upgraded on open, started 17 July 2026: Thursday 8 October
 * is week 12's last day.
 */
import { persona } from '../fixtures/personas.mjs';
import { docs } from '../lib/harness.mjs';
import * as hub from '../lib/hub.mjs';
import * as mv from '../lib/move.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J42';
export const title = 'After week 12: nothing invented, Stretch and Walk carry on, what’s next chosen';
export const safety = false;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();
const JULY = { patch: { settings: { startDate: '2026-07-17' } } };
const NEXT_DAY = Date.parse('2026-10-09T09:00:00+05:30');
const DONE = 'The 12 weeks are done';
const PLAN = '/hub/workout/plan';
const saved = page => page.evaluate(() => {
  const raw = localStorage.getItem('fit-strong-90-guided');
  return raw ? JSON.parse(raw) : null;
});

/** Week 12's session from the Workout hub, through its check-in, running. */
async function startSession(t) {
  const page = t.page;
  await hub.open(t, 'guided');
  const { sheet } = await hub.begin(t);
  if (sheet) {
    await ui.answerCheckIn(t, sheet, ui.normalAnswers('P01'));
    await ui.tap(mv.sheetStart(sheet));
  }
  await page.waitForURL(/#\/session/, { timeout: 15000 });
  await t.ready();
  await ui.tap(page.getByRole('main').getByRole('button', { name: 'Start', exact: true }));
  await page.getByRole('button', { name: 'Pause', exact: true }).waitFor({ timeout: 10000 });
}

/** End session → Save and exit: the run saved part-way, to resume. */
async function saveAndExit(t) {
  const page = t.page;
  await ui.tap(page.getByRole('main').getByRole('button', { name: 'End session', exact: true }));
  await ui.tap(page.getByRole('button', { name: 'Save and exit', exact: true }));
  await page.waitForFunction(() => !location.hash.startsWith('#/session'), null, { timeout: 15000 });
  // The session's screen goes with the frame its transition waits for. On this test's stopped clock that is a moment
  // on: until then the screen is still up, saving its progress as it does every few seconds, and a jump of a day
  // would save it again as if it were the next day's.
  await t.advance(1000);
  await page.getByRole('button', { name: 'End session', exact: true }).waitFor({ state: 'detached', timeout: 10000 });
}

export const cases = [
  {
    name: 'week 12’s last day still plans its session',
    async run(t) {
      const page = await t.open({ seed: persona('P01', JULY), route: '/home' });
      await t.step(1, 'The Workout hub: Week 12 of 12, with its session', async () => {
        await hub.open(t, 'guided');
        const text = flat(await page.getByRole('main').innerText());
        await t.checkpoint('week-12-last-day');
        await t.check(/Week 12 of 12/.test(text), `the hub does not say Week 12 of 12: ${text.slice(0, 300)}`);
        await t.check(await hub.start(page).count() === 1, 'week 12’s last day offers no session');
      });
    },
  },
  {
    name: 'the day after: nothing planned, Choose what’s next, Stretch and Walk carry on',
    async run(t) {
      const page = await t.open({ seed: persona('P01', JULY), route: '/home', time: NEXT_DAY });
      const main = page.getByRole('main');

      await t.step(1, 'Home: Right now and the Workout tile say the twelve weeks are done', async () => {
        const right = ui.rightNow(page);
        const text = flat(await right.innerText());
        await t.checkpoint('home-done');
        await t.check(text.includes(DONE), `Right now reads “${text.slice(0, 200)}”`);
        await t.check(await ui.button(right, 'Choose what’s next').count() === 1, 'Right now has no “Choose what’s next”');
        await t.check(flat(await hub.tile(page, 'Workout').innerText()).includes(DONE), 'the Workout tile still names a session');
      });

      await t.step(2, 'The Workout hub says so too, with no Start; a stale link to the session, and one to resume with nothing saved, open the choice', async () => {
        await hub.open(t, 'guided');
        const card = flat(await hub.card(page).innerText());
        await t.check(card.includes(DONE) && /Choose what’s next/.test(card), `the Workout card reads “${card.slice(0, 200)}”`);
        await t.check(await hub.start(page).count() === 0, 'the Workout hub still starts a session after week 12');
        for (const link of ['/session', '/session?resume=1']) {
          await t.goto(link);
          await t.check((await t.route()).startsWith(PLAN), `${link} opened ${await t.route()}`);
        }
        await t.check(await saved(page) === null, 'a stale link made a run');
      }, { input: '#/session and #/session?resume=1, nothing saved' });

      await t.step(3, 'Stretch and Walk carry on as before', async () => {
        for (const mode of ['stretch', 'walk']) {
          await hub.open(t, mode);
          await t.check(await hub.start(page).count() === 1, `the ${mode} hub offers no start after week 12`);
        }
        await t.checkpoint('stretch-walk-carry-on');
      });

      await t.step(4, 'Choose what’s next → Your plan: two choices under What next? → Leave the programme', async () => {
        await ui.tab(page, 'Home');
        await ui.tap(ui.button(ui.rightNow(page), 'Choose what’s next'));
        await ui.heading(page, 'Your plan');
        const choices = ui.section(main, 'What next?');
        await t.must(await choices.count() === 1, 'Your plan has no “What next?”');
        await t.check(await ui.row(choices, 'Start the 12 weeks again').count() === 1 && await ui.row(choices, 'Leave the programme').count() === 1, `the choices: ${flat(await choices.innerText())}`);
        await ui.tap(ui.row(choices, 'Leave the programme'));
        const sheet = page.getByRole('dialog', { name: 'Leave the programme?' });
        await ui.tap(ui.button(sheet, 'Leave the programme'));
        await sheet.waitFor({ state: 'hidden' });
        const snap = await t.checkpoint('left');
        await t.check(!docs(snap).settings?.startDate, `the start date is still ${docs(snap).settings?.startDate}`);
        await t.check((snap.sessions ?? []).some(s => s.id === 'legacy-strength'), 'leaving lost a session');
      });
    },
  },
  {
    name: 'a session under way at midnight on week 12’s last day stays until it is saved, and reopens only to resume',
    async run(t) {
      const page = await t.open({ seed: persona('P01', JULY), route: '/home', time: Date.parse('2026-10-08T23:50:00+05:30') });

      await t.step(1, '11:50 pm on week 12’s last day: its session started', async () => {
        await startSession(t);
        await t.checkpoint('started-before-midnight');
      }, { input: 'normal check-in at 11:50 pm' });

      await t.step(2, 'Past midnight, the twelve weeks over: the run stays on screen and keeps going', async () => {
        for (let i = 0; i < 15; i++) await t.advance(60_000);
        await t.check((await t.route()).startsWith('/session'), `at 12:05 am the run was taken to ${await t.route()}`);
        await t.check(await page.getByRole('button', { name: /^(Pause|Resume)$/ }).count() >= 1, 'the run’s controls are gone after midnight');
        await t.checkpoint('past-midnight');
      });

      await t.step(3, 'Saved part-way: a fresh link opens the choice, and the link to resume opens the run', async () => {
        await saveAndExit(t);
        const kept = await saved(page);
        await t.must(kept?.plan?.date === '2026-10-08' && kept?.state?.status !== 'done', `the run was not saved part-way: ${JSON.stringify(kept?.state?.status)}`);
        await t.goto('/session');
        await t.check((await t.route()).startsWith(PLAN), `/session opened ${await t.route()}`);
        await t.goto('/session?resume=1');
        await t.check((await t.route()).startsWith('/session'), `/session?resume=1 opened ${await t.route()}, not the saved run`);
        // A new day: the run may first ask for today's check-in (scan M-01), on its own screen.
        // Arriving, that is the session's gate (`arrivalGate`): today's check-in first, Back to Today its way out.
        const run = page.getByRole('button', { name: /^(Resume|Start)$/ })
          .or(page.getByRole('heading', { name: /^(Check in to (carry on|start)|Check again before you start)$/ }));
        await t.check(await run.count() >= 1, 'the saved run did not open');
        await t.checkpoint('resumed-after-week-12');
      }, { input: 'End session → Save and exit at 12:05 am; then the links' });
    },
  },
  {
    name: 'week 12’s last session finished, then the next day in the same run: nothing planned, and Choose what’s next (K8-15)',
    async run(t) {
      const page = await t.open({ seed: persona('P01', JULY), route: '/home', time: Date.parse('2026-10-08T09:00:00+05:30') });
      const main = page.getByRole('main');

      await t.step(1, 'Week 12’s last day: its session started, finished and saved', async () => {
        await startSession(t);
        await t.advance(60_000);
        await ui.tap(main.getByRole('button', { name: 'End session', exact: true }));
        await ui.tap(page.getByRole('button', { name: 'Finish now', exact: true }));
        await ui.tap(page.getByRole('button', { name: 'Save and finish', exact: true }));
        await page.waitForFunction(() => !location.hash.startsWith('#/session'), null, { timeout: 15000 }).catch(() => undefined);
        const snap = await t.checkpoint('week-12-finished');
        // Finished, it is saved as ended: with less than half its work done, "Finish now" saves it as skipped or
        // partial, never completed (Review Focus #2), and never in progress.
        await t.check((snap.sessions ?? []).some(s => s.date === '2026-10-08' && ['completed', 'partial', 'skipped'].includes(s.status)), 'week 12’s last session was not saved as done');
      }, { input: 'End session → Finish now → Save and finish' });

      await t.step(2, 'The next morning, the app still open: Right now says the twelve weeks are done, with Choose what’s next, and the Workout hub plans nothing', async () => {
        await t.setTime(NEXT_DAY);
        await ui.tab(page, 'Home');
        await t.ready();
        const right = ui.rightNow(page);
        await right.getByText(DONE).first().waitFor({ timeout: 15000 });
        await t.check(await ui.button(right, 'Choose what’s next').count() === 1, 'Right now has no “Choose what’s next”');
        await hub.open(t, 'guided');
        await t.check(await hub.start(page).count() === 0, 'the Workout hub starts a session the day after week 12');
        await t.checkpoint('next-day-same-run');
      });

      await t.step(3, 'Choose what’s next → Your plan, with its two choices', async () => {
        await ui.tab(page, 'Home');
        await ui.tap(ui.button(ui.rightNow(page), 'Choose what’s next'));
        await ui.heading(page, 'Your plan');
        const choices = ui.section(main, 'What next?');
        await t.check(await ui.row(choices, 'Start the 12 weeks again').count() === 1 && await ui.row(choices, 'Leave the programme').count() === 1, `the choices: ${flat(await choices.innerText())}`);
      });
    },
  },
  {
    name: 'progress past its 18 hours opens only the choice',
    async run(t) {
      const page = await t.open({ seed: persona('P01', JULY), route: '/home' });

      await t.step(1, 'Week 12’s last day, 9:00 am: its session started, then saved part-way', async () => {
        await startSession(t);
        await t.advance(60_000);
        await saveAndExit(t);
        await t.must((await saved(page))?.plan?.date === '2026-10-08', 'the run was not saved');
      });

      await t.step(2, 'The next day at 9:05 am, past the 18 hours: the link to resume opens the choice', async () => {
        await t.setTime(Date.parse('2026-10-09T09:05:00+05:30'));
        await t.goto('/session?resume=1');
        await t.check((await t.route()).startsWith(PLAN), `/session?resume=1 opened ${await t.route()} for progress past its window`);
        await t.checkpoint('expired-resume');
      }, { input: '#/session?resume=1, 24 hours after the save' });
    },
  },
  {
    name: 'the day after: Start the 12 weeks again',
    async run(t) {
      const page = await t.open({ seed: persona('P01', JULY), route: '/hub/workout/plan?next=1', time: NEXT_DAY });
      const main = page.getByRole('main');
      await t.step(1, 'Your plan → Start the 12 weeks again → its sheet → Week 1 of 12, from today', async () => {
        await ui.heading(page, 'Your plan');
        await ui.tap(ui.row(ui.section(main, 'What next?'), 'Start the 12 weeks again'));
        const sheet = page.getByRole('dialog', { name: 'Start the 12 weeks again?' });
        await ui.tap(ui.button(sheet, 'Start the 12 weeks again'));
        await sheet.waitFor({ state: 'hidden' });
        const snap = await t.checkpoint('restarted');
        await t.check(docs(snap).settings?.startDate === '2026-10-09', `the start date is ${docs(snap).settings?.startDate}`);
        await t.check(/Week 1 of 12/.test(flat(await main.innerText())), 'Your plan does not say Week 1 of 12');
      });
    },
  },
];
