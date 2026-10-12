import { describe, it, expect, beforeEach } from 'vitest';
import type { AppData, WorkoutSet } from '@/types';
import { kgToDisplay } from '@/lib/utils';

// Node test environment: a minimal in-memory localStorage.
const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
} as Storage;

// And a tab's sessionStorage, where the walk and Quick Log drafts live.
const tab = new Map<string, string>();
globalThis.sessionStorage = {
  getItem: (k: string) => tab.get(k) ?? null,
  setItem: (k: string, v: string) => void tab.set(k, v),
  removeItem: (k: string) => void tab.delete(k),
  clear: () => tab.clear(),
  key: (i: number) => [...tab.keys()][i] ?? null,
  get length() { return tab.size; },
} as Storage;

const { migrateData, CURRENT_VERSION, resetData, APP_KEY_PREFIX } = await import('./storage');

/** What a brand-new device starts from: the store builds its defaults the same way. */
const fresh = () => migrateData({ version: CURRENT_VERSION } as AppData);

function v2Data(overrides: Partial<AppData['settings']> = {}): AppData {
  return {
    version: 2,
    settings: {
      startDate: '2026-09-25',
      currentWeight: 82,
      targetGoal: 'Athletic',
      defaultRestSeconds: 90,
      useMetric: true,
      theme: 'light',
      onboardingComplete: true,
      gymDays: {
        monday: 'back', tuesday: 'chest', wednesday: 'legs', thursday: 'shoulders',
        friday: 'arms', saturday: 'core', sunday: 'rest',
      },
      ...overrides,
    },
    sessions: [{
      id: 's1', date: '2026-10-01', dayOfWeek: 'thursday', muscleGroup: 'shoulders', phase: 'foundation',
      week: 1, status: 'completed', sets: [], startedAt: null, completedAt: null, notes: '', totalVolume: 0,
    }],
    bodyMetrics: [],
    personalRecords: [],
  };
}

describe('storage v3', () => {
  beforeEach(() => store.clear());

  it('starts fresh users at the current version with no profile', () => {
    const data = fresh();
    expect(data.version).toBe(CURRENT_VERSION);
    expect(data.profile).toBeUndefined();
    expect(data.checkIns).toEqual([]);
  });

  it('migrates an onboarded v2 user to a v3 profile without touching history', () => {
    const migrated = migrateData(v2Data());
    expect(migrated.version).toBe(CURRENT_VERSION);
    expect(migrated.profile?.weightKg).toBe(82);
    expect(migrated.profile?.trainingDays).toEqual(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']);
    expect(migrated.profile?.health.diabetes).toBe('none');
    expect(migrated.profile?.needsHealthReview).toBe(true);
    expect(migrated.sessions).toHaveLength(1);
    expect(migrated.checkIns).toEqual([]);
  });

  it('does not invent a profile for a v2 user who never finished onboarding', () => {
    const migrated = migrateData(v2Data({ onboardingComplete: false }));
    expect(migrated.profile).toBeUndefined();
  });

  it('leaves already-current data unchanged when migrated again', () => {
    const migrated = migrateData(v2Data());
    expect(migrateData(JSON.parse(JSON.stringify(migrated)) as AppData)).toEqual(migrated);
  });

  it('never hands out the shared default object', () => {
    const a = fresh();
    a.sessions.push(v2Data().sessions[0]);
    a.settings.useMetric = false;
    expect(fresh().sessions).toHaveLength(0);
    expect(fresh().settings.useMetric).toBe(true);
  });

  // Review Focus #7: `undefined < 2` is false, so a version-less blob used to
  // skip every migration and still be stamped as current.
  it('treats a missing or unreadable version as v1 and runs every migration', () => {
    for (const version of [undefined, null, 'three', NaN]) {
      const migrated = migrateData({ ...v2Data(), version } as never);
      expect(migrated.version).toBe(CURRENT_VERSION);
      expect(migrated.profile?.weightKg).toBe(82);
      expect(migrated.profile?.needsHealthReview).toBe(true);
      expect(migrated.profile?.trainingDays).toHaveLength(6);
      expect(migrated.settings.supersetRestSeconds).toBe(20);
      expect(migrated.checkIns).toEqual([]);
      expect(migrated.sessions).toHaveLength(1);
    }
  });
});

// Review Focus #5 / spec §10.2: "Clear all data in Settings removes everything".
describe('resetData', () => {
  beforeEach(() => store.clear());

  it('removes every key the app owns, not just the main blob', () => {
    store.set('fit-strong-90-data', JSON.stringify(migrateData(v2Data())));
    store.set('fit-strong-90-guided', '{"plan":{"readiness":{"reasons":[{"message":"Glucose below 54 mg/dL"}]}}}');
    store.set('fit-strong-90-anything-later', 'x');
    store.set('some-other-app', 'keep me');

    resetData();

    expect([...store.keys()]).toEqual(['some-other-app']);
  });

  it('removes the drafts kept in the tab too: a walk in progress and an unsaved reading (D-05)', async () => {
    tab.clear();
    const { WALK_KEY, LAST_WALK_KEY } = await import('@/walk/persist');
    const { DRAFT_KEY } = await import('@/screens/track/draft');
    tab.set(WALK_KEY, '{"walk":{"id":"walk-before-delete","pain":{"back":{"value":6}}}}');
    tab.set(LAST_WALK_KEY, 'walk-before-delete');
    tab.set(DRAFT_KEY, '{"kind":"glucose","raw":"54"}');
    tab.set('fit-strong-90-navigation', '{}');
    tab.set('some-other-app', 'keep me');

    resetData();

    expect([...tab.keys()]).toEqual(['some-other-app']);
  });

  it('every key the app keeps starts with the one prefix the sweep removes', async () => {
    const { WALK_KEY, LAST_WALK_KEY } = await import('@/walk/persist');
    const { DRAFT_KEY } = await import('@/screens/track/draft');
    const { THEME_KEY } = await import('@/store/useStore');
    for (const key of [WALK_KEY, LAST_WALK_KEY, DRAFT_KEY, THEME_KEY, 'fit-strong-90-data']) expect(key.startsWith(APP_KEY_PREFIX)).toBe(true);
  });
});

describe('v4: weights in kilograms', () => {
  const set = (id: string, weight: number | null, actualReps: number | null, status: WorkoutSet['status'] = 'completed'): WorkoutSet =>
    ({ id, exerciseId: 'goblet-squat', setNumber: 1, plannedReps: 10, actualReps, weight, status, rpe: null });

  /** A v3 blob: manual sets saved as typed, guided ones in kg, and a record won by a pounds set. */
  function v3Data(useMetric: boolean): AppData {
    const base = v2Data({ useMetric }).sessions[0];
    return {
      ...v2Data({ useMetric }),
      version: 3,
      sessions: [
        { ...base, id: 'manual', date: '2026-10-01', sets: [set('m1', 100, 10), set('m2', 110, 8), set('m3', null, null, 'pending')], totalVolume: 1880 },
        { ...base, id: 'guided', date: '2026-10-02', guided: true, sets: [set('g1', 50, 10)], totalVolume: 500 },
      ],
      personalRecords: [
        { exerciseId: 'goblet-squat', weight: 100, reps: 10, date: '2026-10-01', volume: 1000 },
        { exerciseId: 'imported-lift', weight: 70, reps: 5, date: '2025-12-01', volume: 350 },
      ],
    };
  }

  it("converts an imperial user's manual sets from pounds and rebuilds volume and records", () => {
    const old = v3Data(false);
    const migrated = migrateData(old);
    expect(migrated.version).toBe(CURRENT_VERSION);

    const manual = migrated.sessions.find(s => s.id === 'manual')!;
    expect(manual.sets.map(s => (s.weight === null ? null : kgToDisplay(s.weight, false)))).toEqual([100, 110, null]);
    expect(manual.sets[0].weight).toBeCloseTo(100 / 2.20462, 6);
    expect(manual.totalVolume).toBeCloseTo(1880 / 2.20462, 6);
    // Guided sessions always logged kilograms.
    expect(migrated.sessions.find(s => s.id === 'guided')).toEqual(old.sessions[1]);

    // The pounds set no longer outranks the guided 50 kg × 10; the import stays.
    expect(migrated.personalRecords).toEqual([
      { exerciseId: 'imported-lift', weight: 70, reps: 5, date: '2025-12-01', volume: 350 },
      { exerciseId: 'goblet-squat', weight: 50, reps: 10, date: '2026-10-02', volume: 500 },
    ]);
  });

  it("moves a metric user to v4 with weights and records untouched", () => {
    const old = v3Data(true);
    const migrated = migrateData(old);
    expect(migrated.version).toBe(4);
    expect(migrated.sessions).toEqual(old.sessions);
    expect(migrated.personalRecords).toEqual(old.personalRecords);
  });

  it("converts an imperial user's bodyweight and waist entries, and leaves a metric user's alone", () => {
    const metrics = [{ date: '2026-10-01', weight: 180, waist: 34, notes: '' }, { date: '2026-10-02', weight: null, waist: null, notes: '' }];
    const imperial = migrateData({ ...v3Data(false), bodyMetrics: metrics });
    expect(imperial.bodyMetrics[0].weight).toBeCloseTo(180 / 2.20462, 6);
    expect(imperial.bodyMetrics[0].waist).toBeCloseTo(34 * 2.54, 6);
    expect(imperial.bodyMetrics[1]).toEqual(metrics[1]);
    expect(migrateData({ ...v3Data(true), bodyMetrics: metrics }).bodyMetrics).toEqual(metrics);
  });

  it('fixes a bodyweight typed in pounds in Settings, using the profile weight to tell', () => {
    const withWeight = (currentWeight: number) => ({ ...v3Data(false), settings: { ...v3Data(false).settings, currentWeight }, profile: { ...(v3Data(false).profile ?? {}), weightKg: 81.6 } } as AppData);
    expect(migrateData(withWeight(180)).settings.currentWeight).toBeCloseTo(81.65, 2);
    expect(migrateData(withWeight(81.6)).settings.currentWeight).toBe(81.6);
    expect(migrateData(withWeight(120)).settings.currentWeight).toBe(120); // neither: left alone
    // A few kilos of change since the profile was set still reads as pounds.
    expect(migrateData(withWeight(190)).settings.currentWeight).toBeCloseTo(86.18, 2);
  });

  it('converts only once, however often the data is migrated', () => {
    const once = migrateData(v3Data(false));
    const twice = migrateData(structuredClone(once));
    expect(twice).toEqual(once);
    expect(twice.sessions[0].sets[0].weight).toBeCloseTo(100 / 2.20462, 6);
  });
});

describe('stored profiles', () => {
  it('fills fields missing from a partial or hand-edited profile', () => {
    const data = migrateData({
      version: 3,
      settings: { onboardingComplete: true },
      sessions: [], personalRecords: [], bodyMeasurements: [],
      profile: { weightKg: 82, pain: { areas: ['sciatica'], sciaticaSide: 'left' }, health: { diabetes: 'type2' } },
    } as never);
    expect(data.profile?.trainingDays.length).toBeGreaterThan(0);
    expect(data.profile?.pain.sciaticaSide).toBe('left');
    expect(data.profile?.pain.preference).toBe('untested');
    expect(data.profile?.health.diabetes).toBe('type2');
    expect(data.profile?.health.glucoseUnit).toBe('mg/dL');
    expect(data.profile?.voice.rate).toBeGreaterThan(0);
    expect(data.checkIns).toEqual([]);
  });
});
