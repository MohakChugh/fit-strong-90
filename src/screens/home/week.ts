/**
 * This week, Monday to Sunday (journey §7.3, D31): the days with movement,
 * the planned rest days and the status days under the ring, the days with a
 * stretch, today's steps, and what the ring last showed on this device.
 *
 * Plain functions over the records, so the card only lays them out. Minutes
 * come from Track's own count (`recordedMovement`), so Home, Trends and
 * Today's log never disagree about a day.
 */
import type { DayOfWeek, StatusPeriod, WorkoutSession } from '@/types';
import { WEEK } from '@/engine/templates';
import type { Observation } from '@/health/observation';
import { STATUS_LABEL, statusOn, weekdayOf, type Status } from '@/health/status';
import { recordedMovement } from '@/screens/track/movement';
import { addDays, weekOf } from '@/screens/track/periods';
import { stepsDayFigure } from '@/screens/track/stepsDay';
import { stretchedDays } from '@/screens/trends/records';

// ============================================================================
// Day dots
// ============================================================================

export type DotState = 'moved' | 'rest' | 'status' | 'none';

export interface WeekDot {
  day: string;
  /** "M", "T", … as the dot's visible label. */
  letter: string;
  /** "Monday": what a screen reader hears before the state. */
  name: string;
  state: DotState;
  /** The status of a status day: Flare-up, Unwell or Away. */
  status?: Exclude<Status, 'normal'>;
  today: boolean;
  /** Later this week: nothing can have happened on it yet. */
  future: boolean;
}

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** The days of this week up to today with any recorded movement, counted as the ring counts them. */
export function movedDays(today: string, observations: readonly Observation[], sessions: readonly WorkoutSession[]): Set<string> {
  const { from } = weekOf(today);
  const out = new Set<string>();
  for (let i = 0; i < 7; i++) {
    const day = addDays(from, i);
    if (day > today) break;
    if (recordedMovement({ from: day, to: day }, observations, sessions).minutes > 0) out.add(day);
  }
  return out;
}

/**
 * The planned rest days: the programme's days off, for someone in it. The
 * programme trains on the days chosen (`trainingDays`, as the plan builds
 * each day); outside it nothing is planned, so no day is marked as rest
 * rather than shown as a rest nobody planned (A-39).
 */
export function restDaysOf(enrolled: boolean, trainingDays: readonly DayOfWeek[] | undefined): DayOfWeek[] {
  if (!enrolled || !trainingDays?.length) return [];
  return WEEK.filter(d => !trainingDays.includes(d));
}

/**
 * Seven dots, Monday to Sunday: filled for a day with movement, "R" for a
 * planned rest day, hatched for a day that was Away, Unwell or a Flare-up,
 * and empty otherwise. Movement that happened is shown whatever else the day
 * was; a status day is never drawn as a rest day, nor a rest day as activity.
 */
export function weekDots({ today, moved, restDays, statusPeriods }: {
  today: string;
  moved: ReadonlySet<string>;
  restDays: readonly DayOfWeek[];
  statusPeriods?: readonly StatusPeriod[];
}): WeekDot[] {
  const { from } = weekOf(today);
  return LETTERS.map((letter, i) => {
    const day = addDays(from, i);
    const status = statusOn(statusPeriods, day);
    const state: DotState = moved.has(day) ? 'moved' : status !== 'normal' ? 'status' : restDays.includes(weekdayOf(day)) ? 'rest' : 'none';
    return {
      day, letter, name: NAMES[i], state, ...(status !== 'normal' ? { status } : {}), today: day === today, future: day > today,
    };
  });
}

/** What a dot says to a screen reader: the day, then what it was. */
export function dotLabel(dot: WeekDot): string {
  switch (dot.state) {
    case 'moved':
      return `${dot.name}: moved`;
    case 'status':
      return `${dot.name}: ${STATUS_LABEL[dot.status ?? 'away']}`;
    case 'rest':
      return `${dot.name}: rest day`;
    default:
      return `${dot.name}: ${dot.future ? 'still to come' : 'no movement recorded'}`;
  }
}

// ============================================================================
// The plain values beside the ring
// ============================================================================

/**
 * The days this week with a stretch done, or a session whose mobility block
 * was done (journey §12.3): the count Trends gives, so the two never disagree.
 */
export function stretchDays(today: string, sessions: readonly WorkoutSession[]): number {
  const { from, to } = weekOf(today);
  return [...stretchedDays(sessions)].filter(d => d >= from && d <= to).length;
}

/** "Stretched 3 days", or that there has been none yet. */
export function stretchedLine(days: number): string {
  if (days === 0) return 'No stretches yet this week';
  return `Stretched ${days} ${days === 1 ? 'day' : 'days'}`;
}

/**
 * Today's steps with where they came from (D14, D10, A-47), as the Steps hub
 * says them (`stepsDayFigure`): a total the person entered, which is the
 * whole day's, "at least" it with the FitStrong walks after it, or else the
 * steps counted on FitStrong walks. Never a total the app made up: nothing
 * entered says so.
 */
export function stepsLine(day: string, observations: readonly Observation[], hour12: boolean): string {
  const f = stepsDayFigure(day, observations, hour12);
  if (f.kind === 'none') return 'Steps: not entered';
  if (f.kind === 'walks') return `Steps today: ${f.value} in FitStrong walks`;
  return f.kind === 'atLeast' ? `Steps today: ${f.value} (${f.source})` : `Steps today: ${f.value} ${f.source}`;
}

// ============================================================================
// What the ring last showed (B-32, M1)
// ============================================================================

/** A ring as this device drew it: which ring, and the value. */
export interface RingShown {
  id: string;
  value: number;
}

/**
 * Which ring it is: the week (its Monday), what it counts, and the goal it is
 * drawn against. A new week or a changed goal is another ring (B-32).
 */
export function ringId(today: string, goal: number): string {
  return `${weekOf(today).from}|moveMinutes|${goal}`;
}

/**
 * Whether the ring sweeps from what it last showed to `next`: only a real
 * increase within the same week, metric and goal, and never beside an urgent
 * Right now card (motion rule 2, M1). Anything else is drawn already set,
 * and nothing ever sweeps up from zero on arrival.
 */
export function ringSweeps(shown: RingShown | undefined, next: RingShown, still: boolean): boolean {
  return !still && shown !== undefined && shown.id === next.id && next.value > shown.value;
}

/** A remembered ring, as read back from storage; anything else is none. */
export function readRingShown(raw: string | null): RingShown | undefined {
  try {
    const v: unknown = JSON.parse(raw ?? 'null');
    if (typeof v !== 'object' || v === null) return undefined;
    const { id, value } = v as Record<string, unknown>;
    return typeof id === 'string' && typeof value === 'number' && Number.isFinite(value) ? { id, value } : undefined;
  } catch {
    return undefined;
  }
}
