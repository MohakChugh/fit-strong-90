/**
 * V-J35: a backup cancelled at the share sheet, then made, checked and
 * restored exactly (journey §17.2 V-J35, §16 Data, B-25). A known
 * cancellation never advances the backup's status, and "Checked" means the
 * file was read back.
 */
import { docs } from '../lib/harness.mjs';
import { persona } from '../fixtures/personas.mjs';
import * as data from '../lib/data.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J35';
export const title = 'Backup cancelled, then made, checked and restored exactly';
export const safety = false;

const flat = s => s.replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ');
const backupRow = async t => flat(await ui.row(await data.openData(t), 'Back up your record').innerText());

/** From here on the share sheet takes the file, as capabilityInit's `capture` does. */
function shareCaptures() {
  window.__acc = window.__acc || {};
  window.__acc.shares = [];
  navigator.canShare = () => true;
  navigator.share = async d => {
    const files = [];
    for (const f of d?.files ?? []) files.push({ name: f.name, type: f.type, bytes: Array.from(new Uint8Array(await f.arrayBuffer())) });
    window.__acc.shares.push({ files });
  };
}

export const cases = [{
  name: 'cancel, share, check, restore',
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/home', capabilities: { share: 'cancel' } });
    let file;
    let doc;
    await t.step(1, 'Me → Data: never backed up', async () => {
      const row = await backupRow(t);
      await t.check(/Last backup: never/.test(row), `the backup row says “${row}”`);
      await t.checkpoint('data-never');
    });
    await t.step(2, 'Back up → Save or share → cancelled at the share sheet', async () => {
      const before = await t.db();
      const made = await data.backup(t, { expectVia: 'share' });
      await t.check(made.via === 'none', `a cancelled share delivered a file (${made.via})`);
      await t.check(/Not shared, so nothing has changed\. Last backup: never\./.test(made.said), `the sheet said “${made.said.slice(0, 240)}”`);
      await t.check(/Prepared: .+\. It hasn’t left this device yet\./.test(made.said), 'the sheet does not say the file is only prepared');
      await t.check(data.sameSnapshot(before, await t.db()).length === 0, 'the cancelled share changed the record');
      const row = await backupRow(t);
      await t.check(/Last backup: never/.test(row), `after the cancelled share the row says “${row}”`);
    }, { input: 'navigator.share rejects with AbortError' });
    await t.step(3, 'Back up again, and this time share it', async () => {
      await page.evaluate(shareCaptures);
      const made = await data.backup(t, { expectVia: 'share' });
      await t.must(made.via === 'share' && !!made.bytes, `the share took no file (${made.via})`);
      await t.check(/Shared\. Keep the file somewhere private/.test(made.said), `no “Shared” confirmation: ${made.said.slice(0, 200)}`);
      doc = data.decodeBackup(made.bytes);
      file = data.writeFixture(t, made.name, made.bytes);
      const habits = docs(await t.db()).settings?.habits ?? {};
      await t.check(habits.lastExportAt === doc.exportedAt && habits.lastExportVia === 'share' && habits.lastCheckedExportAt === undefined, `the ledger reads ${JSON.stringify(habits)}`);
      const row = await backupRow(t);
      await t.check(/Last backup: shared 8 Oct 2026 · not checked/.test(row), `the row says “${row}”`);
      await t.checkpoint('data-shared');
    });
    await t.step(4, 'Check a backup → that file: checked, and nothing else changed', async () => {
      const before = await t.db();
      const sheet = await data.chooseCheck(t, file);
      const said = flat(await sheet.innerText());
      await t.check(/Checked\. This is your latest backup, made 8 Oct 2026, and it reads back whole\./.test(said), `the check said “${said.slice(0, 240)}”`);
      await ui.tap(ui.button(sheet, 'Done'));
      await sheet.waitFor({ state: 'hidden' });
      const after = await t.db();
      const diffs = data.compareLogical(data.logical(before, { ignoreExportDate: true }), data.logical(after, { ignoreExportDate: true }));
      await t.check(diffs.length === 0, `checking changed the record: ${diffs.slice(0, 4).join(' | ')}`);
      await t.check(docs(after).settings?.habits?.lastCheckedExportAt === doc.exportedAt, 'the check was not recorded');
      const row = await backupRow(t);
      await t.check(/Last backup: shared 8 Oct 2026 · checked/.test(row), `the row says “${row}”`);
      await t.checkpoint('data-checked');
    });
    await t.step(5, 'Add a reading, then restore that backup: the record is exactly the file', async () => {
      await data.logGlucose(t, { value: 130 });
      const sheet = await data.chooseRestore(t, file);
      await ui.tap(sheet.getByRole('button', { name: /^Replace everything here$|^Replace with this backup$/ }));
      await ui.tap(ui.button(sheet, 'Replace everything'));
      await data.waitOutcome(t, sheet);
      await ui.tap(ui.button(sheet, 'Done'));
      await t.reload();
      const now = await t.checkpoint('restored');
      const diffs = data.compareLogical(data.logicalFromDoc(doc, { ignoreExportDate: true }), data.logical(now, { ignoreExportDate: true }), { label: ['backup', 'device'] });
      await t.check(diffs.length === 0, `after restoring, the record is not the backup: ${diffs.slice(0, 6).join(' | ')}`);
      await t.check(!(now.observations ?? []).some(o => o.kind === 'glucose' && o.value === 130), 'the reading added after the backup survived the restore');
    }, { input: 'glucose 130 mg/dL; Replace with the shared backup' });
  },
}];
