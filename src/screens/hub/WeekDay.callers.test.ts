/**
 * This week's day row, as drawn (codex H2-04, journey §4.10): every clinical
 * reading with when it was measured and its context; a day of more than two
 * condensed, with a labelled detail that holds each one.
 */
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { render, textOf } from '@/test/host';
import { WeekDay } from './WeekDay';
import type { WeekValue } from './reading';

const day = (readings?: string[]): WeekValue => ({
  day: '2026-10-08', name: 'Thursday', date: 'Thursday, 8 October', entered: true,
  text: readings ? (readings.length > 2 ? `${readings.slice(0, 2).join('; ')}; and ${readings.length - 2} more` : readings.join('; ')) : '78.4 kg',
  ...(readings ? { readings } : {}),
});

describe('This week’s day row', () => {
  it('two readings or fewer: one row, its date, and each reading with its time and context', () => {
    const host = render(createElement(WeekDay, { day: day(['124/78 mmHg at 9:00 am, morning', '122/76 mmHg at 9:01 am, morning']) }));
    expect(host.all().some(n => n.type === 'details')).toBe(false);
    expect(host.text()).toContain('Thursday, 8 October');
    expect(host.text()).toContain('124/78 mmHg at 9:00 am, morning; 122/76 mmHg at 9:01 am, morning');
  });

  it('more than two: the first two and how many more, and a labelled detail holding every reading', () => {
    const all = ['124/78 mmHg at 9:00 am, morning', '122/76 mmHg at 9:01 am, morning', '118/74 mmHg at 9:02 am, evening'];
    const host = render(createElement(WeekDay, { day: day(all) }));
    const summary = host.all().find(n => n.type === 'summary');
    expect(summary && textOf(summary.children)).toMatch(/Thursday, 8 October.*; and 1 more.*All 3 readings/);
    const list = host.all().find(n => n.type === 'ul');
    expect(list?.props['aria-label']).toBe('Every reading on Thursday, 8 October');
    expect(list?.children.map(c => (typeof c === 'string' ? c : textOf(c.children)))).toEqual(all);
  });

  it('a measurement with no readings list is one row', () => {
    const host = render(createElement(WeekDay, { day: day() }));
    expect(host.all().some(n => n.type === 'details')).toBe(false);
    expect(host.text()).toContain('78.4 kg');
  });
});
