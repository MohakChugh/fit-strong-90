/**
 * Setup's draft (journey §6.1, §18.1; B-07). Every Next stores the answers
 * and the page to resume on before setup moves. When that write fails, setup
 * says so and offers to carry on without saving. Then the answers live only
 * in this session: completion is never stored, and every safety hold applies.
 */
import { useSyncExternalStore } from 'react';
import type { AppData } from '@/types';
import type { PageId, SetupAnswers } from '@/types/setup';
import type { StoreResult } from '@/store/db';
import { setupStateOf } from './state';

export function withDraft(data: AppData, at: PageId, answers: SetupAnswers): AppData {
  const setup = setupStateOf(data.settings, data.profile);
  // Another tab finished setup meanwhile: nothing here may reopen it (Review Focus 4).
  if (setup.stage === 'done') return data;
  return { ...data, settings: { ...data.settings, setup: { ...setup, draft: { at, answers } } } };
}

export type SaveOutcome = 'saved' | 'session' | 'failed';

export function outcomeOf(result: StoreResult, status: 'loading' | 'ready' | 'unavailable'): SaveOutcome {
  if (result.ok) return 'saved';
  // Storage never opened: the store keeps the change for this session, and its banner says so (F09).
  return status === 'unavailable' ? 'session' : 'failed';
}

/** One move at a time: Next waits for its answer to be stored, so a fast double tap can't skip a question (M22). */
export function mover(
  save: (to: PageId, answers: SetupAnswers) => Promise<SaveOutcome>,
  on: { moved: (to: PageId) => void; failed: (to: PageId, answers: SetupAnswers) => void },
): (to: PageId, answers: SetupAnswers) => Promise<SaveOutcome | undefined> {
  let busy = false;
  return async (to, answers) => {
    if (busy) return undefined;
    busy = true;
    try {
      const outcome = await save(to, answers).catch((): SaveOutcome => 'failed');
      if (outcome === 'failed') on.failed(to, answers);
      else on.moved(to);
      return outcome;
    } finally {
      busy = false;
    }
  };
}

export interface SetupSession {
  /** Setup goes on without saving: the warning stays, and the answers live here. */
  unsaved: boolean;
  /** "Start using FitStrong" without saving: the app opens for this session only. */
  entered: boolean;
  answers: SetupAnswers;
  at?: PageId;
}

const EMPTY: SetupSession = { unsaved: false, entered: false, answers: {} };
let session: SetupSession = EMPTY;
const listeners = new Set<() => void>();
const publish = (next: SetupSession) => {
  session = next;
  for (const listener of [...listeners]) listener();
};

export function useSetupSession(): SetupSession {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => session);
}
export const getSetupSession = (): SetupSession => session;

export function continueWithoutSaving(at: PageId, answers: SetupAnswers): void {
  publish({ ...session, unsaved: true, at, answers });
}
export function keepInSession(at: PageId, answers: SetupAnswers): void {
  publish({ ...session, at, answers });
}
export function enterWithoutSaving(): void {
  publish({ ...session, entered: true });
}

/** What each page held when it was left, for this session: Back never loses answers (§6.1). */
const edits = new Map<PageId, Partial<SetupAnswers>>();
export const pageEdits = (id: PageId): Partial<SetupAnswers> => edits.get(id) ?? {};
export function rememberEdits(id: PageId, next: Partial<SetupAnswers>): void {
  edits.set(id, next);
}

export function resetSetupSessionForTests(): void {
  session = EMPTY;
  edits.clear();
}
