/**
 * Undo, for every routine delete (B-04, M19; board D113): at most two
 * standing, the newer stacked above the older, and restoring one keeps the
 * other. Never on a timer. Leaving the screen it was offered on and the
 * details opened from it, or any edit the store stores, ends it; Recently
 * deleted remains. What happens after a tap is said in the same toast, in
 * place, until it is closed or its screen is left (K8-03): a restore, a
 * restore that didn't save beside Undo to try again, or one with nothing to
 * put back, which is no failure (K8-06). Plan 7's food Undo, moved here, so
 * every kind shares one stack.
 */
import { toast } from 'sonner';
import { TOAST_STYLE, UNDO_STYLE } from './toast';
import { follow, scopeOf, type Place, type Scope } from './undoScope';

interface Offer {
  key: string;
  scope: Scope;
  /** The Recently deleted entry it restores, when it has one. */
  entry?: string;
  /** Still an Undo; once its record is back, a line saying so. */
  undo: boolean;
}

export const UNDO_LABEL = 'Undo';
export const CLOSE_LABEL = 'Close';
export const NOT_RESTORED = 'It wasn’t restored.';

/** What an Undo's restore did: back (with words of its own, when it had nothing to put back), or not, and why. */
export type UndoOutcome = { done: true; said?: string } | { done: false; problem: string };

let offers: Offer[] = [];
let seq = 0;
/** Moves on whenever every offer ends at once, so a restore that settles after its offer was ended can tell (P8S-16). */
let generation = 0;

const forget = (key: string) => {
  offers = offers.filter(o => o.key !== key);
};
const drop = (key: string) => {
  toast.dismiss(key);
  forget(key);
};

/** Offer Undo. `undo` puts the record back, and says why when it couldn't. */
export function offerUndo({ text, restored, scope, entry, undo }: {
  text: string;
  /** Said in its place once it is back: "Water 500 ml restored". */
  restored: string;
  /** The screen it is offered on: where the person is, or is going back to. */
  scope: string;
  entry?: string;
  undo: () => Promise<UndoOutcome>;
}): void {
  const key = `undo-${++seq}`;
  const born = generation;
  /** This offer still stands: the same one, on a screen it belongs to. */
  const standing = () => born === generation && offers.some(o => o.key === key);
  offers = [...offers, { key, scope: scopeOf(scope), undo: true, ...(entry ? { entry } : {}) }];
  // Two at most, the newer stacked above the older; restoring one keeps the other (B-04).
  for (const old of offers.filter(o => o.undo).slice(0, -2)) drop(old.key);
  // One restore at a time: a second tap while the first saves would ask for the entry twice.
  let saving = false;
  const tap = (event: { preventDefault(): void }) => {
    // The toast stays until the record is stored back (as Edit Home's Undo does).
    event.preventDefault();
    if (saving) return;
    saving = true;
    void undo().then(outcome => {
      saving = false;
      // Ended while it saved (its screen left, an edit stored, closed or swiped away): it says
      // nothing now, on a screen it no longer belongs to, and every other offer stays (P8S-16).
      if (!standing()) return;
      if (!outcome.done) {
        // The error stays next to its cause, with Undo to try again (J§20.4 rule 9).
        show(`${text}. ${NOT_RESTORED} ${outcome.problem}`, 'undo');
        return;
      }
      offers = offers.map(o => (o.key === key ? { ...o, undo: false } : o));
      show(outcome.said ?? restored, 'close');
    });
  };
  const show = (words: string, kind: 'undo' | 'close') => toast(words, {
    id: key, duration: Infinity, style: TOAST_STYLE, actionButtonStyle: UNDO_STYLE,
    action: kind === 'undo' ? { label: UNDO_LABEL, onClick: tap } : { label: CLOSE_LABEL, onClick: () => forget(key) },
    onDismiss: () => forget(key),
  });
  show(text, 'undo');
}

/** Ends every Undo, and every line one left: an edit was stored (B-04). */
export function endUndos(): void {
  for (const o of offers) toast.dismiss(o.key);
  offers = [];
  generation += 1;
}

/** Ends the Undo for an entry restored another way, from Recently deleted; the other stays. */
export function dismissUndoFor(entry: string): void {
  for (const o of offers) if (o.entry === entry) toast.dismiss(o.key);
  offers = offers.filter(o => o.entry !== entry);
}

/** After every navigation (`main.tsx`): an Undo, or its line, whose screen and details were left ends. */
export function followPlace(place: Place): void {
  offers = offers.flatMap(o => {
    const scope = follow(o.scope, place);
    if (scope) return [{ ...o, scope }];
    toast.dismiss(o.key);
    return [];
  });
}

/** Tests only. */
export function resetUndosForTests(): void {
  offers = [];
  seq = 0;
  generation += 1;
}
