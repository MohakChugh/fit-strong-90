import { describe, it, expect } from 'vitest';
import { createDefaultProfile } from '@/profile/defaults';
import type { CheckInRecord, DailyCheckIn, Readiness } from '@/types/checkin';
import { evaluateCheckIn, glucoseReadingId } from '@/engine/readiness';
import { permission } from '@/engine/permission';
import { effectiveCheckIns } from '@/components/checkin/pending';
import type { UserSettings, WorkoutSession } from '@/types';
import { newObservation, type Observation } from '@/health/observation';
import { routeRecord, type RouteLine } from '@/walk/routeRecord';
import { doc, openDb, type Db } from './db';
import { fakeIndexedDB } from './fakeIdb';
import { SCHEMA_VERSION } from './migrate';
import type { StoredRecord } from './records';
import { commitChange, emptySnapshot, prepare } from './snapshot';
import {
  TRANSFER_FORMAT,
  applyImport,
  collect,
  decode,
  deliver,
  deliveryMethod,
  encode,
  planImport,
  openIncidents,
  previewImport,
  toTransferDoc,
  wholeness,
  withDeviceConsent,
  type TransferDoc,
} from './transfer';

const readiness: Readiness = {
  outcome: 'green', modifiers: [], back: 'green', nerveFlag: false, reasons: [], actions: [],
  vigorousLocked: false, capHeavy: false, rpeOnly: true, notices: [],
};

const session: WorkoutSession = {
  id: 'session-1', date: '2026-10-01', dayOfWeek: 'thursday', muscleGroup: 'lower', phase: 'foundation',
  week: 1, status: 'completed', sets: [], startedAt: null, completedAt: null, notes: 'Steady.', totalVolume: 240,
};

const checkIn: CheckInRecord = {
  date: '2026-10-01', urgentSymptoms: false, news: [], sleep: '5to7', energy: 4, readiness,
};

const glucose = (id: string, day: string, value: number): Observation => newObservation({
  id, kind: 'glucose', value, scope: 'pointInTime', source: 'manual', at: `${day}T07:30:00+05:30`,
});

const steps = (id: string, day: string, value: number): Observation => newObservation({
  id, kind: 'steps', value, scope: 'dayTotal', source: 'manual', at: `${day}T22:00:00+05:30`,
});

async function seeded(options: Parameters<typeof fakeIndexedDB>[0] = {}): Promise<Db> {
  const db = await openDb(fakeIndexedDB(options));
  await db.put('observations', [glucose('g1', '2026-10-01', 132), glucose('g2', '2026-10-05', 118), steps('s1', '2026-10-01', 8100)]);
  await db.put('sessions', [session]);
  await db.put('settings', [
    // A device running this build: its start stamps the current schema.
    doc('schemaVersion', SCHEMA_VERSION),
    doc('settings', { theme: 'dark', defaultRestSeconds: 90 }),
    doc('profile', createDefaultProfile({ weightKg: 82 })),
    doc('checkIns', [checkIn]),
    doc('personalRecords', [{ exerciseId: 'goblet-squat', weight: 24, reps: 10, date: '2026-10-01', volume: 240 }]),
    doc('bodyMetrics', [{ date: '2026-10-01', weight: 82, waist: 96, notes: '' }]),
    doc('focusOverrides', { '2026-10-08': 'activeRecovery' }),
  ]);
  return db;
}

/**
 * Every store, so a round trip that loses one is caught (review F12) — minus
 * the commit metadata (`seq`, the `revision` row) that a new commit
 * legitimately moves.
 */
async function dump(db: Db) {
  const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);
  const byKey = (a: { key: string }, b: { key: string }) => a.key.localeCompare(b.key);
  const unstamped = (rows: { id: string; seq?: number }[]) => rows.map(({ seq, ...rest }) => { void seq; return rest; });
  return {
    observations: unstamped(await db.getAll<{ id: string; seq?: number }>('observations')).sort(byId),
    sessions: (await db.getAll<{ id: string }>('sessions')).sort(byId),
    settings: (await db.getAll<{ key: string }>('settings')).filter(row => row.key !== 'revision').sort(byKey),
    content: (await db.getAll<{ key: string }>('content-state')).sort(byKey),
  };
}

describe('collect', () => {
  it('gathers everything on the device into one document', async () => {
    const db = await seeded();
    const result = await collect(db);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const exported = result.value;
    expect(exported.format).toBe(TRANSFER_FORMAT);
    expect(exported.schemaVersion).toBe(SCHEMA_VERSION);
    expect(exported.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}(Z|[+-]\d{2}:\d{2})$/);
    expect(exported.observations.map(o => o.id)).toEqual(['g1', 's1', 'g2']);
    expect(exported.sessions).toEqual([session]);
    expect(exported.checkIns).toEqual([checkIn]);
    expect(exported.settings).toMatchObject({ theme: 'dark' });
    expect(exported.profile).toMatchObject({ weightKg: 82 });
    expect(exported.personalRecords).toHaveLength(1);
    expect(exported.bodyMetrics).toHaveLength(1);
    expect(exported.focusOverrides).toEqual({ '2026-10-08': 'activeRecovery' });
    db.close();
  });

  it('exports a device with nothing on it without inventing anything', async () => {
    const db = await openDb(fakeIndexedDB());
    const result = await collect(db);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.observations).toEqual([]);
      expect(result.value.profile).toBeUndefined();
      expect(result.value.checkIns).toEqual([]);
    }
    db.close();
  });
});

describe('encode and decode', () => {
  it('round-trips through gzip without losing a field', async () => {
    const db = await seeded();
    const collected = await collect(db);
    if (!collected.ok) return expect.unreachable('collect failed');

    const file = await encode(collected.value);
    expect(file.gzip).toBe(true);
    expect(file.name).toMatch(/^fit-strong-health-record-\d{4}-\d{2}-\d{2}\.json\.gz$/);
    expect([file.bytes[0], file.bytes[1]]).toEqual([0x1f, 0x8b]);

    // Every field comes back, and the manifest written with them says the file is whole (H4-02).
    const { manifest, ...back } = await decode(file.bytes) as TransferDoc;
    expect(back).toEqual(collected.value);
    expect(wholeness({ ...back, manifest })).toBe('whole');
    db.close();
  });

  it('compresses, which is the point of doing it at all', async () => {
    const db = await seeded();
    const collected = await collect(db);
    if (!collected.ok) return expect.unreachable('collect failed');
    const plain = new TextEncoder().encode(JSON.stringify(collected.value));
    const file = await encode(collected.value);
    expect(file.bytes.byteLength).toBeLessThan(plain.byteLength);
    db.close();
  });

  it('reads a plain JSON file too, for a hand-edited backup or an older export', async () => {
    const plain = new TextEncoder().encode(JSON.stringify({ format: TRANSFER_FORMAT, version: 1, observations: [] }));
    expect(await decode(plain)).toMatchObject({ format: TRANSFER_FORMAT });
    expect(await decode(plain.buffer as ArrayBuffer)).toMatchObject({ format: TRANSFER_FORMAT });
  });

  it('refuses a file that is not readable at all', async () => {
    await expect(decode(new TextEncoder().encode('{ not json'))).rejects.toThrow(/could not be read/i);
    await expect(decode(new Uint8Array([0x1f, 0x8b, 0x00, 0x01]))).rejects.toThrow(/could not be read/i);
  });
});

describe('previewImport', () => {
  const file = {
    format: TRANSFER_FORMAT,
    version: 1,
    exportedAt: '2026-10-08T09:00:00+05:30',
    schemaVersion: 5,
    observations: [glucose('g1', '2026-10-01', 132), glucose('g9', '2026-10-09', 101), steps('s1', '2026-10-01', 8100)],
    sessions: [session],
    checkIns: [checkIn],
    personalRecords: [{ exerciseId: 'goblet-squat', weight: 24, reps: 10, date: '2026-10-01', volume: 240 }],
    bodyMetrics: [{ date: '2026-10-01', weight: 82, waist: 96, notes: '' }],
    focusOverrides: { '2026-10-08': 'activeRecovery' },
    settings: { theme: 'dark' },
    profile: { weightKg: 82 },
  };

  it('counts what is in the file, per kind, before anything is written', () => {
    const preview = previewImport(file);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.observations).toEqual({ glucose: 2, steps: 1 });
    expect(preview.sessions).toBe(1);
    expect(preview.checkIns).toBe(1);
    expect(preview.personalRecords).toBe(1);
    expect(preview.bodyMetrics).toBe(1);
    expect(preview.focusOverrides).toBe(1);
    expect(preview.hasSettings).toBe(true);
    expect(preview.hasProfile).toBe(true);
    expect(preview.range).toEqual({ from: '2026-10-01', to: '2026-10-09' });
    expect(preview.exportedAt).toBe('2026-10-08T09:00:00+05:30');
  });

  it('says how much of it this device already has', () => {
    const preview = previewImport(file, ['g1', 'nothing-like-it']);
    if (!preview.ok) return expect.unreachable('preview failed');
    expect(preview.alreadyHere).toBe(1);
  });

  it('counts records it cannot read rather than pretending they are fine', () => {
    const preview = previewImport({
      ...file,
      observations: [...file.observations, { id: 'bad', kind: 'glucose', value: 'lots' }, null, { id: 'x', kind: 'nonsense', at: '2026-10-01T07:00:00+05:30', day: '2026-10-01', value: 1, unit: 'mg/dL', scope: 'pointInTime', source: 'manual' }],
    });
    if (!preview.ok) return expect.unreachable('preview failed');
    expect(preview.observations).toEqual({ glucose: 2, steps: 1 });
    expect(preview.unreadableObservations).toBe(3);
  });

  it('refuses a file from another app, or from the future', () => {
    expect(previewImport(null)).toMatchObject({ ok: false });
    expect(previewImport('a string')).toMatchObject({ ok: false });
    expect(previewImport({ format: 'something-else', version: 1 })).toMatchObject({ ok: false });
    expect(previewImport({ format: TRANSFER_FORMAT, version: 99 })).toMatchObject({ ok: false });
    expect(previewImport({ format: TRANSFER_FORMAT, version: 99 })).toMatchObject({ reason: expect.stringMatching(/newer/i) });
  });

  it('accepts a file with nothing in it, and says it is empty', () => {
    const preview = previewImport({ format: TRANSFER_FORMAT, version: 1 });
    if (!preview.ok) return expect.unreachable('preview failed');
    expect(preview.observations).toEqual({});
    expect(preview.range).toBeUndefined();
    expect(preview.isEmpty).toBe(true);
  });

  it('a file with health answers and settings but no readings is not empty, and restores them (D-07)', async () => {
    const answers = { format: TRANSFER_FORMAT, version: 1, settings: { onboardingComplete: true, theme: 'dark' }, profile: { weightKg: 64 } };
    const preview = previewImport(answers);
    if (!preview.ok) return expect.unreachable('preview failed');
    expect(preview.isEmpty).toBe(false);
    expect(previewImport({ format: TRANSFER_FORMAT, version: 1, profile: { weightKg: 64 } })).toMatchObject({ isEmpty: false });
    const { emptySnapshot } = await import('./snapshot');
    const { change } = planImport(answers, 'replace', emptySnapshot());
    expect(change.profile?.weightKg).toBe(64);
    expect(change.settings?.replace?.theme).toBe('dark');
  });
});

describe('applyImport', () => {
  const incoming = {
    format: TRANSFER_FORMAT,
    version: 1,
    exportedAt: '2026-10-08T09:00:00+05:30',
    schemaVersion: 5,
    observations: [glucose('g1', '2026-10-01', 999), glucose('g9', '2026-10-09', 101)],
    sessions: [{ ...session, id: 'session-9', date: '2026-10-09' }],
    checkIns: [{ ...checkIn, date: '2026-10-09' }],
    personalRecords: [{ exerciseId: 'bench-press', weight: 60, reps: 5, date: '2026-10-09', volume: 300 }],
    bodyMetrics: [{ date: '2026-10-09', weight: 81, waist: null, notes: '' }],
    focusOverrides: { '2026-10-09': 'upperA' },
    settings: { theme: 'light' },
    profile: { weightKg: 70 },
  };

  it('replaces: the device ends up holding exactly what the file held', async () => {
    const db = await seeded();
    const result = await applyImport(db, incoming, 'replace');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.mode).toBe('replace');
    expect(result.value.observations).toBe(2);

    expect((await db.getAll<Observation>('observations')).map(o => o.id).sort()).toEqual(['g1', 'g9']);
    expect((await db.getAll<WorkoutSession>('sessions')).map(s => s.id)).toEqual(['session-9']);
    // A partial profile is completed on the way in, so the planner never meets
    // one missing fields (review F22).
    expect(await db.get('settings', 'profile')).toMatchObject({ value: { weightKg: 70 } });
    expect(await db.get<{ value: { trainingDays: unknown[] } }>('settings', 'profile')).toMatchObject({ value: { trainingDays: expect.any(Array) } });
    expect(await db.get('settings', 'schemaVersion')).toEqual(doc('schemaVersion', SCHEMA_VERSION));
    expect(await db.get('settings', 'focusOverrides')).toEqual(doc('focusOverrides', { '2026-10-09': 'upperA' }));
    db.close();
  });

  // A clash with no way to tell which copy is newer keeps this device's
  // record unless the user says otherwise (review F08).
  it('merges: the file is added, and a clash keeps this device\'s record unless told otherwise', async () => {
    const db = await seeded();
    const result = await applyImport(db, incoming, 'merge');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // g9, plus the weight series of the file's new 9 October measurement (F14).
    expect(result.value.observations).toBe(2);
    expect(result.value.replacedObservations).toBe(0);
    expect(result.value.conflicts?.observations).toBe(1);

    const observations = await db.getAll<Observation>('observations');
    expect(observations.map(o => o.id).sort()).toEqual(['bodyMetric:2026-10-09:weight', 'g1', 'g2', 'g9', 's1']);
    expect(observations.find(o => o.id === 'g1')?.value).toBe(132);
    expect(observations.find(o => o.id === 'bodyMetric:2026-10-09:weight')?.value).toBe(81);

    const told = await applyImport(db, incoming, 'merge', { onConflict: 'takeFile' });
    expect(told.ok && told.value.replacedObservations).toBe(1);
    expect((await db.get<Observation>('observations', 'g1'))?.value).toBe(999);

    expect((await db.getAll<WorkoutSession>('sessions')).map(s => s.id).sort()).toEqual(['session-1', 'session-9']);
    expect(await db.get('settings', 'checkIns')).toMatchObject({ value: [checkIn, { date: '2026-10-09' }] });
    expect(await db.get<{ value: unknown[] }>('settings', 'personalRecords')).toMatchObject({ value: [{ exerciseId: 'goblet-squat' }, { exerciseId: 'bench-press' }] });
    expect(await db.get('settings', 'focusOverrides')).toEqual(doc('focusOverrides', { '2026-10-08': 'activeRecovery', '2026-10-09': 'upperA' }));
    db.close();
  });

  it('merges without overwriting this device\'s own settings and profile', async () => {
    const db = await seeded();
    await applyImport(db, incoming, 'merge');
    expect(await db.get('settings', 'settings')).toMatchObject({ value: { theme: 'dark' } });
    expect(await db.get('settings', 'profile')).toMatchObject({ value: { weightKg: 82 } });
    db.close();
  });

  // A personal record is a historical maximum, so taking a lower imported
  // value would delete a lift the user actually did.
  it('keeps the heavier of two personal records for the same exercise', async () => {
    const db = await seeded();
    await applyImport(db, {
      ...incoming,
      personalRecords: [
        { exerciseId: 'goblet-squat', weight: 20, reps: 8, date: '2026-09-01', volume: 160 },
        { exerciseId: 'bench-press', weight: 60, reps: 5, date: '2026-10-09', volume: 300 },
      ],
    }, 'merge');
    expect(await db.get('settings', 'personalRecords')).toMatchObject({
      value: [{ exerciseId: 'goblet-squat', volume: 240 }, { exerciseId: 'bench-press', volume: 300 }],
    });
    db.close();
  });

  it('takes the file\'s personal record when it is the heavier one', async () => {
    const db = await seeded();
    await applyImport(db, {
      ...incoming,
      personalRecords: [{ exerciseId: 'goblet-squat', weight: 32, reps: 10, date: '2026-10-09', volume: 320 }],
    }, 'merge');
    expect(await db.get('settings', 'personalRecords')).toMatchObject({ value: [{ exerciseId: 'goblet-squat', volume: 320 }] });
    db.close();
  });

  it('adopts the file\'s profile when this device has none yet', async () => {
    const db = await openDb(fakeIndexedDB());
    await applyImport(db, incoming, 'merge');
    expect(await db.get('settings', 'profile')).toMatchObject({ value: { weightKg: 70 } });
    db.close();
  });

  // A damaged file is refused whole unless the user asks for the readable
  // rest: it must never half-replace a good record (review F22).
  it('leaves out records it cannot read only when asked, and says how many', async () => {
    const db = await seeded();
    const damaged = { ...incoming, observations: [...incoming.observations, { id: 'bad', kind: 'glucose', value: 'lots' }] };

    const refused = await applyImport(db, damaged, 'replace');
    expect(refused.ok).toBe(false);
    expect((await db.getAll<Observation>('observations')).map(o => o.id).sort()).toEqual(['g1', 'g2', 's1']);

    const result = await applyImport(db, damaged, 'replace', { allowRejected: true });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.skipped).toBe(1);
    expect((await db.getAll<Observation>('observations')).map(o => o.id).sort()).toEqual(['g1', 'g9']);
    db.close();
  });

  // The engine reads every red flag a day carries by its name, so a name this
  // build does not know would stop the day being worked out at all (R5-01).
  it('refuses a check-in holding an earlier flag it does not know, before writing anything', async () => {
    const db = await seeded();
    const before = await dump(db);
    const flagged = (flagsEarlier: unknown) => ({ ...incoming, checkIns: [{ ...checkIn, date: '2026-10-09', flagsEarlier }] });
    for (const bad of [['newWeakness', 'chestPain'], 'newWeakness', [7]]) {
      expect(previewImport(flagged(bad))).toMatchObject({ ok: true, checkIns: 0, rejected: { checkIns: 1 } });
      expect((await applyImport(db, flagged(bad), 'replace')).ok).toBe(false);
      expect(await dump(db)).toEqual(before);
    }
    // Asked to, the readable rest comes in without that day.
    const rest = await applyImport(db, flagged(['chestPain']), 'merge', { allowRejected: true });
    expect(rest.ok && rest.value.skipped).toBe(1);
    expect(await db.get('settings', 'checkIns')).toEqual(doc('checkIns', [checkIn]));
    // Every flag this build names reads back.
    expect(previewImport(flagged(['newWeakness', 'backFever', 'backSudden', 'footProblem', 'hotSwollenFoot'])))
      .toMatchObject({ ok: true, checkIns: 1, rejected: { checkIns: 0 } });
    db.close();
  });

  // Each of these is read on its day and every day after, by every gate,
  // with nothing to catch a wrong shape; an answer this build does not know
  // would settle a serious reading it names (R5-01).
  it('refuses a check-in holding any other answer it cannot read, before writing anything', async () => {
    const db = await seeded();
    const before = await dump(db);
    const at = '2026-10-09T10:00:00+05:30';
    const answer = { kind: 'extremeGlucose', readings: ['g:2026-10-09T08:00:00+05:30:650mg/dL'], resolution: 'mistake', at };
    const unreadable: [string, unknown][] = [
      ['resolutions', answer], ['resolutions', [null]], ['resolutions', [{ ...answer, readings: undefined }]],
      ['resolutions', [{ ...answer, readings: 'g' }]], ['resolutions', [{ ...answer, readings: [5] }]],
      ['resolutions', [{ ...answer, resolution: 'gone' }]], ['resolutions', [{ ...answer, kind: 'mood' }]], ['resolutions', [{ ...answer, at: undefined }]],
      ['news', undefined], ['newsEarlier', 5], ['newsEarlier', 'fainted'],
      ['provoked', 'brisk-walking'], ['provoked', [5]],
      // Read as true or false, a word would say the opposite: recovered from a low.
      ['lowRecovered', 'no'],
      // Each of these would leave a decision less strict than the field missing would (R5-01).
      // An emergency answer this build cannot name would count as "None of these".
      ['emergency', ['seizure']], ['emergency', [null]],
      // Any value at all says the newer question was asked, and silences an older record's weakness.
      ['back', { pain: 2, newNeuro: true, newWeakness: 'yes' }], ['back', { pain: 2, newNeuro: true, newSensory: null }],
      // A time that is not an instant is read as some other moment: an answer not today's (a reading's own time is below).
      ['resolutions', [{ ...answer, at: 'not a time' }]], ['lowSymptomsAt', '5'],
      // What the day's details show of the suggestion made at the time.
      ['readiness', { ...readiness, reasons: undefined }], ['readiness', { ...readiness, reasons: [null] }],
    ];
    const day = (field: string, value: unknown) => ({ ...incoming, checkIns: [{ ...checkIn, date: '2026-10-09', [field]: value }] });
    for (const [field, value] of unreadable) {
      expect(previewImport(day(field, value)), `${field}: ${JSON.stringify(value)}`).toMatchObject({ ok: true, checkIns: 0, rejected: { checkIns: 1 } });
      expect((await applyImport(db, day(field, value), 'replace')).ok).toBe(false);
    }
    expect(await dump(db)).toEqual(before);
    // Asked to, the readable rest comes in without that day.
    const rest = await applyImport(db, day('resolutions', [{ ...answer, readings: undefined }]), 'merge', { allowRejected: true });
    expect(rest.ok && rest.value.skipped).toBe(1);
    expect(await db.get('settings', 'checkIns')).toEqual(doc('checkIns', [checkIn]));
    db.close();
  });

  // A reading this app cannot read is never left out quietly, since a
  // dangerous one would go with it: the whole file is refused, saying which
  // day holds what, so the person knows it is damaged.
  it('refuses a whole file holding a reading it cannot read, and says which', async () => {
    const db = await seeded();
    const before = await dump(db);
    const at = '2026-10-09T08:30:00+05:30';
    const cases: [string, unknown, string][] = [
      ['glucose', { value: 120, unit: 'mmol', measuredAt: at }, 'a glucose reading in a unit this app does not know ("mmol")'],
      ['glucose', { value: '120', unit: 'mg/dL', measuredAt: at }, 'a glucose reading whose number cannot be read'],
      ['glucose', { value: 120, unit: 'mg/dL', measuredAt: '2026-10-09T08:00' }, 'a glucose reading whose time cannot be read'],
      ['glucoseDisplay', { display: 'Hi', measuredAt: at }, 'a glucose meter display other than HI or LO ("Hi")'],
      ['glucoseDisplay', { display: 'LO', measuredAt: '5' }, 'a glucose meter display whose time cannot be read'],
      ['glucoseEarlier', [{ value: 650, unit: 'MG/DL', measuredAt: at }], 'a glucose reading in a unit this app does not know ("MG/DL")'],
      ['glucoseEarlier', [{ value: 650, unit: 'mg/dL', measuredAt: '2001' }], 'a glucose reading whose time cannot be read'],
      ['glucoseEarlier', 'high', 'a glucose reading this app cannot read'],
      // The engine reads a display before a number, so one holding both is not the number it says (N-07).
      ['glucose', { value: 650, unit: 'mg/dL', display: 'XX', measuredAt: at }, 'a glucose reading that is both a number and a meter display'],
      ['glucoseDisplay', { display: 'HI', value: 650, unit: 'mg/dL', measuredAt: at }, 'a glucose reading that is both a number and a meter display'],
      ['glucoseEarlier', [{ value: 120, unit: 'mg/dL', display: 'XX', measuredAt: at }], 'a glucose reading that is both a number and a meter display'],
      ['ketones', { kind: 'saliva', value: 3.5, measuredAt: at }, 'a ketone reading of a kind this app does not know ("saliva")'],
      ['ketones', { kind: 'blood', value: 'high', measuredAt: at }, 'a blood ketone reading whose number cannot be read'],
      ['ketones', { kind: 'blood', value: 3.5, measuredAt: 5 }, 'a ketone reading whose time cannot be read'],
      ['ketonesEarlier', [{ kind: 'urine', category: 'lots', measuredAt: at }], 'a urine ketone strip reading this app does not know ("lots")'],
      ['ketonesEarlier', [{ kind: 'urine', value: 'x' }], 'a urine ketone strip reading whose number cannot be read'],
      // A strip read is a colour, or before v5 the number for it: one with neither has no result (N-07).
      ['ketones', { kind: 'urine', measuredAt: at }, 'a urine ketone strip reading with no result'],
      ['ketonesEarlier', [{ kind: 'urine' }], 'a urine ketone strip reading with no result'],
      ['ketonesEarlier', [null], 'a ketone reading this app cannot read'],
      ['ketonesEarlier', 'large', 'a ketone reading this app cannot read'],
      ['bp', { sys: 185, dia: null }, 'a blood pressure reading whose numbers cannot be read'],
      ['bpReadings', [{ sys: '190', dia: 125, at }], 'a blood pressure reading whose numbers cannot be read'],
      ['bpReadings', [{ sys: 185, dia: 125, at: '5' }], 'a blood pressure reading whose time cannot be read'],
      ['bpEarlier', [{ sys: 185, dia: 125, at: '2001' }], 'a blood pressure reading whose time cannot be read'],
      ['bpPartial', [{ dia: 'high', at }], 'a blood pressure reading whose numbers cannot be read'],
      ['bpPartial', [{ sys: 200, at: '5' }], 'a blood pressure reading whose time cannot be read'],
      // A partial reading is one number with the other box empty, never neither (N-07).
      ['bpPartial', [{ at }], 'a blood pressure reading with no numbers in it'],
      // The reading that completed a half is a whole reading, and read as one.
      ['bpPartial', [{ sys: 200, at, completion: { sys: 200, dia: 'high', at } }], 'a blood pressure reading whose numbers cannot be read'],
      ['bpPartial', [{ sys: 200, at, completion: { sys: 200, at } }], 'a blood pressure reading whose numbers cannot be read'],
      ['bpPartial', [{ sys: 200, at, completion: { sys: 200, dia: 120, at: '5' } }], 'a blood pressure reading whose time cannot be read'],
      ['bpPartial', [{ sys: 200, at, completion: 'done' }], 'a blood pressure reading this app cannot read'],
      // What Track attached, as a save before P-01 kept it: read as the readings it is, before it is folded in.
      ['logged', { glucose: 'high' }, 'a glucose reading this app cannot read'],
      ['logged', { bp: [null] }, 'a blood pressure reading this app cannot read'],
      ['logged', { glucose: [{ value: 110, unit: 'mmol', measuredAt: at }] }, 'a glucose reading in a unit this app does not know ("mmol")'],
      ['logged', 'high', 'readings from Track this app cannot read'],
      ['bpPartial', [null], 'a blood pressure reading this app cannot read'],
      ['bpPartial', { sys: 200, at }, 'a blood pressure reading this app cannot read'],
    ];
    const day = (field: string, value: unknown) => ({ ...incoming, checkIns: [{ ...checkIn, date: '2026-10-09', [field]: value }] });
    for (const [field, value, said] of cases) {
      const reason = `That file's check-in for 2026-10-09 holds ${said}. It may be damaged.`;
      expect(previewImport(day(field, value)), `${field}: ${JSON.stringify(value)}`).toEqual({ ok: false, reason });
      // Not even to bring in the rest: leaving the day out would leave the reading out with it.
      for (const mode of ['replace', 'merge'] as const) {
        const applied = await applyImport(db, day(field, value), mode, { allowRejected: true });
        expect(applied.ok ? 'imported' : applied.failure.message).toBe(reason);
      }
    }
    // A session's own copy of its day's check-in is read the same way.
    const kept = { ...incoming, sessions: [{ ...session, id: 'session-9', checkIn: { ...checkIn, ketones: { kind: 'urine', category: 'lots' } } }] };
    expect(previewImport(kept)).toEqual({ ok: false, reason: 'That file\'s check-in for 2026-10-01 holds a urine ketone strip reading this app does not know ("lots"). It may be damaged.' });
    expect(await dump(db)).toEqual(before);
    db.close();
  });

  // A half-entered number stands for its measurement until the reading that
  // completed it does (B07, N-04): a link it could never have had would let a
  // severe number go unread (Q-02).
  it('refuses a whole file whose blood pressure half is linked to a reading that could not have completed it', async () => {
    const db = await seeded();
    const before = await dump(db);
    const at = (time: string) => `2026-10-09T${time}:00+05:30`;
    const day = (readings: { sys: number; dia: number; at?: string }[], completion: object, half: object = { sys: 190, at: at('09:10') }) => ({ ...incoming,
      checkIns: [{ ...checkIn, date: '2026-10-09', bpReadings: readings, bp: { sys: readings[0].sys, dia: readings[0].dia }, bpPartial: [{ ...half, completion }] }] });
    const notHeld = 'a blood pressure number linked to a reading the day does not hold';
    const otherNumbers = 'a blood pressure number linked to a reading without that number';
    const impossible: [string, object, string][] = [
      ['to the day’s normal reading, taken before it', day([{ sys: 120, dia: 80, at: at('09:00') }], { sys: 120, dia: 80, at: at('09:00') }), otherNumbers],
      ['to a reading the day does not hold', day([{ sys: 185, dia: 125, at: at('09:20') }], { sys: 190, dia: 100, at: at('09:20') }), notHeld],
      ['to a reading without the time the day’s has', day([{ sys: 190, dia: 100, at: at('09:12') }], { sys: 190, dia: 100 }), notHeld],
      ['to a reading without its top number', day([{ sys: 120, dia: 80, at: at('09:12') }], { sys: 120, dia: 80, at: at('09:12') }), otherNumbers],
      ['to a reading without its bottom number', day([{ sys: 150, dia: 95, at: at('09:12') }], { sys: 150, dia: 95, at: at('09:12') }, { dia: 125, at: at('09:10') }), otherNumbers],
      ['to a reading with no time', day([{ sys: 190, dia: 100 }], { sys: 190, dia: 100 }), 'a blood pressure number linked to a reading with no time'],
      ['to a reading taken before it', day([{ sys: 190, dia: 100, at: at('09:00') }], { sys: 190, dia: 100, at: at('09:00') }), 'a blood pressure number linked to a reading taken before it'],
    ];
    for (const [link, raw, said] of impossible) {
      const reason = `That file's check-in for 2026-10-09 holds ${said}. It may be damaged.`;
      expect(previewImport(raw), link).toEqual({ ok: false, reason });
      for (const mode of ['replace', 'merge'] as const) {
        const applied = await applyImport(db, raw, mode, { allowRejected: true });
        expect(applied.ok ? 'imported' : applied.failure.message, `${link} ${mode}`).toBe(reason);
      }
    }
    expect(await dump(db)).toEqual(before);
    // As the app links them (Q-01): the reading that completed the half in
    // its own row, taken with it or after it, by either number, and found as
    // the engine finds it, by the instant it was taken; a half saved with no
    // time, whenever its reading was taken; and an older record's one
    // reading, kept only as the day's summary. Each comes back as it was.
    const completion = { sys: 190, dia: 100, at: at('09:12') };
    for (const raw of [
      day([{ sys: 190, dia: 100, at: at('09:12') }], completion),
      day([{ sys: 190, dia: 100, at: at('09:12') }], { ...completion, at: '2026-10-09T03:42:00.000Z' }),
      day([{ sys: 190, dia: 100, at: at('09:10') }], { sys: 190, dia: 100, at: at('09:10') }),
      day([{ sys: 150, dia: 125, at: at('09:12') }], { sys: 150, dia: 125, at: at('09:12') }, { dia: 125, at: at('09:10') }),
      day([{ sys: 190, dia: 100, at: at('09:12') }], completion, { sys: 190 }),
      { ...incoming, checkIns: [{ ...checkIn, date: '2026-10-09', bp: completion, bpPartial: [{ sys: 190, at: at('09:10'), completion }] }] },
    ]) {
      expect(previewImport(raw)).toMatchObject({ ok: true, checkIns: 1, rejected: { checkIns: 0 } });
      for (const mode of ['replace', 'merge'] as const) {
        expect((await applyImport(db, raw, mode)).ok, mode).toBe(true);
        expect(await db.get('settings', 'checkIns'), mode).toMatchObject({ value: [{ bpPartial: raw.checkIns[0].bpPartial }] });
      }
    }
    db.close();
  });

  it('reads back a check-in holding every answer as the app writes it', () => {
    const at = '2026-10-09T08:30:00+05:30';
    const answer = { kind: 'extremeGlucose', readings: [`g:${at}:650mg/dL`], resolution: 'mistake', at };
    const full = {
      ...checkIn, date: '2026-10-09', urgentSymptoms: true, emergency: ['chest'], news: ['unwell'],
      // A pain slider left untouched is not an answer, so back answers can come without a score (J03, J16).
      back: { newNeuro: true, newWeakness: true, weaknessFast: false, newSensory: false, feverish: false, suddenSevere: false, worseFunction: false },
      glucoseEarlier: [{ value: 650, unit: 'mg/dL', measuredAt: at }, { value: 5.4, unit: 'mmol/L', measuredAt: at }, { display: 'LO', measuredAt: at }],
      glucose: { value: 120, unit: 'mg/dL', measuredAt: at }, glucoseDisplay: { display: 'HI', measuredAt: at },
      ketones: { kind: 'blood', value: 0.4, measuredAt: at }, ketonesEarlier: [{ kind: 'urine', category: 'small', measuredAt: at }, { kind: 'urine', value: 15 }],
      bpPartial: [{ sys: 200, at }, { dia: 125, at }, { sys: 190, at, completion: { sys: 190, dia: 100, at } }], bpEarlier: [{ sys: 190, dia: 100, at }],
      provoked: ['brisk-walking'], flagsEarlier: ['newWeakness'], newsEarlier: ['fainted'],
      lowSymptomsAt: '2026-10-09T03:00:00.000Z', lowRecovered: true, bpReadings: [{ sys: 150, dia: 95, at: '2026-10-09T03:05:00.000Z' }],
      resolutions: [answer, { ...answer, resolution: 'reopened', at: '2026-10-09T09:00:00+05:30' }, { kind: 'redFlag', readings: ['flag:newWeakness@2026-10-09'], resolution: 'assessed', at },
        { kind: 'news', readings: ['news:fainted@2026-10-09'], resolution: 'mistake', at }],
    };
    expect(previewImport({ ...incoming, checkIns: [full] })).toMatchObject({ ok: true, checkIns: 1, rejected: { checkIns: 0 } });
    // As a report during a session leaves it: what was said, and no score.
    expect(previewImport({ ...incoming, checkIns: [{ ...checkIn, date: '2026-10-09', back: { spreadToday: true } }] })).toMatchObject({ checkIns: 1 });
    // Every emergency answer this build names reads back.
    const emergency = ['chest', 'stroke', 'collapse', 'breathless', 'bladderBowel', 'saddle', 'bothLegs', 'lowCantTreat', 'dka', 'accident', 'heatConfusion'];
    expect(previewImport({ ...incoming, checkIns: [{ ...checkIn, date: '2026-10-09', urgentSymptoms: true, emergency }] })).toMatchObject({ checkIns: 1 });
  });

  it('refuses a file it does not understand, before writing anything', async () => {
    const db = await seeded();
    const before = await dump(db);
    const result = await applyImport(db, { format: 'something-else' }, 'replace');
    expect(result.ok).toBe(false);
    expect(await dump(db)).toEqual(before);
    db.close();
  });

  it('reports a full device instead of half-importing', async () => {
    const db = await openDb(fakeIndexedDB({ quotaAfter: 1 }));
    const result = await applyImport(db, incoming, 'replace');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('quotaExceeded');
    expect(await db.getAll('observations')).toEqual([]);
    db.close();
  });

  it('survives the whole journey: export here, import there', async () => {
    const source = await seeded();
    const collected = await collect(source);
    if (!collected.ok) return expect.unreachable('collect failed');
    const file = await encode(collected.value);

    const target = await openDb(fakeIndexedDB());
    const applied = await applyImport(target, await decode(file.bytes), 'replace');
    expect(applied.ok).toBe(true);
    expect(await dump(target)).toEqual(await dump(source));
    source.close();
    target.close();
  });
});

// D17: no File System Access and no Share Target on iOS, so a round trip is
// always an explicit user action — and it has to work when sharing does not.
describe('delivering the file', () => {
  const file = new File([new Uint8Array([1, 2, 3])], 'record.json.gz', { type: 'application/gzip' });

  it('shares when the browser will share a file, and downloads when it will not', () => {
    const sharing = { canShare: () => true, share: async () => undefined } as unknown as Navigator;
    expect(deliveryMethod(file, sharing)).toBe('share');
    expect(deliveryMethod(file, { share: async () => undefined } as unknown as Navigator)).toBe('download');
    expect(deliveryMethod(file, { canShare: () => false, share: async () => undefined } as unknown as Navigator)).toBe('download');
    expect(deliveryMethod(file, undefined)).toBe('download');
  });

  it('shares the file', async () => {
    const shared: unknown[] = [];
    const result = await deliver(file, {
      navigator: { canShare: () => true, share: async (data: unknown) => void shared.push(data) } as unknown as Navigator,
    });
    expect(result).toEqual({ ok: true, value: 'share' });
    expect(shared).toEqual([{ files: [file] }]);
  });

  it('reports a cancelled share as cancelled, not as a failure', async () => {
    const result = await deliver(file, {
      navigator: {
        canShare: () => true,
        share: async () => { throw new DOMException('cancelled', 'AbortError'); },
      } as unknown as Navigator,
    });
    expect(result).toEqual({ ok: true, value: 'cancelled' });
  });

  it('falls back to a download when sharing fails for any other reason', async () => {
    const clicks: string[] = [];
    const result = await deliver(file, {
      navigator: { canShare: () => true, share: async () => { throw new Error('no'); } } as unknown as Navigator,
      document: fakeDocument(clicks),
      createObjectURL: () => 'blob:x',
      revokeObjectURL: () => undefined,
    });
    expect(result).toEqual({ ok: true, value: 'download' });
    expect(clicks).toEqual(['record.json.gz@blob:x']);
  });

  it('downloads through a link when there is no share sheet', async () => {
    const clicks: string[] = [];
    const result = await deliver(file, { document: fakeDocument(clicks), createObjectURL: () => 'blob:y', revokeObjectURL: () => undefined });
    expect(result).toEqual({ ok: true, value: 'download' });
    expect(clicks).toEqual(['record.json.gz@blob:y']);
  });

  it('says it cannot hand over the file rather than doing nothing', async () => {
    const result = await deliver(file, {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.message).toMatch(/could not/i);
  });
});

function fakeDocument(clicks: string[]): Document {
  return {
    createElement: () => {
      const link = { href: '', download: '', rel: '', click: () => clicks.push(`${link.download}@${link.href}`) };
      return link as unknown as HTMLAnchorElement;
    },
  } as unknown as Document;
}

describe('v2 record stores in a backup (Plan 6 Task 1)', () => {
  const LINE: RouteLine = { start: 1_760_000_000_000, end: 1_760_000_020_000, coords: [[12.97, 77.59], [12.9705, 77.5902], [12.971, 77.5905]], ms: [0, 10_000, 20_000] };
  const route = (walkId: string, shift = 0): StoredRecord => routeRecord(walkId, '2026-10-08T09:00:00.000+05:30',
    [{ ...LINE, coords: LINE.coords.map(([a, b]): [number, number] => [a + shift, b]) }])! as unknown as StoredRecord;
  const file = (over: Partial<TransferDoc> = {}) => ({ ...toTransferDoc(emptySnapshot()), ...over });
  const withRoutes = (...routes: StoredRecord[]) => file({ stores: ['routes'], records: { routes } });
  /** A phone that said Yes to keeping routes: the only kind that takes a file's (H6-05). */
  const yes = prepare(emptySnapshot(), { settings: { patch: { walk: { saveRoutes: true, map: 'off' } } } }).next;
  const holding = (...routes: StoredRecord[]) => prepare(yes, { records: { routes: { put: routes } } }).next;
  const south = (r: StoredRecord) => (r.bbox as number[])[0];

  it('leaves routes out unless they are included, and lists the stores it holds', () => {
    const snap = holding(route('walk-aaaa'));
    expect(toTransferDoc(snap).stores).toEqual(['meals', 'savedMeals', 'customFoods']);
    expect(toTransferDoc(snap).records?.routes).toBeUndefined();
    expect(toTransferDoc(snap, undefined, { include: ['routes'] }).records?.routes).toHaveLength(1);
  });

  it('never leaves out a store every backup holds when routes are included, and holds exactly the stores it lists', () => {
    const snap = holding(route('walk-aaaa'));
    for (const doc of [toTransferDoc(snap), toTransferDoc(snap, undefined, { include: ['routes'] })]) {
      expect(Object.keys(doc.records ?? {})).toEqual(doc.stores);
    }
    expect(toTransferDoc(snap, undefined, { include: ['routes'] }).stores).toEqual(['routes', 'meals', 'savedMeals', 'customFoods']);
  });

  it('never carries the walk journal: it is recovery state, not the record', async () => {
    const db = await openDb(fakeIndexedDB());
    const written = await commitChange(db, undefined, () => ({
      change: { records: { routes: { put: [route('walk-aaaa')] } }, journal: { put: [{ id: 'walk-aaaa', marker: 'journal-only' } as { id: string }] } },
    }));
    expect(written.ok).toBe(true);
    expect(await db.getAll('walkJournal')).toHaveLength(1);
    const collected = await collect(db, { include: ['routes'] });
    if (!collected.ok) return expect.unreachable('collect failed');
    expect(collected.value.records?.routes).toHaveLength(1);
    expect(JSON.stringify(collected.value)).not.toMatch(/walkJournal|journal-only/);
    db.close();
  });

  it('restores routes exactly with Replace', () => {
    const plan = planImport(withRoutes(route('walk-aaaa')), 'replace', yes);
    expect(prepare(yes, plan.change).next.records.routes).toEqual([route('walk-aaaa')]);
    expect(plan.report.records).toEqual({ routes: 1 });
  });

  it('merges by walk: a new route is added, and a different copy is a conflict that keeps this phone’s unless told', () => {
    const here = holding(route('walk-aaaa'));
    const plan = planImport(withRoutes(route('walk-aaaa', 0.01), route('walk-bbbb')), 'merge', here);
    expect(plan.report.conflicts?.routes).toBe(1);
    const merged = prepare(here, plan.change).next.records.routes;
    expect(merged.map(r => r.walkId)).toEqual(['walk-aaaa', 'walk-bbbb']);
    expect(south(merged[0])).toBe(12.97);
    const taken = prepare(here, planImport(withRoutes(route('walk-aaaa', 0.01)), 'merge', here, { onConflict: 'takeFile' }).change).next.records.routes;
    expect(south(taken[0])).toBeCloseTo(12.98, 9);
  });

  it('never brings back a route deleted here, learns the file’s deletions, and never lets one remove a route held here', () => {
    const deleted = prepare(holding(route('walk-aaaa')), { records: { routes: { remove: ['walk-aaaa'] } } }).next;
    expect(prepare(deleted, planImport(withRoutes(route('walk-aaaa')), 'merge', deleted).change).next.records.routes).toEqual([]);
    expect(previewImport(withRoutes(route('walk-aaaa')), deleted)).toMatchObject({ ok: true, deletedHere: 1 });
    const told = file({ settings: { deleted: { records: { routes: ['walk-cccc'] } } } as UserSettings });
    expect(prepare(deleted, planImport(told, 'merge', deleted).change).next.settings?.deleted?.records?.routes).toEqual(['walk-aaaa', 'walk-cccc']);
    const kept = holding(route('walk-dddd'));
    const deleting = file({ settings: { deleted: { records: { routes: ['walk-dddd'] } } } as UserSettings });
    expect(prepare(kept, planImport(deleting, 'merge', kept).change).next.records.routes).toHaveLength(1);
    // Nor is a route held here learned as deleted, on a phone with settings of its own.
    const set = prepare(kept, { settings: { patch: { theme: 'light' } } }).next;
    const merged = prepare(set, planImport(deleting, 'merge', set).change).next;
    expect(merged.records.routes).toHaveLength(1);
    expect(merged.settings?.deleted?.records?.routes ?? []).not.toContain('walk-dddd');
  });

  it('keeps every deletion this phone remembers when a merge teaches it others', () => {
    const deleted = prepare(holding(route('walk-aaaa')), { records: { routes: { remove: ['walk-aaaa'] } } }).next;
    const teaching = file({ settings: { deleted: { observations: ['g-old'] } } as UserSettings });
    const merged = prepare(deleted, planImport(teaching, 'merge', deleted).change).next;
    expect(merged.settings?.deleted).toMatchObject({ observations: ['g-old'], records: { routes: ['walk-aaaa'] } });
    expect(prepare(merged, planImport(withRoutes(route('walk-aaaa')), 'merge', merged).change).next.records.routes).toEqual([]);
  });

  it('counts a file holding only routes as something to restore', () => {
    expect(previewImport(withRoutes(route('walk-aaaa')))).toMatchObject({ ok: true, isEmpty: false, records: { routes: 1 } });
    expect(previewImport(file())).toMatchObject({ ok: true, isEmpty: true });
  });

  it('refuses a damaged route unless asked to import the rest', () => {
    const damaged = withRoutes(route('walk-aaaa'), { ...route('walk-bbbb'), bbox: [0, 0, 1, 1] });
    expect(previewImport(damaged)).toMatchObject({ ok: true, rejected: { routes: 1 } });
    expect(() => planImport(damaged, 'merge', yes)).toThrow(/could not be read/);
    const rest = planImport(damaged, 'merge', yes, { allowRejected: true });
    expect(prepare(yes, rest.change).next.records.routes.map(r => r.walkId)).toEqual(['walk-aaaa']);
  });

  it('keeps the first of two routes for one walk in a file, and refuses the second', () => {
    const twice = withRoutes(route('walk-aaaa'), route('walk-aaaa', 0.01));
    expect(previewImport(twice)).toMatchObject({ ok: true, records: { routes: 1 }, rejected: { routes: 1 } });
    const rest = planImport(twice, 'replace', yes, { allowRejected: true });
    expect(prepare(yes, rest.change).next.records.routes.map(south)).toEqual([12.97]);
  });

  it('refuses a store this build does not know, and more routes than a lifetime holds, before reading them', () => {
    expect(previewImport(file({ stores: ['routes', 'diaries'] as never }))).toMatchObject({ ok: false, reason: expect.stringMatching(/cannot read/) });
    const huge = withRoutes(...Array.from({ length: 100_001 }, () => ({}) as StoredRecord));
    expect(previewImport(huge)).toMatchObject({ ok: false, reason: expect.stringMatching(/more routes/) });
  });

  it('refuses a file whose records are damaged rather than reading a named store as empty', () => {
    expect(previewImport(file({ stores: ['routes'], records: {} }))).toMatchObject({ ok: false, reason: expect.stringMatching(/walk routes are not a list/) });
    expect(previewImport(file({ stores: ['routes'], records: 'damaged' as never }))).toMatchObject({ ok: false, reason: expect.stringMatching(/records are not readable/) });
    expect(previewImport(file({ stores: 'routes' as never }))).toMatchObject({ ok: false, reason: expect.stringMatching(/cannot read/) });
  });

  it('adds no routes to a phone that said No to keeping them, and says so first (Review Focus 4)', () => {
    const no = prepare(emptySnapshot(), { settings: { patch: { walk: { saveRoutes: false, map: 'off' } } } }).next;
    expect(previewImport(withRoutes(route('walk-aaaa')), no)).toMatchObject({ ok: true, records: { routes: 1 }, refusedStores: ['routes'] });
    expect(prepare(no, planImport(withRoutes(route('walk-aaaa')), 'merge', no).change).next.records.routes).toEqual([]);
    const replaced = planImport(withRoutes(route('walk-aaaa')), 'replace', no);
    expect(prepare(no, replaced.change).next.records.routes).toEqual([]);
    // What was written, not what the file held.
    expect(replaced.report.records).toEqual({});
  });

  for (const [what, base] of [
    ['a phone not asked yet', prepare(emptySnapshot(), { settings: { patch: { walk: { saveRoutes: 'unasked', map: 'unasked' } } } }).next],
    ['a phone with no answers at all', emptySnapshot()],
  ] as const) {
    it(`adds no routes to ${what}, and says so first (H6-05, B-26)`, () => {
      expect(previewImport(withRoutes(route('walk-aaaa')), base)).toMatchObject({ ok: true, records: { routes: 1 }, refusedStores: ['routes'] });
      expect(prepare(base, planImport(withRoutes(route('walk-aaaa')), 'merge', base).change).next.records.routes).toEqual([]);
      expect(prepare(base, planImport(withRoutes(route('walk-aaaa')), 'replace', base).change).next.records.routes).toEqual([]);
    });
  }

  it('keeps erased routes erased: a file’s route from before this phone’s erase is left out, and the preview counts it (B-05)', () => {
    const erasedAt = Date.parse('2026-10-08T10:00:00.000+05:30');
    const erased = prepare(emptySnapshot(), { settings: { patch: { walk: { saveRoutes: true, map: 'off', routesErasedAt: erasedAt } } } }).next;
    const before = route('walk-aaaa');
    const after = { ...route('walk-bbbb'), startedAt: '2026-10-08T11:00:00.000+05:30' };
    const both = withRoutes(before, after);
    expect(previewImport(both, erased)).toMatchObject({ ok: true, records: { routes: 2 }, refusedStores: [], refusedRecords: { routes: 1 } });
    for (const mode of ['merge', 'replace'] as const) {
      const plan = planImport(both, mode, erased);
      expect(prepare(erased, plan.change).next.records.routes.map(r => r.walkId)).toEqual(['walk-bbbb']);
      expect(plan.report.records).toEqual({ routes: 1 });
    }
  });

  it('says before a Replace that this phone’s routes will go, when the file has none (Review Focus 4)', () => {
    const here = holding(route('walk-aaaa'), route('walk-bbbb'));
    expect(previewImport(file(), here)).toMatchObject({ ok: true, replaceRemoves: { routes: 2 } });
    expect(prepare(here, planImport(file(), 'replace', here).change).next.records.routes).toEqual([]);
  });

  it('never switches map pictures or route keeping on from a file (B-26)', () => {
    const theirs = { theme: 'dark', walk: { saveRoutes: true, map: 'on', stepCardSeen: true } } as UserSettings;
    expect(withDeviceConsent(theirs, { walk: { saveRoutes: false, map: 'off' } } as UserSettings)?.walk).toEqual({ saveRoutes: false, map: 'off' });
    expect(withDeviceConsent(theirs, undefined)?.walk).toEqual({ saveRoutes: 'unasked', map: 'unasked', stepCardSeen: true });
    const replaced = prepare(emptySnapshot(), planImport(file({ settings: theirs }), 'replace', emptySnapshot()).change).next;
    expect(replaced.settings?.walk).toEqual({ saveRoutes: 'unasked', map: 'unasked', stepCardSeen: true });
    // A new phone set up by a merge asks too.
    const merged = prepare(emptySnapshot(), planImport(file({ settings: theirs }), 'merge', emptySnapshot()).change).next;
    expect(merged.settings).toMatchObject({ theme: 'dark', walk: { saveRoutes: 'unasked', map: 'unasked', stepCardSeen: true } });
  });

  it('keeps this phone’s own answers through a Replace and a merge, whatever the file holds (B-26)', () => {
    const mine = prepare(emptySnapshot(), { settings: { patch: { theme: 'light', walk: { saveRoutes: false, map: 'off' } } } }).next;
    const theirs = { theme: 'dark', walk: { saveRoutes: true, map: 'on' } } as UserSettings;
    for (const over of [{ settings: theirs }, { settings: undefined }]) {
      const replaced = prepare(mine, planImport(file(over), 'replace', mine).change).next;
      expect(replaced.settings?.walk).toEqual({ saveRoutes: false, map: 'off' });
    }
    expect(prepare(mine, planImport(file({ settings: theirs }), 'merge', mine).change).next.settings?.walk).toEqual({ saveRoutes: false, map: 'off' });
  });

  it('refuses food records until Plan 7 can read them', () => {
    expect(previewImport(file({ stores: ['meals'], records: { meals: [{ id: 'm1' }] } }))).toMatchObject({ ok: true, rejected: { meals: 1 } });
  });
});

describe('Replace keeps this device’s open incidents (journey §4.6, H6-03)', () => {
  const profile = createDefaultProfile({
    weightKg: 72,
    health: { diabetes: 'type2', insulin: 'injections_or_pump', glucoseMonitor: 'meter', currentlyActive: true, clearance: 'moderate', medicinesReviewed: true },
  });
  const DAY = '2026-10-08';
  const at = (h: number, m: number) => new Date(2026, 9, 8, h, m).toISOString();
  const NOW = new Date(2026, 9, 8, 13, 40);
  const day = (over: Partial<DailyCheckIn> = {}): CheckInRecord => {
    const c: DailyCheckIn = { date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, ...over };
    return { ...c, readiness: evaluateCheckIn(profile, c) };
  };
  /** The backup, made at 13:20: a normal reading at 13:15, recent enough to walk on. */
  const backup = toTransferDoc({
    ...emptySnapshot(), profile, settings: { theme: 'system' } as UserSettings,
    checkIns: [day({ glucose: { value: 110, unit: 'mg/dL', measuredAt: at(13, 15), source: 'meter' } })],
  }, '2026-10-08T13:20:00.000+05:30');
  /** The device after the backup was made: the same morning, then what happened at 13:30. */
  const device = (later: Partial<DailyCheckIn>, observations: Observation[] = []) => ({
    ...emptySnapshot(3), profile, settings: { theme: 'dark' } as UserSettings, observations,
    checkIns: [day({ glucose: { value: 110, unit: 'mg/dL', measuredAt: at(13, 15), source: 'meter' }, ...later })],
  });
  /** What the gate says about a walk now, on the record Replace leaves: the real engine, Track's readings attached. */
  const walkAfter = (base: ReturnType<typeof device>) => {
    const next = prepare(base, planImport(backup, 'replace', base, { now: NOW }).change).next;
    const all = effectiveCheckIns(next.checkIns, next.profile ?? profile, next.observations);
    return permission({ profile: next.profile ?? profile, checkIn: all.find(c => c.date === DAY), recent: all, now: NOW }, 'walk');
  };
  const low60 = { value: 60, unit: 'mg/dL' as const, measuredAt: at(13, 30), source: 'meter' as const };

  it('lets the file decide when this device holds nothing open', () => {
    expect(walkAfter(device({})).allowed).toBe(true);
  });

  const incidents: [string, Partial<DailyCheckIn>, Observation[]?][] = [
    ['a low reading, not re-checked yet', { glucose: low60, glucoseEarlier: [{ value: 110, unit: 'mg/dL', measuredAt: at(13, 15), source: 'meter' }] }],
    ['“I feel low”, with no reading since', { news: ['lowSymptoms'], lowSymptomsAt: at(13, 30) }],
    ['an emergency answer', { urgentSymptoms: true, emergency: ['chest'] }],
    ['a stop not yet answered', { news: ['stopped'] }],
    ['a red flag: new weakness in a leg', { back: { newWeakness: true, newNeuro: true } }],
    ['a low logged in Track', {}, [newObservation({ id: 'track-low', kind: 'glucose', value: 60, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: at(13, 30) })]],
  ];
  it('keeps nothing of a day that held only on its own day', () => {
    const yesterday = { ...day({ news: ['dizzy'] }), date: '2026-10-07' };
    const base = { ...device({}), checkIns: [yesterday] };
    expect(openIncidents(base, NOW)).toEqual({ checkIns: [], observations: [] });
    const next = prepare(base, planImport(backup, 'replace', base, { now: NOW }).change).next;
    expect(next.checkIns.map(c => c.date)).toEqual([DAY]);
  });

  it('never lets the file’s answer settle what this device holds open, and keeps what the file adds', () => {
    // This device: a severe low at 13:30, unanswered. The file: the same reading, answered as a typing mistake, and chest pain.
    const severe = { value: 40, unit: 'mg/dL' as const, measuredAt: at(13, 30), source: 'meter' as const, unitConfirmed: true };
    const base = device({ glucose: severe });
    const answered = toTransferDoc({
      ...emptySnapshot(), profile, settings: { theme: 'system' } as UserSettings,
      checkIns: [day({
        glucose: severe, urgentSymptoms: true, emergency: ['chest'],
        resolutions: [{ kind: 'severeLow', readings: [glucoseReadingId(severe, DAY)], resolution: 'mistake', at: at(13, 35) }],
      })],
    }, '2026-10-08T13:36:00.000+05:30');
    const next = prepare(base, planImport(answered, 'replace', base, { now: NOW }).change).next;
    const today = next.checkIns.find(c => c.date === DAY)!;
    expect(today.resolutions ?? []).toEqual([]);
    // The low still counts as the low it is: the file's "mistake" settles nothing here.
    expect(evaluateCheckIn(profile, today).reasons.map(r => r.code)).toContain('severeLow');
    expect(today.emergency).toEqual(['chest']);
    const after = permission({ profile, checkIn: today, recent: next.checkIns, now: NOW }, 'walk');
    expect(after.disposition).toBe('emergency');
  });

  it('keeps the readings an incident’s release depends on, and only on its days', () => {
    const trackLow = newObservation({ id: 'track-low', kind: 'glucose', value: 60, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: at(13, 30) });
    const old = newObservation({ id: 'track-old', kind: 'glucose', value: 90, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: '2026-10-01T08:00:00.000+05:30' });
    const steps1 = newObservation({ id: 'steps-today', kind: 'steps', value: 900, unit: 'steps', scope: 'dayTotal', source: 'manual', at: at(12, 0) });
    const base = device({}, [old, trackLow, steps1]);
    const open = openIncidents(base, NOW);
    expect(open.observations.map(o => o.id)).toEqual(['track-low']);
    const next = prepare(base, planImport(backup, 'replace', base, { now: NOW }).change).next;
    expect(next.observations.map(o => o.id)).toEqual(['track-low']);
  });

  it('keeps a low logged in Track on a day with no check-in of its own here', () => {
    const trackLow = newObservation({ id: 'track-low', kind: 'glucose', value: 60, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: at(13, 30) });
    const base = { ...device({}, [trackLow]), checkIns: [] };
    expect(openIncidents(base, NOW).observations.map(o => o.id)).toEqual(['track-low']);
    expect(walkAfter(base).allowed).toBe(false);
  });

  for (const [what, later, observations] of incidents) {
    it(`keeps ${what}: the older file’s recent normal reading does not release it`, () => {
      const before = device(later, observations);
      const all = effectiveCheckIns(before.checkIns, profile, before.observations);
      const was = permission({ profile, checkIn: all.find(c => c.date === DAY), recent: all, now: NOW }, 'walk');
      expect(was.allowed).toBe(false);
      const after = walkAfter(before);
      expect(after.allowed).toBe(false);
      expect(after.disposition).toBe(was.disposition);
    });
  }
});

describe('a backup that says what it holds (B-25, H4-02)', () => {
  const doc = () => toTransferDoc({
    ...emptySnapshot(), profile: createDefaultProfile({ weightKg: 70 }), settings: { theme: 'dark' } as UserSettings,
    observations: [glucose('g1', '2026-10-01', 132)], sessions: [session], checkIns: [checkIn],
  }, '2026-10-08T09:00:00.000+05:30');
  const read = async (d: TransferDoc) => decode((await encode(d)).bytes) as Promise<Record<string, unknown>>;

  it('writes a manifest of what it holds, and reads back whole', async () => {
    const raw = await read(doc());
    expect(raw.manifest).toMatchObject({ version: 1, counts: { observations: 1, sessions: 1, checkIns: 1 }, settings: true, profile: true });
    expect(previewImport(raw)).toMatchObject({ ok: true, complete: 'whole' });
  });

  for (const [what, cut] of [
    ['its sessions', (r: Record<string, unknown>) => { r.sessions = []; }],
    ['its observations', (r: Record<string, unknown>) => { delete r.observations; }],
    ['its profile', (r: Record<string, unknown>) => { delete r.profile; }],
    ['a changed reading', (r: Record<string, unknown>) => { (r.observations as { value: number }[])[0].value = 99; }],
  ] as const) {
    it(`is not whole without ${what}, though it keeps its date`, async () => {
      const raw = await read(doc());
      cut(raw);
      const preview = previewImport(raw);
      expect(preview).toMatchObject({ ok: true, exportedAt: '2026-10-08T09:00:00.000+05:30', complete: 'partial' });
    });
  }

  it('is not whole when its manifest itself is damaged or from a later version', async () => {
    // A later version's manifest may be worked out another way: not trusted, even with this digest.
    const later = await read(doc());
    later.manifest = { ...(later.manifest as object), version: 2 };
    expect(previewImport(later)).toMatchObject({ ok: true, complete: 'partial' });
    for (const manifest of [{ version: 1 }, { version: 2, digest: 'x' }, { version: 1, digest: 7 }]) {
      const raw = await read(doc());
      raw.manifest = { ...(raw.manifest as object), ...manifest, ...('digest' in manifest ? {} : { digest: undefined }) };
      expect(previewImport(raw), JSON.stringify(manifest)).toMatchObject({ ok: true, complete: 'partial' });
    }
  });

  it('can’t be said to be whole when it holds no manifest at all', async () => {
    const raw = await read(doc());
    delete raw.manifest;
    expect(previewImport(raw)).toMatchObject({ ok: true, complete: 'unknown' });
  });
});
