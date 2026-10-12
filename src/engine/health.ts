/**
 * Profile-level health rules: facts that apply every day regardless of the
 * morning check-in (spec §4.6 complications, §4.7, §4.9 clearance).
 * Source: docs/research/diabetes-hypertension-exercise.md §1.8, §2, §6;
 * docs/research/clinical-tracking-protocols.md (H-DATA, H-PRE-LOW).
 */

import type { HealthProfile, MedicineAnswer, UserProfile } from '@/types/profile';
import type { Modifier, Outcome, Reason } from '@/types/checkin';

/** mg/dL per mmol/L for glucose. Conversions with it are never rounded (board D29(1)). */
export const MGDL_PER_MMOL = 18;

export interface DerivedHealth {
  diabetic: boolean;
  /** Insulin or a sulfonylurea/meglitinide, or type 1: lows are possible. */
  hypoRisk: boolean;
  /** Type 1, any SGLT2 inhibitor, insulin-treated "other", or past ketoacidosis / insulin deficiency: ketones matter. */
  ketoneRisk: boolean;
  /** Treated hypertension, or a beta-blocker or diuretic for any reason. */
  onBpMeds: boolean;
}

/** "Not sure" counts as yes for every safety rule. */
export const takes = (answer: MedicineAnswer | undefined): boolean => answer === true || answer === 'unsure';

export function deriveHealth(h: HealthProfile): DerivedHealth {
  const diabetic = h.diabetes === 'type1' || h.diabetes === 'type2' || h.diabetes === 'other';
  // Type 1 means insulin, whatever the insulin answer was left as.
  const insulin = h.diabetes === 'type1' || h.insulin !== 'none';
  return {
    diabetic,
    hypoRisk: diabetic && (insulin || takes(h.sulfonylureaOrMeglitinide)),
    // An SGLT2 answer never given is read as "may be taking it" (round 3 B08).
    ketoneRisk: h.diabetes === 'type1' || takes(h.sglt2i) || sglt2Unknown(h) || (h.diabetes === 'other' && h.insulin !== 'none')
      || (diabetic && takes(h.priorDkaOrInsulinDeficiency)),
    onBpMeds: h.hypertension === 'treated' || takes(h.betaBlocker) || takes(h.diuretic),
  };
}

/**
 * What the profile does not yet say (contract H-DATA). An unreviewed health
 * profile, or a diabetes profile whose medicine answers were never given,
 * cannot support any clearance that depends on the medicine class: the
 * untouched defaults would otherwise read as "no insulin".
 */
export function profileGaps(p: UserProfile): { healthUnreviewed: boolean; medicinesUnknown: boolean; sglt2Unknown?: boolean } {
  const healthUnreviewed = p.needsHealthReview === true;
  const diabetesUnknown = deriveHealth(p.health).diabetic && p.health.medicinesReviewed !== true;
  return { healthUnreviewed, medicinesUnknown: !healthUnreviewed && diabetesUnknown, sglt2Unknown: !healthUnreviewed && sglt2Unknown(p.health) };
}

/**
 * The SGLT2 question was never answered on a profile without diabetes
 * (round 3 B08). The wizard asks it of everyone without diabetes, since the
 * medicine is also prescribed for the heart and kidneys, and records
 * `medicinesReviewed` once it is answered; the untouched default `false` is
 * not an answer.
 *
 * Not knowing is read as "may be taking it": each check-in then asks about the
 * signs of ketoacidosis and offers ketone entry. It is not a hold — without
 * diabetes no movement clearance depends on this answer, as with the blood
 * pressure medicines — and the person is asked to answer it.
 */
export function sglt2Unknown(h: HealthProfile): boolean {
  const diabetic = h.diabetes === 'type1' || h.diabetes === 'type2' || h.diabetes === 'other';
  return !diabetic && h.medicinesReviewed !== true && h.sglt2i === false;
}

/**
 * The blood-pressure medicines have not been answered (contract H-DATA).
 *
 * Unlike the diabetes medicines, not knowing these does not make movement
 * unsafe: what they change is how effort is judged and what may be said about
 * fluids. So this tightens those two things rather than refusing a session,
 * which would lock out every profile saved before the question existed.
 */
export function bpMedicinesUnknown(h: HealthProfile): boolean {
  return bpMedicinesAsked(h) && h.bpMedicinesReviewed !== true;
}

/**
 * Who is asked about a beta-blocker and a diuretic: anyone with high blood
 * pressure, and anyone with heart, vessel or kidney disease, who are often
 * prescribed both without a hypertension diagnosis (round 3, policy note).
 * The wizard asks exactly these people (`bpMedicinesReviewed` records it).
 */
export function bpMedicinesAsked(h: HealthProfile): boolean {
  return h.hypertension !== 'none' || h.heartOrVascularDisease === true || h.kidneyDisease !== 'none';
}

/**
 * The lowest glucose, in mg/dL, at which exercise may start for someone who
 * can go low: the care team's figure when the profile holds a usable one,
 * otherwise 90, or 145 with impaired awareness of lows or a recent severe low
 * (diabetes-hypertension-exercise.md §1.3). A figure is unusable when it
 * would sit inside hypoglycaemia (under 70 mg/dL): a bare 5.5 saved without
 * its unit is a mmol/L target, and reading it as 5.5 mg/dL would clear a low.
 */
/** Whether `glucoseStartMin` is the care team's own number, not the standard one for the medicines. */
export function glucoseStartIsCareTeams(h: HealthProfile): boolean {
  const t = h.clinicianTargets;
  if (t?.glucoseStartMin === undefined || !Number.isFinite(t.glucoseStartMin)) return false;
  const unit = t.glucoseStartUnit ?? 'mg/dL';
  if (unit !== 'mg/dL' && unit !== 'mmol/L') return false;
  const mg = unit === 'mg/dL' ? t.glucoseStartMin : t.glucoseStartMin * MGDL_PER_MMOL;
  return mg >= 70 && mg < 600;
}

export function glucoseStartMin(h: HealthProfile): number {
  const t = h.clinicianTargets;
  const fallback = h.highHypoRisk ? 145 : 90;
  if (t?.glucoseStartMin === undefined || !Number.isFinite(t.glucoseStartMin)) return fallback;
  const unit = t.glucoseStartUnit ?? 'mg/dL';
  if (unit !== 'mg/dL' && unit !== 'mmol/L') return fallback;
  const mg = unit === 'mg/dL' ? t.glucoseStartMin : t.glucoseStartMin * MGDL_PER_MMOL;
  return mg >= 70 && mg < 600 ? mg : fallback;
}

export interface ProfileRules {
  outcome: Outcome;
  modifiers: Modifier[];
  reasons: Reason[];
  /** Notices to show (not blocking), e.g. "Wear shoes and check your feet after". */
  notices: string[];
  /** No lifts heavier than about 80% of max (moderate retinopathy). */
  capHeavy: boolean;
  /** Light–moderate work only until clearance is confirmed (ACSM: disease + inactive). */
  lightOnly: boolean;
  /** Intervals and heavy lifts locked until vigorous clearance is confirmed. */
  vigorousLocked: boolean;
  /** Use effort (RPE / talk test), never heart rate. */
  rpeOnly: boolean;
}

const reason = (code: string, message: string, outcome: Outcome = 'amber'): Reason => ({ code, message, outcome });

/** Shown until the SGLT2 question is answered; the sheet links it to the profile. */
export const SGLT2_UNRECORDED = 'Your medicines are not recorded yet. Until they are, each check-in asks about signs of ketoacidosis, which a medicine for the heart, kidneys or diabetes can cause. Answer the medicine question in your profile.';

export function profileRules(p: UserProfile): ProfileRules {
  const h = p.health;
  const d = deriveHealth(h);
  const out: ProfileRules = {
    outcome: 'green',
    modifiers: [],
    reasons: [],
    notices: [],
    capHeavy: false,
    lightOnly: false,
    vigorousLocked: false,
    rpeOnly: false,
  };
  const add = (...m: Modifier[]) => {
    for (const x of m) if (!out.modifiers.includes(x)) out.modifiers.push(x);
  };

  if (d.onBpMeds) {
    add('COOL');
    out.reasons.push(reason('bpMeds', 'Blood-pressure medicine: a longer cool-down and rising slowly from the floor.'));
  }
  if (sglt2Unknown(h) && p.needsHealthReview !== true) {
    out.notices.push(SGLT2_UNRECORDED);
  }
  // Not knowing is treated as taking it: effort is the safe guide either way,
  // and a heart-rate target would be the only unsafe answer here.
  if (takes(h.betaBlocker) || bpMedicinesUnknown(h)) {
    out.rpeOnly = true;
    out.notices.push(takes(h.betaBlocker)
      ? 'Go by effort and the talk test, not heart rate; beta-blockers lower your heart rate.'
      : 'Go by effort and the talk test, not heart rate, until your blood-pressure medicines are recorded.');
    // A cool-down costs nothing and is what both of these medicines argue for.
    if (bpMedicinesUnknown(h)) add('COOL');
  }
  if (h.dizzyOnStandingOrAutonomicNeuropathy) {
    add('COOL', 'HEAT');
    out.rpeOnly = true;
    out.reasons.push(reason('autonomic', 'Dizziness on standing: longer cool-down, staged rising, effort-based intensity.'));
  }

  if (h.peripheralNeuropathy !== 'no') {
    add('IMPACT');
    out.notices.push('Wear well-fitting shoes, never train barefoot, and check your feet after every session.');
  }
  if (h.footStatus === 'current_wound_or_active_charcot') {
    add('FOOT');
    out.reasons.push(reason('footWound', 'Open foot wound or active Charcot foot: seated and floor work only until a clinician clears you.'));
  } else if (h.footStatus === 'past_ulcer_or_charcot') {
    add('IMPACT');
  }

  switch (h.retinopathy) {
    case 'moderate':
    case 'unknown':
      out.capHeavy = true;
      if (h.retinopathy === 'unknown' && d.diabetic) {
        out.notices.push('Book a dilated eye exam; until then the plan avoids very heavy lifts.');
      }
      break;
    case 'severe_or_proliferative':
      add('INT', 'LOAD', 'HEAD', 'IMPACT');
      out.reasons.push(reason('retinopathy', 'Severe eye disease: no breath-holding, heavy, overhead or head-down work; an eye doctor should sign off vigorous exercise.'));
      break;
    case 'recent_eye_treatment':
      out.outcome = 'red';
      out.reasons.push(reason('eyeTreatment', 'Recent eye treatment or surgery: no exercise until your eye doctor clears you.', 'red'));
      break;
    case 'none_or_mild':
      break;
  }

  if (h.kidneyDisease !== 'none') {
    add('LOAD');
    out.reasons.push(reason('kidney', 'Kidney disease: moderate loads, no breath-holding, careful hydration.'));
  }

  // ACSM pre-participation screening (spec §4.9).
  const screeningDisease = d.diabetic || h.heartOrVascularDisease || h.kidneyDisease !== 'none';
  if (screeningDisease) {
    if (!h.currentlyActive && h.clearance === 'none') {
      out.lightOnly = true;
      out.vigorousLocked = true;
      add('INT', 'LOAD');
      out.reasons.push(reason('clearanceLight', 'Light-to-moderate work only until a clinician clears you to exercise.'));
    } else if (h.clearance !== 'vigorous') {
      out.vigorousLocked = true;
      out.reasons.push(reason('clearanceVigorous', 'Intervals and heavy lifts stay locked until a clinician clears you for vigorous exercise.'));
    }
  }
  if ((h.hypertension === 'untreated' || h.hypertension === 'unsure') && h.clearance !== 'vigorous') {
    out.vigorousLocked = true;
    out.reasons.push(reason('bpUnknown', 'High blood pressure that is untreated or unknown: no intervals or heavy lifts until it is checked.'));
  }

  return out;
}
