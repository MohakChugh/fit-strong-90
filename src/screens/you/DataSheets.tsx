import { useEffect, useMemo, useState } from 'react';
import { Sheet } from '@/components/hig/Sheet';
import { clearAllAndRestart, exportRecord, useStore } from '@/store/useStore';
import { deliver, deliveryMethod } from '@/store/transfer';
import { showBadge } from '@/reminders/badge';
import { clearReminders } from '@/reminders/pending';
import { Notice, PlainButton, PrimaryButton } from './controls';
import { settingsKey } from './backupFile';
import { countsSentence, recordCounts } from './summaries';
import { recordExport } from './write';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "iPhone", "iPad" or "device". */
  device: string;
}

function size(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024)).toLocaleString()} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ============================================================================
// Back up
// ============================================================================

export function BackupSheet({ open, onOpenChange, device }: SheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Back up your record" detent="large">
      {open && <BackupBody device={device} />}
    </Sheet>
  );
}

interface Prepared {
  file: File;
  /** When the snapshot in the file was taken, exactly as the file says. */
  exportedAt: string;
  /** The stored revision of that snapshot. */
  revision: number;
  /** The record it was made from (`version` below). */
  version: readonly unknown[];
}

/**
 * The file is made as the sheet opens, so the share button is one tap that
 * goes straight to the share sheet: iOS refuses to open it from anything but
 * a fresh tap, and making the file first would spend that tap.
 *
 * A file made earlier holds only what was there then. So it is made again
 * whenever the record changes while the sheet is open — here or in another
 * tab — and what the sheet says is in it, and what the backup date records
 * as protected, come from the file itself.
 */
function BackupBody({ device }: { device: string }) {
  const state = useStore();
  const settings = useMemo(() => settingsKey(state.settings), [state.settings]);
  // Everything a backup holds. The store replaces a collection whenever it
  // changes, so a new version means the prepared file no longer matches.
  const version = useMemo(
    () => [state.observations, state.sessions, state.checkIns, state.personalRecords, state.bodyMetrics, state.focusOverrides, state.contentState, state.profile, settings],
    [state.observations, state.sessions, state.checkIns, state.personalRecords, state.bodyMetrics, state.focusOverrides, state.contentState, state.profile, settings],
  );
  const [prepared, setPrepared] = useState<Prepared>();
  const [outcome, setOutcome] = useState<{ tone: 'status' | 'error'; text: string }>();

  useEffect(() => {
    let current = true;
    void exportRecord().then(made => {
      if (!current) return;
      if (!made.ok) {
        setOutcome({ tone: 'error', text: `The backup could not be made. ${made.failure.message}` });
        return;
      }
      const { bytes, name, type, exportedAt, revision } = made.value;
      setPrepared({ file: new File([bytes as BlobPart], name, { type }), exportedAt, revision, version });
      setOutcome(previous => (previous?.tone === 'error' ? undefined : previous));
    });
    return () => { current = false; };
  }, [version]);

  // Only a file of the record as it is now can be handed over.
  const ready = prepared?.version === version ? prepared : undefined;
  const file = ready?.file;

  const hand = async ({ file, exportedAt, revision }: Prepared) => {
    const delivered = await deliver(file);
    if (!delivered.ok) {
      setOutcome({ tone: 'error', text: delivered.failure.message });
      return;
    }
    if (delivered.value === 'cancelled') return;
    // What the file covers, not the moment it was handed over.
    const saved = await recordExport({ at: exportedAt, revision });
    setOutcome(saved.ok
      ? { tone: 'status', text: delivered.value === 'share'
        ? 'Done. Keep the file somewhere private, such as Files or iCloud Drive.'
        : 'Downloaded. You will find the file with your downloads.' }
      : { tone: 'error', text: `The file was made, but the date of this backup did not save. ${saved.failure.message}` });
  };

  return (
    <>
      <p className="px-1 text-[length:var(--text-body)] leading-snug">
        One file with your whole record: {countsSentence(recordCounts(state))}, your profile and health answers, and your settings. Restore it on this {device} or a new one.
      </p>
      <p className="px-1 text-[length:var(--text-subhead)] leading-snug text-muted-foreground">
        The file is not encrypted. Anyone who has it can read your health record, so keep it somewhere private and think twice before sending it to anyone.
      </p>
      <div className="flex flex-col gap-2">
        <PrimaryButton disabled={!ready} onClick={() => { if (ready) void hand(ready); }}>
          {!file ? 'Preparing the file…' : deliveryMethod(file) === 'share' ? 'Save or share' : 'Download'}
        </PrimaryButton>
        <p aria-live="polite" className="numeric px-4 text-[length:var(--text-footnote)] text-muted-foreground">
          {file ? `${file.name}, ${size(file.size)}` : ''}
        </p>
        {outcome && <Notice tone={outcome.tone}>{outcome.text}</Notice>}
      </div>
    </>
  );
}

// ============================================================================
// Delete everything
// ============================================================================

export function DeleteSheet({ open, onOpenChange, device }: SheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Delete everything" detent="large">
      {open && <DeleteBody device={device} close={() => onOpenChange(false)} />}
    </Sheet>
  );
}

function DeleteBody({ device, close }: { device: string; close: () => void }) {
  const state = useStore();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  const counts = recordCounts(state);
  const any = counts.readings + counts.sessions + counts.checkIns + counts.bodyMetrics + counts.personalRecords > 0;

  const erase = async () => {
    setBusy(true);
    // Clears IndexedDB and the app's own small flags, then starts again at
    // Welcome. On success the page reloads, so nothing after this runs; the
    // reminders and the badge go only once the record has.
    const cleared = await clearAllAndRestart(window.location, () => {
      clearReminders();
      showBadge(0);
    });
    if (!cleared.ok) {
      setBusy(false);
      setProblem(`Nothing was deleted. ${cleared.failure.message}`);
    }
  };

  return (
    <>
      <p className="px-1 text-[length:var(--text-title-2)] font-semibold leading-snug">Delete everything on this {device}?</p>
      <p className="px-1 text-[length:var(--text-body)] leading-snug">
        This deletes everything the app keeps here: your profile and health answers{any ? `, ${countsSentence(counts)}` : ''}, your food preferences, your reminders and your settings. The app then starts again as new.
      </p>
      <p className="px-1 text-[length:var(--text-body)] font-medium leading-snug">It cannot be undone. If you might want any of it later, back up first.</p>
      <div className="flex flex-col gap-2">
        {problem && <Notice tone="error">{problem}</Notice>}
        <button
          type="button"
          disabled={busy}
          onClick={() => void erase()}
          className="press-feedback min-h-[3.25rem] w-full rounded-xl bg-stop-fill px-4 text-[length:var(--text-body)] font-semibold text-white disabled:opacity-60"
        >
          {busy ? 'Deleting…' : 'Delete everything'}
        </button>
        <PlainButton disabled={busy} onClick={close}>Keep my record</PlainButton>
      </div>
    </>
  );
}
