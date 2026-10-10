/**
 * Calendar keeps reminding after the app has stopped (D-01).
 *
 * A calendar file the app made holds daily events that Calendar shows with
 * the app closed and whatever it later learns. When a recorded answer — a
 * fluid limit, an open foot wound, health answers not yet confirmed — stops a
 * habit that went into such a file, the app can stop its own prompts but not
 * those events. It says so, names them, and says how to delete them. It never
 * claims to have stopped them.
 */

import type { CalendarFileEntry, HabitSettings } from '@/types/habits';
import type { UserProfile } from '@/types/profile';
import { habitOffered } from './advice';
import type { CalendarEvent } from './ics';
import type { HabitId } from './schedule';
import { addDays } from './time';

/** How long a calendar file's events repeat: renewed whenever a new file is made. */
export const CALENDAR_DAYS = 90;

export type CalendarExport = NonNullable<HabitSettings['calendarExport']>;

const HABITS = ['water', 'sittingBreak', 'mealWalk'] as const;

/** The last day the events of a file starting on `firstDay` repeat. */
export const calendarUntil = (firstDay: string) => addDays(firstDay, CALENDAR_DAYS);

/** What to remember about a calendar file made now, for each habit in it. */
export function calendarExportOf(events: readonly CalendarEvent[], at: string, firstDay: string): CalendarExport {
  const until = calendarUntil(firstDay);
  const out: CalendarExport = {};
  for (const e of events) {
    const entry: CalendarFileEntry = out[e.habit] ??= { at, until, events: 0, titles: [] };
    entry.events += 1;
    if (!entry.titles.includes(e.title)) entry.titles.push(e.title);
  }
  return out;
}

/**
 * A new file replaces what is known of the habits in it. The habits it leaves
 * out keep their entries: their older events stay in Calendar until deleted.
 */
export function withCalendarExport(previous: CalendarExport | undefined, made: CalendarExport): CalendarExport {
  return { ...previous, ...made };
}

/** Once the person says they deleted these habits' events; `undefined` when none are left. */
export function withoutCalendarHabits(previous: CalendarExport | undefined, deleted: readonly HabitId[]): CalendarExport | undefined {
  const left = HABITS.filter(h => previous?.[h] && !deleted.includes(h));
  return left.length ? Object.fromEntries(left.map(h => [h, previous![h]])) : undefined;
}

export interface StillReminding {
  habit: HabitId;
  /** How many daily events of this habit the file held. */
  events: number;
  /** What they are called in Calendar. */
  names: string[];
  /** When the file was made. */
  at: string;
}


/** This habit's events in a calendar file, while they still repeat, whatever the app now does. */
export function exportedStill(habits: HabitSettings | undefined, habit: HabitId, today: string): StillReminding | undefined {
  const entry = habits?.calendarExport?.[habit];
  if (!entry || entry.until < today || entry.events === 0) return undefined;
  return { habit, events: entry.events, names: entry.titles, at: entry.at };
}

/** The habits whose calendar events still repeat that the app itself no longer prompts for. */
export function calendarStillReminds(habits: HabitSettings | undefined, profile: UserProfile | undefined, today: string): StillReminding[] {
  if (!habits) return [];
  return HABITS.flatMap(habit => {
    const still = exportedStill(habits, habit, today);
    // The Guide's one rule for every habit, the fluid limit and conditions among them.
    return still && !habitOffered(habit, profile, habits) ? [still] : [];
  });
}

const dayMonth = (at: string) => new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(Date.parse(at)));

const quoted = (names: readonly string[]) => names.map(n => `“${n}”`).join(' and ');

/** The instruction, in one paragraph; `undefined` when Calendar holds nothing the app has stopped. */
export function calendarNotice(still: readonly StillReminding[]): string | undefined {
  if (still.length === 0) return undefined;
  const what = still
    .map(s => (s.events === 1 ? `the daily ${quoted(s.names)} reminder` : `the ${s.events} daily ${quoted(s.names)} reminders`))
    .join(' and ');
  const days = [...new Set(still.map(s => dayMonth(s.at)))];
  const from = days.length === 1 ? `the file you added on ${days[0]}` : `the files you added on ${days.slice(0, -1).join(', ')} and ${days[days.length - 1]}`;
  // "May": the app cannot know whether they are still there.
  return `Calendar may still show ${what} from ${from}. This app cannot remove them. In Calendar, delete the calendar you added them to, or delete each of those events.`;
}
