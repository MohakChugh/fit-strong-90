/**
 * What saving, correcting or deleting a workout does to the rest of the
 * record. Each is an `AppData → AppData` step for the store's `update`, so a
 * session and the personal records it feeds always change together.
 *
 * Personal records are re-derived from the logged sets every time
 * (`deriveRecords`), never incremented, so a set can only ever count once —
 * however often a workout is saved, edited or deleted.
 */

import type { AppData, PersonalRecord, WorkoutSession, WorkoutSet } from '@/types';
import type { DayFocus } from '@/types/plan';
import { deriveRecords, editSession, finishedStatus } from '@/lib/utils';
import { updateLadder } from '@/engine/progression';
import { bankProgress } from '@/session/logging';
import type { SavedProgress } from '@/session/persistence';
import { liftedVolume, timedExercise } from './summary';

const byDateDescending = (a: { date: string }, b: { date: string }) => b.date.localeCompare(a.date);

/**
 * Personal records from sets dosed in reps (`deriveRecords`). A hold's or a
 * carry's count is seconds, so it is passed in as not done: the exercise
 * still counts as logged, and a record an older version made from its
 * seconds is dropped rather than kept as if it had been imported (F21).
 */
function repRecords(sessions: WorkoutSession[], existing: PersonalRecord[]): PersonalRecord[] {
  const counted = sessions.map(s => (s.sets.some(x => timedExercise(x.exerciseId))
    ? { ...s, sets: s.sets.map(x => (timedExercise(x.exerciseId) ? { ...x, status: 'pending' as const } : x)) }
    : s));
  return deriveRecords(counted, existing);
}

/**
 * A finished workout into the record: the session upserted by id (saving twice
 * is one record), records re-derived, and — when it answered the planner's
 * back-symptom checkpoints — the spinal-loading ladder moved by the same rule
 * the guided session uses: "worse" steps it down, a run of clean answers
 * steps it up.
 */
export function withWorkout(data: AppData, session: WorkoutSession): AppData {
  // The stored weight lifted is taken again here, whoever built the record (F21).
  const saved = { ...session, totalVolume: liftedVolume(session.sets) };
  const sessions = [saved, ...data.sessions.filter(s => s.id !== session.id)].sort(byDateDescending);
  const ladder = data.profile && session.symptomChecks && session.status !== 'in_progress'
    ? { profile: { ...data.profile, ladder: updateLadder(data.profile.ladder, sessions, session.date) } }
    : {};
  return { ...data, sessions, personalRecords: repRecords(sessions, data.personalRecords), ...ladder };
}

/**
 * An unfinished workout nobody is coming back to, saved as it stands: done
 * sets count, the rest were not done. When it ended is not known, so no end
 * time is invented for it.
 */
export function asItStands(session: WorkoutSession): WorkoutSession {
  return { ...session, status: finishedStatus(session.sets), totalVolume: liftedVolume(session.sets) };
}

/**
 * The person's own active minutes for a workout logged by hand, given or
 * taken away after it was saved; taken away is none, never the clock span
 * (F20). A guided session's measured time is not theirs to rewrite here.
 */
export function withActiveMinutes(data: AppData, sessionId: string, minutes: number | null): AppData {
  const target = data.sessions.find(s => s.id === sessionId);
  if (!target || target.guided) return data;
  const durationSeconds = minutes === null ? 0 : minutes * 60;
  return { ...data, sessions: data.sessions.map(s => (s.id === sessionId ? { ...s, durationSeconds } : s)) };
}

export interface SetPatch {
  reps?: number | null;
  weightKg?: number | null;
  /** true marks the set done; false marks it not done and clears what it recorded. */
  done?: boolean;
}

function patched(set: WorkoutSet, patch: SetPatch): WorkoutSet {
  if (patch.done === false) return { ...set, status: 'pending', actualReps: null, weight: null };
  return {
    ...set,
    status: patch.done === true ? 'completed' : set.status,
    actualReps: patch.reps !== undefined ? patch.reps : set.actualReps,
    weight: patch.weightKg !== undefined ? patch.weightKg : set.weight,
  };
}

/**
 * Correct one set of a saved workout, through `editSession`. A manual
 * record's status follows its sets again (`finishedStatus`); a guided one's
 * status also weighs the stretching and cardio it recorded, which a set edit
 * cannot see, so it is left alone. `editSession` counts every set towards the
 * weight lifted and the records, so both are then taken again without holds
 * and carries (F21).
 */
export function withEditedSet(data: AppData, sessionId: string, setId: string, patch: SetPatch): AppData {
  const edited = editSession(data, sessionId, s => {
    const sets = s.sets.map(x => (x.id === setId ? patched(x, patch) : x));
    const settled = !s.guided && (s.status === 'completed' || s.status === 'partial' || s.status === 'skipped');
    return { ...s, sets, status: settled ? finishedStatus(sets) : s.status };
  });
  const sessions = edited.sessions.map(s => (s.id === sessionId ? { ...s, totalVolume: liftedVolume(s.sets) } : s));
  return { ...edited, sessions, personalRecords: repRecords(sessions, data.personalRecords) };
}

/**
 * Delete a workout. Records are re-derived without it; a record its own sets
 * set goes with it, while one it never touched — an imported record — stays.
 */
export function withoutWorkout(data: AppData, sessionId: string): AppData {
  const doomed = data.sessions.find(s => s.id === sessionId);
  if (!doomed) return data;
  const sessions = data.sessions.filter(s => s.id !== sessionId);
  const setHere = (r: PersonalRecord) => r.date === doomed.date && doomed.sets.some(x =>
    x.exerciseId === r.exerciseId && x.status === 'completed' && x.weight === r.weight && x.actualReps === r.reps);
  return { ...data, sessions, personalRecords: repRecords(sessions, data.personalRecords.filter(r => !setHere(r))) };
}

export interface NewBest {
  exerciseId: string;
  weight: number;
  reps: number;
  previous: { weight: number; reps: number };
}

interface Best { weight: number; reps: number; volume: number }

function bestOf(sets: Iterable<{ exerciseId: string; weight: number | null; reps: number | null }>): Map<string, Best> {
  const best = new Map<string, Best>();
  for (const s of sets) {
    if (!s.weight || !s.reps) continue;
    const volume = s.weight * s.reps;
    if (volume > (best.get(s.exerciseId)?.volume ?? 0)) best.set(s.exerciseId, { weight: s.weight, reps: s.reps, volume });
  }
  return best;
}

/** Completed sets dosed in reps: a carry's seconds are not reps to beat (F21). */
const doneSets = (s: WorkoutSession) => s.sets
  .filter(x => x.status === 'completed' && !timedExercise(x.exerciseId))
  .map(x => ({ exerciseId: x.exerciseId, weight: x.weight, reps: x.actualReps }));

/**
 * The sets in this workout that beat everything before it for that exercise,
 * by weight × reps — the measure the records use. "Before" means earlier
 * sessions and any record dated earlier (an imported one). A first ever set
 * is not stated as a new best: there was nothing to beat.
 */
export function newBests(session: WorkoutSession, sessions: WorkoutSession[], records: PersonalRecord[]): NewBest[] {
  const earlier = (s: WorkoutSession) => s.id !== session.id && (s.date < session.date
    || (s.date === session.date && !!s.startedAt && !!session.startedAt && s.startedAt < session.startedAt));
  const before = bestOf([
    ...sessions.filter(earlier).flatMap(doneSets),
    ...records.filter(r => r.date < session.date && !timedExercise(r.exerciseId))
      .map(r => ({ exerciseId: r.exerciseId, weight: r.weight, reps: r.reps })),
  ]);
  const here = bestOf(doneSets(session));
  return [...here].flatMap(([exerciseId, best]) => {
    const previous = before.get(exerciseId);
    if (!previous || best.volume <= previous.volume) return [];
    return [{ exerciseId, weight: best.weight, reps: best.reps, previous: { weight: previous.weight, reps: previous.reps } }];
  });
}

/**
 * Change the day's workout. It is kept per date, so Today and the guided
 * session run the new one too; choosing the scheduled workout again drops the
 * change. Unfinished guided progress for that day belongs to the old workout,
 * so its work is banked into the record first — otherwise the guided session
 * would resume the old workout under the new one's name.
 */
export function withWorkoutChanged(
  data: AppData,
  change: { date: string; focus: DayFocus; scheduled: DayFocus },
  saved: SavedProgress | null,
  bankedId: string,
): AppData {
  const banked = saved && saved.plan.date === change.date ? bankProgress(data, saved, saved.sessionId ?? bankedId) : data;
  const focusOverrides = { ...(banked.focusOverrides ?? {}) };
  if (change.focus === change.scheduled) delete focusOverrides[change.date];
  else focusOverrides[change.date] = change.focus;
  return { ...banked, focusOverrides };
}
