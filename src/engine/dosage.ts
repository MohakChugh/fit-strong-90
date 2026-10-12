/**
 * Sets, reps, effort, rest and tempo by phase and slot role (spec §4.3,
 * program-design.md §3), then adjusted by safety caps and today's readiness.
 */

import type { Phase } from '@/types';
import type { Modifier } from '@/types/checkin';
import type { ExerciseMeta } from '@/types/catalog';
import type { LoadSuggestion, PlanMode, Prescription, Side, SlotRole, Tempo } from '@/types/plan';
import type { UserProfile } from '@/types/profile';
import type { Caps } from './safety';

export function phaseFor(week: number): Phase {
  if (week <= 4) return 'foundation';
  if (week <= 8) return 'hypertrophy';
  return 'strength';
}

export function modeFor(week: number): PlanMode {
  if (week === 4 || week === 8) return 'deload';
  if (week === 12) return 'taper';
  return 'normal';
}

interface Base {
  sets: number;
  reps: [number, number];
  rir: number;
  rest: number;
  tempo: Tempo;
  ramp: number;
}

const T = (lower: number, pauseBottom: number, lift: number, pauseTop: number): Tempo => ({ lower, pauseBottom, lift, pauseTop });

const PHASE_TABLE: Record<Phase, Record<SlotRole, Base>> = {
  foundation: {
    main: { sets: 3, reps: [8, 10], rir: 3, rest: 120, tempo: T(3, 0, 1, 0), ramp: 2 },
    secondary: { sets: 2, reps: [10, 12], rir: 3, rest: 90, tempo: T(3, 0, 1, 0), ramp: 0 },
    isolation: { sets: 2, reps: [12, 15], rir: 2, rest: 60, tempo: T(2, 0, 1, 0), ramp: 0 },
    trunk: { sets: 2, reps: [6, 8], rir: 3, rest: 45, tempo: T(2, 0, 2, 1), ramp: 0 },
    carry: { sets: 2, reps: [1, 1], rir: 3, rest: 60, tempo: T(0, 0, 0, 0), ramp: 0 },
  },
  hypertrophy: {
    main: { sets: 3, reps: [6, 10], rir: 2, rest: 135, tempo: T(2, 0, 1, 0), ramp: 2 },
    secondary: { sets: 3, reps: [8, 12], rir: 2, rest: 90, tempo: T(2, 0, 1, 0), ramp: 0 },
    isolation: { sets: 2, reps: [10, 15], rir: 1, rest: 60, tempo: T(2, 0, 1, 0), ramp: 0 },
    trunk: { sets: 3, reps: [6, 8], rir: 3, rest: 45, tempo: T(2, 0, 2, 1), ramp: 0 },
    carry: { sets: 2, reps: [1, 1], rir: 3, rest: 60, tempo: T(0, 0, 0, 0), ramp: 0 },
  },
  strength: {
    main: { sets: 4, reps: [4, 6], rir: 2, rest: 165, tempo: T(2, 0, 1, 0), ramp: 3 },
    secondary: { sets: 3, reps: [6, 10], rir: 2, rest: 105, tempo: T(2, 0, 1, 0), ramp: 0 },
    isolation: { sets: 2, reps: [10, 12], rir: 1, rest: 60, tempo: T(2, 0, 1, 0), ramp: 0 },
    trunk: { sets: 3, reps: [6, 8], rir: 3, rest: 45, tempo: T(2, 0, 2, 1), ramp: 0 },
    carry: { sets: 3, reps: [1, 1], rir: 3, rest: 75, tempo: T(0, 0, 0, 0), ramp: 0 },
  },
};

/** Trunk and carry exercises are dosed by holds or walking time, not reps. */
const SPECIAL: Record<string, Partial<Prescription> & { tempo?: Tempo }> = {
  'side-plank': { holdSeconds: 20 },
  plank: { holdSeconds: 25 },
  'mcgill-curl-up': { reps: [5, 6], targetReps: 5, tempo: T(1, 0, 1, 10) },
  'bird-dog': { reps: [6, 6], targetReps: 6, tempo: T(2, 0, 2, 5) },
  'dead-bug': { reps: [6, 8], targetReps: 6, tempo: T(2, 0, 2, 1) },
  'pallof-press': { reps: [8, 10], targetReps: 10, tempo: T(2, 0, 2, 2) },
  'cable-chop': { reps: [8, 10], targetReps: 10, tempo: T(2, 0, 1, 0) },
  'suitcase-carry': { carrySeconds: 30 },
  'farmer-carry': { carrySeconds: 40 },
  'back-extension-45': { reps: [10, 12], targetReps: 10, tempo: T(2, 0, 2, 1) },
  'glute-bridge': { reps: [10, 12], targetReps: 10, tempo: T(2, 0, 1, 2) },
};

/**
 * Exercises the planner doses in seconds — holds and carries. A logged set's
 * count for these is seconds, so it is never repetitions to multiply by load:
 * a 30-second carry with 20 kg is not 600 kg lifted (Codex review F21).
 */
export function dosedInSeconds(exerciseId: string): boolean {
  const special = SPECIAL[exerciseId];
  return !!special && (special.holdSeconds !== undefined || special.carrySeconds !== undefined);
}

const SPINAL = (m: ExerciseMeta) => m.flags.axialLoad === 2 || m.flags.lumbarMoment === 2 || !!m.ladder;
const LOADABLE = (m: ExerciseMeta) =>
  m.equipment.some(e => ['barbell', 'trapBar', 'dumbbells', 'kettlebell', 'cable', 'machine', 'landmine'].includes(e));

export interface DoseContext {
  phase: Phase;
  mode: PlanMode;
  profile: UserProfile;
  modifiers: Modifier[];
  /** Back light amber today: no progression, one more rep in reserve on spinal lifts. */
  backAmber: boolean;
  caps: Caps;
  load: LoadSuggestion;
}

export function prescribe(meta: ExerciseMeta, role: SlotRole, ctx: DoseContext): Prescription {
  const base = PHASE_TABLE[ctx.phase][role];
  const special = SPECIAL[meta.id] ?? {};
  let sets = base.sets;
  let reps: [number, number] = special.reps ?? [...base.reps];
  let rir = base.rir;
  let restSeconds = base.rest;
  const tempo = special.tempo ?? base.tempo;
  let rampSets = !LOADABLE(meta) ? 0 : role === 'main' && SPINAL(meta) ? base.ramp : role === 'main' ? Math.min(base.ramp, 1) : 0;
  let holdSeconds = special.holdSeconds;
  const carrySeconds = special.carrySeconds;
  const capNotes = [...ctx.caps.notes];

  // Spinal lifts below the top ladder level stay at 5+ reps in the strength phase.
  if (ctx.phase === 'strength' && role === 'main' && SPINAL(meta) && (meta.ladder?.level ?? 0) < 4) {
    reps = [5, 8];
  }

  // Experience.
  if (ctx.profile.experience === 'beginner') {
    sets = Math.max(1, Math.round(sets * 0.8));
    rir += 1;
  } else if (ctx.profile.experience === 'advanced' && ctx.phase === 'hypertrophy' && role === 'main') {
    sets += 1;
  }

  // Mesocycle.
  if (ctx.mode === 'deload') {
    sets = Math.ceil(sets / 2);
    rir += 2;
    rampSets = Math.min(rampSets, 1);
  } else if (ctx.mode === 'taper') {
    sets = Math.max(2, Math.round(sets * 0.6));
  }

  // Today.
  if (ctx.modifiers.includes('MINUS_SET')) sets = Math.max(1, sets - 1);
  if (ctx.backAmber && SPINAL(meta)) rir += 1;

  // Safety caps.
  if (ctx.caps.minRir !== undefined) rir = Math.max(rir, ctx.caps.minRir);
  const repCapsApply = LOADABLE(meta) && role !== 'trunk' && role !== 'carry';
  if (repCapsApply && ctx.caps.minReps !== undefined && reps[0] < ctx.caps.minReps) {
    const width = reps[1] - reps[0];
    reps = [ctx.caps.minReps, ctx.caps.minReps + Math.max(2, width)];
  }
  if (ctx.caps.maxHoldSeconds !== undefined && holdSeconds !== undefined) {
    holdSeconds = Math.min(holdSeconds, ctx.caps.maxHoldSeconds);
  }
  if (ctx.modifiers.includes('LOAD') || ctx.caps.exhale) {
    capNotes.push('Breathe out as you push. Never hold your breath.');
    restSeconds = Math.max(restSeconds, role === 'main' ? 120 : 75);
  }
  if (rir >= 3 && !capNotes.some(n => n.includes('reps left'))) {
    capNotes.push(`Stop with at least ${rir} reps left in the tank.`);
  }

  const sideOrder = meta.unilateral ? affectedFirst(ctx.profile) : undefined;

  return {
    sets,
    reps,
    targetReps: reps[0] === reps[1] ? reps[0] : Math.round((reps[0] + reps[1]) / 2),
    rir,
    restSeconds,
    tempo,
    rampSets,
    ...(holdSeconds !== undefined ? { holdSeconds } : {}),
    ...(carrySeconds !== undefined ? { carrySeconds } : {}),
    load: ctx.load,
    ...(sideOrder ? { sideOrder } : {}),
    caps: capNotes,
  };
}

/** Unilateral work starts on the affected side (sciatica), then matches it. */
export function affectedFirst(profile: Pick<UserProfile, 'pain'>): Side[] {
  return profile.pain.sciaticaSide === 'right' ? ['right', 'left'] : ['left', 'right'];
}
