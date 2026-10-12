/**
 * A change never lifts a hold (J§4.6, A-05; board D119). Every change that
 * takes away or alters a clinical measurement, or removes a check-in, is
 * asked of the engine before and after: every mode's permission now, and
 * the day's answer today and tomorrow (K8-08). One that would let any mode
 * do more, or stop the engine asking about a serious reading, is refused
 * (`useStore`'s `planOn`), unless each measurement it takes away has been
 * answered as typed wrongly; while the phone's clock change holds the device,
 * every such change is. The engine decides, and names the measurements;
 * nothing here computes a permission. Pure.
 */
import { permission, readinessFor, type Permission, type PermissionInput } from '@/engine/permission';
import { bpPartialId, bpReadingId, glucoseReadingId, ketoneReadingId, standingAnswer, toMgdl, withLogged } from '@/engine/readiness';
import { storedCheckIns } from '@/components/checkin/pending';
import { withoutGateFields } from '@/components/checkin/form';
import type { Observation } from '@/health/observation';
import { toDateString } from '@/lib/utils';
import { createDefaultProfile } from '@/profile/defaults';
import type { UserSettings } from '@/types';
import { DISPOSITION_ORDER, type CheckInRecord, type Disposition, type Mode, type Readiness } from '@/types/checkin';
import type { UserProfile } from '@/types/profile';
import { withPendingClock } from '@/walk/consent';
import { CLOCK_REFUSAL, type HeldReading } from './db';
import type { Change, Snapshot } from './snapshot';

/** What the engine reads of the device, as `deviceClinical` builds it. */
export interface Clinical {
  profile: UserProfile;
  checkIns: readonly CheckInRecord[];
}

const MODES: readonly Mode[] = ['guided', 'stretch', 'walk'];
const DAY_MS = 24 * 60 * 60 * 1000;
const CLINICAL_KINDS = new Set(['glucose', 'bloodPressureSystolic', 'bloodPressureDiastolic']);
const rank = (d: Disposition | undefined) => DISPOSITION_ORDER.indexOf(d ?? 'reassure');
const lost = (before: readonly string[], after: readonly string[]) => before.some(x => !after.includes(x));

/**
 * The device as stored, as the engine reads it: the stored check-ins with
 * Track's readings attached, and the phone's clock changes, those seen and
 * not stored yet included (`deviceClinical`'s rule; the gate itself reads the
 * store, so the store can't import it). An answer still waiting isn't read: a
 * correction waiting for its own write would stand beside what it corrects.
 */
export function clinicalOf(s: Pick<Snapshot, 'profile' | 'checkIns' | 'observations' | 'settings'>, pendingClock: readonly (readonly string[])[] = []): Clinical {
  const profile = s.profile ?? createDefaultProfile({ weightKg: s.settings?.currentWeight || 0, needsHealthReview: true });
  // What only the gates carry (Track's readings, a stored copy, the clock hold) is the gates' to attach again,
  // never read from a record as given: a record holding a copy it can't read is the store's to let go (P-01).
  const own = s.checkIns.map(c => withoutGateFields(c));
  return { profile, checkIns: storedCheckIns(own, profile, s.observations as readonly Observation[], withPendingClock(s.settings?.walk?.clock, pendingClock)) };
}

/** Whether a change can touch a clinical measurement or a check-in: only then is the engine asked (P8S-03). */
export function touchesClinical(change: Change, base: Pick<Snapshot, 'observations'>): boolean {
  if (change.reset || change.checkIns !== undefined) return true;
  const o = change.observations;
  if (!o) return false;
  if ((o.put ?? []).some(x => CLINICAL_KINDS.has(x.kind))) return true;
  const gone = new Set(o.remove ?? []);
  return gone.size > 0 && base.observations.some(x => gone.has(x.id) && CLINICAL_KINDS.has(x.kind));
}

/** Every clinical measurement the engine reads, by the name it gives it: what an answer names (P8S-01). */
export function measurements(c: Clinical): Map<string, HeldReading> {
  const out = new Map<string, HeldReading>();
  const add = (kind: HeldReading['kind'], id: string) => out.set(id, { kind, id });
  for (const record of c.checkIns) {
    const v = withLogged(record);
    for (const e of [...(v.glucoseEarlier ?? []), v.glucose, v.glucoseDisplay]) {
      if (!e) continue;
      const high = 'display' in e ? e.display === 'HI' : toMgdl(e.value, e.unit) >= 600;
      add(high ? 'extremeGlucose' : 'severeLow', glucoseReadingId(e, v.date));
    }
    for (const r of [...(v.bpReadings?.length ? v.bpReadings : v.bp ? [v.bp] : []), ...(v.bpEarlier ?? [])]) add('severeBp', bpReadingId(r, v.date));
    for (const h of v.bpPartial ?? []) add('severeBp', bpPartialId(h, v.date));
    for (const k of [...(v.ketonesEarlier ?? []), ...(v.ketones ? [v.ketones] : [])]) add('ketones', ketoneReadingId(k, v.date));
  }
  return out;
}

/**
 * The phone's clock change holds the device (Plan 6's `settings.walk.clock`, board D174): on the days either side
 * of it, a change seen and not stored yet included, as every gate reads it from the moment it is seen (H6F-02).
 */
export function clockHoldOn(settings: Pick<UserSettings, 'walk'> | undefined, now: Date, pending: readonly (readonly string[])[] = []): boolean {
  const days = withPendingClock(settings?.walk?.clock, pending)?.days;
  return Array.isArray(days) && days.includes(toDateString(now));
}

/** The engine's input at `now`, as `walkInput` makes it. */
function inputAt(c: Clinical, now: Date): PermissionInput {
  const today = toDateString(now);
  const checkIn = c.checkIns.find(x => x.date === today);
  return { profile: c.profile, now, ...(checkIn ? { checkIn } : {}), recent: [...c.checkIns] };
}

/** How much a mode may do: refused below allowed, a stricter disposition lower. */
const freedom = (p: Permission) => (p.allowed ? 10 : 0) - rank(p.disposition);

/** The mode may do more after than before: allowed where it was refused, a gentler disposition, or a restriction gone. */
export function looser(before: Permission, after: Permission): boolean {
  if (freedom(after) !== freedom(before)) return freedom(after) > freedom(before);
  return lost(before.codes ?? [], after.codes ?? []);
}

/** The serious readings the answer still asks about. */
const open = (r: Readiness) => (r.episodes ?? []).flatMap(e => e.readings.filter(x => !x.settled).map(x => x.id));

/**
 * How many of the answer's restrictions hold at each level and above. The engine may name one anew as what it
 * stands on changes (an earlier low the latest again: `lowNotRecovered` becomes `low`), so restrictions are
 * counted, not matched by name: none fewer at any level is none gone.
 */
const levels = (r: Readiness) => {
  const held = r.reasons.map(x => rank(x.disposition)).filter(k => k >= rank('adjust'));
  return DISPOSITION_ORDER.map((_, level) => held.filter(k => k >= level).length);
};
const fewer = (before: Readiness, after: Readiness) => {
  const was = levels(before);
  const now = levels(after);
  return was.some((n, level) => now[level] < n);
};

/** The day's answer is less strict after than before: a restriction gone, a serious reading no longer asked about, a mode, modifier or cap lifted, or a re-check due sooner. */
export function loosens(before: Readiness, after: Readiness): boolean {
  const recheck = (r: Readiness) => (r.recheckAt ? Date.parse(r.recheckAt) : -Infinity);
  return fewer(before, after) || lost(open(before), open(after))
    || lost(before.refusedModes ?? [], after.refusedModes ?? []) || lost(before.modifiers, after.modifiers)
    || (before.capHeavy && !after.capHeavy) || (before.vigorousLocked && !after.vigorousLocked)
    || recheck(after) < recheck(before);
}

// ponytail: the engine is asked ten times per change that takes a measurement away, over every day Track holds readings for. Upgrade: ask only `reachableHistory`'s days (gate.ts) if such a tap is ever slow on a phone.
/**
 * Why a change may not be written, or nothing (D119). Only a change that
 * takes a measurement away, or removes a check-in, is judged. While the
 * phone's clock change holds the device: always refused (`said`). Otherwise
 * refused when it would lift a hold, unless each measurement it takes away
 * has been answered as typed wrongly by the engine's own reading of the
 * answers; `held` is exactly those still unanswered, and `release` the
 * engine's own words for a hold that is no measurement's.
 */
export function holdLifted(
  before: Clinical, after: Clinical, now: Date, opts: { clock?: boolean; removedDays?: readonly string[] } = {},
): { held: HeldReading[]; release?: string; said?: string } | undefined {
  const still = measurements(after);
  const touched = [...measurements(before).values()].filter(m => !still.has(m.id));
  if (touched.length === 0 && !opts.removedDays?.length) return undefined;
  if (opts.clock) return { held: [], said: CLOCK_REFUSAL };
  const tomorrow = new Date(now.getTime() + DAY_MS);
  const b = inputAt(before, now);
  const a = inputAt(after, now);
  const was = MODES.map(mode => permission(b, mode));
  const lifts = MODES.some((mode, i) => looser(was[i], permission(a, mode)))
    || loosens(readinessFor(b), readinessFor(a)) || loosens(readinessFor(inputAt(before, tomorrow)), readinessFor(inputAt(after, tomorrow)));
  if (!lifts) return undefined;
  const answers = after.checkIns.flatMap(c => c.resolutions ?? []);
  const held = touched.filter(m => standingAnswer(answers, m.id)?.resolution !== 'mistake');
  if (touched.length > 0 && held.length === 0) return undefined;
  const release = was.find(p => !p.allowed && p.release)?.release;
  return { held, ...(release ? { release } : {}) };
}
