/**
 * Habit prompts the user opted into. Every one is off until chosen: a default
 * water target or sitting alarm would be an invented prescription (a kidney or
 * heart condition can make "drink more" wrong), so the app only reminds people
 * of what they asked to be reminded of.
 */
export type Meal = 'breakfast' | 'lunch' | 'dinner';

/** One habit's events in a calendar file the app made (D-01). */
export interface CalendarFileEntry {
  /** When the file was made. */
  at: string;
  /** `YYYY-MM-DD`: the events repeat daily until this local day. */
  until: string;
  /** How many daily events of this habit the file held. */
  events: number;
  /** What they are called in Calendar. */
  titles: string[];
}

export interface HabitSettings {
  water?: { enabled: boolean; glassMl: number; dailyGoalMl?: number; everyMinutes: number; from: string; to: string };
  /** Break from sitting. ADA: interrupt prolonged sitting at least every 30 minutes. */
  sittingBreak?: { enabled: boolean; everyMinutes: number; from: string; to: string };
  /**
   * A short walk after the meals the user picked. `finish` is when they
   * usually finish each meal, local HH:MM: the walk that lowered after-meal
   * glucose in Reynolds 2016 started within five minutes of finishing.
   */
  mealWalk?: { enabled: boolean; meals: Meal[]; finish?: Partial<Record<Meal, string>> };
  /** Times as local HH:MM. No prompt is shown outside these hours. */
  quietHours?: { from: string; to: string };
  /**
   * Superseded by the profile's `health.fluidRestriction`, which is now where
   * the answer is asked and kept. Still read, for an answer given before that
   * field existed (`fluidRestriction` in `reminders/water.ts`); never written.
   */
  fluidLimit?: boolean;
  /**
   * Banners while the app is open. Absent means on. Someone who has handed
   * the schedule to Calendar can turn these off rather than be told twice.
   */
  inApp?: boolean;
  /**
   * When the snapshot in the last backup was taken, ISO with offset, for the
   * periodic backup nudge (D17). Not when the file was handed over: a file
   * made earlier holds only what was there then.
   */
  lastExportAt?: string;
  /**
   * The store revision — the commit sequence the store stamps on each change —
   * of the snapshot in that backup. Recording this mark is one more stored
   * change, so a revision beyond the next one holds something the backup does
   * not, whatever date it is for (`reminders/backup.ts`). Absent for a backup
   * made before this was kept.
   */
  lastExportSeq?: number;
  /**
   * Each habit's events in the calendar files made (D-01). Calendar keeps
   * reminding from such a file whatever the app later learns, so the app must
   * be able to say so when an answer stops one of those habits. A new file
   * replaces the entries of the habits in it; the others keep theirs, since
   * their older events stay in Calendar until the person deletes them.
   */
  calendarExport?: Partial<Record<'water' | 'sittingBreak' | 'mealWalk', CalendarFileEntry>>;
}
