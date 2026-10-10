/**
 * Session runner: a pure reducer over a SessionPlan plus a position selector.
 * Elapsed time is derived from clock anchors, so any gap between ticks
 * (background tab, screen lock) resolves to the right step and segment.
 */

import type { Segment, SessionPlan, Step, StepLog } from '@/types/plan';
import { segmentsFor } from '@/engine/timing';

export type RunnerStatus = 'ready' | 'running' | 'paused' | 'done';

export interface RunnerState {
  planId: string;
  /** Plan date (YYYY-MM-DD); resumes keep logging to this date. */
  date: string;
  status: RunnerStatus;
  index: number;
  /** Clock time the current step started, shifted forward by pauses. */
  stepStartedAt: number;
  /**
   * Bumped every time a step is entered (start, next, previous, auto-advance).
   * The narrator keys "already said" by it, so repeating a step speaks it again
   * while merely re-anchoring the schedule does not (spec §7.3).
   */
  visit: number;
  pausedAt?: number;
  /** Extra milliseconds added to a step's segments: stepId → segmentIndex → ms. */
  extraMs: Record<string, Record<number, number>>;
  logs: StepLog[];
  startedAt?: number;
  finishedAt?: number;
  /** Time actually spent running, excluding pauses and time the app was closed. */
  activeMs?: number;
  /** Clock time the current running stretch began (unset while not running). */
  runningSince?: number;
  /** After a low only the cool-down is allowed (spec §4.6): going back stops here. */
  coolDownFrom?: { index: number; segment: number };
}

export type RunnerAction =
  | { type: 'start'; now: number }
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number }
  | { type: 'tick'; now: number }
  | { type: 'next'; now: number; reason?: 'skip' | 'doneEarly' }
  | { type: 'previous'; now: number }
  | { type: 'addTime'; now: number; seconds: number }
  | { type: 'log'; entry: StepLog }
  | { type: 'finish'; now: number }
  /** Jump forward into a later step at one of its segments ("cool-down only" after a low). */
  | { type: 'seek'; now: number; index: number; segment: number }
  /**
   * The plan was re-dosed under the run: `from` is the plan the state was
   * running (N-08). Applied once, to the visit it was worked out for: a render
   * done twice cannot move the run's place twice.
   */
  | { type: 'redose'; now: number; from: SessionPlan; visit: number };

export function initialState(plan: SessionPlan): RunnerState {
  return { planId: plan.id, date: plan.date, status: 'ready', index: 0, stepStartedAt: 0, visit: 0, extraMs: {}, logs: [] };
}

const NONE: ReadonlySet<string> = new Set();

/** Entering a step: a saved state from an older version may not have a visit yet. */
const nextVisit = (state: RunnerState): number => (state.visit ?? 0) + 1;

export function segmentsWithExtra(step: Step, state: Pick<RunnerState, 'extraMs'>): { segment: Segment; ms: number }[] {
  const extra = state.extraMs[step.id] ?? {};
  return segmentsFor(step).map((segment, i) => ({ segment, ms: segment.seconds * 1000 + (extra[i] ?? 0) }));
}

export function stepDurationMs(step: Step, state: Pick<RunnerState, 'extraMs'>): number {
  return segmentsWithExtra(step, state).reduce((s, x) => s + x.ms, 0);
}

/** Elapsed time within the current step (frozen while paused). */
function elapsedInStep(state: RunnerState, now: number): number {
  if (state.status === 'ready') return 0;
  const at = state.status === 'paused' && state.pausedAt !== undefined ? state.pausedAt : now;
  return Math.max(0, at - state.stepStartedAt);
}

function upsertLog(logs: StepLog[], entry: StepLog): StepLog[] {
  const i = logs.findIndex(l => l.stepId === entry.stepId);
  if (i < 0) return [...logs, entry];
  const copy = [...logs];
  copy[i] = { ...copy[i], ...entry };
  return copy;
}

function completeStep(state: RunnerState, step: Step, at: number, skipped = false): StepLog[] {
  const existing = state.logs.find(l => l.stepId === step.id);
  const base: StepLog = {
    stepId: step.id,
    kind: step.kind,
    completed: !skipped,
    at,
    ...('exerciseId' in step && step.exerciseId ? { exerciseId: step.exerciseId } : {}),
    ...(step.kind === 'set' ? { reps: step.holdSeconds || step.carrySeconds ? 1 : step.reps, weightKg: step.load.kg } : {}),
  };
  // Keep anything the user logged (actual reps, weight, answers). A step run
  // to its end is done, whatever an earlier log said (a weight changed mid-set,
  // a skip the user came back to); one entered part-way is not. A skipped step
  // stays done only if it already was.
  const kept: Partial<StepLog> = { ...existing };
  delete kept.skipped;
  const completed = skipped ? existing?.completed === true : !existing?.partial;
  const entry: StepLog = { ...base, ...kept, completed, at, ...(skipped ? { skipped: true } : {}) };
  const i = state.logs.findIndex(l => l.stepId === step.id);
  return i < 0 ? [...state.logs, entry] : state.logs.map((l, j) => (j === i ? entry : l));
}

/** A safety check that holds the session until it is answered, rather than timing out. */
function awaitsAnswer(step: Step, state: RunnerState): boolean {
  return step.kind === 'checkpoint' && step.question === 'glucose' && !state.logs.some(l => l.stepId === step.id && l.answer);
}

/**
 * Steps today's answers refuse are never entered (re-audit round 3 B05, B09):
 * the runner passes over them in either direction and logs them as left out,
 * so neither the clock, Next, Previous nor earphone controls can run one. The
 * set comes from the player, which knows today's restrictions.
 */
export function createRunner(plan: SessionPlan, refused: ReadonlySet<string> = NONE) {
  const steps = plan.steps;
  const blocked = (i: number) => i >= 0 && i < steps.length && refused.has(steps[i].id);

  const advance = (state: RunnerState, now: number, from: number, skipped = false): RunnerState => {
    const step = steps[state.index];
    let logs = step ? completeStep(state, step, now, skipped || blocked(state.index)) : state.logs;
    let nextIndex = state.index + 1;
    while (nextIndex < steps.length && blocked(nextIndex)) {
      logs = completeStep({ ...state, logs }, steps[nextIndex], now, true);
      nextIndex++;
    }
    if (nextIndex >= steps.length) {
      // `from` is when the plan's last step ended: a phone that wakes later still finished on time.
      return { ...state, logs, index: steps.length - 1, status: 'done', finishedAt: from, pausedAt: undefined };
    }
    return { ...state, logs, index: nextIndex, stepStartedAt: from, visit: nextVisit(state) };
  };

  /** Standing on a step that is now refused: move on before anything runs. */
  const passRefused = (state: RunnerState, now: number): RunnerState => {
    if ((state.status !== 'running' && state.status !== 'paused') || !blocked(state.index)) return state;
    const s = advance(state, now, now, true);
    return s.status === 'paused' ? { ...s, pausedAt: now } : s;
  };

  function reduce(state: RunnerState, action: RunnerAction): RunnerState {
    const next = apply(state, action);
    return trackActive(state, 'now' in action ? passRefused(next, action.now) : next, action);
  }

  function apply(state: RunnerState, action: RunnerAction): RunnerState {
    if (steps.length === 0) return { ...state, status: 'done' };
    switch (action.type) {
      case 'start':
        if (state.status !== 'ready') return state;
        return { ...state, status: 'running', stepStartedAt: action.now, startedAt: action.now, visit: nextVisit(state), activeMs: 0 };

      case 'pause':
        if (state.status !== 'running') return state;
        return { ...state, status: 'paused', pausedAt: action.now };

      case 'resume': {
        if (state.status !== 'paused' || state.pausedAt === undefined) return state;
        const paused = action.now - state.pausedAt;
        return { ...state, status: 'running', pausedAt: undefined, stepStartedAt: state.stepStartedAt + paused };
      }

      case 'tick': {
        if (state.status !== 'running') return state;
        let s = state;
        // Catch up across as many steps as the elapsed time covers.
        for (let guard = 0; guard < steps.length; guard++) {
          const step = steps[s.index];
          const dur = stepDurationMs(step, s);
          const elapsed = action.now - s.stepStartedAt;
          if (elapsed < dur || awaitsAnswer(step, s)) break;
          s = advance(s, action.now, s.stepStartedAt + dur);
          if (s.status === 'done') break;
        }
        return s;
      }

      case 'next': {
        if (state.status === 'done' || state.status === 'ready') return state;
        // The glucose check before cardio is answered, not skipped: both of its
        // buttons carry on, and either says whether cardio is safe.
        if (awaitsAnswer(steps[state.index], state)) return state;
        const s = advance(state, action.now, action.now, action.reason === 'skip');
        return s.status === 'paused' ? { ...s, pausedAt: action.now } : s;
      }

      case 'previous': {
        // A finished session stays finished: Previous, from the screen or an
        // earphone's "previous track", never brings it back to life (scan M-03).
        if (state.status === 'ready' || state.status === 'done') return state;
        const elapsed = elapsedInStep(state, action.now);
        // Within the first 3 seconds go back a step; otherwise restart this one.
        // Never back into refused work: the nearest earlier step that may run.
        let index = elapsed < 3000 && state.index > 0 ? state.index - 1 : state.index;
        while (index > 0 && blocked(index)) index--;
        if (blocked(index)) index = state.index;
        // After a low, never back before the cool-down: it restarts instead.
        const floor = state.coolDownFrom;
        const atFloor = !!floor && index <= floor.index;
        if (atFloor) index = floor.index;
        const offset = atFloor ? segmentsWithExtra(steps[index], state).slice(0, floor.segment).reduce((t, x) => t + x.ms, 0) : 0;
        return {
          ...state,
          index,
          // A step entered again from its start is done in full; the cool-down after a low stays partial.
          logs: atFloor ? state.logs : state.logs.map(l => (l.stepId === steps[index].id && l.partial ? { ...l, partial: undefined } : l)),
          stepStartedAt: action.now - offset,
          visit: nextVisit(state),
          pausedAt: state.status === 'paused' ? action.now : undefined,
        };
      }

      case 'addTime': {
        if (state.status !== 'running' && state.status !== 'paused') return state;
        const step = steps[state.index];
        const pos = locate(step, state, elapsedInStep(state, action.now));
        /*
         * Where "+15 s" goes. Tempo is not negotiable: a rep's phases drive the
         * timer ring ("Rep 1 · lower 3 s"), the rep counting and the 3D demo, so
         * adding the time inside one would turn a 3 s lowering into an 18 s one.
         *   · rep phase (inside a set) → the next step, which is the rest after
         *     the set: "+15 s" mid-set means you want longer before the next one
         *   · anything else (hold, carry, prep, rest, switch, cardio, talk) →
         *     that segment, so the hold, the setup or the rest simply lasts longer
         */
        const target = pos.segment.kind === 'rep'
          ? { step: steps[state.index + 1], segmentIndex: 0 }
          : { step, segmentIndex: pos.segmentIndex };
        if (!target.step) return state; // last step of the session: nowhere sensible to put it
        const perStep = { ...(state.extraMs[target.step.id] ?? {}) };
        perStep[target.segmentIndex] = (perStep[target.segmentIndex] ?? 0) + action.seconds * 1000;
        return { ...state, extraMs: { ...state.extraMs, [target.step.id]: perStep } };
      }

      case 'log':
        return { ...state, logs: upsertLog(state.logs, action.entry) };

      case 'finish':
        return { ...state, status: 'done', finishedAt: action.now, pausedAt: undefined };

      case 'redose':
        return state.visit === action.visit ? redoseState(action.from, plan, state, action.now) : state;

      case 'seek': {
        if (state.status !== 'running' && state.status !== 'paused') return state;
        if (action.index < state.index || action.index >= steps.length) return state;
        let s = state;
        while (s.index < action.index) {
          s = advance(s, action.now, action.now, true);
          if (s.status === 'done') return s;
        }
        const target = steps[s.index];
        const segs = segmentsWithExtra(target, s);
        const seg = Math.min(Math.max(0, action.segment), segs.length - 1);
        const offset = segs.slice(0, seg).reduce((t, x) => t + x.ms, 0);
        const logs = seg > 0
          ? upsertLog(s.logs, { stepId: target.id, kind: target.kind, completed: false, partial: true, at: action.now, ...('exerciseId' in target && target.exerciseId ? { exerciseId: target.exerciseId } : {}) })
          : s.logs;
        return { ...s, logs, coolDownFrom: { index: s.index, segment: seg }, stepStartedAt: action.now - offset, ...(s.status === 'paused' ? { pausedAt: action.now } : {}) };
      }
    }
  }

  return { reduce };
}

/**
 * The run's place once the plan is re-dosed under it (R5-04, N-08). Steps
 * already done are not the runner's to change, and a step not under way has
 * nothing to carry. A cardio step under way keeps the time already spent, and
 * what is left is today's dose: past today's work, the person goes straight to
 * the cool-down's own start, so a shorter dose never counts a cool-down that
 * was not done; already in the cool-down, it goes on where it was. Time added
 * to the old dose goes with it, and the coach starts the step again as it is
 * now.
 */
export function redoseState(from: SessionPlan, to: SessionPlan, state: RunnerState, now: number): RunnerState {
  if (state.status !== 'running' && state.status !== 'paused') return state;
  const was = from.steps[state.index];
  const is = to.steps[state.index];
  if (!was || !is || was.id !== is.id || was.kind !== 'cardio' || is.kind !== 'cardio' || JSON.stringify(was.parts) === JSON.stringify(is.parts)) return state;
  const elapsed = elapsedInStep(state, now);
  const workMs = (segs: { segment: Segment; ms: number }[]) => segs.filter(x => x.segment.intensity !== 'cooldown').reduce((t, x) => t + x.ms, 0);
  const oldSegs = segmentsWithExtra(was, state);
  const { [is.id]: _old, ...extraMs } = state.extraMs;
  void _old;
  const newSegs = segmentsWithExtra(is, { extraMs });
  const oldWork = workMs(oldSegs);
  const newWork = workMs(newSegs);
  const newCool = newSegs.reduce((t, x) => t + x.ms, 0) - newWork;
  const at = elapsed < oldWork ? Math.min(elapsed, newWork) : newWork + Math.min(elapsed - oldWork, newCool);
  const anchor = state.status === 'paused' && state.pausedAt !== undefined ? state.pausedAt : now;
  const coolFrom = newSegs.findIndex(x => x.segment.intensity === 'cooldown');
  return {
    ...state,
    stepStartedAt: anchor - at,
    extraMs,
    visit: nextVisit(state),
    ...(state.coolDownFrom?.index === state.index && coolFrom >= 0 ? { coolDownFrom: { index: state.index, segment: coolFrom } } : {}),
  };
}

/**
 * Running time is summed across pauses: each stretch from (re)starting to
 * pausing or finishing. A run saved before this was tracked has no
 * `runningSince`, so it keeps the older estimate in logging.ts.
 */
function trackActive(prev: RunnerState, next: RunnerState, action: RunnerAction): RunnerState {
  if (next === prev || !('now' in action)) return next;
  const was = prev.status === 'running';
  const is = next.status === 'running';
  if (was && !is && prev.runningSince !== undefined) {
    const end = next.status === 'done' && next.finishedAt !== undefined ? Math.min(action.now, next.finishedAt) : action.now;
    return { ...next, activeMs: (prev.activeMs ?? 0) + Math.max(0, end - prev.runningSince), runningSince: undefined };
  }
  if (!was && is) return { ...next, runningSince: action.now };
  return next;
}

/**
 * Where "cool-down only" goes after a low (spec §4.6): the cool-down part of
 * the cardio still ahead, else the wrap-up. Never the warm-up or the intervals.
 */
export function coolDownTarget(plan: SessionPlan, from: number, segment = 0, refused: ReadonlySet<string> = NONE): { index: number; segment: number } | null {
  for (let i = from; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    if (step.kind !== 'cardio' || refused.has(step.id)) continue;
    const cool = segmentsFor(step).findIndex(s => s.intensity === 'cooldown');
    if (cool >= 0 && (i > from || cool > segment)) return { index: i, segment: cool };
  }
  const wrap = plan.steps.findIndex((s, i) => i > from && s.block === 'wrapUp' && !refused.has(s.id));
  return wrap >= 0 ? { index: wrap, segment: 0 } : null;
}

function locate(step: Step, state: RunnerState, elapsed: number) {
  const segs = segmentsWithExtra(step, state);
  let t = 0;
  for (let i = 0; i < segs.length; i++) {
    if (elapsed < t + segs[i].ms || i === segs.length - 1) {
      return { segmentIndex: i, segment: segs[i].segment, segmentStart: t, segmentMs: segs[i].ms };
    }
    t += segs[i].ms;
  }
  return { segmentIndex: 0, segment: segs[0].segment, segmentStart: 0, segmentMs: segs[0].ms };
}

export interface Position {
  step: Step;
  stepIndex: number;
  segment: Segment;
  segmentIndex: number;
  segmentElapsedMs: number;
  segmentRemainingMs: number;
  stepElapsedMs: number;
  stepRemainingMs: number;
  /** Progress through the plan's timeline (not wall time). */
  sessionElapsedMs: number;
  sessionTotalMs: number;
}

export function position(plan: SessionPlan, state: RunnerState, now: number, refused: ReadonlySet<string> = NONE): Position {
  const stepIndex = Math.min(state.index, plan.steps.length - 1);
  const step = plan.steps[stepIndex];
  const dur = stepDurationMs(step, state);
  const stepElapsedMs = state.status === 'done' ? dur : Math.min(dur, elapsedInStep(state, now));
  const loc = locate(step, state, stepElapsedMs);
  // Refused work takes no time: it is not going to be done.
  const counted = (x: Step) => (refused.has(x.id) ? 0 : stepDurationMs(x, state));
  const before = plan.steps.slice(0, stepIndex).reduce((s, x) => s + counted(x), 0);
  const total = plan.steps.reduce((s, x) => s + counted(x), 0);
  return {
    step,
    stepIndex,
    segment: loc.segment,
    segmentIndex: loc.segmentIndex,
    segmentElapsedMs: Math.min(loc.segmentMs, stepElapsedMs - loc.segmentStart),
    segmentRemainingMs: Math.max(0, loc.segmentMs - (stepElapsedMs - loc.segmentStart)),
    stepElapsedMs,
    stepRemainingMs: Math.max(0, dur - stepElapsedMs),
    sessionElapsedMs: before + stepElapsedMs,
    sessionTotalMs: total,
  };
}
