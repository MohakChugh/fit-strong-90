import type { Choice } from '@/screens/you/controls';
import type { PainArea } from '@/types/profile';
import type { ConditionId, MedicineClass, Tri } from '@/types/setup';

/** Yes, No and Not sure: "Not sure" is a real answer (journey §6.1). */
export const TRI: Choice<Tri>[] = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'unsure', label: 'Not sure' }];
/** For what a person knows: no "Not sure" (journey §1.2 "where safety allows"). */
export const YES_NO: Choice<'yes' | 'no'>[] = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }];

/** Chapter 3's chips (journey §6.2; board D77). Review, Profile & health and the acceptance helper read the same labels. */
export const CONDITION_ROWS: readonly { id: ConditionId; label: string }[] = [
  { id: 'diabetes', label: 'Diabetes' },
  { id: 'bp', label: 'High blood pressure' },
  { id: 'heart', label: 'Heart or circulation problems' },
  { id: 'kidney', label: 'Kidney disease' },
  { id: 'eyes', label: 'Eye problems from diabetes, or eye treatment in the last 3 months' },
  { id: 'feet', label: 'Foot problems: numbness, a wound or an ulcer' },
  { id: 'pain', label: 'Back pain, sciatica or other pain' },
  { id: 'other', label: 'Something else that affects exercise' },
];

/** Chapter 4's medicine classes, asked whatever the diagnosis (A-06, K-05). */
export const CLASS_ROWS: readonly { id: MedicineClass; label: string; detail?: string }[] = [
  { id: 'insulin', label: 'Insulin' },
  { id: 'lowsTablet', label: 'A tablet that can cause lows', detail: 'Gliclazide, glimepiride, repaglinide and others' },
  { id: 'gliflozin', label: 'A “-gliflozin” medicine', detail: 'Empagliflozin, dapagliflozin and others, for diabetes, the heart or the kidneys' },
  { id: 'metformin', label: 'Metformin' },
  { id: 'betaBlocker', label: 'A beta-blocker', detail: 'Bisoprolol, metoprolol and others' },
  { id: 'diuretic', label: 'A water tablet (diuretic)' },
  { id: 'other', label: 'Something else' },
];

/** Chapter 5's areas: every area v1 knows (board D77). */
export const AREAS: Choice<PainArea>[] = [
  { value: 'lowerBack', label: 'Lower back' }, { value: 'sciatica', label: 'Sciatica (pain down the leg)' }, { value: 'neck', label: 'Neck' },
  { value: 'shoulder', label: 'Shoulder' }, { value: 'hip', label: 'Hip' }, { value: 'knee', label: 'Knee' },
  { value: 'hamstring', label: 'Back of the thigh (hamstring)' }, { value: 'calf', label: 'Calf' },
];
