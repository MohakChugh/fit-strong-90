import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { WorkoutSession } from '@/types';
import type { CheckInRecord } from '@/types/checkin';
import { newObservation, type Observation } from '@/health/observation';
import { weekdayOf } from '@/health/status';
import { DEFAULT_PREFS } from '@/screens/track/format';
import { TRENDS } from './metrics';
import { dailyView, trendContext } from './model';
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
