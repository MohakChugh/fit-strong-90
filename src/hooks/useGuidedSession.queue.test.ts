/**
 * N-08 under React's own render queue (Codex round 7). React reduces a queued
 * action with the reducer of the render that processes it, so a tick the
 * 4 Hz clock queued just before a re-dosed plan arrives is reduced in the
 * render that brings that plan. The custom test host applies a dispatch at
 * once and cannot show this; React DOM (already a dependency) can. The player
 * here draws nothing, so React needs no DOM beyond a container to attach to.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, createElement as h, StrictMode, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createDefaultProfile } from '@/profile/defaults';
import { buildSessionPlan } from '@/engine/session';
import type { CardioStep, SessionPlan } from '@/types/plan';
import { position, type RunnerState } from '@/session/runner';
import { useGuidedSession } from './useGuidedSession';

vi.mock('@/voice/clips', () => ({ loadManifest: async () => null, primeAudio: async () => true, ClipNarrator: class {} }));

// What React DOM reads while it commits, and what the player's effects use.
const doc = { nodeType: 9, visibilityState: 'visible', activeElement: null, body: null, addEventListener() {}, removeEventListener() {} };
const local = new Map<string, string>();
Object.assign(globalThis, {
  window: globalThis,
  document: doc,
  location: { href: 'http://localhost/' },
  HTMLIFrameElement: class {},
  IS_REACT_ACT_ENVIRONMENT: true,
  localStorage: {
    getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
    removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: (i: number) => [...local.keys()][i] ?? null,
    get length() { return local.size; },
  },
});

const profile = createDefaultProfile({ pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left' }, ladder: { hinge: 2, squat: 2, neuralGate: false } });
const plan = buildSessionPlan({ profile, date: '2026-10-09', startDate: '2026-09-28', sessions: [] });
const cardioAt = plan.steps.findIndex(s => s.kind === 'cardio');
const withCardio = (parts: CardioStep['parts']): SessionPlan => ({ ...plan, steps: plan.steps.map(s => (s.kind === 'cardio' ? { ...s, parts } : s)) });
// Codex's dose change: 120 + 1200 + 300 s, re-dosed to 60 + 300 + 300 s.
const long = withCardio([{ seconds: 120, intensity: 'easy', label: 'Easy warm-up' }, { seconds: 1200, intensity: 'zone2', label: 'Steady' }, { seconds: 300, intensity: 'cooldown', label: 'Cool-down' }]);
const short = withCardio([{ seconds: 60, intensity: 'easy', label: 'Easy warm-up' }, { seconds: 300, intensity: 'zone2', label: 'Steady' }, { seconds: 300, intensity: 'cooldown', label: 'Cool-down' }]);
const T0 = Date.UTC(2026, 9, 9, 9);

/** What the player last committed: read after each `act`, as the screen would show it. */
let seen: ReturnType<typeof useGuidedSession> | undefined;
function Player(props: { plan: SessionPlan; resumeState: RunnerState }) {
  const g = useGuidedSession({ ...props, profile, sessions: [] });
  useEffect(() => { seen = g; });
  return null;
}

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  vi.useRealTimers();
});

describe('N-08 under React’s render queue: a tick queued as the plan is re-dosed', () => {
  it('is counted against the dose it was timed by, so the shorter cardio’s cool-down still runs whole', () => {
    expect(cardioAt).toBeGreaterThan(0);
    vi.useFakeTimers({ now: T0 });
    const container = { nodeType: 1, nodeName: 'DIV', tagName: 'DIV', ownerDocument: doc, textContent: '', addEventListener() {}, removeEventListener() {} };
    root = createRoot(container as unknown as Element);
    // Running, 700 s into the long cardio: still in its steady work.
    const resumeState: RunnerState = {
      planId: plan.id, date: plan.date, status: 'running', index: cardioAt, stepStartedAt: T0 - 700_000, visit: 3,
      extraMs: {}, logs: [], startedAt: T0 - 1_500_000, activeMs: 0, runningSince: T0 - 1_500_000,
    };
    const player = (p: SessionPlan) => h(StrictMode, null, h(Player, { plan: p, resumeState }));
    act(() => root!.render(player(long)));
    expect(seen!.state.index).toBe(cardioAt);
    expect(position(long, seen!.state, Date.now()).segment.intensity).toBe('zone2');

    // One batch: the clock's 4 Hz tick is queued, and the re-dosed plan arrives with it.
    act(() => {
      vi.advanceTimersByTime(250);
      root!.render(player(short));
    });
    // Today's work is done, so the run is at the cool-down's own start, not past it.
    expect(seen!.state.index).toBe(cardioAt);
    const at = position(short, seen!.state, Date.now());
    expect(at.segment.intensity).toBe('cooldown');
    expect(at.segmentElapsedMs).toBeLessThan(1000);
    expect(seen!.position.segment.intensity).toBe('cooldown');

    // And the clock takes it through the whole cool-down before moving on.
    act(() => { vi.advanceTimersByTime(298_000); });
    expect(seen!.state.index).toBe(cardioAt);
    expect(seen!.position.segment.intensity).toBe('cooldown');
    act(() => { vi.advanceTimersByTime(2_000); });
    expect(seen!.state.index).toBe(cardioAt + 1);
  });
});
