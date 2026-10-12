/**
 * Screen Wake Lock, as the live walk's port, with ownership.
 *
 * A request can take a while to be granted, and the walk may let go in the
 * meantime — the screen closed, the walk finished. Each request belongs to a
 * generation; letting go starts a new one. A grant that arrives for an old
 * generation is released at once, so leaving Walk never leaves the screen
 * held awake, and an old request can never release a newer lock (re-audit
 * F34). Pure apart from the platform it is given, so it is tested in node.
 */

import type { WakeLockPort } from './live';

/** The part of a `WakeLockSentinel` used here. */
export interface SentinelLike {
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
}

/** The part of `navigator.wakeLock` used here. */
export interface WakeLockApi {
  request(type: 'screen'): Promise<SentinelLike>;
}

const quietly = (sentinel: SentinelLike | null | undefined) => void sentinel?.release().catch(() => {});

export function createWakeLockPort(api: WakeLockApi, visible: () => boolean): WakeLockPort {
  let generation = 0;
  let held: SentinelLike | null = null;

  return {
    async request(onLost) {
      const mine = ++generation;
      // Only a visible page can hold the lock; asking from a hidden one is refused.
      if (!visible()) return false;
      // A lock from before this request is already dead (the page was hidden)
      // or about to be replaced; let it go.
      quietly(held);
      held = null;
      let sentinel: SentinelLike;
      try {
        sentinel = await api.request('screen');
      } catch {
        return false;
      }
      if (mine !== generation) {
        // Let go of, or overtaken, while this was waiting: not ours to keep.
        quietly(sentinel);
        return false;
      }
      held = sentinel;
      sentinel.addEventListener('release', () => {
        if (held === sentinel) held = null;
        // Only the lock the walk still owns is worth telling it about.
        if (mine === generation) onLost();
      });
      return true;
    },

    release() {
      generation += 1;
      const letting = held;
      held = null;
      quietly(letting);
    },
  };
}
