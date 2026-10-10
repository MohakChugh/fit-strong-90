/**
 * The Stretch screen's preview: each movement with its time, what to have to
 * hand, and the one line about today that matters most.
 */

import type { EquipmentTag } from '@/types/catalog';
import type { SessionPlan, Step } from '@/types/plan';
import type { Permission } from '@/engine/permission';
import { getMeta, nameOf } from '@/data/catalog';
import { stepSeconds } from '@/engine/timing';

export interface PreviewRow {
  id: string;
  name: string;
  /** "20 s each side", "12 reps each side", "6 slow breaths". */
  dose: string;
  seconds: number;
}

type Movement = Extract<Step, { kind: 'hold' | 'drill' }>;

function doseOf(s: Movement): string {
  const each = s.sides ? ' each side' : '';
  if (s.kind === 'hold') return `${s.sets > 1 ? `${s.sets} × ` : ''}${s.holdSeconds} s${each}`;
  return s.breathing ? `${s.reps} slow breaths` : `${s.reps} reps${each}`;
}

export function previewRows(plan: SessionPlan): PreviewRow[] {
  return plan.steps
    .filter((s): s is Movement => s.kind === 'hold' || s.kind === 'drill')
    .map(s => ({ id: s.id, name: nameOf(s.exerciseId), dose: doseOf(s), seconds: stepSeconds(s) }));
}

/** Seconds of the plan that are the coach talking: the welcome, the close and the wrap-up. */
export function talkSeconds(plan: SessionPlan): number {
  return plan.steps.filter(s => s.kind === 'talk').reduce((t, s) => t + stepSeconds(s), 0);
}

/** "1:05": minutes and seconds, as a duration column reads. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const KIT: Partial<Record<EquipmentTag, string>> = {
  mat: 'a mat',
  wall: 'a wall',
  chair: 'a chair',
  strap: 'a strap or towel',
  dowel: 'a broom handle',
  box: 'a sturdy step',
};

/** "You need a mat, a wall and a strap or towel." Null when nothing is needed. */
export function kitLine(plan: SessionPlan): string | null {
  const need = new Set<EquipmentTag>();
  for (const s of plan.steps) if ('exerciseId' in s && s.exerciseId) for (const e of getMeta(s.exerciseId)?.equipment ?? []) need.add(e);
  const items = (Object.keys(KIT) as EquipmentTag[]).filter(e => need.has(e)).map(e => KIT[e]!);
  if (items.length === 0) return null;
  const list = items.length === 1 ? items[0] : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
  return `You need ${list}.`;
}

/**
 * The one line about today: why there is no routine, what stands in the way
 * of starting, or the first thing the plan changed. A refusal the check-in
 * will explain is left to the check-in.
 */
export function todayLine(plan: SessionPlan, p: Permission): string | null {
  if (plan.kind === 'none') return plan.changes[0] ?? p.reasons[0] ?? null;
  if (!p.allowed && !p.needsCheckIn) return p.reasons[0] ?? null;
  return plan.changes[0] ?? null;
}
