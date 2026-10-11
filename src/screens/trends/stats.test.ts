import { describe, expect, it } from 'vitest';
import {
  DAYS_PER_MONTH, MIN_DAYS, compareDaily, compareReadings, dailyStats, dayContext, figureOf, intervalText, labHistory,
  readingStats, recordDays, statisticFor, statusList, type DayContext, type DayFigure, type MeterReading, type ReadingPoint,
} from './stats';

// Thursday 8 October 2026; this week is Monday 5 to Sunday 11 October.
const TODAY = '2026-10-08';
const WEEK = { from: '2026-10-05', to: '2026-10-11' };
const LAST = { from: '2026-09-28', to: '2026-10-04' };
const ctx = (over: Partial<DayContext> = {}): DayContext => ({ today: TODAY, since: '2026-09-01', statusOn: () => 'normal', restOn: () => false, ...over });
const fig = (day: string, value: number, basis?: DayFigure['basis']): DayFigure => ({ day, value, ...(basis ? { basis } : {}) });
const awayOn = (...days: string[]) => (day: string) => (days.includes(day) ? 'away' as const : 'normal' as const);
const stated = (days: [string, number][]) =>
  dailyStats({ from: days[0][0], to: days.at(-1)![0] }, days.map(([d, v]) => fig(d, v)), ctx(), 'stated');

describe('the days of the record (early days)', () => {
  it('run from the first record to today, never before it or after today', () => {
    expect(recordDays(WEEK, ctx())).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']);
    expect(recordDays(WEEK, ctx({ since: '2026-10-07' }))).toEqual(['2026-10-07', '2026-10-08']);
    expect(recordDays(LAST, ctx({ since: '2026-10-07' }))).toEqual([]);
    expect(recordDays(WEEK, ctx({ since: undefined }))).toEqual([]);
  });
});

describe('stated measures: steps, water, sleep (B-15, D14)', () => {
  it('average over the days with a figure, not over the week or the days so far', () => {
    const s = dailyStats(WEEK, [fig('2026-10-05', 6000), fig('2026-10-07', 5000)], ctx(), 'stated');
    expect(s).toMatchObject({ sum: 11000, days: 2, perDay: 5500, recordDays: 4, high: { day: '2026-10-05', value: 6000 } });
  });

  it('the highest day is the highest, wherever it falls in the window', () => {
    const s = dailyStats(WEEK, [fig('2026-10-05', 5000), fig('2026-10-07', 6000), fig('2026-10-08', 5500)], ctx(), 'stated');
    expect(s.high).toEqual({ day: '2026-10-07', value: 6000 });
  });

  it('a figure on an Away day is still a day with data, and the day is named', () => {
    const s = dailyStats(WEEK, [fig('2026-10-06', 3000)], ctx({ statusOn: awayOn('2026-10-06') }), 'stated');
    expect(s).toMatchObject({ days: 1, perDay: 3000, status: { away: 1 } });
  });

  it('counts the days whose figure is a lower bound', () => {
    const s = dailyStats(WEEK, [fig('2026-10-05', 7300, 'atLeast'), fig('2026-10-06', 4210, 'walks'), fig('2026-10-07', 5000, 'entered')], ctx(), 'stated');
    expect(s.partialDays).toBe(2);
  });
});

describe('counted measures: recorded movement (B-15, D25, K-49)', () => {
  it('a day of the record with nothing in it is a 0, and a day of data', () => {
    expect(dailyStats(WEEK, [fig('2026-10-05', 30)], ctx(), 'counted')).toMatchObject({ sum: 30, days: 4, perDay: 7.5 });
  });

  it('a status day is no day of data: its minutes stay in the total and out of the average (D88, KT-03)', () => {
    const s = dailyStats(WEEK, [fig('2026-10-05', 30), fig('2026-10-06', 10)], ctx({ statusOn: awayOn('2026-10-06', '2026-10-07') }), 'counted');
    // 30 over Monday and Thursday, never 40 over them.
    expect(s).toMatchObject({ sum: 40, days: 2, perDay: 15, status: { away: 2 }, outside: 10, restDays: 0 });
    expect(figureOf(s, 'total')).toBe(40);
  });

  it('a planned rest day with nothing recorded is no day of data; one with movement in it is (D88, KT-08)', () => {
    const rest = (day: string) => day === '2026-10-06' || day === '2026-10-07';
    // Monday 30; Tuesday a rest day, empty; Wednesday a rest day with 20; Thursday nothing: 3 days of data.
    const s = dailyStats(WEEK, [fig('2026-10-05', 30), fig('2026-10-07', 20)], ctx({ restOn: rest }), 'counted');
    expect(s).toMatchObject({ sum: 50, days: 3, restDays: 1, outside: 0 });
    expect(s.perDay).toBeCloseTo(50 / 3, 9);
    // A stated measure has no rest days: a day with a figure is a day of data.
    expect(dailyStats(WEEK, [fig('2026-10-06', 6000)], ctx({ restOn: rest }), 'stated')).toMatchObject({ days: 1, perDay: 6000, restDays: 0 });
  });

  it('days before the first record are not zeros (Review Focus 4)', () => {
    const s = dailyStats(LAST, [], ctx({ since: '2026-10-07' }), 'counted');
    expect(s).toMatchObject({ sum: 0, days: 0, recordDays: 0 });
    expect(s.perDay).toBeUndefined();
  });
});

describe('the statistic each period states (B-15)', () => {
  it('counted: a total for Week and Month, a week on average for 6 Months, a month on average for Year; stated: a day on average', () => {
    expect(statisticFor('counted', 'week')).toBe('total');
    expect(statisticFor('counted', 'month')).toBe('total');
    expect(statisticFor('counted', 'sixMonths')).toBe('perWeek');
    expect(statisticFor('counted', 'year')).toBe('perMonth');
    expect(statisticFor('stated', 'week')).toBe('perDay');
    expect(statisticFor('stated', 'year')).toBe('perDay');
  });

  it('weights by the days of data', () => {
    const s = dailyStats(WEEK, [fig('2026-10-05', 30)], ctx(), 'counted');
    expect(figureOf(s, 'total')).toBe(30);
    expect(figureOf(s, 'perDay')).toBe(7.5);
    expect(figureOf(s, 'perWeek')).toBe(52.5);
    expect(figureOf(s, 'perMonth')).toBeCloseTo(7.5 * DAYS_PER_MONTH, 9);
    // An average month: a year's days over 12 (D68's 30.44), so February and March weigh the same.
    expect(DAYS_PER_MONTH).toBe(30.4375);
  });

  it('a total exists for any window of the record, even an Away week with a walk in it; nothing before the record', () => {
    const away = dailyStats(WEEK, [fig('2026-10-06', 15)], ctx({ statusOn: () => 'away' }), 'counted');
    expect(figureOf(away, 'total')).toBe(15);
    expect(figureOf(away, 'perDay')).toBeUndefined();
    expect(figureOf(dailyStats(LAST, [], ctx({ since: '2026-10-07' }), 'counted'), 'total')).toBeUndefined();
  });
});

describe('daily comparisons (A-41, A-42)', () => {
  const cur = stated([['2026-10-05', 6000], ['2026-10-06', 7000], ['2026-10-07', 5500]]);
  const prev = stated([['2026-09-28', 5000], ['2026-09-29', 6000], ['2026-09-30', 5800], ['2026-10-01', 6200]]);

  it('need 3 days of data in both windows', () => {
    expect(MIN_DAYS).toBe(3);
    const two = stated([['2026-10-05', 6000], ['2026-10-06', 7000]]);
    expect(compareDaily(two, prev, 'perDay', 0)).toEqual({ shown: false, reason: 'fewDays' });
    expect(compareDaily(prev, two, 'perDay', 0)).toEqual({ shown: false, reason: 'fewDays' });
  });

  it('say higher or lower by the difference as shown', () => {
    expect(compareDaily(cur, prev, 'perDay', 0)).toEqual({ shown: true, direction: 'higher', difference: 417 });
    expect(compareDaily(prev, cur, 'perDay', 0)).toEqual({ shown: true, direction: 'lower', difference: 417 });
  });

  it('say the same when the figures shown are the same', () => {
    const a = stated([['2026-10-05', 5750.4], ['2026-10-06', 5750.4], ['2026-10-07', 5750.4]]);
    const b = stated([['2026-09-28', 5749.6], ['2026-09-29', 5749.6], ['2026-09-30', 5749.6]]);
    expect(compareDaily(a, b, 'perDay', 0)).toEqual({ shown: true, direction: 'same', difference: 0 });
  });
});

const read = (id: string, day: string, value: number, extra: Partial<ReadingPoint> = {}): ReadingPoint =>
  ({ id, day, at: `${day}T08:00:00+05:30`, value, series: 'beforeMeal', ...extra });
const meter = (day: string, display: 'HI' | 'LO'): MeterReading => ({ day, display });

describe('readings: spread, HI and LO, status days (A-43, A-44, K-11)', () => {
  it('state n, mean, range and the days with a number', () => {
    const s = readingStats(WEEK, [read('a', '2026-10-05', 118), read('b', '2026-10-06', 124), read('c', '2026-10-06', 168), read('d', '2026-09-30', 300)], [], ctx());
    expect(s).toMatchObject({ n: 3, min: 118, max: 168, days: 2, hi: 0, lo: 0 });
    expect(s.mean).toBeCloseTo(136.667, 3);
  });

  it('never average a meter’s HI or LO, and count them with the lows and highs', () => {
    const s = readingStats(WEEK, [read('a', '2026-10-05', 62, { low: true }), read('b', '2026-10-06', 280, { high: true })], [meter('2026-10-07', 'LO'), meter('2026-10-07', 'HI')], ctx());
    expect(s).toMatchObject({ n: 2, mean: 171, lows: 2, highs: 2, hi: 1, lo: 1, days: 2 });
    // A meter's display on a day outside the range belongs to that day's window.
    expect(readingStats(WEEK, [], [meter('2026-10-02', 'LO'), meter('2026-10-12', 'HI')], ctx())).toMatchObject({ hi: 0, lo: 0, lows: 0, highs: 0 });
  });

  it('a week with only a meter’s LO: no mean, no 0, no NaN, and no change (Review Focus 3)', () => {
    const s = readingStats(WEEK, [], [meter('2026-10-05', 'LO'), meter('2026-10-06', 'LO')], ctx());
    expect(s).toMatchObject({ n: 0, days: 0, lo: 2, lows: 2 });
    expect(s.mean).toBeUndefined();
    expect(JSON.stringify(s)).not.toMatch(/NaN|null/);
    const before = readingStats(LAST, [read('x', '2026-09-28', 120)], [], ctx());
    expect(compareReadings(s, before, 0)).toEqual({ shown: false, reason: 'meterLo' });
  });

  it('name the status days readings fell on, and leave none of them out', () => {
    const s = readingStats(WEEK, [read('a', '2026-10-05', 118), read('b', '2026-10-06', 124)], [], ctx({ statusOn: d => (d === '2026-10-06' ? 'unwell' : 'normal') }));
    expect(s).toMatchObject({ n: 2, status: { unwell: 1 } });
  });

  it('compare means with 3 days in both, hidden by a LO anywhere in either period', () => {
    const cur = readingStats(WEEK, [read('a', '2026-10-05', 118), read('b', '2026-10-06', 124), read('c', '2026-10-07', 112)], [], ctx());
    const prev = readingStats(LAST, [read('d', '2026-09-28', 120), read('e', '2026-09-29', 118), read('f', '2026-09-30', 122)], [], ctx());
    expect(compareReadings(cur, prev, 0)).toEqual({ shown: true, direction: 'lower', difference: 2 });
    expect(compareReadings(cur, prev, 0, 1)).toEqual({ shown: false, reason: 'meterLo' });
    // A LO in the period before hides it too.
    const prevLo = readingStats(LAST, [read('d', '2026-09-28', 120), read('e', '2026-09-29', 118), read('f', '2026-09-30', 122)], [meter('2026-09-29', 'LO')], ctx());
    expect(compareReadings(cur, prevLo, 0)).toEqual({ shown: false, reason: 'meterLo' });
    const oneDay = readingStats(WEEK, [read('a', '2026-10-05', 118), read('b', '2026-10-05', 124)], [], ctx());
    expect(compareReadings(oneDay, prev, 0)).toEqual({ shown: false, reason: 'fewDays' });
  });
});

describe('labs: dated results with their intervals (A-45)', () => {
  it('list every result oldest first, each with how long after the one before', () => {
    const rows = labHistory([
      { id: 'c', day: '2026-10-07', value: 6.9, unit: '%' },
      { id: 'a', day: '2026-03-02', value: 7.4, unit: '%' },
      { id: 'b', day: '2026-06-02', value: 7.1, unit: '%' },
    ]);
    expect(rows.map(r => [r.day, r.interval])).toEqual([
      ['2026-03-02', 'First result'], ['2026-06-02', '3 months after the one before'], ['2026-10-07', '4 months after the one before'],
    ]);
  });

  it('say days under two months, and the same day', () => {
    expect(intervalText(undefined)).toBe('First result');
    expect(intervalText(0)).toBe('The same day as the one before');
    expect(intervalText(1)).toBe('1 day after the one before');
    expect(intervalText(12)).toBe('12 days after the one before');
  });
});

describe('the words for status days, and the day context', () => {
  it('name status days in a fixed order', () => {
    expect(statusList({ unwell: 2, away: 1 })).toBe('2 Unwell days and 1 Away day');
    expect(statusList({ flare: 1 })).toBe('1 Flare-up day');
    expect(statusList({ flare: 1, unwell: 1, away: 3 })).toBe('1 Flare-up day, 1 Unwell day and 3 Away days');
    expect(statusList({})).toBeUndefined();
  });

  it('marks planned rest days only for someone in the programme, from its start', () => {
    const c = dayContext({
      today: TODAY, since: '2026-09-01', restDays: ['tuesday', 'wednesday'], startDate: '2026-09-24',
      statusPeriods: [{ kind: 'away', from: '2026-10-07', to: '2026-10-07' }],
    });
    expect(c.restOn('2026-10-06')).toBe(true);    // a Tuesday
    expect(c.restOn('2026-10-05')).toBe(false);   // a Monday
    expect(c.restOn('2026-09-22')).toBe(false);   // a Tuesday before the start
    expect(c.statusOn('2026-10-07')).toBe('away');
    expect(dayContext({ today: TODAY, restDays: [], startDate: '' }).restOn('2026-10-06')).toBe(false);
    // Without a start there is no programme to plan a rest in.
    expect(dayContext({ today: TODAY, restDays: ['tuesday'], startDate: '' }).restOn('2026-10-06')).toBe(false);
  });
});
