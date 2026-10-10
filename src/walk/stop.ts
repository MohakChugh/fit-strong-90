/**
 * "I need to stop" on a walk: the same questions, answers and records as the
 * player's "Stop: something's wrong", from the one shared builder in the
 * check-in code (`@/components/checkin/stop`). What happened goes into today's
 * check-in through the shared path (`reportSymptoms`), so the engine decides
 * what may follow — on this walk and at the next start. A rest records nothing.
 */

export {
  LEG_QUESTIONS, NO_LEG, REACH, REACH_LABEL, SPREAD_QUESTION, STOP_CHOICES, WORSENING, legReport, onChoice, stopReport,
  type LegAnswers, type StopChoice,
} from '@/components/checkin/stop';
