import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { erasedGeneration } from '@/walk/consent';
import { cachedJournal, journalPort } from '@/walk/journalPort';
import type { RouteLine, RouteRecord } from '@/walk/routeRecord';

/**
 * A walk's route, told apart (H6-06): not kept; still being read back;
 * unreadable just now; or here, with `lines` absent when the walk genuinely
 * kept none. Saving never waits on it: the save reads the journal's route in
 * its own transaction when the screen has none.
 */
export type WalkRoute =
  | { state: 'none' }
  | { state: 'loading' }
  | { state: 'failed' }
  /** "Erase all routes" ran while this screen was open (B-05): what it had read is gone too. */
  | { state: 'erased' }
  | { state: 'ready'; lines?: RouteLine[] };

const NONE: WalkRoute = { state: 'none' };
const LOADING: WalkRoute = { state: 'loading' };
const ERASED: WalkRoute = { state: 'erased' };

/**
 * A walk's route: the saved one, or, before the walk is saved, the one
 * journalled as it was walked (this page's copy first, then IndexedDB).
 * Nothing for a walk whose route isn't kept.
 */
export function useWalkRoute(walkId: string, kept: boolean): WalkRoute {
  const { records, settings } = useStore();
  const saved = records.routes.find(r => r.walkId === walkId) as RouteRecord | undefined;
  // B-05: an erase while this is open, in any tab, takes the lines already read with it.
  const erased = erasedGeneration(settings.walk);
  const [erasedOpen] = useState(erased);
  const [read, setRead] = useState<WalkRoute | undefined>(() => {
    const here = cachedJournal(walkId);
    return here ? { state: 'ready', ...(here.route ? { lines: here.route } : {}) } : undefined;
  });
  useEffect(() => {
    if (saved || !kept || read) return;
    let current = true;
    journalPort().read(walkId).then(
      entry => { if (current) setRead({ state: 'ready', ...(entry?.route ? { lines: entry.route } : {}) }); },
      () => { if (current) setRead({ state: 'failed' }); },
    );
    return () => { current = false; };
  }, [walkId, kept, saved, read]);
  if (saved) return { state: 'ready', lines: saved.segments };
  if (!kept) return NONE;
  if (erased !== erasedOpen) return ERASED;
  return read ?? LOADING;
}
