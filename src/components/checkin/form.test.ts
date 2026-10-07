import { describe, expect, it } from 'vitest';
import { createDefaultProfile } from '@/profile/defaults';
import { evaluateCheckIn, glucoseSanity } from '@/engine/readiness';
import type { DailyCheckIn } from '@/types/checkin';
import { initialBp, submitBlocked, submitsGlucose } from './form';

const base: DailyCheckIn = { date: '2026-10-09', urgentSymptoms: false, news: [], sleep: 'gt7', energy: 4 };

describe('check-in form', () => {
  it('sends an ambiguous low to the engine, which stops the session', () => {
    const profile = createDefaultProfile({ health: { diabetes: 'type1', insulin: 'mdi', glucoseMonitor: 'meter', glucoseUnit: 'mg/dL' } as never });
    const sanity = glucoseSanity(5.5, 'mg/dL');
    expect(sanity).toBe('ambiguousLow');
    expect(submitsGlucose(sanity)).toBe(true);
    const c: DailyCheckIn = { ...base, glucose: { value: 5.5, unit: 'mg/dL' } };
    expect(evaluateCheckIn(profile, c, []).outcome).toBe('red');
  });

  it('never sends an implausible reading or one in the wrong unit', () => {
    expect(submitsGlucose('implausible')).toBe(false);
    expect(submitsGlucose('suspectUnit')).toBe(false);
  });

  it('keeps the saved blood pressure when a check-in is edited', () => {
    const profile = createDefaultProfile({ health: { bpMonitor: true, hypertension: 'treated' } as never });
    const saved = { sys: 190, dia: 80 };
    const red = evaluateCheckIn(profile, { ...base, bp: saved }, []).outcome;
    const bp = initialBp(saved);
    expect(bp).toEqual({ s1: '190', d1: '80', s2: '', d2: '' });
    // Re-submitting untouched gives back the same average, so the outcome holds.
    const again = { sys: Number(bp.s1), dia: Number(bp.d1) };
    expect(evaluateCheckIn(profile, { ...base, bp: again }, []).outcome).toBe(red);
    expect(initialBp(undefined)).toEqual({ s1: '', d1: '', s2: '', d2: '' });
  });
});

describe('check-in submit', () => {
  it('needs a new glucose reading after a treat-and-recheck outcome', () => {
    expect(submitBlocked({ sanity: 'ok', needsReading: true, hasReading: false })).toMatch(/new glucose reading/);
    expect(submitBlocked({ sanity: 'ok', needsReading: true, hasReading: true })).toBeNull();
    expect(submitBlocked({ sanity: 'ok', needsReading: false, hasReading: false })).toBeNull();
    expect(submitBlocked({ sanity: 'implausible', needsReading: false, hasReading: true })).not.toBeNull();
  });
});
