/**
 * Back & leg's chart and its period (codex F-ui-05), through the real hub,
 * the real chart, the real store and a fake IndexedDB. The router, the hub's
 * frame and the chart's measuring are stand-ins: the chart is given a phone's
 * width, as a browser would measure it.
 *
 * A day chosen on the chart belongs to the period it was chosen in: another
 * period starts with none, as the trend chart's does (M21), so the words above
 * the plot and the slider's value never point past the new range.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, useEffect, useReducer } from 'react';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, textOf, type Host, type HostNode } from '@/test/host';

const router = vi.hoisted(() => ({ params: new URLSearchParams(), redraw: new Set<() => void>() }));
vi.mock('react-router-dom', async () => {
  const { createElement: h, useEffect, useReducer } = await import('react');
  return {
    useParams: () => ({}),
    useLocation: () => ({ pathname: '/hub/back', search: `?${router.params}`, state: null, key: 'k0' }),
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
vi.mock('@/screens/hub/HubFrame', async () => {
  const { createElement: h } = await import('react');
  return {
    HubFrame: ({ children }: { children?: unknown }) => h('main', null, children as never),
    HubSection: ({ title, children }: { title: string; children?: unknown }) => h('section', null, h('h2', null, title), children as never),
    SeeTrends: () => null,
  };
});
vi.mock('@/components/hig/useMeasure', () => ({ useMeasure: () => [{ current: null }, 360, 15] }));
vi.mock('@/components/checkin/CheckInSheet', () => ({ CheckInSheet: () => null }));
vi.mock('@/components/hig/Sheet', async () => {
  const { createElement: h } = await import('react');
  return { Sheet: ({ open, children }: { open: boolean; children?: unknown }) => (open ? h('div', { role: 'dialog' }, children as never) : null) };
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
const { default: BackHub } = await import('./BackHub');
const { BackLegChart } = await import('@/screens/track/BackLegChart');
const { assembleBackLeg } = await import('@/screens/track/backLegSeries');

let host: Host | undefined;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 13, 9, 0, 0));
  local.clear();
  router.params = new URLSearchParams();
  store.resetForTests();
  await store.start({ factory: fakeIndexedDB(), broadcast: null });
});
afterEach(() => {
  host?.unmount();
  host = undefined;
  vi.useRealTimers();
});

const slider = () => host!.all().find(n => n.props.role === 'slider')!;
const key = async (node: HostNode, name: string, group: HostNode[] = []) => {
  (node.props.onKeyDown as (e: unknown) => void)({
    key: name, preventDefault() {},
    currentTarget: { parentElement: { querySelectorAll: () => group.map(() => ({ focus() {} })) } },
  });
  await host!.settle();
};
const periods = () => {
  const group = host!.all().find(n => n.props.role === 'radiogroup' && n.props['aria-label'] === 'Period')!;
  return host!.all().filter(n => n.props.role === 'radio' && group.children.includes(n));
};
const period = () => textOf(periods().find(n => n.props['aria-checked'] === true)!.children);
/** The chosen day in words, above the plot. */
const callout = () => host!.all().find(n => n.type === 'p' && String(n.props.className ?? '').includes('min-h-[2lh]'))!;

async function painOn(days: string[]) {
  for (const day of days) {
    const saved = await store.addObservation({ kind: 'backPain', value: 4, unit: '0-10', scope: 'pointInTime', source: 'manual', at: atOnDay(day) });
    expect(saved.ok ? 'saved' : saved.failure.message).toBe('saved');
  }
}

describe('Back & leg: a day chosen on the chart, and another period chosen by the keyboard (codex F-ui-05)', () => {
  it('the choice is put down with its period, so nothing points past the new range, and End finds the new last day', async () => {
    await painOn(['2026-10-05', '2026-10-07', '2026-10-09', '2026-10-12']);
    router.params = new URLSearchParams('period=year');
    host = render(createElement(BackHub));
    await host.settle();
    expect(period()).toBe('Year');
    expect(slider().props['aria-valuemax']).toBe(365);
    // End: today, the Year's last day.
    await key(slider(), 'End');
    expect(slider().props['aria-valuenow']).toBe(365);
    expect(String(slider().props['aria-valuetext'])).toMatch(/^Tuesday, 13 October/);
    // Shift+Tab to the period, and ArrowLeft twice: Month.
    await key(periods().find(n => n.props['aria-checked'] === true)!, 'ArrowLeft', periods());
    await key(periods().find(n => n.props['aria-checked'] === true)!, 'ArrowLeft', periods());
    expect(period()).toBe('Month');
    expect(slider().props['aria-valuemax']).toBe(30);
    expect(slider().props['aria-valuenow']).toBe(0);
    expect(slider().props['aria-valuetext']).toBe('Nothing chosen');
    expect(textOf(callout().children)).toBe('Tap or drag across the chart, or use the arrow keys, to read a day.');
    // End in the Month: its own last day, today.
    await key(slider(), 'End');
    expect(slider().props['aria-valuenow']).toBe(30);
    expect(textOf(callout().children)).toMatch(/^Tuesday, 13 October/);
  });

  it('a day chosen early in one period isn’t carried onto another period’s same place, a different date', async () => {
    await painOn(['2026-10-05', '2026-10-07', '2026-10-09', '2026-10-12']);
    router.params = new URLSearchParams('period=year');
    host = render(createElement(BackHub));
    await host.settle();
    // Home: the Year's first day, 14 October 2025.
    await key(slider(), 'Home');
    expect(slider().props['aria-valuenow']).toBe(1);
    expect(String(slider().props['aria-valuetext'])).toMatch(/14 October 2025/);
    await key(periods().find(n => n.props['aria-checked'] === true)!, 'Home', periods());
    expect(period()).toBe('Month');
    expect(slider().props['aria-valuenow']).toBe(0);
    expect(slider().props['aria-valuetext']).toBe('Nothing chosen');
  });

  it('in the same range, a day past today once the phone’s clock goes back is put down too', async () => {
    await painOn(['2026-10-05', '2026-10-07', '2026-10-09', '2026-10-12']);
    // The trend screen's month, 1 to 31 October, which keeps its range while today moves.
    const data = assembleBackLeg({ from: '2026-10-01', to: '2026-10-31' }, store.getState().observations, [], []);
    const clock = { today: '2026-10-13', redraw: () => {} };
    function Trend() {
      const [, redraw] = useReducer((x: number) => x + 1, 0);
      useEffect(() => { clock.redraw = redraw; }, []);
      return createElement(BackLegChart, { data, current: clock.today });
    }
    host = render(createElement(Trend));
    await host.settle();
    await key(slider(), 'End');
    expect(slider().props['aria-valuenow']).toBe(13);
    clock.today = '2026-10-12';
    clock.redraw();
    await host.settle();
    expect(slider().props['aria-valuemax']).toBe(12);
    expect(slider().props['aria-valuenow']).toBe(0);
  });
});
