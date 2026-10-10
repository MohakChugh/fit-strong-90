/**
 * "I need to stop" on a walk: the same questions, answers and records as the
 * player's "Stop: something's wrong", from the one shared builder in the
 * check-in code (`@/components/checkin/stop`). What happened goes into today's
 * check-in through the shared path (`reportSymptoms`), so the engine decides
 * what may follow — on this walk and at the next start.
 *
 * The tap itself is saved (journey §4.4): recording stops, and the stop goes
 * into today's check-in at once, so closing the guidance without an answer
 * leaves the walk held. Every answer answers it; "Just need a rest" records
 * only that.
 */

import type { SaveResult, SymptomReport } from '@/components/checkin/pending';
import { onChoice, type StopChoice } from '@/components/checkin/stop';
import type { LiveWalk } from './live';
import type { Report } from './low';

export {
  LEG_QUESTIONS, NO_LEG, REACH, REACH_LABEL, SPREAD_QUESTION, STOP_CHOICES, WORSENING, legReport, onChoice, stopReport,
  type LegAnswers, type StopChoice,
} from '@/components/checkin/stop';

/** The stop, said and not yet answered: what the tap saves. */
export const STOPPED: SymptomReport = { news: ['stopped'] };

/** What the button does: recording stops at the tap, and the stop is saved through the shared path (§4.4). */
export function needToStop(live: Pick<LiveWalk, 'pause'>, report: Report, at: Date = new Date()): Promise<SaveResult> {
  live.pause();
  return report(STOPPED, at);
}

/** A report that also answers the stop: whatever else it says, the stop has been said. */
export function answering(report: SymptomReport = {}): SymptomReport {
  return { ...report, newsGone: [...new Set([...(report.newsGone ?? []), 'stopped' as const])] };
}

/** One tap on the walk's stop question: what it reports, the stop answered with it, and what comes next. */
export function stopAnswer(choice: StopChoice, hypoRisk: boolean): { report?: SymptomReport; next: 'close' | 'leg' | 'dizzy' } {
  const { report, next } = onChoice(choice, hypoRisk);
  // Leg symptoms are answered by their own questions, saved with "Save leg symptoms".
  if (next === 'leg') return { next };
  return { report: answering(report), next };
}
