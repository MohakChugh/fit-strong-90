import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getState, update, useStore } from '@/store/useStore';
import { continueWithoutSaving, getSetupSession, keepInSession, mover, outcomeOf, useSetupSession, withDraft, type SaveOutcome } from '@/setup/draft';
import { hrefOf, type Ctx } from '@/setup/graph';
import { prefillAnswers } from '@/setup/prefill';
import { setupStateOf } from '@/setup/state';
import type { PageId, SetupAnswers, SetupState } from '@/types/setup';

/** This year, for the birth-year check, read once when the page opens (render stays pure). */
export function useCtx(): Ctx {
  const [ctx] = useState<Ctx>(() => ({ thisYear: new Date().getFullYear() }));
  return ctx;
}

/**
 * The answers setup has: this session's when it goes on without saving, else
 * the stored draft's, else what the record already says (K-57, §6.4).
 */
export function useSetupAnswers(): { answers: SetupAnswers; at: PageId | undefined; setup: SetupState } {
  const { settings, profile } = useStore();
  const session = useSetupSession();
  const setup = setupStateOf(settings, profile);
  if (session.unsaved) return { answers: session.answers, at: session.at, setup };
  return { answers: setup.draft?.answers ?? prefillAnswers(settings, profile), at: setup.draft?.at, setup };
}

type NavState = Record<string, unknown> | undefined;

export interface Move {
  /** Store the draft, then go to `to` (M22). `state` goes with the navigation. */
  go: (to: PageId, answers: SetupAnswers, state?: NavState) => void;
  /** B-07: go to `to` without saving, keeping `answers` in this session only. */
  goUnsaved: (to: PageId, answers: SetupAnswers, state?: NavState) => void;
  /** The last store was refused: the page stays, with its answers (§6.1). */
  failed: boolean;
}

/**
 * A refused store's two ways on (§6.1, B-07). Each runs the page's own move
 * again, planned from the page as it is now. What was refused is never
 * replayed, so a correction made since is the one stored, and its page is
 * the one gone to (H5-02).
 */
export interface Recovery {
  failed: boolean;
  retry: () => void;
  continueUnsaved: () => void;
}

/** `mover`, with each move carrying its navigation's state ("from Review", "Welcome back") to where it lands. */
function movesWithState(
  save: (to: PageId, answers: SetupAnswers) => Promise<SaveOutcome>,
  on: { moved: (to: PageId, state: NavState) => void; failed: () => void },
): (to: PageId, answers: SetupAnswers, state: NavState) => void {
  let pending: NavState;
  const move = mover(save, { moved: to => on.moved(to, pending), failed: () => on.failed() });
  return (to, answers, state) => {
    pending = state;
    void move(to, answers);
  };
}

export function useMove(): Move {
  const navigate = useNavigate();
  // Only that a store was refused: never what was refused, so nothing stale can be replayed (H5-02).
  const [failed, setFailed] = useState(false);
  const run = useMemo(() => movesWithState(
    async (to, answers) => {
      if (getSetupSession().unsaved) {
        keepInSession(to, answers);
        return 'session';
      }
      return outcomeOf(await update(d => withDraft(d, to, answers)), getState().status);
    },
    {
      moved: (to, state) => { setFailed(false); navigate(hrefOf(to), state ? { state } : undefined); },
      failed: () => setFailed(true),
    },
  ), [navigate]);
  return {
    go: run,
    failed,
    goUnsaved: (to, answers, state) => {
      continueWithoutSaving(to, answers);
      setFailed(false);
      navigate(hrefOf(to), state ? { state } : undefined);
    },
  };
}
