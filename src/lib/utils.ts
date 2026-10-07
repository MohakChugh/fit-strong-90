import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"
import type { AppData, DayOfWeek, Phase, WorkoutSession, WorkoutSet, WorkoutStatus, PersonalRecord } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ============================================================================
// Date Utilities
// ============================================================================

/** Total weeks in the program. Phases are 4 weeks each. */
export const TOTAL_WEEKS = 12;

/** Training days per week (Sunday is a rest day). */
export const TRAINING_DAYS_PER_WEEK = 6;

/**
 * Convert a Date to a 'YYYY-MM-DD' string using the LOCAL calendar date.
 *
 * Never use `date.toISOString().split('T')[0]` for this: toISOString converts
 * to UTC first, so for any user behind UTC it yields the previous day.
 */
export function toDateString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Today's date as a local 'YYYY-MM-DD' string
 */
export function todayString(): string {
  return toDateString(new Date());
}

/**
 * Parse a 'YYYY-MM-DD' string as local midnight (not UTC midnight)
 */
export function parseDateString(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00');
}

/**
 * Get the current day of week
 */
export function getCurrentDayOfWeek(): DayOfWeek {
  return getDayOfWeekFromDate(todayString());
}

/**
 * Get the day of week from a date string (YYYY-MM-DD)
 */
export function getDayOfWeekFromDate(dateStr: string): DayOfWeek {
  const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[parseDateString(dateStr).getDay()];
}

/**
 * Format a date as "Mon, Mar 30"
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format a date as "March 30, 2026"
 */
export function formatDateFull(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Get the program week number (1-indexed) for a date, clamped to 1..TOTAL_WEEKS.
 *
 * The start date itself is day 0, which is week 1. Day 7 is week 2.
 * Dates before the start date clamp to week 1; dates past the end of the
 * program clamp to TOTAL_WEEKS so downstream phase lookups never fail.
 */
export function getWeekNumber(startDate: string, currentDate?: string): number {
  if (!startDate) return 1;

  const start = parseDateString(startDate);
  const current = parseDateString(currentDate ?? todayString());

  if (isNaN(start.getTime()) || isNaN(current.getTime())) return 1;

  const diffDays = Math.floor(
    (current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );
  const week = Math.floor(diffDays / 7) + 1;

  return Math.min(Math.max(week, 1), TOTAL_WEEKS);
}

/**
 * Get the phase for a given week number.
 *
 * Total, so it never throws: out-of-range weeks clamp to the nearest phase.
 */
export function getPhaseForWeek(week: number): Phase {
  if (week <= 4) return 'foundation';
  if (week <= 8) return 'hypertrophy';
  return 'strength';
}

/**
 * Check if a date string (YYYY-MM-DD) is today
 */
export function isToday(dateStr: string): boolean {
  return dateStr === todayString();
}

// ============================================================================
// Workout Utilities
// ============================================================================

/**
 * Calculate total volume (weight * reps) for completed sets
 */
export function calculateVolume(sets: WorkoutSet[]): number {
  return sets
    .filter(set => set.status === 'completed' && set.weight !== null && set.actualReps !== null)
    .reduce((sum, set) => sum + (set.weight! * set.actualReps!), 0);
}

/**
 * Calculate the current workout streak (consecutive days with completed workouts)
 */
export function calculateStreak(sessions: WorkoutSession[]): number {
  if (sessions.length === 0) return 0;

  // Sort sessions by date (newest first)
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));

  const today = parseDateString(todayString());

  let streak = 0;
  for (const session of sorted) {
    const sessionDate = parseDateString(session.date);
    const daysDiff = Math.floor(
      (today.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // If this is the next expected day and the workout was completed
    if (daysDiff === streak && session.status === 'completed') {
      streak++;
    } else if (daysDiff > streak) {
      // Gap in the streak
      break;
    }
  }

  return streak;
}

/**
 * Get workouts from the current week
 */
export function getWorkoutsThisWeek(sessions: WorkoutSession[]): WorkoutSession[] {
  const now = new Date();

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  // Compare as 'YYYY-MM-DD' strings: lexicographic order matches chronological
  // order for this format, and it avoids any timezone parsing entirely.
  const start = toDateString(startOfWeek);
  const end = toDateString(endOfWeek);

  return sessions.filter(session => session.date >= start && session.date <= end);
}

/**
 * Get weekly statistics
 */
export function getWeeklyStats(sessions: WorkoutSession[]): {
  workouts: number;
  totalSets: number;
  totalReps: number;
  totalVolume: number;
} {
  const weekSessions = getWorkoutsThisWeek(sessions);
  const completedSessions = weekSessions.filter(s => s.status === 'completed');

  const totalSets = completedSessions.reduce(
    (sum, session) => sum + session.sets.filter(s => s.status === 'completed').length,
    0
  );

  const totalReps = completedSessions.reduce(
    (sum, session) => sum + session.sets
      .filter(s => s.status === 'completed' && s.actualReps !== null)
      .reduce((reps, set) => reps + set.actualReps!, 0),
    0
  );

  const totalVolume = completedSessions.reduce(
    (sum, session) => sum + session.totalVolume,
    0
  );

  return {
    workouts: completedSessions.length,
    totalSets,
    totalReps,
    totalVolume,
  };
}

/**
 * Detect if a new set is a personal record
 */
export function detectPR(
  exerciseId: string,
  weight: number,
  reps: number,
  existingPRs: PersonalRecord[]
): boolean {
  const volume = weight * reps;
  const currentPR = existingPRs.find(pr => pr.exerciseId === exerciseId);

  return !currentPR || volume > currentPR.volume;
}

/**
 * Personal records rebuilt from the logged sets: each exercise's best completed
 * set by volume (weight × reps, the measure `detectPR` uses), the earliest on a
 * tie. A record for an exercise no session logs, such as an imported one, is kept.
 */
export function deriveRecords(sessions: WorkoutSession[], existing: PersonalRecord[]): PersonalRecord[] {
  const logged = new Set<string>();
  const best = new Map<string, PersonalRecord>();
  for (const session of [...sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const set of session.sets) {
      logged.add(set.exerciseId);
      if (set.status !== 'completed' || !set.weight || !set.actualReps) continue;
      const volume = set.weight * set.actualReps;
      if (volume <= (best.get(set.exerciseId)?.volume ?? 0)) continue;
      best.set(set.exerciseId, { exerciseId: set.exerciseId, weight: set.weight, reps: set.actualReps, date: session.date, volume });
    }
  }
  return [...existing.filter(r => !logged.has(r.exerciseId)), ...best.values()];
}

/**
 * Change one session, then refresh what its sets feed: the session's volume
 * and the personal records.
 */
export function editSession(data: AppData, sessionId: string, edit: (session: WorkoutSession) => WorkoutSession): AppData {
  const sessions = data.sessions.map(s => {
    if (s.id !== sessionId) return s;
    const edited = edit(s);
    return { ...edited, totalVolume: calculateVolume(edited.sets) };
  });
  return { ...data, sessions, personalRecords: deriveRecords(sessions, data.personalRecords) };
}

// ============================================================================
// Weight Units
// ============================================================================

/** Pounds per kilogram. Weights are stored in kilograms; pounds exist only on screen. */
/**
 * A finished manual workout counts as completed once at least half its sets
 * were done, like a guided one; some done is partial, none is skipped. A
 * "Finish" tap with nothing logged must not feed the streak.
 */
export function finishedStatus(sets: WorkoutSet[]): WorkoutStatus {
  const done = sets.filter(s => s.status === 'completed').length;
  if (done === 0) return 'skipped';
  return done * 2 >= sets.length ? 'completed' : 'partial';
}

export const LB_PER_KG = 2.20462;

/**
 * A stored weight (kg) in the user's unit, rounded for display: to 0.1 lb, or
 * to 0.01 kg so plate steps like 1.25 kg survive.
 */
export function kgToDisplay(kg: number, useMetric: boolean): number {
  return useMetric ? Math.round(kg * 100) / 100 : Math.round(kg * LB_PER_KG * 10) / 10;
}

/**
 * A weight typed in the user's unit, in kilograms for storage. Not rounded, so
 * the pounds typed are exactly the pounds shown back.
 */
export function displayToKg(value: number, useMetric: boolean): number {
  return useMetric ? value : value / LB_PER_KG;
}

export const CM_PER_IN = 2.54;

/** A stored measurement (cm) in the user's unit, to 0.1 cm or 0.1 inch. */
export function cmToDisplay(cm: number, useMetric: boolean): number {
  return Math.round((useMetric ? cm : cm / CM_PER_IN) * 10) / 10;
}

/** A measurement typed in the user's unit, in centimetres for storage. */
export function displayToCm(value: number, useMetric: boolean): number {
  return useMetric ? value : value * CM_PER_IN;
}

// ============================================================================
// Format Utilities
// ============================================================================

/**
 * Format a stored weight (kg) in the user's unit
 */
export function formatWeight(kg: number, useMetric: boolean): string {
  return `${kgToDisplay(kg, useMetric)} ${useMetric ? 'kg' : 'lbs'}`;
}

/**
 * Format duration in seconds to "M:SS" format
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Generate a simple unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
