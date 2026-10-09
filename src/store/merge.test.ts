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

describe('a reading deleted from a check-in, and an older backup merged (R5-01)', () => {
  const at = `${DAY}T08:30:00.000+05:30`;
  const typo: CheckInRecord = { ...checkIn(600, at, 124, 78), energy: 4 };

  /** Delete the 600 the way Track does: out of the day's record and the series in one write. */
  async function deleteTypo(d: Awaited<ReturnType<typeof device>>) {
    const { withReadingRemoved } = await import('@/components/checkin/pending');
    const id = d.store.getState().observations.find(o => o.kind === 'glucose')!.id;
    const removed = await d.store.update(previous => ({
      ...previous,
      checkIns: (previous.checkIns ?? []).map(c => (c.date === DAY ? (withReadingRemoved(c, { kind: 'glucose', at, value: 600, unit: 'mg/dL' }) ?? c) as CheckInRecord : c)),
    }), { removeObservations: [id] });
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
    await saveCheckIn(a.store, typo);
    const older = await a.backup();
    await deleteTypo(a);
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
    await saveCheckIn(a.store, typo);
    const older = await a.backup();
    await deleteTypo(a);
    await saveCheckIn(a.store, { ...a.store.getState().checkIns.find(c => c.date === DAY)!, energy: 2 });
    // Taken without the deleted reading, and with its readiness worked out again.
    expect((await a.store.importRecord(older, 'merge', { onConflict: 'takeFile' })).ok).toBe(true);
    const { checkIns, observations } = a.store.getState();
    expect(checkIns.find(c => c.date === DAY)).toMatchObject({ energy: 4 });

    const none = { observations: 0, sessions: 0, checkIns: 0, personalRecords: 0, bodyMetrics: 0, focusOverrides: 0, contentState: 0 };
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
      expect(await correctCheckInGlucose({ at, was: { value: 600, unit: 'mg/dL' }, to: { value: 60, unit: 'mg/dL' } }, deps)).toMatchObject({ matched: true, stored: true });
      expect(a.store.getState().observations.filter(o => o.kind === 'glucose').map(o => [o.id, o.value])).toEqual([[id, 60]]);
      expect(await removeCheckInReading({ kind: 'glucose', at, value: 60, unit: 'mg/dL' }, [id], deps)).toMatchObject({ matched: true, stored: true });
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

  it('never lifts a deleted reading back out of a record that still names it', async () => {
    const a = await device();
    await saveCheckIn(a.store, typo);
    // Deleted from the series alone, as before Track also took it out of the record.
    const id = a.store.getState().observations.find(o => o.kind === 'glucose')!.id;
    expect((await a.store.removeObservation(id)).ok).toBe(true);
    await saveCheckIn(a.store, { ...a.store.getState().checkIns.find(c => c.date === DAY)!, energy: 2 });
    expect(glucose(a.store.getState().observations)).toEqual([]);
    // A new reading at another time is a new reading.
    await saveCheckIn(a.store, { ...a.store.getState().checkIns.find(c => c.date === DAY)!, glucose: { value: 110, unit: 'mg/dL', measuredAt: `${DAY}T12:00:00.000+05:30` } });
    expect(glucose(a.store.getState().observations)).toEqual([[110, '12:00']]);
  });
});
