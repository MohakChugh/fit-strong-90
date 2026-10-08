/**
 * Acceptance J17, step 2, through the real caller: Quick Log's glucose and
 * blood-pressure forms over the real store and a fake IndexedDB that refuses
 * the reading's write. A refused save, a reload (a new store over the same
 * database, and the form mounted afresh, as My Day reopens it), the reading
 * recovered as it was typed, and one Save that stores it once.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, type Host, type HostNode } from '@/test/host';

vi.mock('react-router-dom', () => ({ useNavigate: () => () => {}, Link: () => null }));
vi.mock('@/components/hig/Sheet', async () => {
  const { createElement: h } = await import('react');
  return {
    Sheet: ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children?: unknown }) =>
      (open ? h('div', { role: 'dialog' }, h('button', { type: 'button', onClick: () => onOpenChange(false) }, 'Close'), children as never) : null),
  };
});

const memory = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(), key: (i: number) => [...m.keys()][i] ?? null, get length() { return m.size; },
  } as Storage;
};
globalThis.localStorage = memory();
const session = memory();
globalThis.sessionStorage = session;
Object.assign(globalThis, { document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} } });

const store = await import('@/store/useStore');
const { QuickLog } = await import('./QuickLog');
const { DEFAULT_PREFS } = await import('./format');
const { DRAFT_KEY, loadQuickLogDraft, storeQuickLogDraft } = await import('./draft');

const clock = (h: number, m = 0, s = 0) => vi.setSystemTime(new Date(2026, 9, 8, h, m, s));
const local = (h: number, m: number) => `2026-10-08T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

let refuse = false;
let fake: ReturnType<typeof fakeIndexedDB>;
let host: Host | undefined;
const onOpenChange = vi.fn();

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  clock(9);
  session.clear();
  store.resetForTests();
  refuse = false;
  onOpenChange.mockClear();
  fake = fakeIndexedDB({ failWrite: (_name, row) => (refuse && 'kind' in row ? new DOMException('Full', 'QuotaExceededError') : undefined) });
  await store.start({ factory: fake, broadcast: null });
});
afterEach(() => {
  host?.unmount();
  host = undefined;
  vi.useRealTimers();
});

async function open(kind?: 'glucose' | 'bloodPressure') {
  host?.unmount();
  host = render(createElement(QuickLog, { open: true, onOpenChange, ...(kind ? { initial: { kind } } : {}), onSaved: () => {}, prefs: DEFAULT_PREFS }));
  await host.settle();
  return host;
}

/** A reload: the page's memory is gone, the database and the tab's storage are not. */
async function reload() {
  host?.unmount();
  host = undefined;
  store.resetForTests();
  await store.start({ factory: fake, broadcast: null });
}

const inputs = (h: Host, mode: string): HostNode[] => h.all().filter(n => n.type === 'input' && n.props.inputMode === mode);
const timeInputs = (h: Host): HostNode[] => h.all().filter(n => n.type === 'input' && n.props.type === 'datetime-local');
const glucose = () => store.getState().observations.filter(o => o.kind === 'glucose');

describe('J17: a glucose reading the device refused comes back after a reload, and saves once', () => {
  it('keeps the number and the typed time through the reload, then stores one reading at that time', async () => {
    let h = await open('glucose');
    await h.change(inputs(h, 'decimal')[0], { value: '111' });
    await h.click(h.button('Time', { exact: false }));
    await h.change(timeInputs(h)[0], { value: local(8, 50) });
    // Typed, not yet refused: kept, but nothing asks for it to open by itself.
    expect(loadQuickLogDraft(session)).not.toHaveProperty('refused');
    refuse = true;
    await h.click(h.button('Save', { exact: true }));
    expect(h.text()).toMatch(/not enough space/i);
    expect(glucose()).toHaveLength(0);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    // Refused: marked, so My Day opens it again after the reload.
    expect(loadQuickLogDraft(session)).toMatchObject({ raw: '111', time: local(8, 50), refused: true });

    await reload();
    h = await open('glucose');
    expect(inputs(h, 'decimal')[0].props.value).toBe('111');
    expect(timeInputs(h)[0].props.value).toBe(local(8, 50));
    expect(h.text()).toContain('This reading is not saved yet.');

    refuse = false;
    await h.click(h.button('Save', { exact: true }));
    expect(glucose()).toHaveLength(1);
    expect(glucose()[0]).toMatchObject({ value: 111, unit: 'mg/dL', source: 'manual', scope: 'pointInTime' });
    expect(new Date(glucose()[0].at).getHours()).toBe(8);
    expect(new Date(glucose()[0].at).getMinutes()).toBe(50);
    expect(session.getItem(DRAFT_KEY)).toBeNull();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('times a reading left at Now by the first Save, not by the retry minutes later', async () => {
    clock(9, 0, 0);
    let h = await open('glucose');
    await h.change(inputs(h, 'decimal')[0], { value: '140' });
    refuse = true;
    await h.click(h.button('Save', { exact: true }));
    expect(loadQuickLogDraft(session)).toMatchObject({ raw: '140', at: expect.stringMatching(/^2026-10-08T09:00:00/) });

    clock(9, 7, 0);
    await reload();
    h = await open('glucose');
    // The time row stands for the first Save, and says so: not "Now".
    expect(h.text()).toContain('Time 09:00');
    expect(h.text()).not.toContain('Now');
    refuse = false;
    await h.click(h.button('Save', { exact: true }));
    expect(glucose()).toHaveLength(1);
    expect(Date.parse(glucose()[0].at)).toBe(new Date(2026, 9, 8, 9, 0, 0).getTime());
  });

  it('does not bring back a reading that was stored already, so it cannot be stored twice', async () => {
    const h0 = await open('glucose');
    await h0.change(inputs(h0, 'decimal')[0], { value: '120' });
    const before = loadQuickLogDraft(session)!;
    await h0.click(h0.button('Save', { exact: true }));
    expect(glucose()).toHaveLength(1);
    // The save went through, but the page reloaded before the draft was forgotten.
    storeQuickLogDraft(session, before);

    await reload();
    const h = await open('glucose');
    expect(inputs(h, 'decimal')[0].props.value).toBe('');
    expect(session.getItem(DRAFT_KEY)).toBeNull();
    expect(glucose()).toHaveLength(1);
  });

  it('forgets the draft when the form is closed, or left for the list', async () => {
    let h = await open('glucose');
    await h.change(inputs(h, 'decimal')[0], { value: '111' });
    expect(loadQuickLogDraft(session)).toMatchObject({ raw: '111' });
    await h.click(h.button('Close', { exact: true }));
    expect(session.getItem(DRAFT_KEY)).toBeNull();

    h = await open();
    await h.click(h.button('Glucose'));
    await h.change(inputs(h, 'decimal')[0], { value: '112' });
    expect(loadQuickLogDraft(session)).toMatchObject({ raw: '112' });
    await h.click(h.button('All types'));
    expect(session.getItem(DRAFT_KEY)).toBeNull();
  });

  it('forgets a draft whose field is emptied again', async () => {
    const h = await open('glucose');
    await h.change(inputs(h, 'decimal')[0], { value: '111' });
    await h.change(inputs(h, 'decimal')[0], { value: '' });
    expect(session.getItem(DRAFT_KEY)).toBeNull();
  });
});

describe('J17: a dangerous reading refused behind its guidance', () => {
  it('is marked refused at once, though its form is gone, so a reload opens it again', async () => {
    const h = await open('glucose');
    await h.change(inputs(h, 'decimal')[0], { value: '650' });
    refuse = true;
    await h.click(h.button('Save', { exact: true }));
    // The guidance replaced the form before the write settled.
    expect(inputs(h, 'decimal')).toHaveLength(0);
    expect(h.text()).toContain('Not saved');
    expect(loadQuickLogDraft(session)).toMatchObject({ raw: '650', refused: true });
  });
});

describe('J17: a blood-pressure pair the device refused comes back with each reading’s own time', () => {
  it('times a single reading left at Now by the first Save', async () => {
    clock(7, 42, 30);
    let h = await open('bloodPressure');
    await h.change(inputs(h, 'numeric')[0], { value: '130' });
    await h.change(inputs(h, 'numeric')[1], { value: '80' });
    refuse = true;
    await h.click(h.button('Save', { exact: true }));
    clock(7, 50, 0);
    await reload();
    h = await open('bloodPressure');
    refuse = false;
    await h.click(h.button('Save', { exact: true }));
    const sys = store.getState().observations.filter(o => o.kind === 'bloodPressureSystolic');
    expect(sys.map(o => Date.parse(o.at))).toEqual([new Date(2026, 9, 8, 7, 42, 30).getTime()]);
  });

  it('keeps both readings and both moments through the reload, and stores the pair once', async () => {
    clock(7, 42, 30);
    let h = await open('bloodPressure');
    await h.change(inputs(h, 'numeric')[0], { value: '130' });
    await h.change(inputs(h, 'numeric')[1], { value: '80' });
    await h.click(h.button('Add a second reading'));
    clock(7, 43, 40);
    await h.change(inputs(h, 'numeric')[2], { value: '132' });
    await h.change(inputs(h, 'numeric')[3], { value: '82' });
    refuse = true;
    await h.click(h.button('Save', { exact: true }));
    expect(store.getState().observations.filter(o => o.kind === 'bloodPressureSystolic')).toHaveLength(0);

    clock(7, 50, 0);
    await reload();
    h = await open('bloodPressure');
    expect(inputs(h, 'numeric').map(n => n.props.value)).toEqual(['130', '80', '132', '82']);
    expect(h.text()).toContain('This reading is not saved yet.');
    refuse = false;
    await h.click(h.button('Save', { exact: true }));
    const sys = store.getState().observations.filter(o => o.kind === 'bloodPressureSystolic').sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    expect(sys.map(o => o.value)).toEqual([130, 132]);
    expect(sys.map(o => Date.parse(o.at))).toEqual([new Date(2026, 9, 8, 7, 42, 30).getTime(), new Date(2026, 9, 8, 7, 43, 40).getTime()]);
    expect(session.getItem(DRAFT_KEY)).toBeNull();
  });
});
