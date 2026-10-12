/**
 * "I feel low" on a walk (N01), as a clinical answer and not only a way to
 * end the walk.
 *
 * At the tap, recording stops and the symptoms go into today's check-in
 * through the shared path (`reportSymptoms`), timed then — so the engine holds
 * this walk, and any start after it, until a reading measured afterwards
 * answers it. The button never makes up a reading. A write the device
 * refuses still counts: the shared record keeps it waiting.
 */

import type { GlucoseEntry, GlucoseReading, GlucoseUnit } from '@/types/checkin';
import { glucoseSanity, type GlucoseSanity } from '@/engine/readiness';
import type { SaveResult, SymptomReport } from '@/components/checkin/pending';
import type { LiveWalk } from './live';

export type Report = (report: SymptomReport, at: Date) => Promise<SaveResult>;

/** What the button does. */
export function feelLow(live: Pick<LiveWalk, 'pause'>, report: Report, at: Date = new Date()): Promise<SaveResult> {
  live.pause();
  return report({ news: ['lowSymptoms'] }, at);
}

/**
 * A reading taken after it, reported as the player reports one: with the
 * symptoms gone, that too; and a low someone else had to help treat as the
 * severe low it is (M-05), whatever the reading says now.
 */
export function lowReading(reading: GlucoseEntry, symptomsGone: boolean, neededHelp = false): SymptomReport {
  return {
    // A meter's HI or LO is recorded as the check-in records it (`glucoseDisplay`).
    ...('display' in reading ? { glucoseDisplay: reading } : { glucose: reading }),
    ...(neededHelp ? { news: ['lowSevere'] } : {}),
    ...(symptomsGone ? { newsGone: ['lowSymptoms'], lowRecovered: true } : {}),
  };
}

/**
 * The number typed for that reading, judged as the check-in and the player
 * judge it (`glucoseSanity`, scan X2-18): one that does not fit the unit shown
 * is asked about before it is used, so a slip of the unit never becomes
 * advice. A reading is only offered once it is fine as it stands, or its unit
 * has been answered — and then it says so, for the engine to read it as given.
 */
export function typedReading(
  typed: string,
  unit: GlucoseUnit,
  unitConfirmed: boolean,
  source?: GlucoseReading['source'],
): { sanity: GlucoseSanity | null; reading?: GlucoseReading } {
  const text = typed.trim();
  const value = Number(text);
  if (text === '' || !Number.isFinite(value)) return { sanity: null };
  const sanity = glucoseSanity(value, unit, unitConfirmed);
  if (sanity !== 'ok') return { sanity };
  return { sanity, reading: { value, unit, ...(unitConfirmed ? { unitConfirmed: true } : {}), ...(source ? { source } : {}) } };
}
