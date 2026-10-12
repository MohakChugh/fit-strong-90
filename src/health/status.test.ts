import { describe, expect, it } from 'vitest';
import type { StatusPeriod } from '@/types';
import {
  answerShift,
  changeStatus,
  countingDays,
  daysBetween,
  daysFrom,
  endedRun,
  isStatusDay,
  isValidPeriod,
  pausedDays,
  periodOn,
  planOffer,
  shiftDay,
  shiftStartDate,
  statusOn,
  weekdayOf,
} from './status';

// 2026-10-08 is a Thursday.
const TODAY = '2026-10-08';

describe('calendar days', () => {
  it('shifts across month and year ends', () => {
    expect(shiftDay('2026-10-31', 1)).toBe('2026-11-01');
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDay('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('counts calendar days between two days, negative backwards', () => {
    expect(daysBetween('2026-10-01', TODAY)).toBe(7);
    expect(daysBetween(TODAY, '2026-10-01')).toBe(-7);
    expect(daysBetween(TODAY, TODAY)).toBe(0);
  });

  it('names the weekday of a day', () => {
    expect(weekdayOf(TODAY)).toBe('thursday');
    expect(weekdayOf('2026-10-11')).toBe('sunday');
    expect(weekdayOf('2026-10-12')).toBe('monday');
  });

  it('lists every day of a range, inclusive, and nothing for an inverted one', () => {
    expect(daysFrom('2026-10-06', TODAY)).toEqual(['2026-10-06', '2026-10-07', '2026-10-08']);
    expect(daysFrom(TODAY, TODAY)).toEqual([TODAY]);
    expect(daysFrom(TODAY, '2026-10-01')).toEqual([]);
  });
});

describe('reading periods', () => {
  it('rejects periods it cannot trust', () => {
    expect(isValidPeriod({ kind: 'away', from: '2026-10-01' })).toBe(true);
    expect(isValidPeriod({ kind: 'away', from: '2026-10-01', to: '2026-10-01' })).toBe(true);
    expect(isValidPeriod({ kind: 'away', from: '2026-10-05', to: '2026-10-01' })).toBe(false);
    expect(isValidPeriod({ kind: 'holiday', from: '2026-10-01' })).toBe(false);
    expect(isValidPeriod({ kind: 'away', from: '2026-02-30' })).toBe(false);
    expect(isValidPeriod({ kind: 'away', from: '2026-10-01', to: 'soon' })).toBe(false);
    expect(isValidPeriod(null)).toBe(false);
  });

  it('is Normal with no periods at all', () => {
    expect(statusOn(undefined, TODAY)).toBe('normal');
    expect(statusOn([], TODAY)).toBe('normal');
  });

  it('reads an open period as still going', () => {
    const periods: StatusPeriod[] = [{ kind: 'flare', from: '2026-10-06' }];
    expect(statusOn(periods, '2026-10-05')).toBe('normal');
    expect(statusOn(periods, '2026-10-06')).toBe('flare');
    expect(statusOn(periods, TODAY)).toBe('flare');
    expect(statusOn(periods, '2026-12-25')).toBe('flare');
  });

  it('reads a closed period as inclusive at both ends, and Normal after it', () => {
    const periods: StatusPeriod[] = [{ kind: 'away', from: '2026-10-02', to: '2026-10-06' }];
    expect(statusOn(periods, '2026-10-01')).toBe('normal');
    expect(statusOn(periods, '2026-10-02')).toBe('away');
    expect(statusOn(periods, '2026-10-06')).toBe('away');
    expect(statusOn(periods, '2026-10-07')).toBe('normal');
  });

  it('lets the most recently started period win where imported ones overlap', () => {
    const periods: StatusPeriod[] = [
      { kind: 'away', from: '2026-10-01', to: '2026-10-10' },
      { kind: 'unwell', from: '2026-10-05' },
    ];
    expect(statusOn(periods, '2026-10-03')).toBe('away');
    expect(statusOn(periods, TODAY)).toBe('unwell');
    expect(periodOn(periods, TODAY)).toEqual({ kind: 'unwell', from: '2026-10-05' });
  });

  it('ignores a malformed period rather than reading it', () => {
    const periods = [{ kind: 'away', from: '2026-10-09', to: '2026-10-01' }] as StatusPeriod[];
    expect(statusOn(periods, '2026-10-05')).toBe('normal');
  });
});

describe('consistency', () => {
  const periods: StatusPeriod[] = [
    { kind: 'unwell', from: '2026-10-05', to: '2026-10-06' },
    { kind: 'away', from: TODAY },
  ];

  it('marks every day under a status, of any kind', () => {
    expect(isStatusDay(periods, '2026-10-04')).toBe(false);
    expect(isStatusDay(periods, '2026-10-05')).toBe(true);
    expect(isStatusDay(periods, '2026-10-06')).toBe(true);
    expect(isStatusDay(periods, '2026-10-07')).toBe(false);
    expect(isStatusDay(periods, TODAY)).toBe(true);
  });

  it('leaves status days out of the days a consistency figure counts', () => {
    const week = daysFrom('2026-10-05', '2026-10-11');
    expect(countingDays(periods, week)).toEqual(['2026-10-07']);
    expect(countingDays(undefined, week)).toEqual(week);
  });
});

describe('changeStatus', () => {
  it('opens a new period from today', () => {
    const change = changeStatus(undefined, 'flare', TODAY);
    expect(change).toEqual({ periods: [{ kind: 'flare', from: TODAY }], changed: true });
  });

  it('records an end date when one is given', () => {
    const change = changeStatus([], 'away', TODAY, '2026-10-11');
    expect(change.periods).toEqual([{ kind: 'away', from: TODAY, to: '2026-10-11' }]);
    expect(statusOn(change.periods, '2026-10-11')).toBe('away');
    expect(statusOn(change.periods, '2026-10-12')).toBe('normal');
  });

  it('ends the current period yesterday on returning to Normal', () => {
    const flare: StatusPeriod = { kind: 'flare', from: '2026-10-05' };
    const change = changeStatus([flare], 'normal', TODAY);
    expect(change).toEqual({ periods: [{ kind: 'flare', from: '2026-10-05', to: '2026-10-07' }], changed: true });
    expect(statusOn(change.periods, TODAY)).toBe('normal');
  });

  it('cuts short a period that had an end date still to come', () => {
    const change = changeStatus([{ kind: 'away', from: '2026-10-05', to: '2026-10-20' }], 'normal', TODAY);
    expect(change.periods).toEqual([{ kind: 'away', from: '2026-10-05', to: '2026-10-07' }]);
  });

  it('removes a period set and cleared on the same day: it covered no day', () => {
    const change = changeStatus([{ kind: 'unwell', from: TODAY }], 'normal', TODAY);
    expect(change).toEqual({ periods: [], changed: true });
  });

  it('switches status without a gap, keeping both in the record', () => {
    const change = changeStatus([{ kind: 'flare', from: '2026-10-05' }], 'unwell', TODAY);
    expect(change.periods).toEqual([
      { kind: 'flare', from: '2026-10-05', to: '2026-10-07' },
      { kind: 'unwell', from: TODAY },
    ]);
  });

  it('keeps what else a period holds when it ends it or moves its end', () => {
    const answered: StatusPeriod = { kind: 'away', from: '2026-10-05', planShift: 'kept' };
    expect(changeStatus([answered], 'normal', TODAY).periods).toEqual([{ ...answered, to: '2026-10-07' }]);
    expect(changeStatus([answered], 'away', TODAY, '2026-10-09').periods).toEqual([{ ...answered, to: '2026-10-09' }]);
    expect(changeStatus([{ ...answered, to: '2026-10-09' }], 'away', TODAY).periods).toEqual([answered]);
  });

  it('only moves the end date when the same status is chosen again', () => {
    const periods: StatusPeriod[] = [{ kind: 'away', from: '2026-10-05' }];
    const later = changeStatus(periods, 'away', TODAY, '2026-10-12');
    expect(later).toEqual({ periods: [{ kind: 'away', from: '2026-10-05', to: '2026-10-12' }], changed: true });
    const open = changeStatus(later.periods, 'away', TODAY);
    expect(open.periods).toEqual([{ kind: 'away', from: '2026-10-05' }]);
  });

  it('reports no change when the choice is already in force', () => {
    expect(changeStatus([], 'normal', TODAY).changed).toBe(false);
    expect(changeStatus([{ kind: 'away', from: '2026-10-05' }], 'away', TODAY).changed).toBe(false);
    // A period that has already ended does not make today anything but Normal.
    expect(changeStatus([{ kind: 'away', from: '2026-10-01', to: '2026-10-03' }], 'normal', TODAY).changed).toBe(false);
  });

  it('refuses an end date before today', () => {
    expect(() => changeStatus([], 'away', TODAY, '2026-10-07')).toThrow(RangeError);
    expect(() => changeStatus([], 'away', TODAY, 'next week')).toThrow(RangeError);
  });

  it('carries an unreadable entry through rather than deleting it', () => {
    const odd = { kind: 'holiday', from: '2026-09-01' } as unknown as StatusPeriod;
    const change = changeStatus([odd], 'away', TODAY);
    expect(change.periods).toEqual([{ kind: 'away', from: TODAY }, odd]);
  });

  describe('with overlapping periods, as an import can hold (codex F25)', () => {
    // An open flare-up from 1 October and an open Unwell from the 3rd.
    const overlapping: StatusPeriod[] = [{ kind: 'flare', from: '2026-10-01' }, { kind: 'unwell', from: '2026-10-03' }];

    it('ends every period covering today on returning to Normal', () => {
      const change = changeStatus(overlapping, 'normal', TODAY);
      expect(change).toEqual({
        periods: [{ kind: 'flare', from: '2026-10-01', to: '2026-10-07' }, { kind: 'unwell', from: '2026-10-03', to: '2026-10-07' }],
        changed: true,
      });
      expect(statusOn(change.periods, TODAY)).toBe('normal');
      expect(statusOn(change.periods, '2026-10-20')).toBe('normal');
    });

    it('ends the others when a new status is set, so none comes back after it', () => {
      const change = changeStatus(overlapping, 'away', TODAY, '2026-10-10');
      expect(change.periods).toEqual([
        { kind: 'flare', from: '2026-10-01', to: '2026-10-07' },
        { kind: 'unwell', from: '2026-10-03', to: '2026-10-07' },
        { kind: 'away', from: TODAY, to: '2026-10-10' },
      ]);
      expect(statusOn(change.periods, '2026-10-11')).toBe('normal');
    });

    it('keeps the status in force but ends any other covering today', () => {
      expect(changeStatus(overlapping, 'unwell', TODAY)).toEqual({
        periods: [{ kind: 'flare', from: '2026-10-01', to: '2026-10-07' }, { kind: 'unwell', from: '2026-10-03' }],
        changed: true,
      });
    });

    it('removes one that began today, and leaves alone those not covering today', () => {
      const periods: StatusPeriod[] = [
        { kind: 'away', from: '2026-09-01', to: '2026-09-05' },
        { kind: 'flare', from: '2026-10-01' },
        { kind: 'unwell', from: TODAY },
        { kind: 'away', from: '2026-11-01', to: '2026-11-03' },
      ];
      expect(changeStatus(periods, 'normal', TODAY).periods).toEqual([
        { kind: 'away', from: '2026-09-01', to: '2026-09-05' },
        { kind: 'flare', from: '2026-10-01', to: '2026-10-07' },
        { kind: 'away', from: '2026-11-01', to: '2026-11-03' },
      ]);
    });
  });
});

describe('endedRun: what the plan offer is about', () => {
  it('is nothing while a status is in force today', () => {
    expect(endedRun([{ kind: 'away', from: '2026-10-05' }], TODAY)).toBeUndefined();
    expect(endedRun([{ kind: 'away', from: '2026-10-05', to: TODAY }], TODAY)).toBeUndefined();
    expect(endedRun([], TODAY)).toBeUndefined();
    expect(endedRun(undefined, TODAY)).toBeUndefined();
  });

  it('is a period whose end date has passed, with no return by hand', () => {
    const away: StatusPeriod = { kind: 'away', from: '2026-10-01', to: '2026-10-04' };
    expect(endedRun([away], TODAY)).toEqual([away]);
  });

  it('is the period a return to Normal just ended', () => {
    const back = changeStatus([{ kind: 'flare', from: '2026-10-05' }], 'normal', TODAY).periods;
    expect(endedRun(back, TODAY)).toEqual([{ kind: 'flare', from: '2026-10-05', to: '2026-10-07' }]);
  });

  it('takes a switched run as one absence', () => {
    const switched = changeStatus([{ kind: 'flare', from: '2026-10-01' }], 'unwell', '2026-10-04').periods;
    const back = changeStatus(switched, 'normal', TODAY).periods;
    expect(endedRun(back, TODAY)).toEqual([
      { kind: 'flare', from: '2026-10-01', to: '2026-10-03' },
      { kind: 'unwell', from: '2026-10-04', to: '2026-10-07' },
    ]);
  });

  it('does not join a run across a normal day, and offers only the latest', () => {
    const periods: StatusPeriod[] = [
      { kind: 'away', from: '2026-09-28', to: '2026-10-02' },
      { kind: 'unwell', from: '2026-10-04', to: '2026-10-07' },
    ];
    expect(endedRun(periods, TODAY)).toEqual([periods[1]]);
  });

  it('is nothing once the latest run is answered', () => {
    expect(endedRun([{ kind: 'away', from: '2026-10-01', to: '2026-10-07', planShift: 'kept' }], TODAY)).toBeUndefined();
    expect(endedRun([{ kind: 'away', from: '2026-10-01', to: '2026-10-07', planShift: 'moved' }], TODAY)).toBeUndefined();
  });

  it('stops at an answered period, so a status set again on the day of coming back counts only the new days', () => {
    // Unwell to 7 October, back and answered on the 8th, unwell again that same day, back on the 10th.
    let periods: StatusPeriod[] = changeStatus([{ kind: 'unwell', from: '2026-10-01' }], 'normal', TODAY).periods;
    periods = answerShift(periods, endedRun(periods, TODAY) ?? [], 'moved');
    periods = changeStatus(periods, 'unwell', TODAY).periods;
    periods = changeStatus(periods, 'normal', '2026-10-10').periods;
    expect(endedRun(periods, '2026-10-10')).toEqual([{ kind: 'unwell', from: TODAY, to: '2026-10-09' }]);
  });

  it('offers nothing again when a status is set and cleared on the day an offer was answered', () => {
    let periods: StatusPeriod[] = answerShift([{ kind: 'away', from: '2026-10-01', to: '2026-10-07' }], [{ kind: 'away', from: '2026-10-01', to: '2026-10-07' }], 'kept');
    periods = changeStatus(periods, 'flare', TODAY).periods;
    periods = changeStatus(periods, 'normal', TODAY).periods;
    expect(endedRun(periods, TODAY)).toBeUndefined();
  });

  it('still offers an unanswered run after a status set and cleared on the same day', () => {
    const away: StatusPeriod = { kind: 'away', from: '2026-10-01', to: '2026-10-07' };
    const set = changeStatus([away], 'unwell', TODAY).periods;
    expect(endedRun(set, TODAY)).toBeUndefined();
    expect(endedRun(changeStatus(set, 'normal', TODAY).periods, TODAY)).toEqual([away]);
  });

  it('takes in an unanswered run that a new status continued without a break', () => {
    // Back on the 8th but the offer left open, then a flare-up from the 8th to the 11th.
    const periods: StatusPeriod[] = [
      { kind: 'unwell', from: '2026-10-01', to: '2026-10-07' },
      { kind: 'flare', from: TODAY, to: '2026-10-11' },
    ];
    expect(endedRun(periods, '2026-10-12')).toEqual(periods);
  });

  it('ignores entries it cannot read', () => {
    const odd = { kind: 'holiday', from: '2026-10-01', to: '2026-10-07' } as unknown as StatusPeriod;
    expect(endedRun([odd], TODAY)).toBeUndefined();
  });

  it('takes overlapping periods into one run, and offers it once', () => {
    // What returning to Normal leaves of codex F25's imported pair.
    const periods: StatusPeriod[] = [{ kind: 'unwell', from: '2026-10-03', to: '2026-10-07' }, { kind: 'flare', from: '2026-10-01', to: '2026-10-07' }];
    const run = endedRun(periods, TODAY);
    expect(run).toEqual([periods[1], periods[0]]);
    expect(planOffer(periods, '2026-09-24', TODAY)?.days).toBe(7);
    expect(planOffer(answerShift(periods, run ?? [], 'moved'), '2026-09-24', TODAY)).toBeUndefined();
  });

  it('takes in a run of three periods back to back, whatever order they are stored in', () => {
    const periods: StatusPeriod[] = [
      { kind: 'away', from: '2026-09-20', to: '2026-09-25' },
      { kind: 'flare', from: '2026-09-26', to: '2026-10-02' },
      { kind: 'unwell', from: '2026-10-03', to: '2026-10-07' },
    ];
    expect(endedRun(periods, TODAY)).toEqual(periods);
    expect(endedRun([...periods].reverse(), TODAY)).toEqual(periods);
  });

  it('takes in a period nested inside another, and one that overlaps the start of the run', () => {
    const periods: StatusPeriod[] = [
      { kind: 'away', from: '2026-09-20', to: '2026-10-02' },
      { kind: 'flare', from: '2026-10-03', to: '2026-10-07' },
      { kind: 'unwell', from: '2026-10-04', to: '2026-10-05' },
      { kind: 'away', from: '2026-09-01', to: '2026-09-10' },
    ];
    expect(endedRun(periods, TODAY)).toEqual([periods[0], periods[1], periods[2]]);
    expect(planOffer(periods, '2026-09-24', TODAY)?.days).toBe(14);
  });
});

describe('pausedDays: the N in "Move your plan back N days?"', () => {
  const start = '2026-09-07';

  it('counts every calendar day of the run, rest days included', () => {
    // Away Thursday 1 to Sunday 11, back on Monday 12.
    const run: StatusPeriod[] = [{ kind: 'away', from: '2026-10-01', to: '2026-10-11' }];
    expect(pausedDays(run, start, '2026-10-12')).toEqual(daysFrom('2026-10-01', '2026-10-11'));
  });

  it('counts both halves of a switched run, each day once', () => {
    const run: StatusPeriod[] = [
      { kind: 'flare', from: '2026-10-01', to: '2026-10-03' },
      { kind: 'unwell', from: '2026-10-03', to: '2026-10-07' },
    ];
    expect(pausedDays(run, start, TODAY)).toHaveLength(7);
  });

  it('does not count days before the programme started', () => {
    const run: StatusPeriod[] = [{ kind: 'unwell', from: '2026-09-01', to: '2026-09-09' }];
    expect(pausedDays(run, start, TODAY)).toEqual(['2026-09-07', '2026-09-08', '2026-09-09']);
    expect(pausedDays([{ kind: 'unwell', from: '2026-09-01', to: '2026-09-06' }], start, TODAY)).toEqual([]);
  });

  it('never counts today or later, even for a period with no end', () => {
    expect(pausedDays([{ kind: 'away', from: '2026-10-06' }], start, TODAY)).toEqual(['2026-10-06', '2026-10-07']);
    expect(pausedDays([{ kind: 'away', from: '2026-10-06', to: '2026-10-20' }], start, TODAY)).toEqual(['2026-10-06', '2026-10-07']);
  });

  it('gives back a pause that ran past the end of the twelve weeks, but not one that began after them', () => {
    // Day 84 from the start is the first day after week 12.
    const end = shiftDay(start, 84);
    expect(end).toBe('2026-11-30');
    const straddle: StatusPeriod[] = [{ kind: 'away', from: '2026-11-28', to: '2026-12-03' }];
    expect(pausedDays(straddle, start, '2026-12-04')).toHaveLength(6);
    expect(pausedDays([{ kind: 'away', from: end, to: '2026-12-03' }], start, '2026-12-04')).toEqual([]);
  });

  it('has nothing to move without a programme, or for entries it cannot read', () => {
    const run: StatusPeriod[] = [{ kind: 'away', from: '2026-10-01', to: '2026-10-07' }];
    expect(pausedDays(run, '', TODAY)).toEqual([]);
    expect(pausedDays([{ kind: 'away', from: 'soon' } as StatusPeriod], start, TODAY)).toEqual([]);
  });
});

describe('planOffer and answerShift', () => {
  it('matches the acceptance case: away from 5 October, back on the 8th, three days', () => {
    // codex-acceptance J07 steps 5 and 6, start date 24 September.
    const periods = changeStatus(changeStatus([], 'away', '2026-10-05').periods, 'normal', TODAY).periods;
    expect(periods).toEqual([{ kind: 'away', from: '2026-10-05', to: '2026-10-07' }]);
    const offer = planOffer(periods, '2026-09-24', TODAY);
    expect(offer).toEqual({ run: periods, days: 3 });
    expect(shiftStartDate('2026-09-24', offer?.days ?? 0)).toBe('2026-09-27');
  });

  it('is nothing without a programme, or when the run paused none of it', () => {
    const periods: StatusPeriod[] = [{ kind: 'away', from: '2026-10-05', to: '2026-10-07' }];
    expect(planOffer(periods, '', TODAY)).toBeUndefined();
    expect(planOffer(periods, TODAY, TODAY)).toBeUndefined();
    expect(planOffer([{ kind: 'away', from: '2026-10-05' }], '2026-09-24', TODAY)).toBeUndefined();
  });

  it('is asked once: either answer is recorded on every period of the run', () => {
    const periods: StatusPeriod[] = [
      { kind: 'away', from: '2026-09-01', to: '2026-09-03' },
      { kind: 'flare', from: '2026-10-01', to: '2026-10-03' },
      { kind: 'unwell', from: '2026-10-04', to: '2026-10-07' },
    ];
    const offer = planOffer(periods, '2026-09-24', TODAY);
    expect(offer?.days).toBe(7);
    for (const answer of ['moved', 'kept'] as const) {
      const answered = answerShift(periods, offer?.run ?? [], answer);
      expect(answered).toEqual([periods[0], { ...periods[1], planShift: answer }, { ...periods[2], planShift: answer }]);
      expect(planOffer(answered, '2026-09-24', TODAY)).toBeUndefined();
    }
  });

  it('matches periods read again from the store, and leaves what it cannot read alone', () => {
    const odd = { kind: 'holiday', from: '2026-10-05', to: '2026-10-07' } as unknown as StatusPeriod;
    const stored: StatusPeriod[] = [{ kind: 'away', from: '2026-10-05', to: '2026-10-07' }, odd];
    const run = structuredClone([stored[0]]);
    expect(answerShift(stored, run, 'kept')).toEqual([{ ...stored[0], planShift: 'kept' }, odd]);
    expect(answerShift(undefined, run, 'kept')).toEqual([]);
  });
});

describe('shiftStartDate', () => {
  it('moves the start later, which puts the person earlier in the programme', () => {
    expect(shiftStartDate('2026-09-07', 4)).toBe('2026-09-11');
    expect(shiftStartDate('2026-09-28', 5)).toBe('2026-10-03');
    expect(shiftStartDate('2026-09-07', 0)).toBe('2026-09-07');
  });

  it('refuses anything but whole days forward', () => {
    expect(() => shiftStartDate('2026-09-07', -1)).toThrow(RangeError);
    expect(() => shiftStartDate('2026-09-07', 1.5)).toThrow(RangeError);
    expect(() => shiftStartDate('', 1)).toThrow(RangeError);
  });
});
