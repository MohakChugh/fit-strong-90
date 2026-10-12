/**
 * Updates, the platform's own way (J§21.2, B-21; board D106). A new release
 * installs beside this one and waits, as every service worker does, until no
 * window still runs this one: it applies the next time FitStrong opens, and
 * Home says so. Nothing here reloads by itself (K8-02, K8-10). The person can
 * apply it sooner with Home's "Restart to update", offered only while nothing
 * is under way in this window and the waiting worker finds this window is
 * FitStrong's only one; with another open, Home asks for it to be closed. The
 * restart is one transition: the cover first, no new work let in, then the
 * worker asked; if it says no, the cover goes (P8S-13). After an update, the
 * first Home says "Updated" until it is dismissed.
 */
import { useSyncExternalStore } from 'react';

export interface WorkerLike {
  postMessage(message: unknown, transfer: Transferable[]): void;
}

export interface InstallingLike extends WorkerLike {
  readonly state: string;
  addEventListener(type: 'statechange', listener: () => void): void;
}

export interface RegistrationLike {
  readonly waiting: WorkerLike | null;
  readonly installing: InstallingLike | null;
  addEventListener(type: 'updatefound', listener: () => void): void;
}

export interface ContainerLike {
  readonly controller: WorkerLike | null;
  register(url: string): Promise<RegistrationLike>;
  addEventListener(type: 'controllerchange', listener: () => void): void;
}

/** What this app's worker says when asked (public/sw.js). */
export interface WorkerAnswer {
  /** Its release's stamp. */
  build: string;
  /** FitStrong's open windows, the asking one included. */
  windows: number;
  /** It is taking over now, at the asking window's restart. */
  restarting: boolean;
}

export interface UpdateState {
  /** A new release has installed, and waits for this release's windows to close. */
  waiting: boolean;
  /** FitStrong's open windows, as the waiting worker counts them; unknown until it answers. */
  windows?: number;
  /** "Restart to update" was tapped: the cover is up, and the new release is being asked to take over. */
  restarting: boolean;
  /** This open is the first on a new release, and the person hasn't dismissed it. */
  updated: boolean;
}

export interface UpdateDeps {
  container: ContainerLike;
  swUrl: string;
  /** Where the last release seen is kept; absent where web storage is refused. */
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  /** The one reload: after the person's own "Restart to update". */
  reload: () => void;
  /** The page has loaded: the worker registers after it, so it never competes with the first screen. */
  loaded?: Promise<void>;
  /** Told this page's release (`data-build`, which the acceptance suite reads). */
  mark?: (build: string) => void;
  /** How long a worker has to answer before it counts as one from before Plan 8, which never will. */
  answerMs?: number;
  /** Anything under way in this window that a restart would lose (`src/app/underWay.ts`): no restart then (P8S-12). */
  underWay?: () => boolean;
  /** Stops new work for the restart, and gives back what lets it in again (the store's `holdNewWork`, P8S-13). */
  hold?: () => () => void;
  /** Resolves once the work already queued is done (the store's `whenSettled`). */
  settled?: () => Promise<void>;
}

export const BUILD_KEY = 'fit-strong-90-build';
export const UPDATE_READY = 'An update is ready. It applies the next time FitStrong opens.';
export const CLOSE_OTHERS = 'Close FitStrong’s other windows to update now.';
export const RESTART = 'Restart to update';
export const RESTARTING = 'Restarting to update…';
export const UPDATED = 'Updated. FitStrong is on its latest version.';
export const DISMISS = 'Dismiss';
/** How long a takeover the worker agreed to has, before the restart reloads all the same. */
export const TAKEOVER_MS = 10_000;

const IDLE: UpdateState = { waiting: false, restarting: false, updated: false };
let state: UpdateState = IDLE;
let deps: UpdateDeps | undefined;
let registration: RegistrationLike | undefined;
let fallback: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function set(patch: Partial<UpdateState>): void {
  state = { ...state, ...patch };
  for (const listener of [...listeners]) listener();
}

/** One question to one worker, answered on a channel of its own; undefined when it doesn't answer in time. */
function ask(worker: WorkerLike, type: 'windows' | 'restart'): Promise<WorkerAnswer | undefined> {
  return new Promise(resolve => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => {
      channel.port1.close();
      resolve(undefined);
    }, deps?.answerMs ?? 2000);
    channel.port1.onmessage = event => {
      clearTimeout(timer);
      channel.port1.close();
      resolve(event.data as WorkerAnswer);
    };
    worker.postMessage({ type }, [channel.port2]);
  });
}

/** This page's release: one different from the last open's is an update, said on Home until dismissed (K8-03). */
function noteRelease(build: string): void {
  deps?.mark?.(build);
  let before: string | null;
  try {
    before = deps?.storage?.getItem(BUILD_KEY) ?? null;
    deps?.storage?.setItem(BUILD_KEY, build);
  } catch {
    return; // web storage refused: there is nothing to compare with
  }
  if (before !== null && before !== build) set({ updated: true });
}

/** Watch for a new release (main.tsx, production only): registered once the page has loaded. */
export async function startUpdates(d: UpdateDeps): Promise<void> {
  deps = d;
  // A waiting release, known to this page: one left by an earlier open, or one that finishes
  // installing while this page runs. A page no worker controls yet has nothing waiting for it.
  const check = () => {
    if (!registration?.waiting || !d.container.controller) return;
    set({ waiting: true });
    void countWindows();
  };
  // This page's release, as its worker says it.
  const adopt = async () => {
    const mine = d.container.controller;
    const own = mine ? await ask(mine, 'windows') : undefined;
    if (own) noteRelease(own.build);
    check();
  };
  d.container.addEventListener('controllerchange', () => {
    // Only the restart the person asked for reloads the page (D106).
    if (state.restarting) {
      if (fallback !== undefined) clearTimeout(fallback);
      fallback = undefined;
      d.reload();
      return;
    }
    // A first visit taken over by its release's first worker (P8S-11): now that release's,
    // waiting like any other window for whatever comes next. Nothing reloads.
    void adopt();
  });
  await d.loaded;
  registration = await d.container.register(d.swUrl).catch(() => undefined);
  await adopt();
  const reg = registration;
  if (!reg) return;
  reg.addEventListener('updatefound', () => {
    const next = reg.installing;
    next?.addEventListener('statechange', () => {
      if (next.state === 'installed') check();
    });
  });
}

/** FitStrong's windows, as the waiting worker counts them: asked when one is found, when Home shows, and on every return. */
export async function countWindows(): Promise<void> {
  const waiting = registration?.waiting;
  if (!waiting) return;
  const answer = await ask(waiting, 'windows');
  if (answer) set({ windows: answer.windows });
}

/**
 * "Restart to update" (D106). Asked again at the tap: with anything under way
 * now, nothing happens (P8S-12). Otherwise one transition (P8S-13): the
 * cover goes up over an app made inert, no new work is let in, and the work
 * already queued finishes; only then is the waiting worker asked. It takes
 * over only while this window is FitStrong's only one, and the page reloads
 * once, at the takeover (`controllerchange`), or after `TAKEOVER_MS` should
 * that never come. If it says no, or doesn't answer, the cover goes and work
 * is let in again, with nothing under it changed.
 */
export async function restartToUpdate(): Promise<'restarting' | 'others' | 'busy' | 'none'> {
  const waiting = registration?.waiting;
  if (!waiting || state.restarting) return 'none';
  if (deps?.underWay?.()) return 'busy';
  set({ restarting: true });
  const resume = deps?.hold?.();
  await deps?.settled?.();
  const answer = await ask(waiting, 'restart');
  if (answer?.restarting) {
    const reload = deps?.reload;
    fallback = setTimeout(() => {
      fallback = undefined;
      if (state.restarting) reload?.();
    }, TAKEOVER_MS);
    return 'restarting';
  }
  resume?.();
  set({ restarting: false, ...(answer ? { windows: answer.windows } : {}) });
  return answer ? 'others' : 'none';
}

/** The person has read "Updated". */
export function dismissUpdated(): void {
  set({ updated: false });
}

export const updateState = (): UpdateState => state;

export function subscribeUpdates(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export const useUpdates = (): UpdateState => useSyncExternalStore(subscribeUpdates, updateState, updateState);

export interface UpdateLine {
  text: string;
  /** A second sentence, under it. */
  detail?: string;
  action?: 'restart' | 'dismiss';
}

/**
 * Home's line (pure): from the state, and whether anything is under way in
 * this window (`src/app/underWay.ts`). A waiting release comes before the
 * "Updated" note.
 */
export function updateLine(s: UpdateState, underWay: boolean): UpdateLine | undefined {
  if (s.waiting) {
    if ((s.windows ?? 0) > 1) return { text: UPDATE_READY, detail: CLOSE_OTHERS };
    return s.windows === 1 && !underWay ? { text: UPDATE_READY, action: 'restart' } : { text: UPDATE_READY };
  }
  return s.updated ? { text: UPDATED, action: 'dismiss' } : undefined;
}

/** Tests only. */
export function resetUpdatesForTests(): void {
  if (fallback !== undefined) clearTimeout(fallback);
  fallback = undefined;
  state = IDLE;
  deps = undefined;
  registration = undefined;
  listeners.clear();
}
