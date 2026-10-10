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
import { glucoseReadingId, withLogged } from '@/engine/readiness';
import { reachableHistory } from '@/engine/reach';
import { effectiveCheckIns, pendingCheckInsVersion, subscribePendingCheckIns } from '@/components/checkin/pending';
import { createDefaultProfile } from '@/profile/defaults';
import { toDateString } from '@/lib/utils';
import { getState, subscribe, type StoreState } from '@/store/useStore';
import type { WalkIntent } from './live';
import type { Walk } from './clock';

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
 * B-19: every glucose reading on these days' records, Track's included, by
 * identity: what a walk keeps when it sees the phone's clock change. Those
 * readings were timed by the clock as it was, so none can say how old it is.
 */
export function readingIds(checkIns: readonly CheckInRecord[], days: readonly string[]): string[] {
  const want = new Set(days);
  const ids = new Set<string>();
  for (const c of checkIns) {
    if (!want.has(c.date)) continue;
    const v = withLogged(c);
    for (const e of [...(v.glucoseEarlier ?? []), v.glucose, v.glucoseDisplay]) if (e) ids.add(glucoseReadingId(e, c.date));
  }
  return [...ids];
}

/**
 * The readings a walk's clock change left untimed, for the engine (B-19):
 * named by identity, never by comparing their times with the change's, which
 * come from two different clocks. Nothing when the walk saw no change.
 */
export function untimedOf(walk?: Pick<Walk, 'clockChangedAt' | 'untimedReadings'>): ReadonlySet<string> | undefined {
  return walk?.clockChangedAt === undefined ? undefined : new Set(walk.untimedReadings ?? []);
}

/**
 * The engine's input at `now`: today's effective record as the check-in, and every day's as the earlier ones.
 * After a change to the clock (B-19), the readings from before it, for the engine to hold on (`PermissionInput.untimed`).
 */
export function walkInput(clinical: Clinical, now: Date, untimed?: ReadonlySet<string>): PermissionInput {
  const today = toDateString(now);
  const checkIn = clinical.checkIns.find(c => c.date === today);
  return { profile: clinical.profile, now, ...(checkIn ? { checkIn } : {}), recent: [...clinical.checkIns], ...(untimed ? { untimed } : {}) };
}

/**
 * What this device knows, outside React: the stored check-ins with every
 * answer still waiting to be stored. The same fallback profile as
 * `useGuided`: a device part-way through onboarding is asked about, and held
 * for its health questions, never assumed fine.
 */
export function deviceClinical(state: Pick<StoreState, 'profile' | 'checkIns' | 'settings'> & { observations?: StoreState['observations'] }): Clinical {
  const profile = state.profile ?? createDefaultProfile({ weightKg: state.settings.currentWeight || 0, needsHealthReview: true });
  // Track's glucose and blood pressure readings count as the check-in's do (scan X2-01).
  return { profile, checkIns: effectiveCheckIns(state.checkIns, profile, state.observations ?? []) };
}

/** A gate over `read`, asked at the moment it is asked: never cached between two taps. */
export function clinicalGate(read: () => Clinical, now: () => Date = () => new Date()): (intent: WalkIntent, untimed?: ReadonlySet<string>) => boolean {
  return (intent, untimed) => walkRefusal(walkInput(read(), now(), untimed), intent) === undefined;
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
): (intent: WalkIntent, untimed?: ReadonlySet<string>) => boolean {
  // Keyed on the state itself, not the parts read today: the store hands out a
  // new state only when something changed, so whatever the gate comes to read
  // from it is covered, and a quiet walk asks the cache.
  let memo: { state: unknown; pending: number; day: string; clinical: Clinical } | undefined;
  return (intent, untimed) => {
    const at = now();
    const state = read();
    const day = toDateString(at);
    const pending = pendingCheckInsVersion();
    if (!memo || memo.state !== state || memo.pending !== pending || memo.day !== day) {
      const all = deviceClinical(state);
      memo = { state, pending, day, clinical: { profile: all.profile, checkIns: reachableHistory(all.checkIns, day, all.profile) } };
    }
    return walkRefusal(walkInput(memo.clinical, at, untimed), intent) === undefined;
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
