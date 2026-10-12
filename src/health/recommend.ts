/**
 * Today's one recommendation (codex-vision §2; board D5, D20, D25).
 *
 * The app does not ask "what do you want to do?" on launch; it already has a
 * suggestion, says why in a sentence that is always on screen, and keeps
 * "Choose something else" one tap away. The order of precedence is fixed:
 *
 * 1. Safety: an emergency, a "get advice today", a pending glucose re-check or
 *    a hold on the mode that would be suggested. Nothing that starts movement.
 * 2. The small hours, midnight to 04:00: rest, and nothing that starts
 *    movement (scan J2-05). Unwell and away keep their own words.
 * 3. Resume a session left part-way through today.
 * 4. Status (D25): a flare-up gets a gentle stretch, unwell gets rest, away
 *    gets nothing.
 * 5. The walk after a meal the person asked for, in that meal's 45 minutes
 *    (D26). Each meal has its own walk.
 * 6. An explicit focus of stretching or moving more.
 * 7. A habit: the same choice in the same part of the day on 3 of the last
 *    7 days, outside the hours the person usually trains.
 * 8. Today's scheduled programme session, when enrolled and not yet done.
 * 9. Done, or a rest day: something optional and easy.
 * 10. Too little to go on: the chosen focus, or the choice itself.
 *
 * Pure and deterministic. Safety is never computed here: the caller passes in
 * the shared gate's `Permission` for each mode, and this only reads them.
 */

import type { StatusPeriod, UserSettings, WorkoutSession } from '@/types';
import type { CheckInRecord, Readiness } from '@/types/checkin';
import { DISPOSITION_ORDER } from '@/types/checkin';
import type { Meal } from '@/types/habits';
import type { SessionPlan } from '@/types/plan';
import type { UserProfile } from '@/types/profile';
import { checkedIn, PERMISSION_TEXT, type Mode, type Permission } from '@/engine/permission';
import { profileGaps } from '@/engine/health';
import { headline } from '@/components/checkin/copy';
import { minutesLeft, resumeOffer, slotOf, type SavedProgress } from '@/session/persistence';
import { specFromPlanId, stretchHref } from '@/engine/stretch';
import { format, parseISO } from 'date-fns';
import { timeOf } from '@/lib/time';
import { walkSetupHref } from '@/walk/plan';
import type { Observation } from './observation';
import { daysBetween, periodOn, shiftDay, type Status } from './status';

// ============================================================================
// Shapes
// ============================================================================

export type RecommendationKind =
  | 'emergency'
  | 'seekHelp'
  | 'recheck'
  | 'hold'
  | 'resume'
  | 'status'
  | 'preference'
  | 'habit'
  | 'scheduled'
  | 'gentle'
  | 'mealWalk'
  | 'plan'
  | 'choose';

export interface RecommendationAction {
  /** The button's words. */
  label: string;
  /** A route, or a sheet on Today (`/today?…`). */
  to: string;
  /** Set when the action starts movement, which then goes through the shared start gate. */
  mode?: Mode;
}

export interface Recommendation {
  kind: RecommendationKind;
  title: string;
  /** What it is, or what would change a stop. Empty when the gate gave nothing to add. */
  detail: string;
  /** "Why this?", in words, with its real inputs. Always shown (D20). */
  reason: string;
  action: RecommendationAction;
}

export interface RecommendInput {
  now: Date;
  settings: Pick<UserSettings, 'focus' | 'statusPeriods' | 'habits' | 'startDate'>;
  /** The stored profile; absent until one exists. */
  profile?: UserProfile;
  /** Today's planned session, as `planFor` builds it. */
  plan: SessionPlan;
  sessions: readonly WorkoutSession[];
  checkIns: readonly CheckInRecord[];
  observations: readonly Observation[];
  /** Runs saved part-way through: `loadProgress` for each slot, the guided session and a stretch. */
  saved: readonly SavedProgress[];
  /** The shared gate's answer for each mode, asked by the caller. */
  permissions: Record<Mode, Permission>;
}

/** Where actions go. Today's own sheets are addressed by query, so a link can open one. */
export const HREF = {
  guided: '/session',
  resume: '/session?resume=1',
  stretch: '/move/stretch',
  walk: '/walk',
  plan: '/move/plan',
  profile: '/you/profile',
  day: '/track',
  checkIn: (mode: Mode) => `/today?checkin=${mode}`,
  status: '/today?status=1',
  statusNormal: '/today?status=normal',
  choose: '/today?choose=1',
} as const;

// ============================================================================
// Time of day
// ============================================================================

export type DayPart = 'morning' | 'daytime' | 'evening';

/**
 * Three broad parts of the day (codex-vision §2): morning from 04:00,
 * daytime from 12:00, evening from 17:00 until 04:00. The small hours belong
 * to the evening before, which is when someone awake at 01:00 thinks they are.
 */
export function dayPartOf(hour: number): DayPart {
  if (hour >= 4 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'daytime';
  return 'evening';
}

/** The small hours: from midnight until the morning begins at 04:00, the end of `dayPartOf`'s evening. */
export function smallHours(now: Date): boolean {
  return now.getHours() < 4;
}

const PART_WORDS: Record<DayPart, { in: string; adjective: string }> = {
  morning: { in: 'in the morning', adjective: 'morning' },
  daytime: { in: 'in the afternoon', adjective: 'afternoon' },
  evening: { in: 'in the evening', adjective: 'evening' },
};

// ============================================================================
// What the person has done
// ============================================================================

export type ActivityMode = 'programme' | 'stretch' | 'walk';

export interface Activity {
  id: string;
  mode: ActivityMode;
  day: string;
  /** Absent when the record kept no clock time. */
  part?: DayPart;
  /** A walk's start, in minutes after its local midnight: what matches it to a meal (D26). */
  minute?: number;
  /** A walk the person said followed a meal (Walk's "After a meal"). */
  afterMeal?: true;
}

/** A session with real work in it. Skipped and abandoned runs were not a choice carried out. */
function didWork(s: WorkoutSession): boolean {
  return s.status === 'completed' || s.status === 'partial';
}

/** A recorded session's plan kind. Records from before `planKind` carry it in the plan id. */
function kindOf(s: WorkoutSession): WorkoutSession['planKind'] {
  if (s.planKind) return s.planKind;
  if (s.planId?.startsWith('stretch:')) return 'stretch';
  const kind = s.planId?.split(':')[2];
  return kind === 'full' || kind === 'recovery' || kind === 'restDay' ? kind : undefined;
}

/**
 * The day's programme workout, as Move counts it: a guided session or a
 * logged workout. A stretch is its own routine, and a rest-day session is the
 * optional mobility a rest day offers, so neither is the day's workout.
 */
export function isProgrammeSession(s: WorkoutSession): boolean {
  const kind = kindOf(s);
  return kind !== 'stretch' && kind !== 'restDay';
}

/**
 * Every stretch, walk and programme session on record, one entry each.
 *
 * A stretch is a session saved with `planKind: 'stretch'`; any other session
 * is a programme one (older records have no `planKind` and all were). A walk
 * is the observations sharing a `walk:<id>` context, timed by the earliest.
 * A session's start is a UTC instant, so its part of the day is read on this
 * device's clock; an observation carries its own local time.
 */
export function activitiesFrom(sessions: readonly WorkoutSession[], observations: readonly Observation[]): Activity[] {
  const out: Activity[] = [];
  for (const s of sessions) {
    // A rest day's optional mobility is neither a stretch chosen nor training time.
    if (!didWork(s) || kindOf(s) === 'restDay') continue;
    const started = s.startedAt ?? s.completedAt;
    const ms = started ? Date.parse(started) : Number.NaN;
    out.push({
      id: `session:${s.id}`,
      mode: kindOf(s) === 'stretch' ? 'stretch' : 'programme',
      day: s.date,
      ...(Number.isNaN(ms) ? {} : { part: dayPartOf(new Date(ms).getHours()) }),
    });
  }

  const walks = new Map<string, Observation>();
  const afterMeal = new Set<string>();
  for (const o of observations) {
    if (!o.context?.startsWith('walk:')) continue;
    const first = walks.get(o.context);
    if (!first || o.at < first.at) walks.set(o.context, o);
    if (o.tag === 'afterMeal') afterMeal.add(o.context);
  }
  for (const [context, o] of walks) {
    const hour = Number(o.at.slice(11, 13));
    out.push({
      id: context, mode: 'walk', day: o.day, part: dayPartOf(hour), minute: hour * 60 + Number(o.at.slice(14, 16)),
      ...(afterMeal.has(context) ? { afterMeal: true as const } : {}),
    });
  }
  return out;
}

/**
 * A programme session with real work in it on the day. Partly done counts:
 * the person stopped, and the full session is not pushed at them again.
 */
export function trainedOn(sessions: readonly WorkoutSession[], day: string): boolean {
  return sessions.some(s => s.date === day && isProgrammeSession(s) && didWork(s));
}

/** A programme session finished on the day, which is what a weekly count calls done. */
export function completedOn(sessions: readonly WorkoutSession[], day: string): boolean {
  return sessions.some(s => s.date === day && isProgrammeSession(s) && s.status === 'completed');
}

/**
 * The parts of the day the person trains in: wherever a programme session
 * started in the last four weeks. A habit is only promoted outside them, so a
 * morning stretch never displaces the session someone does in the morning.
 *
 * There is no explicit training-time setting, so this is read from what they
 * actually do; with no programme history there is no window to protect.
 */
export function trainingWindow(activities: readonly Activity[], today: string): Set<DayPart> {
  const from = shiftDay(today, -28);
  const parts = new Set<DayPart>();
  for (const a of activities) {
    if (a.mode === 'programme' && a.part && a.day >= from && a.day < today) parts.add(a.part);
  }
  return parts;
}

export interface Habit {
  mode: 'stretch' | 'walk';
  /** Distinct days in the last 7 with this choice at this part of the day. */
  days: number;
}

/**
 * The same choice at the same part of the day on at least 3 of the 7 days
 * before today (codex-vision §2: "at least three matching activity choices").
 * Days, not entries: three stretches in one morning are one morning. Already
 * done at this part of today, it is not suggested again.
 */
export function habitAt(activities: readonly Activity[], today: string, part: DayPart): Habit | undefined {
  const from = shiftDay(today, -7);
  let best: (Habit & { last: string }) | undefined;
  for (const mode of ['stretch', 'walk'] as const) {
    const matching = activities.filter(a => a.mode === mode && a.part === part);
    if (matching.some(a => a.day === today)) continue;
    const days = [...new Set(matching.filter(a => a.day >= from && a.day < today).map(a => a.day))].sort();
    if (days.length < 3) continue;
    const last = days[days.length - 1];
    if (!best || days.length > best.days || (days.length === best.days && last > best.last)) best = { mode, days: days.length, last };
  }
  return best && { mode: best.mode, days: best.days };
}

/**
 * In the programme: the one rule, which Today, Move and You all ask here
 * (board D8; codex F29). A programme start date, and training days to hold
 * the programme on. Joining sets the start date and leaving clears it; the
 * focus setting only chooses what Today leads with, and never enrols anyone.
 */
export function isEnrolled(settings: Pick<UserSettings, 'startDate'>, profile: Pick<UserProfile, 'trainingDays'> | undefined): boolean {
  return typeof settings.startDate === 'string' && settings.startDate.trim() !== '' && (profile?.trainingDays?.length ?? 0) > 0;
}

/** How long the after-meal walk suggestion stays up once the meal is usually over. */
export const MEAL_WALK_WINDOW_MINUTES = 45;

/**
 * The meal whose walk is due now, only for someone who asked for after-meal
 * walks and said when that meal usually ends (D26). Without a time there is
 * no honest way to say "after lunch".
 */
export function mealWalkNow(habits: UserSettings['habits'], now: Date): Meal | undefined {
  const walk = habits?.mealWalk;
  if (!walk?.enabled) return undefined;
  const minute = now.getHours() * 60 + now.getMinutes();
  for (const meal of walk.meals) {
    const finish = clockMinute(walk.finish?.[meal]);
    if (finish === undefined) continue;
    const since = (minute - finish + 1440) % 1440;
    if (since < MEAL_WALK_WINDOW_MINUTES) return meal;
  }
  return undefined;
}

/** A local `HH:MM` as minutes after midnight; anything else is no time at all. */
function clockMinute(clock: string | undefined): number | undefined {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(clock ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : undefined;
}

/** How far from a meal's usual end a walk said to follow a meal can be, and still be that meal's: Walk asks back two hours. */
const MEAL_MATCH_MINUTES = 120;

/**
 * The chosen meal whose walk a walk was (D26: each meal has its own, so one
 * after breakfast never uses up lunch's). A walk the person said followed a
 * meal belongs to the chosen meal whose usual end is nearest its start,
 * within two hours, so a walk after an early breakfast is still breakfast's.
 * Any other walk belongs to a meal only if it started in that meal's 45
 * minutes: earlier, it may as well have come before the meal. Same-day
 * minutes only; the walk carries its own day.
 */
export function mealOfWalk(habits: UserSettings['habits'], walk: Pick<Activity, 'minute' | 'afterMeal'>): Meal | undefined {
  const chosen = habits?.mealWalk;
  if (!chosen || walk.minute === undefined) return undefined;
  let nearest: { meal: Meal; apart: number } | undefined;
  for (const meal of chosen.meals) {
    const finish = clockMinute(chosen.finish?.[meal]);
    if (finish === undefined) continue;
    const since = walk.minute - finish;
    if (!walk.afterMeal) {
      if (since >= 0 && since < MEAL_WALK_WINDOW_MINUTES) return meal;
    } else if (Math.abs(since) <= MEAL_MATCH_MINUTES && (!nearest || Math.abs(since) < nearest.apart)) {
      nearest = { meal, apart: Math.abs(since) };
    }
  }
  return nearest?.meal;
}

// ============================================================================
// Reading the gate
// ============================================================================

/**
 * What a `Permission` means for Today.
 *
 * - `go`: allowed now.
 * - `checkIn`: a routine step before starting: the day's first check-in, or
 *   a fresher glucose reading for someone on insulin or a sulfonylurea. The
 *   suggestion stands and its button says "Check in & start".
 * - `recheck`: a low is being treated and needs a new reading.
 * - `hold`, `today`, `emergency`: the contract's stops (safety contract).
 */
export type Gate = 'go' | 'checkIn' | 'recheck' | 'hold' | 'today' | 'emergency';

const rank = (d: Readiness['disposition']) => DISPOSITION_ORDER.indexOf(d ?? 'reassure');

/** The check-in itself asks to hold (records before v5 carry only the colour). */
function readinessHolds(r: Readiness): boolean {
  return r.disposition !== undefined ? rank(r.disposition) >= rank('hold') : r.outcome === 'red' || r.outcome === 'urgent';
}

/** A treated low waiting for its re-check reading. */
export function recheckPending(checkIn: CheckInRecord | undefined): boolean {
  return checkIn !== undefined && (checkIn.readiness.recheckMinutes !== undefined || checkIn.readiness.recheckAt !== undefined);
}

export function gateOf(p: Permission, checkIn: CheckInRecord | undefined, profileGap: boolean): Gate {
  if (p.disposition === 'emergency') return 'emergency';
  if (p.disposition === 'today') return 'today';
  if (p.allowed && !p.needsCheckIn) return 'go';
  // A treated low's re-check comes first, however the day began: it is the
  // one time-critical step (the check-in sheet takes the reading, and asks
  // its first question, when the person enters it).
  if (recheckPending(checkIn)) return 'recheck';
  // A day begun by any other report holds only what was said: the check-in
  // itself is still to come, so it is asked for rather than a bare hold.
  if (p.needsCheckIn && !profileGap && checkIn !== undefined && !checkedIn(checkIn)) return 'checkIn';
  // A check-in can only clear what is not a stop, and never an unanswered profile.
  if (p.needsCheckIn && !profileGap && (!checkIn || !readinessHolds(checkIn.readiness))) return 'checkIn';
  return 'hold';
}

// ============================================================================
// The recommendation
// ============================================================================

interface Context {
  input: RecommendInput;
  today: string;
  part: DayPart;
  status: Status;
  period?: StatusPeriod;
  enrolled: boolean;
  trainingDay: boolean;
  trained: boolean;
  activities: Activity[];
  checkIn?: CheckInRecord;
  gaps: ProfileGaps;
  profileGap: boolean;
  gates: Record<Mode, Gate>;
}

type ProfileGaps = ReturnType<typeof profileGaps>;

const MODES: Mode[] = ['guided', 'stretch', 'walk'];

export function recommend(input: RecommendInput): Recommendation {
  const today = format(input.now, 'yyyy-MM-dd');
  const checkIn = input.checkIns.find(c => c.date === today);
  // No profile yet is unanswered health questions, as the gate reads it (scan J2-09).
  const gaps = input.profile ? profileGaps(input.profile) : { healthUnreviewed: true, medicinesUnknown: false };
  const profileGap = gaps.healthUnreviewed || gaps.medicinesUnknown;
  const period = periodOn(input.settings.statusPeriods, today);
  const ctx: Context = {
    input,
    today,
    part: dayPartOf(input.now.getHours()),
    status: period?.kind ?? 'normal',
    ...(period ? { period } : {}),
    enrolled: isEnrolled(input.settings, input.profile),
    trainingDay: input.plan.focus !== 'rest',
    trained: trainedOn(input.sessions, today),
    activities: activitiesFrom(input.sessions, input.observations),
    ...(checkIn ? { checkIn } : {}),
    gaps,
    profileGap,
    gates: {
      guided: gateOf(input.permissions.guided, checkIn, profileGap),
      stretch: gateOf(input.permissions.stretch, checkIn, profileGap),
      walk: gateOf(input.permissions.walk, checkIn, profileGap),
    },
  };

  const suggestion = night(ctx) ?? resume(ctx) ?? statusSuggestion(ctx) ?? mealWalk(ctx) ?? preference(ctx) ?? habit(ctx)
    ?? scheduled(ctx) ?? gentle(ctx) ?? fallback(ctx);
  return safety(ctx, suggestion) ?? suggestion;
}

/** The first permission, in mode order, whose gate is `gate`. */
function firstWith(ctx: Context, gate: Gate): Permission | undefined {
  const mode = MODES.find(m => ctx.gates[m] === gate);
  return mode && ctx.input.permissions[mode];
}

/**
 * The gate's own sentences, exactly as given, so a stop reads the same on
 * Today as in the check-in. The fallback only covers a permission that gave
 * no reason at all.
 */
function reasonsOf(p: Permission): string {
  return p.reasons.length ? p.reasons.join(' ') : 'Based on today’s check-in.';
}

/**
 * Priority 1. An emergency or a "today" answer from any mode stops all of
 * them; a re-check stops all of them; a hold stops the mode that would have
 * been suggested, or everything when every mode is held.
 *
 * Titles are the check-in's own headlines (`headline` in the check-in copy),
 * so the person reads one set of words for one answer wherever they see it.
 * No emergency number is shown: the app cannot know which country the person
 * is in. The only action is the check-in, where a mistaken answer can be put
 * right; nothing here starts movement.
 */
function safety(ctx: Context, suggestion: Recommendation): Recommendation | undefined {
  const emergency = firstWith(ctx, 'emergency');
  if (emergency) {
    return {
      kind: 'emergency',
      title: headline(emergency).title,
      detail: emergency.release ?? '',
      reason: reasonsOf(emergency),
      action: { label: 'Review your check-in', to: HREF.checkIn(emergency.mode) },
    };
  }

  const advice = firstWith(ctx, 'today');
  if (advice) {
    return {
      kind: 'seekHelp',
      title: headline(advice).title,
      detail: advice.release ?? '',
      reason: reasonsOf(advice),
      action: { label: 'Review your check-in', to: HREF.checkIn(advice.mode) },
    };
  }

  const recheck = firstWith(ctx, 'recheck');
  if (recheck) {
    return {
      kind: 'recheck',
      title: 'Re-check your glucose',
      // When it is due comes first: the release is the reason's own words (scan J2-03).
      detail: recheckWhen(ctx) ?? recheck.release ?? '',
      reason: reasonsOf(recheck),
      action: { label: 'Enter a new reading', to: HREF.checkIn(recheck.mode) },
    };
  }

  const mode = suggestion.action.mode;
  const held = mode !== undefined
    ? (ctx.gates[mode] === 'hold' ? ctx.input.permissions[mode] : undefined)
    : MODES.every(m => ctx.gates[m] === 'hold') ? ctx.input.permissions.guided : undefined;
  if (!held) return undefined;

  return holdFor(ctx, held);
}

/** A hold, in the gate's own words, with the check-in as the way to put a mistaken answer right. */
function holdFor(ctx: Context, held: Permission): Recommendation {
  if (ctx.profileGap) return profileFirst(ctx.gaps, held);
  return {
    kind: 'hold',
    title: headline(held).title,
    detail: held.release ?? '',
    reason: reasonsOf(held),
    action: { label: 'Review your check-in', to: HREF.checkIn(held.mode) },
  };
}

/**
 * The gate holds every session while the profile is unanswered (contract
 * H-DATA): untouched defaults would read as "no insulin". So this is the top
 * of Today until it is done, and it says exactly what is missing, in the
 * gate's own words.
 */
export function profileFirst(gaps: ProfileGaps, held: Permission): Recommendation {
  return gaps.healthUnreviewed
    ? {
      kind: 'hold',
      title: 'Finish your health profile',
      detail: held.release ?? '',
      reason: PERMISSION_TEXT.healthUnreviewed,
      action: { label: 'Open your health profile', to: HREF.profile },
    }
    : {
      kind: 'hold',
      title: 'Your diabetes medicines',
      detail: held.release ?? '',
      reason: PERMISSION_TEXT.medicinesUnknown,
      action: { label: 'Answer them', to: HREF.profile },
    };
}

/** When the re-check after a low can be taken, from the check-in's own time stamp. */
function recheckWhen(ctx: Context): string | undefined {
  const at = ctx.checkIn?.readiness.recheckAt;
  const ms = at ? Date.parse(at) : Number.NaN;
  if (Number.isNaN(ms)) return undefined;
  return ms > ctx.input.now.getTime()
    ? `Re-check at ${timeOf(ms)}, then enter the new reading.`
    : 'It is time to re-check. Enter the new reading.';
}

/** The button's words: the gate decides whether a check-in comes first. */
function startLabel(ctx: Context, mode: Mode, go: string, verb: string): string {
  if (ctx.gates[mode] !== 'checkIn') return go;
  return ctx.checkIn ? `Re-check & ${verb}` : `Check in & ${verb}`;
}

/** A routine step before starting, said in the detail so the button is not a surprise. */
function beforeStart(ctx: Context, mode: Mode): string {
  const p = ctx.input.permissions[mode];
  return ctx.gates[mode] === 'checkIn' && ctx.checkIn && p.reasons[0] ? ` ${p.reasons[0]}` : '';
}

function weekday(day: string): string {
  return format(parseISO(day), 'EEEE');
}

/**
 * Where a saved run picks up. The player reads its slot from the address: a
 * stretch carries its routine, so the guided session's `?resume=1` would
 * resume the wrong run.
 */
export function resumeHref(saved: Pick<SavedProgress, 'plan'>): string {
  if (slotOf(saved.plan) === 'guided') return HREF.resume;
  const spec = saved.plan.stretch ?? specFromPlanId(saved.plan.id);
  return `${spec ? stretchHref(spec) : '/session?mode=stretch'}&resume=1`;
}

/** The most recently saved run whose offer is `kind` (today's own, or an earlier day's). */
export function savedRun(saved: readonly SavedProgress[], today: string, kind: 'today' | 'earlier'): SavedProgress | undefined {
  return [...saved]
    .filter(s => resumeOffer(today, s).kind === kind)
    .sort((a, b) => b.savedAt - a.savedAt)[0];
}

/**
 * Priority 2 (scan J2-05). From midnight to 04:00 nothing that starts
 * movement is suggested, whatever a plan, focus, habit, meal or paused run
 * would say: the person is told to rest. Unwell and away keep their own
 * words, which already ask for nothing and say how to change the status.
 *
 * What counts as already done here. A walk or session counts on the day it
 * started, which is the day My Day lists it on (`track/timeline.ts`), while
 * D10 still credits each day with its own minutes; so a walk from 23:45 to
 * 00:10 is Thursday's walk, with 10 of its minutes in Friday's total. The
 * small hours belong to the evening before (`dayPartOf`), so here that
 * evening counts as well: at 00:10 the walk is the one just done, and the
 * card says so. From 04:00 the new day starts with nothing done, as its My
 * Day does, and the next walk is a new day's walk.
 */
function night(ctx: Context): Recommendation | undefined {
  if (!smallHours(ctx.input.now) || ctx.status === 'unwell' || ctx.status === 'away') return undefined;
  const evening = shiftDay(ctx.today, -1);
  const moved = ctx.activities.some(a => a.day === ctx.today || (a.day === evening && a.part === 'evening'));
  return {
    kind: 'gentle',
    title: 'Rest well',
    detail: 'Movement can wait until the morning.',
    reason: moved ? 'You have already moved this evening, and it is the middle of the night.' : 'It is the middle of the night.',
    action: { label: 'See your day', to: HREF.day },
  };
}

/** Priority 3. Only today's own run takes the place of a suggestion; an earlier day's is offered beside it. */
function resume(ctx: Context): Recommendation | undefined {
  // D25: while not Normal only gentle movement is offered, so a paused stretch
  // can be picked up during a flare-up, and nothing at all when unwell or away.
  if (ctx.status === 'unwell' || ctx.status === 'away') return undefined;
  const runs = ctx.status === 'flare' ? ctx.input.saved.filter(r => slotOf(r.plan) === 'stretch') : ctx.input.saved;
  const saved = savedRun(runs, ctx.today, 'today');
  if (!saved) return undefined;
  const stretch = slotOf(saved.plan) === 'stretch';
  const mode: Mode = stretch ? 'stretch' : 'guided';
  return {
    kind: 'resume',
    title: stretch ? 'Continue your stretch' : 'Continue your session',
    detail: `${minutesLeft(saved)} min left · ${saved.plan.label}${beforeStart(ctx, mode)}`,
    reason: 'You stopped part-way through. It picks up where you left off.',
    action: { label: startLabel(ctx, mode, 'Continue', 'continue'), to: resumeHref(saved), mode },
  };
}

/** "since Tuesday", "since 3 October", or "today". */
function since(period: StatusPeriod, today: string): string {
  if (period.from === today) return ' today';
  const ago = daysBetween(period.from, today);
  return ago < 7 ? ` since ${weekday(period.from)}` : ` since ${format(parseISO(period.from), 'd MMMM')}`;
}

function until(period: StatusPeriod, today: string): string {
  if (!period.to) return '';
  const ahead = daysBetween(today, period.to);
  return ahead === 0 ? ', until today' : ahead < 7 ? `, until ${weekday(period.to)}` : `, until ${format(parseISO(period.to), 'd MMMM')}`;
}

/** Priority 4 (D25). */
function statusSuggestion(ctx: Context): Recommendation | undefined {
  const { period, today } = ctx;
  if (!period) return undefined;
  const when = `${since(period, today)}${until(period, today)}`;
  switch (period.kind) {
    case 'flare':
      // One gentle stretch is the day's movement in a flare; once it is done,
      // rest is the suggestion, not the same stretch again (scan J2-04 note).
      if (did(ctx, 'stretch')) {
        return {
          kind: 'status',
          title: 'Rest for the rest of the day',
          detail: 'You have had your gentle stretch today. Rest is enough now.',
          reason: `You marked a flare-up${when}, and you have already stretched today.`,
          action: { label: 'See your day', to: HREF.day },
        };
      }
      return {
        kind: 'status',
        title: 'A gentle stretch, or rest',
        detail: `Gentle mobility for your back and hips, or simply rest. Both are fine today.${beforeStart(ctx, 'stretch')}`,
        reason: `You marked a flare-up${when}. Only gentle movement is suggested until you change it.`,
        action: { label: startLabel(ctx, 'stretch', 'Gentle stretch', 'stretch'), to: HREF.stretch, mode: 'stretch' },
      };
    case 'unwell':
      return {
        kind: 'status',
        title: 'Rest today',
        detail: 'Movement can wait until you feel better.',
        reason: `You marked yourself unwell${when}. Nothing is suggested until you change it.`,
        action: { label: 'I feel better', to: HREF.statusNormal },
      };
    case 'away':
      return {
        kind: 'status',
        title: 'Nothing planned while you’re away',
        detail: 'Your plan waits for you.',
        reason: `You marked yourself away${when}.`,
        action: { label: 'I’m back', to: HREF.statusNormal },
      };
  }
}

function stretchFor(ctx: Context, kind: RecommendationKind, reason: string): Recommendation {
  const part = PART_WORDS[ctx.part].adjective;
  return {
    kind,
    title: `${part === 'afternoon' ? 'An' : part === 'evening' ? 'An' : 'A'} ${part} stretch`,
    detail: `Gentle mobility and supported movements.${beforeStart(ctx, 'stretch')}`,
    reason,
    action: { label: startLabel(ctx, 'stretch', 'Stretch now', 'stretch'), to: HREF.stretch, mode: 'stretch' },
  };
}

function walkFor(ctx: Context, kind: RecommendationKind, reason: string): Recommendation {
  const part = PART_WORDS[ctx.part].adjective;
  return {
    kind,
    title: `${part === 'afternoon' ? 'An' : part === 'evening' ? 'An' : 'A'} ${part} walk`,
    detail: `An easy pace: you can talk in full sentences.${beforeStart(ctx, 'walk')}`,
    reason,
    action: { label: startLabel(ctx, 'walk', 'Walk now', 'walk'), to: HREF.walk, mode: 'walk' },
  };
}

const did = (ctx: Context, mode: ActivityMode) => ctx.activities.some(a => a.mode === mode && a.day === ctx.today);

const MEAL_WORD: Record<Meal, string> = { breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner' };

/**
 * Priority 5 (D26). The walk after a meal the person asked for, in the 45
 * minutes after that meal usually ends: ahead of a stated focus, a habit and
 * the day's session, which can all wait, as those minutes cannot. Each meal
 * has its own walk (`mealOfWalk`), so a walk after breakfast leaves lunch's
 * still to come, and the button opens Walk on that meal. A held walk is
 * skipped rather than suggested and then refused; under a status (D25) or in
 * the small hours it is never reached.
 */
function mealWalk(ctx: Context): Recommendation | undefined {
  const { habits } = ctx.input.settings;
  const meal = mealWalkNow(habits, ctx.input.now);
  if (!meal || ctx.gates.walk === 'hold') return undefined;
  if (ctx.activities.some(a => a.mode === 'walk' && a.day === ctx.today && mealOfWalk(habits, a) === meal)) return undefined;
  return {
    kind: 'mealWalk',
    title: `A walk after ${MEAL_WORD[meal]}`,
    detail: `About 10 minutes, starting soon after you finish eating.${beforeStart(ctx, 'walk')}`,
    reason: `You asked for a walk after ${MEAL_WORD[meal]}. In a study of people with type 2 diabetes, a short walk after meals lowered the rise in glucose (Reynolds 2016).`,
    action: { label: startLabel(ctx, 'walk', 'Walk now', 'walk'), to: walkSetupHref(meal), mode: 'walk' },
  };
}

/**
 * Priority 6, outside a scheduled training session: someone who chose
 * stretching and has since joined the programme still gets today's session
 * on a training day. Once today's chosen routine is done it is not pushed a
 * second time.
 */
function preference(ctx: Context): Recommendation | undefined {
  const { focus } = ctx.input.settings;
  if (ctx.enrolled && ctx.trainingDay && !ctx.trained && ctx.input.plan.kind !== 'none') return undefined;
  if (focus === 'stretch' && !did(ctx, 'stretch')) return stretchFor(ctx, 'preference', 'You chose stretching as your focus.');
  if (focus === 'move' && !did(ctx, 'walk')) return walkFor(ctx, 'preference', 'You chose moving more as your focus.');
  return undefined;
}

/** Priority 7. Not inside the part of the day a pending programme session usually happens in. */
function habit(ctx: Context): Recommendation | undefined {
  const found = habitAt(ctx.activities, ctx.today, ctx.part);
  if (!found) return undefined;
  const pending = ctx.enrolled && ctx.trainingDay && !ctx.trained;
  if (pending && trainingWindow(ctx.activities, ctx.today).has(ctx.part)) return undefined;
  const reason = `You usually ${found.mode} ${PART_WORDS[ctx.part].in}.`;
  return found.mode === 'stretch' ? stretchFor(ctx, 'habit', reason) : walkFor(ctx, 'habit', reason);
}

function blocks(plan: SessionPlan): string {
  const names = (['mobility', 'strength', 'cardio'] as const).filter(b => plan.blockStarts[b] !== undefined);
  if (names.length <= 1) return names[0] ?? 'a guided session';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Priority 8. A training day whose session the check-in took off (new
 * numbness, a stop) is still the session that would have been suggested, so
 * its hold is what Today shows, in the gate's words: never "a rest day".
 */
function scheduled(ctx: Context): Recommendation | undefined {
  const { plan } = ctx.input;
  if (!ctx.enrolled || !ctx.trainingDay || ctx.trained) return undefined;
  if (plan.kind === 'none') return ctx.gates.guided === 'hold' ? holdFor(ctx, ctx.input.permissions.guided) : undefined;
  const minutes = Math.round(plan.totalSeconds / 60);
  const recovery = plan.kind === 'recovery';
  const adjusted = ctx.checkIn && (ctx.checkIn.readiness.outcome === 'amber' || recovery) ? ' Adjusted for today’s check-in.' : '';
  return {
    kind: 'scheduled',
    title: plan.label,
    detail: `${minutes} min · ${recovery ? 'a gentler recovery version today' : blocks(plan)}.${adjusted}${beforeStart(ctx, 'guided')}`,
    reason: 'A training day in your plan, and today’s session is not done yet.',
    action: { label: startLabel(ctx, 'guided', recovery ? 'Start recovery session' : 'Start session', 'start'), to: HREF.guided, mode: 'guided' },
  };
}

/**
 * Priority 9. After the day's session, on a rest day, or once someone outside
 * the programme has already moved: something optional and easy, never a
 * second demanding workout. A mode the gate holds is skipped rather than
 * suggested and then refused.
 */
function gentle(ctx: Context): Recommendation | undefined {
  const moved = did(ctx, 'stretch') || did(ctx, 'walk') || ctx.trained;
  const applies = ctx.enrolled ? ctx.trained || !ctx.trainingDay || ctx.input.plan.kind === 'none' : moved;
  if (!applies) return undefined;

  const free = (mode: Mode) => ctx.gates[mode] !== 'hold';
  const reason = ctx.trained
    ? (completedOn(ctx.input.sessions, ctx.today) ? 'Today’s session is done, so nothing demanding.' : 'You did part of today’s session, so nothing demanding.')
    : ctx.enrolled && ctx.trainingDay ? 'Today’s session is off after your check-in, so nothing demanding.'
      : ctx.enrolled ? 'A rest day in your plan. Rest counts too.'
        : 'You have already moved today.';

  // A gentle routine chosen recently comes first; otherwise a walk.
  const from = shiftDay(ctx.today, -7);
  const stretchedRecently = ctx.activities.some(a => a.mode === 'stretch' && a.day >= from && a.day < ctx.today);
  const order: ('stretch' | 'walk')[] = stretchedRecently ? ['stretch', 'walk'] : ['walk', 'stretch'];
  const pick = order.find(mode => free(mode) && !did(ctx, mode));
  if (pick === 'stretch') return { ...stretchFor(ctx, 'gentle', reason), title: 'A gentle stretch, if you like' };
  if (pick === 'walk') return { ...walkFor(ctx, 'gentle', reason), title: 'An easy walk, if you like' };
  return {
    kind: 'gentle',
    title: 'That’s today’s movement',
    detail: 'Nothing more is needed today.',
    reason,
    action: { label: 'See your day', to: HREF.day },
  };
}

/** Priority 10. Missing information is not a reason to invent a need. */
function fallback(ctx: Context): Recommendation {
  if (ctx.input.settings.focus === 'strength') {
    return {
      kind: 'plan',
      title: 'The 12-week programme',
      detail: 'A coached strength session on the days you choose, adapted to your back.',
      reason: 'You chose building strength.',
      action: { label: 'See the programme', to: HREF.plan },
    };
  }
  return {
    kind: 'choose',
    title: 'What would you like to do?',
    detail: 'Stretch, walk, a guided session, a log or something to read.',
    reason: 'There is not enough to go on yet to suggest one thing, so the choice is yours.',
    action: { label: 'See the choices', to: HREF.choose },
  };
}

// ============================================================================
// Freezing
// ============================================================================

/**
 * What makes Today work out its recommendation again: a new day, the end of
 * the small hours (whose "Rest well" must not outlast them), a return to the
 * screen, a new or changed check-in, a change of status, or the plan moved
 * back. Anything else in the store can change while the person reads, and
 * the suggestion stays where it is; that includes the answer to the plan
 * offer, which is kept on the status periods but changes no suggestion.
 */
export function freezeKey(input: {
  now: Date;
  checkIns: readonly CheckInRecord[];
  statusPeriods?: readonly StatusPeriod[];
  /** Moving the plan back is an explicit change too. */
  startDate: string;
  /** Bumped each time the person comes back to the screen. */
  visit: number;
}): string {
  const today = format(input.now, 'yyyy-MM-dd');
  const parts = [today, smallHours(input.now), input.visit, input.startDate, input.checkIns.find(c => c.date === today) ?? null, input.statusPeriods ?? []];
  return JSON.stringify(parts, (field, value: unknown) => (field === 'planShift' ? undefined : value));
}
