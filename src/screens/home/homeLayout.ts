/**
 * Home's tile layout, for the screens that change it besides Home: Browse's
 * More and Me's offers (journey §5.1, §14).
 *
 * It's the person's own layout once one is stored, or else the defaults from
 * their answers, the same as Home draws. Each change is an operation, applied
 * in the store's own transaction to the layout as it stands there (codex
 * H4-03): another tab's change since is built on, never written over, and a
 * change ahead of it that failed is never carried forward. What it would
 * make now is said at once, as in Edit Home.
 */
import { useMemo } from 'react';
import { categoryById, defaultHome, relevantCategories, type CategoryId } from '@/categories';
import { createDefaultProfile } from '@/profile/defaults';
import type { StoreResult } from '@/store/db';
import { getState, update, useStore } from '@/store/useStore';
import type { AppData, HomeLayout } from '@/types';
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

/** The layout a record holds, or the defaults. */
const layoutIn = (data: AppData, fallback: HomeLayout): HomeLayout => storedLayout(data.settings.home) ?? fallback;

/**
 * One Edit Home operation: `next` is what it makes of the layout as it stands
 * now, and `saved` applies it again where it is written, to the layout as it
 * stands then. `undefined` when it changes nothing now.
 */
export function changeHome(fallback: HomeLayout, op: (layout: HomeLayout) => HomeLayout): { next: HomeLayout; saved: Promise<StoreResult> } | undefined {
  const before = layoutNow(fallback);
  const next = op(before);
  if (next === before) return undefined;
  const saved = update(previous => {
    const at = layoutIn(previous, fallback);
    const made = op(at);
    return made === at ? previous : { ...previous, settings: { ...previous.settings, home: made } };
  });
  return { next, saved };
}

/**
 * "Add Glucose to Home?" answered (journey §5.1). Either answer means it is
 * never offered again; Add also puts the tile at the end of its group, in the
 * same write. The group's room and the answers so far are read where it is
 * written, so another tab's answers are kept and a group it filled meanwhile
 * is never overfilled (codex H4-03). When there is no room, nothing is
 * written and the offer stays to answer: `undefined` when there is none now,
 * and `value: false` when another tab took it first.
 */
export function answerOffer(fallback: HomeLayout, id: CategoryId, add: boolean): Promise<StoreResult<boolean>> | undefined {
  const { group } = categoryById(id);
  const room = (layout: HomeLayout) => layout.order[group].includes(id) || !addButton(layout, id).disabled;
  if (add && !room(layoutNow(fallback))) return undefined;
  // Whether the write that lands answered it: the updater runs again if what it read changes before its turn.
  let answered = false;
  const saved = update(previous => {
    const offered = previous.settings.homeOffered ?? [];
    const homeOffered = offered.includes(id) ? offered : [...offered, id];
    const at = layoutIn(previous, fallback);
    answered = !add || room(at);
    if (!answered) return previous;
    const home = add && !at.order[group].includes(id) ? { home: addTile(at, id) } : {};
    return homeOffered === offered && !('home' in home) ? previous : { ...previous, settings: { ...previous.settings, ...home, homeOffered } };
  });
  return saved.then(r => (r.ok ? { ok: true, value: answered } : r));
}
