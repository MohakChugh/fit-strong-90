/**
 * The v1–v4 `localStorage` schema, kept only for what it still does: lift old
 * data to v4 (`migrateData`) so the store can move it into IndexedDB, and sweep
 * the old keys (`resetData`). Nothing reads or writes the v4 blob any more —
 * the store (`src/store`) is the record.
 */
import type { AppData, UserSettings, DayOfWeek } from '@/types';
import { createDefaultProfile, type ProfileInput } from '@/profile/defaults';
import { calculateVolume, deriveRecords, displayToCm, displayToKg } from '@/lib/utils';

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

/**
 * The start of every key the app keeps in browser storage: the record, its
 * drafts and progress, and its preferences. One list, so the sweep below
 * reaches a key added later too (D-05).
 */
export const APP_KEY_PREFIX = 'fit-strong';

/**
 * Reset all data to defaults.
 *
 * Sweeps every key under the app's prefix, not just the main blob, in
 * `localStorage` and in the tab's `sessionStorage`: an in-progress guided
 * session holds the whole plan, including readiness reasons that quote the
 * user's glucose and eye disease, and a walk in progress or an unsaved Quick
 * Log reading lives in the tab, which a reload keeps. "Clear all data" must
 * leave nothing behind (spec §10.2).
 */
export function resetData(): void {
  for (const storage of [globalThis.localStorage, globalThis.sessionStorage]) {
    if (!storage) continue;
    const owned = Array.from({ length: storage.length }, (_, i) => storage.key(i))
      .filter((key): key is string => key !== null && key.startsWith(APP_KEY_PREFIX));
    for (const key of owned) storage.removeItem(key);
  }
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
