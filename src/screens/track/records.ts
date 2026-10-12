/**
 * What may be done to a stored record from Track, and what doing it means.
 */

import { entryFor, summariseDay, type BpReading } from '@/health/aggregate';
import { bpReadingId, checkInDayOf, isBpKind, type Observation } from '@/health/observation';
import { formatObservation, kindTitle, type DisplayPrefs } from './format';

/**
 * Whether a record can be corrected here, and if not, why. Measured and
 * imported data is not overwritten by hand — the correction would then look
 * like a measurement. A walk's own measurements belong to the walk (a pain
 * rating given after it is the person's own, and can be corrected), and blood
 * pressure is corrected as a reading, both numbers together. A corrected
 * glucose keeps its timing and meal start: the store keeps every field a
 * correction does not name.
 */
export function editBlock(o: Observation): string | undefined {
  if (o.source !== 'manual') return 'Measured and imported records are kept as they arrived. Delete it and add it again if it is wrong.';
  if (o.context?.startsWith('walk:') && o.scope !== 'pointInTime') return 'This belongs to a walk.';
  if (isBpKind(o.kind)) return 'Correct blood pressure from the reading itself.';
  return undefined;
}

/**
 * Whether a reading can be rewritten whole — both numbers, its time and its
 * timing — by `putBloodPressure`, which corrects a reading in place by its
 * id. That needs one systolic and one diastolic sharing the reading's `bp:`
 * context. A check-in's readings keep their time: the check-in finds its
 * readings again by the time they were taken, so a moved one would be
 * recorded a second time. Only their numbers are corrected.
 */
export function rewritable(r: Pick<BpReading, 'id' | 'halves'>): boolean {
  return r.halves.length === 2
    && r.halves.every(h => bpReadingId(h.context) === r.id && checkInDayOf(h) === undefined)
    && r.halves.some(h => h.kind === 'bloodPressureSystolic')
    && r.halves.some(h => h.kind === 'bloodPressureDiastolic');
}

/** Why a check-in's reading keeps its time when its number is corrected (C2-01). */
export const CHECK_IN_TIME = 'The time can’t be changed here: it is your check-in’s.';

/** Whether a day-total statement is the one the day shows. */
export function countsForDay(o: Observation, observations: readonly Observation[]): boolean {
  if (o.scope !== 'dayTotal') return false;
  const entry = entryFor(summariseDay(o.day, observations), o.kind, 'dayTotal');
  return entry?.contributed.some(c => c.id === o.id) ?? false;
}

/**
 * Why a replaced day-total entry is not corrected here. A correction is a new
 * statement, and the newest statement is the day's total (D10) — so
 * "correcting" 250 ml from this morning would quietly replace tonight's
 * 1,500 ml with 300.
 */
export function replacedBlock(o: Observation, observations: readonly Observation[]): string | undefined {
  if (o.scope !== 'dayTotal' || countsForDay(o, observations)) return undefined;
  return 'A later entry replaced this one. Correct the latest entry for the day instead.';
}

/**
 * What deleting a record does, said before it is done. For a day total the
 * earlier statement becomes current again, which is worth knowing first.
 */
export function deleteConsequence(o: Observation, observations: readonly Observation[], prefs: DisplayPrefs): string {
  if (o.scope !== 'dayTotal') return 'It is removed from this device. This cannot be undone.';
  const name = kindTitle(o.kind).toLowerCase();
  const rest = observations.filter(x => x.id !== o.id && x.day === o.day);
  const after = entryFor(summariseDay(o.day, rest), o.kind, 'dayTotal');
  const shown = after && after.total !== null
    ? formatObservation({ kind: o.kind, value: after.total, unit: after.contributed[0].unit }, prefs)
    : undefined;
  if (!countsForDay(o, observations)) {
    return shown ? `The day’s ${name} stays at ${shown}: a later entry already replaced this one.` : 'It is removed from this device. This cannot be undone.';
  }
  if (shown) return `The day’s ${name} goes back to ${shown}, the entry before this one.`;
  return `The day will show ${name} as not entered. This cannot be undone.`;
}
