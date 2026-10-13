/**
 * Restore, for every kind in Recently deleted (B-05, D110): each through the
 * module that holds its rules, each checked against what is stored when it is
 * written (P8R-14). A session's personal records are worked out again
 * (`restoreWorkout`); a check-in's reading goes back into its check-in and
 * the series (`restoreCheckInReading`), or, when the check-in holds it
 * already or has a newer answer, says so and leaves the list (K8-06);
 * everything else is the store's (`restoreDeleted`).
 */
import { ALREADY_BACK, NEWER_STAYS, restoreCheckInReading } from '@/components/checkin/pending';
import type { RecentDeletion } from '@/store/recent';
import { restoreDeleted, update } from '@/store/useStore';
import { restoreWorkout } from '@/screens/workout/deletion';
import type { UserProfile } from '@/types/profile';

export async function restoreEntry(e: RecentDeletion, profile: UserProfile | undefined): Promise<{ said?: string; problem?: string }> {
  if (e.kind === 'session') {
    const back = await restoreWorkout(e.id);
    return back.ok ? {} : { problem: back.failure.message };
  }
  if (e.kind === 'checkInReading') {
    if (!profile || !e.day || !e.kept) return { problem: 'It needs your profile to go back into its check-in.' };
    const back = await restoreCheckInReading({ id: e.id, kept: e.kept, ...(e.observations ? { observations: e.observations } : {}) }, { profile, update, date: e.day });
    if (back.unchanged) return { said: back.unchanged === 'already' ? ALREADY_BACK : NEWER_STAYS };
    return back.stored && back.matched ? {} : { problem: back.failure ?? 'The device did not keep it.' };
  }
  const back = await restoreDeleted(e.id);
  return back.ok ? {} : { problem: back.failure.message };
}
