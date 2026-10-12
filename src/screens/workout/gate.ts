/**
 * Whether the Workout Log may take a set, from the readiness engine's
 * per-mode permission (board D30).
 *
 * Nothing here is a safety rule of its own (BUILD-BRIEF: call the existing
 * gate and respect it). Which question is asked follows where the workout
 * stands, as the guided player's gates do (`src/session/gate.ts`):
 *
 * - **start** — before the first set: exactly what a start button asks.
 * - **restart** — a workout taken up again, from its record after a reload or
 *   from memory on coming back to the screen. Nothing shows the exercise went
 *   on without a break, so its next set asks the full question again:
 *   today's check-in, a fresh reading where D29(6) needs one, every hold
 *   (re-audit B03).
 * - **live** — sets logged in this sitting, without a break: today's answers
 *   again, so a new stop or a pending re-check is never bypassed, but not the
 *   pre-session paperwork — a reading turning 30 minutes old mid-workout does
 *   not lock anyone out of the sets they are doing.
 * - **record** — a past day written down afterwards: the movement has
 *   already happened, so today's readiness is not asked.
 *
 * Strength work is the guided session's middle block, so the log asks for
 * `guided` permission: the same clearance, never a looser one.
 */

import type { CheckInRecord } from '@/types/checkin';
import type { SessionPlan } from '@/types/plan';
import type { UserProfile } from '@/types/profile';
import { toDateString } from '@/lib/utils';
import { FRESH_MINUTES, permission, resumePermission, type Permission, type PermissionInput } from '@/engine/permission';
import { arrivalGate } from '@/session/gate';
import { startDecision } from '@/components/checkin/start';

export const LOG_MODE = 'guided' as const;

export type LogGate =
  | { kind: 'log'; permission: Permission }
  /** A first, new or repeated check-in decides. */
  | { kind: 'checkIn'; permission: Permission }
  /** Refused for now, for a reason another check-in will not change. */
  | { kind: 'stop'; permission: Permission };

/** What recording a past day asks of today's readiness: nothing. The movement has already happened. */
const RECORDING: Permission = {
  mode: LOG_MODE, allowed: true, disposition: 'reassure', reasons: [], restrictions: [], needsCheckIn: false,
};

export type Stage = 'start' | 'restart' | 'live' | 'record';

/**
 * A set this long after the last one ends the sitting: the player's own
 * 30 minutes, after which a restart needs a new reading (D29(6)). A locked
 * phone or a break with the Workout screen still open is a break (M-04).
 */
export const SITTING_GAP_MS = FRESH_MINUTES * 60_000;

/** Where a workout stands at `at`, for the question its next set asks. */
export function stageOf(w: { begun: boolean; live: boolean; afterTheFact: boolean; lastSetAt?: number | null }, at?: Date): Stage {
  if (w.afterTheFact) return 'record';
  if (!w.begun) return 'start';
  const broken = at !== undefined && w.lastSetAt != null && at.getTime() - w.lastSetAt > SITTING_GAP_MS;
  return w.live && !broken ? 'live' : 'restart';
}

export function logGate(input: PermissionInput, stage: Stage): LogGate {
  if (stage === 'record') return { kind: 'log', permission: RECORDING };
  const p = stage === 'start' ? permission(input, LOG_MODE)
    : stage === 'restart' ? arrivalGate(input, LOG_MODE, true)
      : resumePermission(input, LOG_MODE);
  if (startDecision(p) === 'go') return { kind: 'log', permission: p };
  return { kind: p.needsCheckIn ? 'checkIn' : 'stop', permission: p };
}

/**
 * What the gate is asked with, from `useGuided(date)`: every day's effective
 * check-in — stored, or still waiting because the device refused or has not
 * finished the write — never the stored list alone (re-audit B04).
 *
 * Today's record is the check-in, so a workout carried over from yesterday is
 * decided by today's answers. All of them are `recent`, where the engine finds
 * what an earlier day still asks of today: chest pain the device refused at
 * 23:59 still stops logging at 00:01.
 */
export function gateInputFor(guided: Clinical, now: Date): PermissionInput {
  const checkIn = guided.checkIns.find(c => c.date === toDateString(now));
  return { profile: guided.profile, now, recent: guided.checkIns, ...(checkIn ? { checkIn } : {}) };
}

/** What the readiness engine reads, as `useGuided(date)` hands it over. */
export interface Clinical {
  profile: UserProfile;
  checkIns: CheckInRecord[];
}

/**
 * The question the screen asks before a workout's next set, at `at`: what it
 * shows, and what it asks again at the tap.
 */
export function setGate(w: { begun: boolean; live: boolean; afterTheFact: boolean; lastSetAt?: number | null }, clinical: Clinical, at: Date): LogGate {
  return logGate(gateInputFor(clinical, at), stageOf(w, at));
}

/**
 * On a scheduled rest day another workout from the week may be done instead,
 * as before — unless today's answers rule training out altogether.
 */
export function offersOtherWorkout(plan: Pick<SessionPlan, 'focus' | 'exercises'>, p: Permission): boolean {
  return plan.exercises.length === 0
    && (plan.focus === 'rest' || plan.focus === 'activeRecovery')
    && (p.allowed || p.needsCheckIn);
}
