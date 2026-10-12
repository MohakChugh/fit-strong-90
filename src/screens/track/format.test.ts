import { describe, expect, it } from 'vitest';
import type { Observation } from '@/health/observation';
import {
  DEFAULT_PREFS, formatClock, formatDayLong, formatDayRelative, formatDayShort, formatDuration, formatObservation,
  formatValue, hasClockTime, sourceLabel,
} from './format';

const now = '2026-10-08';

function obs(over: Partial<Observation>): Observation {
  return {
    id: 'o1', kind: 'glucose', at: '2026-10-08T07:42:10.000+05:30', day: '2026-10-08',
    value: 112, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', ...over,
  };
}

describe('time is the record’s own wall clock', () => {
  it('reads HH:mm from the instant as written, in either clock style', () => {
    expect(formatClock('2026-10-08T07:42:10.000+05:30', false)).toBe('07:42');
    expect(formatClock('2026-10-08T07:42:10.000+05:30', true)).toBe('7:42 am');
    expect(formatClock('2026-10-08T00:05:00.000+05:30', true)).toBe('12:05 am');
    expect(formatClock('2026-10-08T12:30:00.000+05:30', true)).toBe('12:30 pm');
    expect(formatClock('2026-10-08T23:59:00.000-04:00', false)).toBe('23:59');
  });

  it('knows a stand-in midday time from a real one', () => {
    expect(hasClockTime(obs({ context: 'checkIn:2026-10-08', at: '2026-10-08T12:00:00.000+05:30' }))).toBe(false);
    expect(hasClockTime(obs({ context: 'bp:checkIn:2026-10-08', at: '2026-10-08T12:00:00.000+05:30' }))).toBe(false);
    expect(hasClockTime(obs({ context: 'bodyMetric:2026-10-08', at: '2026-10-08T12:00:00.000+05:30' }))).toBe(false);
    expect(hasClockTime(obs({ context: 'session:abc', at: '2026-10-08T12:00:00.000+05:30' }))).toBe(false);
    // A real noon reading keeps its time; so does a session record with a real time.
    expect(hasClockTime(obs({ at: '2026-10-08T12:00:00.000+05:30' }))).toBe(true);
    expect(hasClockTime(obs({ context: 'session:abc', at: '2026-10-08T07:12:31.000+05:30' }))).toBe(true);
    // Lab results are dated, never timed.
    expect(hasClockTime(obs({ kind: 'hba1c', unit: '%', value: 7 }))).toBe(false);
  });
});

describe('dates', () => {
  it('writes days in full, short and relative forms, with the year only when it differs', () => {
    expect(formatDayLong('2026-10-08', now)).toBe('Thursday, 8 October');
    expect(formatDayLong('2025-10-08', now)).toBe('Wednesday, 8 October 2025');
    expect(formatDayShort('2026-10-08', now)).toBe('8 Oct');
    expect(formatDayShort('2025-12-31', now)).toBe('31 Dec 2025');
    expect(formatDayRelative('2026-10-08', now)).toBe('Today');
    expect(formatDayRelative('2026-10-07', now)).toBe('Yesterday');
    expect(formatDayRelative('2026-10-05', now)).toBe('Monday, 5 October');
  });
});

describe('values', () => {
  it('shows a reading in the person’s unit, with its unit', () => {
    expect(formatObservation(obs({}), DEFAULT_PREFS)).toBe('112 mg/dL');
    expect(formatObservation(obs({}), { ...DEFAULT_PREFS, glucose: 'mmol/L' })).toBe('6.2 mmol/L');
    expect(formatObservation(obs({ kind: 'weight', value: 82.4, unit: 'kg' }), { ...DEFAULT_PREFS, mass: 'lb' })).toBe('181.7 lb');
    expect(formatObservation(obs({ kind: 'backPain', value: 4, unit: '0-10' }), DEFAULT_PREFS)).toBe('4 of 10');
    expect(formatObservation(obs({ kind: 'steps', value: 12480, unit: 'steps', scope: 'dayTotal' }), DEFAULT_PREFS)).toBe('12,480 steps');
    expect(formatObservation(obs({ kind: 'hba1c', value: 7.2, unit: '%' }), DEFAULT_PREFS)).toBe('7.2%');
    expect(formatObservation(obs({ kind: 'hba1c', value: 7.2, unit: '%' }), { ...DEFAULT_PREFS, hba1c: 'mmol/mol' })).toBe('55 mmol/mol');
    expect(formatObservation(obs({ kind: 'sleep', value: 7.5, unit: 'h', scope: 'dayTotal' }), DEFAULT_PREFS)).toBe('7.5 h');
  });

  it('never rounds a shown value across a threshold it is judged against (acceptance J06)', () => {
    expect(formatObservation(obs({ value: 53.9 }), DEFAULT_PREFS)).toBe('53.9 mg/dL');
    expect(formatObservation(obs({ value: 54 }), DEFAULT_PREFS)).toBe('54 mg/dL');
    expect(formatObservation(obs({ value: 69.6 }), DEFAULT_PREFS)).toBe('69.6 mg/dL');
    expect(formatObservation(obs({ value: 79.6, tag: 'fasting' }), DEFAULT_PREFS)).toBe('79.6 mg/dL');
    // Converted for display: 69.9 mg/dL is under 70, so never "3.9 mmol/L", the first value at 70.
    expect(formatObservation(obs({ value: 69.9 }), { ...DEFAULT_PREFS, glucose: 'mmol/L' })).toBe('3.88 mmol/L');
    expect(formatObservation(obs({ kind: 'b12', value: 179.9, unit: 'pg/mL' }), DEFAULT_PREFS)).toBe('179.9 pg/mL');
    expect(formatObservation(obs({ kind: 'b12', value: 350.1, unit: 'pg/mL' }), DEFAULT_PREFS)).toBe('350.1 pg/mL');
    expect(formatObservation(obs({ kind: 'vitaminD', value: 11.96, unit: 'ng/mL' }), DEFAULT_PREFS)).toBe('11.96 ng/mL');
    expect(formatValue(53.9, 'glucose', 'mg/dL')).toBe('53.9 mg/dL');
  });

  it('keeps the usual reading precision when it crosses nothing', () => {
    expect(formatObservation(obs({ value: 112.4 }), DEFAULT_PREFS)).toBe('112 mg/dL');
    expect(formatObservation(obs({ kind: 'b12', value: 245.6, unit: 'pg/mL' }), DEFAULT_PREFS)).toBe('246 pg/mL');
  });

  it('formats durations for reading', () => {
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(3480)).toBe('58 min');
    expect(formatDuration(3900)).toBe('1 h 5 min');
    expect(formatDuration(7200)).toBe('2 h');
    expect(formatDuration(59.6)).toBe('1 min');
    expect(formatDuration(3599)).toBe('1 h');
  });
});

describe('sourceLabel', () => {
  it('says where every number came from', () => {
    expect(sourceLabel({ source: 'manual' })).toBe('Manual entry');
    expect(sourceLabel({ source: 'measured' })).toBe('Measured');
    expect(sourceLabel({ source: 'imported' })).toBe('Imported');
    expect(sourceLabel({ source: 'manual', context: 'checkIn:2026-10-08' })).toBe('From your check-in');
    expect(sourceLabel({ source: 'manual', context: 'bp:checkIn:2026-10-08' })).toBe('From your check-in');
    expect(sourceLabel({ source: 'manual', context: 'session:s1' })).toBe('After a session');
    expect(sourceLabel({ source: 'measured', context: 'walk:w1' })).toBe('Measured on a walk');
    expect(sourceLabel({ source: 'manual', context: 'walk:w1' })).toBe('Added to a walk');
  });
});

