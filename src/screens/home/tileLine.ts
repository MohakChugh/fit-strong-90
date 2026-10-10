/**
 * The live line on a movement tile (journey §7.5). It always follows the
 * shared gate for that tile's mode, so a tile can never invite what its hub
 * would refuse (audit K-04, A-08). Emergency outranks status, status outranks
 * a hold, and a hold outranks a flare-up's suggestion.
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
/** The setup chapter each profile gap needs (L-03). */
const PROFILE_GAP: [reason: string, chapter: string][] = [
  [PERMISSION_TEXT.healthUnreviewed, 'your health'],
  [PERMISSION_TEXT.medicinesUnknown, 'your medicines'],
];
/** Reasons a check-in (or a fresh glucose in it) answers: the tile keeps its line and the Start opens the check-in (L-03). */
const CHECK_IN_ONLY: string[] = [PERMISSION_TEXT.noCheckIn, PERMISSION_TEXT.stale, PERMISSION_TEXT.staleNoTime];
/** v1 plans a recovery session and a gentler stretch during a flare; walking has no flare plan, so Walk keeps its line and suggests a stretch (L-08). */
const FLARE: Partial<Record<Mode, string>> = { guided: 'Gentle only today', stretch: 'Gentle stretch' };

export function movementLine({ mode, permission: p, status, normal, recheckAt, now, hour12 = prefersHour12() }: {
  mode: Mode;
  permission: Permission;
  status: Status;
  normal: string;
  /**
   * When a treated low's re-check can be taken (`Readiness.recheckAt`, from
   * today's check-in), with the moment the line is worked out: the line names
   * the time until it comes, then the gate's own state says the rest (L-07).
   */
  recheckAt?: string;
  now?: Date;
  hour12?: boolean;
}): TileLine {
  if (!p.allowed && (p.disposition === 'emergency' || p.disposition === 'today')) return { text: 'Not today', tone: 'stop' };
  if (status === 'away' || status === 'unwell') return { text: 'Paused', tone: 'quiet' };
  if (!p.allowed) {
    // The gate may add detail after its fixed sentence (a stale reading says how old it is), so a reason counts by how it starts.
    const said = (text: string) => p.reasons.some(r => r.startsWith(text));
    const gap = PROFILE_GAP.find(([reason]) => said(reason));
    if (gap) return { text: `Finish setting up · ${gap[1]}`, tone: 'caution' };
    if (p.needsCheckIn && p.reasons.length > 0 && p.reasons.every(r => CHECK_IN_ONLY.some(t => r.startsWith(t)))) return { text: `${normal} · check in first`, tone: 'normal' };
    const known = HOLD_HEADLINE.find(([reason]) => said(reason))?.[1];
    // A treated low's re-check comes before the routine check-in, however the day began, as in v1's gate.
    const due = recheckAt ? Date.parse(recheckAt) : Number.NaN;
    const at = now && due > now.getTime() ? ` at ${timeOf(due, hour12)}` : '';
    const recheck = p.release?.toLowerCase().includes('re-check') ? `Waiting for your re-check${at}` : undefined;
    const checkIn = said(PERMISSION_TEXT.noCheckIn) ? 'Check in first' : undefined;
    return { text: known ?? recheck ?? checkIn ?? 'Not now: open to see why', tone: 'caution' };
  }
  if (status === 'flare') return { text: FLARE[mode] ?? `${normal} · Stretch is suggested today`, tone: 'normal' };
  if (p.disposition === 'adjust' && p.restrictions.length > 0) return { text: `${normal} · with changes`, tone: 'normal' };
  return { text: normal, tone: 'normal' };
}

/** The Workout tile's own line: the programme's session, or that it hasn't been joined (D35). A day with no session (a rest day) is only its name. */
export function workoutNormal({ enrolled, label, minutes }: { enrolled: boolean; label: string; minutes: number }): string {
  if (!enrolled) return '12-week programme · not joined';
  return minutes > 0 ? `${label} · ${minutes} min` : label;
}
