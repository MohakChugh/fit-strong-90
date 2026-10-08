import { describe, it, expect, beforeEach } from 'vitest';
import type { CheckInRecord, Readiness } from '@/types/checkin';
import type { WorkoutSession } from '@/types';
import { dayOf, nowAt } from '@/health/observation';
import { entryFor, isOrphanedReading, pairBloodPressure, summariseDay } from '@/health/aggregate';
import { fakeIndexedDB } from './fakeIdb';
import { decode } from './transfer';

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null,
  setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k),
  clear: () => local.clear(),
  key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;

const store = await import('./useStore');

const readiness: Readiness = {
  outcome: 'green', modifiers: [], back: 'green', nerveFlag: false, reasons: [], actions: [],
  vigorousLocked: false, capHeavy: false, rpeOnly: true, notices: [],
};

const session: WorkoutSession = {
  id: 'session-1', date: '2026-10-01', dayOfWeek: 'thursday', muscleGroup: 'lower', phase: 'foundation',
  week: 1, status: 'completed', sets: [], startedAt: null, completedAt: null, notes: '', totalVolume: 0,
};

async function booted(options: Parameters<typeof fakeIndexedDB>[0] = {}) {
  const fake = fakeIndexedDB(options);
  await store.start({ factory: fake, broadcast: null });
  return fake;
}

beforeEach(() => {
  local.clear();
  store.resetForTests();
});

describe('only what the app reaches (C2-10)', () => {
  it('has one way to save a check-in, through update, and no retry the app never calls', () => {
    expect(Object.keys(store)).not.toContain('putCheckIn');
    expect(Object.keys(store)).not.toContain('retry');
  });
});

describe('start', () => {
  it('shows the record without waiting for the answer to keeping it, and says when it comes (C2-09)', async () => {
    let answer: (kept: boolean) => void = () => {};
    const navigator = { storage: { persisted: async () => false, persist: () => new Promise<boolean>(resolve => { answer = resolve; }) } } as unknown as Navigator;
    await store.start({ factory: fakeIndexedDB(), broadcast: null, navigator });
    // The browser is still asking the person; the record is on screen regardless.
    expect(store.getState().status).toBe('ready');
    expect(store.getState().persisted).toBe(false);
    answer(true);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(store.getState().persisted).toBe(true);
  });

  it('reads the device and reports ready', async () => {
    await booted();
    const state = store.getState();
    expect(state.status).toBe('ready');
    expect(state.observations).toEqual([]);
    expect(state.settings.defaultRestSeconds).toBe(90);
    expect(state.migration?.from).toBe(0);
  });

  it('does the work once however many components ask', async () => {
    const factory = fakeIndexedDB();
    const [a, b] = [store.start({ factory }), store.start({ factory })];
    await Promise.all([a, b]);
    expect(a).toBe(b);
    expect(store.getState().status).toBe('ready');
  });

  it('migrates the v4 blob on the way in', async () => {
    local.set('fit-strong-90-data', JSON.stringify({
      version: 4,
      settings: { onboardingComplete: true, currentWeight: 82, useMetric: true },
      sessions: [session],
      bodyMetrics: [{ date: '2026-10-01', weight: 82, waist: 96, notes: '' }],
      personalRecords: [],
      checkIns: [{ ...readinessCheckIn('2026-10-01'), glucose: { value: 132, unit: 'mg/dL' } }],
    }));
    await booted();
    const state = store.getState();
    expect(state.sessions.map(s => s.id)).toEqual(['session-1']);
    expect(state.observations.map(o => [o.kind, o.value])).toEqual([
      ['glucose', 132],
      ['weight', 82],
      ['waist', 96],
    ]);
    expect(state.migration?.from).toBe(4);
  });

  it('says so, rather than crashing, when the browser will not store anything', async () => {
    await store.start({ factory: undefined });
    expect(store.getState().status).toBe('unavailable');
    expect(store.getState().failure?.code).toBe('unavailable');
  });

  it('refuses to write when there is nowhere to write to', async () => {
    await store.start({ factory: undefined });
    const result = await store.addObservation({ kind: 'water', value: 250, scope: 'dayTotal', source: 'manual' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('unavailable');
  });
});

// The bug this module exists to fix: two components held two copies of the
// data, so clearing it left one of them showing a user who no longer existed.
describe('one store, every subscriber', () => {
  it('publishes a change to every listener', async () => {
    await booted();
    const seen: number[] = [];
    const off = [
      store.subscribe(() => seen.push(1)),
      store.subscribe(() => seen.push(2)),
      store.subscribe(() => seen.push(3)),
    ];
    await store.addObservation({ kind: 'water', value: 250, scope: 'dayTotal', source: 'manual' });
    // Told twice — when the change is made, and when it is confirmed stored
    // (\`saving\` flips back) — every listener each time, in order.
    expect(seen.length).toBeGreaterThan(0);
    for (let i = 0; i < seen.length; i += 3) expect(seen.slice(i, i + 3)).toEqual([1, 2, 3]);
    for (const stop of off) stop();
  });

  it('hands every subscriber the same object, with a new identity on change', async () => {
    await booted();
    const before = store.getState();
    expect(store.getState()).toBe(before);

    let afterInListener: ReturnType<typeof store.getState> | undefined;
    const off = store.subscribe(() => { afterInListener = store.getState(); });
    await store.addObservation({ kind: 'water', value: 250, scope: 'dayTotal', source: 'manual' });
    off();

    expect(afterInListener).toBe(store.getState());
    expect(store.getState()).not.toBe(before);
    expect(before.observations).toEqual([]); // the old snapshot is not mutated
  });

  it('stops notifying a listener that has unsubscribed', async () => {
    await booted();
    let calls = 0;
    const off = store.subscribe(() => { calls += 1; });
    await store.addObservation({ kind: 'water', value: 250, scope: 'dayTotal', source: 'manual' });
    off();
    const heard = calls;
    await store.addObservation({ kind: 'water', value: 500, scope: 'dayTotal', source: 'manual' });
    expect(heard).toBeGreaterThan(0);
    expect(calls).toBe(heard);
  });

  it('survives a listener that unsubscribes while being notified', async () => {
    await booted();
    let once = 0;
    let others = 0;
    const off = store.subscribe(() => { once += 1; off(); });
    const other = store.subscribe(() => { others += 1; });
    await store.addObservation({ kind: 'water', value: 250, scope: 'dayTotal', source: 'manual' });
    expect(once).toBe(1);
    expect(others).toBeGreaterThan(0);
    other();
  });

  it('clears everything and tells every subscriber', async () => {
    local.set('fit-strong-90-guided', '{"plan":"in progress"}');
    await booted();
    await store.addObservation({ kind: 'water', value: 250, scope: 'dayTotal', source: 'manual' });
    await store.putSession(session);
    await store.setProfile({ weightKg: 82 } as never);

    let notified = false;
    const off = store.subscribe(() => { notified = true; });
    expect((await store.clearAll()).ok).toBe(true);
    off();

    expect(notified).toBe(true);
    const state = store.getState();
    expect(state.observations).toEqual([]);
    expect(state.sessions).toEqual([]);
    expect(state.profile).toBeUndefined();
    expect(state.status).toBe('ready');
    // The in-progress session quotes the user's readings; it has to go too.
    expect([...local.keys()]).toEqual([]);
  });
});

describe('writing observations', () => {
  it('adds, edits and removes', async () => {
    await booted();
    const added = await store.addObservation({
      kind: 'glucose', value: 132, scope: 'pointInTime', source: 'manual', at: '2026-10-08T07:30:00+05:30',
    });
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(store.getState().observations).toEqual([added.value]);

    const edited = await store.editObservation(added.value.id, { value: 140, note: 'Re-tested.' });
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.value.value).toBe(140);
    expect(edited.value.note).toBe('Re-tested.');
    expect(edited.value.at).toBe('2026-10-08T07:30:00+05:30');
    expect(edited.value.editedAt).toBeDefined();
    expect(store.getState().observations).toEqual([edited.value]);

    expect((await store.removeObservation(added.value.id)).ok).toBe(true);
    expect(store.getState().observations).toEqual([]);
  });

  it('refuses an impossible record without touching the device', async () => {
    await booted();
    const result = await store.addObservation({ kind: 'glucose', value: -1, scope: 'pointInTime', source: 'manual' });
    expect(result.ok).toBe(false);
    expect(store.getState().observations).toEqual([]);
    expect(store.getState().failure).toBeDefined();
  });

  it('will not edit a record that is no longer there', async () => {
    await booted();
    const result = await store.editObservation('gone', { value: 1 });
    expect(result.ok).toBe(false);
  });

  // The quota is on one store: a full device that also refused the start would
  // put the store in memory mode, which is a different test.
  it('surfaces a full device on the state for the UI to show', async () => {
    await booted({ quotaAfter: 0, quotaStore: 'observations' });
    const result = await store.addObservation({ kind: 'water', value: 250, scope: 'dayTotal', source: 'manual' });
    expect(result.ok).toBe(false);
    expect(store.getState().failure?.code).toBe('quotaExceeded');
    expect(store.getState().observations).toEqual([]);

    // And the next write that works clears it.
    await booted();
  });

  it('clears a stale failure once a write succeeds', async () => {
    await booted();
    await store.addObservation({ kind: 'glucose', value: -1, scope: 'pointInTime', source: 'manual' });
    expect(store.getState().failure).toBeDefined();
    await store.addObservation({ kind: 'glucose', value: 110, scope: 'pointInTime', source: 'manual' });
    expect(store.getState().failure).toBeUndefined();
  });
});

describe('addToDayTotal', () => {
  it('grows the day total by replacing it, never by adding a second one', async () => {
    await booted();
    const day = dayOf(nowAt());
    await store.addToDayTotal('water', 250);
    const second = await store.addToDayTotal('water', 250);
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.value.value).toBe(500);

    // What matters is the number the screen shows: both statements are kept as
    // history, and the day reads as the later one rather than their sum.
    const totals = store.getState().observations.filter(o => o.kind === 'water');
    expect(totals.map(o => o.value).sort((a, b) => a - b)).toEqual([250, 500]);
    expect(totals.every(o => o.scope === 'dayTotal' && o.day === day)).toBe(true);
    expect(entryFor(summariseDay(day, store.getState().observations), 'water', 'dayTotal')?.total).toBe(500);
  });

  it('counts both of two taps in the same frame', async () => {
    await booted();
    const [a, b] = await Promise.all([store.addToDayTotal('water', 250), store.addToDayTotal('water', 250)]);
    expect([a.ok, b.ok]).toEqual([true, true]);
    if (a.ok && b.ok) expect(Math.max(a.value.value, b.value.value)).toBe(500);
    const day = dayOf(nowAt());
    expect(entryFor(summariseDay(day, store.getState().observations), 'water', 'dayTotal')?.total).toBe(500);
  });

  it('starts from zero on a day with nothing recorded', async () => {
    await booted();
    const result = await store.addToDayTotal('water', 250, { day: '2026-01-05' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.value).toBe(250);
      expect(result.value.day).toBe('2026-01-05');
    }
  });

  it("keeps each source's own running total", async () => {
    await booted();
    await store.addToDayTotal('steps', 4000, { source: 'manual' });
    const imported = await store.addToDayTotal('steps', 7800, { source: 'imported' });
    if (imported.ok) expect(imported.value.value).toBe(7800);
  });
});

describe('the documents v4 carried', () => {
  it('keeps settings, profile, records, metrics and overrides', async () => {
    await booted();
    await store.setSettings({ theme: 'dark' });
    await store.setProfile({ weightKg: 82, version: 1 } as never);
    await store.putPersonalRecord({ exerciseId: 'goblet-squat', weight: 24, reps: 10, date: '2026-10-01', volume: 240 });
    await store.putBodyMetric({ date: '2026-10-01', weight: 82, waist: 96, notes: '' });
    await store.setFocusOverride('2026-10-08', 'activeRecovery');

    const state = store.getState();
    expect(state.settings.theme).toBe('dark');
    expect(state.profile?.weightKg).toBe(82);
    expect(state.personalRecords).toHaveLength(1);
    expect(state.bodyMetrics).toHaveLength(1);
    expect(state.focusOverrides).toEqual({ '2026-10-08': 'activeRecovery' });

    await store.setFocusOverride('2026-10-08', undefined);
    expect(store.getState().focusOverrides).toEqual({});

    // Everything survives a reload from the device.
    const before = store.getState();
    expect((await store.reload()).ok).toBe(true);
    expect(store.getState().settings).toEqual(before.settings);
    expect(store.getState().profile).toEqual(before.profile);
    expect(store.getState().personalRecords).toEqual(before.personalRecords);
    expect(store.getState().bodyMetrics).toEqual(before.bodyMetrics);
  });

  // Both writers build `{ ...settings, patch }`. If either built its value
  // before the other had landed, the later write would undo the earlier one.
  it('does not let two writers to the same document undo each other', async () => {
    await booted();
    const first = store.setSettings({ theme: 'dark' });
    const second = store.setSettings({ startDate: '2026-01-01' });
    expect([(await first).ok, (await second).ok]).toEqual([true, true]);
    expect(store.getState().settings).toMatchObject({ theme: 'dark', startDate: '2026-01-01' });
    await store.reload();
    expect(store.getState().settings).toMatchObject({ theme: 'dark', startDate: '2026-01-01' });
  });

  it('replaces a session rather than storing it twice', async () => {
    await booted();
    await store.putSession(session);
    await store.putSession({ ...session, notes: 'Updated.' });
    expect(store.getState().sessions).toHaveLength(1);
    expect(store.getState().sessions[0].notes).toBe('Updated.');

    await store.removeSession(session.id);
    expect(store.getState().sessions).toEqual([]);
  });

  it('lifts a check-in reading straight into the series', async () => {
    await booted();
    const record: CheckInRecord = {
      ...readinessCheckIn('2026-10-08'),
      glucose: { value: 132, unit: 'mg/dL' },
      bp: { sys: 138, dia: 86 },
    };
    expect((await saveCheckIn(record)).ok).toBe(true);
    expect(store.getState().checkIns).toEqual([record]);
    expect(store.getState().observations.map(o => [o.kind, o.value])).toEqual([
      ['glucose', 132],
      ['bloodPressureSystolic', 138],
      ['bloodPressureDiastolic', 86],
    ]);
  });

  // The summary is replaced; a new number is a new reading, because it may be
  // a recheck, and a treated hypo must never be overwritten (review F10).
  it("replaces a day's summary but keeps every reading when it is submitted again", async () => {
    await booted();
    await saveCheckIn({ ...readinessCheckIn('2026-10-08'), glucose: { value: 132, unit: 'mg/dL' } });
    await saveCheckIn({ ...readinessCheckIn('2026-10-08'), glucose: { value: 96, unit: 'mg/dL' } });
    expect(store.getState().checkIns).toHaveLength(1);
    expect(store.getState().checkIns[0].glucose?.value).toBe(96);
    expect(store.getState().observations.map(o => o.value)).toEqual([132, 96]);
  });

  it('corrects the reading in place when told it is a correction', async () => {
    await booted();
    await saveCheckIn({ ...readinessCheckIn('2026-10-08'), glucose: { value: 132, unit: 'mg/dL' } });
    await saveCheckIn({ ...readinessCheckIn('2026-10-08'), glucose: { value: 96, unit: 'mg/dL' } }, { readings: 'correct' });
    const [reading] = store.getState().observations;
    expect(store.getState().observations).toHaveLength(1);
    expect(reading.value).toBe(96);
    expect(reading.editedAt).toBeDefined();
  });
});

/** A check-in saved as the app saves one: through `update`, replacing that day's summary (C2-10). */
const saveCheckIn = (record: CheckInRecord, options: { readings?: 'append' | 'correct' } = {}) =>
  store.update(previous => ({ ...previous, checkIns: [...(previous.checkIns ?? []).filter(c => c.date !== record.date), record] }), options);

function readinessCheckIn(date: string): CheckInRecord {
  return { date, urgentSymptoms: false, news: [], sleep: '5to7', energy: 4, readiness };
}

// The screens that still speak the v4 shape read and write through this.
describe('update, the v4 adapter', () => {
  it('projects the store as AppData, with stable identities between reads', async () => {
    await booted();
    const [data] = [store.projectAppData(store.getState())];
    expect(data.version).toBe(4);
    expect(data.sessions).toEqual([]);
    expect(data.checkIns).toEqual([]);
    expect(data.settings.defaultRestSeconds).toBe(90);
    // Several callers use these arrays as effect dependencies.
    expect(store.projectAppData(store.getState())).toBe(data);
    expect(store.projectAppData(store.getState()).checkIns).toBe(data.checkIns);
  });

  // The hazard: SessionPage saves the finished session and navigates in the
  // same tick, and the check-in flow saves a check-in then opens /session,
  // which builds its plan from this data.
  it('is visible to the next screen in the same tick, before the write lands', async () => {
    await booted();
    const pending = store.update(prev => ({ ...prev, sessions: [...prev.sessions, session] }));
    // No await: this is what a screen mounting immediately after sees.
    expect(store.getState().sessions.map(s => s.id)).toEqual(['session-1']);
    expect(store.projectAppData(store.getState()).sessions).toHaveLength(1);
    expect((await pending).ok).toBe(true);
    expect((await store.getState().sessions)).toHaveLength(1);
  });

  it('persists what it published, so a reload agrees', async () => {
    await booted();
    await store.update(prev => ({
      ...prev,
      sessions: [session],
      settings: { ...prev.settings, theme: 'dark' },
      personalRecords: [{ exerciseId: 'goblet-squat', weight: 24, reps: 10, date: '2026-10-01', volume: 240 }],
      bodyMetrics: [{ date: '2026-10-01', weight: 82, waist: 96, notes: '' }],
      focusOverrides: { '2026-10-08': 'activeRecovery' },
      profile: { weightKg: 82 } as never,
    }));
    const before = store.getState();
    expect((await store.reload()).ok).toBe(true);
    const after = store.getState();
    expect(after.sessions).toEqual(before.sessions);
    expect(after.settings).toEqual(before.settings);
    expect(after.personalRecords).toEqual(before.personalRecords);
    expect(after.bodyMetrics).toEqual(before.bodyMetrics);
    expect(after.focusOverrides).toEqual(before.focusOverrides);
    expect(after.profile).toEqual(before.profile);
  });

  it('writes only what changed', async () => {
    await booted();
    await store.update(prev => ({ ...prev, sessions: [session] }));
    // Settings were untouched, so the settings document was never rewritten.
    expect((await store.reload()).ok).toBe(true);
    expect(store.getState().sessions).toHaveLength(1);
    expect(store.getState().settings.theme).toBe('system');
  });

  it('does nothing at all when the updater changes nothing', async () => {
    await booted();
    let notified = 0;
    const off = store.subscribe(() => { notified += 1; });
    expect((await store.update(prev => prev)).ok).toBe(true);
    expect((await store.update(prev => ({ ...prev }))).ok).toBe(true);
    off();
    expect(notified).toBe(0);
  });

  // WorkoutPage logs a set by replacing the session it is editing, so a change
  // to a session that already exists is the common case, not the edge one.
  it('writes a change to a session that already exists', async () => {
    await booted();
    await store.update(prev => ({ ...prev, sessions: [session] }));
    await store.update(prev => ({
      ...prev,
      sessions: prev.sessions.map(s => (s.id === session.id ? { ...s, notes: 'Second set felt heavy.', totalVolume: 480 } : s)),
    }));
    expect(store.getState().sessions[0]).toMatchObject({ notes: 'Second set felt heavy.', totalVolume: 480 });
    await store.reload();
    expect(store.getState().sessions[0]).toMatchObject({ notes: 'Second set felt heavy.', totalVolume: 480 });
    expect(store.getState().sessions).toHaveLength(1);
  });

  it('removes a session the updater dropped', async () => {
    await booted();
    await store.update(prev => ({ ...prev, sessions: [session] }));
    await store.update(prev => ({ ...prev, sessions: [] }));
    expect(store.getState().sessions).toEqual([]);
    await store.reload();
    expect(store.getState().sessions).toEqual([]);
  });

  it('notices an updater that edits in place, the old localStorage habit', async () => {
    await booted();
    await store.update(prev => {
      prev.sessions.push(session);
      prev.settings.theme = 'dark';
      return prev;
    });
    expect(store.getState().sessions).toHaveLength(1);
    expect(store.getState().settings.theme).toBe('dark');
    await store.reload();
    expect(store.getState().sessions).toHaveLength(1);
    expect(store.getState().settings.theme).toBe('dark');
  });

  it('never lets an updater reach into live state', async () => {
    await booted();
    await store.putSession(session);
    const live = store.getState().sessions[0];
    await store.update(prev => {
      prev.sessions[0].notes = 'scribbled on a copy';
      return { ...prev, sessions: [] };
    });
    expect(live.notes).toBe('');
  });

  it('lifts a check-in written the old way into the series too', async () => {
    await booted();
    const record: CheckInRecord = { ...readinessCheckIn('2026-10-08'), glucose: { value: 132, unit: 'mg/dL' }, bp: { sys: 138, dia: 86 } };
    await store.update(prev => ({ ...prev, checkIns: [...(prev.checkIns ?? []), record] }));
    expect(store.getState().observations.map(o => [o.kind, o.value])).toEqual([
      ['glucose', 132],
      ['bloodPressureSystolic', 138],
      ['bloodPressureDiastolic', 86],
    ]);
    // Saved again unchanged, nothing is recorded twice...
    await store.update(prev => ({ ...prev, checkIns: [{ ...record, energy: 3 }] }));
    expect(store.getState().observations).toHaveLength(3);
    // ...and a new number is a new reading, the earlier one kept (review F10).
    await store.update(prev => ({ ...prev, checkIns: [{ ...record, glucose: { value: 96, unit: 'mg/dL' } }] }));
    expect(store.getState().observations.filter(o => o.kind === 'glucose').map(o => o.value)).toEqual([132, 96]);
  });

  it('composes: the second updater sees the first result', async () => {
    await booted();
    const first = store.update(prev => ({ ...prev, sessions: [session] }));
    const second = store.update(prev => ({ ...prev, sessions: [...prev.sessions, { ...session, id: 'session-2', date: '2026-10-02' }] }));
    expect(store.getState().sessions.map(s => s.id).sort()).toEqual(['session-1', 'session-2']);
    expect([(await first).ok, (await second).ok]).toEqual([true, true]);
    await store.reload();
    expect(store.getState().sessions.map(s => s.id).sort()).toEqual(['session-1', 'session-2']);
  });
});

describe('a write that fails', () => {
  it('takes the optimistic change back out and says why', async () => {
    await booted({ quotaAfter: 0, quotaStore: 'sessions' });
    const pending = store.update(prev => ({ ...prev, sessions: [session] }));
    expect(store.getState().sessions).toHaveLength(1); // shown immediately
    const result = await pending;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('quotaExceeded');
    expect(store.getState().sessions).toEqual([]); // and taken back
    expect(store.getState().failure?.code).toBe('quotaExceeded');
    expect(store.storageNotice()?.tone).toBe('error');
  });

  it('keeps a later change that did work, while undoing the one that did not', async () => {
    // Only the session store is full, so the first write fails and the second
    // — a different slice, queued behind it — succeeds.
    await booted({ quotaAfter: 0, quotaStore: 'sessions' });
    const failing = store.update(prev => ({ ...prev, sessions: [session] }));
    const working = store.update(prev => ({ ...prev, settings: { ...prev.settings, theme: 'dark' } }));
    expect((await failing).ok).toBe(false);
    expect((await working).ok).toBe(true);

    expect(store.getState().sessions).toEqual([]);
    expect(store.getState().settings.theme).toBe('dark');
    expect(store.getState().failure).toBeUndefined();
    await store.reload();
    expect(store.getState().settings.theme).toBe('dark');
  });

  it('leaves nothing behind when two writes fail one after the other', async () => {
    // The second updater was computed from the first's optimistic value, so a
    // naive undo would put the first failure's change back as "what was there
    // before me". The state has to end up as what the device actually holds.
    const fake = await booted({ quotaStore: 'settings' });
    fake.control.setQuota(0);
    const first = store.update(prev => ({ ...prev, settings: { ...prev.settings, startDate: '2026-01-01' } }));
    const second = store.update(prev => ({ ...prev, settings: { ...prev.settings, startDate: '2026-02-02' } }));
    expect([(await first).ok, (await second).ok]).toEqual([false, false]);
    expect(store.getState().settings.startDate).toBe('');
    expect(store.getState().failure).toBeDefined();
  });

  // With no storage at all the app still has to get through today's session;
  // it just cannot promise to remember it.
  it('keeps working in memory when there is nowhere to write, and says so', async () => {
    await store.start({ factory: undefined });
    const result = await store.update(prev => ({ ...prev, sessions: [session] }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('unavailable');
    expect(store.getState().sessions).toHaveLength(1);
    expect(store.storageNotice()?.tone).toBe('warning');
    expect(store.storageNotice()?.title).toMatch(/nothing is being saved/i);
  });
});

describe('the theme, which cannot wait for IndexedDB', () => {
  it('is readable synchronously, before anything is open', () => {
    expect(store.readStoredTheme()).toBeUndefined();
    store.writeStoredTheme('dark');
    expect(store.readStoredTheme()).toBe('dark');
    expect(local.get(store.THEME_KEY)).toBe('dark');
  });

  it('ignores a flag that is not a theme', () => {
    local.set(store.THEME_KEY, 'octarine');
    expect(store.readStoredTheme()).toBeUndefined();
  });

  it('is mirrored out of the store on every boot, for the next first frame', async () => {
    local.set('fit-strong-90-data', JSON.stringify({
      version: 4, settings: { onboardingComplete: true, theme: 'dark' }, sessions: [], bodyMetrics: [], personalRecords: [],
    }));
    await booted();
    expect(store.readStoredTheme()).toBe('dark');
  });

  it('is written whenever the theme changes, through either route', async () => {
    await booted();
    await store.setSettings({ theme: 'light' });
    expect(store.readStoredTheme()).toBe('light');
    await store.update(prev => ({ ...prev, settings: { ...prev.settings, theme: 'dark' } }));
    expect(store.readStoredTheme()).toBe('dark');
  });

  it('goes back to what the device holds if the write that changed it failed', async () => {
    const fake = await booted({ quotaStore: 'settings' });
    fake.control.setQuota(0);
    store.writeStoredTheme('light');
    const result = await store.update(prev => ({ ...prev, settings: { ...prev.settings, theme: 'dark' } }));
    expect(result.ok).toBe(false);
    expect(store.readStoredTheme()).toBe('system'); // the stored settings' theme
    expect(store.getState().settings.theme).toBe('system');
  });

  it('is cleared with everything else', async () => {
    await booted();
    await store.setSettings({ theme: 'dark' });
    await store.clearAll();
    expect(store.readStoredTheme()).toBeUndefined();
  });
});

describe('blood pressure, one reading at a time', () => {
  it('stores both halves together, paired', async () => {
    await booted();
    const result = await store.putBloodPressure({ systolic: 138, diastolic: 86, tag: 'morning', at: '2026-10-08T07:15:00.000+05:30' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({ systolic: 138, diastolic: 86, tag: 'morning', day: '2026-10-08' });

    const readings = pairBloodPressure(store.getState().observations);
    expect(readings).toHaveLength(1);
    expect(isOrphanedReading(readings[0])).toBe(false);
    await store.reload();
    expect(pairBloodPressure(store.getState().observations)).toEqual(readings);
  });

  it('writes neither half when the device is full', async () => {
    await booted({ quotaAfter: 1, quotaStore: 'observations' });
    const result = await store.putBloodPressure({ systolic: 138, diastolic: 86 });
    expect(result.ok).toBe(false);
    expect(store.getState().observations).toEqual([]);
  });

  it('refuses an impossible reading without storing half of it', async () => {
    await booted();
    const result = await store.putBloodPressure({ systolic: 138, diastolic: -1 });
    expect(result.ok).toBe(false);
    expect(store.getState().observations).toEqual([]);
  });

  it('deletes a reading whole, never leaving a lone systolic', async () => {
    await booted();
    const added = await store.putBloodPressure({ systolic: 138, diastolic: 86 });
    if (!added.ok) return expect.unreachable('putBloodPressure failed');

    expect((await store.removeReading(added.value.id)).ok).toBe(true);
    expect(store.getState().observations).toEqual([]);
    await store.reload();
    expect(store.getState().observations).toEqual([]);
  });

  it('leaves other readings alone, and says when there is nothing to delete', async () => {
    await booted();
    const first = await store.putBloodPressure({ systolic: 138, diastolic: 86, at: '2026-10-08T07:15:00.000+05:30' });
    await store.putBloodPressure({ systolic: 126, diastolic: 78, at: '2026-10-08T21:40:00.000+05:30' });
    if (!first.ok) return expect.unreachable('putBloodPressure failed');

    await store.removeReading(first.value.id);
    const left = pairBloodPressure(store.getState().observations);
    expect(left.map(r => [r.systolic, r.diastolic])).toEqual([[126, 78]]);

    expect((await store.removeReading('never-existed')).ok).toBe(false);
  });

  it('corrects a reading in place when given its id', async () => {
    await booted();
    const added = await store.putBloodPressure({ systolic: 138, diastolic: 86, at: '2026-10-08T07:15:00.000+05:30' });
    if (!added.ok) return expect.unreachable('putBloodPressure failed');

    await store.putBloodPressure({ systolic: 142, diastolic: 88, at: '2026-10-08T07:15:00.000+05:30', readingId: added.value.id });
    const readings = pairBloodPressure(store.getState().observations);
    expect(readings.map(r => [r.systolic, r.diastolic])).toEqual([[142, 88]]);
    expect(store.getState().observations).toHaveLength(2);
  });
});

describe('export and import, the only way out and back in (D17)', () => {
  it('exports the whole record as a file', async () => {
    await booted();
    await store.putSession(session);
    await store.addObservation({ kind: 'glucose', value: 132, scope: 'pointInTime', source: 'manual', at: '2026-10-08T07:30:00+05:30' });

    const exported = await store.exportRecord();
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    expect(exported.value.gzip).toBe(true);
    expect(exported.value.name).toMatch(/\.json\.gz$/);

    const decoded = await decode(exported.value.bytes) as { sessions: unknown[]; observations: unknown[] };
    expect(decoded.sessions).toHaveLength(1);
    expect(decoded.observations).toHaveLength(1);
  });

  it('imports a file and publishes what the device then holds', async () => {
    await booted();
    await store.putSession(session);
    const exported = await store.exportRecord();
    if (!exported.ok) return expect.unreachable('export failed');
    const file = await decode(exported.value.bytes);

    await store.clearAll();
    expect(store.getState().sessions).toEqual([]);

    const imported = await store.importRecord(file, 'replace');
    expect(imported.ok).toBe(true);
    if (imported.ok) expect(imported.value.sessions).toBe(1);
    expect(store.getState().sessions.map(s => s.id)).toEqual(['session-1']);
  });

  it('refuses a file it does not understand, and says so on the state', async () => {
    await booted();
    const result = await store.importRecord({ format: 'something-else' }, 'merge');
    expect(result.ok).toBe(false);
    expect(store.getState().failure).toBeDefined();
  });

  // While nothing can be saved, exporting is the one way left to keep what
  // this session holds; importing cannot be saved and says so.
  it('exports what this session holds when nothing can be saved, and refuses to import', async () => {
    await store.start({ factory: undefined, broadcast: null });
    await store.putSession(session);
    const exported = await store.exportRecord();
    expect(exported.ok).toBe(true);
    if (exported.ok) expect((await decode(exported.value.bytes) as { sessions: unknown[] }).sessions).toHaveLength(1);
    expect((await store.importRecord({}, 'merge')).ok).toBe(false);
  });

  // The old `resetAndRestart` swept localStorage and reloaded, which would now
  // bring the whole IndexedDB record straight back.
  it('clears the device before restarting onto onboarding', async () => {
    await booted();
    await store.putSession(session);
    local.set('fit-strong-90-guided', '{"plan":"in progress"}');

    const calls: string[] = [];
    const result = await store.clearAllAndRestart({
      replace: url => void calls.push(`replace ${String(url)}`),
      reload: () => void calls.push(`reload with ${store.getState().sessions.length} sessions`),
    });

    expect(result.ok).toBe(true);
    expect(calls).toEqual(['replace #/onboarding', 'reload with 0 sessions']);
    expect([...local.keys()]).toEqual([]);
    await store.reload();
    expect(store.getState().sessions).toEqual([]);
  });

  it('while nothing can be saved, deletes nothing, says so truly, and does not restart (C2-08)', async () => {
    await booted({ openFails: 'error' });
    expect(store.getState().status).toBe('unavailable');
    await store.setSettings({ onboardingComplete: true });
    local.set('fit-strong-90-guided', '{"plan":"in progress"}');
    local.set('fit-strong-90-theme', 'dark');

    const calls: string[] = [];
    let before = 0;
    const result = await store.clearAllAndRestart(
      { replace: url => void calls.push(String(url)), reload: () => void calls.push('reload') },
      () => { before += 1; },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.message).toMatch(/cannot reach this device.s storage/i);
    // What it says is what it did: nothing.
    expect([...local.keys()].sort()).toEqual(['fit-strong-90-guided', 'fit-strong-90-theme']);
    expect(store.getState().settings.onboardingComplete).toBe(true);
    expect(calls).toEqual([]);
    expect(before).toBe(0);
  });

  it('tidies up just before restarting, only once the record is deleted', async () => {
    await booted();
    const order: string[] = [];
    await store.clearAllAndRestart(
      { replace: () => void order.push('replace'), reload: () => void order.push('reload') },
      () => { order.push(`before, with ${store.getState().sessions.length} sessions`); },
    );
    expect(order).toEqual(['before, with 0 sessions', 'replace', 'reload']);
  });

  it('does not restart if the device could not be cleared', async () => {
    await booted({ writeError: () => new DOMException('no', 'UnknownError') });
    const calls: string[] = [];
    const result = await store.clearAllAndRestart({
      replace: url => void calls.push(String(url)),
      reload: () => void calls.push('reload'),
    });
    expect(result.ok).toBe(false);
    expect(calls).toEqual([]);
  });
});
