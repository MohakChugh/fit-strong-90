/**
 * Per-mode permission (board D30): may this person start Guided, Stretch or
 * Walk now, and if not, what would change the answer?
 *
 * Every screen that starts movement asks this, never the readiness colour.
 * The colour (`Readiness.outcome`) stays for older screens; it cannot express
 * a data hold, a stale reading or a restriction that rules out one mode only,
 * so recovery or green is never permission on its own.
 *
 * On top of the check-in's own evaluation this applies, in one merge where
 * the most serious answer wins:
 * - no check-in today: a check-in is needed first;
 * - D29(6): with insulin or a sulfonylurea, the glucose reading must be from
 *   the last 30 minutes and carry its time (app policy, from the research's
 *   15–30 minute reading cadence around exercise);
 * - D29(5): an unreviewed health profile, or diabetes with medicine answers
 *   never given, is a data hold, because the untouched defaults would read as
 *   "no insulin";
 * - restrictions that rule out one mode only, such as no walking with a foot
 *   that needs protecting while seated work goes ahead.
 */

import type { CheckInRecord, DailyCheckIn, Disposition, Mode, Modifier, Readiness } from '@/types/checkin';
import { DISPOSITION_ORDER } from '@/types/checkin';
import type { UserProfile } from '@/types/profile';
import { toDateString } from '@/lib/utils';
import { deriveHealth, profileGaps } from './health';
import { durableView, EMERGENCY_CALL, evaluateCheckIn, profileOnlyReadiness, withLogged } from './readiness';

export type { Disposition, Mode } from '@/types/checkin';

export interface PermissionInput {
  profile: UserProfile;
  checkIn?: CheckInRecord;
  now: Date;
  /** Earlier check-ins, any order. Optional: only the two-days-running and spread rules read them. */
  recent?: DailyCheckIn[];
}

export interface Permission {
  mode: Mode;
  allowed: boolean;
  disposition: Disposition;
  /** Plain sentences, most important first. Safe to show as-is. */
  reasons: string[];
  /** What would change the answer, e.g. "Re-check your glucose in 15 minutes." */
  release?: string;
  /** Limits inside an allowed mode, as plain sentences, most important first, e.g. "No head-down positions." */
  restrictions: string[];
  /**
   * The same limits for code, one per sentence in `restrictions`, same order.
   * Always set by `permission` and `resumePermission`; optional only so a
   * hand-built `Permission` (tests, defaults) stays valid.
   */
  codes?: RestrictionCode[];
  /** True when a new or first check-in is needed before this mode can start: none today, stale per D29(6), or a recheck pending. */
  needsCheckIn: boolean;
}

/** D29(6): a pre-session reading for insulin or a sulfonylurea must be this recent. */
export const FRESH_MINUTES = 30;
/** Clock drift allowed for a reading stamped a little after "now". */
const FUTURE_SLACK_MINUTES = 2;

export const PERMISSION_TEXT = {
  /** The headline for an emergency, on every screen. */
  emergencyTitle: 'Call emergency services now',
  /** What to do, with no country-specific number. */
  emergencyCall: EMERGENCY_CALL,
  emergencyNoExercise: 'No exercise today.',
  noCheckIn: 'Check in first, so today’s movement fits how you are.',
  healthUnreviewed: 'Finish the health questions in your profile first, so the app knows what keeps you safe.',
  medicinesUnknown: 'Tell the app which diabetes medicines you take first: some of them change what is safe before exercise.',
  stale: `With insulin or a sulfonylurea, check your glucose within ${FRESH_MINUTES} minutes of starting.`,
  staleNoTime: 'Add the time you took your glucose reading: with insulin or a sulfonylurea it must be from the last 30 minutes.',
  future: 'Your glucose reading’s time is later than now. Check the time and enter it again.',
  footWalk: 'No walking today: your foot needs protecting. Seated and floor work can still go ahead.',
} as const;

const RELEASES = {
  checkIn: 'Answer today’s check-in.',
  profile: 'Answer the health questions in your profile.',
  medicines: 'Answer the diabetes medicine questions in your health profile.',
  fresh: 'Check your glucose now and add the reading.',
  foot: 'Walking is back once your foot has healed or a clinician says it is fine.',
  provoked: 'Try it again tomorrow, once your symptoms have settled.',
} as const;

/** Refusals for the rest of the day, by the movement that made symptoms worse (X2-09, J2-04): no answer changes them. */
const PROVOKED = ['provokedWalk', 'provokedStretch'];
/**
 * Refusals of a new start only. A stretch that sent symptoms further down
 * means no new stretch today (J2-04), while the routine under way carries on
 * without that drill (acceptance J02). A walk is one movement, so it stops (X2-09).
 */
const STARTS_ONLY = ['provokedStretch'];

/** A restriction inside an allowed mode: a session modifier, or one of the readiness flags. */
export type RestrictionCode = Modifier | 'capHeavy' | 'vigorousLocked' | 'nerve' | 'backAmber' | 'recovery' | 'rpeOnly';

/** Each restriction in the words that matter for the mode; a modifier with nothing to say for a mode is left out. */
const RESTRICTIONS: Record<Mode, Partial<Record<RestrictionCode, string>>> = {
  guided: {
    recovery: 'A recovery session only: gentle mobility and an easy walk, no lifting.',
    FOOT: 'Seated and floor work only: nothing that loads your feet.',
    HEAD: 'No head-down positions.',
    INT: 'Moderate effort only: you can talk in full sentences. No intervals.',
    LOAD: 'Lighter weights and more reps, and no holds longer than 30 seconds.',
    capHeavy: 'No heavy or maximal lifts.',
    vigorousLocked: 'No intervals or heavy lifts until a clinician clears you for vigorous exercise.',
    IMPACT: 'No jumping or jarring.',
    nerve: 'Leg symptoms: nerve sliders only, no long hamstring holds, and stop anything that sends symptoms further down the leg.',
    backAmber: 'No progression today, and a smaller range on anything that provokes your back.',
    HYPO: 'Fast-acting carbohydrate within reach, and a glucose check before cardio.',
    COOL: 'A longer cool-down, and get up from the floor in stages.',
    HEAT: 'Shorter, easier cardio, and drink regularly unless you have a fluid limit.',
    MINUS_SET: 'One set fewer per exercise.',
    rpeOnly: 'Go by effort and the talk test, not heart rate.',
  },
  stretch: {
    recovery: 'Gentle range only.',
    FOOT: 'Seated and floor stretches only.',
    HEAD: 'No head-down positions.',
    nerve: 'Leg symptoms: nerve sliders only, no long hamstring holds, and stop anything that sends symptoms further down the leg.',
    backAmber: 'A smaller range on anything that provokes your back.',
    HYPO: 'Fast-acting carbohydrate within reach.',
    COOL: 'Get up from the floor in stages.',
    HEAT: 'A cool spot, and sip water unless you have a fluid limit.',
  },
  walk: {
    recovery: 'Keep it short and easy.',
    INT: 'An easy, comfortable pace: you can talk in full sentences.',
    IMPACT: 'Walk, don’t jog, in well-fitting shoes.',
    nerve: 'Stop if leg symptoms spread further down your leg.',
    backAmber: 'Keep it shorter than usual, and stop if your back or leg gets worse.',
    HYPO: 'Carry fast-acting carbohydrate, and stop to check your glucose if you feel shaky, sweaty or odd.',
    COOL: 'Slow down gradually for the last few minutes.',
    HEAT: 'Keep it short and easy, in the coolest place and time, and drink unless you have a fluid limit.',
    rpeOnly: 'Go by effort and the talk test, not heart rate.',
  },
};

/** Most important first: what the session is, then what protects the body, then comfort. */
const ORDER: RestrictionCode[] = ['recovery', 'FOOT', 'HEAD', 'INT', 'LOAD', 'capHeavy', 'vigorousLocked', 'IMPACT', 'nerve', 'backAmber', 'HYPO', 'COOL', 'HEAT', 'MINUS_SET', 'rpeOnly'];

/** The limits that apply to this mode, as sentences and as codes. A limit with nothing to say for the mode is not one. */
function restrictionsFor(r: Readiness, mode: Mode): { text: string[]; codes: RestrictionCode[] } {
  const on = new Set<RestrictionCode>(r.modifiers);
  if (r.capHeavy) on.add('capHeavy');
  if (r.vigorousLocked) on.add('vigorousLocked');
  if (r.nerveFlag) on.add('nerve');
  if (r.back === 'amber' || r.back === 'red') on.add('backAmber');
  if (r.outcome === 'recovery') on.add('recovery');
  if (r.rpeOnly) on.add('rpeOnly');
  const codes = ORDER.filter(k => on.has(k) && RESTRICTIONS[mode][k]);
  return { text: codes.map(k => RESTRICTIONS[mode][k] as string), codes };
}

interface Block {
  disposition: Disposition;
  reasons: string[];
  release?: string;
  needsCheckIn?: boolean;
  /** Names the block, so a caller can treat one specially. */
  code?: 'future';
}

const rank = (d: Disposition) => DISPOSITION_ORDER.indexOf(d);

/**
 * Whether a day's record is a check-in: its first question, "Right now, any
 * of these?", has been answered. Every check-in asks it first. A record
 * started by something said during movement — "I feel low" on a walk after
 * midnight, a reading typed in the player — has not answered it, so it is
 * evidence for the safety rules but never stands in for the check-in a start
 * needs (scan M-01). The readiness carry-over reads the same field: until it
 * is answered, the last check-in's emergency answers still stand.
 */
export function checkedIn(c: DailyCheckIn | undefined): boolean {
  return c?.emergency !== undefined;
}

const emergencyReasons = (r: Readiness) => r.reasons.filter(x => x.disposition === 'emergency').map(x => x.message);

/** The latest numeric glucose reading's time, for the freshness rule. */
function freshness(c: DailyCheckIn, now: Date): Block | undefined {
  const g = c.glucose;
  if (!g || c.glucoseDisplay) return undefined;
  const t = g.measuredAt ? Date.parse(g.measuredAt) : Number.NaN;
  if (Number.isNaN(t)) return { disposition: 'hold', reasons: [PERMISSION_TEXT.staleNoTime], release: RELEASES.fresh, needsCheckIn: true };
  const age = (now.getTime() - t) / 60_000;
  if (age < -FUTURE_SLACK_MINUTES) return { disposition: 'hold', reasons: [PERMISSION_TEXT.future], release: RELEASES.fresh, needsCheckIn: true, code: 'future' };
  if (age > FRESH_MINUTES) {
    const minutes = Math.round(age);
    return {
      disposition: 'hold',
      reasons: [`${PERMISSION_TEXT.stale} Your last reading was ${minutes < 120 ? `${minutes} minutes` : `${Math.round(minutes / 60)} hours`} ago.`],
      release: RELEASES.fresh, needsCheckIn: true,
    };
  }
  return undefined;
}

/** The profile on its own, with no check-in at all, refuses this mode. */
function profileRefuses(profile: UserProfile, mode: Mode): boolean {
  const r = profileOnlyReadiness(profile);
  return r.reasons.some(x => x.refuses?.includes(mode)) || (mode === 'walk' && r.modifiers.includes('FOOT'));
}

function decide(input: PermissionInput, mode: Mode, opts: { fresh: boolean; needToday: boolean; onScreen?: boolean }): Permission {
  const { profile, now } = input;
  const today = toDateString(now);
  const checkIn = input.checkIn && input.checkIn.date === today ? input.checkIn : undefined;
  const recent = (input.recent ?? []).filter(x => !checkIn || x.date < checkIn.date);
  // With no check-in the profile alone still decides: recent eye treatment, an
  // open foot wound and the rest are refusals in their own right, and must be
  // collected here rather than read off an allowed answer (re-audit F02/R03).
  // With no check-in yet today, what earlier check-ins still ask of today
  // stands: a chest pain at 23:59 is still one at 00:01 (round 3 B01).
  const r: Readiness = checkIn ? evaluateCheckIn(profile, checkIn, recent, now) : profileOnlyReadiness(profile, { date: today, recent, now });
  const blocks: Block[] = [];

  if (rank(r.disposition ?? 'reassure') >= rank('hold')) {
    blocks.push({
      disposition: r.disposition ?? 'hold',
      reasons: r.reasons.filter(x => rank(x.disposition ?? 'adjust') >= rank('hold')).map(x => x.message),
      ...(r.release ? { release: r.release } : {}),
      // A re-check or a missing reading is answered by a new check-in; a stop is not.
      needsCheckIn: r.disposition === 'hold' && r.awaitingReading === true,
    });
  }
  const refusing = r.reasons.filter(x => x.refuses?.includes(mode) && !(STARTS_ONLY.includes(x.code) && (!opts.needToday || opts.onScreen)));
  const footWalk = mode === 'walk' && r.modifiers.includes('FOOT');
  if (refusing.length || footWalk) {
    blocks.push({
      disposition: 'hold',
      reasons: [...(footWalk ? [PERMISSION_TEXT.footWalk] : []), ...refusing.map(x => x.message)],
      release: footWalk ? RELEASES.foot : refusing.every(x => PROVOKED.includes(x.code)) ? RELEASES.provoked : 'Change today’s answers once things have settled.',
    });
  }

  const gaps = profileGaps(profile);
  const profileGap = gaps.healthUnreviewed || gaps.medicinesUnknown;
  if (gaps.healthUnreviewed) blocks.push({ disposition: 'hold', reasons: [PERMISSION_TEXT.healthUnreviewed], release: RELEASES.profile });
  if (gaps.medicinesUnknown) blocks.push({ disposition: 'hold', reasons: [PERMISSION_TEXT.medicinesUnknown], release: RELEASES.medicines });

  // A day started by a report has its evidence counted above, but no answers.
  // The profile comes first: no check-in can answer it (scan J2-09).
  if (!profileGap && !checkedIn(checkIn) && opts.needToday) {
    blocks.push({ disposition: 'hold', reasons: [PERMISSION_TEXT.noCheckIn], release: RELEASES.checkIn, needsCheckIn: true });
  }
  if (checkIn) {
    // The 30-minute rule is for someone who can go low, before they start
    // (D29(6)). A reading stamped in the future is nobody's pre-session check,
    // whatever the medicines (re-audit, decision 8 scope note).
    // The newest reading from any screen is the one that is timed (X2-01),
    // and one the device has not stored makes nothing fresher than what it
    // has (N-01).
    const stored = durableView(checkIn);
    const stale = [checkIn, ...(stored ? [stored] : [])].map(x => freshness(withLogged(x), now))
      .find(s => s && (s.code === 'future' || (opts.fresh && deriveHealth(profile.health).hypoRisk)));
    if (stale) blocks.push(stale);
  }

  if (blocks.length) {
    // Stable sort: equal dispositions keep the order above, check-in reasons first.
    const ordered = [...blocks].sort((a, b) => rank(b.disposition) - rank(a.disposition));
    const top = ordered[0].disposition;
    // A mode the profile alone rules out — a foot that needs protecting rules
    // out walking, unanswered health questions rule out everything — stays
    // ruled out whatever a check-in says, so no screen should send the person
    // to one first: the refusal shows straight away.
    const settled = profileGap || profileRefuses(profile, mode);
    // In an emergency, nothing about starting later belongs next to "call now".
    const shown = top === 'emergency' ? ordered.filter(b => b.disposition === 'emergency') : ordered;
    const reasons = [...new Set(shown.flatMap(b => b.disposition === 'emergency' && r ? emergencyReasons(r) : b.reasons))];
    const release = top === 'emergency' ? undefined : ordered.find(b => b.release)?.release;
    return {
      mode, allowed: false, disposition: top, reasons, restrictions: [], codes: [],
      ...(release ? { release } : {}),
      needsCheckIn: top === 'hold' && !settled && ordered.some(b => b.needsCheckIn),
    };
  }

  const readiness = r;
  const { text: restrictions, codes } = restrictionsFor(readiness, mode);
  const reasons = [
    ...readiness.reasons.filter(x => x.disposition === 'adjust' && x.outcome !== 'green').map(x => x.message),
    ...readiness.reasons.filter(x => x.disposition === 'adjust' && x.outcome === 'green').map(x => x.message),
    ...readiness.notices,
  ];
  const disposition: Disposition = readiness.disposition === 'adjust' || restrictions.length ? 'adjust' : 'reassure';
  return { mode, allowed: true, disposition, reasons: [...new Set(reasons)], restrictions, codes, needsCheckIn: false };
}

/**
 * May this person start, or start again, now? Everything applies: today's
 * check-in, the reading D29(6) asks for, every current clinical condition and
 * every profile rule. Restarting after a pause, a background interval or
 * another day asks this, not the gentler question below.
 */
export function permission(input: PermissionInput, mode: Mode): Permission {
  return decide(input, mode, { fresh: true, needToday: true });
}

/**
 * The Start tap in a player already open, first or after a pause: the full
 * question `permission` asks, except a refusal of new starts only. A stretch
 * that sent symptoms further down rules out another stretch today (J2-04),
 * while the routine on screen carries on without that drill (acceptance J02,
 * J16 step 6). Opening the player asks `permission`.
 */
export function onScreenPermission(input: PermissionInput, mode: Mode): Permission {
  return decide(input, mode, { fresh: true, needToday: true, onScreen: true });
}

/**
 * May exercise already under way carry on?
 *
 * Profile rules and every current clinical condition still refuse — a new
 * emergency, a stop for today, a new low all stop it at once. What is left out
 * is only the pre-session paperwork: a reading merely turning 30 minutes old,
 * or a day without a check-in, does not interrupt someone mid-movement
 * (re-audit F02). A restart must use `permission` instead.
 */
export function resumePermission(input: PermissionInput, mode: Mode = 'guided'): Permission {
  return decide(input, mode, { fresh: false, needToday: false });
}
