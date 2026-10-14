/**
 * V-J36 (journey §17.2 #36, B-26; D108): a malformed or oversized backup → a
 * specific refusal, with the data untouched → a valid file → merge, with each
 * collection's differing records named first. Six files past a published
 * limit, each refused in its own words before anything in it is read or
 * converted (Review Focus 5): a file too large to read, a small gzip that
 * unpacks past the limit, one enormous text, nesting no app writes, more
 * usual meals than a restore takes, and a backup from the previous version
 * past a count of its own. Me → Data lists the limits; and a record past one
 * backs up whole, saying a restore can't take it (Codex P8-15 to P8-18). J19
 * covers truncated files, bad gzip, other apps' files and unreadable records.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { persona } from '../fixtures/personas.mjs';
import * as data from '../lib/data.mjs';
import * as food from '../lib/food.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J36';
export const title = 'A file past a published limit is refused in its own words; a valid one merges; a record past one backs up whole';
export const safety = false;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();
const MB = 1024 * 1024;
const AT = '2026-10-07T13:05:00.000+05:30';
const nested = levels => {
  let value = 1;
  for (let i = 0; i < levels; i++) value = [value];
  return value;
};
/** A file larger than a restore takes, made without writing its bytes: it must be refused by its size alone. */
function sparse(t, name, bytes) {
  const file = path.join(t.dir, 'fixtures', name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const fd = fs.openSync(file, 'w');
  fs.ftruncateSync(fd, bytes);
  fs.closeSync(fd);
  return file;
}
/** A backup from the previous version of the app (Settings → Export), as `limits.test.ts`'s fixture is. */
const legacy = over => ({
  version: 4,
  settings: {
    startDate: '2026-09-28', currentWeight: 82, targetGoal: 'Pain-free back', defaultRestSeconds: 90, useMetric: true, theme: 'system', onboardingComplete: true,
    gymDays: { monday: 'legs', tuesday: 'back', wednesday: 'rest', thursday: 'chest', friday: 'arms', saturday: 'core', sunday: 'rest' },
  },
  sessions: [], bodyMetrics: [], personalRecords: [], checkIns: [], focusOverrides: {},
  ...over,
});
const lifts = n => Array.from({ length: n }, (_, i) => ({ exerciseId: 'goblet-squat', weight: 20 + (i % 5), reps: 8, date: '2026-09-01', volume: 8 * (20 + (i % 5)) }));
const quick = name => ({ kind: 'quick', size: 'normal', name });

const REFUSALS = [
  {
    name: 'is larger than a restore takes',
    file: t => sparse(t, 'huge.json', 129 * MB),
    says: 'That file is too large to restore: it is 129 MB, and a restore takes at most 128 MB. Nothing was changed.',
  },
  {
    name: 'unpacks past 128 MB',
    file: t => data.writeFixture(t, 'bomb.json.gz', zlib.gzipSync(Buffer.alloc(129 * MB))),
    says: 'That file is too large to restore: it unpacks to over 128 MB, and a restore takes at most 128 MB. Nothing was changed.',
  },
  {
    name: 'holds a text 1,00,001 characters long',
    file: t => data.writeFixture(t, 'long-note.json', data.transferDoc({ observations: [data.obs({ id: 'g-long', kind: 'glucose', value: 110, at: '2026-10-07T08:00:00+05:30', note: 'x'.repeat(100_001) })] })),
    says: 'That file holds a text 1,00,001 characters long, and a restore takes none longer than 1,00,000. Nothing was changed.',
  },
  {
    name: 'nests deeper than this app writes',
    file: t => data.writeFixture(t, 'deep.json', data.transferDoc({ focusOverrides: { '2026-10-07': nested(40) } })),
    says: 'That file is built in a way this app never writes. Nothing was changed.',
  },
  {
    name: 'holds more usual meals than a restore takes',
    file: t => data.writeFixture(t, 'usual.json', data.transferDoc({ stores: ['meals', 'savedMeals', 'customFoods'], records: { meals: [], savedMeals: new Array(10_001).fill({}), customFoods: [] } })),
    says: 'That file holds 10,001 usual meals, and a restore takes at most 10,000. Nothing was changed.',
  },
  {
    name: 'is the previous version’s backup, past a count of its own',
    file: t => data.writeFixture(t, 'legacy.json', legacy({ personalRecords: lifts(10_001) })),
    says: 'That file holds 10,001 personal records, and a restore takes at most 10,000. Nothing was changed.',
  },
];

export const cases = [
  {
    name: 'the published limits, six hostile files, then a valid one',
    async run(t) {
      const page = await t.open({ seed: persona('P01'), route: '/home' });
      let before;
      let sheet;

      await t.step(1, 'Me → Data → What a backup can hold: every limit, in Indian grouping', async () => {
        const main = await data.openData(t);
        await ui.tap(ui.row(main, 'What a backup can hold'));
        const limits = page.getByRole('dialog', { name: 'What a backup can hold' });
        await limits.waitFor();
        const text = flat(await limits.innerText());
        await t.checkpoint('limits');
        for (const line of ['File size 128 MB, packed or unpacked', 'Readings 10,00,000', 'Usual meals 10,000', 'Route points, all routes together 50,00,000', 'Longest single text 1,00,000 characters']) {
          await t.check(text.includes(line), `“What a backup can hold” lacks “${line}”: ${text.slice(0, 300)}`);
        }
        await ui.tap(ui.button(limits, 'Close'));
      });

      await t.step(2, 'A glucose reading of this phone’s own, then the record as it stands', async () => {
        await data.logGlucose(t, { value: 118 });
        before = await t.checkpoint('before-files');
      }, { input: 'Glucose 118 mg/dL' });

      for (const [i, r] of REFUSALS.entries()) {
        await t.step(3 + i, `A file that ${r.name}: refused in its own words, nothing changed`, async () => {
          const file = r.file(t);
          if (i === 0) sheet = await data.chooseRestore(t, file);
          else await data.chooseAnother(t, sheet, file);
          await data.waitOutcome(t, sheet);
          const text = flat(await sheet.innerText());
          await t.checkpoint(`refused-${i + 1}`);
          await t.check(text.includes(r.says), `the refusal reads “${text.slice(0, 300)}”, not “${r.says}”`);
          const diffs = data.sameSnapshot(before, await t.db());
          await t.check(diffs.length === 0, `the record changed: ${diffs.slice(0, 5).join(' | ')}`);
        }, { input: r.name });
      }

      await t.step(9, 'A valid file: this phone’s reading with another figure, a meal, a usual meal and an own food → each named → Merge', async () => {
        const mine = (before.observations ?? []).find(o => o.kind === 'glucose' && o.value === 118);
        await t.must(!!mine, 'the 118 mg/dL reading is not stored');
        const valid = data.transferDoc({
          observations: [{ ...mine, value: 121 }],
          stores: ['meals', 'savedMeals', 'customFoods'],
          records: {
            meals: [food.meal('meal-from-file', AT, 'lunch', [food.ROTI], 'meals')],
            savedMeals: [{ id: 'usual-from-file', name: 'Weekday lunch', items: [quick('Normal plate')], savedAt: AT, updatedAt: AT }],
            customFoods: [{ id: 'food-from-file', name: 'Bhel puri', per: { qty: 1, unit: 'plate' }, createdAt: AT, updatedAt: AT }],
          },
        });
        await data.chooseAnother(t, sheet, data.writeFixture(t, 'valid.json', valid));
        const differ = ui.section(sheet, 'Records that differ');
        await differ.waitFor({ timeout: 10000 });
        const differs = flat(await differ.innerText());
        const holds = flat(await ui.section(sheet, 'In this file').innerText());
        await t.checkpoint('valid-preview');
        await t.check(/Readings\s*1/.test(differs), `“Records that differ” does not name the readings: ${differs.slice(0, 200)}`);
        for (const line of ['Meals 1', 'Usual meals 1', 'Own foods 1']) await t.check(holds.includes(line), `“In this file” lacks “${line}”: ${holds.slice(0, 300)}`);
        await data.merge(t, sheet);
        const snap = await t.checkpoint('merged');
        await t.check(/Merged\./.test(flat(await sheet.innerText())), 'the merge did not say Merged.');
        const glucose = (snap.observations ?? []).filter(o => o.id === mine.id);
        await t.check(glucose.length === 1 && glucose[0].value === 118, `the merge did not keep this phone’s reading: ${JSON.stringify(glucose.map(o => o.value))}`);
        for (const [store, id] of [['meals', 'meal-from-file'], ['savedMeals', 'usual-from-file'], ['customFoods', 'food-from-file']]) {
          await t.check((snap[store] ?? []).some(r => r.id === id), `the file’s ${id} was not added`);
        }
      }, { input: 'the same reading at 121 mg/dL; a lunch, a usual meal and an own food' });
    },
  },
  {
    name: 'a record past a limit backs up whole, and says a restore can’t take it',
    async run(t) {
      await t.open({ seed: persona('P01', { patch: { personalRecords: lifts(10_001) } }), route: '/home' });
      let made;

      await t.step(1, 'Back up your record: the warning, and every personal record in the file', async () => {
        made = await data.backup(t);
        await t.checkpoint('backed-up');
        const warning = 'This backup holds everything, but it holds 10,001 personal records, and a restore takes at most 10,000, so this version of the app can’t restore it. Keep it: nothing was left out of it.';
        await t.check(made.said.includes(warning), `the backup sheet does not warn: ${made.said.slice(0, 400)}`);
        await t.must(made.bytes?.length > 0, `no backup left the app (${made.via})`);
        await t.check(data.decodeBackup(made.bytes).personalRecords?.length === 10_001, 'the backup left personal records out (D108)');
      }, { input: '10,001 personal records on this phone' });

      await t.step(2, 'That backup, restored: refused in its own words, nothing changed', async () => {
        const before = await t.db();
        const sheet = await data.chooseRestore(t, data.writeFixture(t, made.name ?? 'backup.json.gz', made.bytes));
        await data.waitOutcome(t, sheet);
        const text = flat(await sheet.innerText());
        await t.checkpoint('own-backup-refused');
        await t.check(text.includes('That file holds 10,001 personal records, and a restore takes at most 10,000. Nothing was changed.'), `the refusal reads “${text.slice(0, 300)}”`);
        const diffs = data.sameSnapshot(before, await t.db());
        await t.check(diffs.length === 0, `the record changed: ${diffs.slice(0, 5).join(' | ')}`);
      });
    },
  },
];
