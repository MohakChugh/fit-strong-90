/**
 * The 12-week programme's own Join flow (journey §6.2 ch. 6; D35; board D81):
 * experience, place, days, and session length with a start date. Setup opens
 * it from "Join the 12-week strength programme?", Your plan and Goals from
 * "Join the 12-week programme": the same answers and the same write. It isn't
 * part of setup's page count (L-01).
 */
import { format, parseISO } from 'date-fns';
import type { AppData } from '@/types';
import type { UserProfile } from '@/types/profile';
import type { JoinAnswers } from '@/types/setup';
import { WEEK } from '@/engine/templates';
import { isDay } from '@/health/observation';
import { createDefaultProfile } from '@/profile/defaults';

export const JOIN_STEPS = ['experience', 'place', 'days', 'length'] as const;
export type JoinStep = (typeof JOIN_STEPS)[number];

/** Any real day from today on. */
export function startDateProblem(date: string, today: string): string | null {
  if (!isDay(date)) return 'Choose a start date.';
  return date < today ? 'Choose today or a later day.' : null;
}

export function joinProblem(step: JoinStep, j: JoinAnswers, today: string): string | null {
  if (step === 'days') return j.days.length === 0 ? 'Choose at least one day.' : null;
  if (step === 'length') return startDateProblem(j.startDate, today);
  return null;
}

/** The first answers: what the profile already says, as labelled usual choices (§6.1), starting today. */
export function joinInitial(profile: UserProfile | undefined, today: string): JoinAnswers {
  const p = profile ?? createDefaultProfile();
  return { experience: p.experience, equipment: p.equipment, days: [...p.trainingDays], minutes: p.sessionMinutes, startDate: today };
}

/** The record after joining: the programme's answers on the profile, and its start date. Nothing else changes (D35, scan D-03). */
export function withJoinAnswers<T extends Pick<AppData, 'profile' | 'settings'>>(data: T, j: JoinAnswers): T {
  const profile = data.profile ?? createDefaultProfile({ weightKg: data.settings.currentWeight || 0, needsHealthReview: true });
  return {
    ...data,
    profile: { ...profile, experience: j.experience, equipment: j.equipment, trainingDays: WEEK.filter(d => j.days.includes(d)), sessionMinutes: j.minutes },
    settings: { ...data.settings, startDate: j.startDate },
  };
}

/** "3 days a week, 45 minutes, from Monday 12 October". */
export function joinLine(j: JoinAnswers): string {
  const days = j.days.length === 1 ? '1 day a week' : `${j.days.length} days a week`;
  return `${days}, ${j.minutes} minutes, from ${format(parseISO(j.startDate), 'EEEE d MMMM')}`;
}
