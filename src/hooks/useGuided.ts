import { useCallback, useMemo } from 'react';
import { useAppData } from '@/hooks/useLocalStorage';
import type { CheckInRecord, DailyCheckIn, Readiness } from '@/types/checkin';
import type { SessionPlan } from '@/types/plan';
import type { UserProfile } from '@/types/profile';
import { createDefaultProfile } from '@/profile/defaults';
import { buildSessionPlan } from '@/engine/session';
import { evaluateCheckIn } from '@/engine/readiness';
import { todayString } from '@/lib/utils';

/** Today's profile, check-in and plan, rebuilt whenever any input changes. */
export function useGuided(date: string = todayString()) {
  const [data, update] = useAppData();
  const profile: UserProfile = useMemo(
    () => data.profile ?? createDefaultProfile({ weightKg: data.settings.currentWeight || 0, needsHealthReview: true }),
    [data.profile, data.settings.currentWeight],
  );
  const checkIns = useMemo(() => data.checkIns ?? [], [data.checkIns]);
  const checkIn = checkIns.find(c => c.date === date);

  const plan: SessionPlan = useMemo(
    () => buildSessionPlan({
      profile, date, startDate: data.settings.startDate, sessions: data.sessions,
      recentCheckIns: checkIns.filter(c => c.date < date), ...(checkIn ? { checkIn } : {}),
    }),
    [profile, date, data.settings.startDate, data.sessions, checkIns, checkIn],
  );

  const saveCheckIn = useCallback((c: DailyCheckIn): Readiness => {
    const readiness = evaluateCheckIn(profile, c, checkIns.filter(x => x.date < c.date));
    const record: CheckInRecord = { ...c, readiness };
    update(prev => ({ ...prev, checkIns: [...(prev.checkIns ?? []).filter(x => x.date !== c.date), record] }));
    return readiness;
  }, [profile, checkIns, update]);

  return { data, update, profile, date, checkIn, plan, saveCheckIn };
}
