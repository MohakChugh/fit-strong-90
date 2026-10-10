/**
 * Which of the profile wizard's steps a flow shows, and what it may write.
 *
 * The wizard has four steps: about you and your schedule, your body, your
 * health, and a summary. Not every flow needs all four. Someone who only wants
 * to stretch should never be asked for training days, and changing one answer
 * should not mean walking through every screen. But a step that was not shown
 * must leave its answers exactly as they were — above all the medicine review,
 * which only the health step can complete.
 */

import type { LadderLevel } from '@/types/catalog';
import type { HealthProfile, LadderState, UserProfile } from '@/types/profile';
import { bpMedicinesAsked, deriveHealth } from '@/engine/health';
import { startingLadder } from '@/engine/progression';
import { isDay } from '@/health/observation';
import { LB_PER_KG } from '@/lib/utils';
import { sameValue } from '@/store/transfer';

export type WizardStep = 'about' | 'body' | 'health' | 'summary';

export const WIZARD_STEPS: readonly WizardStep[] = ['about', 'body', 'health', 'summary'];

/**
 * The steps to run, in the wizard's own order and each once. Nothing asked for
 * means all four. A first-time profile always ends on the summary, because its
 * acknowledgement — stop for chest pain, follow your care team's medicines —
 * is not something any flow may skip.
 */
export function wizardSteps(requested: readonly WizardStep[] | undefined, mode: 'onboarding' | 'edit'): WizardStep[] {
  const chosen = requested ? WIZARD_STEPS.filter(step => requested.includes(step)) : [];
  const steps = chosen.length > 0 ? chosen : [...WIZARD_STEPS];
  if (mode === 'onboarding' && !steps.includes('summary')) steps.push('summary');
  return steps;
}

/**
 * Whether the 12-week programme's questions (training days, session length,
 * equipment, goals) and its weekly plan are part of the flow. A flow says so
 * itself when it knows; otherwise they come with the `about` step.
 */
export function programmeInFlow(steps: readonly WizardStep[], programme?: boolean): boolean {
  return programme ?? steps.includes('about');
}

/**
 * Whether the programme start date is asked: only with the programme's
 * questions, always when they are first set up, and in an edit only when the
 * flow says so — a flow that asks the date itself (Move's way in) does not
 * want it twice.
 */
export function asksStartDate(programme: boolean, mode: 'onboarding' | 'edit', ask: boolean | undefined): boolean {
  return programme && (ask ?? mode === 'onboarding');
}

/** Any real day will do; a flow with a rule of its own (joining: today or later) passes that instead. */
export function startDateMissing(date: string): string | null {
  return isDay(date) ? null : 'Choose a start date.';
}

// ============================================================================
// The medicine questions (contract H-DATA, Codex safety round 3 B08)
// ============================================================================

export type MedicineQuestion = 'insulin' | 'sulfonylurea' | 'sglt2i' | 'metformin' | 'priorDka' | 'betaBlocker' | 'diuretic';

export const DIABETES_MEDICINES: readonly MedicineQuestion[] = ['insulin', 'sulfonylurea', 'sglt2i', 'metformin', 'priorDka'];
export const BP_MEDICINES: readonly MedicineQuestion[] = ['betaBlocker', 'diuretic'];

/**
 * The medicine questions this health profile must answer before the health
 * review is complete. With diabetes, every diabetes medicine. Without it, the
 * SGLT2 question alone — also prescribed for heart and kidney conditions,
 * with ketone risk either way — and no insulin questions. Then the
 * blood-pressure medicines, whenever the engine asks them (`bpMedicinesAsked`):
 * high blood pressure, or heart, vessel or kidney disease.
 */
export function requiredMedicines(h: HealthProfile): MedicineQuestion[] {
  const own: readonly MedicineQuestion[] = deriveHealth(h).diabetic ? DIABETES_MEDICINES : ['sglt2i'];
  return [...own, ...(bpMedicinesAsked(h) ? BP_MEDICINES : [])];
}

/** Whether every required medicine question has an answer given in this wizard, or vouched for on opening. */
export function medicinesAnswered(h: HealthProfile, answered: ReadonlySet<MedicineQuestion>): boolean {
  return requiredMedicines(h).every(q => answered.has(q));
}

/**
 * The answers that count as given when the wizard opens: only what was
 * actually answered. A review flag vouches for its questions — the diabetes
 * medicines, or without diabetes the SGLT2 question alone, so adding diabetes
 * later still asks the rest. Without diabetes a Yes or Not sure for SGLT2 can
 * only have come from an answer; the untouched default No never counts.
 */
export function answeredOnOpen(h: HealthProfile | undefined): Set<MedicineQuestion> {
  const out = new Set<MedicineQuestion>();
  if (!h) return out;
  const diabetic = deriveHealth(h).diabetic;
  if (h.medicinesReviewed === true) for (const q of diabetic ? DIABETES_MEDICINES : ['sglt2i' as const]) out.add(q);
  else if (!diabetic && h.sglt2i !== false) out.add('sglt2i');
  if (h.bpMedicinesReviewed === true) for (const q of BP_MEDICINES) out.add(q);
  return out;
}

// ============================================================================
// The weight field (Codex screens re-check N05)
// ============================================================================

const oneDecimal = (n: number) => String(Math.round(n * 10) / 10);

/** A weight in the unit shown, as the field shows it. */
export function weightFieldText(kg: number | undefined, metric: boolean): string {
  return kg ? oneDecimal(metric ? kg : kg * LB_PER_KG) : '';
}

/**
 * The field's text in the other unit, when the unit is switched: the same body
 * weight. An empty or unfinished entry is left as it is rather than made 0.
 */
export function convertWeightText(text: string, toMetric: boolean): string {
  const n = Number(text);
  if (text.trim() === '' || !Number.isFinite(n) || n <= 0) return text;
  return oneDecimal(toMetric ? n / LB_PER_KG : n * LB_PER_KG);
}

/**
 * The weight to save, in kilograms. While the person has not typed in the
 * field, it is exactly the weight that was stored, whichever unit is shown:
 * changing the display unit is not a weight edit.
 */
export function submittedWeightKg({ text, metric, untouchedKg }: { text: string; metric: boolean; untouchedKg?: number }): number {
  if (untouchedKg !== undefined) return untouchedKg;
  const n = Number(text);
  if (!Number.isFinite(n)) return 0;
  return metric ? n : n / LB_PER_KG;
}

/**
 * What is wrong with the year metformin was started, as typed: nothing for an
 * empty field (it is optional) or a real four-digit year up to this one.
 * Checked when the field is left or the step saved, never per keystroke, so
 * "2", "20" and "201" can be typed on the way to "2019" (J02).
 */
export function metforminYearProblem(text: string, thisYear: number): string | null {
  if (text === '') return null;
  const year = /^\d{4}$/.test(text) ? Number(text) : NaN;
  return year >= 1950 && year <= thisYear ? null : 'Enter the year as four digits, such as 2019.';
}

export interface StepGate {
  /** Whether the programme's questions are asked (`programmeInFlow`). */
  programme: boolean;
  /** Something typed on this step that cannot be saved, such as an unfinished year; `null` or absent when nothing is. */
  fieldProblem?: string | null;
  /** What is wrong with the start date, when one is asked; `null` or absent when nothing is. */
  startDateProblem?: string | null;
  /** Body weight as typed, in the person's own unit; 0 when the field is empty. */
  weight: number;
  trainingDays: number;
  medicinesAnswered: boolean;
  acknowledged: boolean;
}

/**
 * Whether the person may move on from a step — Continue, or the last step's
 * own button. Each step asks only for its own answers: weight and training
 * days only where the programme's questions are asked (anyone else may leave
 * the weight empty, but not negative), the medicine answers only on the
 * health step.
 */
export function canLeave(step: WizardStep, gate: StepGate): boolean {
  switch (step) {
    case 'about': return gate.programme ? gate.weight > 0 && gate.trainingDays > 0 && !gate.startDateProblem : gate.weight >= 0;
    case 'body': return true;
    case 'health': return gate.medicinesAnswered && !gate.fieldProblem;
    case 'summary': return gate.acknowledged;
  }
}

export function stepTitle(step: WizardStep, programme: boolean): string {
  switch (step) {
    case 'about': return programme ? 'You and your schedule' : 'About you';
    case 'body': return 'Your body';
    case 'health': return 'Your health';
    case 'summary': return programme ? 'Your plan' : 'Before you start';
  }
}

export function finishLabel(mode: 'onboarding' | 'edit', programme: boolean): string {
  if (mode === 'edit') return 'Save';
  return programme ? 'Build my plan' : 'Save my answers';
}

const hasBack = (p: UserProfile) => p.pain.areas.includes('lowerBack') || p.pain.areas.includes('sciatica');

/**
 * The spinal-loading ladder after an edit, which can only become more
 * cautious. A back problem that is new lowers the hinge and squat levels to
 * where a first-time profile with it would start; sciatica that is new closes
 * the nerve gate, so stretches that pull on the nerve are left out again.
 * Answers that did not change keep the levels the person has earned.
 */
export function ladderAfterEdit(before: UserProfile, after: UserProfile, today: string): LadderState {
  let ladder = after.ladder;
  if (hasBack(after) && !hasBack(before)) {
    const start = startingLadder(after);
    const hinge = Math.min(ladder.hinge, start.hinge) as LadderLevel;
    const squat = Math.min(ladder.squat, start.squat) as LadderLevel;
    if (hinge !== ladder.hinge || squat !== ladder.squat) ladder = { ...ladder, hinge, squat, changedOn: today };
  }
  if (after.pain.areas.includes('sciatica') && !before.pain.areas.includes('sciatica') && ladder.neuralGate) {
    ladder = { ...ladder, neuralGate: false, changedOn: today };
  }
  return ladder;
}

/**
 * The profile the wizard hands back. Only the steps that were shown change
 * anything: the weight is taken from the field only if it was asked, and the
 * health review and medicine reviews are marked done only by the health step,
 * which cannot be left until every required medicine is answered
 * (`medicinesAnswered`). `medicinesReviewed` then vouches for the diabetes
 * medicines, or without diabetes for the SGLT2 answer; `bpMedicinesReviewed`
 * for the blood-pressure medicines where they were asked.
 * A first-time profile gets its starting ladder; an edited one can only have
 * its ladder made more cautious (`ladderAfterEdit`).
 */
export function finalProfile(args: {
  draft: UserProfile;
  /** The profile the wizard opened with, if any. */
  before: UserProfile | undefined;
  steps: readonly WizardStep[];
  mode: 'onboarding' | 'edit';
  /** The weight field, in kilograms; `undefined` keeps the stored weight exactly. */
  typedWeightKg: number | undefined;
  today: string;
}): UserProfile {
  const { draft, before, steps, mode, typedWeightKg, today } = args;
  const health = steps.includes('health');
  const reviewed = health
    ? { medicinesReviewed: true, ...(bpMedicinesAsked(draft.health) ? { bpMedicinesReviewed: true } : {}) }
    : {};
  const profile: UserProfile = {
    ...draft,
    weightKg: steps.includes('about') && typedWeightKg !== undefined ? Math.round(typedWeightKg * 10) / 10 : draft.weightKg,
    ...(health ? { needsHealthReview: false } : {}),
    health: { ...draft.health, ...reviewed },
  };
  if (mode === 'onboarding' || !before) profile.ladder = startingLadder(profile);
  else profile.ladder = ladderAfterEdit(before, profile, today);
  return profile;
}

// ============================================================================
// What an edit changed (D-03)
// ============================================================================

/** One answer the person changed: where it is in the profile, and its new value (`undefined`: cleared). */
export interface ProfileChange {
  path: string[];
  value: unknown;
}

const isPlain = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/**
 * Every answer that differs between the profile a wizard opened with and the
 * one it saved, leaf by leaf (a list is one answer). With nothing opened,
 * everything is a change.
 */
export function profileChanges(opened: UserProfile | undefined, saved: UserProfile): ProfileChange[] {
  const out: ProfileChange[] = [];
  const walk = (a: unknown, b: unknown, path: string[]) => {
    if (sameValue(a, b)) return;
    if (isPlain(a) && isPlain(b)) {
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[key], b[key], [...path, key]);
      return;
    }
    out.push({ path, value: b });
  };
  walk(opened, saved, []);
  return out;
}

/**
 * The wizard's answers on top of the profile as it is when they are written:
 * only what the person changed since the wizard opened, so a save from one
 * open copy cannot put back answers another copy changed meanwhile. Without
 * what it opened with, or anything stored, the wizard's profile is taken whole.
 */
export function answeredProfile(
  current: UserProfile | undefined,
  result: { profile: UserProfile; opened?: { profile?: UserProfile } },
): UserProfile {
  if (!current || !result.opened) return result.profile;
  return withProfileChanges(current, profileChanges(result.opened.profile, result.profile));
}

/**
 * The profile as it now stands with those changes made, and nothing else:
 * whatever another open copy saved meanwhile to any other answer stays.
 */
export function withProfileChanges(current: UserProfile, changes: readonly ProfileChange[]): UserProfile {
  let next: unknown = structuredClone(current);
  for (const { path, value } of changes) {
    if (path.length === 0) {
      next = structuredClone(value);
      continue;
    }
    let node = next as Record<string, unknown>;
    for (const key of path.slice(0, -1)) {
      if (!isPlain(node[key])) node[key] = {};
      node = node[key] as Record<string, unknown>;
    }
    const last = path[path.length - 1];
    if (value === undefined) delete node[last];
    else node[last] = structuredClone(value);
  }
  return next as UserProfile;
}
