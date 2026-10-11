/**
 * V-J18, P02: a medicine change after setup (journey §16): a changed medicine
 * re-runs its chapter's follow-ups and says what changes.
 */
import { docs } from '../lib/harness.mjs';
import { persona } from '../fixtures/personas.mjs';
import * as setup from '../lib/setup.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J18';
export const title = 'A medicine change after setup';
export const safety = true;

/** The check-in for `mode`, past its first question: "None of these" right now, so the day's questions show. */
const checkIn = async (t, mode) => {
  await t.goto(`/home?checkin=${mode}`);
  const sheet = t.page.getByRole('dialog', { name: ui.CHECKIN });
  await sheet.waitFor();
  await ui.tap(ui.checkbox(ui.section(sheet, 'Right now, any of these?'), 'None of these'));
  await sheet.getByRole('radiogroup', { name: 'Sleep last night' }).waitFor();
  return sheet;
};

export const cases = [{
  name: 'main',
  async run(t) {
    const page = await t.open({ seed: persona('P02'), route: '/home' });
    await t.step(1, 'Stretch → the check-in: no ketone rows', async () => {
      const sheet = await checkIn(t, 'stretch');
      await t.check(await sheet.getByText(/Ketones/).count() === 0, 'the check-in asks about ketones before any ketone risk');
      await ui.tap(ui.button(sheet, 'Close'));
    });
    await t.step(2, 'Edit Your medicines: a “-gliflozin”; Ketones appears; Save', async () => {
      const main = await setup.openChapter(t, 'Your medicines');
      await setup.choose(main, 'Do you take any regular medicines?', 'Yes');
      await setup.tick(main, 'A “-gliflozin” medicine');
      await main.getByRole('heading', { level: 2, name: 'Ketones', exact: true }).waitFor();
      await setup.choose(main, 'Can you test ketones?', 'Urine strips');
      await setup.choose(main, 'Glucose meter or sensor', 'Neither');
      await setup.choose(main, 'Home blood-pressure cuff', 'No');
      await t.checkpoint('medicines-edited');
      await setup.save(t);
      await t.check(await main.getByText('Each check-in will ask about ketones and the signs of ketoacidosis.', { exact: true }).count() === 1, 'the save does not say what changes');
      const h = docs(await t.db()).profile?.health ?? {};
      await t.check(h.sglt2i === true && h.ketoneTest === 'urine' && h.medicinesReviewed === true, `stored: ${JSON.stringify({ sglt2i: h.sglt2i, ketoneTest: h.ketoneTest, reviewed: h.medicinesReviewed })}`);
    }, { input: 'regular medicines Yes; a -gliflozin; urine strips; no meter, no cuff' });
    await t.step(3, 'Home → Stretch → the check-in asks for a urine strip', async () => {
      const sheet = await checkIn(t, 'stretch');
      await t.checkpoint('check-in-ketones');
      await t.check(await sheet.getByText('Ketones, urine strip', { exact: true }).count() >= 1, 'the check-in does not ask “Ketones, urine strip”');
    });
  },
}];
