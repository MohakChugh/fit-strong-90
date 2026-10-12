import { describe, it, expect, beforeEach } from 'vitest';
import type { AppData, WorkoutSession } from '@/types';
import type { CheckInRecord, Readiness } from '@/types/checkin';
import type { Observation } from '@/health/observation';
import { isOrphanedReading, pairBloodPressure } from '@/health/aggregate';
import { readDoc, type Db } from './db';
import { fakeIndexedDB } from './fakeIdb';

// Node test environment: a minimal in-memory localStorage, installed before
// the module under test is imported.
const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null,
  setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k),
  clear: () => local.clear(),
  key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;

const { openDb } = await import('./db');
const { V4_KEY, SCHEMA_VERSION, migrateToV5, observationsFromV4 } = await import('./migrate');

const readiness: Readiness = {
  outcome: 'green', modifiers: [], back: 'green', nerveFlag: false, reasons: [], actions: [],
  vigorousLocked: false, capHeavy: false, rpeOnly: true, notices: [],
};

function checkIn(date: string, over: Partial<CheckInRecord> = {}): CheckInRecord {
  return {
    date,
    urgentSymptoms: false,
    news: [],
    sleep: '5to7',
    energy: 4,
    readiness,
    ...over,
  };
}

/** A realistic v4 blob: the shape the owner's device actually holds today. */
function v4(): AppData {
  const sets = [
    { id: 'set-1', exerciseId: 'goblet-squat', setNumber: 1, plannedReps: 10, actualReps: 10, weight: 24, status: 'completed' as const, rpe: 7 },
    { id: 'set-2', exerciseId: 'goblet-squat', setNumber: 2, plannedReps: 10, actualReps: 9, weight: 24, status: 'completed' as const, rpe: 8 },
    { id: 'set-3', exerciseId: 'romanian-deadlift', setNumber: 1, plannedReps: 8, actualReps: null, weight: null, status: 'skipped' as const, rpe: null },
  ];
  const sessions: WorkoutSession[] = [
    {
      id: 'session-1', date: '2026-09-28', dayOfWeek: 'monday', muscleGroup: 'lower', phase: 'foundation',
      week: 1, status: 'completed', sets, startedAt: '2026-09-28T06:02:00.000Z', completedAt: '2026-09-28T07:05:00.000Z',
      notes: 'Felt steady.', totalVolume: 456, guided: true, focus: 'lowerA', planId: 'plan-1',
      mobility: [{ exerciseId: 'hip-opener-stretch', seconds: 60 }],
      cardio: { modality: 'treadmillWalk', minutes: 12, format: 'steady' },
      checkIn: checkIn('2026-09-28', { glucose: { value: 132, unit: 'mg/dL', trend: 'flat' } }),
      painAfter: 2,
      symptomChecks: { 'goblet-squat': 'same' },
      durationSeconds: 3780,
      exerciseNotes: { 'goblet-squat': 'Heels down.' },
      warmup: [{ exerciseId: 'hamstring-stretch', completed: true }],
      cooldown: [{ exerciseId: 'breathing-cooldown', completed: true, durationSeconds: 120 }],
      supersetGroups: [{ id: 'ss-1', exerciseIds: ['a', 'b'], restBetweenSeconds: 20, restAfterRoundSeconds: 90 }],
    },
    {
      id: 'session-2', date: '2026-10-01', dayOfWeek: 'thursday', muscleGroup: 'upper', phase: 'foundation',
      week: 1, status: 'partial', sets: [sets[0]], startedAt: null, completedAt: null,
      notes: '', totalVolume: 240,
    },
  ];

  return {
    version: 4,
    settings: {
      startDate: '2026-09-28', currentWeight: 82.4, targetGoal: 'Pain-free back', defaultRestSeconds: 90,
      useMetric: true, theme: 'dark', onboardingComplete: true,
      gymDays: { monday: 'legs', tuesday: 'back', wednesday: 'rest', thursday: 'chest', friday: 'arms', saturday: 'core', sunday: 'rest' },
      warmupEnabled: true, cooldownEnabled: true,
      defaultWarmupExercises: ['hamstring-stretch'], defaultCooldownExercises: ['breathing-cooldown'],
      supersetRestSeconds: 20,
    },
    sessions,
    bodyMetrics: [
      { date: '2026-09-28', weight: 82.4, waist: 96, notes: 'Morning.' },
      { date: '2026-10-05', weight: 81.9, waist: null, notes: '' },
      { date: '2026-10-06', weight: null, waist: null, notes: 'Forgot.' },
    ],
    personalRecords: [
      { exerciseId: 'goblet-squat', weight: 24, reps: 10, date: '2026-09-28', volume: 240 },
      { exerciseId: 'bench-press', weight: 60, reps: 5, date: '2026-09-20', volume: 300 },
    ],
    profile: {
      version: 1, weightKg: 82.4, heightCm: 178, birthYear: 1990, experience: 'beginner',
      trainingDays: ['monday', 'thursday', 'saturday'], sessionMinutes: 60, equipment: 'homeDumbbells',
      goals: ['painFreeBack', 'strong'],
      pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left', worseWith: 'flexion', preference: 'extension' },
      health: {
        diabetes: 'type2', insulin: 'none', sulfonylureaOrMeglitinide: false, sglt2i: true, highHypoRisk: false,
        hypertension: 'treated', betaBlocker: false, diuretic: true, heartOrVascularDisease: false,
        kidneyDisease: 'none', retinopathy: 'none_or_mild', peripheralNeuropathy: 'no', footStatus: 'healthy',
        dizzyOnStandingOrAutonomicNeuropathy: false, glucoseMonitor: 'meter', glucoseUnit: 'mg/dL',
        ketoneTest: 'none', bpMonitor: true, currentlyActive: false, clearance: 'moderate',
        clinicianTargets: { glucoseStartMin: 100 },
      },
      ladder: { hinge: 2, squat: 3, neuralGate: false, changedOn: '2026-09-28' },
      flexibilityTargets: ['hipFlexors', 'hamstrings'],
      dislikes: ['barbell-back-squat'],
      restDayMobility: true,
      voice: { pack: 'af_heart', rate: 0.95, verbosity: 'auto', mode: 'coach', muted: false, checked: true },
      figure: 'male',
    },
    checkIns: [
      checkIn('2026-09-28', { glucose: { value: 132, unit: 'mg/dL', trend: 'flat' } }),
      checkIn('2026-10-01', {
        glucose: { value: 148, unit: 'mg/dL', rapidInsulinLast2h: true },
        bp: { sys: 138, dia: 86 },
        back: { pain: 4, legPain: 3, reach: 'thigh', newNeuro: false, caudaEquinaFlag: false },
        news: ['unusualFatigue'],
        sleep: 'lt5',
        energy: 2,
      }),
      checkIn('2026-10-05', {
        bp: { sys: 126, dia: 78 },
        back: { pain: 1, newNeuro: false, caudaEquinaFlag: false },
      }),
      checkIn('2026-10-07', { glucose: { value: 7.2, unit: 'mmol/L' } }),
    ],
    focusOverrides: { '2026-10-01': 'upperA', '2026-10-08': 'activeRecovery' },
  };
}

async function fresh(options: Parameters<typeof fakeIndexedDB>[0] = {}): Promise<Db> {
  return openDb(fakeIndexedDB(options));
}

/**
 * Every store's contents. `stamped: false` drops the commit metadata (`seq`,
 * the `revision` row): a second commit moves those even when every record it
 * writes is the same.
 */
async function dump(db: Db, stamped = true) {
  const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);
  const byKey = (a: { key: string }, b: { key: string }) => a.key.localeCompare(b.key);
  const observations = await db.getAll<{ id: string; seq?: number }>('observations');
  return {
    observations: (stamped ? observations : observations.map(({ seq, ...rest }) => { void seq; return rest; })).sort(byId),
    sessions: (await db.getAll<{ id: string }>('sessions')).sort(byId),
    settings: (await db.getAll<{ key: string }>('settings')).filter(row => stamped || row.key !== 'revision').sort(byKey),
    content: await db.getAll('content-state'),
  };
}

const find = (all: Observation[], kind: string, day: string) => all.filter(o => o.kind === kind && o.day === day);

beforeEach(() => local.clear());

describe('observationsFromV4', () => {
  it('lifts every reading out of the check-ins', () => {
    const all = observationsFromV4(v4());

    const glucose = all.filter(o => o.kind === 'glucose');
    expect(glucose.map(o => [o.day, o.value, o.unit])).toEqual([
      ['2026-09-28', 132, 'mg/dL'],
      ['2026-10-01', 148, 'mg/dL'],
      ['2026-10-07', 7.2, 'mmol/L'],
    ]);
    for (const o of glucose) {
      expect(o.source).toBe('manual');
      expect(o.scope).toBe('pointInTime');
      expect(o.at.startsWith(`${o.day}T12:00:00`)).toBe(true);
      expect(o.context).toBe(`checkIn:${o.day}`);
    }

    expect(find(all, 'bloodPressureSystolic', '2026-10-01').map(o => [o.value, o.unit])).toEqual([[138, 'mmHg']]);
    expect(find(all, 'bloodPressureDiastolic', '2026-10-01').map(o => [o.value, o.unit])).toEqual([[86, 'mmHg']]);
    expect(find(all, 'bloodPressureSystolic', '2026-10-05').map(o => o.value)).toEqual([126]);
  });

  it('keeps the two halves of a migrated blood pressure reading paired', () => {
    const all = observationsFromV4(v4());
    const readings = pairBloodPressure(all);
    expect(readings.map(r => [r.day, r.systolic, r.diastolic])).toEqual([
      ['2026-10-01', 138, 86],
      ['2026-10-05', 126, 78],
    ]);
    expect(readings.some(isOrphanedReading)).toBe(false);
    // The pairing context keeps the provenance, so a record still says where
    // it came from.
    expect(readings[0].halves.map(h => h.context)).toEqual(['bp:checkIn:2026-10-01', 'bp:checkIn:2026-10-01']);
  });

  it('does not pretend to know whether a v4 reading was the morning or the evening one', () => {
    const all = observationsFromV4(v4());
    expect(all.filter(o => o.tag !== undefined)).toEqual([]);
    expect(all.filter(o => o.mealStartedAt !== undefined)).toEqual([]);
  });

  // D21: the signature screen is pain against the loading ladder over time, so
  // pain has to be a series, not a field buried in a check-in record.
  it('lifts back and leg pain out too, and does not invent a leg reading', () => {
    const all = observationsFromV4(v4());
    expect(find(all, 'backPain', '2026-10-01').map(o => [o.value, o.unit])).toEqual([[4, '0-10']]);
    expect(find(all, 'legPain', '2026-10-01').map(o => o.value)).toEqual([3]);
    expect(find(all, 'backPain', '2026-10-05').map(o => o.value)).toEqual([1]);
    expect(find(all, 'legPain', '2026-10-05')).toEqual([]);
  });

  it('records the pain reported after a session against the session', () => {
    const all = observationsFromV4(v4());
    const after = find(all, 'backPain', '2026-09-28').find(o => o.context === 'session:session-1');
    expect(after?.value).toBe(2);
  });

  it('lifts weight and waist out of the body metrics, skipping the blanks', () => {
    const all = observationsFromV4(v4());
    expect(all.filter(o => o.kind === 'weight').map(o => [o.day, o.value, o.unit])).toEqual([
      ['2026-09-28', 82.4, 'kg'],
      ['2026-10-05', 81.9, 'kg'],
    ]);
    expect(all.filter(o => o.kind === 'waist').map(o => [o.day, o.value])).toEqual([['2026-09-28', 96]]);
  });

  it('does not invent a number for a band or a word', () => {
    // `sleep` is 'lt5' | '5to7' | 'gt7' and `energy` is a 1–5 scale of energy,
    // not mood. Turning either into a measurement would be a fabrication.
    const all = observationsFromV4(v4());
    expect(all.filter(o => o.kind === 'sleep')).toEqual([]);
    expect(all.filter(o => o.kind === 'mood')).toEqual([]);
  });

  it('keeps both readings when two check-ins share a date', () => {
    const data = { ...v4(), sessions: [] };
    data.checkIns = [
      checkIn('2026-10-02', { glucose: { value: 120, unit: 'mg/dL' } }),
      checkIn('2026-10-02', { glucose: { value: 190, unit: 'mg/dL' } }),
    ];
    const glucose = observationsFromV4(data).filter(o => o.kind === 'glucose');
    expect(glucose.map(o => o.value)).toEqual([120, 190]);
    expect(new Set(glucose.map(o => o.id)).size).toBe(2);
  });

  it('skips a value no measurement could have, rather than losing the rest', () => {
    const data = { ...v4(), sessions: [] };
    data.checkIns = [
      checkIn('2026-10-02', { glucose: { value: Number.NaN, unit: 'mg/dL' }, bp: { sys: 130, dia: 80 } }),
      checkIn('2026-10-03', { glucose: { value: 120, unit: 'mg/dL' } }),
    ];
    const all = observationsFromV4(data);
    expect(all.filter(o => o.kind === 'glucose').map(o => o.value)).toEqual([120]);
    expect(find(all, 'bloodPressureSystolic', '2026-10-02').map(o => o.value)).toEqual([130]);
  });

  // A guided session carries a copy of the day's check-in. If the check-in
  // list has lost it, the reading would otherwise be invisible to every screen.
  it('recovers a reading that only survives inside a session', () => {
    const data = { ...v4(), checkIns: [] };
    const glucose = observationsFromV4(data).filter(o => o.kind === 'glucose');
    expect(glucose.map(o => [o.day, o.value])).toEqual([['2026-09-28', 132]]);
    expect(glucose[0].context).toBe('checkIn:2026-09-28');
  });

  it('does not record the same check-in twice when the session and the list agree', () => {
    const all = observationsFromV4(v4());
    expect(all.filter(o => o.kind === 'glucose' && o.day === '2026-09-28')).toHaveLength(1);
  });

  it('survives a blob with no check-ins, metrics or sessions at all', () => {
    expect(observationsFromV4({ version: 4, settings: v4().settings, sessions: [], bodyMetrics: [], personalRecords: [] })).toEqual([]);
  });

  it('produces the same ids every time, so a second run overwrites rather than duplicates', () => {
    expect(observationsFromV4(v4()).map(o => o.id)).toEqual(observationsFromV4(v4()).map(o => o.id));
  });
});

describe('migrateToV5', () => {
  it('loses nothing: every v4 field is still there afterwards', async () => {
    const db = await fresh();
    const data = v4();
    const result = await migrateToV5(db, JSON.stringify(data));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.from).toBe(4);
    expect(result.value.sessions).toBe(2);
    expect(result.value.checkIns).toBe(4);
    expect(result.value.skipped).toEqual([]);

    expect(await readDoc(db, 'schemaVersion')).toBe(SCHEMA_VERSION);
    expect(await readDoc(db, 'settings')).toEqual(data.settings);
    expect(await readDoc(db, 'profile')).toEqual(data.profile);
    expect(await readDoc(db, 'checkIns')).toEqual(data.checkIns);
    expect(await readDoc(db, 'personalRecords')).toEqual(data.personalRecords);
    expect(await readDoc(db, 'bodyMetrics')).toEqual(data.bodyMetrics);
    expect(await readDoc(db, 'focusOverrides')).toEqual(data.focusOverrides);

    const sessions = await db.getAll<WorkoutSession>('sessions');
    expect(sessions.map(s => s.id).sort()).toEqual(['session-1', 'session-2']);
    const first = sessions.find(s => s.id === 'session-1')!;
    expect(first).toEqual(data.sessions[0]);
    expect(first.sets).toHaveLength(3);
    expect(sessions.find(s => s.id === 'session-2')).toEqual(data.sessions[1]);
    db.close();
  });

  it('is idempotent: running it again changes nothing', async () => {
    const db = await fresh();
    const raw = JSON.stringify(v4());
    await migrateToV5(db, raw);
    const once = await dump(db);

    const second = await migrateToV5(db, raw);
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.value.alreadyDone).toBe(true);
    expect(await dump(db)).toEqual(once);
    db.close();
  });

  // With the marker present nothing at all is written (above). Without it the
  // migration commits again: every record is the same, though the commit
  // order it stamps has moved on.
  it('is idempotent even if it runs again with the marker gone', async () => {
    const db = await fresh();
    const raw = JSON.stringify(v4());
    await migrateToV5(db, raw);
    const once = await dump(db, false);

    await db.remove('settings', ['schemaVersion']);
    const again = await migrateToV5(db, raw);
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.value.alreadyDone).toBe(false);
    expect(await dump(db, false)).toEqual(once);
    db.close();
  });

  it('reads the blob from localStorage when it is not handed one', async () => {
    local.set(V4_KEY, JSON.stringify(v4()));
    const db = await fresh();
    const result = await migrateToV5(db);
    expect(result.ok).toBe(true);
    expect((await db.getAll('sessions')).length).toBe(2);
    db.close();
  });

  it('leaves the old copy in localStorage: the device holds the only record', async () => {
    const raw = JSON.stringify(v4());
    local.set(V4_KEY, raw);
    const db = await fresh();
    await migrateToV5(db);
    expect(local.get(V4_KEY)).toBe(raw);
    db.close();
  });

  it('marks a device with no old data as current without writing anything else', async () => {
    const db = await fresh();
    const result = await migrateToV5(db, null);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.from).toBe(0);
    expect(await readDoc(db, 'schemaVersion')).toBe(SCHEMA_VERSION);
    expect(await db.getAll('observations')).toEqual([]);
    expect(await db.getAll('sessions')).toEqual([]);
    db.close();
  });

  it('brings an older blob forward through the existing v1–v4 migrations first', async () => {
    const db = await fresh();
    const old = { ...v4(), version: 2, profile: undefined, checkIns: undefined, focusOverrides: undefined };
    const result = await migrateToV5(db, JSON.stringify(old));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.from).toBe(2);
    // v2 → v3 builds a profile for an onboarded user and asks for a review.
    expect(await readDoc<{ needsHealthReview?: boolean }>(db, 'profile')).toMatchObject({ needsHealthReview: true });
    expect(await readDoc(db, 'checkIns')).toEqual([]);
    expect((await db.getAll('sessions')).length).toBe(2);
    db.close();
  });

  it('does not throw or wipe anything when the old blob is unreadable', async () => {
    local.set(V4_KEY, '{ this is not json');
    const db = await fresh();
    const result = await migrateToV5(db);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.unreadable).toBe(true);
    expect(local.get(V4_KEY)).toBe('{ this is not json');
    expect(await db.getAll('sessions')).toEqual([]);
    db.close();
  });

  // If the device fills up half-way, the marker must stay unset so the next
  // start tries again — and the deterministic ids make the retry safe.
  it('reports a full device and does not claim to have finished', async () => {
    const db = await fresh({ quotaAfter: 3 });
    const result = await migrateToV5(db, JSON.stringify(v4()));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('quotaExceeded');
    expect(await readDoc(db, 'schemaVersion')).toBeUndefined();
    db.close();
  });

  it('writes the observations where the kind and day indexes can find them', async () => {
    const db = await fresh();
    await migrateToV5(db, JSON.stringify(v4()));
    expect((await db.byIndex<Observation>('observations', 'kind', 'glucose')).length).toBe(3);
    expect((await db.byIndex<Observation>('observations', 'day', '2026-10-01')).map(o => o.kind).sort())
      .toEqual(['backPain', 'bloodPressureDiastolic', 'bloodPressureSystolic', 'glucose', 'legPain']);
    db.close();
  });
});
