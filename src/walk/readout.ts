/**
 * What each state of a walk says on screen. The screens only lay these out.
 *
 * The rule throughout is codex-vision §9: say what was observed and how, and
 * never fill a gap with a plausible number. Poor signal reads "Measuring
 * pace…", not 0:00 or a pace from a minute ago; a blank stays a blank.
 */

import { format } from 'date-fns';
import { PERMISSION_TEXT, type Permission } from '@/engine/permission';
import type { CheckInRecord } from '@/types/checkin';
import { RECHECK_MINUTES, STOP_UNANSWERED, toMgdl, TREAT } from '@/engine/readiness';
import { toDateString } from '@/lib/utils';
import type { GapCause, Walk, WalkPlan } from './clock';
import { clock, count, km, pace, span, timeOfDay, wholeMinutes } from './format';
import { ADDABLE_GAP_MS, type GpsState, type LiveSnapshot, type Notice, type StepsState } from './live';
import { afterMealTitle } from './plan';
import type { WalkSummary } from './record';
import type { VoiceTrouble } from '@/voice/clips';
import type { VoiceStatus } from './voice';
import type { Split } from './route';

export interface Figure {
  /** The figure, or a short word in its place. */
  value: string;
  /** Present only when `value` is a number. */
  unit?: string;
  /** How it was observed, or why it was not. */
  note: string;
}

export function walkTitle(walk: Pick<Walk, 'plan'>): string {
  return walk.plan.kind === 'afterMeal' && walk.plan.meal ? `Walk ${afterMealTitle(walk.plan.meal.which).toLowerCase()}` : 'Walk';
}

/** The live screen's bar title: short enough for a 320 px bar, which holds about 16 characters. */
export function liveTitle(walk: Pick<Walk, 'plan'>): string {
  return walk.plan.kind === 'afterMeal' && walk.plan.meal ? afterMealTitle(walk.plan.meal.which) : 'Walk';
}

/**
 * The one line under the title that says whether anything is being recorded.
 * Only a running walk is recording: a held or paused one must not claim to be.
 */
export function recordingLine(snapshot: Pick<LiveSnapshot, 'walk' | 'blocked'>): string {
  if (snapshot.blocked) return 'On hold. Nothing is being recorded.';
  return snapshot.walk.status === 'running' ? 'Recording while this screen is open' : 'Paused. Nothing is being recorded.';
}

/**
 * When the tab's storage refused the walk in progress, only this page holds
 * its latest state. Said plainly, with what to do, because a reload would
 * bring back an older copy or none (re-audit F08).
 */
export function draftWarning(kept: boolean, where: 'live' | 'summary'): string | undefined {
  if (kept) return undefined;
  return where === 'live'
    ? 'This phone would not store the walk in progress, so a reload would lose the latest of it. Finish to save it.'
    : 'This phone would not store this unsaved walk, so a reload would lose it. Save it now.';
}

/** Shown only while recording, when the screen may go dark and stop it. */
/** On a held walk after a change to the phone's clock (B-19). */
export function clockLine(walk: Pick<Walk, 'clockChangedAt'>): string | undefined {
  return walk.clockChangedAt === undefined
    ? undefined
    : 'Your phone’s clock changed during this walk, so a reading from before the change can’t be timed. Check your glucose again to carry on.';
}

export function wakeHint(snapshot: Pick<LiveSnapshot, 'wake' | 'walk' | 'blocked'>): string | undefined {
  return snapshot.wake === 'unavailable' && snapshot.walk.status === 'running' && !snapshot.blocked
    ? 'Keep this screen on to keep tracking.'
    : undefined;
}

/** Steps, when motion access was turned down at the start (journey §9.1). */
export const STEPS_DENIED: Figure = { value: 'Steps not counted', note: 'Motion access was turned down when this walk started.' };

/** When the phone refused the walk's last checkpoint for want of space (journey §9.4). */
export function journalLine(s: Pick<LiveSnapshot, 'journalFull'>): string | undefined {
  return s.journalFull ? 'This phone is out of space. Your walk is kept on this screen; free some space and tap Save.' : undefined;
}

/**
 * The voice's line on the live walk (journey §9.2, V-J16). A screen opened
 * without the tap that starts a walk (a reload, a link) has a locked audio
 * element, and only a tap unlocks it.
 */
export function cueLine(voice: { status: VoiceStatus; trouble: VoiceTrouble | null }, online: boolean): { text: string; unlock: boolean } | undefined {
  if (voice.trouble === 'blocked' || voice.status === 'idle') return { text: 'Voice cues are off until you turn them on.', unlock: true };
  if (voice.status === 'unavailable') return { text: online ? 'Voice cues aren’t available right now.' : 'Voice cues need a connection.', unlock: false };
  return undefined;
}

/** Where the route will be, before there is one to draw. */
export function routePlaceholder(gps: LiveSnapshot['gps']): string {
  return gps.state === 'denied' || gps.state === 'unsupported' ? 'Location is off, so no route is drawn.' : 'Finding your location…';
}

export function targetLine(observedMs: number, targetMinutes: number | undefined): string | undefined {
  if (targetMinutes === undefined) return undefined;
  const left = targetMinutes * 60_000 - observedMs;
  return left > 0 ? `Your target is ${targetMinutes} min · ${clock(left + 999)} to go` : `You reached your ${targetMinutes} minutes`;
}

const PACE_WORDS: Record<Exclude<GpsState, 'ok' | 'off'>, Figure> = {
  unsupported: { value: 'Not available', note: 'This browser cannot share your location.' },
  denied: { value: 'Location is off', note: 'The walk is still being timed.' },
  paused: { value: 'Paused', note: 'Recent pace, GPS estimate' },
  acquiring: { value: 'Measuring pace…', note: 'Finding your position' },
  measuring: { value: 'Measuring pace…', note: 'Recent pace, GPS estimate' },
  still: { value: 'Measuring pace…', note: 'Pace shows once you are moving' },
  weak: { value: 'Weak GPS signal', note: 'Open sky helps' },
  lost: { value: 'No GPS signal', note: 'Distance is not being measured' },
};

/** Pace, when GPS is on for this walk. */
export function paceFigure(gps: LiveSnapshot['gps']): Figure | undefined {
  if (gps.state === 'off') return undefined;
  if (gps.state === 'ok' && gps.secPerKm !== undefined) {
    return { value: pace(gps.secPerKm), unit: 'min/km', note: 'Recent pace, GPS estimate' };
  }
  return PACE_WORDS[gps.state === 'ok' ? 'measuring' : gps.state];
}

/** Distance so far, when GPS is on for this walk. Nothing measured yet is not 0 km. */
export function distanceFigure(snapshot: Pick<LiveSnapshot, 'gps' | 'distanceM' | 'distanceMeasured'>): Figure | undefined {
  const { gps, distanceM, distanceMeasured } = snapshot;
  if (gps.state === 'off') return undefined;
  if (distanceMeasured) return { value: km(distanceM), unit: 'km', note: 'Distance measured by GPS' };
  if (gps.state === 'denied' || gps.state === 'unsupported') return { value: 'Not measured', note: 'Distance needs your location' };
  return { value: 'Measuring…', note: 'Distance measured by GPS' };
}

/** Steps, when they are on for this walk. */
export function stepsFigure(state: StepsState, steps: number, locale?: string): Figure | undefined {
  switch (state) {
    case 'off':
      return undefined;
    case 'counting':
    case 'paused':
      return { value: count(steps, locale), unit: steps === 1 ? 'step' : 'steps', note: 'Counted while the app is open' };
    case 'waiting':
      return { value: 'Starting…', note: 'Counted while the app is open' };
    case 'needsPermission':
      return { value: 'Not counting', note: 'Your iPhone needs a tap to allow motion again.' };
    case 'denied':
      return { value: 'Not counting', note: 'Motion access is off for this app.' };
    case 'noSensor':
      return { value: 'Not counting', note: 'No motion sensor this browser can read.' };
    case 'unsupported':
      return { value: 'Not available', note: 'This browser has no motion sensor.' };
  }
}

/** A minute-by-minute line for screen readers, so the figures are heard without a timer chattering every second. */
export function spokenProgress(snapshot: LiveSnapshot): string {
  const minutes = Math.floor(snapshot.observedMs / 60_000);
  const parts = [`${minutes} ${minutes === 1 ? 'minute' : 'minutes'} recorded`];
  if (snapshot.distanceMeasured) parts.push(`${km(snapshot.distanceM)} kilometres`);
  if (snapshot.stepsState === 'counting') parts.push(`${snapshot.steps} steps`);
  return `${parts.join(', ')}.`;
}

const AWAY: Record<GapCause, string> = {
  hidden: 'while the app was away',
  interrupted: 'while the app was away',
  left: 'while this screen was closed',
};

export interface NoticeText {
  message: string;
  /** Offered only for a gap of a minute or more. */
  add?: string;
}

/** After coming back: what happened, and the offer to count the time. */
export function noticeText(notice: Notice): NoticeText {
  const ms = notice.gap.end - notice.gap.start;
  if (notice.kind === 'added') {
    return { message: `Added ${wholeMinutes(ms)} min as time you entered. It is kept separate from recorded time.` };
  }
  return {
    message: `Recording paused ${AWAY[notice.gap.cause]}, for ${span(ms)}. Continue walking, or finish?`,
    ...(ms >= ADDABLE_GAP_MS ? { add: `I kept walking: add ${wholeMinutes(ms)} min` } : {}),
  };
}

export interface SummaryRow {
  label: string;
  value: string;
  detail?: string;
}

/**
 * The summary's rows, in order. Only what was observed or entered is listed,
 * each with how it was observed; anything off for this walk is not a row.
 */
/** "1 min 30 s" or "18 min": to the second under 10 minutes, where rounding to a minute would hide a dropout. */
function coverSpan(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s >= 600 || s % 60 === 0) return span(ms);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}

/** One row for each complete kilometre (journey §9.5). A kilometre still under way isn't a split. */
export function splitRows(splits: readonly Split[]): SummaryRow[] {
  return splits.map(s => ({ label: `Kilometre ${s.km}`, value: `${pace(s.ms / 1000)} min` }));
}

/** In place of a route (journey §9.5, V-J20). Without the walk's plan, as on a saved walk's detail, the plain line. */
export function noRouteLine(plan?: Pick<WalkPlan, 'gps' | 'keepRoute'>): string {
  if (!plan) return 'No route kept for this walk.';
  if (!plan.gps) return 'No route: location was off for this walk.';
  if (!plan.keepRoute) return 'No route: routes aren’t kept on this phone.';
  return 'No route: no location was found during this walk.';
}

export function summaryRows(walk: Walk, summary: WalkSummary, options: { locale?: string; time?: (t: number) => string; energy?: { value: string; detail: string } } = {}): SummaryRow[] {
  const time = options.time ?? (t => timeOfDay(t, options.locale));
  const rows: SummaryRow[] = [];
  const meal = walk.plan.kind === 'afterMeal' ? walk.plan.meal : undefined;
  if (meal) {
    rows.push(meal.basis === 'had'
      ? { label: afterMealTitle(meal.which), value: `Had at ${time(meal.startedAt)}`, detail: 'When you had the meal' }
      : { label: afterMealTitle(meal.which), value: `Started ${time(meal.startedAt)}`, detail: 'When the meal started' });
  }

  if (walk.plan.gps) {
    if (summary.distanceM !== undefined) {
      const short = (summary.gpsCoverage ?? 0) < 0.8;
      rows.push({
        label: 'Distance',
        value: `${km(summary.distanceM)} km`,
        detail: `Measured by GPS for ${coverSpan(summary.coveredMs ?? 0)} of ${coverSpan(summary.observedMs)}${short ? '. The signal dropped out for part of the walk, so this may be short.' : ''}`,
      });
    } else {
      rows.push({ label: 'Distance', value: 'Not measured', detail: 'GPS did not measure this walk' });
    }
    if (summary.paceSecPerKm !== undefined) {
      rows.push({ label: 'Average pace', value: `${pace(summary.paceSecPerKm)} min/km`, detail: 'GPS estimate' });
    }
  }

  if (walk.plan.stepsDenied) {
    rows.push({ label: 'Steps', value: 'Not counted', detail: STEPS_DENIED.note });
  } else if (walk.plan.steps) {
    rows.push(summary.steps !== undefined
      ? { label: 'Steps', value: count(summary.steps, options.locale), detail: `Counted while the screen was on: ${wholeMinutes(summary.stepsCoveredMs ?? 0)} of ${wholeMinutes(summary.observedMs)} min` }
      : { label: 'Steps', value: 'Not counted', detail: 'No motion data arrived' });
  }
  if (options.energy) rows.push({ label: 'Energy (estimate)', ...options.energy });

  if (summary.addedMs >= 1000) {
    rows.push({ label: 'Time you added', value: `${wholeMinutes(summary.addedMs)} min`, detail: 'Entered by you for time the app was away' });
  }
  if (summary.awayMs >= ADDABLE_GAP_MS) {
    rows.push({ label: 'Not recorded', value: span(summary.awayMs), detail: 'The app was away, so this time is not counted' });
  }
  return rows;
}

/**
 * When the walk ran: "7:40 pm to 8:05 pm", or one time when both fall in the
 * same minute, with the date in front when it was not today — a walk left
 * open overnight is offered the next morning.
 */
export function walkSpan(from: number, to: number, options: { today?: string; time?: (t: number) => string } = {}): string {
  const time = options.time ?? (t => timeOfDay(t));
  const start = time(from);
  const end = time(to);
  const span = start === end ? start : `${start} to ${end}`;
  const started = new Date(from);
  return options.today === undefined || toDateString(started) === options.today ? span : `${format(started, 'EEE d MMM')}, ${span}`;
}

/** A line under the summary's figure when the walk did not end with Finish. */
export function endingLine(walk: Walk, time: (t: number) => string = t => timeOfDay(t)): string | undefined {
  if (walk.endedBy === 'stale') {
    return `This walk was left open, so it was finished at ${time(walk.finishedAt ?? walk.seenAt)}, when the app last saw it. Here is what was recorded.`;
  }
  if (walk.endedBy === 'interrupted') {
    return `The app closed during this walk, so it ends at ${time(walk.finishedAt ?? walk.seenAt)}, when it was last kept. Here is what was recorded.`;
  }
  if (walk.endedBy === 'emergency') return 'This walk ended because of symptoms that need emergency help.';
  return undefined;
}

/**
 * What a held walk offers besides its reasons (re-audit N01, N06). Help comes
 * first in an emergency, and never a form in its place. After "I feel low",
 * the reading that can answer it. After "I need to stop" with nothing said
 * since, the stop's own question, which answers it (journey §4.4). Held for
 * the health questions, the profile where they are answered. Any other hold —
 * no check-in today, a reading too old to restart on, dizziness until today's
 * answers change — the shared check-in, where today's answers are given and
 * changed.
 */
export type HeldAction = 'emergency' | 'lowReading' | 'stop' | 'profile' | 'checkIn';

export function heldAction(refusal: Permission, low: boolean): HeldAction {
  if (refusal.disposition === 'emergency') return 'emergency';
  if (low) return 'lowReading';
  if (refusal.reasons.includes(STOP_UNANSWERED.reason)) return 'stop';
  const profile = refusal.reasons.some(r => r === PERMISSION_TEXT.healthUnreviewed || r === PERMISSION_TEXT.medicinesUnknown);
  return profile ? 'profile' : 'checkIn';
}

/** "I feel low" was said during this walk, whatever has been said since. */
export function lowReportedDuring(today: CheckInRecord | undefined, walk: Pick<Walk, 'startedAt'>): boolean {
  const at = today?.lowSymptomsAt ? Date.parse(today.lowSymptomsAt) : Number.NaN;
  return Number.isFinite(at) && at >= walk.startedAt;
}

/** A low reported during this walk, its symptoms not yet said to have gone. */
export function lowOpen(today: CheckInRecord | undefined, walk: Pick<Walk, 'startedAt'>): boolean {
  return !!today?.news.includes('lowSymptoms') && lowReportedDuring(today, walk);
}

/** After a report the device would not keep: it still counts, and may not last. */
export function reportNote(stored: boolean): string | undefined {
  return stored ? undefined : 'This device could not save that, so it may be lost if you close the app. It still counts for now.';
}

/**
 * Where a low reported on this walk stands (X2-13), timed from the low itself
 * — never from when the walk finished:
 * - `untreated`: "I feel low", nothing measured since: treat it, re-check 15
 *   minutes after the low began;
 * - `waiting`: a low reading is in and not yet re-checked: treat it, and
 *   re-check at the engine's own time when it gives one;
 * - `due`: that time has come.
 * Nothing when no low was reported on this walk, or a reading since was not low.
 */
export interface LowStage {
  stage: 'untreated' | 'waiting' | 'due';
  /** When the low began, or was measured. */
  since: number;
  recheckAt: number;
}

const RECHECK_MS = RECHECK_MINUTES * 60_000;

/** Today's current glucose — the newer of the number and a HI or LO — with its time, and whether it is low. */
function currentReading(today: CheckInRecord): { t: number; low: boolean } | undefined {
  const g = today.glucose?.measuredAt ? { t: Date.parse(today.glucose.measuredAt), low: toMgdl(today.glucose.value, today.glucose.unit) < 70 } : undefined;
  const d = today.glucoseDisplay?.measuredAt ? { t: Date.parse(today.glucoseDisplay.measuredAt), low: today.glucoseDisplay.display === 'LO' } : undefined;
  const known = [g, d].filter((x): x is { t: number; low: boolean } => !!x && Number.isFinite(x.t));
  return known.sort((a, b) => b.t - a.t)[0];
}

export function lowStage(today: CheckInRecord | undefined, walk: Pick<Walk, 'startedAt'>, now: number): LowStage | undefined {
  if (!today || !lowReportedDuring(today, walk)) return undefined;
  const at = (since: number, recheckAt: number, before: LowStage['stage']): LowStage =>
    ({ stage: now >= recheckAt ? 'due' : before, since, recheckAt });
  const engine = today.readiness?.recheckAt ? Date.parse(today.readiness.recheckAt) : Number.NaN;
  if (Number.isFinite(engine)) return at(engine - RECHECK_MS, engine, 'waiting');
  const felt = Date.parse(today.lowSymptomsAt!);
  const reading = currentReading(today);
  if (reading && reading.t >= felt) return reading.low ? at(reading.t, reading.t + RECHECK_MS, 'waiting') : undefined;
  return at(felt, felt + RECHECK_MS, 'untreated');
}

/** What the summary says for it, with the check-in's own treatment sentence (`TREAT`). */
export function lowAdvice(s: LowStage, time: (t: number) => string): { title: string; lines: string[] } {
  if (s.stage === 'untreated') {
    return { title: 'Treat the low now', lines: [TREAT, `Your re-check is due at ${time(s.recheckAt)}, 15 minutes after the low began.`] };
  }
  if (s.stage === 'waiting') {
    // The player's words for the same state: the 15 g, and when to measure again (J2-03).
    return {
      title: `Treat the low, then re-check at ${time(s.recheckAt)}`,
      lines: [TREAT, `Your re-check is due at ${time(s.recheckAt)}, 15 minutes after the low reading at ${time(s.since)}.`],
    };
  }
  return { title: 'Your re-check is due', lines: ['Check your glucose now.', `If it is still low, or you cannot check: ${TREAT}`] };
}

/**
 * The same words on the walk's hold card, once a low reading is in (J2-03).
 * Before any reading the card already carries the engine's own: check now,
 * or treat it as a low if you cannot.
 */
export function heldLowAdvice(s: LowStage | undefined, time: (t: number) => string): { title: string; lines: string[] } | undefined {
  return s && s.stage !== 'untreated' ? lowAdvice(s, time) : undefined;
}
