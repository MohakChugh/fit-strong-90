import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { markBack } from '@/components/hig/navigation';
import {
  CHANGED_ELSEWHERE, changeAnswers, continueUnsaved, discardWaiting, flushAnswers, nextFrom, rawWithQueued, skipFrom, useAnswersQueue, waitingOn, withQueued,
  type SaveOutcome,
} from '@/setup/draft';
import { getState } from '@/store/useStore';
import { SAFETY_CHAPTERS, backFromReview, capsuleOf, chapterOf, hrefOf, nextMove, pageDef, pageInvalid, prevPage, rawInvalid } from '@/setup/graph';
import { Notice, PlainButton, PrimaryButton } from '@/screens/you/controls';
import type { ChapterId, PageId, SetupAnswers } from '@/types/setup';
import type { PageView } from './controls';
import { DiscardGuard } from './DiscardGuard';
import { SetupShell } from './SetupShell';
import { PAGE_TITLE } from './titles';
import { useCtx, useSetupAnswers, type Recovery } from './useSetup';

/**
 * A setup page (journey §6.1): its view, then Next, and "Skip for now" on a
 * preference page only. Each change goes into the draft's answers shortly
 * after it's made, with numbers as typed, so Back, Close and closing the app
 * lose nothing (board D169). Next stores what's waiting, then the move,
 * planned from the answers as stored (M22, H5R-11). Opened from Review's
 * Edit, Next walks that chapter and then returns to Review, and so does Back
 * from its first page (K5-14). A refused write, a change's or a move's, shows
 * here with Try again and Continue without saving, each from the page as it
 * is now (H5-02, H5R-16): Back and Close wait for theirs, and stay if it's
 * refused. On a safety page, leaving with its changes refused asks first,
 * "Discard your changes?" (board D198).
 */
export function PageFrame({ id, View }: { id: PageId; View: PageView }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { answers, raw: storedRaw } = useSetupAnswers();
  const queue = useAnswersQueue();
  const ctx = useCtx();
  // The record this page was opened for: a store for it, once another copy has replaced it, is refused (H5R-09).
  const [generation] = useState(() => getState().epoch);
  const [tried, setTried] = useState(false);
  // The move a refused store was for: Try again and Continue without saving make it again.
  const [refusedMove, setRefusedMove] = useState<'next' | 'skip'>();
  const moving = useRef(false);
  const a = withQueued(answers);
  const raw = rawWithQueued(storedRaw);
  const fromReview = (location.state as { fromReview?: boolean } | null)?.fromReview === true;
  const carry = fromReview ? { fromReview: true } : undefined;
  // A safety page's own changes the device refused: leaving asks first (board D198), Back's and Close's as the browser's.
  const safety = SAFETY_CHAPTERS.includes(chapterOf(id) as ChapterId);
  const refusedHere = safety && queue.refused !== undefined && waitingOn(id);
  const [asking, setAsking] = useState<() => void>();
  /** Refused, the page stays, saying so; on a safety page, with its changes still waiting, it asks before `go`. */
  const stayOrAsk = (outcome: SaveOutcome, go: () => void) => {
    if (outcome !== 'failed') go();
    else if (safety && waitingOn(id)) setAsking(() => go);
  };

  const set = (patch: Partial<SetupAnswers>, typed: Readonly<Record<string, string | undefined>> = {}) => changeAnswers(a, patch, typed, id);
  // What's waiting is stored as the page is left, or the app goes to the background (H5-16).
  useEffect(() => {
    const away = () => { if (document.visibilityState === 'hidden') void flushAnswers(); };
    document.addEventListener('visibilitychange', away);
    return () => {
      document.removeEventListener('visibilitychange', away);
      void flushAnswers();
    };
  }, []);

  /** Next or Skip for now: stored, then made; or, without saving, kept for this session (B-07). */
  const attempt = async (kind: 'next' | 'skip') => {
    if (moving.current) return;
    // Optional is optional; an answer given that can't be stored isn't: it's fixed or cleared first, and the page says why (K5-04, H5R-15).
    if (rawInvalid(id, a, raw) || (kind === 'skip' ? pageInvalid(id, a, ctx) : !nextMove(id, a, ctx, fromReview))) {
      setTried(true);
      return;
    }
    moving.current = true;
    try {
      const moved = await (kind === 'skip' ? skipFrom : nextFrom)(id, ctx, fromReview, generation);
      setRefusedMove(moved.outcome === 'failed' ? kind : undefined);
      if (moved.outcome === 'notDone') setTried(true);
      // A change made here while the move was stored stays on the page, for another look; Next goes on from it (H5R-11).
      if (moved.outcome === 'failed' || moved.outcome === 'notDone' || waitingOn(id)) return;
      navigate(hrefOf(moved.to), carry ? { state: carry } : undefined);
    } finally {
      moving.current = false;
    }
  };
  const recovery: Recovery = {
    failed: refusedMove !== undefined || queue.refused !== undefined,
    retry: () => void (refusedMove ? attempt(refusedMove) : flushAnswers()),
    continueUnsaved: () => {
      continueUnsaved(id, answers, storedRaw);
      if (refusedMove) void attempt(refusedMove);
    },
  };

  const back = async () => {
    const prev = fromReview ? backFromReview(a, id) : prevPage(a, id);
    // Stored first, with the page Back goes to as the one to resume on (H5-16, H5R-16).
    stayOrAsk(await flushAnswers(prev ?? 'welcome.start'), () => {
      markBack();
      navigate(prev && prev !== 'welcome.start' ? hrefOf(prev) : '/setup', { replace: true, state: { back: true, ...carry } });
    });
  };
  // Close goes Home once it's stored (SetupShell); refused, a safety page asks first.
  const close = async () => {
    const outcome = await flushAnswers(id);
    if (outcome === 'failed') stayOrAsk(outcome, () => navigate('/home'));
    return outcome;
  };

  return (
    <SetupShell title={PAGE_TITLE[id]} capsule={capsuleOf(id, a)} onBack={() => void back()} onClose={close} recovery={recovery}>
      <View a={a} raw={raw} set={set} tried={tried} ctx={ctx} mode="setup" />
      <div className="mt-auto flex flex-col gap-2 pt-2">
        {queue.changedElsewhere && <Notice>{CHANGED_ELSEWHERE}</Notice>}
        <PrimaryButton className="min-h-[3.75rem]" onClick={() => void attempt('next')}>Next</PrimaryButton>
        {pageDef(id).skippable && <PlainButton className="min-h-12" onClick={() => void attempt('skip')}>Skip for now</PlainButton>}
      </div>
      <DiscardGuard dirty={refusedHere} onDiscard={() => discardWaiting(id)} open={asking !== undefined}
        onDone={discarded => { setAsking(undefined); if (discarded) asking?.(); }} />
    </SetupShell>
  );
}
