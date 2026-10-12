import { describe, expect, it, vi } from 'vitest';
import type { WorkoutSession } from '@/types';
import type { CheckInRecord, DailyCheckIn, Readiness } from '@/types/checkin';
import { pairBloodPressure } from '@/health/aggregate';
import { checkInDayOf, type Observation } from '@/health/observation';
import { typedWrongly } from '@/test/held';
import { fakeIndexedDB } from './fakeIdb';

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

const readiness: Readiness = {
  outcome: 'green', modifiers: [], back: 'green', nerveFlag: false, reasons: [], actions: [],
  vigorousLocked: false, capHeavy: false, rpeOnly: true, notices: [],
};

const DAY = '2026-10-07';
const checkIn = (glucose: number, at: string, sys: number, dia: number): CheckInRecord => ({
  date: DAY, urgentSymptoms: false, news: [], sleep: '5to7', energy: 4, readiness,
  glucose: { value: glucose, unit: 'mg/dL', measuredAt: at },
  bpReadings: [{ sys, dia, at }], bp: { sys, dia },
});

/** A check-in saved as the app saves one: through `update`, replacing that day's summary. */
const saveCheckIn = (store: { update: typeof import('./useStore').update }, record: CheckInRecord) =>
  store.update(previous => ({ ...previous, checkIns: [...(previous.checkIns ?? []).filter(c => c.date !== record.date), record] }));

/** A separate copy of the app on its own device: its own store and its own database. */
async function device() {
  vi.resetModules();
  const store = await import('./useStore');
  const { decode } = await import('./transfer');
  store.resetForTests();
  await store.start({ factory: fakeIndexedDB(), broadcast: null });
  const backup = async () => {
    const exported = await store.exportRecord();
    if (!exported.ok) throw exported.failure;
    return decode(exported.value.bytes.buffer as ArrayBuffer);
  };
  const pending = await import('@/components/checkin/pending');
  const { createDefaultProfile } = await import('@/profile/defaults');
  /**
   * A typo gone the way the person can make it go (board D119): a reading still holding movement is refused,
   * "It was a mistake" answers it, and the same change goes through.
   */
  const mistaken = <R>(change: () => Promise<R>) => typedWrongly(change, held =>
    pending.answerMistakes(held, { profile: store.getState().profile ?? createDefaultProfile({ needsHealthReview: true }), update: store.update }));
  return { store, backup, mistaken };
}

const glucose = (os: readonly Observation[]) => os.filter(o => o.kind === 'glucose').map(o => [o.value, o.at.slice(11, 16)]).sort();
const pressures = (os: readonly Observation[]) => pairBloodPressure(os).map(r => [r.systolic, r.diastolic, r.at.slice(11, 16)]).sort();

describe('two devices each with a check-in the same day (D-02)', () => {
  it('give their readings ids that cannot collide', async () => {
    const b = await device();
    await saveCheckIn(b.store, checkIn(160, `${DAY}T18:30:00.000+05:30`, 150, 95));
    const ofB = b.store.getState().observations.map(o => o.id);
    const a = await device();
    await saveCheckIn(a.store, checkIn(62, `${DAY}T08:30:00.000+05:30`, 124, 78));
    const ofA = a.store.getState().observations.map(o => o.id);
    expect(ofA).toHaveLength(3);
    expect(ofA.filter(id => ofB.includes(id))).toEqual([]);
    // Still filed under that day's check-in.
    expect(a.store.getState().observations.every(o => checkInDayOf(o) === DAY)).toBe(true);
  });

  it('even when both save in the same millisecond', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date(`${DAY}T20:00:00.000+05:30`));
      const b = await device();
      await saveCheckIn(b.store, checkIn(160, `${DAY}T18:30:00.000+05:30`, 150, 95));
      const a = await device();
      await saveCheckIn(a.store, checkIn(62, `${DAY}T08:30:00.000+05:30`, 124, 78));
      const ofB = new Set(b.store.getState().observations.map(o => o.id));
      expect(a.store.getState().observations.filter(o => ofB.has(o.id))).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a merge keeps both devices’ readings, and the preview does not call them already here', async () => {
    const b = await device();
    await saveCheckIn(b.store, checkIn(160, `${DAY}T18:30:00.000+05:30`, 150, 95));
    const file = await b.backup();
    const a = await device();
    await saveCheckIn(a.store, checkIn(62, `${DAY}T08:30:00.000+05:30`, 124, 78));

    const preview = a.store.previewRecord(file);
    if (!preview.ok) throw new Error(preview.reason);
    expect(preview.alreadyHere).toBe(0);
    expect(preview.conflicts?.observations).toBe(0);

    expect((await a.store.importRecord(file, 'merge')).ok).toBe(true);
    const after = a.store.getState().observations;
    expect(glucose(after)).toEqual([[160, '18:30'], [62, '08:30']]);
    expect(pressures(after)).toEqual([[124, 78, '08:30'], [150, 95, '18:30']]);
  });
});

describe('a correction made on one device, merged into another (R5-02)', () => {
  it('replaces the older copy, even when it corrects the time', async () => {
    const a = await device();
    await saveCheckIn(a.store, checkIn(62, `${DAY}T08:30:00.000+05:30`, 124, 78));
    const b = await device();
    expect((await b.store.importRecord(await a.backup(), 'replace')).ok).toBe(true);

    const reading = a.store.getState().observations.find(o => o.kind === 'glucose')!;
    expect((await a.store.editObservation(reading.id, { at: `${DAY}T09:00:00.000+05:30` })).ok).toBe(true);
    expect((await b.store.importRecord(await a.backup(), 'merge')).ok).toBe(true);
    expect(glucose(b.store.getState().observations)).toEqual([[62, '09:00']]);

    // A reading named by its device is one reading wherever it is: even a
    // correction of both its number and its time replaces the older copy.
    expect((await a.store.editObservation(reading.id, { value: 64, at: `${DAY}T09:15:00.000+05:30` })).ok).toBe(true);
    expect((await b.store.importRecord(await a.backup(), 'merge')).ok).toBe(true);
    expect(glucose(b.store.getState().observations)).toEqual([[64, '09:15']]);
  });

  it('replaces it under a shared old-style id too, when the correction changed only the time or only the number', async () => {
    const at = (time: string) => `${DAY}T${time}:00.000+05:30`;
    const old = { id: `checkIn:${DAY}:glucose`, kind: 'glucose', at: at('08:30'), day: DAY, value: 62, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', context: `checkIn:${DAY}` } as Observation;
    const file = async (o: Observation) => {
      const { TRANSFER_FORMAT } = await import('./transfer');
      return { format: TRANSFER_FORMAT, version: 1, exportedAt: at('20:00'), schemaVersion: 5, observations: [o], sessions: [], checkIns: [], personalRecords: [], bodyMetrics: [], focusOverrides: {}, contentState: [] };
    };
    for (const corrected of [{ ...old, at: at('09:00'), editedAt: at('10:00') }, { ...old, value: 65, editedAt: at('10:00') }]) {
      const b = await device();
      await b.store.importRecord(await file(old), 'replace');
      expect((await b.store.importRecord(await file(corrected), 'merge')).ok).toBe(true);
      expect(glucose(b.store.getState().observations)).toEqual([[corrected.value, corrected.at.slice(11, 16)]]);
    }
  });

  it('a device whose name happens to be all digits is a device, not an old shared number', async () => {
    const at = (time: string) => `${DAY}T${time}:00.000+05:30`;
    const { TRANSFER_FORMAT } = await import('./transfer');
    const file = (o: Observation) => ({ format: TRANSFER_FORMAT, version: 1, exportedAt: at('20:00'), schemaVersion: 5, observations: [o], sessions: [], checkIns: [], personalRecords: [], bodyMetrics: [], focusOverrides: {}, contentState: [] });
    const reading = (event: string) => ({ id: `${event}:glucose`, kind: 'glucose', at: at('08:30'), day: DAY, value: 62, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', context: `checkIn:${DAY}` }) as Observation;
    // A copy of the app is named by ten hex digits, and about one in a hundred gets decimal ones only.
    const cases: [string, (string | number)[][]][] = [
      [`checkIn:${DAY}#0123456789`, [[64, '09:15']]],
      [`checkIn:${DAY}#12345678901`, [[64, '09:15']]],
      // Numbered per day, as before D-02: two devices' readings under one id.
      [`checkIn:${DAY}#1`, [[62, '08:30'], [64, '09:15']]],
      [`checkIn:${DAY}#12`, [[62, '08:30'], [64, '09:15']]],
    ];
    for (const [event, held] of cases) {
      const b = await device();
      const mine = reading(event);
      await b.store.importRecord(file(mine), 'replace');
      expect((await b.store.importRecord(file({ ...mine, value: 64, at: at('09:15'), editedAt: at('10:00') }), 'merge')).ok).toBe(true);
      expect(glucose(b.store.getState().observations)).toEqual(held);
    }
    // And deleted, it is remembered by its id, as any device's reading is.
    const b = await device();
    const mine = reading(`checkIn:${DAY}#0123456789`);
    await b.store.setSettings({ deleted: { observations: [mine.id] } });
    expect((await b.store.importRecord(file(mine), 'merge')).ok).toBe(true);
    expect(glucose(b.store.getState().observations)).toEqual([]);
  });
});

describe('readings that share an id from before ids were unique (D-02)', () => {
  /** A file as an older version exported it: the day's first check-in reading named `checkIn:<day>:<kind>`. */
  const legacy = (value: number, time: string, sys: number, dia: number) => {
    const at = `${DAY}T${time}:00.000+05:30`;
    const base = { at, day: DAY, scope: 'pointInTime', source: 'manual' } as const;
    return [
      { ...base, id: `checkIn:${DAY}:glucose`, kind: 'glucose', value, unit: 'mg/dL', context: `checkIn:${DAY}` },
      { ...base, id: `checkIn:${DAY}:bloodPressureSystolic`, kind: 'bloodPressureSystolic', value: sys, unit: 'mmHg', context: `bp:checkIn:${DAY}` },
      { ...base, id: `checkIn:${DAY}:bloodPressureDiastolic`, kind: 'bloodPressureDiastolic', value: dia, unit: 'mmHg', context: `bp:checkIn:${DAY}` },
    ] as Observation[];
  };
  const fileOf = async (observations: Observation[]) => {
    const { TRANSFER_FORMAT } = await import('./transfer');
    return {
      format: TRANSFER_FORMAT, version: 1, exportedAt: `${DAY}T20:00:00.000+05:30`, schemaVersion: 5,
      observations, sessions: [], checkIns: [], personalRecords: [], bodyMetrics: [], focusOverrides: {}, contentState: [],
    };
  };

  it('keeps both readings when they were taken at different times, whichever is later', async () => {
    for (const [mine, theirs] of [[['08:30', 62], ['18:30', 160]], [['18:30', 62], ['08:30', 160]]] as const) {
      const a = await device();
      expect((await a.store.importRecord(await fileOf(legacy(mine[1], mine[0], 124, 78)), 'replace')).ok).toBe(true);
      const file = await fileOf(legacy(theirs[1], theirs[0], 150, 95));
      const preview = a.store.previewRecord(file);
      if (!preview.ok) throw new Error(preview.reason);
      expect(preview.alreadyHere).toBe(0);
      const merged = await a.store.importRecord(file, 'merge');
      expect(merged.ok && merged.value.replacedObservations).toBe(0);
      const after = a.store.getState().observations;
      expect(glucose(after)).toEqual([[160, theirs[0]], [62, mine[0]]].sort());
      expect(pressures(after)).toEqual([[124, 78, mine[0]], [150, 95, theirs[0]]].sort());
      // Every reading still says which day's check-in it came with, and each pair has both halves.
      expect(after.every(o => checkInDayOf(o) === DAY)).toBe(true);
    }
  });

  it('keeps both when two readings stand in at the same time with different numbers', async () => {
    const a = await device();
    await a.store.importRecord(await fileOf(legacy(62, '12:00', 124, 78)), 'replace');
    expect((await a.store.importRecord(await fileOf(legacy(160, '12:00', 124, 95)), 'merge')).ok).toBe(true);
    const after = a.store.getState().observations;
    expect(glucose(after)).toEqual([[160, '12:00'], [62, '12:00']]);
    // The pair is kept whole: 124/95 is not split into a lone 95.
    expect(pressures(after)).toEqual([[124, 78, '12:00'], [124, 95, '12:00']]);
  });

  it('keeps both when one of them was corrected, since they were taken at different times', async () => {
    const a = await device();
    const mine = legacy(62, '08:30', 124, 78).map(o => (o.kind === 'glucose' ? { ...o, value: 64, editedAt: `${DAY}T21:00:00.000+05:30` } : o));
    await a.store.importRecord(await fileOf(mine), 'replace');
    await a.store.importRecord(await fileOf(legacy(160, '18:30', 150, 95)), 'merge');
    expect(glucose(a.store.getState().observations)).toEqual([[160, '18:30'], [64, '08:30']]);
  });

  it('keeps a correction of both the time and the number as a second reading, on purpose (R5-02)', async () => {
    const a = await device();
    await a.store.importRecord(await fileOf(legacy(62, '08:30', 124, 78)), 'replace');
    // The same old reading, corrected on another device in both its number and its time.
    const corrected = legacy(62, '08:30', 124, 78)
      .map(o => (o.kind === 'glucose' ? { ...o, value: 64, at: `${DAY}T09:15:00.000+05:30`, editedAt: `${DAY}T10:00:00.000+05:30` } : o));
    expect((await a.store.importRecord(await fileOf(corrected), 'merge')).ok).toBe(true);
    // Under an id two devices could each have given, it cannot be told from a
    // second reading, so it is kept as one: a reading too many can be deleted,
    // one too few could hide a low.
    expect(glucose(a.store.getState().observations)).toEqual([[62, '08:30'], [64, '09:15']]);
  });

  it('keeps a third device’s reading too', async () => {
    const a = await device();
    await a.store.importRecord(await fileOf(legacy(62, '12:00', 124, 78)), 'replace');
    await a.store.importRecord(await fileOf(legacy(160, '12:00', 150, 95)), 'merge');
    await a.store.importRecord(await fileOf(legacy(98, '12:00', 132, 84)), 'merge');
    await a.store.importRecord(await fileOf(legacy(160, '12:00', 150, 95)), 'merge');
    const after = a.store.getState().observations;
    expect(glucose(after)).toEqual([[160, '12:00'], [62, '12:00'], [98, '12:00']]);
    expect(pressures(after)).toEqual([[124, 78, '12:00'], [132, 84, '12:00'], [150, 95, '12:00']]);
  });

  it('backups passed both ways between two devices settle, with each reading once on each', async () => {
    const a = await device();
    await a.store.importRecord(await fileOf(legacy(62, '08:30', 124, 78)), 'replace');
    const b = await device();
    await b.store.importRecord(await fileOf(legacy(160, '18:30', 150, 95)), 'replace');

    await a.store.importRecord(await b.backup(), 'merge');
    await b.store.importRecord(await a.backup(), 'merge');
    await a.store.importRecord(await b.backup(), 'merge');
    for (const d of [a, b]) {
      const held = d.store.getState().observations;
      expect(glucose(held)).toEqual([[160, '18:30'], [62, '08:30']]);
      expect(pressures(held)).toEqual([[124, 78, '08:30'], [150, 95, '18:30']]);
    }
  });

  it('a reading deleted here does not take another device’s reading under the same old id with it (R5-01)', async () => {
    const a = await device();
    await a.store.importRecord(await fileOf(legacy(62, '08:30', 124, 78)), 'replace');
    const mine = a.store.getState().observations.find(o => o.kind === 'glucose')!;
    expect((await a.store.removeObservation(mine.id)).ok).toBe(true);
    const merged = await a.store.importRecord(await fileOf(legacy(160, '18:30', 150, 95)), 'merge');
    expect(merged.ok).toBe(true);
    expect(glucose(a.store.getState().observations)).toEqual([[160, '18:30']]);
    // And the deleted one stays deleted when this device's own older backup comes back.
    await a.store.importRecord(await fileOf(legacy(62, '08:30', 124, 78)), 'merge');
    expect(glucose(a.store.getState().observations)).toEqual([[160, '18:30']]);
  });

  it('a reading kept under a new name and deleted since comes out of the file’s record too (R5-01)', async () => {
    const { createDefaultProfile } = await import('@/profile/defaults');
    const a = await device();
    const { removeCheckInReading } = await import('@/components/checkin/pending');
    const profile = createDefaultProfile({ weightKg: 80, health: { diabetes: 'type2', metformin: true, medicinesReviewed: true, glucoseMonitor: 'meter' } });
    await a.store.setProfile(profile);
    await a.store.importRecord(await fileOf(legacy(62, '08:30', 124, 78)), 'replace');
    const evening = `${DAY}T18:30:00.000+05:30`;
    const file = { ...(await fileOf(legacy(160, '18:30', 150, 95))), checkIns: [checkIn(160, evening, 150, 95)] };
    expect((await a.store.importRecord(file, 'merge')).ok).toBe(true);
    const theirs = a.store.getState().observations.find(o => o.kind === 'glucose' && o.value === 160)!;
    expect(theirs.id).not.toBe(`checkIn:${DAY}:glucose`);
    const deps = { profile, update: a.store.update, date: DAY };
    expect(await removeCheckInReading({ kind: 'glucose', at: evening, value: 160, unit: 'mg/dL' }, [theirs.id], deps)).toMatchObject({ matched: true, stored: true });

    // The file still names it under the old shared id, which this device's own reading holds.
    expect((await a.store.importRecord(file, 'merge', { onConflict: 'takeFile' })).ok).toBe(true);
    expect(glucose(a.store.getState().observations)).toEqual([[62, '08:30']]);
    expect(a.store.getState().checkIns.find(c => c.date === DAY)?.glucose).toBeUndefined();
  });

  it('adds them once however often the same file is merged', async () => {
    const a = await device();
    await a.store.importRecord(await fileOf(legacy(62, '08:30', 124, 78)), 'replace');
    const file = await fileOf(legacy(160, '18:30', 150, 95));
    await a.store.importRecord(file, 'merge');
    const once = a.store.getState().observations.length;
    await a.store.importRecord(file, 'merge');
    expect(a.store.getState().observations.length).toBe(once);
    const preview = a.store.previewRecord(file);
    expect(preview.ok && preview.alreadyHere).toBe(3);
  });

  it('a correction of the same reading is still a correction: the later statement is kept, not both', async () => {
    const a = await device();
    await a.store.importRecord(await fileOf(legacy(62, '08:30', 124, 78)), 'replace');
    const corrected = legacy(65, '08:30', 124, 78).map(o => (o.kind === 'glucose' ? { ...o, editedAt: `${DAY}T09:00:00.000+05:30` } : o));
    expect((await a.store.importRecord(await fileOf(corrected), 'merge')).ok).toBe(true);
    expect(glucose(a.store.getState().observations)).toEqual([[65, '08:30']]);
  });
});

describe('a guided session saved with the day’s check-in, backed up and restored (N-02)', () => {
  const at = `${DAY}T08:30:00.000+05:30`;
  const track = `${DAY}T09:00:00.000+05:30`;

  /** A session saved as the player saves one, with the check-in the day's screens hold (`useGuided().checkIn`). */
  async function sessionSaved(d: Awaited<ReturnType<typeof device>>, withTrack: boolean, withCheckIn = true) {
    const { createDefaultProfile } = await import('@/profile/defaults');
    const { effectiveCheckIns } = await import('@/components/checkin/pending');
    const { evaluateCheckIn } = await import('@/engine/readiness');
    const { buildSessionPlan } = await import('@/engine/session');
    const { createRunner, initialState } = await import('@/session/runner');
    const { toWorkoutSession, withGuidedSession } = await import('@/session/logging');
    const profile = createDefaultProfile({ weightKg: 80, health: { diabetes: 'type2', metformin: true, medicinesReviewed: true, glucoseMonitor: 'meter' } });
    await d.store.setProfile(profile);
    if (withCheckIn) await saveCheckIn(d.store, checkIn(120, at, 124, 78));
    if (withTrack) {
      const logged = await d.store.addObservation({ kind: 'glucose', value: 140, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: track });
      if (!logged.ok) throw logged.failure;
    }
    const state = d.store.getState();
    const checkIns = effectiveCheckIns(state.checkIns, profile, state.observations);
    const today = checkIns.find(c => c.date === DAY)!;
    const held = { ...today, readiness: evaluateCheckIn(profile, today, checkIns.filter(c => c.date < DAY)) };
    expect(held.logged !== undefined).toBe(withTrack);
    const plan = buildSessionPlan({ profile, date: DAY, startDate: DAY, sessions: [] });
    const runner = createRunner(plan);
    const run = runner.reduce(runner.reduce(initialState(plan), { type: 'start', now: 0 }), { type: 'tick', now: plan.totalSeconds * 1000 + 1 });
    const session = toWorkoutSession(plan, run, { sessionId: 'guided-1', checkIn: held });
    expect((await d.store.update(prev => withGuidedSession(prev, session))).ok).toBe(true);
    return { held, session };
  }

  /** The session's copy of its check-in: what the day said, with Track's reading in it once, and nothing only the screens carry. */
  const kept = (d: Awaited<ReturnType<typeof device>>, withTrack: boolean) => {
    const copy = d.store.getState().sessions.find(s => s.id === 'guided-1')?.checkIn;
    expect(copy).toBeDefined();
    expect(copy!.logged).toBeUndefined();
    expect(copy!.readingsOnly).toBeUndefined();
    expect(copy!.durable).toBeUndefined();
    expect(copy!.glucose).toEqual(withTrack ? expect.objectContaining({ value: 140, measuredAt: track }) : { value: 120, unit: 'mg/dL', measuredAt: at });
    expect(copy!.glucoseEarlier ?? []).toEqual(withTrack ? [{ value: 120, unit: 'mg/dL', measuredAt: at }] : []);
  };

  for (const withTrack of [true, false]) {
    it(`round-trips ${withTrack ? 'with a reading logged in Track that day' : 'with the check-in’s readings alone'}, replaced or merged`, async () => {
      const a = await device();
      await sessionSaved(a, withTrack);
      kept(a, withTrack);
      const file = await a.backup();

      const b = await device();
      const preview = b.store.previewRecord(file);
      if (!preview.ok) throw new Error(preview.reason);
      expect(preview.rejected?.sessions).toBe(0);
      expect(preview.sessions).toBe(1);
      expect((await b.store.importRecord(file, 'replace')).ok).toBe(true);
      kept(b, withTrack);

      const c = await device();
      await saveCheckIn(c.store, { ...checkIn(98, `${DAY}T07:00:00.000+05:30`, 118, 76), date: '2026-10-06' });
      expect((await c.store.importRecord(file, 'merge')).ok).toBe(true);
      kept(c, withTrack);
    });
  }

  it('reads a backup made before, whose session kept the screens’ copy with Track’s readings attached', async () => {
    const a = await device();
    const { held } = await sessionSaved(a, true);
    const file = await a.backup() as { sessions: { checkIn?: unknown }[] };
    // As the previous version wrote it, the stored record the screens attach included.
    const { readiness: _r, ...stored } = held;
    void _r;
    const older = { ...file, sessions: file.sessions.map(s => ({ ...s, checkIn: { ...held, durable: stored } })) };
    for (const mode of ['replace', 'merge'] as const) {
      const b = await device();
      const preview = b.store.previewRecord(older);
      expect(preview.ok && preview.rejected?.sessions).toBe(0);
      expect((await b.store.importRecord(older, mode)).ok).toBe(true);
      kept(b, true);
    }
  });

  it('round-trips a session saved while answers were still waiting, without the stored record the screens attach', async () => {
    const a = await device();
    const { createDefaultProfile } = await import('@/profile/defaults');
    const { effectiveRecord } = await import('@/components/checkin/pending');
    const { buildSessionPlan } = await import('@/engine/session');
    const { createRunner, initialState } = await import('@/session/runner');
    const { toWorkoutSession, withGuidedSession } = await import('@/session/logging');
    const profile = createDefaultProfile({ weightKg: 80, health: { diabetes: 'type2', metformin: true, medicinesReviewed: true, glucoseMonitor: 'meter' } });
    await a.store.setProfile(profile);
    await saveCheckIn(a.store, checkIn(120, at, 124, 78));
    const stored = a.store.getState().checkIns.find(c => c.date === DAY)!;
    // An answer not stored yet, merged in as the screens merge it: the stored record rides along (`durable`).
    const held = effectiveRecord(stored, { ...stored, energy: 2 }, profile, [])!;
    expect(held.durable).toBeDefined();
    const plan = buildSessionPlan({ profile, date: DAY, startDate: DAY, sessions: [] });
    const runner = createRunner(plan);
    const run = runner.reduce(runner.reduce(initialState(plan), { type: 'start', now: 0 }), { type: 'tick', now: plan.totalSeconds * 1000 + 1 });
    expect((await a.store.update(prev => withGuidedSession(prev, toWorkoutSession(plan, run, { sessionId: 'guided-1', checkIn: held })))).ok).toBe(true);
    kept(a, false);
    const file = await a.backup();
    // And as the previous version wrote it, the stored record kept inside the session's copy.
    const older = { ...(file as { sessions: object[] }), sessions: (file as { sessions: object[] }).sessions.map(s => ({ ...s, checkIn: held })) };
    for (const [mode, raw] of [['replace', file], ['merge', file], ['replace', older], ['merge', older]] as const) {
      const b = await device();
      expect((await b.store.importRecord(raw, mode)).ok).toBe(true);
      kept(b, false);
      expect(b.store.getState().sessions.find(s => s.id === 'guided-1')?.checkIn?.energy).toBe(2);
    }
  });

  it('reads a session this device stored that way before, as it now keeps them', async () => {
    const a = await device();
    const { held, session } = await sessionSaved(a, true);
    expect((await a.store.putSession({ ...session, checkIn: held })).ok).toBe(true);
    expect((await a.store.reload()).ok).toBe(true);
    kept(a, true);
    const b = await device();
    expect((await b.store.importRecord(await a.backup(), 'replace')).ok).toBe(true);
    kept(b, true);
  });

  it('keeps no clock hold in a session’s copy of its day, nor in a check-in: the device’s own, attached for the gates only (B-19, board D174)', async () => {
    const a = await device();
    const { held, session } = await sessionSaved(a, true);
    const clockHold = { generation: 1, days: [DAY] };
    expect((await a.store.putSession({ ...session, checkIn: { ...held, clockHold } })).ok).toBe(true);
    expect((await a.store.update(prev => ({ ...prev, checkIns: (prev.checkIns ?? []).map(c => ({ ...c, clockHold })) })))).toMatchObject({ ok: true });
    expect((await a.store.reload()).ok).toBe(true);
    expect(a.store.getState().sessions.find(s => s.id === 'guided-1')?.checkIn?.clockHold).toBeUndefined();
    expect(a.store.getState().checkIns.every(c => c.clockHold === undefined)).toBe(true);
    kept(a, true);
  });

  it('keeps a day with no check-in but a reading in Track as that reading, without the mark only the screens carry', async () => {
    const a = await device();
    const { held } = await sessionSaved(a, true, false);
    expect(held.readingsOnly).toBe(true);
    const copy = () => a.store.getState().sessions.find(s => s.id === 'guided-1')!.checkIn!;
    expect(copy().readingsOnly).toBeUndefined();
    expect(copy().logged).toBeUndefined();
    expect(copy().glucose).toEqual(expect.objectContaining({ value: 140, measuredAt: track }));
    const b = await device();
    expect((await b.store.importRecord(await a.backup(), 'replace')).ok).toBe(true);
    expect(b.store.getState().sessions.find(s => s.id === 'guided-1')?.checkIn?.readingsOnly).toBeUndefined();
    // And from a backup made before, which kept the mark with the session.
    const file = await a.backup() as { sessions: { checkIn?: unknown }[] };
    const older = { ...file, sessions: file.sessions.map(s => ({ ...s, checkIn: held })) };
    const c = await device();
    expect((await c.store.importRecord(older, 'replace')).ok).toBe(true);
    const restored = c.store.getState().sessions.find(s => s.id === 'guided-1')!.checkIn!;
    expect(restored.readingsOnly).toBeUndefined();
    expect(restored.logged).toBeUndefined();
    expect(restored.glucose).toEqual(expect.objectContaining({ value: 140, measuredAt: track }));
  });

  // Read for damage before anything is made of it, as any check-in is: folding
  // readings into a damaged copy would fail on it, or hide what is wrong (P-03).
  it('refuses a backup whose session copy holds a reading it cannot read, naming the day, and is not thrown by it', async () => {
    const a = await device();
    const { held, session } = await sessionSaved(a, true);
    const file = await a.backup() as { sessions: { checkIn?: unknown }[] };
    // Beside readings from Track it can read, and among the readings Track attached.
    const copies: [object, string][] = [
      [{ ...held, glucoseEarlier: 'high' }, 'a glucose reading this app cannot read'],
      [{ ...held, logged: { glucose: 'high' } }, 'a glucose reading this app cannot read'],
      [{ ...held, logged: { glucose: [{ value: 'high', unit: 'mg/dL' }] } }, 'a glucose reading whose number cannot be read'],
      [{ ...held, logged: 'high' }, 'readings from Track this app cannot read'],
    ];
    for (const [copy, said] of copies) {
      const reason = `That file's check-in for ${DAY} holds ${said}. It may be damaged.`;
      const damaged = { ...file, sessions: file.sessions.map(s => ({ ...s, checkIn: copy })) };
      expect(a.store.previewRecord(damaged), said).toEqual({ ok: false, reason });
      for (const mode of ['replace', 'merge'] as const) {
        const before = a.store.getState();
        const applied = await a.store.importRecord(damaged, mode, { allowRejected: true });
        expect(applied.ok ? 'imported' : applied.failure.message).toBe(reason);
        expect(a.store.getState().sessions).toEqual(before.sessions);
      }
    }
    // A copy stored that way on this device is read as it is, not thrown by.
    expect((await a.store.putSession({ ...session, checkIn: { ...held, glucoseEarlier: 'high' } as never })).ok).toBe(true);
    expect((await a.store.reload()).ok).toBe(true);
  });
});

describe('a check-in a save once stored with what only the screens carry (P-01)', () => {
  const at = `${DAY}T09:00:00.000+05:30`;
  const track = `${DAY}T11:58:00.000+05:30`;
  const now = new Date(`${DAY}T12:00:00.000+05:30`);
  const profile = async () => (await import('@/profile/defaults')).createDefaultProfile({
    weightKg: 80, health: { diabetes: 'type2', metformin: true, sulfonylureaOrMeglitinide: true, medicinesReviewed: true, glucoseMonitor: 'meter' },
  });

  /** Stored as an earlier save could store it: the screens' copy, Track's reading attached and the mark for a day without a check-in. */
  async function stored(d: Awaited<ReturnType<typeof device>>, record: CheckInRecord) {
    expect((await d.store.update(prev => ({ ...prev, checkIns: [...(prev.checkIns ?? []).filter(c => c.date !== record.date), record] }))).ok).toBe(true);
  }

  /**
   * What every gate says of the day, as the screens read it: the stored
   * record with the series' Track readings attached (`effectiveCheckIns`),
   * its readiness and each mode's permission.
   */
  async function gates(d: Awaited<ReturnType<typeof device>>, p: Awaited<ReturnType<typeof profile>>) {
    const { effectiveCheckIns } = await import('@/components/checkin/pending');
    const { evaluateCheckIn } = await import('@/engine/readiness');
    const { permission } = await import('@/engine/permission');
    const state = d.store.getState();
    const days = effectiveCheckIns(state.checkIns, p, state.observations);
    const day = days.find(c => c.date === DAY)!;
    const recent = days.filter(c => c.date < DAY);
    return { readiness: evaluateCheckIn(p, day, recent, now), modes: (['guided', 'stretch', 'walk'] as const).map(m => permission({ profile: p, checkIn: day, now, recent }, m)) };
  }

  /** A day with an hour-old reading of its own, and a fresh one in Track that the screens' copy carried along. */
  async function withTrack(d: Awaited<ReturnType<typeof device>>, p: Awaited<ReturnType<typeof profile>>) {
    await d.store.setProfile(p);
    const logged = await d.store.addObservation({ kind: 'glucose', value: 110, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: track });
    if (!logged.ok) throw logged.failure;
    const screens = {
      ...checkIn(120, at, 124, 78),
      logged: { glucose: [{ value: 110, unit: 'mg/dL', measuredAt: track, unitConfirmed: true, source: 'meter' }] },
      readingsOnly: true,
    } as CheckInRecord;
    await stored(d, screens);
    // As the build that stored it wrote its backup.
    const written = { ...(await d.backup() as object), checkIns: [screens] };
    return { trackId: logged.value.id, written };
  }

  /** The day's own record as it is kept: its own readings, and nothing only the screens carry. */
  const own = (d: Awaited<ReturnType<typeof device>>) => {
    const day = d.store.getState().checkIns.find(c => c.date === DAY)!;
    expect(day.logged).toBeUndefined();
    expect(day.readingsOnly).toBeUndefined();
    expect(day.glucose).toEqual({ value: 120, unit: 'mg/dL', measuredAt: at });
    expect(day.glucoseEarlier).toBeUndefined();
  };

  it('restores it, replaced or merged, as the day’s own record, the gates reading Track’s reading from the series as before', async () => {
    const p = await profile();
    const a = await device();
    const { written } = await withTrack(a, p);
    const asItWas = await gates(a, p);
    const exported = await a.backup();
    for (const file of [written, exported]) {
      for (const mode of ['replace', 'merge'] as const) {
        const b = await device();
        await b.store.setProfile(p);
        expect((await b.store.importRecord(file, mode)).ok).toBe(true);
        own(b);
        expect(await gates(b, p)).toEqual(asItWas);
      }
    }
    // And on the device that stored it, read as it is now kept.
    expect((await a.store.reload()).ok).toBe(true);
    own(a);
    expect(await gates(a, p)).toEqual(asItWas);
  });

  it('a Track reading deleted here does not come back through that day’s record, merged or read again', async () => {
    const p = await profile();
    const a = await device();
    const { trackId, written } = await withTrack(a, p);
    const b = await device();
    expect((await b.store.importRecord(written, 'replace')).ok).toBe(true);
    expect((await b.store.removeObservation(trackId)).ok).toBe(true);
    const without = await gates(b, p);
    expect(without).not.toEqual(await gates(a, p));
    for (const onConflict of ['keepDevice', 'takeFile'] as const) {
      expect((await b.store.importRecord(written, 'merge', { onConflict })).ok).toBe(true);
      expect(b.store.getState().observations.some(o => o.value === 110)).toBe(false);
      own(b);
      expect(await gates(b, p)).toEqual(without);
    }
    // Deleted on the device that stored it, with the screens' copy still in its store.
    expect((await a.store.removeObservation(trackId)).ok).toBe(true);
    expect((await a.store.reload()).ok).toBe(true);
    own(a);
    expect(await gates(a, p)).toEqual(without);
  });

  it('lets go of Track readings it cannot read in this device’s own record, rather than stop every gate on them', async () => {
    const p = await profile();
    const a = await device();
    await a.store.setProfile(p);
    await stored(a, { ...checkIn(120, at, 124, 78), logged: { glucose: 'high' } } as unknown as CheckInRecord);
    expect((await a.store.reload()).ok).toBe(true);
    expect(a.store.getState().checkIns.find(c => c.date === DAY)?.logged).toBeUndefined();
    await expect(gates(a, p)).resolves.toBeDefined();
  });

  it('without the mark for a day with no check-in, its red flags carry, as any day’s do', async () => {
    const p = (await import('@/profile/defaults')).createDefaultProfile({ weightKg: 80 });
    const { evaluateCheckIn } = await import('@/engine/readiness');
    const marked = { date: DAY, urgentSymptoms: false, news: [], sleep: '5to7', energy: 4, readiness, back: { pain: 3, newWeakness: true }, readingsOnly: true } as CheckInRecord;
    const a = await device();
    await stored(a, marked);
    // As the build that stored it wrote its backup.
    const written = { ...(await a.backup() as object), checkIns: [marked] };
    const b = await device();
    expect((await b.store.importRecord(written, 'replace')).ok).toBe(true);
    const day = b.store.getState().checkIns.find(c => c.date === DAY)!;
    expect(day.readingsOnly).toBeUndefined();
    const next: DailyCheckIn = { date: '2026-10-08', urgentSymptoms: false, emergency: [], news: [], sleep: '5to7', energy: 4 };
    const tomorrow = new Date('2026-10-08T09:00:00.000+05:30');
    // With the mark the flag was passed over; without it, it holds the next day until a clinician has checked it.
    const carried = (r: Readiness) => r.reasons.some(x => x.code === 'carried:newWeakness');
    expect(carried(evaluateCheckIn(p, next, [marked], tomorrow))).toBe(false);
    expect(carried(evaluateCheckIn(p, next, [day], tomorrow))).toBe(true);
    expect(evaluateCheckIn(p, next, [day], tomorrow).disposition).toBe('today');
  });
});

describe('a merge of an older backup and what was deleted since (D-06)', () => {
  const session: WorkoutSession = { id: 'session-typo', date: DAY, dayOfWeek: 'wednesday', muscleGroup: 'lower', phase: 'foundation', week: 1,
    status: 'completed', sets: [], startedAt: null, completedAt: null, notes: '', totalVolume: 0 };

  it('keeps a deleted reading and session deleted, and the preview says so', async () => {
    const a = await device();
    const typo = await a.store.addObservation({ kind: 'glucose', value: 600, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: `${DAY}T08:00:00.000+05:30` });
    if (!typo.ok) throw typo.failure;
    await a.store.putSession({ ...session });
    const older = await a.backup();
    expect((await a.mistaken(() => a.store.removeObservation(typo.value.id))).ok).toBe(true);
    expect((await a.store.removeSession(session.id)).ok).toBe(true);
    // Remembered on the device, not just on screen.
    expect((await a.store.reload()).ok).toBe(true);

    const preview = a.store.previewRecord(older);
    expect(preview.ok && preview.deletedHere).toBe(2);
    expect((await a.store.importRecord(older, 'merge')).ok).toBe(true);
    expect(a.store.getState().observations.map(o => o.value)).not.toContain(600);
    expect(a.store.getState().sessions.map(s => s.id)).not.toContain(session.id);
  });

  it('remembers the deletion in the backup, so a new device set up from it keeps it deleted too', async () => {
    const a = await device();
    const typo = await a.store.addObservation({ kind: 'glucose', value: 600, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: `${DAY}T08:00:00.000+05:30` });
    if (!typo.ok) throw typo.failure;
    const older = await a.backup();
    await a.mistaken(() => a.store.removeObservation(typo.value.id));
    const later = await a.backup();

    const b = await device();
    expect((await b.store.importRecord(later, 'replace')).ok).toBe(true);
    expect((await b.store.importRecord(older, 'merge')).ok).toBe(true);
    expect(b.store.getState().observations.map(o => o.value)).not.toContain(600);

    // Merged into a device with settings of its own, the deletion is learned all the same.
    const c = await device();
    await c.store.setSettings({ theme: 'dark' });
    await c.store.importRecord(later, 'merge');
    await c.store.importRecord(older, 'merge');
    expect(c.store.getState().observations.map(o => o.value)).not.toContain(600);
  });

  it('forgets a deletion once the same record is written again', async () => {
    const a = await device();
    const input = { id: 'glucose-again', kind: 'glucose', value: 110, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: `${DAY}T08:00:00.000+05:30` } as const;
    await a.store.addObservation(input);
    await a.store.removeObservation(input.id);
    expect(a.store.getState().settings.deleted?.observations).toEqual([input.id]);
    await a.store.addObservation(input);
    expect(a.store.getState().settings.deleted).toBeUndefined();
  });

  it('a restore that replaces everything brings it back, as it says, and it can be deleted again', async () => {
    const a = await device();
    const typo = await a.store.addObservation({ kind: 'glucose', value: 600, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: `${DAY}T08:00:00.000+05:30` });
    if (!typo.ok) throw typo.failure;
    const older = await a.backup();
    await a.store.removeObservation(typo.value.id);
    expect((await a.store.importRecord(older, 'replace')).ok).toBe(true);
    expect(a.store.getState().observations.map(o => o.value)).toContain(600);
    // Back on the device, it is no longer remembered as deleted.
    const preview = a.store.previewRecord(older);
    expect(preview.ok && preview.deletedHere).toBe(0);
  });
});

describe('a reading deleted from a check-in, and an older backup merged (R5-01)', () => {
  const at = `${DAY}T08:30:00.000+05:30`;
  const typo: CheckInRecord = { ...checkIn(600, at, 124, 78), energy: 4 };
  /**
   * A slip that holds nothing. A 600 can only go once "It was a mistake" has answered it (board D119), and
   * an incident this device has answered keeps its day as it is here through every merge (Plan 6's H6-03):
   * a test of which day's record a merge takes deletes this one instead.
   */
  const slip: CheckInRecord = { ...checkIn(160, at, 124, 78), energy: 4 };

  /** Delete the 600 (or `value`) the way Track does: out of the day's record and the series in one write. */
  async function deleteTypo(d: Awaited<ReturnType<typeof device>>, value = 600) {
    const { withReadingRemoved } = await import('@/components/checkin/pending');
    const id = d.store.getState().observations.find(o => o.kind === 'glucose')!.id;
    const removed = await d.mistaken(() => d.store.update(previous => ({
      ...previous,
      checkIns: (previous.checkIns ?? []).map(c => (c.date === DAY ? (withReadingRemoved(c, { kind: 'glucose', at, value, unit: 'mg/dL' }) ?? c) as CheckInRecord : c)),
    }), { removeObservations: [id] }));
    expect(removed.ok).toBe(true);
  }

  it('takes the deleted reading out of the file’s record as well, so no later save brings it back', async () => {
    const a = await device();
    await saveCheckIn(a.store, typo);
    const older = await a.backup();
    await deleteTypo(a);
    expect(glucose(a.store.getState().observations)).toEqual([]);

    // The file's record of that day is taken over the device's.
    expect((await a.store.importRecord(older, 'merge', { onConflict: 'takeFile' })).ok).toBe(true);
    expect(glucose(a.store.getState().observations)).toEqual([]);
    expect(a.store.getState().checkIns.find(c => c.date === DAY)?.glucose).toBeUndefined();

    // Then that day's check-in is saved again with another change.
    await saveCheckIn(a.store, { ...a.store.getState().checkIns.find(c => c.date === DAY)!, energy: 2 });
    expect(glucose(a.store.getState().observations)).toEqual([]);
  });

  it('works the day’s readiness out again without it, as deleting it in Track does', async () => {
    const { createDefaultProfile } = await import('@/profile/defaults');
    const { evaluateCheckIn } = await import('@/engine/readiness');
    const a = await device();
    const profile = createDefaultProfile({ weightKg: 80, health: { diabetes: 'type2', metformin: true, medicinesReviewed: true, glucoseMonitor: 'meter' } });
    await a.store.setProfile(profile);
    await saveCheckIn(a.store, slip);
    const older = await a.backup();
    await deleteTypo(a, 160);
    // The device's record of the day differs in more than the reading, so the file's is taken.
    await saveCheckIn(a.store, { ...a.store.getState().checkIns.find(c => c.date === DAY)!, energy: 2 });
    await a.store.importRecord(older, 'merge', { onConflict: 'takeFile' });
    const day = a.store.getState().checkIns.find(c => c.date === DAY)!;
    expect(day.energy).toBe(4);
    expect(day.glucose).toBeUndefined();
    const { readiness, ...plain } = day;
    expect(readiness).toEqual(evaluateCheckIn(profile, plain, []));
  });

  it('merging the same file again finds nothing to disagree about, and changes nothing', async () => {
    const { createDefaultProfile } = await import('@/profile/defaults');
    const a = await device();
    await a.store.setProfile(createDefaultProfile({ weightKg: 80, health: { diabetes: 'type2', metformin: true, medicinesReviewed: true, glucoseMonitor: 'meter' } }));
    await saveCheckIn(a.store, slip);
    const older = await a.backup();
    await deleteTypo(a, 160);
    await saveCheckIn(a.store, { ...a.store.getState().checkIns.find(c => c.date === DAY)!, energy: 2 });
    // Taken without the deleted reading, and with its readiness worked out again.
    expect((await a.store.importRecord(older, 'merge', { onConflict: 'takeFile' })).ok).toBe(true);
    const { checkIns, observations } = a.store.getState();
    expect(checkIns.find(c => c.date === DAY)).toMatchObject({ energy: 4 });

    const none = {
      observations: 0, sessions: 0, checkIns: 0, personalRecords: 0, bodyMetrics: 0, focusOverrides: 0, contentState: 0,
      routes: 0, meals: 0, savedMeals: 0, customFoods: 0,
    };
    expect(a.store.previewRecord(older)).toMatchObject({ conflicts: none });
    for (const onConflict of ['keepDevice', 'takeFile'] as const) {
      const again = await a.store.importRecord(older, 'merge', { onConflict });
      expect(again.ok && again.value.conflicts).toEqual(none);
      expect(a.store.getState().checkIns).toEqual(checkIns);
      expect(a.store.getState().observations).toEqual(observations);
    }
  });

  it('a device that learns of the deletion from a later backup keeps it out of an older one too', async () => {
    const a = await device();
    await saveCheckIn(a.store, typo);
    const older = await a.backup();
    await deleteTypo(a);
    const later = await a.backup();

    const b = await device();
    await b.store.setSettings({ theme: 'dark' });
    await b.store.importRecord(later, 'merge');
    expect((await b.store.importRecord(older, 'merge', { onConflict: 'takeFile' })).ok).toBe(true);
    expect(glucose(b.store.getState().observations)).toEqual([]);
    expect(b.store.getState().checkIns.find(c => c.date === DAY)?.glucose).toBeUndefined();
  });

  it('stays deleted when it was corrected before it was deleted, whichever record of the day the merge keeps', async () => {
    const { createDefaultProfile } = await import('@/profile/defaults');
    for (const onConflict of ['keepDevice', 'takeFile'] as const) {
      const a = await device();
      const { correctCheckInGlucose, removeCheckInReading } = await import('@/components/checkin/pending');
      const profile = createDefaultProfile({ weightKg: 80, health: { diabetes: 'type2', metformin: true, medicinesReviewed: true, glucoseMonitor: 'meter' } });
      await a.store.setProfile(profile);
      await saveCheckIn(a.store, typo);
      const older = await a.backup();
      const deps = { profile, update: a.store.update, date: DAY };
      const id = a.store.getState().observations.find(o => o.kind === 'glucose')!.id;
      // 600 corrected to 60 in Track, then deleted: one reading, one id, throughout.
      expect(await a.mistaken(() => correctCheckInGlucose({ at, was: { value: 600, unit: 'mg/dL' }, to: { value: 60, unit: 'mg/dL' } }, deps))).toMatchObject({ matched: true, stored: true });
      expect(a.store.getState().observations.filter(o => o.kind === 'glucose').map(o => [o.id, o.value])).toEqual([[id, 60]]);
      expect(await a.mistaken(() => removeCheckInReading({ kind: 'glucose', at, value: 60, unit: 'mg/dL' }, [id], deps))).toMatchObject({ matched: true, stored: true });
      expect(glucose(a.store.getState().observations)).toEqual([]);

      // The backup still says 600, which no deletion of the 60 named by number.
      expect((await a.store.importRecord(older, 'merge', { onConflict })).ok).toBe(true);
      expect(glucose(a.store.getState().observations)).toEqual([]);
      expect(a.store.getState().checkIns.find(c => c.date === DAY)?.glucose).toBeUndefined();
    }
  });

  it('stays deleted when this device remembers it by its id alone, as the previous version did', async () => {
    for (const onConflict of ['keepDevice', 'takeFile'] as const) {
      const a = await device();
      await saveCheckIn(a.store, typo);
      const older = await a.backup();
      const id = a.store.getState().observations.find(o => o.kind === 'glucose')!.id;
      await deleteTypo(a);
      await a.store.setSettings({ deleted: { observations: [id] } });
      expect(a.store.getState().settings.deleted).toEqual({ observations: [id] });

      expect((await a.store.importRecord(older, 'merge', { onConflict })).ok).toBe(true);
      expect(glucose(a.store.getState().observations)).toEqual([]);
      expect(a.store.getState().checkIns.find(c => c.date === DAY)?.glucose).toBeUndefined();
    }
  });

  it('keeps a deleted reading out of the file’s own record, though the file holds no lifted copy of it (N-05)', async () => {
    const { createDefaultProfile } = await import('@/profile/defaults');
    const { evaluateCheckIn } = await import('@/engine/readiness');
    const profile = createDefaultProfile({ weightKg: 80, health: { diabetes: 'type2', metformin: true, medicinesReviewed: true, glucoseMonitor: 'meter' } });
    const a = await device();
    await a.store.setProfile(profile);
    await saveCheckIn(a.store, typo);
    // Deleted from the series alone, as a direct deletion does: the day's record still says 600.
    const id = a.store.getState().observations.find(o => o.kind === 'glucose')!.id;
    expect((await a.store.removeObservation(id)).ok).toBe(true);
    const file = await a.backup() as { observations: Observation[]; checkIns: CheckInRecord[]; settings: { deleted?: { readings?: string[] } } };
    expect(file.observations.some(o => o.kind === 'glucose')).toBe(false);
    expect(file.checkIns.find(c => c.date === DAY)?.glucose?.value).toBe(600);
    expect(file.settings.deleted?.readings).toHaveLength(1);

    const clean = (d: Awaited<ReturnType<typeof device>>) => {
      const day = d.store.getState().checkIns.find(c => c.date === DAY)!;
      expect(day.glucose).toBeUndefined();
      expect(day.bpReadings).toEqual([{ sys: 124, dia: 78, at }]);
      const { readiness, ...plain } = day;
      expect(readiness).toEqual(evaluateCheckIn(profile, plain, []));
    };
    for (const onConflict of ['keepDevice', 'takeFile'] as const) {
      const b = await device();
      await b.store.setProfile(profile);
      expect((await b.store.importRecord(file, 'merge', { onConflict })).ok).toBe(true);
      expect(glucose(b.store.getState().observations)).toEqual([]);
      clean(b);
    }
    // Replacing takes the file as it is, its record of what was deleted included.
    const c = await device();
    expect((await c.store.importRecord(file, 'replace')).ok).toBe(true);
    clean(c);
  });

  it('and out of a record this device deleted it from, when the file holds the record alone (N-05)', async () => {
    const a = await device();
    await saveCheckIn(a.store, typo);
    const withCopy = await a.backup() as { observations: Observation[] };
    const b = await device();
    await b.store.importRecord(withCopy, 'replace');
    await deleteTypo(b);
    const recordAlone = { ...withCopy, observations: withCopy.observations.filter(o => o.kind !== 'glucose') };
    for (const onConflict of ['keepDevice', 'takeFile'] as const) {
      expect((await b.store.importRecord(recordAlone, 'merge', { onConflict })).ok).toBe(true);
      expect(b.store.getState().checkIns.find(c => c.date === DAY)?.glucose).toBeUndefined();
    }
  });

  it('and a reading an older record kept only as the day’s blood pressure, merged or replaced (N-05)', async () => {
    const { TRANSFER_FORMAT } = await import('./transfer');
    const { readingKey } = await import('./project');
    // Before a day kept each reading, its one blood pressure was the day's own.
    const older = { date: DAY, urgentSymptoms: false, news: [], sleep: '5to7', energy: 4, readiness, bp: { sys: 190, dia: 100, at } };
    const key = readingKey({ kind: 'bloodPressureSystolic', at, value: 190, context: `bp:checkIn:${DAY}` })!;
    const file = { format: TRANSFER_FORMAT, version: 1, exportedAt: `${DAY}T20:00:00.000+05:30`, schemaVersion: 5, observations: [], sessions: [],
      checkIns: [older], personalRecords: [], bodyMetrics: [], focusOverrides: {}, contentState: [], settings: { deleted: { readings: [key] } } };
    for (const [mode, onConflict] of [['merge', 'keepDevice'], ['merge', 'takeFile'], ['replace', 'keepDevice']] as const) {
      const b = await device();
      expect((await b.store.importRecord(file, mode, { onConflict })).ok).toBe(true);
      expect(b.store.getState().checkIns.find(c => c.date === DAY)?.bp, `${mode} ${onConflict}`).toBeUndefined();
    }
  });

  it('a file that holds a reading and says it was deleted keeps it, in the series and the day’s record alike', async () => {
    const a = await device();
    await saveCheckIn(a.store, typo);
    const file = await a.backup() as { settings?: { deleted?: { readings?: string[] } } };
    const { readingKey } = await import('./project');
    const key = readingKey(a.store.getState().observations.find(o => o.kind === 'glucose')!)!;
    const both = { ...file, settings: { ...file.settings, deleted: { readings: [key] } } };
    for (const mode of ['merge', 'replace'] as const) {
      const b = await device();
      expect((await b.store.importRecord(both, mode)).ok).toBe(true);
      expect(glucose(b.store.getState().observations)).toEqual([[600, '08:30']]);
      expect(b.store.getState().checkIns.find(c => c.date === DAY)?.glucose?.value).toBe(600);
    }
  });

  it('never lifts a deleted reading back out of a record that still names it', async () => {
    const a = await device();
    await saveCheckIn(a.store, typo);
    // Deleted from the series alone, as before Track also took it out of the record.
    const id = a.store.getState().observations.find(o => o.kind === 'glucose')!.id;
    expect((await a.store.removeObservation(id)).ok).toBe(true);
    await saveCheckIn(a.store, { ...a.store.getState().checkIns.find(c => c.date === DAY)!, energy: 2 });
    expect(glucose(a.store.getState().observations)).toEqual([]);
    // A new reading at another time is a new reading. Put in the 600's place, it's said as a typo first (D119).
    await a.mistaken(() => saveCheckIn(a.store, { ...a.store.getState().checkIns.find(c => c.date === DAY)!, glucose: { value: 110, unit: 'mg/dL', measuredAt: `${DAY}T12:00:00.000+05:30` } }));
    expect(glucose(a.store.getState().observations)).toEqual([[110, '12:00']]);
  });
});

describe('a meal deleted and brought back on another device, merged (B-05; board D136, D147)', () => {
  const AT = '2026-10-08T13:10:00.000+05:30';
  const roti = { kind: 'food', foodId: 'roti', rev: 1, name: 'Roti', unit: 'piece', count: 2, gramsPerPortion: 40, kcal: 204, carbsG: 43.2, carbsLowG: 31.1, carbsHighG: 57 } as const;
  const lunch = { id: 'meal-1', at: AT, day: '2026-10-08', meal: 'lunch' as const, items: [roti], level: 'estimates' as const, loggedAt: AT, edits: [] };
  /** A device as `device` is, set up (settings of its own), with its own food actions. */
  async function phone() {
    const d = await device();
    expect((await d.store.setSettings({ theme: 'system' })).ok).toBe(true);
    const food = await import('@/food/store');
    const { mealsIn, customFoodsIn } = await import('@/food/records');
    return { ...d, food, meals: () => mealsIn(d.store.getState().records), own: () => customFoodsIn(d.store.getState().records) };
  }
  /** Two devices holding the same lunch: B set up from A's backup. */
  async function pair() {
    const a = await phone();
    expect((await a.food.saveMeal(lunch)).ok).toBe(true);
    const b = await phone();
    expect((await b.store.importRecord(await a.backup(), 'merge')).ok).toBe(true);
    return { a, b };
  }
  const restore = async (p: Awaited<ReturnType<typeof phone>>, id: string) => {
    const meal = p.meals().find(m => m.id === id)!;
    expect((await p.food.deleteMeal(id)).ok).toBe(true);
    const back = await p.food.restoreMeal(meal);
    if (!back.ok) throw back.failure;
    return back.value;
  };
  const merged = async (into: Awaited<ReturnType<typeof phone>>, file: unknown) => {
    const preview = into.store.previewRecord(file);
    if (!preview.ok) throw new Error(preview.reason);
    expect((await into.store.importRecord(file, 'merge')).ok).toBe(true);
    return { restoredHere: preview.restoredHere, restoredKept: preview.restoredKept };
  };

  it('takes the copy in place of the original when it is the original unchanged, once', async () => {
    const { a, b } = await pair();
    const r = await restore(b, 'meal-1');
    expect(await merged(a, await b.backup())).toEqual({ restoredHere: 1, restoredKept: 0 });
    expect(a.meals()).toEqual([r]);
    expect(a.store.getState().settings.deleted?.records?.meals).toEqual(['meal-1']);
  });

  it('keeps a correction made here since, with its history, leaves the copy out, and says so (K7R-03)', async () => {
    const { a, b } = await pair();
    await restore(b, 'meal-1');
    expect((await a.food.saveCorrection(lunch, { at: AT, meal: 'lunch', items: [{ ...roti, count: 3, kcal: 306 }] }, '2026-10-08T14:00:00.000+05:30')).ok).toBe(true);
    const fixed = a.meals()[0];
    expect(fixed.edits).toHaveLength(1);
    expect(await merged(a, await b.backup())).toEqual({ restoredHere: 0, restoredKept: 1 });
    expect(a.meals()).toEqual([fixed]);
    expect(a.store.getState().settings.deleted?.records?.meals).toBeUndefined();
  });

  it('reads restores of restores as one meal: M, then R, then S, each copy naming M (H7-11)', async () => {
    const { a, b } = await pair();
    const r = await restore(b, 'meal-1');
    const s = await restore(b, r.id);
    expect([r.restoredFrom, s.restoredFrom]).toEqual(['meal-1', 'meal-1']);
    expect(await merged(a, await b.backup())).toEqual({ restoredHere: 1, restoredKept: 0 });
    expect(a.meals()).toEqual([s]);
  });

  it('follows a chain made before copies named their original, through the records it knows (H7-11)', async () => {
    const { a, b } = await pair();
    const r = await restore(b, 'meal-1');
    await merged(a, await b.backup());
    expect(a.meals()).toEqual([r]);
    // B brings R back again under a build that named only the copy it came from.
    const s = { ...r, id: 'meal-s', restoredFrom: r.id };
    const file = await b.backup() as { records: { meals: unknown[] }; settings: { deleted?: { records?: { meals?: string[] } } } };
    const older = { ...file, records: { ...file.records, meals: [s] }, settings: { ...file.settings, deleted: { records: { meals: ['meal-1', r.id] } } } };
    expect(await merged(a, older)).toEqual({ restoredHere: 1, restoredKept: 0 });
    expect(a.meals()).toEqual([s]);
  });

  it('keeps one copy when both devices bring the same meal back, each keeping its own (H7-11)', async () => {
    const { a, b } = await pair();
    const r = await restore(a, 'meal-1');
    const s = await restore(b, 'meal-1');
    expect(await merged(a, await b.backup())).toEqual({ restoredHere: 0, restoredKept: 0 });
    expect(a.meals()).toEqual([r]);
    expect(await merged(b, await a.backup())).toEqual({ restoredHere: 0, restoredKept: 0 });
    expect(b.meals()).toEqual([s]);
    // Corrected on one, the other's copy is left out and the preview says so.
    expect((await a.food.saveCorrection(r, { at: AT, meal: 'dinner', items: r.items }, '2026-10-08T15:00:00.000+05:30')).ok).toBe(true);
    expect(await merged(a, await b.backup())).toEqual({ restoredHere: 0, restoredKept: 1 });
    expect(a.meals().map(m => [m.id, m.meal])).toEqual([[r.id, 'dinner']]);
  });

  it('never removes a meal for a copy that loses the merge (H7R-02)', async () => {
    const a = await phone();
    const other = { ...lunch, id: 'meal-2', meal: 'dinner' as const };
    expect((await a.food.saveMeal(lunch)).ok).toBe(true);
    expect((await a.food.saveMeal(other)).ok).toBe(true);
    expect((await a.food.saveCorrection(lunch, { at: AT, meal: 'lunch', items: [{ ...roti, count: 3, kcal: 306 }] }, '2026-10-08T14:00:00.000+05:30')).ok).toBe(true);
    const held = a.meals();
    // A file whose older copy of meal-1 says it came back from meal-2.
    const file = await a.backup() as { records: { meals: Record<string, unknown>[] } };
    const older = { ...file, records: { ...file.records, meals: [{ ...lunch, restoredFrom: 'meal-2' }] } };
    expect(await merged(a, older)).toEqual({ restoredHere: 0, restoredKept: 0 });
    expect(a.meals()).toEqual(held);
  });

  it('reads restoredFrom only where records are restored: never on own foods (H7R-02)', async () => {
    const a = await phone();
    const T = '2026-10-08T09:00:00.000+05:30';
    const lemon = { id: 'food-1', name: 'Lemon rice', per: { qty: 1, unit: 'plate' }, kcal: 333, createdAt: T, updatedAt: '2026-10-08T12:00:00.000+05:30' };
    const kheer = { id: 'food-2', name: 'Kheer', per: { qty: 1, unit: 'katori' }, createdAt: T, updatedAt: T };
    expect((await a.store.writeRecords({ put: { customFoods: [lemon, kheer] } })).ok).toBe(true);
    const file = await a.backup() as { records: Record<string, unknown[]> };
    const odd = { ...file, records: { ...file.records, customFoods: [{ ...lemon, updatedAt: T, restoredFrom: 'food-2' }, { ...kheer, id: 'food-3', restoredFrom: 'food-2' }] } };
    expect(await merged(a, odd)).toEqual({ restoredHere: 0, restoredKept: 0 });
    expect(a.own().map(f => f.id)).toEqual(['food-1', 'food-2', 'food-3']);
  });

  it('brings in one meal from a file holding an original and its copy, never writing and removing the same one (H7-11)', async () => {
    const { a, b } = await pair();
    const r = await restore(b, 'meal-1');
    // A file made before this fix, by a device that had merged and kept both.
    const file = await b.backup() as { records: { meals: unknown[] }; settings: Record<string, unknown> };
    const both = { ...file, records: { ...file.records, meals: [lunch, r] }, settings: { ...file.settings, deleted: undefined } };
    expect(await merged(a, both)).toEqual({ restoredHere: 1, restoredKept: 0 });
    expect(a.meals()).toEqual([r]);
    // On a device with neither, the copy stands in for the original it equals, and the original's deletion is
    // remembered, so the same file merged again brings it in no more (H7-11).
    const c = await phone();
    expect(await merged(c, both)).toEqual({ restoredHere: 0, restoredKept: 0 });
    expect(c.meals()).toEqual([r]);
    expect(c.store.getState().settings.deleted?.records?.meals).toEqual(['meal-1']);
    await merged(c, both);
    expect(c.meals()).toEqual([r]);
    // A device that took the copy alone before this, with no deletion to go by: the original isn't brought in beside it.
    const took = await phone();
    expect((await took.store.writeRecords({ put: { meals: [r as unknown as Record<string, unknown>] } })).ok).toBe(true);
    await merged(took, both);
    expect(took.meals()).toEqual([r]);
    expect(took.store.getState().settings.deleted?.records?.meals).toEqual(['meal-1']);
    // And when the file's original is a later correction, that one is kept, and the copy left out.
    const later = { ...lunch, meal: 'dinner' as const, editedAt: '2026-10-08T16:00:00.000+05:30', edits: [{ replacedAt: '2026-10-08T16:00:00.000+05:30', at: AT, meal: 'lunch' as const, items: [roti] }] };
    const d = await phone();
    expect((await d.food.saveMeal(lunch)).ok).toBe(true);
    const newer = { ...both, records: { ...both.records, meals: [later, r] } };
    expect(await merged(d, newer)).toEqual({ restoredHere: 0, restoredKept: 1 });
    expect(d.meals()).toEqual([later]);
    // Its copy brought back after that correction: the copy alone, the correction neither written nor kept beside it.
    const e = await phone();
    expect((await e.food.saveMeal(lunch)).ok).toBe(true);
    const copy = { ...later, id: 'meal-r2', restoredFrom: 'meal-1' };
    expect(await merged(e, { ...both, records: { ...both.records, meals: [later, copy] } })).toEqual({ restoredHere: 1, restoredKept: 0 });
    expect(e.meals()).toEqual([copy]);
  });

  it('keeps one of two copies of one meal in a file, and clears a pair this device kept before (H7-11)', async () => {
    const a = await phone();
    expect((await a.food.saveMeal(lunch)).ok).toBe(true);
    const file = await a.backup() as { records: { meals: unknown[] } };
    const r = { ...lunch, id: 'meal-r', restoredFrom: 'meal-1' };
    const s = { ...lunch, id: 'meal-s', restoredFrom: 'meal-1' };
    expect(await merged(a, { ...file, records: { ...file.records, meals: [r, s] } })).toEqual({ restoredHere: 1, restoredKept: 0 });
    expect(a.meals()).toEqual([r]);
    // A device that kept an original and its copy side by side, before this fix, keeps the copy once it is merged again.
    const b = await phone();
    expect((await b.store.writeRecords({ put: { meals: [lunch, r] } })).ok).toBe(true);
    expect(await merged(b, { ...file, records: { ...file.records, meals: [r] } })).toEqual({ restoredHere: 1, restoredKept: 0 });
    expect(b.meals()).toEqual([r]);
  });
});
