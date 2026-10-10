/**
 * Where setup stands (journey §6, §18.1, §19.1). A v1 record has no
 * `settings.setup`, and one Plan 4 wrote has only `declined`. Its state is
 * read from what v1 kept, and written the first time something changes it.
 * There's no migration step and no interstitial (§6.6).
 */
import type { AppData, UserSettings } from '@/types';
import type { UserProfile } from '@/types/profile';
import type { ChapterId, SetupAnswers, SetupState } from '@/types/setup';

/** The chapters a v1 record has new questions in: name, food logging, and meal times for after-meal walks (§6.6, board D79). */
export function upgradeSkipped(settings: Pick<UserSettings, 'habits'>, profile: UserProfile): ChapterId[] {
  const walk = settings.habits?.mealWalk;
  return [
    ...(profile.name === undefined ? ['about' as const] : []),
    ...(profile.food?.level === undefined ? ['food' as const] : []),
    ...(walk?.enabled && walk.meals.some(meal => !walk.finish?.[meal]) ? ['day' as const] : []),
  ];
}

export function setupStateOf(settings: Pick<UserSettings, 'setup' | 'onboardingComplete' | 'habits'>, profile: UserProfile | undefined): SetupState {
  const stored = settings.setup ?? {};
  if (stored.stage !== undefined) return { ...stored, stage: stored.stage, skipped: stored.skipped ?? [] };
  const declined = stored.declined?.length ? { declined: [...stored.declined] } : {};
  if (!settings.onboardingComplete) return { stage: 'open', skipped: [], ...declined };
  if (!profile) return { stage: 'lookAround', skipped: [], upgraded: true, ...declined };
  return { stage: 'done', skipped: upgradeSkipped(settings, profile), upgraded: true, ...declined };
}

/** The answers so far, wherever they're kept. */
export const answersOf = (s: SetupState): SetupAnswers => s.draft?.answers ?? s.answers ?? {};

/** The one-time "FitStrong has a new Home" row was answered (§6.6). */
export function withNewHomeSeen(data: AppData): AppData {
  return { ...data, settings: { ...data.settings, setup: { ...setupStateOf(data.settings, data.profile), newHomeSeen: true } } };
}
