/**
 * Profile-level health rules: facts that apply every day regardless of the
 * morning check-in (spec §4.6 complications, §4.7, §4.9 clearance).
 * Source: docs/research/diabetes-hypertension-exercise.md §1.8, §2, §6.
 */

import type { HealthProfile, UserProfile } from '@/types/profile';
import type { Modifier, Outcome, Reason } from '@/types/checkin';

export interface DerivedHealth {
  diabetic: boolean;
  /** Insulin or a sulfonylurea/meglitinide: lows are possible. */
  hypoRisk: boolean;
  /** Type 1, any SGLT2 inhibitor, or insulin-treated "other": ketones matter. */
  ketoneRisk: boolean;
  /** Treated hypertension, or a beta-blocker or diuretic for any reason. */
  onBpMeds: boolean;
}

export function deriveHealth(h: HealthProfile): DerivedHealth {
  const diabetic = h.diabetes === 'type1' || h.diabetes === 'type2' || h.diabetes === 'other';
  return {
    diabetic,
    hypoRisk: diabetic && (h.insulin !== 'none' || h.sulfonylureaOrMeglitinide),
    ketoneRisk: h.diabetes === 'type1' || h.sglt2i || (h.diabetes === 'other' && h.insulin !== 'none'),
    onBpMeds: h.hypertension === 'treated' || h.betaBlocker || h.diuretic,
  };
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
  if (h.betaBlocker) {
    out.rpeOnly = true;
    out.notices.push('Go by effort and the talk test, not heart rate; beta-blockers lower your heart rate.');
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
