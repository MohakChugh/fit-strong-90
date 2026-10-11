/**
 * V-J13, P01: the upgrade from v1 (journey §6.6). No interstitial, one inline
 * row, legacy records with their own dates, and the new chapters waiting in Me.
 */
import { docs } from '../lib/harness.mjs';
import { persona } from '../fixtures/personas.mjs';
import * as data from '../lib/data.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J13';
export const title = 'Upgrade from v1';
export const safety = false;

const flat = s => s.replace(/\s+/g, ' ').trim();
const row = page => page.getByRole('main').getByRole('region', { name: 'FitStrong has a new Home', exact: true });
const afterRightNow = page => page.evaluate(() => document.getElementById('right-now')?.nextElementSibling?.getAttribute('aria-label') ?? null);

export const cases = [
  {
    name: 'main',
    async run(t) {
      const page = await t.open({ seed: persona('P01'), route: '/home' });
      const main = page.getByRole('main');
      await t.step(1, 'Home with no dialog; the new-Home row comes first after Right now', async () => {
        await t.check(await page.getByRole('dialog').count() === 0, 'a dialog opened over Home');
        await t.must(await row(page).count() === 1, 'no “FitStrong has a new Home” row');
        await t.check(await afterRightNow(page) === 'FitStrong has a new Home', `the element after Right now is “${await afterRightNow(page)}”`);
        await t.check(await ui.button(row(page), 'Show me').count() === 1 && await ui.button(row(page), 'Got it').count() === 1, 'the row lacks Show me or Got it');
        await t.checkpoint('new-home-row');
      });
      await t.step(2, 'Got it; reload: the row stays gone', async () => {
        await ui.tap(ui.button(row(page), 'Got it'));
        await data.waitDb(t, s => docs(s).settings?.setup?.newHomeSeen === true, 'Got it was not stored');
        await t.reload();
        await t.check(await row(page).count() === 0, 'the row came back after a reload');
        const s = docs(await t.db()).settings?.setup ?? {};
        await t.check(s.stage === 'done' && s.upgraded === true && s.newHomeSeen === true && s.completedAt === undefined, `settings.setup: ${JSON.stringify(s)}`);
      });
      await t.step(3, 'The legacy session, glucose and weight, each with its own date', async () => {
        // Today's log (v1's Track) on 25 September, as J02 reaches it.
        await ui.legacyTab(page, 'Track');
        await ui.trackDay(page, '2026-09-25');
        await t.check(await main.getByRole('link', { name: /^Upper A · Push & Row/ }).count() === 1, 'Today’s log for 25 September does not list the legacy session once');
        for (const [hub, value, what] of [['/hub/glucose', /\b104\b/, '104 mg/dL'], ['/hub/weight', /\b78\b/, '78 kg']]) {
          await t.goto(hub);
          const text = flat(await main.innerText());
          await t.check(value.test(text), `${hub} does not show ${what}: ${text.slice(0, 300)}`);
        }
        const snap = await t.checkpoint('legacy-records');
        const on25 = kind => (snap.observations ?? []).filter(o => o.kind === kind && o.day === '2026-09-25').map(o => o.value);
        await t.check(on25('glucose').includes(104) && on25('weight').includes(78), `the legacy readings are not dated 25 September: glucose ${on25('glucose')}, weight ${on25('weight')}`);
      });
      await t.step(4, 'Me: Finish setting up · 2 short chapters', async () => {
        await ui.tab(page, 'Me');
        const group = ui.section(main, 'Finish setting up · 2 short chapters');
        await t.must(await group.count() === 1, `Me has no “Finish setting up · 2 short chapters”: ${flat(await main.innerText()).slice(0, 300)}`);
        for (const [label, detail, href] of [['About you', 'What to call you', '#/me/profile?chapter=about'], ['Your food', 'Logging what you eat', '#/me/profile?chapter=food']]) {
          const link = ui.row(group, label, 'link');
          await t.check(flat(await link.innerText()).includes(detail), `the ${label} row does not say “${detail}”`);
          await t.check((await link.getAttribute('href'))?.endsWith(href), `the ${label} row opens ${await link.getAttribute('href')}`);
        }
        await t.checkpoint('me-finish-setting-up');
      });
    },
  },
  {
    name: 'show me',
    async run(t) {
      const page = await t.open({ seed: persona('P01'), route: '/home' });
      await t.step(5, 'Show me → Next, Next, Done', async () => {
        await ui.tap(ui.button(row(page), 'Show me'));
        // Each card is the sheet's title, so the sheet is named by it.
        for (const [i, [title, next]] of [['Your tiles are here', 'Next'], ['Trends is new', 'Next'], ['Browse is new', 'Done']].entries()) {
          const sheet = page.getByRole('dialog', { name: title, exact: true });
          await sheet.waitFor({ timeout: 10000 }).catch(() => {});
          await t.must(await sheet.count() === 1, `card ${i + 1} is not “${title}”`);
          await t.checkpoint(`show-me-${i + 1}`);
          await ui.tap(ui.button(sheet, next));
        }
        await data.waitDb(t, s => docs(s).settings?.setup?.newHomeSeen === true, 'Done was not stored');
        await t.check(await row(page).count() === 0, 'the row stayed after Done');
      });
    },
  },
];
