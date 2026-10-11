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

export interface Move {
  /** Store the draft, then go to `to` (M22). `state` goes with the navigation. */
  go: (to: PageId, answers: SetupAnswers, state?: Record<string, unknown>) => void;
  /** The last store was refused: the page stays, with its answers (§6.1). */
  failed: boolean;
  retry: () => void;
  /** B-07: go on, keeping the answers in this session only. */
  continueUnsaved: () => void;
}

interface Failed {
  to: PageId;
  answers: SetupAnswers;
  /** The navigation's own state, kept for Try again and Continue without saving. */
  state?: Record<string, unknown>;
}

type NavState = Record<string, unknown> | undefined;

/** `mover`, with each move carrying its navigation's state ("from Review", "Welcome back") to where it lands. */
function movesWithState(
  save: (to: PageId, answers: SetupAnswers) => Promise<SaveOutcome>,
  on: { moved: (to: PageId, state: NavState) => void; failed: (to: PageId, answers: SetupAnswers, state: NavState) => void },
): (to: PageId, answers: SetupAnswers, state: NavState) => void {
  let pending: NavState;
  const move = mover(save, { moved: to => on.moved(to, pending), failed: (to, answers) => on.failed(to, answers, pending) });
  return (to, answers, state) => {
    pending = state;
    void move(to, answers);
  };
}

export function useMove(): Move {
  const navigate = useNavigate();
  const [failed, setFailed] = useState<Failed>();
  const run = useMemo(() => movesWithState(
    async (to, answers) => {
      if (getSetupSession().unsaved) {
        keepInSession(to, answers);
        return 'session';
      }
      return outcomeOf(await update(d => withDraft(d, to, answers)), getState().status);
    },
    {
      moved: (to, state) => { setFailed(undefined); navigate(hrefOf(to), state ? { state } : undefined); },
      failed: (to, answers, state) => setFailed({ to, answers, ...(state ? { state } : {}) }),
    },
  ), [navigate]);
  return {
    go: run,
    failed: failed !== undefined,
    retry: () => { if (failed) run(failed.to, failed.answers, failed.state); },
    continueUnsaved: () => {
      if (!failed) return;
      continueWithoutSaving(failed.to, failed.answers);
      setFailed(undefined);
      navigate(hrefOf(failed.to), failed.state ? { state: failed.state } : undefined);
    },
  };
}
