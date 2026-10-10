/**
 * Your week (journey §12.1, §12.6; B-15, B-16, B-20): up to 4 factual
 * sentences about a Monday-to-Sunday week, never praise or blame; the rings
 * of the last 8 weeks; and when "Your week in brief" is offered. None of it
 * shows while the status isn't Normal or a safety decision stands. There is
 * no weight, waist or food sentence, and no sentence about how often anyone
 * tests (A-15, K-51).
 */
import { format } from 'date-fns';
import type { DayRange } from '@/health/aggregate';
import type { Status } from '@/health/status';
import type { DisplayPrefs } from '@/screens/track/format';
import { recordedMovement, wholeMinutes } from '@/screens/track/movement';
import { addDays, daysIn, mondayOf, today as dayOf, weekOf } from '@/screens/track/periods';
import { formatNumber } from '@/screens/track/units';
import { pendingWeeklyGoal, weeklyGoalOn, type WeeklyGoalSettings } from '@/screens/track/weeklyGoal';
import { GLUCOSE_LINES, readingsFor } from './metrics';
import { countText } from './model';
import { stepsDays, stretchedDays, type TrendData } from './records';
import { MIN_DAYS, dailyStats, readingStats, type DayContext, type DayFigure } from './stats';

const noon = (day: string) => new Date(`${day}T12:00:00`);

export interface WeekFacts {
  /** The week's Monday. */
  week: string;
  /** "This week", "Last week", "Week of 21 Sep". */
  title: string;
  /** In a sentence: "this week", "last week", "in the week of 21 Sep". */
  name: string;
  /** Recorded movement in whole minutes (§12.3), to today in the current week. */
  minutes: number;
  /** The same days of the week before, when that week is all part of the record. */
  before?: number;
  /** "by this time last week", "the week before". */
  beforeName: string;
  stretchDays: number;
  steps?: { perDay: number; days: number };
  glucose?: { numeric: number; lo: number; hi: number; lows: number; highs: number };
  pressure?: { readings: number; severe: number };
}

export function weekFacts({ week, data, prefs, ctx }: { week: string; data: TrendData; prefs: DisplayPrefs; ctx: DayContext }): WeekFacts {
  const range = weekOf(week);
  const current = range.from <= ctx.today && ctx.today <= range.to;
  const shown: DayRange = { from: range.from, to: current ? ctx.today : range.to };
  const last = range.from === addDays(mondayOf(ctx.today), -7);
  const short = format(noon(range.from), 'd MMM');
  const prior: DayRange = { from: addDays(shown.from, -7), to: addDays(shown.to, -7) };
  const moved = (r: DayRange) => wholeMinutes(recordedMovement(r, data.observations, data.sessions).minutes);
  // Days of data as a movement trend counts them, from each day's recorded movement (B-15, D68).
  const enough = (r: DayRange) => dailyStats(r, daysIn(r).flatMap((day): DayFigure[] => {
    const minutes = recordedMovement({ from: day, to: day }, data.observations, data.sessions).minutes;
    return minutes > 0 ? [{ day, value: minutes }] : [];
  }), ctx, 'counted').days >= MIN_DAYS;
  const steps = dailyStats(shown, stepsDays(shown, data.observations, prefs.hour12), ctx, 'stated');
  const glucose = readingsFor('glucose', shown, data, prefs);
  const g = readingStats(shown, glucose.points, glucose.meters, ctx);
  const pressure = readingsFor('bp', shown, data, prefs).texts;
  return {
    week: range.from,
    title: current ? 'This week' : last ? 'Last week' : `Week of ${short}`,
    name: current ? 'this week' : last ? 'last week' : `in the week of ${short}`,
    minutes: moved(shown),
    // Only a week wholly in the record is compared: before the first record there was nothing to count (Review Focus 4);
    // and, as every trend's comparison, with 3 days of data in both (H3-12).
    ...(ctx.since !== undefined && ctx.since <= prior.from && enough(shown) && enough(prior) ? { before: moved(prior) } : {}),
    beforeName: current ? 'by this time last week' : 'the week before',
    stretchDays: [...stretchedDays(data.sessions)].filter(d => d >= shown.from && d <= shown.to).length,
    ...(steps.perDay !== undefined ? { steps: { perDay: steps.perDay, days: steps.days } } : {}),
    ...(g.n + g.hi + g.lo > 0 ? { glucose: { numeric: g.n, lo: g.lo, hi: g.hi, lows: g.lows, highs: g.highs } } : {}),
    ...(pressure.length > 0 ? { pressure: { readings: pressure.length, severe: pressure.filter(t => t.note === 'Very high').length } } : {}),
  };
}

/** At most 4 sentences: movement, stretching, the readings with their context, then steps (§12.1). Facts, never verdicts. */
export function weekSentences(f: WeekFacts, prefs: DisplayPrefs): string[] {
  const out: string[] = [];
  if (f.minutes > 0) {
    const moved = `You moved ${countText(f.minutes, ['minute', 'minutes'])} ${f.name}`;
    const diff = f.before === undefined ? undefined : f.minutes - f.before;
    out.push(diff === undefined ? `${moved}.`
      : diff === 0 ? `${moved}, the same as ${f.beforeName}.`
        : `${moved}, ${formatNumber(Math.abs(diff))} ${diff > 0 ? 'more' : 'fewer'} than ${f.beforeName}.`);
  }
  if (f.stretchDays > 0) out.push(`You stretched on ${countText(f.stretchDays, ['day', 'days'])} ${f.name}.`);
  if (f.glucose) {
    const { numeric, lo, hi, lows, highs } = f.glucose;
    const meter = [lo > 0 ? `${formatNumber(lo)} meter LO` : '', hi > 0 ? `${formatNumber(hi)} meter HI` : ''].filter(Boolean).join(' and ');
    const line = GLUCOSE_LINES[prefs.glucose];
    const past = [
      lows > 0 ? `${formatNumber(lows)} ${lows === 1 ? 'was' : 'were'} below ${line.low}` : '',
      highs > 0 ? `${formatNumber(highs)} ${highs === 1 ? 'was' : 'were'} above ${line.high}` : '',
    ].filter(Boolean).join(' and ');
    out.push(`${countText(numeric + lo + hi, ['glucose reading', 'glucose readings'])} ${f.name}${meter ? ` (${formatNumber(numeric)} with a number, ${meter})` : ''}${past ? `; ${past}` : ''}.`);
  }
  if (f.pressure) {
    const { readings, severe } = f.pressure;
    out.push(`${countText(readings, ['blood pressure reading', 'blood pressure readings'])} ${f.name}${severe > 0 ? `; ${formatNumber(severe)} ${severe === 1 ? 'was' : 'were'} 180/120 mmHg or higher` : ''}.`);
  }
  if (f.steps) out.push(`${formatNumber(f.steps.perDay)} steps a day on average ${f.name}, from ${countText(f.steps.days, ['day with steps', 'days with steps'])}.`);
  return out.slice(0, 4);
}

/** Why Your week is paused today, or nothing: a safety decision stands, or the status isn't Normal (§12.6). */
export function briefPause({ status, urgent }: { status: Status; urgent: boolean }): 'status' | 'safety' | undefined {
  if (urgent) return 'safety';
  return status === 'normal' ? undefined : 'status';
}

export interface WeekRing {
  /** Monday. */
  week: string;
  minutes: number;
  /** The goal the week had (B-16); none drawn without one. */
  goal?: number;
  current: boolean;
}

/** The last 8 weeks, oldest first, each against the goal it had (B-16), drawn set (M21). */
export function weekRings(today: string, data: TrendData, settings: WeeklyGoalSettings | undefined): WeekRing[] {
  const thisWeek = mondayOf(today);
  return Array.from({ length: 8 }, (_, i) => {
    const week = addDays(thisWeek, (i - 7) * 7);
    const goal = weeklyGoalOn(settings, week);
    return {
      week,
      minutes: wholeMinutes(recordedMovement(weekOf(week), data.observations, data.sessions).minutes),
      ...(goal !== undefined ? { goal } : {}),
      current: week === thisWeek,
    };
  });
}

/** A ring's name, with its visible date in it (WCAG 2.5.3): "Week of 21 Sep: 96 of 150 min". */
export function ringLabel(r: WeekRing): string {
  const name = r.current ? 'This week' : `Week of ${format(noon(r.week), 'd MMM')}`;
  return r.goal === undefined ? `${name}: ${formatNumber(r.minutes)} min moved` : `${name}: ${formatNumber(r.minutes)} of ${formatNumber(r.goal)} min`;
}

/** A goal change waiting for Monday, said beside the rings (B-16). */
export function pendingGoalText(settings: WeeklyGoalSettings | undefined, today: string): string | undefined {
  const p = pendingWeeklyGoal(settings, today);
  if (!p) return undefined;
  const on = format(noon(p.from), 'EEEE d MMMM');
  return p.goal === undefined ? `From ${on}, no weekly goal.` : `From ${on}, your weekly goal is ${formatNumber(p.goal)} min.`;
}

/** Content state's key for the weeks whose brief was opened: backed up with the record (B-20: once seen, it stays seen). */
export const WEEK_BRIEF_KEY = 'trends:weekBrief';

/** The Mondays whose brief was opened, read from content state; anything else there is ignored. */
export function briefSeen(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((w): w is string => typeof w === 'string') : [];
}

/** The list with `week` opened, the last 8 kept. */
export function withSeen(seen: readonly string[], week: string): string[] {
  return [...seen.filter(w => w !== week), week].slice(-8);
}

/** Last week's brief, from Monday 04:00 until it's opened or the week is over (B-20, L-18), when last week has something to say. */
export function weekBriefFor({ now, seen, hasFacts }: { now: Date; seen: readonly string[]; hasFacts: boolean }): { week: string } | undefined {
  const day = dayOf(now);
  const monday = mondayOf(day);
  if (day === monday && now.getHours() < 4) return undefined;
  const week = addDays(monday, -7);
  return hasFacts && !seen.includes(week) ? { week } : undefined;
}
