/**
 * How a walk's numbers read. Every figure carries its unit at the call site;
 * these only shape the number.
 */

import { prefersHour12, timeOf } from '@/lib/time';

/** A stopwatch reading: `0:07`, `8:42`, `1:02:15`. Rounded down: a second is shown once it has passed. */
export function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** The same reading, as a screen reader should say it. */
export function spokenClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts = [
    h > 0 ? `${h} ${h === 1 ? 'hour' : 'hours'}` : '',
    m > 0 || h > 0 ? `${m} ${m === 1 ? 'minute' : 'minutes'}` : '',
    `${s} ${s === 1 ? 'second' : 'seconds'}`,
  ];
  return parts.filter(Boolean).join(' ');
}

/** Minutes and seconds per kilometre: `12:49`. Rounded to the nearest second. */
export function pace(secPerKm: number): string {
  const total = Math.round(secPerKm);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Kilometres to two places, from metres: `0.65`, `12.40`. */
export function km(metres: number): string {
  return (Math.max(0, metres) / 1000).toFixed(2);
}

/** A count in the reader's own grouping: `1,204`, or `1,20,450` in India. */
export function count(n: number, locale?: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n);
}

/**
 * A stretch of time in words, for gaps and added time: `12 seconds`,
 * `4 min`, `1 h 5 min`. Seconds below a minute, because "0 min away" says
 * nothing.
 */
export function span(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Whole minutes, at least 1, for an offer such as "Add 4 min". */
export function wholeMinutes(ms: number): number {
  return Math.max(1, Math.round(ms / 60_000));
}

/** A time of day in the reader's own convention, `7:40 pm` or `19:40`, written as the whole app writes times (J2-14). */
export function timeOfDay(epochMs: number, locale?: string): string {
  return timeOf(epochMs, prefersHour12(locale));
}
