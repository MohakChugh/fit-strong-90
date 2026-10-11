import { beforeEach, describe, expect, it } from 'vitest';
import type { AppData } from '@/types';
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
  continueWithoutSaving, enterWithoutSaving, finishSetup, getSetupSession, keepInSession, mover, outcomeOf, pageEdits, rememberEdits,
  resetSetupSessionForTests, saveDraft, withDraft,
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

  it('remembers what a page held, so Back never loses it (§6.1)', () => {
    rememberEdits('about.name', { name: 'As' });
    expect(pageEdits('about.name')).toEqual({ name: 'As' });
    expect(pageEdits('about.figure')).toEqual({});
  });
});
