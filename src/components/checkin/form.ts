import type { DailyCheckIn } from '@/types/checkin';
import type { GlucoseSanity } from '@/engine/readiness';

/**
 * Which glucose readings reach the readiness engine: plausible ones, and an
 * ambiguous low (5.5 entered in mg/dL), which the engine treats as a severe low.
 * Dropping that one would turn "treat this low now" into a full workout.
 */
export const submitsGlucose = (sanity: GlucoseSanity): boolean => sanity === 'ok' || sanity === 'ambiguousLow';

/**
 * The blood-pressure inputs for a check-in being edited. Only the average is
 * stored, so it comes back as the first reading; leaving it blank would drop
 * the BP from the re-evaluated readiness.
 */
export function initialBp(saved?: DailyCheckIn['bp']): { s1: string; d1: string; s2: string; d2: string } {
  return saved ? { s1: String(saved.sys), d1: String(saved.dia), s2: '', d2: '' } : { s1: '', d1: '', s2: '', d2: '' };
}

/**
 * Why the check-in can't be submitted yet, or null. After a treat-and-recheck
 * outcome a new glucose reading is required: leaving it blank would otherwise
 * clear the recheck without anyone measuring.
 */
export function submitBlocked(o: { sanity: GlucoseSanity; needsReading: boolean; hasReading: boolean }): string | null {
  if (o.sanity === 'implausible' || o.sanity === 'suspectUnit') return 'Check the glucose reading first.';
  if (o.needsReading && !o.hasReading) return 'Enter your new glucose reading to carry on.';
  return null;
}
