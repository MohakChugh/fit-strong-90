import { useMemo, useSyncExternalStore } from 'react';
import { contextFromProfile, type GuideContext } from '@/content';
import { allergyAnswer, setupAllergyAnswer, type AllergyAnswer } from '@/food/allergens';
import { ALLERGIES_CHANGED, answerNoAllergies, useSetupSession } from '@/setup/draft';
import { StoreFailure } from '@/store/db';
import { sameValue } from '@/store/transfer';
import { getState, setProfile, update, useStore } from '@/store/useStore';
import type { AppData } from '@/types';
import type { FoodPreferences } from '@/types/profile';

/**
 * Food choices for a person who has no profile yet ("Explore first"). The
 * profile is the only place food preferences are saved, and inventing a
 * profile to hold them would record health answers they never gave, so the
 * choice lasts for this visit and the picker says so.
 */
let sessionFood: FoodPreferences | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

const readSessionFood = () => sessionFood;

export interface Guide {
  ctx: GuideContext;
  food?: FoodPreferences;
  /**
   * What the person is allergic to as far as it's known: the food record's, or setup's waiting answer
   * without one, this session's while setup goes on without saving (board D205; Plan 5's B-07). Absent is
   * not known, never none: meal ideas ask first.
   */
  allergies?: AllergyAnswer;
  /** What meal ideas are filtered by: the food record with the allergies as known, setup's where the record has none (H5R-10). */
  filter?: Partial<FoodPreferences>;
  /** False before onboarding has stored a profile: food choices are for this visit only. */
  canSaveFood: boolean;
}

/** What the Guide knows about the person, rebuilt only when their answers change. */
export function useGuide(): Guide {
  const { profile, settings } = useStore();
  const fromSession = useSyncExternalStore(subscribe, readSessionFood, readSessionFood);
  const food = profile?.food ?? fromSession;
  const fluidLimit = settings.habits?.fluidLimit;
  // Setup going on without saving keeps its answers in this session (Plan 5's B-07, H5-06).
  const session = useSetupSession();
  const allergies = useMemo(() => allergyAnswer(food, settings.setup, session), [food, settings.setup, session]);
  const ctx = useMemo(() => ({ ...contextFromProfile(profile, food, { fluidLimit }), ...(allergies ? { allergies } : {}) }), [profile, food, fluidLimit, allergies]);
  return { ctx, food, ...(allergies ? { allergies, filter: { ...food, ...allergies } } : {}), canSaveFood: profile !== undefined };
}

/** The allergy answer as a screen shows it: the food record's, setup's, and its own words as typed (board D221). */
export const allergiesShown = (d: Pick<AppData, 'profile' | 'settings'>): unknown[] =>
  [d.profile?.food?.allergies, d.profile?.food?.customAllergies, setupAllergyAnswer(d.settings.setup), d.settings.setup?.draft?.raw?.customAllergies];

/**
 * "No food allergies", in one tap, where meal ideas ask first (owner
 * decision; Plan 5's board D194): into the food record, or this visit's
 * choices with no profile, or with no record at all, into the answer setup
 * keeps for one (`answerNoAllergies`). Only over the answer it was shown:
 * refused, inside its transaction, once another copy has replaced the record
 * or changed its allergies (H5F-07; board D221). Returns the message to show
 * when it wasn't stored.
 */
export async function saveNoAllergies(): Promise<string | undefined> {
  // What the person was shown at the tap: the record, and its allergy answer.
  const generation = getState().epoch;
  const shown = allergiesShown(getState());
  const unchanged = (d: AppData) => sameValue(allergiesShown(d), shown);
  const none = <T extends Partial<FoodPreferences>>(food: T): T => {
    const next = { ...food, allergies: [] };
    delete next.customAllergies;
    return next;
  };
  if (!getState().profile && sessionFood) {
    sessionFood = none(sessionFood);
    for (const listener of [...listeners]) listener();
    return undefined;
  }
  const result = getState().profile?.food
    ? await update(d => {
      if (!unchanged(d)) throw new StoreFailure('conflict', ALLERGIES_CHANGED);
      return d.profile?.food ? { ...d, profile: { ...d.profile, food: none(d.profile.food) } } : d;
    }, { generation })
    : await answerNoAllergies(unchanged);
  return result && !result.ok ? result.failure.message : undefined;
}

/**
 * Save the person's food choices. Returns the message to show when the device
 * refused the write; nothing is swallowed (BUILD-BRIEF, Data).
 */
export async function saveFood(food: FoodPreferences): Promise<string | undefined> {
  const profile = getState().profile;
  if (!profile) {
    sessionFood = food;
    for (const listener of [...listeners]) listener();
    return undefined;
  }
  const result = await setProfile({ ...profile, food });
  return result.ok ? undefined : result.failure.message;
}
