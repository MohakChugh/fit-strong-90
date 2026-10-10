/**
 * A walk's start through its real callers (B-01, journey §9.1, Review Focus 5):
 * `useStartMovement` and its walk path, the preflight sheet, and the real
 * store over a fake IndexedDB. Replaced are the router, the vendored sheet,
 * and the two platform calls, which record when they are made.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import type { CheckInRecord, DailyCheckIn } from '@/types/checkin';
import type { UserProfile } from '@/types/profile';
import type { UserSettings } from '@/types';
import { createDefaultProfile, type ProfileInput } from '@/profile/defaults';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, type Host } from '@/test/host';

const router = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => router.navigate,
  useLocation: () => ({ pathname: '/hub/walk', search: '', state: null, key: 'k0' }),
}));
vi.mock('@/components/ui/sheet', async () => {
  const { createElement: h, Fragment } = await import('react');
  return {
    Sheet: ({ open, children }: { open: boolean; children?: ReactNode }) => (open ? h(Fragment, null, children) : null),
    SheetContent: ({ children }: { children?: ReactNode }) => h('div', { role: 'dialog' }, children),
    SheetTitle: ({ children }: { children?: ReactNode }) => h('h2', null, children),
    SheetClose: ({ children }: { children?: ReactNode }) => h('button', { type: 'button' }, children),
  };
});
const platform = vi.hoisted(() => ({ motion: vi.fn(), audio: vi.fn() }));
vi.mock('@/walk/browser', () => ({ requestMotion: platform.motion }));
vi.mock('@/walk/voice', () => ({ walkVoice: () => ({ unlock: platform.audio, say: async () => 'skipped', cancel() {}, trouble: null, status: 'idle', subscribe: () => () => {} }) }));

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;
Object.assign(globalThis, {
  window: globalThis,
  document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {}, getElementById: () => null },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
});

const store = await import('@/store/useStore');
const { useStartMovement } = await import('@/components/checkin/useStartMovement');
const { evaluateCheckIn } = await import('@/engine/readiness');
const { liveHref } = await import('@/walk/plan');
const { resetPendingCheckInsForTests } = await import('@/components/checkin/pending');

const known = { medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous' as const, glucoseMonitor: 'meter' as const, glucoseUnit: 'mg/dL' as const };
const PLAIN = { health: known, voice: { muted: false } } satisfies ProfileInput;
const INSULIN = { health: { ...known, diabetes: 'type2', insulin: 'injections_or_pump', insulinRegimen: 'basalOnly' }, voice: { muted: false } } satisfies ProfileInput;
const DAY = '2026-10-09';
const iso = (h: number, m = 0) => new Date(2026, 9, 9, h, m, 0).toISOString();
const clock = (h: number, m = 0) => vi.setSystemTime(new Date(2026, 9, 9, h, m, 0));
const tap = (h: Host, name: string) => (h.button(name, { exact: true }).props.onClick as (e: unknown) => void)({ preventDefault() {}, stopPropagation() {} });

let host: Host | undefined;
let plan = { kind: 'walk' as const, gps: true, steps: true };

function Harness() {
  const { start, sheet } = useStartMovement();
  return createElement('div', null,
    createElement('button', { type: 'button', onClick: () => start('walk', liveHref('mgh3k2x1-1a2b3c4d', plan), 'Start walk') }, 'Begin'),
    sheet);
}

async function seeded(p: UserProfile, walk?: UserSettings['walk']) {
  const morning: DailyCheckIn = { date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(9), source: 'meter' } };
  const rec: CheckInRecord = { ...morning, readiness: evaluateCheckIn(p, morning) };
  await store.update(prev => ({ ...prev, profile: p, checkIns: [rec], settings: { ...prev.settings, ...(walk ? { walk } : {}) } }));
  host = render(createElement(Harness));
  await host.settle();
  return host;
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  clock(9, 5);
  local.clear();
  store.resetForTests();
  resetPendingCheckInsForTests();
  router.navigate = vi.fn();
  platform.motion.mockReset().mockResolvedValue('granted');
  platform.audio.mockReset().mockResolvedValue(true);
  plan = { kind: 'walk', gps: true, steps: true };
  await store.start({ factory: fakeIndexedDB(), broadcast: null });
});
afterEach(() => {
  host?.unmount();
  host = undefined;
  vi.useRealTimers();
});

describe('starting a walk (B-01)', () => {
  it('asks for motion and unlocks audio inside the tap that starts the walk, then starts it once', async () => {
    const h = await seeded(createDefaultProfile(PLAIN), { saveRoutes: false, map: 'off', stepCardSeen: true });
    tap(h, 'Begin');
    // Synchronously, before the handler's work is awaited.
    expect(platform.motion).toHaveBeenCalledTimes(1);
    expect(platform.audio).toHaveBeenCalledTimes(1);
    await h.settle();
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(router.navigate.mock.calls[0][0]).toMatch(/^\/walk\/live\?.*from=walk/);
  });

  it('asks the first-walk questions first, and makes the last answer the tap that starts', async () => {
    const h = await seeded(createDefaultProfile(PLAIN));
    tap(h, 'Begin');
    await h.settle();
    expect(h.text()).toContain('Keep a record of your route on this phone?');
    expect(platform.motion).not.toHaveBeenCalled();
    tap(h, 'Yes, keep routes');
    await h.settle();
    tap(h, 'No pictures');
    await h.settle();
    expect(h.text()).toContain('FitStrong counts steps only while it’s open on the screen.');
    expect(platform.motion).not.toHaveBeenCalled();
    tap(h, 'Start walk');
    expect(platform.motion).toHaveBeenCalledTimes(1);
    await h.settle();
    expect(router.navigate.mock.calls[0][0]).toMatch(/route=1/);
    expect(store.getState().settings.walk).toEqual({ saveRoutes: true, map: 'off', stepCardSeen: true });
  });
});

describe('a start refused at the last moment (J§4.1, V-J19, Review Focus 5)', () => {
  it('shows the gate’s new answer, keeps the answers given, and asks no question twice', async () => {
    plan = { kind: 'walk', gps: true, steps: false };
    const h = await seeded(createDefaultProfile(INSULIN));
    tap(h, 'Begin');
    await h.settle();
    expect(h.text()).toContain('Keep a record of your route on this phone?');
    // The person takes their time: the 09:00 reading is no longer fresh.
    clock(9, 31);
    tap(h, 'No, don’t keep routes');
    await h.settle();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(h.text()).toContain('Check glucose first');
    expect(store.getState().settings.walk?.saveRoutes).toBe(false);
    tap(h, 'Check in');
    await h.settle();
    // The check-in asks for a fresh reading; the route question is not asked again.
    expect(h.buttons('No, don’t keep routes')).toHaveLength(0);
    expect(() => h.field('Glucose reading')).not.toThrow();
    // The refused attempt unlocked audio in its own tap; the next start unlocks it again in its own.
    expect(platform.audio).toHaveBeenCalledTimes(1);
    await h.change(h.field('Glucose reading'), { value: '128' });
    await h.click(h.button('See today’s plan'));
    expect(platform.audio).toHaveBeenCalledTimes(1);
    // The check-in's own Start is the tap that finally starts the walk: B-01 runs inside it.
    tap(h, 'Start walk');
    expect(platform.audio).toHaveBeenCalledTimes(2);
    await h.settle();
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(router.navigate.mock.calls[0][0]).toMatch(/^\/walk\/live\?.*from=walk/);
    expect(router.navigate.mock.calls[0][0]).not.toMatch(/route=1/);
  });
});
