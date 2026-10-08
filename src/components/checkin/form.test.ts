import { describe, expect, it } from 'vitest';
import { createDefaultProfile } from '@/profile/defaults';
import { evaluateCheckIn, glucoseSanity } from '@/engine/readiness';
import type { CheckInRecord, DailyCheckIn } from '@/types/checkin';
import type { UserProfile } from '@/types/profile';
import {
  buildCheckIn, carryForward, emptyForm, formFromRecord, initialBp, needsNewGlucose, saveOnEmergency, submitBlocked, submitsGlucose,
  visibleQuestions,
} from './form';

const DATE = '2026-10-09';
const NOW = new Date(2026, 9, 9, 9, 0, 0);
const at = (minutesBeforeNow: number) => new Date(NOW.getTime() - minutesBeforeNow * 60_000).toISOString();
const base: DailyCheckIn = { date: DATE, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4 };

const diabetic = createDefaultProfile({ health: { diabetes: 'type2', insulin: 'injections_or_pump', medicinesReviewed: true, glucoseMonitor: 'meter', bpMonitor: true } });
const backProfile = createDefaultProfile({ pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left' }, health: { bpMonitor: true } });
const plain = createDefaultProfile({ health: { bpMonitor: true } });
const record = (p: UserProfile, c: DailyCheckIn): CheckInRecord => ({ ...c, readiness: evaluateCheckIn(p, c) });
const build = (form: ReturnType<typeof emptyForm>, p: UserProfile, previous?: CheckInRecord) =>
  buildCheckIn(form, { date: DATE, profile: p, now: NOW, ...(previous ? { previous } : {}) });

describe('emergency answers come first', () => {
  it('never blocks saving an emergency answer, whatever the glucose box holds', () => {
    for (const [glucose, unit] of [['99', 'mmol/L'], ['abc', 'mg/dL'], ['0', 'mg/dL']] as const) {
      const form = { ...emptyForm(diabetic), emergency: ['chest' as const], glucose, unit };
      expect(submitBlocked(form, { profile: diabetic, now: NOW })).toBeNull();
      const c = build(form, diabetic);
      // The unusable reading is left out; the emergency is not held back for it.
      expect(c.glucose).toBeUndefined();
      expect(c.emergency).toEqual(['chest']);
      expect(c.urgentSymptoms).toBe(true);
    }
  });

  it('asks for an answer to the first question before anything else is saved', () => {
    expect(submitBlocked(emptyForm(plain), { profile: plain, now: NOW })).toMatch(/right now/i);
    expect(submitBlocked({ ...emptyForm(plain), emergency: [] }, { profile: plain, now: NOW })).toBeNull();
  });

  it('saves the moment an emergency item is ticked, not when the form is finished', () => {
    expect(saveOnEmergency(null, ['stroke'])).toBe(true);
    expect(saveOnEmergency([], ['stroke'])).toBe(true);
    expect(saveOnEmergency(['stroke'], ['stroke', 'chest'])).toBe(true);
    expect(saveOnEmergency(['stroke'], ['stroke'])).toBe(false);
    expect(saveOnEmergency(['stroke'], [])).toBe(false);
  });

  it('marks the cauda equina flag for older screens when a bladder or saddle item is ticked', () => {
    const c = build({ ...emptyForm(backProfile), emergency: ['saddle'] }, backProfile);
    expect(c.back?.caudaEquinaFlag).toBe(true);
    expect(evaluateCheckIn(backProfile, c).outcome).toBe('urgent');
  });
});

describe('saved answers survive a profile change', () => {
  it('keeps a saved back answer when the profile no longer asks about the back', () => {
    const saved = record(backProfile, { ...base, back: { pain: 0, newNeuro: false, caudaEquinaFlag: true, newWeakness: true } });
    const c = build(formFromRecord(saved), plain, saved);
    expect(c.back).toMatchObject({ caudaEquinaFlag: true, newWeakness: true });
    expect(evaluateCheckIn(plain, c).outcome).toBe('urgent');
  });

  it('keeps saved readings when the profile no longer asks for them', () => {
    const saved = record(diabetic, {
      ...base,
      glucose: { value: 52, unit: 'mg/dL', measuredAt: at(20) },
      ketones: { kind: 'blood', value: 1.8, measuredAt: at(20) },
      bpReadings: [{ sys: 190, dia: 80, at: at(20) }],
    });
    const noLonger = createDefaultProfile({ health: { diabetes: 'none', bpMonitor: false } });
    const c = build(formFromRecord(saved), noLonger, saved);
    expect(c.glucose).toEqual(saved.glucose);
    expect(c.ketones).toEqual(saved.ketones);
    expect(c.bpReadings).toEqual(saved.bpReadings);
  });

  it('keeps an emergency or news answer the profile would no longer show, so it stays visible and counts', () => {
    const saved = record(diabetic, { ...base, emergency: ['lowCantTreat'], news: ['lowSevere'] });
    const form = formFromRecord(saved);
    const v = visibleQuestions(plain, form, saved);
    expect(v.emergency).toContain('lowCantTreat');
    expect(v.news).toContain('lowSevere');
    expect(build(form, plain, saved).emergency).toEqual(['lowCantTreat']);
  });
});

describe('readings carry forward through "Change answers"', () => {
  it('does not duplicate a reading resubmitted unchanged', () => {
    const saved = record(diabetic, { ...base, glucose: { value: 140, unit: 'mg/dL', measuredAt: at(10) } });
    const c = build(formFromRecord(saved), diabetic, saved);
    expect(c.glucose).toEqual(saved.glucose);
    expect(c.glucoseEarlier ?? []).toEqual([]);
  });

  it('keeps the earlier reading when a new one replaces it, so a low is never erased', () => {
    const saved = record(diabetic, { ...base, glucose: { value: 50, unit: 'mg/dL', measuredAt: at(30) }, ketones: { kind: 'blood', value: 1.6, measuredAt: at(30) } });
    const c = build({ ...formFromRecord(saved), glucose: '115', glucoseAt: at(2), bloodKetones: '0.2' }, diabetic, saved);
    expect(c.glucose).toMatchObject({ value: 115, measuredAt: at(2) });
    expect(c.glucoseEarlier).toEqual([{ value: 50, unit: 'mg/dL', measuredAt: at(30) }]);
    expect(c.ketonesEarlier).toEqual([{ kind: 'blood', value: 1.6, measuredAt: at(30) }]);
    // Clearing a reading moves it to the earlier list too.
    const cleared = build({ ...formFromRecord(saved), glucose: '' }, diabetic, saved);
    expect(cleared.glucose).toBeUndefined();
    expect(cleared.glucoseEarlier?.[0]).toMatchObject({ value: 50 });
  });

  it('treats switching the unit on an ambiguous low as a correction, not a new reading', () => {
    const saved = record(diabetic, { ...base, glucose: { value: 5.5, unit: 'mg/dL', measuredAt: at(3) } });
    expect(glucoseSanity(5.5, 'mg/dL')).toBe('ambiguousLow');
    const c = build({ ...formFromRecord(saved), unit: 'mmol/L' }, diabetic, saved);
    expect(c.glucose).toEqual({ value: 5.5, unit: 'mmol/L', measuredAt: at(3) });
    expect(c.glucoseEarlier ?? []).toEqual([]);
  });

  it('keeps a replaced severe blood pressure reading for the rest of the day', () => {
    const saved = record(plain, { ...base, bpReadings: [{ sys: 188, dia: 84, at: at(30) }, { sys: 186, dia: 82, at: at(29) }] });
    const c = build({ ...formFromRecord(saved), bp: { s1: '132', d1: '82', s2: '130', d2: '80' } }, plain, saved);
    expect(c.bpReadings?.map(r => r.sys)).toEqual([132, 130]);
    expect(c.bpEarlier?.map(r => r.sys)).toEqual([188, 186]);
    expect(evaluateCheckIn(plain, c).outcome).toBe('red');
  });
});

describe('check-in form', () => {
  it('sends an ambiguous low to the engine, which stops the session', () => {
    const profile = createDefaultProfile({ health: { diabetes: 'type1', insulin: 'injections_or_pump', glucoseMonitor: 'meter', glucoseUnit: 'mg/dL' } });
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

  it('keeps both raw blood pressure readings with their average, and restores both on edit', () => {
    const c = build({ ...emptyForm(plain), emergency: [], bp: { s1: '150', d1: '85', s2: '146', d2: '84' } }, plain);
    expect(c.bpReadings?.map(r => [r.sys, r.dia])).toEqual([[150, 85], [146, 84]]);
    expect(c.bpReadings?.every(r => typeof r.at === 'string')).toBe(true);
    expect(c.bp).toEqual({ sys: 148, dia: 85 });
    expect(initialBp(c)).toMatchObject({ s1: '150', d1: '85', s2: '146', d2: '84' });
  });

  it('restores an older record’s single average as the first reading', () => {
    const saved = { sys: 190, dia: 80 };
    expect(initialBp({ ...base, bp: saved })).toMatchObject({ s1: '190', d1: '80', s2: '', d2: '' });
    expect(initialBp(undefined)).toMatchObject({ s1: '', d1: '', s2: '', d2: '' });
    // Re-submitting untouched gives back the same reading, so the outcome holds.
    const again = build({ ...emptyForm(plain), emergency: [], bp: initialBp({ ...base, bp: saved }) }, plain);
    expect(evaluateCheckIn(plain, again).outcome).toBe(evaluateCheckIn(plain, { ...base, bp: saved }).outcome);
  });

  it('refuses a half-entered blood pressure reading rather than silently dropping it', () => {
    const form = { ...emptyForm(plain), emergency: [], bp: { s1: '190', d1: '', s2: '', d2: '' } };
    expect(submitBlocked(form, { profile: plain, now: NOW })).toMatch(/both/i);
  });

  it('refuses a reading time that is still to come', () => {
    const form = { ...emptyForm(diabetic), emergency: [], glucose: '120', glucoseAt: at(-20) };
    expect(submitBlocked(form, { profile: diabetic, now: NOW })).toMatch(/later than now/i);
  });
});

describe('check-in submit', () => {
  it('needs a new glucose reading after a treat-and-recheck outcome', () => {
    const saved = record(diabetic, { ...base, glucose: { value: 64, unit: 'mg/dL', measuredAt: at(16) } });
    expect(saved.readiness.recheckMinutes).toBe(15);
    const same = formFromRecord(saved);
    expect(submitBlocked(same, { profile: diabetic, previous: saved, now: NOW })).toMatch(/new glucose reading/);
    expect(submitBlocked({ ...same, glucose: '96', glucoseAt: at(1) }, { profile: diabetic, previous: saved, now: NOW })).toBeNull();
  });
});

describe('which questions are shown', () => {
  it('asks only what the profile needs, and ketones when the profile carries ketone risk or glucose is high', () => {
    expect(visibleQuestions(plain, emptyForm(plain)).glucose).toBe(false);
    expect(visibleQuestions(diabetic, emptyForm(diabetic)).glucose).toBe(true);
    expect(visibleQuestions(diabetic, emptyForm(diabetic)).ketones).toBeNull();
    expect(visibleQuestions(diabetic, { ...emptyForm(diabetic), glucose: '260' }).ketones).toBe('blood');
    const sglt2 = createDefaultProfile({ health: { diabetes: 'type2', sglt2i: true, ketoneTest: 'urine' } });
    expect(visibleQuestions(sglt2, emptyForm(sglt2)).ketones).toBe('urine');
    expect(visibleQuestions(plain, emptyForm(plain)).back).toBe(false);
    expect(visibleQuestions(backProfile, emptyForm(backProfile)).back).toBe(true);
  });

  it('asks about acute symptoms only with a severe blood pressure reading', () => {
    expect(visibleQuestions(plain, { ...emptyForm(plain), bp: { s1: '150', d1: '85', s2: '', d2: '' } }).bpSymptoms).toBe(false);
    expect(visibleQuestions(plain, { ...emptyForm(plain), bp: { s1: '150', d1: '120', s2: '', d2: '' } }).bpSymptoms).toBe(true);
  });

  it('asks whether a treated low has passed only after a low today', () => {
    const saved = record(diabetic, { ...base, glucose: { value: 64, unit: 'mg/dL', measuredAt: at(16) } });
    expect(visibleQuestions(diabetic, { ...formFromRecord(saved), glucose: '98' }, saved).lowRecovered).toBe(true);
    expect(visibleQuestions(diabetic, { ...emptyForm(diabetic), glucose: '98' }).lowRecovered).toBe(false);
  });
});

describe('the save keeps every reading the day already holds', () => {
  const saved: DailyCheckIn = {
    ...base,
    glucose: { value: 52, unit: 'mg/dL', measuredAt: at(30) },
    ketones: { kind: 'blood', value: 0.9, measuredAt: at(30) },
    bpReadings: [{ sys: 184, dia: 82, at: at(30) }],
  };

  it('moves a reading the new answers dropped into the earlier lists, whoever built them', () => {
    const next: DailyCheckIn = { ...base, glucose: { value: 110, unit: 'mg/dL', measuredAt: at(1) } };
    const merged = carryForward(saved, next);
    expect(merged.glucose).toEqual(next.glucose);
    expect(merged.glucoseEarlier).toEqual([saved.glucose]);
    expect(merged.ketonesEarlier).toEqual([saved.ketones]);
    expect(merged.bpEarlier).toEqual(saved.bpReadings);
    expect(evaluateCheckIn(diabetic, merged).disposition).toBe('today');
  });

  it('changes nothing twice, and nothing across days', () => {
    const next: DailyCheckIn = { ...base, glucose: { value: 110, unit: 'mg/dL', measuredAt: at(1) } };
    const once = carryForward(saved, next);
    expect(carryForward(saved, once)).toEqual(once);
    expect(carryForward({ ...saved, date: '2026-10-08' }, next)).toEqual(next);
    expect(carryForward(undefined, next)).toEqual(next);
  });

  it('keeps the unit correction of an ambiguous low as one reading', () => {
    const typo: DailyCheckIn = { ...base, glucose: { value: 5.5, unit: 'mg/dL', measuredAt: at(3) } };
    const fixed: DailyCheckIn = { ...base, glucose: { value: 5.5, unit: 'mmol/L', measuredAt: at(3) } };
    expect(carryForward(typo, fixed).glucoseEarlier).toBeUndefined();
  });
});

describe('reopening for a re-check', () => {
  it('clears the old number only when a new reading is what is needed', () => {
    const low = record(diabetic, { ...base, glucose: { value: 64, unit: 'mg/dL', measuredAt: at(16) } });
    expect(needsNewGlucose(low, true, [], [])).toBe(true);
    expect(needsNewGlucose(low, false, [], [])).toBe(false);
    const fine = record(diabetic, { ...base, glucose: { value: 140, unit: 'mg/dL', measuredAt: at(90) } });
    expect(needsNewGlucose(fine, true, ['Stale: check again.'], ['Stale'])).toBe(true);
    expect(needsNewGlucose(fine, true, ['Something else.'], ['Stale'])).toBe(false);
  });
});

describe('scan C2-06: clearing one blood-pressure reading leaves the other as it was', () => {
  it('reading 2 keeps its own time and is recorded once when reading 1 is cleared', () => {
    const saved = record(plain, { ...base, bpReadings: [{ sys: 150, dia: 95, at: at(60) }, { sys: 182, dia: 100, at: at(58) }] });
    const form = formFromRecord(saved, plain);
    // Clearing a row stamps that row; the other is untouched.
    const cleared = { ...form, bp: { ...form.bp, s1: '', d1: '', at1: at(30) } };
    const next = carryForward(saved, build(cleared, plain, saved));
    expect(next.bpReadings).toEqual([{ sys: 182, dia: 100, at: at(58) }]);
    expect(next.bpEarlier).toEqual([{ sys: 150, dia: 95, at: at(60) }]);
    const all = [...(next.bpReadings ?? []), ...(next.bpEarlier ?? [])];
    expect(all.filter(r => r.sys === 182 && r.dia === 100)).toHaveLength(1);
  });

  it('the same for reading 2 cleared, and a changed reading is still a new one', () => {
    const saved = record(plain, { ...base, bpReadings: [{ sys: 150, dia: 95, at: at(60) }, { sys: 182, dia: 100, at: at(58) }] });
    const form = formFromRecord(saved, plain);
    const second = carryForward(saved, build({ ...form, bp: { ...form.bp, s2: '', d2: '', at2: at(30) } }, plain, saved));
    expect(second.bpReadings).toEqual([{ sys: 150, dia: 95, at: at(60) }]);
    expect(second.bpEarlier).toEqual([{ sys: 182, dia: 100, at: at(58) }]);
    const changed = carryForward(saved, build({ ...form, bp: { ...form.bp, s1: '148', at1: at(30) } }, plain, saved));
    expect(changed.bpReadings).toEqual([{ sys: 148, dia: 95, at: at(30) }, { sys: 182, dia: 100, at: at(58) }]);
    expect(changed.bpEarlier).toEqual([{ sys: 150, dia: 95, at: at(60) }]);
  });
});
