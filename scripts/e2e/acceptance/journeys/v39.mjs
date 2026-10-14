/**
 * V-J39: calendar copies after a fluid limit is added (journey §17.2 V-J39,
 * §15; A-78). Reminders records what each calendar file holds, says when the
 * copies may be out of date and what to do, and a new file replaces them. A
 * changed glass size, at the same times, dates them too (codex H4-05).
 */
import { docs } from '../lib/harness.mjs';
import { persona } from '../fixtures/personas.mjs';
import * as g from '../lib/guide.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J39';
export const title = 'Calendar copies after a fluid limit';
export const safety = false;

const flat = s => s.replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ');
const HABITS = {
  water: { enabled: true, glassMl: 250, everyMinutes: 120, from: '09:00', to: '21:00' },
  sittingBreak: { enabled: true, everyMinutes: 60, from: '10:00', to: '16:00' },
};

const glassSize = {
  name: 'out of date after the glass size changes, at the same times (codex H4-05)',
  async run(t) {
    const page = await t.open({
      seed: persona('P02', { patch: { settings: { habits: HABITS }, profile: { health: { fluidRestriction: false } } } }),
      route: '/home',
      capabilities: { share: 'absent' },
    });
    const main = page.getByRole('main');
    const shown = async () => flat(await main.innerText());
    await t.step(1, 'Me → Reminders → Add to Calendar: a fresh file reads as up to date', async () => {
      await g.openHabits(t);
      const cal = await g.openHabitSheet(t, 'Add to Calendar');
      const file = await g.download(t, () => ui.tap(ui.button(cal, 'Add to Calendar')));
      await t.check(g.parseIcs(file.text).events.some(e => /250 ml/.test(e.DESCRIPTION ?? '')), 'the file’s water events do not say 250 ml');
      await ui.tap(ui.button(cal, 'Close'));
      await cal.waitFor({ state: 'hidden' });
      await t.check(!/may be out of date/.test(await shown()), 'a fresh file reads as out of date');
    });
    await t.step(2, 'Water → 150 ml glass → Save, the times unchanged: the copies may be out of date, still worded as before', async () => {
      const ws = await g.openHabitSheet(t, 'Water');
      await ui.tap(ws.getByRole('radiogroup', { name: 'Glass size' }).getByRole('radio', { name: '150 ml', exact: true }));
      await ui.tap(ui.button(ws, 'Save'));
      await ws.waitFor({ state: 'hidden' });
      const text = await shown();
      await t.checkpoint('reminders-glass-out-of-date');
      await t.check(/Your calendar copies may be out of date/.test(text), `no out-of-date warning after the glass size changed: ${text.slice(0, 300)}`);
      await t.check(/Glass of water: 6 a day in Calendar, still worded as before your change\./.test(text), `the warning does not say what changed: ${text.slice(0, 400)}`);
    }, { input: 'glass 150 ml' });
  },
};

export const cases = [{
  name: 'out of date after a fluid limit, then replaced',
  async run(t) {
    const page = await t.open({
      seed: persona('P02', { patch: { settings: { habits: HABITS }, profile: { health: { fluidRestriction: false } } } }),
      route: '/home',
      capabilities: { share: 'absent' },
    });
    const main = page.getByRole('main');
    const shown = async () => flat(await main.innerText());
    await t.step(1, 'Me → Reminders → Add to Calendar: the copies are listed', async () => {
      await g.openHabits(t);
      const text = await shown();
      await t.check(/FitStrong can’t alert you while it’s closed\. For safety re-checks, set a timer on your phone\./.test(text), 'Reminders does not say the app can’t alert while closed');
      const cal = await g.openHabitSheet(t, 'Add to Calendar');
      const file = await g.download(t, () => ui.tap(ui.button(cal, 'Add to Calendar')));
      await t.check(file.name.endsWith('.ics'), `the file is ${file.name}`);
      await ui.tap(ui.button(cal, 'Close'));
      await cal.waitFor({ state: 'hidden' });
      const after = await shown();
      await t.check(/Calendar reminders are copies\. Changes here don’t update them\. Remove the old ones and add the new file\./.test(after), 'Reminders does not say calendar reminders are copies');
      await t.check(/Glass of water 6 a day · added 8 Oct 2026 · until 6 Jan 2027/.test(after) && /Stand up and move 6 a day · added 8 Oct 2026 · until 6 Jan 2027/.test(after), `the copies are not listed: ${after.slice(0, 500)}`);
      await t.check(!/may be out of date/.test(after), 'a fresh file reads as out of date');
      const exp = docs(await t.db()).settings?.habits?.calendarExport ?? {};
      await t.check(exp.water?.minutes?.length === 6 && exp.sittingBreak?.minutes?.length === 6, `the file’s times were not kept: ${JSON.stringify(exp)}`);
      await t.checkpoint('reminders-copies');
    });
    await t.step(2, 'Water → “Yes, I have a fluid limit” → Save: the copies may be out of date', async () => {
      const ws = await g.openHabitSheet(t, 'Water');
      await ui.tap(ui.row(ws.getByRole('radiogroup', { name: 'Has your care team told you to limit how much you drink?' }), 'Yes, I have a fluid limit', 'radio'));
      await ui.tap(ui.button(ws, 'Save'));
      await ws.waitFor({ state: 'hidden' });
      const text = await shown();
      await t.check(/Your calendar copies may be out of date/.test(text), `no out-of-date warning: ${text.slice(0, 300)}`);
      await t.check(/Glass of water: 6 a day in Calendar, none now\./.test(text), 'the warning does not say what changed');
      await t.check(/This app can’t remove them\. In Calendar, delete those events, or the calendar you added them to, then add the new file with Add to Calendar\./.test(text), 'the warning does not say what to do');
      await t.checkpoint('reminders-out-of-date');
    }, { input: 'fluid limit: yes' });
    await t.step(3, 'I have deleted them → Add to Calendar: the new copies match', async () => {
      await ui.tap(ui.row(main, 'I have deleted them'));
      await page.waitForTimeout(300);
      await t.check(!/may be out of date/.test(await shown()), 'the warning stays after the old copies were removed');
      const cal = await g.openHabitSheet(t, 'Add to Calendar');
      const file = await g.download(t, () => ui.tap(ui.button(cal, 'Add to Calendar')));
      await t.check(!g.parseIcs(file.text).events.some(e => /water/i.test(e.SUMMARY ?? '')), 'the new file still holds water');
      await ui.tap(ui.button(cal, 'Close'));
      await cal.waitFor({ state: 'hidden' });
      const text = await shown();
      await t.check(/Stand up and move 6 a day/.test(text) && !/Glass of water \d+ a day/.test(text) && !/may be out of date/.test(text), `after replacing, Reminders reads: ${text.slice(0, 500)}`);
      const exp = docs(await t.db()).settings?.habits?.calendarExport ?? {};
      await t.check(!exp.water && !!exp.sittingBreak, `the copies kept: ${Object.keys(exp).join(', ')}`);
      await t.checkpoint('reminders-replaced');
    });
  },
}, glassSize];
