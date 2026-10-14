import { useState, type ChangeEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TARGET } from '@/components/hig/targets';
import { toast } from 'sonner';
import { Group, Row } from '@/components/hig/List';
import { Sheet } from '@/components/hig/Sheet';
import { getState, importRecord, previewRecord, useStore } from '@/store/useStore';
import { readBackupFile } from '@/store/limits';
import { decode, type CollectionCounts, type ConflictPolicy, type ImportMode, type ImportPreview } from '@/store/transfer';
import { deviceNoun, readInstallEnv } from '@/screens/welcome/install';
import { ChoiceRows, Notice, PlainButton, PrimaryButton } from './controls';
import { checkOutcome, checkedLine, type CheckOutcome } from './dataStatus';
import { shortDate, shortDay } from './dates';
import { latestOnly } from './latest';
import { replaceErases, restoreLocked } from './restore';
import { conflictLines, keepsOpenLine, plural, previewLines, routeNotes } from './summaries';
import { walkSettings } from '@/walk/consent';
import { recordBackupCheck, recordExport } from './write';

type Stage =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'problem'; message: string }
  | { kind: 'preview'; raw: unknown; preview: ImportPreview }
  | { kind: 'confirmReplace'; raw: unknown; preview: ImportPreview }
  | { kind: 'importing'; mode: ImportMode }
  | { kind: 'done'; message: string }
  | { kind: 'checked'; preview: ImportPreview; outcome: CheckOutcome; latest?: string };

const total = (counts: CollectionCounts | undefined) => Object.values(counts ?? {}).reduce((sum, n) => sum + n, 0);

/**
 * Restore from a backup file: read it, show what is in it, then ask.
 *
 * Nothing is written until the person has seen the counts and chosen. Merge
 * keeps what is here and adds the file; replace makes the device hold exactly
 * the file, and because that deletes what is here it is asked twice. Records
 * the file holds that cannot be read are named first, and only then left out;
 * records that differ here and in the file, with no way to tell which is
 * newer, keep this device's copy unless the person picks the file's.
 * `place: 'welcome'` is a device being set up, where only a replace makes
 * sense — merge keeps this device's settings, which would leave it unfinished.
 */
export function RestoreFlow({ place, note, trigger, purpose = 'restore' }: {
  place: 'welcome' | 'you';
  /** Shown above the choice, e.g. that Safari keeps its own copy. */
  note?: string;
  trigger: (pick: () => void) => ReactNode;
  /**
   * `check` (Me → Data → Check a backup; B-25, D61): read the file back and
   * say whether it is the latest backup, whole. That mark is the only thing
   * written.
   */
  purpose?: 'restore' | 'check';
}) {
  const state = useStore();
  // Held in state rather than a ref, so handing `pick` out during render reads nothing mutable.
  const [input, setInput] = useState<HTMLInputElement | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });
  const [device] = useState(() => deviceNoun(readInstallEnv()));
  // Only the file chosen last may change what is shown: a large file chosen
  // first and read last must not replace the preview of the one after it.
  const [selection] = useState(latestOnly);
  // Anything Replace would delete here, setup's answers so far included: then it is asked twice (H5-25, K5-06).
  const erases = replaceErases(state);

  const locked = restoreLocked(stage);

  const pick = () => {
    // While an import is being written, nothing may replace what it shows.
    if (locked) return;
    setStage({ kind: 'idle' });
    input?.click();
  };

  /** B-25: a backup is checked once its own file reads back here, whole. Any other file is reported, and nothing is written. */
  const check = async (preview: ImportPreview): Promise<Stage> => {
    const latest = getState().settings.habits?.lastExportAt;
    const outcome = checkOutcome(preview, latest);
    const checked: Stage = { kind: 'checked', preview, outcome, ...(latest ? { latest } : {}) };
    if (outcome !== 'latest' || !preview.exportedAt) return checked;
    const saved = await recordBackupCheck(preview.exportedAt);
    return saved.ok ? checked : { kind: 'problem', message: `The file reads back, but the check did not save. ${saved.failure.message}` };
  };

  const read = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared so choosing the same file again still fires a change.
    event.target.value = '';
    if (!file) return;
    const token = selection.next();
    setStage({ kind: 'reading' });
    try {
      const raw = await decode(await readBackupFile(file));
      if (!selection.isCurrent(token)) return;
      const preview = previewRecord(raw);
      if (!preview.ok) {
        setStage({ kind: 'problem', message: preview.reason });
        return;
      }
      if (purpose === 'check') {
        const next = await check(preview);
        if (selection.isCurrent(token)) setStage(next);
        return;
      }
      setStage({ kind: 'preview', raw, preview });
    } catch (error) {
      if (!selection.isCurrent(token)) return;
      setStage({ kind: 'problem', message: error instanceof Error ? error.message : 'That file could not be read.' });
    }
  };

  const apply = async (raw: unknown, preview: ImportPreview, mode: ImportMode, onConflict: ConflictPolicy = 'keepDevice') => {
    // The import owns the flow until it is acknowledged; its result lands
    // only if nothing has started since (N04).
    const token = selection.next();
    setStage({ kind: 'importing', mode });
    // The preview has already said which records cannot be read; going on
    // after that is the explicit choice to leave them out.
    const unreadable = (total(preview.rejected) || preview.unreadableObservations) + (preview.unreadableFields?.length ?? 0);
    const applied = await importRecord(raw, mode, { onConflict, ...(unreadable > 0 ? { allowRejected: true } : {}) });
    if (!selection.isCurrent(token)) return;
    if (!applied.ok) {
      setStage({ kind: 'problem', message: `Nothing was changed. ${applied.failure.message}` });
      return;
    }
    // After a replace this device holds exactly that backup, so it is the
    // latest copy there is: its time, and this database's revision right after
    // the import — the file's own mark counts another database's changes. A
    // merge keeps this device's settings, and with them its own mark.
    if (mode === 'replace' && preview.exportedAt) await recordExport({ at: preview.exportedAt, revision: getState().revision });
    const report = applied.value;
    const differed = total(report.conflicts);
    // At Welcome a restored record completes setup, so the app moves on to
    // Today and this sheet goes with it: say it there, where it is seen.
    if (place === 'welcome' && mode === 'replace') toast.success('Your record is restored');
    setStage({
      kind: 'done',
      message: mode === 'replace'
        ? `Restored. This ${device} now holds what the backup held.`
        : `Merged. What the file holds is on this ${device} now.${differed > 0 ? ` For the ${plural(differed, 'record')} that differed, ${onConflict === 'takeFile' ? 'the file’s copy' : `this ${device}’s copy`} was kept.` : ''}`,
    });
  };

  const open = stage.kind !== 'idle' && stage.kind !== 'reading';
  // Closing retires any read still in flight. While an import is being
  // written the sheet stays: closing it would hand the flow to another file.
  const close = () => {
    if (locked) return;
    selection.cancel();
    setStage({ kind: 'idle' });
  };

  return (
    <>
      {trigger(pick)}
      <input ref={setInput} type="file" className="sr-only" tabIndex={-1} aria-hidden onChange={event => void read(event)} />
      {stage.kind === 'reading' && <Notice>Reading the file…</Notice>}

      <Sheet open={open} dismissible={!locked} onOpenChange={next => { if (!next) close(); }} title={purpose === 'check' ? 'Check a backup' : 'Restore from a backup'} detent="large">
        {stage.kind === 'problem' && (
          <>
            <Notice tone="error">{stage.message}</Notice>
            <PrimaryButton className={TARGET.primary} onClick={pick}>Choose another file</PrimaryButton>
          </>
        )}

        {stage.kind === 'checked' && (
          <>
            <Notice>{checkedLine(stage.outcome, stage.preview.exportedAt, stage.latest, device)}</Notice>
            <Group header="In this file">
              {previewLines(stage.preview).map(line => <Row key={line.label} label={line.label} value={line.count.toLocaleString()} numeric />)}
            </Group>
            <PrimaryButton className={TARGET.primary} onClick={close}>Done</PrimaryButton>
          </>
        )}

        {stage.kind === 'preview' && (
          <PreviewBody
            preview={stage.preview}
            saveRoutes={walkSettings(state.settings).saveRoutes}
            {...(note ? { note } : {})}
            place={place}
            device={device}
            erases={erases !== undefined}
            onMerge={policy => void apply(stage.raw, stage.preview, 'merge', policy)}
            onReplace={() => (erases !== undefined
              ? setStage({ kind: 'confirmReplace', raw: stage.raw, preview: stage.preview })
              : void apply(stage.raw, stage.preview, 'replace'))}
          />
        )}

        {stage.kind === 'confirmReplace' && (
          <>
            <p className="px-1 text-[length:var(--text-title-2)] font-semibold leading-snug">Replace everything on this {device}?</p>
            <p className="px-1 text-[length:var(--text-body)] leading-snug">
              This deletes {erases ?? 'what is here'} on this {device}, and keeps only what is in the file{(total(stage.preview.rejected) || stage.preview.unreadableObservations) > 0 ? ', leaving out the records in it that cannot be read' : ''}. It cannot be undone.
            </p>
            {stage.preview.keepsOpen && <p className="px-1 text-[length:var(--text-body)] leading-snug">{keepsOpenLine(device)}</p>}
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => void apply(stage.raw, stage.preview, 'replace')}
                className={cn('press-feedback w-full rounded-xl bg-stop-fill px-4 text-[length:var(--text-body)] font-semibold text-white', TARGET.primary)}
              >
                Replace everything
              </button>
              <PlainButton onClick={close}>Keep what is here</PlainButton>
            </div>
          </>
        )}

        {stage.kind === 'importing' && <Notice>{stage.mode === 'replace' ? 'Restoring…' : 'Merging…'}</Notice>}

        {stage.kind === 'done' && (
          <>
            <Notice>{stage.message}</Notice>
            <PrimaryButton className={TARGET.primary} onClick={close}>Done</PrimaryButton>
          </>
        )}
      </Sheet>
    </>
  );
}

/** What a file's unreadable fields come to: its health answers left out, and how many other settings. */
function fieldsUnreadable(preview: ImportPreview): { health: boolean; settings: number } {
  const fields = preview.unreadableFields ?? [];
  const health = fields.some(f => f === 'profile.health' || f === 'profile.pain');
  return { health, settings: fields.filter(f => f !== 'profile.health' && f !== 'profile.pain').length };
}

/** What a file holds and what each way of restoring it does, before anything changes. */
export function PreviewBody({ preview, saveRoutes, note, place, device, erases, onMerge, onReplace }: {
  preview: ImportPreview;
  /** This phone's own answer about keeping routes, for what happens to the file's (B-26). */
  saveRoutes: boolean | 'unasked';
  note?: string;
  place: 'welcome' | 'you';
  device: string;
  /** Replace would delete something here, so it's asked twice. */
  erases: boolean;
  onMerge: (policy: ConflictPolicy) => void;
  onReplace: () => void;
}) {
  const [policy, setPolicy] = useState<ConflictPolicy>('keepDevice');
  const lines = previewLines(preview);
  const readable = Object.values(preview.observations).reduce((sum, n) => sum + (n ?? 0), 0);
  const unreadable = total(preview.rejected) || preview.unreadableObservations;
  const differ = total(preview.conflicts);
  const made = preview.exportedAt ? `Made ${shortDate(preview.exportedAt)}.` : 'The file does not say when it was made.';
  const span = preview.range ? ` Readings from ${shortDay(preview.range.from)} to ${shortDay(preview.range.to)}.` : '';
  const replaceOnly = place === 'welcome';

  return (
    <>
      <p className="px-1 text-[length:var(--text-body)] leading-snug">{made}{span}</p>
      {note && <Notice>{note}</Notice>}
      {preview.legacy && <Notice>This backup is from the previous version of the app. It is brought up to date as it is restored.</Notice>}

      <Group
        header="In this file"
        footer={[
          preview.hasProfile && 'It includes a profile and health answers.',
          preview.hasSettings && 'It includes settings and reminders.',
          preview.alreadyHere > 0 && (preview.alreadyHere >= readable
            ? `Every reading in it is already on this ${device}.`
            : `Some of its readings are already on this ${device}; each is kept once.`),
          // D-06: a merge never brings back what was deleted here since.
          !replaceOnly && (preview.deletedHere ?? 0) > 0
            && `${plural(preview.deletedHere ?? 0, 'record')} in it ${preview.deletedHere === 1 ? 'was' : 'were'} deleted on this ${device} since. Merging leaves ${preview.deletedHere === 1 ? 'it' : 'them'} deleted.`,
          // D136: a record restored on the other device is the one held here, under a fresh id.
          !replaceOnly && (preview.restoredHere ?? 0) > 0
            && `${plural(preview.restoredHere ?? 0, 'record')} on this ${device} ${preview.restoredHere === 1 ? 'was' : 'were'} deleted and brought back on the device the file came from. Merging keeps the brought-back ${preview.restoredHere === 1 ? 'copy' : 'copies'} in ${preview.restoredHere === 1 ? 'its' : 'their'} place, once.`,
          // D147: a brought-back copy never replaces a record that has changed here.
          !replaceOnly && (preview.restoredKept ?? 0) > 0
            && `${plural(preview.restoredKept ?? 0, 'record')} in it ${preview.restoredKept === 1 ? 'was' : 'were'} brought back on the device the file came from, and ${preview.restoredKept === 1 ? 'differs' : 'differ'} from this ${device}’s. Merging keeps this ${device}’s and leaves the brought-back ${preview.restoredKept === 1 ? 'copy' : 'copies'} out.`,
        ].filter(Boolean).join(' ') || undefined}
      >
        {lines.length > 0
          ? lines.map(line => <Row key={line.label} label={line.label} value={line.count.toLocaleString()} numeric />)
          : <Row label="No records" detail="This file holds no readings, sessions or check-ins." />}
      </Group>

      {unreadable > 0 && (
        <Notice tone="error">{`${plural(unreadable, 'record')} in this file cannot be read. Restoring it leaves ${unreadable === 1 ? 'that one' : 'those'} out and keeps the rest.`}</Notice>
      )}
      {/* What happens to routes, before anything changes (B-26, H6-05). */}
      {routeNotes(preview, saveRoutes).map(n => <Notice key={n}>{n}</Notice>)}
      {/* D-08: what is left out of the settings and profile, said before anything changes. */}
      {fieldsUnreadable(preview).health && (
        <Notice tone="error">The health answers in this file cannot be read, so restoring it leaves them out. The app will ask them again before you move.</Notice>
      )}
      {fieldsUnreadable(preview).settings > 0 && (
        <Notice tone="error">{`${plural(fieldsUnreadable(preview).settings, 'setting')} in this file cannot be read, so restoring it leaves ${fieldsUnreadable(preview).settings === 1 ? 'that one' : 'those'} out and uses the usual ${fieldsUnreadable(preview).settings === 1 ? 'one' : 'ones'}.`}</Notice>
      )}

      {preview.isEmpty ? (
        <Notice tone="error">This backup is empty, so restoring it would add nothing.</Notice>
      ) : replaceOnly ? (
        <div className="flex flex-col gap-3">
          <PrimaryButton className={TARGET.primary} onClick={onReplace}>Restore</PrimaryButton>
          <p className="px-4 text-[length:var(--text-footnote)] leading-snug text-muted-foreground">
            This {device} will hold exactly what the backup holds, settings and profile included.{preview.keepsOpen ? ` ${keepsOpenLine(device)}` : ''}
          </p>
        </div>
      ) : (
        <>
          {differ > 0 && (
            <Group
              header="Records that differ"
              footer={`${plural(differ, 'record')} ${differ === 1 ? 'is' : 'are'} both here and in the file, with different contents and no way to tell which is newer.`}
            >
              {conflictLines(preview).map(line => <Row key={line.label} label={line.label} value={line.count.toLocaleString('en-IN')} numeric />)}
              <ChoiceRows
                label="Which copy to keep when merging"
                options={[
                  { value: 'keepDevice', label: `Keep this ${device}’s copy` },
                  { value: 'takeFile', label: 'Use the file’s copy' },
                ]}
                value={policy}
                onChange={setPolicy}
              />
            </Group>
          )}
          <div className="flex flex-col gap-3">
            <PrimaryButton className={TARGET.primary} onClick={() => onMerge(policy)}>Merge into this {device}</PrimaryButton>
            <p className="px-4 pb-2 text-[length:var(--text-footnote)] leading-snug text-muted-foreground">
              {/* What the merge does (planMerge): a later change is kept, and only where that can't be told does the choice above decide (kiro FK-09). */}
              {`Keeps everything here and adds what is in the file. Where one copy of a record was changed later, that change is kept.${differ > 0 ? ` Where that can’t be told, this ${device}’s copy is kept unless you choose the file’s.` : ''} Your settings and profile here stay as they are.`}
            </p>
            <button
              type="button"
              onClick={onReplace}
              className="press-feedback min-h-12 w-full rounded-xl px-4 text-[length:var(--text-body)] font-medium text-stop"
            >
              {erases ? 'Replace everything here' : 'Replace with this backup'}
            </button>
            <p className="px-4 text-[length:var(--text-footnote)] leading-snug text-muted-foreground">
              Makes this {device} hold exactly what is in the file, settings and profile included.{preview.keepsOpen ? ` ${keepsOpenLine(device)}` : ''}
            </p>
          </div>
        </>
      )}
    </>
  );
}
