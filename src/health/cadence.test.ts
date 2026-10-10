import { describe, expect, it } from 'vitest';
import { createDefaultProfile } from '@/profile/defaults';
import type { HealthProfile, UserProfile } from '@/types/profile';
import {
  ADA_HBA1C_GOAL,
  clinicianHba1cGoal,
  TRACK_ADD,
  dueItems,
  hba1cIn,
  hba1cIntervalMonths,
  latestStart,
  mostRelevantDue,
  sessionOf,
  type CadenceInput,
} from './cadence';
import { pairBloodPressure } from './aggregate';
import { bpContext, newObservation, type Observation, type ObservationTag } from './observation';

/** Local wall-clock time, so the hour-dependent rules hold in any time zone. */
const at = (day: string, time = '09:00') => new Date(`${day}T${time}:00`);

// 2026-10-08 is a Thursday.
const NOW = at('2026-10-08', '09:00');

function owner(health: Partial<HealthProfile> = {}, extra: Partial<UserProfile> = {}): UserProfile {
  return createDefaultProfile({
    health: { diabetes: 'type2', hypertension: 'treated', bpMonitor: true, metformin: false, ...health },
    ...extra,
  });
}

function input(over: Partial<CadenceInput> = {}): CadenceInput {
  return { now: NOW, profile: owner(), observations: [], ...over };
}

let n = 0;
/** One complete reading at `HH:MM` or `HH:MM:SS`, local to Kolkata. */
function bp(day: string, time: string, tag?: ObservationTag, readingId = `r${++n}`): Observation[] {
  const clock = time.length === 5 ? `${time}:00` : time;
  const shared = { at: `${day}T${clock}+05:30`, scope: 'pointInTime' as const, source: 'manual' as const, context: bpContext(readingId), ...(tag ? { tag } : {}) };
  return [
    newObservation({ ...shared, id: `${readingId}:s`, kind: 'bloodPressureSystolic', value: 132 }),
    newObservation({ ...shared, id: `${readingId}:d`, kind: 'bloodPressureDiastolic', value: 84 }),
  ];
}

/** One measurement session: two readings a minute apart, as both protocols ask. */
function session(day: string, time: string, tag?: ObservationTag): Observation[] {
  const [h, m] = time.split(':');
  return [...bp(day, time, tag), ...bp(day, `${h}:${String(Number(m) + 1).padStart(2, '0')}`, tag)];
}

/** A complete day: two readings in the morning and two in the evening. */
const checkDay = (day: string) => [...session(day, '07:30', 'morning'), ...session(day, '20:00', 'evening')];

/** Codex F23: a day whose pairs were taken `gap` seconds apart, morning and evening. */
const pairedDay = (day: string, gap: number) => {
  const second = (hm: string) => `${hm}:${String(gap % 60).padStart(2, '0')}`;
  const later = (h: string, m: number) => second(`${h}:${String(m + Math.floor(gap / 60)).padStart(2, '0')}`);
  return [
    ...bp(day, '07:30:00', 'morning'), ...bp(day, later('07', 30), 'morning'),
    ...bp(day, '20:00:00', 'evening'), ...bp(day, later('20', 0), 'evening'),
  ];
};

function lab(kind: 'hba1c' | 'b12' | 'vitaminD', day: string, value: number, unit?: string): Observation {
  return newObservation({ kind, value, ...(unit ? { unit } : {}), scope: 'pointInTime', source: 'manual', at: `${day}T10:00:00+05:30` });
}

const kinds = (i: CadenceInput) => dueItems(i).map(d => d.kind);

describe('nothing to base a schedule on', () => {
  it('is empty without a stored profile', () => {
    expect(dueItems(input({ profile: undefined }))).toEqual([]);
  });

  it('asks nothing of someone with neither diabetes nor a blood pressure concern', () => {
    expect(dueItems(input({ profile: owner({ diabetes: 'none', hypertension: 'none' }) }))).toEqual([]);
  });
});

describe('blood pressure, treated: one check day a week', () => {
  const profile = owner({ diabetes: 'none' });

  it('is due with no reading on record', () => {
    const item = mostRelevantDue(input({ profile }));
    expect(item).toMatchObject({ kind: 'bpCheckDay', title: 'Blood pressure check day', action: { to: TRACK_ADD.bloodPressure } });
    expect(item?.detail).toBe('Two readings this morning and two this evening, a minute apart.');
    expect(item?.source).toContain('European Society of Hypertension');
  });

  it('is due a week after the last complete check day, and not a day sooner', () => {
    expect(kinds(input({ profile, observations: checkDay('2026-10-01') }))).toEqual(['bpCheckDay']);
    expect(kinds(input({ profile, observations: checkDay('2026-10-02') }))).toEqual([]);
  });

  it('does not take one half of a day, however complete, for a check day', () => {
    expect(kinds(input({ profile, observations: session('2026-10-05', '07:30', 'morning') }))).toEqual(['bpCheckDay']);
    expect(kinds(input({ profile, observations: session('2026-10-05', '20:00', 'evening') }))).toEqual(['bpCheckDay']);
  });

  it('does not take one reading in each half of a day for a check day', () => {
    // Codex F23: each session asks for two readings, a minute apart.
    const observations = [...bp('2026-10-05', '07:30', 'morning'), ...bp('2026-10-05', '20:00', 'evening')];
    expect(kinds(input({ profile, observations }))).toEqual(['bpCheckDay']);
  });

  it('asks for the second morning reading, then the evening', () => {
    const observations = [...checkDay('2026-09-20'), ...bp('2026-10-08', '07:40', 'morning')];
    expect(mostRelevantDue(input({ profile, observations }))?.detail).toBe('One more reading this morning, a minute after the last, then two this evening.');
  });

  it('asks only for the evening once this morning’s two readings are in', () => {
    const observations = [...checkDay('2026-09-20'), ...session('2026-10-08', '07:40', 'morning')];
    expect(mostRelevantDue(input({ profile, observations }))?.detail).toBe('Two more readings this evening, a minute apart.');
  });

  it('asks for the evening only when the day is already that late', () => {
    expect(mostRelevantDue(input({ profile, now: at('2026-10-08', '18:30') }))?.detail).toBe('Two readings this evening, a minute apart.');
  });

  it('asks for the second evening reading, and is done for the day once it is in', () => {
    const morning = session('2026-10-08', '07:40', 'morning');
    const one = [...morning, ...bp('2026-10-08', '19:10', 'evening')];
    expect(mostRelevantDue(input({ profile, observations: one, now: at('2026-10-08', '19:30') }))?.detail)
      .toBe('One more reading this evening, a minute after the last.');
    const two = [...morning, ...session('2026-10-08', '19:10', 'evening')];
    expect(kinds(input({ profile, observations: two, now: at('2026-10-08', '20:00') }))).toEqual([]);
  });

  it('counts a reading recorded twice once, and half a reading not at all', () => {
    const before = checkDay('2026-09-20');
    const twice = [...bp('2026-10-08', '07:40', 'morning', 'same'), ...bp('2026-10-08', '07:40', 'morning', 'same')];
    expect(mostRelevantDue(input({ profile, observations: [...before, ...twice] }))?.detail)
      .toBe('One more reading this morning, a minute after the last, then two this evening.');
    const systolicOnly = bp('2026-10-08', '07:41', 'morning').filter(o => o.kind === 'bloodPressureSystolic');
    expect(mostRelevantDue(input({ profile, observations: [...before, ...bp('2026-10-08', '07:40', 'morning'), ...systolicOnly] }))?.detail)
      .toBe('One more reading this morning, a minute after the last, then two this evening.');
  });

  it('does not take two readings less than a minute apart, or saved at one moment, for a session', () => {
    // NICE NG136 1.2.7: two consecutive readings at least one minute apart.
    const before = checkDay('2026-09-20');
    const close = 'Your two readings this morning were less than a minute apart. Take one more, a minute after the last, then two this evening.';
    for (const second of ['07:40:30', '07:40:00', '07:40:59']) {
      const observations = [...before, ...bp('2026-10-08', '07:40:00', 'morning'), ...bp('2026-10-08', second, 'morning')];
      expect(mostRelevantDue(input({ profile, observations }))?.detail).toBe(close);
    }
    // A minute apart, by the readings' own times, is a session.
    const minute = [...before, ...bp('2026-10-08', '07:40:00', 'morning'), ...bp('2026-10-08', '07:41:00', 'morning')];
    expect(mostRelevantDue(input({ profile, observations: minute }))?.detail).toBe('Two more readings this evening, a minute apart.');
  });

  it('says so in the evening too, and is done once a reading comes a minute later', () => {
    const morning = session('2026-10-08', '07:40', 'morning');
    const close = [...morning, ...bp('2026-10-08', '19:10:00', 'evening'), ...bp('2026-10-08', '19:10:20', 'evening')];
    expect(mostRelevantDue(input({ profile, observations: close, now: at('2026-10-08', '19:30') }))?.detail)
      .toBe('Your two readings this evening were less than a minute apart. Take one more, a minute after the last.');
    const third = [...close, ...bp('2026-10-08', '19:11:20', 'evening')];
    expect(kinds(input({ profile, observations: third, now: at('2026-10-08', '19:30') }))).toEqual([]);
  });

  it('does not take a check day of pairs less than a minute apart, and says why', () => {
    for (const gap of [30, 0]) {
      const item = mostRelevantDue(input({ profile, observations: pairedDay('2026-10-05', gap) }));
      expect(item?.kind).toBe('bpCheckDay');
      expect(item?.detail).toBe('Two readings this morning and two this evening, a minute apart. On 1 day this week your two readings were less than a minute apart, so it was not counted.');
    }
    expect(kinds(input({ profile, observations: pairedDay('2026-10-05', 60) }))).toEqual([]);
    // One half too close is enough to keep the day from counting, and to say why.
    const halfClose = [...session('2026-10-05', '07:30', 'morning'), ...bp('2026-10-05', '20:00:00', 'evening'), ...bp('2026-10-05', '20:00:30', 'evening')];
    expect(mostRelevantDue(input({ profile, observations: halfClose }))?.detail)
      .toBe('Two readings this morning and two this evening, a minute apart. On 1 day this week your two readings were less than a minute apart, so it was not counted.');
  });

  it('does not claim readings whose half of the day is unknown', () => {
    const observations = [...checkDay('2026-09-20'), ...bp('2026-10-08', '07:40', 'other'), ...bp('2026-10-08', '07:41', 'other')];
    expect(mostRelevantDue(input({ profile, observations }))?.detail).toBe('Two readings this morning and two this evening, a minute apart.');
  });

  it('is not asked for without a home monitor', () => {
    expect(dueItems(input({ profile: owner({ diabetes: 'none', bpMonitor: false }) }))).toEqual([]);
  });
});

describe('sessionOf: which half of the protocol a reading is', () => {
  const r = (time: string, tag?: ObservationTag) => ({ at: `2026-10-08T${time}:00+05:30`, ...(tag ? { tag } : {}) });

  it('trusts the tag first', () => {
    expect(sessionOf(r('20:00', 'morning'))).toBe('morning');
    expect(sessionOf(r('08:00', 'evening'))).toBe('evening');
    expect(sessionOf(r('08:00', 'other'))).toBe('unknown');
  });

  it('reads the reading’s own clock at the boundaries', () => {
    expect(sessionOf(r('03:59'))).toBe('unknown');
    expect(sessionOf(r('04:00'))).toBe('morning');
    expect(sessionOf(r('11:59'))).toBe('morning');
    expect(sessionOf(r('12:00'))).toBe('unknown');
    expect(sessionOf(r('16:59'))).toBe('unknown');
    expect(sessionOf(r('17:00'))).toBe('evening');
  });

  it('never guesses the half of a reading whose time was not recorded, and keeps one that was', () => {
    // A v4 check-in kept only its date, so its readings stand in at midday.
    const standIn = pairBloodPressure(bp('2026-10-08', '12:00', undefined, 'checkIn:2026-10-08'))[0];
    expect(sessionOf(standIn)).toBe('unknown');
    const timed = pairBloodPressure(bp('2026-10-08', '07:30', undefined, 'checkIn:2026-10-08#1'))[0];
    expect(sessionOf(timed)).toBe('morning');
  });

  it('counts timed check-in readings towards the day, but not two saved at one moment as a session', () => {
    const profile = owner({ diabetes: 'none' });
    const one = [...checkDay('2026-09-20'), ...bp('2026-10-08', '07:30', undefined, 'checkIn:2026-10-08#1')];
    expect(mostRelevantDue(input({ profile, observations: one }))?.detail).toBe('One more reading this morning, a minute after the last, then two this evening.');
    // The check-in stamps both of its readings with its own time: two readings, but no minute between them is on record.
    const both = [...one, ...bp('2026-10-08', '07:30', undefined, 'checkIn:2026-10-08#2')];
    expect(mostRelevantDue(input({ profile, observations: both }))?.detail)
      .toBe('Your two readings this morning were less than a minute apart. Take one more, a minute after the last, then two this evening.');
    // With each reading's own time recorded a minute apart, they are the session.
    const timed = [...one, ...bp('2026-10-08', '07:31', undefined, 'checkIn:2026-10-08#2')];
    expect(mostRelevantDue(input({ profile, observations: timed }))?.detail).toBe('Two more readings this evening, a minute apart.');
  });
});

describe('blood pressure, not yet confirmed: one diagnostic week', () => {
  const profile = owner({ diabetes: 'none', hypertension: 'unsure' });

  it('asks for a week of readings when none is on record', () => {
    const item = mostRelevantDue(input({ profile }));
    expect(item?.kind).toBe('bpWeek');
    expect(item?.detail).toBe('Two readings this morning and two this evening, a minute apart. Aim for at least 4 days in a row, ideally 7.');
    expect(item?.source).toContain('NG136');
  });

  it('counts the full days in a row already done', () => {
    const observations = [...checkDay('2026-10-06'), ...checkDay('2026-10-07')];
    expect(mostRelevantDue(input({ profile, observations }))?.detail).toContain('2 of at least 4 days in a row done.');
  });

  it('keeps asking after three full days in a row, one short of the block', () => {
    const observations = ['2026-10-05', '2026-10-06', '2026-10-07'].flatMap(checkDay);
    expect(mostRelevantDue(input({ profile, observations }))?.detail).toContain('3 of at least 4 days in a row done.');
  });

  it('starts the count again after a day missed', () => {
    const observations = ['2026-10-04', '2026-10-05', '2026-10-07'].flatMap(checkDay);
    expect(mostRelevantDue(input({ profile, observations }))?.detail).toContain('1 of at least 4 days in a row done.');
  });

  it('does not take one reading a session, on alternate days, for a week done', () => {
    // Codex F23: one morning and one evening reading on 1, 3, 5 and 7 October.
    const observations = ['2026-10-01', '2026-10-03', '2026-10-05', '2026-10-07']
      .flatMap(d => [...bp(d, '07:30', 'morning'), ...bp(d, '20:00', 'evening')]);
    const item = mostRelevantDue(input({ profile, observations }));
    expect(item?.kind).toBe('bpWeek');
    expect(item?.detail).toContain('Aim for at least 4 days in a row, ideally 7.');
  });

  it('stops asking once four full days in a row are on record, and does not ask again', () => {
    const observations = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'].flatMap(checkDay);
    expect(kinds(input({ profile, observations }))).toEqual([]);
    expect(kinds(input({ profile, observations, now: at('2027-03-01') }))).toEqual([]);
  });

  it('does not take four days of pairs less than a minute apart for the block (codex F23 re-check)', () => {
    // 1 to 4 October: 07:30:00 and 07:30:30, 20:00:00 and 20:00:30.
    const days = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'];
    for (const gap of [30, 0]) {
      const item = mostRelevantDue(input({ profile, observations: days.flatMap(d => pairedDay(d, gap)) }));
      expect(item?.kind).toBe('bpWeek');
      expect(item?.detail).toBe('Two readings this morning and two this evening, a minute apart. Aim for at least 4 days in a row, ideally 7. On 4 days this week your two readings were less than a minute apart, so they were not counted.');
    }
    // The same days a minute apart complete it.
    expect(kinds(input({ profile, observations: days.flatMap(d => pairedDay(d, 60)) }))).toEqual([]);
  });

  it('counts a session when any two of its readings are a minute apart', () => {
    const observations = ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'].flatMap(d => [
      ...bp(d, '07:30:00', 'morning'), ...bp(d, '07:30:30', 'morning'), ...bp(d, '07:31:00', 'morning'),
      ...bp(d, '20:00:00', 'evening'), ...bp(d, '20:01:10', 'evening'),
    ]);
    expect(kinds(input({ profile, observations }))).toEqual([]);
  });

  it('keeps asking after four mornings in a row with no evenings', () => {
    const observations = ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'].flatMap(d => session(d, '07:30', 'morning'));
    expect(kinds(input({ profile, observations }))).toEqual(['bpWeek']);
  });

  it('keeps asking when four full days are not in a row', () => {
    const observations = ['2026-09-01', '2026-09-02', '2026-09-04', '2026-09-07'].flatMap(checkDay);
    expect(kinds(input({ profile, observations }))).toEqual(['bpWeek']);
  });

  it('asks for what is left of today', () => {
    expect(mostRelevantDue(input({ profile, observations: bp('2026-10-08', '07:30', 'morning') }))?.detail)
      .toBe('One more reading this morning, a minute after the last, then two this evening. Aim for at least 4 days in a row, ideally 7.');
    expect(mostRelevantDue(input({ profile, observations: session('2026-10-08', '07:30', 'morning') }))?.detail)
      .toBe('Two more readings this evening, a minute apart. Aim for at least 4 days in a row, ideally 7.');
  });

  it('is quiet for the rest of a day already done', () => {
    expect(kinds(input({ profile, observations: checkDay('2026-10-08'), now: at('2026-10-08', '21:00') }))).toEqual([]);
  });

  it('applies to untreated hypertension too', () => {
    expect(kinds(input({ profile: owner({ diabetes: 'none', hypertension: 'untreated' }) }))).toEqual(['bpWeek']);
  });
});

describe('HbA1c: about 6 months at goal, about 3 when not', () => {
  const profile = owner({ hypertension: 'none' });

  it('uses ADA’s under-7% goal by default, with 7.0% itself not at goal', () => {
    expect(hba1cIntervalMonths({ value: 6.9, unit: '%' })).toBe(6);
    expect(hba1cIntervalMonths({ value: 7.0, unit: '%' })).toBe(3);
    expect(hba1cIntervalMonths({ value: 8.2, unit: '%' })).toBe(3);
    expect(ADA_HBA1C_GOAL).toEqual({ value: 7, unit: '%' });
  });

  it('compares a result at the precision labs report it in the goal’s unit', () => {
    // ADA: under 7%, or under 53 mmol/mol. 53 mmol/mol is how a lab writes 7.0%.
    expect(hba1cIntervalMonths({ value: 53, unit: 'mmol/mol' })).toBe(3);
    expect(hba1cIntervalMonths({ value: 52, unit: 'mmol/mol' })).toBe(6);
    expect(hba1cIntervalMonths({ value: 6.96, unit: '%' })).toBe(3);
    expect(hba1cIntervalMonths({ value: 6.94, unit: '%' })).toBe(6);
    // A clinician's 48 mmol/mol is 6.5%: a 6.5% result is not under it.
    expect(hba1cIntervalMonths({ value: 6.5, unit: '%' }, { value: 48, unit: 'mmol/mol' })).toBe(3);
    expect(hba1cIntervalMonths({ value: 6.4, unit: '%' }, { value: 48, unit: 'mmol/mol' })).toBe(6);
    expect(hba1cIn(7, '%', 'mmol/mol')).toBeCloseTo(53.0057, 3);
    expect(hba1cIn(53.0057, 'mmol/mol', '%')).toBeCloseTo(7, 3);
  });

  it('uses the clinician’s goal when one is recorded', () => {
    const goal = { value: 8, unit: '%' } as const;
    expect(hba1cIntervalMonths({ value: 7.5, unit: '%' }, goal)).toBe(6);
    expect(hba1cIntervalMonths({ value: 6.4, unit: '%' }, { value: 6.5, unit: '%' })).toBe(6);
    expect(hba1cIntervalMonths({ value: 6.5, unit: '%' }, { value: 6.5, unit: '%' })).toBe(3);
  });

  it('is due 6 months after a result at goal, and not a day before', () => {
    const at6 = [lab('hba1c', '2026-04-08', 6.6)];
    expect(kinds(input({ profile, observations: at6 }))).toEqual(['hba1c']);
    const notYet = [lab('hba1c', '2026-04-09', 6.6)];
    expect(kinds(input({ profile, observations: notYet }))).toEqual([]);
    expect(mostRelevantDue(input({ profile, observations: at6 }))?.detail)
      .toBe('Your last result was 6.6% on 8 April, within the usual goal (under 7%). About every 6 months is usual.');
  });

  it('is due 3 months after a result above goal', () => {
    const above = [lab('hba1c', '2026-07-08', 7.4)];
    expect(kinds(input({ profile, observations: above }))).toEqual(['hba1c']);
    expect(mostRelevantDue(input({ profile, observations: above }))?.detail)
      .toBe('Your last result was 7.4% on 8 July, not yet within the usual goal (under 7%). About every 3 months is usual until it is.');
    expect(kinds(input({ profile, observations: [lab('hba1c', '2026-07-09', 7.4)] }))).toEqual([]);
  });

  it('takes the later of two results entered for the same day, whatever order they come in', () => {
    // Codex F24: both carry the date-only noon stamp; the store numbers them in the order entered.
    const stamp = { kind: 'hba1c' as const, unit: '%', scope: 'pointInTime' as const, source: 'manual' as const, at: '2026-06-08T12:00:00+05:30' };
    const first = { ...newObservation({ ...stamp, value: 6.5 }), seq: 3 };
    const second = { ...newObservation({ ...stamp, value: 9 }), seq: 4 };
    for (const observations of [[first, second], [second, first]]) {
      const item = mostRelevantDue(input({ profile, observations }));
      expect(item?.kind).toBe('hba1c');
      expect(item?.detail).toContain('Your last result was 9% on 8 June');
    }
  });

  it('compares the times of results as instants, not as text', () => {
    // 01:10 at -05:00 is twenty minutes after 01:50 at -04:00 (a US clock change).
    const earlier = newObservation({ kind: 'hba1c', value: 6.5, unit: '%', scope: 'pointInTime', source: 'manual', at: '2026-06-08T01:50:00-04:00' });
    const later = newObservation({ kind: 'hba1c', value: 9, unit: '%', scope: 'pointInTime', source: 'manual', at: '2026-06-08T01:10:00-05:00' });
    expect(mostRelevantDue(input({ profile, observations: [later, earlier] }))?.detail).toContain('Your last result was 9%');
  });

  it('goes by the most recent result', () => {
    const observations = [lab('hba1c', '2026-01-10', 8.1), lab('hba1c', '2026-07-01', 6.8)];
    expect(kinds(input({ profile, observations }))).toEqual([]);
  });

  it('takes the clinician’s goal from the profile, and names it', () => {
    const looser = owner({ hypertension: 'none', clinicianTargets: { hba1cPercent: 8 } });
    // 7.5% is above ADA's 7% (due after 3 months) but within a goal of 8% (6 months).
    const observations = [lab('hba1c', '2026-06-01', 7.5)];
    expect(kinds(input({ profile, observations }))).toEqual(['hba1c']);
    expect(kinds(input({ profile: looser, observations }))).toEqual([]);
    const item = mostRelevantDue(input({ profile: looser, observations: [lab('hba1c', '2026-04-01', 7.5)] }));
    expect(item?.detail).toBe('Your last result was 7.5% on 1 April, within your clinician’s goal (under 8%). About every 6 months is usual.');
    const tighter = owner({ hypertension: 'none', clinicianTargets: { hba1cPercent: 6.5 } });
    expect(mostRelevantDue(input({ profile: tighter, observations: [lab('hba1c', '2026-07-01', 6.8)] }))?.detail)
      .toBe('Your last result was 6.8% on 1 July, not yet within your clinician’s goal (under 6.5%). About every 3 months is usual until it is.');
  });

  it('ignores a goal that cannot be a percentage', () => {
    for (const hba1cPercent of [53, 0, -7, Number.NaN, Number.POSITIVE_INFINITY, 3.9, 15.1]) {
      const odd = owner({ hypertension: 'none', clinicianTargets: { hba1cPercent } });
      expect(clinicianHba1cGoal(odd)).toBeUndefined();
      expect(mostRelevantDue(input({ profile: odd, observations: [lab('hba1c', '2026-07-01', 7.4)] }))?.detail).toContain('the usual goal (under 7%)');
    }
    expect(clinicianHba1cGoal(owner({ hypertension: 'none', clinicianTargets: { hba1cPercent: 4 } }))).toBe(4);
    expect(clinicianHba1cGoal(owner({ hypertension: 'none', clinicianTargets: { hba1cPercent: 15 } }))).toBe(15);
    expect(clinicianHba1cGoal(owner({ hypertension: 'none', clinicianTargets: {} }))).toBeUndefined();
    expect(clinicianHba1cGoal(owner({ hypertension: 'none' }))).toBeUndefined();
  });

  it('asks for a first result when none is recorded, as the least urgent item', () => {
    const item = mostRelevantDue(input({ profile }));
    expect(item).toMatchObject({ kind: 'hba1cFirst', action: { to: TRACK_ADD.hba1c } });
  });

  it('is not asked of someone without diabetes', () => {
    expect(kinds(input({ profile: owner({ diabetes: 'none', hypertension: 'none' }) }))).toEqual([]);
    expect(kinds(input({ profile: owner({ diabetes: 'prediabetes', hypertension: 'none' }) }))).toEqual([]);
  });
});

describe('vitamin B12: annual after more than 4 years of metformin', () => {
  const onMetformin = (since?: string, extra: Partial<UserProfile> = {}) =>
    owner({ hypertension: 'none', metformin: true, ...(since ? { metforminSince: since } : {}) }, extra);
  const withHba1c = [lab('hba1c', '2026-09-01', 6.5)];

  it('reads the latest possible start from a year or a month', () => {
    expect(latestStart('2021')).toBe('2021-12-31');
    expect(latestStart('2022-02')).toBe('2022-02-28');
    expect(latestStart('2024-02')).toBe('2024-02-29');
    // March holds a clock change in much of the world; the month still ends on the 31st.
    expect(latestStart('2024-03')).toBe('2024-03-31');
    expect(latestStart('2024-10')).toBe('2024-10-31');
    expect(latestStart('2021-13')).toBeUndefined();
    expect(latestStart('spring 2020')).toBeUndefined();
    expect(latestStart(undefined)).toBeUndefined();
  });

  it('is due when more than 4 years is certain and there is no result', () => {
    const item = mostRelevantDue(input({ profile: onMetformin('2021'), observations: withHba1c }));
    expect(item).toMatchObject({ kind: 'b12', title: 'Vitamin B12 check', action: { to: TRACK_ADD.b12 } });
    expect(item?.detail).toBe('Once a year is usual after more than 4 years on metformin. No result recorded yet.');
    expect(item?.source).toContain('3.10');
  });

  it('waits until the 4 years are certain, not merely possible', () => {
    // Started some time in 2022: only certain to be more than 4 years after 2026-12-31.
    expect(kinds(input({ profile: onMetformin('2022'), observations: withHba1c }))).toEqual([]);
    expect(kinds(input({ profile: onMetformin('2022-09'), observations: withHba1c }))).toEqual(['b12']);
    expect(kinds(input({ profile: onMetformin('2022-10'), observations: withHba1c }))).toEqual([]);
  });

  it('is due again 12 months after the last result', () => {
    const recent = [...withHba1c, lab('b12', '2025-10-09', 410)];
    expect(kinds(input({ profile: onMetformin('2019'), observations: recent }))).toEqual([]);
    const yearOld = [...withHba1c, lab('b12', '2025-10-08', 410)];
    expect(mostRelevantDue(input({ profile: onMetformin('2019'), observations: yearOld }))?.detail)
      .toBe('Once a year is usual after more than 4 years on metformin. Your last result was 410 pg/mL on 8 October 2025.');
  });

  it('counts a vegan diet as a reason for an annual check on metformin', () => {
    const profile = onMetformin('2025', { food: { pattern: 'vegan', avoid: [] } });
    expect(mostRelevantDue(input({ profile, observations: withHba1c }))?.detail)
      .toBe('Once a year is usual on metformin with a vegan diet. No result recorded yet.');
  });

  it('has no interval for shorter use, no start date, or an unsure answer', () => {
    expect(kinds(input({ profile: onMetformin('2024'), observations: withHba1c }))).toEqual([]);
    expect(kinds(input({ profile: onMetformin(undefined), observations: withHba1c }))).toEqual([]);
    const unsure = owner({ hypertension: 'none', metformin: 'unsure', metforminSince: '2015' });
    expect(kinds(input({ profile: unsure, observations: withHba1c }))).toEqual([]);
  });
});

describe('vitamin D: never routine', () => {
  it('is never due, however old or low the last result', () => {
    const profile = owner({ hypertension: 'none', metformin: true, metforminSince: '2010' });
    const observations = [lab('hba1c', '2026-09-01', 6.5), lab('b12', '2026-09-01', 400), lab('vitaminD', '2019-01-01', 9)];
    expect(kinds(input({ profile, observations }))).toEqual([]);
    expect(kinds(input({ profile: owner(), observations: [lab('vitaminD', '2019-01-01', 9)] }))).not.toContain('vitaminD');
  });
});

describe('the one most relevant item', () => {
  const profile = owner({ metformin: true, metforminSince: '2015' });
  const labsDue = [lab('hba1c', '2026-01-01', 7.9)];

  it('puts a blood pressure day that has just come round ahead of a lab test that can wait', () => {
    const observations = [...labsDue, ...checkDay('2026-10-01')];
    expect(kinds(input({ profile, observations }))).toEqual(['bpCheckDay', 'hba1c', 'b12']);
    expect(mostRelevantDue(input({ profile, observations }))?.kind).toBe('bpCheckDay');
  });

  it('lets a lab test that is due through once a blood pressure prompt has gone unanswered for days', () => {
    const observations = [...labsDue, ...checkDay('2026-09-29')];
    expect(kinds(input({ profile, observations }))).toEqual(['hba1c', 'b12', 'bpCheckDay']);
    // Never recorded at all is not "just come round" either.
    expect(kinds(input({ profile, observations: labsDue }))).toEqual(['hba1c', 'b12', 'bpCheckDay']);
  });

  it('puts the one-off diagnostic week behind a due lab test', () => {
    const unsure = owner({ hypertension: 'unsure', metformin: true, metforminSince: '2015' });
    expect(kinds(input({ profile: unsure, observations: labsDue }))).toEqual(['hba1c', 'b12', 'bpWeek']);
  });

  it('puts a missing first HbA1c last', () => {
    expect(kinds(input({ profile, observations: checkDay('2026-10-07') }))).toEqual(['b12', 'hba1cFirst']);
  });
});
