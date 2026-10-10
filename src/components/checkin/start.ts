import { permission, type Mode, type Permission } from '@/engine/permission';
import type { CheckInRecord } from '@/types/checkin';
import type { UserProfile } from '@/types/profile';

/**
 * What tapping a Start button does: go straight to the mode, or open the
 * check-in first.
 *
 * Only an allowed answer that needs nothing new goes straight through. Every
 * other answer opens the sheet, including a refusal that a new check-in
 * cannot fix (an emergency, a hold for today): the sheet is where the person
 * sees why, and where a mistaken answer can be changed.
 */
export function startDecision(p: Permission): 'go' | 'checkIn' {
  return p.allowed && !p.needsCheckIn ? 'go' : 'checkIn';
}

/**
 * The mode's screen opens on its refusal rather than its Start: a stop, or a
 * hold no check-in can answer. A tap into it skips the view transition, so
 * the reason is in the first frame, whether or not the shell's urgent surface
 * stands (codex V1-05, motion rule 2).
 */
export function opensOnHold(p: Permission): boolean {
  return !p.allowed && !p.needsCheckIn;
}

/**
 * The shared gate for `mode` at this moment, from `useGuided()`'s effective
 * records: today's check-in and every earlier day's. Every start, every tile
 * and the shell's safety surface ask it this one way (journey §4.2).
 */
export function gateFor(records: { profile: UserProfile; checkIn?: CheckInRecord | undefined; checkIns: CheckInRecord[] }, mode: Mode, now: Date = new Date()): Permission {
  return permission({ profile: records.profile, ...(records.checkIn ? { checkIn: records.checkIn } : {}), now, recent: records.checkIns }, mode);
}
