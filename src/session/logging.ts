/**
 * Record a guided session as a standard WorkoutSession so History, Progress
 * and personal records keep working (spec §6.6).
 */

import type { AppData, PersonalRecord, WorkoutSession, WorkoutSet } from '@/types';
import type { CheckInRecord } from '@/types/checkin';
import type { SessionPlan } from '@/types/plan';
import { calculateVolume, detectPR, getDayOfWeekFromDate } from '@/lib/utils';
import { focusMuscleGroup } from '@/engine/templates';
import { stepSeconds } from '@/engine/timing';
import { updateLadder } from '@/engine/progression';
import { position, type RunnerState } from './runner';

export interface LogOptions {
  sessionId: string;
  checkIn?: CheckInRecord;
  painAfter?: number;
}

/**
 * Seconds the user actually spent, not the wall-clock span: a session paused at
 * 23:58 and resumed at 09:00 must not log nine hours (Review Focus #4). The
 * plan timeline the runner covered excludes paused time; the wall span caps it
 * so skipping quickly through the hour isn't reported as a full hour either.
 */
export function activeSeconds(plan: SessionPlan, state: RunnerState): number | undefined {
  if (state.startedAt === undefined || state.finishedAt === undefined) return undefined;
  if (state.activeMs !== undefined) return Math.round(state.activeMs / 1000);
  // Runs saved before the runner tracked active time: an estimate.
  const covered = position(plan, state, state.finishedAt).sessionElapsedMs;
  return Math.round(Math.min(state.finishedAt - state.startedAt, covered) / 1000);
}

export function toWorkoutSession(plan: SessionPlan, state: RunnerState, opts: LogOptions): WorkoutSession {
  const logById = new Map(state.logs.map(l => [l.stepId, l]));

  const sets: WorkoutSet[] = [];
  for (const step of plan.steps) {
    if (step.kind !== 'set' || step.ramp) continue;
    const log = logById.get(step.id);
    const done = !!log?.completed;
    sets.push({
      id: `${opts.sessionId}-${step.id}`,
      exerciseId: step.exerciseId,
      setNumber: step.set,
      plannedReps: step.reps,
      actualReps: done ? log?.reps ?? step.reps : null,
      weight: done ? log?.weightKg ?? step.load.kg : null,
      status: done ? 'completed' : log?.skipped ? 'skipped' : 'pending',
      rpe: null,
    });
  }

  const mobility = plan.steps
    .filter(s => (s.kind === 'hold' || s.kind === 'drill') && logById.get(s.id)?.completed)
    .map(s => ({ exerciseId: (s as { exerciseId: string }).exerciseId, seconds: stepSeconds(s) }));

  const cardioStep = plan.steps.find(s => s.kind === 'cardio');
  const cardioDone = cardioStep && logById.get(cardioStep.id)?.completed;

  const symptomChecks: Record<string, 'better' | 'same' | 'worse'> = {};
  for (const s of plan.steps) {
    if (s.kind !== 'checkpoint' || s.question !== 'backSymptoms' || !s.exerciseId) continue;
    const answer = logById.get(s.id)?.answer;
    if (answer === 'better' || answer === 'same' || answer === 'worse') symptomChecks[s.exerciseId] = answer;
  }

  // "Finish now", the low-glucose exit and an abandoned session all leave the
  // runner at `done`, so a session counts as completed only when the run got to
  // the end AND at least half of the exercise time was actually done. Otherwise
  // five minutes, or skipping straight through, would feed the streak and phase
  // progress as a full session (Review Focus #2).
  const lastStep = plan.steps[plan.steps.length - 1];
  const reachedEnd = state.status === 'done' && !!lastStep && logById.has(lastStep.id);
  const work = plan.steps.filter(s => s.kind === 'hold' || s.kind === 'drill' || s.kind === 'cardio' || (s.kind === 'set' && !s.ramp));
  const plannedWork = work.reduce((t, s) => t + stepSeconds(s), 0);
  const doneWork = work.filter(s => logById.get(s.id)?.completed).reduce((t, s) => t + stepSeconds(s), 0);
  const status: WorkoutSession['status'] = doneWork === 0
    ? (state.status === 'done' ? 'skipped' : 'in_progress')
    : reachedEnd && doneWork * 2 >= plannedWork ? 'completed' : 'partial';
  const seconds = activeSeconds(plan, state);
  const startedAt = state.startedAt ? new Date(state.startedAt).toISOString() : null;
  const completedAt = status === 'completed' && state.finishedAt !== undefined
    ? new Date(state.finishedAt).toISOString()
    : null;

  return {
    id: opts.sessionId,
    date: plan.date,
    dayOfWeek: getDayOfWeekFromDate(plan.date),
    muscleGroup: focusMuscleGroup(plan.focus),
    phase: plan.phase,
    week: plan.week,
    status,
    sets,
    startedAt,
    completedAt,
    notes: '',
    totalVolume: calculateVolume(sets),
    guided: true,
    focus: plan.focus,
    planId: plan.id,
    mobility,
    ...(cardioStep && cardioDone && plan.cardio
      ? { cardio: { modality: plan.cardio.modality, minutes: Math.round(stepSeconds(cardioStep) / 60), format: plan.cardio.format } }
      : {}),
    ...(opts.checkIn ? { checkIn: opts.checkIn } : {}),
    ...(opts.painAfter !== undefined ? { painAfter: opts.painAfter } : {}),
    ...(Object.keys(symptomChecks).length ? { symptomChecks } : {}),
    durationSeconds: seconds,
  };
}

/**
 * Fold a guided session into the stored data: upsert by id, so the session
 * written when the runner finishes and the one written by "Save and finish"
 * (which adds `painAfter`) are the same record rather than two. Any other
 * unfinished session for that day is replaced.
 *
 * Saving is also when the spinal-loading ladder moves: a "Worse" answer to an
 * in-session symptom checkpoint steps that track down (spec §6.6, §4.5).
 */
export function withGuidedSession(data: AppData, session: WorkoutSession): AppData {
  // Each run keeps its own record (a resumed run carries its id), so another
  // run on the same day with real work in it, such as work banked before a
  // swap, is never removed. An empty unfinished record that day is replaced.
  const sessions = [session, ...data.sessions.filter(s => s.id !== session.id && !(s.date === session.date && s.guided && s.status === 'in_progress'))]
    .sort((a, b) => b.date.localeCompare(a.date));
  return {
    ...data,
    sessions,
    personalRecords: mergeRecords(data.personalRecords, newRecords(session, data.personalRecords)),
    ...(data.profile ? { profile: { ...data.profile, ladder: updateLadder(data.profile.ladder, sessions, session.date) } } : {}),
  };
}

/**
 * Bank unfinished progress (another day's, or too old to resume) into History,
 * unless nothing was done or that day already has a finished guided session.
 */
export function bankProgress(data: AppData, saved: { plan: SessionPlan; state: RunnerState; clockAt?: number }, sessionId: string): AppData {
  // Close the run where it was last saved, so its time spent is kept.
  const at = saved.clockAt ?? saved.state.pausedAt ?? saved.state.startedAt;
  const state: RunnerState = saved.state.finishedAt !== undefined || at === undefined ? saved.state : {
    ...saved.state,
    finishedAt: at,
    ...(saved.state.status === 'running' && saved.state.runningSince !== undefined
      ? { activeMs: (saved.state.activeMs ?? 0) + Math.max(0, at - saved.state.runningSince), runningSince: undefined }
      : {}),
  };
  const session = toWorkoutSession(saved.plan, state, { sessionId });
  if (session.status === 'in_progress') return data;
  if (data.sessions.some(s => s.date === session.date && s.guided && s.status === 'completed')) return data;
  return withGuidedSession(data, session);
}

function mergeRecords(existing: PersonalRecord[], fresh: PersonalRecord[]): PersonalRecord[] {
  const ids = new Set(fresh.map(r => r.exerciseId));
  return [...existing.filter(r => !ids.has(r.exerciseId)), ...fresh];
}

/** New personal records from a session's best completed set per exercise. */
export function newRecords(session: WorkoutSession, existing: PersonalRecord[]): PersonalRecord[] {
  const best = new Map<string, WorkoutSet>();
  for (const s of session.sets) {
    if (s.status !== 'completed' || !s.weight || !s.actualReps) continue;
    const prev = best.get(s.exerciseId);
    if (!prev || s.weight * s.actualReps > (prev.weight ?? 0) * (prev.actualReps ?? 0)) best.set(s.exerciseId, s);
  }
  const out: PersonalRecord[] = [];
  for (const [exerciseId, s] of best) {
    if (detectPR(exerciseId, s.weight!, s.actualReps!, existing)) {
      out.push({ exerciseId, weight: s.weight!, reps: s.actualReps!, date: session.date, volume: s.weight! * s.actualReps! });
    }
  }
  return out;
}

/**
 * How long a session actually took. Guided sessions record their active time;
 * older and manual ones only have the wall-clock span between start and finish.
 */
export function sessionSeconds(session: Pick<WorkoutSession, 'durationSeconds' | 'startedAt' | 'completedAt'>): number | undefined {
  if (session.durationSeconds !== undefined) return session.durationSeconds;
  if (!session.startedAt || !session.completedAt) return undefined;
  return Math.max(0, Math.floor((new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()) / 1000));
}
