/**
 * V-J37, fresh iPhone Safari: finish setup, then move to the Home Screen app
 * (journey §6.5; A-27; B-24; B-30: temporary storage and device loss).
 */
import { docs } from '../lib/harness.mjs';
import * as data from '../lib/data.mjs';
import * as setup from '../lib/setup.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J37';
export const title = 'Finish setup in Safari, then move to the Home Screen app';
export const safety = false;

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
const flat = s => s.replace(/\s+/g, ' ');

export const cases = [{
  name: 'main',
  async run(t) {
    let page = await t.open({ seed: null, route: '', contextOptions: { userAgent: IPHONE }, capabilities: { persist: 'refuse', share: 'capture' } });
    let main = page.getByRole('main');
    let file;
    await t.step(1, 'Page 1 in Safari: the install line and Show me how', async () => {
      await t.check(flat(await main.innerText()).includes('Installing helps iPhone keep your data, but it isn’t a backup.'), 'no install line (B-24)');
      await ui.tap(ui.button(main, 'Show me how'));
      const sheet = page.getByRole('dialog', { name: 'Add FitStrong to your Home Screen' });
      await sheet.waitFor();
      await t.check(await sheet.getByRole('list', { name: 'How to add the app to your Home Screen' }).getByRole('listitem').count() === 3, 'the sheet does not show three steps');
      await t.checkpoint('install-steps');
      await ui.tap(ui.button(sheet, 'Close'));
    });
    await t.step(2, 'P02’s answers; Review offers the move with a backup; Start using', async () => {
      await setup.throughSetup(t, setup.P02);
      const offer = ui.section(main, 'Moving to the Home Screen app?');
      await t.must(await offer.count() === 1, 'Review offers no “Moving to the Home Screen app?”');
      await t.check(flat(await offer.innerText()).includes('Make a backup first, then restore it there. Safari may remove data from websites you haven’t opened for a while.'), 'the offer’s words are not B-24’s');
      await ui.tap(ui.row(offer, 'Make a backup'));
      const sheet = page.getByRole('dialog', { name: 'Back up your record' });
      await sheet.waitFor();
      // Safari on iPhone can share files, so the file goes to the share sheet (`deliveryMethod`), captured here.
      await ui.tap(ui.button(sheet, 'Save or share'));
      await page.waitForTimeout(500);
      const shared = (await page.evaluate(() => window.__acc?.shares ?? [])).at(-1)?.files?.[0];
      await t.must(!!shared?.bytes, 'no backup file was made');
      file = data.writeFixture(t, shared.name, Buffer.from(shared.bytes));
      await ui.tap(ui.button(sheet, 'Close'));
      await t.checkpoint('review-handoff');
      await setup.startUsing(t);
    }, { input: 'P02’s answers; Make a backup' });
    await t.step(3, 'Me → Data: not installed, storage temporary', async () => {
      const data2 = await data.openData(t);
      await t.check(/Not installed/.test(await data2.innerText()), 'Me → Data does not say Not installed (B-30)');
      await t.checkpoint('data-not-installed');
    });
    await t.step(4, 'The installed app, empty: restore the file on page 1; setup carries on at Review', async () => {
      await t.context.close();
      page = await t.open({ seed: null, route: '', contextOptions: { userAgent: IPHONE }, capabilities: { standalone: true } });
      main = page.getByRole('main');
      await t.check(!flat(await main.innerText()).includes('Installing helps'), 'the installed app still shows the install line');
      const sheet = await data.chooseRestore(t, file, { from: 'welcome' });
      await ui.tap(ui.button(sheet, 'Restore'));
      await data.waitOutcome(t, sheet);
      await t.check(/Restored\./.test(await sheet.innerText()), `the restore did not finish: ${flat(await sheet.innerText()).slice(0, 200)}`);
      await ui.tap(ui.button(sheet, 'Done'));
      // The file has no finished profile, so page 1 stays; Get started carries on where the draft stopped.
      await ui.tap(ui.button(main, 'Get started'));
      await ui.heading(page, setup.REVIEW);
      await t.check(await main.getByText('Welcome back, let’s carry on.', { exact: true }).count() === 1, 'no “Welcome back, let’s carry on.” at Review');
      await setup.startUsing(t);
      const d = docs(await t.checkpoint('installed-home'));
      await t.check(d.settings?.setup?.stage === 'done' && d.settings?.setup?.answers?.focus === 'stretch', `settings.setup: ${JSON.stringify(d.settings?.setup).slice(0, 200)}`);
    });
  },
}];
