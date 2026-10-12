/**
 * The back and leg signs that need emergency care whatever a pain number
 * says, in the check-in's own words: saddle numbness or new sexual problems,
 * bladder or bowel change (E-CES), both legs (E-BILATERAL), and one leg
 * getting weaker and getting worse (T-NEURO's progression). Built from the
 * check-in's labels and the stop control's question, so Track's note and the
 * check-in cannot list different signs (scan X2-20).
 */

import { BACK_LABEL, EMERGENCY_LABEL } from '@/components/checkin/copy';
import { WORSENING } from '@/components/checkin/stop';

export const BACK_EMERGENCY_SIGNS: readonly string[] = [
  EMERGENCY_LABEL.saddle,
  EMERGENCY_LABEL.bladderBowel,
  EMERGENCY_LABEL.bothLegs,
  `${BACK_LABEL.newWeakness}, when ${WORSENING.charAt(0).toLowerCase()}${WORSENING.slice(1)}`,
];

