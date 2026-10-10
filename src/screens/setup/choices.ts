import type { Choice } from '@/screens/you/controls';
import type { Tri } from '@/types/setup';

/** Yes, No and Not sure: "Not sure" is a real answer (journey §6.1). */
export const TRI: Choice<Tri>[] = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'unsure', label: 'Not sure' }];
/** For what a person knows: no "Not sure" (journey §1.2 "where safety allows"). */
export const YES_NO: Choice<'yes' | 'no'>[] = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }];
