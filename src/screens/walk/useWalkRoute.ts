import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { cachedJournal, journalPort } from '@/walk/journalPort';
import type { RouteLine, RouteRecord } from '@/walk/routeRecord';

/**
 * A walk's route: the saved one, or, before the walk is saved, the one
 * journalled as it was walked (this page's copy first, then IndexedDB).
 * Nothing for a walk whose route isn't kept.
 */
export function useWalkRoute(walkId: string, kept: boolean): RouteLine[] | undefined {
  const { records } = useStore();
  const saved = records.routes.find(r => r.walkId === walkId) as RouteRecord | undefined;
  const [journalled, setJournalled] = useState<RouteLine[] | undefined>(() => cachedJournal(walkId)?.route);
  useEffect(() => {
    if (saved || !kept || journalled) return;
    let current = true;
    void journalPort().read(walkId).then(entry => {
      if (current && entry?.route) setJournalled(entry.route);
    });
    return () => { current = false; };
  }, [walkId, kept, saved, journalled]);
  return saved?.segments ?? (kept ? journalled : undefined);
}
