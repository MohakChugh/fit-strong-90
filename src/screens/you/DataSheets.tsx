import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { TARGET } from '@/components/hig/targets';
import { Group, Row } from '@/components/hig/List';
import { Sheet } from '@/components/hig/Sheet';
import { clearAllAndRestart, eraseRoutes, exportRecord, getState, useStore } from '@/store/useStore';
import { walkSettings } from '@/walk/consent';
import { deliver, deliveryMethod } from '@/store/transfer';
import { showBadge } from '@/reminders/badge';
import { clearReminders } from '@/reminders/pending';
import { Notice, PlainButton, PrimaryButton, Toggle } from './controls';
import { settingsKey } from './backupFile';
import { backupLine, backupState, fileSize } from './dataStatus';
import { countsSentence, plural, recordCounts } from './summaries';
import { recordExport } from './write';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "iPhone", "iPad" or "device". */
  device: string;
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
  // Routes go into a backup only when the person includes them (journey §18.3).
  const [withRoutes, setWithRoutes] = useState(false);
  const routes = state.records.routes.length;
  // Everything a backup holds. The store replaces a collection whenever it
  // changes, so a new version means the prepared file no longer matches.
  const version = useMemo(
    () => [state.observations, state.sessions, state.checkIns, state.personalRecords, state.bodyMetrics, state.focusOverrides, state.contentState, state.records, state.profile, settings, withRoutes],
    [state.observations, state.sessions, state.checkIns, state.personalRecords, state.bodyMetrics, state.focusOverrides, state.contentState, state.records, state.profile, settings, withRoutes],
  );
  const [prepared, setPrepared] = useState<Prepared>();
  // Whether the prepared file has left the app: a new one has not, yet.
  const [handed, setHanded] = useState(false);
  const [outcome, setOutcome] = useState<{ tone: 'status' | 'error'; text: string }>();

  useEffect(() => {
    let current = true;
    void exportRecord(withRoutes ? { include: ['routes'] } : {}).then(made => {
      if (!current) return;
      if (!made.ok) {
        setOutcome({ tone: 'error', text: `The backup could not be made. ${made.failure.message}` });
        return;
      }
      const { bytes, name, type, exportedAt, revision } = made.value;
      setPrepared({ file: new File([bytes as BlobPart], name, { type }), exportedAt, revision, version });
      setHanded(false);
      setOutcome(previous => (previous?.tone === 'error' ? undefined : previous));
    });
    return () => { current = false; };
  }, [version, withRoutes]);

  // Only a file of the record as it is now can be handed over.
  const ready = prepared?.version === version ? prepared : undefined;
  const file = ready?.file;

  const hand = async ({ file, exportedAt, revision }: Prepared) => {
    const delivered = await deliver(file);
    if (!delivered.ok) {
      setOutcome({ tone: 'error', text: delivered.failure.message });
      return;
    }
    if (delivered.value === 'cancelled') {
      // A known cancellation never advances the backup's status (B-25).
      setOutcome({ tone: 'status', text: `Not shared, so nothing has changed. ${backupLine(backupState(getState().settings.habits))}.` });
      return;
    }
    setHanded(true);
    // What the file covers, not the moment it was handed over.
    const saved = await recordExport({ at: exportedAt, revision, via: delivered.value });
    setOutcome(saved.ok
      ? { tone: 'status', text: delivered.value === 'share'
        ? 'Shared. Keep the file somewhere private, such as Files or iCloud Drive. To check it reads back, use Check a backup.'
        : 'Downloaded. You will find the file with your downloads. To check it reads back, use Check a backup.' }
      : { tone: 'error', text: `The file was made, but the date of this backup did not save. ${saved.failure.message}` });
  };

  return (
    <>
      <p className="px-1 text-[length:var(--text-body)] leading-snug">
        One file with your whole record: {countsSentence({ ...recordCounts(state), routes: withRoutes ? routes : 0 })}, your profile and health answers, and your settings. Restore it on this {device} or a new one.
      </p>
      <p className="px-1 text-[length:var(--text-subhead)] leading-snug text-muted-foreground">
        The file is not encrypted. Anyone who has it can read your health record, so keep it somewhere private and think twice before sending it to anyone.
      </p>
      {routes > 0 && (
        <Group footer="A backup with routes shows where you walked to anyone who has the file.">
          <Row
            label="Include your routes"
            detail={plural(routes, 'route')}
            accessory={<Toggle label="Include your routes" checked={withRoutes} onChange={setWithRoutes} />}
          />
        </Group>
      )}
      <div className="flex flex-col gap-2">
        <PrimaryButton disabled={!ready} onClick={() => { if (ready) void hand(ready); }}>
          {!file ? 'Preparing the file…' : deliveryMethod(file) === 'share' ? 'Save or share' : 'Download'}
        </PrimaryButton>
        <p aria-live="polite" className="numeric px-4 text-[length:var(--text-footnote)] text-muted-foreground">
          {file ? (handed ? `${file.name}, ${fileSize(file.size)}` : `Prepared: ${file.name}, ${fileSize(file.size)}. It hasn’t left this ${device} yet.`) : ''}
        </p>
        {outcome && <Notice tone={outcome.tone}>{outcome.text}</Notice>}
      </div>
    </>
  );
}

// ============================================================================
// Delete everything
// ============================================================================

// ============================================================================
// Erase all routes
// ============================================================================

/**
 * "Erase all routes" (B-05), asked twice, as everything that cannot be undone
 * is, in Delete everything's pattern (§20.4 rule 6, H6R-15, K6R-04, board
 * D182). The sheet can't be closed while the erase is being written.
 */
export function EraseRoutesSheet({ open, onOpenChange, device, onErased }: SheetProps & { onErased: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onOpenChange={next => { if (!busy) onOpenChange(next); }} dismissible={!busy} title="Erase all routes" detent="large">
      {open && <EraseRoutesBody device={device} busy={busy} setBusy={setBusy} close={() => onOpenChange(false)} onErased={onErased} />}
    </Sheet>
  );
}

function EraseRoutesBody({ device, busy, setBusy, close, onErased }: {
  device: string; busy: boolean; setBusy: (busy: boolean) => void; close: () => void; onErased: () => void;
}) {
  const keeps = walkSettings(useStore().settings).saveRoutes === true;
  const [step, setStep] = useState<'ask' | 'confirm'>('ask');
  const [problem, setProblem] = useState<string>();
  const heading = useRef<HTMLParagraphElement>(null);
  // The button pressed has gone: the second question takes focus (B-03).
  useEffect(() => { if (step === 'confirm') heading.current?.focus(); }, [step]);
  const erase = async () => {
    setBusy(true);
    setProblem(undefined);
    const done = await eraseRoutes();
    setBusy(false);
    if (!done.ok) return setProblem(`The routes were not erased. ${done.failure.message}`);
    onErased();
    close();
  };
  const stop = cn('press-feedback w-full rounded-xl bg-stop-fill px-4 text-[length:var(--text-body)] font-semibold text-white disabled:opacity-60', TARGET.primary);

  if (step === 'ask') {
    return (
      <>
        <p className="px-1 text-[length:var(--text-title-2)] font-semibold leading-snug">Erase all routes on this {device}?</p>
        <p className="px-1 text-[length:var(--text-body)] leading-snug">
          Every route on this {device} is erased: from saved walks, from a walk not yet saved, and from one you’re on now. The walks keep their time, distance and steps. This cannot be undone.
        </p>
        {/* What happens next, so erasing is never mistaken for turning routes off (K6R-11). */}
        {keeps && <p className="px-1 text-[length:var(--text-body)] leading-snug">New walks still keep their route while Keep walk routes is on.</p>}
        <div className={cn('flex flex-col', TARGET.gap)}>
          <button type="button" onClick={() => setStep('confirm')} className={stop}>Erase routes</button>
          <PlainButton className={TARGET.tap} onClick={close}>Keep my routes</PlainButton>
        </div>
      </>
    );
  }
  return (
    <>
      <p ref={heading} tabIndex={-1} className="px-1 text-[length:var(--text-title-2)] font-semibold leading-snug outline-none">Erase every route for good?</p>
      <p className="px-1 text-[length:var(--text-body)] leading-snug">This is the last step. No backup brings them back.</p>
      {problem && <Notice tone="error">{problem}</Notice>}
      <div className={cn('flex flex-col', TARGET.gap)}>
        <button type="button" disabled={busy} onClick={() => void erase()} className={stop}>
          {busy ? 'Erasing…' : 'Erase all routes'}
        </button>
        <PlainButton disabled={busy} className={TARGET.tap} onClick={close}>Keep my routes</PlainButton>
      </div>
    </>
  );
}

export function DeleteSheet({ open, onOpenChange, device }: SheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Delete everything" detent="large">
      {open && <DeleteBody device={device} close={() => onOpenChange(false)} />}
    </Sheet>
  );
}

function DeleteBody({ device, close }: { device: string; close: () => void }) {
  const state = useStore();
  const [step, setStep] = useState<'ask' | 'confirm'>('ask');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  const heading = useRef<HTMLParagraphElement>(null);
  const counts = recordCounts(state);
  const any = counts.readings + counts.sessions + counts.checkIns + counts.bodyMetrics + counts.personalRecords > 0;
  // The button pressed has gone: the second question takes focus (B-03).
  useEffect(() => { if (step === 'confirm') heading.current?.focus(); }, [step]);

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

  if (step === 'ask') {
    return (
      <>
        <p className="px-1 text-[length:var(--text-title-2)] font-semibold leading-snug">Delete everything on this {device}?</p>
        <p className="px-1 text-[length:var(--text-body)] leading-snug">
          This deletes everything the app keeps here: your profile and health answers{any ? `, ${countsSentence(counts)}` : ''}, your food preferences, your reminders and your settings. The app then starts again as new.
        </p>
        <p className="px-1 text-[length:var(--text-body)] font-medium leading-snug">It cannot be undone. If you might want any of it later, back up first.</p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setStep('confirm')}
            className={cn('press-feedback w-full rounded-xl bg-stop-fill px-4 text-[length:var(--text-body)] font-semibold text-white', TARGET.primary)}
          >
            Delete everything
          </button>
          <PlainButton onClick={close}>Keep my record</PlainButton>
        </div>
      </>
    );
  }
  return (
    <>
      <p ref={heading} tabIndex={-1} className="px-1 text-[length:var(--text-title-2)] font-semibold leading-snug outline-none">Erase all of it?</p>
      <p className="px-1 text-[length:var(--text-body)] leading-snug">
        This is the last step. Everything the app holds on this {device} goes, and only a backup can bring it back.
      </p>
      <div className="flex flex-col gap-2">
        {problem && <Notice tone="error">{problem}</Notice>}
        <button
          type="button"
          disabled={busy}
          onClick={() => void erase()}
          className={cn('press-feedback w-full rounded-xl bg-stop-fill px-4 text-[length:var(--text-body)] font-semibold text-white disabled:opacity-60', TARGET.primary)}
        >
          {busy ? 'Erasing…' : 'Erase all'}
        </button>
        <PlainButton disabled={busy} onClick={close}>Keep my record</PlainButton>
      </div>
    </>
  );
}
