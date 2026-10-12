import type { Claim } from '../schema';
import { CHECK_CLAIMS } from './checks';
import { DAILY_CLAIMS } from './daily';
import { FOOD_CLAIMS } from './food';
import { VITAMIN_CLAIMS } from './vitamins';

export { REVIEWED } from './make';

/** Every statement the Guide shows, in one list. */
export const CLAIMS: Claim[] = [...FOOD_CLAIMS, ...VITAMIN_CLAIMS, ...DAILY_CLAIMS, ...CHECK_CLAIMS];
