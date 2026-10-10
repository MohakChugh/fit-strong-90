import { describe, expect, it } from 'vitest';
import type { HabitSettings } from '@/types/habits';
import { createDefaultProfile } from '@/profile/defaults';
import {
  PRODID,
  buildIcs,
  calendarEvents,
  escapeText,
  floatingStamp,
  foldLine,
  utcStamp,
  type CalendarEvent,
} from './ics';

const profile = createDefaultProfile({ weightKg: 80 });
const APP = 'https://mohakchugh.github.io/fit-strong-90/#/today';
const NOW = new Date(Date.UTC(2026, 9, 8, 9, 30, 0));
const OPTIONS = { now: NOW, firstDay: '2026-10-08', appUrl: APP };

const HABITS: HabitSettings = {
  water: { enabled: true, glassMl: 250, everyMinutes: 120, from: '09:00', to: '21:00' },
  sittingBreak: { enabled: true, everyMinutes: 30, from: '09:00', to: '10:00' },
  mealWalk: { enabled: true, meals: ['lunch'], finish: { lunch: '13:30' } },
};

const octets = (s: string) => new TextEncoder().encode(s).length;
/** §3.1 unfolding: a line break followed by one space or tab is removed. */
const unfold = (text: string) => text.replace(/\r\n[ \t]/g, '');
/** §3.3.11 in reverse. */
const unescape = (s: string) => s.replace(/\\([\\;,nN])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

interface Parsed { lines: string[]; events: Record<string, string>[] }

function parse(text: string): Parsed {
  const lines = unfold(text).split('\r\n').filter(Boolean);
  const events: Record<string, string>[] = [];
  let current: Record<string, string> | undefined;
  let alarm = false;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') current = {};
    else if (line === 'END:VEVENT') { if (current) events.push(current); current = undefined; }
    else if (line === 'BEGIN:VALARM') alarm = true;
    else if (line === 'END:VALARM') alarm = false;
    else if (current) {
      const colon = line.indexOf(':');
      current[`${alarm ? 'ALARM.' : ''}${line.slice(0, colon)}`] = line.slice(colon + 1);
    }
  }
  return { lines, events };
}

describe('escapeText', () => {
  it('escapes backslashes, semicolons, commas and line breaks', () => {
    expect(escapeText('a\\b')).toBe('a\\\\b');
    expect(escapeText('rice; dal, roti')).toBe('rice\\; dal\\, roti');
    expect(escapeText('one\ntwo\r\nthree\rfour')).toBe('one\\ntwo\\nthree\\nfour');
  });

  it('escapes the backslash first, so a literal "\\n" survives the round trip', () => {
    const tricky = 'C:\\new, then; a line\nend\\';
    expect(unescape(escapeText(tricky))).toBe(tricky);
    expect(escapeText(tricky)).not.toMatch(/[\r\n]/);
  });
});

describe('foldLine', () => {
  it('leaves a line of 75 octets or fewer alone', () => {
    const exact = `SUMMARY:${'x'.repeat(67)}`;
    expect(octets(exact)).toBe(75);
    expect(foldLine(exact)).toBe(exact);
    expect(foldLine('SUMMARY:Water')).toBe('SUMMARY:Water');
  });

  it('breaks a longer line with CRLF and one space, every physical line at most 75 octets', () => {
    const long = `DESCRIPTION:${'abcdefghij'.repeat(20)}`;
    const folded = foldLine(long);
    const physical = folded.split('\r\n');
    expect(physical.length).toBeGreaterThan(2);
    expect(octets(physical[0])).toBe(75);
    for (const line of physical) expect(octets(line)).toBeLessThanOrEqual(75);
    for (const line of physical.slice(1)) expect(line.startsWith(' ')).toBe(true);
    expect(unfold(folded)).toBe(long);
  });

  it('breaks at 76 octets, not before', () => {
    const line = `SUMMARY:${'x'.repeat(68)}`;
    expect(octets(line)).toBe(76);
    expect(foldLine(line).split('\r\n').map(octets)).toEqual([75, 2]);
  });

  it('counts octets, not characters, and never splits a character', () => {
    const rupees = `DESCRIPTION:${'₹'.repeat(40)}`;
    const emoji = `SUMMARY:${'😀'.repeat(30)}`;
    for (const line of [rupees, emoji]) {
      const physical = foldLine(line).split('\r\n');
      for (const part of physical) {
        expect(octets(part)).toBeLessThanOrEqual(75);
        expect(LONE_SURROGATE.test(part)).toBe(false);
      }
      expect(unfold(foldLine(line))).toBe(line);
    }
    // 12 octets of "DESCRIPTION:" then 3-octet characters: 21 fit in the first 75.
    expect(foldLine(rupees).split('\r\n')[0]).toBe(`DESCRIPTION:${'₹'.repeat(21)}`);
  });
});

describe('stamps', () => {
  it('writes DTSTAMP in UTC and reminder times as floating local time', () => {
    expect(utcStamp(NOW)).toBe('20261008T093000Z');
    expect(floatingStamp('2026-10-08', 9 * 60 + 5)).toBe('20261008T090500');
  });
});

describe('buildIcs', () => {
  const events = calendarEvents(HABITS, profile);
  const text = buildIcs(events, OPTIONS);
  const { lines, events: parsed } = parse(text);

  it('ends every line with CRLF, including the last', () => {
    expect(text.endsWith('\r\n')).toBe(true);
    expect(/(?<!\r)\n/.test(text)).toBe(false);
    expect(/\r(?!\n)/.test(text)).toBe(false);
  });

  it('keeps every physical line within 75 octets', () => {
    for (const line of text.split('\r\n')) expect(octets(line), line).toBeLessThanOrEqual(75);
  });

  it('is one well-formed calendar', () => {
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines[lines.length - 1]).toBe('END:VCALENDAR');
    expect(lines).toContain('VERSION:2.0');
    expect(lines).toContain(`PRODID:${PRODID}`);
    const count = (line: string) => lines.filter(l => l === line).length;
    expect(count('BEGIN:VEVENT')).toBe(events.length);
    expect(count('END:VEVENT')).toBe(events.length);
    expect(count('BEGIN:VALARM')).toBe(events.length);
    expect(count('END:VALARM')).toBe(events.length);
  });

  it('writes one daily event per reminder time, with the forms every calendar reads', () => {
    // 6 water + 2 sitting + 1 walk.
    expect(parsed.length).toBe(9);
    for (const e of parsed) {
      expect(e.UID).toMatch(/^[a-z-]+(-\d+)?@mohakchugh\.github\.io$/);
      expect(e.DTSTAMP).toBe('20261008T093000Z');
      // Floating: no Z and no TZID parameter on the property.
      expect(e.DTSTART).toMatch(/^20261008T\d{6}$/);
      expect(Object.keys(e).some(k => k.startsWith('DTSTART;'))).toBe(false);
      expect(e.RRULE).toBe('FREQ=DAILY');
      expect(e.DURATION).toMatch(/^PT\d+M$/);
      expect(e.TRANSP).toBe('TRANSPARENT');
      expect(e.URL).toBe(APP);
      expect(e['ALARM.ACTION']).toBe('DISPLAY');
      expect(e['ALARM.TRIGGER']).toBe('PT0S');
      expect(e['ALARM.DESCRIPTION']?.length).toBeGreaterThan(0);
    }
    expect(text).not.toMatch(/FREQ=HOURLY|BYHOUR|TZID/);
  });

  it('puts each reminder at its own local time', () => {
    const starts = parsed.map(e => e.DTSTART.slice(9, 13));
    expect(starts).toEqual(['0930', '1000', '1100', '1300', '1330', '1500', '1700', '1900', '2100']);
  });

  it('escapes the description and links back into the app', () => {
    const walk = parsed.find(e => e.UID.startsWith('walk-after-lunch'));
    expect(walk?.SUMMARY).toBe('Walk after lunch');
    const water = parsed.find(e => e.UID.startsWith('water-1@'));
    expect(water?.DESCRIPTION).toContain('glass\\, if');
    expect(unescape(water?.DESCRIPTION ?? '')).toBe(`Your 250 ml glass, if it suits you now.\n\nOpen the app: ${APP}`);
    const sitting = parsed.find(e => e.UID.startsWith('sitting-1@'));
    expect(unescape(sitting?.DESCRIPTION ?? '')).toMatch(/every 30 minutes\.\n\nOpen the app: /);
  });

  it('is still a valid, empty calendar when nothing is chosen', () => {
    const empty = parse(buildIcs(calendarEvents({}, profile), OPTIONS));
    expect(empty.lines).toEqual([
      'BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:${PRODID}`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'X-WR-CALNAME:FitStrong reminders', 'END:VCALENDAR',
    ]);
  });

  it('folds and escapes an event whose words need it', () => {
    const odd: CalendarEvent = {
      uid: 'test@mohakchugh.github.io', habit: 'water', minute: 600, durationMinutes: 5,
      title: 'Chai, paani; ₹ — '.repeat(6), note: 'Line one\nLine two', alert: 'Alert, now',
    };
    const out = buildIcs([odd], OPTIONS);
    for (const line of out.split('\r\n')) expect(octets(line)).toBeLessThanOrEqual(75);
    const [event] = parse(out).events;
    expect(unescape(event.SUMMARY)).toBe(odd.title);
    expect(unescape(event['ALARM.DESCRIPTION'])).toBe('Alert, now');
  });
});

describe('UIDs', () => {
  const uids = (habits: HabitSettings, now = NOW) =>
    parse(buildIcs(calendarEvents(habits, profile), { ...OPTIONS, now })).events.map(e => e.UID);

  it('are the same every time the same schedule is written, so adding it again updates it', () => {
    expect(uids(HABITS, new Date(Date.UTC(2026, 11, 25)))).toEqual(uids(HABITS));
  });

  it('are unique within a file', () => {
    const all = uids(HABITS);
    expect(new Set(all).size).toBe(all.length);
  });

  it('name the meal, not its time, so a new time updates the same walk', () => {
    const later = { ...HABITS, mealWalk: { enabled: true, meals: ['lunch' as const], finish: { lunch: '14:15' } } };
    expect(uids(later)).toContain('walk-after-lunch@mohakchugh.github.io');
    expect(uids(HABITS)).toContain('walk-after-lunch@mohakchugh.github.io');
  });

  it('for one habit do not move when another habit is turned on', () => {
    const waterOnly = { water: HABITS.water };
    const water = (all: string[]) => all.filter(u => u.startsWith('water-'));
    expect(water(uids(HABITS))).toEqual(water(uids(waterOnly)));
  });

  it('come with a revision number that grows with each new file', () => {
    const seq = (now: Date) => Number(parse(buildIcs(calendarEvents(HABITS, profile), { ...OPTIONS, now })).events[0].SEQUENCE);
    expect(seq(new Date(Date.UTC(2026, 9, 9)))).toBeGreaterThan(seq(NOW));
  });
});

describe('calendarEvents', () => {
  it('leaves out times inside quiet hours', () => {
    const quiet = { ...HABITS, quietHours: { from: '19:00', to: '07:00' } };
    const minutes = calendarEvents(quiet, profile).map(e => e.minute);
    expect(minutes).not.toContain(19 * 60);
    expect(minutes).not.toContain(21 * 60);
    expect(minutes).toContain(17 * 60);
  });

  it('is for when the app is closed, so the in-app switch and the Status do not apply', () => {
    expect(calendarEvents({ ...HABITS, inApp: false }, profile).length).toBe(9);
  });
});

describe('calendarEvents, with the Guide\'s movement rules (content re-check R03)', () => {
  const insulin = {
    diabetes: 'type2', insulin: 'injections_or_pump', insulinRegimen: 'basalOnly', sulfonylureaOrMeglitinide: false,
    sglt2i: false, metformin: true, priorDkaOrInsulinDeficiency: false, medicinesReviewed: true,
  } as const;
  const habits = {
    sittingBreak: { enabled: true, everyMinutes: 30, from: '09:00', to: '10:00' },
    mealWalk: { enabled: true, meals: ['dinner' as const], finish: { dinner: '19:00' } },
  };

  it('puts no standing or walking event in a calendar for an open foot wound', () => {
    const wound = createDefaultProfile({ weightKg: 80, health: { ...insulin, footStatus: 'current_wound_or_active_charcot' } });
    expect(calendarEvents(habits, wound)).toEqual([]);
  });

  it('carries the care-plan checks and fast-acting sugar in every movement event for someone on insulin', () => {
    const healed = createDefaultProfile({ weightKg: 80, health: { ...insulin, footStatus: 'healthy' } });
    const events = calendarEvents(habits, healed);
    expect(events.map(e => e.title)).toEqual(['Stand up and move', 'Stand up and move', 'Walk after dinner']);
    for (const event of events) expect(event.note, event.title).toMatch(/carry a fast-acting source of sugar/);
  });
});

describe('buildIcs, with an end date (D-01)', () => {
  const event: CalendarEvent = { uid: 'water-1@x', habit: 'water', minute: 660, title: 'Glass of water', note: 'n', alert: 'a', durationMinutes: 5 };

  it('repeats daily until the given day, so a forgotten file stops in the end', () => {
    const text = buildIcs([event], { now: new Date(Date.UTC(2026, 9, 8, 5, 0)), firstDay: '2026-10-08', appUrl: 'https://x/', until: '2027-01-06' });
    expect(text).toContain('RRULE:FREQ=DAILY;UNTIL=20270106T235959\r\n');
  });

  it('repeats without end only when no end is given', () => {
    const text = buildIcs([event], { now: new Date(Date.UTC(2026, 9, 8, 5, 0)), firstDay: '2026-10-08', appUrl: 'https://x/' });
    expect(text).toContain('RRULE:FREQ=DAILY\r\n');
  });
});
