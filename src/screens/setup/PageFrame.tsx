import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { markBack } from '@/components/hig/navigation';
import { pageEdits, rememberEdits } from '@/setup/draft';
import { capsuleOf, hrefOf, nextMove, pageDef, prevPage, skipMove, type PlannedMove } from '@/setup/graph';
import { PlainButton, PrimaryButton } from '@/screens/you/controls';
import type { PageId, SetupAnswers } from '@/types/setup';
import type { PageView } from './controls';
import { SetupShell } from './SetupShell';
import { PAGE_TITLE } from './titles';
import { useCtx, useMove, useSetupAnswers, type Recovery } from './useSetup';

/**
 * A setup page (journey §6.1): its view, then Next, which stores the answers
 * before moving (M22), and "Skip for now" on a preference page only. Back
 * keeps what the page held, for this session (§6.1). Opened from Review's
 * Edit, Next walks that chapter and then returns to Review. After a refused
 * store, Try again and Continue without saving plan the move again from the
 * page as it is now (H5-02).
 */
export function PageFrame({ id, View }: { id: PageId; View: PageView }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { answers } = useSetupAnswers();
  const move = useMove();
  const ctx = useCtx();
  const [edits, setEdits] = useState<Partial<SetupAnswers>>(() => pageEdits(id));
  const [tried, setTried] = useState(false);
  // The move the last store was for: Try again makes it again.
  const [last, setLast] = useState<'next' | 'skip'>('next');
  const a: SetupAnswers = { ...answers, ...edits };
  const fromReview = (location.state as { fromReview?: boolean } | null)?.fromReview === true;
  const carry = fromReview ? { fromReview: true } : undefined;

  const set = (patch: Partial<SetupAnswers>) => setEdits(e => {
    const next = { ...e, ...patch };
    rememberEdits(id, next);
    return next;
  });

  /** Next or Skip for now, stored then made; or, without saving, kept for this session (B-07). */
  const attempt = (kind: 'next' | 'skip', unsaved = false) => {
    setLast(kind);
    let planned: PlannedMove | undefined;
    if (kind === 'skip') {
      rememberEdits(id, {});
      planned = skipMove(id, answers, ctx, fromReview);
    } else {
      planned = nextMove(id, a, ctx, fromReview);
      if (!planned) {
        setTried(true);
        return;
      }
    }
    (unsaved ? move.goUnsaved : move.go)(planned.to, planned.answers, carry);
  };
  const recovery: Recovery = { failed: move.failed, retry: () => attempt(last), continueUnsaved: () => attempt(last, true) };

  const back = () => {
    const prev = prevPage(a, id);
    markBack();
    navigate(prev && prev !== 'welcome.start' ? hrefOf(prev) : '/setup', { replace: true, state: { back: true, ...carry } });
  };

  return (
    <SetupShell title={PAGE_TITLE[id]} capsule={capsuleOf(id, answers)} onBack={back} recovery={recovery}>
      <View a={a} set={set} tried={tried} ctx={ctx} mode="setup" />
      <div className="mt-auto flex flex-col gap-2 pt-2">
        <PrimaryButton className="min-h-[3.75rem]" onClick={() => attempt('next')}>Next</PrimaryButton>
        {pageDef(id).skippable && <PlainButton className="min-h-12" onClick={() => attempt('skip')}>Skip for now</PlainButton>}
      </div>
    </SetupShell>
  );
}
