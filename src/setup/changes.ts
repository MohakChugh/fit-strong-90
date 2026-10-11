/**
 * What an edit changes, in words (journey §16: "Before exercise, you'll be
 * asked for a glucose reading"): only what the engine itself now does
 * differently, read from the profile before and after.
 */
import type { UserProfile } from '@/types/profile';
import { walkingHeldForFeet } from '@/categories';
import { deriveHealth, profileGaps } from '@/engine/health';

export function whatChanges(before: UserProfile, after: UserProfile): string[] {
  const b = deriveHealth(before.health);
  const a = deriveHealth(after.health);
  return [
    a.hypoRisk && !b.hypoRisk && 'Before exercise, you’ll be asked for a glucose reading.',
    a.ketoneRisk && !b.ketoneRisk && 'Each check-in will ask about ketones and the signs of ketoacidosis.',
    walkingHeldForFeet(after) && !walkingHeldForFeet(before) && 'Walks stay off while your foot needs weight kept off it.',
    profileGaps(after).medicinesUnknown && !profileGaps(before).medicinesUnknown && 'Sessions wait until your diabetes medicines are answered.',
  ].filter((x): x is string => typeof x === 'string');
}
