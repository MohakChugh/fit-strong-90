/**
 * The player's safety gates, kept out of the component so each one can be
 * tested (Codex re-audit F02, F03, F07, F14, F15).
 *
 * There are three moments, and they are not the same question:
 *
 * - **arrival** — opening the player, fresh or on saved progress. Opening is
 *   starting or restarting, so everything applies: today's check-in, the
 *   reading freshness D29(6) asks for, every current clinical condition and
 *   every profile rule. Restoring progress for inspection is not permission
 *   to move.
 * - **start** — the physical Start tap, asked again, because the ready screen
 *   can sit open while a reading goes stale.
 * - **live** — while exercise is under way. A newly reported emergency, today
 *   or hold stops it at once; the starting reading merely turning 30 minutes
 *   old does not.
 *
 * Separately, an archived plan's remaining work is checked against today's
 * restrictions: allowing a mode with restrictions is only safe if the work
 * inside it respects them.
 */

import type { Mode } from '@/types/checkin';
import type { SessionPlan, Step } from '@/types/plan';
import { getMeta } from '@/data/catalog';
import { activeConditions, evaluateFlags } from '@/engine/safety';
import { evaluateCheckIn, profileOnlyReadiness } from '@/engine/readiness';
import { deriveHealth } from '@/engine/health';
import { checkedIn, onScreenPermission, permission, resumePermission, type Permission, type PermissionInput } from '@/engine/permission';
import { toDateString } from '@/lib/utils';

/** Opening the player: a start or a restart, so the full question. */
export function arrivalGate(input: PermissionInput, mode: Mode, resuming: boolean): Permission {
  void resuming;
  return permission(input, mode);
}

/** The Start tap in the open player, first or after a pause: everything, except a refusal of new starts only (J2-04). */
export function startGate(input: PermissionInput, mode: Mode): Permission {
  return onScreenPermission(input, mode);
}

/** While exercise is under way: a refusal here stops it. `undefined` means carry on. */
export function liveGate(input: PermissionInput, mode: Mode): Permission | undefined {
  const p = resumePermission(input, mode);
  return p.allowed ? undefined : p;
}

/**
 * Holds a new glucose reading answers: a reading that is missing, unusable,
 * stale or low, or a low that was felt or measured. The player's reading
 * screen can settle these and nothing else.
 */
const GLUCOSE_ANSWERS = new Set([
  'lowSymptoms', 'lowReported', 'noReading', 'readingInvalid', 'suspectUnit', 'meterHi', 'low', 'belowStart',
  'falling', 'tooSoon', 'recheckNoTime', 'recheckUnknownTime', 'lowNotRecovered', 'high',
]);

/**
 * What a restart that waits on something should ask (scan M-01).
 *
 * - `reading` — a glucose reading, when this person's check-in asks for one
 *   and every hold on today's check-in is one a new reading answers.
 * - `checkIn` — anything else: no check-in yet today (a session left open
 *   past midnight, or a day started only by something said during movement),
 *   a blood pressure or ketone reading, or an answer to change. Someone
 *   without diabetes is never asked for glucose here.
 */
export function restartCapture(input: PermissionInput): 'reading' | 'checkIn' {
  const today = toDateString(input.now);
  const c = input.checkIn?.date === today ? input.checkIn : undefined;
  if (!c || !checkedIn(c)) return 'checkIn';
  const h = input.profile.health;
  const asksGlucose = deriveHealth(h).diabetic || h.diabetes === 'prediabetes' || input.profile.needsHealthReview === true;
  if (!asksGlucose) return 'checkIn';
  const r = evaluateCheckIn(input.profile, c, (input.recent ?? []).filter(x => x.date < c.date));
  const holding = r.reasons.filter(x => x.disposition === 'hold' || x.disposition === 'today' || x.disposition === 'emergency');
  return holding.every(x => GLUCOSE_ANSWERS.has(x.code)) ? 'reading' : 'checkIn';
}

export interface SymptomResponse {
  /** Set when today's answers no longer allow this mode: stop, do not continue. */
  halt?: Permission;
  /** Exercise ids whose remaining work must not go ahead. */
  skip: string[];
}

/**
 * What a worse-symptoms report during a session leads to (contract A-BACK):
 * a stop when today's answers no longer allow the mode, and otherwise
 * carrying on without the movement that provoked it.
 */
export function afterSymptomReport(input: PermissionInput, mode: Mode, exerciseId: string | undefined): SymptomResponse {
  const halt = liveGate(input, mode);
  if (halt) return { halt, skip: exerciseId ? [exerciseId] : [] };
  return { skip: exerciseId ? [exerciseId] : [] };
}

/** Today's readiness for this input, however little of it exists. */
function readinessOf(input: PermissionInput): ReturnType<typeof profileOnlyReadiness> {
  return input.checkIn
    ? evaluateCheckIn(input.profile, input.checkIn, (input.recent ?? []).filter(c => c.date < input.checkIn!.date))
    : profileOnlyReadiness(input.profile);
}

/**
 * Step ids in `plan` that today's restrictions do not allow.
 *
 * A saved plan was built for the person as they were. A foot that now needs
 * protecting, a new eye restriction or active leg symptoms change which
 * movements are safe, so each step's own safety flags are re-checked against
 * today's conditions — the same matrix that chose them in the first place —
 * and the work that no longer passes is refused rather than run (re-audit F07).
 */
export function blockedSteps(plan: SessionPlan, input: PermissionInput, skip: readonly string[] = []): string[] {
  const readiness = readinessOf(input);
  const conditions = activeConditions(input.profile, readiness);
  const dropped = new Set(skip);
  const out: string[] = [];
  for (const step of plan.steps) {
    const id = exerciseOf(step);
    if (!id) continue;
    const flags = getMeta(id)?.flags;
    if (dropped.has(id) || (flags && evaluateFlags(flags, conditions).excluded)) out.push(step.id);
  }
  return out;
}

function exerciseOf(step: Step): string | undefined {
  return step.kind !== 'checkpoint' && 'exerciseId' in step ? step.exerciseId : undefined;
}

export interface Reconciled {
  plan: SessionPlan;
  /** Steps that must not run today. The runner passes over them in both directions. */
  refused: ReadonlySet<string>;
  /** What changed and why, in plain words, for the screen. */
  notes: string[];
}

type Cardio = Extract<Step, { kind: 'cardio' }>;
const hard = (c: Cardio) => c.parts.some(p => p.intensity === 'fast' || p.intensity === 'tempo');
const coolSeconds = (c: Cardio) => c.parts.filter(p => p.intensity === 'cooldown').reduce((t, p) => t + p.seconds, 0);

/** Keys that line a saved step up with the step a plan built now would have in its place. */
function keysOf(steps: readonly Step[]): string[] {
  const seen = new Map<string, number>();
  return steps.map(st => {
    const base = st.kind === 'set' ? `set:${st.exerciseId}:${st.set}:${st.ramp ? 'r' : 'w'}`
      : st.kind === 'hold' || st.kind === 'drill' ? `${st.kind}:${st.exerciseId}`
        : st.kind === 'setup' ? `setup:${st.exerciseId}`
          : st.kind === 'cardio' ? 'cardio'
            : `${st.kind}:${st.id}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return `${base}#${n}`;
  });
}

/**
 * A saved plan made to obey today (re-audit round 3 B05).
 *
 * The plan was built for the person as they were. Allowing a mode with
 * restrictions is only safe if the work inside it respects them, so every
 * step still to come is checked against what the app's own builders prescribe
 * now (`fresh`: the same day and focus, built from today's answers):
 *
 * - **Kept** when it still meets today's caps (reps, reps in reserve, hold
 *   time, the cues that must be said) and the fresh plan does the same work.
 * - **Re-dosed** from the fresh plan when it does not: intervals become the
 *   steady cardio the builder now gives, a short cool-down the longer one,
 *   a heavy set today's capped set, with today's cues.
 * - **Refused** when the fresh plan has no equivalent: excluded movements, a
 *   ladder level no longer open, cardio there is no longer a safe machine for.
 *   The runner then passes over it, before and after the current step.
 *
 * Completed work keeps its steps and logs. No number here is new: every dose
 * comes from the builders that made the plan in the first place.
 */
export function reconcilePlan(saved: SessionPlan, index: number, fresh: SessionPlan, input: PermissionInput): Reconciled {
  const readiness = readinessOf(input);
  const conditions = activeConditions(input.profile, readiness);
  const provoked = new Set(input.checkIn?.provoked ?? []);
  const freshKeys = keysOf(fresh.steps);
  const freshBy = new Map(freshKeys.map((k, i) => [k, fresh.steps[i]]));
  const savedKeys = keysOf(saved.steps);
  const freshRx = new Map(fresh.exercises.map(e => [e.exerciseId, e]));
  const refused = new Set<string>();
  const notes: string[] = [];
  let changedCardio = false;
  const exercises = [...saved.exercises];

  const steps = saved.steps.map((st, i): Step => {
    const id = exerciseOf(st);
    if (st.kind === 'talk' || st.kind === 'checkpoint' || st.kind === 'rest') return st;
    const flags = id ? getMeta(id)?.flags : undefined;
    const verdict = flags ? evaluateFlags(flags, conditions) : undefined;
    const twin = freshBy.get(savedKeys[i]);
    if ((id && provoked.has(id)) || verdict?.excluded || (!twin && st.kind !== 'setup')) {
      refused.add(st.id);
      return st;
    }
    if (i < index || st.kind === 'setup' || !twin) return st;
    if (st.kind === 'cardio' && twin.kind === 'cardio') {
      const exceeds = (hard(st) && !hard(twin)) || coolSeconds(twin) > coolSeconds(st) || (conditions.foot && twin.exerciseId !== st.exerciseId);
      if (!exceeds) return st;
      changedCardio = true;
      return { ...twin, id: st.id };
    }
    if (st.kind === 'set' && twin.kind === 'set') {
      // The builder applies today's caps (more reps in reserve, no heavy
      // low-rep work, shorter holds, a lighter suggested load): where the set
      // it builds now is more cautious than the saved one, that is the dose.
      const kgNow = twin.load.kg ?? 0;
      const kgThen = st.load.kg ?? 0;
      const meets = twin.reps <= st.reps && twin.rir <= st.rir
        && (twin.holdSeconds ?? 0) >= (st.holdSeconds ?? 0) && (twin.carrySeconds ?? 0) >= (st.carrySeconds ?? 0)
        && !(twin.load.kg !== null && st.load.kg !== null && kgNow < kgThen);
      const cuesNow = freshRx.get(st.exerciseId)?.rx.caps ?? [];
      const cuesThen = saved.exercises.find(e => e.exerciseId === st.exerciseId)?.rx.caps ?? [];
      const saysAll = cuesNow.every(cue => cuesThen.includes(cue));
      if (meets && saysAll) return st;
      const rx = freshRx.get(st.exerciseId);
      if (rx) {
        const at = exercises.findIndex(e => e.exerciseId === st.exerciseId);
        if (at >= 0) exercises[at] = rx; else exercises.push(rx);
      }
      return { ...twin, id: st.id };
    }
    if ((st.kind === 'hold' || st.kind === 'drill') && twin.kind === st.kind) {
      const tooLong = st.kind === 'hold' && twin.kind === 'hold' && twin.holdSeconds < st.holdSeconds;
      const cues = (twin.caps ?? []).every(cue => (st.caps ?? []).includes(cue));
      return tooLong || !cues ? { ...twin, id: st.id } : st;
    }
    return st;
  });

  // A setup or a rest belongs to the work around it: with that refused, so is it.
  const allowedSet = (exerciseId: string) => steps.some(x => x.kind === 'set' && x.exerciseId === exerciseId && !refused.has(x.id));
  for (const st of steps) {
    if (st.kind === 'setup' && !allowedSet(st.exerciseId)) refused.add(st.id);
    if (st.kind === 'rest' && st.nextStepId && refused.has(st.nextStepId)) refused.add(st.id);
  }

  const left = [...new Set(steps.filter(x => refused.has(x.id) && exerciseOf(x)).map(x => x.title))];
  if (left.length) notes.push(`Left out today: ${left.join(', ')}.`);
  if (changedCardio) notes.push('Cardio follows today’s limits: steady, with a longer cool-down where needed.');

  const changed = steps.some((x, i) => x !== saved.steps[i]) || exercises.some((x, i) => x !== saved.exercises[i]);
  const plan: SessionPlan = changed || refused.size
    ? { ...saved, steps, exercises, readiness: fresh.readiness, ...(changedCardio ? { cardio: fresh.cardio } : {}), changes: [...saved.changes, ...notes] }
    : saved;
  return { plan, refused, notes };
}
