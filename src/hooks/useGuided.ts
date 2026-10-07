import { useCallback, useMemo } from 'react';
import { useAppData } from '@/hooks/useLocalStorage';
import type { AppData } from '@/types';
import type { CheckInRecord, DailyCheckIn, Readiness } from '@/types/checkin';
import type { DayFocus, SessionPlan } from '@/types/plan';
import type { UserProfile } from '@/types/profile';
import { createDefaultProfile } from '@/profile/defaults';
import { buildSessionPlan } from '@/engine/session';
import { evaluateCheckIn } from '@/engine/readiness';
import { swapOptions } from '@/session/manual';
import { todayString } from '@/lib/utils';

/** The workout swapped in for `date` on the Workout page, if the swap dialog still offers it. */
export function focusOverrideFor(data: Pick<AppData, 'focusOverrides'>, profile: Pick<UserProfile, 'trainingDays'>, date: string): DayFocus | undefined {
  const focus = data.focusOverrides?.[date];
  return swapOptions(profile).find(o => o.focus === focus)?.focus;
}

/**
 * The plan for `date`, built the same way on Today, Workout and the guided
 * session. Only earlier sessions feed it, so logging today's sets never
 * reshuffles today's plan.
 */
export function planFor(data: AppData, profile: UserProfile, date: string): SessionPlan {
  const checkIns = data.checkIns ?? [];
  const checkIn = checkIns.find(c => c.date === date);
  const focusOverride = focusOverrideFor(data, profile, date);
  return buildSessionPlan({
    profile, date, startDate: data.settings.startDate,
    sessions: data.sessions.filter(s => s.date < date),
    recentCheckIns: checkIns.filter(c => c.date < date),
    ...(checkIn ? { checkIn } : {}),
    ...(focusOverride ? { focusOverride } : {}),
  });
}

/** Today's profile, check-in and plan, rebuilt whenever any input changes. */
export function useGuided(date: string = todayString()) {
  const [data, update] = useAppData();
  const profile: UserProfile = useMemo(
    () => data.profile ?? createDefaultProfile({ weightKg: data.settings.currentWeight || 0, needsHealthReview: true }),
    [data.profile, data.settings.currentWeight],
  );
  const checkIns = useMemo(() => data.checkIns ?? [], [data.checkIns]);
  const checkIn = checkIns.find(c => c.date === date);

  const plan: SessionPlan = useMemo(() => planFor(data, profile, date), [data, profile, date]);

  const saveCheckIn = useCallback((c: DailyCheckIn): Readiness => {
    const readiness = evaluateCheckIn(profile, c, checkIns.filter(x => x.date < c.date));
    const record: CheckInRecord = { ...c, readiness };
    update(prev => ({ ...prev, checkIns: [...(prev.checkIns ?? []).filter(x => x.date !== c.date), record] }));
    return readiness;
  }, [profile, checkIns, update]);

  return { data, update, profile, date, checkIn, plan, saveCheckIn };
}
