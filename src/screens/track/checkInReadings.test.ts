/**
 * What correcting or deleting one of a check-in's readings does to the
 * record every gate reads (code review C2-01): the record transforms behind
 * `correctCheckInGlucose`, `correctCheckInPain` and `removeCheckInReading`.
 */

import { describe, expect, it } from 'vitest';
import type { DailyCheckIn } from '@/types/checkin';
import { withGlucoseCorrected, withPainCorrected, withPressureCorrected, withReadingRemoved } from '@/components/checkin/pending';

const at = (h: number, m = 0) => new Date(2026, 9, 8, h, m, 0).toISOString();
const BASE: DailyCheckIn = { date: '2026-10-08', urgentSymptoms: false, emergency: [], news: [] };
const g = (value: number, h: number, m = 0, extra = {}) => ({ value, unit: 'mg/dL' as const, measuredAt: at(h, m), source: 'meter' as const, ...extra });

describe('withGlucoseCorrected', () => {
  const day: DailyCheckIn = { ...BASE, glucoseEarlier: [g(60, 8, 0), { display: 'HI', measuredAt: at(8, 10) }], glucose: g(146, 8, 55) };

  it('corrects the latest reading in place, found by its time and number', () => {
    expect(withGlucoseCorrected(day, { at: at(8, 55), was: { value: 146, unit: 'mg/dL' }, to: { value: 46, unit: 'mg/dL' } }))
      .toEqual({ ...day, glucose: g(46, 8, 55) });
  });

  it('corrects an earlier reading where it is, and never a HI or LO shown at that time', () => {
    const fixed = withGlucoseCorrected(day, { at: at(8, 0), was: { value: 60, unit: 'mg/dL' }, to: { value: 6, unit: 'mmol/L' } });
    expect(fixed?.glucoseEarlier).toEqual([{ ...g(6, 8, 0), unit: 'mmol/L' }, { display: 'HI', measuredAt: at(8, 10) }]);
    expect(fixed?.glucose).toEqual(day.glucose);
    expect(withGlucoseCorrected(day, { at: at(8, 10), was: { value: 1, unit: 'mg/dL' }, to: { value: 5, unit: 'mg/dL' } })).toBeUndefined();
  });

  it('finds an untimed reading by its number, and one corrected on its own before by its time alone', () => {
    const untimed: DailyCheckIn = { ...BASE, glucose: { value: 146, unit: 'mg/dL' } };
    expect(withGlucoseCorrected(untimed, { at: at(9, 3), was: { value: 146, unit: 'mg/dL' }, to: { value: 46, unit: 'mg/dL' } })?.glucose)
      .toEqual({ value: 46, unit: 'mg/dL' });
    expect(withGlucoseCorrected(day, { at: at(8, 55), was: { value: 150, unit: 'mg/dL' }, to: { value: 46, unit: 'mg/dL' } })?.glucose?.value).toBe(46);
    expect(withGlucoseCorrected(day, { at: at(7, 0), was: { value: 150, unit: 'mg/dL' }, to: { value: 46, unit: 'mg/dL' } })).toBeUndefined();
  });

  it('drops a unit confirmed for the old number', () => {
    const confirmed: DailyCheckIn = { ...BASE, glucose: g(30, 8, 55, { unitConfirmed: true }) };
    expect(withGlucoseCorrected(confirmed, { at: at(8, 55), was: { value: 30, unit: 'mg/dL' }, to: { value: 300, unit: 'mg/dL' } })?.glucose)
      .toEqual(g(300, 8, 55));
  });

  it('keeps one reading when the corrected number is there already beside the old (a retry after a refused write)', () => {
    const merged: DailyCheckIn = { ...BASE, glucose: g(46, 8, 55), glucoseEarlier: [g(146, 8, 55)] };
    expect(withGlucoseCorrected(merged, { at: at(8, 55), was: { value: 146, unit: 'mg/dL' }, to: { value: 46, unit: 'mg/dL' } }))
      .toEqual({ ...BASE, glucose: g(46, 8, 55) });
    const other: DailyCheckIn = { ...BASE, glucose: g(146, 8, 55), glucoseEarlier: [g(46, 8, 55)] };
    expect(withGlucoseCorrected(other, { at: at(8, 55), was: { value: 146, unit: 'mg/dL' }, to: { value: 46, unit: 'mg/dL' } }))
      .toEqual({ ...BASE, glucose: g(46, 8, 55) });
  });
});

describe('withPressureCorrected, tried again', () => {
  it('keeps one reading when the corrected numbers are there already beside the old', () => {
    const merged: DailyCheckIn = { ...BASE, bpReadings: [{ sys: 190, dia: 80, at: at(8, 56) }], bpEarlier: [{ sys: 130, dia: 80, at: at(8, 56) }], bp: { sys: 190, dia: 80 } };
    expect(withPressureCorrected(merged, { at: at(8, 56), was: { sys: 130, dia: 80 }, to: { sys: 190, dia: 80 } }))
      .toEqual({ ...BASE, bpReadings: [{ sys: 190, dia: 80, at: at(8, 56) }], bp: { sys: 190, dia: 80 } });
    const other: DailyCheckIn = { ...BASE, bpReadings: [{ sys: 130, dia: 80, at: at(8, 56) }], bpEarlier: [{ sys: 190, dia: 80, at: at(8, 56) }], bp: { sys: 130, dia: 80 } };
    expect(withPressureCorrected(other, { at: at(8, 56), was: { sys: 130, dia: 80 }, to: { sys: 190, dia: 80 } }))
      .toEqual({ ...BASE, bpReadings: [{ sys: 190, dia: 80, at: at(8, 56) }], bp: { sys: 190, dia: 80 } });
  });
});

describe('withPainCorrected', () => {
  it('corrects the score the record holds, and nothing else', () => {
    const day: DailyCheckIn = { ...BASE, back: { pain: 2, legPain: 1, reach: 'thigh' } };
    expect(withPainCorrected(day, { kind: 'backPain', was: 2, to: 8 })?.back).toEqual({ pain: 8, legPain: 1, reach: 'thigh' });
    expect(withPainCorrected(day, { kind: 'legPain', was: 1, to: 0 })?.back).toEqual({ pain: 2, legPain: 0, reach: 'thigh' });
    // An older score of the day, replaced since: not the record's to correct.
    expect(withPainCorrected(day, { kind: 'backPain', was: 5, to: 8 })).toBeUndefined();
  });
});

describe('withReadingRemoved', () => {
  it('makes the reading before a deleted latest one the latest again', () => {
    const day: DailyCheckIn = { ...BASE, glucoseEarlier: [g(60, 8, 0), g(90, 8, 20)], glucose: g(146, 8, 55) };
    expect(withReadingRemoved(day, { kind: 'glucose', at: at(8, 55), value: 146, unit: 'mg/dL' }))
      .toEqual({ ...BASE, glucoseEarlier: [g(60, 8, 0)], glucose: g(90, 8, 20) });
    const lastBefore: DailyCheckIn = { ...BASE, glucoseEarlier: [{ display: 'LO', measuredAt: at(8, 0) }], glucose: g(146, 8, 55) };
    expect(withReadingRemoved(lastBefore, { kind: 'glucose', at: at(8, 55), value: 146, unit: 'mg/dL' }))
      .toEqual({ ...BASE, glucoseDisplay: { display: 'LO', measuredAt: at(8, 0) } });
  });

  it('leaves a HI or LO shown after it as the latest, and takes an earlier one out where it is', () => {
    const shown: DailyCheckIn = { ...BASE, glucoseEarlier: [g(60, 8, 0)], glucose: g(146, 8, 55), glucoseDisplay: { display: 'HI', measuredAt: at(9, 0) } };
    expect(withReadingRemoved(shown, { kind: 'glucose', at: at(8, 55), value: 146, unit: 'mg/dL' }))
      .toEqual({ ...BASE, glucoseEarlier: [g(60, 8, 0)], glucoseDisplay: { display: 'HI', measuredAt: at(9, 0) } });
    expect(withReadingRemoved(shown, { kind: 'glucose', at: at(8, 0), value: 60, unit: 'mg/dL' }))
      .toEqual({ ...BASE, glucose: g(146, 8, 55), glucoseDisplay: { display: 'HI', measuredAt: at(9, 0) } });
    expect(withReadingRemoved(shown, { kind: 'glucose', at: at(7, 0), value: 61, unit: 'mg/dL' })).toBeUndefined();
  });

  it('takes a blood-pressure reading out of the current ones and works the average out again', () => {
    const day: DailyCheckIn = { ...BASE, bpReadings: [{ sys: 210, dia: 125, at: at(8, 50) }, { sys: 150, dia: 95, at: at(8, 52) }], bp: { sys: 180, dia: 110 }, bpEarlier: [{ sys: 140, dia: 90, at: at(7, 0) }] };
    expect(withReadingRemoved(day, { kind: 'pressure', at: at(8, 50), sys: 210, dia: 125 }))
      .toEqual({ ...BASE, bpReadings: [{ sys: 150, dia: 95, at: at(8, 52) }], bp: { sys: 150, dia: 95 }, bpEarlier: [{ sys: 140, dia: 90, at: at(7, 0) }] });
    expect(withReadingRemoved(day, { kind: 'pressure', at: at(7, 0), sys: 140, dia: 90 }))
      .toEqual({ ...BASE, bpReadings: day.bpReadings, bp: day.bp });
    const one: DailyCheckIn = { ...BASE, bpReadings: [{ sys: 210, dia: 125, at: at(8, 50) }], bp: { sys: 210, dia: 125 } };
    expect(withReadingRemoved(one, { kind: 'pressure', at: at(8, 50), sys: 210, dia: 125 })).toEqual(BASE);
    expect(withReadingRemoved({ ...BASE, bp: { sys: 210, dia: 125 } }, { kind: 'pressure', sys: 210, dia: 125 })).toEqual(BASE);
    expect(withReadingRemoved(one, { kind: 'pressure', at: at(6, 0), sys: 120, dia: 80 })).toBeUndefined();
  });

  it('takes a pain score out, and the back answers with it when nothing else was said', () => {
    expect(withReadingRemoved({ ...BASE, back: { pain: 2, legPain: 1 } }, { kind: 'legPain', value: 1 })).toEqual({ ...BASE, back: { pain: 2 } });
    expect(withReadingRemoved({ ...BASE, back: { pain: 2 } }, { kind: 'backPain', value: 2 })).toEqual(BASE);
    expect(withReadingRemoved({ ...BASE, back: { pain: 2 } }, { kind: 'backPain', value: 3 })).toBeUndefined();
  });
});
