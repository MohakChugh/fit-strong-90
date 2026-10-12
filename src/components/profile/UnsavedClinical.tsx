import { useRef, useState } from 'react';
import { TriangleAlertIcon } from 'lucide-react';
import { Group, Row } from '@/components/hig/List';
import { CLINICAL_UNSAVED } from '@/engine/readiness';
import { discardClinical, retryClinical, useClinicalUnsaved } from '@/setup/effective';

/**
 * While a clinical answer couldn't be stored (board D197): that said, with
 * Try again and Discard changes, wherever the day's answer is read. Once
 * they're gone, the region stays, saying what happened, with focus on it, so
 * neither the place nor the news is lost (H5F-12). A card that says the pause
 * draws it whatever its answer, so it stays as the hold lifts.
 */
export function UnsavedClinical({ stated = false }: {
  /** The card around it already says the pause (Readiness, a hub's Right now): only the way out, then. */
  stated?: boolean;
}) {
  const unsaved = useClinicalUnsaved();
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
  // Nothing waiting and nothing said: no place taken in the screen's layout.
  if (!unsaved && said === undefined) return null;
  return (
    <div ref={region} tabIndex={-1} className="outline-none">
      <p role="status" className="px-4 pb-2 text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{said}</p>
      {unsaved && (
        <Group footer={stated ? undefined : 'Until they’re saved, or the changes discarded, no session starts and water reminders pause.'}>
          {!stated && <Row icon={<TriangleAlertIcon className="text-caution" />} label={CLINICAL_UNSAVED} />}
          <Row onClick={() => void retry()} label={<span className="text-tint">{busy ? 'Saving…' : 'Try again'}</span>} />
          <Row onClick={discard} label={<span className="text-tint">Discard changes</span>} />
        </Group>
      )}
    </div>
  );
}
