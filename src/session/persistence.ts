/**
 * Save and resume an in-progress guided session. The plan itself is stored,
 * so a session resumed after midnight (or after the engine changes) continues
 * exactly as it was planned and logs to its original date (Review Focus #2).
 */

import type { SessionPlan } from '@/types/plan';
import { stepSeconds } from '@/engine/timing';
import { position, type RunnerState } from './runner';

/**
 * One saved run per kind: the programme's guided session, and a stretch. A
 * ten-minute stretch must never overwrite a paused guided hour, nor resume in
 * its place.
 */
export type ProgressSlot = 'guided' | 'stretch';
const KEYS: Record<ProgressSlot, string> = { guided: 'fit-strong-90-guided', stretch: 'fit-strong-90-stretch' };

/** Which slot a plan's progress lives in. */
export function slotOf(plan: Pick<SessionPlan, 'kind'>): ProgressSlot {
  return plan.kind === 'stretch' ? 'stretch' : 'guided';
}
/** Older progress than this is offered as "discard", not "resume". */
export const RESUME_WINDOW_MS = 18 * 60 * 60 * 1000;

export interface SavedProgress {
  plan: SessionPlan;
  state: RunnerState;
  /** Real epoch ms when saved (for the resume window). */
  savedAt: number;
  /** Session-clock time when saved (the runner's time domain). */
  clockAt: number;
  /** The run's History record id, so a resumed run updates its own record. */
  sessionId?: string;
}

export function saveProgress(plan: SessionPlan, state: RunnerState, clockAt: number, savedAt = Date.now(), sessionId?: string): void {
  try {
    localStorage.setItem(KEYS[slotOf(plan)], JSON.stringify({ plan, state, savedAt, clockAt, ...(sessionId ? { sessionId } : {}) } satisfies SavedProgress));
  } catch {
    // Storage full or unavailable: the session still runs; only resume is lost.
  }
}

export function loadProgress(now = Date.now(), slot: ProgressSlot = 'guided'): SavedProgress | null {
  try {
    const raw = localStorage.getItem(KEYS[slot]);
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedProgress;
    if (!saved.plan || !saved.state || saved.state.status === 'done') return null;
    if (now - saved.savedAt > RESUME_WINDOW_MS) return null;
    return saved;
  } catch {
    return null;
  }
}

/**
 * Progress that can no longer be resumed — too old, or finished but never
 * stored as a session (the summary was closed before its save landed). Its
 * work still belongs in History, so it is handed back for banking rather than
 * silently ignored. Banking skips a day that already has the finished record.
 */
export function loadExpiredProgress(now = Date.now(), slot: ProgressSlot = 'guided'): SavedProgress | null {
  try {
    const raw = localStorage.getItem(KEYS[slot]);
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedProgress;
    if (!saved.plan || !saved.state) return null;
    if (saved.state.status === 'done') return saved;
    return now - saved.savedAt > RESUME_WINDOW_MS ? saved : null;
  } catch {
    return null;
  }
}

/** Roughly how much of a saved session is left, for the Resume label. */
export function minutesLeft(saved: SavedProgress): number {
  const done = saved.plan.steps.slice(0, saved.state.index).reduce((t, s) => t + stepSeconds(s), 0);
  return Math.max(1, Math.round((saved.plan.totalSeconds - done) / 60));
}

export type ResumeOffer =
  | { kind: 'none' }
  | { kind: 'today'; minutesLeft: number }
  | { kind: 'earlier'; date: string; minutesLeft: number };

/**
 * What Today should offer for saved progress. Only a session planned for today
 * can take the place of the Start button; progress from an earlier day is
 * offered separately and named by its date, so it can neither hide today's
 * session nor be mistaken for it (Review Focus #3).
 */
export function resumeOffer(date: string, saved: SavedProgress | null = loadProgress()): ResumeOffer {
  if (!saved) return { kind: 'none' };
  if (saved.plan.date === date) return { kind: 'today', minutesLeft: minutesLeft(saved) };
  return { kind: 'earlier', date: saved.plan.date, minutesLeft: minutesLeft(saved) };
}

/**
 * Earlier runs whose banking into History the device refused (scan M-08).
 * A run's own slot is overwritten by the next run's first save, so one that
 * could not be banked is moved here first, and banked from here once the
 * device stores again. Under the app's key prefix, so "Clear all data"
 * sweeps it.
 */
const ASIDE_KEY = 'fit-strong-90-unbanked';

/** The runs kept aside, oldest first. */
export function loadSetAside(): SavedProgress[] {
  try {
    const raw = localStorage.getItem(ASIDE_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((s): s is SavedProgress => !!s && typeof s === 'object' && 'plan' in s && 'state' in s) : [];
  } catch {
    return [];
  }
}

const sameRun = (a: SavedProgress, b: SavedProgress) => (a.sessionId ?? a.savedAt) === (b.sessionId ?? b.savedAt) && a.plan.date === b.plan.date;

/** Keep a run that could not be banked. True when it is kept, so the caller may tell the person. */
export function setAside(saved: SavedProgress): boolean {
  try {
    const list = loadSetAside().filter(s => !sameRun(s, saved));
    localStorage.setItem(ASIDE_KEY, JSON.stringify([...list, saved]));
    return true;
  } catch {
    return false;
  }
}

/** A kept run is in History now: let it go. */
export function releaseSetAside(saved: SavedProgress): void {
  try {
    const list = loadSetAside().filter(s => !sameRun(s, saved));
    if (list.length) localStorage.setItem(ASIDE_KEY, JSON.stringify(list));
    else localStorage.removeItem(ASIDE_KEY);
  } catch {
    // ignore
  }
}

export function clearProgress(slot: ProgressSlot = 'guided'): void {
  try {
    localStorage.removeItem(KEYS[slot]);
  } catch {
    // ignore
  }
}

/**
 * Re-anchor a saved state to "now": a running session resumes paused at the
 * same point within its step, so nothing is skipped while the app was closed.
 */
export function rehydrate(state: RunnerState, clockAt: number, now: number, plan?: SessionPlan): RunnerState {
  if (state.status === 'ready' || state.status === 'done') return state;
  const elapsedAtSave = (state.status === 'paused' && state.pausedAt !== undefined ? state.pausedAt : clockAt) - state.stepStartedAt;
  // Running time stops at the last save: the time the app was closed isn't training.
  // A run saved by an older build kept no running time, so start from the
  // estimate it would have been logged with.
  const legacy = state.activeMs === undefined && state.startedAt !== undefined && plan
    ? Math.min(clockAt - state.startedAt, position(plan, state, clockAt).sessionElapsedMs)
    : undefined;
  const active = state.status === 'running' && state.runningSince !== undefined
    ? { activeMs: (state.activeMs ?? 0) + Math.max(0, clockAt - state.runningSince), runningSince: undefined }
    : legacy !== undefined ? { activeMs: Math.max(0, legacy) } : {};
  return { ...state, ...active, status: 'paused', pausedAt: now, stepStartedAt: now - Math.max(0, elapsedAtSave) };
}
