/**
 * Which unfinished workout the Workout Log picks back up.
 *
 * A workout in progress is a stored record with status `in_progress`, so it
 * survives a reload, a locked phone and the app being closed. Today's is
 * continued. One begun late last night is continued for a few hours past
 * midnight, and keeps its own date. Anything older is not silently resumed or
 * silently finished: it is listed, so it can be saved as it stands.
 */

import type { WorkoutSession } from '@/types';
import { parseDateString, toDateString } from '@/lib/utils';

/** How long after it began a workout carried past midnight is still picked back up. */
export const CARRY_OVER_MS = 4 * 60 * 60 * 1000;

/** Unfinished and logged by hand: the guided session keeps its own progress. */
const unfinished = (s: WorkoutSession) => !s.guided && s.status === 'in_progress';

export function resumable(sessions: WorkoutSession[], today: string, now: number): WorkoutSession | undefined {
  return sessions
    .filter(s => unfinished(s) && (s.date === today || (s.startedAt !== null && now - Date.parse(s.startedAt) < CARRY_OVER_MS)))
    .sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''))[0];
}

export function abandoned(sessions: WorkoutSession[], today: string, now: number): WorkoutSession[] {
  const current = resumable(sessions, today, now);
  return sessions.filter(s => unfinished(s) && s.id !== current?.id);
}

/**
 * A `?date=` the log may write to, for a workout done but not logged at the
 * time: a real calendar date before today. The address can be typed, so
 * anything else — not a date, a 31 February, the future, today — is ignored.
 */
export function pastDate(param: string | null, today: string): string | undefined {
  if (!param || !/^\d{4}-\d{2}-\d{2}$/.test(param)) return undefined;
  const d = parseDateString(param);
  if (Number.isNaN(d.getTime()) || toDateString(d) !== param) return undefined;
  return param < today ? param : undefined;
}

/** The newest unfinished workout logged by hand for a date, to carry on writing it down. */
export function unfinishedOn(sessions: WorkoutSession[], date: string): WorkoutSession | undefined {
  return sessions
    .filter(s => unfinished(s) && s.date === date)
    .sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''))[0];
}
