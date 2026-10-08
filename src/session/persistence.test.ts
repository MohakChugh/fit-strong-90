import { describe, it, expect, beforeEach } from 'vitest';
import { createDefaultProfile } from '@/profile/defaults';
import { buildSessionPlan } from '@/engine/session';
import { createRunner, initialState } from './runner';

// Node test environment: a minimal in-memory localStorage.
const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
} as Storage;

const { saveProgress, loadProgress, loadExpiredProgress, clearProgress, minutesLeft, resumeOffer, RESUME_WINDOW_MS, setAside, loadSetAside, releaseSetAside } = await import('./persistence');

const profile = createDefaultProfile({ pain: { areas: ['lowerBack'] } });
const planFor = (date: string) => buildSessionPlan({ profile, date, startDate: '2026-09-28', sessions: [] });
const today = planFor('2026-10-09');
const yesterday = planFor('2026-10-08');

function progress(plan: typeof today, steps: number) {
  const runner = createRunner(plan);
  let s = runner.reduce(initialState(plan), { type: 'start', now: 0 });
  for (let i = 0; i < steps; i++) s = runner.reduce(s, { type: 'next', now: 1000 * (i + 1) });
  return { plan, state: s, savedAt: Date.now(), clockAt: 1000 * (steps + 1) };
}

describe('resumeOffer', () => {
  beforeEach(() => store.clear());

  it('offers nothing when no session is saved', () => {
    expect(resumeOffer('2026-10-09')).toEqual({ kind: 'none' });
  });

  it("offers today's saved session in place of Start", () => {
    const offer = resumeOffer('2026-10-09', progress(today, 4));
    expect(offer.kind).toBe('today');
    expect(offer.kind === 'today' && offer.minutesLeft).toBeGreaterThan(0);
  });

  // Review Focus #3: an older session must not hide today's Start button, and
  // what it is offered as has to name its own date.
  it("offers an earlier day's session separately, labelled with its date", () => {
    const offer = resumeOffer('2026-10-09', progress(yesterday, 4));
    expect(offer).toMatchObject({ kind: 'earlier', date: '2026-10-08' });
    expect(resumeOffer('2026-10-09', progress(yesterday, 4)).kind).not.toBe('today');
  });

  it('reads the saved blob when none is passed, and honours a discard', () => {
    const p = progress(yesterday, 4);
    saveProgress(p.plan, p.state, p.clockAt);
    expect(resumeOffer('2026-10-09')).toMatchObject({ kind: 'earlier', date: '2026-10-08' });
    clearProgress();
    expect(resumeOffer('2026-10-09')).toEqual({ kind: 'none' });
  });

  it('ignores progress older than the resume window', () => {
    const p = progress(today, 4);
    saveProgress(p.plan, p.state, p.clockAt, Date.now() - RESUME_WINDOW_MS - 1);
    expect(loadProgress()).toBeNull();
    expect(resumeOffer('2026-10-09')).toEqual({ kind: 'none' });
  });

  it('keeps progress too old to resume so its work can still be saved to History', () => {
    const p = progress(today, 4);
    saveProgress(p.plan, p.state, p.clockAt, Date.now() - RESUME_WINDOW_MS - 1);
    expect(loadExpiredProgress()?.state.index).toBe(4);
    // Resumable progress is not "expired".
    saveProgress(p.plan, p.state, p.clockAt);
    expect(loadExpiredProgress()).toBeNull();
  });
});

describe('minutesLeft', () => {
  it('shrinks as the session advances', () => {
    expect(minutesLeft(progress(today, 2))).toBeGreaterThan(minutesLeft(progress(today, 20)));
    expect(minutesLeft(progress(today, today.steps.length))).toBeGreaterThanOrEqual(1);
  });
});

const { buildStretchPlan } = await import('@/engine/stretch');
const { slotOf } = await import('./persistence');

describe('progress slots', () => {
  const stretch = buildStretchPlan({ profile, date: '2026-10-09', startDate: '2026-09-28', sessions: [], focus: 'backHips', minutes: 10 });

  beforeEach(() => store.clear());

  it('keeps a stretch in its own slot, so it never overwrites a paused guided hour', () => {
    const guided = progress(today, 3);
    saveProgress(guided.plan, guided.state, guided.clockAt);
    const s = progress(stretch, 2);
    saveProgress(s.plan, s.state, s.clockAt);
    expect(slotOf(stretch)).toBe('stretch');
    expect(loadProgress()?.plan.id).toBe(today.id);
    expect(loadProgress(Date.now(), 'stretch')?.plan.id).toBe(stretch.id);
  });

  it('clears one slot without touching the other', () => {
    const guided = progress(today, 3);
    saveProgress(guided.plan, guided.state, guided.clockAt);
    const s = progress(stretch, 2);
    saveProgress(s.plan, s.state, s.clockAt);
    clearProgress('stretch');
    expect(loadProgress(Date.now(), 'stretch')).toBeNull();
    expect(loadProgress()?.plan.id).toBe(today.id);
  });
});

describe('a finished run that was never stored', () => {
  beforeEach(() => store.clear());

  it('is handed back for banking at any age, and never offered as a resume', () => {
    const run = progress(today, 2);
    const done = { ...run.state, status: 'done' as const };
    saveProgress(today, done, run.clockAt, Date.now());
    expect(loadProgress()).toBeNull();
    expect(loadExpiredProgress()?.state.status).toBe('done');
  });
});

describe('runs kept aside because they could not be banked (scan M-08)', () => {
  beforeEach(() => store.clear());

  it('are kept under their own key, once each, outlive the slot being overwritten, and go when released', () => {
    const old = { ...progress(yesterday, 3), sessionId: 'guided-2026-10-08-a' };
    expect(setAside(old)).toBe(true);
    expect(setAside(old)).toBe(true);
    expect(loadSetAside().map(s => s.sessionId)).toEqual(['guided-2026-10-08-a']);
    saveProgress(today, progress(today, 1).state, 2000);
    expect(loadSetAside()).toHaveLength(1);
    releaseSetAside(old);
    expect(loadSetAside()).toEqual([]);
    expect(store.has('fit-strong-90-unbanked')).toBe(false);
  });

  it('read nothing from a damaged copy', () => {
    store.set('fit-strong-90-unbanked', '{not json');
    expect(loadSetAside()).toEqual([]);
    store.set('fit-strong-90-unbanked', JSON.stringify([{ nope: 1 }, null]));
    expect(loadSetAside()).toEqual([]);
  });
});
