/**
 * Reminders that still fire when the app is closed, handed to Calendar (D15).
 *
 * A web app on iOS cannot wake itself on a timer, and Web Push needs a sender
 * this app refuses to run. So the schedule goes to the one thing on the phone
 * that can keep it: a calendar file (RFC 5545) the user adds to Calendar, which
 * then shows its own alerts and needs nothing more from us.
 *
 * Choices, and why:
 *
 * - **One event per reminder time, each `RRULE:FREQ=DAILY`.** "Every two
 *   hours" would be one rule with `BYHOUR`, but iOS Calendar keeps only daily,
 *   weekly, monthly and yearly repeats (EventKit has no hourly rule), so that
 *   file would import as one reminder a day. Daily rules are the form every
 *   calendar reads the same way.
 * - **Floating local times** (§3.3.5, form 1: no `Z`, no `TZID`). A habit is
 *   "09:30 wherever I am": floating time stays 09:30 through a daylight-saving
 *   change and after a flight, which UTC would not, and it needs no
 *   `VTIMEZONE` block — which every `TZID` requires (§3.2.19) and which a
 *   browser has no tz database to write correctly.
 * - **Stable UIDs** (`water-1`, `walk-after-lunch`, …): the same schedule
 *   written twice describes the same events, so a calendar that matches on
 *   UID updates them rather than adding a second set.
 * - **`VALARM` with `ACTION:DISPLAY` at the event's start** (§3.6.6), which is
 *   the alert. Events are `TRANSP:TRANSPARENT` so they never show as busy.
 */

import type { HabitSettings, Meal } from '@/types/habits';
import type { UserProfile } from '@/types/profile';
import { MEAL_LABEL, SITTING_EVIDENCE, reminderText } from './copy';
import { habitPrecautions } from './advice';
import { dailyTimes, type HabitId } from './schedule';

const CRLF = '\r\n';

/** Right-hand side of every UID: the app's own host, as §3.8.4.7 suggests. */
const UID_HOST = 'mohakchugh.github.io';

export const PRODID = '-//FitStrong//Habit reminders//EN';
export const CALENDAR_NAME = 'FitStrong reminders';

/** §3.1: a content line is at most 75 octets, not counting its line break. */
const MAX_OCTETS = 75;

/**
 * Escape a TEXT value (§3.3.11): backslash, semicolon and comma get a
 * backslash, and a line break becomes the two characters `\n`.
 */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

const encoder = new TextEncoder();

/**
 * Fold a content line (§3.1): break before it passes 75 octets, continuing
 * with CRLF and one space. Counted in UTF-8 octets, not characters, and never
 * splitting a character's bytes — "₹" is three octets and must stay whole.
 */
export function foldLine(line: string): string {
  const parts: string[] = [];
  let current = '';
  let octets = 0;
  // The continuation's leading space is one of its 75 octets.
  let room = MAX_OCTETS;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (octets + size > room) {
      parts.push(current);
      current = '';
      octets = 0;
      room = MAX_OCTETS - 1;
    }
    current += char;
    octets += size;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** A UTC date-time, which `DTSTAMP` must be (§3.8.7.2). */
export function utcStamp(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

/** A floating local date-time: a calendar day and a time, no zone. */
export function floatingStamp(day: string, minute: number): string {
  return `${day.replace(/-/g, '')}T${pad(Math.floor(minute / 60))}${pad(minute % 60)}00`;
}

export interface CalendarEvent {
  uid: string;
  habit: HabitId;
  meal?: Meal;
  /** Minutes after local midnight. */
  minute: number;
  title: string;
  note: string;
  /** What the alert itself says. */
  alert: string;
  durationMinutes: number;
}

const TITLE: Record<HabitId, (meal?: Meal) => string> = {
  water: () => 'Glass of water',
  sittingBreak: () => 'Stand up and move',
  mealWalk: meal => `Walk after ${(meal ? MEAL_LABEL[meal] : 'a meal').toLowerCase()}`,
};

/** Ten minutes for the walk, as in Reynolds 2016; five for a glass or a stretch. */
const MINUTES: Record<HabitId, number> = { water: 5, sittingBreak: 5, mealWalk: 10 };

/**
 * The events for what the user chose, from the same `dailyTimes` the in-app
 * scheduler uses: quiet hours and the fluid-limit rule apply here too, so a
 * calendar can never carry a water reminder the app itself would not show.
 */
export function calendarEvents(habits: HabitSettings | undefined, profile: UserProfile | undefined): CalendarEvent[] {
  const counts: Partial<Record<HabitId, number>> = {};
  return dailyTimes(habits, profile).map(time => {
    const n = (counts[time.habit] ?? 0) + 1;
    counts[time.habit] = n;
    const uid = time.habit === 'mealWalk'
      ? `walk-after-${time.meal ?? 'meal'}`
      : `${time.habit === 'water' ? 'water' : 'sitting'}-${n}`;
    const text = reminderText(time, habits?.water?.glassMl);
    // A calendar can be followed with the app closed, so the precautions the
    // Guide attaches to movement travel in the note (R03).
    const precautions = habitPrecautions(time.habit, profile, habits);
    const note = [time.habit === 'sittingBreak' ? `${text.detail} ${SITTING_EVIDENCE}` : text.detail, ...precautions].join(' ');
    return {
      uid: `${uid}@${UID_HOST}`,
      habit: time.habit,
      ...(time.meal ? { meal: time.meal } : {}),
      minute: time.minute,
      title: TITLE[time.habit](time.meal),
      note,
      alert: text.title,
      durationMinutes: MINUTES[time.habit],
    };
  });
}

export interface IcsOptions {
  /** `YYYY-MM-DD`: repeat daily until this local day, so a forgotten file stops in the end. Absent: no end. */
  until?: string;
  /** When the file is made: `DTSTAMP`, and the revision number. */
  now: Date;
  /** The local day the series start on, `YYYY-MM-DD`. */
  firstDay: string;
  /** A link back into the app, shown in each event. */
  appUrl: string;
}

/**
 * A revision number that only grows, so a newer file is recognisably newer
 * (§3.8.7.4): minutes since the start of 2026.
 */
function sequence(now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - Date.UTC(2026, 0, 1)) / 60_000));
}

/** The calendar file: CRLF line ends, folded lines, escaped text. */
export function buildIcs(events: CalendarEvent[], options: IcsOptions): string {
  const stamp = utcStamp(options.now);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(CALENDAR_NAME)}`,
  ];
  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `DTSTAMP:${stamp}`,
      `SEQUENCE:${sequence(options.now)}`,
      `DTSTART:${floatingStamp(options.firstDay, event.minute)}`,
      `DURATION:PT${event.durationMinutes}M`,
      // Floating like DTSTART, as RFC 5545 requires for a local start time.
      options.until ? `RRULE:FREQ=DAILY;UNTIL=${options.until.replaceAll('-', '')}T235959` : 'RRULE:FREQ=DAILY',
      `SUMMARY:${escapeText(event.title)}`,
      `DESCRIPTION:${escapeText(`${event.note}\n\nOpen the app: ${options.appUrl}`)}`,
      `URL:${options.appUrl}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(event.alert)}`,
      'TRIGGER:PT0S',
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join(CRLF) + CRLF;
}
