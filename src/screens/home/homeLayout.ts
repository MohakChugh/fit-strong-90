/**
 * Home's tile layout, for the screens that change it besides Home: Browse's
 * More and Me's offers (journey §5.1, §14).
 *
 * It's the person's own layout once one is stored, or else the defaults from
 * their answers, the same as Home draws. Every change is made to the layout
 * as it stands at that moment, a change still being written included, so
 * quick taps build on each other, as in Edit Home.
 */
import { useMemo } from 'react';
import { categoryById, defaultHome, relevantCategories, type CategoryId } from '@/categories';
import { createDefaultProfile } from '@/profile/defaults';
import type { StoreResult } from '@/store/db';
import { getState, setSettings, useStore } from '@/store/useStore';
import type { HomeLayout } from '@/types';
import { addButton, addTile, storedLayout } from './layout';

export function useHomeLayout(): { layout: HomeLayout; fallback: HomeLayout; stored: HomeLayout | undefined; relevant: CategoryId[] } {
  const { profile, settings, observations } = useStore();
  const hasSteps = useMemo(() => observations.some(o => o.kind === 'steps'), [observations]);
  const answers = useMemo(() => ({
    profile: profile ?? createDefaultProfile({ weightKg: settings.currentWeight || 0, needsHealthReview: true }),
    settings,
    hasSteps,
  }), [profile, settings, hasSteps]);
  const fallback = useMemo(() => defaultHome(answers), [answers]);
  const relevant = useMemo(() => relevantCategories(answers), [answers]);
  const stored = storedLayout(settings.home);
  return { layout: stored ?? fallback, fallback, stored, relevant };
}

/** The layout as it stands this moment, a change still being written included. */
export function layoutNow(fallback: HomeLayout): HomeLayout {
  return storedLayout(getState().settings.home) ?? fallback;
}

/** One Edit Home operation on the layout as it stands, then stored; `undefined` when it changed nothing. */
export function changeHome(fallback: HomeLayout, op: (layout: HomeLayout) => HomeLayout): { next: HomeLayout; saved: Promise<StoreResult> } | undefined {
  const before = layoutNow(fallback);
  const next = op(before);
  return next === before ? undefined : { next, saved: setSettings({ home: next }) };
}

/**
 * "Add Glucose to Home?" answered (journey §5.1). Either answer means it is
 * never offered again; Add also puts the tile at the end of its group, in
 * the same write. When that group has filled meanwhile, nothing is written
 * and `undefined` comes back, so the offer stays to answer.
 */
export function answerOffer(fallback: HomeLayout, id: CategoryId, add: boolean): Promise<StoreResult> | undefined {
  const offered = getState().settings.homeOffered ?? [];
  const homeOffered = offered.includes(id) ? [...offered] : [...offered, id];
  if (!add) return setSettings({ homeOffered });
  const before = layoutNow(fallback);
  if (before.order[categoryById(id).group].includes(id)) return setSettings({ homeOffered });
  if (addButton(before, id).disabled) return undefined;
  return setSettings({ home: addTile(before, id), homeOffered });
}
