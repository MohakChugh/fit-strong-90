/**
 * Assemble the day's SessionPlan (spec §5): readiness → focus → mobility →
 * strength → cardio → wrap-up, with recovery, rest-day, red and urgent
 * variants. Pure and deterministic: same inputs, same plan.
 */

import type { WorkoutSession } from '@/types';
import type { DailyCheckIn, Readiness } from '@/types/checkin';
import type { Block, DayFocus, PlannedExercise, SessionPlan, Step } from '@/types/plan';
import type { UserProfile } from '@/types/profile';
import { getDayOfWeekFromDate, getWeekNumber, parseDateString, toDateString } from '@/lib/utils';
import type { ExerciseMeta } from '@/types/catalog';
import { EQUIPMENT_BY_ACCESS, getMeta, getMobility, getStrength } from '@/data/catalog';
import { evaluateCheckIn, profileOnlyReadiness } from './readiness';
import { activeConditions } from './safety';
import { selectForSlot } from './select';
import { focusLabel, mobilityDayType, slotsFor, weekFocus } from './templates';
import { modeFor, phaseFor, prescribe } from './dosage';
import { suggestLoad } from './progression';
import { coverageFromSessions, mobilityBlock } from './mobility';
import { cardioBlock, cardioPlan, intervalsAllowed } from './cardio';
import { fitStrength } from './strengthBlock';
import { stepSeconds } from './timing';
import { deriveHealth } from './health';
import { createSpeechSizer } from './speech';

export interface PlanInput {
  profile: UserProfile;
  /** YYYY-MM-DD */
  date: string;
  /** Program start date (settings.startDate). */
  startDate: string;
  sessions: WorkoutSession[];
  /** Earlier check-ins (for two-days-running rules). */
  recentCheckIns?: DailyCheckIn[];
  checkIn?: DailyCheckIn;
  /** Override the scheduled focus (e.g. the user swaps days). */
  focusOverride?: DayFocus;
}

export const BUDGETS: Record<UserProfile['sessionMinutes'], { mobility: number; strength: number; cardio: number; wrapUp: number }> = {
  45: { mobility: 600, strength: 1440, cardio: 600, wrapUp: 60 },
  60: { mobility: 900, strength: 1920, cardio: 720, wrapUp: 60 },
  75: { mobility: 900, strength: 2700, cardio: 840, wrapUp: 60 },
};

function mondayOf(date: string): string {
  const d = parseDateString(date);
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return toDateString(d);
}

function blockStartsOf(steps: Step[]): Partial<Record<Block, number>> {
  const starts: Partial<Record<Block, number>> = {};
  let t = 0;
  for (const s of steps) {
    if (starts[s.block] === undefined) starts[s.block] = t;
    t += stepSeconds(s);
  }
  return starts;
}

/** Strength metadata for a slot filled by a bodyweight mobility drill (home fallbacks). */
function strengthMetaFor(id: string): ExerciseMeta | undefined {
  const s = getStrength(id);
  if (s) return s;
  const m = getMobility(id);
  if (!m) return undefined;
  return {
    id: m.id, name: m.name, kind: 'strength', category: 'mobility', patterns: [], equipment: m.equipment,
    level: 'beginner', unilateral: m.dose.sides !== 'none', supersetEligible: true, setupSeconds: 15, flags: m.flags,
  };
}

function wrapUp(seconds: number): Step {
  return { kind: 'talk', id: 'wrap-up', block: 'wrapUp', title: 'Session complete', topic: 'wrapUp', seconds };
}

function planId(date: string, focus: DayFocus, kind: string, r: Readiness): string {
  return `${date}:${focus}:${kind}:${r.outcome}:${[...r.modifiers].sort().join('')}`;
}

/**
 * A mobility block standing in for cardio: its opening introduces the flow
 * instead of welcoming the user a second time, and its end closes the flow.
 */
function seatedFlow(steps: Step[]): Step[] {
  return steps.map(s => (s.kind !== 'talk' ? s
    : s.topic === 'welcome' ? { ...s, block: 'mobility' as const, title: 'Seated and floor flow', topic: 'blockIntro' as const }
      : s.topic === 'transition' ? { ...s, title: 'Flow complete' } : s));
}

export function buildSessionPlan(input: PlanInput): SessionPlan {
  const { profile, date } = input;
  const readiness = input.checkIn
    ? evaluateCheckIn(profile, input.checkIn, input.recentCheckIns ?? [])
    : profileOnlyReadiness(profile);
  const week = getWeekNumber(input.startDate, date);
  const phase = phaseFor(week);
  const mode = modeFor(week);
  const focus = input.focusOverride ?? weekFocus(profile)[getDayOfWeekFromDate(date)];
  const conditions = activeConditions(profile, readiness);
  const equipment = EQUIPMENT_BY_ACCESS[profile.equipment];
  const budget = BUDGETS[profile.sessionMinutes];
  const coverage = coverageFromSessions(input.sessions, mondayOf(date), date);
  const speech = createSpeechSizer(profile, input.sessions);
  const changes: string[] = [];
  const warnings: string[] = [];

  const base = {
    date, week, phase, mode, focus, label: focusLabel(focus), mobilityDayType: mobilityDayType(focus), readiness,
  };

  for (const r of readiness.reasons) if (r.outcome !== 'green') changes.push(r.message);

  if (readiness.outcome === 'urgent' || readiness.outcome === 'red') {
    return {
      ...base, id: planId(date, focus, 'none', readiness), kind: 'none', steps: [], exercises: [], cardio: null,
      blockStarts: {}, totalSeconds: 0, changes, warnings,
    };
  }

  if (readiness.outcome === 'recovery' || focus === 'activeRecovery' || focus === 'rest') {
    if (focus === 'rest' && readiness.outcome !== 'recovery' && !profile.restDayMobility) {
      return {
        ...base, id: planId(date, focus, 'none', readiness), kind: 'none', steps: [], exercises: [], cardio: null,
        blockStarts: {}, totalSeconds: 0, changes: [...changes, 'Rest day: walk after meals if you can.'], warnings,
      };
    }
    const kind = focus === 'rest' ? 'restDay' : 'recovery';
    const mobility = mobilityBlock({
      dayType: 'core', profile, readiness, conditions, equipment, week, budgetSeconds: 900, coverage, idPrefix: 'm', speech,
    });
    const cardio = cardioBlock({
      focus, profile, readiness: { ...readiness, modifiers: [...readiness.modifiers, 'INT'] }, conditions, equipment, week,
      mode: 'deload', budgetSeconds: kind === 'restDay' ? 900 : 600, idPrefix: 'c',
    });
    const steps = [...mobility, ...cardio, wrapUp(60)];
    if (kind === 'recovery') changes.push(cardio.length
      ? 'Recovery session: gentle mobility, nerve glides and an easy walk. No lifting today.'
      : 'Recovery session: gentle mobility and nerve glides. No lifting today, and no walking with a foot problem.');
    return {
      ...base, id: planId(date, focus, kind, readiness), kind, steps, exercises: [],
      cardio: cardio.length ? { modality: (cardio[0] as Extract<Step, { kind: 'cardio' }>).exerciseId, format: 'easy', seconds: stepSeconds(cardio[0]) } : null,
      blockStarts: blockStartsOf(steps), totalSeconds: steps.reduce((s, x) => s + stepSeconds(x), 0), changes, warnings,
    };
  }

  // ─── Full session ──────────────────────────────────────────────────────────
  const map = weekFocus(profile);
  const order = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
  const upcoming = order
    .slice(order.indexOf(getDayOfWeekFromDate(date)) + 1)
    .map(d => map[d])
    .filter(f => f !== 'rest')
    .map(mobilityDayType);
  const mobility = mobilityBlock({
    dayType: base.mobilityDayType, profile, readiness, conditions, equipment, week,
    budgetSeconds: budget.mobility, coverage, upcoming, idPrefix: 'm', speech,
  });

  const slots = slotsFor(focus);
  const used = new Set<string>();
  const backProfile = profile.pain.areas.includes('lowerBack') || profile.pain.areas.includes('sciatica');
  const hyper = conditions.hypertension;
  const planned: PlannedExercise[] = [];
  for (const slot of slots) {
    const sel = selectForSlot(slot, { conditions, equipment, dislikes: profile.dislikes, used });
    used.add(sel.exerciseId);
    const meta = strengthMetaFor(sel.exerciseId);
    if (!meta) continue;
    const load = suggestLoad(sel.exerciseId, { reps: [8, 12] }, input.sessions, { cautious: hyper });
    const rx = prescribe(meta, slot.role, {
      phase, mode, profile, modifiers: readiness.modifiers, backAmber: readiness.back === 'amber', caps: sel.caps, load,
    });
    rx.load = suggestLoad(sel.exerciseId, rx, input.sessions, { cautious: hyper });
    planned.push({
      exerciseId: sel.exerciseId, slotId: slot.id, role: slot.role, rx,
      ...(slot.pair ?? slot.circuit ? { pairId: slot.pair ?? slot.circuit } : {}),
      ...(sel.swappedFrom ? { swappedFrom: sel.swappedFrom, reason: sel.reason } : {}),
    });
    if (sel.swappedFrom && sel.reason) {
      changes.push(`${getMeta(sel.exerciseId)?.name} instead of ${getMeta(sel.swappedFrom)?.name}: ${sel.reason}.`);
    }
  }

  const d = deriveHealth(profile.health);
  const cardioCtx = { focus, profile, readiness, conditions, equipment, week, mode, idPrefix: 'c' };
  const glucoseCheck = d.hypoRisk;
  const cardioBudget = budget.cardio - (glucoseCheck ? 30 : 0);
  const cplan = cardioPlan({ ...cardioCtx, budgetSeconds: cardioBudget });
  const fit = fitStrength(planned, {
    slots, backProfile, budgetSeconds: budget.strength, nextTitle: (cplan && getMeta(cplan.modality)?.name) ?? 'cardio', idPrefix: 's', speech,
  });
  changes.push(...fit.cuts);
  warnings.push(...fit.warnings);

  // Nothing to do cardio on without standing (a foot problem, no machine): an
  // easy seated and floor flow takes its place, so the session still ends on time.
  const cardioSteps: Step[] = cplan
    ? [
      ...(glucoseCheck ? [{ kind: 'checkpoint' as const, id: 'c-glucose', block: 'cardio' as const, title: 'Glucose check', question: 'glucose' as const, seconds: 30 }] : []),
      ...cardioBlock({ ...cardioCtx, budgetSeconds: cardioBudget }),
    ]
    : seatedFlow(mobilityBlock({ dayType: 'core', profile, readiness, conditions, equipment, week, budgetSeconds: budget.cardio, coverage, idPrefix: 'c', speech }));
  if (!cplan) changes.push('No cardio today: with a foot problem and no bike or other machine to hand, an easy seated and floor mobility flow takes its place.');
  const interval = intervalsAllowed({ ...cardioCtx, budgetSeconds: cardioBudget });
  if (cplan && cplan.format !== 'intervals' && !interval.ok && ['upperB', 'upperC', 'pull', 'push'].includes(focus) && interval.reason) {
    changes.push(`Steady cardio instead of intervals: ${interval.reason}.`);
  }

  const steps = [...mobility, ...fit.steps, ...cardioSteps, wrapUp(budget.wrapUp)];
  return {
    ...base,
    id: planId(date, focus, 'full', readiness),
    kind: 'full',
    steps,
    exercises: fit.exercises,
    cardio: cplan,
    blockStarts: blockStartsOf(steps),
    totalSeconds: steps.reduce((s, x) => s + stepSeconds(x), 0),
    changes,
    warnings,
  };
}
