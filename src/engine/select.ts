/**
 * Fill a plan slot with the best exercise the user can safely do today
 * (spec §5.2 step 3). Never returns an empty slot.
 */

import type { EquipmentTag, Pattern } from '@/types/catalog';
import type { SlotRole } from '@/types/plan';
import { getMeta, getStrength, hasEquipment } from '@/data/catalog';
import { evaluateFlags, type Caps, type Conditions } from './safety';
import type { Slot } from './templates';

export interface SelectContext {
  conditions: Conditions;
  equipment: EquipmentTag[];
  dislikes: string[];
  /** Ids already used today (no duplicates in one session). */
  used: Set<string>;
}

export interface Selection {
  exerciseId: string;
  caps: Caps;
  /** The top candidate this replaced, when it was ruled out. */
  swappedFrom?: string;
  reason?: string;
}

/**
 * Minimal-equipment fallbacks by movement pattern: each one trains the same
 * muscles as the slot it stands in for. Elbow flexion and extension need a
 * pulling or pressing drill — a prone Y-T raise is neither, so it only covers
 * the shoulder-blade patterns.
 */
const FALLBACK_BY_PATTERN: Partial<Record<Pattern, string[]>> = {
  hinge: ['glute-bridge', 'dowel-hinge', 'bird-dog'],
  backExtension: ['bird-dog', 'glute-bridge'],
  squat: ['box-squat', 'split-squat', 'glute-bridge'],
  lunge: ['split-squat', 'reverse-lunge', 'box-squat'],
  hPush: ['push-ups', 'incline-push-up'],
  vPush: ['incline-push-up', 'push-ups'],
  chestFly: ['push-ups', 'incline-push-up'],
  hPull: ['band-row', 'prone-y-t'],
  vPull: ['scapular-pull-up', 'band-row', 'prone-y-t'],
  rearDelt: ['band-pull-apart', 'prone-y-t'],
  sideDelt: ['band-pull-apart', 'prone-y-t'],
  biceps: ['band-row', 'scapular-pull-up'],
  triceps: ['incline-push-up', 'push-ups'],
  kneeFlexion: ['glute-bridge', 'dead-bug'],
  calf: ['single-leg-calf-raise', 'knee-to-wall-rock'],
  antiExtension: ['dead-bug', 'mcgill-curl-up', 'bird-dog'],
  antiRotation: ['bird-dog', 'dead-bug'],
  antiLateral: ['side-plank', 'bird-dog'],
  rotation: ['bird-dog', 'dead-bug'],
  carry: ['side-plank', 'bird-dog'],
};

/** Last-resort fallbacks by role. */
const FALLBACK: Record<SlotRole, string[]> = {
  main: ['glute-bridge', 'box-squat', 'incline-push-up', 'prone-y-t'],
  secondary: ['glute-bridge', 'box-squat', 'incline-push-up', 'prone-y-t'],
  isolation: ['prone-y-t', 'incline-push-up', 'glute-bridge'],
  trunk: ['dead-bug', 'bird-dog', 'mcgill-curl-up'],
  carry: ['side-plank', 'bird-dog', 'dead-bug'],
};

/** Every fallback drill, for the sweep that keeps one session repeat-free. */
const EVERY_FALLBACK = [...new Set([
  ...Object.values(FALLBACK_BY_PATTERN).flat(),
  ...Object.values(FALLBACK).flat(),
])];

function check(id: string, ctx: SelectContext, allowUsed = false): { ok: true; caps: Caps } | { ok: false; reason: string } {
  const meta = getMeta(id);
  if (!meta) return { ok: false, reason: 'not in catalogue' };
  if ('retired' in meta && meta.retired) return { ok: false, reason: 'retired' };
  if (ctx.dislikes.includes(id)) return { ok: false, reason: 'you swapped it out before' };
  if (!allowUsed && ctx.used.has(id)) return { ok: false, reason: 'already in today’s plan' };
  if (!hasEquipment(meta, ctx.equipment)) return { ok: false, reason: 'equipment not available' };
  if (meta.kind === 'mobility' && meta.status === 'excluded') return { ok: false, reason: 'excluded' };

  const verdict = evaluateFlags(meta.flags, ctx.conditions);
  if (verdict.excluded) return { ok: false, reason: verdict.reason ?? 'not safe today' };
  if (verdict.needsNeuralGate) return { ok: false, reason: 'unlocks once your sciatic nerve passes the gate check' };

  const ladder = meta.kind !== 'mobility' ? meta.ladder : undefined;
  if (ladder && ctx.conditions.ladder[ladder.track] < ladder.level) {
    return { ok: false, reason: `unlocks at ${ladder.track} level ${ladder.level}` };
  }
  return { ok: true, caps: verdict.caps };
}

export function selectForSlot(slot: Slot, ctx: SelectContext): Selection {
  let firstReason: string | undefined;
  for (const [i, id] of slot.candidates.entries()) {
    const r = check(id, ctx);
    if (r.ok) {
      return {
        exerciseId: id,
        caps: r.caps,
        ...(i > 0 ? { swappedFrom: slot.candidates[0], reason: firstReason } : {}),
      };
    }
    if (i === 0) firstReason = r.reason;
  }

  // Follow the regression chain of the last candidate, then generic fallbacks,
  // then every other fallback drill: filling two slots with the same exercise
  // is a worse session than standing in with a drill from another pattern.
  const chain: string[] = [];
  let next = getStrength(slot.candidates[slot.candidates.length - 1])?.regressionId;
  while (next && !chain.includes(next)) {
    chain.push(next);
    next = getStrength(next)?.regressionId;
  }
  const patterns = getStrength(slot.candidates[0])?.patterns ?? [];
  const byPattern = patterns.flatMap(pt => FALLBACK_BY_PATTERN[pt] ?? []);
  const swapped = { swappedFrom: slot.candidates[0], reason: firstReason };
  for (const id of [...chain, ...byPattern, ...FALLBACK[slot.role], ...EVERY_FALLBACK]) {
    const r = check(id, ctx);
    if (r.ok) return { exerciseId: id, caps: r.caps, ...swapped };
  }

  // Nothing new is safe today: repeating a safe drill still beats an unsafe one.
  for (const id of [...slot.candidates, ...chain, ...byPattern, ...FALLBACK[slot.role]]) {
    const r = check(id, ctx, true);
    if (r.ok) return { exerciseId: id, caps: r.caps, ...swapped };
  }

  // Last resort: the safest bodyweight drill for the role, keeping whatever caps
  // its flags earn so it is at least dosed conservatively.
  const last = FALLBACK[slot.role][0];
  const meta = getMeta(last);
  return {
    exerciseId: last,
    caps: meta ? evaluateFlags(meta.flags, ctx.conditions).caps : { notes: [] },
    ...swapped,
  };
}
