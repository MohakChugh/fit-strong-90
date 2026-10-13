/**
 * V-J40 (journey §17.2 #40, J§20.4; B-30): with text at 200%, a blood
 * pressure reading logged with the keyboard up → the minute's announcement
 * doesn't move focus → Save → focus back on the button that opened the form.
 * And B-30's interrupted audio cue: a walk cue the system cuts off is never
 * resumed, and the next one still plays. VoiceOver itself is on the device
 * checklist (Task 17).
 */
import { MINUTE } from '../lib/env.mjs';
import { persona } from '../fixtures/personas.mjs';
import { saveForm } from '../lib/data.mjs';
import * as hub from '../lib/hub.mjs';
import * as ui from '../lib/ui.mjs';
import * as walk from '../lib/walk.mjs';

export const id = 'V-J40';
export const title = 'Text at 200%: focus stays through the minute and comes back; an interrupted cue stays stopped';
export const safety = false;

const focusName = page => page.evaluate(() => {
  const el = document.activeElement;
  return el ? (el.getAttribute('aria-label') || el.textContent || el.id || el.tagName).trim() : '';
});

export const cases = [
  {
    name: 'blood pressure at 200% text',
    async run(t) {
      const page = await t.open({ seed: persona('P01'), route: '/home', textScale: 2 });
      const main = page.getByRole('main');
      const form = page.getByRole('dialog', { name: 'Blood pressure' });
      const second = form.getByRole('group', { name: 'Second reading' });

      await t.step(1, 'BP hub → Add reading → 124/78 → Add a second reading → its Top field, keyboard up', async () => {
        await hub.openHub(t, 'Blood pressure', '/hub/bp');
        await ui.tap(ui.button(main, 'Add reading'));
        await form.waitFor({ timeout: 10000 });
        await ui.type(form.getByRole('textbox', { name: 'Top (systolic)', exact: true }), '124');
        await ui.type(form.getByRole('textbox', { name: 'Bottom (diastolic)', exact: true }), '78');
        await ui.tap(ui.button(form, 'Add a second reading'));
        await second.getByRole('textbox', { name: 'Top (systolic)', exact: true }).focus();
        await page.evaluate(() => { window.__accFocused = document.activeElement; });
        await t.check(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'the page scrolls sideways at 200% text');
        await t.checkpoint('second-field-200');
      }, { input: '124/78; text at 200%' });

      await t.step(2, 'The minute passes: it is announced, and focus stays in the field', async () => {
        await t.advance(60_000);
        const live = form.locator('[aria-live="polite"]').filter({ hasText: 'A minute has passed: you can take the second reading now.' });
        await t.check(await live.count() === 1, 'the minute is not announced');
        await t.check(await page.evaluate(() => document.activeElement === window.__accFocused), `the announcement moved focus to “${await focusName(page)}”`);
      });

      await t.step(3, '122/76 → Save: the sheet closes, and focus is back on Add reading', async () => {
        await second.getByRole('textbox', { name: 'Top (systolic)', exact: true }).fill('122');
        await second.getByRole('textbox', { name: 'Bottom (diastolic)', exact: true }).fill('76');
        await t.must(await saveForm(t, form) === 'closed', 'the two readings did not save');
        await page.waitForTimeout(500);
        await t.check(await focusName(page) === 'Add reading', `focus went to “${await focusName(page)}”, not back to Add reading`);
        await t.checkpoint('saved-200');
      }, { input: '122/76' });
    },
  },
  {
    name: 'a walk cue the system cuts off is never resumed (B-30)',
    async run(t) {
      const page = await t.open({ seed: persona('P03', { patch: { profile: { voice: { muted: false } } } }), route: '/home' });
      let plays = 0;

      await t.step(1, 'A walk, nine minutes in', async () => {
        await walk.openSetup(t);
        await walk.start(t, ui.normalAnswers('P03'));
        await walk.elapse(t, 9 * MINUTE);
      });

      await t.step(2, 'The 10-minute cue starts, and the system takes the audio at once', async () => {
        const before = (await walk.played(page)).length;
        await walk.elapse(t, MINUTE);
        await page.waitForFunction(n => window.__acc.calls.play.length > n, before, { timeout: 10000 });
        await page.evaluate(() => window.__acc.lastAudio?.pause());
        plays = (await walk.played(page)).length;
        await t.checkpoint('cue-interrupted');
      });

      await t.step(3, 'Never resumed: nothing plays for the rest of the cue’s grace', async () => {
        await walk.elapse(t, 50_000, 10_000);
        const after = await walk.played(page);
        await t.check(after.length === plays, `the interrupted cue played again: ${JSON.stringify(after.slice(plays))}`);
      });

      await t.step(4, 'The 20-minute cue still plays', async () => {
        await walk.elapse(t, 9 * MINUTE + 10_000);
        await t.check(await walk.cueHeard(page, 'Twenty minutes of walking.'), 'no cue played after an interrupted one');
        await t.check((await walk.played(page)).length > plays, 'the 20-minute cue never played');
        await t.checkpoint('next-cue');
      });
    },
  },
];
