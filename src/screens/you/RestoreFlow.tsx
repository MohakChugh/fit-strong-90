import { useState, type ChangeEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Group, Row } from '@/components/hig/List';
import { Sheet } from '@/components/hig/Sheet';
import { getState, importRecord, previewRecord, useStore } from '@/store/useStore';
import { decode, type CollectionCounts, type ConflictPolicy, type ImportMode, type ImportPreview } from '@/store/transfer';
import { deviceNoun, readInstallEnv } from '@/screens/welcome/install';
import { ChoiceRows, Notice, PlainButton, PrimaryButton } from './controls';
import { shortDate, shortDay } from './dates';
import { latestOnly } from './latest';
import { restoreLocked } from './restore';
import { countsSentence, plural, previewLines, recordCounts } from './summaries';
import { recordExport } from './write';

type Stage =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'problem'; message: string }
  | { kind: 'preview'; raw: unknown; preview: ImportPreview }
  | { kind: 'confirmReplace'; raw: unknown; preview: ImportPreview }
  | { kind: 'importing'; mode: ImportMode }
  | { kind: 'done'; message: string };

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
export function RestoreFlow({ place, note, trigger }: {
  place: 'welcome' | 'you';
  /** Shown above the choice, e.g. that Safari keeps its own copy. */
  note?: string;
  trigger: (pick: () => void) => ReactNode;
}) {
  const state = useStore();
  // Held in state rather than a ref, so handing `pick` out during render reads nothing mutable.
  const [input, setInput] = useState<HTMLInputElement | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });
  const [device] = useState(() => deviceNoun(readInstallEnv()));
  // Only the file chosen last may change what is shown: a large file chosen
  // first and read last must not replace the preview of the one after it.
  const [selection] = useState(latestOnly);
  const here = recordCounts(state);
  const heldHere = here.readings + here.sessions + here.checkIns + here.bodyMetrics + here.personalRecords;

  const locked = restoreLocked(stage);

  const pick = () => {
    // While an import is being written, nothing may replace what it shows.
    if (locked) return;
    setStage({ kind: 'idle' });
    input?.click();
  };

  const read = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared so choosing the same file again still fires a change.
    event.target.value = '';
    if (!file) return;
    const token = selection.next();
    setStage({ kind: 'reading' });
    try {
      const raw = await decode(await file.arrayBuffer());
      if (!selection.isCurrent(token)) return;
      const preview = previewRecord(raw);
      setStage(preview.ok ? { kind: 'preview', raw, preview } : { kind: 'problem', message: preview.reason });
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

      <Sheet open={open} dismissible={!locked} onOpenChange={next => { if (!next) close(); }} title="Restore from a backup" detent="large">
        {stage.kind === 'problem' && (
          <>
            <Notice tone="error">{stage.message}</Notice>
            <PrimaryButton onClick={pick}>Choose another file</PrimaryButton>
          </>
        )}

        {stage.kind === 'preview' && (
          <PreviewBody
            preview={stage.preview}
            {...(note ? { note } : {})}
            place={place}
            device={device}
            heldHere={heldHere}
            onMerge={policy => void apply(stage.raw, stage.preview, 'merge', policy)}
            onReplace={() => (heldHere > 0
              ? setStage({ kind: 'confirmReplace', raw: stage.raw, preview: stage.preview })
              : void apply(stage.raw, stage.preview, 'replace'))}
          />
        )}

        {stage.kind === 'confirmReplace' && (
          <>
            <p className="px-1 text-[length:var(--text-title-2)] font-semibold leading-snug">Replace everything on this {device}?</p>
            <p className="px-1 text-[length:var(--text-body)] leading-snug">
              This deletes the {countsSentence(here)} on this {device}, with its profile and settings, and keeps only what is in the file{(total(stage.preview.rejected) || stage.preview.unreadableObservations) > 0 ? ', leaving out the records in it that cannot be read' : ''}. It cannot be undone.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void apply(stage.raw, stage.preview, 'replace')}
                className="press-feedback min-h-[3.25rem] w-full rounded-xl bg-stop-fill px-4 text-[length:var(--text-body)] font-semibold text-white"
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
            <PrimaryButton onClick={close}>Done</PrimaryButton>
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

function PreviewBody({ preview, note, place, device, heldHere, onMerge, onReplace }: {
  preview: ImportPreview;
  note?: string;
  place: 'welcome' | 'you';
  device: string;
  heldHere: number;
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
        ].filter(Boolean).join(' ') || undefined}
      >
        {lines.length > 0
          ? lines.map(line => <Row key={line.label} label={line.label} value={line.count.toLocaleString()} numeric />)
          : <Row label="No records" detail="This file holds no readings, sessions or check-ins." />}
      </Group>

      {unreadable > 0 && (
        <Notice tone="error">{`${plural(unreadable, 'record')} in this file cannot be read. Restoring it leaves ${unreadable === 1 ? 'that one' : 'those'} out and keeps the rest.`}</Notice>
      )}
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
        <div className="flex flex-col gap-2">
          <PrimaryButton onClick={onReplace}>Restore</PrimaryButton>
          <p className="px-4 text-[length:var(--text-footnote)] leading-snug text-muted-foreground">
            This {device} will hold exactly what the backup holds, settings and profile included.
          </p>
        </div>
      ) : (
        <>
          {differ > 0 && (
            <Group
              header="Records that differ"
              footer={`${plural(differ, 'record')} ${differ === 1 ? 'is' : 'are'} both here and in the file, with different contents and no way to tell which is newer.`}
            >
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
          <div className="flex flex-col gap-2">
            <PrimaryButton onClick={() => onMerge(policy)}>Merge into this {device}</PrimaryButton>
            <p className="px-4 pb-2 text-[length:var(--text-footnote)] leading-snug text-muted-foreground">
              Keeps everything here and adds what is in the file. Where a record has been changed, the newer copy is kept. Your settings and profile here stay as they are.
            </p>
            <button
              type="button"
              onClick={onReplace}
              className="press-feedback min-h-11 w-full rounded-xl px-4 text-[length:var(--text-body)] font-medium text-stop"
            >
              {heldHere > 0 ? 'Replace everything here' : 'Replace with this backup'}
            </button>
            <p className="px-4 text-[length:var(--text-footnote)] leading-snug text-muted-foreground">
              Makes this {device} hold exactly what is in the file, settings and profile included.
            </p>
          </div>
        </>
      )}
    </>
  );
}
