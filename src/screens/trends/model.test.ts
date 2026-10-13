import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { WorkoutSession } from '@/types';
import type { CheckInRecord } from '@/types/checkin';
import { bpContext, newObservation, type Observation } from '@/health/observation';
import { weekdayOf } from '@/health/status';
import { DEFAULT_PREFS } from '@/screens/track/format';
import { addDays } from '@/screens/track/periods';
import { buildSessionPlan } from '@/engine/session';
import { createDefaultProfile } from '@/profile/defaults';
import { startWorkout, toSession, workoutReducer } from '@/screens/workout/model';
import { TRENDS, hasData } from './metrics';
import { dailyView, labsView, latestLab, readingCount, readingsView, trendContext, trendRow, trendSections, type TrendRowView } from './model';
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
    expect(view.notes).toEqual(['Includes 10 min on 2 Away days, not in the average.', 'Includes 1 rest day with nothing recorded, not in the average.']);
    expect(view.stats).toEqual([{ label: 'Days with time recorded', value: '5' }, { label: 'Highest day', value: '40 min · Thu 1 Oct' }]);
  });

  it('shades Away and rest days and never draws them as zero; a walk on an Away day still counts', () => {
    expect(view.chart.series[1].kind === 'bars' && view.chart.series[1].values).toEqual([30, 20, null, 40, 10, 20, null]);
    expect(view.chart.series[0].kind === 'bars' && view.chart.series[0].values).toEqual([20, 0, 30, 0, 10, 0, null]);
    expect(view.chart.slots[2]).toMatchObject({ mark: 'away', text: 'Wednesday, 30 September: Away. The week before: 30 min.' });
    expect(view.chart.slots[4]).toMatchObject({ mark: 'away', text: 'Friday, 2 October: 10 min (Away). The week before: 10 min.' });
    expect(view.chart.slots[6]).toMatchObject({ mark: 'rest', text: 'Sunday, 4 October: Rest day. The week before: Rest day.' });
    // Over the 4 Normal days with data, never the Away day's 10 minutes or the empty rest day (D125, KT-03, KT-08).
    expect(view.chart.average).toEqual({ value: 27.5, label: 'Average 28 min a day' });
  });

  it('sums the view up with its notes', () => {
    expect(view.summary).toBe('Walk, Last week. Total, 7 days: 120 min. Higher than the week before, +60 min, 28 Sep – 4 Oct vs 21–27 Sep. Includes 10 min on 2 Away days, not in the average. Includes 1 rest day with nothing recorded, not in the average.');
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
    expect(view.chart.slots[slot('2026-09-28')].text).toBe('28 Sep – 4 Oct: 5,500 steps a day on average, from 7 days with steps. The 6 months before, 31 Mar – 6 Apr: Not entered.');
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
    expect(view.chart.slots[10].text).toBe('September 2026: 110 min. The 12 months before, September 2025: Before your first record.');
    expect(view.chart.slots.every(s => s.day === undefined)).toBe(true);
    expect(view.table.columns).toEqual(['Month', 'Nov 2025 – Oct 2026', 'The 12 months before']);
  });
});

describe('the period before, slot by slot, over the same days (H3-13)', () => {
  // 30 minutes of walking every day from 1 November 2024 to today, Thursday 8 October 2026.
  const days = Array.from({ length: 707 }, (_, i) => addDays('2024-11-01', i)).filter(d => d <= TODAY);
  const every = data(days.flatMap((d, i) => walk(`e${i}`, d, 30)));
  const c = ctx({ since: '2024-11-01' });

  it('Year: this October so far beside the same days of last October, both named, never the whole month', () => {
    const year = dailyView({ def: TRENDS.walk, window: windowOf('year', TODAY), data: every, prefs, ctx: c });
    const october = year.chart.slots.findIndex(s => s.key === '2026-10-01');
    const [previous, current] = year.chart.series;
    expect([previous.kind === 'bars' && previous.values[october], current.kind === 'bars' && current.values[october]]).toEqual([240, 240]);
    expect(year.chart.slots[october].text).toBe('October 2026: 240 min. The 12 months before, 1–8 Oct 2025: 240 min.');
    // A month wholly past is set beside the whole of the same month a year before.
    expect(year.chart.slots[october - 1].text).toBe('September 2026: 900 min. The 12 months before, September 2025: 900 min.');
    expect(year.table.rows.at(-1)).toEqual(['October 2026', '240 min', '240 min, 1–8 Oct 2025']);
  });

  it('6 Months: each week beside the same days from the start of the 6 months before, as long as it', () => {
    const six = dailyView({ def: TRENDS.walk, window: windowOf('sixMonths', TODAY), data: every, prefs, ctx: c });
    const [previous, current] = six.chart.series;
    if (previous.kind !== 'bars' || current.kind !== 'bars') throw new Error('bars');
    // 1–3 May is three days: beside 1–3 November, never the two days of 1–2 November's week.
    expect(six.chart.slots[0].text).toBe('1–3 May: 90 min. The 6 months before, 1–3 Nov 2025: 90 min.');
    // This week so far, Monday to Thursday, beside the same 4 days: the comparison's own days (A-42).
    const now = six.chart.slots.findIndex(s => s.key === '2026-10-05');
    expect([previous.values[now], current.values[now]]).toEqual([120, 120]);
    expect(six.chart.slots[now].text).toBe('5–11 Oct: 120 min. The 6 months before, 7–10 Apr: 120 min.');
    expect(six.change).toMatchObject({ text: 'The same as the 6 months before', compared: '1 May – 8 Oct vs 1 Nov 2025 – 10 Apr 2026' });
    // The 6 months before are 3 days shorter: the last week has 28–30 April behind it, never 1–2 May, this window's own.
    expect(previous.values.at(-1)).toBe(90);
    expect(six.chart.slots.at(-1)?.text).toBe('26–31 Oct: Still to come. The 6 months before, 28–30 Apr: 90 min.');
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
    expect(view.notes).toEqual(['Includes 20 min on 1 Away day, not in the average.']);
    // 30 on Monday over the record's other 10 days, a week on average: never the Away day's 20.
    expect(view.headline).toEqual({ statistic: 'A week on average', coverage: 'from 10 days', value: '21', unit: 'min' });
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
    // FitStrong walks only is a lower bound too (D127, H3-11).
    expect(view.chart.slots[2].text).toBe('Wednesday, 7 October: at least 4,210 steps, in FitStrong walks · day total not entered. Last week: Not entered.');
    expect(view.notes).toEqual(['2 days show at least the steps counted: FitStrong walks only, or walks after a total was entered.']);
    expect(view.headline).toEqual({ statistic: 'A day on average', coverage: '2 days with steps', value: 'at least 5,755', unit: 'steps' });
    expect(view.stats).toEqual([{ label: 'Days with steps', value: '2' }, { label: 'Highest', value: 'at least 7,300 steps · Thu 8 Oct' }]);
    expect(view.chart.average?.label).toBe('Average: at least 5,755 steps a day');
  });

  it('a lower bound is never set against a whole total: no exact change (D127, H3-11)', () => {
    // Last week's Monday to Wednesday were entered totals of 6,000; this week's are FitStrong walks of 1,000 each.
    const obs = [
      ...['2026-09-28', '2026-09-29', '2026-09-30'].map(d => steps(d, 6000)),
      ...['2026-10-05', '2026-10-06', '2026-10-07'].flatMap((d, i) => walk(`p${i}`, d, 10, { count: 1000 })),
    ];
    const partial = dailyView({ def: TRENDS.steps, window: windowOf('week', TODAY), data: data(obs), prefs, ctx: ctx() });
    expect(partial.change).toEqual({ text: 'No change shown: on some of these days only part of the day’s steps is known.' });
    expect(partial.headline.value).toBe('at least 1,000');
    expect(trendRow(TRENDS.steps, data(obs), prefs, ctx()).value).toBe('A day on average this week: at least 1,000 steps');
    // In 6 Months, each week's bar says so too.
    const six = dailyView({ def: TRENDS.steps, window: windowOf('sixMonths', TODAY), data: data(obs), prefs, ctx: ctx() });
    expect(six.chart.slots.find(s => s.key === '2026-10-05')?.text.startsWith('5–11 Oct: at least 1,000 steps a day on average, from 3 days with steps.')).toBe(true);
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

  it('compares means over the same days, with 3 days in both weeks, one kind of reading at a time (KT-07)', () => {
    // Last week's were all fasting; this week's are a mix with one fasting: no one kind has 3 days in both.
    expect(view.change).toEqual({ text: 'Comparisons start once one kind of reading, such as fasting, has 3 days in both weeks.' });
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
    // Each pain its own coverage: the headline counts back pain's readings, the leg's stat its own (H3-07).
    expect(back.headline).toEqual({ statistic: 'Back pain on average', coverage: '2 readings, all with a number', value: '5.0', unit: 'of 10' });
    expect(back.stats).toEqual([
      { label: 'Range, back', value: '4.0–6.0 of 10' }, { label: 'Range, leg', value: '2.0–3.0 of 10' }, { label: 'Leg pain on average', value: '2.5 of 10, 2 readings' },
    ]);
    expect(back.chart.average).toBeUndefined();
  });

  it('leg pain with back pain left blank, as the form allows: no back readings, and the leg’s figure (H3-07)', () => {
    const leg = readingsView({ def: TRENDS.back, window: week, prefs, ctx: ctx(), data: data([pain('legPain', 2, '2026-10-05')]) });
    expect(leg.headline).toEqual({ statistic: 'Back pain on average', coverage: '0 readings', value: 'No back readings' });
    expect(leg.stats).toEqual([{ label: 'Range, leg', value: '2.0–2.0 of 10' }, { label: 'Leg pain on average', value: '2.0 of 10, 1 reading' }]);
    expect(readingsView({ def: TRENDS.back, window: week, prefs, ctx: ctx(), data: data([]) }).headline.value).toBe('No readings');
  });

  it('6 Months: each week’s range and mean, in words and as a list by week', () => {
    const six = readingsView({ def: TRENDS.glucose, window: windowOf('sixMonths', TODAY), data: data(GLUCOSE), prefs, ctx: ctx() });
    const slot = (key: string) => six.chart.slots.findIndex(s => s.key === key);
    expect(six.headline).toEqual({ statistic: 'Average', coverage: '7 readings, all with a number', value: '141', unit: 'mg/dL' });
    // A range for each context (H3-08): fasting, after a meal and other times, never one of all of them.
    expect(six.chart.series.map(s => s.kind === 'ranges' && [s.label, s.values[slot('2026-09-28')], s.values[slot('2026-10-05')], s.values[slot('2026-09-21')]])).toEqual([
      ['Fasting or before a meal', { min: 118, max: 122, mean: 120 }, { min: 118, max: 118, mean: 118 }, null],
      ['After a meal', null, { min: 168, max: 280, mean: 224 }, null],
      ['Other times', null, { min: 62, max: 62, mean: 62 }, null],
    ]);
    expect(six.chart.slots[slot('2026-09-28')].text).toBe('28 Sep – 4 Oct: Fasting or before a meal: 3 readings, 118 to 122 mg/dL, average 120 mg/dL.');
    expect(six.chart.slots[slot('2026-09-21')].text).toBe('21–27 Sep: No readings.');
    expect(six.chart.slots[slot('2026-10-12')].text).toBe('12–18 Oct: Still to come.');
    expect(six.chart.slots.every(s => s.day === undefined)).toBe(true);
    expect(six.table).toEqual({
      columns: ['Week', 'Readings', 'Range', 'Average'],
      rows: [
        ['28 Sep – 4 Oct · Fasting or before a meal', '3', '118–122 mg/dL', '120 mg/dL'],
        ['5–11 Oct · Fasting or before a meal', '1', '118–118 mg/dL', '118 mg/dL'],
        ['5–11 Oct · After a meal', '2', '168–280 mg/dL', '224 mg/dL'],
        ['5–11 Oct · Other times', '1', '62–62 mg/dL', '62 mg/dL'],
      ],
    });
  });

  it('6 Months and Year: each glucose context its own range, shape and words, never one mixed range (H3-08, KT-07)', () => {
    const at = (day: string, time: string) => `${day}T${time}:00+05:30`;
    const both = data([g(100, at('2026-10-05', '07:30'), 'fasting'), g(200, at('2026-10-05', '14:00'), 'afterMeal')]);
    const six = readingsView({ def: TRENDS.glucose, window: windowOf('sixMonths', TODAY), data: both, prefs, ctx: ctx() });
    const i = six.chart.slots.findIndex(s => s.key === '2026-10-05');
    expect(six.chart.series.map(s => s.kind === 'ranges' && [s.id, s.label, s.shape, s.values[i]])).toEqual([
      ['beforeMeal', 'Fasting or before a meal', 'circle', { min: 100, max: 100, mean: 100 }],
      ['afterMeal', 'After a meal', 'triangle', { min: 200, max: 200, mean: 200 }],
    ]);
    expect(six.chart.slots[i].text).toBe('5–11 Oct: Fasting or before a meal: 1 reading, 100 to 100 mg/dL, average 100 mg/dL; After a meal: 1 reading, 200 to 200 mg/dL, average 200 mg/dL.');
    expect(six.table.rows).toEqual([
      ['5–11 Oct · Fasting or before a meal', '1', '100–100 mg/dL', '100 mg/dL'],
      ['5–11 Oct · After a meal', '1', '200–200 mg/dL', '200 mg/dL'],
    ]);
    const year = readingsView({ def: TRENDS.glucose, window: windowOf('year', TODAY), data: both, prefs, ctx: ctx() });
    expect(year.chart.series.map(s => s.label)).toEqual(['Fasting or before a meal', 'After a meal']);
  });

  it('a change compares like with like: one context at a time, named, never a mix (KT-07)', () => {
    const at = (day: string, time: string) => `${day}T${time}:00+05:30`;
    const fasting = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-05', '2026-10-06', '2026-10-07'].map((day, j) => g(j < 3 ? 110 : 116, at(day, '07:30'), 'fasting'));
    // This week also has after-meal readings: the mean of the mix would be "+36 mg/dL".
    const view = readingsView({ def: TRENDS.glucose, window: week, data: data([...fasting, g(180, at('2026-10-05', '14:00'), 'afterMeal'), g(190, at('2026-10-06', '14:00'), 'afterMeal')]), prefs, ctx: ctx() });
    expect(view.change).toEqual({ text: 'Higher than last week · +6 mg/dL, fasting or before a meal', direction: 'higher', compared: 'Mon–Thu vs last Mon–Thu' });
    // Two kinds each on 3 days in both: the first in the fixed order, fasting, as the series are listed.
    const afterMeals = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-05', '2026-10-06', '2026-10-07'].map((day, j) => g(j < 3 ? 200 : 180, at(day, '14:00'), 'afterMeal'));
    expect(readingsView({ def: TRENDS.glucose, window: week, data: data([...fasting, ...afterMeals]), prefs, ctx: ctx() }).change.text)
      .toBe('Higher than last week · +6 mg/dL, fasting or before a meal');
    // With no one kind on 3 days in both weeks, no change: GLUCOSE's mix had a fasting week before an after-meal one.
    expect(readingsView({ def: TRENDS.glucose, window: week, data: data(GLUCOSE), prefs, ctx: ctx() }).change)
      .toEqual({ text: 'Comparisons start once one kind of reading, such as fasting, has 3 days in both weeks.' });
  });

  it('6 Months and Year say and list every plotted series: both numbers of a pressure, back and leg (H3-15)', () => {
    const year = readingsView({ def: TRENDS.bp, window: windowOf('year', TODAY), data: data(reading('2026-10-05', 150, 95)), prefs, ctx: ctx() });
    const october = year.chart.slots.findIndex(s => s.key === '2026-10-01');
    expect(year.chart.slots[october].text)
      .toBe('October 2026: Top number (systolic): 1 reading, 150 to 150 mmHg, average 150 mmHg; Bottom number (diastolic): 1 reading, 95 to 95 mmHg, average 95 mmHg.');
    expect(year.table.rows).toEqual([
      ['October 2026 · Top number (systolic)', '1', '150–150 mmHg', '150 mmHg'], ['October 2026 · Bottom number (diastolic)', '1', '95–95 mmHg', '95 mmHg'],
    ]);
    const back = readingsView({ def: TRENDS.back, window: windowOf('sixMonths', TODAY), data: data([pain('backPain', 4, '2026-10-05'), pain('legPain', 2, '2026-10-05')]), prefs, ctx: ctx() });
    expect(back.table.rows).toEqual([['5–11 Oct · Back pain', '1', '4.0–4.0 of 10', '4.0 of 10'], ['5–11 Oct · Leg pain', '1', '2.0–2.0 of 10', '2.0 of 10']]);
  });

  it('a week or a month with a meter’s LO or HI says it and lists it, dated, number or not (H3-15)', () => {
    const six = readingsView({ def: TRENDS.glucose, window: windowOf('sixMonths', TODAY), data: data([], [], [display('2026-10-06', 'LO', '13:00')]), prefs, ctx: ctx() });
    const i = six.chart.slots.findIndex(s => s.key === '2026-10-05');
    expect(six.chart.slots[i].text).toBe('5–11 Oct: Meter showed LO on Tue 6 Oct at 1:00 pm.');
    expect(six.table.rows).toEqual([['5–11 Oct · Meter', 'LO on Tue 6 Oct at 1:00 pm', 'Below what the meter can show', '']]);
    const year = readingsView({ def: TRENDS.glucose, window: windowOf('year', TODAY), data: data([g(140, at('2026-10-05', '07:30'))], [], [display('2026-10-07', 'HI', '21:00')]), prefs, ctx: ctx() });
    const october = year.chart.slots.findIndex(s => s.key === '2026-10-01');
    expect(year.chart.slots[october].text).toBe('October 2026: 1 reading, 140 to 140 mg/dL, average 140 mg/dL; Meter showed HI on Wed 7 Oct at 9:00 pm.');
    expect(year.table.rows).toEqual([
      ['October 2026', '1', '140–140 mg/dL', '140 mg/dL'],
      ['October 2026 · Meter', 'HI on Wed 7 Oct at 9:00 pm', 'Above what the meter can show', ''],
    ]);
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
    expect(view.summary).toBe('HbA1c. Latest, 3 results: 6.9%, measured on Wednesday, 7 October. The first was on Monday, 2 March.');
    const turning = labsView('hba1c', data([lab('hba1c', 7.4, '2025-11-20'), lab('hba1c', 7.0, '2026-02-03')]), prefs, '2026-02-10');
    expect(turning.chart.slots.map(s => s.label)).toEqual(['Nov 2025', 'Dec', 'Jan 2026', 'Feb']);
  });

  it('the latest result says when it was measured, beside it and in the summary (H3-05, J§4.10)', () => {
    const view = labsView('hba1c', data([lab('hba1c', 7.4, '2025-11-20'), lab('hba1c', 7.0, '2026-03-02')]), prefs, TODAY);
    expect(view.headline).toEqual({ statistic: 'Latest', coverage: '2 results', value: '7.0%' });
    expect(view.change).toEqual({ text: 'Measured Monday, 2 March · 3 months after the one before' });
    expect(view.summary).toBe('HbA1c. Latest, 2 results: 7.0%, measured on Monday, 2 March. The first was on Thursday, 20 November 2025.');
    const one = labsView('hba1c', data([lab('hba1c', 7.4, '2025-11-20')]), prefs, TODAY);
    expect(one.change).toEqual({ text: 'Measured Thursday, 20 November 2025 · First result' });
    expect(labsView('b12', data([]), prefs, TODAY).change).toEqual({ text: 'No results yet. Add one in Labs.' });
  });

  it('a row’s date carries its year when it isn’t this year’s (H3-05)', () => {
    expect(trendRow(TRENDS.labs, data([lab('hba1c', 7.4, '2025-11-20')]), prefs, ctx()).value).toBe('Latest HbA1c: 7.4% · Thu 20 Nov 2025');
    const old = g(118, '2025-12-30T07:30:00+05:30');
    expect(trendRow(TRENDS.glucose, data([old]), prefs, ctx({ since: '2025-12-30' })).value).toBe('Latest: 118 mg/dL at 7:30 am · Tue 30 Dec 2025');
  });

  it('the Labs row opens the lab it names: one rule, the latest result of any lab (H3-20)', () => {
    const both = data([lab('hba1c', 7.1, '2026-03-02'), lab('b12', 410, '2026-06-02')]);
    expect(trendRow(TRENDS.labs, both, prefs, ctx())).toMatchObject({ value: 'Latest Vitamin B12: 410 pg/mL · Tue 2 Jun', search: '?metric=b12' });
    expect(latestLab(both.observations, prefs)?.lab).toBe('b12');
    expect(latestLab([], prefs)).toBeUndefined();
    expect(trendRow(TRENDS.labs, data([]), prefs, ctx()).search).toBeUndefined();
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

describe('Trends’ rows, at most 5 to a region (H3-22, KT-12, B-08)', () => {
  const row = (id: TrendRowView['id']): TrendRowView => ({ id, title: TRENDS[id].title, colour: TRENDS[id].colour, value: '', spark: [] });
  const of = (ids: TrendRowView['id'][]) => trendSections(ids.map(row)).map(s => [s.title, s.rows.map(r => r.id)]);

  it('a group of more than 5 is cut into labelled parts, in the registry’s order, every category kept', () => {
    expect(of(['workout', 'walk', 'glucose', 'bp', 'back', 'weight', 'water', 'sleep', 'waist', 'labs', 'mood'])).toEqual([
      ['Move', ['workout', 'walk']],
      ['Check', ['glucose', 'bp', 'back', 'weight']],
      ['Check, continued', ['water', 'sleep', 'waist', 'labs']],
      ['Other records', ['mood']],
    ]);
    expect(of(['glucose', 'bp', 'back', 'weight', 'water', 'sleep'])).toEqual([['Check', ['glucose', 'bp', 'back']], ['Check, continued', ['weight', 'water', 'sleep']]]);
  });

  it('5 or fewer stay one region; a group with none has none', () => {
    expect(of(['glucose', 'bp', 'back', 'weight', 'water'])).toEqual([['Check', ['glucose', 'bp', 'back', 'weight', 'water']]]);
    expect(of(['steps'])).toEqual([['Move', ['steps']]]);
    expect(of([])).toEqual([]);
  });
});

describe('a workout logged by hand counts in the Workout trend (KT-10, J§12.3)', () => {
  it('stored as the log screen stores it (an unguided session), its entered minutes on its own day', () => {
    // Monday 5 October's Lower A, logged at /hub/workout/log: one set at 9 am, finished at 10 with 40 active minutes entered.
    const plan = buildSessionPlan({ profile: createDefaultProfile({ weightKg: 80 }), date: '2026-10-05', startDate: '2026-09-28', sessions: [] });
    const nine = Date.parse('2026-10-05T09:00:00+05:30');
    const logged = toSession([
      { type: 'log' as const, key: 'lowerA.main', reps: 10, weightKg: 20, now: nine },
      { type: 'finish' as const, now: nine + 3_600_000, notes: '', activeMinutes: 40 },
    ].reduce(workoutReducer, startWorkout(plan, { id: 'logged-1', defaultRest: 90 })));
    expect([logged.guided, logged.date, logged.durationSeconds]).toEqual([undefined, '2026-10-05', 2400]);
    expect(hasData('workout', data([], [logged]))).toBe(true);
    const view = dailyView({ def: TRENDS.workout, window: windowOf('week', TODAY), data: data([], [logged]), prefs, ctx: ctx() });
    expect(view.headline).toMatchObject({ statistic: 'Total', value: '40', unit: 'min' });
    expect(view.chart.slots[0].text).toBe('Monday, 5 October: 40 min. Last week: 0 min.');
  });
});

describe('a glucose change is worked out from the figures as shown, a line’s extra decimal included (codex F-ui-07, KT-01)', () => {
  const at = (day: string) => `${day}T07:30:00+05:30`;
  const fasting = (pairs: [string, number][]) => pairs.map(([day, value]) => g(value, at(day), 'fasting'));
  const earlier = fasting([['2026-09-21', 249], ['2026-09-22', 250], ['2026-09-23', 250]]);
  const later = fasting([['2026-09-28', 251], ['2026-09-29', 250], ['2026-09-30', 250]]);
  const view = (week: string, readings: Observation[]) =>
    readingsView({ def: TRENDS.glucose, window: windowOf('week', week), data: data(readings), prefs, ctx: ctx({ since: '2026-09-21' }) });

  it('250 and 250.3 mg/dL on screen are never “the same”: the change is their difference, 0.3', () => {
    // The earlier week's mean, 249.67, is shown as 250; the later one's, 250.33, keeps its decimal by the 250 line.
    expect(view('2026-09-23', earlier).headline).toMatchObject({ value: '250', unit: 'mg/dL' });
    const shown = view('2026-09-30', [...earlier, ...later]);
    expect(shown.headline).toMatchObject({ value: '250.3', unit: 'mg/dL' });
    expect(shown.change.text).toBe('Higher than the week before · +0.3 mg/dL');
    // The other way round, lower by the same.
    const back = fasting([['2026-09-28', 249], ['2026-09-29', 250], ['2026-09-30', 250]]);
    const ahead = fasting([['2026-09-21', 251], ['2026-09-22', 250], ['2026-09-23', 250]]);
    expect(view('2026-09-30', [...ahead, ...back]).change.text).toBe('Lower than the week before · −0.3 mg/dL');
  });

  it('figures that need no extra decimal compare as before, in the unit’s precision', () => {
    const plain = fasting([['2026-09-21', 120], ['2026-09-22', 121], ['2026-09-23', 122], ['2026-09-28', 121.2], ['2026-09-29', 121], ['2026-09-30', 120.9]]);
    expect(view('2026-09-30', plain).change.text).toBe('The same as the week before');
  });
});
