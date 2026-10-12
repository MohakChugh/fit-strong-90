import type { Habit } from './schema';

/**
 * The habits the reminders area may offer (Task 8), with the claims that
 * explain them. Nothing here schedules anything: the cue is the sourced
 * suggestion, and the person chooses their own times.
 */
export const HABITS: Habit[] = [
  {
    id: 'water',
    title: 'Drink water through the day',
    claimIds: ['water-amount', 'fd-water-first'],
    cardId: 'card-water-amount',
    // A fluid limit, a kidney or heart condition, or health answers not yet
    // given can make "drink more" wrong; the care team's limit comes first,
    // so no generic prompt is offered (as reminders/water.ts decides).
    withheldWhen: ['fluidCaution', 'healthUnknown'],
    withheldClaimId: 'water-plan-first',
  },
  {
    id: 'sittingBreak',
    title: 'Get up from sitting',
    claimIds: ['sit-30', 'sit-hourly'],
    cueClaimId: 'sit-30',
    cardId: 'card-sitting-breaks',
    // The readiness engine's FOOT rule: a standing prompt gives way to seated changes.
    withheldWhen: ['footWound'],
    withheldClaimId: 'desk-seated-change',
  },
  {
    id: 'mealWalk',
    title: 'Walk after meals',
    claimIds: ['walk-meals-study'],
    cueClaimId: 'walk-meals-try',
    cardId: 'card-after-meal-walk',
    // The readiness engine's FOOT rule: no weight-bearing exercise.
    withheldWhen: ['footWound'],
    withheldClaimId: 'walk-foot-wound',
  },
  {
    id: 'sleepWindDown',
    title: 'Wind down for sleep',
    claimIds: ['sleep-same-times', 'sleep-screens'],
    cueClaimId: 'sleep-screens',
    cardId: 'card-sleep-better',
  },
];
