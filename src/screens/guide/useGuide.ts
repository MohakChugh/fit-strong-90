import { useMemo, useSyncExternalStore } from 'react';
import { contextFromProfile, type GuideContext } from '@/content';
import { getState, setProfile, useStore } from '@/store/useStore';
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
  /** False before onboarding has stored a profile: food choices are for this visit only. */
  canSaveFood: boolean;
}

/** What the Guide knows about the person, rebuilt only when their answers change. */
export function useGuide(): Guide {
  const { profile, settings } = useStore();
  const fromSession = useSyncExternalStore(subscribe, readSessionFood, readSessionFood);
  const food = profile?.food ?? fromSession;
  const fluidLimit = settings.habits?.fluidLimit;
  const ctx = useMemo(() => contextFromProfile(profile, food, { fluidLimit }), [profile, food, fluidLimit]);
  return { ctx, food, canSaveFood: profile !== undefined };
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
