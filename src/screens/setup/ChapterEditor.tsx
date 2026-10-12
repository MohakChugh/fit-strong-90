import { useState } from 'react';
import { Screen } from '@/components/hig/Screen';
import { dayOf, nowAt } from '@/health/observation';
import { whatChanges } from '@/setup/changes';
import { ANSWERS_CHANGED, editMeasurements, editOf, editedRecord, editorOpens, editorState } from '@/setup/edit';
import { getField, isSafetyField, mergeAnswersWithConflicts, putField } from '@/setup/merge';
import { discardClinical, saveClinical, useClinicalUnsaved } from '@/setup/effective';
import { CHAPTER_TITLE, chapterOf } from '@/setup/graph';
import { answersToEdit } from '@/setup/prefill';
import { setupStateOf } from '@/setup/state';
import { Notice, PlainButton, PrimaryButton } from '@/screens/you/controls';
import { StoreFailure, type StoreResult } from '@/store/db';
import { sameValue } from '@/store/transfer';
import { getState, update, useStore } from '@/store/useStore';
import type { ChapterId, SetupAnswers } from '@/types/setup';
import { Missing } from './controls';
import { DiscardGuard } from './DiscardGuard';
import { PAGE_VIEWS } from './pages';
import { PAGE_TITLE } from './titles';
import { useCtx } from './useSetup';

/**
 * One chapter of Profile & health (journey §16, board D79): its own page
 * views, one under another, and any page the change makes necessary, with
 * one Save. While a health review is pending, the three safety chapters open
 * together, with whether the person exercises now: only all of them
 * answered clear it.
 */
export function ChapterEditor({ chapter }: { chapter: ChapterId }) {
  const { profile } = useStore();
  const ctx = useCtx();
  const [today] = useState(() => dayOf(nowAt()));
  const opens = editorOpens(chapter, profile);
  const reopen = () => {
    const now = getState();
    return now.profile ? answersToEdit(setupStateOf(now.settings, now.profile).answers, now.profile, now.settings, today, ctx) : {};
  };
  const [opened, setOpened] = useState<SetupAnswers>(reopen);
  const [edits, setEdits] = useState<Partial<SetupAnswers>>({});
  // Numbers as typed: one is an answer only once it's valid, and Save waits for any that isn't (H5R-15).
  const [typed, setTyped] = useState<Readonly<Record<string, string>>>({});
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{ tone: 'status' | 'error'; lines: string[] }>();
  // A save the device refused: Save tries it again, or it's not kept.
  const [refused, setRefused] = useState(false);
  // A clinical one refused holds every movement till it's stored or not kept (board D197).
  const unsaved = useClinicalUnsaved();
  // The record this editor was opened for: a save for it, once another copy has replaced it, is refused (H5R-09).
  const [generation] = useState(() => getState().epoch);
  const a: SetupAnswers = { ...opened, ...edits };
  const state = editorState(opens, a, opened, ctx, typed);
  const { pages, blocking } = state;
  const reviewing = opens.reviewing;
  // A safety answer changed and not stored: leaving asks first (board D198).
  const clinical = Object.keys({ ...opened, ...edits }).some(k => isSafetyField(k) && !sameValue(opened[k as keyof SetupAnswers], a[k as keyof SetupAnswers]));

  const set = (patch: Partial<SetupAnswers>, texts: Readonly<Record<string, string | undefined>> = {}) => {
    setOutcome(undefined);
    setEdits(e => ({ ...e, ...patch }));
    setTyped(t => Object.fromEntries(Object.entries({ ...t, ...texts }).filter((e): e is [string, string] => e[1] !== undefined && e[1] !== '')));
  };

  const save = async () => {
    if (busy || !profile) return;
    if (blocking.length > 0) {
      setTried(true);
      return;
    }
    setBusy(true);
    const now = nowAt();
    const edit = editOf(state, opened);
    // Held until stored, so the record every gate reads changes only then, and with nothing to store to, not at all
    // (H5-08, K5R-05). A clinical save refused holds every movement for this session until it's stored or not kept
    // (board D197); the edit is planned inside its transaction, so a conflict is a refusal like any other (H5F-10).
    const write = () => update(d => editedRecord(d, edit, today, ctx), {
      hold: true, needsStorage: 'This phone isn’t storing data right now, so these answers aren’t saved.', addObservations: editMeasurements(edit, now), generation,
    });
    // Once a clinical save is refused, every later one is too, so a later refusal, a retraction included, never lifts
    // the hold, and only one stored lifts it (H5R-04).
    const held = clinical || unsaved;
    let saved: StoreResult;
    try {
      saved = held ? await saveClinical(write) : await write();
    } catch (error) {
      saved = { ok: false, failure: error instanceof StoreFailure ? error : new StoreFailure('unknown', 'The device did not keep it.', error) };
    } finally {
      setBusy(false);
    }
    if (!saved.ok) {
      // Another copy changed an answer this edit changed too, and neither is chosen (board D196): the editor shows that
      // copy's answer, keeps the person's others, and saves from the record as it is now (H5F-10).
      if (saved.failure.message === ANSWERS_CHANGED) {
        const latest = reopen();
        const { conflicts } = mergeAnswersWithConflicts(latest, opened, edit.answers);
        setOpened(latest);
        setEdits(e => conflicts.reduce<Partial<SetupAnswers>>((out, field) => putField(out, field, getField(latest, field)), e));
        setOutcome({ tone: 'error', lines: [ANSWERS_CHANGED] });
        return;
      }
      setRefused(true);
      setOutcome({ tone: 'error', lines: [`That did not save. ${saved.failure.message}`] });
      return;
    }
    setRefused(false);
    setTried(false);
    // The answers now as stored: nothing here is waiting any more.
    setOpened(reopen());
    setEdits({});
    setTyped({});
    const after = getState().profile;
    setOutcome({ tone: 'status', lines: ['Saved. Home uses your new answers.', ...(after ? whatChanges(profile, after) : [])] });
  };

  /** Not kept: the record's answers stand, and the page shows them again. */
  const forget = () => {
    if (unsaved) discardClinical();
    setRefused(false);
    setEdits({});
    setTyped({});
    setTried(false);
  };
  const discard = () => {
    forget();
    setOutcome({ tone: 'status', lines: ['Not kept. Your answers are as they were.'] });
  };

  return (
    <Screen title={CHAPTER_TITLE[chapter]} back={{ to: '/me/profile', label: 'Profile & health' }}>
      {reviewing && <Notice>Your health answers need a review. Check each answer, then Save.</Notice>}
      {pages.map((id, i) => {
        const View = PAGE_VIEWS[id as keyof typeof PAGE_VIEWS];
        const own = chapterOf(id);
        const first = i === 0 || chapterOf(pages[i - 1]) !== own;
        return (
          <section key={id} aria-labelledby={`edit-${id}`} className="flex flex-col gap-3">
            {first && own !== chapter && own !== 'review' && (
              <p className="px-1 text-[length:var(--text-footnote)] font-semibold uppercase tracking-wide text-muted-foreground">{CHAPTER_TITLE[own]}</p>
            )}
            <h2 id={`edit-${id}`} className="px-1 text-[length:var(--text-title-2)] font-semibold leading-snug">{PAGE_TITLE[id]}</h2>
            <View a={a} raw={typed} set={set} tried={tried} ctx={ctx} mode="edit" />
          </section>
        );
      })}
      <div className="flex flex-col gap-2">
        <Missing show={tried && blocking.length > 0}>Answer the questions marked above, then Save.</Missing>
        {outcome?.lines.map(line => <Notice key={line} tone={outcome.tone}>{line}</Notice>)}
        <PrimaryButton className="min-h-[3.75rem]" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : refused ? 'Try again' : 'Save'}</PrimaryButton>
        {(refused || unsaved) && !busy && <PlainButton className="min-h-12" onClick={discard}>Don’t keep these answers</PlainButton>}
      </div>
      <DiscardGuard dirty={clinical || unsaved} onDiscard={forget} />
    </Screen>
  );
}
