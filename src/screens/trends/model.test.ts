import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { WorkoutSession } from '@/types';
import type { CheckInRecord } from '@/types/checkin';
import { bpContext, newObservation, type Observation } from '@/health/observation';
import { weekdayOf } from '@/health/status';
import { DEFAULT_PREFS } from '@/screens/track/format';
import { TRENDS } from './metrics';
import { dailyView, labsView, readingCount, readingsView, trendContext, trendRow } from './model';
import { windowOf } from './periods';
import type { DayContext } from './stats';

// A meter's display is placed on this device's clock (`nowAt`), so the zone is pinned.
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const zone = env.TZ;
beforeAll(() => { env.TZ = 'Asia/Kolkata'; });
afterAll(() => { if (zone === undefined) delete env.TZ; else env.TZ = zone; });

// Thursday 8 October 2026.
const TODAY = '2026-10-08';
const prefs = { ...DEFAULT_PREFS, hour12: true };
const data = (observations: Observation[], sessions: WorkoutSession[] = [], checkIns: CheckInRecord[] = []) => ({ observations, sessions, checkIns });
const ctx = (over: Partial<DayContext> = {}): DayContext => ({ today: TODAY, since: '2026-09-28', statusOn: () => 'normal', restOn: () => false, ...over });
const steps = (day: string, value: number, time = '20:00') =>
  newObservation({ kind: 'steps', value, at: `${day}T${time}:00.000+05:30`, scope: 'dayTotal', source: 'manual' });
const walk = (id: string, day: string, minutes: number, { time = '18:00', count }: { time?: string; count?: number } = {}) => {
  const at = `${day}T${time}:00.000+05:30`;
  const common = { at, scope: 'sessionObserved' as const, source: 'measured' as const, coverageMs: minutes * 60_000, context: `walk:${id}` };
  return [
    newObservation({ ...common, kind: 'walkDuration', value: minutes }),
    ...(count === undefined ? [] : [newObservation({ ...common, kind: 'steps', value: count })]),
  ];
};

// V-J07's fortnight: a total entered at 8 pm each evening from 28 September to 7 October.
const STEPS: [string, number][] = [
  ['2026-09-28', 5000], ['2026-09-29', 6000], ['2026-09-30', 5800], ['2026-10-01', 6200], ['2026-10-02', 4000], ['2026-10-03', 8000], ['2026-10-04', 3500],
  ['2026-10-05', 6000], ['2026-10-06', 7000], ['2026-10-07', 5500],
];

describe('a stated measure’s week: Steps (V-J07, B-15)', () => {
  const view = dailyView({ def: TRENDS.steps, window: windowOf('week', TODAY), data: data(STEPS.map(([d, v]) => steps(d, v))), prefs, ctx: ctx() });

  it('states a day on average over the days with steps, and names them', () => {
    expect(view.title).toBe('This week');
    expect(view.headline).toEqual({ statistic: 'A day on average', coverage: '3 days with steps', value: '6,167', unit: 'steps' });
    expect(view.stats).toEqual([{ label: 'Days with steps', value: '3' }, { label: 'Highest', value: '7,000 steps · Tue 6 Oct' }]);
    expect(view.notes).toEqual([]);
  });

  it('compares Monday to Thursday with last Monday to Thursday, never with the whole of last week', () => {
    expect(view.change).toEqual({ text: 'Higher than last week · +417 steps a day', direction: 'higher', compared: 'Mon–Thu vs last Mon–Thu' });
  });

  it('draws last week behind this one, labels the average, and says each day in words', () => {
    const [previous, current] = view.chart.series;
    expect(previous).toMatchObject({ kind: 'bars', previous: true, label: 'Last week', values: [5000, 6000, 5800, 6200, 4000, 8000, 3500] });
    expect(current).toMatchObject({ kind: 'bars', label: 'This week', colour: 'var(--cat-steps)', values: [6000, 7000, 5500, null, null, null, null] });
    expect(view.chart.average).toEqual({ value: 18500 / 3, label: 'Average 6,167 steps a day' });
    expect(view.chart.slots.map(s => s.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(view.chart.slots[1]).toMatchObject({ day: '2026-10-06', text: 'Tuesday, 6 October: 7,000 steps, entered at 8:00 pm. Last week: 6,000 steps.' });
    expect(view.chart.slots[3].text).toBe('Thursday, 8 October: Not entered. Last week: 6,200 steps.');
    expect(view.chart.slots[4]).toMatchObject({ future: true, text: 'Friday, 9 October: Still to come. Last week: 4,000 steps.' });
    expect(view.chart.slots[4].day).toBeUndefined();
  });

  it('lists the days so far, and sums the view up for VoiceOver', () => {
    expect(view.table.columns).toEqual(['Day', 'This week', 'Last week']);
    expect(view.table.rows).toHaveLength(4);
    expect(view.table.rows[1]).toEqual(['Tuesday, 6 October', '7,000 steps, entered at 8:00 pm', '6,000 steps']);
    expect(view.summary).toBe('Steps, This week. A day on average, 3 days with steps: 6,167 steps. Higher than last week, +417 steps a day, Mon–Thu vs last Mon–Thu.');
  });
});

describe('a counted measure: Walk, with Away days and a rest day (B-15, D25, K-49)', () => {
  const WALKS = [
    ...walk('a', '2026-09-21', 20), ...walk('b', '2026-09-23', 30), ...walk('c', '2026-09-25', 10),
    ...walk('d', '2026-09-28', 30), ...walk('e', '2026-09-29', 20), ...walk('f', '2026-10-01', 40), ...walk('g', '2026-10-02', 10), ...walk('h', '2026-10-03', 20),
  ];
  const c = ctx({
    since: '2026-09-21',
    statusOn: d => (d === '2026-09-30' || d === '2026-10-02' ? 'away' : 'normal'),
    restOn: d => weekdayOf(d) === 'sunday',
  });
  const view = dailyView({ def: TRENDS.walk, window: windowOf('week', '2026-09-30'), data: data(WALKS), prefs, ctx: c });

  it('a finished week: its total, against the whole week before', () => {
    expect(view.title).toBe('Last week');
    expect(view.headline).toEqual({ statistic: 'Total', coverage: '7 days', value: '120', unit: 'min' });
    expect(view.change).toEqual({ text: 'Higher than the week before · +60 min', direction: 'higher', compared: '28 Sep – 4 Oct vs 21–27 Sep' });
    expect(view.notes).toEqual(['Includes 2 Away days.']);
    expect(view.stats).toEqual([{ label: 'Days with time recorded', value: '5' }, { label: 'Highest day', value: '40 min · Thu 1 Oct' }]);
  });

  it('shades Away and rest days and never draws them as zero; a walk on an Away day still counts', () => {
    expect(view.chart.series[1].kind === 'bars' && view.chart.series[1].values).toEqual([30, 20, null, 40, 10, 20, null]);
    expect(view.chart.series[0].kind === 'bars' && view.chart.series[0].values).toEqual([20, 0, 30, 0, 10, 0, null]);
    expect(view.chart.slots[2]).toMatchObject({ mark: 'away', text: 'Wednesday, 30 September: Away. The week before: 30 min.' });
    expect(view.chart.slots[4]).toMatchObject({ mark: 'away', text: 'Friday, 2 October: 10 min (Away). The week before: 10 min.' });
    expect(view.chart.slots[6]).toMatchObject({ mark: 'rest', text: 'Sunday, 4 October: Rest day. The week before: Rest day.' });
    expect(view.chart.average).toEqual({ value: 24, label: 'Average 24 min a day' });
  });

  it('sums the view up with its notes', () => {
    expect(view.summary).toBe('Walk, Last week. Total, 7 days: 120 min. Higher than the week before, +60 min, 28 Sep – 4 Oct vs 21–27 Sep. Includes 2 Away days.');
  });
});

describe('a stated Month: a day on average, a bar a day by its date (B-15)', () => {
  const view = dailyView({ def: TRENDS.steps, window: windowOf('month', TODAY), data: data(STEPS.map(([d, v]) => steps(d, v))), prefs, ctx: ctx() });

  it('states a day on average over the month’s days with steps', () => {
    expect(view.title).toBe('This month');
    expect(view.headline).toEqual({ statistic: 'A day on average', coverage: '7 days with steps', value: '5,743', unit: 'steps' });
    expect(view.change).toEqual({ text: 'Comparisons start once there are 3 days with data in both months.' });
    expect(view.table.columns).toEqual(['Day', 'This month', 'Last month']);
  });

  it('labels each day by its date, each opening that day; a longer month has nothing behind its last days', () => {
    const labels = view.chart.slots.map(s => s.label);
    expect([labels.length, ...labels.slice(0, 3), labels.at(-1)]).toEqual([31, '1', '2', '3', '31']);
    expect(view.chart.slots[0].day).toBe('2026-10-01');
    const [previous] = view.chart.series;
    expect(previous.kind === 'bars' && previous.values.slice(27)).toEqual([5000, 6000, 5800, null]);
    expect(view.chart.slots[27].text).toBe('Wednesday, 28 October: Still to come. Last month: 5,000 steps.');
    expect(view.chart.slots[30].text).toBe('Saturday, 31 October: Still to come.');
  });
});

describe('6 Months of a stated measure: each week’s bar is its average a day (D68)', () => {
  const view = dailyView({ def: TRENDS.steps, window: windowOf('sixMonths', TODAY), data: data(STEPS.map(([d, v]) => steps(d, v))), prefs, ctx: ctx() });
  const slot = (key: string) => view.chart.slots.findIndex(s => s.key === key);

  it('a day on average over the whole window, and each week’s own average a day', () => {
    expect(view.headline).toEqual({ statistic: 'A day on average', coverage: '10 days with steps', value: '5,700', unit: 'steps' });
    expect(view.chart.average?.label).toBe('Average 5,700 steps a day');
    const bars = view.chart.series[1];
    expect(bars.kind === 'bars' && [bars.values[slot('2026-09-21')], bars.values[slot('2026-09-28')], bars.values[slot('2026-10-05')], bars.values[slot('2026-10-12')]])
      .toEqual([null, 5500, 18500 / 3, null]);
    expect(view.chart.slots[slot('2026-09-28')].text).toBe('28 Sep – 4 Oct: 5,500 steps a day on average, from 7 days with steps. The 6 months before: Not entered.');
    expect(view.chart.slots[slot('2026-10-12')]).toMatchObject({ future: true, label: '12 Oct' });
    expect(view.chart.slots[slot('2026-10-12')].text.startsWith('12–18 Oct: Still to come.')).toBe(true);
  });

  it('a week is no day to open, and the list is by week', () => {
    expect(view.chart.slots.every(s => s.day === undefined)).toBe(true);
    expect(view.table.columns).toEqual(['Week', 'May – Oct 2026', 'The 6 months before']);
  });
});

describe('a counted Year: a month on average, a bar a month (D68)', () => {
  const walks = [
    ...walk('a', '2026-09-21', 20), ...walk('b', '2026-09-23', 30), ...walk('c', '2026-09-25', 10),
    ...walk('d', '2026-09-28', 30), ...walk('e', '2026-09-29', 20), ...walk('f', '2026-10-01', 40), ...walk('g', '2026-10-02', 10), ...walk('h', '2026-10-03', 20),
  ];
  const view = dailyView({ def: TRENDS.walk, window: windowOf('year', TODAY), data: data(walks), prefs, ctx: ctx({ since: '2026-09-21' }) });

  it('is the total over the days of the record, times an average month', () => {
    expect(view.headline).toEqual({ statistic: 'A month on average', coverage: 'from 18 days', value: '304', unit: 'min' });
    expect(view.chart.average?.label).toBe('Average 304 min a month');
    expect(view.stats).toEqual([
      { label: 'Days with time recorded', value: '8' }, { label: 'Total', value: '180 min' }, { label: 'Highest day', value: '40 min · Thu 1 Oct' },
    ]);
    expect(view.change).toEqual({ text: 'Comparisons start once there are 3 days with data in both periods.' });
  });

  it('a bar a month by its name, each month’s total; a month before the record has none', () => {
    expect(view.chart.slots.map(s => s.label)).toEqual(['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']);
    expect([view.chart.slots[0].name, view.chart.slots[10].name]).toEqual(['November 2025', 'September 2026']);
    const bars = view.chart.series[1];
    expect(bars.kind === 'bars' && bars.values.slice(9)).toEqual([null, 110, 70]);
    expect(view.chart.slots[10].text).toBe('September 2026: 110 min. The 12 months before: Before your first record.');
    expect(view.chart.slots.every(s => s.day === undefined)).toBe(true);
    expect(view.table.columns).toEqual(['Month', 'Nov 2025 – Oct 2026', 'The 12 months before']);
  });
});

describe('the change in words: lower, and the same (A-41)', () => {
  const week = (current: number) => dailyView({
    def: TRENDS.steps, window: windowOf('week', TODAY), prefs, ctx: ctx(),
    data: data([...STEPS.slice(0, 7), ['2026-10-05', current], ['2026-10-06', current], ['2026-10-07', current]].map(([d, v]) => steps(d as string, v as number))),
  });
  it('a minus sign and the unit, or the same with no figure', () => {
    expect(week(3000).change).toEqual({ text: 'Lower than last week · −2,750 steps a day', direction: 'lower', compared: 'Mon–Thu vs last Mon–Thu' });
    expect(week(5750).change).toEqual({ text: 'The same as last week', direction: 'same', compared: 'Mon–Thu vs last Mon–Thu' });
  });
});

describe('sleep: a night on average, never shaded (J§12.2)', () => {
  const sleep = (day: string, hours: number) => newObservation({ kind: 'sleep', value: hours, at: `${day}T07:00:00+05:30`, scope: 'dayTotal', source: 'manual' });
  const view = dailyView({
    def: TRENDS.sleep, window: windowOf('week', TODAY), prefs, ctx: ctx({ statusOn: d => (d === '2026-10-06' ? 'away' : 'normal') }),
    data: data([sleep('2026-10-05', 7.5), sleep('2026-10-06', 7.5), sleep('2026-10-07', 7.5)]),
  });

  it('says nights, and names an Away night without shading it', () => {
    expect(view.headline).toEqual({ statistic: 'A night on average', coverage: '3 nights recorded', value: '7.5', unit: 'h' });
    expect(view.stats).toEqual([{ label: 'Nights recorded', value: '3' }, { label: 'Highest', value: '7.5 h · Mon 5 Oct' }]);
    expect(view.chart.average?.label).toBe('Average 7.5 h a night');
    expect(view.chart.slots.some(s => s.mark !== undefined)).toBe(false);
    expect(view.chart.slots[1].text).toBe('Tuesday, 6 October: 7.5 h. Last week: Not entered.');
    expect(view.notes).toEqual(['Includes 1 Away day.']);
  });
});

describe('a counted measure’s first days (J§12.2, early days)', () => {
  const c = ctx({ since: '2026-10-06', restOn: d => weekdayOf(d) === 'tuesday' });
  const zero = newObservation({ kind: 'walkDuration', value: 0, at: '2026-10-07T18:00:00+05:30', scope: 'sessionObserved', source: 'imported', coverageMs: 60_000, context: 'walk:z' });

  it('days before the record are no days; a rest day with a walk on it isn’t shaded; a 0-minute record is no time recorded', () => {
    const view = dailyView({ def: TRENDS.walk, window: windowOf('week', TODAY), data: data([...walk('t', '2026-10-06', 15), zero]), prefs, ctx: c });
    expect(view.chart.series[1].kind === 'bars' && view.chart.series[1].values).toEqual([null, 15, 0, 0, null, null, null]);
    expect(view.chart.slots[0].text).toBe('Monday, 5 October: Before your first record. Last week: Before your first record.');
    expect(view.chart.slots[1]).toMatchObject({ text: 'Tuesday, 6 October: 15 min. Last week: Rest day.' });
    expect(view.chart.slots[1].mark).toBeUndefined();
    expect(view.headline).toEqual({ statistic: 'Total', coverage: '3 days', value: '15', unit: 'min' });
    expect(view.stats).toEqual([{ label: 'Days with time recorded', value: '1' }, { label: 'Highest day', value: '15 min · Tue 6 Oct' }]);
  });

  it('a record that begins today is a day of 0, with no highest day; before it, nothing recorded; nothing entered, not entered', () => {
    const first = dailyView({ def: TRENDS.walk, window: windowOf('week', TODAY), data: data([]), prefs, ctx: ctx({ since: TODAY }) });
    expect(first.headline).toEqual({ statistic: 'Total', coverage: '1 day', value: '0', unit: 'min' });
    expect(first.stats).toEqual([{ label: 'Days with time recorded', value: '0' }]);
    const before = dailyView({ def: TRENDS.walk, window: windowOf('week', '2026-09-23'), data: data([]), prefs, ctx: c });
    expect(before.headline).toEqual({ statistic: 'Total', coverage: '0 days', value: 'Nothing recorded' });
    const none = dailyView({ def: TRENDS.steps, window: windowOf('week', TODAY), data: data([]), prefs, ctx: ctx() });
    expect(none.headline).toEqual({ statistic: 'A day on average', coverage: '0 days with steps', value: 'Not entered' });
    expect(none.stats).toEqual([]);
  });

  it('over 6 Months, status days are named as left out of the average', () => {
    const view = dailyView({
      def: TRENDS.walk, window: windowOf('sixMonths', TODAY), prefs, ctx: ctx({ statusOn: d => (d === '2026-09-29' ? 'away' : 'normal') }),
      data: data([...walk('d', '2026-09-28', 30), ...walk('e', '2026-09-29', 20)]),
    });
    expect(view.notes).toEqual(['Includes 1 Away day, not counted as days in the average.']);
  });
});

describe('Stretch: its own minutes, and every day stretched (§12.3, D72)', () => {
  const session = (date: string, over: Partial<WorkoutSession>): WorkoutSession => ({
    id: `${date}-${over.planKind}`, date, dayOfWeek: 'monday', muscleGroup: 'fullBody', phase: 'foundation', week: 3, status: 'completed', sets: [],
    startedAt: `${date}T07:30:00+05:30`, completedAt: null, notes: '', totalVolume: 0, guided: true, ...over,
  });
  it('counts the stretch routines’ minutes, and the days with a mobility block as days stretched', () => {
    const view = dailyView({
      def: TRENDS.stretch, window: windowOf('week', TODAY), prefs, ctx: ctx(),
      data: data([], [session('2026-10-06', { planKind: 'stretch', durationSeconds: 600 }), session('2026-10-07', { planKind: 'full', durationSeconds: 1440, mobility: [{ exerciseId: 'cat-cow', seconds: 60 }] })]),
    });
    expect(view.stats).toEqual([{ label: 'Days with time recorded', value: '1' }, { label: 'Days stretched', value: '2' }, { label: 'Highest day', value: '10 min · Tue 6 Oct' }]);
  });
});

describe('6 Months: a week on average, weighted by the days of data (B-15)', () => {
  const view = dailyView({
    def: TRENDS.walk, window: windowOf('sixMonths', TODAY), prefs, ctx: ctx(),
    data: data([...walk('d', '2026-09-28', 30), ...walk('e', '2026-09-29', 20), ...walk('f', '2026-10-01', 40), ...walk('h', '2026-10-03', 30)]),
  });
  const slot = (key: string) => view.chart.slots.findIndex(s => s.key === key);

  it('is the total over the days of the record, times seven', () => {
    expect(view.headline).toEqual({ statistic: 'A week on average', coverage: 'from 11 days', value: '76', unit: 'min' });
    expect(view.stats).toEqual([
      { label: 'Days with time recorded', value: '4' }, { label: 'Total', value: '120 min' }, { label: 'Highest day', value: '40 min · Thu 1 Oct' },
    ]);
    expect(view.chart.average?.value).toBeCloseTo((120 / 11) * 7, 9);
    expect(view.chart.average?.label).toBe('Average 76 min a week');
  });

  it('draws each week’s total; a week of the record with nothing is 0, a week before it is nothing', () => {
    const bars = view.chart.series[1];
    expect(bars.kind).toBe('bars');
    if (bars.kind !== 'bars') return;
    expect(bars.values[slot('2026-09-28')]).toBe(120);
    expect(bars.values[slot('2026-10-05')]).toBe(0);
    expect(bars.values[slot('2026-09-21')]).toBeNull();
    expect(view.chart.slots[slot('2026-09-28')].name).toBe('28 Sep – 4 Oct');
  });

  it('waits for 3 days of data in both periods before comparing', () => {
    expect(view.change).toEqual({ text: 'Comparisons start once there are 3 days with data in both periods.' });
  });
});

describe('steps that are a lower bound (J§9.6, V-J26)', () => {
  const obs = [
    steps(TODAY, 6050, '12:05'),
    ...walk('w1', TODAY, 20, { time: '15:00', count: 1250 }),
    ...walk('w0', '2026-10-07', 20, { time: '07:40', count: 4210 }),
  ];
  const view = dailyView({ def: TRENDS.steps, window: windowOf('week', TODAY), data: data(obs), prefs, ctx: ctx({ since: '2026-10-07' }) });

  it('says “at least”, with both sources, and notes how many days are lower bounds', () => {
    expect(view.chart.slots[3].text).toBe('Thursday, 8 October: at least 7,300 steps, 6,050 entered at 12:05 pm + 1,250 in walks after 12:05 pm. Last week: Not entered.');
    expect(view.chart.slots[2].text).toBe('Wednesday, 7 October: 4,210 steps, in FitStrong walks · day total not entered. Last week: Not entered.');
    expect(view.notes).toEqual(['2 days show at least the steps counted: FitStrong walks only, or walks after a total was entered.']);
    expect(view.headline).toEqual({ statistic: 'A day on average', coverage: '2 days with steps', value: '5,755', unit: 'steps' });
  });

  it('a record that starts this week has no comparison yet', () => {
    expect(view.change).toEqual({ text: 'Comparisons start once there are 3 days with data in both weeks.' });
  });
});

describe('the day context from the settings', () => {
  it('rest days are the programme’s days without training, from its start; none outside the programme', () => {
    const d = data([steps('2026-09-28', 5000)]);
    const c = trendContext({
      today: TODAY, data: d, profile: { trainingDays: ['monday', 'thursday', 'saturday'] },
      settings: { startDate: '2026-09-24', statusPeriods: [{ kind: 'away', from: '2026-10-02', to: '2026-10-02' }] },
    });
    expect(c.since).toBe('2026-09-28');
    expect(c.restOn('2026-10-06')).toBe(true);    // a Tuesday
    expect(c.restOn('2026-10-08')).toBe(false);   // a Thursday
    expect(c.restOn('2026-09-22')).toBe(false);   // before the start
    expect(c.statusOn('2026-10-02')).toBe('away');
    expect(trendContext({ today: TODAY, data: d, settings: { startDate: '' }, profile: { trainingDays: ['monday'] } }).restOn('2026-10-06')).toBe(false);
  });
});

const g = (value: number, at: string, tag?: 'fasting' | 'afterMeal') =>
  newObservation({ kind: 'glucose', value, unit: 'mg/dL', at, scope: 'pointInTime', source: 'manual', ...(tag ? { tag } : {}) });
const GLUCOSE = [
  g(120, '2026-09-28T07:30:00+05:30', 'fasting'), g(118, '2026-09-29T07:30:00+05:30', 'fasting'), g(122, '2026-09-30T07:30:00+05:30', 'fasting'),
  g(118, '2026-10-05T07:30:00+05:30', 'fasting'), g(168, '2026-10-06T14:10:00+05:30', 'afterMeal'),
  g(280, '2026-10-07T13:00:00+05:30', 'afterMeal'), g(62, '2026-10-07T21:30:00+05:30'),
];
const week = windowOf('week', TODAY);

describe('the reading count says which readings are numeric (B-15)', () => {
  it('in words', () => {
    expect(readingCount(5, 0, 0)).toBe('5 readings, all with a number');
    expect(readingCount(1, 0, 0)).toBe('1 reading with a number');
    expect(readingCount(0, 0, 0)).toBe('0 readings');
    expect(readingCount(5, 0, 1)).toBe('6 readings: 5 with a number, 1 meter LO');
    expect(readingCount(0, 1, 2)).toBe('3 readings: none with a number, 2 meter LO and 1 meter HI');
  });
});

describe('a readings trend: Glucose (A-44, K-11)', () => {
  const view = readingsView({ def: TRENDS.glucose, window: week, data: data(GLUCOSE), prefs, ctx: ctx() });

  it('states the average with n, the range, the lows and highs, and each context', () => {
    expect(view.headline).toEqual({ statistic: 'Average', coverage: '4 readings, all with a number', value: '157', unit: 'mg/dL' });
    expect(view.stats).toEqual([
      { label: 'Range', value: '62–280 mg/dL' },
      { label: 'Below 70 mg/dL', value: '1' },
      { label: 'Above 250 mg/dL', value: '1' },
      { label: 'Fasting or before a meal', value: '118 mg/dL on average, 1 reading' },
      { label: 'After a meal', value: '224 mg/dL on average, 2 readings' },
      { label: 'Other times', value: '62 mg/dL on average, 1 reading' },
    ]);
    expect(view.meter).toBeUndefined();
  });

  it('compares means over the same days, with 3 days in both weeks', () => {
    expect(view.change).toEqual({ text: 'Higher than last week · +37 mg/dL', direction: 'higher', compared: 'Mon–Thu vs last Mon–Thu' });
  });

  it('lists each reading with its time, context and what it was', () => {
    expect(view.table).toEqual({
      columns: ['Day', 'Reading', 'Note'],
      rows: [
        ['Monday, 5 October', '118 mg/dL at 7:30 am, fasting', ''],
        ['Tuesday, 6 October', '168 mg/dL at 2:10 pm, after a meal', ''],
        ['Wednesday, 7 October', '280 mg/dL at 1:00 pm, after a meal', 'Above 250 mg/dL'],
        ['Wednesday, 7 October', '62 mg/dL at 9:30 pm', 'Low'],
      ],
    });
    expect(view.chart.slots[2].text).toBe('Wednesday, 7 October: 280 mg/dL at 1:00 pm, after a meal, above 250 mg/dL; 62 mg/dL at 9:30 pm, low.');
  });

  it('draws each context as its own series, flags the lows and highs, and labels the lines and the average', () => {
    expect(view.chart.series.map(s => s.kind === 'points' && [s.id, s.shape, s.points.length])).toEqual([
      ['beforeMeal', 'circle', 1], ['afterMeal', 'triangle', 2], ['other', 'square', 1],
    ]);
    const other = view.chart.series[2];
    expect(other.kind === 'points' && other.points[0]).toEqual({ slot: 2, at: (21 * 60 + 30) / 1440, value: 62, flag: 'low' });
    expect(view.chart.lines).toEqual([{ value: 70, label: '70 mg/dL' }, { value: 250, label: '250 mg/dL' }]);
    expect(view.chart.average).toEqual({ value: 157, label: 'Average 157 mg/dL' });
  });

  it('in mmol/L, the same readings in that unit, and the lines where the mg/dL lines are', () => {
    const mmol = readingsView({ def: TRENDS.glucose, window: week, data: data(GLUCOSE), prefs: { ...prefs, glucose: 'mmol/L' }, ctx: ctx() });
    expect(mmol.headline).toMatchObject({ value: '8.7', unit: 'mmol/L' });
    expect(mmol.chart.lines.map(l => l.label)).toEqual(['3.9 mmol/L', '13.9 mmol/L']);
    expect(mmol.chart.lines[0].value).toBeCloseTo(70 / 18, 9);
  });
});

describe('a reading by a line is never rounded across it (KT-01, H3-04, KT-15, J06)', () => {
  const at = (day: string, time: string) => `${day}T${time}:00+05:30`;

  it('a serious low of 53.9 mg/dL keeps its decimal in the range, never “54”', () => {
    const view = readingsView({ def: TRENDS.glucose, window: week, data: data([g(53.9, at('2026-10-05', '07:30')), g(180, at('2026-10-06', '07:30'))]), prefs, ctx: ctx() });
    expect(view.stats[0]).toEqual({ label: 'Range', value: '53.9–180 mg/dL' });
    expect(view.table.rows[0][1]).toBe('53.9 mg/dL at 7:30 am');
  });

  it('in mmol/L, 3.85 is below 3.9: shown as 3.85, never as the line itself', () => {
    const mmol = (value: number, day: string) => newObservation({ kind: 'glucose', value, unit: 'mmol/L', at: at(day, '07:30'), scope: 'pointInTime', source: 'manual' });
    const view = readingsView({ def: TRENDS.glucose, window: week, data: data([mmol(3.85, '2026-10-05'), mmol(6.2, '2026-10-06')]), prefs: { ...prefs, glucose: 'mmol/L' }, ctx: ctx() });
    expect(view.stats.slice(0, 2)).toEqual([{ label: 'Range', value: '3.85–6.2 mmol/L' }, { label: 'Below 3.9 mmol/L', value: '1' }]);
    const six = readingsView({ def: TRENDS.glucose, window: windowOf('sixMonths', TODAY), data: data([mmol(3.85, '2026-10-05'), mmol(6.2, '2026-10-06')]), prefs: { ...prefs, glucose: 'mmol/L' }, ctx: ctx() });
    expect(six.table.rows).toEqual([['5–11 Oct', '2', '3.85–6.2 mmol/L', '5.0 mmol/L']]);
  });

  it('13.9 mmol/L read in mg/dL is 250.2, above 250, in its words, the range and the count', () => {
    const high = newObservation({ kind: 'glucose', value: 13.9, unit: 'mmol/L', at: at('2026-10-06', '13:00'), scope: 'pointInTime', source: 'manual' });
    const view = readingsView({ def: TRENDS.glucose, window: week, data: data([g(120, at('2026-10-05', '07:30')), high]), prefs, ctx: ctx() });
    expect(view.table.rows[1]).toEqual(['Tuesday, 6 October', '250.2 mg/dL at 1:00 pm', 'Above 250 mg/dL']);
    expect(view.stats.slice(0, 3)).toEqual([{ label: 'Range', value: '120–250.2 mg/dL' }, { label: 'Below 70 mg/dL', value: '0' }, { label: 'Above 250 mg/dL', value: '1' }]);
  });

  it('keeps each reading’s unrounded value, so the average is the readings’, not their rounded figures (§4.10)', () => {
    const view = readingsView({ def: TRENDS.glucose, window: week, data: data(GLUCOSE), prefs: { ...prefs, glucose: 'mmol/L' }, ctx: ctx() });
    const points = view.chart.series.flatMap(s => (s.kind === 'points' ? s.points.map(p => p.value) : []));
    expect(points[0]).toBeCloseTo(118 / 18, 9);
    expect(view.chart.average?.value).toBeCloseTo((118 + 168 + 280 + 62) / 4 / 18, 9);
  });
});

describe('a week with only a meter’s LO (Review Focus 3)', () => {
  const lo = { date: '2026-10-06', glucoseDisplay: { display: 'LO', measuredAt: '2026-10-06T13:00:00+05:30' } } as unknown as CheckInRecord;
  const view = readingsView({ def: TRENDS.glucose, window: week, data: data(GLUCOSE.slice(0, 3), [], [lo]), prefs, ctx: ctx() });

  it('says no reading had a number, shows the LO above the average, and hides the change', () => {
    expect(view.headline).toEqual({ statistic: 'Average', coverage: '1 reading: none with a number, 1 meter LO', value: 'No numeric readings' });
    expect(view.meter).toBe('Not in the average: 1 LO. The meter showed this instead of a number.');
    expect(view.change).toEqual({ text: 'No change shown: a meter LO has no number, so an average would leave out the lowest reading.' });
    expect(view.stats).toEqual([{ label: 'Below 70 mg/dL', value: '1' }, { label: 'Above 250 mg/dL', value: '0' }]);
    expect(view.chart.slots[1].text).toBe('Tuesday, 6 October: Meter showed LO at 1:00 pm, below what the meter can show.');
  });

  it('never shows a 0 or NaN for a missing average', () => {
    expect(view.chart.average).toBeUndefined();
    expect(JSON.stringify(view)).not.toMatch(/NaN|Infinity/);
  });
});

describe('blood pressure: two numbers, each averaged on its own', () => {
  const half = (kind: 'bloodPressureSystolic' | 'bloodPressureDiastolic', value: number, day: string, id: string) =>
    newObservation({ kind, value, at: `${day}T07:30:00+05:30`, scope: 'pointInTime', source: 'manual', context: bpContext(id) });
  const view = readingsView({
    def: TRENDS.bp, window: week, prefs, ctx: ctx(),
    data: data([
      half('bloodPressureSystolic', 132, '2026-10-05', 'r1'), half('bloodPressureDiastolic', 84, '2026-10-05', 'r1'),
      half('bloodPressureSystolic', 184, '2026-10-06', 'r2'), half('bloodPressureDiastolic', 96, '2026-10-06', 'r2'),
      half('bloodPressureSystolic', 128, '2026-10-07', 'r3'),
    ]),
  });

  it('a headline of both averages, ranges for each, and the readings at 180/120 or higher counted', () => {
    expect(view.headline).toEqual({ statistic: 'Average', coverage: '3 readings, all with a number', value: '148/90', unit: 'mmHg' });
    expect(view.stats).toEqual([
      { label: 'Range, top number', value: '128–184 mmHg' },
      { label: 'Range, bottom number', value: '84–96 mmHg' },
      { label: '180/120 mmHg or higher', value: '1' },
    ]);
    expect(view.table.rows).toEqual([
      ['Monday, 5 October', '132/84 mmHg at 7:30 am', ''],
      ['Tuesday, 6 October', '184/96 mmHg at 7:30 am', 'Very high'],
      ['Wednesday, 7 October', '128/Not entered mmHg at 7:30 am', ''],
    ]);
  });
});

describe('labs: dated results with their intervals (A-45)', () => {
  const lab = (value: number, day: string) => newObservation({ kind: 'hba1c', value, unit: '%', at: `${day}T12:00:00+05:30`, scope: 'pointInTime', source: 'manual' });

  it('one result shows at once, with no daily data needed (V-J27)', () => {
    const view = labsView('hba1c', data([lab(7.1, TODAY)]), prefs, TODAY);
    expect(view.headline).toEqual({ statistic: 'Latest', coverage: '1 result', value: '7.1%' });
    expect(view.table.rows).toEqual([['Thursday, 8 October', '7.1%', 'First result']]);
    expect(view.chart.series[0].kind === 'points' && view.chart.series[0].points).toEqual([{ slot: 0, at: 7.5 / 31, value: 7.1 }]);
  });

  it('each later result says how long after the one before it came, spaced by the months between', () => {
    const view = labsView('hba1c', data([lab(6.9, '2026-10-07'), lab(7.4, '2026-03-02'), lab(7.1, '2026-06-02')]), prefs, TODAY);
    expect(view.rows.map(r => r.interval)).toEqual(['First result', '3 months after the one before', '4 months after the one before']);
    expect(view.chart.slots.map(s => s.label)).toEqual(['Mar 2026', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']);
    expect(view.headline.value).toBe('6.9%');
  });

  it('with none yet, says so', () => {
    expect(labsView('b12', data([]), prefs, TODAY).headline).toEqual({ statistic: 'Latest', coverage: '0 results', value: 'No Vitamin B12 results yet' });
  });
});

describe('a category’s row on the Trends tab (J§12.1)', () => {
  it('daily measures: the week’s figure with its statistic named, and the week’s days', () => {
    const row = trendRow(TRENDS.steps, data(STEPS.map(([d, v]) => steps(d, v))), prefs, ctx());
    expect(row).toEqual({
      id: 'steps', title: 'Steps', colour: '--cat-steps',
      value: 'A day on average this week: 6,167 steps', spark: [6000, 7000, 5500, null, null, null, null],
    });
    expect(trendRow(TRENDS.walk, data(STEPS.map(([d, v]) => steps(d, v))), prefs, ctx()).value).toBe('Total this week: 0 min');
  });

  it('readings: the latest, with when; labs: the latest result of any lab', () => {
    expect(trendRow(TRENDS.glucose, data(GLUCOSE), prefs, ctx())).toMatchObject({
      value: 'Latest: 62 mg/dL at 9:30 pm · Wed 7 Oct', spark: [120, 118, 122, 118, 168, 280, 62],
    });
    const hba1c = newObservation({ kind: 'hba1c', value: 7.1, unit: '%', at: `${TODAY}T12:00:00+05:30`, scope: 'pointInTime', source: 'manual' });
    expect(trendRow(TRENDS.labs, data([hba1c]), prefs, ctx()).value).toBe('Latest HbA1c: 7.1% · Thu 8 Oct');
    expect(trendRow(TRENDS.mood, data([]), prefs, ctx()).value).toBe('No readings yet');
  });
});

describe('more of the readings view (A-43, A-44, K-11)', () => {
  const view = readingsView({ def: TRENDS.glucose, window: week, data: data(GLUCOSE), prefs, ctx: ctx() });
  const at = (day: string, time: string) => `${day}T${time}:00+05:30`;
  const half = (kind: 'bloodPressureSystolic' | 'bloodPressureDiastolic', value: number, day: string, id: string) =>
    newObservation({ kind, value, at: `${day}T07:30:00+05:30`, scope: 'pointInTime', source: 'manual', context: bpContext(id) });
  const reading = (day: string, sys: number, dia?: number) => [
    half('bloodPressureSystolic', sys, day, `bp-${day}`), ...(dia === undefined ? [] : [half('bloodPressureDiastolic', dia, day, `bp-${day}`)]),
  ];
  const pain = (kind: 'backPain' | 'legPain', value: number, day: string) => newObservation({ kind, value, at: at(day, '07:30'), scope: 'pointInTime', source: 'manual' });
  const display = (date: string, kind: 'HI' | 'LO', time: string) => ({ date, glucoseDisplay: { display: kind, measuredAt: at(date, time) } }) as unknown as CheckInRecord;

  it('a high is flagged as well as named; today with nothing says so; days to come can’t be chosen', () => {
    const afterMeal = view.chart.series[1];
    expect(afterMeal.kind === 'points' && afterMeal.points).toEqual([{ slot: 1, at: (14 * 60 + 10) / 1440, value: 168 }, { slot: 2, at: (13 * 60) / 1440, value: 280, flag: 'high' }]);
    expect(view.chart.slots[3]).toMatchObject({ day: '2026-10-08', text: 'Thursday, 8 October: No readings.' });
    expect(view.chart.slots[4]).toMatchObject({ future: true, text: 'Friday, 9 October: Still to come.' });
    expect(view.chart.slots[4].day).toBeUndefined();
  });

  it('a week with nothing has no readings; one context alone isn’t split out', () => {
    const none = readingsView({ def: TRENDS.glucose, window: week, data: data([]), prefs, ctx: ctx() });
    expect(none.headline).toEqual({ statistic: 'Average', coverage: '0 readings', value: 'No readings' });
    const fasting = readingsView({
      def: TRENDS.glucose, window: week, prefs, ctx: ctx(),
      data: data([g(110, at('2026-10-05', '07:30'), 'fasting'), g(112, at('2026-10-06', '07:30'), 'fasting'), g(108, at('2026-10-07', '07:30'), 'fasting')]),
    });
    expect(fasting.stats).toEqual([{ label: 'Range', value: '108–112 mg/dL' }, { label: 'Below 70 mg/dL', value: '0' }, { label: 'Above 250 mg/dL', value: '0' }]);
  });

  it('a LO and a HI are both said above the average; the series a week has no reading in isn’t drawn', () => {
    const both = readingsView({ def: TRENDS.glucose, window: week, data: data(GLUCOSE.slice(0, 3), [], [display('2026-10-06', 'LO', '13:00'), display('2026-10-07', 'HI', '21:00')]), prefs, ctx: ctx() });
    expect(both.meter).toBe('Not in the average: 1 LO and 1 HI. The meter showed these instead of a number.');
    expect(both.headline.coverage).toBe('2 readings: none with a number, 1 meter LO and 1 meter HI');
    expect(both.chart.series).toEqual([]);
  });

  it('a LO in the week before hides the change too, though it isn’t on the days compared', () => {
    const lastSaturday = readingsView({
      def: TRENDS.glucose, window: week, prefs, ctx: ctx(),
      data: data([...GLUCOSE.slice(0, 3), g(118, at('2026-10-05', '07:30')), g(120, at('2026-10-06', '07:30')), g(116, at('2026-10-07', '07:30'))], [], [display('2026-10-03', 'LO', '22:00')]),
    });
    expect(lastSaturday.change).toEqual({ text: 'No change shown: a meter LO has no number, so an average would leave out the lowest reading.' });
  });

  it('a LO keeps its week when the phone changes zone: the change stays hidden (H3-01, B-15, J§4.10)', () => {
    // Monday 28 September, half past midnight in Kolkata: the week before this one. In London it is 8 pm on the 27th.
    const kept = { date: '2026-09-28', glucoseDisplay: { display: 'LO', measuredAt: '2026-09-28T00:30:00+05:30' } } as unknown as CheckInRecord;
    // The same instant, saved before the offset was kept: its zone is lost, so it could have been the 27th or the 28th.
    const utc = { date: '2026-09-28', glucoseDisplay: { display: 'LO', measuredAt: '2026-09-27T19:00:00.000Z' } } as unknown as CheckInRecord;
    const hidden = { text: 'No change shown: a meter LO has no number, so an average would leave out the lowest reading.' };
    env.TZ = 'Europe/London';
    try {
      for (const lo of [kept, utc]) expect(readingsView({ def: TRENDS.glucose, window: week, data: data(GLUCOSE, [], [lo]), prefs, ctx: ctx() }).change).toEqual(hidden);
    } finally {
      env.TZ = 'Asia/Kolkata';
    }
    for (const lo of [kept, utc]) expect(readingsView({ def: TRENDS.glucose, window: week, data: data(GLUCOSE, [], [lo]), prefs, ctx: ctx() }).change).toEqual(hidden);
  });

  it('readings on a status day are counted, and the day named', () => {
    const unwell = readingsView({ def: TRENDS.glucose, window: week, data: data(GLUCOSE), prefs, ctx: ctx({ statusOn: d => (d === '2026-10-06' ? 'unwell' : 'normal') }) });
    expect(unwell.headline.coverage).toBe('4 readings, all with a number');
    expect(unwell.notes).toEqual(['Includes 1 Unwell day.']);
  });

  it('sums a meter’s LO up with the rest', () => {
    const lo = readingsView({ def: TRENDS.glucose, window: week, data: data(GLUCOSE.slice(0, 3), [], [display('2026-10-06', 'LO', '13:00')]), prefs, ctx: ctx() });
    expect(lo.summary).toBe('Glucose, This week. Average, 1 reading: none with a number, 1 meter LO: No numeric readings. No change shown: a meter LO has no number, so an average would leave out the lowest reading. Not in the average: 1 LO. The meter showed this instead of a number.');
  });

  it('blood pressure: compared on the top number, said so; no single average line and no reference lines; a missing half is not entered', () => {
    const bp = readingsView({
      def: TRENDS.bp, window: week, prefs, ctx: ctx(),
      data: data([...reading('2026-09-28', 130, 70), ...reading('2026-09-29', 128, 70), ...reading('2026-09-30', 126, 70), ...reading('2026-10-05', 132, 84), ...reading('2026-10-06', 184, 96), ...reading('2026-10-07', 128)]),
    });
    expect(bp.change).toEqual({ text: 'Higher than last week · +20 mmHg, top number', direction: 'higher', compared: 'Mon–Thu vs last Mon–Thu' });
    expect(bp.chart.average).toBeUndefined();
    expect(bp.chart.lines).toEqual([]);
    const onlyTop = readingsView({ def: TRENDS.bp, window: week, data: data(reading('2026-10-07', 128)), prefs, ctx: ctx() });
    expect(onlyTop.headline).toEqual({ statistic: 'Average', coverage: '1 reading with a number', value: '128/Not entered', unit: 'mmHg' });
  });

  it('back and leg pain: back pain is the headline, leg pain its own average and range', () => {
    const back = readingsView({
      def: TRENDS.back, window: week, prefs, ctx: ctx(),
      data: data([pain('backPain', 6, '2026-10-05'), pain('legPain', 3, '2026-10-05'), pain('backPain', 4, '2026-10-06'), pain('legPain', 2, '2026-10-06')]),
    });
    expect(back.headline).toEqual({ statistic: 'Back pain on average', coverage: '4 readings, all with a number', value: '5.0', unit: 'of 10' });
    expect(back.stats).toEqual([
      { label: 'Range, back', value: '4.0–6.0 of 10' }, { label: 'Range, leg', value: '2.0–3.0 of 10' }, { label: 'Leg pain on average', value: '2.5 of 10' },
    ]);
    expect(back.chart.average).toBeUndefined();
  });

  it('6 Months: each week’s range and mean, in words and as a list by week', () => {
    const six = readingsView({ def: TRENDS.glucose, window: windowOf('sixMonths', TODAY), data: data(GLUCOSE), prefs, ctx: ctx() });
    const slot = (key: string) => six.chart.slots.findIndex(s => s.key === key);
    expect(six.headline).toEqual({ statistic: 'Average', coverage: '7 readings, all with a number', value: '141', unit: 'mg/dL' });
    const [ranges] = six.chart.series;
    expect(ranges.kind === 'ranges' && [ranges.label, ranges.values[slot('2026-09-28')], ranges.values[slot('2026-10-05')], ranges.values[slot('2026-09-21')]])
      .toEqual(['Glucose', { min: 118, max: 122, mean: 120 }, { min: 62, max: 280, mean: 157 }, null]);
    expect(six.chart.slots[slot('2026-09-28')].text).toBe('28 Sep – 4 Oct: 3 readings, 118 to 122 mg/dL, average 120 mg/dL.');
    expect(six.chart.slots[slot('2026-09-21')].text).toBe('21–27 Sep: No readings.');
    expect(six.chart.slots[slot('2026-10-12')].text).toBe('12–18 Oct: Still to come.');
    expect(six.chart.slots.every(s => s.day === undefined)).toBe(true);
    expect(six.table).toEqual({
      columns: ['Week', 'Readings', 'Range', 'Average'],
      rows: [['28 Sep – 4 Oct', '3', '118–122 mg/dL', '120 mg/dL'], ['5–11 Oct', '4', '62–280 mg/dL', '157 mg/dL']],
    });
  });

  it('6 Months of blood pressure: a range for each number, named', () => {
    const six = readingsView({ def: TRENDS.bp, window: windowOf('sixMonths', TODAY), data: data([...reading('2026-10-05', 132, 84), ...reading('2026-10-06', 184, 96), ...reading('2026-10-07', 128)]), prefs, ctx: ctx() });
    const at5 = six.chart.slots.findIndex(s => s.key === '2026-10-05');
    expect(six.chart.series.map(s => s.kind === 'ranges' && [s.id, s.label, s.values[at5]])).toEqual([
      ['systolic', 'Top number (systolic)', { min: 128, max: 184, mean: 148 }], ['diastolic', 'Bottom number (diastolic)', { min: 84, max: 96, mean: 90 }],
    ]);
  });
});

describe('a record that starts with a LO the night before its check-in (H3-02)', () => {
  // Monday 12 October's check-in is the only record; it holds a LO measured at 11:40 pm on Sunday 11 October.
  const lo = { date: '2026-10-12', glucoseDisplay: { display: 'LO', measuredAt: '2026-10-11T23:40:00+05:30' } } as unknown as CheckInRecord;
  const d = data([], [], [lo]);
  const c = trendContext({ today: '2026-10-12', data: d, settings: { startDate: '' }, profile: undefined });

  it('Glucose’s row shows it, and Previous week can reach its week', () => {
    expect(c.since).toBe('2026-10-11');
    expect(trendRow(TRENDS.glucose, d, prefs, c).value).toBe('Latest: Meter showed LO at 11:40 pm · Sun 11 Oct');
    // CategoryTrend pages back while the week before still holds a day of the record.
    expect(windowOf('week', '2026-10-05').to >= c.since!).toBe(true);
    const last = readingsView({ def: TRENDS.glucose, window: windowOf('week', '2026-10-11'), data: d, prefs, ctx: c });
    expect(last.headline.coverage).toBe('1 reading: none with a number, 1 meter LO');
  });
});

describe('more of labs and the rows', () => {
  const lab = (kind: 'hba1c' | 'b12', value: number, day: string) =>
    newObservation({ kind, value, unit: kind === 'hba1c' ? '%' : 'pg/mL', at: `${day}T12:00:00+05:30`, scope: 'pointInTime', source: 'manual' });

  it('a month says its results; the year is said again at each January; the summary names the first', () => {
    const view = labsView('hba1c', data([lab('hba1c', 6.9, '2026-10-07'), lab('hba1c', 7.4, '2026-03-02'), lab('hba1c', 7.1, '2026-06-02')]), prefs, TODAY);
    expect([view.chart.slots[0].text, view.chart.slots[1].text]).toEqual(['March 2026: 7.4% on 2 Mar.', 'April 2026: No results.']);
    expect(view.summary).toBe('HbA1c. Latest, 3 results: 6.9%. The first was on Monday, 2 March.');
    const turning = labsView('hba1c', data([lab('hba1c', 7.4, '2025-11-20'), lab('hba1c', 7.0, '2026-02-03')]), prefs, '2026-02-10');
    expect(turning.chart.slots.map(s => s.label)).toEqual(['Nov 2025', 'Dec', 'Jan 2026', 'Feb']);
  });

  it('the Labs row names the latest result of any lab, or says there are none', () => {
    expect(trendRow(TRENDS.labs, data([lab('hba1c', 7.1, '2026-03-02'), lab('b12', 410, '2026-06-02')]), prefs, ctx()).value).toBe('Latest Vitamin B12: 410 pg/mL · Tue 2 Jun');
    expect(trendRow(TRENDS.labs, data([lab('hba1c', 7.1, '2026-06-02'), lab('b12', 410, '2026-03-02')]), prefs, ctx()).value).toBe('Latest HbA1c: 7.1% · Tue 2 Jun');
    expect(trendRow(TRENDS.labs, data([]), prefs, ctx()).value).toBe('No results yet');
  });

  it('a readings row draws the top number’s last 10; a week with nothing entered says so', () => {
    const half = (kind: 'bloodPressureSystolic' | 'bloodPressureDiastolic', value: number, day: string, id: string) =>
      newObservation({ kind, value, at: `${day}T07:30:00+05:30`, scope: 'pointInTime', source: 'manual', context: bpContext(id) });
    const bp = [half('bloodPressureSystolic', 132, '2026-10-05', 'r1'), half('bloodPressureDiastolic', 84, '2026-10-05', 'r1'), half('bloodPressureSystolic', 128, '2026-10-06', 'r2')];
    expect(trendRow(TRENDS.bp, data(bp), prefs, ctx()).spark).toEqual([132, 128]);
    const twelve = Array.from({ length: 12 }, (_, i) => g(100 + i, `2026-10-0${1 + (i % 7)}T0${i % 10}:00:00+05:30`));
    expect(trendRow(TRENDS.glucose, data(twelve), prefs, ctx()).spark).toHaveLength(10);
    expect(trendRow(TRENDS.steps, data([]), prefs, ctx()).value).toBe('Not entered this week');
  });
});
