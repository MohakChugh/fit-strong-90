/**
 * Trends' eight week rings and a week chosen before them (codex F-ui-06),
 * through the real Trends screen, the real store and a fake IndexedDB. The
 * router and the screen's frame are stand-ins that decide nothing here.
 *
 * The address can choose a week older than the eight rings (H3-14). The
 * group still has its one place in the Tab order, so the keyboard can reach
 * the weeks at all (ARIA radio group: with none of them chosen, the first).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, type Host } from '@/test/host';

const router = vi.hoisted(() => ({ params: new URLSearchParams(), redraw: new Set<() => void>() }));
vi.mock('react-router-dom', async () => {
  const { createElement: h, useEffect, useReducer } = await import('react');
  return {
    useParams: () => ({}),
    useLocation: () => ({ pathname: '/trends', search: `?${router.params}`, state: null, key: 'k0' }),
    useNavigate: () => () => {},
    useSearchParams: () => {
      const [, redraw] = useReducer((x: number) => x + 1, 0);
      useEffect(() => {
        router.redraw.add(redraw);
        return () => void router.redraw.delete(redraw);
      }, []);
      return [router.params, (next: URLSearchParams | ((p: URLSearchParams) => URLSearchParams)) => {
        router.params = typeof next === 'function' ? next(router.params) : next;
        router.redraw.forEach(r => r());
      }];
    },
    Link: ({ children }: { children?: unknown }) => h('a', null, children as never),
    Navigate: () => null,
  };
});
vi.mock('sonner', () => ({ toast: Object.assign(() => {}, { success() {}, warning() {}, error() {}, dismiss() {} }) }));
vi.mock('@/components/hig/Screen', async () => {
  const { createElement: h } = await import('react');
  return { Screen: ({ title, children }: { title: string; children?: unknown }) => h('main', null, h('h1', null, title), children as never) };
});

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
const { atOnDay } = await import('@/health/observation');
const { default: TrendsScreen } = await import('./TrendsScreen');

let host: Host | undefined;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 13, 9, 0, 0));
  local.clear();
  store.resetForTests();
  await store.start({ factory: fakeIndexedDB(), broadcast: null });
  // Something recorded, so Trends shows its weeks.
  const saved = await store.addObservation({ kind: 'weight', value: 80, unit: 'kg', scope: 'pointInTime', source: 'manual', at: atOnDay('2026-10-12') });
  expect(saved.ok ? 'saved' : saved.failure.message).toBe('saved');
});
afterEach(() => {
  host?.unmount();
  host = undefined;
  vi.useRealTimers();
});

const weeks = () => {
  const group = host!.all().find(n => n.props.role === 'radiogroup' && n.props['aria-label'] === 'Week')!;
  return host!.all().filter(n => n.props.role === 'radio' && group.children.includes(n));
};
const stops = () => weeks().filter(n => n.props.tabIndex === 0).map(n => String(n.props['aria-label']));

describe('Trends’ week rings, with a week chosen before them (codex F-ui-06)', () => {
  it('a week older than the rings leaves the group one Tab stop, the oldest ring, and the arrows move on from it', async () => {
    router.params = new URLSearchParams('week=2026-01-05');
    host = render(createElement(TrendsScreen));
    await host.settle();
    expect(weeks()).toHaveLength(8);
    expect(weeks().every(n => n.props['aria-checked'] === false)).toBe(true);
    expect(stops()).toEqual([String(weeks()[0].props['aria-label'])]);
    // ArrowRight from it chooses the next ring, which takes the Tab stop.
    (weeks()[0].props.onKeyDown as (e: unknown) => void)({ key: 'ArrowRight', preventDefault() {}, currentTarget: { parentElement: { querySelectorAll: () => weeks().map(() => ({ focus() {} })) } } });
    await host.settle();
    expect(router.params.get('week')).toBe('2026-08-31');
    expect(weeks()[1].props['aria-checked']).toBe(true);
    expect(stops()).toEqual([String(weeks()[1].props['aria-label'])]);
  });

  it('a chosen week among the rings is the one Tab stop, as before', async () => {
    router.params = new URLSearchParams('week=2026-09-28');
    host = render(createElement(TrendsScreen));
    await host.settle();
    expect(stops()).toEqual(['Week of 28 Sep: 0 min moved']);
  });
});
