/**
 * Room for the toasts standing above the tab bar (M19, B-04). An Undo now
 * stands until its screen, and the details opened from it, are left, so on a
 * small phone a detail's last row, its Delete, can sit under one with
 * nothing below it to scroll. The shell keeps this much room under every
 * screen while toasts stand, so the row scrolls clear of them.
 */
import { useEffect, useState } from 'react';

/** Sonner's gap between toasts (its default), kept above the top one too. */
const GAP = 14;

/** The height the toasts take, a gap above each; one on its way out (`data-removed`) takes none. */
export function toastSpace(toasts: Iterable<{ offsetHeight: number; dataset: { removed?: string } }>): number {
  let space = 0;
  for (const t of toasts) if (t.dataset.removed !== 'true') space += t.offsetHeight + GAP;
  return space;
}

/** `toastSpace` of the toasts in `#toasts` (main.tsx), kept up to date as they come, change their words and go. */
export function useToastSpace(): number {
  const [space, setSpace] = useState(0);
  useEffect(() => {
    const host = document.getElementById('toasts');
    if (!host) return undefined;
    const measure = () => setSpace(toastSpace(host.querySelectorAll<HTMLElement>('[data-sonner-toast]')));
    const watch = new MutationObserver(measure);
    watch.observe(host, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-removed'] });
    measure();
    return () => watch.disconnect();
  }, []);
  return space;
}
