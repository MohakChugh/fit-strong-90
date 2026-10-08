import { describe, expect, it } from 'vitest';
import type { HabitSettings } from '@/types/habits';
import { createDefaultProfile } from '@/profile/defaults';
import {
  dailyTimes,
  dueBetween,
  inWindowOrder,
  isQuiet,
  nextAfter,
  occurrencesOn,
  stillDue,
  tick,
  windowTimes,
  type DayStatus,
  type ReminderContext,
} from './schedule';
import { parseClock, type WallTime } from './time';

const healthy = createDefaultProfile({ weightKg: 80 });

const D = '2026-10-08';
const NEXT = '2026-10-09';

/** 11:00, 13:00, 15:00, 17:00, 19:00, 21:00 */
const WATER = { enabled: true, glassMl: 250, everyMinutes: 120, from: '09:00', to: '21:00' };
/** 09:30, 10:00, 10:30, 11:00 */
const SITTING = { enabled: true, everyMinutes: 30, from: '09:00', to: '11:00' };
const MEAL_WALK = { enabled: true, meals: ['lunch', 'dinner'] as ('lunch' | 'dinner')[], finish: { lunch: '13:30', dinner: '20:30' } };

function at(day: string, clock: string): WallTime {
  const minute = parseClock(clock);
  if (minute === undefined) throw new Error(`bad clock ${clock}`);
  return { day, minute };
}

function context(habits: HabitSettings, over: Partial<ReminderContext> = {}): ReminderContext {
  return { habits, profile: healthy, status: 'normal', ...over };
}

const clocks = (minutes: number[]) => minutes.map(m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);

describe('windowTimes', () => {
  it('starts one interval after the window opens and includes its close', () => {
    expect(clocks(windowTimes('09:00', '21:00', 120))).toEqual(['11:00', '13:00', '15:00', '17:00', '19:00', '21:00']);
    expect(clocks(windowTimes('09:00', '20:59', 120))).toEqual(['11:00', '13:00', '15:00', '17:00', '19:00']);
  });

  it('crosses midnight for a window that does', () => {
    expect(clocks(windowTimes('22:00', '02:00', 60))).toEqual(['23:00', '00:00', '01:00', '02:00']);
  });

  it('puts times sorted by the clock back in the order their window runs (D-11)', () => {
    expect(clocks(inWindowOrder([0, 60, 120, 1380], '22:00'))).toEqual(['23:00', '00:00', '01:00', '02:00']);
    expect(clocks(inWindowOrder([660, 780], '09:00'))).toEqual(['11:00', '13:00']);
  });

  it('is empty when the window is shorter than one interval, or not a window', () => {
    expect(windowTimes('09:00', '09:20', 30)).toEqual([]);
    expect(windowTimes('09:00', '09:00', 30)).toEqual([]);
    expect(windowTimes('9am', '17:00', 30)).toEqual([]);
    expect(windowTimes('09:00', undefined, 30)).toEqual([]);
  });

  it('refuses an interval a screen never offered instead of looping on it', () => {
    for (const every of [0, -30, 14, 7.5, Number.NaN, Number.POSITIVE_INFINITY, 721, '60', undefined]) {
      expect(windowTimes('00:00', '23:59', every), String(every)).toEqual([]);
    }
    expect(windowTimes('09:00', '09:15', 15)).toEqual([555]);
    expect(windowTimes('00:00', '12:00', 720)).toEqual([720]);
  });
});

describe('isQuiet', () => {
  it('covers a window that crosses midnight, from inclusive and to exclusive', () => {
    const night = { from: '22:00', to: '07:00' };
    expect(isQuiet(parseClock('22:00')!, night)).toBe(true);
    expect(isQuiet(parseClock('23:30')!, night)).toBe(true);
    expect(isQuiet(parseClock('06:59')!, night)).toBe(true);
    expect(isQuiet(parseClock('07:00')!, night)).toBe(false);
    expect(isQuiet(parseClock('21:59')!, night)).toBe(false);
  });

  it('covers a daytime window', () => {
    const nap = { from: '13:00', to: '14:00' };
    expect(isQuiet(parseClock('13:00')!, nap)).toBe(true);
    expect(isQuiet(parseClock('13:59')!, nap)).toBe(true);
    expect(isQuiet(parseClock('14:00')!, nap)).toBe(false);
    expect(isQuiet(parseClock('12:59')!, nap)).toBe(false);
  });

  it('is never quiet without a real window', () => {
    expect(isQuiet(600, undefined)).toBe(false);
    expect(isQuiet(600, { from: '10:00', to: '10:00' })).toBe(false);
    expect(isQuiet(600, { from: 'late', to: '07:00' })).toBe(false);
  });
});

describe('dailyTimes', () => {
  it('holds nothing until the user turns a habit on', () => {
    expect(dailyTimes(undefined, healthy)).toEqual([]);
    expect(dailyTimes({}, healthy)).toEqual([]);
    expect(dailyTimes({
      water: { ...WATER, enabled: false },
      sittingBreak: { ...SITTING, enabled: false },
      mealWalk: { ...MEAL_WALK, enabled: false },
    }, healthy)).toEqual([]);
  });

  it('merges every habit that is on, in time order', () => {
    const times = dailyTimes({ water: WATER, sittingBreak: SITTING, mealWalk: MEAL_WALK }, healthy);
    expect(times.map(t => `${t.habit}${t.meal ? `:${t.meal}` : ''} ${clocks([t.minute])[0]}`)).toEqual([
      'sittingBreak 09:30',
      'sittingBreak 10:00',
      'sittingBreak 10:30',
      'water 11:00',
      'sittingBreak 11:00',
      'water 13:00',
      'mealWalk:lunch 13:30',
      'water 15:00',
      'water 17:00',
      'water 19:00',
      'mealWalk:dinner 20:30',
      'water 21:00',
    ]);
  });

  it('drops every time inside quiet hours, whichever habit it belongs to', () => {
    const times = dailyTimes({ water: WATER, mealWalk: MEAL_WALK, quietHours: { from: '20:00', to: '07:00' } }, healthy);
    expect(clocks(times.map(t => t.minute))).toEqual(['11:00', '13:00', '13:30', '15:00', '17:00', '19:00']);
  });

  it('reminds after a meal only when the user said when they finish it', () => {
    const times = dailyTimes({ mealWalk: { enabled: true, meals: ['breakfast', 'lunch', 'dinner'], finish: { lunch: '13:30', dinner: 'late' } } }, healthy);
    expect(times).toEqual([{ habit: 'mealWalk', meal: 'lunch', minute: parseClock('13:30') }]);
  });

  it('leaves water out for a profile that needs a fluid limit, and keeps the rest', () => {
    const ckd = createDefaultProfile({ weightKg: 80, health: { kidneyDisease: 'ckd' } });
    const times = dailyTimes({ water: WATER, sittingBreak: SITTING }, ckd);
    expect(times.length).toBe(4);
    expect(times.every(t => t.habit === 'sittingBreak')).toBe(true);
  });
});

describe('occurrencesOn', () => {
  const habits = { water: WATER, sittingBreak: SITTING };

  it('is silent whenever the Status is not Normal', () => {
    for (const status of ['flare', 'unwell', 'away'] as DayStatus[]) {
      expect(occurrencesOn(D, context(habits, { status })), status).toEqual([]);
    }
    expect(occurrencesOn(D, context(habits)).length).toBe(10);
  });

  it('is silent when the user turned banners off', () => {
    expect(occurrencesOn(D, context({ ...habits, inApp: false }))).toEqual([]);
  });

  it('stops water for the day once the goal the user chose is met, and only water', () => {
    const goal = { water: { ...WATER, dailyGoalMl: 2000 }, sittingBreak: SITTING };
    const met = occurrencesOn(D, context(goal, { waterOn: day => (day === D ? 2000 : 0) }));
    expect(met.map(o => o.habit)).toEqual(['sittingBreak', 'sittingBreak', 'sittingBreak', 'sittingBreak']);

    const short = occurrencesOn(D, context(goal, { waterOn: () => 1999 }));
    expect(short.filter(o => o.habit === 'water').length).toBe(6);

    // No goal, or an unknown total, never ends the reminders.
    expect(occurrencesOn(D, context(habits, { waterOn: () => 9000 })).filter(o => o.habit === 'water').length).toBe(6);
    expect(occurrencesOn(D, context(goal)).filter(o => o.habit === 'water').length).toBe(6);
    // The goal is per day.
    expect(occurrencesOn(NEXT, context(goal, { waterOn: day => (day === D ? 2000 : 0) })).filter(o => o.habit === 'water').length).toBe(6);
  });

  it('gives every reminder an id of its own', () => {
    const ids = [...occurrencesOn(D, context(habits)), ...occurrencesOn(NEXT, context(habits))].map(o => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('water@2026-10-08T11:00');
  });
});

describe('dueBetween', () => {
  const habits = { water: WATER };

  it('counts after the start and up to and including the end', () => {
    expect(dueBetween(at(D, '10:59'), at(D, '11:00'), context(habits)).map(o => o.id)).toEqual(['water@2026-10-08T11:00']);
    expect(dueBetween(at(D, '11:00'), at(D, '12:59'), context(habits))).toEqual([]);
    expect(dueBetween(at(D, '11:00'), at(D, '11:00'), context(habits))).toEqual([]);
    expect(dueBetween(at(D, '12:00'), at(D, '11:00'), context(habits))).toEqual([]);
  });

  it('crosses midnight', () => {
    const night = { water: { ...WATER, from: '22:00', to: '02:00', everyMinutes: 60 } };
    expect(dueBetween(at(D, '22:30'), at(NEXT, '00:30'), context(night)).map(o => o.id)).toEqual([
      'water@2026-10-08T23:00',
      'water@2026-10-09T00:00',
    ]);
  });

  it('never walks further back than 48 hours, however old the start', () => {
    const due = dueBetween(at('2025-10-08', '00:00'), at(D, '23:59'), context(habits));
    expect(new Set(due.map(o => o.day))).toEqual(new Set(['2026-10-07', '2026-10-08']));
    expect(due.length).toBe(12);
  });
});

describe('nextAfter', () => {
  it('steps over quiet hours to the next time that may show', () => {
    const habits = { water: { ...WATER, everyMinutes: 60, to: '23:00' }, quietHours: { from: '13:00', to: '15:00' } };
    expect(nextAfter(at(D, '12:30'), context(habits))?.id).toBe('water@2026-10-08T15:00');
  });

  it('is tomorrow\'s first reminder once today\'s last has passed', () => {
    expect(nextAfter(at(D, '21:00'), context({ water: WATER }))?.id).toBe('water@2026-10-09T11:00');
    expect(nextAfter(at(D, '23:59'), context({ water: WATER }))?.id).toBe('water@2026-10-09T11:00');
  });

  it('crosses midnight inside a night window', () => {
    const night = { water: { ...WATER, from: '22:00', to: '02:00', everyMinutes: 60 } };
    expect(nextAfter(at(D, '23:30'), context(night))?.id).toBe('water@2026-10-09T00:00');
  });

  it('is strictly after the moment asked about', () => {
    expect(nextAfter(at(D, '11:00'), context({ water: WATER }))?.id).toBe('water@2026-10-08T13:00');
  });

  it('is nothing while the Status is not Normal, and the next future reminder once it is', () => {
    const habits = { water: WATER };
    expect(nextAfter(at(D, '12:00'), context(habits, { status: 'away' }))).toBeUndefined();
    expect(nextAfter(at(D, '12:00'), context(habits, { status: 'flare' }))).toBeUndefined();
    expect(nextAfter(at(D, '12:00'), context(habits))?.id).toBe('water@2026-10-08T13:00');
  });

  it('follows a Status that changes at midnight: quiet while Away today, back tomorrow', () => {
    const awayToday = (day: string): DayStatus => (day === D ? 'away' : 'normal');
    expect(nextAfter(at(D, '09:00'), context({ water: WATER }, { status: awayToday }))?.id).toBe('water@2026-10-09T11:00');
    expect(occurrencesOn(D, context({ water: WATER }, { status: awayToday }))).toEqual([]);
    expect(occurrencesOn(NEXT, context({ water: WATER }, { status: awayToday })).length).toBe(6);
  });

  it('moves to tomorrow when today\'s water goal is already met', () => {
    const habits = { water: { ...WATER, dailyGoalMl: 1500 } };
    expect(nextAfter(at(D, '12:00'), context(habits, { waterOn: day => (day === D ? 1500 : undefined) }))?.id)
      .toBe('water@2026-10-09T11:00');
  });

  it('is nothing when nothing is chosen or banners are off', () => {
    expect(nextAfter(at(D, '12:00'), context({}))).toBeUndefined();
    expect(nextAfter(at(D, '12:00'), context({ water: WATER, inApp: false }))).toBeUndefined();
  });
});

describe('tick', () => {
  const habits = { water: WATER, sittingBreak: { ...SITTING, to: '18:00' } };

  it('starts counting on the first look and shows nothing, even on the minute', () => {
    const first = tick({}, at(D, '11:00'), context(habits));
    expect(first.fire).toEqual([]);
    expect(first.state.lastCheck).toEqual(at(D, '11:00'));
  });

  it('shows a reminder when its minute comes, and only once', () => {
    let state = tick({}, at(D, '10:58'), context(habits)).state;
    const due = tick(state, at(D, '11:00'), context(habits));
    expect(due.fire.map(o => o.id)).toEqual(['water@2026-10-08T11:00', 'sittingBreak@2026-10-08T11:00']);
    state = due.state;
    expect(tick(state, at(D, '11:00'), context(habits)).fire).toEqual([]);
    expect(tick(state, at(D, '11:01'), context(habits)).fire).toEqual([]);
  });

  it('crosses midnight', () => {
    const night = { water: { ...WATER, from: '22:00', to: '02:00', everyMinutes: 60 } };
    const result = tick({ lastCheck: at(D, '23:59') }, at(NEXT, '00:00'), context(night));
    expect(result.fire.map(o => o.id)).toEqual(['water@2026-10-09T00:00']);
    expect(result.fire[0].day).toBe(NEXT);
  });

  it('after a long gap shows only what is still timely, once per habit', () => {
    const result = tick({ lastCheck: at(D, '09:00') }, at(D, '15:10'), context(habits));
    expect(result.fire.map(o => o.id)).toEqual(['water@2026-10-08T15:00', 'sittingBreak@2026-10-08T15:00']);
  });

  it('drops a reminder that is fifteen minutes old and keeps one fourteen minutes old', () => {
    const water = { water: WATER };
    expect(tick({ lastCheck: at(D, '09:00') }, at(D, '11:15'), context(water)).fire).toEqual([]);
    expect(tick({ lastCheck: at(D, '09:00') }, at(D, '11:14'), context(water)).fire.map(o => o.id)).toEqual(['water@2026-10-08T11:00']);
  });

  it('restarts the count when the clock goes backwards', () => {
    const result = tick({ lastCheck: at(D, '15:00') }, at(D, '11:00'), context(habits));
    expect(result.fire).toEqual([]);
    expect(result.state.lastCheck).toEqual(at(D, '11:00'));
  });

  it('keeps quiet while Away, and coming back does not replay what was missed', () => {
    let state = tick({}, at(D, '10:58'), context(habits, { status: 'away' })).state;
    const away = tick(state, at(D, '11:00'), context(habits, { status: 'away' }));
    expect(away.fire).toEqual([]);
    state = away.state;

    const back = tick(state, at(D, '11:01'), context(habits));
    expect(back.fire).toEqual([]);
    const later = tick(back.state, at(D, '11:30'), context(habits));
    expect(later.fire.map(o => o.id)).toEqual(['sittingBreak@2026-10-08T11:30']);
  });

  it('stays quiet across midnight while a Status runs, and resumes the day it ends', () => {
    const night = { water: { ...WATER, from: '22:00', to: '02:00', everyMinutes: 60 } };
    // Away on the 8th; Normal from the 9th, as a period ending on the 8th says.
    const status = (day: string): DayStatus => (day <= D ? 'away' : 'normal');
    const result = tick({ lastCheck: at(D, '22:59') }, at(D, '23:00'), context(night, { status }));
    expect(result.fire).toEqual([]);
    expect(tick({ lastCheck: at(D, '23:59') }, at(NEXT, '00:00'), context(night, { status })).fire.map(o => o.id))
      .toEqual(['water@2026-10-09T00:00']);
  });

  it('treats each meal as its own reminder', () => {
    const close = { mealWalk: { enabled: true, meals: ['lunch', 'dinner'] as ('lunch' | 'dinner')[], finish: { lunch: '13:30', dinner: '13:35' } } };
    const result = tick({ lastCheck: at(D, '13:29') }, at(D, '13:36'), context(close));
    expect(result.fire.map(o => o.id)).toEqual(['mealWalk:lunch@2026-10-08T13:30', 'mealWalk:dinner@2026-10-08T13:35']);
  });
});

describe('stillDue', () => {
  const habits = { water: WATER, sittingBreak: SITTING, mealWalk: MEAL_WALK };
  const on = occurrencesOn(D, context(habits));
  const water11 = on.find(o => o.id === 'water@2026-10-08T11:00')!;
  const lunch = on.find(o => o.habit === 'mealWalk' && o.meal === 'lunch')!;
  const soon = at(D, '11:05');

  it('keeps a reminder that may still show', () => {
    expect(stillDue(water11, soon, context(habits))).toBe(true);
    expect(stillDue(lunch, at(D, '13:40'), context(habits))).toBe(true);
  });

  it('drops one from a day that has ended', () => {
    expect(stillDue(water11, at(NEXT, '00:05'), context(habits))).toBe(false);
  });

  it('drops one once today is no longer Normal, or banners are off', () => {
    expect(stillDue(water11, soon, context(habits, { status: day => (day === D ? 'unwell' : 'normal') }))).toBe(false);
    expect(stillDue(water11, soon, context({ ...habits, inApp: false }))).toBe(false);
  });

  it('drops one inside quiet hours, even one that came due before they began', () => {
    expect(stillDue(water11, soon, context({ ...habits, quietHours: { from: '11:01', to: '12:00' } }))).toBe(false);
  });

  it('drops one whose habit has been turned off', () => {
    expect(stillDue(water11, soon, context({ ...habits, water: { ...WATER, enabled: false } }))).toBe(false);
    expect(stillDue(water11, soon, context({ ...habits, sittingBreak: undefined }))).toBe(true);
  });

  it('drops a water reminder once a fluid limit, or not knowing, is recorded', () => {
    const limited = createDefaultProfile({ weightKg: 80, health: { fluidRestriction: true } });
    const unsure = createDefaultProfile({ weightKg: 80, health: { fluidRestriction: 'unsure' } });
    expect(stillDue(water11, soon, context(habits, { profile: limited }))).toBe(false);
    expect(stillDue(water11, soon, context(habits, { profile: unsure }))).toBe(false);
    expect(stillDue(water11, soon, context({ ...habits, fluidLimit: true }))).toBe(false);
  });

  it("drops a water reminder once the day's goal is met", () => {
    const goal = { ...habits, water: { ...WATER, dailyGoalMl: 1000 } };
    expect(stillDue(water11, soon, context(goal, { waterOn: () => 1000 }))).toBe(false);
    expect(stillDue(water11, soon, context(goal, { waterOn: () => 750 }))).toBe(true);
  });

  it('drops an after-meal walk for a meal no longer chosen', () => {
    expect(stillDue(lunch, at(D, '13:40'), context({ ...habits, mealWalk: { ...MEAL_WALK, meals: ['dinner'] } }))).toBe(false);
  });
});

describe('tick, catching up after a gap', () => {
  // 09:55, then 10:50 and 11:45; quiet hours from 10:00 hide 10:50.
  const water = { ...WATER, from: '09:00', to: '12:00', everyMinutes: 55 };

  it('does not show a missed reminder once quiet hours have begun', () => {
    const quiet = { water, quietHours: { from: '10:00', to: '11:00' } };
    expect(tick({ lastCheck: at(D, '09:54') }, at(D, '10:01'), context(quiet)).fire).toEqual([]);
    expect(tick({ lastCheck: at(D, '09:54') }, at(D, '10:01'), context({ water })).fire.map(o => o.id)).toEqual(['water@2026-10-08T09:55']);
  });

  it("does not carry yesterday's reminder onto a day that is not Normal", () => {
    const late = { water: { ...WATER, from: '22:55', to: '23:55', everyMinutes: 60 } };
    const unwellToday: ReminderContext['status'] = day => (day === NEXT ? 'unwell' : 'normal');
    expect(tick({ lastCheck: at(D, '23:54') }, at(NEXT, '00:02'), context(late, { status: unwellToday })).fire).toEqual([]);
  });

  it('leaves a reminder from a day that has ended behind, even on a Normal day', () => {
    const late = { water: { ...WATER, from: '22:55', to: '23:55', everyMinutes: 60 } };
    expect(tick({ lastCheck: at(D, '23:54') }, at(NEXT, '00:02'), context(late)).fire).toEqual([]);
  });
});

describe('dailyTimes, with an open foot wound (content re-check R03)', () => {
  const insulin = {
    diabetes: 'type2', insulin: 'injections_or_pump', insulinRegimen: 'basalOnly', sulfonylureaOrMeglitinide: false,
    sglt2i: false, metformin: true, priorDkaOrInsulinDeficiency: false, medicinesReviewed: true,
  } as const;
  const wound = createDefaultProfile({ weightKg: 80, health: { ...insulin, footStatus: 'current_wound_or_active_charcot' } });
  const healed = createDefaultProfile({ weightKg: 80, health: { ...insulin, footStatus: 'healthy' } });
  const habits: HabitSettings = {
    sittingBreak: { enabled: true, everyMinutes: 30, from: '09:00', to: '10:00' },
    mealWalk: { enabled: true, meals: ['dinner'], finish: { dinner: '19:00' } },
  };

  it('schedules no standing or walking prompt, even for habits already turned on', () => {
    expect(dailyTimes(habits, wound)).toEqual([]);
    expect(dailyTimes(habits, healed).map(t => t.minute)).toEqual([570, 600, 1140]);
  });

  it('lets nothing already waiting outlive the wound being recorded', () => {
    const [first] = occurrencesOn(D, context(habits, { profile: healed }));
    expect(stillDue(first, at(D, '09:31'), context(habits, { profile: healed }))).toBe(true);
    expect(stillDue(first, at(D, '09:31'), context(habits, { profile: wound }))).toBe(false);
  });
});
