/**
 * V-J11, P01: back up, and restore on a new phone from setup's page 1
 * (journey §6.4). A backup with a finished profile goes straight to Home; one
 * without carries setup on with its answers.
 */
import { docs } from '../lib/harness.mjs';
import { persona } from '../fixtures/personas.mjs';
import * as data from '../lib/data.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J11';
export const title = 'Back up, and restore on a new phone';
export const safety = false;

const restoreDraft = async (t, file) => {
  const sheet = await data.chooseRestore(t, file, { from: 'welcome' });
  await ui.tap(ui.button(sheet, 'Restore'));
  await data.waitOutcome(t, sheet);
  await t.check(/Restored\./.test(await sheet.innerText()), `the restore did not finish: ${(await sheet.innerText()).slice(0, 200)}`);
  await ui.tap(ui.button(sheet, 'Done'));
  await sheet.waitFor({ state: 'hidden' });
};

export const cases = [
  {
    name: 'finished record',
    async run(t) {
      await t.open({ seed: persona('P01'), route: '/home' });
      let made;
      let before;
      await t.step(1, 'Me → Data → Back up your record', async () => {
        made = await data.backup(t, { expectVia: 'download' });
        before = data.decodeBackup(made.bytes);
      });
      await t.step(2, 'A fresh context opens setup’s page 1', async () => {
        await t.context.close();
        const page = await t.open({ seed: null, route: '' });
        await t.must(await page.getByRole('heading', { level: 1, name: 'Welcome', exact: true }).count() === 1, 'a fresh phone does not open setup’s page 1');
      });
      await t.step(3, 'Restore from a backup → the file → Restore: a preview, then Home', async () => {
        const sheet = await data.chooseRestore(t, data.writeFixture(t, made.name, made.bytes), { from: 'welcome' });
        // The preview J18 reads, before anything is written.
        await t.check(/In this file/i.test(await sheet.innerText()), 'no preview before restoring from page 1');
        await t.check(((await t.db()).observations ?? []).length === 0, 'choosing the file wrote records before Restore was tapped');
        await t.checkpoint('restore-preview');
        await ui.tap(ui.button(sheet, 'Restore'));
        await data.restoredFromWelcome(t, sheet);
        const snap = await t.checkpoint('restored-home');
        const diffs = data.compareLogical(data.logicalFromDoc(before, { ignoreExportDate: true }), data.logical(snap, { ignoreExportDate: true }), { label: ['file', 'restored'] });
        await t.check(diffs.length === 0, `the restored record differs from the file: ${diffs.slice(0, 5).join(' | ')}`);
      });
    },
  },
  {
    name: 'a backup made part-way through setup',
    async run(t) {
      const page = await t.open({ seed: null, route: '' });
      const main = page.getByRole('main');
      const file = data.writeFixture(t, 'setup-draft.json', data.transferDoc({
        settings: {
          onboardingComplete: false, theme: 'system', useMetric: true, startDate: '',
          setup: { stage: 'open', skipped: [], draft: { at: 'health.conditions', answers: { figure: 'female', metric: true } } },
        },
      }));
      await t.step(4, 'Restore it from page 1, then Get started: setup carries on where it stopped', async () => {
        await restoreDraft(t, file);
        await ui.tap(ui.button(main, 'Get started'));
        await ui.heading(page, 'Do you have any of these?');
        await t.check(await t.route() === '/setup/health/conditions', `opened ${await t.route()}`);
        await t.check(await main.getByText('Welcome back, let’s carry on.', { exact: true }).count() === 1, 'no “Welcome back, let’s carry on.”');
        await ui.tap(ui.button(main, 'Back'));
        await ui.heading(page, 'Your height and weight');
        await ui.tap(ui.button(main, 'Back'));
        await ui.heading(page, 'Body for the exercise demos');
        await t.check(await ui.radio(main.getByRole('radiogroup', { name: 'Body for the exercise demos', exact: true }), 'Female figure').getAttribute('aria-checked') === 'true',
          'the restored answer “Female figure” is not chosen');
        const snap = await t.checkpoint('restored-draft');
        await t.check(docs(snap).settings?.setup?.draft?.answers?.figure === 'female', 'the draft’s answers were not restored');
      });
    },
  },
];
