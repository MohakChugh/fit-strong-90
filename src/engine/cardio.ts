/**
 * The 12-minute cardio block (spec §4.4; program-design.md §4).
 */

import type { Readiness } from '@/types/checkin';
import type { CardioModality, EquipmentTag } from '@/types/catalog';
import type { CardioPlan, CardioStep, DayFocus, PlanMode, Step } from '@/types/plan';
import type { UserProfile } from '@/types/profile';
import { getCardio, hasEquipment } from '@/data/catalog';
import { isUpperFocus } from './templates';
import { deriveHealth } from './health';
import { fluidLimit } from './readiness';
import type { Conditions } from './safety';

export interface CardioContext {
  focus: DayFocus;
  profile: UserProfile;
  readiness: Readiness;
  conditions: Conditions;
  equipment: EquipmentTag[];
  week: number;
  mode: PlanMode;
  budgetSeconds: number;
  idPrefix?: string;
}

/** Day-to-day modality rotation; the first available, safe option wins. */
const ROTATION: Partial<Record<DayFocus, CardioModality[]>> = {
  lowerA: ['treadmill-walk', 'elliptical', 'recumbent-bike', 'brisk-walking'],
  upperA: ['recumbent-bike', 'elliptical', 'treadmill-walk', 'brisk-walking'],
  lowerB: ['elliptical', 'treadmill-walk', 'recumbent-bike', 'brisk-walking'],
  upperB: ['recumbent-bike', 'stationary-bike', 'elliptical', 'brisk-walking'],
  lowerC: ['treadmill-walk', 'elliptical', 'recumbent-bike', 'brisk-walking'],
  upperC: ['elliptical', 'recumbent-bike', 'treadmill-walk', 'brisk-walking'],
};
const DEFAULT_ROTATION: CardioModality[] = ['treadmill-walk', 'recumbent-bike', 'elliptical', 'brisk-walking'];

export function pickModality(ctx: CardioContext): CardioModality | null {
  const c = ctx.conditions;
  let order = [...(ROTATION[ctx.focus] ?? DEFAULT_ROTATION)];
  if (c.neuropathy || c.foot) order = ['recumbent-bike', 'stationary-bike', ...order];
  if (c.sciaticaActive && c.worseWith === 'flexion') order = order.filter(m => m !== 'stationary-bike');
  for (const id of order) {
    const meta = getCardio(id);
    if (!meta || !hasEquipment(meta, ctx.equipment)) continue;
    if (c.foot && meta.flags.weightBearing) continue;
    if (meta.ladder && c.ladder[meta.ladder.track] < meta.ladder.level) continue;
    return id;
  }
  // No machine to hand and no weight-bearing allowed: there is no cardio to do,
  // so say so rather than prescribe a bike that isn't there. Standing is
  // otherwise always possible, so an easy walk is the last resort.
  return c.foot ? null : 'brisk-walking';
}

/** Interval days: one per week in Foundation (Upper B), two later (Upper B and Upper C). */
function intervalDay(focus: DayFocus, week: number): boolean {
  if (!isUpperFocus(focus)) return false;
  if (week <= 4) return focus === 'upperB' || focus === 'pull';
  return ['upperB', 'upperC', 'pull', 'push'].includes(focus);
}

export function intervalsAllowed(ctx: CardioContext): { ok: boolean; reason?: string } {
  const r = ctx.readiness;
  const h = ctx.profile.health;
  const d = deriveHealth(h);
  if (ctx.mode === 'deload') return { ok: false, reason: 'deload week: steady cardio only' };
  if (r.vigorousLocked) return { ok: false, reason: 'intervals unlock once a clinician clears you for vigorous exercise' };
  if (r.modifiers.includes('INT')) return { ok: false, reason: 'moderate effort only today' };
  if (r.modifiers.includes('HYPO')) return { ok: false, reason: 'steady cardio keeps glucose more predictable today' };
  if (r.modifiers.includes('HEAT')) return { ok: false, reason: 'hot conditions' };
  if (r.capHeavy) return { ok: false, reason: 'blood pressure is raised today' };
  if (h.retinopathy === 'severe_or_proliferative') return { ok: false, reason: 'eye disease' };
  if (d.hypoRisk && h.glucoseMonitor === 'none') return { ok: false, reason: 'intervals need glucose monitoring when you use insulin' };
  if (r.back === 'amber' || r.back === 'red' || r.nerveFlag) return { ok: false, reason: 'symptoms today' };
  return { ok: true };
}

export function cardioPlan(ctx: CardioContext): CardioPlan | null {
  const modality = pickModality(ctx);
  if (!modality) return null;
  const wantIntervals = intervalDay(ctx.focus, ctx.week) && getCardio(modality)?.intervals;
  const format: CardioPlan['format'] = wantIntervals && intervalsAllowed(ctx).ok ? 'intervals' : 'zone2';
  const seconds = ctx.readiness.modifiers.includes('HEAT') ? Math.min(ctx.budgetSeconds, 480) : ctx.budgetSeconds;
  return { modality, format, seconds };
}

/**
 * A hot day's spare minutes, with only the drinking advice this profile may
 * be given, as the rest line says it (contract H-DIZZY; Codex re-audit F13).
 */
export const HOT_COOL_DOWN: Record<ReturnType<typeof fluidLimit>, string> = {
  limited: 'Easy cool-down, cool off and keep to your fluid plan',
  free: 'Easy cool-down, cool off and drink',
  unknown: 'Easy cool-down, cool off and drink unless you have a fluid limit',
};

export function cardioBlock(ctx: CardioContext): Step[] {
  const plan = cardioPlan(ctx);
  if (!plan) return [];
  const cool = ctx.readiness.modifiers.includes('COOL');
  const total = plan.seconds;
  const parts: CardioStep['parts'] = [];
  const easyEnd = cool ? 300 : 60;

  if (plan.format === 'intervals') {
    parts.push({ seconds: 120, intensity: 'easy', label: 'Easy warm-up' });
    const rounds = Math.max(3, Math.floor((total - 120 - easyEnd) / 90));
    for (let i = 1; i <= rounds; i++) {
      parts.push({ seconds: 30, intensity: 'fast', label: `Fast ${i} of ${rounds}` });
      parts.push({ seconds: 60, intensity: 'easy', label: `Recover ${i} of ${rounds}` });
    }
    const used = parts.reduce((s, p) => s + p.seconds, 0);
    parts.push({ seconds: total - used, intensity: 'cooldown', label: 'Cool-down' });
  } else {
    const warm = Math.min(120, Math.round(total / 6));
    parts.push({ seconds: warm, intensity: 'easy', label: 'Easy warm-up' });
    parts.push({ seconds: total - warm - easyEnd, intensity: 'zone2', label: 'Steady, conversational pace' });
    parts.push({ seconds: easyEnd, intensity: 'cooldown', label: 'Cool-down' });
  }

  // On a hot day cardio is capped, so the time it gives back becomes an easy
  // cool-down rather than vanishing: the session still ends when promised.
  const spare = ctx.budgetSeconds - total;
  if (spare >= 30) parts.push({ seconds: spare, intensity: 'cooldown', label: HOT_COOL_DOWN[fluidLimit(ctx.profile.health)] });

  const name = getCardio(plan.modality)?.name ?? plan.modality;
  return [{ kind: 'cardio', id: `${ctx.idPrefix ?? 'c'}cardio`, block: 'cardio', title: name, exerciseId: plan.modality, parts }];
}
