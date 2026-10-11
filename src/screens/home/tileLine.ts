/**
 * The live line on a movement tile (journey §7.5). It always follows the
 * shared gate for that tile's mode, so a tile can never invite what its hub
 * would refuse (audit K-04, A-08). Emergency outranks status, status outranks
 * a hold, and a hold outranks a flare-up's suggestion; a hold that only
 * today's check-in answers keeps the flare's words and adds "check in first".
 */
import { PERMISSION_TEXT, type Mode, type Permission } from '@/engine/permission';
import type { Status } from '@/health/status';
import { prefersHour12, timeOf } from '@/lib/time';

export interface TileLine {
  text: string;
  tone: 'normal' | 'caution' | 'stop' | 'quiet';
  /** A second line, such as when and where a reading was taken. */
  detail?: string;
}

/**
 * Short headlines for the gate's known reasons, most specific first: a
 * check-in never releases a foot restriction, so the foot wins whatever order
 * the reasons come in. Anything new falls back to a pointer to the hub.
 */
const HOLD_HEADLINE: [reason: string, headline: string][] = [
  [PERMISSION_TEXT.footWalk, 'No walking for now'],
  [PERMISSION_TEXT.future, 'Check the reading’s time'],
  [PERMISSION_TEXT.stale, 'Check glucose first'],
  [PERMISSION_TEXT.staleNoTime, 'Check glucose first'],
];
/** The gate's short headline for a refusal it knows (journey §7.5), as tiles say it: the walk's preflight uses it when the final gate refuses (Plan 6). */
export function holdHeadline(p: Permission): string | undefined {
  return HOLD_HEADLINE.find(([reason]) => p.reasons.some(r => r.startsWith(reason)))?.[1];
}

/** The setup chapter each profile gap needs (L-03). */
const PROFILE_GAP: [reason: string, chapter: string][] = [
  [PERMISSION_TEXT.healthUnreviewed, 'your health'],
  [PERMISSION_TEXT.medicinesUnknown, 'your medicines'],
];
/** Reasons a check-in (or a fresh glucose in it) answers: the tile keeps its line and the Start opens the check-in (L-03). */
const CHECK_IN_ONLY: string[] = [PERMISSION_TEXT.noCheckIn, PERMISSION_TEXT.stale, PERMISSION_TEXT.staleNoTime];

/**
 * A hold that only today's check-in answers, as the tile reads it: the tile
 * keeps its line, with "check in first". Any other hold is said by its
 * headline. The gate may say more (a stale reading's age), so a reason counts
 * by how it starts.
 */
export function checkInOnly(p: Permission): boolean {
  return p.needsCheckIn && p.reasons.length > 0 && p.reasons.every(r => CHECK_IN_ONLY.some(t => r.startsWith(t)));
}
/** v1 plans a recovery session and a gentler stretch during a flare; walking has no flare plan, so Walk keeps its line and suggests a stretch (L-08). */
const FLARE: Partial<Record<Mode, string>> = { guided: 'Gentle only today', stretch: 'Gentle stretch' };
const STRETCH_SUGGESTED = 'Stretch is suggested today';

export function movementLine({ mode, permission: p, status, normal, enrolled = true, recheckAt, now, hour12 = prefersHour12(), gapChapter }: {
  mode: Mode;
  permission: Permission;
  status: Status;
  normal: string;
  /**
   * In the 12-week programme (D35); only the Workout tile reads it. Outside
   * it there is no recovery session to offer during a flare, and nothing to
   * check in for on this tile, so it suggests a stretch and never names the
   * programme (no programme pressure during a flare).
   */
  enrolled?: boolean;
  /**
   * When a treated low's re-check can be taken (`Readiness.recheckAt`, from
   * today's check-in), with the moment the line is worked out: the line names
   * the time until it comes, then the gate's own state says the rest (L-07).
   */
  recheckAt?: string;
  now?: Date;
  hour12?: boolean;
  /** While setup is unfinished, the safety chapter it still asks: "your back and feet" (§6.1; K5-07). */
  gapChapter?: string;
}): TileLine {
  if (!p.allowed && (p.disposition === 'emergency' || p.disposition === 'today')) return { text: 'Not today', tone: 'stop' };
  if (status === 'away' || status === 'unwell') return { text: 'Paused', tone: 'quiet' };
  // Outside the programme the Workout tile starts nothing, so it has nothing to check in for (D35, kiro KV-05).
  const outside = mode === 'guided' && !enrolled;
  // The line before any check-in: a flare's own first, then the check-in after it (kiro KV-04).
  const line = status !== 'flare' ? normal : outside ? STRETCH_SUGGESTED : FLARE[mode] ?? `${normal} · ${STRETCH_SUGGESTED}`;
  if (!p.allowed) {
    // The gate may add detail after its fixed sentence (a stale reading says how old it is), so a reason counts by how it starts.
    const said = (text: string) => p.reasons.some(r => r.startsWith(text));
    const gap = PROFILE_GAP.find(([reason]) => said(reason));
    if (gap) return { text: `Finish setting up · ${gapChapter ?? gap[1]}`, tone: 'caution' };
    if (checkInOnly(p)) {
      return { text: outside ? line : `${line} · check in first`, tone: 'normal' };
    }
    const known = holdHeadline(p);
    // A treated low's re-check comes before the routine check-in, however the day began, as in v1's gate.
    const due = recheckAt ? Date.parse(recheckAt) : Number.NaN;
    const at = now && due > now.getTime() ? ` at ${timeOf(due, hour12)}` : '';
    const recheck = p.release?.toLowerCase().includes('re-check') ? `Waiting for your re-check${at}` : undefined;
    const checkIn = said(PERMISSION_TEXT.noCheckIn) ? 'Check in first' : undefined;
    return { text: known ?? recheck ?? checkIn ?? 'Not now: open to see why', tone: 'caution' };
  }
  if (status === 'flare') return { text: line, tone: 'normal' };
  if (p.disposition === 'adjust' && p.restrictions.length > 0) return { text: `${normal} · with changes`, tone: 'normal' };
  return { text: normal, tone: 'normal' };
}

/** The Workout tile's own line: the programme's session, or that it hasn't been joined (D35). A day with no session (a rest day) is only its name. */
export function workoutNormal({ enrolled, label, minutes }: { enrolled: boolean; label: string; minutes: number }): string {
  if (!enrolled) return '12-week programme · not joined';
  return minutes > 0 ? `${label} · ${minutes} min` : label;
}
