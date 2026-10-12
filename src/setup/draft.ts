/**
 * Setup's draft (journey §6.1, §18.1; B-07; board D169): one store of answers.
 *
 * - A page's changes go into the draft's answers field by field, a checklist
 *   row by row, shortly after each one (`changeAnswers`). Each carries what its
 *   control started from, so another copy's answer is never overwritten
 *   unseen (H5R-03, H5R-14; board D190). Review, routing, the gates and
 *   finishing all read those same answers (H5R-01).
 * - A number typed is kept as typed in `draft.raw`, and is an answer only once
 *   it's a valid one; the page shows it back as typed (H5R-15).
 * - Next stores what's waiting, then commits the page and works out where to
 *   go from the answers as stored, in one transaction, and takes nothing away
 *   (H5R-11).
 * - When a write fails, every page says so, with Try again and Continue
 *   without saving (H5R-16). Without saving, the answers live only in this
 *   session: completion is never stored, and every safety hold applies.
 */
import { useSyncExternalStore } from 'react';
import type { AppData } from '@/types';
import type { ChapterId, PageId, SetupAnswers } from '@/types/setup';
import { nowAt } from '@/health/observation';
import { StoreFailure, type StoreResult } from '@/store/db';
import { sameValue } from '@/store/transfer';
import { getState, subscribe, update } from '@/store/useStore';
import { completedSetup, lookedAround, measurementsFrom } from './assemble';
import { CHAPTER_TITLE, RAW_FIELDS, chapterOf, nextMove, pageDef, rawLeft, rawPage, skipMove, type Ctx, type PlannedMove } from './graph';
import { fieldRoot, getField, isSafetyField, mergeAnswers, mergeSkipped, putField, stricterAnswer } from './merge';
import type { RawKey } from './limits';
import { prefillAnswers } from './prefill';
import { setupStateOf } from './state';

/** Numbers as typed on setup's pages, by their key in `RAW_FIELDS`. */
export type Raw = Readonly<Record<string, string>>;
type Bag = Record<string, unknown>;

/** Said when another copy finished setup before this one's answers were stored (K5R-04). */
export const FINISHED_ELSEWHERE = 'Setup was finished in another window of FitStrong, so your last answers here weren’t saved. Check them in Me → Profile & health.';

/** Said wherever the person is by then, since setup closes behind them (K5R-04): the app's toasts, loaded only when one is needed. */
const tell = (message: string) => void import('sonner').then(({ toast }) => toast(message)).catch(() => undefined);

/** Said when an answer changed here was changed in another copy at the same time, and that copy's was kept (board D190). */
export const CHANGED_ELSEWHERE = 'Another window of FitStrong changed an answer at the same time, and its answer was kept. Check your answers, then carry on.';

/** `raw` with each text changed in `typed`: an empty one taken away. */
function withTexts(raw: Raw | undefined, typed: Iterable<[string, string | undefined]>): Bag {
  const out: Bag = { ...(raw ?? {}) };
  for (const [key, text] of typed) {
    if (text === undefined || text === '') delete out[key];
    else out[key] = text;
  }
  return out;
}

/** Only the texts of numbers these answers show: a question hidden takes its number's text with it, as its answer (H5-27). */
function shownTexts(raw: Raw | undefined, a: SetupAnswers): Raw | undefined {
  const kept = Object.entries(raw ?? {}).filter(([key]) => RAW_FIELDS[key as RawKey]?.(a) === true);
  return kept.length > 0 ? Object.fromEntries(kept) : undefined;
}

/**
 * The draft with `answers` stored and `at` to resume on. Given what the page
 * opened with, only the page's own changes are written, onto the draft as it
 * is now, so another tab's newer answers stay (H5-12, D165).
 */
export function withDraft(data: AppData, at: PageId, answers: SetupAnswers, opened?: SetupAnswers): AppData {
  const setup = setupStateOf(data.settings, data.profile);
  // Another tab finished setup meanwhile: nothing here may reopen it (Review Focus 4).
  if (setup.stage === 'done') return data;
  let stored = answers;
  if (opened) {
    const now = setup.draft?.answers ?? prefillAnswers(data.settings, data.profile);
    stored = { ...mergeAnswers(now, opened, answers), skippedPages: mergeSkipped(now.skippedPages, opened.skippedPages, answers.skippedPages) };
  }
  const raw = shownTexts(setup.draft?.raw, stored);
  return { ...data, settings: { ...data.settings, setup: { ...setup, draft: { at, answers: stored, ...(raw ? { raw } : {}) } } } };
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

// ---- Without saving (B-07) ----

export interface SetupSession {
  /** Setup goes on without saving: the warning stays, and the answers live here. */
  unsaved: boolean;
  /** "Start using FitStrong" without saving: the app opens for this session only. */
  entered: boolean;
  answers: SetupAnswers;
  raw?: Raw;
  at?: PageId;
}

const EMPTY: SetupSession = { unsaved: false, entered: false, answers: {} };
let session: SetupSession = EMPTY;
/**
 * The record the session belongs to (`StoreState.epoch`). Once a backup
 * replaces it, or everything is deleted, here or in another copy, the session
 * reads as empty: another record's answers never show over the new one's
 * (H5-07, H5R-09).
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

export function continueWithoutSaving(at: PageId, answers: SetupAnswers, raw?: Raw): void {
  publish({ ...current(), unsaved: true, at, answers, ...(raw ? { raw } : {}) });
}
export function keepInSession(at: PageId, answers: SetupAnswers): void {
  publish({ ...current(), at, answers });
}
export function enterWithoutSaving(): void {
  publish({ ...current(), entered: true });
}

/** Setup's session and what's waiting to be stored, forgotten once setup is finished (K5-05). */
export function resetSetupSession(): void {
  clearQueue();
  queueChanged();
  publish(EMPTY);
}

// ---- One store of answers: a page's changes, field by field (boards D169, D190) ----

/** A page's change to one field: what its control started from, and the new value. */
export interface FieldChange { baseline: unknown; value: unknown }

const CHECKLISTS: readonly string[] = ['conditions', 'classes'];

/** Every field a page's patch changes from what it shows: a checklist row by row, any other answer whole. */
export function fieldChanges(shown: SetupAnswers, patch: Partial<SetupAnswers>): [string, unknown][] {
  const out: [string, unknown][] = [];
  for (const [key, value] of Object.entries(patch)) {
    const was = (shown as Bag)[key];
    if (CHECKLISTS.includes(key) && (value === undefined || typeof value === 'object')) {
      const [before, after] = [(was ?? {}) as Bag, (value ?? {}) as Bag];
      for (const row of new Set([...Object.keys(before), ...Object.keys(after)])) if (!sameValue(before[row], after[row])) out.push([`${key}.${row}`, after[row]]);
    } else if (!sameValue(was, value)) {
      out.push([key, value]);
    }
  }
  return out;
}

/**
 * Changes onto the draft as it is now, inside its transaction (boards D190,
 * D196): each written where the stored answer is still what its control
 * started from. Where it isn't, another copy changed it meanwhile: a
 * preference takes this one, the later; a Yes, No or Not sure safety answer
 * the earlier in Yes, Not sure, No (`stricterAnswer`); any other safety
 * answer stays as stored. Each answer not written as given is named in
 * `kept`, and its number's text isn't written either, so a page never shows
 * a number its answer isn't. So with texts alone, typed with no answer yet:
 * written only while the stored answer is still the one they were typed
 * against (`baselines`, by field); another copy's answer stored meanwhile is
 * kept, with its texts, and named (H5F-06; board D220).
 */
export function withFields(
  data: AppData, changes: ReadonlyMap<string, FieldChange>, raw: ReadonlyMap<string, string | undefined>, at: PageId | undefined, kept: string[] = [],
  baselines: ReadonlyMap<string, unknown> = new Map(),
): AppData {
  const setup = setupStateOf(data.settings, data.profile);
  // Another copy finished setup meanwhile: this copy's answers aren't stored onto it (K5R-04).
  if (setup.stage === 'done') throw new StoreFailure('conflict', FINISHED_ELSEWHERE);
  let answers = setup.draft?.answers ?? prefillAnswers(data.settings, data.profile);
  for (const [field, { baseline, value }] of changes) {
    const stored = getField(answers, field);
    const chosen = sameValue(stored, baseline) || sameValue(stored, value) || !isSafetyField(field) ? { value } : stricterAnswer(stored, value);
    if (chosen) answers = putField(answers, field, chosen.value);
    if (!chosen || !sameValue(chosen.value, value)) kept.push(field);
  }
  for (const root of new Set([...raw.keys()].map(fieldRoot))) {
    if (![...changes.keys()].some(f => fieldRoot(f) === root) && !sameValue(getField(answers, root), baselines.get(root))) kept.push(root);
  }
  const texts = withTexts(setup.draft?.raw, [...raw].filter(([key]) => !kept.some(f => fieldRoot(f) === fieldRoot(key))));
  const resume = at ?? setup.draft?.at;
  const draft = { ...(resume ? { at: resume } : {}), answers, ...(Object.keys(texts).length > 0 ? { raw: texts as Raw } : {}) };
  return { ...data, settings: { ...data.settings, setup: { ...setup, draft } } };
}

/** How long after a change it is stored (§6.1; board D158). */
export const AUTOSAVE_MS = 400;

/** What's waiting to be stored, for the record it was made in (`StoreState.epoch`). */
const queued = new Map<string, FieldChange>();
const queuedRaw = new Map<string, string | undefined>();
/** The answer each number's texts were last typed against, by its field: set with each, so never stale (H5F-06; board D220). */
const rawBaselines = new Map<string, unknown>();
let queuedAt: PageId | undefined;
let queueEpoch = -1;
let timer: ReturnType<typeof setTimeout> | undefined;
let writing: Promise<unknown> = Promise.resolve();
/** Why the last write was refused: every page says so, until one is stored (H5R-16). */
let refused: string | undefined;
/** An answer changed here was changed in another copy at the same time, and that copy's was kept. */
let changedElsewhere = false;
let version = 0;
const queueListeners = new Set<() => void>();

/** The queue, empty once the record it was for is replaced (H5-07, H5R-09). */
function queue(): Map<string, FieldChange> {
  if (queueEpoch !== getState().epoch) {
    clearQueue();
    queueEpoch = getState().epoch;
  }
  return queued;
}
function clearQueue(): void {
  clearTimeout(timer);
  queued.clear();
  queuedRaw.clear();
  refused = undefined;
  changedElsewhere = false;
}
const queueChanged = () => {
  version += 1;
  for (const listener of [...queueListeners]) listener();
};

/** What happened to what's waiting: why its last write was refused, and whether another copy's answer was kept. */
export function answersQueue(): { refused?: string; changedElsewhere: boolean } {
  queue();
  return { ...(refused !== undefined ? { refused } : {}), changedElsewhere };
}

/** `answersQueue`, redrawn as it changes. */
export function useAnswersQueue(): { refused?: string; changedElsewhere: boolean } {
  useSyncExternalStore(listener => {
    queueListeners.add(listener);
    return () => void queueListeners.delete(listener);
  }, () => version, () => version);
  return answersQueue();
}

/** The answers a page shows: those stored, with what's waiting on top. */
export function withQueued(stored: SetupAnswers): SetupAnswers {
  let a = stored;
  for (const [field, { value }] of queue()) a = putField(a, field, value);
  return a;
}

/** The numbers' texts a page shows: those stored, with what's waiting on top. */
export function rawWithQueued(stored: Raw | undefined): Raw {
  queue();
  return withTexts(stored, queuedRaw) as Raw;
}

/** A change on page `id` waits to be stored: Next stays on the page, for another look (H5R-11). */
export function waitingOn(id: PageId): boolean {
  const sets = pageDef(id).sets as readonly string[];
  return [...queue().keys()].some(f => sets.includes(fieldRoot(f))) || [...queuedRaw.keys()].some(key => rawPage(key) === id);
}

/** Not kept (board D198): what's waiting from page `id` is dropped, so the answers stored stand. */
export function discardWaiting(id: PageId): void {
  const sets = pageDef(id).sets as readonly string[];
  for (const field of [...queue().keys()]) if (sets.includes(fieldRoot(field))) queued.delete(field);
  for (const key of [...queuedRaw.keys()]) if (rawPage(key) === id) queuedRaw.delete(key);
  if (queued.size === 0 && queuedRaw.size === 0) clearQueue();
  queueChanged();
}

/**
 * A page's changes, shown at once and stored shortly after, field by field
 * (§6.1; H5-16, K5-17; board D169), each with what its control started from.
 * `raw`: numbers as typed. Without saving, they're this session's at once.
 */
export function changeAnswers(shown: SetupAnswers, patch: Partial<SetupAnswers>, raw: Readonly<Record<string, string | undefined>>, at: PageId): void {
  const changes = fieldChanges(shown, patch);
  if (current().unsaved) {
    let answers = current().answers;
    for (const [field, value] of changes) answers = putField(answers, field, value);
    publish({ ...current(), at, answers, raw: withTexts(current().raw, Object.entries(raw)) as Raw });
    return;
  }
  const q = queue();
  for (const [field, value] of changes) {
    const waiting = q.get(field);
    q.set(field, { baseline: waiting ? waiting.baseline : getField(shown, field), value });
  }
  for (const [key, text] of Object.entries(raw)) {
    queuedRaw.set(key, text);
    rawBaselines.set(fieldRoot(key), getField(shown, fieldRoot(key)));
  }
  queuedAt = at;
  changedElsewhere = false;
  queueChanged();
  clearTimeout(timer);
  timer = setTimeout(() => void flushAnswers(), AUTOSAVE_MS);
}

/**
 * Store everything waiting now, in one transaction, with `at` to resume on
 * where given: Back's page, Close's own. What changes again while it's
 * stored stays waiting. One write at a time, in order.
 */
export function flushAnswers(at?: PageId): Promise<SaveOutcome> {
  const run = writing.then(() => storeQueued(at));
  writing = run.catch(() => undefined);
  return run;
}

async function storeQueued(at: PageId | undefined): Promise<SaveOutcome> {
  clearTimeout(timer);
  const changes = new Map(queue());
  const raw = new Map(queuedRaw);
  const baselines = new Map(rawBaselines);
  const generation = queueEpoch;
  if (current().unsaved) {
    if (at) keepInSession(at, current().answers);
    return 'session';
  }
  if (changes.size === 0 && raw.size === 0 && at === undefined) return 'saved';
  const kept: string[] = [];
  let written: SetupAnswers = {};
  const result = await update(d => {
    kept.length = 0;
    const next = withFields(d, changes, raw, at ?? queuedAt, kept, baselines);
    written = setupStateOf(next.settings, next.profile).draft?.answers ?? {};
    return next;
  }, { generation });
  const outcome = outcomeOf(result, getState().status);
  if (outcome === 'failed') {
    const message = result.ok ? '' : result.failure.message;
    // Finished in another copy: nothing here can be stored now, so it's said, and where to check (K5R-04).
    if (message === FINISHED_ELSEWHERE) {
      clearQueue();
      tell(FINISHED_ELSEWHERE);
    } else {
      refused = message;
    }
    queueChanged();
    return 'failed';
  }
  // Stored, or kept in this session's memory: what changed again meanwhile stays waiting, against what's stored now.
  for (const [field, change] of changes) {
    const now = queued.get(field);
    if (now && sameValue(now.value, change.value)) queued.delete(field);
    else if (now) queued.set(field, { baseline: getField(written, field), value: now.value });
  }
  for (const [key, text] of raw) if (queuedRaw.get(key) === text) queuedRaw.delete(key);
  refused = undefined;
  changedElsewhere = kept.length > 0;
  if (outcome === 'session') {
    const setup = setupStateOf(getState().settings, getState().profile);
    continueWithoutSaving(at ?? queuedAt ?? 'about.name', withQueued(setup.draft?.answers ?? {}), rawWithQueued(setup.draft?.raw));
    clearQueue();
  }
  queueChanged();
  return outcome;
}

/** Go on without saving: what's waiting becomes this session's, with the answers stored so far (B-07). */
export function continueUnsaved(at: PageId, stored: SetupAnswers, storedRaw: Raw | undefined): void {
  const answers = withQueued(stored);
  const raw = rawWithQueued(storedRaw);
  clearQueue();
  queueChanged();
  continueWithoutSaving(at, answers, raw);
}

/** Where a move went: stored or kept in this session, refused (with why), or the page unanswered as stored. */
export type MoveResult = { outcome: 'saved' | 'session'; to: PageId } | { outcome: 'failed'; message: string } | { outcome: 'notDone' };

/**
 * Next or Skip for now (§6.1; M22; H5R-11; board D169): what's waiting is
 * stored first; then, in one transaction, the move is planned from the
 * answers as stored, another copy's included, and stored with the page to go
 * to. Nothing is taken away.
 */
async function moveFrom(generation: number, plan: (a: SetupAnswers) => PlannedMove | undefined): Promise<MoveResult> {
  if (await flushAnswers() === 'failed') return { outcome: 'failed', message: refused ?? '' };
  if (current().unsaved) {
    const planned = plan(current().answers);
    if (!planned) return { outcome: 'notDone' };
    keepInSession(planned.to, planned.answers);
    return { outcome: 'session', to: planned.to };
  }
  let to: PageId | undefined;
  const result = await update(d => {
    const setup = setupStateOf(d.settings, d.profile);
    if (setup.stage === 'done') throw new StoreFailure('conflict', FINISHED_ELSEWHERE);
    const planned = plan(setup.draft?.answers ?? prefillAnswers(d.settings, d.profile));
    to = planned?.to;
    return planned ? withDraft(d, planned.to, planned.answers) : d;
  }, { generation });
  const outcome = outcomeOf(result, getState().status);
  if (outcome === 'failed') {
    const message = result.ok ? '' : result.failure.message;
    if (message === FINISHED_ELSEWHERE) tell(FINISHED_ELSEWHERE);
    return { outcome, message };
  }
  if (to === undefined) return { outcome: 'notDone' };
  if (outcome === 'session') {
    const setup = setupStateOf(getState().settings, getState().profile);
    continueWithoutSaving(to, setup.draft?.answers ?? {}, setup.draft?.raw);
  }
  return { outcome, to };
}

/** Next: the page committed (`nextMove`), and the page after it as the stored answers have it. */
export function nextFrom(id: PageId, ctx: Ctx, fromReview: boolean, generation: number): Promise<MoveResult> {
  return moveFrom(generation, a => nextMove(id, a, ctx, fromReview));
}

/** "Skip for now": the page marked skipped (`skipMove`), its answers kept as they are. */
export function skipFrom(id: PageId, ctx: Ctx, fromReview: boolean, generation: number): Promise<MoveResult> {
  return moveFrom(generation, a => skipMove(id, a, ctx, fromReview));
}

/**
 * Welcome's Get started (M22), or kept for this session while setup goes on
 * without saving (B-07). Storage refused from the start, or gone since, is
 * the same as a draft that won't save: setup goes on in its explicit unsaved
 * mode, so its warning shows and its answers live here (H5-06). `opened`:
 * what the page opened with, so only its own changes are written
 * (`withDraft`, H5-12).
 */
export async function saveDraft(to: PageId, answers: SetupAnswers, opened?: SetupAnswers, generation?: number): Promise<SaveOutcome> {
  if (current().unsaved) {
    keepInSession(to, answers);
    return 'session';
  }
  const outcome = outcomeOf(await update(d => withDraft(d, to, answers, opened), { ...(generation !== undefined ? { generation } : {}) }), getState().status);
  if (outcome === 'session') continueWithoutSaving(to, answers);
  return outcome;
}

export type FinishOutcome = { kind: 'home' } | { kind: 'failed'; message: string };

/** Finishing waits for a number typed that isn't an answer yet, named by its chapter (H5F-05; board D199). */
export const RAW_LEFT = (chapter: ChapterId): string =>
  `A number you typed in ${CHAPTER_TITLE[chapter]} isn’t an answer yet. Correct it or clear it there, then start again.`;
const rawHeld = (answers: SetupAnswers, raw: Raw | undefined): FinishOutcome | undefined => {
  const left = rawLeft(answers, raw);
  return left === undefined ? undefined : { kind: 'failed', message: RAW_LEFT(chapterOf(left) as ChapterId) };
};

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
  if (await flushAnswers() === 'failed' && refused !== undefined) return { kind: 'failed', message: `That did not save. ${refused}` };
  const state = getState();
  const held = rawHeld(answers, setupStateOf(state.settings, state.profile).draft?.raw);
  if (held) return held;
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
 * said (D-04). The answers so far, numbers as typed included, wait in the
 * draft (H5R-12). Returns what to say when it's refused.
 */
export async function lookAroundFirst(generation?: number): Promise<string | undefined> {
  if (await flushAnswers() === 'failed' && refused !== undefined) return `That did not save. ${refused}`;
  const saved = await update(lookedAround, { hold: true, ...(generation !== undefined ? { generation } : {}) });
  if (!saved.ok && getState().status !== 'unavailable') return `That did not save. ${saved.failure.message}`;
  return undefined;
}

/**
 * "No food allergies" for a food record not made yet (owner decision; board
 * D194): setup's own answer, where meal ideas read it (`setupAllergyAnswer`),
 * stored as setup stores any answer: this session's while setup goes on
 * without saving, the draft's while it's unfinished, else the finished
 * answers. Nothing is written for a record another copy has since replaced.
 */
export async function answerNoAllergies(): Promise<StoreResult | undefined> {
  const none = (a: SetupAnswers) => putField(putField(a, 'allergies', []), 'customAllergies', undefined);
  if (current().unsaved) {
    keepInSession(current().at ?? 'food.allergies', none(current().answers));
    return undefined;
  }
  return update(d => {
    const setup = setupStateOf(d.settings, d.profile);
    if (setup.stage === 'done') return { ...d, settings: { ...d.settings, setup: { ...setup, answers: none(setup.answers ?? {}) } } };
    const now = setup.draft?.answers ?? prefillAnswers(d.settings, d.profile);
    const change = (field: 'allergies' | 'customAllergies', value: unknown): [string, FieldChange] => [field, { baseline: getField(now, field), value }];
    return withFields(d, new Map([change('allergies', []), change('customAllergies', undefined)]), new Map([['customAllergies', '']]), undefined);
  }, { generation: getState().epoch });
}

export function resetSetupSessionForTests(): void {
  session = EMPTY;
  sessionEpoch = 0;
  clearQueue();
  queueEpoch = -1;
  writing = Promise.resolve();
}
