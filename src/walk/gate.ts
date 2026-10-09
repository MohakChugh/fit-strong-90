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
import { answeredCheckIn, profileOnlyReadiness } from '@/engine/readiness';
import { effectiveCheckIns, pendingCheckInsVersion, subscribePendingCheckIns } from '@/components/checkin/pending';
import { createDefaultProfile } from '@/profile/defaults';
import { toDateString } from '@/lib/utils';
import { getState, subscribe, type StoreState } from '@/store/useStore';
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

/** The engine's input at `now`: today's effective record as the check-in, and every day's as the earlier ones. */
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
export function deviceClinical(state: Pick<StoreState, 'profile' | 'checkIns' | 'settings'> & { observations?: StoreState['observations'] }): Clinical {
  const profile = state.profile ?? createDefaultProfile({ weightKg: state.settings.currentWeight || 0, needsHealthReview: true });
  // Track's glucose and blood pressure readings count as the check-in's do (scan X2-01).
  return { profile, checkIns: effectiveCheckIns(state.checkIns, profile, state.observations ?? []) };
}

/** A gate over `read`, asked at the moment it is asked: never cached between two taps. */
export function clinicalGate(read: () => Clinical, now: () => Date = () => new Date()): (intent: WalkIntent) => boolean {
  return intent => walkRefusal(walkInput(read(), now()), intent) === undefined;
}

const dayAfter = (date: string, n: number) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/**
 * Whether a day holds a serious reading the engine carries into later days —
 * a severe or extreme glucose, a low that needed help, high ketones, a
 * confirmed severe pressure — asked of the engine's own carried rules, with
 * the day's answers left out so it can only say yes too often, never too
 * rarely. Records do not change once made, so each is asked once.
 */
const carries = new WeakMap<CheckInRecord, boolean>();
function mayCarry(record: CheckInRecord, profile: UserProfile): boolean {
  let known = carries.get(record);
  if (known === undefined) {
    const { resolutions: _answers, ...bare } = record;
    void _answers;
    known = (profileOnlyReadiness(profile, { date: dayAfter(record.date, 1), recent: [bare] }).episodes?.length ?? 0) > 0;
    carries.set(record, known);
  }
  return known;
}

/**
 * The days the engine's rules can reach on `today` (C2-05), in their order:
 * today itself; the latest earlier day (yesterday's, when there is one, for
 * "two days running"); the last record that answered the check-in, whose
 * answers stand until a newer one answers them, past any day holding only
 * readings or a report (R5-07); the last day with a reach, for symptoms
 * spreading; every
 * day with a serious reading the engine carries; and every day holding
 * answers about readings. The engine reads nothing else, so the answers are
 * the same as from the whole history — at the cost of a handful of days, not
 * thousands, every second of a walk.
 */
export function reachableHistory(checkIns: readonly CheckInRecord[], today: string, profile: UserProfile): CheckInRecord[] {
  const keep = new Set<CheckInRecord>();
  let last: CheckInRecord | undefined;
  let lastAnswered: CheckInRecord | undefined;
  let lastReach: CheckInRecord | undefined;
  for (const c of checkIns) {
    if (c.date > today) continue;
    if (c.date === today) { keep.add(c); continue; }
    if (!last || c.date >= last.date) last = c;
    // The check-in whose answers stand, past any day with only readings or a report (R5-07).
    if (answeredCheckIn(c) && (!lastAnswered || c.date >= lastAnswered.date)) lastAnswered = c;
    if (c.back?.reach && (!lastReach || c.date >= lastReach.date)) lastReach = c;
    if (c.resolutions?.length || mayCarry(c, profile)) keep.add(c);
  }
  if (last) keep.add(last);
  if (lastAnswered) keep.add(lastAnswered);
  if (lastReach) keep.add(lastReach);
  return checkIns.filter(c => keep.has(c));
}

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
    return walkRefusal(walkInput(memo.clinical, at), intent) === undefined;
  };
}

/** The live controller's gate: the store and the answers waiting to be stored. */
export const storeGate = deviceGate(() => getState());

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
