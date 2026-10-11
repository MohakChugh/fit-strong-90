/**
 * V-J17, fresh: uncertain answers, and a draft that won't save (journey §6.1,
 * B-07). "Not sure" is stored as "may have"; a refused write stays on its page
 * with its answers; without saving, nothing is stored and every hold applies.
 */
import { docs } from '../lib/harness.mjs';
import * as data from '../lib/data.mjs';
import * as setup from '../lib/setup.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J17';
export const title = 'Uncertain answers, and a draft that won’t save';
export const safety = true;

/** The settings document refuses every write: the draft can't be stored. */
const FAIL_SETTINGS = [{ op: 'put', store: 'settings', match: { key: 'settings' }, action: 'throwUnknown' }];
const SAVE_FAILED = 'Your answers aren’t being saved on this phone.';
const UNSAVED = 'Your answers aren’t being saved on this phone. If you close FitStrong, they’re lost.';

/** Step 1, shared by both cases: to the conditions, then a refused Next. */
async function refusedNext(t) {
  const page = await t.open({ seed: null, route: '' });
  const main = page.getByRole('main');
  t.allowConsole('acceptance-injected');
  await t.step(1, 'Get started; Next; Skip for now; Next; tick; writes fail; Next', async () => {
    await ui.tap(ui.button(main, 'Get started'));
    await ui.heading(page, 'What should we call you?');
    await ui.tap(ui.button(main, 'Next'));
    await ui.heading(page, 'Body for the exercise demos');
    await ui.tap(ui.button(main, 'Skip for now'));
    await ui.heading(page, 'Your height and weight');
    await ui.tap(ui.button(main, 'Next'));
    await ui.heading(page, 'Do you have any of these?');
    await setup.tick(main, 'Not sure: Diabetes');
    await setup.tick(main, 'High blood pressure');
    // Each change is kept as typed shortly after it's made (H5-16): what's stored before the refused Next includes the ticks.
    const kept = s => docs(s).settings?.setup?.draft?.edits?.['health.conditions']?.conditions?.bp === 'yes';
    const stored = docs(await data.waitDb(t, kept, 'the ticks were not kept as typed')).settings?.setup;
    await t.setPageFaults(FAIL_SETTINGS);
    await ui.tap(ui.button(main, 'Next'));
    const alert = main.getByRole('alert').filter({ hasText: SAVE_FAILED });
    await alert.waitFor({ timeout: 10000 });
    await t.check(await ui.button(alert, 'Try again').count() === 1 && await ui.button(alert, 'Continue without saving').count() === 1, 'no Try again or Continue without saving');
    await t.check(await t.route() === '/setup/health/conditions', `the refused Next moved to ${await t.route()}`);
    for (const box of ['Not sure: Diabetes', 'High blood pressure']) {
      await t.check(await main.getByRole('checkbox', { name: box, exact: true }).getAttribute('aria-checked') === 'true', `“${box}” is no longer ticked`);
    }
    await t.checkpoint('draft-refused');
    await t.check(JSON.stringify(docs(await t.db()).settings?.setup) === JSON.stringify(stored), 'the refused draft was stored');
  }, { input: 'Not sure: Diabetes, High blood pressure; settings writes fail' });
  return page;
}

export const cases = [
  {
    name: 'Not sure is stored as may-have',
    async run(t) {
      const page = await refusedNext(t);
      const main = page.getByRole('main');
      await t.step(2, 'Writes work again; Try again; Not sure wherever it’s offered; Start using', async () => {
        await t.setPageFaults(null);
        await ui.tap(ui.button(main, 'Try again'));
        await ui.heading(page, 'Which type of diabetes?');
        await setup.throughSetup(t, setup.UNSURE);
        await setup.startUsing(t);
        const h = docs(await t.checkpoint('unsure-stored')).profile?.health ?? {};
        const want = {
          diabetes: 'other', hypertension: 'unsure', insulin: 'unsure', sulfonylureaOrMeglitinide: 'unsure', sglt2i: 'unsure', metformin: 'unsure',
          betaBlocker: 'unsure', diuretic: 'unsure', priorDkaOrInsulinDeficiency: 'unsure', highHypoRisk: true, dizzyOnStandingOrAutonomicNeuropathy: true,
        };
        const bad = Object.entries(want).filter(([k, v]) => h[k] !== v);
        await t.check(!bad.length, `stored: ${bad.map(([k, v]) => `${k}=${JSON.stringify(h[k])} (want ${JSON.stringify(v)})`).join(', ')}`);
        await t.goto('/home?checkin=stretch');
        const sheet = page.getByRole('dialog', { name: ui.CHECKIN });
        await sheet.waitFor();
        // The day's questions show once "Right now, any of these?" is answered.
        await ui.tap(ui.checkbox(ui.section(sheet, 'Right now, any of these?'), 'None of these'));
        await sheet.getByRole('radiogroup', { name: 'Sleep last night' }).waitFor();
        const text = await sheet.innerText();
        await t.checkpoint('check-in-unsure');
        await t.check(/glucose/i.test(text) && /ketone/i.test(text), `the check-in does not ask for glucose and about ketones: ${text.replace(/\s+/g, ' ').slice(0, 300)}`);
      }, { input: 'Not sure for every safety question; No ketone testing; Neither; no cuff' });
    },
  },
  {
    name: 'continue without saving',
    async run(t) {
      const page = await refusedNext(t);
      const main = page.getByRole('main');
      await t.step(2, 'Continue without saving; answer through Review; Start using', async () => {
        await ui.tap(ui.button(main, 'Continue without saving'));
        await ui.heading(page, 'Which type of diabetes?');
        // Writes work again, so anything the app stored now would show.
        await t.setPageFaults(null);
        const lost = [];
        const seen = await setup.throughSetup(t, setup.UNSURE, {
          checkpoint: true,
          onPage: async heading => { if (await main.getByText(UNSAVED, { exact: true }).count() !== 1) lost.push(heading); },
        });
        await t.check(!lost.length, `these pages don’t say the answers aren’t being saved: ${lost.join(', ')}`);
        t.note(`pages after Continue without saving: ${seen.join(' → ')}`);
        await setup.startUsing(t);
        const card = (await ui.rightNow(page).innerText()).replace(/\s+/g, ' ');
        await t.check(/Finish setting up/.test(card), `Right now does not say Finish setting up: ${card.slice(0, 200)}`);
        const d = docs(await t.checkpoint('home-unsaved'));
        await t.check(!d.profile && d.settings?.onboardingComplete !== true && d.settings?.setup?.completedAt === undefined, `stored without saving: ${JSON.stringify({ profile: !!d.profile, onboarded: d.settings?.onboardingComplete, setup: d.settings?.setup })}`);
        // Within the running app: a reload would end this session, and with it the answers.
        await t.hash('/home?checkin=stretch');
        const sheet = page.getByRole('dialog', { name: ui.CHECKIN });
        await sheet.waitFor();
        await t.check(/health questions/i.test(await sheet.innerText()), 'Stretch is not held for the health questions');
        await ui.tap(ui.button(sheet, 'Close'));
      });
      await t.step(3, 'After a reload, setup again, where the draft was stored', async () => {
        await t.reload();
        await ui.heading(page, 'Do you have any of these?');
        await t.check(await main.getByText('Welcome back, let’s carry on.', { exact: true }).count() === 1, 'no “Welcome back” after the reload');
      });
    },
  },
  {
    // H5-02: the recovery actions store the page as it is now, never the refused submission.
    name: 'Try again stores the page as corrected',
    async run(t) {
      const page = await refusedNext(t);
      const main = page.getByRole('main');
      await t.step(2, 'Take back “Not sure” about diabetes; writes work again; Try again', async () => {
        await setup.tick(main, 'Not sure: Diabetes', false);
        await t.setPageFaults(null);
        await ui.tap(ui.button(main, 'Try again'));
        const landed = await ui.heading(page, 'High blood pressure');
        await t.check(landed === 'High blood pressure', `Try again went to “${landed}”`);
        const draft = docs(await t.checkpoint('corrected-try-again')).settings?.setup?.draft;
        await t.check(draft?.at === 'health.bp' && draft?.answers?.conditions?.diabetes === 'no' && draft?.answers?.conditions?.bp === 'yes',
          `Try again stored ${JSON.stringify(draft)}`);
      }, { input: 'Not sure: Diabetes unticked after the refusal' });
    },
  },
  {
    name: 'Continue without saving keeps the page as corrected',
    async run(t) {
      const page = await refusedNext(t);
      const main = page.getByRole('main');
      await t.step(2, 'Take back “Not sure” about diabetes; Continue without saving', async () => {
        await setup.tick(main, 'Not sure: Diabetes', false);
        await ui.tap(ui.button(main, 'Continue without saving'));
        // The corrected page's next page, not the refused one's ("Which type of diabetes?").
        const landed = await ui.heading(page, 'High blood pressure');
        await t.check(landed === 'High blood pressure', `Continue without saving went to “${landed}”`);
        await t.checkpoint('corrected-continue-unsaved');
        // Back on the conditions, the answer kept is the corrected one.
        await ui.tap(ui.button(main, 'Back'));
        await ui.heading(page, 'Do you have any of these?');
        await t.check(await main.getByRole('checkbox', { name: 'Not sure: Diabetes', exact: true }).getAttribute('aria-checked') === 'false',
          '“Not sure: Diabetes” is ticked again after Continue without saving');
      }, { input: 'Not sure: Diabetes unticked after the refusal' });
    },
  },
];
