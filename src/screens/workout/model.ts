/**
 * The workout being logged, as data (PLAN.md Task 6).
 *
 * Today's exercises come from the same plan the guided session runs
 * (`planFor`), so the two can never disagree about what today is. This module
 * turns that plan into exercises with their sets, and a reducer moves the
 * workout along as sets are logged. Nothing here touches React or storage.
 *
 * The durable part is a `WorkoutSession` (`toSession`), written to the store
 * after every change, so a reload or a locked phone costs nothing that was
 * logged. The rest — which exercise is in front of you, a running rest, what
 * "undo" would take back — is screen state, rebuilt sensibly when it is lost.
 */

import type { Phase, WorkoutSession, WorkoutSet, WorkoutStatus } from '@/types';
import type { DayFocus, LoadSuggestion, PlannedExercise, SessionPlan } from '@/types/plan';
import { finishedStatus, getDayOfWeekFromDate } from '@/lib/utils';
import { focusLabel, focusMuscleGroup, slotsFor } from '@/engine/templates';
import { liftedVolume, timedExercise } from './summary';

/** An answer to the planner's back-symptom checkpoint, as the guided session stores it. */
export type Answer = 'better' | 'same' | 'worse';

/** What the plan asks of one exercise today. */
export interface Target {
  /** Working sets. Warm-up (ramp) sets are advice, not logged. */
  sets: number;
  /** Reps per set, or seconds when `timed`. */
  reps: number;
  /** The plan's rep range, when it is a range. */
  range?: [number, number];
  /** Dosed in seconds: a hold or a carry. */
  timed: boolean;
  /** Each set is done on each side. */
  perSide: boolean;
  rampSets: number;
  /** Rest between this exercise's own sets. */
  restSeconds?: number;
  /** The planner's load advice; absent when the plan is no longer known. */
  load?: LoadSuggestion;
  /** Safety cues the planner attached, e.g. "Breathe out as you push." */
  caps: string[];
}

/** One exercise as the plan has it, which is also what a swap remembers. */
export interface Planned {
  exerciseId: string;
  target: Target;
  /** The planner follows this exercise with a back-symptom checkpoint. */
  checkpoint: boolean;
  /** The planner's own swap: what it would have chosen, and why it did not. */
  plannerSwap?: { from: string; reason: string };
}

export interface Item extends Planned {
  /** Stable within the workout: the plan's slot id, which a swap keeps. */
  key: string;
  slotId?: string;
  sets: WorkoutSet[];
  /** What the user swapped away from, so the swap can be taken back. */
  swappedFrom?: Planned;
}

/** Exercises the plan pairs (a superset) or rotates (a circuit), one set each in turn. */
export interface Group {
  id: string;
  kind: 'superset' | 'circuit';
  keys: string[];
  /** Rest before the next exercise in the same round. */
  restBetween: number;
  /** Rest after the last exercise of a round. */
  restAfterRound: number;
}

/** A rest kept as a deadline, so a locked phone wakes to the right time left. */
export interface Rest {
  endsAt: number;
  seconds: number;
}

export interface WorkoutState {
  /** The session id it is stored under. */
  id: string;
  date: string;
  focus: DayFocus;
  label: string;
  phase: Phase;
  week: number;
  /** The plan it was logged against; absent for a record an older version began. */
  planId?: string;
  items: Item[];
  groups: Group[];
  /** Rest after a set when the plan names none: the user's own default. */
  defaultRest: number;
  /** The stored record this continues, so fields this screen does not edit survive a rewrite. */
  base?: WorkoutSession;
  /** A record exists on the device. Set by the first logged or skipped set. */
  begun: boolean;
  /**
   * A set has been logged in this sitting: the exercise is going on without a
   * break. Never stored. A workout taken up again — from its record, or from
   * memory on coming back to the screen — is a restart until its next set,
   * which asks the full readiness question again (re-audit B03). Finishing
   * ends the sitting too, so a finish that fails to save leaves a stopped
   * workout, not a moving one (review R04).
   */
  live: boolean;
  /**
   * When this sitting's last set was logged (epoch ms), never stored. A set
   * long after it is a restart even with the screen left open: a phone
   * locked over lunch on the Workout screen is a break (M-04).
   */
  lastSetAt: number | null;
  /**
   * A past day's workout, written down afterwards: no rests to time, no
   * start or finish time to claim, and no back-symptom question asked in
   * hindsight in place of one asked at the time.
   */
  afterTheFact: boolean;
  /** Bumps on every change worth storing. */
  revision: number;
  startedAt: string | null;
  completedAt: string | null;
  status: WorkoutStatus;
  /** The exercise the user is looking at; null follows the plan's order. */
  current: string | null;
  rest: Rest | null;
  /** Set ids in the order they were logged in this sitting: what undo takes back. */
  logged: string[];
  /** The values of the set just undone, so the editor offers them again. */
  undone?: { setId: string; reps: number | null; weightKg: number | null };
  symptomChecks: Record<string, Answer>;
  notes: string;
  /**
   * The minutes the person says they were active, given when they finish.
   * Nothing else here is activity: a set logged at 9:00 and a finish at 13:00
   * are four hours on the clock, not four hours of exercise (review F20).
   */
  activeMinutes: number | null;
}

// ============================================================================
// From the plan
// ============================================================================

export function targetOf(ex: PlannedExercise): Target {
  const { rx } = ex;
  const seconds = rx.holdSeconds ?? rx.carrySeconds;
  return {
    sets: rx.sets,
    reps: seconds ?? rx.targetReps,
    ...(seconds === undefined && rx.reps[0] !== rx.reps[1] ? { range: rx.reps } : {}),
    timed: seconds !== undefined,
    perSide: !!rx.sideOrder,
    rampSets: rx.rampSets,
    restSeconds: rx.restSeconds,
    load: rx.load,
    caps: rx.caps,
  };
}

/** A planned exercise as the Workout Log holds it. */
export function plannedFrom(ex: PlannedExercise, checkpoint: boolean): Planned {
  return {
    exerciseId: ex.exerciseId,
    target: targetOf(ex),
    checkpoint,
    ...(ex.swappedFrom && ex.reason ? { plannerSwap: { from: ex.swappedFrom, reason: ex.reason } } : {}),
  };
}

/** Exercises the planner checks back symptoms after (spinal slots, back profiles). */
export function checkpointIds(plan: Pick<SessionPlan, 'steps'>): Set<string> {
  const ids = new Set<string>();
  for (const s of plan.steps) {
    if (s.kind === 'checkpoint' && s.question === 'backSymptoms' && s.exerciseId) ids.add(s.exerciseId);
  }
  return ids;
}

/** The rest the plan puts straight after one working set, if any. */
function restAfter(plan: SessionPlan, exerciseId: string, set: number): number | undefined {
  const i = plan.steps.findIndex(s => s.kind === 'set' && !s.ramp && s.exerciseId === exerciseId && s.set === set);
  const next = i >= 0 ? plan.steps[i + 1] : undefined;
  return next?.kind === 'rest' ? next.seconds : undefined;
}

/** Keys of the plan's circuits for this day, to tell a circuit from a superset. */
function circuitIds(focus: DayFocus): Set<string> {
  return new Set(slotsFor(focus).flatMap(s => (s.circuit ? [s.circuit] : [])));
}

function setsFor(workoutId: string, key: string, planned: Planned): WorkoutSet[] {
  return Array.from({ length: planned.target.sets }, (_, i) => ({
    id: `${workoutId}:${key}:${i + 1}`,
    exerciseId: planned.exerciseId,
    setNumber: i + 1,
    plannedReps: planned.target.reps,
    actualReps: null,
    weight: null,
    status: 'pending' as const,
    rpe: null,
  }));
}

export interface StartOptions {
  id: string;
  defaultRest: number;
  afterTheFact?: boolean;
}

/** Today's workout from today's plan, before anything is logged. */
export function startWorkout(plan: SessionPlan, opts: StartOptions): WorkoutState {
  const checks = checkpointIds(plan);
  const items: Item[] = plan.exercises.map(ex => {
    const planned = plannedFrom(ex, checks.has(ex.exerciseId));
    return { ...planned, key: ex.slotId, slotId: ex.slotId, sets: setsFor(opts.id, ex.slotId, planned) };
  });

  // Rests inside a group are read off the plan's own steps rather than
  // recomputed, so they match the guided session's to the second.
  const circuits = circuitIds(plan.focus);
  const byPair = new Map<string, PlannedExercise[]>();
  for (const ex of plan.exercises) if (ex.pairId) byPair.set(ex.pairId, [...(byPair.get(ex.pairId) ?? []), ex]);
  const groups: Group[] = [...byPair].filter(([, members]) => members.length > 1).map(([id, members]) => ({
    id,
    kind: circuits.has(id) ? 'circuit' : 'superset',
    keys: members.map(m => m.slotId),
    restBetween: restAfter(plan, members[0].exerciseId, 1) ?? opts.defaultRest,
    restAfterRound: restAfter(plan, members[members.length - 1].exerciseId, 1) ?? opts.defaultRest,
  }));

  return {
    id: opts.id, date: plan.date, focus: plan.focus, label: plan.label, phase: plan.phase, week: plan.week, planId: plan.id,
    items, groups, defaultRest: opts.defaultRest,
    begun: false, live: false, lastSetAt: null, afterTheFact: opts.afterTheFact ?? false, revision: 0, startedAt: null, completedAt: null, status: 'in_progress',
    current: null, rest: null, logged: [], symptomChecks: {}, notes: '', activeMinutes: null,
  };
}

/** Identifies a plan's exercises, so a workout not yet begun follows a plan that changes under it. */
export function planKey(plan: Pick<SessionPlan, 'id' | 'exercises'>): string {
  return `${plan.id}|${plan.exercises.map(e => e.exerciseId).join(',')}`;
}

// ============================================================================
// From a stored record
// ============================================================================

export interface RestoreOptions {
  defaultRest: number;
  afterTheFact?: boolean;
  /** The planner's alternative for a slot, to restore what a swap chose in place of `planned`. */
  alternativeFor?: (slotId: string, planned: string, exerciseId: string) => Planned | undefined;
}

/** Consecutive sets of the same exercise: how `toSession` writes an exercise's sets. */
function runsOf(sets: WorkoutSet[]): { exerciseId: string; sets: WorkoutSet[] }[] {
  const runs: { exerciseId: string; sets: WorkoutSet[] }[] = [];
  for (const set of sets) {
    const last = runs[runs.length - 1];
    if (last && last.exerciseId === set.exerciseId) last.sets.push(set);
    else runs.push({ exerciseId: set.exerciseId, sets: [set] });
  }
  return runs;
}

/** What is still known about an exercise once the plan that chose it is gone. */
function fromSets(exerciseId: string, sets: WorkoutSet[]): Planned {
  return {
    exerciseId,
    target: { sets: sets.length, reps: sets[0]?.plannedReps ?? 10, timed: timedExercise(exerciseId), perSide: false, rampSets: 0, caps: [] },
    checkpoint: false,
  };
}

/**
 * Pick a stored workout back up: after a reload, a locked phone or a visit to
 * another screen. The sets are the record's; the targets come from today's
 * plan when it is the plan the workout was begun on, and from the record alone
 * when the plan has changed since — the sets already logged are never hidden.
 */
export function restoreWorkout(session: WorkoutSession, plan: SessionPlan, opts: RestoreOptions): WorkoutState {
  const runs = runsOf(session.sets);
  const checks = checkpointIds(plan);
  const samePlan = session.planId !== undefined && session.planId === plan.id && runs.length === plan.exercises.length;
  const used = new Set<number>();

  const items = runs.map((run, i): Item => {
    if (samePlan) {
      const ex = plan.exercises[i];
      const original = plannedFrom(ex, checks.has(ex.exerciseId));
      if (ex.exerciseId === run.exerciseId) return { ...original, key: ex.slotId, slotId: ex.slotId, sets: run.sets };
      const chosen = opts.alternativeFor?.(ex.slotId, ex.exerciseId, run.exerciseId) ?? fromSets(run.exerciseId, run.sets);
      return { ...chosen, key: ex.slotId, slotId: ex.slotId, sets: run.sets, swappedFrom: original };
    }
    const j = plan.exercises.findIndex((e, k) => !used.has(k) && e.exerciseId === run.exerciseId);
    if (j < 0) return { ...fromSets(run.exerciseId, run.sets), key: `item-${i}`, sets: run.sets };
    used.add(j);
    const ex = plan.exercises[j];
    return { ...plannedFrom(ex, checks.has(ex.exerciseId)), key: ex.slotId, slotId: ex.slotId, sets: run.sets };
  }).map(item => (session.symptomChecks?.[item.exerciseId] ? { ...item, checkpoint: true } : item));

  const circuits = circuitIds(session.focus ?? plan.focus);
  const taken = new Set<string>();
  const groups = (session.supersetGroups ?? []).flatMap((g): Group[] => {
    const keys = g.exerciseIds.flatMap(id => {
      const item = items.find(it => it.exerciseId === id && !taken.has(it.key));
      if (!item) return [];
      taken.add(item.key);
      return [item.key];
    });
    if (keys.length < 2) return [];
    return [{
      id: g.id,
      kind: circuits.has(g.id) || keys.length > 2 ? 'circuit' : 'superset',
      keys,
      restBetween: g.restBetweenSeconds || opts.defaultRest,
      restAfterRound: g.restAfterRoundSeconds || opts.defaultRest,
    }];
  });

  const focus = session.focus ?? plan.focus;
  return {
    id: session.id, date: session.date, focus, label: focusLabel(focus), phase: session.phase, week: session.week,
    ...(session.planId !== undefined ? { planId: session.planId } : {}),
    items, groups, defaultRest: opts.defaultRest, base: session,
    begun: true, live: false, lastSetAt: null, afterTheFact: opts.afterTheFact ?? false, revision: 0, startedAt: session.startedAt, completedAt: null, status: 'in_progress',
    current: null, rest: null, logged: [], symptomChecks: { ...(session.symptomChecks ?? {}) }, notes: session.notes ?? '',
    activeMinutes: session.durationSeconds && session.durationSeconds > 0 ? Math.round(session.durationSeconds / 60) : null,
  };
}

/**
 * A workout the screen held in memory, taken up again on coming back to it:
 * the rest, focus and undo carry on, but the next set is a restart.
 */
export function resumed(state: WorkoutState): WorkoutState {
  return { ...state, live: false };
}

// ============================================================================
// Reading the state
// ============================================================================

export interface Entry {
  key: string;
  /** 0-based set index within the item. */
  index: number;
}

/**
 * The order the plan means the sets to be done in: an exercise's sets one
 * after another, and a superset or circuit one set of each in turn — the
 * guided session's order.
 */
export function sequence(state: Pick<WorkoutState, 'items' | 'groups'>): Entry[] {
  const out: Entry[] = [];
  const placed = new Set<string>();
  for (const item of state.items) {
    if (placed.has(item.key)) continue;
    const group = state.groups.find(g => g.keys.includes(item.key));
    const members = group
      ? group.keys.flatMap(k => state.items.filter(i => i.key === k))
      : [item];
    for (const m of members) placed.add(m.key);
    const rounds = Math.max(...members.map(m => m.sets.length));
    for (let r = 0; r < rounds; r++) {
      for (const m of members) if (r < m.sets.length) out.push({ key: m.key, index: r });
    }
  }
  return out;
}

export function itemFor(state: Pick<WorkoutState, 'items'>, key: string): Item | undefined {
  return state.items.find(i => i.key === key);
}

export function groupFor(state: Pick<WorkoutState, 'groups'>, key: string): Group | undefined {
  return state.groups.find(g => g.keys.includes(key));
}

/** The item's next set to do, or -1 when none is left. */
export function nextSetIndex(item: Item): number {
  return item.sets.findIndex(s => s.status === 'pending');
}

function pendingAt(state: Pick<WorkoutState, 'items'>, e: Entry): boolean {
  return itemFor(state, e.key)?.sets[e.index]?.status === 'pending';
}

/** The first set still to do after one, wrapping round to the start. */
function nextAfter(state: Pick<WorkoutState, 'items' | 'groups'>, key: string, index: number): Entry | undefined {
  const seq = sequence(state);
  const at = seq.findIndex(e => e.key === key && e.index === index);
  const ordered = at < 0 ? seq : [...seq.slice(at + 1), ...seq.slice(0, at + 1)];
  return ordered.find(e => pendingAt(state, e));
}

/**
 * The exercise in front of the user: the one they chose, else — after a reload
 * has forgotten that — the set that follows the furthest one logged in the
 * plan's order, which is where a superset left off rather than the first
 * exercise not yet started.
 */
export function currentItem(state: WorkoutState): Item | undefined {
  if (state.current) return itemFor(state, state.current);
  const seq = sequence(state);
  const furthest = seq.findLast(e => itemFor(state, e.key)?.sets[e.index]?.status === 'completed');
  const next = furthest ? nextAfter(state, furthest.key, furthest.index) : seq.find(e => pendingAt(state, e));
  return next ? itemFor(state, next.key) : undefined;
}

export function progress(state: Pick<WorkoutState, 'items'>): { done: number; skipped: number; pending: number; total: number } {
  const sets = state.items.flatMap(i => i.sets);
  const count = (status: WorkoutSet['status']) => sets.filter(s => s.status === status).length;
  return { done: count('completed'), skipped: count('skipped'), pending: count('pending'), total: sets.length };
}

/** An exercise whose back-symptom checkpoint is due: all its sets settled, at least one done, no answer yet. */
export function pendingCheck(state: WorkoutState): Item | undefined {
  if (state.afterTheFact) return undefined;
  return state.items.find(i => i.checkpoint && !state.symptomChecks[i.exerciseId]
    && i.sets.some(s => s.status === 'completed') && !i.sets.some(s => s.status === 'pending'));
}

/** What the set editor offers for an item's next set. */
export function prefill(state: WorkoutState, item: Item): { reps: number; weightKg: number | null } {
  const next = item.sets[nextSetIndex(item)];
  if (next && state.undone?.setId === next.id) {
    return { reps: state.undone.reps ?? item.target.reps, weightKg: state.undone.weightKg };
  }
  // The weight just lifted is the likeliest next one; the reps aim at the plan's target.
  const last = [...item.sets].reverse().find(s => s.status === 'completed');
  return { reps: item.target.reps, weightKg: last ? last.weight : item.target.load?.kg ?? null };
}

/**
 * Milliseconds of rest left at `now`, from the deadline: right however long
 * the phone slept. Never more than the rest itself, so a clock read a moment
 * before the rest began cannot show extra time.
 */
export function restLeftMs(rest: Rest | null, now: number): number {
  return rest ? Math.min(rest.seconds * 1000, Math.max(0, rest.endsAt - now)) : 0;
}

/**
 * The rest owed after a set. Inside a superset or circuit the plan's own
 * group rests apply; between an exercise's sets, its rest; moving on to
 * another exercise, the user's default. Nothing left to do: no rest.
 */
function restAfterSet(state: WorkoutState, item: Item, index: number, next: Entry | undefined): number {
  if (!next) return 0;
  const group = groupFor(state, item.key);
  if (group && group.keys.includes(next.key)) {
    if (next.key !== item.key && next.index === index) return group.restBetween;
    if (next.index > index) return group.restAfterRound;
  }
  if (!group && next.key === item.key) return item.target.restSeconds ?? state.defaultRest;
  return state.defaultRest;
}

// ============================================================================
// Changing it
// ============================================================================

export type WorkoutAction =
  | { type: 'log'; key: string; reps: number; weightKg: number | null; now: number }
  | { type: 'edit'; setId: string; reps: number; weightKg: number | null }
  | { type: 'unlog'; setId: string }
  | { type: 'undo' }
  | { type: 'skip'; key: string }
  | { type: 'unskip'; key: string }
  | { type: 'swap'; key: string; to: Planned }
  | { type: 'focus'; key: string }
  | { type: 'answer'; exerciseId: string; answer: Answer }
  | { type: 'endRest' }
  | { type: 'finish'; now: number; notes: string; activeMinutes: number | null }
  /** A finish that could not be saved: back to the workout as it was, still in progress. */
  | { type: 'reopen' }
  /** The page was hidden: the sitting ends, and the next set is a restart (M-04). */
  | { type: 'away' };

/** A change worth storing. `begins` marks the first one, which creates the record. */
function stored(state: WorkoutState, next: Partial<WorkoutState>, begins = false): WorkoutState {
  const begun = state.begun || begins;
  return { ...state, ...next, begun, revision: begun ? state.revision + 1 : state.revision };
}

function mapSet(state: WorkoutState, setId: string, change: (set: WorkoutSet) => WorkoutSet): Item[] {
  return state.items.map(i => (i.sets.some(s => s.id === setId) ? { ...i, sets: i.sets.map(s => (s.id === setId ? change(s) : s)) } : i));
}

function itemOfSet(state: WorkoutState, setId: string): Item | undefined {
  return state.items.find(i => i.sets.some(s => s.id === setId));
}

const pending = (s: WorkoutSet): WorkoutSet => ({ ...s, status: 'pending', actualReps: null, weight: null });

function planned(item: Item): Planned {
  return {
    exerciseId: item.exerciseId,
    target: item.target,
    checkpoint: item.checkpoint,
    ...(item.plannerSwap ? { plannerSwap: item.plannerSwap } : {}),
  };
}

export function workoutReducer(state: WorkoutState, action: WorkoutAction): WorkoutState {
  if (action.type === 'reopen') {
    return state.status === 'in_progress' ? state : { ...state, status: 'in_progress', completedAt: null };
  }
  if (action.type === 'away') return state.live ? resumed(state) : state;
  // A finished workout is a record now — or is being saved as one — so it
  // takes no more sets; changing it is the record screen's job.
  if (state.status !== 'in_progress') return state;

  switch (action.type) {
    case 'log': {
      const item = itemFor(state, action.key);
      const index = item ? nextSetIndex(item) : -1;
      if (!item || index < 0) return state;
      const set = item.sets[index];
      const done: WorkoutSet = { ...set, status: 'completed', actualReps: action.reps, weight: action.weightKg };
      const items = state.items.map(i => (i.key === item.key ? { ...i, sets: i.sets.map((s, n) => (n === index ? done : s)) } : i));
      const after = { ...state, items };
      const next = nextAfter(after, item.key, index);
      const rest = state.afterTheFact ? 0 : restAfterSet(after, item, index, next);
      return stored(state, {
        items,
        startedAt: state.afterTheFact ? state.startedAt : state.startedAt ?? new Date(action.now).toISOString(),
        logged: [...state.logged, set.id],
        current: next?.key ?? null,
        rest: rest > 0 ? { endsAt: action.now + rest * 1000, seconds: rest } : null,
        undone: undefined,
        live: true,
        lastSetAt: action.now,
      }, true);
    }

    case 'edit': {
      const item = itemOfSet(state, action.setId);
      if (item?.sets.find(s => s.id === action.setId)?.status !== 'completed') return state;
      return stored(state, { items: mapSet(state, action.setId, s => ({ ...s, actualReps: action.reps, weight: action.weightKg })) });
    }

    case 'unlog': {
      const item = itemOfSet(state, action.setId);
      if (item?.sets.find(s => s.id === action.setId)?.status !== 'completed') return state;
      return stored(state, {
        items: mapSet(state, action.setId, pending),
        logged: state.logged.filter(id => id !== action.setId),
        current: item.key,
      });
    }

    case 'undo': {
      if (state.logged.length === 0) return state;
      // Sets already edited back to "not done" are no longer anything to undo.
      const logged = [...state.logged];
      let id = logged.pop();
      while (id !== undefined && itemOfSet(state, id)?.sets.find(s => s.id === id)?.status !== 'completed') id = logged.pop();
      if (id === undefined) return { ...state, logged };
      const setId = id;
      const item = itemOfSet(state, setId)!;
      const set = item.sets.find(s => s.id === setId)!;
      return stored(state, {
        items: mapSet(state, setId, pending),
        logged,
        current: item.key,
        rest: null,
        undone: { setId, reps: set.actualReps, weightKg: set.weight },
      });
    }

    case 'skip': {
      const item = itemFor(state, action.key);
      const from = item ? nextSetIndex(item) : -1;
      if (!item || from < 0) return state;
      const items = state.items.map(i => (i.key === item.key
        ? { ...i, sets: i.sets.map(s => (s.status === 'pending' ? { ...s, status: 'skipped' as const } : s)) }
        : i));
      // Carry on from where the skipped exercise was, so a superset's other
      // exercise finishes its sets before the workout moves on.
      const next = nextAfter({ ...state, items }, item.key, from);
      return stored(state, { items, current: next?.key ?? null }, true);
    }

    case 'unskip': {
      const item = itemFor(state, action.key);
      if (!item?.sets.some(s => s.status === 'skipped')) return state;
      const items = state.items.map(i => (i.key === item.key
        ? { ...i, sets: i.sets.map(s => (s.status === 'skipped' ? { ...s, status: 'pending' as const } : s)) }
        : i));
      return stored(state, { items, current: item.key });
    }

    case 'swap': {
      const item = itemFor(state, action.key);
      // Once a set is done the exercise is what was done; the rest of it can be skipped instead.
      if (!item || item.sets.some(s => s.status === 'completed') || item.exerciseId === action.to.exerciseId) return state;
      const back = item.swappedFrom?.exerciseId === action.to.exerciseId;
      const chosen = back ? item.swappedFrom! : action.to;
      const replacement: Item = {
        ...chosen,
        key: item.key,
        ...(item.slotId !== undefined ? { slotId: item.slotId } : {}),
        sets: setsFor(state.id, item.key, chosen),
        ...(back ? {} : { swappedFrom: item.swappedFrom ?? planned(item) }),
      };
      return stored(state, { items: state.items.map(i => (i.key === item.key ? replacement : i)), current: item.key });
    }

    case 'focus':
      return itemFor(state, action.key) ? { ...state, current: action.key } : state;

    case 'answer':
      return stored(state, { symptomChecks: { ...state.symptomChecks, [action.exerciseId]: action.answer } });

    case 'endRest':
      return state.rest ? { ...state, rest: null } : state;

    case 'finish': {
      if (!state.begun) return state;
      const sets = state.items.flatMap(i => i.sets);
      return stored(state, {
        status: finishedStatus(sets),
        completedAt: state.afterTheFact ? null : new Date(action.now).toISOString(),
        notes: action.notes,
        activeMinutes: action.activeMinutes,
        rest: null,
        current: null,
        live: false,
      });
    }
  }
}

// ============================================================================
// To the store
// ============================================================================

/** The fields a stored record carries that this screen rewrites from its own state. */
function carried(base: WorkoutSession | undefined): Partial<WorkoutSession> {
  if (!base) return {};
  const copy: Partial<WorkoutSession> = { ...base };
  delete copy.supersetGroups;
  delete copy.symptomChecks;
  return copy;
}

/** The workout as the record the store keeps: a manual `WorkoutSession`. */
export function toSession(state: WorkoutState): WorkoutSession {
  const sets = state.items.flatMap(i => i.sets);
  const exerciseOf = (key: string) => itemFor(state, key)?.exerciseId ?? key;
  return {
    ...carried(state.base),
    id: state.id,
    date: state.date,
    dayOfWeek: getDayOfWeekFromDate(state.date),
    muscleGroup: focusMuscleGroup(state.focus),
    phase: state.phase,
    week: state.week,
    status: state.status,
    sets,
    startedAt: state.startedAt,
    completedAt: state.completedAt,
    notes: state.notes,
    totalVolume: liftedVolume(sets),
    // Only the person's own minutes are active time. Left unsaid, it is none
    // (0), never the clock span: unset, `sessionSeconds` would fall back to
    // that span and count hours of a locked phone as movement (F20).
    durationSeconds: state.activeMinutes === null ? 0 : state.activeMinutes * 60,
    focus: state.focus,
    ...(state.planId !== undefined ? { planId: state.planId } : {}),
    ...(state.groups.length ? {
      supersetGroups: state.groups.map(g => ({
        id: g.id,
        exerciseIds: g.keys.map(exerciseOf),
        restBetweenSeconds: g.restBetween,
        restAfterRoundSeconds: g.restAfterRound,
      })),
    } : {}),
    ...(Object.keys(state.symptomChecks).length ? { symptomChecks: { ...state.symptomChecks } } : {}),
  };
}
