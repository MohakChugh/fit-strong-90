/**
 * Load progression (double progression) and the spinal-loading ladder
 * (spec §4.3, program-design.md §2.3–§3).
 */

import type { WorkoutSession } from '@/types';
import type { ExerciseMeta, LadderLevel, LadderTrack } from '@/types/catalog';
import type { LoadSuggestion, Prescription } from '@/types/plan';
import type { LadderState, UserProfile } from '@/types/profile';
import { getStrength } from '@/data/catalog';

interface ExerciseHistory {
  date: string;
  weight: number;
  reps: number[];
}

function historyFor(exerciseId: string, sessions: WorkoutSession[]): ExerciseHistory[] {
  return sessions
    .map(s => {
      const sets = s.sets.filter(x => x.exerciseId === exerciseId && x.status === 'completed' && x.weight && x.actualReps);
      if (sets.length === 0) return null;
      const weight = Math.max(...sets.map(x => x.weight as number));
      return { date: s.date, weight, reps: sets.filter(x => x.weight === weight).map(x => x.actualReps as number) };
    })
    .filter((x): x is ExerciseHistory => x !== null)
    .sort((a, b) => b.date.localeCompare(a.date));
}

const isLoadable = (m: ExerciseMeta) => m.equipment.some(e => ['barbell', 'trapBar', 'dumbbells', 'kettlebell', 'cable', 'machine', 'landmine'].includes(e));
const isLower = (m: ExerciseMeta) => m.patterns.some(p => ['squat', 'hinge', 'lunge'].includes(p));
const roundTo = (v: number, step: number) => Math.round(v / step) * step;

/**
 * Suggest today's working weight from the last sessions:
 * all sets at the top of the range → add the smallest step;
 * any set below the range → −5%; three sessions with no progress → −10%.
 */
export function suggestLoad(
  exerciseId: string,
  rx: Pick<Prescription, 'reps'>,
  sessions: WorkoutSession[],
  opts: { cautious: boolean } = { cautious: false },
): LoadSuggestion {
  const meta = getStrength(exerciseId);
  if (!meta || !isLoadable(meta)) return { kg: null, note: 'bodyweight' };
  const hist = historyFor(exerciseId, sessions);
  if (hist.length === 0) return { kg: null, note: 'firstTime' };

  const [last, prev, third] = hist;
  const top = (h: ExerciseHistory) => h.reps.length > 0 && h.reps.every(r => r >= rx.reps[1]);
  const below = (h: ExerciseHistory) => h.reps.some(r => r < rx.reps[0]);

  if (below(last)) return { kg: roundTo(last.weight * 0.95, 1.25), note: 'decrease' };

  const needTwo = opts.cautious || !!meta.ladder;
  const ready = top(last) && (!needTwo || (prev !== undefined && prev.weight === last.weight && top(prev)));
  if (ready) {
    const pct = isLower(meta) ? 0.05 : 0.025;
    const step = isLower(meta) ? 2.5 : meta.equipment.includes('dumbbells') ? 2 : 1;
    const isolation = meta.patterns.every(p => ['biceps', 'triceps', 'sideDelt', 'rearDelt', 'calf', 'chestFly'].includes(p));
    if (isolation) return { kg: last.weight, note: 'same' };
    return { kg: last.weight + Math.max(step, roundTo(last.weight * pct, step)), note: 'increase' };
  }

  const stalled = third !== undefined && [last, prev, third].every(h => h.weight === last.weight)
    && !top(last) && !top(prev) && !top(third);
  if (stalled) return { kg: roundTo(last.weight * 0.9, 1.25), note: 'decrease' };

  return { kg: last.weight, note: 'same' };
}

/**
 * Starting spinal-loading levels (spec §4.3). A back history starts at H1/S1
 * until the movement screen is passed, because nothing has watched the user
 * hinge yet; an irritable back starts at H0/S0 (plus clinician review). The
 * ladder earns the rest through `updateLadder`.
 */
export function startingLadder(
  profile: Pick<UserProfile, 'pain' | 'experience'>,
  screen: { passed?: boolean; irritable?: boolean } = {},
): LadderState {
  const back = profile.pain.areas.includes('lowerBack') || profile.pain.areas.includes('sciatica');
  const sciatica = profile.pain.areas.includes('sciatica');
  if (back) {
    const level: LadderLevel = screen.irritable ? 0 : screen.passed ? 2 : 1;
    return { hinge: level, squat: level, neuralGate: !sciatica };
  }
  const level: LadderLevel = profile.experience === 'beginner' ? 2 : 3;
  return { hinge: level, squat: level, neuralGate: true };
}

const TRACKS = ['hinge', 'squat'] as const;
const FORTNIGHT = 14;
const daysBetween = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / 86_400_000;

/** One answer per session per track: a day with two spinal slots is one exposure. */
function exposuresOn(track: LadderTrack, sessions: WorkoutSession[]): { date: string; worse: boolean }[] {
  return sessions
    .map(s => {
      const answers = Object.entries(s.symptomChecks ?? {}).filter(([id]) => {
        const meta = getStrength(id);
        return meta?.ladder?.track === track || meta?.patterns.includes(track);
      });
      return answers.length > 0 ? { date: s.date, worse: answers.some(([, a]) => a === 'worse') } : null;
    })
    .filter((x): x is { date: string; worse: boolean } => x !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Move the spinal-loading ladder from logged symptom checkpoints (spec §4.3):
 * drop a level as soon as one says "worse", otherwise promote one level after
 * ≥ 4 clean exposures spread over ≥ 2 weeks, at most one level per fortnight.
 *
 * Only checkpoints logged after the last change count, so calling this twice on
 * the same day — or twice on the same sessions — moves the ladder once.
 */
export function updateLadder(ladder: LadderState, sessions: WorkoutSession[], today: string): LadderState {
  const since = ladder.changedOn;
  const recent = sessions.filter(s => s.symptomChecks && s.date <= today && (since === undefined || s.date > since));
  const next: LadderState = { ...ladder };

  for (const track of TRACKS) {
    const exposures = exposuresOn(track, recent);
    if (exposures.some(e => e.worse)) {
      if (ladder[track] > 0) next[track] = (ladder[track] - 1) as LadderLevel;
      next.changedOn = today;
      continue;
    }
    // A fortnight since the last change, or — for a ladder that has never moved
    // — exposures spread over a fortnight.
    const settled = since !== undefined
      ? daysBetween(since, today) >= FORTNIGHT
      : exposures.length > 0 && daysBetween(exposures[0].date, today) >= FORTNIGHT;
    if (exposures.length >= 4 && settled && ladder[track] < 4) {
      next[track] = (ladder[track] + 1) as LadderLevel;
      next.changedOn = today;
    }
  }
  return next;
}
