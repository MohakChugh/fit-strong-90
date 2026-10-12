/**
 * J17, all personas: failure visibility, durable writes and recovery
 * (codex-acceptance.md, SAFETY 9 of 10; basis D13, D16, D28, D30; PLAN Task 1).
 *
 * Faults go into the browser's own IndexedDB API after seeding and migration,
 * never into the app (lib/inpage.mjs `faultInit`): a thrown DOMException
 * QuotaExceededError, a Safari-like thrown `{name, code: 22}`, and a real
 * readwrite transaction aborted after its requests were queued. Console
 * errors are exempted only when they carry the injected marker.
 */
import { MINUTE, NOW } from '../lib/env.mjs';
import { docs } from '../lib/harness.mjs';
import * as ui from '../lib/ui.mjs';
import * as mv from '../lib/move.mjs';
import { persona } from '../fixtures/personas.mjs';
import { atSummary, outcome, openApp } from '../lib/safety-c.mjs';

export const id = 'J17';
export const title = 'Failure visibility, durable writes and recovery';
export const safety = true;

const MARK = 'acceptance-injected';
const SAVED = /Saved on this (device|iPhone)|^Saved\b/m;
const STORAGE_ERROR = /not enough space|did not save|couldn.t save|could not save|not saved|storage|interrupted/i;

const glucoseObs = (snap, value) => (snap?.observations ?? []).filter(o => o.kind === 'glucose' && (value === undefined || o.value === value));
const today = snap => (docs(snap).checkIns ?? []).find(c => c.date === '2026-10-08');

/** The storage notice in the screen's header or task frame (role alert or status). */
async function storageNotice(page) {
  const n = page.locator('[role="alert"], [role="status"]').filter({ hasText: /did not save|not enough space|isn.t storing|Nothing is being saved|couldn.t save|could not save|interrupted/i });
  return (await n.count()) ? (await n.allInnerTexts()).join(' | ') : '';
}

/** Track → Add a record → kind. */
async function openAdd(t, kind, page = t.page) {
  if (!/^\/track/.test(await t.route(page))) await t.goto('/track', page);
  await ui.tap(ui.header(page).getByRole('button', { name: 'Add a record', exact: true }));
  const add = page.getByRole('dialog', { name: 'Add' });
  await add.waitFor();
  await ui.tap(ui.row(add, kind));
  const form = page.getByRole('dialog', { name: kind });
  await form.waitFor();
  return form;
}

/** The glucose form: reading, unit and an explicit reading time. */
async function fillGlucose(form, { value, time }) {
  await ui.tap(ui.radio(form.getByRole('radiogroup', { name: 'Glucose unit' }), 'mg/dL'));
  await ui.type(form.getByRole('textbox', { name: 'Reading', exact: true }), value);
  if (time) {
    const row = ui.row(form, 'Time');
    if (await row.count()) await ui.tap(row);
    await ui.setDateTime(form.getByLabel('Time', { exact: true }), time);
  }
}

/** Two glucose cases, one per thrown error shape. */
function glucoseCase(action) {
  return {
    name: `glucose save fails (${action})`,
    async run(t) {
      const page = await openApp(t, { seed: persona('P01'), route: '/track' });
      t.allowConsole(MARK);
      const rule = [{ op: 'put', store: 'observations', match: { kind: 'glucose' }, action }];
      let before;
      await t.step(1, 'Fail the next glucose write: Track → Add glucose 111 → Save', async () => {
        before = await t.checkpoint('p01-snapshot');
        await t.setFaults(rule);
        const form = await openAdd(t, 'Glucose');
        await fillGlucose(form, { value: '111', time: '2026-10-08T08:50' });
        await ui.tap(ui.button(form, 'Save'));
        await page.waitForTimeout(800);
        const fired = await t.faultLog();
        await t.must(fired.some(f => f.store === 'observations'), `the fault never fired: ${JSON.stringify(fired)}`);
        await t.checkpoint('glucose-save-failed');
        const sheetText = await form.innerText().catch(() => '');
        await t.check(await form.isVisible(), 'the glucose form closed after a failed save');
        await t.check(STORAGE_ERROR.test(sheetText) || STORAGE_ERROR.test(await storageNotice(page)), `no visible storage error: ${sheetText.slice(0, 200)}`);
        await t.check(await form.getByRole('textbox', { name: 'Reading', exact: true }).inputValue() === '111', 'the draft 111 was not retained');
        await t.check(!SAVED.test(await page.locator('body').innerText()), 'a Saved acknowledgment appeared for a failed write');
        const snap = await t.db();
        await t.check(glucoseObs(snap, 111).length === 0, `a glucose 111 is in the database: ${JSON.stringify(glucoseObs(snap, 111))}`);
        await t.check(glucoseObs(snap).length === glucoseObs(before).length, 'the glucose count changed after a failed write');
        const shown = await page.getByRole('main').innerText();
        await t.check(!/\b111\b/.test(shown), 'a phantom 111 row is on My Day after the rollback');
        const notice = await storageNotice(page);
        t.note(`store failure state shown as: ${notice || '(no storage notice)'}`);
        await t.check(notice !== '', 'the failed write does not appear in the store’s failure notice');
      }, { input: `glucose 111 mg/dL at 08:50, ${action} on the observation put` });

      await t.step(2, 'Reload with the fault active, recover the draft, remove the fault, Save once', async () => {
        await t.reload();
        await page.waitForTimeout(500);
        const form = page.getByRole('dialog', { name: 'Glucose' });
        const reading = form.getByRole('textbox', { name: 'Reading', exact: true });
        const recovered = (await form.count()) && (await reading.inputValue()) === '111';
        await t.checkpoint('after-reload');
        await t.check(recovered, `the unsaved glucose draft was not recovered after reload (${(await form.count()) ? `form open, reading “${await reading.inputValue()}”` : 'no form open'})`);
        let f = form;
        if (!recovered) {
          t.note('draft not recovered: re-entered 111 at 08:50 to finish the step');
          if (await form.count()) await ui.tap(ui.button(form, 'Close'));
          f = await openAdd(t, 'Glucose');
          await fillGlucose(f, { value: '111', time: '2026-10-08T08:50' });
        } else {
          const time = f.getByLabel('Time', { exact: true });
          await t.check((await time.count()) && (await time.inputValue()) === '2026-10-08T08:50', 'the recovered draft lost its intended reading time');
        }
        await t.setFaults(null);
        await ui.tap(ui.button(f, 'Save'));
        await f.waitFor({ state: 'hidden', timeout: 15000 });
        await page.waitForTimeout(500);
        const snap = await t.checkpoint('saved-once');
        const rows = glucoseObs(snap, 111);
        await t.check(rows.length === 1, `${rows.length} glucose 111 observations after the retry`);
        const r = rows[0];
        await t.check(r && r.unit === 'mg/dL' && r.source === 'manual' && r.scope === 'pointInTime' && r.at.startsWith('2026-10-08T08:50'),
          `the saved reading lost its intended time/unit/source: ${JSON.stringify(r)}`);
        await t.check(SAVED.test(await page.getByRole('main').innerText()), 'no Saved acknowledgment after the successful retry');
      }, { input: 'reload with the fault active; then fault removed; Save once' });
    },
  };
}

/** P01 walks for two minutes and finishes, reaching the summary unsaved. */
async function finishedWalk(t) {
  const page = t.page;
  const main = page.getByRole('main');
  await ui.tab(page, 'Move');
  await ui.tap(ui.row(main, 'Walk', 'link'));
  await ui.tap(ui.button(main, 'Start walk'));
  const sheet = mv.checkInSheet(page);
  await sheet.waitFor();
  await ui.answerCheckIn(t, sheet, ui.normalAnswers('P01'));
  await page.waitForTimeout(500);
  await t.must(await mv.sheetStart(sheet).count() === 1, `the walk is not permitted for P01’s normal answers: ${(await outcome(page)).text.slice(0, 200)}`);
  await ui.tap(mv.sheetStart(sheet));
  await page.waitForURL(/#\/walk\/live/, { timeout: 15000 });
  // The walk starts when the live screen attaches; only then does time count.
  await ui.button(main, 'Pause').waitFor();
  await t.advance(MINUTE);
  await t.advance(MINUTE);
  await ui.tap(ui.button(main, 'Finish'));
  const fin = page.getByRole('dialog', { name: 'Finish walk' });
  await ui.tap(ui.button(fin, 'Finish walk'));
  await page.waitForURL(/#\/walk\/summary/, { timeout: 15000 });
  await t.ready();
  return page.evaluate(() => JSON.parse(sessionStorage.getItem('fit-strong-walk') ?? 'null'));
}

const walkObs = (snap, id) => (snap?.observations ?? []).filter(o => o.context === `walk:${id}`);

function walkCase(variant) {
  return {
    name: `walk partial save then ${variant}`,
    async run(t) {
      const page = await openApp(t, { seed: persona('P01'), route: '/today' });
      t.allowConsole(MARK);
      const main = page.getByRole('main');
      let walk;
      await t.step(3, 'Finish a walk; abort the save after one segment record committed', async () => {
        walk = await finishedWalk(t);
        await t.must(!!walk?.id, 'no finished walk in the tab');
        await t.checkpoint('walk-summary');
        // However the walk is batched, abort the transaction that carries movementMinutes once its put was queued.
        await t.setPageFaults([{ op: 'put', store: 'observations', match: { kind: 'movementMinutes' }, action: 'abortAfterQueue' }]);
        await ui.tap(ui.button(main, 'Save walk'));
        await page.waitForTimeout(1200);
        const fired = await t.faultLog();
        await t.must(fired.some(f => f.action === 'abortAfterQueue'), `the transaction abort never fired: ${JSON.stringify(fired)}`);
        const text = (await main.innerText()).replace(/\s+/g, ' ');
        await t.checkpoint('walk-partial-failure');
        await t.check(!/Saved on this iPhone|Saved on this device/.test(text), 'the summary claims the walk saved');
        await t.check(/did not save|not saved|incomplete|try again/i.test(text), `no explicit incomplete-save state: ${text.slice(0, 260)}`);
        await t.check(await main.getByRole('button', { name: /^(Try again|Save walk)$/ }).count() === 1, 'no retry is offered');
        const snap = await t.db();
        const rows = walkObs(snap, walk.id);
        if (rows.length === 0) {
          // The walk was saved in one transaction, so the abort left nothing behind: atomic, and nothing to identify.
          t.note('walk save is one transaction: the aborted save committed nothing');
        } else {
          // Saved in several transactions: the part already on the device must be identified, not hidden.
          t.note(`walk save committed ${rows.length} record(s) before the abort: ${rows.map(o => o.kind).join(', ')}`);
          await t.check(/part of|some of|partly|already saved|one of|was saved|were saved/i.test(text), `the committed part of the walk is not identified (the summary says: “${/This walk did not save[^.]*\.[^.]*\./.exec(text)?.[0] ?? text.slice(0, 160)}”)`);
          const kept = await page.evaluate(() => JSON.parse(sessionStorage.getItem('fit-strong-walk') ?? 'null'));
          await t.check(!!kept, 'the partly saved walk is not kept in the tab for a retry');
        }
        await t.check(!!(await page.evaluate(() => sessionStorage.getItem('fit-strong-walk'))), 'the unsaved walk is not kept in the tab');
      }, { input: 'two-minute walk; abortAfterQueue on the movementMinutes transaction' });

      if (variant === 'retry') {
        await t.step(4, 'Reload the summary, retry: the complete walk once per stable id', async () => {
          await t.setPageFaults(null);
          await t.reload();
          await t.check(/^\/walk\/summary/.test(await t.route()), `reload left the summary for ${await t.route()}`);
          await t.checkpoint('walk-summary-reloaded');
          await ui.tap(main.getByRole('button', { name: /^(Try again|Save walk)$/ }));
          await main.getByText('Saved on this device').waitFor({ timeout: 15000 });
          const snap = await t.checkpoint('walk-saved');
          const rows = walkObs(snap, walk.id);
          const kinds = rows.map(o => o.kind).sort();
          await t.check(JSON.stringify(kinds) === JSON.stringify(['movementMinutes', 'walkDuration']), `the walk saved as ${JSON.stringify(kinds)}`);
          await t.check(new Set(rows.map(o => o.id)).size === rows.length && rows.every(o => o.id.startsWith(`${walk.id}:s0:`)), `ids are not stable or unique: ${JSON.stringify(rows.map(o => o.id))}`);
          await t.check(rows.every(o => o.value === 2 && o.coverageMs === 120000 && o.source === 'measured' && o.scope === 'sessionObserved'), `the records are not the observed two minutes: ${JSON.stringify(rows.map(o => [o.value, o.coverageMs, o.source]))}`);
        }, { input: 'reload /walk/summary; fault removed; Try again' });
      } else {
        await t.step(4, 'Discard after the partial-save failure', async () => {
          await ui.tap(ui.button(main, 'Discard walk'));
          const sheet = page.getByRole('dialog', { name: 'Discard walk' });
          await sheet.waitFor();
          await t.checkpoint('discard-confirm');
          await ui.tap(ui.button(sheet, 'Discard walk'));
          await page.waitForTimeout(1000);
          const snap = await t.checkpoint('after-discard');
          const rows = walkObs(snap, walk.id);
          const shown = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
          const failed = /did not|couldn.t|could not/i.test(shown) && /discard|remove|delete/i.test(shown);
          await t.check(rows.length === 0 || failed, `Discard left ${rows.length} hidden record(s): ${JSON.stringify(rows.map(o => o.id))}`);
          await t.check(!(await page.evaluate(() => sessionStorage.getItem('fit-strong-walk'))) || failed, 'the discarded walk is still kept in the tab');
        }, { input: 'Discard walk → Discard walk' });
      }
    },
  };
}

/** Another tab holds a readwrite transaction over every store, so writes queue behind it. */
async function holdDatabase(p2) {
  await p2.evaluate(() => new Promise((resolve, reject) => {
    const req = window.__acc.orig.open.call(indexedDB, 'fit-strong');
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(['observations', 'sessions', 'settings', 'content-state'], 'readwrite');
      const store = tx.objectStore('settings');
      window.__hold = true;
      window.__release = () => { window.__hold = false; };
      const spin = () => { if (window.__hold) store.get('revision').onsuccess = spin; };
      spin();
      tx.oncomplete = () => db.close();
      resolve(true);
    };
  }));
}

export const cases = [
  glucoseCase('quotaDom'),
  glucoseCase('quotaSafari'),
  walkCase('retry'),
  walkCase('discard'),
  {
    name: 'stretch session save fails',
    async run(t) {
      const page = await openApp(t, { seed: persona('P01'), route: '/today' });
      t.allowConsole(MARK);
      const main = page.getByRole('main');
      await t.step(5, 'Fail saving a finished Stretch session', async () => {
        const r = await mv.enter(t, 'stretch', 'move');
        await t.must(!!r.sheet, 'no check-in opened');
        await ui.answerCheckIn(t, r.sheet, ui.normalAnswers('P01'));
        await page.waitForTimeout(500);
        await ui.tap(mv.sheetStart(r.sheet));
        await ui.button(main, 'Start').click({ timeout: 20000 });
        await t.setFaults([{ op: 'put', store: 'sessions', action: 'quotaSafari' }]);
        for (let i = 0; i < 20 && !(await atSummary(page)); i++) await t.advance(MINUTE);
        await t.must(await atSummary(page), 'the stretch never reached its summary');
        await page.waitForTimeout(800);
        await t.checkpoint('summary-autosave-failed');
        const notice = await storageNotice(page);
        await t.check(notice !== '', 'the failed automatic save on reaching the summary is not shown anywhere');
        await ui.tap(page.getByRole('button', { name: /Save and finish/ }));
        await page.waitForTimeout(800);
        const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
        await t.checkpoint('save-and-finish-failed');
        await t.check(/couldn.t save|could not save|did not save|try again/i.test(text), `no unsaved state after Save and finish failed: ${text.slice(0, 200)}`);
        await t.check(!/\bSaved\b/.test(text), 'a success toast appeared for a failed save');
        const cache = await page.evaluate(() => localStorage.getItem('fit-strong-90-stretch'));
        await t.check(!!cache, 'the progress cache was deleted before the session was durably stored');
        const snap = await t.db();
        await t.check(!(snap.sessions ?? []).some(s => s.planKind === 'stretch'), 'a stretch session is stored despite the failure');
        await t.setFaults(null);
        await ui.tap(page.getByRole('button', { name: /Save and finish/ }));
        await page.waitForTimeout(1200);
        let after = await t.checkpoint('retry-saved');
        let stretches = (after.sessions ?? []).filter(s => s.planKind === 'stretch');
        await t.check(stretches.length === 1, `${stretches.length} stretch session(s) after the retry`);
        await t.reload();
        await page.waitForTimeout(800);
        after = await t.db();
        stretches = (after.sessions ?? []).filter(s => s.planKind === 'stretch');
        await t.check(stretches.length === 1, `${stretches.length} stretch session(s) after reloading`);
        const s = stretches[0];
        await t.check(!!s && (s.mobility ?? []).length > 0, `the stored stretch lost its logged work: ${JSON.stringify(s?.mobility ?? null).slice(0, 200)}`);
        await t.check(!(await page.evaluate(() => localStorage.getItem('fit-strong-90-stretch'))), 'the progress cache survived the durable save');
      }, { input: 'P01 10-minute Back & hips stretch; quotaSafari on the sessions put' });
    },
  },
  {
    name: 'profile update fails',
    async run(t) {
      const seed = persona('P01', {
        patch: { profile: { needsHealthReview: true } },
        remove: ['profile.health.medicinesReviewed', 'profile.health.metformin', 'profile.health.metforminSince', 'profile.health.priorDkaOrInsulinDeficiency'],
      });
      const page = await openApp(t, { seed, route: '/today' });
      t.allowConsole(MARK);
      const startHeld = async label => {
        await t.goto('/today');
        const r = await mv.enter(t, 'guided', 'move');
        const o = await outcome(page);
        const offered = r.sheet ? await mv.sheetStart(r.sheet).count() : 0;
        if (r.sheet && await r.sheet.getByRole('heading', { name: 'Right now, any of these?', exact: true }).count()) {
          // A check-in may be asked first; the start must still be held for the medicines.
          await ui.answerCheckIn(t, r.sheet, ui.normalAnswers('P01'));
          await page.waitForTimeout(500);
        }
        const after = await outcome(page);
        const startNow = r.sheet ? await mv.sheetStart(r.sheet).count() : 0;
        await t.checkpoint(`start-${label}`);
        if (r.sheet) await ui.tap(ui.button(r.sheet, 'Close'));
        return { held: !startNow && !offered && !/^\/session/.test(r.route), text: `${o.text} ${after.text}` };
      };
      await t.step(6, 'Fail the health update from unknown medicines to metformin-only; attempt Start before and after', async () => {
        const first = await startHeld('before');
        await t.check(first.held, `Start is not held while the medicines are unknown: ${first.text.slice(0, 200)}`);
        await t.goto('/you/profile');
        await ui.tap(page.getByRole('button', { name: 'Edit health' }));
        const dialog = page.getByRole('dialog', { name: 'Edit your answers' });
        await dialog.waitFor();
        const pick = async (group, answer) => ui.tap(ui.radio(dialog.getByRole('radiogroup', { name: group, exact: true }), answer));
        await pick('Insulin', 'No insulin');
        await pick('Sulfonylurea or meglitinide? (e.g. gliclazide, glimepiride)', 'No');
        await pick('An SGLT2 inhibitor, for diabetes, heart or kidney? (e.g. empagliflozin, dapagliflozin)', 'No');
        await pick('Metformin?', 'Yes');
        const since = dialog.getByRole('textbox', { name: /since|year/i });
        if (await since.count()) await ui.type(since, '2019');
        await pick('Ever had diabetic ketoacidosis (DKA), or been told your body makes too little insulin?', 'No');
        for (const g of ['Beta-blocker? (e.g. bisoprolol, metoprolol)', 'Diuretic or water pill?', 'Has your care team told you to limit how much you drink?']) {
          if (await dialog.getByRole('radiogroup', { name: g, exact: true }).count()) await pick(g, 'No');
        }
        await t.setFaults([{ op: 'put', store: 'settings', match: { key: 'profile' }, action: 'quotaDom' }]);
        const save = ui.button(dialog.getByRole('contentinfo'), 'Save');
        await t.must(await save.isEnabled(), 'Save stays disabled after every medicine question was answered');
        await ui.tap(save);
        await page.waitForTimeout(1000);
        const fired = await t.faultLog();
        await t.must(fired.some(f => f.store === 'settings'), `the profile write fault never fired: ${JSON.stringify(fired)}`);
        const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
        await t.checkpoint('profile-save-failed');
        await t.check(/did not save|not enough space|couldn.t save/i.test(text), `the failed profile update is not shown: ${text.slice(0, 200)}`);
        await t.check(!/Saved\. Today uses your new answers/.test(text), 'the failed profile update was acknowledged as saved');
        const snap = await t.db();
        const health = docs(snap).profile?.health ?? {};
        await t.check(health.medicinesReviewed !== true && health.metformin === undefined, `the uncommitted medicine answers are in the stored profile: ${JSON.stringify({ r: health.medicinesReviewed, m: health.metformin })}`);
        const second = await startHeld('after-error');
        await t.check(second.held, `Start was allowed on the uncommitted profile: ${second.text.slice(0, 200)}`);
        // Retry, now that the device can store it.
        await t.setFaults(null);
        await t.goto('/you/profile');
        await ui.tap(page.getByRole('button', { name: 'Edit health' }));
        await dialog.waitFor();
        await pick('Insulin', 'No insulin');
        await pick('Sulfonylurea or meglitinide? (e.g. gliclazide, glimepiride)', 'No');
        await pick('An SGLT2 inhibitor, for diabetes, heart or kidney? (e.g. empagliflozin, dapagliflozin)', 'No');
        await pick('Metformin?', 'Yes');
        if (await since.count()) await ui.type(since, '2019');
        await pick('Ever had diabetic ketoacidosis (DKA), or been told your body makes too little insulin?', 'No');
        for (const g of ['Beta-blocker? (e.g. bisoprolol, metoprolol)', 'Diuretic or water pill?', 'Has your care team told you to limit how much you drink?']) {
          if (await dialog.getByRole('radiogroup', { name: g, exact: true }).count()) await pick(g, 'No');
        }
        await ui.tap(ui.button(dialog.getByRole('contentinfo'), 'Save'));
        await page.getByText(/Saved\. Today uses your new answers/).waitFor({ timeout: 15000 });
        const stored = docs(await t.db()).profile?.health ?? {};
        await t.check(stored.medicinesReviewed === true && stored.metformin === true, `the retried answers are not stored: ${JSON.stringify({ r: stored.medicinesReviewed, m: stored.metformin })}`);
        await t.goto('/today');
        const r = await mv.enter(t, 'guided', 'move');
        if (r.sheet && await r.sheet.getByRole('heading', { name: 'Right now, any of these?', exact: true }).count()) {
          await ui.answerCheckIn(t, r.sheet, ui.normalAnswers('P01'));
          await page.waitForTimeout(500);
        }
        await t.checkpoint('start-after-retry');
        // Allowed means a Start on the sheet, or straight to the player's own Start.
        const straight = /^\/session/.test(await t.route()) && await ui.button(page.getByRole('main'), 'Start').count() === 1;
        await t.check(straight || (!!r.sheet && await mv.sheetStart(r.sheet).count() === 1), `the metformin-only profile, once stored, still cannot start: ${(await outcome(page)).text.slice(0, 200)}`);
      }, { input: 'insulin none, SU no, SGLT2 no, metformin yes since 2019, DKA no; quotaDom on the profile put' });
    },
  },
  {
    name: 'emergency save fails',
    async run(t) {
      const page = await openApp(t, { seed: persona('P01'), route: '/today' });
      t.allowConsole(MARK);
      const main = page.getByRole('main');
      await t.step(7, 'An emergency over an earlier safe check-in, with the save failing; other modes, reload, Resume', async () => {
        // A safe check-in and a resumable guided session first.
        const r = await mv.enter(t, 'guided', 'today');
        await t.must(!!r.sheet, 'Today’s action opened no check-in');
        await ui.answerCheckIn(t, r.sheet, ui.normalAnswers('P01'));
        await page.waitForTimeout(500);
        await ui.tap(mv.sheetStart(r.sheet));
        await ui.button(main, 'Start').click({ timeout: 20000 });
        await t.advance(MINUTE);
        await ui.tap(main.getByRole('button', { name: 'End session', exact: true }));
        await ui.tap(page.getByRole('button', { name: 'Save and exit', exact: true }));
        await page.waitForTimeout(800);
        await t.must(!!(await page.evaluate(() => localStorage.getItem('fit-strong-90-guided'))), 'no resumable guided progress was saved');
        await t.checkpoint('safe-and-resumable');
        // Now the emergency, with the check-in write failing.
        await t.setFaults([{ op: 'put', store: 'settings', match: { key: 'checkIns' }, action: 'quotaDom' }]);
        await t.hash('/move');
        await t.hash('/today?checkin=guided');
        const sheet = mv.checkInSheet(page);
        await sheet.waitFor({ timeout: 30000 });
        const change = ui.button(sheet, 'Change answers');
        await sheet.getByRole('heading', { name: 'Right now, any of these?', exact: true }).or(change).waitFor();
        if (await change.count()) await ui.tap(change);
        const right = ui.section(sheet, 'Right now, any of these?');
        const again = ui.button(right, 'Show the list again');
        if (await again.count()) await ui.tap(again);
        await ui.tap(ui.checkbox(right, ui.EMERGENCY.chest));
        await page.waitForTimeout(800);
        const o = await outcome(page);
        await t.checkpoint('emergency-unsaved');
        await t.check(o.title === 'Call emergency services now', `the emergency is not shown at once: “${o.title}”`);
        await t.check(/could not save|couldn.t save|not saved|may be lost/i.test(o.text), `the failed emergency save is not shown: ${o.text.slice(0, 200)}`);
        await t.check((await t.faultLog()).some(f => f.store === 'settings'), 'the check-in write fault never fired');
        const stored = today(await t.db());
        await t.check(!stored?.emergency?.length, 'the emergency was stored despite the fault (the fault missed)');
        await ui.tap(ui.button(sheet, 'Close'));
        // Other modes, without a reload (the unsaved answer lives in this page only).
        await t.hash('/move');
        await ui.tap(ui.row(main, 'Stretch', 'link'));
        // While the engine refuses, Stretch refuses before any tap (scan S-15): no Start, the reason, and the check-in one tap away.
        const refusal = await mv.setupRefusal(page, 'stretch');
        await t.check(!!refusal, 'Stretch still offers Start stretch over the unsaved emergency');
        if (refusal) {
          await t.check(/help now|emergency/i.test(refusal.text), `Stretch does not show the emergency before any tap: “${refusal.text.slice(0, 200)}”`);
          await t.check(refusal.review, 'the refusing Stretch setup offers no “Review today’s check-in”');
          if (refusal.review) await mv.reviewFromSetup(page);
        } else {
          await ui.tap(ui.button(main, 'Start stretch'));
        }
        await page.waitForTimeout(500);
        const st = await outcome(page);
        await t.check(st.title === 'Call emergency services now', `Stretch after the unsaved emergency reads “${st.title}”`);
        await t.checkpoint('stretch-after-unsaved-emergency');
        if (await mv.checkInSheet(page).count()) await ui.tap(ui.button(mv.checkInSheet(page), 'Close'));
        // Reload: the fault is still active; the pending emergency must still decide.
        await t.reload();
        await t.goto('/session?resume=1');
        const resumeText = (await main.innerText()).replace(/\s+/g, ' ');
        await t.checkpoint('resume-after-reload');
        await t.check(!(await main.getByRole('button', { name: /^(Start|Resume)$/ }).count()), `after reload, Resume is offered over the unsaved emergency: ${resumeText.slice(0, 200)}`);
        await t.check(/Call emergency services now|emergency|help now/i.test(resumeText), `after reload, the resume does not show the emergency: ${resumeText.slice(0, 200)}`);
        await t.goto('/today');
        const r2 = await mv.enter(t, 'walk', 'chooser');
        const w = await outcome(page);
        const walkOffered = r2.sheet ? await mv.sheetStart(r2.sheet).count() > 0 : await ui.button(main, 'Start walk').count() > 0;
        await t.check(!walkOffered && /emergency/i.test(w.text), `after reload, Walk is offered over the unsaved emergency (${r2.sheet ? `sheet “${w.title}”` : `went straight to ${r2.route}, which offers Start walk`})`);
        await t.checkpoint('walk-after-reload');
        const snap = await t.db();
        await t.check(!(snap.sessions ?? []).some(s => s.status === 'completed' && s.date === '2026-10-08'), 'a session was completed');
      }, { input: 'normal check-in and a paused guided session; then chest pain with quotaDom on the check-in write' });
    },
  },
  {
    name: 'two tabs',
    async run(t) {
      const p1 = await openApp(t, { seed: persona('P01'), route: '/track' });
      t.allowConsole(MARK);
      const p2 = await t.newPage();
      await p2.goto(`${t.base}#/track`);
      await t.ready(p2);
      await t.step(8, 'Two tabs add Water 250 at once; theme and food change while writes queue', async () => {
        const f1 = await openAdd(t, 'Water', p1);
        const f2 = await openAdd(t, 'Water', p2);
        const b1 = ui.button(f1, 'Add 250 ml');
        const b2 = ui.button(f2, 'Add 250 ml');
        await Promise.all([b1.click(), b2.click()]);
        await p1.waitForTimeout(1500);
        const snap = await t.checkpoint('water-both-tabs', { page: p1 });
        const water = (snap.observations ?? []).filter(o => o.kind === 'water' && o.day === '2026-10-08').sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
        await t.check(water.length === 2 && water.map(o => o.value).join(',') === '250,500', `water statements are ${JSON.stringify(water.map(o => o.value))}, not 250 then 500`);
        await t.check(water.every(o => o.scope === 'dayTotal' && o.source === 'manual'), 'water is not a manual day total');
        // Both tabs show the effective 500.
        for (const [p, name] of [[p1, 'first'], [p2, 'second']]) {
          await t.goto('/track', p);
          await t.check(/500 ml/.test(await p.getByRole('main').innerText()), `the ${name} tab does not show 500 ml`);
        }
        // A failed earlier write must not overwrite a later successful one.
        await t.goto('/you/appearance', p1);
        await t.goto('/you/food', p2);
        // Page-only rules: set after the navigation, which reloads the page.
        await t.setPageFaults([{ op: 'put', store: 'settings', match: { key: 'settings' }, action: 'quotaDom' }], p1);
        await Promise.all([
          ui.tap(ui.radio(p1.getByRole('radiogroup', { name: 'Appearance' }), 'Dark')),
          ui.tap(ui.radio(p2.getByRole('radiogroup', { name: 'What you eat' }), 'Vegan')),
        ]);
        await p1.waitForTimeout(1500);
        let after = await t.db(p2);
        await t.check(docs(after).profile?.food?.pattern === 'vegan', `the second tab’s food change was lost: ${JSON.stringify(docs(after).profile?.food)}`);
        await t.check((docs(after).settings?.theme ?? 'system') !== 'dark', 'the failed theme write is stored');
        const failText = (await p1.locator('body').innerText()).replace(/\s+/g, ' ');
        await t.checkpoint('theme-failed', { page: p1 });
        await t.check(/did not save|not enough space/i.test(failText), `the first tab does not show its failed theme write: ${failText.slice(0, 200)}`);
        await t.setPageFaults(null, p1);
        await ui.tap(ui.radio(p1.getByRole('radiogroup', { name: 'Appearance' }), 'Light'));
        await ui.tap(ui.radio(p1.getByRole('radiogroup', { name: 'Appearance' }), 'Dark'));
        await p1.waitForTimeout(1200);
        after = await t.db(p1);
        await t.check(docs(after).settings?.theme === 'dark' && docs(after).profile?.food?.pattern === 'vegan', `both acknowledged changes did not persist: theme ${docs(after).settings?.theme}, food ${docs(after).profile?.food?.pattern}`);
        // The other tab catches up.
        await p2.waitForTimeout(1500);
        const dark = await p2.evaluate(() => document.documentElement.classList.contains('dark'));
        await t.check(dark, 'the second tab did not resynchronise the new appearance');
        await t.goto('/track', p2);
        await t.check(/500 ml/.test(await p2.getByRole('main').innerText()), 'the second tab lost the water total');
      }, { input: 'two tabs: Water +250 each at once; tab 1 Dark (theme write fails, then retried); tab 2 Vegan' });
    },
  },
  {
    name: 'suspended check-in',
    async run(t) {
      const p1 = await openApp(t, { seed: persona('P01'), route: '/today' });
      const p2 = await t.newPage();
      await p2.goto(`${t.base}#/you`);
      await t.ready(p2);
      await t.step(9, 'Suspend a check-in with its BP and pain projections, reload, inspect, retry', async () => {
        const projections = snap => (snap?.observations ?? []).filter(o => o.context?.startsWith('checkIn:2026-10-08') || o.context?.startsWith('bp:checkIn:2026-10-08'));
        const r = await mv.enter(t, 'guided', 'today');
        await t.must(!!r.sheet, 'no check-in opened');
        await ui.answerCheckIn(t, r.sheet, { ...ui.normalAnswers('P01'), submit: false });
        await holdDatabase(p2);
        await ui.tap(ui.button(r.sheet, ui.SUBMIT));
        await p1.waitForTimeout(1500);
        const pending = (await r.sheet.innerText().catch(() => '')).replace(/\s+/g, ' ');
        await p1.screenshot({ path: `${t.dir}/suspended-check-in.png`, scale: 'css' });
        await p1.reload({ waitUntil: 'domcontentloaded' });
        await p2.evaluate(() => window.__release());
        await t.ready(p1);
        await p1.waitForTimeout(800);
        t.note(`while queued the sheet read: ${pending.slice(0, 200)}`);
        const mid = await t.checkpoint('after-reload-inspect', { page: p1 });
        const ci = today(mid);
        const rows = projections(mid);
        const torn = ci ? rows.length !== 6 : rows.length !== 0;
        await t.check(!torn, `a torn check-in: ${ci ? 'check-in stored' : 'no check-in'} with ${rows.length} projection(s) ${JSON.stringify(rows.map(o => o.kind))}`);
        if (!ci) {
          const again = await mv.enter(t, 'guided', 'today');
          await t.must(!!again.sheet, 'no check-in opened for the retry');
          await ui.answerCheckIn(t, again.sheet, ui.normalAnswers('P01'));
          await p1.waitForTimeout(800);
        }
        const end = await t.checkpoint('after-retry', { page: p1 });
        const all = (docs(end).checkIns ?? []).filter(c => c.date === '2026-10-08');
        const endRows = projections(end);
        await t.check(all.length === 1, `${all.length} check-ins for today after the retry`);
        await t.check(endRows.length === 6, `the retried check-in has ${endRows.length} projections, not 6 (two BP pairs, back and leg pain): ${JSON.stringify(endRows.map(o => o.kind))}`);
        await t.check(new Set(endRows.map(o => o.id)).size === endRows.length, 'duplicate projections after the retry');
      }, { input: 'P01 normal check-in (BP 124/78, 122/76; pain 0/0) submitted while another tab holds the database' });
    },
  },
  {
    name: 'suspended write',
    async run(t) {
      const p1 = await openApp(t, { seed: persona('P01'), route: '/track' });
      const p2 = await t.newPage();
      await p2.goto(`${t.base}#/you`);
      await t.ready(p2);
      await t.step(9, 'Suspend a blood-pressure write before it commits, reload, inspect, retry', async () => {
        const bp = snap => (snap?.observations ?? []).filter(o => /^bloodPressure/.test(o.kind) && o.day === '2026-10-08');
        const before = bp(await t.db());
        const form = await openAdd(t, 'Blood pressure', p1);
        await ui.type(form.getByRole('textbox', { name: 'Top (systolic)', exact: true }), '128');
        await ui.type(form.getByRole('textbox', { name: 'Bottom (diastolic)', exact: true }), '84');
        // Another tab holds a readwrite transaction open, so this save queues behind it.
        await p2.evaluate(() => new Promise((resolve, reject) => {
          const req = window.__acc.orig.open.call(indexedDB, 'fit-strong');
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction(['observations', 'sessions', 'settings', 'content-state'], 'readwrite');
            const store = tx.objectStore('settings');
            window.__hold = true;
            window.__release = () => { window.__hold = false; };
            const spin = () => { if (window.__hold) store.get('revision').onsuccess = spin; };
            spin();
            tx.oncomplete = () => db.close();
            resolve(true);
          };
        }));
        await ui.tap(ui.button(form, 'Save'));
        await p1.waitForTimeout(1500);
        // Nothing here may read the database while the other tab holds it: a check that failed would wait on it.
        const pending = (await p1.locator('body').innerText()).replace(/\s+/g, ' ');
        await p1.screenshot({ path: `${t.dir}/suspended-save.png`, scale: 'css' });
        // Reload while it is still queued; then let the other tab go.
        await p1.reload({ waitUntil: 'domcontentloaded' });
        await p2.evaluate(() => window.__release());
        await t.ready(p1);
        await p1.waitForTimeout(800);
        await t.check(!/Saved on this device|Saved on this iPhone/.test(pending), `a Saved claim appeared before the write committed (see ${t.dir}/suspended-save.png)`);
        await t.check(/Saving|Save/.test(pending), 'the queued save shows nothing');
        const mid = await t.checkpoint('after-reload-inspect', { page: p1 });
        const rows = bp(mid);
        const sys = rows.filter(o => o.kind === 'bloodPressureSystolic');
        const dia = rows.filter(o => o.kind === 'bloodPressureDiastolic');
        await t.check(sys.length === dia.length, `torn BP halves after the suspended write: ${sys.length} systolic, ${dia.length} diastolic`);
        await t.check(sys.every(s => dia.some(d => d.context === s.context && d.at === s.at)), 'a systolic has no matching diastolic');
        const committed = rows.length > before.length;
        t.note(`after the reload the suspended write had ${committed ? 'committed in full' : 'not committed'}`);
        // Retry, without duplicating an operation that already committed.
        if (!committed) {
          const f = await openAdd(t, 'Blood pressure', p1);
          await ui.type(f.getByRole('textbox', { name: 'Top (systolic)', exact: true }), '128');
          await ui.type(f.getByRole('textbox', { name: 'Bottom (diastolic)', exact: true }), '84');
          await ui.tap(ui.button(f, 'Save'));
          await f.waitFor({ state: 'hidden', timeout: 15000 });
        }
        const end = await t.checkpoint('after-retry', { page: p1 });
        const endRows = bp(end).filter(o => !before.some(b => b.id === o.id));
        await t.check(endRows.length === 2 && endRows.some(o => o.value === 128) && endRows.some(o => o.value === 84), `the retried reading is not exactly one pair: ${JSON.stringify(endRows.map(o => `${o.kind}:${o.value}`))}`);
      }, { input: 'BP 128/84 via Quick Log while another tab holds a readwrite transaction; reload; retry' });
    },
  },
];
