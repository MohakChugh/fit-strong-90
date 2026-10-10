/**
 * The Trends list on My Day: one row per measure this person actually keeps,
 * with the latest value and how often it was recorded this week. No
 * sparklines — the second line is words, and the chart is one tap away.
 */

import type { UserProfile } from '@/types/profile';
import { pairBloodPressure, series } from '@/health/aggregate';
import type { Observation } from '@/health/observation';
import { formatDayShort, formatObservation, sourceLabel, type DisplayPrefs } from './format';
import { METRICS, metricPath, trackedMetrics, type MetricId } from './metrics';
import { addDays, today, weekOf } from './periods';
import { formatPressure } from './timeline';

export interface TrendRow {
  metric: MetricId;
  title: string;
  /** The latest value on or before the day, or "Not entered". */
  value: string;
  detail: string;
  to: string;
}

export interface TrendData {
  observations: readonly Observation[];
  profile?: UserProfile;
}

/**
 * "this week" when the day is in the current week, otherwise "in the week of
 * 28 Sep". Weeks run Monday to Sunday (board D31).
 */
export function weekPhrase(asOf: string, current: string = today()): string {
  const week = weekOf(asOf).from;
  return week === weekOf(current).from ? 'this week' : `in the week of ${formatDayShort(week, current)}`;
}

function counted(n: number, one: string, many: string, phrase: string): string {
  if (n === 0) return `None ${phrase}`;
  return `${n} ${n === 1 ? one : many} ${phrase}`;
}

function latestOf(observations: readonly Observation[]): Observation | undefined {
  let latest: Observation | undefined;
  for (const o of observations) if (!latest || Date.parse(o.at) > Date.parse(latest.at)) latest = o;
  return latest;
}

/** Saved together: the same source record, at the same moment. A check-in's context is the day's, so the moment tells its saves apart. */
function sameRecord(a: Observation, b: Observation): boolean {
  return a.context === b.context && Date.parse(a.at) === Date.parse(b.at);
}

/** Rows for every tracked metric, as of the end of `asOf`. */
export function trendRows(asOf: string, data: TrendData, prefs: DisplayPrefs, current: string = today()): TrendRow[] {
  const upTo = data.observations.filter(o => o.day <= asOf);
  const week = { from: weekOf(asOf).from, to: asOf };
  const inWeek = (o: { day: string }) => o.day >= week.from && o.day <= week.to;
  const phrase = weekPhrase(asOf, current);
  const when = (day: string) => (day === current ? 'Today' : day === addDays(current, -1) ? 'Yesterday' : formatDayShort(day, current));

  return trackedMetrics(data.observations, data.profile).map((metric): TrendRow => {
    const spec = METRICS[metric];
    const to = metricPath(metric);
    const base = { metric, title: spec.title, to };

    if (metric === 'bloodPressure') {
      const readings = pairBloodPressure(upTo.filter(o => spec.kinds.includes(o.kind)));
      const latest = readings.at(-1);
      return {
        ...base,
        value: latest ? formatPressure(latest) : 'Not entered',
        detail: latest
          ? `${counted(readings.filter(inWeek).length, 'reading', 'readings', phrase)} · ${sourceLabel(latest.halves[0])}`
          : 'No readings yet',
      };
    }

    if (metric === 'backLeg') {
      const pain = upTo.filter(o => spec.kinds.includes(o.kind));
      const days = new Set(pain.filter(inWeek).map(o => o.day)).size;
      // The latest record, and only what it held: a check-in, a session's
      // pain afterwards or an Add are each one moment with one source, and a
      // leg score from the morning is not shown under "After a session" (J2-13).
      const newest = latestOf(pain);
      const record = newest ? pain.filter(o => sameRecord(o, newest)) : [];
      const back = record.find(o => o.kind === 'backPain');
      const leg = record.find(o => o.kind === 'legPain');
      const parts = [back && `Back ${back.value}`, leg && `Leg ${leg.value}`].filter(Boolean);
      return {
        ...base,
        value: parts.length > 0 ? parts.join(' · ') : 'Not entered',
        detail: newest ? `${counted(days, 'day recorded', 'days recorded', phrase)} · ${sourceLabel(newest)}` : 'No readings yet',
      };
    }

    const kind = spec.kinds[0];
    const own = upTo.filter(o => o.kind === kind);

    if (spec.chart === 'bar') {
      // Day totals (and a walk's observed minutes) come from the aggregate,
      // which applies the replace rule and refuses to double-count.
      const scope = metric === 'walking' ? 'sessionObserved' : 'dayTotal';
      const points = own.length > 0
        ? series(kind, { from: own.reduce((min, o) => (o.day < min ? o.day : min), asOf), to: asOf }, own).points.filter(p => p.scope === scope)
        : [];
      const latest = points.at(-1);
      if (!latest) return { ...base, value: 'Not entered', detail: 'Nothing recorded yet' };
      const daysThisWeek = points.filter(inWeek).length;
      const value = formatObservation({ kind, value: latest.value, unit: latest.observations[0].unit }, prefs);
      const tail = `${counted(daysThisWeek, 'day', 'days', phrase)} · ${sourceLabel(latest.observations[0])}`;
      // A day total is about its own day: yesterday's steps are not today's,
      // so the day looked at says it is not entered, and the last one follows (J01).
      if (scope === 'dayTotal' && latest.day !== asOf) {
        return {
          ...base,
          value: asOf === current ? 'Not entered today' : `Not entered on ${formatDayShort(asOf, current)}`,
          detail: `${when(latest.day)}: ${value} · ${tail}`,
        };
      }
      return { ...base, value, detail: `${when(latest.day)} · ${tail}` };
    }

    const readings = own.filter(o => o.scope === 'pointInTime');
    const latest = latestOf(readings);
    if (!latest) return { ...base, value: 'Not entered', detail: 'No readings yet' };
    const isLab = metric === 'hba1c' || metric === 'b12' || metric === 'vitaminD';
    return {
      ...base,
      value: formatObservation(latest, prefs),
      detail: `${isLab
        ? `Tested ${formatDayShort(latest.day, current)}`
        : counted(readings.filter(inWeek).length, 'reading', 'readings', phrase)} · ${sourceLabel(latest)}`,
    };
  });
}
