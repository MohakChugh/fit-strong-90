import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  effectiveCheckIns, pendingCheckInsVersion, reportSymptoms as reportInto, resetPendingCheckInsForTests, saveCheckInRecord,
  subscribePendingCheckIns, unstoredCheckIn, type SymptomReport,
} from '@/components/checkin/pending';
import { useAppData } from '@/hooks/useLocalStorage';
import { useStore } from '@/store/useStore';
import { evaluateCheckIn } from '@/engine/readiness';
import type { AppData } from '@/types';
import type { CheckInRecord, DailyCheckIn } from '@/types/checkin';
import { DISPOSITION_ORDER } from '@/types/checkin';
import type { DayFocus, SessionPlan } from '@/types/plan';
import type { UserProfile } from '@/types/profile';
import { createDefaultProfile } from '@/profile/defaults';
import { buildSessionPlan } from '@/engine/session';
import { swapOptions } from '@/session/manual';
import { toDateString, todayString } from '@/lib/utils';
import { periodOn } from '@/health/status';

export type { SaveResult, SymptomReport } from '@/components/checkin/pending';

/** Test seam: forget any answers waiting to be stored. */
export const resetUnstoredForTests = resetPendingCheckInsForTests;

const rank = (r: CheckInRecord) => DISPOSITION_ORDER.indexOf(r.readiness.disposition ?? 'adjust');

/**
 * Kept for callers that already hold both records: the stricter of the
 * stored record and one waiting to be stored. New code should read
 * `useGuided().checkIn`, or `effectiveCheckIns` outside React, which also keep
 * every reading of both.
 */
export function effectiveCheckIn(stored: CheckInRecord | undefined, draft: CheckInRecord | null | undefined, date: string): CheckInRecord | undefined {
  if (!draft || draft.date !== date) return stored;
  if (!stored) return draft;
  return rank(draft) >= rank(stored) ? draft : stored;
}

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
    // A declared flare-up is a gentle day for the guided session too (D25, X2-16).
    ...(periodOn(data.settings.statusPeriods, date)?.kind === 'flare' ? { flare: true } : {}),
  });
}

/** Today's profile, check-in and plan, rebuilt whenever any input changes. */
export function useGuided(date: string = todayString()) {
  const [data, update] = useAppData();
  const profile: UserProfile = useMemo(
    () => data.profile ?? createDefaultProfile({ weightKg: data.settings.currentWeight || 0, needsHealthReview: true }),
    [data.profile, data.settings.currentWeight],
  );
  // Answers the device has not stored yet count everywhere, for every day,
  // the moment they are given (round 3 B04).
  const pending = useSyncExternalStore(subscribePendingCheckIns, pendingCheckInsVersion, pendingCheckInsVersion);
  // Readings logged in Track reach every gate as the check-in's own do (scan X2-01).
  const { observations } = useStore();
  const checkIns = useMemo(
    () => effectiveCheckIns(data.checkIns ?? [], profile, observations),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.checkIns, profile, pending, observations],
  );
  // Today's, evaluated against the profile as it is now: advice stored with
  // the record can be out of date, such as extra water after a fluid limit
  // was recorded (scan X2-12).
  const checkIn = useMemo(() => {
    const c = checkIns.find(x => x.date === date);
    return c ? { ...c, readiness: evaluateCheckIn(profile, c, checkIns.filter(x => x.date < date)) } : undefined;
  }, [checkIns, date, profile]);

  const plan: SessionPlan = useMemo(
    () => planFor({ ...data, checkIns }, profile, date),
    [data, checkIns, profile, date],
  );

  /**
   * Save today's answers and say what happened (`saveCheckInRecord`): merged
   * against what is stored and anything still waiting to be, so resubmitting
   * can never erase a reading; the merged record comes back to be evaluated;
   * an answer the device refuses keeps counting until a later write covers it.
   */
  const saveCheckIn = useCallback((c: DailyCheckIn) => saveCheckInRecord(c, { profile, update }), [profile, update]);
  /**
   * Symptoms said during movement, added to the check-in of the day they are
   * said on, the same way from every screen (`reportSymptoms`). The day comes
   * from the moment of the report, not from this screen's last render: a
   * session left open across midnight files 00:05 on the new day (scan M-01).
   */
  const reportSymptoms = useCallback(
    (report: SymptomReport, at: Date = new Date()) => reportInto(report, { profile, update, date: toDateString(at) }, at),
    [profile, update],
  );

  return {
    data, update, profile, date,
    /** Today's effective check-in: stored, or waiting to be. What every gate reads. */
    checkIn,
    /** Every day's effective check-in, oldest first: pass as `recent`. */
    checkIns,
    plan, saveCheckIn, reportSymptoms,
    /** Today's answers the device refused to store, if any. */
    unstored: pending >= 0 ? unstoredCheckIn(date) : null,
  };
}
