import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppData } from '@/types';
import type { SetupAnswers } from '@/types/setup';
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
const toasts = vi.hoisted(() => [] as string[]);
vi.mock('sonner', () => ({ toast: (message: string) => void toasts.push(message) }));

const store = await import('@/store/useStore');
const {
  AUTOSAVE_MS, FINISHED_ELSEWHERE, answersQueue, changeAnswers, continueUnsaved, continueWithoutSaving, enterWithoutSaving, finishSetup, flushAnswers,
  getSetupSession, keepInSession, lookAroundFirst, mover, nextFrom, outcomeOf, rawWithQueued, resetSetupSessionForTests, saveDraft, skipFrom,
  waitingOn, withDraft, withFields, withQueued,
} = await import('./draft');
const { MINIMAL, NO_CLASSES, NO_CONDITIONS, withC } = await import('./fixtures');
const { answersOf, setupStateOf } = await import('./state');
const { rawInvalid } = await import('./graph');
const { gateProfile } = await import('./effective');
const { TRANSFER_FORMAT } = await import('@/store/transfer');
const CTX = { thisYear: 2026 };
const NOW = '2026-10-10T09:00:00.000+05:30';

const fresh = (): AppData => migrateData({ version: CURRENT_VERSION } as AppData);
const ok = { ok: true as const, value: undefined };
const refused = { ok: false as const, failure: new StoreFailure('quotaExceeded', 'Storage is full') };
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const stored = () => store.getState().settings.setup?.draft;
/** What a page shows now: the stored answers, with what's waiting on top. */
const shown = (): SetupAnswers => withQueued(stored()?.answers ?? {});
const draftOf = (answers: SetupAnswers, at: 'review' | 'medicines.which' | 'about.name' = 'about.name') => (d: AppData) => withDraft(d, at, answers);
/** Refuses every write of the settings document while `on.refuse` is set. */
const refusing = (on: { refuse: boolean }) => fakeIndexedDB({
  failWrite: (s, v) => (on.refuse && s === 'settings' && v.key === 'settings' ? new DOMException('Disk is full', 'QuotaExceededError') : undefined),
});
const backup = (settings: Record<string, unknown>) => ({
  format: TRANSFER_FORMAT, version: 1, exportedAt: '2026-10-08T19:00:00.000+05:30', schemaVersion: 5, settings,
  observations: [], sessions: [], checkIns: [], personalRecords: [], bodyMetrics: [], focusOverrides: {}, contentState: [],
});

beforeEach(() => {
  local.clear();
  toasts.length = 0;
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

  it('a move takes a hidden question’s number with it, as its answer (H5-27)', () => {
    const data = fresh();
    data.settings = { ...data.settings, setup: { stage: 'open', draft: { at: 'medicines.which', answers: {}, raw: { metforminSince: '2019', birthYear: '195' } } } };
    const moved = withDraft(data, 'medicines.ketones', { regular: 'yes', classes: { ...NO_CLASSES } });
    expect(moved.settings.setup?.draft?.raw).toEqual({ birthYear: '195' });
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
    const on = { refuse: false };
    await store.start({ factory: refusing(on) });
    expect((await store.update(d => withDraft(d, 'about.figure', { name: 'Asha' }))).ok).toBe(true);
    on.refuse = true;
    const result = await store.update(d => withDraft(d, 'health.conditions', { name: 'Asha', figure: 'female' }));
    expect(outcomeOf(result, store.getState().status)).toBe('failed');
    expect((await store.reload()).ok).toBe(true);
    expect(stored()).toEqual({ at: 'about.figure', answers: { name: 'Asha' } });
  });

  it('Get started stores only the page to go to: the draft’s answers stay as they are (H5-12)', async () => {
    await store.start({ factory: fakeIndexedDB() });
    expect((await store.update(draftOf({ metric: true }))).ok).toBe(true);
    const opened = stored()!.answers!;
    // Another tab answered the name meanwhile.
    expect((await store.update(draftOf({ ...opened, name: 'Kai' }))).ok).toBe(true);
    expect(await saveDraft('about.name', opened, opened)).toBe('saved');
    expect(stored()).toEqual({ at: 'about.name', answers: { metric: true, name: 'Kai', skippedPages: [] } });
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

  it('a change is this session’s at once, numbers as typed included, and Back keeps the page to resume on', async () => {
    await store.start({ factory: fakeIndexedDB({ openFails: 'error' }) });
    continueWithoutSaving('health.bp', MINIMAL);
    changeAnswers(MINIMAL, { name: 'Kai' }, { birthYear: '195' }, 'about.name');
    expect(getSetupSession()).toMatchObject({ unsaved: true, at: 'about.name', answers: { ...MINIMAL, name: 'Kai' }, raw: { birthYear: '195' } });
    expect(await flushAnswers('health.conditions')).toBe('session');
    expect(getSetupSession().at).toBe('health.conditions');
  });

  it('a backup restored with Replace starts setup afresh: nothing waiting, nothing unsaved, from the record before (H5-07, K5-05)', async () => {
    await store.start({ factory: fakeIndexedDB() });
    // The previous setup: "No" to diabetes waiting to be stored, and answers kept unsaved.
    changeAnswers({}, { conditions: { diabetes: 'no' } }, {}, 'health.conditions');
    continueWithoutSaving('health.bp', { conditions: { diabetes: 'no', bp: 'yes' } });
    const file = backup({ setup: { stage: 'open', draft: { at: 'health.diabetes', answers: { conditions: { diabetes: 'yes' } } } } });
    expect((await store.importRecord(file, 'replace')).ok).toBe(true);
    expect(getSetupSession()).toMatchObject({ unsaved: false, entered: false, answers: {} });
    expect(withQueued({})).toEqual({});
    expect(await flushAnswers()).toBe('saved');
    expect(stored()?.answers?.conditions?.diabetes).toBe('yes');
  });

  it('a merge keeps this device’s settings, so setup’s session is kept too', async () => {
    await store.start({ factory: fakeIndexedDB() });
    continueWithoutSaving('health.bp', { conditions: { bp: 'yes' } });
    expect((await store.importRecord(backup({}), 'merge')).ok).toBe(true);
    expect(getSetupSession().unsaved).toBe(true);
  });
});

describe('finishing (journey §6.2)', () => {
  it('a finish planned after another tab finished keeps that tab’s record, and adds none of its readings (H5-09)', async () => {
    const { completedSetup } = await import('./assemble');
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
    expect((await store.update(draftOf(MINIMAL, 'review'))).ok).toBe(true);
    // Another tab took the answers on: insulin, since Review was drawn.
    const changed = { ...MINIMAL, regular: 'yes' as const, classes: { insulin: 'yes' as const } };
    expect((await store.update(d => withDraft(d, 'medicines.lows', changed))).ok).toBe(true);
    const finished = await finishSetup(MINIMAL, CTX, NOW);
    expect(finished.kind).toBe('failed');
    const s = store.getState();
    expect(setupStateOf(s.settings, s.profile).stage).toBe('open');
    expect(s.settings.setup?.draft?.answers?.classes?.insulin).toBe('yes');
  });

  it('forgets setup’s session once it’s done (K5-05)', async () => {
    await store.start({ factory: fakeIndexedDB() });
    expect((await store.update(draftOf(MINIMAL, 'review'))).ok).toBe(true);
    keepInSession('review', MINIMAL);
    expect(await finishSetup(stored()!.answers!, CTX, NOW)).toEqual({ kind: 'home' });
    expect(getSetupSession()).toMatchObject({ unsaved: false, answers: {} });
  });
});

describe('one store of answers (board D169)', () => {
  it('a change goes into the draft’s answers shortly after it’s made, a checklist row by row, and is there after the app closes (H5-16, K5-17)', async () => {
    await store.start({ factory: fakeIndexedDB() });
    changeAnswers({}, { conditions: { feet: 'unsure' } }, {}, 'health.conditions');
    expect(stored()).toBeUndefined();
    await wait(AUTOSAVE_MS + 50);
    expect(stored()).toMatchObject({ at: 'health.conditions', answers: { conditions: { feet: 'unsure' } } });
    expect((await store.reload()).ok).toBe(true);
    resetSetupSessionForTests();
    expect(stored()?.answers?.conditions).toEqual({ feet: 'unsure' });
  });

  it('Review and finishing read those answers, with every gate held meanwhile: a change in a chapter opened from Review and left with Back counts, and Review’s older answers can’t be finished (H5R-01; board D197)', async () => {
    const answered = withC({ diabetes: 'yes', feet: 'yes' }, { diabetesType: 'type2', feetNumb: 'no', footWound: 'no', footRestriction: 'no', clearance: 'none', targets: 'no', priorDka: 'no', dizzy: 'no' });
    await store.start({ factory: fakeIndexedDB() });
    expect((await store.update(draftOf(answered, 'review'))).ok).toBe(true);
    const onReview = answersOf(setupStateOf(store.getState().settings, store.getState().profile));
    // Review → Edit Your health: "No" to a wound becomes "Not sure", then Back to Review, with no Next.
    changeAnswers(shown(), { footWound: 'unsure' }, {}, 'health.feet');
    await flushAnswers('review');
    const s = store.getState();
    expect(answersOf(setupStateOf(s.settings, s.profile)).footWound).toBe('unsure');
    // Unfinished, every gate holds for the profile gap, whatever is stored (board D197).
    expect(gateProfile(s).needsHealthReview).toBe(true);
    expect((await finishSetup(onReview, CTX, NOW)).kind).toBe('failed');
    expect(await finishSetup(stored()!.answers!, CTX, NOW)).toEqual({ kind: 'home' });
    expect(store.getState().profile?.health.footStatus).toBe('current_wound_or_active_charcot');
  });

  it('“Start using FitStrong” stores what’s waiting first, so Review’s older answers can’t be finished over it (H5R-01)', async () => {
    await store.start({ factory: fakeIndexedDB() });
    expect((await store.update(draftOf(MINIMAL, 'review'))).ok).toBe(true);
    changeAnswers(shown(), { conditions: { ...NO_CONDITIONS, feet: 'unsure' } }, {}, 'health.conditions');
    expect((await finishSetup(MINIMAL, CTX, NOW)).kind).toBe('failed');
    expect(stored()?.answers?.conditions?.feet).toBe('unsure');
  });

  it('Next stores what’s waiting, then plans from the answers as stored and takes nothing away; a change made meanwhile stays waiting and holds the page (H5R-11)', async () => {
    const fake = fakeIndexedDB();
    await store.start({ factory: fake });
    const page = withC({ diabetes: 'yes' }, { diabetesType: 'type2', regular: 'yes' });
    expect((await store.update(draftOf(page, 'medicines.which'))).ok).toBe(true);
    const generation = store.getState().epoch;
    changeAnswers(shown(), { classes: { ...NO_CLASSES } }, {}, 'medicines.which');
    fake.control.hold();
    const next = nextFrom('medicines.which', CTX, false, generation);
    await wait(10);
    // Insulin, corrected to Yes while the slow write is on its way.
    changeAnswers(shown(), { classes: { ...NO_CLASSES, insulin: 'yes' } }, {}, 'medicines.which');
    fake.control.release();
    expect(await next).toEqual({ outcome: 'saved', to: 'medicines.ketones' });
    expect(waitingOn('medicines.which')).toBe(true);
    expect(shown().classes?.insulin).toBe('yes');
    expect(await flushAnswers()).toBe('saved');
    expect(stored()?.answers?.classes?.insulin).toBe('yes');
    expect(waitingOn('medicines.which')).toBe(false);
    expect(await nextFrom('medicines.which', CTX, false, generation)).toEqual({ outcome: 'saved', to: 'medicines.lows' });
    expect(stored()?.at).toBe('medicines.lows');
  });

  it('Next on a page not answered as stored moves nowhere', async () => {
    await store.start({ factory: fakeIndexedDB() });
    expect(await nextFrom('health.conditions', CTX, false, store.getState().epoch)).toEqual({ outcome: 'notDone' });
    expect(stored()).toBeUndefined();
  });

  it('Skip for now keeps what the page holds, and marks it skipped', async () => {
    await store.start({ factory: fakeIndexedDB() });
    changeAnswers({}, { name: 'As' }, {}, 'about.name');
    expect(await skipFrom('about.name', CTX, false, store.getState().epoch)).toEqual({ outcome: 'saved', to: 'about.figure' });
    expect(stored()).toMatchObject({ at: 'about.figure', answers: { name: 'As', skippedPages: ['about.name'] } });
  });

  it('Back and Close store what’s waiting with the page to resume on (H5-16)', async () => {
    await store.start({ factory: fakeIndexedDB() });
    expect((await store.update(d => withDraft(d, 'health.bp', MINIMAL))).ok).toBe(true);
    changeAnswers(shown(), { bpMedicine: 'unsure' }, {}, 'health.bp');
    expect(await flushAnswers('health.conditions')).toBe('saved');
    expect(stored()).toMatchObject({ at: 'health.conditions', answers: { ...MINIMAL, bpMedicine: 'unsure' } });
  });

  it('a number is kept as typed, and is an answer only once it’s a valid one (H5R-15)', async () => {
    await store.start({ factory: fakeIndexedDB() });
    changeAnswers({}, { birthYear: undefined }, { birthYear: '195' }, 'about.name');
    await flushAnswers();
    expect(stored()?.raw).toEqual({ birthYear: '195' });
    expect(stored()?.answers?.birthYear).toBeUndefined();
    expect(rawInvalid('about.name', stored()!.answers!, stored()!.raw)).toBe(true);
    changeAnswers(shown(), { birthYear: 1958 }, { birthYear: '1958' }, 'about.name');
    await flushAnswers();
    expect(stored()).toMatchObject({ answers: { birthYear: 1958 }, raw: { birthYear: '1958' } });
    expect(rawInvalid('about.name', stored()!.answers!, stored()!.raw)).toBe(false);
    // A text emptied goes, and so does its answer.
    changeAnswers(shown(), { birthYear: undefined }, { birthYear: '' }, 'about.name');
    await flushAnswers();
    expect(stored()?.raw).toBeUndefined();
    expect(rawWithQueued(stored()?.raw)).toEqual({});
  });

  it('a number typed for a question that no longer shows holds nothing: metformin unticked, or the other units chosen (H5-27)', () => {
    const typed = { metforminSince: '20' };
    expect(rawInvalid('medicines.which', { classes: { ...NO_CLASSES, metformin: 'yes' } }, typed)).toBe(true);
    expect(rawInvalid('medicines.which', { classes: { ...NO_CLASSES } }, typed)).toBe(false);
    expect(rawInvalid('about.body', { metric: true }, { heightCm: '1' })).toBe(true);
    expect(rawInvalid('about.body', { metric: false }, { heightCm: '1' })).toBe(false);
    // A number on another page holds this one in nothing.
    expect(rawInvalid('about.body', { metric: true }, { birthYear: '195' })).toBe(false);
  });

  it('a refused write says so, keeps what’s waiting until it’s stored, and Try again stores it (H5R-16)', async () => {
    const on = { refuse: false };
    await store.start({ factory: refusing(on) });
    on.refuse = true;
    changeAnswers({}, { name: 'Kai' }, {}, 'about.name');
    expect(await flushAnswers()).toBe('failed');
    expect(answersQueue().refused).toBeDefined();
    expect(shown().name).toBe('Kai');
    // Back, refused too: the change still waits, with the page to resume on.
    expect(await flushAnswers('welcome.start')).toBe('failed');
    on.refuse = false;
    expect(await flushAnswers()).toBe('saved');
    expect(answersQueue().refused).toBeUndefined();
    expect(stored()?.answers?.name).toBe('Kai');
  });

  it('Continue without saving takes what’s waiting into this session (H5R-16, B-07)', async () => {
    const on = { refuse: false };
    await store.start({ factory: refusing(on) });
    expect((await store.update(d => withDraft(d, 'health.bp', MINIMAL))).ok).toBe(true);
    on.refuse = true;
    changeAnswers(shown(), { bpMedicine: 'unsure' }, {}, 'health.bp');
    expect(await flushAnswers()).toBe('failed');
    continueUnsaved('health.bp', stored()!.answers!, stored()?.raw);
    expect(getSetupSession()).toMatchObject({ unsaved: true, at: 'health.bp', answers: { ...MINIMAL, bpMedicine: 'unsure' } });
    expect(answersQueue().refused).toBeUndefined();
    expect(withQueued({})).toEqual({});
  });

  it('Look around first keeps every answer, numbers as typed included, and stores what’s waiting before Home opens (H5R-12)', async () => {
    await store.start({ factory: fakeIndexedDB() });
    changeAnswers({}, { name: 'As' }, { birthYear: '195' }, 'about.name');
    expect(await flushAnswers('welcome.start')).toBe('saved');
    changeAnswers(shown(), { figure: 'female' }, {}, 'about.figure');
    expect(await lookAroundFirst()).toBeUndefined();
    expect(store.getState().settings.setup).toMatchObject({ stage: 'lookAround', draft: { answers: { name: 'As', figure: 'female' }, raw: { birthYear: '195' } } });
  });

  it('a correction made here while the answer before it is stored is this copy’s own, and is stored as given', async () => {
    const fake = fakeIndexedDB();
    await store.start({ factory: fake });
    const feet = withC({ diabetes: 'yes', feet: 'yes' }, { feetNumb: 'no', footWound: 'past' });
    expect((await store.update(d => withDraft(d, 'health.feet', feet))).ok).toBe(true);
    changeAnswers(shown(), { footWound: 'unsure' }, {}, 'health.feet');
    fake.control.hold();
    const first = flushAnswers();
    await wait(10);
    // "No" after all, while "Not sure" is on its way.
    changeAnswers(shown(), { footWound: 'no' }, {}, 'health.feet');
    fake.control.release();
    expect(await first).toBe('saved');
    expect(await flushAnswers()).toBe('saved');
    expect(stored()?.answers?.footWound).toBe('no');
    expect(answersQueue().changedElsewhere).toBe(false);
  });

  it('a backup brings its draft’s answers and numbers as typed; an earlier build’s page edits aren’t read (H5R-13)', async () => {
    await store.start({ factory: fakeIndexedDB() });
    const file = backup({ setup: { stage: 'open', draft: { at: 'about.name', answers: { figure: 'female', footWound: 'unsure' }, raw: { birthYear: '195' }, edits: { 'about.name': { name: 'Someone' } } } } });
    expect((await store.importRecord(file, 'replace')).ok).toBe(true);
    expect(stored()).toEqual({ at: 'about.name', answers: { figure: 'female', footWound: 'unsure' }, raw: { birthYear: '195' } });
  });

  it('numbers as typed are read as setup takes them: a key setup lacks, or a text longer than its field, is unreadable by name (H5-18)', async () => {
    const { readSettings } = await import('@/store/importCheck');
    const draft = (raw: unknown) => readSettings({ setup: { stage: 'open', draft: { at: 'about.name', answers: {}, raw } } });
    expect(draft({ birthYear: '195', 'heightCm.ft': '5', customAllergies: 'kiwi, '.repeat(300) }).unreadable).toEqual([]);
    expect(draft({ birthYear: '1'.repeat(13) }).unreadable).toEqual(['settings.setup.draft.raw']);
    expect(draft({ customAllergies: 'k'.repeat(1861) }).unreadable).toEqual(['settings.setup.draft.raw']);
    expect(draft({ name: 'Kai' }).unreadable).toEqual(['settings.setup.draft.raw']);
  });

  it('a change still waiting when a backup replaces the record is never stored in the new one (H5-07)', async () => {
    await store.start({ factory: fakeIndexedDB() });
    changeAnswers({}, { conditions: { diabetes: 'no' } }, {}, 'health.conditions');
    const file = backup({ setup: { stage: 'open', draft: { at: 'about.figure', answers: { figure: 'female' } } } });
    expect((await store.importRecord(file, 'replace')).ok).toBe(true);
    await flushAnswers();
    await wait(AUTOSAVE_MS + 50);
    expect(stored()).toEqual({ at: 'about.figure', answers: { figure: 'female' } });
  });

  it('a change waiting when another copy has finished setup isn’t stored onto it, and says where to check (K5R-04)', async () => {
    const { completedSetup } = await import('./assemble');
    await store.start({ factory: fakeIndexedDB() });
    changeAnswers({}, { footWound: 'now' }, {}, 'health.feet');
    expect((await store.update(d => completedSetup(d, MINIMAL, NOW, { ...CTX, hasSteps: false }))).ok).toBe(true);
    expect(await flushAnswers()).toBe('failed');
    await vi.waitFor(() => expect(toasts).toEqual([FINISHED_ELSEWHERE]));
    expect(store.getState().settings.setup?.answers?.footWound).toBeUndefined();
    expect(withQueued({})).toEqual({});
    expect(answersQueue().refused).toBeUndefined();
  });
});

describe('two copies, each storing only what it changed (H5R-03, H5R-14, K5R-02; board D190)', () => {
  const withAnswers = (answers: SetupAnswers, raw?: Record<string, string>): AppData => {
    const data = fresh();
    data.settings = { ...data.settings, setup: { stage: 'open', draft: { at: 'health.conditions', answers, ...(raw ? { raw } : {}) } } };
    return data;
  };
  const write = (data: AppData, changes: Record<string, [unknown, unknown]>, raw: Record<string, string> = {}) => {
    const kept: string[] = [];
    const next = withFields(data, new Map(Object.entries(changes).map(([f, [baseline, value]]) => [f, { baseline, value }])), new Map(Object.entries(raw)), undefined, kept);
    return { draft: next.settings.setup?.draft, kept };
  };

  it('a checklist row ticked here leaves the row another copy changed: its uncertainty stays (H5R-03, K5R-02)', () => {
    const { draft, kept } = write(withAnswers({ conditions: { ...NO_CONDITIONS, feet: 'unsure' } }), { 'conditions.heart': ['no', 'yes'] });
    expect(draft?.answers?.conditions).toEqual({ ...NO_CONDITIONS, feet: 'unsure', heart: 'yes' });
    expect(kept).toEqual([]);
  });

  it('two fields of one page, one from each copy, both stay; a preference both changed takes this one, the later (H5R-14)', () => {
    expect(write(withAnswers({ name: 'Kai' }), { birthYear: [undefined, 1958] }).draft?.answers).toEqual({ name: 'Kai', birthYear: 1958 });
    expect(write(withAnswers({ name: 'Kai' }), { name: [undefined, 'Asha'] }).draft?.answers).toEqual({ name: 'Asha' });
  });

  it('a Yes, No or Not sure safety answer both changed keeps the earlier in Yes, Not sure, No; any other, the stored one, named (boards D190, D196)', () => {
    const numb = (feetNumb: 'unsure' | 'no' | 'yes') => withAnswers(withC({ diabetes: 'yes', feet: 'yes' }, { feetNumb, footWound: 'no' }));
    // The other copy's "Not sure" stays over this one's "No"; this one's "Yes" goes over its "Not sure".
    expect(write(numb('unsure'), { feetNumb: ['yes', 'no'] })).toMatchObject({ draft: { answers: { feetNumb: 'unsure' } }, kept: ['feetNumb'] });
    expect(write(numb('unsure'), { feetNumb: ['no', 'yes'] })).toMatchObject({ draft: { answers: { feetNumb: 'yes' } }, kept: [] });
    // A wound answer, a clearance, a direction: never chosen between.
    const wound = (footWound: 'past' | 'no') => withAnswers(withC({ diabetes: 'yes', feet: 'yes' }, { feetNumb: 'no', footWound }));
    expect(write(wound('no'), { footWound: ['past', 'now'] })).toMatchObject({ draft: { answers: { footWound: 'no' } }, kept: ['footWound'] });
    const back = (worseWith: 'flexion' | 'extension') => withAnswers(withC({ pain: 'yes' }, { painAreas: ['lowerBack'], worseWith }));
    expect(write(back('flexion'), { worseWith: ['unknown', 'extension'] })).toMatchObject({ draft: { answers: { worseWith: 'flexion' } }, kept: ['worseWith'] });
  });

  it('a number whose answer wasn’t written keeps the stored text, so the page shows the answer kept', () => {
    const data = withAnswers(withC({ bp: 'yes' }, { bpMedicine: 'no', clearance: 'none', targets: 'yes', bpStopSystolic: 160 }), { bpStopSystolic: '160' });
    const { draft, kept } = write(data, { bpStopSystolic: [undefined, 180] }, { bpStopSystolic: '180' });
    expect(draft?.answers?.bpStopSystolic).toBe(160);
    expect(draft?.raw).toEqual({ bpStopSystolic: '160' });
    expect(kept).toEqual(['bpStopSystolic']);
  });

  it('through the store: another copy’s change made while this one’s waits is kept, and this one’s too (K5R-02)', async () => {
    await store.start({ factory: fakeIndexedDB() });
    expect((await store.update(d => withDraft(d, 'health.conditions', { conditions: { ...NO_CONDITIONS } }))).ok).toBe(true);
    changeAnswers(shown(), { conditions: { ...NO_CONDITIONS, heart: 'yes' } }, {}, 'health.conditions');
    // The other copy: feet, Not sure.
    expect((await store.update(d => withDraft(d, 'health.feet', { conditions: { ...NO_CONDITIONS, feet: 'unsure' } }))).ok).toBe(true);
    expect(await flushAnswers()).toBe('saved');
    expect(stored()?.answers?.conditions).toEqual({ ...NO_CONDITIONS, heart: 'yes', feet: 'unsure' });
    expect(answersQueue().changedElsewhere).toBe(false);
  });

  it('through the store: a safety answer the other copy changed too keeps its stricter one, and the page says so', async () => {
    await store.start({ factory: fakeIndexedDB() });
    const feet = withC({ diabetes: 'yes', feet: 'yes' }, { feetNumb: 'no', footWound: 'past' });
    expect((await store.update(d => withDraft(d, 'health.feet', feet))).ok).toBe(true);
    changeAnswers(shown(), { footWound: 'no' }, {}, 'health.feet');
    expect((await store.update(d => withDraft(d, 'health.feet', { ...feet, footWound: 'unsure' }))).ok).toBe(true);
    expect(await flushAnswers()).toBe('saved');
    expect(stored()?.answers?.footWound).toBe('unsure');
    expect(answersQueue().changedElsewhere).toBe(true);
    // The next change here is the person's own again.
    changeAnswers(shown(), { feetNumb: 'yes' }, {}, 'health.feet');
    expect(answersQueue().changedElsewhere).toBe(false);
  });
});

describe('a setup write planned for a record another copy has since replaced (H5R-09, K5R-03; board D191)', () => {
  const replaceElsewhere = async (fake: ReturnType<typeof fakeIndexedDB>) => {
    const { openDb } = await import('@/store/db');
    const { commitChange } = await import('@/store/snapshot');
    const tab = await openDb(fake);
    expect((await commitChange(tab, undefined, () => ({ change: { reset: true, schemaVersion: 6, settings: { replace: { ...fresh().settings, setup: { stage: 'open', draft: { at: 'about.figure', answers: { figure: 'female' } } } } } } }))).ok).toBe(true);
    tab.close();
  };

  it('a Next is refused inside its transaction, and nothing of the old record’s page reaches the new one', async () => {
    const fake = fakeIndexedDB();
    await store.start({ factory: fake });
    const generation = store.getState().epoch;
    changeAnswers({}, { conditions: { ...NO_CONDITIONS } }, {}, 'health.conditions');
    await replaceElsewhere(fake);
    expect((await nextFrom('health.conditions', CTX, false, generation)).outcome).toBe('failed');
    // Refused for that, this copy takes the new record by itself, so its screens move on.
    for (let i = 0; i < 50 && store.getState().epoch === generation; i++) await wait(5);
    expect(store.getState().epoch).toBe(generation + 1);
    expect(stored()).toEqual({ at: 'about.figure', answers: { figure: 'female' } });
    expect(withQueued({})).toEqual({});
  });

  it('finishing onto a record with no draft at all is refused too', async () => {
    const { openDb } = await import('@/store/db');
    const { commitChange } = await import('@/store/snapshot');
    const fake = fakeIndexedDB();
    await store.start({ factory: fake });
    const generation = store.getState().epoch;
    const tab = await openDb(fake);
    expect((await commitChange(tab, undefined, () => ({ change: { reset: true, schemaVersion: 6 } }))).ok).toBe(true);
    tab.close();
    expect((await finishSetup(MINIMAL, CTX, NOW, generation)).kind).toBe('failed');
    expect((await store.reload()).ok).toBe(true);
    expect(store.getState().profile).toBeUndefined();
  });

  it('so are Back’s and Close’s, Look around first’s and finishing’s', async () => {
    const fake = fakeIndexedDB();
    await store.start({ factory: fake });
    const generation = store.getState().epoch;
    changeAnswers({}, { name: 'Old' }, {}, 'about.name');
    await replaceElsewhere(fake);
    expect(await flushAnswers('welcome.start')).toBe('failed');
    expect(await lookAroundFirst(generation)).toBeDefined();
    expect((await finishSetup(MINIMAL, CTX, NOW, generation)).kind).toBe('failed');
    expect((await store.reload()).ok).toBe(true);
    expect(store.getState().settings.setup).toMatchObject({ stage: 'open', draft: { at: 'about.figure', answers: { figure: 'female' } } });
  });
});
