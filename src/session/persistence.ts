/**
 * Save and resume an in-progress guided session. The plan itself is stored,
 * so a session resumed after midnight (or after the engine changes) continues
 * exactly as it was planned and logs to its original date (Review Focus #2).
 */

import type { SessionPlan } from '@/types/plan';
import { stepSeconds } from '@/engine/timing';
import type { RunnerState } from './runner';

const KEY = 'fit-strong-90-guided';
/** Older progress than this is offered as "discard", not "resume". */
export const RESUME_WINDOW_MS = 18 * 60 * 60 * 1000;

export interface SavedProgress {
  plan: SessionPlan;
  state: RunnerState;
  /** Real epoch ms when saved (for the resume window). */
  savedAt: number;
  /** Session-clock time when saved (the runner's time domain). */
  clockAt: number;
}

export function saveProgress(plan: SessionPlan, state: RunnerState, clockAt: number, savedAt = Date.now()): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ plan, state, savedAt, clockAt } satisfies SavedProgress));
  } catch {
    // Storage full or unavailable: the session still runs; only resume is lost.
  }
}

export function loadProgress(now = Date.now()): SavedProgress | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedProgress;
    if (!saved.plan || !saved.state || saved.state.status === 'done') return null;
    if (now - saved.savedAt > RESUME_WINDOW_MS) return null;
    return saved;
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

export function clearProgress(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/**
 * Re-anchor a saved state to "now": a running session resumes paused at the
 * same point within its step, so nothing is skipped while the app was closed.
 */
export function rehydrate(state: RunnerState, clockAt: number, now: number): RunnerState {
  if (state.status === 'ready' || state.status === 'done') return state;
  const elapsedAtSave = (state.status === 'paused' && state.pausedAt !== undefined ? state.pausedAt : clockAt) - state.stepStartedAt;
  return { ...state, status: 'paused', pausedAt: now, stepStartedAt: now - Math.max(0, elapsedAtSave) };
}
