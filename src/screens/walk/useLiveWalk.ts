import { useSyncExternalStore } from 'react';
import { liveWalk } from '@/walk/browser';
import type { LiveSnapshot, LiveWalk } from '@/walk/live';

/**
 * The live walk and its latest snapshot. The controller publishes about once
 * a second, so this re-renders the screen at about 1 Hz however fast the
 * sensors run (D18).
 */
export function useLiveWalk(): { live: LiveWalk; snapshot: LiveSnapshot | null } {
  const live = liveWalk();
  const snapshot = useSyncExternalStore(live.subscribe, live.getSnapshot, live.getSnapshot);
  return { live, snapshot };
}
