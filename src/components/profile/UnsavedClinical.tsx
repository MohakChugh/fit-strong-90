import { useContext, useLayoutEffect, useRef, useState } from 'react';
import { Group, Row } from '@/components/hig/List';
import { discardClinical, retryClinical, useClinicalUnsaved } from '@/setup/effective';
import { PauseClaimContext } from './pauseClaim';

/**
 * While a clinical answer couldn't be stored (board D197): the way out, Try
 * again and Discard changes, in a card that lists the pause among its reasons
 * (Readiness, a hub's Right now). The shared surface says the pause itself, on
 * every screen (board D224). Once they're gone, the region stays, saying what
 * happened, with focus on it, so neither the place nor the news is lost
 * (H5F-12). A card draws it whatever its answer, so it stays as the hold lifts.
 */
export function UnsavedClinical() {
  const unsaved = useClinicalUnsaved();
  // In a full-screen task, the way out drawn here is the task's: its surface doesn't repeat it (board D224).
  const claim = useContext(PauseClaimContext);
  useLayoutEffect(() => claim?.(), [claim]);
  const [said, setSaid] = useState<string>();
  const [busy, setBusy] = useState(false);
  const region = useRef<HTMLDivElement>(null);
  const done = (text: string) => {
    setSaid(text);
    region.current?.focus();
  };
  const retry = async () => {
    if (busy) return;
    setBusy(true);
    const saved = await retryClinical();
    setBusy(false);
    if (!saved) return;
    if (saved.ok) done('Saved. Movement follows your health answers again.');
    else setSaid(`That did not save. ${saved.failure.message}`);
  };
  const discard = () => {
    discardClinical();
    done('Not kept. The health answers stored before stand.');
  };
  // Nothing waiting and nothing said: no place taken in the card's layout.
  if (!unsaved && said === undefined) return null;
  return (
    <div ref={region} tabIndex={-1} className="outline-none">
      <p role="status" className="px-4 pb-2 text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{said}</p>
      {unsaved && (
        <Group>
          <Row onClick={() => void retry()} label={<span className="text-tint">{busy ? 'Saving…' : 'Try again'}</span>} />
          <Row onClick={discard} label={<span className="text-tint">Discard changes</span>} />
        </Group>
      )}
    </div>
  );
}
