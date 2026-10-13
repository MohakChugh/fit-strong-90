/**
 * "Restarting to update…" (board D106, Codex P8S-13): up the moment Restart
 * is tapped, over the whole app, which is inert beneath it (`App.tsx`), so
 * nothing new can start while the waiting release is asked to take over. It
 * goes if the worker says no: nothing under it has changed.
 */
import { RefreshCwIcon } from 'lucide-react';
import { RESTARTING, useUpdates } from './updates';

export function RestartCover() {
  const { restarting } = useUpdates();
  if (!restarting) return null;
  return (
    <div role="alertdialog" aria-modal="true" aria-label={RESTARTING}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-grouped-bg px-6 text-center">
      <RefreshCwIcon className="size-8 animate-spin text-tint motion-reduce:animate-none" aria-hidden />
      <p className="text-[length:var(--text-title-3)] font-semibold">{RESTARTING}</p>
    </div>
  );
}
