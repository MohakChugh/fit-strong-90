/**
 * Edit Home's writes, driven through the real editor and the real store over
 * a fake IndexedDB that can refuse a settings write (codex V1-11, V1-12;
 * journey §4.5: "Saved" appears, and a form closes, only after the write is
 * confirmed). Undo toasts are recorded, not drawn.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, useEffect } from 'react';
import type { HomeLayout } from '@/types';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, type Host } from '@/test/host';

const toasts = vi.hoisted(() => {
  const shown = new Map<string, { title: string; undo: (event: { preventDefault(): void }) => void }>();
  const toast = Object.assign(
    (title: string, opts: { id: string; action: { onClick: (event: { preventDefault(): void }) => void } }) => { shown.set(opts.id, { title, undo: opts.action.onClick }); },
    { dismiss: (id: string) => void shown.delete(id) },
  );
  return { shown, toast };
});
vi.mock('sonner', () => ({ toast: toasts.toast }));

const local = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
    removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: () => null, get length() { return local.size; },
  },
  window: Object.assign(globalThis.window ?? {}, { matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) }),
  document: { querySelector: () => null, activeElement: null },
  requestAnimationFrame: (f: () => void) => setTimeout(f, 0),
});

const store = await import('@/store/useStore');
const { useFirstLayout, useHomeEditor } = await import('./editor');

const L: HomeLayout = { order: { move: ['workout', 'stretch', 'walk'], eat: ['food'], check: ['weight', 'sleep'], learn: ['learn'] }, hidden: [] };
let refuse = false;
let host: Host | undefined;

beforeEach(async () => {
  local.clear();
  toasts.shown.clear();
  refuse = false;
  store.resetForTests();
  const fake = fakeIndexedDB({ failWrite: (_store, row) => (refuse && row.key === 'settings' ? new DOMException('Full', 'QuotaExceededError') : undefined) });
  await store.start({ factory: fake, broadcast: null });
});
afterEach(() => {
  host?.unmount();
  host = undefined;
});

const homeNow = () => store.getState().settings.home;
const drawn = { editor: undefined as ReturnType<typeof useHomeEditor> | undefined };
function Editor() {
  const e = useHomeEditor({ fallback: L, still: false, urgent: false });
  useEffect(() => { drawn.editor = e; });
  return null;
}
const editor = () => drawn.editor!;
async function open() {
  await store.setSettings({ home: L });
  host = render(createElement(Editor));
  await host.settle();
  editor().start();
  await host.settle();
}
const settle = () => host!.settle(10);

describe('Edit Home says a change only once it is stored (codex V1-11)', () => {
  it('a refused Hide offers no Undo and keeps the change as a draft, with Try again; Try again stores it and offers Undo', async () => {
    await open();
    refuse = true;
    editor().hide('stretch', 'edit');
    await settle();
    expect(toasts.shown.size).toBe(0);
    expect(homeNow()?.order.move).toContain('stretch');
    expect(editor().draft?.order.move).toEqual(['workout', 'walk']);
    expect(editor().failed).toMatch(/./);
    refuse = false;
    editor().retry();
    await settle();
    expect(homeNow()?.order.move).toEqual(['workout', 'walk']);
    expect(editor().draft).toBeUndefined();
    expect(editor().failed).toBeUndefined();
    expect([...toasts.shown.values()].map(t => t.title)).toEqual(['Stretch hidden from Home']);
  });

  it('a refused move is not announced until Try again has stored it', async () => {
    await open();
    refuse = true;
    editor().move('walk', -1, 'up');
    await settle();
    expect(editor().said.text).toBe('');
    refuse = false;
    editor().retry();
    await settle();
    expect(editor().said.text).toMatch(/^Walk moved to position 2 of 3/);
  });

  it('Done ends editing only once every change is stored, and not after a refusal', async () => {
    await open();
    refuse = true;
    editor().move('walk', -1, 'up');
    editor().done();
    await settle();
    expect(editor().editing).toBe(true);
    refuse = false;
    editor().retry();
    await settle();
    editor().done();
    await settle();
    expect(editor().editing).toBe(false);
  });

  it('an Undo stays until the restore is stored', async () => {
    await open();
    editor().hide('stretch', 'edit');
    await settle();
    const [key] = [...toasts.shown.keys()];
    refuse = true;
    let prevented = false;
    toasts.shown.get(key)!.undo({ preventDefault() { prevented = true; } });
    await settle();
    expect(prevented).toBe(true);
    expect(toasts.shown.has(key)).toBe(true);
    expect(homeNow()?.order.move).toEqual(['workout', 'walk']);
    refuse = false;
    toasts.shown.get(key)!.undo({ preventDefault() {} });
    await settle();
    expect(homeNow()?.order.move).toEqual(['workout', 'stretch', 'walk']);
    expect(toasts.shown.has(key)).toBe(false);
  });
});

describe('quick changes after a refused one build on each other (codex W-03)', () => {
  it('Hide Stretch is refused; storage comes back; Hide Walk and Hide Workout at once: all three stay hidden, and Walk is not brought back', async () => {
    await open();
    refuse = true;
    editor().hide('stretch', 'edit');
    await settle();
    expect(editor().failed).toMatch(/./);
    refuse = false;
    // Both before either write has settled.
    editor().hide('walk', 'edit');
    editor().hide('workout', 'edit');
    await settle();
    expect(homeNow()?.order.move).toEqual([]);
    expect(homeNow()?.hidden).toEqual(expect.arrayContaining(['stretch', 'walk', 'workout']));
    expect(editor().draft).toBeUndefined();
    expect(editor().failed).toBeUndefined();
    // Each toast says what is stored.
    expect([...toasts.shown.values()].map(t => t.title)).toEqual(['Walk hidden from Home', 'Workout hidden from Home']);
    editor().done();
    await settle();
    expect(editor().editing).toBe(false);
  });

  it('a change made while a refused one waits, refused too, keeps both; Try again stores both', async () => {
    await open();
    refuse = true;
    editor().hide('stretch', 'edit');
    await settle();
    editor().move('walk', -1, 'up');
    await settle();
    expect(editor().draft?.order.move).toEqual(['walk', 'workout']);
    refuse = false;
    editor().retry();
    await settle();
    expect(homeNow()?.order.move).toEqual(['walk', 'workout']);
    expect(homeNow()?.hidden).toContain('stretch');
    expect(editor().draft).toBeUndefined();
  });

  it('changes queued behind a write still on its way compose from it, and the last one stored is all of them', async () => {
    await open();
    editor().hide('stretch', 'edit');
    editor().move('walk', -1, 'up');
    editor().hide('workout', 'edit');
    await settle();
    expect(homeNow()?.order.move).toEqual(['walk']);
    expect(homeNow()?.hidden).toEqual(expect.arrayContaining(['stretch', 'workout']));
  });
});

describe('Home’s first layout is kept, and stored once (codex V1-12, journey §5.1)', () => {
  const other: HomeLayout = { ...L, order: { ...L.order, check: ['glucose', 'weight', 'sleep'] } };
  const seen = { layout: undefined as HomeLayout | undefined, first: undefined as ReturnType<typeof useFirstLayout> | undefined };
  function First({ fallback, visit }: { fallback: HomeLayout; visit: number }) {
    const first = useFirstLayout({ stored: homeNow(), fallback, ready: true, visit });
    useEffect(() => { seen.layout = first.layout; seen.first = first; });
    return null;
  }

  it('a refused first write is tried again on the next visit, and the layout drawn meanwhile stays the first', async () => {
    refuse = true;
    host = render(createElement(First, { fallback: L, visit: 0 }));
    await settle();
    expect(homeNow()).toBeUndefined();
    // Later answers would give another layout: the first stays.
    host.update(createElement(First, { fallback: other, visit: 0 }));
    await settle();
    expect(seen.layout).toEqual(L);
    expect(homeNow()).toBeUndefined();
    refuse = false;
    host.update(createElement(First, { fallback: other, visit: 1 }));
    await settle();
    expect(homeNow()).toEqual(L);
  });

  it('never over a layout the person stored meanwhile', async () => {
    refuse = true;
    host = render(createElement(First, { fallback: L, visit: 0 }));
    await settle();
    refuse = false;
    await store.setSettings({ home: other });
    host.update(createElement(First, { fallback: L, visit: 1 }));
    await settle();
    expect(homeNow()).toEqual(other);
  });

  it('a refused first write says so while the person stays, and Try again stores it then (codex V1-12)', async () => {
    refuse = true;
    host = render(createElement(First, { fallback: L, visit: 0 }));
    await settle();
    expect(homeNow()).toBeUndefined();
    expect(seen.first?.failed).toMatch(/./);
    // Tried again while still refused: still said, still the first layout.
    seen.first!.retry();
    await settle();
    expect(seen.first?.failed).toMatch(/./);
    expect(seen.layout).toEqual(L);
    refuse = false;
    seen.first!.retry();
    await settle();
    expect(homeNow()).toEqual(L);
    expect(seen.first?.failed).toBeUndefined();
  });

  it('Try again never writes over a layout stored meanwhile, and has nothing more to say once one is', async () => {
    refuse = true;
    host = render(createElement(First, { fallback: L, visit: 0 }));
    await settle();
    refuse = false;
    await store.setSettings({ home: other });
    host.update(createElement(First, { fallback: L, visit: 0 }));
    await settle();
    expect(seen.first?.failed).toBeUndefined();
    seen.first!.retry();
    await settle();
    expect(homeNow()).toEqual(other);
  });
});
