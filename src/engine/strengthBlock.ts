/**
 * Turns the day's prescribed exercises into timed steps (setup → ramp sets →
 * working sets with rests; antagonist pairs alternate; circuits rotate) and
 * fits them into the strength budget (spec §5.2 step 7;
 * program-design.md §5.3). Never cuts main-lift sets, ramp sets, main rest,
 * or the trunk slot for back profiles.
 */

import type { PlannedExercise, Prescription, RestStep, SetStep, Step, Tempo } from '@/types/plan';
import { getStrength, getMeta } from '@/data/catalog';
import type { Slot } from './templates';
import { totalSeconds } from './timing';
import type { SpeechSizer } from './speech';

export interface StrengthOptions {
  slots: Slot[];
  backProfile: boolean;
  budgetSeconds: number;
  /** Next block's first exercise, for the closing transition. */
  nextTitle: string;
  idPrefix?: string;
  /** Sizes setup time to the narration. */
  speech?: SpeechSizer;
  /** Longest setup talk for the first exercise of a group (seconds); the fitter lowers it when tight. */
  setupCap?: number;
}

interface Group {
  kind: 'single' | 'pair' | 'circuit';
  items: PlannedExercise[];
  spinal: boolean;
}

const FAST_TEMPO: Tempo = { lower: 2, pauseBottom: 0, lift: 1, pauseTop: 0 };
const RAMP_REPS = [8, 5, 3];
const FINAL_TRANSITION_MIN = 30;

function groupsOf(exercises: PlannedExercise[], slots: Slot[]): Group[] {
  const slotById = new Map(slots.map(s => [s.id, s]));
  const groups: Group[] = [];
  const seen = new Set<string>();
  for (const ex of exercises) {
    if (seen.has(ex.slotId)) continue;
    const slot = slotById.get(ex.slotId);
    const key = slot?.pair ?? slot?.circuit;
    const members = key
      ? exercises.filter(e => { const s = slotById.get(e.slotId); return (s?.pair ?? s?.circuit) === key; })
      : [ex];
    members.forEach(m => seen.add(m.slotId));
    groups.push({
      kind: slot?.circuit ? 'circuit' : members.length > 1 ? 'pair' : 'single',
      items: members,
      spinal: members.some(m => slotById.get(m.slotId)?.spinal),
    });
  }
  return groups;
}

function setStep(ex: PlannedExercise, set: number, ramp: boolean, idPrefix: string, idx: number): SetStep {
  const meta = getStrength(ex.exerciseId);
  const rx = ex.rx;
  const unilateral = meta?.unilateral ?? false;
  const rampReps = RAMP_REPS[Math.min(set - 1, RAMP_REPS.length - 1)];
  return {
    kind: 'set',
    id: `${idPrefix}${idx}-${ex.exerciseId}-${ramp ? 'r' : 's'}${set}`,
    block: 'strength',
    title: getMeta(ex.exerciseId)?.name ?? ex.exerciseId,
    exerciseId: ex.exerciseId,
    set,
    of: ramp ? rx.rampSets : rx.sets,
    ramp,
    reps: ramp ? rampReps : rx.targetReps,
    tempo: ramp ? FAST_TEMPO : rx.tempo,
    sides: unilateral ? rx.sideOrder ?? ['left', 'right'] : null,
    ...(rx.holdSeconds && !ramp ? { holdSeconds: rx.holdSeconds } : {}),
    ...(rx.carrySeconds && !ramp ? { carrySeconds: rx.carrySeconds } : {}),
    load: rx.load,
    rir: rx.rir,
    ...(ex.pairId ? { pairId: ex.pairId } : {}),
    prepSeconds: 5,
  };
}

export function buildStrengthSteps(exercises: PlannedExercise[], opts: StrengthOptions): Step[] {
  const p = opts.idPrefix ?? 's';
  const steps: Step[] = [];
  let idx = 0;
  const rest = (seconds: number, title = 'Rest'): RestStep => ({ kind: 'rest', id: `${p}${idx++}-rest`, block: 'strength', title, seconds });
  const mainCap = opts.setupCap ?? 75;
  const setup = (ex: PlannedExercise, seconds?: number, cap = mainCap): Step => {
    const floor = Math.min(seconds ?? getStrength(ex.exerciseId)?.setupSeconds ?? 30, cap);
    return {
      kind: 'setup', id: `${p}${idx++}-setup-${ex.exerciseId}`, block: 'strength',
      title: getMeta(ex.exerciseId)?.name ?? ex.exerciseId, exerciseId: ex.exerciseId,
      seconds: opts.speech ? opts.speech.setupSeconds(ex.exerciseId, ex.rx, floor, cap) : floor,
    };
  };
  const ramps = (ex: PlannedExercise) => {
    for (let r = 1; r <= ex.rx.rampSets; r++) {
      steps.push(setStep(ex, r, true, p, idx++));
      steps.push(rest(45, 'Load up'));
    }
  };
  const checkpoint = (g: Group) => {
    if (opts.backProfile && g.spinal) {
      const ex = g.items.find(i => opts.slots.find(s => s.id === i.slotId)?.spinal) ?? g.items[0];
      steps.push({ kind: 'checkpoint', id: `${p}${idx++}-check-${ex.exerciseId}`, block: 'strength', title: 'How does your back feel?', question: 'backSymptoms', seconds: 15, exerciseId: ex.exerciseId });
    }
  };

  for (const g of groupsOf(exercises, opts.slots)) {
    if (g.kind === 'single') {
      const ex = g.items[0];
      steps.push(setup(ex));
      ramps(ex);
      for (let s = 1; s <= ex.rx.sets; s++) {
        steps.push(setStep(ex, s, false, p, idx++));
        if (s < ex.rx.sets) steps.push(rest(ex.rx.restSeconds));
      }
      checkpoint(g);
    } else if (g.kind === 'pair') {
      const [a, b] = g.items;
      const pairRest = Math.min(90, Math.max(60, Math.round(Math.min(a.rx.restSeconds, b.rx.restSeconds) * 0.6)));
      steps.push(setup(a));
      ramps(a);
      const n = Math.max(a.rx.sets, b.rx.sets);
      for (let s = 1; s <= n; s++) {
        const aSet = s <= a.rx.sets;
        if (aSet) steps.push(setStep(a, s, false, p, idx++));
        if (s <= b.rx.sets) {
          if (aSet) steps.push(rest(pairRest));
          if (s === 1) steps.push(setup(b, Math.min(30, getStrength(b.exerciseId)?.setupSeconds ?? 20), Math.min(45, mainCap)));
          steps.push(setStep(b, s, false, p, idx++));
        }
        if (s < n) steps.push(rest(pairRest));
      }
      checkpoint(g);
    } else {
      const rounds = Math.max(...g.items.map(i => i.rx.sets));
      steps.push(setup(g.items[0], 30, Math.min(45, mainCap)));
      for (let r = 1; r <= rounds; r++) {
        const inRound = g.items.filter(i => i.rx.sets >= r);
        inRound.forEach((ex, i) => {
          if (r === 1 && i > 0) steps.push(setup(ex, 15, Math.min(30, mainCap)));
          steps.push(setStep(ex, r, false, p, idx++));
          const lastInRound = i === inRound.length - 1;
          if (!lastInRound) steps.push(rest(30, 'Next station'));
          else if (r < rounds) steps.push(rest(Math.max(45, ex.rx.restSeconds), 'Rest, then next round'));
        });
      }
    }
  }
  return steps;
}

const isIsolation = (e: PlannedExercise) => e.role === 'isolation';
const isTrunk = (e: PlannedExercise) => e.role === 'trunk' || e.role === 'carry';

/** Accessory removal priority: duplicate-ish isolation first, then calves/arms, then delts. */
function dropPriority(e: PlannedExercise): number {
  const pats = getStrength(e.exerciseId)?.patterns ?? [];
  if (pats.includes('chestFly')) return 0;
  if (pats.includes('calf') || pats.includes('biceps') || pats.includes('triceps')) return 1;
  if (pats.includes('sideDelt') || pats.includes('rearDelt')) return 2;
  return 3;
}

export interface FitResult {
  exercises: PlannedExercise[];
  steps: Step[];
  warnings: string[];
  cuts: string[];
}

export function fitStrength(input: PlannedExercise[], baseOpts: StrengthOptions): FitResult {
  let exercises = input.map(e => ({ ...e, rx: { ...e.rx } }));
  const opts: StrengthOptions = { ...baseOpts, setupCap: baseOpts.setupCap ?? 75 };
  const cuts: string[] = [];
  const target = opts.budgetSeconds - FINAL_TRANSITION_MIN;
  const time = () => totalSeconds(buildStrengthSteps(exercises, opts));
  const update = (i: number, rx: Partial<Prescription>) => { exercises[i] = { ...exercises[i], rx: { ...exercises[i].rx, ...rx } }; };

  type Cut = () => boolean;
  const cutsInOrder: Cut[] = [
    () => { // shorter spoken setup (details move to captions); floor 45 s
      if ((opts.setupCap ?? 75) <= 45) return false;
      opts.setupCap = (opts.setupCap ?? 75) - 15;
      return true;
    },
    () => { // trim isolation and trunk rest to their floors
      let changed = false;
      exercises.forEach((e, i) => {
        if (isIsolation(e) && e.rx.restSeconds > 45) { update(i, { restSeconds: 45 }); changed = true; }
        if (isTrunk(e) && e.rx.restSeconds > 30) { update(i, { restSeconds: 30 }); changed = true; }
      });
      if (changed) cuts.push('Shorter rests on accessory exercises.');
      return changed;
    },
    () => { // third isolation set → 2
      const i = exercises.findIndex(e => isIsolation(e) && e.rx.sets > 2);
      if (i < 0) return false;
      update(i, { sets: 2 });
      return true;
    },
    () => { // drop the lowest-priority accessory
      const candidates = exercises
        .map((e, i) => ({ e, i }))
        .filter(({ e }) => isIsolation(e))
        .sort((a, b) => dropPriority(a.e) - dropPriority(b.e) || b.i - a.i);
      if (candidates.length === 0) return false;
      const { e, i } = candidates[0];
      cuts.push(`Skipped ${getMeta(e.exerciseId)?.name ?? e.exerciseId} to finish on time.`);
      const removedSlot = opts.slots.find(s => s.id === e.slotId);
      exercises = exercises.filter((_, j) => j !== i);
      // A pair that lost its partner becomes a single.
      if (removedSlot?.pair) {
        exercises = exercises.map(x => (x.pairId === removedSlot.pair ? { ...x, pairId: undefined } : x));
      }
      return true;
    },
    () => { // secondary compound −1 set (floor 2)
      const i = exercises.findIndex(e => e.role === 'secondary' && e.rx.sets > 2);
      if (i < 0) return false;
      update(i, { sets: exercises[i].rx.sets - 1 });
      return true;
    },
    () => { // shorten rests inside antagonist pairs (floor 60 s)
      const i = exercises.findIndex(e => e.pairId && e.role !== 'main' && e.rx.restSeconds > 60);
      if (i < 0) return false;
      update(i, { restSeconds: Math.max(60, exercises[i].rx.restSeconds - 15) });
      return true;
    },
    () => { // carries: one set fewer (floor 1)
      const i = exercises.findIndex(e => e.role === 'carry' && e.rx.sets > 1);
      if (i < 0) return false;
      update(i, { sets: exercises[i].rx.sets - 1 });
      return true;
    },
    () => { // non-back profiles may also trim trunk sets
      if (opts.backProfile) return false;
      const i = exercises.findIndex(e => isTrunk(e) && e.rx.sets > 1);
      if (i < 0) return false;
      update(i, { sets: exercises[i].rx.sets - 1 });
      return true;
    },
    () => { // non-spinal secondaries: down to one set as a last resort
      const i = exercises.findIndex(e => e.role === 'secondary' && e.rx.sets > 1
        && !opts.slots.find(sl => sl.id === e.slotId)?.spinal);
      if (i < 0) return false;
      update(i, { sets: exercises[i].rx.sets - 1 });
      return true;
    },
  ];

  for (const cut of cutsInOrder) {
    while (time() > target) {
      if (!cut()) break;
    }
  }

  // Comfortably under budget: put back accessory sets a cut above took too
  // many of, never more than `prescribe` asked for (spec §5.2 step 7 authorises
  // a cut order only). Main lifts and spinal slots never grow: on a deload week
  // prescribe halves their sets (§4.3) and growing them back would undo it.
  // Spare time flows into the longer transition that closes the block.
  const prescribed = new Map(input.map(e => [e.slotId, e.rx.sets]));
  const canGrow = (e: PlannedExercise) =>
    e.role !== 'main'
    && !opts.slots.find(s => s.id === e.slotId)?.spinal
    && e.rx.sets < (prescribed.get(e.slotId) ?? e.rx.sets);
  while (time() < target - 150) {
    const i = exercises.findIndex(canGrow);
    if (i < 0) break;
    const before = exercises[i].rx.sets;
    update(i, { sets: before + 1 });
    if (time() > target) { // undo an overshoot
      update(i, { sets: before });
      break;
    }
  }

  const steps = buildStrengthSteps(exercises, opts);
  const used = totalSeconds(steps);
  const warnings: string[] = [];
  if (used > target) warnings.push(`Strength block runs about ${Math.round((used - target) / 60)} min over.`);
  steps.push({
    kind: 'talk', id: `${opts.idPrefix ?? 's'}to-cardio`, block: 'strength', title: 'Strength complete',
    topic: 'transition', seconds: Math.max(FINAL_TRANSITION_MIN, opts.budgetSeconds - used),
  });
  void opts.nextTitle;
  return { exercises, steps, warnings, cuts };
}
