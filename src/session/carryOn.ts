/**
 * A saved run, as it would carry on now (round 3 B05, B-30). The plan was
 * built for the person as they were; carrying it on runs what the app's
 * builders prescribe today for the same day and focus (`todayDose`), with
 * the saved plan held to it from where it stopped (`reconcilePlan`), and the
 * back check of whatever today leaves out left out with it
 * (`withBackChecks`). The player runs exactly this, and a hub's "Continue"
 * describes it, so the two never disagree (codex H2-02).
 */
import { buildSessionPlan } from '@/engine/session';
import { specFromPlanId, stretchPlanFor } from '@/engine/stretch';
import { stepSeconds } from '@/engine/timing';
import type { PermissionInput } from '@/engine/permission';
import type { AppData } from '@/types';
import type { CheckInRecord } from '@/types/checkin';
import type { SessionPlan, Step, StretchSpec } from '@/types/plan';
import type { UserProfile } from '@/types/profile';
import { reconcilePlan } from './gate';
import type { RunnerState } from './runner';

export interface DoseContext {
  data: Pick<AppData, 'settings' | 'sessions'>;
  /** Every day's effective check-in (`useGuided().checkIns`). */
  checkIns: CheckInRecord[];
  /** Today's (`useGuided().checkIn`). */
  checkIn?: CheckInRecord | undefined;
  profile: UserProfile;
  /** Today. */
  date: string;
  /** Today's own plan (`useGuided().plan`). */
  todayPlan: SessionPlan;
  /** The stretch the run's address names, when its id doesn't. */
  spec?: StretchSpec | null;
}

/**
 * What the app's own builders would prescribe now for `plan`'s day and
 * focus, from today's answers. For today's own plan it is that plan, so
 * nothing changes.
 */
export function todayDose(plan: SessionPlan, c: DoseContext): SessionPlan {
  if (plan.kind === 'stretch') {
    const s = specFromPlanId(plan.id) ?? c.spec;
    const built = s ? stretchPlanFor({ ...c.data, checkIns: c.checkIns }, c.profile, c.date, s) : plan;
    // A stretch that sent symptoms further down rules out a new stretch
    // today, not the routine on screen (J2-04; acceptance J16 step 6). The
    // builder has no routine to offer then, so the one under way is held to
    // its own steps, less whatever today leaves out. Anything that stops the
    // routine itself is the live gate's.
    return built.kind === 'none' ? plan : built;
  }
  if (plan.date === c.date && plan.focus === c.todayPlan.focus) return c.todayPlan;
  return buildSessionPlan({
    profile: c.profile, date: plan.date, startDate: c.data.settings.startDate,
    sessions: c.data.sessions.filter(x => x.date < plan.date),
    recentCheckIns: c.checkIns.filter(x => x.date < c.date),
    ...(c.checkIn ? { checkIn: c.checkIn } : {}),
    focusOverride: plan.focus,
  });
}

/** The refused steps, with the back check of every exercise that is left out altogether (scan J2-02). */
export function withBackChecks(plan: SessionPlan, refused: ReadonlySet<string>): ReadonlySet<string> {
  const out = new Set(refused);
  for (const s of plan.steps) {
    if (s.kind !== 'checkpoint' || s.question !== 'backSymptoms' || !s.exerciseId) continue;
    const work = plan.steps.filter(x => x.kind !== 'checkpoint' && 'exerciseId' in x && x.exerciseId === s.exerciseId);
    if (work.length > 0 && work.every(x => refused.has(x.id))) out.add(s.id);
  }
  return out.size === refused.size ? refused : out;
}

export interface CarriedOn {
  /** The plan the player will run: the saved one, held to today. */
  plan: SessionPlan;
  /** Steps today refuses, with their back checks: the runner never enters them. */
  refused: ReadonlySet<string>;
  /** What is still to run, from where the run stopped, as it will run. */
  left: Step[];
  /** Roughly how long that takes, at least a minute. */
  minutesLeft: number;
}

/** A saved run as it would carry on now, from where it stopped. */
export function carriedOn(saved: { plan: SessionPlan; state: Pick<RunnerState, 'index'> }, c: DoseContext, input: PermissionInput): CarriedOn {
  const at = saved.state.index;
  const r = reconcilePlan(saved.plan, at, todayDose(saved.plan, c), input);
  const refused = withBackChecks(r.plan, r.refused);
  const left = r.plan.steps.slice(at).filter(s => !refused.has(s.id));
  return { plan: r.plan, refused, left, minutesLeft: Math.max(1, Math.round(left.reduce((t, s) => t + stepSeconds(s), 0) / 60)) };
}
