/**
 * What each reminder says. One place, so the banner, the habit settings and
 * the calendar file use the same words, and a claim is sourced once.
 *
 * Every figure traces to docs/research/clinical-tracking-protocols.md: the
 * 30-minute sitting interval to ADA 2026, 5.34; the after-meal walk to
 * Reynolds et al. 2016 (12% lower after-meal glucose overall, 22% after the
 * evening meal), which is a study result and is worded as one.
 */

import type { Meal } from '@/types/habits';
import type { DailyTime, HabitId } from './schedule';

export const HABIT_LABEL: Record<HabitId, string> = {
  water: 'Water',
  sittingBreak: 'Sitting breaks',
  mealWalk: 'Walk after meals',
};

export const MEAL_LABEL: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};

export const SITTING_SOURCE = 'ADA Standards of Care in Diabetes 2026, 5.34';
export const SITTING_EVIDENCE = 'The American Diabetes Association suggests getting up from sitting at least every 30 minutes.';

export const MEAL_WALK_SOURCE = 'Reynolds and others, Diabetologia, 2016';
export const MEAL_WALK_EVIDENCE =
  'In a study of people with type 2 diabetes, a 10-minute walk soon after each meal lowered blood sugar after meals more than one 30-minute walk a day: 12% lower overall and 22% lower after the evening meal. That is what the study found, not a promise for every person.';

export const NOT_ADVICE = 'General information, not medical advice.';

export interface ReminderText {
  title: string;
  detail: string;
}

/** The words for one reminder. `glassMl` is the user's own glass size. */
export function reminderText(time: Pick<DailyTime, 'habit' | 'meal'>, glassMl?: number): ReminderText {
  switch (time.habit) {
    case 'water':
      return {
        title: 'Time for a glass of water',
        detail: glassMl ? `Your ${glassMl} ml glass, if it suits you now.` : 'A glass, if it suits you now.',
      };
    case 'sittingBreak':
      return { title: 'Time to stand up for a few minutes', detail: 'A short walk or a gentle stretch breaks up sitting.' };
    case 'mealWalk':
      return {
        title: `A short walk after ${(time.meal ? MEAL_LABEL[time.meal] : 'your meal').toLowerCase()}?`,
        detail: 'Ten easy minutes, if you feel up to it.',
      };
  }
}
