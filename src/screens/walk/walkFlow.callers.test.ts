/**
 * The first walk's questions, answered while another tab changes this
 * phone's walk settings (H6R-07, board D176): each answer is written on its
 * own, against what is stored then, so the other tab's answers stay. Driven through the real `useWalkFlow` and `PreflightSheet`, the real
 * store over a fake IndexedDB and another tab's write straight to it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement as h, type ReactNode } from 'react';
import { createDefaultProfile } from '@/profile/defaults';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { openDb } from '@/store/db';
import { commitChange } from '@/store/snapshot';
import { render, type Host } from '@/test/host';

vi.mock('react-router-dom', () => ({ useNavigate: () => () => {}, useLocation: () => ({ pathname: '/hub/walk', search: '', state: null, key: 'k0' }) }));
vi.mock('@/components/ui/sheet', async () => {
  const { createElement, Fragment } = await import('react');
  return {
    Sheet: ({ open, children }: { open: boolean; children?: ReactNode }) => (open ? createElement(Fragment, null, children) : null),
    SheetContent: ({ children }: { children?: ReactNode }) => createElement('div', { role: 'dialog' }, children),
    SheetTitle: ({ children }: { children?: ReactNode }) => createElement('h2', null, children),
    SheetClose: ({ children }: { children?: ReactNode }) => createElement('button', { type: 'button' }, children),
  };
});
vi.mock('@/walk/browser', () => ({ requestMotion: async () => 'granted' }));

const local = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
    removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: () => null, get length() { return local.size; },
  },
  window: globalThis,
  document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {}, getElementById: () => null, documentElement: { dataset: {} }, body: { nodeType: 1 } },
});

const store = await import('@/store/useStore');
const { useWalkFlow } = await import('./useWalkFlow');
const { CONSENT } = await import('@/walk/consent');

let fake = fakeIndexedDB();
let host: Host | undefined;
beforeEach(async () => {
  local.clear();
  store.resetForTests();
  fake = fakeIndexedDB();
  await store.start({ factory: fake, broadcast: null });
  await store.update(prev => ({ ...prev, profile: createDefaultProfile({ health: { diabetes: 'none', medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous' } }) }));
});
afterEach(() => {
  host?.unmount();
  host = undefined;
});

function Probe() {
  const flow = useWalkFlow(() => {});
  return h('div', null, h('button', { type: 'button', onClick: () => flow.begin({ kind: 'walk', gps: true, steps: false }) }, 'Start walk'), flow.ui);
}

describe('the first walk’s questions, answered one at a time against what is stored (H6R-07)', () => {
  it('writes only the answer given: another tab’s map answer, made while the question was open, stays', async () => {
    host = render(h(Probe));
    await host.settle();
    await host.click(host.button('Start walk', { exact: true }));
    expect(host.text()).toContain(CONSENT.keepRoute.title);
    // Meanwhile another tab answers the map question; this one hasn't heard.
    const tab = await openDb(fake);
    const theirs = { saveRoutes: 'unasked' as const, map: 'off' as const };
    expect((await commitChange(tab, undefined, () => ({ change: { settings: { patch: { walk: theirs } } } }))).ok).toBe(true);
    tab.close();
    await host.click(host.button(CONSENT.keepRoute.yes, { exact: true }));
    await host.settle();
    expect(store.getState().settings.walk).toEqual({ ...theirs, saveRoutes: true });
  });
});
