/**
 * V-J10, P01: change my weight in Me (journey §16, §18.1; board D83).
 * A weight change is a dated reading; a page saved in other units drifts nothing (Review Focus 2).
 */
import { docs } from '../lib/harness.mjs';
import { persona } from '../fixtures/personas.mjs';
import * as setup from '../lib/setup.mjs';

export const id = 'V-J10';
export const title = 'Change my weight';
export const safety = false;

const weights = snap => (snap.observations ?? []).filter(o => o.kind === 'weight');
const brief = o => ({ v: o.value, unit: o.unit, scope: o.scope, source: o.source, context: o.context, day: o.day, timeUnknown: o.timeUnknown });

export const cases = [{
  name: 'main',
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/home' });
    let before;
    await t.step(1, 'Me → Profile & health → Edit About you', async () => {
      before = await t.db();
      const main = await setup.openChapter(t, 'About you');
      for (const h of ['What should we call you?', 'Body for the exercise demos', 'Your height and weight']) {
        await t.check(await main.getByRole('heading', { level: 2, name: h, exact: true }).count() === 1, `About you does not show “${h}”`);
      }
      await t.checkpoint('edit-about-you');
    });
    await t.step(2, 'Weight 80 kg; Save', async () => {
      await setup.fill(page.getByRole('main'), 'Weight in kg', '80');
      await setup.save(t);
      const snap = await t.checkpoint('about-you-saved');
      const added = weights(snap).filter(o => !weights(before).some(b => b.id === o.id));
      await t.check(added.length === 1 && added[0].value === 80 && added[0].unit === 'kg' && added[0].scope === 'pointInTime'
        && added[0].source === 'manual' && added[0].context === 'profile' && added[0].day === '2026-10-08' && !added[0].timeUnknown,
        `the new weight readings: ${JSON.stringify(added.map(brief))}`);
      const migrated = weights(before).find(o => o.day === '2026-09-25');
      await t.check(!!migrated && JSON.stringify(weights(snap).find(o => o.id === migrated.id)) === JSON.stringify(migrated), 'the migrated 25 September weight changed');
      const d = docs(snap);
      const was = docs(before).profile ?? {};
      await t.check(d.profile?.weightKg === 80 && d.settings?.currentWeight === 80, `weight is ${d.profile?.weightKg} in the profile, ${d.settings?.currentWeight} in the settings`);
      const changed = Object.keys(d.profile ?? {}).filter(k => k !== 'weightKg' && JSON.stringify(d.profile[k]) !== JSON.stringify(was[k]));
      await t.check(changed.length === 0, `other profile fields changed: ${changed.join(', ')}`);
      await t.check(!(snap.observations ?? []).some(o => o.kind === 'height'), 'a height reading was added though the height did not change');
    }, { input: 'weight 80 kg' });
    await t.step(3, 'The Weight hub shows it, dated today', async () => {
      await t.goto('/hub/weight');
      const text = (await page.getByRole('main').innerText()).replace(/\s+/g, ' ');
      await t.checkpoint('weight-hub');
      await t.check(/\b80(\.0)?\s?kg/.test(text), `the Weight hub does not show 80 kg: ${text.slice(0, 300)}`);
    });
    await t.step(4, 'Feet and pounds, saved unchanged: nothing drifts (Review Focus 2)', async () => {
      const count = (await t.db()).observations?.length ?? 0;
      const main = await setup.openChapter(t, 'About you');
      await setup.choose(main, 'Units', 'ft, in and lb');
      await setup.save(t);
      const snap = await t.db();
      const d = docs(snap);
      await t.check(d.settings?.useMetric === false, `useMetric is ${d.settings?.useMetric}`);
      await t.check(d.profile?.weightKg === 80 && d.profile?.heightCm === 175, `after saving in feet and pounds: ${d.profile?.weightKg} kg, ${d.profile?.heightCm} cm`);
      await t.check((snap.observations?.length ?? 0) === count, 'saving unchanged values in other units added a reading');
    }, { input: 'Units ft, in and lb; Save' });
  },
}];
