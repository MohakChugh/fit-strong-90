import { describe, expect, it } from 'vitest';
import { createDefaultProfile } from '@/profile/defaults';
import type { HabitSettings } from '@/types/habits';
import { calendarEvents } from './ics';
import {
  CALENDAR_DAYS,
  calendarExportOf,
  calendarNotice,
  calendarStillReminds,
  exportedStill,
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
  it('records, for each habit in the file, when it was made, until when its events repeat, how many and what they are called', () => {
    expect(calendarExportOf(calendarEvents(habits, healthy), AT, TODAY)).toEqual({
      water: { at: AT, until: '2027-01-06', events: 6, titles: ['Glass of water'] },
      sittingBreak: { at: AT, until: '2027-01-06', events: 2, titles: ['Stand up and move'] },
      mealWalk: { at: AT, until: '2027-01-06', events: 1, titles: ['Walk after dinner'] },
    });
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
