import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { continueWithoutSaving, forgetEdits, mover, saveDraft, useSetupSession, type SaveOutcome } from '@/setup/draft';
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

/** How a move is made: `state` goes with the navigation; `from`, the page left, has its edits in the draft then (K5-05); `opened`, what it opened with, so only its own changes are stored (H5-12). */
export interface MoveOpts {
  state?: NavState;
  from?: PageId;
  opened?: SetupAnswers;
}

export interface Move {
  /** Store the draft, then go to `to` (M22). */
  go: (to: PageId, answers: SetupAnswers, opts?: MoveOpts) => void;
  /** B-07: go to `to` without saving, keeping `answers` in this session only. */
  goUnsaved: (to: PageId, answers: SetupAnswers, opts?: MoveOpts) => void;
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

/** `mover`, with each move carrying its navigation's state ("from Review", "Welcome back") to where it lands, and the page it leaves. */
function movesWithState(
  save: (to: PageId, answers: SetupAnswers, from?: PageId, opened?: SetupAnswers) => Promise<SaveOutcome>,
  on: { moved: (to: PageId, state: NavState) => void; failed: () => void },
): (to: PageId, answers: SetupAnswers, opts?: MoveOpts) => void {
  let pending: MoveOpts = {};
  const move = mover((to, answers) => save(to, answers, pending.from, pending.opened), { moved: to => on.moved(to, pending.state), failed: () => on.failed() });
  return (to, answers, opts = {}) => {
    pending = opts;
    void move(to, answers);
  };
}

export function useMove(): Move {
  const navigate = useNavigate();
  // Only that a store was refused: never what was refused, so nothing stale can be replayed (H5-02).
  const [failed, setFailed] = useState(false);
  const run = useMemo(() => movesWithState(
    saveDraft,
    {
      moved: (to, state) => { setFailed(false); navigate(hrefOf(to), state ? { state } : undefined); },
      failed: () => setFailed(true),
    },
  ), [navigate]);
  return {
    go: run,
    failed,
    goUnsaved: (to, answers, opts = {}) => {
      continueWithoutSaving(to, answers);
      if (opts.from) forgetEdits(opts.from);
      setFailed(false);
      navigate(hrefOf(to), opts.state ? { state: opts.state } : undefined);
    },
  };
}
