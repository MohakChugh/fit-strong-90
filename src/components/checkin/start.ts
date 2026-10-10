import type { Permission } from '@/engine/permission';

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
