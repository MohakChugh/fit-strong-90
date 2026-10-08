import { describe, expect, it, vi } from 'vitest';
import type { WorkoutSession } from '@/types';
import type { CheckInRecord, Readiness } from '@/types/checkin';
import { pairBloodPressure } from '@/health/aggregate';
import { checkInDayOf, type Observation } from '@/health/observation';
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
  return { store, backup };
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

describe('a merge of an older backup and what was deleted since (D-06)', () => {
  const session: WorkoutSession = { id: 'session-typo', date: DAY, dayOfWeek: 'wednesday', muscleGroup: 'lower', phase: 'foundation', week: 1,
    status: 'completed', sets: [], startedAt: null, completedAt: null, notes: '', totalVolume: 0 };

  it('keeps a deleted reading and session deleted, and the preview says so', async () => {
    const a = await device();
    const typo = await a.store.addObservation({ kind: 'glucose', value: 600, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: `${DAY}T08:00:00.000+05:30` });
    if (!typo.ok) throw typo.failure;
    await a.store.putSession({ ...session });
    const older = await a.backup();
    expect((await a.store.removeObservation(typo.value.id)).ok).toBe(true);
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
    await a.store.removeObservation(typo.value.id);
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
