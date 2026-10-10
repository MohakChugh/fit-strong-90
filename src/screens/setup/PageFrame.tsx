import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { markBack } from '@/components/hig/navigation';
import { pageEdits, rememberEdits } from '@/setup/draft';
import { capsuleOf, commitPage, hrefOf, nextFromReview, nextPage, pageDef, pageDone, prevPage } from '@/setup/graph';
import { PlainButton, PrimaryButton } from '@/screens/you/controls';
import type { PageId, SetupAnswers } from '@/types/setup';
import type { PageView } from './controls';
import { SetupShell } from './SetupShell';
import { PAGE_TITLE } from './titles';
import { useCtx, useMove, useSetupAnswers } from './useSetup';

/**
 * A setup page (journey §6.1): its view, then Next, which stores the answers
 * before moving (M22), and "Skip for now" on a preference page only. Back
 * keeps what the page held, for this session (§6.1). Opened from Review's
 * Edit, Next walks that chapter and then returns to Review.
 */
export function PageFrame({ id, View }: { id: PageId; View: PageView }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { answers } = useSetupAnswers();
  const move = useMove();
  const ctx = useCtx();
  const [edits, setEdits] = useState<Partial<SetupAnswers>>(() => pageEdits(id));
  const [tried, setTried] = useState(false);
  const a: SetupAnswers = { ...answers, ...edits };
  const fromReview = (location.state as { fromReview?: boolean } | null)?.fromReview === true;
  const carry = fromReview ? { fromReview: true } : undefined;
  const after = (stored: SetupAnswers) => (fromReview ? nextFromReview(stored, id, ctx) : nextPage(stored, id));

  const set = (patch: Partial<SetupAnswers>) => setEdits(e => {
    const next = { ...e, ...patch };
    rememberEdits(id, next);
    return next;
  });

  const next = () => {
    const stored = commitPage(id, a);
    if (!pageDone(id, stored, ctx)) {
      setTried(true);
      return;
    }
    // Answering a page takes it off the skipped list.
    const toStore = { ...stored, skippedPages: (stored.skippedPages ?? []).filter(p => p !== id) };
    move.go(after(toStore), toStore, carry);
  };

  const skip = () => {
    rememberEdits(id, {});
    const toStore = { ...answers, skippedPages: [...new Set([...(answers.skippedPages ?? []), id])] };
    move.go(after(toStore), toStore, carry);
  };

  const back = () => {
    const prev = prevPage(a, id);
    markBack();
    navigate(prev && prev !== 'welcome.start' ? hrefOf(prev) : '/setup', { replace: true, state: { back: true, ...carry } });
  };

  return (
    <SetupShell title={PAGE_TITLE[id]} capsule={capsuleOf(id, answers)} onBack={back} move={move}>
      <View a={a} set={set} tried={tried} ctx={ctx} mode="setup" />
      <div className="mt-auto flex flex-col gap-2 pt-2">
        <PrimaryButton className="min-h-[3.75rem]" onClick={next}>Next</PrimaryButton>
        {pageDef(id).skippable && <PlainButton className="min-h-12" onClick={skip}>Skip for now</PlainButton>}
      </div>
    </SetupShell>
  );
}
