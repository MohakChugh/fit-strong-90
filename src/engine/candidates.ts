/**
 * While answers are on their way (setup unfinished, a save in Me pending or
 * refused), the profile a gate reads carries every profile the person might
 * have: the stored one, the draft's, and the stored one with each save's own
 * changes (`UserProfile.candidates`; board D168). The engine runs on each.
 *
 * - A mode is allowed only if every candidate allows it, with all of their
 *   reasons and restrictions (`permission`).
 * - What one profile has to answer, a day's readiness or a plan, comes from a
 *   candidate at least as strict as every other in everything the engine
 *   makes of it for the same inputs. When none is, every mode holds until
 *   the answers are saved.
 *
 * Nothing here ranks one answer above another or builds a profile nobody
 * has: each candidate is a profile the person might really have, and what is
 * compared is the engine's own output for it (H5R-05 to H5R-08).
 */
import type { Readiness } from '@/types/checkin';
import { DISPOSITION_ORDER, OUTCOME_ORDER } from '@/types/checkin';
import type { SessionPlan } from '@/types/plan';
import type { UserProfile } from '@/types/profile';
import { deriveHealth, glucoseStartMin, profileGaps } from './health';
import { fluidLimit } from './readiness';
import { activeConditions, type Conditions } from './safety';

/** Every profile a gate must satisfy: the candidates it carries, or itself alone. */
export function candidatesOf(p: UserProfile): readonly UserProfile[] {
  return p.candidates !== undefined && p.candidates.length > 0 ? p.candidates : [p];
}

/** A candidate as the engine sees it for the inputs at hand. */
interface View {
  r: Readiness;
  c: Conditions;
  gaps: ReturnType<typeof profileGaps>;
  d: ReturnType<typeof deriveHealth>;
  /** Lows possible with no glucose meter or sensor: no intervals (`intervalsAllowed`). */
  unmonitored: boolean;
  fluid: ReturnType<typeof fluidLimit>;
  areas: readonly string[];
  preference: UserProfile['pain']['preference'];
  glucoseStart: number;
  bpStop: number;
  bpPermission: UserProfile['health']['bpExercisePermission'];
}

function viewOf(p: UserProfile, r: Readiness): View {
  const d = deriveHealth(p.health);
  return {
    r, c: activeConditions(p, r), gaps: profileGaps(p), d,
    unmonitored: d.hypoRisk && p.health.glucoseMonitor === 'none',
    fluid: fluidLimit(p.health),
    areas: p.pain.areas,
    preference: p.pain.preference,
    glucoseStart: glucoseStartMin(p.health),
    bpStop: p.health.clinicianTargets?.bpStopSystolic ?? Number.POSITIVE_INFINITY,
    bpPermission: p.health.bpExercisePermission,
  };
}

const BACK = { none: 0, green: 0, amber: 1, red: 2 } as const;
const FLUID = { free: 0, unknown: 1, limited: 2 } as const;
const CONDITION_FLAGS = [
  'backHistory', 'backIrritable', 'sciaticaActive', 'sciaticaQuiet', 'hamstringPain', 'calfPain', 'severeRetinopathy',
  'neuropathy', 'hypertension', 'head', 'impact', 'foot', 'load', 'int', 'capHeavy', 'vigorousLocked',
] as const satisfies readonly (keyof Conditions)[];
const READINESS_FLAGS = ['capHeavy', 'vigorousLocked', 'nerveFlag', 'rpeOnly', 'awaitingReading'] as const satisfies readonly (keyof Readiness)[];

const covers = (a: readonly string[] | undefined, b: readonly string[] | undefined) => (b ?? []).every(x => (a ?? []).includes(x));
const reasonKeys = (r: Readiness) => r.reasons.map(x => `${x.code}|${x.disposition ?? ''}|${[...(x.refuses ?? [])].sort().join(',')}`);
const at = <T>(order: readonly T[], v: T | undefined, fallback: T) => order.indexOf(v ?? fallback);

/** `a` asks everything `b` does, as strictly or more: every hold, restriction, threshold and limit on what a plan may hold. */
function atLeastAsStrict(a: View, b: View): boolean {
  const [r, s] = [a.r, b.r];
  if (at(DISPOSITION_ORDER, r.disposition, 'reassure') < at(DISPOSITION_ORDER, s.disposition, 'reassure')) return false;
  if (at(OUTCOME_ORDER, r.outcome, 'green') < at(OUTCOME_ORDER, s.outcome, 'green') || BACK[r.back] < BACK[s.back]) return false;
  if (!covers(r.modifiers, s.modifiers) || !covers(r.refusedModes, s.refusedModes) || !covers(reasonKeys(r), reasonKeys(s))) return false;
  if (!covers(r.actions, s.actions) || !covers(r.unresolved, s.unresolved) || (r.recheckMinutes ?? 0) < (s.recheckMinutes ?? 0)) return false;
  if (READINESS_FLAGS.some(k => s[k] === true && r[k] !== true)) return false;
  if ((b.gaps.healthUnreviewed && !a.gaps.healthUnreviewed) || (b.gaps.medicinesUnknown && !a.gaps.medicinesUnknown)) return false;
  if (CONDITION_FLAGS.some(k => b.c[k] && !a.c[k])) return false;
  if (a.c.ladder.hinge > b.c.ladder.hinge || a.c.ladder.squat > b.c.ladder.squat) return false;
  // An open nerve gate lets more in (H5R-05); a direction that makes the back worse keeps its exclusion (H5R-06).
  if (a.c.neuralGate && !b.c.neuralGate) return false;
  if (b.c.worseWith !== 'unknown' && a.c.worseWith !== b.c.worseWith) return false;
  // What the plan builders read for themselves: a glucose check, intervals (H5R-08), drinking advice, the pain areas.
  if ((['diabetic', 'hypoRisk', 'ketoneRisk', 'onBpMeds'] as const).some(k => b.d[k] && !a.d[k])) return false;
  if ((b.unmonitored && !a.unmonitored) || FLUID[a.fluid] < FLUID[b.fluid] || !covers(a.areas, b.areas)) return false;
  // A direction known to ease symptoms lets a drill in: `a` may lean on one only where `b` does.
  if (a.preference !== b.preference && (a.preference === 'extension' || a.preference === 'flexion')) return false;
  // The care team's numbers: a higher glucose to start, a lower blood pressure to stop.
  if (a.glucoseStart < b.glucoseStart || a.bpStop > b.bpStop) return false;
  // A clinician's blood-pressure permission lifts a hold: `a` may have one only as far as `b` does.
  const [pa, pb] = [a.bpPermission, b.bpPermission];
  return !pa || (pb !== undefined && pa.sys <= pb.sys && pa.dia <= pb.dia);
}

/** The caller's profile with `chosen`'s clinical answers: its health, pain, ladder and review gap. Preferences stay the caller's. */
function clinicalOf(profile: UserProfile, chosen: UserProfile): UserProfile {
  const { candidates: _all, needsHealthReview: _gap, ...rest } = profile;
  void _all;
  void _gap;
  return { ...rest, health: chosen.health, pain: chosen.pain, ladder: chosen.ladder, ...(chosen.needsHealthReview !== undefined ? { needsHealthReview: chosen.needsHealthReview } : {}) };
}

/**
 * Of a gate's candidates, the one at least as strict as every other, each
 * evaluated as the caller would (`readinessOf`): the newest where several
 * are. `undefined` when none is: then no single profile can stand for them,
 * and every mode holds until the answers are saved.
 */
export function planningProfile(profile: UserProfile, readinessOf: (p: UserProfile) => Readiness): UserProfile | undefined {
  const all = candidatesOf(profile);
  if (all.length === 1) return profile.candidates === undefined ? profile : clinicalOf(profile, all[0]);
  const views = all.map(p => viewOf(p, readinessOf(p)));
  for (let i = all.length - 1; i >= 0; i--) {
    if (views.every((v, j) => j === i || atLeastAsStrict(views[i], v))) return clinicalOf(profile, all[i]);
  }
  return undefined;
}

/**
 * Which of two profiles is at least as strict as the other, each evaluated
 * with `readinessOf`: `'a'`, `'b'`, `'same'` where each is, or `undefined`
 * where neither is (each holds something the other doesn't).
 */
export function stricterOf(a: UserProfile, b: UserProfile, readinessOf: (p: UserProfile) => Readiness): 'a' | 'b' | 'same' | undefined {
  const [va, vb] = [viewOf(a, readinessOf(a)), viewOf(b, readinessOf(b))];
  const [ab, ba] = [atLeastAsStrict(va, vb), atLeastAsStrict(vb, va)];
  return ab && ba ? 'same' : ab ? 'a' : ba ? 'b' : undefined;
}

const severity = (r: Readiness) => at(DISPOSITION_ORDER, r.disposition, 'reassure') * OUTCOME_ORDER.length + at(OUTCOME_ORDER, r.outcome, 'green');

/**
 * The day's readiness for a gate's profile: its planning candidate's, or with
 * none (every mode holds), the most serious of the candidates', for what is
 * shown and carried meanwhile.
 */
export function readinessAcross(profile: UserProfile, readinessOf: (p: UserProfile) => Readiness): Readiness {
  const all = candidatesOf(profile);
  if (all.length === 1) return readinessOf(profile.candidates === undefined ? profile : all[0]);
  const chosen = planningProfile(profile, readinessOf);
  if (chosen) return readinessOf(chosen);
  return all.map(readinessOf).reduce((a, b) => (severity(b) > severity(a) ? b : a));
}

/** What a plan says while no candidate can stand for the others (board D168). */
export const UNSAVED_PLAN = 'Your new health answers haven’t been saved yet. Save them, or discard them, in Profile & health, and today’s plan follows.';

/**
 * A plan for a gate's profile: built from its planning candidate, or with
 * none, nothing to do, and why. `build` makes the plan from one profile.
 */
export function planAcross(profile: UserProfile, readinessOf: (p: UserProfile) => Readiness, build: (p: UserProfile) => SessionPlan): SessionPlan {
  const chosen = planningProfile(profile, readinessOf);
  if (chosen) return build(chosen);
  const { candidates: _all, ...newest } = profile;
  void _all;
  const plan = build(newest);
  return { ...plan, id: `${plan.id}:unsaved`, kind: 'none', steps: [], exercises: [], cardio: null, blockStarts: {}, totalSeconds: 0, changes: [UNSAVED_PLAN], warnings: [] };
}
