/**
 * How a workout record reads: its title, status, source and each set, in the
 * user's unit. Shared by the workout in progress and the record screen, so a
 * set never reads one way while it is being logged and another way afterwards.
 */

import type { MuscleGroup, WorkoutSession, WorkoutSet, WorkoutStatus } from '@/types';
import { calculateVolume, formatWeight, parseDateString } from '@/lib/utils';
import { prefersHour12, timeOf } from '@/lib/time';
import { getStrength, nameOf } from '@/data/catalog';
import { prescribe } from '@/engine/dosage';
import { suggestLoad } from '@/engine/progression';
import { focusLabel } from '@/engine/templates';
import { createDefaultProfile } from '@/profile/defaults';
import { sessionSeconds } from '@/session/logging';

const PROFILE = createDefaultProfile();
const timedCache = new Map<string, boolean>();

/**
 * Whether the planner doses this exercise in seconds — a hold or a carry —
 * rather than reps. It asks the planner's own dosing rather than keeping a
 * second list here, so the two cannot drift apart.
 */
export function timedExercise(id: string): boolean {
  const cached = timedCache.get(id);
  if (cached !== undefined) return cached;
  const meta = getStrength(id);
  const rx = meta && prescribe(meta, 'trunk', {
    phase: 'foundation', mode: 'normal', profile: PROFILE, modifiers: [], backAmber: false,
    caps: { notes: [] }, load: { kg: null, note: 'bodyweight' },
  });
  const timed = !!rx && (rx.holdSeconds !== undefined || rx.carrySeconds !== undefined);
  timedCache.set(id, timed);
  return timed;
}

/**
 * Whether the planner treats this exercise as bodyweight-only, so no weight is
 * asked for — the guided session's rule, asked of its own load logic.
 */
export function bodyweightExercise(id: string): boolean {
  return suggestLoad(id, { reps: [8, 12] }, []).note === 'bodyweight';
}

const MUSCLE_LABEL: Record<MuscleGroup, string> = {
  back: 'Back', chest: 'Chest', legs: 'Legs', shoulders: 'Shoulders', arms: 'Arms', core: 'Core',
  cardio: 'Cardio', mobility: 'Mobility', upper: 'Upper body', lower: 'Lower body', fullBody: 'Full body',
};

const KIND_TITLE: Partial<Record<NonNullable<WorkoutSession['planKind']>, string>> = {
  stretch: 'Stretch',
  recovery: 'Recovery session',
  restDay: 'Rest-day session',
};

/**
 * The record's name: the programme day it was, or what an older version
 * called it. A guided stretch or recovery session keeps the day's focus, but
 * it was not that day's workout, so it is not named as one.
 */
export function sessionTitle(s: Pick<WorkoutSession, 'focus' | 'guided' | 'muscleGroup' | 'planKind'>): string {
  const kind = s.planKind ? KIND_TITLE[s.planKind] : undefined;
  if (kind) return kind;
  if (s.focus) return focusLabel(s.focus);
  if (s.guided) return 'Guided session';
  return `${MUSCLE_LABEL[s.muscleGroup] ?? 'Strength'} workout`;
}

export const STATUS_LABEL: Record<WorkoutStatus, string> = {
  completed: 'Completed',
  partial: 'Partly done',
  skipped: 'Skipped',
  in_progress: 'In progress',
  not_started: 'Not started',
};

/** Where the numbers came from (BUILD-BRIEF: every number carries its source). Short: it sits beside a label at 320 px. */
export function sourceLabel(s: Pick<WorkoutSession, 'guided'>): string {
  return s.guided ? 'Guided session' : 'Logged by you';
}

export interface ExerciseLog {
  exerciseId: string;
  name: string;
  sets: WorkoutSet[];
  timed: boolean;
}

/**
 * Sets grouped by exercise, in the order each exercise first appears. A guided
 * session stores a superset's sets interleaved (A, B, A, B); this puts each
 * exercise's sets together again.
 */
export function exerciseLogs(s: Pick<WorkoutSession, 'sets'>): ExerciseLog[] {
  const byId = new Map<string, ExerciseLog>();
  for (const set of s.sets) {
    let log = byId.get(set.exerciseId);
    if (!log) {
      log = { exerciseId: set.exerciseId, name: nameOf(set.exerciseId), sets: [], timed: timedExercise(set.exerciseId) };
      byId.set(set.exerciseId, log);
    }
    log.sets.push(set);
  }
  return [...byId.values()];
}

/**
 * One set in words, e.g. "10 reps · 20 kg". A guided hold records only that it
 * was done — its stored count is the planner's rep target, not seconds held —
 * so no number is shown for it rather than a wrong one.
 */
export function setLine(set: WorkoutSet, opts: { timed: boolean; guided: boolean; useMetric: boolean }): string {
  if (set.status === 'skipped') return 'Skipped';
  if (set.status === 'pending') return 'Not done';
  const parts: string[] = [];
  if (set.actualReps !== null && !(opts.timed && opts.guided)) {
    parts.push(opts.timed ? `${set.actualReps} s` : `${set.actualReps} ${set.actualReps === 1 ? 'rep' : 'reps'}`);
  }
  if (set.weight !== null) parts.push(formatWeight(set.weight, opts.useMetric));
  // The old Workout page asked for effort; what it recorded is still shown.
  if (set.rpe !== null) parts.push(`effort ${set.rpe} of 10`);
  return parts.length ? parts.join(' · ') : 'Done';
}

/**
 * Weight lifted: weight × reps over completed sets, as `calculateVolume` has
 * it — but only sets dosed in reps. A hold's or a carry's count is seconds,
 * and 20 kg carried for 30 s is not 600 kg lifted (review F21).
 */
export function liftedVolume(sets: WorkoutSet[]): number {
  return calculateVolume(sets.filter(s => !timedExercise(s.exerciseId)));
}

export interface Totals {
  done: number;
  total: number;
  /** Reps across completed sets dosed in reps (holds and carries are seconds, so they are left out). */
  reps: number;
  /** Weight lifted, holds and carries left out (`liftedVolume`). */
  volumeKg: number;
  /**
   * Active time: what the guided player measured, or the minutes the person
   * gave for a workout logged by hand. Absent when neither is known.
   */
  activeSeconds?: number;
  /**
   * For a workout logged by hand, when it was begun and finished on the
   * clock. Not activity: the phone may have spent most of it in a pocket.
   */
  span?: { from: string; to: string };
}

export function totals(s: WorkoutSession): Totals {
  const done = s.sets.filter(x => x.status === 'completed');
  const reps = done.filter(x => !timedExercise(x.exerciseId)).reduce((sum, x) => sum + (x.actualReps ?? 0), 0);
  const active = s.guided ? sessionSeconds(s) : s.durationSeconds !== undefined && s.durationSeconds > 0 ? s.durationSeconds : undefined;
  const span = !s.guided && s.startedAt && s.completedAt ? { from: s.startedAt, to: s.completedAt } : undefined;
  return {
    done: done.length,
    total: s.sets.length,
    reps,
    volumeKg: liftedVolume(s.sets),
    ...(active !== undefined ? { activeSeconds: active } : {}),
    ...(span ? { span } : {}),
  };
}

/** "47 min", "1 h 5 min"; a record of a few seconds says so rather than "0 min". */
export function durationText(seconds: number): string {
  if (seconds < 60) return 'Under a minute';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** "Thursday, 8 October", with the year once it is not this year's. */
export function dayText(date: string, today: string, locale?: string): string {
  const d = parseDateString(date);
  return d.toLocaleDateString(locale, {
    weekday: 'long', day: 'numeric', month: 'long',
    ...(date.slice(0, 4) !== today.slice(0, 4) ? { year: 'numeric' } : {}),
  });
}

/** A recorded instant as a time of day, in the device's own format, as the whole app writes times (J2-14). */
export function timeText(iso: string, locale?: string): string {
  return timeOf(iso, prefersHour12(locale));
}
