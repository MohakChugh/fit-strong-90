/**
 * What Move shows about the 12-week programme: today's guided session in one
 * line, this week's seven days, the phase, and when a day may be swapped
 * (codex-vision §4 and §10; board D8, D11).
 *
 * The rule that matters most here is honesty: a day reads Done only when that
 * day's programme workout was recorded as completed. A stretch, a walk or a
 * recovery session in its place is never shown as the workout, and a past day
 * with nothing recorded says so.
 */

import type { AppData, DayOfWeek, Phase, StatusPeriod, UserSettings, WorkoutSession } from '@/types';
import type { DayFocus, SessionPlan } from '@/types/plan';
import type { UserProfile } from '@/types/profile';
import { PHASES } from '@/data/program';
import { focusLabel, focusMuscleGroup, WEEK, weekFocus } from '@/engine/templates';
import { modeFor, phaseFor } from '@/engine/dosage';
import { focusOverrideFor } from '@/hooks/useGuided';
import { swapOptions } from '@/session/manual';
import type { SavedProgress } from '@/session/persistence';
import type { StoreResult } from '@/store/db';
import type { WizardResult } from '@/components/profile/ProfileWizard';
import { answeredProfile } from '@/components/profile/wizardSteps';
import { createDefaultProfile } from '@/profile/defaults';
import { addDays, differenceInCalendarDays } from 'date-fns';
import { parseDateString, toDateString, TOTAL_WEEKS } from '@/lib/utils';
import { STATUS_LABEL, statusOn } from '@/health/status';

export type DayStatus =
  | 'done' | 'partial' | 'recovery' | 'skipped' | 'inProgress'
  | 'rest' | 'today' | 'comingUp' | 'notRecorded' | 'beforeStart'
  /** A day the person declared a Status for (board D25): not a missed workout (scan J2-12). */
  | StatusPeriod['kind'];

export const STATUS_TEXT: Record<DayStatus, string> = {
  done: 'Done',
  partial: 'Partly done',
  recovery: 'Recovery session instead',
  skipped: 'Skipped',
  inProgress: 'Started',
  rest: 'Rest',
  today: 'Today',
  comingUp: 'Coming up',
  notRecorded: 'Not recorded',
  beforeStart: 'Before your start date',
  flare: STATUS_LABEL.flare,
  unwell: STATUS_LABEL.unwell,
  away: STATUS_LABEL.away,
};

export interface WeekDay {
  date: string;
  day: DayOfWeek;
  isToday: boolean;
  /** What the day is about: what was recorded, otherwise what is planned. */
  focus: DayFocus;
  /** The day's own workout in the weekly template, when `focus` is something else. */
  swappedFrom?: DayFocus;
  status: DayStatus;
  /**
   * The programme week the day falls in, from the start date. A calendar
   * week, Monday to Sunday, spans two of them when the programme began on
   * another weekday, so each day says which (scan J2-11). Absent before the start.
   */
  week?: number;
}

type Data = Pick<AppData, 'sessions' | 'focusOverrides'> & { settings?: Pick<UserSettings, 'startDate' | 'statusPeriods'> };

/** A real calendar day written YYYY-MM-DD (not 2026-02-30). */
function isDay(date: string | undefined): date is string {
  return !!date && /^\d{4}-\d{2}-\d{2}$/.test(date) && toDateString(parseDateString(date)) === date;
}

/**
 * Recorded programme work: guided sessions and logged workouts. A stretch is
 * its own routine, and a rest-day session is the optional mobility a rest day
 * offers, so neither makes a day's workout done.
 */
function programme(s: WorkoutSession): boolean {
  const kind = s.planKind ?? kindFromPlanId(s.planId);
  return kind !== 'stretch' && kind !== 'restDay';
}

/** Records saved before `planKind` existed: the guided planner wrote the kind into the plan id. */
function kindFromPlanId(id: string | undefined): WorkoutSession['planKind'] {
  if (id?.startsWith('stretch:')) return 'stretch';
  const kind = id?.split(':')[2];
  return kind === 'full' || kind === 'recovery' || kind === 'restDay' ? kind : undefined;
}

const hasWork = (s: WorkoutSession) => s.sets.some(x => x.status === 'completed') || (s.mobility?.length ?? 0) > 0 || !!s.cardio;

/** Completed beats partly done beats started; a later start breaks a tie. */
function rank(s: WorkoutSession): number {
  if (s.status === 'completed') return 4;
  if (s.status === 'partial') return 3;
  if (s.status === 'in_progress' && hasWork(s)) return 2;
  if (s.status === 'skipped') return 1;
  return 0;
}

function best(sessions: WorkoutSession[]): WorkoutSession | undefined {
  let top: WorkoutSession | undefined;
  for (const s of sessions) {
    if (rank(s) === 0) continue;
    if (!top || rank(s) > rank(top) || (rank(s) === rank(top) && (s.startedAt ?? '') > (top.startedAt ?? ''))) top = s;
  }
  return top;
}

function statusOf(s: WorkoutSession, planned: DayFocus): DayStatus {
  const kind = s.planKind ?? kindFromPlanId(s.planId);
  // On an active-recovery day the recovery session is the workout itself.
  if (kind === 'recovery' && planned !== 'activeRecovery') return 'recovery';
  if (s.status === 'completed') return 'done';
  if (s.status === 'partial') return 'partial';
  if (s.status === 'in_progress') return 'inProgress';
  return 'skipped';
}

/** The Monday of the week holding `date`. */
export function mondayOf(date: string): string {
  const d = parseDateString(date);
  return toDateString(addDays(d, -((d.getDay() + 6) % 7)));
}

/** This week, Monday first, as it stands today. */
export function weekView(data: Data, profile: Pick<UserProfile, 'trainingDays'>, today: string): WeekDay[] {
  const map = weekFocus(profile);
  const monday = parseDateString(mondayOf(today));
  return WEEK.map((day, i) => {
    const date = toDateString(addDays(monday, i));
    const scheduled = map[day];
    const planned = focusOverrideFor(data, profile, date) ?? scheduled;
    const top = best(data.sessions.filter(s => s.date === date && programme(s)));
    const isToday = date === today;
    // Today, a workout not yet finished under another name gives way to the
    // one now planned: the earlier work is in Track, the plan is this.
    const recorded = top && !(isToday && top.status !== 'completed' && top.focus !== undefined && top.focus !== planned) ? top : undefined;
    const focus = recorded?.focus ?? planned;
    // Before the programme starts nothing is scheduled: an empty day was never
    // there to miss, and a rest day is not yet the plan's rest.
    const start = data.settings?.startDate;
    const beforeStart = isDay(start) && date < start;
    // A declared Flare-up, Unwell or Away day is that, not a missed workout.
    const declared = statusOn(data.settings?.statusPeriods, date);
    const status: DayStatus = recorded
      ? statusOf(recorded, planned)
      : beforeStart ? 'beforeStart'
        : planned === 'rest' ? 'rest'
          : declared !== 'normal' ? declared
            : date < today ? 'notRecorded'
              : isToday ? 'today' : 'comingUp';
    const week = isDay(start) && !beforeStart ? programmeWeek(start, date).week : undefined;
    return { date, day, isToday, focus, ...(focus !== scheduled ? { swappedFrom: scheduled } : {}), status, ...(week !== undefined ? { week } : {}) };
  });
}

/** The first and last day of the programme week holding `today`, counted from the start date; nothing without a real one. */
export function programmeWeekDates(startDate: string, today: string): { from: string; to: string } | undefined {
  if (!isDay(startDate)) return undefined;
  const { week } = programmeWeek(startDate, today);
  const from = addDays(parseDateString(startDate), (week - 1) * 7);
  return { from: toDateString(from), to: toDateString(addDays(from, 6)) };
}

export interface ProgrammeWeek {
  /** 1–12: the week the planner uses today. */
  week: number;
  /** Twelve weeks have passed; the planner stays on the last one. */
  finished: boolean;
  /** The start date, while it is still to come. */
  startsOn?: string;
  phase: Phase;
  mode: ReturnType<typeof modeFor>;
}

/** Where today sits in the 12-week programme. */
export function programmeWeek(startDate: string, today: string): ProgrammeWeek {
  const days = differenceInCalendarDays(parseDateString(today), parseDateString(startDate));
  const raw = Number.isFinite(days) ? Math.floor(days / 7) + 1 : 1;
  const week = Math.min(Math.max(raw, 1), TOTAL_WEEKS);
  return {
    week, finished: raw > TOTAL_WEEKS, phase: phaseFor(week), mode: modeFor(week),
    ...(isDay(startDate) && startDate > today ? { startsOn: startDate } : {}),
  };
}

/** Each phase's weeks and what the main lifts do in it (spec §4.3). */
export const PHASE_INFO = PHASES.map(p => ({
  phase: p.phase,
  name: p.name,
  weeks: p.weeks,
  dose: {
    foundation: 'Main lifts 3 × 8–10 at an easy-to-moderate effort, lowering for 3 seconds. Learn the patterns.',
    hypertrophy: 'Main lifts 3–4 × 6–10, a little harder, lowering for 2 seconds. Build muscle.',
    strength: 'Main lifts 3–5 × 4–6, or 5–8 for spinal lifts until cleared. Build strength.',
  }[p.phase],
}));

/** One line for the current week's character. */
export function weekNote(mode: ProgrammeWeek['mode']): string | null {
  if (mode === 'deload') return 'A lighter week: half the sets and easier effort, so you come back stronger.';
  if (mode === 'taper') return 'The last week: lighter, with re-tests on spine-friendly lifts only. No one-rep maxes.';
  return null;
}

/**
 * Whether today's workout may be swapped, as the Workout page allowed: not
 * once it is done, not into training on a day readiness has turned into
 * recovery or a stop, and only today, never a day still to come. Recorded
 * work today also keeps it: the old page discarded that work on a swap.
 */
export function canSwapToday(plan: SessionPlan, today: WeekDay | undefined): boolean {
  if (!today || ['done', 'partial', 'inProgress', 'recovery', 'beforeStart'].includes(today.status)) return false;
  if (plan.kind === 'full') return true;
  const restLike = plan.focus === 'rest' || plan.focus === 'activeRecovery';
  return restLike && (plan.readiness.outcome === 'green' || plan.readiness.outcome === 'amber');
}

export interface SwapChoice {
  focus: DayFocus;
  /** The weekday it usually falls on. */
  day?: DayOfWeek;
  /** The workout today already is. */
  current: boolean;
}

/** The workouts today can become: one per training day of the week, then the scheduled one if today was swapped. */
export function swapChoices(profile: Pick<UserProfile, 'trainingDays'>, today: WeekDay): SwapChoice[] {
  const planned = today.focus;
  const options: SwapChoice[] = swapOptions(profile).map(o => ({ ...o, current: o.focus === planned }));
  const scheduled = today.swappedFrom;
  if (scheduled && !options.some(o => o.focus === scheduled)) options.push({ focus: scheduled, current: false });
  return options;
}

/** The value `setFocusOverride` should store for a swap: none when it returns to the scheduled workout. */
export function overrideFor(choice: DayFocus, scheduled: DayFocus): DayFocus | undefined {
  return choice === scheduled ? undefined : choice;
}

export interface SwapEffects {
  /** In-progress guided session, if one is saved. */
  saved: SavedProgress | null;
  /** Put the saved session's work into the record. */
  bank: (saved: SavedProgress) => Promise<StoreResult>;
  /** Drop the saved session. */
  clear: () => void;
  setOverride: (date: string, focus: DayFocus | undefined) => Promise<StoreResult>;
}

/**
 * Swap today's workout, as the Workout page did. An unfinished guided session
 * for today belongs to the old workout, so its work is banked into the record
 * before the swap, or it would resume under the new workout's name; if that
 * save fails, nothing else happens. A saved stretch is its own routine and
 * stays as it is.
 */
export async function swapToday(today: WeekDay, choice: DayFocus, fx: SwapEffects): Promise<StoreResult> {
  const scheduled = today.swappedFrom ?? today.focus;
  if (fx.saved && fx.saved.plan.date === today.date && fx.saved.plan.kind !== 'stretch') {
    const banked = await fx.bank(fx.saved);
    if (!banked.ok) return banked;
    fx.clear();
  }
  return fx.setOverride(today.date, overrideFor(choice, scheduled));
}

/**
 * Joining the programme (board D8): what it asks, then a start date. Entry is
 * explicit and optional, and membership itself is decided in one place for
 * the whole app (`isEnrolled`); these only write the record.
 */
export function startDateProblem(date: string, today: string): string | null {
  if (!isDay(date)) return 'Choose a start date.';
  return date < today ? 'Choose today or a later day.' : null;
}

/** The record after joining: the programme's answers, and its start date. */
export function withJoined(data: AppData, answers: { profile: UserProfile; useMetric: boolean }, startDate: string): AppData {
  return {
    ...data,
    profile: answers.profile,
    settings: { ...data.settings, startDate, currentWeight: answers.profile.weightKg, useMetric: answers.useMetric },
  };
}

/** The record after leaving: no start date. Every session, check-in, swap and answer stays. */
export function withLeft(data: AppData): AppData {
  return { ...data, settings: { ...data.settings, startDate: '' } };
}

/**
 * The Join form's life (codex R02). The wizard stays open, with every answer
 * in it, until the store says the save happened: closing it first would let
 * a refused save throw the answers away. A refusal keeps the wizard open
 * with the reason; closing it after that still keeps the unsaved answers, so
 * opening it again starts from them rather than from the stored profile.
 */
export interface JoinFlow {
  open: boolean;
  /** A save is under way: nothing may be sent again, and nothing may close. */
  busy: boolean;
  /** Why the last save was refused, as the person reads it. */
  error?: string;
  /** The answers last submitted and not yet saved. */
  draft?: WizardResult;
}

export type JoinAction =
  | { type: 'open' }
  | { type: 'cancel' }
  | { type: 'submit'; draft: WizardResult }
  | { type: 'saved' }
  | { type: 'refused'; error: string };

export const JOIN_CLOSED: JoinFlow = { open: false, busy: false };

export function joinFlow(state: JoinFlow, action: JoinAction): JoinFlow {
  switch (action.type) {
    // Opening again is a fresh attempt: the unsaved answers stay, the old reason goes.
    case 'open': return state.busy ? state : { ...state, open: true, error: undefined };
    case 'cancel': return state.busy ? state : { ...state, open: false };
    case 'submit': return state.busy ? state : { open: true, busy: true, draft: action.draft };
    case 'refused': return { ...state, open: true, busy: false, error: action.error };
    case 'saved': return JOIN_CLOSED;
  }
}

/**
 * Submit the Join answers: one save at a time however often the button is
 * pressed, and the flow told only once the store has answered.
 */
export function joinController(
  write: (updater: (data: AppData) => AppData) => Promise<StoreResult>,
  dispatch: (action: JoinAction) => void,
): (draft: WizardResult) => Promise<StoreResult | null> {
  let saving = false;
  return async draft => {
    if (saving) return null;
    saving = true;
    dispatch({ type: 'submit', draft });
    try {
      // Only the answers changed in this wizard, laid over the latest stored
      // profile: another open copy's saved answers stay (scan D-03).
      const result = await write(data => withJoined(data, { ...draft, profile: answeredProfile(data.profile, draft) }, draft.startDate));
      dispatch(result.ok ? { type: 'saved' } : { type: 'refused', error: `That did not save. ${result.failure.message}` });
      return result;
    } catch {
      // The store answers with a result rather than throwing; if anything
      // throws all the same, the wizard must not be left waiting forever.
      dispatch({ type: 'refused', error: 'That did not save. Try again.' });
      return null;
    } finally {
      saving = false;
    }
  };
}

/** What the Join wizard opens with: the unsaved answers if there are any, otherwise the stored profile and today. */
export function joinSeed(state: JoinFlow, data: Pick<AppData, 'profile' | 'settings'>, today: string): WizardResult {
  return state.draft ?? {
    profile: data.profile ?? createDefaultProfile({ weightKg: data.settings.currentWeight || 0, needsHealthReview: true }),
    startDate: today,
    useMetric: data.settings.useMetric,
  };
}

/**
 * Which view Your plan shows (R02). The store shows a change before storing
 * it, so a join or a leave flips membership at once, and flips it back if the
 * save is refused. While either is under way, the view it started from stays,
 * with its answers and its error.
 */
export function planView(enrolled: boolean, saving: { joining: boolean; leaving: boolean }): 'member' | 'join' {
  if (saving.joining) return 'join';
  if (saving.leaving) return 'member';
  return enrolled ? 'member' : 'join';
}

/** The Move tab's Guided session row: today's session for a member, the way in for anyone else. */
export function guidedRow(enrolled: boolean, plan: SessionPlan, today: WeekDay | undefined): { detail: string; join: boolean } {
  if (!enrolled) return { detail: 'The 12-week strength programme', join: true };
  const summary = guidedSummary(plan);
  return { detail: today?.status === 'done' ? `Done today · ${summary}` : summary, join: false };
}

const BODY: Record<string, string> = { lower: 'Lower body', upper: 'Upper body', fullBody: 'Full body' };

/** Today's guided session in one line for the Move tab. */
export function guidedSummary(plan: SessionPlan): string {
  const minutes = `${Math.round(plan.totalSeconds / 60)} min`;
  switch (plan.kind) {
    case 'full': return `${BODY[focusMuscleGroup(plan.focus)] ?? focusLabel(plan.focus)} · ${minutes}`;
    case 'recovery': return `Recovery · ${minutes}`;
    case 'restDay': return plan.cardio ? 'Rest day — mobility and an easy walk' : 'Rest day — mobility only';
    case 'stretch': return `Stretch · ${minutes}`;
    case 'none': return plan.focus === 'rest' && plan.readiness.outcome !== 'red' && plan.readiness.outcome !== 'urgent' ? 'Rest day' : 'Not today';
  }
}
