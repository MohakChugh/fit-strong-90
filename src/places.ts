import type { WorkoutSession } from '@/types';
import type { CheckInRecord } from '@/types/checkin';
import { pairBloodPressure } from '@/health/aggregate';
import { bpReadingId, isBpKind, type Observation } from '@/health/observation';
import { walkRecords } from '@/walk/record';

/** One record's address under Track (screens/track/routes.tsx, screens/workout/routes.tsx). */
const RECORD = /^\/track\/(reading|pressure|walk|session|workout|check-in)\/([^/]+)$/;

/**
 * Whether a tab may go back to a place it remembers: a screen that shows one
 * record needs that record still stored. After a delete, or a restore that
 * replaced the record, the tab opens at its root instead of on "This record
 * is gone" (acceptance J18). Each check finds the record the way its screen
 * does (screens/track/RecordDetails.tsx, screens/workout/RecordScreen.tsx);
 * every other address leads somewhere by itself.
 */
export function placeExists(
  pathname: string,
  record: { observations: readonly Observation[]; sessions: readonly WorkoutSession[]; checkIns: readonly CheckInRecord[] },
): boolean {
  const match = RECORD.exec(pathname);
  if (!match) return true;
  let id: string;
  try {
    id = decodeURIComponent(match[2]);
  } catch {
    return false;
  }
  switch (match[1]) {
    case 'reading':
      return record.observations.some(o => o.id === id);
    case 'pressure':
      return pairBloodPressure(record.observations.filter(o => isBpKind(o.kind) && (bpReadingId(o.context) ?? o.id) === id)).length > 0;
    case 'walk':
      return walkRecords(record.observations).some(w => w.id === id);
    case 'check-in':
      return record.checkIns.some(c => c.date === id) || record.sessions.some(s => s.checkIn?.date === id);
    default:
      return record.sessions.some(s => s.id === id);
  }
}
