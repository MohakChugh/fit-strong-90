/**
 * Room for the toasts standing above the tab bar (M19, B-04). An Undo now
 * stands until its screen, and the details opened from it, are left, so on a
 * small phone a detail's last row, its Delete, can sit under one with
 * nothing below it to scroll. The shell keeps this much room under every
 * screen while toasts stand, so the row scrolls clear of them. And on a
 * screen too short for two at the text size chosen, one shows at a time, so
 * they never cover most of it; the next waits its turn, as it was.
 */
import { useEffect, useState } from 'react';

/** Sonner's gap between toasts (its default), kept above the top one too. */
const GAP = 14;

type ToastBox = { offsetHeight: number; dataset: { removed?: string; visible?: string } };

/** The height the toasts take, a gap above each; one on its way out (`data-removed`), or waiting its turn (`data-visible`), takes none. */
export function toastSpace(toasts: Iterable<ToastBox>): number {
  let space = 0;
  for (const t of toasts) if (t.dataset.removed !== 'true' && t.dataset.visible !== 'false') space += t.offsetHeight + GAP;
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
    watch.observe(host, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-removed', 'data-visible'] });
    measure();
    return () => watch.disconnect();
  }, []);
  return space;
}

/**
 * How many toasts show at once: one on a screen fewer than 24 lines of body text tall (a small phone at a
 * large text size, where two would cover most of it), up to three elsewhere, sonner's own number.
 */
export function toastsShown(screenPx: number, rootPx: number): number {
  return screenPx < 24 * rootPx ? 1 : 3;
}

const roomNow = () => toastsShown(window.innerHeight, parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);

/** `toastsShown` for this screen, kept up to date as it turns and as the text size changes (the root's font size, `applyTextScale`). */
export function useToastRoom(): number {
  const [shown, setShown] = useState(roomNow);
  useEffect(() => {
    const update = () => setShown(roomNow());
    window.addEventListener('resize', update);
    const watch = new MutationObserver(update);
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    return () => {
      window.removeEventListener('resize', update);
      watch.disconnect();
    };
  }, []);
  return shown;
}
