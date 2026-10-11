/**
 * The profile every gate reads (journey §4, §6.1; board D161).
 *
 * While setup is unfinished (Look around first, a v1 Welcome left part-way, a
 * session that went on without saving), the profile gap stands, whatever the
 * record holds, and any answer the draft discloses that is stricter than the
 * record's applies at once (H5-05). A finished record, a completed v1 upgrade
 * included, is read as it is.
 *
 * "Stricter" is field by field (`stricterProfile`): the value the engine
 * treats more cautiously, so a combined profile is never looser than either
 * of the two it comes from. On a tie, the newer answer, as the person's latest.
 */
import type { UserSettings } from '@/types';
import type { HealthProfile, MedicineAnswer, PainArea, PainProfile, UserProfile } from '@/types/profile';
import type { ChapterId } from '@/types/setup';
import { glucoseStartMin } from '@/engine/health';
import { toDateString } from '@/lib/utils';
import { createDefaultProfile } from '@/profile/defaults';
import type { StoreResult } from '@/store/db';
import { getState } from '@/store/useStore';
import { compact, healthFrom, painFrom } from './assemble';
import { getSetupSession, type SetupSession } from './draft';
import { answersOf, setupStateOf } from './state';

type Pick2<T> = (stored: T, newer: T) => T;

/** The stricter of two answers by rank; on a tie, the newer one. */
const ranked = <T>(rank: (v: T) => number): Pick2<T> => (stored, newer) => (rank(newer) >= rank(stored) ? newer : stored);
const order = <T extends string>(r: Record<T, number>): Pick2<T> => ranked<T>(v => r[v]);
/** True is the stricter: a condition, a symptom. */
const yes = ranked<boolean>(v => (v ? 1 : 0));
/** "Taking it" or "Not sure" over not asked, over No (`takes`, engine/health.ts). */
const medicine = ranked<MedicineAnswer | undefined>(v => (v === false ? 0 : v === undefined ? 1 : 2));
/** Not yet reviewed is the stricter: it holds what it vouches for (H-DATA). */
const reviewed = ranked<boolean | undefined>(v => (v === true ? 0 : 1));
/** Not a hold either way, such as a monitor or a unit: the newer answer, when there is one. */
const newer = <T>(stored: T, next: T): T => next ?? stored;

/** Each health field's rule. A `Record` over the profile's own keys, so a field added without one fails the build. */
const HEALTH: { [K in keyof HealthProfile]-?: Pick2<HealthProfile[K]> } = {
  diabetes: order({ none: 0, prediabetes: 1, type2: 2, other: 3, type1: 4 }),
  insulin: order({ none: 0, injections_or_pump: 1, automated_delivery: 1, unsure: 2 }),
  insulinRegimen: newer,
  sulfonylureaOrMeglitinide: medicine as Pick2<MedicineAnswer>,
  sglt2i: medicine as Pick2<MedicineAnswer>,
  metformin: medicine,
  metforminSince: newer,
  priorDkaOrInsulinDeficiency: medicine,
  medicinesReviewed: reviewed,
  highHypoRisk: yes,
  hypertension: order({ none: 0, treated: 1, untreated: 2, unsure: 2 }),
  betaBlocker: medicine as Pick2<MedicineAnswer>,
  diuretic: medicine as Pick2<MedicineAnswer>,
  bpMedicinesReviewed: reviewed,
  heartOrVascularDisease: yes,
  kidneyDisease: order({ none: 0, ckd: 1, unsure: 1, dialysis_or_transplant: 2 }),
  fluidRestriction: medicine,
  retinopathy: order({ none_or_mild: 0, moderate: 1, unknown: 1, severe_or_proliferative: 2, recent_eye_treatment: 3 }),
  peripheralNeuropathy: order({ no: 0, unsure: 1, yes: 1 }),
  footStatus: order({ healthy: 0, past_ulcer_or_charcot: 1, current_wound_or_active_charcot: 2 }),
  dizzyOnStandingOrAutonomicNeuropathy: yes,
  glucoseMonitor: newer,
  glucoseUnit: newer,
  ketoneTest: newer,
  bpMonitor: newer,
  // Inactive is the stricter: with disease and no clearance, light work only.
  currentlyActive: ranked<boolean>(v => (v ? 0 : 1)),
  clearance: order({ vigorous: 0, moderate: 1, none: 2 }),
  // Worked out below, from the rest.
  clinicianTargets: newer,
  bpExercisePermission: newer,
};

/**
 * The care team's numbers, stricter: the start figure that is higher for this
 * person (theirs, or the usual one when theirs is lower), and the lower stop.
 */
function stricterTargets(a: HealthProfile, b: HealthProfile, merged: HealthProfile): HealthProfile['clinicianTargets'] {
  const ta = a.clinicianTargets;
  const tb = b.clinicianTargets;
  const glucose = glucoseStartMin({ ...merged, clinicianTargets: tb }) >= glucoseStartMin({ ...merged, clinicianTargets: ta }) ? tb : ta;
  const stops = [ta?.bpStopSystolic, tb?.bpStopSystolic].filter((x): x is number => x !== undefined);
  return compact({
    glucoseStartMin: glucose?.glucoseStartMin,
    glucoseStartUnit: glucose?.glucoseStartUnit,
    bpStopSystolic: stops.length > 0 ? Math.min(...stops) : undefined,
    hba1cPercent: tb?.hba1cPercent ?? ta?.hba1cPercent,
  });
}

/** A clinician's permission only lifts a hold: it stands only where both have one, at the lower of the two. */
function stricterPermission(a: HealthProfile['bpExercisePermission'], b: HealthProfile['bpExercisePermission']): HealthProfile['bpExercisePermission'] {
  if (!a || !b) return undefined;
  const lower = b.sys <= a.sys ? b : a;
  return { sys: Math.min(a.sys, b.sys), dia: Math.min(a.dia, b.dia), ...(lower.recordedOn ? { recordedOn: lower.recordedOn } : {}) };
}

export function stricterHealth(a: HealthProfile, b: HealthProfile): HealthProfile {
  const fields = {} as Record<keyof HealthProfile, unknown>;
  for (const k of Object.keys(HEALTH) as (keyof HealthProfile)[]) fields[k] = (HEALTH[k] as Pick2<unknown>)(a[k], b[k]);
  const merged = fields as HealthProfile;
  const out: HealthProfile = { ...merged, clinicianTargets: stricterTargets(a, b, merged), bpExercisePermission: stricterPermission(a.bpExercisePermission, b.bpExercisePermission) };
  // A stored record never holds an `undefined` key.
  for (const k of Object.keys(out) as (keyof HealthProfile)[]) if (out[k] === undefined) delete out[k];
  return out;
}

/** Every area either names, with the leg as either says it ("both" when they differ); the learned direction stays. */
export function stricterPain(a: PainProfile, b: PainProfile): PainProfile {
  const areas: PainArea[] = [...a.areas, ...b.areas.filter(x => !a.areas.includes(x))];
  // A leg counts only where that profile has sciatica.
  const sideOf = (p: PainProfile) => (p.areas.includes('sciatica') ? p.sciaticaSide : undefined);
  const [sa, sb] = [sideOf(a), sideOf(b)];
  const side = !areas.includes('sciatica') ? undefined : sa && sb && sa !== sb ? 'both' : sb ?? sa;
  const neuro = medicine(a.neuroHistory, b.neuroHistory);
  const out: PainProfile = { ...a, areas, worseWith: b.worseWith };
  if (side) out.sciaticaSide = side;
  else delete out.sciaticaSide;
  if (neuro !== undefined) out.neuroHistory = neuro;
  return out;
}

/** Two profiles as one, never looser than either: the health and pain answers, the review gap and the exercise ladder. */
export function stricterProfile(stored: UserProfile, next: UserProfile): UserProfile {
  return {
    ...stored,
    health: stricterHealth(stored.health, next.health),
    pain: stricterPain(stored.pain, next.pain),
    needsHealthReview: stored.needsHealthReview === true || next.needsHealthReview === true,
    ladder: {
      ...stored.ladder,
      hinge: Math.min(stored.ladder.hinge, next.ladder.hinge) as UserProfile['ladder']['hinge'],
      squat: Math.min(stored.ladder.squat, next.ladder.squat) as UserProfile['ladder']['squat'],
      neuralGate: stored.ladder.neuralGate || next.ladder.neuralGate,
    },
  };
}

// ---- A clinical edit on its way to being stored (H5-08; board D162) ----------

/** Each chapter edit not yet stored, by the chapters it owns: the profile it would store. */
const editing = new Map<string, UserProfile>();
let editingEpoch = 0;
let editingVersion = 0;
const editingListeners = new Set<() => void>();
/** Edits of a record a backup has since replaced are that record's (H5-07). */
const edits = () => {
  if (editingEpoch !== getState().epoch) {
    editing.clear();
    editingEpoch = getState().epoch;
  }
  return editing;
};
const editsChanged = () => {
  editingVersion += 1;
  for (const listener of [...editingListeners]) listener();
};
export const subscribePendingEdits = (listener: () => void): (() => void) => {
  editingListeners.add(listener);
  return () => void editingListeners.delete(listener);
};
export const pendingEditsVersion = (): number => editingVersion;

/**
 * Store a chapter edit (Me → Profile & health). Its stricter answers count
 * for every gate from the tap; what it releases waits until `write`, which
 * must be held until stored, is. If the write is refused, those answers keep
 * counting until a save of the same chapters is stored: the person said them,
 * and a refusal doesn't unsay them (§4.5).
 */
export async function saveClinicalEdit(chapters: readonly ChapterId[], planned: UserProfile, write: () => Promise<StoreResult>): Promise<StoreResult> {
  const key = [...chapters].sort().join(',');
  edits().set(key, planned);
  editsChanged();
  const saved = await write();
  if (saved.ok) {
    for (const k of [...edits().keys()]) if (k.split(',').every(c => chapters.includes(c as ChapterId))) edits().delete(k);
    editsChanged();
  }
  return saved;
}

export function resetPendingEditsForTests(): void {
  editing.clear();
  editingEpoch = 0;
}

export interface GateInput {
  profile?: UserProfile;
  settings: Pick<UserSettings, 'setup' | 'onboardingComplete' | 'habits' | 'currentWeight'>;
}

/**
 * The profile every gate reads: the record's, or with nothing stored the
 * default with its gap (as v1 read it). While setup is unfinished, the gap,
 * and the draft's answers wherever they're stricter than the record's. Then
 * any chapter edit on its way, wherever it's stricter (H5-08).
 */
export function gateProfile(state: GateInput, now: Date = new Date(), session: SetupSession = getSetupSession()): UserProfile {
  const stored = state.profile ?? createDefaultProfile({ weightKg: state.settings.currentWeight || 0, needsHealthReview: true });
  const setup = setupStateOf(state.settings, state.profile);
  let out = stored;
  if (setup.stage !== 'done' || session.entered) {
    const answers = session.unsaved ? session.answers : answersOf(setup);
    const drafted: UserProfile = { ...stored, health: healthFrom(answers, stored.health, toDateString(now)), pain: painFrom(answers, stored.pain) };
    out = { ...stricterProfile(stored, drafted), needsHealthReview: true };
  }
  for (const planned of edits().values()) out = stricterProfile(out, planned);
  return out;
}
