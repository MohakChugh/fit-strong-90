import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { continueWithoutSaving, mover, saveDraft, useSetupSession, type Raw, type SaveOutcome } from '@/setup/draft';
import { CHAPTER_TITLE, hrefOf, type Ctx } from '@/setup/graph';
import { prefillAnswers } from '@/setup/prefill';
import { askAbout, safetyLeft } from '@/setup/progress';
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
export function useSetupAnswers(): { answers: SetupAnswers; raw: Raw | undefined; at: PageId | undefined; setup: SetupState } {
  const { settings, profile } = useStore();
  const session = useSetupSession();
  const setup = setupStateOf(settings, profile);
  if (session.unsaved) return { answers: session.answers, raw: session.raw, at: session.at, setup };
  return { answers: setup.draft?.answers ?? prefillAnswers(settings, profile), raw: setup.draft?.raw, at: setup.draft?.at, setup };
}

/**
 * While setup is unfinished, the safety chapter movement waits for, as the
 * tiles and hubs say it: "your back and feet", and "Answer 2 questions about
 * your back and feet" (§6.1; K5-07).
 */
export function useSafetyLeft(): { chapter: string; ask: string } | undefined {
  const { answers, setup } = useSetupAnswers();
  const ctx = useCtx();
  const left = setup.stage !== 'done' ? safetyLeft(answers, ctx) : undefined;
  return left && { chapter: CHAPTER_TITLE[left.chapter].toLowerCase(), ask: askAbout(left) };
}

type NavState = Record<string, unknown> | undefined;

/** How a move is made: `state` goes with the navigation; `opened`, what the page opened with, so only its own changes are stored (H5-12). */
export interface MoveOpts {
  state?: NavState;
  opened?: SetupAnswers;
  /** The record the page was opened for (`StoreState.epoch`): a store for one since replaced is refused (H5R-09). */
  generation?: number;
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

/** `mover`, with each move carrying its navigation's state ("Welcome back") to where it lands. */
function movesWithState(
  save: (to: PageId, answers: SetupAnswers, opened?: SetupAnswers, generation?: number) => Promise<SaveOutcome>,
  on: { moved: (to: PageId, state: NavState) => void; failed: () => void },
): (to: PageId, answers: SetupAnswers, opts?: MoveOpts) => void {
  let pending: MoveOpts = {};
  const move = mover((to, answers) => save(to, answers, pending.opened, pending.generation), { moved: to => on.moved(to, pending.state), failed: () => on.failed() });
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
      setFailed(false);
      navigate(hrefOf(to), opts.state ? { state: opts.state } : undefined);
    },
  };
}
