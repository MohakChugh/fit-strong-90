/**
 * When the app must not suggest drinking water.
 *
 * "Have a glass of water" is ordinary advice that is wrong for some people:
 * kidney disease and heart failure can need a fluid limit, and a limit a
 * clinician set overrides any generic reminder (clinical-tracking-protocols.md,
 * Hydration; NIH NIDDK on CKD liquids). The profile cannot tell heart failure
 * from other heart conditions, so any heart or circulation condition counts —
 * the cost of a missing water reminder is small, the cost of a wrong one is not.
 */

import type { HabitSettings } from '@/types/habits';
import type { MedicineAnswer, UserProfile } from '@/types/profile';
import { entryFor, summariseDay } from '@/health/aggregate';
import type { Observation } from '@/health/observation';

/**
 * Water recorded on a day, in ml, through the one aggregation path (D10).
 * `undefined` when nothing is recorded or the day's records cannot be
 * combined: an unknown total must never read as zero, nor end a reminder.
 */
export function waterRecorded(day: string, observations: Observation[]): number | undefined {
  const entry = entryFor(summariseDay(day, observations), 'water', 'dayTotal');
  return entry && entry.unit === 'ml' && entry.total !== null ? entry.total : undefined;
}

/**
 * The person's answer to "Has your care team told you to limit how much you
 * drink?". It lives on the profile (`health.fluidRestriction`); an answer
 * given before that field existed was kept as `habits.fluidLimit`, which is
 * still read so it is never lost, but no longer written.
 */
export function fluidRestriction(profile: UserProfile | undefined, habits: HabitSettings | undefined): MedicineAnswer | undefined {
  return profile?.health.fluidRestriction ?? habits?.fluidLimit;
}

/**
 * The profile with an answer kept the old way carried over, for showing or
 * saving it where it now lives. A profile that already has its own answer keeps it.
 */
export function withFluidAnswer(profile: UserProfile, habits: HabitSettings | undefined): UserProfile {
  if (profile.health.fluidRestriction !== undefined || habits?.fluidLimit === undefined) return profile;
  return { ...profile, health: { ...profile.health, fluidRestriction: habits.fluidLimit } };
}

/**
 * Why water reminders are off for this person, in one line, or `undefined`
 * when they may be offered. Checked every time a reminder would fire or a
 * calendar file is written, not only when the reminder is turned on, so a
 * diagnosis added later silences a reminder chosen earlier. "Not sure" about
 * a fluid limit counts as a limit.
 */
export function waterBlock(profile: UserProfile | undefined, habits: HabitSettings | undefined): string | undefined {
  const limit = fluidRestriction(profile, habits);
  if (limit === true) return 'Off, because your care team has asked you to limit fluids.';
  if (limit === 'unsure') return 'Off until you know whether your care team wants you to limit fluids. Ask them first.';
  return conditionBlock(profile);
}

/** The profile's own reasons — conditions, missing or unconfirmed answers — leaving the fluid-limit answer aside. */
export function conditionBlock(profile: UserProfile | undefined): string | undefined {
  if (!profile) return 'Off until you answer the health questions, since some conditions need a fluid limit.';
  // A migrated profile carries default answers nobody has confirmed. "No
  // kidney disease" there is a placeholder, not something the person said.
  if (profile.needsHealthReview) return 'Off until you review your health answers, since some conditions need a fluid limit.';

  const { kidneyDisease, heartOrVascularDisease } = profile.health;
  if (kidneyDisease === 'ckd' || kidneyDisease === 'dialysis_or_transplant') {
    return 'Off, because kidney disease can need a fluid limit. Ask your care team what is right for you.';
  }
  if (kidneyDisease === 'unsure') {
    return 'Off, because you are not sure about kidney disease, which can need a fluid limit. Ask your care team.';
  }
  if (heartOrVascularDisease) {
    return 'Off, because heart conditions such as heart failure can need a fluid limit. Ask your care team.';
  }
  return undefined;
}
