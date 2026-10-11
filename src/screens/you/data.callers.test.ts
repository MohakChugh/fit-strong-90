/**
 * Me → Data's walk answers and "Erase all routes", driven through the real
 * screen and sheets and the real store over a fake IndexedDB that can refuse
 * a write: asked twice before anything is erased (H6R-15, K6R-04), said when
 * done (K6R-11), and the row's words (K6R-05). Replaced are only the router,
 * the toasts and the vendored sheet and switch.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement as h, type ReactNode } from 'react';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, type Host } from '@/test/host';

vi.mock('react-router-dom', async () => {
  const { createElement } = await import('react');
  return {
    useNavigate: () => () => {},
    useLocation: () => ({ pathname: '/me/data', search: '', state: null, key: 'k0' }),
    useSearchParams: () => [new URLSearchParams(), () => {}],
    useViewTransitionState: () => false,
    Link: ({ to, children }: { to: string; children?: ReactNode }) => createElement('a', { href: `#${to}` }, children),
  };
});
vi.mock('sonner', () => ({ toast: Object.assign(() => {}, { success() {}, warning() {}, error() {} }) }));
// The vendored switch needs a DOM: a plain one, its change through the same callback.
vi.mock('@base-ui/react/switch', async () => {
  const { createElement } = await import('react');
  return {
    Switch: {
      Root: ({ checked, onCheckedChange, children, ...rest }: { checked: boolean; onCheckedChange: (on: boolean) => void; children?: ReactNode; [k: string]: unknown }) =>
        createElement('button', { type: 'button', role: 'switch', 'aria-checked': checked, 'aria-label': rest['aria-label'], onClick: () => onCheckedChange(!checked) }, children),
      Thumb: () => null,
    },
  };
});
vi.mock('@/components/ui/sheet', async () => {
  const { createElement, Fragment } = await import('react');
  return {
    Sheet: ({ open, children }: { open: boolean; children?: ReactNode }) => (open ? createElement(Fragment, null, children) : null),
    SheetContent: ({ children }: { children?: ReactNode }) => createElement('div', { role: 'dialog' }, children),
    SheetTitle: ({ children }: { children?: ReactNode }) => createElement('h2', null, children),
    SheetClose: ({ children }: { children?: ReactNode }) => createElement('button', { type: 'button' }, children),
  };
});

const local = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
    removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: () => null, get length() { return local.size; },
  },
  window: globalThis,
  document: {
    title: '', visibilityState: 'visible', activeElement: null, addEventListener() {}, removeEventListener() {},
    getElementById: () => null, querySelector: () => null, documentElement: { dataset: {} }, body: { nodeType: 1 },
  },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  scrollTo() {},
  getComputedStyle: () => ({ getPropertyValue: () => '' }),
  ...(typeof globalThis.addEventListener === 'function' ? {} : { addEventListener() {}, removeEventListener() {} }),
  requestAnimationFrame: (f: () => void) => setTimeout(f, 0),
});

const store = await import('@/store/useStore');
const { DataScreen } = await import('./DataScreen');

const WALK = 'mgh3k2x1-1a2b3c4d';
const LINE = { start: 1_760_000_000_000, end: 1_760_000_020_000, coords: [[12.97, 77.59], [12.9705, 77.5902]] as [number, number][], ms: [0, 20_000] };
const ROUTE = { walkId: WALK, version: 1 as const, startedAt: '2026-10-08T09:00:00.000+05:30', segments: [LINE], bbox: [12.97, 77.59, 12.9705, 77.5902] as [number, number, number, number] };

/** Whether the next settings write is refused. */
let refuse = false;
let host: Host | undefined;
beforeEach(async () => {
  local.clear();
  refuse = false;
  store.resetForTests();
  await store.start({
    factory: fakeIndexedDB({ failWrite: (s, v) => (refuse && s === 'settings' && v.key === 'settings' ? new DOMException('Disk is full', 'QuotaExceededError') : undefined) }),
    broadcast: null,
  });
  await store.setSettings({ walk: { saveRoutes: true, map: 'off' } });
  await store.putRecords('routes', [ROUTE]);
});
afterEach(() => {
  host?.unmount();
  host = undefined;
});

const x = () => host!;
async function open() {
  host = render(h(DataScreen));
  await x().settle();
}

describe('"Erase all routes" in Me → Data, asked twice, as Delete everything is (H6R-15, K6R-04, K6R-11)', () => {
  it('erases nothing at the first yes; the second erases every route, and says so', async () => {
    await open();
    await x().click(x().button('Erase all routes', { exact: false }));
    // "device" and its question mark are two pieces of text in the host's reading.
    expect(x().text()).toMatch(/Erase all routes on this device ?\?/);
    expect(x().text()).toContain('New walks still keep their route while Keep walk routes is on.');
    await x().click(x().button('Erase routes', { exact: true }));
    // The first yes only asks again.
    expect(store.getState().records.routes).toEqual([ROUTE]);
    expect(x().text()).toContain('Erase every route for good?');
    expect(x().text()).toContain('No backup brings them back.');
    await x().click(x().button('Erase all routes', { exact: true }));
    await x().settle();
    expect(store.getState().records.routes).toEqual([]);
    expect(x().text()).not.toContain('Erase every route for good?');
    expect(x().all().some(n => n.props.role === 'status' && x().text().includes('All routes erased.'))).toBe(true);
  });

  it('keeps the routes at "Keep my routes", at either step', async () => {
    await open();
    await x().click(x().button('Erase all routes', { exact: false }));
    await x().click(x().button('Keep my routes', { exact: true }));
    expect(x().text()).not.toMatch(/Erase all routes on this device ?\?/);
    await x().click(x().button('Erase all routes', { exact: false }));
    await x().click(x().button('Erase routes', { exact: true }));
    await x().click(x().button('Keep my routes', { exact: true }));
    expect(store.getState().records.routes).toEqual([ROUTE]);
    expect(x().text()).not.toContain('All routes erased.');
  });

  it('says so, in the sheet, when the device refuses the erase, and changes nothing', async () => {
    await open();
    await x().click(x().button('Erase all routes', { exact: false }));
    await x().click(x().button('Erase routes', { exact: true }));
    refuse = true;
    await x().click(x().button('Erase all routes', { exact: true }));
    await x().settle();
    expect(x().text()).toContain('The routes were not erased.');
    expect(store.getState().records.routes).toEqual([ROUTE]);
    expect(x().text()).not.toContain('All routes erased.');
  });

  it('says a walk not yet saved keeps itself, only its route goes, when no route is saved (K6R-05)', async () => {
    await store.removeRecords('routes', [WALK]);
    await open();
    expect(x().text()).toContain('No saved routes. Erasing also clears the route of a walk not yet saved. The walk stays.');
  });
});
