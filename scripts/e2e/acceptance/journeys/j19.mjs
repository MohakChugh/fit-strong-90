/**
 * J19, P01: merge, malformed files and capability fallback
 * (codex-acceptance.md; basis D10, D16, D17; PLAN Task 1).
 *
 * Files reach the app only through its own Restore from a backup file
 * chooser; capabilities are taken away with init-script shims before the app
 * loads (lib/inpage.mjs capabilityInit), never by changing the app.
 */
import { docs } from '../lib/harness.mjs';
import { persona } from '../fixtures/personas.mjs';
import { MINUTE, NOW } from '../lib/env.mjs';
import * as ui from '../lib/ui.mjs';
import * as data from '../lib/data.mjs';

export const id = 'J19';
export const title = 'Merge, malformed files and capability fallback';
export const safety = false;

const C0_GLUCOSE = 'checkIn:2026-09-25:glucose';
const flat = s => s.replace(/[  ]/g, ' ').replace(/\s+/g, ' ');
const say = async locator => flat(await locator.innerText());
const iso = ms => {
  const d = new Date(ms + 5.5 * 3600 * 1000);
  return `${d.toISOString().slice(0, 23)}+05:30`;
};

/** Open the glucose reading `value` from Track → Trends → Glucose and correct it to `to`. */
async function correctGlucose(t, value, to) {
  const page = t.page;
  const main = page.getByRole('main');
  await ui.tab(page, 'Track');
  await ui.tap(ui.radio(main.getByRole('radiogroup', { name: 'Show' }), 'Trends'));
  await ui.tap(main.getByRole('link', { name: /^Glucose/ }));
  await page.getByRole('heading', { level: 1, name: 'Glucose', exact: true }).waitFor();
  await ui.tap(main.getByRole('link').filter({ hasText: new RegExp(`^${value} mg/dL`) }));
  await page.waitForFunction(() => location.hash.startsWith('#/track/reading/'), null, { timeout: 15000 });
  await ui.row(main, 'Correct this').waitFor({ timeout: 15000 });
  await ui.tap(ui.row(main, 'Correct this'));
  const edit = page.getByRole('dialog', { name: 'Correct this record' });
  await ui.type(edit.getByRole('textbox', { name: 'Value', exact: true }), String(to));
  await ui.tap(ui.button(edit, 'Save correction'));
  await edit.waitFor({ state: 'hidden' });
}

/** Restore from a backup with `file`: what the sheet said, then it is closed. The record must not change. */
async function rejectFile(t, name, file, expect) {
  const before = await t.db();
  const sheet = await data.chooseRestore(t, file);
  await t.page.waitForTimeout(300);
  const said = await say(sheet);
  await t.checkpoint(`file-${name}`);
  await t.check(expect.test(said), `${name}: the app said “${said.slice(0, 220)}”, not ${expect}`);
  await t.check(!/connected|synced|linked to (Apple )?Health|imported from (Apple )?Health/i.test(said), `${name}: the message presents the file as a Health connection: ${said.slice(0, 200)}`);
  await ui.tap(ui.button(sheet, 'Close'));
  await sheet.waitFor({ state: 'hidden' });
  const after = await t.db();
  const changed = data.sameSnapshot(before, after);
  await t.check(changed.length === 0, `${name}: the record changed: ${changed.slice(0, 3).join(' | ')}`);
  return said;
}

const UNREADABLE = /could not be read|damaged|not an export|not a health record/i;
const NEWER = /newer version of this app\. Update the app/;

const sequence = {
  name: 'merge, conflicts, malformed and unsupported files',
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/today' });
    let B; let fileB; let mine; let corrected;

    await t.step(1, 'Export B; correct an existing reading (newer editedAt); add another; merge B twice', async () => {
      const made = await data.backup(t, { expectVia: 'download' });
      B = data.decodeBackup(made.bytes);
      fileB = data.writeFixture(t, made.name, made.bytes);
      await correctGlucose(t, 104, 105);
      await data.logGlucose(t, { value: 120 });
      const before = await t.db();
      corrected = (before.observations ?? []).find(o => o.id === C0_GLUCOSE);
      mine = (before.observations ?? []).find(o => o.kind === 'glucose' && o.value === 120);
      await t.must(corrected?.value === 105 && typeof corrected.editedAt === 'string' && mine, `the correction or the new reading did not save: ${JSON.stringify({ corrected, mine })}`);
      for (const round of [1, 2]) {
        const sheet = await data.chooseRestore(t, fileB);
        await data.merge(t, sheet);
        await t.check(/Merged\./.test(await say(sheet)), `merge ${round} did not complete: ${(await say(sheet)).slice(0, 200)}`);
        await ui.tap(ui.button(sheet, 'Done'));
      }
      const after = await t.checkpoint('after-two-merges');
      const obs = after.observations ?? [];
      await t.check(obs.find(o => o.id === C0_GLUCOSE)?.value === 105 && obs.find(o => o.id === C0_GLUCOSE)?.editedAt === corrected.editedAt, `the newer device correction was not kept: ${JSON.stringify(obs.find(o => o.id === C0_GLUCOSE))}`);
      await t.check(obs.some(o => o.id === mine.id), 'the device-only reading was lost in the merge');
      await t.check(obs.length === (before.observations ?? []).length && new Set(obs.map(o => o.id)).size === obs.length, `merging B twice changed the observation count ${(before.observations ?? []).length} → ${obs.length}`);
      await t.check((after.sessions ?? []).length === (before.sessions ?? []).length, 'merging duplicated sessions');
      const [d0, d1] = [docs(before), docs(after)];
      for (const key of ['settings', 'profile', 'checkIns', 'personalRecords', 'bodyMetrics', 'focusOverrides']) {
        await t.check(JSON.stringify(d0[key]) === JSON.stringify(d1[key]), `merging changed this device's ${key}`);
      }
    }, { input: 'correct C0 glucose 104 → 105; add glucose 120; merge B twice' });

    await t.step(2, 'Import the same reading with a provably newer correction: the newer one is kept', async () => {
      await t.advance(10 * MINUTE);
      const newer = { ...B.observations.find(o => o.id === C0_GLUCOSE), value: 107, editedAt: iso(NOW + 5 * MINUTE) };
      delete newer.seq;
      const sheet = await data.chooseRestore(t, data.writeFixture(t, 'newer-correction.json', data.transferDoc({ observations: [newer] })));
      await data.merge(t, sheet);
      await ui.tap(ui.button(sheet, 'Done'));
      const snap = await t.checkpoint('after-newer-correction');
      const got = (snap.observations ?? []).find(o => o.id === C0_GLUCOSE);
      await t.check(got?.value === 107 && got.editedAt === newer.editedAt, `the provably newer correction was not taken: ${JSON.stringify(got)}`);
      await t.check(got && got.at === corrected.at && got.context === corrected.context && got.source === corrected.source && got.unit === corrected.unit && got.timeUnknown === corrected.timeUnknown,
        `the merge changed fields the correction did not: ${JSON.stringify(got)} vs ${JSON.stringify(corrected)}`);
      await t.check((snap.observations ?? []).some(o => o.id === mine.id), 'other records were lost');
      corrected = got;
    }, { input: `C0 glucose value 107, editedAt ${iso(NOW + 5 * MINUTE)}` });

    await t.step(3, 'Import equal-revision and revision-less conflicts: disclosed, device kept by default, file only by choice', async () => {
      const equal = { ...corrected, value: 109 };
      delete equal.seq;
      const session = { ...B.sessions[0], notes: 'Changed in the file' };
      const checkIn = { ...B.checkIns[0], energy: 2 };
      const metric = { ...B.bodyMetrics[0], waist: 96 };
      const file = data.writeFixture(t, 'conflicts.json', data.transferDoc({ observations: [equal], sessions: [session], checkIns: [checkIn], bodyMetrics: [metric] }));
      const sheet = await data.chooseRestore(t, file);
      const preview = await say(sheet);
      await t.checkpoint('conflicts-preview');
      await t.check(/Records that differ/i.test(preview) && /\b4 records\b/.test(preview), `the conflicts are not disclosed (expected 4): ${preview.slice(0, 500)}`);
      const keep = sheet.getByRole('radio', { name: /^Keep this .*copy$/ });
      await t.check(await keep.getAttribute('aria-checked') === 'true', 'keeping this device’s copy is not the default');
      await t.check(!/file (always )?wins|file’s copy is (always )?used|replaces what is here/i.test(preview), `the preview says the file wins: ${preview.slice(0, 300)}`);
      await data.merge(t, sheet);
      const merged = await say(sheet);
      await t.check(/differed/.test(merged) && /this device’s copy was kept/.test(merged), `the merge result does not say this device's copies were kept: ${merged.slice(0, 300)}`);
      await ui.tap(ui.button(sheet, 'Done'));
      let snap = await t.db();
      let d = docs(snap);
      await t.check((snap.observations ?? []).find(o => o.id === C0_GLUCOSE)?.value === 107, 'the device reading was overwritten by an equal-revision file copy');
      await t.check((snap.sessions ?? []).find(s => s.id === 'legacy-strength')?.notes === 'Retain this session note', 'the device session was overwritten');
      await t.check(d.checkIns?.find(c => c.date === '2026-09-25')?.energy === 4, 'the device check-in was overwritten');
      await t.check(d.bodyMetrics?.find(m => m.date === '2026-09-25')?.waist === 95, 'the device body measurement was overwritten');
      // Now the explicit choice.
      const again = await data.chooseRestore(t, file);
      await data.merge(t, again, { takeFile: true });
      await t.check(/the file’s copy/.test(await say(again)), `choosing the file's copy is not reported: ${(await say(again)).slice(0, 200)}`);
      await ui.tap(ui.button(again, 'Done'));
      snap = await t.checkpoint('after-take-file');
      d = docs(snap);
      await t.check((snap.observations ?? []).find(o => o.id === C0_GLUCOSE)?.value === 109 && (snap.sessions ?? []).find(s => s.id === 'legacy-strength')?.notes === 'Changed in the file'
        && d.checkIns?.find(c => c.date === '2026-09-25')?.energy === 2 && d.bodyMetrics?.find(m => m.date === '2026-09-25')?.waist === 96,
        'choosing the file’s copy did not take every conflicting record from the file');
    }, { input: 'equal-revision glucose 109; legacy session note; C0 energy 2; 25 Sep waist 96' });

    await t.step(4, 'Malformed files: truncated, bad gzip, other format/version, negative glucose, unknown unit, impossible date, broken BP half', async () => {
      const good = data.obs({ id: 'fx-ok', kind: 'glucose', value: 99, at: '2026-10-08T07:00:00.000+05:30' });
      const doc = obsList => data.transferDoc({ observations: obsList });
      const json = JSON.stringify(doc([good]));
      await rejectFile(t, 'truncated', data.writeFixture(t, 'truncated.json', json.slice(0, Math.floor(json.length / 2))), UNREADABLE);
      await rejectFile(t, 'bad-gzip', data.writeFixture(t, 'bad.json.gz', Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0x13, 0x37, 0xde, 0xad, 0xbe, 0xef, 0x00, 0x01, 0x02])), UNREADABLE);
      await rejectFile(t, 'other-format', data.writeFixture(t, 'other.json', { format: 'some-other-health-app', version: 1, observations: [good] }), /different app/);
      await rejectFile(t, 'other-version', data.writeFixture(t, 'v2.json', { ...doc([good]), version: 2 }), NEWER);
      const bad = {
        'negative-glucose': { ...good, id: 'fx-neg', value: -5 },
        'unknown-unit': { ...good, id: 'fx-unit', unit: 'mmol' },
        'impossible-date': { ...good, id: 'fx-date', at: '2026-02-30T08:00:00.000+05:30', day: '2026-02-30' },
        'broken-bp-half': { id: 'fx-bp:bloodPressureSystolic', kind: 'bloodPressureSystolic', value: '130', unit: 'mmHg', scope: 'pointInTime', source: 'manual', at: '2026-10-08T07:05:00.000+05:30', day: '2026-10-08', context: 'bp:fx-bp' },
      };
      for (const [name, record] of Object.entries(bad)) {
        const file = data.writeFixture(t, `${name}.json`, doc([good, record]));
        const said = await rejectFile(t, name, file, /1 record in this file cannot be read/);
        await t.check(/leaves that one out/.test(said), `${name}: the preview does not say the unreadable record is left out: ${said.slice(0, 200)}`);
      }
      // A file with an unreadable record cannot half-Replace quietly: the confirmation says what is left out.
      const before = await t.db();
      const sheet = await data.chooseRestore(t, data.writeFixture(t, 'half.json', doc([good, bad['negative-glucose']])));
      await ui.tap(sheet.getByRole('button', { name: 'Replace everything here', exact: true }));
      const confirm = await say(sheet);
      await t.check(/leaving out the records in it that cannot be read/.test(confirm), `the Replace confirmation does not say unreadable records are left out: ${confirm.slice(0, 300)}`);
      await ui.tap(ui.button(sheet, 'Keep what is here'));
      await sheet.waitFor({ state: 'hidden' });
      await t.check(data.sameSnapshot(before, await t.db()).length === 0, 'the record changed without a Replace');
    });

    await t.step(7, 'A later schema, an Apple Health XML export and a ZIP are refused honestly', async () => {
      await rejectFile(t, 'schema-6', data.writeFixture(t, 'schema6.json', { ...B, schemaVersion: 6 }), NEWER);
      const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE HealthData>\n<HealthData locale="en_IN"><Record type="HKQuantityTypeIdentifierStepCount" value="4200" unit="count" startDate="2026-10-07 08:00:00 +0530"/></HealthData>\n';
      await rejectFile(t, 'apple-health-xml', data.writeFixture(t, 'export.xml', xml), UNREADABLE);
      const zip = Buffer.concat([Buffer.from('PK\x03\x04\x14\x00\x00\x00\x08\x00', 'binary'), Buffer.from('apple_health_export/export.xml'), Buffer.alloc(40, 7)]);
      await rejectFile(t, 'apple-health-zip', data.writeFixture(t, 'export.zip', zip), UNREADABLE);
      const sent = t.requests.filter(r => r.method !== 'GET');
      await t.check(sent.length === 0, `a file was sent somewhere: ${sent.map(r => `${r.method} ${r.url}`).join(', ')}`);
    });
  },
};

const noCompression = {
  name: 'export without CompressionStream, restore in a fresh context',
  async run(t) {
    const capabilities = { compression: 'absent', share: 'capture' };
    await t.open({ seed: persona('P01'), route: '/today', capabilities });
    let made; let doc;
    await t.step(5, 'Without CompressionStream the backup is plain .json, labelled as JSON', async () => {
      await t.must(await t.page.evaluate(() => typeof CompressionStream === 'undefined'), 'CompressionStream is still present');
      made = await data.backup(t, { expectVia: 'share' });
      await t.must(made.via === 'share', `no file was handed over (${made.via})`);
      await t.check(/\.json$/.test(made.name) && !/\.gz$/.test(made.name), `the file is named ${made.name}`);
      await t.check(made.type === 'application/json', `the file's type is ${made.type}`);
      await t.check(made.bytes[0] === 0x7b, 'the file is not plain JSON text');
      doc = JSON.parse(made.bytes.toString('utf8'));
      await t.checkpoint('plain-json-backup');
    });
    await t.step(5, 'Restore that file in a fresh context: a lossless round trip', async () => {
      const exported = await t.db();
      await t.context.close();
      await t.open({ seed: null, route: '', capabilities });
      const sheet = await data.chooseRestore(t, data.writeFixture(t, made.name, made.bytes), { from: 'welcome' });
      await ui.tap(ui.button(sheet, 'Restore'));
      await data.restoredFromWelcome(t, sheet);
      const snap = await t.checkpoint('restored-plain-json');
      const diffs = data.compareLogical(data.logicalFromDoc(doc, { ignoreExportDate: true }), data.logical(snap, { ignoreExportDate: true }), { label: ['file', 'restored'] });
      await t.check(diffs.length === 0, `the plain JSON round trip lost something: ${diffs.slice(0, 5).join(' | ')}`);
      const same = data.compareLogical(data.logical(exported, { ignoreExportDate: true }), data.logical(snap, { ignoreExportDate: true }), { label: ['original', 'restored'] });
      await t.check(same.length === 0, `the restored record differs from the original: ${same.slice(0, 5).join(' | ')}`);
    });
  },
};

const shareCase = (name, share, expect) => ({
  name,
  async run(t) {
    await t.open({ seed: persona('P01'), route: '/today', capabilities: { share } });
    await t.step(6, `${name}`, async () => {
      const before = await t.db();
      const made = await data.backup(t);
      await t.checkpoint(`backup-${share}`);
      const after = await t.db();
      const exportAt = docs(after).settings?.habits?.lastExportAt;
      if (expect === 'download') {
        await t.check(made.label === 'Download' && made.via === 'download', `with share ${share} the backup offered “${made.label}” and delivered by ${made.via}, not a download`);
        await t.check(/Downloaded\./.test(made.said), `no download confirmation: ${made.said.slice(0, 200)}`);
        await t.check(typeof exportAt === 'string', 'a delivered backup was not recorded');
      } else {
        await t.check(made.label === 'Save or share', `with a share sheet available the backup offered “${made.label}”`);
        await t.check(!/Done\.|Downloaded\./.test(made.said), `a cancelled share was reported as delivered: ${made.said.slice(0, 200)}`);
        await t.check(exportAt === undefined, `a cancelled share was recorded as a backup (lastExportAt ${exportAt})`);
        await t.check(data.sameSnapshot(before, after).length === 0, 'a cancelled share changed the record');
        const main = await data.openData(t);
        const row = await say(ui.row(main, 'Back up your record'));
        await t.check(/No backup yet|not made one yet/i.test(row), `after a cancelled share the backup row says “${row}”`);
        await t.reload();
        await t.check(docs(await t.db()).settings?.habits?.lastExportAt === undefined, 'after reload the cancelled share counts as a backup');
      }
    }, { input: `navigator.share ${share}` });
  },
});

export const cases = [
  sequence,
  noCompression,
  shareCase('share absent: download fallback', 'absent', 'download'),
  shareCase('canShare false: download fallback', 'cannot', 'download'),
  shareCase('share cancelled: nothing marked delivered', 'cancel', 'cancel'),
];
