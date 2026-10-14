/**
 * Me → Data's walk answers and "Erase all routes", driven through the real
 * screen and sheets and the real store over a fake IndexedDB that can refuse
 * a write: asked twice before anything is erased (H6R-15, K6R-04), said when
 * done (K6R-11), a refused answer said too (K6R-09), and the row's words
 * (K6R-05). Replaced are only the router and the vendored sheet.
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
  const { createContext, createElement, useContext } = await import('react');
  // Close closes, as the vendored sheet's does: through the sheet's own `onOpenChange`.
  const Closing = createContext<(open: boolean) => void>(() => {});
  return {
    Sheet: ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children?: ReactNode }) =>
      (open ? createElement(Closing.Provider, { value: onOpenChange }, children) : null),
    SheetContent: ({ children }: { children?: ReactNode }) => createElement('div', { role: 'dialog' }, children),
    SheetTitle: ({ children }: { children?: ReactNode }) => createElement('h2', null, children),
    SheetClose: ({ children }: { children?: ReactNode }) => {
      const close = useContext(Closing);
      return createElement('button', { type: 'button', onClick: () => close(false) }, children);
    },
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
let db = fakeIndexedDB();
beforeEach(async () => {
  local.clear();
  refuse = false;
  store.resetForTests();
  // A full device is found at commit, so a write held mid-way can still be refused (`setQuota`).
  db = fakeIndexedDB({ quota: 'commit', failWrite: (s, v) => (refuse && s === 'settings' && v.key === 'settings' ? new DOMException('Disk is full', 'QuotaExceededError') : undefined) });
  await store.start({
    factory: db,
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

describe('a walk answer the device refuses, said where it was given (K6R-09)', () => {
  it('leaves the switch as it was, and says the change wasn’t saved', async () => {
    await open();
    refuse = true;
    const toggle = () => x().all().find(n => n.props.role === 'switch' && n.props['aria-label'] === 'Map pictures under routes')!;
    await x().click(toggle());
    expect(x().text()).toContain('That change wasn’t saved.');
    expect(store.getState().settings.walk?.map).toBe('off');
    // Given again once it can be kept: the note goes.
    refuse = false;
    await x().click(toggle());
    expect(x().text()).not.toContain('That change wasn’t saved.');
    expect(store.getState().settings.walk?.map).toBe('on');
  });
});

describe('Delete everything, while it erases (kiro FK-10)', () => {
  it('can’t be closed while Erasing…, so a refusal is said in it: Nothing was deleted', async () => {
    await open();
    await x().click(x().button('Delete everything on this device', { exact: false }));
    await x().click(x().button('Delete everything', { exact: true }));
    expect(x().text()).toContain('Erase all of it?');
    // The device takes its time over the erase, and then refuses it.
    db.control.hold();
    await x().click(x().button('Erase all', { exact: true }));
    expect(x().buttons('Erasing…', { exact: true })).toHaveLength(1);
    db.control.setQuota(-1);
    // Close, mid-erase: the sheet stays, with the erase it is waiting on.
    await x().click(x().button('Close', { exact: true }));
    expect(x().text()).toContain('Erase all of it?');
    db.control.release();
    await x().settle();
    expect(x().text()).toContain('Nothing was deleted.');
    expect(store.getState().records.routes).toEqual([ROUTE]);
    // Once it has settled, Close closes again.
    db.control.setQuota(undefined);
    await x().click(x().button('Close', { exact: true }));
    expect(x().text()).not.toContain('Erase all of it?');
  });
});
