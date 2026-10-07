import type {
  AppData,
  UserSettings,
  WorkoutSession,
  BodyMetric,
  PersonalRecord,
  DayOfWeek,
} from '@/types';
import { createDefaultProfile, type ProfileInput } from '@/profile/defaults';
import { calculateVolume, deriveRecords, displayToCm, displayToKg } from '@/lib/utils';

/** Every localStorage key this app owns starts with this (see `resetData`). */
const KEY_PREFIX = 'fit-strong-90';
const STORAGE_KEY = `${KEY_PREFIX}-data`;
export const CURRENT_VERSION = 4;

// Default settings
const DEFAULT_SETTINGS: UserSettings = {
  startDate: '',
  currentWeight: 0,
  targetGoal: '',
  defaultRestSeconds: 90,
  useMetric: true,
  theme: 'system',
  onboardingComplete: false,
  gymDays: {
    monday: 'back',
    tuesday: 'chest',
    wednesday: 'legs',
    thursday: 'shoulders',
    friday: 'arms',
    saturday: 'core',
    sunday: 'rest',
  },
  warmupEnabled: false,
  cooldownEnabled: false,
  defaultWarmupExercises: ['hip-opener-stretch', 'hamstring-stretch', 'treadmill-walk'],
  defaultCooldownExercises: ['thoracic-opener', 'breathing-cooldown'],
  supersetRestSeconds: 20,
};

const DEFAULT_DATA: AppData = {
  version: CURRENT_VERSION,
  settings: DEFAULT_SETTINGS,
  sessions: [],
  bodyMetrics: [],
  personalRecords: [],
  checkIns: [],
};

/** A fresh copy, so callers can never mutate the shared default. */
function defaultData(): AppData {
  return structuredClone(DEFAULT_DATA);
}

/**
 * Load data from localStorage
 */
export function loadData(): AppData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return defaultData();
    }

    // Migrate older versions; for current data this only fills missing profile fields.
    return migrateData(JSON.parse(stored) as AppData);
  } catch (error) {
    console.error('Failed to load data from localStorage:', error);
    return defaultData();
  }
}

/**
 * Save data to localStorage
 */
export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save data to localStorage:', error);
  }
}

/**
 * Update user settings
 */
export function updateSettings(settings: Partial<UserSettings>): UserSettings {
  const data = loadData();
  const updatedSettings = { ...data.settings, ...settings };
  saveData({ ...data, settings: updatedSettings });
  return updatedSettings;
}

/**
 * Save or update a workout session
 */
export function saveSession(session: WorkoutSession): void {
  const data = loadData();
  const existingIndex = data.sessions.findIndex((s) => s.id === session.id);

  if (existingIndex >= 0) {
    data.sessions[existingIndex] = session;
  } else {
    data.sessions.push(session);
  }

  // Sort sessions by date (newest first)
  data.sessions.sort((a, b) => b.date.localeCompare(a.date));

  saveData(data);
}

/**
 * Get a workout session by date
 */
export function getSession(date: string): WorkoutSession | undefined {
  const data = loadData();
  return data.sessions.find((s) => s.date === date);
}

/**
 * Get all workout sessions
 */
export function getSessions(): WorkoutSession[] {
  const data = loadData();
  return data.sessions;
}

/**
 * Save or update a body metric
 */
export function saveBodyMetric(metric: BodyMetric): void {
  const data = loadData();
  const existingIndex = data.bodyMetrics.findIndex((m) => m.date === metric.date);

  if (existingIndex >= 0) {
    data.bodyMetrics[existingIndex] = metric;
  } else {
    data.bodyMetrics.push(metric);
  }

  // Sort metrics by date (newest first)
  data.bodyMetrics.sort((a, b) => b.date.localeCompare(a.date));

  saveData(data);
}

/**
 * Get all body metrics
 */
export function getBodyMetrics(): BodyMetric[] {
  const data = loadData();
  return data.bodyMetrics;
}

/**
 * Save a personal record (only if it's actually a new PR)
 */
export function savePersonalRecord(pr: PersonalRecord): void {
  const data = loadData();
  const existingPR = data.personalRecords.find(
    (record) => record.exerciseId === pr.exerciseId
  );

  // Only save if it's a new PR (higher volume)
  if (!existingPR || pr.volume > existingPR.volume) {
    if (existingPR) {
      // Update existing PR
      const index = data.personalRecords.indexOf(existingPR);
      data.personalRecords[index] = pr;
    } else {
      // Add new PR
      data.personalRecords.push(pr);
    }
    saveData(data);
  }
}

/**
 * Get all personal records
 */
export function getPersonalRecords(): PersonalRecord[] {
  const data = loadData();
  return data.personalRecords;
}

/**
 * Export data as JSON string
 */
export function exportData(): string {
  const data = loadData();
  return JSON.stringify(data, null, 2);
}

/**
 * Import data from JSON string
 */
export function importData(json: string): boolean {
  try {
    const data = JSON.parse(json) as AppData;

    // Validate the data structure
    if (
      !data.version ||
      !data.settings ||
      !Array.isArray(data.sessions) ||
      !Array.isArray(data.bodyMetrics) ||
      !Array.isArray(data.personalRecords)
    ) {
      console.error('Invalid data structure');
      return false;
    }

    // Always migrate, rather than only when the version looks older: an export
    // with an odd version must not slip past. migrateData is idempotent.
    saveData(migrateData(data));
    return true;
  } catch (error) {
    console.error('Failed to import data:', error);
    return false;
  }
}

/**
 * Reset all data to defaults.
 *
 * Sweeps every key under the app's prefix, not just the main blob: an
 * in-progress guided session is stored separately and holds the whole plan,
 * including the readiness reasons that quote the user's glucose and eye
 * disease. "Clear all data" must leave nothing behind (spec §10.2).
 */
export function resetData(): void {
  const owned = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
    .filter((key): key is string => key !== null && key.startsWith(KEY_PREFIX));
  for (const key of owned) localStorage.removeItem(key);
}

/**
 * "Reset All Data": clear everything, then reload onto onboarding. Every
 * mounted `useAppData`, App's route gate included, still holds the old data,
 * so only a full reload drops it, as import and finishing onboarding do.
 */
export function resetAndRestart(loc: Pick<Location, 'replace' | 'reload'> = window.location): void {
  resetData();
  loc.replace('#/onboarding');
  loc.reload();
}

/**
 * Migrate data from older versions
 */
export function migrateData(data: AppData): AppData {
  // A missing or unreadable version predates versioning, so treat it as v1:
  // comparing `undefined < 2` is false, which would skip every migration below
  // and then stamp the blob as current.
  const stored = Number(data.version);
  const from = Number.isFinite(stored) ? stored : 1;

  // Missing lists or settings (hand-edited backups, very old builds) get defaults.
  const migrated: AppData = {
    ...data,
    settings: { ...DEFAULT_DATA.settings, ...data.settings },
    sessions: Array.isArray(data.sessions) ? data.sessions : [],
    bodyMetrics: Array.isArray(data.bodyMetrics) ? data.bodyMetrics : [],
    personalRecords: Array.isArray(data.personalRecords) ? data.personalRecords : [],
  };

  // v1 → v2: Add warmup/cooldown/superset settings (all optional fields, no data loss)
  if (from < 2) {
    migrated.settings = {
      ...migrated.settings,
      warmupEnabled: migrated.settings.warmupEnabled ?? false,
      cooldownEnabled: migrated.settings.cooldownEnabled ?? false,
      defaultWarmupExercises: migrated.settings.defaultWarmupExercises ?? ['hip-opener-stretch', 'hamstring-stretch', 'treadmill-walk'],
      defaultCooldownExercises: migrated.settings.defaultCooldownExercises ?? ['thoracic-opener', 'breathing-cooldown'],
      supersetRestSeconds: migrated.settings.supersetRestSeconds ?? 20,
    };
  }

  // v2 → v3: guided-training profile and check-ins. Existing users get a
  // profile built from their settings and are asked to review the health
  // screen; nothing in their history changes.
  if (from < 3) {
    migrated.checkIns = migrated.checkIns ?? [];
    if (migrated.settings.onboardingComplete && !migrated.profile) {
      const trainingDays = (Object.entries(migrated.settings.gymDays ?? {}) as [DayOfWeek, string][])
        .filter(([, group]) => group !== 'rest')
        .map(([day]) => day);
      migrated.profile = createDefaultProfile({
        weightKg: migrated.settings.currentWeight || 0,
        ...(trainingDays.length > 0 ? { trainingDays } : {}),
        needsHealthReview: true,
      });
    }
  }

  // v3 → v4: weights are stored in kilograms. Manual sets used to be saved as
  // typed, so an imperial user's were pounds; guided sessions always logged
  // kilograms. Metric users' data is already right and stays untouched.
  if (from < 4 && migrated.settings.useMetric === false) {
    migrated.sessions = migrated.sessions.map(s => {
      if (s.guided === true) return s;
      const sets = s.sets.map(set => (set.weight === null ? set : { ...set, weight: displayToKg(set.weight, false) }));
      return { ...s, sets, totalVolume: calculateVolume(sets) };
    });
    migrated.personalRecords = deriveRecords(migrated.sessions, migrated.personalRecords);
    // Settings saved bodyweight as typed, while onboarding and the profile
    // saved kg: the profile says which one this is.
    const cw = migrated.settings.currentWeight;
    const kg = migrated.profile?.weightKg;
    // Within 10 % of the profile weight in kg it was kg; within 10 % once read as
    // pounds it was pounds (the two differ 2.2-fold, so they can't be confused).
    const near = (a: number) => Math.abs(a - (kg ?? 0)) <= 0.1 * (kg ?? 0);
    if (cw && kg && !near(cw) && near(displayToKg(cw, false))) {
      migrated.settings = { ...migrated.settings, currentWeight: Math.round(displayToKg(cw, false) * 100) / 100 };
    }
    // Body metrics were saved as typed too: pounds and inches.
    migrated.bodyMetrics = migrated.bodyMetrics.map(m => ({
      ...m,
      weight: m.weight === null ? null : displayToKg(m.weight, false),
      waist: m.waist === null ? null : displayToCm(m.waist, false),
    }));
  }

  // Fill any fields missing from a stored or imported profile (older builds,
  // hand-edited backups) so the planner never meets an incomplete profile.
  if (migrated.profile) migrated.profile = createDefaultProfile(migrated.profile as ProfileInput);
  migrated.checkIns = migrated.checkIns ?? [];

  migrated.version = CURRENT_VERSION;
  return migrated;
}
