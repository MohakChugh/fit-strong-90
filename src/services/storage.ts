import type {
  AppData,
  UserSettings,
  WorkoutSession,
  BodyMetric,
  PersonalRecord,
} from '@/types';

const STORAGE_KEY = 'fit-strong-90-data';
const CURRENT_VERSION = 2;

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
};

/**
 * Load data from localStorage
 */
export function loadData(): AppData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULT_DATA;
    }

    const data = JSON.parse(stored) as AppData;

    // Handle migration if needed
    if (data.version < CURRENT_VERSION) {
      return migrateData(data);
    }

    return data;
  } catch (error) {
    console.error('Failed to load data from localStorage:', error);
    return DEFAULT_DATA;
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

    // Save the imported data
    saveData(data);
    return true;
  } catch (error) {
    console.error('Failed to import data:', error);
    return false;
  }
}

/**
 * Reset all data to defaults
 */
export function resetData(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Migrate data from older versions
 */
function migrateData(data: AppData): AppData {
  let migrated = { ...data };

  // v1 → v2: Add warmup/cooldown/superset settings (all optional fields, no data loss)
  if (migrated.version < 2) {
    migrated.settings = {
      ...migrated.settings,
      warmupEnabled: migrated.settings.warmupEnabled ?? false,
      cooldownEnabled: migrated.settings.cooldownEnabled ?? false,
      defaultWarmupExercises: migrated.settings.defaultWarmupExercises ?? ['hip-opener-stretch', 'hamstring-stretch', 'treadmill-walk'],
      defaultCooldownExercises: migrated.settings.defaultCooldownExercises ?? ['thoracic-opener', 'breathing-cooldown'],
      supersetRestSeconds: migrated.settings.supersetRestSeconds ?? 20,
    };
  }

  migrated.version = CURRENT_VERSION;
  return migrated;
}
