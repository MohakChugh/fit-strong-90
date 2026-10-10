/**
 * The dated Status (board D25): Normal, Flare-up, Unwell or Away.
 *
 * A status is a period on the calendar, not a flag, so it can answer two
 * questions afterwards as well as now: which days were not normal days (they
 * leave every consistency figure), and how many planned sessions fell inside
 * one (the "move your plan back" offer). Periods are kept, never overwritten,
 * which is what lets a flare-up three weeks ago still explain a gap; the
 * offer's answer is kept on them too, so it is asked once.
 *
 * Days are local `YYYY-MM-DD` strings throughout. Both ends of a period are
 * inclusive; a period with no `to` is still going.
 */

import { addDays, differenceInCalendarDays, format, getDay, parseISO } from 'date-fns';
import type { DayOfWeek, StatusPeriod } from '@/types';
import { TOTAL_WEEKS } from '@/lib/utils';
import { isDay } from './observation';

export type Status = 'normal' | StatusPeriod['kind'];

export const STATUS_LABEL: Record<Status, string> = {
  normal: 'Normal',
  flare: 'Flare-up',
  unwell: 'Unwell',
  away: 'Away',
};

const KINDS: readonly StatusPeriod['kind'][] = ['flare', 'unwell', 'away'];

// ============================================================================
// Calendar days
// ============================================================================

/** A day moved by whole calendar days. Safe across daylight-saving changes. */
export function shiftDay(day: string, days: number): string {
  return format(addDays(parseISO(day), days), 'yyyy-MM-dd');
}

/** Calendar days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return differenceInCalendarDays(parseISO(to), parseISO(from));
}

const WEEKDAYS: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function weekdayOf(day: string): DayOfWeek {
  return WEEKDAYS[getDay(parseISO(day))];
}

/** Every day from `from` to `to`, inclusive. Empty when the range is inverted. */
export function daysFrom(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = shiftDay(d, 1)) out.push(d);
  return out;
}

// ============================================================================
// Reading periods
// ============================================================================

/**
 * A period that can be trusted: a known kind, real days, not inverted.
 * Settings can come from an imported file, so this is checked, not assumed.
 */
export function isValidPeriod(value: unknown): value is StatusPeriod {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Partial<StatusPeriod>;
  if (!KINDS.includes(p.kind as StatusPeriod['kind'])) return false;
  if (!isDay(p.from)) return false;
  if (p.to !== undefined && (!isDay(p.to) || p.to < p.from)) return false;
  return true;
}

function valid(periods: readonly StatusPeriod[] | undefined): StatusPeriod[] {
  return (periods ?? []).filter(isValidPeriod);
}

function covers(period: StatusPeriod, day: string): boolean {
  return period.from <= day && (period.to === undefined || day <= period.to);
}

/**
 * The period in force on a day. Periods written by this module never overlap;
 * if imported ones do, the one that started most recently is the one the
 * person set last, so it wins.
 */
export function periodOn(periods: readonly StatusPeriod[] | undefined, day: string): StatusPeriod | undefined {
  let found: StatusPeriod | undefined;
  for (const p of valid(periods)) {
    if (covers(p, day) && (found === undefined || p.from >= found.from)) found = p;
  }
  return found;
}

export function statusOn(periods: readonly StatusPeriod[] | undefined, day: string): Status {
  return periodOn(periods, day)?.kind ?? 'normal';
}

/** A day under any status. Such days are left out of every consistency figure (D25). */
export function isStatusDay(periods: readonly StatusPeriod[] | undefined, day: string): boolean {
  return periodOn(periods, day) !== undefined;
}

/** The days that count towards a consistency figure: the normal ones. */
export function countingDays(periods: readonly StatusPeriod[] | undefined, days: readonly string[]): string[] {
  return days.filter(day => !isStatusDay(periods, day));
}

// ============================================================================
// Changing the status
// ============================================================================

export interface StatusChange {
  /** What to store. Entries this module cannot read are carried through untouched. */
  periods: StatusPeriod[];
  /** False when the choice was already in force, so there is nothing to write. */
  changed: boolean;
}

/**
 * Set today's status. Pure: returns the periods to store.
 *
 * - The period in force today ends yesterday, because today is the day the
 *   new status starts. A period that only started today is removed instead:
 *   a same-day change of mind covered no day at all.
 * - A status other than Normal opens a new period from today, until `until`
 *   (inclusive) when one is given.
 * - Choosing the status already in force only moves its end date.
 * - Any other period covering today ends with it. The app never writes two at
 *   once, but an import can hold them, and Normal must mean that nothing
 *   covers today (codex F25); earlier history stays as it is.
 *
 * Whether there is now a plan offer to make is `endedRun`'s question, asked
 * of the periods this returns.
 *
 * `until` before today is a caller error: the sheet only offers today or later.
 */
export function changeStatus(
  periods: readonly StatusPeriod[] | undefined,
  next: Status,
  today: string,
  until?: string,
): StatusChange {
  if (!isDay(today)) throw new RangeError(`Not a YYYY-MM-DD day: ${today}`);
  if (until !== undefined && (!isDay(until) || until < today)) {
    throw new RangeError(`A status cannot end before it starts: ${String(until)} is before ${today}.`);
  }

  const all = [...(periods ?? [])];
  const current = periodOn(all, today);
  const yesterday = shiftDay(today, -1);
  const opened = (kind: StatusPeriod['kind']): StatusPeriod => ({ kind, from: today, ...(until !== undefined ? { to: until } : {}) });
  // Copied rather than rebuilt, so nothing else a period holds is lost on the way.
  const endingOn = (p: StatusPeriod, to: string | undefined): StatusPeriod => {
    const copy = { ...p };
    if (to === undefined) delete copy.to;
    else copy.to = to;
    return copy;
  };

  // What covers today, other than a period kept: each ends yesterday, or goes if it began today.
  const endAllBut = (kept: StatusPeriod | undefined): StatusPeriod[] => all.flatMap(p => {
    if (p === kept || !isValidPeriod(p) || !covers(p, today)) return [p];
    return p.from === today ? [] : [endingOn(p, yesterday)];
  });
  const others = all.some(p => p !== current && isValidPeriod(p) && covers(p, today));

  if (current?.kind === next) {
    if (current.to === until && !others) return { periods: all, changed: false };
    return { periods: sorted(endAllBut(current).map(p => (p === current ? endingOn(p, until) : p))), changed: true };
  }
  if (!current && next === 'normal') return { periods: all, changed: false };

  const after = endAllBut(undefined);
  return { periods: sorted(next === 'normal' ? after : [...after, opened(next)]), changed: true };
}

/** By start day; anything unreadable keeps its place at the end rather than being dropped. */
function sorted(periods: StatusPeriod[]): StatusPeriod[] {
  const readable = periods.filter(isValidPeriod).sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  return [...readable, ...periods.filter(p => !isValidPeriod(p))];
}

/**
 * The run the plan offer is about: the unbroken stretch of status that ended
 * most recently, when nothing is in force today and its offer has not been
 * answered. A flare-up that became a week of being unwell is one absence, not
 * two, so the run takes in every period touching or overlapping it, back to
 * one whose offer was answered: those days have been offered already. That
 * is what stops a status set again on the day of coming back from counting
 * the first absence a second time.
 *
 * Only the latest run is offered. An older one left unanswered had its offer
 * on Today until the next status began.
 */
export function endedRun(periods: readonly StatusPeriod[] | undefined, today: string): StatusPeriod[] | undefined {
  const all = valid(periods);
  if (periodOn(all, today)) return undefined;
  const ended = all.filter(p => p.to !== undefined && p.to < today);
  let last: StatusPeriod | undefined;
  for (const p of ended) {
    if (last?.to === undefined || (p.to as string) > last.to) last = p;
  }
  if (!last || last.planShift) return undefined;

  // Nothing ended after `last`, so a period joins the run when it reaches
  // the day before the run's first day, and the run grows back from there.
  const run = [last];
  let first = last.from;
  for (let grew = true; grew;) {
    grew = false;
    for (const p of ended) {
      if (run.includes(p) || p.planShift || (p.to as string) < shiftDay(first, -1)) continue;
      run.push(p);
      if (p.from < first) first = p.from;
      grew = true;
    }
  }
  return run.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
}

// ============================================================================
// Moving the plan back
// ============================================================================

/**
 * The days a run paused the programme: D25's "paused days", the N in "Move
 * your plan back N days?". Every calendar day of the run from the start date
 * to yesterday, each once.
 *
 * Calendar days, not missed sessions, because the programme's week is
 * counted in calendar days from `startDate`: moving the start by the days
 * paused puts the person back in the week they paused in, where moving it by
 * the sessions missed would still let a long absence carry them into a harder
 * week. A pause that began after the twelve weeks were over has no week to
 * give back.
 */
export function pausedDays(run: readonly StatusPeriod[], startDate: string, today: string): string[] {
  if (!isDay(startDate)) return [];
  const days = new Set<string>();
  for (const period of run) {
    if (!isValidPeriod(period)) continue;
    const first = period.from > startDate ? period.from : startDate;
    const last = period.to !== undefined && period.to < today ? period.to : shiftDay(today, -1);
    for (const day of daysFrom(first, last)) days.add(day);
  }
  const paused = [...days].sort();
  return paused.length > 0 && paused[0] < shiftDay(startDate, TOTAL_WEEKS * 7) ? paused : [];
}

export interface PlanOffer {
  /** The periods it is about. The answer is recorded on each of them. */
  run: StatusPeriod[];
  /** How far "Move your plan back" moves it. */
  days: number;
}

/** The offer to make today, if any: a run that has ended, paused the programme and is unanswered. */
export function planOffer(periods: readonly StatusPeriod[] | undefined, startDate: string, today: string): PlanOffer | undefined {
  const run = endedRun(periods, today);
  const days = run ? pausedDays(run, startDate, today).length : 0;
  return run && days > 0 ? { run, days } : undefined;
}

/**
 * The periods with the offer's answer recorded on every period of its run,
 * so it is never asked again. Periods are matched by what they hold, not by
 * identity, so periods read again from the store still match.
 */
export function answerShift(periods: readonly StatusPeriod[] | undefined, run: readonly StatusPeriod[], answer: 'moved' | 'kept'): StatusPeriod[] {
  const key = (p: StatusPeriod) => `${p.kind}|${p.from}|${p.to ?? ''}`;
  const answered = new Set(run.map(key));
  return (periods ?? []).map(p => (isValidPeriod(p) && answered.has(key(p)) ? { ...p, planShift: answer } : p));
}

/**
 * The start date that moves the plan back by `days`: a later start puts the
 * person `days` earlier in the programme, never further on.
 */
export function shiftStartDate(startDate: string, days: number): string {
  if (!isDay(startDate)) throw new RangeError(`Not a YYYY-MM-DD day: ${startDate}`);
  if (!Number.isInteger(days) || days < 0) throw new RangeError(`The plan only moves back by whole days, got ${days}.`);
  return shiftDay(startDate, days);
}
