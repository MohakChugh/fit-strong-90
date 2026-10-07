import { useEffect, useRef } from 'react';

/**
 * Keep the screen on while `active` (Screen Wake Lock API). The lock is
 * released whenever the page is hidden, so it is re-requested on return.
 * iOS Home Screen apps support this from iOS 18.4 (spec §7.1).
 */
export function useWakeLock(active: boolean): void {
  const lock = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let cancelled = false;
    const request = async () => {
      try {
        if (document.visibilityState !== 'visible') return;
        const sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) void sentinel.release();
        else lock.current = sentinel;
      } catch {
        // Not allowed (battery saver, unsupported context): the session still works.
      }
    };
    void request();
    const onVisible = () => { if (document.visibilityState === 'visible') void request(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock.current?.release().catch(() => {});
      lock.current = null;
    };
  }, [active]);
}
