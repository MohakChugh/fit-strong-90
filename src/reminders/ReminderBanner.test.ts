/**
 * Where the after-meal walk reminder leads (D26; scan J2-07), through the real
 * banner. The router's Link stands in as a plain anchor, and the store is not
 * needed: nothing here is saved.
 */

import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import type { Meal } from '@/types/habits';
import { render } from '@/test/host';
import { mealFromSearch } from '@/walk/plan';

vi.mock('react-router-dom', async () => {
  const { createElement: h } = await import('react');
  return { Link: ({ to, children, ...rest }: { to: string; children?: unknown }) => h('a', { ...rest, href: to }, children as never) };
});
vi.mock('@/store/useStore', () => ({ addToDayTotal: () => Promise.resolve({ ok: true }) }));

const { ReminderBanner } = await import('./ReminderBanner');

/** The banner's link for a walk reminder after `meal`. */
function linkFor(meal?: Meal): string {
  const occurrence = { habit: 'mealWalk' as const, minute: 13 * 60 + 30, day: '2026-10-08', id: `mealWalk:${meal ?? ''}@2026-10-08T13:30`, ...(meal ? { meal } : {}) };
  const host = render(createElement(ReminderBanner, { item: { occurrence, shownAt: 0 }, variant: 'inline' }));
  const links = host.all().filter(n => n.type === 'a');
  host.unmount();
  expect(links).toHaveLength(1);
  return String(links[0].props.href);
}

describe('the after-meal walk reminder', () => {
  it('opens Walk on "After a meal" with its own meal chosen', () => {
    for (const meal of ['breakfast', 'lunch', 'dinner'] as const) {
      const href = linkFor(meal);
      const url = new URL(href, 'https://app.test');
      expect(url.pathname).toBe('/hub/walk');
      expect(mealFromSearch(url.searchParams)).toBe(meal);
    }
  });

  it('opens an ordinary walk for a reminder that names no meal', () => {
    expect(linkFor()).toBe('/hub/walk');
  });
});

describe('the reminder’s answers (journey §20.4 rules 1 and 7, kiro KV-10)', () => {
  it('are 48 px targets that wrap under each other rather than run off a narrow screen at large text', () => {
    const occurrence = { habit: 'water' as const, minute: 9 * 60, day: '2026-10-08', id: 'water@2026-10-08T09:00' };
    const host = render(createElement(ReminderBanner, { item: { occurrence, shownAt: 0 }, variant: 'inline', glassMl: 250 }));
    const buttons = host.all().filter(n => n.type === 'button');
    const row = host.all().find(n => n.type === 'div' && n.children.some(c => typeof c !== 'string' && c.type === 'button'));
    host.unmount();
    expect(buttons).toHaveLength(2);
    expect(buttons.every(b => /\bmin-h-12\b/.test(String(b.props.className)))).toBe(true);
    expect(String(row?.props.className)).toMatch(/\bflex-wrap\b/);
  });
});

describe('the food prompt (journey §7.4; board D103)', () => {
  it('asks gently, and opens “Log a meal” on its own meal', () => {
    const occurrence = { habit: 'foodLog' as const, meal: 'lunch' as const, minute: 14 * 60 + 30, day: '2026-10-08', id: 'foodLog:lunch@2026-10-08T14:30' };
    const host = render(createElement(ReminderBanner, { item: { occurrence, shownAt: 0 }, variant: 'inline' }));
    const links = host.all().filter(n => n.type === 'a');
    const text = host.text();
    host.unmount();
    expect(links.map(l => String(l.props.href))).toEqual(['/hub/food/log?meal=lunch']);
    expect(text).toContain('Add lunch to Food?');
    expect(text).toContain('Only if you’d like to. It takes a few taps.');
    expect(text).toContain('Log lunch');
  });
});
