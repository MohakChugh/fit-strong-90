/**
 * What to do about a reading that was just saved, from the safety contract in
 * docs/research/clinical-tracking-protocols.md.
 *
 * Scope is deliberately narrow. Only rows a single number can trigger are
 * here, and only those that ask the person to act on the reading itself:
 *
 * - **emergency** — E-EXTREME-GLUCOSE (glucose ≥ 600 mg/dL).
 * - **today** — T-BP (systolic ≥ 180 or diastolic ≥ 120 mmHg) and a level 2
 *   low (glucose < 54 mg/dL), which T-HYPO-REVIEW and board D29(3) send to the
 *   care team today.
 * - **treat now** — H-HYPO, a level 1 low (54 to under 70 mg/dL). The contract
 *   ranks it a hold, but its required action is to treat the low now, so it is
 *   shown at once like the two above.
 * - A meter's **HI or LO** (H-DATA): no number, so nothing is saved, but the
 *   person still gets what to do — LO as the severe low it reports, as the
 *   check-in treats it.
 *
 * Holds that only change whether exercise may start (H-EXERCISE-BP,
 * H-T2-HIGH, H-PRE-LOW…) are not repeated here: the movement gate owns them,
 * and a second, slightly different copy of a safety rule is how two screens
 * end up disagreeing.
 *
 * Thresholds are compared in mg/dL, converted at 18 and never rounded first
 * (D29(1)), with the contract's own operators: < 54, < 70, ≥ 600, ≥ 180, ≥ 120.
 * "Contact today" means the care team or the treating clinician; "emergency"
 * means local emergency services — no UK telephone numbers.
 */

import { CANNOT_SWALLOW, evaluateCheckIn, TREAT } from '@/engine/readiness';
import { PERMISSION_TEXT } from '@/engine/permission';
import { createDefaultProfile } from '@/profile/defaults';
import type { DailyCheckIn } from '@/types/checkin';
import type { UserProfile } from '@/types/profile';
import { today } from './periods';
import { glucoseMgdl, type GlucoseUnit } from './units';

export type Disposition = 'emergency' | 'today' | 'treatNow';

export interface Escalation {
  /** The safety-contract row, for tests and for anyone auditing a message. */
  rule: 'E-EXTREME-GLUCOSE' | 'T-HYPO-LEVEL-2' | 'H-HYPO' | 'T-BP' | 'H-DATA';
  disposition: Disposition;
  /** One plain sentence: what this reading is. */
  title: string;
  /** What to do, in order. Shown in full, never truncated. */
  steps: string[];
  /** The guideline the steps come from, in words a person can look up. */
  basis: string;
}

/** ADA 2026 Table 6.4: level 1 is < 70 and ≥ 54 mg/dL; level 2 is < 54. */
export const HYPO_LEVEL_1_MGDL = 70;
export const HYPO_LEVEL_2_MGDL = 54;
/** ADA 2026 Table 16.1, the hyperglycaemic crisis boundary the contract uses. */
export const EXTREME_GLUCOSE_MGDL = 600;
/** NICE NG136 1.5.1; inclusive, as the contract's T-BP row states. */
export const SEVERE_SYSTOLIC = 180;
export const SEVERE_DIASTOLIC = 120;

const SEVERE_LOW_BASIS = 'ADA Standards of Care 2026, Table 6.4 and recommendation 6.15';

/**
 * The check-in's own words for treating a low and for when that cannot be
 * done by mouth (one 15 g sentence and one swallow line across the app).
 */
const CANNOT_SWALLOW_STEP = `${CANNOT_SWALLOW.title}: ${CANNOT_SWALLOW.line.charAt(0).toLowerCase()}${CANNOT_SWALLOW.line.slice(1)} ${PERMISSION_TEXT.emergencyTitle}. ${PERMISSION_TEXT.emergencyCall}`;

/** "70 mg/dL" or "3.9 mmol/L", as ADA itself pairs them. */
function lowLine(unit: GlucoseUnit): string {
  return unit === 'mg/dL' ? '70 mg/dL' : '3.9 mmol/L';
}

/** The check-in's sentence, then what "still low" means in the reading's own unit. */
function treatLow(unit: GlucoseUnit): string[] {
  return [TREAT, `Still low means under ${lowLine(unit)}.`];
}

/**
 * What the check-in says about one reading, word for word: the engine's own
 * reason for it, worked out from a check-in that holds only that reading and
 * this person's health answers. So what to do about exercise here is what
 * the check-in and every movement gate say (scan X2-11), never a second copy
 * of the rule. Should the engine ever give no such reason, the line falls
 * back to its plainest stop.
 */
export function checkInSays(reading: Partial<DailyCheckIn>, code: string, profile: UserProfile | undefined): string {
  const c: DailyCheckIn = { date: today(), urgentSymptoms: false, emergency: [], news: [], ...reading };
  return evaluateCheckIn(profile ?? createDefaultProfile(), c).reasons.find(r => r.code === code)?.message
    ?? PERMISSION_TEXT.emergencyNoExercise;
}

/** One sentence a step, so a long rule reads as the steps it is. */
const sentences = (text: string) => text.split(/(?<=\.)\s+/).filter(Boolean);

function severeLowSteps(unit: GlucoseUnit, says: string): string[] {
  return [...treatLow(unit), CANNOT_SWALLOW_STEP, says];
}

/**
 * A meter that shows HI or LO has read past its range, so there is no number
 * to judge and none is invented (H-DATA). HI is checked again, and needs
 * urgent advice if it stays, with the emergency signs first; LO is a severe
 * low, which the engine's check-in rules treat it as too.
 */
export function meterEscalation(display: 'HI' | 'LO', unit: GlucoseUnit, profile?: UserProfile): Escalation {
  if (display === 'LO') {
    return {
      rule: 'T-HYPO-LEVEL-2',
      disposition: 'today',
      title: 'Your meter says LO, lower than it can measure. Treat it as a serious low, now.',
      steps: severeLowSteps(unit, checkInSays({ glucoseDisplay: { display: 'LO', measuredAt: new Date().toISOString() } }, 'severeLow', profile)),
      basis: SEVERE_LOW_BASIS,
    };
  }
  return {
    rule: 'H-DATA',
    disposition: 'today',
    title: 'Your meter says HI, higher than it can measure.',
    steps: [
      'Wash and dry your hands and check again.',
      'If it still says HI, contact your diabetes team or urgent care now.',
      'If you are vomiting, breathing deeply or unusually, or very drowsy or confused, call emergency services now.',
      'Do not exercise.',
    ],
    basis: 'ADA Standards of Care 2026, recommendations 7.10 to 7.12 and Table 16.1',
  };
}

/**
 * The escalation for a glucose reading, or undefined when none applies.
 * `profile` sets what the check-in says about exercise after a low (a care
 * team's start level, for one).
 */
export function glucoseEscalation(value: number, unit: GlucoseUnit, profile?: UserProfile): Escalation | undefined {
  if (!Number.isFinite(value)) return undefined;
  const mg = glucoseMgdl(value, unit);
  const reading = { glucose: { value, unit, measuredAt: new Date().toISOString() } };

  if (mg >= EXTREME_GLUCOSE_MGDL) {
    return {
      rule: 'E-EXTREME-GLUCOSE',
      disposition: 'emergency',
      title: 'This reading is extremely high and needs emergency care.',
      steps: [
        'Get emergency medical help now.',
        'Do not exercise.',
        'If you are not sure the reading is right, wash and dry your hands and test again straight away. A second reading this high still needs emergency help.',
      ],
      basis: 'ADA Standards of Care 2026, Table 16.1',
    };
  }

  if (mg < HYPO_LEVEL_2_MGDL) {
    return {
      rule: 'T-HYPO-LEVEL-2',
      disposition: 'today',
      title: 'This is a serious low. Treat it now.',
      steps: severeLowSteps(unit, checkInSays(reading, 'severeLow', profile)),
      basis: SEVERE_LOW_BASIS,
    };
  }

  if (mg < HYPO_LEVEL_1_MGDL) {
    return {
      rule: 'H-HYPO',
      disposition: 'treatNow',
      title: 'This is a low. Treat it now.',
      steps: [
        ...treatLow(unit),
        CANNOT_SWALLOW_STEP,
        checkInSays(reading, 'low', profile),
        'Tell your care team if lows keep happening.',
      ],
      basis: SEVERE_LOW_BASIS,
    };
  }

  return undefined;
}

/**
 * The escalation for one blood-pressure reading. Either number is enough: a
 * normal diastolic never lowers the category of a severe systolic (contract
 * E-BP, T-BP).
 */
export function pressureEscalation(systolic: number, diastolic: number, profile?: UserProfile): Escalation | undefined {
  if (!Number.isFinite(systolic) || !Number.isFinite(diastolic)) return undefined;
  if (systolic < SEVERE_SYSTOLIC && diastolic < SEVERE_DIASTOLIC) return undefined;
  const reading = { sys: systolic, dia: diastolic, at: new Date().toISOString() };
  return {
    rule: 'T-BP',
    disposition: 'today',
    title: 'This reading is very high.',
    // The check-in's own words: re-measure after 5 minutes, no exercise today,
    // contact today if it stays high, and the signs that mean emergency help.
    steps: sentences(checkInSays({ bpReadings: [reading], bp: { sys: systolic, dia: diastolic } }, 'bpSevereUnconfirmed', profile)),
    basis: 'NICE NG136, recommendation 1.5.1, and American Heart Association guidance (2025)',
  };
}

/** How an earlier serious reading has been settled since, in the check-in's words. */
export type Settled = 'open' | 'assessed';

/**
 * Whether an earlier reading of this kind stays in force until the person
 * says it was settled. An extreme glucose or a severe blood pressure needs
 * emergency or same-day care whenever it was taken, unless a clinician has
 * seen the person since: an earlier clock time is not recovery (R03). A low
 * that has passed is different: what matters is whether one is happening now.
 */
export function needsSettling(e: Escalation): boolean {
  return e.rule === 'E-EXTREME-GLUCOSE' || e.rule === 'T-BP';
}

const CHECKED = 'Keep to the plan from the clinician who checked you.';
const LOW_NOW = 'If you feel low now, check your glucose and treat it straight away.';

/**
 * A reading recorded after the moment it was taken (F03, R03). Its
 * seriousness and its guideline stay. For an extreme glucose or a severe
 * blood pressure that has not been settled, the help action stays exactly as
 * for a current reading; once a clinician has seen the person, it is reviewed,
 * with what to do if it is happening now first. A low that has passed is
 * reviewed the same way — "treat it now" is about a reading being taken now.
 * No time limit decides any of this: the person says.
 */
export function earlierEscalation(e: Escalation, settled: Settled = 'open'): Escalation {
  switch (e.rule) {
    case 'E-EXTREME-GLUCOSE':
      return settled === 'open'
        ? { ...e, title: 'An extremely high reading that has not been checked since still needs emergency care.' }
        : {
          ...e,
          title: 'That reading was extremely high.',
          steps: ['If you feel unwell now — very thirsty, vomiting, drowsy or confused — get emergency medical help now.', CHECKED],
        };
    case 'T-BP':
      return settled === 'open'
        ? { ...e, title: 'A very high reading that has not been checked since still needs action today.' }
        : {
          ...e,
          title: 'That reading was very high.',
          steps: [
            'If you have chest pain, severe back pain, breathlessness, confusion, weakness, numbness, a change in vision or trouble speaking now, call emergency services now.',
            CHECKED,
          ],
        };
    case 'T-HYPO-LEVEL-2':
      return { ...e, title: 'That was a serious low.', steps: [LOW_NOW, 'Tell your care team about this low, so they can review your plan.'] };
    case 'H-HYPO':
      return { ...e, title: 'That was a low.', steps: [LOW_NOW, 'If lows keep happening, tell your care team.'] };
    case 'H-DATA':
      // A meter's HI is never recorded, so it is only ever current.
      return e;
  }
}

/**
 * What is shown while the questions about a reading are still open: for an
 * extreme glucose or a severe blood pressure, the help action itself, which
 * only a clinician's check since can set aside — never a conditional "if you
 * feel unwell" (R03); for a low, what to do if one is happening now.
 */
export function holdLine(e: Escalation): string {
  switch (e.rule) {
    case 'E-EXTREME-GLUCOSE':
      return 'A reading this high needs emergency medical help now, unless a clinician has checked you since.';
    case 'T-BP':
      return 'Check your blood pressure again and contact your doctor today, unless a clinician has checked you since. With chest pain, breathlessness, confusion, weakness, numbness, a change in vision or trouble speaking, call emergency services now.';
    case 'T-HYPO-LEVEL-2':
    case 'H-HYPO':
      return LOW_NOW;
    case 'H-DATA':
      return e.steps[0];
  }
}

/** What the person has said about a reading given its own time. */
export interface GuidanceAnswer {
  when: 'now' | 'earlier';
  settled?: Settled;
}

export type GuidanceView =
  | { question: 'when' | 'settled'; hold: string }
  | { escalation: Escalation };

/**
 * The guidance to show for a reading, given what has been asked and answered.
 * A reading entered for now gets its steps at once. One given its own time is
 * asked when it was taken; one that stays in force is then asked whether it
 * has been settled; and only then is it reviewed as past. Until each answer,
 * the help action holds (`holdLine`).
 */
export function guidanceView(e: Escalation, ask: boolean, answer: GuidanceAnswer | undefined): GuidanceView {
  if (!ask || answer?.when === 'now') return { escalation: e };
  if (!answer) return { question: 'when', hold: holdLine(e) };
  if (needsSettling(e) && answer.settled === undefined) return { question: 'settled', hold: holdLine(e) };
  return { escalation: earlierEscalation(e, answer.settled ?? 'open') };
}

const ORDER: Disposition[] = ['treatNow', 'today', 'emergency'];

/**
 * The one escalation to show for several readings saved together (two
 * blood-pressure readings a minute apart): the most urgent. Ties keep the
 * first, which is the earlier reading.
 */
export function mostUrgent(escalations: (Escalation | undefined)[]): Escalation | undefined {
  let worst: Escalation | undefined;
  for (const e of escalations) {
    if (e && (!worst || ORDER.indexOf(e.disposition) > ORDER.indexOf(worst.disposition))) worst = e;
  }
  return worst;
}

/**
 * A word for a reading the contract singles out, so a list never relies on
 * colour, or on the person knowing the thresholds, to show it. Same tests and
 * operators as the escalation itself.
 */
export function glucoseFlag(value: number, unit: GlucoseUnit): string | undefined {
  const mg = glucoseMgdl(value, unit);
  if (mg >= EXTREME_GLUCOSE_MGDL) return 'Extremely high';
  if (mg < HYPO_LEVEL_2_MGDL) return 'Serious low';
  if (mg < HYPO_LEVEL_1_MGDL) return 'Low';
  return undefined;
}

export function pressureFlag(systolic: number | null, diastolic: number | null): string | undefined {
  if ((systolic !== null && systolic >= SEVERE_SYSTOLIC) || (diastolic !== null && diastolic >= SEVERE_DIASTOLIC)) return 'Very high';
  return undefined;
}
