/**
 * Condition → exercise-flag matrix (spec §4.8, program-design.md §7.4).
 * X = excluded, G = gated (ladder / nerve gate), C = capped.
 */

import type { Readiness } from '@/types/checkin';
import type { LadderLevel, LadderTrack, SafetyFlags } from '@/types/catalog';
import type { UserProfile } from '@/types/profile';
import { deriveHealth } from './health';

export interface Conditions {
  backHistory: boolean;
  /** Back light amber or red today. */
  backIrritable: boolean;
  /** Leg nerve symptoms today. */
  sciaticaActive: boolean;
  /** Sciatica history, quiet today. */
  sciaticaQuiet: boolean;
  hamstringPain: boolean;
  calfPain: boolean;
  severeRetinopathy: boolean;
  neuropathy: boolean;
  hypertension: boolean;
  /** What makes the back worse: drives direction-specific mobility. */
  worseWith: 'flexion' | 'extension' | 'unknown';
  head: boolean;
  impact: boolean;
  foot: boolean;
  load: boolean;
  int: boolean;
  capHeavy: boolean;
  vigorousLocked: boolean;
  /** Spinal-loading levels allowed today. */
  ladder: Record<LadderTrack, LadderLevel>;
  neuralGate: boolean;
}

export function activeConditions(profile: UserProfile, readiness: Readiness): Conditions {
  const areas = profile.pain.areas;
  const backHistory = areas.includes('lowerBack') || areas.includes('sciatica');
  const backIrritable = readiness.back === 'amber' || readiness.back === 'red';
  const sciaticaActive = readiness.nerveFlag;
  const m = readiness.modifiers;

  let hinge = profile.ladder.hinge;
  let squat = profile.ladder.squat;
  if (backIrritable) {
    hinge = Math.max(0, hinge - 1) as LadderLevel;
    squat = Math.max(0, squat - 1) as LadderLevel;
  }
  if (sciaticaActive) hinge = Math.min(hinge, 1) as LadderLevel;

  return {
    backHistory,
    backIrritable,
    sciaticaActive,
    sciaticaQuiet: areas.includes('sciatica') && !sciaticaActive,
    hamstringPain: areas.includes('hamstring'),
    calfPain: areas.includes('calf'),
    severeRetinopathy: profile.health.retinopathy === 'severe_or_proliferative',
    neuropathy: profile.health.peripheralNeuropathy !== 'no',
    hypertension: profile.health.hypertension !== 'none' || deriveHealth(profile.health).onBpMeds,
    worseWith: profile.pain.worseWith,
    head: m.includes('HEAD'),
    impact: m.includes('IMPACT'),
    foot: m.includes('FOOT'),
    load: m.includes('LOAD'),
    int: m.includes('INT'),
    capHeavy: readiness.capHeavy,
    vigorousLocked: readiness.vigorousLocked,
    ladder: { hinge, squat },
    neuralGate: profile.ladder.neuralGate,
  };
}

export interface Caps {
  /** Minimum reps in reserve. */
  minRir?: number;
  /** Minimum reps per set (no heavy low-rep work). */
  minReps?: number;
  /** Maximum hold time in seconds. */
  maxHoldSeconds?: number;
  /** Spoken / shown caps, e.g. "Stop before your pelvis tucks under". */
  notes: string[];
  /** Exhale-through-the-effort cue is mandatory. */
  exhale?: boolean;
}

export interface FlagVerdict {
  excluded: boolean;
  reason?: string;
  /** Needs the nerve gate (G5) before it can be used. */
  needsNeuralGate: boolean;
  caps: Caps;
}

/** Evaluate an exercise's flags against today's conditions. */
export function evaluateFlags(flags: SafetyFlags, c: Conditions): FlagVerdict {
  const caps: Caps = { notes: [] };
  const raise = (key: 'minRir' | 'minReps', v: number) => { caps[key] = Math.max(caps[key] ?? 0, v); };
  const exclude = (reason: string): FlagVerdict => ({ excluded: true, reason, needsNeuralGate: false, caps });
  const sciatica = c.sciaticaActive || c.sciaticaQuiet;
  let needsNeuralGate = false;

  if (flags.spinalFlexion === 2 && (c.backHistory || c.backIrritable || sciatica)) return exclude('repeated loaded spinal bending');
  if (flags.spinalFlexion === 1) {
    if (c.backIrritable) return exclude('back is irritable today');
    if (c.backHistory || sciatica) { raise('minRir', 2); caps.notes.push('Keep your lower back neutral; stop the range before it rounds.'); }
  }
  if (flags.loadedRotation && (c.backHistory || c.backIrritable || sciatica)) return exclude('twisting the lower back under load');
  if (flags.axialLoad === 2) {
    if (c.backIrritable || c.sciaticaActive) return exclude('heavy spinal loading while symptoms are active');
    if (c.severeRetinopathy) return exclude('heavy straining with eye disease');
    if (c.hypertension) { raise('minRir', 3); raise('minReps', 6); }
  }
  if (flags.lumbarMoment === 2) {
    if (c.backIrritable || c.sciaticaActive) return exclude('high lower-back load while symptoms are active');
    if (c.hamstringPain || c.severeRetinopathy || c.hypertension) { raise('minRir', 2); caps.notes.push('Shorter range: stop at mid-shin.'); }
  }
  if (flags.loadedExtension && (c.backHistory || c.backIrritable || sciatica)) {
    caps.notes.push('Finish in a straight line; do not arch past neutral.');
  }
  if (flags.valsalva === 2) {
    if (c.severeRetinopathy) return exclude('heavy straining with eye disease');
    if (c.backHistory || c.backIrritable || c.sciaticaActive) raise('minRir', 2);
  }
  if (flags.valsalva && c.hypertension) {
    raise('minRir', 3);
    raise('minReps', 6);
    caps.exhale = true;
  }
  if (flags.headBelowHeart) {
    if (c.severeRetinopathy || c.head) return exclude('head-below-heart position');
    if (c.hypertension) caps.notes.push('Keep head-down time brief and rise slowly.');
  }
  if (flags.highImpact && (c.backIrritable || c.sciaticaActive || c.calfPain || c.severeRetinopathy || c.neuropathy || c.impact)) {
    return exclude('impact');
  }
  if (flags.sciaticTension === 2) {
    if (c.sciaticaActive) return exclude('stretches the sciatic nerve while it is irritated');
    if (c.sciaticaQuiet && !c.neuralGate) needsNeuralGate = true;
    if (c.hamstringPain) caps.notes.push('Shorter range: stop before any pull behind the knee.');
  }
  if (flags.sciaticTension === 1 && c.sciaticaActive) {
    caps.notes.push('Work only in a range with no leg symptoms.');
  }
  // NTf is NTs on the front of the thigh (hip extension + knee flexion). §4.8's
  // neural-tension rows are gated by leg-symptom status, so a high-tension
  // femoral drill is out while symptoms are active and range-limited once they
  // are quiet. It is never put behind the neural gate: G5 tests the sciatic
  // nerve (straight-leg raise, kickstand hinge), which says nothing about this.
  if (flags.femoralTension === 2) {
    if (c.sciaticaActive) return exclude('stretches the front-of-thigh nerve while leg symptoms are active');
    if (c.sciaticaQuiet) caps.notes.push('Shorter step: keep the back thigh under you, not stretched out behind.');
  }
  if (flags.femoralTension === 1 && c.sciaticaActive) {
    caps.notes.push('Work only in a range with no front-of-thigh or leg symptoms.');
  }
  if (flags.deepHipFlexionLoaded && (c.sciaticaActive || c.hamstringPain)) {
    caps.notes.push('Limit depth: thighs no deeper than parallel.');
  }
  if (flags.balance === 2 && (c.sciaticaActive || c.neuropathy)) {
    caps.notes.push('Hold onto a rack or wall for balance.');
  }
  if (flags.overhead && c.severeRetinopathy) return exclude('overhead pressing with eye disease');
  // "No breath-holding, isometrics or overhead" (§4.6) bars a sustained brace —
  // a plank, a side plank, the 10-second McGill curl-up — because holding one
  // drives blood pressure up. A dead bug, bird dog or Pallof press is dosed as
  // slow reps with a 1–5 s pause breathed out through, which is not that, so it
  // stays available with the pause capped and the exhale cue forced. Excluding
  // it too would leave this profile — which also has a back history — with no
  // trunk drill at all, and the McGill Big 3 is the core of that plan (§4.2).
  if (flags.isometricHold === 2 && c.severeRetinopathy) return exclude('sustained isometric holds with eye disease');
  if (flags.isometricHold) {
    if (c.severeRetinopathy) {
      caps.maxHoldSeconds = Math.min(caps.maxHoldSeconds ?? 5, 5);
      caps.exhale = true;
      caps.notes.push('Keep the pause brief and keep breathing out through it.');
    }
    if (c.hypertension) { caps.maxHoldSeconds = Math.min(caps.maxHoldSeconds ?? 30, 30); caps.exhale = true; }
  }
  // FOOT: seated, upper-body or floor work only. `weightBearing` covers every
  // drill whose load travels through the foot, including seated foot-plate work
  // (leg press, seated calf raise), not just standing drills.
  if (flags.weightBearing && c.foot) return exclude('load through the foot while it needs protecting');
  if (flags.seatedFlexion && c.sciaticaActive && c.worseWith === 'flexion') {
    caps.notes.push('Sit tall; stop if leg symptoms build.');
  }

  if (c.load) { raise('minRir', 3); raise('minReps', 10); caps.maxHoldSeconds = Math.min(caps.maxHoldSeconds ?? 30, 30); }
  if (c.capHeavy || c.vigorousLocked) raise('minReps', 8);
  if (c.int) raise('minRir', 3);

  return { excluded: false, needsNeuralGate, caps };
}
