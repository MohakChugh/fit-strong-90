/**
 * May this person walk right now? One answer, asked by the live walk's
 * controller and shown by its screen, so the two can never disagree
 * (re-audit F06).
 *
 * The readiness engine decides, through the session's own gates; nothing
 * here re-implements a safety rule. Three questions (re-audit 3, B03):
 * a start and a restart — a stored walk restored, Resume after a pause, the
 * return from hidden — ask everything (`startGate`, `arrivalGate`); walking
 * under way asks the live question (`liveGate`), which keeps every current
 * condition and profile rule but not the starting checks.
 *
 * What it is asked about is every day's *effective* check-in: the stored
 * records with any answer the device has not stored yet (B04). Today's is the
 * check-in and the whole list the earlier days, so what the last check-in
 * still asks of today — a chest pain at 23:59 — stands at 00:01 (B01). The
 * controller reads it here, outside React; a screen gets the same list from
 * `useGuided().checkIns`.
 *
 * A walk stored on the device is progress to read and save. It is never, on
 * its own, permission to carry on walking.
 */

import type { Permission, PermissionInput } from '@/engine/permission';
import type { CheckInRecord } from '@/types/checkin';
import type { UserProfile } from '@/types/profile';
import { arrivalGate, liveGate, startGate } from '@/session/gate';
import { STOP_UNANSWERED } from '@/engine/readiness';
import { reachableHistory } from '@/engine/reach';
import { effectiveCheckIns, pendingCheckInsVersion, subscribePendingCheckIns } from '@/components/checkin/pending';
import { createDefaultProfile } from '@/profile/defaults';
import { toDateString } from '@/lib/utils';
import { getState, subscribe, type StoreState } from '@/store/useStore';
import { statusOn, type Status } from '@/health/status';
import { resumeAllowed } from '@/screens/hub/movement';
import { STATUS_HOLD } from './readout';
import type { WalkIntent } from './live';

/** Movement is allowed only on a plain yes: a check-in that is still needed is not one. */
export function allowsMovement(p: Permission): boolean {
  return p.allowed && !p.needsCheckIn;
}

/** Why this walk may not move now, or nothing when it may. */
export function walkRefusal(input: PermissionInput, intent: WalkIntent): Permission | undefined {
  if (intent === 'live') return liveGate(input, 'walk');
  const p = intent === 'start' ? startGate(input, 'walk') : arrivalGate(input, 'walk', true);
  return allowsMovement(p) ? undefined : p;
}

/** What the engine is asked about, apart from the time: the profile, and every day's effective check-in, oldest first. */
export interface Clinical {
  profile: UserProfile;
  checkIns: readonly CheckInRecord[];
}

/**
 * The engine's input at `now`: today's effective record as the check-in, and every day's as the earlier ones.
 * A change to the phone's clock is the device's (`clockHold`, on the records), never the walk's (B-19, board D174).
 */
export function walkInput(clinical: Clinical, now: Date): PermissionInput {
  const today = toDateString(now);
  const checkIn = clinical.checkIns.find(c => c.date === today);
  return { profile: clinical.profile, now, ...(checkIn ? { checkIn } : {}), recent: [...clinical.checkIns] };
}

/**
 * What this device knows, outside React: the stored check-ins with every
 * answer still waiting to be stored. The same fallback profile as
 * `useGuided`: a device part-way through onboarding is asked about, and held
 * for its health questions, never assumed fine.
 */
export function deviceClinical(state: Pick<StoreState, 'profile' | 'checkIns' | 'settings'> & Partial<Pick<StoreState, 'observations' | 'clockHold'>>): Clinical {
  const profile = state.profile ?? createDefaultProfile({ weightKg: state.settings.currentWeight || 0, needsHealthReview: true });
  // Track's glucose and blood pressure readings count as the check-in's do (scan X2-01), and the
  // changes to this phone's clock hold every gate, from the moment one is seen (B-19, board D174, D188).
  return { profile, checkIns: effectiveCheckIns(state.checkIns, profile, state.observations ?? [], state.clockHold ?? state.settings.walk?.clock) };
}

export { STATUS_HOLD } from './readout';

/**
 * H2-01, the live half (journey §4.8, A-34): carrying a walk on — Resume,
 * "Continue walking" after a gap, a walk restored after a reload — is a
 * restart, so it asks the status first, as the hubs' Continue does
 * (`resumeAllowed`): never while Away or Unwell, and in a flare-up only a
 * stretch carries on. A new walk ("Start anyway") and one recording now
 * aren't asked: the status changes only off the walk screen, and coming back
 * to it is a restart.
 */
export function statusRefusal(status: Status, intent: WalkIntent): Permission | undefined {
  if (intent !== 'restart' || resumeAllowed(status, 'walk')) return undefined;
  const reason = status === 'away' || status === 'unwell' ? STATUS_HOLD[status] : STATUS_HOLD.flare;
  return { mode: 'walk', allowed: false, disposition: 'hold', reasons: [reason], release: STATUS_HOLD.release, restrictions: [], needsCheckIn: false };
}

/**
 * The hold a walk shows: a stop first, then the status, then any other hold,
 * as the hubs order them (§4.2). An unanswered "I need to stop" is a stop
 * too, so its "Say what happened" is never hidden behind Change status
 * (K6R-02, board D171).
 */
export function heldBy(clinical: Permission | undefined, status: Permission | undefined): Permission | undefined {
  if (clinical && (clinical.disposition === 'emergency' || clinical.disposition === 'today' || clinical.reasons.includes(STOP_UNANSWERED.reason))) return clinical;
  return status ?? clinical;
}

/** A gate over `read`, asked at the moment it is asked: never cached between two taps. */
export function clinicalGate(read: () => Clinical, now: () => Date = () => new Date()): (intent: WalkIntent) => boolean {
  return intent => walkRefusal(walkInput(read(), now()), intent) === undefined;
}

/** The days the engine's rules can reach (C2-05): the engine's own, used here every second of a walk. */
export { reachableHistory } from '@/engine/reach';

/**
 * A gate over the device's state that works out its effective, reachable
 * days only when they can have changed — the check-ins, the profile, an
 * answer waiting to be stored, the day itself — never on a tick (C2-05).
 * The question is still asked fresh each time, at the time it is asked.
 */
export function deviceGate(
  read: () => Pick<StoreState, 'profile' | 'checkIns' | 'settings'> & { observations?: StoreState['observations'] },
  now: () => Date = () => new Date(),
): (intent: WalkIntent) => boolean {
  // Keyed on the state itself, not the parts read today: the store hands out a
  // new state only when something changed, so whatever the gate comes to read
  // from it is covered, and a quiet walk asks the cache.
  let memo: { state: unknown; pending: number; day: string; clinical: Clinical } | undefined;
  return intent => {
    const at = now();
    const state = read();
    const day = toDateString(at);
    const pending = pendingCheckInsVersion();
    if (!memo || memo.state !== state || memo.pending !== pending || memo.day !== day) {
      const all = deviceClinical(state);
      memo = { state, pending, day, clinical: { profile: all.profile, checkIns: reachableHistory(all.checkIns, day, all.profile) } };
    }
    if (statusRefusal(statusOn(state.settings.statusPeriods, day), intent)) return false;
    return walkRefusal(walkInput(memo.clinical, at), intent) === undefined;
  };
}

/** The live controller's gate: the store and the answers waiting to be stored. */
export const storeGate = deviceGate(() => getState());

/**
 * B-01's final gate: the start question at this moment, asked of what the
 * device holds now (answers waiting to be stored included), never of a
 * screen's copy from before a system prompt.
 */
export function storeStartPermission(now: Date = new Date()): Permission {
  const all = deviceClinical(getState());
  const clinical: Clinical = { profile: all.profile, checkIns: reachableHistory(all.checkIns, toDateString(now), all.profile) };
  return startGate(walkInput(clinical, now), 'walk');
}

/**
 * Anything that could change the answer while a walk records: the store, and
 * the answers waiting to be stored — a refused emergency write appears only
 * there.
 */
export function watchClinical(onChange: () => void): () => void {
  const stopStore = subscribe(onChange);
  const stopPending = subscribePendingCheckIns(onChange);
  return () => {
    stopStore();
    stopPending();
  };
}
