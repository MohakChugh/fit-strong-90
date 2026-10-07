import type { SessionPlan } from '@/types/plan';

/** Seconds per block from a plan's block start times. */
export function blockMinutes(plan: SessionPlan) {
  const starts = plan.blockStarts;
  const total = plan.totalSeconds;
  const mob = (starts.strength ?? starts.cardio ?? total) - 0;
  const str = starts.strength !== undefined ? (starts.cardio ?? total) - starts.strength : 0;
  const car = starts.cardio !== undefined ? (starts.wrapUp ?? total) - starts.cardio : 0;
  return { mobility: mob, strength: str, cardio: car, total };
}
