/**
 * Acceptance J07, step 3, through the real sheet over the real store: a daily
 * steps goal starts empty, is the person's own number, and a change on a
 * later day keeps the earlier day's goal, so the past is never re-scored.
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
const { StepsGoalSheet } = await import('./GoalSheet');
const { stepsGoalOn } = await import('./stepsGoal');

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  store.resetForTests();
  await store.start({ factory: fakeIndexedDB(), broadcast: null });
});

async function choose(value: string) {
  const onOpenChange = vi.fn();
  const host = render(createElement(StepsGoalSheet, { open: true, onOpenChange, goal: store.getState().settings.dailyStepsGoal }));
  await host.settle();
  const field = host.field('Steps a day');
  const before = field.props.value;
  await host.change(field, { value });
  await host.click(host.button('Save goal'));
  const text = host.text();
  host.unmount();
  return { before, text, closed: onOpenChange.mock.calls.some(([open]) => open === false) };
}

describe('a daily steps goal chosen in the Steps detail (J07)', () => {
  it('starts empty, and a later change keeps the earlier day’s goal', async () => {
    vi.setSystemTime(new Date(2026, 9, 7, 9));
    const first = await choose('2500');
    expect(first.before).toBe('');
    expect(first.closed).toBe(true);

    vi.setSystemTime(new Date(2026, 9, 8, 9));
    const second = await choose('3000');
    expect(second.before).toBe('2500');

    const settings = store.getState().settings;
    expect(settings.dailyStepsGoal).toBe(3000);
    expect(stepsGoalOn(settings, '2026-10-07')).toBe(2500);
    expect(stepsGoalOn(settings, '2026-10-08')).toBe(3000);
    expect(stepsGoalOn(settings, '2026-10-06')).toBeUndefined();
  });

  it('refuses no goal at all as a number, and saves nothing', async () => {
    vi.setSystemTime(new Date(2026, 9, 7, 9));
    const zero = await choose('0');
    expect(zero.closed).toBe(false);
    expect(zero.text).toContain('Enter a goal above zero.');
    expect(store.getState().settings.dailyStepsGoalHistory).toBeUndefined();
  });
});
