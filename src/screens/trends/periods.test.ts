import { describe, expect, it } from 'vitest';
import { addDays } from '@/screens/track/periods';
import {
  comparedText, compareRanges, isTrendPeriod, monthEnd, monthStart, nextWindow, pagerLabels, previousName, previousWindow,
  rangeText, windowOf, windowTitle,
} from './periods';

// Thursday 8 October 2026.
const TODAY = '2026-10-08';

describe('trend windows (journey §12.2)', () => {
  it('Week: Monday to Sunday, a bucket a day', () => {
    const w = windowOf('week', TODAY);
    expect([w.from, w.to]).toEqual(['2026-10-05', '2026-10-11']);
    expect(w.buckets).toHaveLength(7);
    expect(w.buckets[0]).toEqual({ from: '2026-10-05', to: '2026-10-05' });
  });

  it('Month: the calendar month, a bucket a day, leap Februaries included', () => {
    const w = windowOf('month', TODAY);
    expect([w.from, w.to, w.buckets.length]).toEqual(['2026-10-01', '2026-10-31', 31]);
    expect(windowOf('month', '2028-02-10').buckets).toHaveLength(29);
    expect(windowOf('month', '2026-02-10').buckets).toHaveLength(28);
  });

  it('6 Months: the last 6 calendar months, in Monday–Sunday weeks cut to the window', () => {
    const w = windowOf('sixMonths', TODAY);
    expect([w.from, w.to]).toEqual(['2026-05-01', '2026-10-31']);
    // 1 May 2026 is a Friday: the first week is cut to Friday–Sunday.
    expect(w.buckets[0]).toEqual({ from: '2026-05-01', to: '2026-05-03' });
    expect(w.buckets[1]).toEqual({ from: '2026-05-04', to: '2026-05-10' });
    expect(w.buckets.at(-1)).toEqual({ from: '2026-10-26', to: '2026-10-31' });
    expect(w.buckets).toHaveLength(27);
    expect(w.buckets.every((b, i) => i === 0 || b.from === addDays(w.buckets[i - 1].to, 1))).toBe(true);
  });

  it('Year: the last 12 calendar months, a bucket a month, across the year end (Review Focus 5)', () => {
    const w = windowOf('year', TODAY);
    expect([w.from, w.to, w.buckets.length]).toEqual(['2025-11-01', '2026-10-31', 12]);
    expect(w.buckets[1]).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    expect(w.buckets[3]).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });

  it('pages to the window before and after', () => {
    expect(previousWindow(windowOf('week', TODAY)).from).toBe('2026-09-28');
    expect(previousWindow(windowOf('month', '2026-03-31'))).toMatchObject({ from: '2026-02-01', to: '2026-02-28' });
    expect(previousWindow(windowOf('sixMonths', TODAY))).toMatchObject({ from: '2025-11-01', to: '2026-04-30' });
    expect(previousWindow(windowOf('year', TODAY))).toMatchObject({ from: '2024-11-01', to: '2025-10-31' });
    expect(nextWindow(windowOf('week', '2026-09-30')).from).toBe('2026-10-05');
  });

  it('moves months across the year end', () => {
    expect(monthStart('2026-01-15', -1)).toBe('2025-12-01');
    expect(monthEnd('2026-01-15', 1)).toBe('2026-02-28');
    expect(monthEnd('2028-02-01')).toBe('2028-02-29');
  });
});

describe('like-for-like comparisons (A-42, B-15)', () => {
  it('an unfinished week against the same days of last week', () => {
    expect(compareRanges(windowOf('week', TODAY), TODAY)).toEqual({
      current: { from: '2026-10-05', to: '2026-10-08' }, previous: { from: '2026-09-28', to: '2026-10-01' }, partial: true,
    });
  });

  it('a finished week against the whole week before', () => {
    expect(compareRanges(windowOf('week', '2026-09-30'), TODAY)).toEqual({
      current: { from: '2026-09-28', to: '2026-10-04' }, previous: { from: '2026-09-21', to: '2026-09-27' }, partial: false,
    });
  });

  it('30 March against February: the same days, cut to the shorter month (Review Focus 5)', () => {
    expect(compareRanges(windowOf('month', '2026-03-30'), '2026-03-30')?.previous).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(compareRanges(windowOf('month', '2028-03-30'), '2028-03-30')?.previous).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(compareRanges(windowOf('month', '2026-03-08'), '2026-03-08')?.previous).toEqual({ from: '2026-02-01', to: '2026-02-08' });
  });

  it('6 Months counts the same number of days from the start of the window before', () => {
    // 1 May to 8 October is 160 days on from the start; 160 days on from 1 November is 10 April.
    expect(compareRanges(windowOf('sixMonths', TODAY), TODAY)).toEqual({
      current: { from: '2026-05-01', to: '2026-10-08' }, previous: { from: '2025-11-01', to: '2026-04-10' }, partial: true,
    });
  });

  it('on its last day a window is compared whole, as a finished one', () => {
    const sunday = windowOf('week', '2026-10-11');
    const r = compareRanges(sunday, '2026-10-11');
    expect(r).toEqual({ current: { from: '2026-10-05', to: '2026-10-11' }, previous: { from: '2026-09-28', to: '2026-10-04' }, partial: false });
    expect(comparedText(sunday, r!, '2026-10-11')).toBe('5–11 Oct vs 28 Sep – 4 Oct');
  });

  it('nothing to compare for a window that has not started', () => {
    expect(compareRanges(windowOf('week', '2026-10-12'), TODAY)).toBeUndefined();
  });
});

describe('the words for windows', () => {
  it('this week, last week, and other weeks by their dates, with the year only when it isn’t this one', () => {
    expect(windowTitle(windowOf('week', TODAY), TODAY)).toBe('This week');
    expect(windowTitle(windowOf('week', '2026-09-30'), TODAY)).toBe('Last week');
    expect(windowTitle(windowOf('week', '2026-09-23'), TODAY)).toBe('21–27 Sep');
    expect(windowTitle(windowOf('week', '2025-12-31'), TODAY)).toBe('29 Dec 2025 – 4 Jan 2026');
  });

  it('months and the longer windows', () => {
    expect(windowTitle(windowOf('month', TODAY), TODAY)).toBe('This month');
    expect(windowTitle(windowOf('month', '2026-09-10'), TODAY)).toBe('September');
    expect(windowTitle(windowOf('month', '2025-09-10'), TODAY)).toBe('September 2025');
    expect(windowTitle(windowOf('sixMonths', TODAY), TODAY)).toBe('May – Oct 2026');
    expect(windowTitle(windowOf('year', TODAY), TODAY)).toBe('Nov 2025 – Oct 2026');
  });

  it('ranges of days', () => {
    expect(rangeText({ from: '2026-10-05', to: '2026-10-11' }, TODAY)).toBe('5–11 Oct');
    expect(rangeText({ from: '2026-09-28', to: '2026-10-04' }, TODAY)).toBe('28 Sep – 4 Oct');
    expect(rangeText({ from: '2026-10-05', to: '2026-10-05' }, TODAY)).toBe('5 Oct');
    expect(rangeText({ from: '2025-09-28', to: '2025-10-04' }, TODAY)).toBe('28 Sep – 4 Oct 2025');
  });

  it('the pager says where it goes, in words (B-08)', () => {
    expect(pagerLabels('week')).toEqual({ previous: 'Previous week', next: 'Next week' });
    expect(pagerLabels('month')).toEqual({ previous: 'Previous month', next: 'Next month' });
    expect(pagerLabels('sixMonths')).toEqual({ previous: 'Previous 6 months', next: 'Next 6 months' });
    expect(pagerLabels('year')).toEqual({ previous: 'Previous year', next: 'Next year' });
  });

  it('which days were compared', () => {
    const w = windowOf('week', TODAY);
    expect(comparedText(w, compareRanges(w, TODAY)!, TODAY)).toBe('Mon–Thu vs last Mon–Thu');
    const monday = windowOf('week', '2026-10-05');
    expect(comparedText(monday, compareRanges(monday, '2026-10-05')!, '2026-10-05')).toBe('Monday vs last Monday');
    const month = windowOf('month', TODAY);
    expect(comparedText(month, compareRanges(month, TODAY)!, TODAY)).toBe('1–8 Oct vs 1–8 Sep');
    const past = windowOf('week', '2026-09-30');
    expect(comparedText(past, compareRanges(past, TODAY)!, TODAY)).toBe('28 Sep – 4 Oct vs 21–27 Sep');
  });

  it('the window a change is measured against', () => {
    expect(previousName(windowOf('week', TODAY), TODAY)).toBe('last week');
    expect(previousName(windowOf('week', '2026-09-30'), TODAY)).toBe('the week before');
    expect(previousName(windowOf('month', TODAY), TODAY)).toBe('last month');
    expect(previousName(windowOf('month', '2026-09-10'), TODAY)).toBe('the month before');
    expect(previousName(windowOf('sixMonths', TODAY), TODAY)).toBe('the 6 months before');
    expect(previousName(windowOf('year', TODAY), TODAY)).toBe('the 12 months before');
  });

  it('knows its own period ids, and nothing else', () => {
    expect(isTrendPeriod('sixMonths')).toBe(true);
    expect(isTrendPeriod('quarter')).toBe(false);
    expect(isTrendPeriod(undefined)).toBe(false);
  });
});
