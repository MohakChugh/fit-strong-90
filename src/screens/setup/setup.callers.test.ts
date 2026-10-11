/**
 * Me's chapter editor, driven through its real caller: `ChapterEditor` with
 * the real store and its real Save. Only the router and the browser's globals
 * are stand-ins.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, type Host, type HostChild, type HostNode } from '@/test/host';

const router = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock('react-router-dom', async () => {
  const { createElement: h } = await import('react');
  return {
    useNavigate: () => router.navigate,
    useLocation: () => ({ pathname: '/me/profile', search: '?chapter=health', state: null }),
    useSearchParams: () => [new URLSearchParams('chapter=health')],
    Link: ({ children, to, onClick }: { children?: unknown; to: string; onClick?: () => void }) => h('a', { href: `#${to}`, onClick }, children as never),
  };
});
vi.mock('@/components/hig/navigation', async importOriginal => ({ ...await importOriginal<typeof import('@/components/hig/navigation')>(), cameFrom: () => false }));

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;
Object.assign(globalThis, {
  window: globalThis,
  location: { href: 'http://localhost/' },
  document: { title: '', activeElement: null, visibilityState: 'visible', addEventListener() {}, removeEventListener() {}, documentElement: { dataset: {}, style: { setProperty() {}, removeProperty() {} } }, body: { nodeType: 1 } },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  // What base-ui's floating parts ask of a node.
  Element: class {}, HTMLElement: class {},
});

const store = await import('@/store/useStore');
const { ChapterEditor } = await import('./ChapterEditor');
const { completedSetup } = await import('@/setup/assemble');
const { gateProfile, resetPendingEditsForTests } = await import('@/setup/effective');
const { FOOT_WOUND, MINIMAL } = await import('@/setup/fixtures');
const { resetSetupSessionForTests } = await import('@/setup/draft');

const NOW = '2026-10-10T09:00:00.000+05:30';
const CTX = { thisYear: 2026, hasSteps: false };
const all = (list: HostChild[]): HostNode[] => list.flatMap(c => (typeof c === 'string' ? [] : [c, ...all(c.children)]));
const textIn = (n: HostChild): string => (typeof n === 'string' ? n : n.children.map(textIn).join(' '));
/** The option `option` of the question named `question` (a radio group's label). */
function radio(host: Host, question: string, option: string): HostNode {
  const group = host.all().find(n => n.props.role === 'radiogroup' && n.props['aria-label'] === question);
  if (!group) throw new Error(`no question “${question}”`);
  const found = all(group.children).find(n => n.props.role === 'radio' && textIn(n).trim().startsWith(option));
  if (!found) throw new Error(`no “${option}” for “${question}”`);
  return found;
}

let host: Host | undefined;
let fake: ReturnType<typeof fakeIndexedDB>;
beforeEach(async () => {
  router.navigate = vi.fn();
  local.clear();
  store.resetForTests();
  resetSetupSessionForTests();
  resetPendingEditsForTests();
  fake = fakeIndexedDB();
  await store.start({ factory: fake, broadcast: null });
});
afterEach(() => {
  host?.unmount();
  host = undefined;
});

const footStatus = () => ({ stored: store.getState().profile?.health.footStatus, gate: gateProfile(store.getState()).health.footStatus });

describe('a clinical edit in Me (H5-08; board D162)', () => {
  it('releases a hold only once its write is stored', async () => {
    expect((await store.update(d => completedSetup(d, FOOT_WOUND, NOW, CTX))).ok).toBe(true);
    host = render(createElement(ChapterEditor, { chapter: 'health' }));
    await host.settle();
    // The wound has healed.
    await host.click(radio(host, 'A wound, an ulcer or a Charcot foot?', 'No'));
    fake.control.hold();
    await host.click(host.button('Save', { exact: true }));
    await host.settle();
    // Still being written: walks stay held, on screen and at every gate.
    expect(footStatus()).toEqual({ stored: 'current_wound_or_active_charcot', gate: 'current_wound_or_active_charcot' });
    fake.control.release();
    await host.settle();
    expect(footStatus()).toEqual({ stored: 'healthy', gate: 'healthy' });
  });

  it('a stricter answer counts from the tap, and keeps counting if its write is refused', async () => {
    expect((await store.update(d => completedSetup(d, MINIMAL, NOW, CTX))).ok).toBe(true);
    host = render(createElement(ChapterEditor, { chapter: 'health' }));
    await host.settle();
    await host.click(host.button(/^Foot problems: numbness, a wound or an ulcer/));
    await host.settle();
    await host.click(radio(host, 'Numbness or loss of feeling in your feet?', 'Yes'));
    await host.click(radio(host, 'A wound, an ulcer or a Charcot foot?', 'Yes, now'));
    await host.click(radio(host, 'Has a clinician told you to keep weight off a foot?', 'No'));
    fake.control.setWriteError(() => new DOMException('Disk is full', 'QuotaExceededError'));
    await host.click(host.button('Save', { exact: true }));
    await host.settle();
    expect(host.text()).toContain('That did not save.');
    expect(footStatus()).toEqual({ stored: 'healthy', gate: 'current_wound_or_active_charcot' });
  });
});

describe('body readings from Me (H5-14)', () => {
  it('a save of another chapter makes no reading from a value another tab changed since', async () => {
    expect((await store.update(d => completedSetup(d, { ...MINIMAL, weightKg: 68 }, NOW, CTX))).ok).toBe(true);
    host = render(createElement(ChapterEditor, { chapter: 'health' }));
    await host.settle();
    // Another tab: 70 kg.
    expect((await store.update(d => ({ ...d, profile: { ...d.profile!, weightKg: 70 } }))).ok).toBe(true);
    await host.settle();
    await host.click(host.button('Save', { exact: true }));
    await host.settle();
    expect(host.text()).toContain('Saved.');
    expect(store.getState().observations.filter(o => o.kind === 'weight')).toEqual([]);
    expect(store.getState().profile?.weightKg).toBe(70);
  });
});

describe('Your medicines in Me', () => {
  it('clearing the year metformin was started clears it from the record (H5-21)', async () => {
    const { withMeds } = await import('@/setup/fixtures');
    expect((await store.update(d => completedSetup(d, withMeds({ metformin: 'yes' }, { metforminSince: '2019' }), NOW, CTX))).ok).toBe(true);
    expect(store.getState().profile?.health.metforminSince).toBe('2019');
    host = render(createElement(ChapterEditor, { chapter: 'medicines' }));
    await host.settle();
    await host.change(host.field('Year you started metformin (optional)'), { value: '' });
    await host.click(host.button('Save', { exact: true }));
    await host.settle();
    expect(host.text()).toContain('Saved.');
    expect(store.getState().profile?.health.metformin).toBe(true);
    expect(store.getState().profile?.health.metforminSince).toBeUndefined();
  });
});

describe('setup’s pages', () => {
  it('Skip for now never gets past an answer that can’t be stored, such as an underage year; cleared, it skips (K5-04, H5-15)', async () => {
    const { PageFrame } = await import('./PageFrame');
    const { AboutName } = await import('./pages/about');
    host = render(createElement(PageFrame, { id: 'about.name', View: AboutName }));
    await host.settle();
    await host.change(host.field('Year you were born (optional)'), { value: '2015' });
    await host.click(host.button('Skip for now', { exact: true }));
    await host.settle();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(host.text()).toContain('FitStrong is made for adults aged 18 and over.');
    expect(store.getState().settings.setup?.draft).toBeUndefined();
    await host.change(host.field('Year you were born (optional)'), { value: '' });
    await host.click(host.button('Skip for now', { exact: true }));
    await host.settle();
    expect(router.navigate).toHaveBeenCalledWith('/setup/about/figure', undefined);
  });
});
