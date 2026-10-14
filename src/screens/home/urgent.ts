/**
 * The one safety surface (journey §4.7, B-02): every active emergency, stop
 * for today, low being treated and re-check, said at once and the same way on
 * every tab screen, each in the engine's own headline, with when it was
 * measured or answered and the safe action now; an emergency alone (board
 * D224). Ordinary holds (no check-in yet, a profile gap, a
 * foot that needs protecting) are not urgent: tiles and hubs say them in
 * their own mode's words.
 *
 * The decision is the engine's, read from the same gate and the same day's
 * answer every start reads (`permission`, `readinessFor`), whatever the Right
 * now card happens to suggest: a stop, an emergency or a re-check heads the
 * card too, in the same words.
 */
import { createContext, useMemo, useState } from 'react';
import { headline } from '@/components/checkin/copy';
import { gateFor } from '@/components/checkin/start';
import { readinessFor, type Mode, type Permission } from '@/engine/permission';
import { ASKS_FOR_A_READING, RECHECK_MINUTES, STOP_UNANSWERED, profileOnlyReadiness, toMgdl, withLogged } from '@/engine/readiness';
import { nextBoundary, recheckPending, recommend, type RecommendInput, type RecommendationKind } from '@/health/recommend';
import { useGuided } from '@/hooks/useGuided';
import { prefersHour12, timeOf } from '@/lib/time';
import { toDateString } from '@/lib/utils';
import { useClock, useWakeAt } from '@/screens/today/clock';
import { checkInOnly } from './tileLine';
import { loadProgress, type ProgressSlot, type SavedProgress } from '@/session/persistence';
import { setupStateOf } from '@/setup/state';
import { useStore, type StoreState } from '@/store/useStore';
import { DISPOSITION_ORDER, type CheckInRecord, type Disposition, type GlucoseEntry, type Reason } from '@/types/checkin';
import type { UserProfile } from '@/types/profile';

export interface Urgent {
  /** `hold`: a symptom or a reading that holds every movement for now, such as dizziness or repeated lows. */
  kind: 'emergency' | 'seekHelp' | 'recheck' | 'low' | 'hold';
  /** Stop ink for an emergency or a stop for today; caution ink for a low, its re-check and a hold. */
  tone: 'stop' | 'caution';
  /** The engine's own headline, as the Right now card shows it. */
  headline: string;
  /** What it is about, and when it was measured or answered: "Low glucose at 1:30 pm", "Emergency answer today". */
  when: string;
  /** The safe action now, when it has a time of its own: "Re-check at 1:45 pm", then "Re-check now". */
  next?: string;
  /**
   * The engine's own sentences the decision stands on, as a screen showing
   * the gate's answer lists them (`Permission.reasons`): what tells a
   * full-screen task drawing this decision from one drawing an older or
   * another one (`says`, codex W-01).
   */
  reasons: readonly string[];
  /** An unanswered "I need to stop": the safe action is to say what happened (K6R-03). */
  stop?: true;
}

// ============================================================================
// The decision
// ============================================================================

/** Readings behind a stop or a hold, by what was read: the surface names the reading and when it was taken. */
const READ: Record<string, 'glucose' | 'ketones' | 'bp'> = {
  extremeGlucose: 'glucose', severeLow: 'glucose', persistentHi: 'glucose', suspectUnit: 'glucose',
  high: 'glucose', meterHi: 'glucose', noKetones: 'glucose', falling: 'glucose',
  ketonesUrgent: 'ketones', ketonesHigh: 'ketones', illnessKetones: 'ketones', ketonesTrace: 'ketones',
  bpEmergency: 'bp', bpSevere: 'bp', bpHold: 'bp', bpClinicianLimit: 'bp', bpSevereUnconfirmed: 'bp', lowBpDizzy: 'bp',
};
/** Low glucose, and the reading after it: named as a low (`recheckWhen` names the one a re-check counts from). */
const LOW_CODES = new Set(['severeLow', 'low', 'lowNotRecovered', 'lowRepeat', 'tooSoon']);
/** A reading from earlier today, still deciding today (the engine's message says which). */
const EARLIER = new Set([
  'extremeGlucoseEarlier', 'extremeGlucoseAssessed', 'severeLowEarlier', 'severeLowAssessed',
  'ketonesEarlier', 'ketonesEarlierUrgent', 'illnessKetonesEarlier', 'ketonesAssessed', 'bpSevereEarlier', 'bpAssessed',
]);
const READING_NAME = { glucose: 'Glucose reading', ketones: 'Ketone reading', bp: 'Blood pressure reading' } as const;
/** Feeling low, said in the check-in or during movement, with no reading after it yet: treat it as a low. */
const FEELING_LOW = new Set(['lowSymptoms', 'lowReported']);

const LOW_MGDL = 70;
/** A low by its number, in either unit, or a meter showing LO. A reading in no unit the app knows is no low it can name. */
const isLow = (e: GlucoseEntry) => {
  if ('display' in e) return e.display === 'LO';
  return (e.unit === 'mg/dL' || e.unit === 'mmol/L') && toMgdl(e.value, e.unit) < LOW_MGDL;
};
const timeIn = (iso: string | undefined) => (iso ? Date.parse(iso) : Number.NaN);
/** " at 1:30 pm" for a time today, or " today" when the record kept none. */
const atOrToday = (iso: string | undefined, hour12: boolean) => {
  const t = timeIn(iso);
  return Number.isNaN(t) ? ' today' : ` at ${timeOf(t, hour12)}`;
};

/** Today's glucose readings, the check-in's and Track's, as the gate reads them. */
function glucoseToday(c: CheckInRecord | undefined): GlucoseEntry[] {
  if (!c) return [];
  const v = withLogged(c);
  return [...(v.glucoseEarlier ?? []), ...[v.glucose, v.glucoseDisplay].filter((e): e is GlucoseEntry => e !== undefined)];
}

/**
 * When a stop or a hold was measured or answered: the reading behind it and
 * its time, an earlier day's answer, or today's.
 */
function stopWhen(kind: 'emergency' | 'seekHelp' | 'hold', top: Reason | undefined, c: CheckInRecord | undefined, hour12: boolean): string {
  if (!c || !top || top.code.startsWith('carried')) return 'From your last check-in';
  const read = READ[top.code];
  if (read === 'glucose') {
    const latest = glucoseToday(c).filter(e => !Number.isNaN(timeIn(e.measuredAt))).sort((a, b) => timeIn(a.measuredAt) - timeIn(b.measuredAt)).at(-1)
      ?? glucoseToday(c).at(-1);
    return `${LOW_CODES.has(top.code) ? 'Low glucose' : READING_NAME.glucose}${atOrToday(latest?.measuredAt, hour12)}`;
  }
  if (read === 'ketones') return `${READING_NAME.ketones}${atOrToday(withLogged(c).ketones?.measuredAt, hour12)}`;
  if (read === 'bp') return `${READING_NAME.bp}${atOrToday(withLogged(c).bpReadings?.at(-1)?.at, hour12)}`;
  if (EARLIER.has(top.code)) return 'A reading from earlier today';
  return kind === 'emergency' ? 'Emergency answer today' : 'From today’s check-in';
}

/**
 * The reading a re-check counts from, and when: the engine sets the re-check
 * 15 minutes after it (`RECHECK_MINUTES`), so that reading is the one taken
 * then. A low says so; a reading under the start level or falling is named
 * only as a reading. A low just before midnight is the same episode as the
 * readings after it (X2-08), so its time says "yesterday" (A-12).
 */
function recheckWhen(c: CheckInRecord | undefined, hour12: boolean): string {
  const due = timeIn(c?.readiness.recheckAt);
  if (!c || Number.isNaN(due)) return 'Glucose reading today';
  const taken = due - RECHECK_MINUTES * 60_000;
  const reading = glucoseToday(c).find(e => timeIn(e.measuredAt) === taken);
  const day = toDateString(new Date(taken)) === c.date ? '' : ' yesterday';
  return `${reading && isLow(reading) ? 'Low glucose' : READING_NAME.glucose} at ${timeOf(taken, hour12)}${day}`;
}

/** "Re-check at 1:45 pm" until then; "Re-check now" once it is time, or when no time is known. */
function recheckNext(c: CheckInRecord | undefined, now: Date, hour12: boolean): string {
  const due = timeIn(c?.readiness.recheckAt);
  return !Number.isNaN(due) && due > now.getTime() ? `Re-check at ${timeOf(due, hour12)}` : 'Re-check now';
}

export interface UrgentInput {
  profile: UserProfile;
  /** Today's effective record (`useGuided().checkIn`). */
  checkIn?: CheckInRecord;
  /** Every day's records, today's as every screen must act on it. */
  checkIns: readonly CheckInRecord[];
  /** The shared gate's answer for each mode, now. */
  permissions: Record<Mode, Permission>;
}

const MODES: Mode[] = ['guided', 'stretch', 'walk'];

/** The reasons that time a re-check: the re-check's own, said with it while one is due. */
const RECHECK_CODES = new Set(['severeLow', 'lowRepeat', 'low', 'recheckUnknownTime', 'recheckNoTime', 'tooSoon', 'belowStart', 'falling']);

/**
 * Every safety state that stands, and what the surface says for each (journey
 * §4.7, B-02), decided from the engine whatever the Right now card suggests
 * (codex V1-01). An emergency stands alone: "call now", with nothing beside
 * it. Otherwise every active decision, at once, in this order (board D224): a
 * low being treated, reported with no reading yet; the day's own holds, an
 * unanswered stop's "Say what happened" among them, with any symptom or
 * reading that holds every movement (dizziness, repeated lows, a very high
 * reading); a stop for today ("get advice today"); a re-check. Each with its
 * own headline, when it was measured or answered, the safe action, and the
 * engine's sentences it stands on. Ordinary holds are not urgent: no check-in
 * yet, a profile gap, a foot that needs protecting, a reading still to be
 * given, and limits the profile sets for good.
 */
export function urgentsOf({ profile, checkIn, checkIns, permissions }: UrgentInput, now: Date, hour12: boolean = prefersHour12()): Urgent[] {
  const all = MODES.map(m => permissions[m]);
  const day = readinessFor({ profile, ...(checkIn ? { checkIn } : {}), now, recent: [...checkIns] });
  // The profile's standing limits are no part of the day's decision.
  const standing = new Set(profileOnlyReadiness(profile).reasons.map(x => x.code));
  /** The day's own reasons: every refusal of the gate lists them, in any mode (the engine's `decide`). */
  const own = day.reasons.filter(x => !standing.has(x.code));
  const messages = (reasons: typeof own) => reasons.map(x => x.message);
  const emergency = all.find(p => p.disposition === 'emergency');
  if (emergency) {
    const top = day.reasons.find(r => r.disposition === 'emergency');
    return [{ kind: 'emergency', tone: 'stop', headline: headline(emergency).title, when: stopWhen('emergency', top, checkIn, hour12), reasons: messages(own.filter(x => x.disposition === 'emergency')) }];
  }
  // A re-check due while movement waits, advice today beside it or not.
  const rechecking = recheckPending(checkIn) && all.some(p => !p.allowed);
  const found: Urgent[] = [];
  // The engine's words for a low reported with no reading yet: check now, and treat it as a low if that can't be done.
  const low = checkIn ? own.filter(x => FEELING_LOW.has(x.code)) : [];
  if (checkIn && low.length > 0) {
    found.push({ kind: 'low', tone: 'caution', headline: 'Check your glucose now', when: `Feeling low${atOrToday(checkIn.lowSymptomsAt, hour12)}`, reasons: messages(low) });
  }
  // The day's own holds, every movement's: not a reading still to be given, nor the low or the re-check said on their own.
  const holds = own.filter(x => x.disposition === 'hold' && !ASKS_FOR_A_READING.has(x.code) && !FEELING_LOW.has(x.code) && !(rechecking && RECHECK_CODES.has(x.code)));
  if (holds.length > 0) {
    found.push({
      kind: 'hold', tone: 'caution',
      ...(holds.some(x => x.message === STOP_UNANSWERED.reason) ? { stop: true as const } : {}),
      // The check-in's own headline, for every movement at once; a reading the low or the re-check waits for is theirs.
      headline: day.awaitingReading && !rechecking && low.length === 0 ? 'Check again before you start' : 'No exercise for now',
      when: stopWhen('hold', holds[0], checkIn, hour12),
      reasons: messages(holds),
    });
  }
  const advice = all.find(p => p.disposition === 'today');
  if (advice) {
    const top = day.reasons.find(r => r.disposition === 'today');
    found.push({ kind: 'seekHelp', tone: 'stop', headline: headline(advice).title, when: stopWhen('seekHelp', top, checkIn, hour12), reasons: messages(own.filter(x => x.disposition === 'today')) });
  }
  if (rechecking) {
    found.push({
      kind: 'recheck', tone: 'caution', headline: 'Re-check your glucose', when: recheckWhen(checkIn, hour12), next: recheckNext(checkIn, now, hour12),
      reasons: messages(own.filter(x => RECHECK_CODES.has(x.code))),
    });
  }
  return found;
}

/** The first of the decisions that stand (`urgentsOf`), or none. */
export function urgentOf(input: UrgentInput, now: Date, hour12: boolean = prefersHour12()): Urgent | undefined {
  return urgentsOf(input, now, hour12)[0];
}

/** How firmly the gate refuses for each kind of decision. */
const WEIGHT: Record<Urgent['kind'], Disposition> = { emergency: 'emergency', seekHelp: 'today', recheck: 'hold', low: 'hold', hold: 'hold' };

/**
 * Whether a screen drawing this answer of the gate says the urgent decision
 * (codex W-01): a refusal at least as firm, listing every sentence the
 * decision stands on, as the gate lists every decision under the firmest
 * (board D224). A full-screen task's own screen that says it lets the shared
 * surface step aside. One drawn earlier, or for another reason, does not, and
 * the surface stays: a session opened before any check-in, still saying
 * "Check in first" after an emergency was answered on another screen, hides
 * nothing.
 */
export function says(drawn: { allowed: boolean; disposition: Disposition; reasons: readonly string[] }, urgent: Urgent): boolean {
  // A decision with no sentences of its own can't be shown to be drawn anywhere: the surface stays.
  return !drawn.allowed && DISPOSITION_ORDER.indexOf(drawn.disposition) >= DISPOSITION_ORDER.indexOf(WEIGHT[urgent.kind])
    && urgent.reasons.length > 0 && urgent.reasons.every(r => drawn.reasons.includes(r));
}

// ============================================================================
// The inputs, shared with Home
// ============================================================================

/** The guided session and a stretch each keep their own saved run. */
export const SLOTS: ProgressSlot[] = ['guided', 'stretch'];

/**
 * Every day's records with today's as every screen must act on it: the
 * stored one, or an answer the device would not keep that is at least as
 * restrictive (`useGuided().checkIn`).
 */
export function withEffectiveToday(stored: readonly CheckInRecord[], effective: CheckInRecord | undefined): CheckInRecord[] {
  if (!effective || stored.includes(effective)) return [...stored];
  return [...stored.filter(c => c.date !== effective.date), effective];
}

/** What `recommend` works from, all but the gate: what Home freezes, and what the shell reads live. */
export function recommendSources({ now, state, plan, checkIns }: {
  now: Date;
  state: Pick<StoreState, 'settings' | 'profile' | 'sessions' | 'observations'>;
  plan: RecommendInput['plan'];
  checkIns: readonly CheckInRecord[];
}): Omit<RecommendInput, 'permissions'> {
  const saved = SLOTS.map(slot => loadProgress(now.getTime(), slot)).filter((p): p is SavedProgress => p !== null);
  return {
    now, settings: state.settings, ...(state.profile ? { profile: state.profile } : {}), plan,
    sessions: state.sessions, checkIns, observations: state.observations, saved,
    // While setup is unfinished, the profile hold says "Finish setting up" (L-20, board D80).
    setupOpen: setupStateOf(state.settings, state.profile).stage !== 'done',
  };
}

/** The gate's answer for every mode, now. */
export function gatesNow(records: Parameters<typeof gateFor>[0]): Record<Mode, Permission> {
  return { guided: gateFor(records, 'guided'), stretch: gateFor(records, 'stretch'), walk: gateFor(records, 'walk') };
}

/** What Home's card stands on when it is quiet (§12.6): a stop, a re-check or a hold. The one definition, Home's and Trends'. */
export const SAFETY_KINDS: ReadonlySet<RecommendationKind> = new Set(['emergency', 'seekHelp', 'recheck', 'hold']);

/**
 * Whether Home's card stands on a stop, a re-check or a hold now: the verdict
 * Home's quiet branch reads, from the same sources and gate, worked out live
 * and again at each time boundary, so another screen goes quiet with Home
 * (H3-03). A check-in still to give before starting is no hold: the card
 * offers "Check in & start".
 */
export function useHeld(): boolean {
  const state = useStore();
  const guided = useGuided();
  const { now } = useClock();
  const checkIns = useMemo(() => withEffectiveToday(state.checkIns, guided.checkIn), [state.checkIns, guided.checkIn]);
  useWakeAt(nextBoundary(now, { ...(guided.checkIn ? { checkIn: guided.checkIn } : {}), ...(state.settings.habits ? { habits: state.settings.habits } : {}) }));
  return SAFETY_KINDS.has(recommend({ ...recommendSources({ now, state, plan: guided.plan, checkIns }), permissions: gatesNow(guided) }).kind);
}

/**
 * Whether a prompt to move, a walk or a stand-up, is held back now (board
 * D224): while the walk's gate refuses for anything but a check-in still to
 * give. So any hold on movement quiets them, whether or not it raises the
 * shared surface: a stop or any other safety decision, the pause while health
 * answers aren't saved, a change to the phone's clock, setup unfinished, a
 * foot to protect. A check-in or a reading still to give holds nothing back:
 * the walk a prompt leads to asks for it.
 */
export function movementHeld(walk: Permission): boolean {
  return !walk.allowed && !checkInOnly(walk);
}

/** The shared held verdict, live, as every movement prompt asks it: the floating banner and Home's (`offeredNow`). */
export function useMovementHeld(): boolean {
  const { settings } = useStore();
  const guided = useGuided();
  const { now } = useClock();
  useWakeAt(nextBoundary(now, { ...(guided.checkIn ? { checkIn: guided.checkIn } : {}), ...(settings.habits ? { habits: settings.habits } : {}) }));
  return movementHeld(gateFor(guided, 'walk'));
}

// ============================================================================
// The shell's copy
// ============================================================================

/** Where the surface's "What to do" takes the eye on Home: the Right now card. */
export const RIGHT_NOW_ID = 'right-now';

/**
 * The first urgent decision as the shell worked it out, for every screen in it: whether one stands, and which leads.
 * Nothing outside the shell (full-screen tasks show their own stop).
 */
export const UrgentContext = createContext<Urgent | undefined>(undefined);
/** Every urgent decision the shell's surface says, in its order (`urgentsOf`, board D224). */
export const UrgentsContext = createContext<readonly Urgent[]>([]);

/**
 * The urgent decisions as they stand, for the shell. Worked out live from the
 * same inputs as Home's card, again when the clock passes a boundary
 * (`nextBoundary`) and when the app becomes visible; the same list while
 * the words stay the same.
 */
export function useUrgents(): readonly Urgent[] {
  const state = useStore();
  const guided = useGuided();
  const { now } = useClock();
  const checkIns = useMemo(() => withEffectiveToday(state.checkIns, guided.checkIn), [state.checkIns, guided.checkIn]);
  useWakeAt(nextBoundary(now, { ...(guided.checkIn ? { checkIn: guided.checkIn } : {}), ...(state.settings.habits ? { habits: state.settings.habits } : {}) }));
  const urgents = urgentsOf({ profile: guided.profile, ...(guided.checkIn ? { checkIn: guided.checkIn } : {}), checkIns, permissions: gatesNow(guided) }, now);
  // The same list while the words are the same, so the screens under it draw again only when it changes.
  const key = JSON.stringify(urgents);
  const [kept, setKept] = useState({ key, urgents });
  if (kept.key !== key) {
    setKept({ key, urgents });
    return urgents;
  }
  return kept.urgents;
}
