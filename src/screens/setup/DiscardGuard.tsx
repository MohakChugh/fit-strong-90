import { useRef } from 'react';
import { useBlocker } from 'react-router-dom';
import { ConfirmSheet } from '@/screens/track/ui';

/**
 * Leaving with clinical changes that aren't stored asks once (board D198):
 * "Discard your changes?" Back, the tab bar and the browser's Back all ask.
 * Discard changes drops them and goes on; Cancel stays, with the changes.
 * `open`: asked by the screen itself, for a Back or Close of its own whose
 * store was refused; `onDone` says whether they were discarded.
 */
export function DiscardGuard({ dirty, onDiscard, open = false, onDone }: {
  dirty: boolean;
  onDiscard: () => void;
  open?: boolean;
  onDone?: (discarded: boolean) => void;
}) {
  const leaving = useRef(false);
  const blocker = useBlocker(() => !leaving.current && dirty);
  const discard = () => {
    onDiscard();
    leaving.current = true;
    if (blocker.state === 'blocked') blocker.proceed();
    else onDone?.(true);
  };
  const stay = () => {
    if (blocker.state === 'blocked') blocker.reset();
    else onDone?.(false);
  };
  return (
    <ConfirmSheet
      open={blocker.state === 'blocked' || open}
      onOpenChange={next => { if (!next) stay(); }}
      title="Discard your changes?"
      detail="Your health answers here aren’t saved. Discarded, the ones already stored stay."
      confirm="Discard changes"
      onConfirm={discard}
    />
  );
}
