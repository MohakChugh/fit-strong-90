/**
 * What the Guide allows each reminder to say (Codex content re-check R03).
 *
 * The reminders keep no rules of their own about who may be prompted: they
 * follow the Guide's canonical reading of the person (`contextFromProfile`)
 * and its habit advice (`habitAdvice`). A habit it does not offer is neither
 * scheduled nor shown, already-enabled ones included — no standing or walking
 * prompt with an open foot wound or active Charcot foot, no water prompt with
 * a fluid caution or health answers not yet given. A habit it offers carries
 * the Guide's precautions — checks as the care plan says, and fast-acting
 * sugar, with insulin or a sulfonylurea or meglitinide — in the banner and in
 * a calendar note, which can be followed with the app closed.
 */

import type { HabitSettings } from '@/types/habits';
import type { UserProfile } from '@/types/profile';
import { contextFromProfile, habitAdvice, type GuideContext, type HabitAdvice } from '@/content/personalise';
import type { HabitId } from './schedule';

export type MovementHabit = Exclude<HabitId, 'water'>;

// The scheduler asks often. The store replaces the profile whenever it
// changes; of the habits, only an answer kept the old way (`fluidLimit`)
// changes the reading, so it keys the cache.
const readings = new WeakMap<UserProfile, Map<string, GuideContext>>();
const withoutProfile = new Map<string, GuideContext>();

/** The Guide's reading of the person: the one the reminders follow. */
export function guideContext(profile: UserProfile | undefined, habits?: Pick<HabitSettings, 'fluidLimit'>): GuideContext {
  let byAnswer = profile ? readings.get(profile) : withoutProfile;
  if (!byAnswer) {
    byAnswer = new Map();
    readings.set(profile!, byAnswer);
  }
  const key = String(habits?.fluidLimit);
  let ctx = byAnswer.get(key);
  if (!ctx) {
    ctx = contextFromProfile(profile, profile?.food, habits);
    byAnswer.set(key, ctx);
  }
  return ctx;
}

function advice(habit: HabitId, profile: UserProfile | undefined, habits?: Pick<HabitSettings, 'fluidLimit'>): HabitAdvice | undefined {
  return habitAdvice(habit, guideContext(profile, habits));
}

/** Whether the Guide offers this habit's prompt to this person. */
export function habitOffered(habit: HabitId, profile: UserProfile | undefined, habits?: Pick<HabitSettings, 'fluidLimit'>): boolean {
  return advice(habit, profile, habits)?.offered !== false;
}

/** What the Guide says instead, when it does not offer the prompt: a seated change, or why there is no walk. */
export function habitInstead(habit: HabitId, profile: UserProfile | undefined, habits?: Pick<HabitSettings, 'fluidLimit'>): string | undefined {
  const a = advice(habit, profile, habits);
  return a?.offered === false ? a.instead?.statement : undefined;
}

/**
 * The precautions that travel with this habit's prompt for this person, as
 * sentences: only those that could apply, and none for a prompt not offered.
 */
export function habitPrecautions(habit: HabitId, profile: UserProfile | undefined, habits?: Pick<HabitSettings, 'fluidLimit'>): string[] {
  return advice(habit, profile, habits)?.precautions.map(claim => claim.statement) ?? [];
}

/** Why a standing or walking habit cannot remind, in one line for its row; `undefined` when it can. */
export function movementBlock(habit: MovementHabit, profile: UserProfile | undefined): string | undefined {
  if (habitOffered(habit, profile)) return undefined;
  return habit === 'sittingBreak'
    ? 'Off: with an open foot wound or active Charcot foot, the app does not ask you to stand.'
    : 'Off: with an open foot wound or active Charcot foot, the app does not suggest walks.';
}
