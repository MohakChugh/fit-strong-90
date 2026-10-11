/**
 * What v1's profile wizard left that setup and Profile & health still read:
 * the medicine answers a review vouches for (contract H-DATA, B08), the
 * weight field in either unit, the year metformin was started, the
 * spinal-loading ladder after an edit, and what an edit changed (D-03). The
 * wizard itself is gone (Plan 5).
 */

import type { LadderLevel } from '@/types/catalog';
import type { HealthProfile, LadderState, UserProfile } from '@/types/profile';
import { deriveHealth } from '@/engine/health';
import { startingLadder } from '@/engine/progression';
import { LB_PER_KG } from '@/lib/utils';
import { sameValue } from '@/store/transfer';

// ============================================================================
// The medicine questions (contract H-DATA, Codex safety round 3 B08)
// ============================================================================

export type MedicineQuestion = 'insulin' | 'sulfonylurea' | 'sglt2i' | 'metformin' | 'priorDka' | 'betaBlocker' | 'diuretic';

export const DIABETES_MEDICINES: readonly MedicineQuestion[] = ['insulin', 'sulfonylurea', 'sglt2i', 'metformin', 'priorDka'];
export const BP_MEDICINES: readonly MedicineQuestion[] = ['betaBlocker', 'diuretic'];

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
