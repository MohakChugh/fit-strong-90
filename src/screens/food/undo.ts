/**
 * Undo for a food delete (B-04, B-05): offered at once, on no timer, the two
 * latest standing. Each belongs to the screen the person returns to, and
 * leaving that screen ends it, as an unrelated change ends them all. Kept
 * here rather than in a screen, so a toast raised as the sheet closes
 * outlives the sheet.
 */
import { useEffect } from 'react';
import { toast } from 'sonner';
import { TOAST_STYLE, UNDO_STYLE } from '@/components/hig/toast';
import { FOOD_COPY } from '@/food/copy';

interface Offer {
  key: string;
  /** The path of the screen it belongs to. */
  scope: string;
}

let offers: Offer[] = [];
let seq = 0;

const forget = (key: string) => {
  offers = offers.filter(o => o.key !== key);
};

/** Offer Undo. `undo` restores the record, and says why if it couldn't. */
export function offerFoodUndo({ text, restored, scope, undo }: {
  text: string;
  restored: string;
  scope: string;
  undo: () => Promise<string | undefined>;
}): void {
  const key = `food-undo-${++seq}`;
  offers = [...offers, { key, scope }];
  // Two at most, the newer stacked above the older; restoring one keeps the other (B-04).
  while (offers.length > 2) {
    const [oldest, ...rest] = offers;
    toast.dismiss(oldest.key);
    offers = rest;
  }
  toast(text, {
    id: key, duration: Infinity, style: TOAST_STYLE, actionButtonStyle: UNDO_STYLE,
    action: {
      label: FOOD_COPY.undo,
      onClick: event => {
        // The toast stays until the record is stored back (as Edit Home's Undo does).
        event.preventDefault();
        void undo().then(problem => {
          if (problem) {
            toast(`${FOOD_COPY.didNotSave} ${problem}`, { style: TOAST_STYLE });
            return;
          }
          forget(key);
          toast.dismiss(key);
          toast(restored, { style: TOAST_STYLE });
        });
      },
    },
    onDismiss: () => forget(key),
  });
}

/** Ends every Undo standing, or only one screen's: leaving it, or an unrelated change (B-04). */
export function endFoodUndos(scope?: string): void {
  for (const o of offers) if (scope === undefined || o.scope === scope) toast.dismiss(o.key);
  offers = scope === undefined ? [] : offers.filter(o => o.scope !== scope);
}

/** How many mounted screens hold each scope. */
const holders = new Map<string, number>();

/**
 * Holds a screen's scope while it's mounted; the function returned lets go.
 * A screen remounted at once (React StrictMode runs every effect twice in
 * development) hasn't been left, so its Undo is ended only if nothing holds
 * the scope once the current turn is over.
 */
export function holdFoodUndoScope(path: string): () => void {
  holders.set(path, (holders.get(path) ?? 0) + 1);
  return () => {
    const left = (holders.get(path) ?? 1) - 1;
    if (left > 0) holders.set(path, left);
    else holders.delete(path);
    setTimeout(() => {
      if (!holders.has(path)) endFoodUndos(path);
    }, 0);
  };
}

/** A screen food Undo toasts can belong to: leaving it ends its own. */
export function useFoodUndoScope(path: string): void {
  useEffect(() => holdFoodUndoScope(path), [path]);
}
