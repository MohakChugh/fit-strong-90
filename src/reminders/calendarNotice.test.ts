import { describe, expect, it } from 'vitest';
import { createDefaultProfile } from '@/profile/defaults';
import type { HabitSettings } from '@/types/habits';
import { calendarEvents } from './ics';
import {
  CALENDAR_DAYS,
  calendarCopies,
  calendarExportOf,
  calendarNotice,
  calendarStillReminds,
  eventContent,
  exportedStill,
  staleCalendarCopies,
  withCalendarExport,
  withoutCalendarHabits,
} from './calendarNotice';

const TODAY = '2026-10-08';
const AT = `${TODAY}T10:00:00.000+05:30`;
const healthy = createDefaultProfile({ weightKg: 80, health: { medicinesReviewed: true, fluidRestriction: false } });
const limited = createDefaultProfile({ weightKg: 80, health: { medicinesReviewed: true, fluidRestriction: true } });
const wound = createDefaultProfile({ weightKg: 80, health: { medicinesReviewed: true, fluidRestriction: false, footStatus: 'current_wound_or_active_charcot' } });
const habits: HabitSettings = {
  water: { enabled: true, glassMl: 250, everyMinutes: 120, from: '09:00', to: '21:00' },
  sittingBreak: { enabled: true, everyMinutes: 30, from: '09:00', to: '10:00' },
  mealWalk: { enabled: true, meals: ['dinner'], finish: { dinner: '19:00' } },
};
const exported = (h: HabitSettings, day = TODAY, at = `${day}T10:00:00.000+05:30`) =>
  ({ ...h, calendarExport: withCalendarExport(h.calendarExport, calendarExportOf(calendarEvents(h, healthy), at, day)) });

describe('calendarExportOf', () => {
  it('records, for each habit in the file, when it was made, until when its events repeat, how many, what they are called, and what each says', () => {
    const events = calendarEvents(habits, healthy);
    const said = (habit: string) => events.filter(e => e.habit === habit).map(eventContent);
    expect(calendarExportOf(events, AT, TODAY)).toEqual({
      water: { at: AT, until: '2027-01-06', events: 6, titles: ['Glass of water'], minutes: [660, 780, 900, 1020, 1140, 1260], contents: said('water') },
      sittingBreak: { at: AT, until: '2027-01-06', events: 2, titles: ['Stand up and move'], minutes: [570, 600], contents: said('sittingBreak') },
      mealWalk: { at: AT, until: '2027-01-06', events: 1, titles: ['Walk after dinner'], minutes: [1140], contents: said('mealWalk') },
    });
    // The same words give the same fingerprint, and any change in them another.
    const [first] = events;
    expect(eventContent(first)).toBe(eventContent({ ...first }));
    for (const change of [{ note: `${first.note}.` }, { alert: 'Water' }, { durationMinutes: first.durationMinutes + 1 }]) {
      expect(eventContent({ ...first, ...change }), JSON.stringify(change)).not.toBe(eventContent(first));
    }
    expect(CALENDAR_DAYS).toBe(90);
  });
});

describe('withCalendarExport / withoutCalendarHabits', () => {
  it('a new file replaces the habits in it and keeps the older events of those it leaves out', () => {
    const first = exported(habits, '2026-09-01');
    const walksOnly = { ...first, water: { ...first.water!, enabled: false } };
    const second = exported(walksOnly);
    expect(second.calendarExport?.water?.at).toBe('2026-09-01T10:00:00.000+05:30');
    expect(second.calendarExport?.water?.until).toBe('2026-11-30');
    expect(second.calendarExport?.mealWalk?.at).toBe(AT);
    expect(second.calendarExport?.mealWalk?.until).toBe('2027-01-06');
  });

  it('forgets only the habits the person says they deleted, and nothing is left once all are', () => {
    const file = exported(habits).calendarExport;
    expect(Object.keys(withoutCalendarHabits(file, ['water']) ?? {})).toEqual(['sittingBreak', 'mealWalk']);
    expect(withoutCalendarHabits(file, ['water', 'sittingBreak', 'mealWalk'])).toBeUndefined();
    expect(withoutCalendarHabits(undefined, ['water'])).toBeUndefined();
  });
});

describe('calendarStillReminds (D-01)', () => {
  it('names the water events Calendar will keep showing once a fluid limit is recorded', () => {
    expect(calendarStillReminds(exported(habits), limited, TODAY)).toEqual([{ habit: 'water', events: 6, names: ['Glass of water'], at: AT }]);
  });

  it('names the standing and walking events once an open foot wound is recorded', () => {
    expect(calendarStillReminds(exported(habits), wound, TODAY).map(e => [e.habit, e.events, e.names])).toEqual([
      ['sittingBreak', 2, ['Stand up and move']],
      ['mealWalk', 1, ['Walk after dinner']],
    ]);
  });

  it('names the events as the file did, whatever the settings say now', () => {
    const later = { ...exported(habits), mealWalk: { enabled: true, meals: ['breakfast' as const], finish: { breakfast: '08:00' } } };
    expect(calendarStillReminds(later, wound, TODAY).find(e => e.habit === 'mealWalk')?.names).toEqual(['Walk after dinner']);
  });

  it('says nothing when the habit was never exported, still reminds in the app, or its file has run out', () => {
    expect(calendarStillReminds(habits, limited, TODAY)).toEqual([]);
    expect(calendarStillReminds(exported(habits), healthy, TODAY)).toEqual([]);
    expect(calendarStillReminds(exported(habits, '2026-06-01'), limited, TODAY)).toEqual([]);
    // Each habit runs out on its own day.
    expect(calendarStillReminds(exported(habits, '2026-06-01'), wound, '2026-08-30').map(e => e.habit)).toEqual(['sittingBreak', 'mealWalk']);
    expect(calendarStillReminds(exported(habits, '2026-06-01'), wound, '2026-08-31')).toEqual([]);
  });

  it('one habit asked for by itself, as its own sheet does', () => {
    expect(exportedStill(exported(habits), 'water', TODAY)).toEqual({ habit: 'water', events: 6, names: ['Glass of water'], at: AT });
    expect(exportedStill(habits, 'water', TODAY)).toBeUndefined();
    expect(exportedStill(exported(habits, '2026-06-01'), 'water', TODAY)).toBeUndefined();
  });
});

describe('calendarNotice', () => {
  it('tells the person what to delete and where, and never that the app has stopped them', () => {
    const text = calendarNotice(calendarStillReminds(exported(habits), limited, TODAY));
    expect(text).toMatch(/6 daily “Glass of water” reminders/);
    expect(text).toMatch(/cannot remove them/);
    expect(text).toMatch(/In Calendar, delete the calendar you added them to, or delete each of those events/);
    expect(text).not.toMatch(/stopped|turned off|removed them/i);
    expect(calendarNotice([])).toBeUndefined();
  });

  it('lists each habit, in one sentence', () => {
    const text = calendarNotice(calendarStillReminds(exported(habits), wound, TODAY));
    expect(text).toMatch(/the 2 daily “Stand up and move” reminders and the daily “Walk after dinner” reminder from the file you added on /);
  });

  it('says files when the events came from more than one', () => {
    const both = exported({ ...exported(habits, '2026-09-01'), water: { ...habits.water!, enabled: false } });
    const text = calendarNotice(calendarStillReminds({ ...both, water: habits.water }, { ...wound, health: { ...wound.health, fluidRestriction: true } }, TODAY));
    expect(text).toMatch(/from the files you added on .+ and .+\./);
  });
});

describe('calendarCopies (A-78)', () => {
  it('lists what each file holds while its events still repeat', () => {
    expect(calendarCopies(exported(habits), TODAY).map(c => [c.habit, c.events, c.until])).toEqual([
      ['water', 6, '2027-01-06'], ['sittingBreak', 2, '2027-01-06'], ['mealWalk', 1, '2027-01-06'],
    ]);
    expect(calendarCopies(exported(habits, '2026-06-01'), TODAY)).toEqual([]);
  });
});

describe('staleCalendarCopies: the copies may be out of date (A-78)', () => {
  it('is empty while the schedule is the one the file holds', () => {
    expect(staleCalendarCopies(exported(habits), healthy, TODAY)).toEqual([]);
  });
  it('names a copy quiet hours have since thinned or emptied', () => {
    const quiet = { ...exported(habits), quietHours: { from: '17:00', to: '20:00' } };
    expect(staleCalendarCopies(quiet, healthy, TODAY)).toEqual([
      { habit: 'water', names: ['Glass of water'], inCalendar: 6, now: 4 },
      { habit: 'mealWalk', names: ['Walk after dinner'], inCalendar: 1, now: 0 },
    ]);
  });
  it('names a copy a fluid limit has stopped, and one turned off', () => {
    expect(staleCalendarCopies(exported(habits), limited, TODAY)).toEqual([{ habit: 'water', names: ['Glass of water'], inCalendar: 6, now: 0 }]);
    const off = { ...exported(habits), sittingBreak: { ...habits.sittingBreak!, enabled: false } };
    expect(staleCalendarCopies(off, healthy, TODAY)).toEqual([{ habit: 'sittingBreak', names: ['Stand up and move'], inCalendar: 2, now: 0 }]);
  });
  it('notices a moved time, with the same number a day', () => {
    const moved = { ...exported(habits), mealWalk: { enabled: true, meals: ['dinner' as const], finish: { dinner: '20:00' } } };
    expect(staleCalendarCopies(moved, healthy, TODAY)).toEqual([{ habit: 'mealWalk', names: ['Walk after dinner'], inCalendar: 1, now: 1 }]);
  });
  it('judges a file made before times were kept by its count and names alone', () => {
    const old = exported(habits);
    const entry = { ...old.calendarExport!.water! };
    delete entry.minutes;
    const noTimes = { ...old, calendarExport: { ...old.calendarExport, water: entry } };
    // ponytail: a shift with the same count isn't seen in such a file; a new file records times.
    expect(staleCalendarCopies({ ...noTimes, water: { ...habits.water!, from: '10:00', to: '22:00' } }, healthy, TODAY)).toEqual([]);
    expect(staleCalendarCopies({ ...noTimes, quietHours: { from: '17:00', to: '20:00' } }, healthy, TODAY).map(s => s.habit)).toEqual(['water', 'mealWalk']);
    // The same number a day under another name: the walk is after lunch now, not dinner.
    const walk = { ...old.calendarExport!.mealWalk! };
    delete walk.minutes;
    const lunch = { ...old, calendarExport: { ...old.calendarExport, mealWalk: walk }, mealWalk: { enabled: true, meals: ['lunch' as const], finish: { lunch: '13:00' } } };
    expect(staleCalendarCopies(lunch, healthy, TODAY)).toEqual([{ habit: 'mealWalk', names: ['Walk after dinner'], inCalendar: 1, now: 1 }]);
  });
  it('says nothing once a file has run out', () => {
    expect(staleCalendarCopies({ ...exported(habits, '2026-06-01'), quietHours: { from: '17:00', to: '20:00' } }, healthy, TODAY)).toEqual([]);
  });
});

describe('the copies say what they said: a changed note, alert or length dates them (codex H4-05, A-78)', () => {
  const water = (h: HabitSettings, profile = healthy) => calendarEvents(h, profile).filter(e => e.habit === 'water');

  it('a 250 ml glass changed to 100 ml, the times as they were: Calendar still says 250 ml', () => {
    const file = exported(habits);
    const smaller = { ...file, water: { ...file.water!, glassMl: 100 } };
    // The schedule is the file's own; only what each event says has changed.
    expect(water(smaller).map(e => e.minute)).toEqual(file.calendarExport!.water!.minutes);
    expect(water(smaller)[0].note).toBe('Your 100 ml glass, if it suits you now.');
    expect(water(file)[0].note).toBe('Your 250 ml glass, if it suits you now.');
    expect(staleCalendarCopies(smaller, healthy, TODAY)).toEqual([{ habit: 'water', names: ['Glass of water'], inCalendar: 6, now: 6, wording: true }]);
  });

  it('a clinical precaution added to the walk’s note since, at the same time', () => {
    const file = exported(habits);
    const sugar = createDefaultProfile({ weightKg: 80, health: { medicinesReviewed: true, fluidRestriction: false, diabetes: 'type2', metformin: true, sulfonylureaOrMeglitinide: true } });
    const walk = (profile: typeof healthy) => calendarEvents(file, profile).find(e => e.habit === 'mealWalk')!;
    expect(walk(sugar).minute).toBe(walk(healthy).minute);
    expect(walk(sugar).note).not.toBe(walk(healthy).note);
    expect(staleCalendarCopies(file, sugar, TODAY).map(s => s.habit)).toContain('mealWalk');
  });

  it('records what each event says, and a file made before that was kept is judged by its times and names', () => {
    const file = exported(habits);
    expect(file.calendarExport!.water!.contents).toHaveLength(6);
    const entry = { ...file.calendarExport!.water! };
    delete entry.contents;
    const older = { ...file, calendarExport: { ...file.calendarExport, water: entry }, water: { ...file.water!, glassMl: 100 } };
    // ponytail: such a file can't say what its events said; a new file records it.
    expect(staleCalendarCopies(older, healthy, TODAY)).toEqual([]);
  });
});
