import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { DayOfWeek, Phase, WorkoutSession, WorkoutSet, PersonalRecord } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ============================================================================
// Date Utilities
// ============================================================================

/**
 * Get the current day of week
 */
export function getCurrentDayOfWeek(): DayOfWeek {
  return getDayOfWeekFromDate(new Date().toISOString().split('T')[0]);
}

/**
 * Get the day of week from a date string (YYYY-MM-DD)
 */
export function getDayOfWeekFromDate(dateStr: string): DayOfWeek {
  const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const date = new Date(dateStr + 'T00:00:00');
  return days[date.getDay()];
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
 * Get the week number (1-indexed) from the start date
 */
export function getWeekNumber(startDate: string, currentDate?: string): number {
  const start = new Date(startDate);
  const current = currentDate ? new Date(currentDate) : new Date();

  const diffTime = current.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return Math.floor(diffDays / 7) + 1;
}

/**
 * Get the phase for a given week number
 */
export function getPhaseForWeek(week: number): Phase {
  if (week <= 4) return 'foundation';
  if (week <= 8) return 'hypertrophy';
  return 'strength';
}

/**
 * Check if a date string is today
 */
export function isToday(dateStr: string): boolean {
  const today = new Date();
  const date = new Date(dateStr);

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

/**
 * Get an array of ISO date strings between two dates
 */
export function getDaysInRange(start: string, end: string): string[] {
  const days: string[] = [];
  const startDate = new Date(start);
  const endDate = new Date(end);

  const current = new Date(startDate);
  while (current <= endDate) {
    days.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return days;
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

  let streak = 0;
  let currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  for (const session of sorted) {
    const sessionDate = new Date(session.date);
    sessionDate.setHours(0, 0, 0, 0);

    const daysDiff = Math.floor((currentDate.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));

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
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return sessions.filter(session => {
    const sessionDate = new Date(session.date);
    return sessionDate >= startOfWeek && sessionDate <= endOfWeek;
  });
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

// ============================================================================
// Format Utilities
// ============================================================================

/**
 * Format weight with unit
 */
export function formatWeight(weight: number, useMetric: boolean): string {
  const unit = useMetric ? 'kg' : 'lbs';
  return `${weight} ${unit}`;
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
