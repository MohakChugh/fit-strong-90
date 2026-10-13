import { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router-dom';

/**
 * A Back, or any other way off the screen, while a sheet's save is being
 * written waits for it (B-03, §4.5; codex F-food-04): `settle(true)` once
 * it's stored lets the leave go on, `settle(false)` once it's refused keeps
 * the screen, with the draft and the reason. Close, a swipe and Escape are
 * the sheet's own `onOpenChange` and `dismissible`.
 */
export function useSaveHold(saving: boolean): (stored: boolean) => void {
  const blocker = useBlocker(saving);
  // The blocker as it is now, for a handler that awaited the save.
  const latest = useRef(blocker);
  useEffect(() => {
    latest.current = blocker;
  });
  return stored => {
    const b = latest.current;
    if (b.state !== 'blocked') return;
    if (stored) b.proceed();
    else b.reset();
  };
}
