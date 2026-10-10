/**
 * J18, P01: backup, Replace and clearing all data — SAFETY 10 of 10
 * (codex-acceptance.md; basis D13, D16, D17, D23; PLAN Task 1).
 *
 * One sequence in one context, as the steps build on each other: backup B,
 * newer records A, a cancelled and a failed Replace, a real Replace, a kept,
 * a failed and a real Delete everything, then B restored from Welcome.
 * Faults are injected into IndexedDB itself (lib/inpage.mjs), never the app.
 */
import { docs } from '../lib/harness.mjs';
import { persona } from '../fixtures/personas.mjs';
import * as ui from '../lib/ui.mjs';
import * as data from '../lib/data.mjs';

export const id = 'J18';
export const title = 'Backup, Replace and clearing all data';
export const safety = true;

const flat = s => s.replace(/[  ]/g, ' ').replace(/\s+/g, ' ');
const say = async locator => flat(await locator.innerText());

/** Record every route the app shows, so a passing flash through Welcome is caught. */
async function watchRoutes(page) {
  await page.evaluate(() => {
    // The router moves with history.pushState/replaceState, which fire no hashchange.
    window.__accRoutes = [location.hash];
    const note = () => { if (window.__accRoutes.at(-1) !== location.hash) window.__accRoutes.push(location.hash); };
    for (const fn of ['pushState', 'replaceState']) {
      const orig = history[fn].bind(history);
      history[fn] = (...args) => { const r = orig(...args); note(); return r; };
    }
    window.addEventListener('hashchange', note);
    window.addEventListener('popstate', note);
  });
}
const routesSeen = page => page.evaluate(() => window.__accRoutes ?? []);

/** One set of today's workout, logged and finished through the Workout Log. */
async function logWorkout(t) {
  const page = t.page;
  const main = page.getByRole('main');
  const add = await data.openAdd(t);
  await ui.tap(ui.row(add, 'Workout'));
  await page.getByRole('heading', { name: 'Workout', exact: true }).waitFor();
  const checkIn = main.getByRole('button', { name: /^(Check in|Update today’s check-in)$/ });
  if (await checkIn.count()) {
    await ui.tap(checkIn);
    const sheet = page.getByRole('dialog', { name: ui.CHECKIN });
    await ui.answerCheckIn(t, sheet, ui.normalAnswers('P01'));
    await ui.tap(sheet.getByRole('button', { name: 'Start logging', exact: true }));
    await sheet.waitFor({ state: 'hidden' });
  }
  const reps = main.getByRole('textbox', { name: /^(Reps|Seconds)/ });
  await ui.type(reps, '10');
  const weight = main.getByRole('textbox', { name: 'Weight (kg)', exact: true });
  if (await weight.count()) await ui.type(weight, '20');
  await ui.tap(ui.button(main, 'Done set'));
  await data.waitDb(t, s => (s.sessions ?? []).some(x => x.id !== 'legacy-strength' && x.sets.some(y => y.status === 'completed')), 'the logged set never reached the database');
  await ui.tap(main.getByRole('button', { name: 'Finish workout', exact: true }));
  const finish = page.getByRole('dialog', { name: 'Finish workout' });
  await ui.tap(ui.button(finish, 'Save workout'));
  await page.waitForFunction(() => /#\/track\/workout\/./.test(location.hash), null, { timeout: 10000 });
  await t.ready();
}

/** The confirm-Replace stage of a restore sheet, reached from a fresh pick of `file`. */
async function toConfirm(t, file) {
  const sheet = await data.chooseRestore(t, file);
  await ui.tap(sheet.getByRole('button', { name: /^Replace everything here$|^Replace with this backup$/ }));
  await sheet.getByRole('button', { name: 'Replace everything', exact: true }).waitFor();
  return sheet;
}

export const cases = [{
  name: 'backup, replace and clear',
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/today' });
    const main = page.getByRole('main');
    t.allowConsole('acceptance-injected');
    let B; let fileB; let A;

    await t.step(1, 'Add a glucose and a day steps total; restore reading state from a backup; Back up your record; decode B', async () => {
      await data.logGlucose(t, { value: 112 });
      await data.logTotal(t, 'steps', 3000);
      // The defined setup (codex-acceptance.md, J18 step 1): no screen writes
      // reading state, so it arrives the one way the app accepts it — a
      // canonical backup carrying one content-state row, merged through the
      // app's own Restore — and the later steps check that store as usual.
      const withContent = data.transferDoc({ contentState: [{ key: 'guide:read:vitamin-b12', value: { readAt: '2026-10-08T08:55:00.000+05:30' } }] });
      const sheet = await data.chooseRestore(t, data.writeFixture(t, 'reading-state.json', withContent));
      await data.merge(t, sheet);
      await ui.tap(ui.button(sheet, 'Done'));
      const before = await t.db();
      const requestsBefore = t.requests.length;
      const made = await data.backup(t, { expectVia: 'download' });
      B = data.decodeBackup(made.bytes);
      fileB = data.writeFixture(t, made.name, made.bytes);
      await t.checkpoint('backup-made');
      await t.check(B.format === 'fit-strong-health-record' && B.version === 1 && B.schemaVersion === 5, `backup header: ${JSON.stringify({ format: B.format, version: B.version, schemaVersion: B.schemaVersion })}`);
      const diffs = data.compareLogical(data.logical(before), data.logicalFromDoc(B), { label: ['device', 'backup'] });
      await t.check(diffs.length === 0, `backup B does not hold the whole record: ${diffs.slice(0, 6).join(' | ')}`);
      await t.check(B.observations.some(o => o.kind === 'glucose' && o.value === 112) && B.observations.some(o => o.kind === 'steps' && o.value === 3000)
        && B.sessions.length === 1 && !!B.settings && !!B.profile && B.checkIns.length === 1 && B.personalRecords.length === 1 && B.bodyMetrics.length === 1
        && Object.keys(B.focusOverrides).length === 1 && B.contentState?.length === 1,
        `backup B is missing a collection: ${JSON.stringify({ obs: B.observations.length, sessions: B.sessions.length, settings: !!B.settings, profile: !!B.profile, checkIns: B.checkIns.length, prs: B.personalRecords.length, metrics: B.bodyMetrics.length, overrides: Object.keys(B.focusOverrides).length, content: B.contentState?.length })}`);
      await t.check(!/latitude|longitude|"coords"|"route"/.test(JSON.stringify(B)), 'backup B carries location data');
      const sent = t.requests.slice(requestsBefore).filter(r => r.method !== 'GET' || !r.url.startsWith(t.origin));
      await t.check(sent.length === 0, `the backup sent something: ${sent.map(r => `${r.method} ${r.url}`).join(', ')}`);
    }, { input: 'glucose 112 mg/dL; steps 3000; one reading-state row merged from a canonical backup (the defined setup)' });

    await t.step(2, 'Add a glucose and a session after B; snapshot A; Restore from a backup → B shows a preview, nothing written', async () => {
      await data.logGlucose(t, { value: 118 });
      await logWorkout(t);
      A = await t.db();
      const sheet = await data.chooseRestore(t, fileB);
      const preview = await say(sheet);
      await t.checkpoint('restore-preview');
      await t.check(/In this file/i.test(preview) && /Blood glucose\s*2/.test(preview) && /Sessions\s*1/.test(preview), `the preview does not count what B holds: ${preview.slice(0, 400)}`);
      await t.check(/Readings from 25 Sept? 2026 to 8 Oct 2026/.test(preview), `the preview gives no date range: ${preview.slice(0, 300)}`);
      await t.check(/includes a profile and health answers/.test(preview) && /includes settings/.test(preview), `the preview does not say it includes the profile and settings: ${preview.slice(0, 400)}`);
      const now = await t.db();
      const changed = data.sameSnapshot(A, now);
      await t.check(changed.length === 0, `opening the preview changed the record: ${changed.slice(0, 4).join(' | ')}`);
      t.restoreSheet = sheet;
    }, { input: 'glucose 118 mg/dL; a one-set workout; choose B' });

    await t.step(3, 'Replace everything here, then Keep what is here; reload', async () => {
      const sheet = t.restoreSheet;
      await ui.tap(sheet.getByRole('button', { name: 'Replace everything here', exact: true }));
      const confirm = await say(sheet);
      await t.checkpoint('replace-confirm');
      await t.check(/Replace everything on this/.test(confirm) && /deletes/.test(confirm) && /cannot be undone/.test(confirm), `the confirmation does not describe the deletion: ${confirm.slice(0, 300)}`);
      await ui.tap(ui.button(sheet, 'Keep what is here'));
      await sheet.waitFor({ state: 'hidden' });
      await t.reload();
      const now = await t.checkpoint('after-keep-reload');
      const changed = data.sameSnapshot(A, now);
      await t.check(changed.length === 0, `Keep what is here changed the record: ${changed.slice(0, 4).join(' | ')}`);
    });

    for (const [n, fault] of [['abort', { op: 'put', store: 'observations', action: 'abortAfterQueue' }], ['quota', { op: 'put', store: 'sessions', action: 'quotaSafari' }]]) {
      await t.step(4, `Replace again with a ${n === 'abort' ? 'transaction abort' : 'Safari-style quota error'} injected: nothing changes`, async () => {
        const sheet = await toConfirm(t, fileB);
        await watchRoutes(page);
        await t.setPageFaults([fault]);
        await ui.tap(ui.button(sheet, 'Replace everything'));
        await data.waitOutcome(t, sheet).catch(() => {});
        const said = await say(sheet).catch(() => '(the restore sheet is gone)');
        await t.checkpoint(`replace-failed-${n}`);
        await t.setPageFaults(null);
        const log = await t.faultLog();
        await t.must(log.length > 0, `the ${n} fault never fired`);
        await t.check(/Nothing was changed/.test(said), `the failed Replace does not say nothing changed: ${said.slice(0, 300)}`);
        await t.check(!/Restored\./.test(said), 'a failed Replace says Restored');
        const routes = await routesSeen(page);
        await t.check(routes.every(r => !r.startsWith('#/welcome')), `the failed Replace routed through ${routes.join(' → ')}`);
        const now = await t.db();
        const changed = data.sameSnapshot(A, now);
        await t.check(changed.length === 0, `the failed Replace changed the record: ${changed.slice(0, 4).join(' | ')}`);
        if (await sheet.count()) await ui.tap(ui.button(sheet, 'Close'));
      }, { input: `fault ${JSON.stringify(fault)}` });
    }

    await t.step(5, 'Remove the fault, choose B again, Replace everything; reload: the record is B', async () => {
      const sheet = await toConfirm(t, fileB);
      await ui.tap(ui.button(sheet, 'Replace everything'));
      await data.waitOutcome(t, sheet);
      const said = await say(sheet);
      await t.check(/Restored\./.test(said), `Replace did not confirm: ${said.slice(0, 200)}`);
      await ui.tap(ui.button(sheet, 'Done'));
      await t.reload();
      const now = await t.checkpoint('after-replace-reload');
      const diffs = data.compareLogical(data.logicalFromDoc(B, { ignoreExportDate: true }), data.logical(now, { ignoreExportDate: true }), { label: ['B', 'device'] });
      await t.check(diffs.length === 0, `after Replace the record is not B: ${diffs.slice(0, 6).join(' | ')}`);
      const obs = now.observations ?? [];
      await t.check(!obs.some(o => o.kind === 'glucose' && o.value === 118), 'the A-only glucose survived Replace');
      await t.check((now.sessions ?? []).length === 1, `${(now.sessions ?? []).length} sessions after Replace (B holds 1)`);
      await t.check(docs(now).settings?.habits?.lastExportAt === B.exportedAt || docs(now).settings?.habits?.lastExportAt === undefined,
        `lastExportAt after Replace is ${docs(now).settings?.habits?.lastExportAt}, not B's export date ${B.exportedAt}`);
      t.replaced = now;
    });

    await t.step(6, 'Delete everything on this device → Keep my record: no change', async () => {
      const before = await t.db();
      const storage = await t.storage();
      const m = await data.openData(t);
      await ui.tap(ui.row(m, `Delete everything on this device`));
      const sheet = page.getByRole('dialog', { name: 'Delete everything' });
      await sheet.waitFor();
      await t.checkpoint('delete-confirm');
      await ui.tap(ui.button(sheet, 'Keep my record'));
      await sheet.waitFor({ state: 'hidden' });
      const now = await t.db();
      await t.check(data.sameSnapshot(before, now).length === 0, 'Keep my record changed the record');
      const after = await t.storage();
      await t.check(JSON.stringify(data.appKeys(after)) === JSON.stringify(data.appKeys(storage)) && after.local['fit-strong-90-data'] === storage.local['fit-strong-90-data'],
        `Keep my record changed web storage: ${JSON.stringify(data.appKeys(storage))} → ${JSON.stringify(data.appKeys(after))}`);
      await t.check(typeof after.local['fit-strong-90-data'] === 'string', 'the old v4 blob is gone before any delete');
    });

    await t.step(7, 'Delete everything with the clear transaction failing: failure shown, record kept, no Welcome', async () => {
      const before = await t.db();
      const storage = await t.storage();
      const m = await data.openData(t);
      await ui.tap(ui.row(m, `Delete everything on this device`));
      const sheet = page.getByRole('dialog', { name: 'Delete everything' });
      await sheet.waitFor();
      await watchRoutes(page);
      await t.setPageFaults([{ op: 'clear', action: 'abortAfterQueue' }]);
      await ui.tap(ui.button(sheet, 'Delete everything'));
      await page.waitForTimeout(1500);
      await t.checkpoint('delete-failed');
      await t.setPageFaults(null);
      await t.must((await t.faultLog()).some(f => f.op === 'clear'), 'the clear fault never fired');
      const now = await t.db();
      const changed = data.sameSnapshot(before, now);
      await t.check(changed.length === 0, `the failed delete changed the record: ${changed.slice(0, 4).join(' | ')}`);
      const after = await t.storage();
      await t.check(after.local['fit-strong-90-data'] === storage.local['fit-strong-90-data'] && JSON.stringify(data.appKeys(after)) === JSON.stringify(data.appKeys(storage)),
        `the failed delete changed web storage: ${JSON.stringify(data.appKeys(storage))} → ${JSON.stringify(data.appKeys(after))}`);
      const routes = await routesSeen(page);
      await t.check(routes.every(r => !r.startsWith('#/welcome') && !r.startsWith('#/onboarding')), `after the failed delete the app routed ${routes.join(' → ')} (the Welcome gate, then away from Data & offline)`);
      const where = await t.route();
      const visible = await t.visible();
      const said = (await sheet.count()) ? await say(sheet) : '';
      await t.check(/Nothing was deleted/.test(said), `the delete's own failure (“Nothing was deleted”) is not shown: the person is on ${where} seeing “${visible.replace(/\n/g, ' ').slice(0, 160)}”`);
      await t.check(/did not save|Nothing was deleted|could not/i.test(`${said} ${visible}`), 'no failure is visible at all after the failed delete');
      await t.check(!(await page.getByRole('heading', { level: 1, name: 'Welcome', exact: true }).count()), 'the Welcome screen is shown after a failed delete');
    }, { input: 'fault {"op":"clear","action":"abortAfterQueue"}' });

    await t.step(8, 'Delete everything for real; reload twice: a new user, nothing left', async () => {
      // The failed delete leaves its sheet open, and the screen behind an open
      // sheet is inert. Close it the way a person would before starting again.
      const left = page.getByRole('dialog', { name: 'Delete everything' });
      if (await left.count()) {
        const keep = ui.button(left, 'Keep my record');
        if (await keep.count()) await ui.tap(keep);
        else await page.keyboard.press('Escape');
        await left.waitFor({ state: 'hidden' });
      }
      const m = await data.openData(t);
      await ui.tap(ui.row(m, `Delete everything on this device`));
      const sheet = page.getByRole('dialog', { name: 'Delete everything' });
      await sheet.waitFor();
      await ui.tap(ui.button(sheet, 'Delete everything'));
      await page.getByRole('heading', { level: 1, name: 'Welcome', exact: true }).waitFor({ timeout: 15000 });
      await t.ready();
      await t.reload();
      await t.reload();
      const now = await t.checkpoint('after-clear-reloads');
      await t.check(await t.route() === '/welcome', `after Delete everything and two reloads the app is at ${await t.route()}`);
      await t.check((now.observations ?? []).length === 0 && (now.sessions ?? []).length === 0 && (now['content-state'] ?? []).length === 0,
        `stores not empty: ${JSON.stringify({ obs: now.observations?.length, sessions: now.sessions?.length, content: now['content-state']?.length })}`);
      const d = docs(now);
      const leftover = Object.entries(d).filter(([k, v]) => !['schemaVersion', 'revision'].includes(k)
        && !(Array.isArray(v) && v.length === 0) && !(v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0));
      await t.check(leftover.length === 0, `settings documents left after Delete everything: ${leftover.map(([k, v]) => `${k}=${JSON.stringify(v).slice(0, 80)}`).join(', ')}`);
      const s = await t.storage();
      const keys = data.appKeys(s);
      await t.check(!('fit-strong-90-data' in s.local), 'the old v4 blob survived Delete everything');
      const extra = keys.filter(k => !(k === 'fit-strong-90-theme' && s.local[k] === 'system'));
      await t.check(extra.length === 0, `app-owned web storage left after Delete everything: ${extra.join(', ')}`);
      // The fresh app's own navigation history, rebuilt since the restart: only Welcome has been on screen.
      const freshNavigation = ([k, v]) => {
        if (k !== 'fit-strong-90-navigation') return false;
        try {
          const nav = JSON.parse(v);
          const entries = [...(nav.entries ?? []), ...Object.values(nav.places ?? {}), ...Object.values(nav.roots ?? {})].filter(Boolean);
          return entries.every(e => typeof e.pathname === 'string' && e.pathname.startsWith('/welcome'));
        } catch { return false; }
      };
      const session = Object.entries(s.session).filter(([k]) => /^fit|draft|progress|session/i.test(k) && !/^(remix-router|react-router)/.test(k))
        .filter(e => !freshNavigation(e));
      await t.check(session.length === 0, `app-owned session storage left: ${session.map(([k, v]) => `${k}=${String(v).slice(0, 300)}`).join(', ')}`);
    });

    await t.step(9, 'Restore B from Welcome: the same record, onboarded, P01', async () => {
      const sheet = await data.chooseRestore(t, fileB, { from: 'welcome' });
      const preview = await say(sheet);
      await t.checkpoint('welcome-restore-preview');
      await t.check(/In this file/i.test(preview) && /Restore/.test(preview), `no preview before restoring from Welcome: ${preview.slice(0, 300)}`);
      const nothingYet = await t.db();
      await t.check((nothingYet.observations ?? []).length === 0, 'choosing the file wrote records before Restore was tapped');
      await ui.tap(ui.button(sheet, 'Restore'));
      const seen = await data.restoredFromWelcome(t, sheet);
      t.note(`Welcome restore ended on ${seen.seen}${seen.confirmed ? ' with the Restored confirmation' : ''}`);
      await t.reload();
      const now = await t.checkpoint('restored-from-welcome');
      const diffs = data.compareLogical(data.logicalFromDoc(B, { ignoreExportDate: true }), data.logical(now, { ignoreExportDate: true }), { label: ['B', 'device'] });
      await t.check(diffs.length === 0, `restored from Welcome, the record is not B: ${diffs.slice(0, 6).join(' | ')}`);
      const settings = docs(now).settings ?? {};
      await t.check(settings.onboardingComplete === true && settings.focus === 'strength' && settings.startDate === '2026-09-24', `restored settings are not P01's onboarded settings: ${JSON.stringify(settings).slice(0, 200)}`);
      await t.check(await t.route() === '/today' && await page.getByRole('heading', { level: 1, name: 'Today', exact: true }).count() === 1, `after restoring from Welcome the app is at ${await t.route()}`);
    });
  },
}];
