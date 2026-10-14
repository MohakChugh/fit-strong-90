/**
 * V-J41 (journey §17.2 #41, B-19, A-75; D88): a time-zone change mid-walk →
 * the elapsed time is right (a monotonic clock); history keeps its days; and
 * a clock jump makes no reading "fresh". The zone change crosses a date
 * (Kolkata to Auckland, where it is already the 9th), so a history regrouped
 * by the new zone would show. The clock is set back 20 minutes, so a reading
 * already too old to restart on would look fresh again by the wall clock:
 * only the clock-change rule holds P03, on a sulfonylurea, for a new reading
 * (Codex P8-24). Plan 6 Task 3 built the rules; this walks them. And a
 * clock set a day on and back leaves a serious low and Recently deleted as
 * they were (A-75, B-19, Kiro K8-01).
 */
import { MINUTE } from '../lib/env.mjs';
import { persona } from '../fixtures/personas.mjs';
import { content } from '../lib/harness.mjs';
import * as data from '../lib/data.mjs';
import * as hub from '../lib/hub.mjs';
import * as rec from '../lib/recovery.mjs';
import * as ui from '../lib/ui.mjs';
import * as walk from '../lib/walk.mjs';

export const id = 'V-J41';
export const title = 'A time-zone change across a date, the clock set back mid-walk, and a clock jump with a serious low on the device';
export const safety = true;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();
// Chromium's ICU names Kolkata's zone by its older id, Asia/Calcutta: one zone either way.
const zone = page => page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/^Asia\/Calcutta$/, 'Asia/Kolkata'));
/** The page's own date, in its zone now. */
const localDay = page => page.evaluate(() => new Date().toLocaleDateString('en-CA'));
const minutesShown = async page => Number((await walk.timer(page)).split(':')[0]);
const walkRow = main => ui.row(ui.section(main, 'Records'), 'Walk', 'link');
const DAY = 24 * 60 * MINUTE;
const REFUSED = 'This reading is keeping movement on hold, so it can’t be changed or removed yet.';
/** While the clock's change holds the device, every clinical change is refused in these words instead (P8S-02). */
const CLOCK_REFUSED = 'Your phone’s clock changed, so FitStrong can’t be sure when your readings were taken.';
const lowsOf = snap => (snap.observations ?? []).filter(o => o.kind === 'glucose' && o.value === 52);
/** A serious reading's guidance, closed by its Close. */
async function closeGuidance(page) {
  const guidance = page.getByRole('dialog', { name: /^(Saved|What to do)$/ });
  if (!(await guidance.count())) return;
  await ui.tap(ui.button(guidance, 'Close'));
  await guidance.waitFor({ state: 'hidden' });
}

export const cases = [
  {
    name: 'Kolkata to Auckland, into the next day, mid-walk',
    async run(t) {
      const page = await t.open({ seed: persona('P03'), route: '/home', zoneByCdp: 'Asia/Kolkata', time: Date.parse('2026-10-08T16:55:00+05:30') });
      const main = page.getByRole('main');
      let before;

      await t.step(1, 'A walk in Kolkata’s time zone at 4:55 pm on the 8th, 5 minutes in', async () => {
        await t.must(await zone(page) === 'Asia/Kolkata', `the page runs in ${await zone(page)}`);
        await walk.openSetup(t);
        await walk.start(t, ui.normalAnswers('P03'));
        before = await t.db();
        await walk.elapse(t, 5 * MINUTE);
        await t.check(await minutesShown(page) === 5, `the timer reads ${await walk.timer(page)}`);
      });

      await t.step(2, 'The phone moves to Auckland’s time zone, where it is already the 9th: the time walked stays right, and nothing recorded moves', async () => {
        await t.setTimezone('Pacific/Auckland');
        await t.must(await zone(page) === 'Pacific/Auckland', `the zone did not change: ${await zone(page)}`);
        await t.must(await localDay(page) === '2026-10-09', `in Auckland the page says it is ${await localDay(page)}: the change crosses no date`);
        await walk.elapse(t, 5 * MINUTE);
        await t.check(await minutesShown(page) === 10, `after the zone change the timer reads ${await walk.timer(page)}`);
        const stored = await walk.stored(page);
        const first = stored?.segments?.[0];
        await t.check(first?.day === '2026-10-08' && first?.offsetMin === 330, `the walk’s first segment: ${JSON.stringify({ day: first?.day, offsetMin: first?.offsetMin })}`);
        const after = await t.checkpoint('after-zone-change');
        const moved = (before.observations ?? []).filter(o => {
          const now = (after.observations ?? []).find(x => x.id === o.id);
          return !now || now.day !== o.day || now.at !== o.at;
        });
        await t.check(moved.length === 0, `records moved with the zone: ${JSON.stringify(moved.map(o => [o.kind, o.day, o.at]))}`);
      }, { input: 'time zone Asia/Kolkata → Pacific/Auckland at 5:00 pm IST' });

      await t.step(3, 'Finish and save: each of the walk’s records keeps the day and the offset it was walked in', async () => {
        await walk.finish(t);
        await ui.tap(ui.button(main, 'Save walk'));
        await page.getByText('Saved on this device', { exact: true }).waitFor({ timeout: 10000 });
        const snap = await t.checkpoint('walk-saved');
        const records = walk.walkObservations(snap);
        // The zone change closes the walk's segment as `timeZone`, and the next opens in the new offset and day (board
        // D88, H6-10): what was walked in Kolkata stays on the 8th at +05:30, and what came after is Auckland's 9th.
        const walkedIn = o => (o.day === '2026-10-08' && o.at.endsWith('+05:30')) || (o.day === '2026-10-09' && o.at.endsWith('+13:00'));
        await t.check(records.some(o => o.day === '2026-10-08') && records.every(walkedIn), `the walk’s records: ${JSON.stringify(records.map(o => [o.kind, o.day, o.at]))}`);
        const minutes = records.filter(o => o.kind === 'walkDuration').reduce((sum, o) => sum + o.value, 0);
        await t.check(minutes >= 10 && minutes < 12, `the saved walk is ${minutes} min, not about 10`);
      });

      await t.step(4, 'Today’s log in Auckland: the 9th holds no walk, and the 8th holds it', async () => {
        await ui.tap(ui.button(main, 'Done'));
        await ui.legacyTab(page, 'Track');
        await t.check(await walkRow(main).count() === 0, 'the walk shows on the 9th, the day the new zone would give it');
        await ui.trackDay(page, '2026-10-08');
        await t.check(await walkRow(main).count() === 1, 'the 8th does not show the walk');
        await t.checkpoint('log-keeps-days');
      });
    },
  },
  {
    name: 'the clock set back 20 minutes mid-walk, past the reading’s 30',
    async run(t) {
      const page = await t.open({ seed: persona('P03'), route: '/home' });
      const main = page.getByRole('main');

      await t.step(1, 'A walk from 9:00, its glucose taken at 9:00; 35 minutes in, past the 30 a restart allows', async () => {
        await walk.openSetup(t);
        await walk.start(t, ui.normalAnswers('P03'));
        await walk.elapse(t, 35 * MINUTE);
        await t.check(await minutesShown(page) === 35, `the timer reads ${await walk.timer(page)}`);
      });

      await t.step(2, 'The clock set back to 9:15: the reading would look 15 minutes old, but the walk counts real time and notes the change', async () => {
        await t.jumpClock(-20 * MINUTE);
        const shown = await minutesShown(page);
        await t.check(shown >= 35 && shown < 37, `after the change the timer reads ${await walk.timer(page)}`);
        const stored = await walk.stored(page);
        await t.check((stored?.segments ?? []).some(s => s.endedBy === 'clockChange') && typeof stored?.clockChangedAt === 'number',
          `the walk did not note the change: ${JSON.stringify((stored?.segments ?? []).map(s => s.endedBy))}`);
      }, { input: 'the phone’s clock set from 9:35 to 9:15' });

      // The device's clock hold reaches the walk under way (Plan 6's H6R-02, board D174): it goes on hold at once,
      // with no Pause or Resume to carry it on by the old reading.
      await t.step(3, 'Held at once for a new reading, never carried on by the old one', async () => {
        await main.getByText('This walk is on hold', { exact: true }).waitFor({ timeout: 10000 });
        const text = flat(await main.innerText());
        await t.checkpoint('held-after-change');
        await t.check(/Your phone’s clock changed during (this|a) walk/.test(text), `the held walk does not ask for a new reading: ${text.slice(0, 300)}`);
        await t.check(await ui.button(main, 'Pause').count() === 0 && await ui.button(main, 'Resume').count() === 0, 'the walk carries on, or offers to, with a reading the clock change leaves untimed');
      });

      await t.step(4, 'A new reading, 118 mg/dL: Carry on walking, and the walk runs again', async () => {
        await ui.tap(ui.button(main, 'Check in'));
        const sheet = page.getByRole('dialog', { name: ui.CHECKIN });
        await sheet.waitFor({ timeout: 10000 });
        // A reading that is needed opens the sheet on its form; one opened on its outcome asks for it first.
        for (const name of ['Enter a new reading', 'Change answers']) {
          if (await ui.button(sheet, name).count()) {
            await ui.tap(ui.button(sheet, name));
            break;
          }
        }
        await ui.answerCheckIn(t, sheet, { glucose: { value: '118', unit: 'mg/dL' } });
        await ui.tap(ui.button(sheet, 'Carry on walking'));
        await ui.button(main, 'Pause').waitFor({ timeout: 10000 });
        await t.checkpoint('walking-again');
      }, { input: 'glucose 118 mg/dL, taken now' });
    },
  },
  {
    name: 'a serious low on the device, the clock a day on and back: never deletable, the walk held, and Recently deleted kept (K8-01)',
    async run(t) {
      const page = await t.open({ seed: persona('P03'), route: '/day/today', visibility: true });
      const main = page.getByRole('main');
      const back = async () => {
        await page.evaluate(() => window.__acc.setVisibility('hidden'));
        await page.waitForTimeout(500);
        await page.evaluate(() => window.__acc.setVisibility('visible'));
        await page.waitForTimeout(800);
      };
      const lowRefused = async when => {
        await ui.legacyTab(page, 'Track');
        // The 52's own day, whatever day the phone's clock says it is.
        await ui.trackDay(page, '2026-10-08');
        await ui.tap(ui.section(main, 'Records').getByRole('link').filter({ hasText: '52' }).first());
        await ui.tap(ui.row(main, 'Delete this reading'));
        const refused = (await main.getByText(REFUSED, { exact: false }).count()) + (await main.getByText(CLOCK_REFUSED, { exact: false }).count());
        await t.check(refused >= 1, `${when}: the 52’s delete was not refused`);
        await t.check(lowsOf(await t.db()).length === 1, `${when}: the 52 is gone`);
      };
      const walkHeld = async when => {
        await hub.open(t, 'walk');
        const starts = (await hub.card(page).getByRole('button').allInnerTexts()).map(flat).filter(l => hub.STARTERS.test(l));
        await t.check(starts.length === 0, `${when}: the Walk hub offers ${JSON.stringify(starts)}`);
      };

      await t.step(1, 'Water 250 ml deleted into Recently deleted, and a 52 mg/dL low logged: the walk held, the 52 not deletable', async () => {
        await data.logWater(t, 250);
        await ui.tap(ui.row(ui.section(main, 'Day totals'), 'Water', 'link'));
        await ui.tap(ui.row(main, 'Delete this entry'));
        await rec.toast(page, 'Water 250 ml deleted').waitFor({ timeout: 10000 });
        await data.logGlucose(t, { value: 52 });
        await closeGuidance(page);
        await walkHeld('after the low');
        await lowRefused('at first');
      }, { input: 'Water 250 ml, deleted; glucose 52 mg/dL' });

      await t.step(2, 'The clock set a day on, and the app opened again: the 52 still not deletable, the walk still held', async () => {
        await t.jumpClock(DAY);
        await back();
        await lowRefused('a day on');
        await walkHeld('a day on');
        await t.checkpoint('a-day-on');
      }, { input: 'the phone’s clock set a day ahead' });

      await t.step(3, 'The clock set back a day: the walk still held by the low, and Recently deleted still holds the water', async () => {
        await t.jumpClock(-DAY);
        await back();
        await walkHeld('set back');
        await lowRefused('set back');
        const snap = await t.checkpoint('set-back');
        await t.check(Object.keys(content(snap)).some(k => k.startsWith('recent:')), 'the clock set back ended a Recently deleted entry');
        await ui.legacyTab(page, 'Track');
        const sheet = await rec.openRecentlyDeleted(t);
        await t.check(await sheet.getByRole('button', { name: 'Restore Water 250 ml', exact: true }).count() === 1, 'Recently deleted lost the water');
      }, { input: 'the phone’s clock set back a day' });
    },
  },
];
