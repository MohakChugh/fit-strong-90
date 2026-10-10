/**
 * A day's steps, said with where they came from (journey §9.6; D10, D14):
 * - with an entered total: that total, "entered at 6:00 pm";
 * - with walks only: "4,210 in FitStrong walks · day total not entered";
 * - when a FitStrong walk started after the total was stated at a real
 *   time: "at least 7,300", with both sources. A past day's total is
 *   stamped at midday and typed after the day, so it never adds walks
 *   (D52); a corrected total counts from its correction.
 * It is never presented as complete, and a day with nothing says so.
 */
import { entryFor, summariseDay } from '@/health/aggregate';
import { compareStatements, type Observation } from '@/health/observation';
import { walkRecords } from '@/walk/record';
import { formatClock, hasClockTime } from './format';
import { formatNumber } from './units';

export interface StepsFigure {
  kind: 'entered' | 'atLeast' | 'walks' | 'none';
  /** "6,050", or "at least 7,300". Absent with nothing recorded. */
  value?: string;
  /** Where it came from: "entered at 6:00 pm", "in FitStrong walks · day total not entered". */
  source: string;
  /** The steps the figure stands for, at least. */
  steps?: number;
}

export function stepsDayFigure(day: string, observations: readonly Observation[], hour12: boolean): StepsFigure {
  const summary = summariseDay(day, observations);
  const entered = entryFor(summary, 'steps', 'dayTotal');
  if (entered && entered.total !== null) {
    // The statement behind the total, and when it was stated: a correction counts from when it was made (D10).
    const stated = [...entered.contributed].sort(compareStatements).at(-1) ?? entered.latest;
    const asOf = stated.editedAt ?? stated.at;
    // A total typed for a past day is stamped at midday (`atOnDay`): its clock time is a stand-in, not when it was entered.
    const standIn = !stated.editedAt && stated.source === 'manual' && stated.at.slice(11, 23) === '12:00:00.000';
    const at = hasClockTime(stated) && !standIn ? formatClock(asOf, hour12) : undefined;
    const said = stated.editedAt ? 'changed' : 'entered';
    // Only walks that started after the total was stated are surely not in it, so the sum is a floor.
    const walked = at === undefined ? 0 : walkRecords(observations)
      .filter(w => w.day === day && w.steps !== undefined && Date.parse(w.at) > Date.parse(asOf))
      .reduce((n, w) => n + (w.steps ?? 0), 0);
    if (walked > 0) {
      const steps = entered.total + walked;
      return { kind: 'atLeast', value: `at least ${formatNumber(steps)}`, steps, source: `${formatNumber(entered.total)} ${said} at ${at} + ${formatNumber(walked)} in walks after ${at}` };
    }
    return { kind: 'entered', value: formatNumber(entered.total), steps: entered.total, source: at ? `${said} at ${at}` : 'entered' };
  }
  const walks = entryFor(summary, 'steps', 'sessionObserved');
  if (walks && walks.total !== null && walks.total > 0) {
    return { kind: 'walks', value: formatNumber(walks.total), steps: walks.total, source: 'in FitStrong walks · day total not entered' };
  }
  return { kind: 'none', source: 'Not entered' };
}

/** Thousands separators a pasted count may carry: comma, space, no-break space, narrow no-break space. */
const GROUP = '[, \\u00a0\\u202f]';
const TOKEN = new RegExp(`\\d(?:[\\d.]|${GROUP})*\\d|\\d`, 'g');
const INTERNATIONAL = new RegExp(`^\\d{1,3}(?:${GROUP}\\d{3})+$`);
/** 1,00,000: the Indian grouping, in twos above the thousands. */
const INDIAN = /^\d{1,2}(?:,\d{2})*,\d{3}$/;

/**
 * A step count from pasted text (journey §9.6, "Paste"): the one number in
 * it, its thousands grouped the Indian or the international way. Text with
 * no number, a decimal, or more than one number gives nothing, and the
 * person types the number instead: the app never guesses.
 */
export function stepsFromText(text: string): number | undefined {
  const tokens = text.match(TOKEN) ?? [];
  if (tokens.length !== 1) return undefined;
  const t = tokens[0];
  return /^\d+$/.test(t) || INTERNATIONAL.test(t) || INDIAN.test(t) ? Number(t.replace(/\D/g, '')) : undefined;
}
