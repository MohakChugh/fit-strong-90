import type { Coaching } from '@/types/catalog';
import { canonicalId } from '@/data/catalog';
import { UPPER_COACHING } from './upper';
import { LOWER_COACHING } from './lower';
import { CORE_CARDIO_COACHING } from './core-cardio';
import { MOBILITY_UPPER_COACHING } from './mobility-upper';
import { MOBILITY_LOWER_COACHING } from './mobility-lower';

export const COACHING: Coaching[] = [
  ...UPPER_COACHING,
  ...LOWER_COACHING,
  ...CORE_CARDIO_COACHING,
  ...MOBILITY_UPPER_COACHING,
  ...MOBILITY_LOWER_COACHING,
];

const byId = new Map(COACHING.map(c => [c.id, c]));

/** Coaching for an id, following retired aliases (e.g. hip-opener-stretch). */
export function getCoaching(id: string): Coaching | undefined {
  return byId.get(id) ?? byId.get(canonicalId(id));
}
