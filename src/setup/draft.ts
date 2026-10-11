/**
 * Setup's draft (journey §6.1, §18.1; B-07). Every Next stores the answers
 * and the page to resume on before setup moves. When that write fails, setup
 * says so and offers to carry on without saving. Then the answers live only
 * in this session: completion is never stored, and every safety hold applies.
 */
import { useSyncExternalStore } from 'react';
import type { AppData } from '@/types';
import type { PageId, SetupAnswers } from '@/types/setup';
import { nowAt } from '@/health/observation';
import type { StoreResult } from '@/store/db';
import { getState, subscribe, update } from '@/store/useStore';
import { completedSetup, lookedAround, measurementsFrom } from './assemble';
import { mergeAnswers, mergeSkipped } from './merge';
import { prefillAnswers } from './prefill';
import type { Ctx } from './graph';
import { setupStateOf } from './state';

type Held = Partial<Record<PageId, Partial<SetupAnswers>>>;

/** The pages' held answers with page `id`'s set to `held`, or taken away when it holds none. */
function heldWith(edits: Held | undefined, id: PageId, held: Partial<SetupAnswers>): Held | undefined {
  const { [id]: _was, ...rest } = edits ?? {};
  void _was;
  const next = Object.keys(held).length > 0 ? { ...rest, [id]: held } : rest;
  return Object.keys(next).length > 0 ? next : undefined;
}

/**
 * The draft with `answers` stored and `at` to resume on. Given what the page
 * opened with, only the page's own changes are written, onto the draft as it
 * is now, so another tab's newer answers stay (H5-12, D165). What the page
 * `from` held is its answers now, so its entry goes; other pages' stay (H5-16).
 */
export function withDraft(data: AppData, at: PageId, answers: SetupAnswers, opened?: SetupAnswers, from?: PageId): AppData {
  const setup = setupStateOf(data.settings, data.profile);
  // Another tab finished setup meanwhile: nothing here may reopen it (Review Focus 4).
  if (setup.stage === 'done') return data;
  let stored = answers;
  if (opened) {
    const now = setup.draft?.answers ?? prefillAnswers(data.settings, data.profile);
    stored = { ...mergeAnswers(now, opened, answers), skippedPages: mergeSkipped(now.skippedPages, opened.skippedPages, answers.skippedPages) };
  }
  const edits = from === undefined ? setup.draft?.edits : heldWith(setup.draft?.edits, from, {});
  return { ...data, settings: { ...data.settings, setup: { ...setup, draft: { at, answers: stored, ...(edits ? { edits } : {}) } } } };
}

/**
 * What page `id` holds, as typed, onto the draft, with `at` to resume on: the
 * page itself, or Back's page before (§6.1; H5-16, K5-17). The draft's
 * answers stay as they are: only a Next or Skip stores a page's answers.
 */
export function withPageEdits(data: AppData, at: PageId, id: PageId, held: Partial<SetupAnswers>): AppData {
  const setup = setupStateOf(data.settings, data.profile);
  if (setup.stage === 'done') return data;
  const edits = heldWith(setup.draft?.edits, id, held);
  const { edits: _old, ...draft } = setup.draft ?? {};
  void _old;
  return { ...data, settings: { ...data.settings, setup: { ...setup, draft: { ...draft, at, ...(edits ? { edits } : {}) } } } };
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
/**
 * The record the session belongs to (`StoreState.epoch`). Once a backup
 * replaces it, or everything is deleted, the session reads as empty: another
 * record's answers never show over the new one's (H5-07).
 */
let sessionEpoch = 0;
const listeners = new Set<() => void>();
const current = (): SetupSession => (sessionEpoch === getState().epoch ? session : EMPTY);
const publish = (next: SetupSession) => {
  session = next;
  sessionEpoch = getState().epoch;
  for (const listener of [...listeners]) listener();
};

export function useSetupSession(): SetupSession {
  return useSyncExternalStore(listener => {
    listeners.add(listener);
    // The record's epoch moves on in the store, so that's listened to as well.
    const stop = subscribe(listener);
    return () => { listeners.delete(listener); stop(); };
  }, current, current);
}
export const getSetupSession = (): SetupSession => current();

export function continueWithoutSaving(at: PageId, answers: SetupAnswers): void {
  publish({ ...current(), unsaved: true, at, answers });
}
export function keepInSession(at: PageId, answers: SetupAnswers): void {
  publish({ ...current(), at, answers });
}
export function enterWithoutSaving(): void {
  publish({ ...current(), entered: true });
}

/** Setup's session and what its pages held, forgotten once setup is finished (K5-05). */
export function resetSetupSession(): void {
  clearHeld();
  publish(EMPTY);
}

/**
 * The draft stored before a move (M22), or kept for this session while setup
 * goes on without saving (B-07). Storage refused from the start, or gone
 * since, is the same as a draft that won't save: setup goes on in its
 * explicit unsaved mode, so its warning shows and its answers live here
 * (H5-06). Once stored or kept, what the page `from` held is the draft's, so
 * it's forgotten there (K5-05). `opened`: what the page opened with, so only
 * its own changes are written (`withDraft`, H5-12).
 */
export async function saveDraft(to: PageId, answers: SetupAnswers, from?: PageId, opened?: SetupAnswers, generation?: number): Promise<SaveOutcome> {
  // A change still waiting to be kept would put back what this move stores (H5-16).
  if (from !== undefined) cancelAutosave(from);
  let outcome: SaveOutcome;
  if (current().unsaved) {
    keepInSession(to, answers);
    outcome = 'session';
  } else {
    outcome = outcomeOf(await update(d => withDraft(d, to, answers, opened, from), { ...(generation !== undefined ? { generation } : {}) }), getState().status);
    if (outcome === 'session') continueWithoutSaving(to, answers);
  }
  if (from !== undefined && outcome !== 'failed') forgetEdits(from);
  return outcome;
}

export type FinishOutcome = { kind: 'home' } | { kind: 'failed'; message: string };

/** Setup ends without saving (B-07): the app opens for this session only, with the answers here and nothing completed. */
function enterUnsaved(answers: SetupAnswers): FinishOutcome {
  if (!current().unsaved) continueWithoutSaving('review', answers);
  enterWithoutSaving();
  return { kind: 'home' };
}

/**
 * "Start using FitStrong" (journey §6.2): the profile, the settings,
 * completion and Home's first tiles as one write, held until stored, since
 * finishing opens Home and a refusal must leave the person on Review, where
 * it is said (D-04). Without saving, chosen or because storage was refused,
 * the app opens for this session only, and completion is never run, even in
 * this session's memory: its safety gap stays, so every hold applies (B-07;
 * H5-06). Storage going while it's written refuses it the same way.
 *
 * Planned against what is stored, it keeps a setup another tab finished
 * meanwhile, and goes Home to it; answers changed since Review drew them are
 * not finished, and Review says so (H5-09). Either way, the readings it would
 * have added aren't.
 */
export async function finishSetup(answers: SetupAnswers, ctx: Ctx, now: string = nowAt(), generation?: number): Promise<FinishOutcome> {
  if (current().unsaved) return enterUnsaved(answers);
  const state = getState();
  const hasSteps = state.observations.some(o => o.kind === 'steps');
  const done = (d: Pick<AppData, 'settings' | 'profile'>) => setupStateOf(d.settings, d.profile).stage === 'done';
  const saved = await update(d => completedSetup(d, answers, now, { ...ctx, hasSteps }), {
    hold: true,
    needsStorage: 'This phone isn’t storing data, so setup is not finished: it carries on without saving.',
    addObservations: measurementsFrom(answers, state.profile, now),
    addObservationsWhen: (before, after) => !done(before) && done(after),
    ...(generation !== undefined ? { generation } : {}),
  });
  if (saved.ok) {
    if (!done(getState())) {
      return { kind: 'failed', message: 'Your answers changed in another window of FitStrong. Check them here, then start again.' };
    }
    resetSetupSession();
    return { kind: 'home' };
  }
  if (saved.failure.code === 'unavailable') return enterUnsaved(answers);
  return { kind: 'failed', message: `That did not save. ${saved.failure.message}` };
}

/**
 * "Look around first" (journey §6.4): Home now, with every movement held,
 * held until stored, since a refusal must leave the person here, where it is
 * said (D-04). The answers so far wait in the draft; what the pages held is
 * forgotten (K5-05). Returns what to say when it's refused.
 */
export async function lookAroundFirst(generation?: number): Promise<string | undefined> {
  const saved = await update(lookedAround, { hold: true, ...(generation !== undefined ? { generation } : {}) });
  if (!saved.ok && getState().status !== 'unavailable') return `That did not save. ${saved.failure.message}`;
  clearHeld();
  return undefined;
}

/**
 * What each page held when it was left, for this session and this record:
 * Back never loses answers (§6.1), and a record restored over it never shows
 * them (H5-07).
 */
const edits = new Map<PageId, Partial<SetupAnswers>>();
let editsEpoch = 0;
const heldNow = () => {
  if (editsEpoch !== getState().epoch) {
    edits.clear();
    editsEpoch = getState().epoch;
  }
  return edits;
};
/**
 * What page `id` held: this session's, else what the draft kept when the app
 * last closed (H5-16). Without saving, the draft is behind this session's
 * answers, so what it kept is never drawn over them (K5-05).
 */
export const pageEdits = (id: PageId): Partial<SetupAnswers> => {
  const { settings, profile } = getState();
  const kept = current().unsaved ? undefined : setupStateOf(settings, profile).draft?.edits?.[id];
  return heldNow().get(id) ?? kept ?? {};
};
export function rememberEdits(id: PageId, next: Partial<SetupAnswers>): void {
  heldNow().set(id, next);
}
/** A page's answers stored: the draft has them, so a change made elsewhere since is never drawn under them (K5-05). */
export function forgetEdits(id: PageId): void {
  cancelAutosave(id);
  heldNow().delete(id);
}

/** How long after a change its page's answers are kept in the draft (§6.1; board D158). */
export const AUTOSAVE_MS = 500;
/** Each change waiting to be kept, with the record it was made in (`StoreState.epoch`). */
const waiting = new Map<PageId, { timer: ReturnType<typeof setTimeout>; epoch: number }>();

export function cancelAutosave(id: PageId): void {
  clearTimeout(waiting.get(id)?.timer);
  waiting.delete(id);
}
function clearHeld(): void {
  for (const id of [...waiting.keys()]) cancelAutosave(id);
  edits.clear();
}

/**
 * A change on page `id`: held at once for this session, and kept in the
 * draft as typed shortly after, so closing the app loses nothing (§6.1;
 * H5-16, K5-17; board D158). Next still stores the page's answers itself,
 * and waits until they're stored.
 */
export function autosaveEdits(id: PageId, held: Partial<SetupAnswers>, delayMs = AUTOSAVE_MS): void {
  rememberEdits(id, held);
  cancelAutosave(id);
  waiting.set(id, { epoch: getState().epoch, timer: setTimeout(() => void flushPending(id), delayMs) });
}

/**
 * A change still waiting on page `id`, kept now: as the page is left, or the
 * app goes to the background. Only into the record it was made in: once a
 * backup replaces it, or everything is deleted, it's dropped (H5-07).
 */
export function flushPending(id: PageId): Promise<void> {
  const change = waiting.get(id);
  cancelAutosave(id);
  return change && change.epoch === getState().epoch ? flushEdits(id, id, change.epoch) : Promise.resolve();
}

/**
 * What page `id` holds, kept now, with `at` to resume on: Back's page before,
 * or the page itself on Close (H5-16). Without saving, the session keeps the
 * page to resume on, and its pages' answers are this session's already.
 */
export async function flushEdits(id: PageId, at: PageId, generation?: number): Promise<void> {
  cancelAutosave(id);
  if (current().unsaved) {
    keepInSession(at, current().answers);
    return;
  }
  const held = pageEdits(id);
  await update(d => withPageEdits(d, at, id, held), { ...(generation !== undefined ? { generation } : {}) });
}

export function resetSetupSessionForTests(): void {
  session = EMPTY;
  sessionEpoch = 0;
  clearHeld();
  editsEpoch = 0;
}
