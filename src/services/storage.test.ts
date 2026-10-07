import { describe, it, expect, beforeEach } from 'vitest';
import type { AppData } from '@/types';

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

const { loadData, saveData, migrateData, CURRENT_VERSION, importData, resetData } = await import('./storage');

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
    const data = loadData();
    expect(data.version).toBe(CURRENT_VERSION);
    expect(data.profile).toBeUndefined();
    expect(data.checkIns).toEqual([]);
  });

  it('migrates an onboarded v2 user to a v3 profile without touching history', () => {
    const migrated = migrateData(v2Data());
    expect(migrated.version).toBe(3);
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

  it('round-trips v3 data unchanged', () => {
    const migrated = migrateData(v2Data());
    saveData(migrated);
    expect(loadData()).toEqual(migrated);
  });

  it('falls back to defaults on corrupt JSON', () => {
    store.set('fit-strong-90-data', '{not json');
    expect(loadData().version).toBe(CURRENT_VERSION);
  });

  it('migrates an imported v2 export', () => {
    expect(importData(JSON.stringify(v2Data()))).toBe(true);
    expect(loadData().profile?.weightKg).toBe(82);
  });

  it('never hands out the shared default object', () => {
    const a = loadData();
    a.sessions.push(v2Data().sessions[0]);
    expect(loadData().sessions).toHaveLength(0);
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
    saveData(migrateData(v2Data()));
    store.set('fit-strong-90-guided', '{"plan":{"readiness":{"reasons":[{"message":"Glucose below 54 mg/dL"}]}}}');
    store.set('fit-strong-90-anything-later', 'x');
    store.set('some-other-app', 'keep me');

    resetData();

    expect([...store.keys()]).toEqual(['some-other-app']);
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
