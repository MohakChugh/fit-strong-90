/**
 * What the answers so far mean in the engine's terms: the conditions that
 * decide which pages apply (journey §6.3, board D76), and how `profileFrom`
 * reads them. One place, so a page's condition and the profile it writes
 * can't disagree.
 */
import type { HealthProfile } from '@/types/profile';
import type { SetupAnswers, Tri } from '@/types/setup';

/** "Yes" or "Not sure": every safety rule reads "Not sure" as "may have" (§6.1). */
export const has = (t: Tri | undefined): boolean => t === 'yes' || t === 'unsure';

/**
 * The diabetes value the engine reads, or `undefined` before the chip is
 * answered. "Not sure", or a type not given yet, is `'other'`. Insulin or a
 * tablet that can cause lows means lows are possible, so with "No" or
 * prediabetes it is `'other'` too (board D78; Review Focus 3).
 */
export function diabetesOf(a: SetupAnswers): HealthProfile['diabetes'] | undefined {
  const chip = a.conditions?.diabetes;
  if (chip === undefined) return undefined;
  const lowsMedicine = has(a.classes?.insulin) || has(a.classes?.lowsTablet);
  if (chip === 'no') return lowsMedicine ? 'other' : 'none';
  const t = a.diabetesType;
  const typed = t === 'type1' || t === 'type2' || t === 'prediabetes' || t === 'other' ? t : 'other';
  return typed === 'prediabetes' && lowsMedicine ? 'other' : typed;
}

export interface Facts {
  diabetic: boolean;
  /** Type 1, or insulin ticked or not sure. */
  insulin: boolean;
  /** Diabetes with insulin or a tablet that can cause lows: the engine's `hypoRisk`. */
  hypoRisk: boolean;
  /** Type 1, a "-gliflozin", insulin with another type, or past DKA: ketones matter. */
  ketoneRisk: boolean;
  bp: boolean;
  /** High blood pressure treated or not sure, a beta-blocker or a diuretic: the dizziness question's "BP medicine". */
  bpMeds: boolean;
  heart: boolean;
  kidney: boolean;
  eyes: boolean;
  feet: boolean;
  pain: boolean;
  other: boolean;
  /** Lower back or sciatica among the areas: which leg and what makes it worse are asked. */
  back: boolean;
  /** Regular medicines, yes or not sure: the classes are asked. */
  medicines: boolean;
  /** A wound now, or a clinician's weight-bearing limit: walking is held (K-30). */
  footHeld: boolean;
}

export function factsOf(a: SetupAnswers): Facts {
  const c = a.conditions ?? {};
  const k = a.classes ?? {};
  const diabetes = diabetesOf(a);
  const diabetic = diabetes === 'type1' || diabetes === 'type2' || diabetes === 'other';
  const insulin = diabetes === 'type1' || has(k.insulin);
  const bp = has(c.bp);
  const feet = has(c.feet);
  return {
    diabetic,
    insulin,
    hypoRisk: diabetic && (insulin || has(k.lowsTablet)),
    ketoneRisk: diabetes === 'type1' || has(k.gliflozin) || (diabetes === 'other' && has(k.insulin)) || (diabetic && has(a.priorDka)),
    bp,
    bpMeds: (bp && a.bpMedicine !== 'no') || has(k.betaBlocker) || has(k.diuretic),
    heart: has(c.heart),
    kidney: has(c.kidney),
    eyes: has(c.eyes),
    feet,
    pain: has(c.pain),
    other: has(c.other),
    back: (a.painAreas ?? []).some(x => x === 'lowerBack' || x === 'sciatica'),
    medicines: a.regular === 'yes' || a.regular === 'unsure',
    footHeld: feet && (a.footWound === 'now' || a.footRestriction === 'yes'),
  };
}
