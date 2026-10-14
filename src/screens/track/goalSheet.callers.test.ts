/**
 * The weekly goal through the real sheet over the real store (B-16): a first
 * goal counts this week; a change on Thursday waits for Monday, and the sheet
 * says so before it is saved.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render } from '@/test/host';

vi.mock('@/components/hig/Sheet', async () => {
  const { createElement: h } = await import('react');
  return { Sheet: ({ open, children }: { open: boolean; children?: unknown }) => (open ? h('div', { role: 'dialog' }, children as never) : null) };
});

const m = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k),
  clear: () => m.clear(), key: (i: number) => [...m.keys()][i] ?? null, get length() { return m.size; },
} as Storage;
Object.assign(globalThis, { document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} } });

const store = await import('@/store/useStore');
const { GoalSheet } = await import('./GoalSheet');
const { weeklyGoalOn } = await import('./weeklyGoal');

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  store.resetForTests();
  await store.start({ factory: fakeIndexedDB(), broadcast: null });
});

async function save(value: string) {
  const host = render(createElement(GoalSheet, { open: true, onOpenChange: vi.fn(), goal: store.getState().settings.weeklyMovementGoalMinutes }));
  await host.settle();
  const before = host.text();
  await host.change(host.field('Minutes each week'), { value });
  await host.click(host.button('Save goal'));
  host.unmount();
  return before;
}

describe('the weekly goal sheet (B-16)', () => {
  it('a first goal counts this week; a change on Thursday waits for Monday, and the sheet says so first', async () => {
    vi.setSystemTime(new Date(2026, 9, 6, 9));
    const first = await save('150');
    expect(first).not.toContain('This week keeps');
    expect(weeklyGoalOn(store.getState().settings, '2026-10-06')).toBe(150);

    vi.setSystemTime(new Date(2026, 9, 8, 9));
    const second = await save('200');
    expect(second).toContain('A change starts on Monday 12 October. This week keeps its goal of 150 minutes.');
    const settings = store.getState().settings;
    expect(weeklyGoalOn(settings, '2026-10-08')).toBe(150);
    expect(weeklyGoalOn(settings, '2026-10-12')).toBe(200);
    expect(settings.weeklyMovementGoalMinutes).toBe(200);
  });
});
