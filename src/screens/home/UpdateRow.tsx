/**
 * Home's update line (J§21.2, board D106; `src/app/updates.ts`): "An update is
 * ready. It applies the next time FitStrong opens." "Restart to update" only
 * with nothing under way in this window and no other window of FitStrong
 * open; with one open, it says to close it. After an update, "Updated" until
 * it is dismissed: never on a timer (K8-03).
 */
import { useEffect } from 'react';
import { RefreshCwIcon } from 'lucide-react';
import { Group, Row } from '@/components/hig/List';
import { DISMISS, RESTART, countWindows, dismissUpdated, restartToUpdate, updateLine, useUpdates } from '@/app/updates';
import { underWay } from '@/app/underWay';
import { useStore } from '@/store/useStore';

export function UpdateRow() {
  const s = useUpdates();
  // Drawn again as a write starts or ends; a walk or a workout changes only on its own screen, before Home.
  const { saving } = useStore();
  // Counted again on every return to the app: a window closed elsewhere lets the restart in.
  useEffect(() => {
    if (!s.waiting) return;
    const again = () => {
      if (document.visibilityState === 'visible') void countWindows();
    };
    void countWindows();
    document.addEventListener('visibilitychange', again);
    return () => document.removeEventListener('visibilitychange', again);
  }, [s.waiting]);
  const line = updateLine(s, saving || underWay());
  if (!line) return null;
  return (
    <Group>
      <Row role="status" icon={<RefreshCwIcon />} label={line.text} {...(line.detail ? { detail: line.detail } : {})} />
      {line.action === 'restart' && (
        <Row data-main="" className="min-h-[3.75rem]" onClick={() => void restartToUpdate()} label={<span className="font-semibold text-tint">{RESTART}</span>} />
      )}
      {line.action === 'dismiss' && <Row onClick={dismissUpdated} label={<span className="text-tint">{DISMISS}</span>} />}
    </Group>
  );
}
