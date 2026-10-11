import { useState } from 'react';
import { Screen } from '@/components/hig/Screen';
import { dayOf, nowAt } from '@/health/observation';
import { measurementsFrom } from '@/setup/assemble';
import { whatChanges } from '@/setup/changes';
import { editOf, editedRecord, editorOpens, editorState } from '@/setup/edit';
import { CHAPTER_TITLE, chapterOf } from '@/setup/graph';
import { answersToEdit } from '@/setup/prefill';
import { setupStateOf } from '@/setup/state';
import { Notice, PrimaryButton } from '@/screens/you/controls';
import { getState, update, useStore } from '@/store/useStore';
import type { ChapterId, SetupAnswers } from '@/types/setup';
import { Missing } from './controls';
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
  const { settings, profile } = useStore();
  const ctx = useCtx();
  const [today] = useState(() => dayOf(nowAt()));
  const opens = editorOpens(chapter, profile);
  const [opened] = useState<SetupAnswers>(() => (profile ? answersToEdit(setupStateOf(settings, profile).answers, profile, settings, today, ctx) : {}));
  const [edits, setEdits] = useState<Partial<SetupAnswers>>({});
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{ tone: 'status' | 'error'; lines: string[] }>();
  const a: SetupAnswers = { ...opened, ...edits };
  const state = editorState(opens, a, opened, ctx);
  const { pages, committed, blocking } = state;
  const reviewing = opens.reviewing;

  const set = (patch: Partial<SetupAnswers>) => {
    setOutcome(undefined);
    setEdits(e => ({ ...e, ...patch }));
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
    const saved = await update(d => editedRecord(d, edit, today, ctx), { addObservations: measurementsFrom(committed, profile, now) });
    setBusy(false);
    if (!saved.ok) {
      setOutcome({ tone: 'error', lines: [`That did not save. ${saved.failure.message}`] });
      return;
    }
    setTried(false);
    const after = getState().profile;
    setOutcome({ tone: 'status', lines: ['Saved. Home uses your new answers.', ...(after ? whatChanges(profile, after) : [])] });
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
            <View a={a} set={set} tried={tried} ctx={ctx} mode="edit" />
          </section>
        );
      })}
      <div className="flex flex-col gap-2">
        <Missing show={tried && blocking.length > 0}>Answer the questions marked above, then Save.</Missing>
        {outcome?.lines.map(line => <Notice key={line} tone={outcome.tone}>{line}</Notice>)}
        <PrimaryButton className="min-h-[3.75rem]" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</PrimaryButton>
      </div>
    </Screen>
  );
}
