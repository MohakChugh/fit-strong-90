/**
 * "Stop: something's wrong", asked the same way wherever movement happens:
 * the guided session and a stretch (acceptance J02, J08, J16) and a walk
 * (Walk's "I need to stop").
 *
 * What the person says is put in the check-in's own words and goes into
 * today's check-in through the shared path (`reportSymptoms`), so the engine
 * decides what may follow — at once, and at the next start. No React here:
 * the player and the walk screens each draw it their own way.
 *
 * - Chest pain, stroke signs and severe breathlessness are emergencies: the
 *   movement ends.
 * - Dizziness is reported; for someone who can go low it is also a reason to
 *   check for a low.
 * - Leg symptoms are the player's "Worse" questions: spread, new weakness and
 *   how fast, both legs, saddle numbness and bladder or bowel change.
 * - "Just need a rest" records nothing.
 *
 * Anything but an emergency starts again only through the restart question.
 */

import type { EmergencyFlag, SymptomReach } from '@/types/checkin';
import type { SymptomReport } from './pending';
import { BACK_LABEL, EMERGENCY_LABEL, NEWS_LABEL } from './copy';

export type StopChoice = 'chest' | 'stroke' | 'breathless' | 'dizzy' | 'leg' | 'rest';

/** The question's answers, most urgent first. */
export const STOP_CHOICES: readonly { choice: StopChoice; label: string }[] = [
  { choice: 'chest', label: EMERGENCY_LABEL.chest },
  { choice: 'stroke', label: EMERGENCY_LABEL.stroke },
  { choice: 'breathless', label: EMERGENCY_LABEL.breathless },
  { choice: 'dizzy', label: NEWS_LABEL.dizzy },
  { choice: 'leg', label: 'Pain travelling down my leg' },
  { choice: 'rest', label: 'Just need a rest' },
];

/** What a one-tap answer reports. */
export function stopReport(choice: 'chest' | 'stroke' | 'breathless' | 'dizzy'): SymptomReport {
  return choice === 'dizzy' ? { news: ['dizzy'] } : { emergency: [choice] };
}

/**
 * What one tap does: what it reports, if anything, and what comes next — the
 * leg questions, or for someone who can go low, "check your glucose now".
 */
export function onChoice(choice: StopChoice, hypoRisk: boolean): { report?: SymptomReport; next: 'close' | 'leg' | 'dizzy' } {
  if (choice === 'leg') return { next: 'leg' };
  if (choice === 'rest') return { next: 'close' };
  if (choice === 'dizzy') return { report: stopReport('dizzy'), next: hypoRisk ? 'dizzy' : 'close' };
  return { report: stopReport(choice), next: 'close' };
}

/** Pain travelling down a leg: the player's questions after "Worse". */
export interface LegAnswers {
  /** How far down symptoms reach now, if said. */
  reach?: SymptomReach;
  /** "Symptoms reach further down my leg than before", when that was asked. */
  spread?: boolean;
  weakness: boolean;
  /** The weakness is getting worse over hours or days (NICE NG127 1.7.4, as the Guide says; scan X2-14). */
  fast: boolean;
  bothLegs: boolean;
  saddle: boolean;
  bladderBowel: boolean;
}

/** One rule for a weakening leg, worded the same everywhere: "quickly" is over hours or days (scan X2-14). */
export const WORSENING = 'It is getting worse over hours or days';

/** Nothing said yet. */
export const NO_LEG: LegAnswers = { weakness: false, fast: false, bothLegs: false, saddle: false, bladderBowel: false };

/** Nearest the back first, as the check-in orders them. */
export const REACH: readonly SymptomReach[] = ['back', 'buttock', 'thigh', 'belowKnee', 'foot'];
/** The check-in's words for them. */
export const REACH_LABEL: Record<SymptomReach, string> = { back: 'Back', buttock: 'Buttock', thigh: 'Thigh', belowKnee: 'Below knee', foot: 'Foot' };

/** The player's questions, in its words. "Getting worse quickly" is asked only of a weakness. */
export const LEG_QUESTIONS: readonly { key: Exclude<keyof LegAnswers, 'reach' | 'spread'>; label: string }[] = [
  { key: 'weakness', label: BACK_LABEL.newWeakness },
  { key: 'fast', label: WORSENING },
  { key: 'bothLegs', label: EMERGENCY_LABEL.bothLegs },
  { key: 'saddle', label: EMERGENCY_LABEL.saddle },
  { key: 'bladderBowel', label: EMERGENCY_LABEL.bladderBowel },
];

/**
 * Spread said in so many words, for a screen that cannot compare with where
 * symptoms reached before (acceptance J16): the stop control asks it first.
 */
export const SPREAD_QUESTION = { key: 'spread', label: 'Symptoms reach further down my leg than before' } as const;

/**
 * Worse leg symptoms, recorded the same way from every screen: how far they
 * reach, and that they have spread — said so, or further than earlier today;
 * new weakness and how fast it is getting worse; both legs, saddle numbness
 * and bladder or bowel change as the emergencies they are. Nothing that was
 * not said is filled in.
 */
export function legReport(a: LegAnswers, before: SymptomReach | undefined, movement?: string): SymptomReport {
  const further = !!a.reach && !!before && REACH.indexOf(a.reach) > REACH.indexOf(before);
  const emergency: EmergencyFlag[] = [
    ...(a.bothLegs ? ['bothLegs' as const] : []),
    ...(a.saddle ? ['saddle' as const] : []),
    ...(a.bladderBowel ? ['bladderBowel' as const] : []),
  ];
  return {
    ...(emergency.length ? { emergency } : {}),
    // What was being done is left out for the rest of the day (A-BACK): on a
    // walk that is walking itself (scan X2-09).
    ...(movement ? { provoked: [movement] } : {}),
    back: {
      ...(a.reach ? { reach: a.reach } : {}),
      ...(a.spread || further ? { spreadToday: true } : {}),
      ...(a.weakness ? { newWeakness: true, newNeuro: true, weaknessFast: a.fast } : {}),
      ...(a.saddle || a.bladderBowel ? { caudaEquinaFlag: true } : {}),
    },
  };
}
