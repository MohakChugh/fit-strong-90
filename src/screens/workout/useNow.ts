import { useEffect, useState } from 'react';

/**
 * The clock, re-read while `active`: every `ms`, and the moment the page is
 * visible again. Anything shown from it is computed from a deadline
 * (`restLeftMs`), so a tab the phone throttled or suspended is right on its
 * first tick back rather than counting from where it stopped.
 */
export function useNow(active: boolean, ms = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    const id = window.setInterval(tick, ms);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [active, ms]);
  return now;
}
