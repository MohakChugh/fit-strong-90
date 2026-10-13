/**
 * The Labs hub's "Which result" (codex F-ui-04), through the real hub, the
 * real store and a fake IndexedDB. The router and the hub's frame are
 * stand-ins; the selector is the real one, counted as it mounts.
 *
 * Moving the result with the keyboard must leave the selector in place: one
 * remounted takes the focused radio with it, and focus falls to the page.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, textOf, type Host } from '@/test/host';

const router = vi.hoisted(() => ({ params: new URLSearchParams('metric=hba1c'), redraw: new Set<() => void>() }));
vi.mock('react-router-dom', async () => {
  const { createElement: h, useEffect, useReducer } = await import('react');
  return {
    useParams: () => ({ id: 'labs' }),
    useLocation: () => ({ pathname: '/hub/labs', search: `?${router.params}`, state: null, key: 'k0' }),
    useNavigate: () => () => {},
    useSearchParams: () => {
      const [, redraw] = useReducer((x: number) => x + 1, 0);
      useEffect(() => {
        router.redraw.add(redraw);
        return () => void router.redraw.delete(redraw);
      }, []);
      return [router.params, (next: Record<string, string> | URLSearchParams | ((p: URLSearchParams) => URLSearchParams)) => {
        router.params = typeof next === 'function' ? next(router.params) : new URLSearchParams(next as Record<string, string>);
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
const mounts = vi.hoisted(() => ({ segmented: 0 }));
vi.mock('@/screens/track/ui', async importOriginal => {
  const real = await importOriginal<typeof import('@/screens/track/ui')>();
  const { createElement: h, useEffect } = await import('react');
  return {
    ...real,
    Segmented: (props: Parameters<typeof real.Segmented>[0]) => {
      useEffect(() => { mounts.segmented += 1; }, []);
      return h(real.Segmented as never, props as never);
    },
  };
});
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
const { default: ReadingHub } = await import('./ReadingHub');

let host: Host | undefined;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 8, 9, 0, 0));
  router.params = new URLSearchParams('metric=hba1c');
  mounts.segmented = 0;
  store.resetForTests();
  await store.start({ factory: fakeIndexedDB(), broadcast: null });
});
afterEach(() => {
  host?.unmount();
  host = undefined;
  vi.useRealTimers();
});

const radios = () => host!.all().filter(n => n.props.role === 'radio' && !inDialog(n));
const inDialog = (n: unknown) => host!.all().some(d => d.props.role === 'dialog' && contains(d, n));
const contains = (d: { children: unknown[] }, n: unknown): boolean => d.children.some(c => c === n || (typeof c !== 'string' && contains(c as { children: unknown[] }, n)));
const chosen = () => textOf(radios().find(n => n.props['aria-checked'] === true)!.children);
/** An arrow on the chosen radio, as the keyboard does it: the names of what it focused. */
async function arrowRight(key = 'ArrowRight') {
  const current = radios().find(n => n.props['aria-checked'] === true)!;
  const focused: string[] = [];
  const group = radios().map(r => ({ focus: () => focused.push(textOf(r.children)) }));
  (current.props.onKeyDown as (e: unknown) => void)({ key, preventDefault() {}, currentTarget: { parentElement: { querySelectorAll: () => group } } });
  await host!.settle();
  return focused;
}
const latest = () => {
  const section = host!.all().find(n => n.type === 'section' && textOf(n.children).startsWith('Latest'))!;
  return textOf(section.children);
};

describe('the Labs hub’s “Which result”, moved by the keyboard (codex F-ui-04)', () => {
  it('stays in place as each result is chosen, so the radio chosen keeps the focus and the next arrow moves on', async () => {
    const { atOnDay } = await import('@/health/observation');
    const at = atOnDay('2026-10-01');
    for (const reading of [{ kind: 'hba1c', value: 6.4, unit: '%' }, { kind: 'vitaminD', value: 31, unit: 'ng/mL' }] as const) {
      const saved = await store.addObservation({ ...reading, scope: 'pointInTime', source: 'manual', at });
      expect(saved.ok ? 'saved' : saved.failure.message).toBe('saved');
    }
    host = render(createElement(ReadingHub));
    await host.settle();
    expect(chosen()).toBe('HbA1c');
    expect(latest()).toContain('6.4%');
    expect(mounts.segmented).toBe(1);
    for (const next of ['Vitamin B12', 'Vitamin D']) {
      expect(await arrowRight()).toEqual([next]);
      expect(chosen()).toBe(next);
      // The radio it focused is the one still there: the group wasn't drawn again.
      expect(mounts.segmented).toBe(1);
    }
    // The result's own content follows it.
    expect(latest()).toContain('31.0 ng/mL');
    expect(latest()).not.toContain('6.4%');
  });

  it('a saved result’s notice goes with its result, as it did when the screen was drawn again', async () => {
    host = render(createElement(ReadingHub));
    await host.settle();
    await host.click(host.button('Add a result'));
    await host.change(host.all().find(n => n.type === 'input' && n.props.inputMode === 'decimal')!, { value: '6.4' });
    await host.click(host.button('Save'));
    const notice = () => host!.all().filter(n => n.props.role === 'status').map(n => textOf(n.children)).find(t => t.startsWith('Saved on this device'));
    expect(notice()).toMatch(/^Saved on this device: HbA1c 6\.4%/);
    const arriving = () => host!.all().some(n => String(n.props.className ?? '').includes('zoom-in-110'));
    expect(arriving()).toBe(true);
    // The form's own "Which result" came and went with its sheet; the hub's stays.
    const before = mounts.segmented;
    expect(await arrowRight()).toEqual(['Vitamin B12']);
    expect(notice()).toBeUndefined();
    // Back on HbA1c, its result is no longer arriving.
    expect(await arrowRight('ArrowLeft')).toEqual(['HbA1c']);
    expect(arriving()).toBe(false);
    expect(mounts.segmented).toBe(before);
  });
});
