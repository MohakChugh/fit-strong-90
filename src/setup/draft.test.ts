import { beforeEach, describe, expect, it } from 'vitest';
import type { AppData } from '@/types';
import { createDefaultProfile } from '@/profile/defaults';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { StoreFailure } from '@/store/db';
import { CURRENT_VERSION, migrateData } from '@/services/storage';

// The store sweeps localStorage on clear-all; node has none, so give it one.
const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null,
  setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k),
  clear: () => local.clear(),
  key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;

const store = await import('@/store/useStore');
const {
  autosaveEdits, continueWithoutSaving, enterWithoutSaving, finishSetup, flushEdits, flushPending, forgetEdits, getSetupSession, keepInSession, lookAroundFirst, mover, outcomeOf,
  pageEdits, rememberEdits, resetSetupSessionForTests, saveDraft, withDraft,
} = await import('./draft');
const { MINIMAL } = await import('./fixtures');
const { setupStateOf } = await import('./state');
const CTX = { thisYear: 2026 };
const NOW = '2026-10-10T09:00:00.000+05:30';

const fresh = (): AppData => migrateData({ version: CURRENT_VERSION } as AppData);
const ok = { ok: true as const, value: undefined };
const refused = { ok: false as const, failure: new StoreFailure('quotaExceeded', 'Storage is full') };

beforeEach(() => {
  local.clear();
  store.resetForTests();
  resetSetupSessionForTests();
});

describe('the draft (journey §6.1, §18.1)', () => {
  it('stores the answers and the page to resume on, keeping the rest of setup’s state', () => {
    const data = fresh();
    data.settings = { ...data.settings, setup: { declined: ['food'] } };
    expect(withDraft(data, 'about.figure', { name: 'Asha' }).settings.setup)
      .toEqual({ stage: 'open', skipped: [], declined: ['food'], draft: { at: 'about.figure', answers: { name: 'Asha' } } });
  });

  it('changes nothing once another tab has finished setup (Review Focus 4)', () => {
    const data = fresh();
    // Finishing stores the profile with completion; without one, setup is still to finish (H5-17).
    data.profile = createDefaultProfile({ name: 'Asha' });
    data.settings = { ...data.settings, onboardingComplete: true, setup: { stage: 'done', skipped: [], answers: { name: 'Asha' } } };
    expect(withDraft(data, 'health.conditions', { name: 'Someone else' })).toBe(data);
  });

  it('reads a write’s result: stored, kept for this session only, or refused', () => {
    expect(outcomeOf(ok, 'ready')).toBe('saved');
    expect(outcomeOf(refused, 'unavailable')).toBe('session');
    expect(outcomeOf(refused, 'ready')).toBe('failed');
  });
});

describe('Next moves only once its answer is stored (M22)', () => {
  it('a fast double tap stores once and moves once', async () => {
    const saves: string[] = [];
    const moves: string[] = [];
    let finish!: () => void;
    const go = mover(to => new Promise(resolve => { saves.push(to); finish = () => resolve('saved'); }), { moved: to => moves.push(to), failed: () => {} });
    const first = go('about.figure', {});
    const second = go('about.figure', {});
    expect(await second).toBeUndefined();
    finish();
    expect(await first).toBe('saved');
    expect(saves).toEqual(['about.figure']);
    expect(moves).toEqual(['about.figure']);
    // Once stored, the next Next moves as it should.
    const third = go('about.body', {});
    finish();
    expect(await third).toBe('saved');
    expect(moves).toEqual(['about.figure', 'about.body']);
  });

  it('a refused or thrown save stays, with the answers kept to try again', async () => {
    const failed: [string, unknown][] = [];
    const moves: string[] = [];
    const on = { moved: (to: string) => moves.push(to), failed: (to: string, a: unknown) => failed.push([to, a]) };
    await mover(() => Promise.resolve('failed'), on)('health.diabetes', { regular: 'yes' });
    await mover(() => Promise.reject(new Error('disk gone')), on)('health.bp', {});
    expect(moves).toEqual([]);
    expect(failed).toEqual([['health.diabetes', { regular: 'yes' }], ['health.bp', {}]]);
  });

  it('a refused write leaves the stored draft as it was (V-J17)', async () => {
    let refuse = false;
    await store.start({ factory: fakeIndexedDB({ failWrite: (s, v) => (refuse && s === 'settings' && v.key === 'settings' ? new DOMException('Disk is full', 'QuotaExceededError') : undefined) }) });
    expect((await store.update(d => withDraft(d, 'about.figure', { name: 'Asha' }))).ok).toBe(true);
    refuse = true;
    const result = await store.update(d => withDraft(d, 'health.conditions', { name: 'Asha', figure: 'female' }));
    expect(outcomeOf(result, store.getState().status)).toBe('failed');
    expect((await store.reload()).ok).toBe(true);
    expect(store.getState().settings.setup?.draft).toEqual({ at: 'about.figure', answers: { name: 'Asha' } });
  });
});

describe('without saving (B-07)', () => {
  it('keeps the answers in this session, then lets the app open for it only', () => {
    continueWithoutSaving('health.diabetes', { conditions: { diabetes: 'unsure' } });
    keepInSession('health.bp', { conditions: { diabetes: 'unsure' }, diabetesType: 'unsure' });
    expect(getSetupSession()).toEqual({ unsaved: true, entered: false, at: 'health.bp', answers: { conditions: { diabetes: 'unsure' }, diabetesType: 'unsure' } });
    enterWithoutSaving();
    expect(getSetupSession().entered).toBe(true);
  });

  it('storage refused from the start runs setup in its unsaved mode: the warning shows, and the answers live in this session (H5-06)', async () => {
    await store.start({ factory: fakeIndexedDB({ openFails: 'error' }) });
    expect(store.getState().status).toBe('unavailable');
    expect(await saveDraft('health.conditions', MINIMAL)).toBe('session');
    expect(getSetupSession()).toMatchObject({ unsaved: true, at: 'health.conditions', answers: MINIMAL });
  });

  it('and finishing then completes nothing, even in this session’s memory, so every hold stays (H5-06)', async () => {
    await store.start({ factory: fakeIndexedDB({ openFails: 'error' }) });
    expect(await finishSetup(MINIMAL, CTX, NOW)).toEqual({ kind: 'home' });
    expect(getSetupSession().entered).toBe(true);
    const s = store.getState();
    expect(s.profile).toBeUndefined();
    expect(s.settings.onboardingComplete).not.toBe(true);
    expect(setupStateOf(s.settings, s.profile).stage).not.toBe('done');
  });

  it('a write that needs storage is refused with nothing to store to, before anything changes, even in memory (H5-06)', async () => {
    await store.start({ factory: fakeIndexedDB({ openFails: 'error' }) });
    const result = await store.update(d => ({ ...d, settings: { ...d.settings, onboardingComplete: true } }), { hold: true, needsStorage: 'Not stored' });
    expect(result.ok ? undefined : result.failure.code).toBe('unavailable');
    expect(store.getState().settings.onboardingComplete).not.toBe(true);
  });

  it('a successful Next forgets what its page held, since the draft has it now; a refused one keeps it (K5-05)', async () => {
    let refuse = false;
    await store.start({ factory: fakeIndexedDB({ failWrite: (s, v) => (refuse && s === 'settings' && v.key === 'settings' ? new DOMException('Disk is full', 'QuotaExceededError') : undefined) }) });
    rememberEdits('about.name', { name: 'As' });
    refuse = true;
    expect(await saveDraft('about.figure', { name: 'Asha' }, 'about.name')).toBe('failed');
    expect(pageEdits('about.name')).toEqual({ name: 'As' });
    refuse = false;
    expect(await saveDraft('about.figure', { name: 'Asha' }, 'about.name')).toBe('saved');
    expect(pageEdits('about.name')).toEqual({});
  });

  it('a backup restored with Replace starts setup afresh: no page held, nothing unsaved, from the record before (H5-07, K5-05)', async () => {
    const { TRANSFER_FORMAT } = await import('@/store/transfer');
    await store.start({ factory: fakeIndexedDB() });
    // The previous setup: "No" to diabetes on the page, and answers kept unsaved.
    rememberEdits('health.conditions', { conditions: { diabetes: 'no' } });
    continueWithoutSaving('health.bp', { conditions: { diabetes: 'no', bp: 'yes' } });
    const backup = {
      format: TRANSFER_FORMAT, version: 1, exportedAt: '2026-10-08T19:00:00.000+05:30', schemaVersion: 5,
      settings: { setup: { stage: 'open', draft: { at: 'health.diabetes', answers: { conditions: { diabetes: 'yes' } } } } },
      observations: [], sessions: [], checkIns: [], personalRecords: [], bodyMetrics: [], focusOverrides: {}, contentState: [],
    };
    expect((await store.importRecord(backup, 'replace')).ok).toBe(true);
    expect(getSetupSession()).toMatchObject({ unsaved: false, entered: false, answers: {} });
    expect(pageEdits('health.conditions')).toEqual({});
    expect(store.getState().settings.setup?.draft?.answers?.conditions?.diabetes).toBe('yes');
  });

  it('a merge keeps this device’s settings, so setup’s session is kept too', async () => {
    const { TRANSFER_FORMAT } = await import('@/store/transfer');
    await store.start({ factory: fakeIndexedDB() });
    continueWithoutSaving('health.bp', { conditions: { bp: 'yes' } });
    const file = {
      format: TRANSFER_FORMAT, version: 1, exportedAt: '2026-10-08T19:00:00.000+05:30', schemaVersion: 5, settings: {},
      observations: [], sessions: [], checkIns: [], personalRecords: [], bodyMetrics: [], focusOverrides: {}, contentState: [],
    };
    expect((await store.importRecord(file, 'merge')).ok).toBe(true);
    expect(getSetupSession().unsaved).toBe(true);
  });

  it('Look around first forgets what the pages held; the answers wait in the draft (K5-05)', async () => {
    await store.start({ factory: fakeIndexedDB() });
    rememberEdits('about.name', { name: 'As' });
    expect(await lookAroundFirst()).toBeUndefined();
    expect(pageEdits('about.name')).toEqual({});
    expect(store.getState().settings.setup?.stage).toBe('lookAround');
  });

  it('a finish planned after another tab finished keeps that tab’s record, and adds none of its readings (H5-09)', async () => {
    const { completedSetup } = await import('./assemble');
    const { withC } = await import('./fixtures');
    await store.start({ factory: fakeIndexedDB() });
    // The other tab finished first, with a foot limit that holds walks.
    const other = withC({ feet: 'yes' }, { feetNumb: 'no', footWound: 'no', footRestriction: 'yes' });
    expect((await store.update(d => completedSetup(d, other, NOW, { ...CTX, hasSteps: false }))).ok).toBe(true);
    expect(await finishSetup({ ...MINIMAL, weightKg: 81 }, CTX, NOW)).toEqual({ kind: 'home' });
    const s = store.getState();
    expect(s.profile?.health.footStatus).toBe('current_wound_or_active_charcot');
    expect(s.settings.setup?.answers?.footRestriction).toBe('yes');
    expect(s.observations.filter(o => o.kind === 'weight')).toEqual([]);
  });

  it('a finish of answers changed meanwhile stores nothing, and says why, on Review (H5-09)', async () => {
    await store.start({ factory: fakeIndexedDB() });
    expect((await store.update(d => withDraft(d, 'review', MINIMAL))).ok).toBe(true);
    // Another tab took the answers on: insulin, since Review was drawn.
    const changed = { ...MINIMAL, regular: 'yes' as const, classes: { insulin: 'yes' as const } };
    expect((await store.update(d => withDraft(d, 'medicines.lows', changed))).ok).toBe(true);
    const finished = await finishSetup(MINIMAL, CTX, NOW);
    expect(finished.kind).toBe('failed');
    const s = store.getState();
    expect(setupStateOf(s.settings, s.profile).stage).toBe('open');
    expect(s.settings.setup?.draft?.answers?.classes?.insulin).toBe('yes');
  });

  it('finishing setup forgets its session and what its pages held (K5-05)', async () => {
    await store.start({ factory: fakeIndexedDB() });
    rememberEdits('about.name', { name: 'Someone else' });
    expect(await finishSetup(MINIMAL, CTX, NOW)).toEqual({ kind: 'home' });
    expect(pageEdits('about.name')).toEqual({});
  });

  it('a Next stores only its page’s changes onto the draft as it is now: another tab’s answers stay (H5-12)', async () => {
    const { NO_CONDITIONS } = await import('./fixtures');
    await store.start({ factory: fakeIndexedDB() });
    expect((await store.update(d => withDraft(d, 'about.name', { metric: true }))).ok).toBe(true);
    const opened = store.getState().settings.setup!.draft!.answers!;
    // Tab B, from the same draft, stores the health answers.
    expect((await store.update(d => withDraft(d, 'health.diabetes', { ...opened, conditions: { ...NO_CONDITIONS, diabetes: 'yes' } }, opened))).ok).toBe(true);
    // Tab A, opened before that, stores its name.
    expect(await saveDraft('about.figure', { ...opened, name: 'Kai' }, 'about.name', opened)).toBe('saved');
    expect(store.getState().settings.setup?.draft?.answers).toMatchObject({ name: 'Kai', conditions: { diabetes: 'yes' } });
  });

  it('remembers what a page held, so Back never loses it (§6.1)', () => {
    rememberEdits('about.name', { name: 'As' });
    expect(pageEdits('about.name')).toEqual({ name: 'As' });
    expect(pageEdits('about.figure')).toEqual({});
  });
});

describe('a page’s answers, kept as typed while it’s open (§6.1; H5-16, K5-17; board D158)', () => {
  const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
  const stored = () => store.getState().settings.setup?.draft;

  it('are stored shortly after each change, half-typed numbers as typed, and a new session opens the page on them', async () => {
    await store.start({ factory: fakeIndexedDB() });
    autosaveEdits('about.name', { name: 'As', birthYear: 195 }, 10);
    expect(stored()?.edits).toBeUndefined();
    await wait(60);
    expect(stored()).toMatchObject({ at: 'about.name', edits: { 'about.name': { name: 'As', birthYear: 195 } } });
    // The app closed and opened again.
    expect((await store.reload()).ok).toBe(true);
    resetSetupSessionForTests();
    expect(pageEdits('about.name')).toEqual({ name: 'As', birthYear: 195 });
  });

  it('Back stores the page it goes to, with what this page held', async () => {
    await store.start({ factory: fakeIndexedDB() });
    expect((await store.update(d => withDraft(d, 'health.bp', MINIMAL))).ok).toBe(true);
    rememberEdits('health.bp', { bpMedicine: 'unsure' });
    await flushEdits('health.bp', 'health.conditions');
    expect(stored()).toMatchObject({ at: 'health.conditions', answers: MINIMAL, edits: { 'health.bp': { bpMedicine: 'unsure' } } });
  });

  it('a Next stores its page’s answers and forgets what it held, a change still waiting included; another page’s stay', async () => {
    await store.start({ factory: fakeIndexedDB() });
    autosaveEdits('about.figure', { figure: 'female' }, 10);
    await wait(60);
    autosaveEdits('about.name', { name: 'Kai' }, 10);
    expect(await saveDraft('about.figure', { name: 'Kai' }, 'about.name', {})).toBe('saved');
    await wait(60);
    expect(stored()?.edits).toEqual({ 'about.figure': { figure: 'female' } });
    expect(stored()?.answers?.name).toBe('Kai');
  });

  it('a page’s Next takes away what it held once kept, and a change waiting through a slow write never puts it back', async () => {
    const fake = fakeIndexedDB();
    await store.start({ factory: fake });
    autosaveEdits('about.name', { name: 'Ka' }, 10);
    await wait(60);
    expect(stored()?.edits).toEqual({ 'about.name': { name: 'Ka' } });
    autosaveEdits('about.name', { name: 'Kai' }, 10);
    fake.control.hold();
    const next = saveDraft('about.figure', { name: 'Kai' }, 'about.name', {});
    await wait(60);
    fake.control.release();
    expect(await next).toBe('saved');
    await wait(60);
    expect(stored()).toMatchObject({ at: 'about.figure', answers: { name: 'Kai' } });
    expect(stored()?.edits).toBeUndefined();
  });

  it('Look around first forgets what the pages held, kept ones included (K5-05)', async () => {
    await store.start({ factory: fakeIndexedDB() });
    rememberEdits('about.name', { name: 'As' });
    await flushEdits('about.name', 'about.name');
    expect(stored()?.edits).toEqual({ 'about.name': { name: 'As' } });
    expect(await lookAroundFirst()).toBeUndefined();
    expect(stored()?.edits).toBeUndefined();
    expect(pageEdits('about.name')).toEqual({});
  });

  it('without saving, what the draft kept from before is never drawn over this session’s answers (K5-05)', async () => {
    await store.start({ factory: fakeIndexedDB() });
    rememberEdits('health.conditions', { conditions: { diabetes: 'unsure', bp: 'yes' } });
    await flushEdits('health.conditions', 'health.conditions');
    // The next write is refused; the page is corrected and goes on without saving.
    continueWithoutSaving('health.bp', { conditions: { diabetes: 'no', bp: 'yes' } });
    forgetEdits('health.conditions');
    expect(pageEdits('health.conditions')).toEqual({});
  });

  it('without saving, Back keeps the page to resume on in this session', async () => {
    await store.start({ factory: fakeIndexedDB({ openFails: 'error' }) });
    continueWithoutSaving('health.bp', MINIMAL);
    await flushEdits('health.bp', 'health.conditions');
    expect(getSetupSession()).toMatchObject({ unsaved: true, at: 'health.conditions', answers: MINIMAL });
  });

  it('a change still waiting when a backup replaces the record is never kept in the new one (H5-07)', async () => {
    const { TRANSFER_FORMAT } = await import('@/store/transfer');
    await store.start({ factory: fakeIndexedDB() });
    autosaveEdits('health.conditions', { conditions: { diabetes: 'no' } }, 20);
    const backup = {
      format: TRANSFER_FORMAT, version: 1, exportedAt: '2026-10-08T19:00:00.000+05:30', schemaVersion: 5,
      settings: { setup: { stage: 'open', draft: { at: 'about.figure', answers: { figure: 'female' } } } },
      observations: [], sessions: [], checkIns: [], personalRecords: [], bodyMetrics: [], focusOverrides: {}, contentState: [],
    };
    expect((await store.importRecord(backup, 'replace')).ok).toBe(true);
    await flushPending('health.conditions');
    await wait(60);
    expect(stored()).toEqual({ at: 'about.figure', answers: { figure: 'female' } });
  });

  it('a backup never brings half-typed answers: they stay on the device they were typed on (H5-07)', async () => {
    const { TRANSFER_FORMAT } = await import('@/store/transfer');
    await store.start({ factory: fakeIndexedDB() });
    const backup = {
      format: TRANSFER_FORMAT, version: 1, exportedAt: '2026-10-08T19:00:00.000+05:30', schemaVersion: 5,
      settings: { setup: { stage: 'open', draft: { at: 'about.name', answers: { figure: 'female' }, edits: { 'about.name': { name: 'Someone' } } } } },
      observations: [], sessions: [], checkIns: [], personalRecords: [], bodyMetrics: [], focusOverrides: {}, contentState: [],
    };
    expect((await store.importRecord(backup, 'replace')).ok).toBe(true);
    expect(stored()).toEqual({ at: 'about.name', answers: { figure: 'female' } });
  });
});
