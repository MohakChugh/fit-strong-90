/**
 * Kiro's final review of Today's log and a measure's own screen (FK-05,
 * FK-06), through the real screens, Quick Log's real form, the real store and
 * a fake IndexedDB. The router, the screen's frame and the sheet are
 * stand-ins that decide nothing here.
 *
 * - FK-05: "Saved on this device" stays until the next Add, or until the
 *   screen is left, never on a timer (§20.4 rule 8), as the hubs' does (KH-16).
 * - FK-06: Previous day, Next day and Add say so in words (§20.4 rule 2, B-08).
 * - FK-07: it is called Today's log, as Home's row and the journey call it
 *   (§13), and its second view is Measures, never a second "Trends".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, textOf, type Host, type HostNode } from '@/test/host';

const router = vi.hoisted(() => ({ search: new URLSearchParams(), kind: 'water', id: '' }));
vi.mock('react-router-dom', async () => {
  const { createElement: h } = await import('react');
  return {
    useParams: () => ({ kind: router.kind, id: router.id }),
    useLocation: () => ({ pathname: '/day/today', search: '', state: null, key: 'k0' }),
    useNavigate: () => () => undefined,
    useSearchParams: () => [router.search, (next: URLSearchParams | ((p: URLSearchParams) => URLSearchParams)) => {
      router.search = typeof next === 'function' ? next(router.search) : next;
    }],
    // A link keeps the name of where it came from, which its screen's Back says.
    Link: ({ state, children }: { state?: { label?: string }; children?: unknown }) => h('a', { 'data-from': state?.label }, children as never),
    Navigate: () => null,
    // A correction sheet holds a Back while it saves (codex F-ui-02); nothing here leaves mid-save.
    useBlocker: () => ({ state: 'unblocked', proceed() {}, reset() {} }),
  };
});
vi.mock('@/components/hig/Screen', async () => {
  const { createElement: h } = await import('react');
  return {
    Screen: ({ title, back, trailing, children }: { title: string; back?: { label: string }; trailing?: unknown; children?: unknown }) =>
      h('main', null, h('header', null, back ? h('a', { 'data-back': back.label }, back.label) : null, h('h1', null, title), trailing as never), children as never),
  };
});
vi.mock('@/components/hig/Sheet', async () => {
  const { createElement: h } = await import('react');
  return { Sheet: ({ open, title, children }: { open: boolean; title?: string; children?: unknown }) => (open ? h('div', { role: 'dialog', 'aria-label': title }, children as never) : null) };
});
vi.mock('sonner', () => ({ toast: Object.assign(() => {}, { success() {}, warning() {}, error() {}, dismiss() {} }) }));

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
  // What a chart asks of its node as it measures it.
  getComputedStyle: () => ({ getPropertyValue: () => '' }),
});

const store = await import('@/store/useStore');
const { MyDay } = await import('./MyDay');
const { MetricDetail } = await import('./MetricDetail');
const { ReadingDetail } = await import('./RecordDetails');
const { nowAt } = await import('@/health/observation');

let host: Host | undefined;
/** Every timer of a second or more a screen sets: run by `later()`, as the minutes pass. */
let long: (() => void)[] = [];
const realTimeout = globalThis.setTimeout;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 8, 9, 0, 0));
  local.clear();
  long = [];
  router.search = new URLSearchParams();
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void, ms?: number, ...rest: unknown[]) => {
    if ((ms ?? 0) >= 1000) { long.push(fn); return 0; }
    return realTimeout(fn, ms, ...rest);
  }) as typeof setTimeout);
  store.resetForTests();
  await store.start({ factory: fakeIndexedDB(), broadcast: null });
});
afterEach(() => {
  host?.unmount();
  host = undefined;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** Time passes: every long timer set so far fires. */
async function later() {
  for (const fn of long.splice(0)) fn();
  await host!.settle();
}
const notice = () => host!.all().filter(n => n.props.role === 'status').map(n => textOf(n.children)).find(t => t.startsWith('Saved on this device'));
/** The screen's bar's control named `name`: its Add. */
function inBar(name: string): HostNode {
  const bar = host!.all().find(n => n.type === 'header')!;
  const found = [bar, ...allIn(bar)].filter(n => n.type === 'button' && String(n.props['aria-label'] ?? textOf(n.children)) === name);
  expect(found, name).toHaveLength(1);
  return found[0];
}
const allIn = (n: HostNode): HostNode[] => n.children.flatMap(c => (typeof c === 'string' ? [] : [c, ...allIn(c)]));
/** The control named `name`, exactly, as VoiceOver and the acceptance suite find it. */
function named(name: string | RegExp): HostNode {
  const found = host!.all().filter(n => n.type === 'button' && (typeof name === 'string' ? String(n.props['aria-label'] ?? textOf(n.children)) === name : name.test(String(n.props['aria-label'] ?? textOf(n.children)))));
  expect(found, String(name)).toHaveLength(1);
  return found[0];
}

describe('kiro FK-05: “Saved on this device” stays until the next Add, never on a timer (journey §20.4 rule 8)', () => {
  it('on Today’s log: saved through Quick Log, still said long after, and gone at the next Add', async () => {
    router.search = new URLSearchParams('add=water');
    host = render(createElement(MyDay, { day: 'today' }));
    await host.settle();
    await host.click(host.button('Add 250 ml'));
    expect(notice()).toBe('Saved on this device: Water 250 ml today.');
    await later();
    expect(notice()).toBe('Saved on this device: Water 250 ml today.');
    await host.click(inBar('Add a record'));
    expect(notice()).toBeUndefined();
  });

  it('on a measure’s own screen, the same', async () => {
    router.kind = 'water';
    host = render(createElement(MetricDetail, { kind: 'water' }));
    await host.settle();
    await host.click(inBar('Add water'));
    await host.click(host.button('Add 250 ml'));
    expect(notice()).toBe('Saved on this device: Water 250 ml today.');
    await later();
    expect(notice()).toBe('Saved on this device: Water 250 ml today.');
    await host.click(inBar('Add water'));
    expect(notice()).toBeUndefined();
  });
});

describe('kiro FK-06: Today’s log says Previous day, Next day and Add in words (journey §20.4 rule 2, §13, B-08)', () => {
  it('each shows its word, and keeps its name, which starts with it', async () => {
    host = render(createElement(MyDay, { day: 'today' }));
    await host.settle();
    const previous = named(/^Previous day, /);
    const next = named('Next day');
    const add = inBar('Add a record');
    expect([textOf(previous.children), textOf(next.children), textOf(add.children)]).toEqual(['Previous day', 'Next day', 'Add']);
    // The day's heading stays the one just after Previous day, as the acceptance suite and VoiceOver read it.
    const row = host.all().find(n => n.children.includes(previous))!;
    const after = row.children.slice(row.children.indexOf(previous) + 1).find(c => typeof c !== 'string');
    expect(typeof after !== 'string' && after?.type).toBe('h2');
  });
});

describe('kiro FK-07: Today’s log is called so, and its second view is Measures (journey §13)', () => {
  it('its title, its views, and the name its records’ screens go back to', async () => {
    const saved = await store.addObservation({ kind: 'weight', value: 71.5, unit: 'kg', scope: 'pointInTime', source: 'manual', at: nowAt() });
    expect(saved.ok ? 'saved' : saved.failure.message).toBe('saved');
    host = render(createElement(MyDay, { day: 'today' }));
    await host.settle();
    expect(textOf(host.all().find(n => n.type === 'h1')!.children)).toBe('Today’s log');
    const show = host.all().find(n => n.props.role === 'radiogroup' && n.props['aria-label'] === 'Show')!;
    expect(host.all().filter(n => n.props.role === 'radio' && show.children.includes(n)).map(n => textOf(n.children))).toEqual(['Timeline', 'Measures']);
    // A record's link says where it came from, and its screen's Back says so.
    const from = host.all().filter(n => n.type === 'a' && n.props['data-from'] !== undefined).map(n => n.props['data-from']);
    expect(from.length).toBeGreaterThan(0);
    expect(new Set(from)).toEqual(new Set(['Today’s log']));
  });

  it('a record’s screen opened with no way back named, a bookmark say, goes back to Today’s log by that name', async () => {
    const added = await store.addObservation({ kind: 'weight', value: 71.5, unit: 'kg', scope: 'pointInTime', source: 'manual', at: nowAt() });
    expect(added.ok).toBe(true);
    router.id = added.ok ? added.value.id : '';
    host = render(createElement(ReadingDetail));
    await host.settle();
    expect(host.all().find(n => n.props['data-back'] !== undefined)?.props['data-back']).toBe('Today’s log');
  });
});
