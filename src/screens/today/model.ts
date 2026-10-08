/**
 * Today's decisions that are not the recommendation itself: what the day
 * group says, the plan row, the one prompt, the chooser's rows and which sheet
 * the address asks for. Plain functions, so the screen stays a layout.
 *
 * Numbers come through `aggregate.ts` and Track's own helpers, so Today and
 * Track never disagree about a reading, its source or the week's movement.
 */

import { format, parseISO } from 'date-fns';
import type { Phase, StatusPeriod, UserSettings, WorkoutSession } from '@/types';
import type { SessionPlan } from '@/types/plan';
import type { UserProfile } from '@/types/profile';
import type { Mode } from '@/engine/permission';
import { entryFor, pairBloodPressure, summariseDay } from '@/health/aggregate';
import { dueItems, type DueItem } from '@/health/cadence';
import type { Observation } from '@/health/observation';
import { HREF, completedOn, trainedOn, type Recommendation } from '@/health/recommend';
import { countingDays, daysBetween, daysFrom, statusOn, weekdayOf, type Status } from '@/health/status';
import { DEFAULT_PREFS, formatClock, formatObservation, hasClockTime, sourceLabel, type DisplayPrefs } from '@/screens/track/format';
import { recordedMovement, wholeMinutes } from '@/screens/track/movement';
import type { Pending } from '@/reminders/pending';
import { weekOf } from '@/screens/track/periods';

// ============================================================================
// The day
// ============================================================================

/** Display preferences for the few figures Today shows: the profile's glucose unit, the device's clock. */
export function todayPrefs(profile: UserProfile | undefined, hour12: boolean): DisplayPrefs {
  return { ...DEFAULT_PREFS, glucose: profile?.health.glucoseUnit ?? DEFAULT_PREFS.glucose, hour12 };
}

export interface Reading {
  /** "142 mg/dL", "132/84 mmHg". */
  value: string;
  /** When and where from: "07:40 · Manual entry", or only the source when no time was recorded. */
  detail: string;
}

function provenance(o: Observation, prefs: DisplayPrefs): string {
  return hasClockTime(o) ? `${formatClock(o.at, prefs.hour12)} · ${sourceLabel(o)}` : sourceLabel(o);
}

/** Today's latest glucose reading, or nothing (the screen says "Not entered"). */
export function latestGlucose(observations: readonly Observation[], day: string, prefs: DisplayPrefs): Reading | undefined {
  const entry = entryFor(summariseDay(day, [...observations]), 'glucose');
  if (!entry) return undefined;
  return { value: formatObservation(entry.latest, prefs), detail: provenance(entry.latest, prefs) };
}

/**
 * Today's latest blood pressure, put back together from its two halves. A
 * half whose partner was lost says so rather than showing an invented number.
 */
export function latestPressure(observations: readonly Observation[], day: string, prefs: DisplayPrefs): Reading | undefined {
  const summary = summariseDay(day, [...observations]);
  const halves = [
    ...(entryFor(summary, 'bloodPressureSystolic')?.observations ?? []),
    ...(entryFor(summary, 'bloodPressureDiastolic')?.observations ?? []),
  ];
  const reading = pairBloodPressure(halves).at(-1);
  if (!reading) return undefined;
  const detail = provenance(reading.halves[0], prefs);
  if (reading.systolic !== null && reading.diastolic !== null) {
    return { value: `${reading.systolic}/${reading.diastolic} mmHg`, detail };
  }
  return reading.systolic !== null
    ? { value: `${reading.systolic} mmHg`, detail: `${detail} · systolic only, the other number was not saved` }
    : { value: `${reading.diastolic} mmHg`, detail: `${detail} · diastolic only, the other number was not saved` };
}

/** Glucose earns a row for someone with diabetes, or once there is a reading today. */
export function showsGlucose(profile: UserProfile | undefined, reading: Reading | undefined): boolean {
  const d = profile?.health.diabetes;
  return reading !== undefined || (d !== undefined && d !== 'none');
}

/** Blood pressure earns a row with a concern or a monitor, or once there is a reading today. */
export function showsPressure(profile: UserProfile | undefined, reading: Reading | undefined): boolean {
  return reading !== undefined || (profile !== undefined && (profile.health.hypertension !== 'none' || profile.health.bpMonitor));
}

/**
 * This week's recorded movement, exactly as Track's ring counts it (D31), and
 * how much of it the person entered by hand rather than the app measuring it.
 */
export function weekMovement(day: string, observations: readonly Observation[], sessions: readonly WorkoutSession[]): { minutes: number; entered: number } {
  const total = recordedMovement(weekOf(day), observations, sessions);
  return { minutes: wholeMinutes(total.minutes), entered: wholeMinutes(total.enteredMinutes) };
}

/** Says when part of the week's total was typed in, so a measured total is never implied. */
export function enteredNote({ minutes, entered }: { minutes: number; entered: number }): string | undefined {
  if (entered <= 0 || minutes <= 0) return undefined;
  return entered >= minutes ? 'all added by hand' : `${entered} min added by hand`;
}

// ============================================================================
// The plan row
// ============================================================================

const PHASE: Record<Phase, string> = { foundation: 'Foundation', hypertrophy: 'Hypertrophy', strength: 'Strength' };

export interface PlanRow {
  label: string;
  detail: string;
}

/**
 * "Week 3 of 12" (D11), the phase, and either today's session — when the
 * suggestion above is something else, so it is not lost — or the week so far.
 * The week counts only normal days: a day under a status is neither a session
 * missed nor one owed (D25). Done means finished, as Move's week shows it; a
 * stretch or a rest day's optional mobility is not a programme session.
 */
export function planRow(input: {
  day: string;
  plan: SessionPlan;
  sessions: readonly WorkoutSession[];
  profile: UserProfile;
  startDate: string;
  statusPeriods: StatusPeriod[] | undefined;
  /** The recommendation above is today's session. */
  sessionShown: boolean;
}): PlanRow {
  const { day, plan, sessions, profile, startDate, statusPeriods } = input;
  const phase = `${PHASE[plan.phase]} phase`;
  // Under a status nothing is pushed, so the plan row does not push either.
  const pending = statusOn(statusPeriods, day) === 'normal' && plan.focus !== 'rest' && plan.kind !== 'none' && !trainedOn(sessions, day);
  if (pending && !input.sessionShown) return { label: `Week ${plan.week} of 12`, detail: `${phase} · ${plan.label} today` };

  const { from, to } = weekOf(day);
  const week = countingDays(statusPeriods, daysFrom(from, to));
  const planned = week.filter(d => (startDate === '' || d >= startDate) && profile.trainingDays.includes(weekdayOf(d))).length;
  const done = week.filter(d => completedOn(sessions, d)).length;
  if (planned === 0) return { label: `Week ${plan.week} of 12`, detail: phase };
  const count = done <= planned ? `${done} of ${planned} sessions this week` : `${done} sessions this week`;
  return { label: `Week ${plan.week} of 12`, detail: `${phase} · ${count}` };
}

// ============================================================================
// The one prompt
// ============================================================================

export type Prompt =
  | { kind: 'due'; item: DueItem }
  | { kind: 'reminder'; item: Pending }
  | { kind: 'water'; totalMl?: number; goalMl?: number; glassMl: number };

/** `HH:MM` as minutes after midnight, or undefined for anything else. */
function minuteOf(clock: string | undefined): number | undefined {
  const m = clock === undefined ? null : /^([01]\d|2[0-3]):([0-5]\d)$/.exec(clock);
  return m ? Number(m[1]) * 60 + Number(m[2]) : undefined;
}

/** Inside `from`–`to`, which may run past midnight. An unreadable window is never "inside". */
export function within(now: Date, from: string | undefined, to: string | undefined): boolean {
  const start = minuteOf(from);
  const end = minuteOf(to);
  if (start === undefined || end === undefined || start === end) return false;
  const minute = now.getHours() * 60 + now.getMinutes();
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}

/**
 * At most one prompt (codex-vision §4), in this order: the most relevant due
 * item, which is guidance with its source; then the newest reminder still
 * waiting, which is a habit the person asked for and stays here once its
 * banner has stepped out of view; then their water habit. Away or unwell,
 * nothing is asked of them; during a flare-up a due test still shows, but
 * habit prompts go quiet (D25). Under an emergency or a "get advice today"
 * nothing else asks for attention, and beside a hold or a re-check no habit
 * does. The waiting list and `waterBlocked` are the reminders module's own
 * verdicts on quiet hours, Status and fluid limits, never a second rule here.
 */
export function pickPrompt(input: {
  now: Date;
  day: string;
  status: Status;
  /** The suggestion above is a stop: emergency, or advice today. */
  stopped: boolean;
  /** The suggestion above is a hold or a re-check. */
  held: boolean;
  profile: UserProfile | undefined;
  settings: Pick<UserSettings, 'habits'>;
  observations: readonly Observation[];
  waterBlocked: boolean;
  /** Reminders shown and not yet answered, newest first (`usePending`). */
  waiting: readonly Pending[];
}): Prompt | undefined {
  const { now, day, status, settings } = input;
  if (input.stopped || status === 'away' || status === 'unwell') return undefined;
  // One slot, by how much the moment matters (scan J2-06): a blood-pressure
  // check is about today and has a time; a reminder the person turned on is
  // about now; a lab test due this month can wait an hour; a first result
  // never entered is the least urgent of all, behind even the water row.
  // `dueItems` keeps its own order (cadence.ts): a timely blood-pressure day,
  // then a lab test, then an ignored or diagnostic blood-pressure prompt, then
  // a first result never entered. A reminder waiting now goes in after the
  // timely day, so a lab nudge or an ignored prompt never hides it.
  const due = dueItems({ now, profile: input.profile, observations: input.observations });
  const first = due.find(d => d.kind === 'hba1cFirst');
  const rest = due.filter(d => d !== first);
  if (rest[0]?.timely) return { kind: 'due', item: rest[0] };
  const quiet = status !== 'normal' || input.held;
  if (!quiet && input.waiting[0]) return { kind: 'reminder', item: input.waiting[0] };
  if (rest[0]) return { kind: 'due', item: rest[0] };
  if (quiet) return first ? { kind: 'due', item: first } : undefined;

  const habits = settings.habits;
  const water = habits?.water;
  const firstOrNothing = first ? { kind: 'due' as const, item: first } : undefined;
  // Turning in-app reminders off (to rely on Calendar) quiets this too.
  if (!water?.enabled || habits?.inApp === false || input.waterBlocked || !within(now, water.from, water.to)) return firstOrNothing;
  if (habits?.quietHours && within(now, habits.quietHours.from, habits.quietHours.to)) return firstOrNothing;
  const total = entryFor(summariseDay(day, [...input.observations]), 'water', 'dayTotal')?.total;
  return {
    kind: 'water',
    ...(typeof total === 'number' ? { totalMl: total } : {}),
    ...(water.dailyGoalMl ? { goalMl: water.dailyGoalMl } : {}),
    glassMl: water.glassMl > 0 ? water.glassMl : 250,
  };
}

// ============================================================================
// Choose something else
// ============================================================================

export type ChooserId = 'stretch' | 'walk' | 'guided' | 'log' | 'learn';

export interface ChooserRow {
  id: ChooserId;
  label: string;
  detail: string;
  to: string;
  /** Set for movement, which goes through the start gate. */
  mode?: Mode;
  /** The suggestion above is this row. */
  suggested: boolean;
}

/**
 * The five modes (D6), always in this order: the list never reorders itself,
 * so a thumb learns where each one is. The suggestion is marked, not moved.
 */
export function chooserRows(input: { recommendation: Recommendation; enrolled: boolean; plan: SessionPlan; trained: boolean; stopped?: boolean }): ChooserRow[] {
  const { recommendation, enrolled, plan, trained, stopped = false } = input;
  const minutes = Math.round(plan.totalSeconds / 60);
  // Named as what runs: a flare-up or the check-in turns the day's session
  // into its recovery version, which keeps the day's label (scan X2-16).
  const runs = plan.kind === 'restDay' ? 'Rest-day session' : plan.kind === 'recovery' ? 'Recovery session' : plan.label;
  const guided: Omit<ChooserRow, 'suggested'> = !enrolled
    ? { id: 'guided', label: 'Guided session', detail: 'The 12-week strength programme', to: HREF.plan }
    : plan.kind === 'none'
      ? { id: 'guided', label: 'Guided session', detail: plan.focus === 'rest' ? 'A rest day in your plan' : 'Not today', to: HREF.plan }
      : {
        id: 'guided',
        label: 'Guided session',
        detail: trained ? `Done today · ${plan.label}` : `${runs} · ${minutes} min`,
        to: HREF.guided,
        mode: 'guided',
      };

  const rows: Omit<ChooserRow, 'suggested'>[] = [
    { id: 'stretch', label: 'Stretch', detail: 'Gentle mobility and supported movements', to: HREF.stretch, mode: 'stretch' },
    { id: 'walk', label: 'Walk', detail: 'Timed, with your pace if you allow location', to: HREF.walk, mode: 'walk' },
    guided,
    { id: 'log', label: 'Log something', detail: 'A reading, water, steps or a workout', to: '/track?add=' },
    { id: 'learn', label: 'Learn', detail: 'Food, desk setup and everyday habits', to: '/guide' },
  ];
  const suggested = suggestedRow(recommendation);
  // A stop applies to every way of moving, so none is offered as an ordinary
  // choice beside it (codex-vision §4; the gate would refuse it anyway).
  const NOT_TODAY = 'Not today · see your check-in';
  return rows.map(r => ({
    ...r,
    ...(stopped && (r.id === 'stretch' || r.id === 'walk' || r.id === 'guided') ? { detail: NOT_TODAY } : {}),
    suggested: !stopped && r.id === suggested,
  }));
}

function suggestedRow(r: Recommendation): ChooserId | undefined {
  switch (r.action.mode) {
    case 'stretch': return 'stretch';
    case 'walk': return 'walk';
    case 'guided': return 'guided';
    default: return r.action.to === HREF.plan ? 'guided' : undefined;
  }
}

/**
 * What the check-in sheet's Start button says once it allows a mode. Stretch
 * and Walk open their setup rather than starting, so they say "Continue".
 */
export function startLabelFor(mode: Mode, to: string, recovery = false): string {
  if (/[?&]resume=1\b/.test(to)) return mode === 'stretch' ? 'Continue stretch' : 'Continue session';
  if (mode === 'guided') return recovery ? 'Start recovery session' : 'Start session';
  return mode === 'stretch' ? 'Continue to stretch' : 'Continue to walk';
}

// ============================================================================
// Sheets
// ============================================================================

export type TodaySheet =
  | { kind: 'checkIn'; mode: Mode }
  | { kind: 'status'; preset?: 'normal' }
  | { kind: 'choose' }
  | { kind: 'goal' };

/**
 * The sheet the address asks for. Sheets live in the query, so a link — the
 * session player's `?checkin=1`, a hero action — can open one, and only one:
 * the first that applies wins.
 */
export function sheetFrom(params: URLSearchParams): TodaySheet | undefined {
  const checkIn = params.get('checkin');
  if (checkIn !== null) return { kind: 'checkIn', mode: checkIn === 'stretch' || checkIn === 'walk' ? checkIn : 'guided' };
  const status = params.get('status');
  if (status !== null) return status === 'normal' ? { kind: 'status', preset: 'normal' } : { kind: 'status' };
  if (params.has('choose')) return { kind: 'choose' };
  if (params.has('goal')) return { kind: 'goal' };
  return undefined;
}

/** The query keys `sheetFrom` reads, so closing one clears every one. */
export const SHEET_KEYS = ['checkin', 'status', 'choose', 'goal'] as const;

/** "since Tuesday · until Sunday", read after the status's name. Nothing for Normal. */
export function statusDetail(period: StatusPeriod | undefined, today: string): string | undefined {
  if (!period) return undefined;
  const name = (day: string) => {
    const away = Math.abs(daysBetween(today, day));
    return day === today ? 'today' : away < 7 ? format(parseISO(day), 'EEEE') : format(parseISO(day), 'd MMMM');
  };
  const from = `since ${name(period.from)}`;
  return period.to ? `${from} · until ${name(period.to)}` : from;
}

const WHILE: Record<StatusPeriod['kind'], string> = { away: 'away', unwell: 'unwell', flare: 'in a flare-up' };

/** How the plan offer names the run: "While you were away", "During your flare-up", "While you were in a flare-up and unwell". */
export function during(run: readonly StatusPeriod[]): string {
  const kinds = [...new Set(run.map(p => p.kind))];
  if (kinds.length === 1 && kinds[0] === 'flare') return 'During your flare-up';
  return `While you were ${kinds.map(k => WHILE[k]).join(' and ')}`;
}

/** The words above the recommendation. */
export function eyebrowOf(r: Recommendation): string {
  switch (r.kind) {
    case 'emergency':
    case 'seekHelp':
    case 'recheck':
      return 'Today’s check-in';
    case 'hold':
      return r.action.to === HREF.profile ? 'Before you start' : 'Today’s check-in';
    case 'resume':
      return 'In progress';
    case 'status':
      return 'Your status';
    case 'scheduled':
      return 'Today’s session';
    case 'choose':
      return 'Today';
    default:
      return 'Suggested for now';
  }
}
