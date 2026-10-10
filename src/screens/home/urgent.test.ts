import { describe, expect, it } from 'vitest';
import { createDefaultProfile } from '@/profile/defaults';
import { permission, type Mode, type Permission } from '@/engine/permission';
import { evaluateCheckIn } from '@/engine/readiness';
import { recommend } from '@/health/recommend';
import type { CheckInRecord, DailyCheckIn, Readiness } from '@/types/checkin';
import type { SessionPlan } from '@/types/plan';
import type { UserProfile } from '@/types/profile';
import type { ChapterId, UserSettings } from '@/types';
import { recommendSources, says, urgentOf, withEffectiveToday } from './urgent';

const TODAY = '2026-10-08';
const at = (time: string, day = TODAY) => new Date(`${day}T${time}:00`);
const iso = (time: string, day = TODAY) => at(time, day).toISOString();

const known = { medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous' as const, glucoseMonitor: 'meter' as const, glucoseUnit: 'mg/dL' as const };
const diabetic = createDefaultProfile({ health: { ...known, diabetes: 'type2', metformin: true } });
const footWound = createDefaultProfile({ health: { ...known, diabetes: 'type2', metformin: true, footStatus: 'current_wound_or_active_charcot', peripheralNeuropathy: 'yes' } });

function plan(): SessionPlan {
  const readiness: Readiness = { outcome: 'green', modifiers: [], back: 'none', nerveFlag: false, reasons: [], actions: [], vigorousLocked: false, capHeavy: false, rpeOnly: false, notices: [] };
  return {
    id: 'plan', date: TODAY, week: 3, phase: 'foundation', mode: 'normal', focus: 'rest', label: 'Rest Day', mobilityDayType: 'lowerSquat',
    readiness, kind: 'none', steps: [], exercises: [], cardio: null, blockStarts: {}, totalSeconds: 0, changes: [], warnings: [],
  };
}
const answered = (over: Partial<DailyCheckIn> = {}, date = TODAY): DailyCheckIn => ({ date, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, ...over });
const record = (profile: UserProfile, c: DailyCheckIn, recent: DailyCheckIn[] = []): CheckInRecord => ({ ...c, readiness: evaluateCheckIn(profile, c, recent) });

/** Home's recommendation and the shell's surface, from the real gate, as both work them out. */
function surface(profile: UserProfile, today: CheckInRecord | undefined, now: Date, earlier: CheckInRecord[] = []) {
  const recent = [...earlier, ...(today ? [today] : [])];
  const gate = (m: Mode): Permission => permission({ profile, ...(today ? { checkIn: today } : {}), now, recent }, m);
  const r = recommend({
    now, settings: { startDate: '' }, profile, plan: plan(), sessions: [], checkIns: recent, observations: [], saved: [],
    permissions: { guided: gate('guided'), stretch: gate('stretch'), walk: gate('walk') },
  });
  const permissions = { guided: gate('guided'), stretch: gate('stretch'), walk: gate('walk') };
  return { r, urgent: urgentOf({ profile, ...(today ? { checkIn: today } : {}), checkIns: recent, permissions }, now, true) };
}

const held = (mode: Mode): Permission => ({ mode, allowed: false, disposition: 'hold', reasons: ['Held.'], restrictions: [], needsCheckIn: true });
const allHeld = { guided: held('guided'), stretch: held('stretch'), walk: held('walk') };
/** The engine's own sentences a decision stands on: checked in their own tests below. */
const SENTENCES = expect.arrayContaining([expect.any(String)]);

describe('which decisions are urgent (journey §4.7, B-02)', () => {
  it('an emergency, a stop for today and a re-check, whatever the card suggests', () => {
    const chest = record(diabetic, answered({ urgentSymptoms: true, emergency: ['chest'] }));
    expect(surface(diabetic, chest, at('09:00')).urgent?.kind).toBe('emergency');
    const severe = record(diabetic, answered({ glucose: { value: 48, unit: 'mg/dL', measuredAt: iso('09:05') } }));
    expect(surface(diabetic, severe, at('09:10')).urgent?.kind).toBe('seekHelp');
    const low = record(diabetic, answered({ glucose: { value: 62, unit: 'mg/dL', measuredAt: iso('13:30') } }));
    expect(surface(diabetic, low, at('13:32')).urgent?.kind).toBe('recheck');
  });

  it('a symptom that holds every movement is urgent, though the card shows it as an ordinary hold (codex V1-01)', () => {
    const dizzy = record(diabetic, answered({ news: ['dizzy'] }));
    const { r, urgent } = surface(diabetic, dizzy, at('09:00'));
    expect(r.kind).toBe('hold');
    expect(urgent).toEqual({ kind: 'hold', tone: 'caution', headline: 'No exercise for now', when: 'From today’s check-in', reasons: SENTENCES });
    for (const news of [['unwell'], ['unusualFatigue']] as const) {
      expect(surface(diabetic, record(diabetic, answered({ news: [...news] })), at('09:00')).urgent?.kind, news[0]).toBe('hold');
    }
  });

  it('repeated lows stop exercise for the day after the glucose has recovered (codex V1-01)', () => {
    const c = record(diabetic, answered({ news: ['lowTwoPlus'], glucose: { value: 110, unit: 'mg/dL', measuredAt: iso('09:00') } }));
    expect(surface(diabetic, c, at('09:05')).urgent).toEqual({ kind: 'hold', tone: 'caution', headline: 'No exercise for now', when: 'From today’s check-in', reasons: SENTENCES });
  });

  it('a reading that holds every movement is named with its time, and one that needs checking again says so', () => {
    const bp = record(diabetic, answered({ bpReadings: [{ sys: 165, dia: 96, at: iso('08:50') }, { sys: 166, dia: 98, at: iso('08:52') }] }));
    expect(surface(diabetic, bp, at('09:00')).urgent).toMatchObject({ kind: 'hold', headline: 'No exercise for now', when: 'Blood pressure reading at 8:52 am' });
    const high = record(diabetic, answered({ glucose: { value: 320, unit: 'mg/dL', measuredAt: iso('08:55') } }));
    expect(surface(diabetic, high, at('09:00')).urgent).toMatchObject({ kind: 'hold', when: 'Glucose reading at 8:55 am' });
  });

  it('decides from the engine, not from the card: the same state is urgent whatever the recommendation was', () => {
    const dizzy = record(diabetic, answered({ news: ['dizzy'] }));
    const gate = (m: Mode) => permission({ profile: diabetic, checkIn: dizzy, now: at('09:00'), recent: [dizzy] }, m);
    const permissions = { guided: gate('guided'), stretch: gate('stretch'), walk: gate('walk') };
    expect(urgentOf({ profile: diabetic, checkIn: dizzy, checkIns: [dizzy], permissions }, at('09:00'), true)?.kind).toBe('hold');
  });

  it('a low being treated, before its reading: urgent though the card holds it as a hold', () => {
    const c = record(diabetic, answered({ news: ['lowSymptoms'] }));
    const { r, urgent } = surface(diabetic, c, at('09:00'));
    expect(r.kind).toBe('hold');
    expect(urgent).toEqual({ kind: 'low', tone: 'caution', headline: 'Check your glucose now', when: 'Feeling low today', reasons: SENTENCES });
  });

  it('ordinary holds are not urgent: no check-in yet, a profile gap, a foot that needs protecting', () => {
    expect(surface(diabetic, undefined, at('09:00')).urgent).toBeUndefined();
    const unreviewed = createDefaultProfile({ needsHealthReview: true });
    expect(surface(unreviewed, undefined, at('09:00')).urgent).toBeUndefined();
    const c = record(footWound, answered());
    expect(surface(footWound, c, at('09:00')).urgent).toBeUndefined();
  });

  it('nor a reading still to be given or typed again, nor a standing limit from the profile (codex V1-01)', () => {
    // With insulin, the check-in needs a glucose reading before a start.
    const onInsulin = createDefaultProfile({ health: { ...known, diabetes: 'type2', insulin: 'injections_or_pump' } });
    const noReading = record(onInsulin, answered());
    expect(surface(onInsulin, noReading, at('09:00')).urgent).toBeUndefined();
    const eyes = createDefaultProfile({ health: { ...known, retinopathy: 'recent_eye_treatment' } });
    expect(surface(eyes, record(eyes, answered()), at('09:00')).urgent).toBeUndefined();
  });
});

describe('what the surface says: the engine’s headline, when, and the safe action now', () => {
  it('a 62 mg/dL at 1:30 pm: "Low glucose at 1:30 pm · Re-check at 1:45 pm", then "Re-check now"', () => {
    const c = record(diabetic, answered({ glucose: { value: 62, unit: 'mg/dL', measuredAt: iso('13:30') } }));
    expect(surface(diabetic, c, at('13:32')).urgent).toEqual({
      kind: 'recheck', tone: 'caution', headline: 'Re-check your glucose', when: 'Low glucose at 1:30 pm', next: 'Re-check at 1:45 pm', reasons: SENTENCES,
    });
    expect(surface(diabetic, c, at('13:45')).urgent).toMatchObject({ when: 'Low glucose at 1:30 pm', next: 'Re-check now' });
  });

  it('a re-check taken too soon still counts from the low it follows', () => {
    const c = record(diabetic, answered({
      glucoseEarlier: [{ value: 62, unit: 'mg/dL', measuredAt: iso('13:30') }],
      glucose: { value: 95, unit: 'mg/dL', measuredAt: iso('13:38') },
    }));
    expect(surface(diabetic, c, at('13:39')).urgent).toMatchObject({ kind: 'recheck', when: 'Low glucose at 1:30 pm', next: 'Re-check at 1:45 pm' });
  });

  it('an emergency answer: "Emergency answer today", in the check-in’s own headline', () => {
    const c = record(diabetic, answered({ urgentSymptoms: true, emergency: ['chest'] }));
    expect(surface(diabetic, c, at('09:00')).urgent).toEqual({ kind: 'emergency', tone: 'stop', headline: 'Call emergency services now', when: 'Emergency answer today', reasons: SENTENCES });
  });

  it('a reading behind a stop is named with the time it was taken', () => {
    const extreme = record(diabetic, answered({ glucose: { value: 650, unit: 'mg/dL', measuredAt: iso('09:05') } }));
    expect(surface(diabetic, extreme, at('09:10')).urgent).toEqual({ kind: 'emergency', tone: 'stop', headline: 'Call emergency services now', when: 'Glucose reading at 9:05 am', reasons: SENTENCES });
    const severe = record(diabetic, answered({ glucose: { value: 48, unit: 'mg/dL', measuredAt: iso('09:05') } }));
    expect(surface(diabetic, severe, at('09:10')).urgent).toEqual({
      kind: 'seekHelp', tone: 'stop', headline: 'No exercise today. Get medical advice today.', when: 'Low glucose at 9:05 am', reasons: SENTENCES,
    });
  });

  it('an answer from an earlier day that still stands says so', () => {
    const yesterday = record(diabetic, answered({ urgentSymptoms: true, emergency: ['chest'] }, '2026-10-07'));
    const { r, urgent } = surface(diabetic, undefined, at('00:30'), [yesterday]);
    expect(r.kind).toBe('emergency');
    expect(urgent).toMatchObject({ kind: 'emergency', when: 'From your last check-in' });
  });

  it('a re-check after midnight that counts from a low before it says the low was yesterday (X2-08, A-12)', () => {
    const today: CheckInRecord = { ...record(diabetic, answered()), readiness: { ...record(diabetic, answered()).readiness, recheckAt: iso('00:10') } };
    expect(urgentOf({ profile: diabetic, checkIn: today, checkIns: [today], permissions: allHeld }, at('00:02'), true)).toMatchObject({
      kind: 'recheck', when: 'Glucose reading at 11:55 pm yesterday', next: 'Re-check at 12:10 am',
    });
  });

  it('writes times on the device’s clock', () => {
    const c = record(diabetic, answered({ glucose: { value: 62, unit: 'mg/dL', measuredAt: iso('13:30') } }));
    const gate = (m: Mode) => permission({ profile: diabetic, checkIn: c, now: at('13:32'), recent: [c] }, m);
    const permissions = { guided: gate('guided'), stretch: gate('stretch'), walk: gate('walk') };
    expect(urgentOf({ profile: diabetic, checkIn: c, checkIns: [c], permissions }, at('13:32'), false)).toMatchObject({ when: 'Low glucose at 13:30', next: 'Re-check at 13:45' });
  });
});

describe('a task’s own screen says the decision only while it draws that decision (codex W-01)', () => {
  /** The gate's answer a full-screen task draws, from the same engine. */
  const drawn = (profile: UserProfile, c: CheckInRecord | undefined, now: Date, mode: Mode = 'guided') =>
    permission({ profile, ...(c ? { checkIn: c } : {}), now, recent: c ? [c] : [] }, mode);

  it('stands on the engine’s own sentences, as every screen shows them', () => {
    const chest = record(diabetic, answered({ urgentSymptoms: true, emergency: ['chest'] }));
    const { urgent } = surface(diabetic, chest, at('09:05'));
    expect(urgent?.reasons).toEqual(drawn(diabetic, chest, at('09:05')).reasons);
    const dizzy = record(diabetic, answered({ news: ['dizzy'] }));
    expect(surface(diabetic, dizzy, at('09:00')).urgent?.reasons).toEqual(dizzy.readiness.reasons.filter(r => r.disposition === 'hold').map(r => r.message));
  });

  it('a session opened before any check-in, its refusal still showing, does not say an emergency answered since on another screen', () => {
    const arrival = drawn(diabetic, undefined, at('09:00'));
    expect(arrival).toMatchObject({ allowed: false, disposition: 'hold', needsCheckIn: true });
    const chest = record(diabetic, answered({ urgentSymptoms: true, emergency: ['chest'] }));
    const emergency = surface(diabetic, chest, at('09:05')).urgent!;
    expect(emergency.kind).toBe('emergency');
    expect(says(arrival, emergency)).toBe(false);
    // Drawn again as it stands now, it does: whichever mode's screen draws it.
    expect(says(drawn(diabetic, chest, at('09:05')), emergency)).toBe(true);
    expect(says(drawn(diabetic, chest, at('09:05'), 'walk'), emergency)).toBe(true);
  });

  it('a hold drawn for one reason does not say a hold for another', () => {
    const dizzy = record(diabetic, answered({ news: ['dizzy'] }));
    const hold = surface(diabetic, dizzy, at('09:00')).urgent!;
    expect(hold.kind).toBe('hold');
    expect(says(drawn(diabetic, undefined, at('09:00')), hold)).toBe(false);
    expect(says(drawn(diabetic, dizzy, at('09:00')), hold)).toBe(true);
  });

  it('an emergency drawn earlier does not say a different one standing now', () => {
    const chest = record(diabetic, answered({ urgentSymptoms: true, emergency: ['chest'] }));
    const extreme = record(diabetic, answered({ glucose: { value: 650, unit: 'mg/dL', measuredAt: iso('09:05') } }));
    const now = surface(diabetic, extreme, at('09:10')).urgent!;
    expect(now.kind).toBe('emergency');
    expect(says(drawn(diabetic, chest, at('09:00')), now)).toBe(false);
    expect(says(drawn(diabetic, extreme, at('09:10')), now)).toBe(true);
  });

  it('a re-check is said by the gate drawn with its low, not by one drawn before the low, nor by a stop of another weight', () => {
    const low = record(diabetic, answered({ glucose: { value: 62, unit: 'mg/dL', measuredAt: iso('13:30') } }));
    const recheck = surface(diabetic, low, at('13:32')).urgent!;
    expect(recheck.kind).toBe('recheck');
    const before = record(diabetic, answered({ glucose: { value: 110, unit: 'mg/dL', measuredAt: iso('13:00') } }));
    expect(says(drawn(diabetic, before, at('13:05')), recheck)).toBe(false);
    expect(says(drawn(diabetic, low, at('13:32')), recheck)).toBe(true);
    const chest = record(diabetic, answered({ urgentSymptoms: true, emergency: ['chest'] }));
    expect(says(drawn(diabetic, chest, at('13:32')), recheck)).toBe(false);
  });

  it('a decision with no sentences of its own is said by nothing, so the surface always stays (review of W-01)', () => {
    // A re-check timed by the stored record while today's reasons hold nothing: no screen can be shown to draw it.
    const today: CheckInRecord = { ...record(diabetic, answered()), readiness: { ...record(diabetic, answered()).readiness, recheckAt: iso('00:10') } };
    const recheck = urgentOf({ profile: diabetic, checkIn: today, checkIns: [today], permissions: allHeld }, at('00:02'), true)!;
    expect(recheck).toMatchObject({ kind: 'recheck', reasons: [] });
    expect(says(drawn(diabetic, undefined, at('00:02')), recheck)).toBe(false);
    expect(says(held('guided'), recheck)).toBe(false);
  });

  it('an answer that allows movement says nothing', () => {
    const fine = record(diabetic, answered({ glucose: { value: 110, unit: 'mg/dL', measuredAt: iso('09:00') } }));
    const chest = record(diabetic, answered({ urgentSymptoms: true, emergency: ['chest'] }));
    const emergency = surface(diabetic, chest, at('09:05')).urgent!;
    expect(drawn(diabetic, fine, at('09:05')).allowed).toBe(true);
    expect(says(drawn(diabetic, fine, at('09:05')), emergency)).toBe(false);
  });
});

describe('withEffectiveToday', () => {
  it('puts today’s effective record in place of the stored one, and leaves the rest', () => {
    const stored = [record(diabetic, answered({}, '2026-10-07')), record(diabetic, answered())];
    const effective = record(diabetic, answered({ news: ['lowSymptoms'] }));
    expect(withEffectiveToday(stored, effective)).toEqual([stored[0], effective]);
    expect(withEffectiveToday(stored, stored[1])).toEqual(stored);
    expect(withEffectiveToday(stored, undefined)).toEqual(stored);
  });
});

describe('recommendSources: whether setup is unfinished (journey §6.4, L-20; board D80)', () => {
  it('says so after Look around first, and not once a record is set up', () => {
    const base = { now: at('09:00'), plan: plan(), checkIns: [] };
    const state = (settings: Partial<UserSettings>, profile?: UserProfile) =>
      ({ settings: settings as UserSettings, ...(profile ? { profile } : {}), sessions: [], observations: [] });
    expect(recommendSources({ ...base, state: state({ onboardingComplete: true, setup: { stage: 'lookAround', skipped: [] as ChapterId[] } }) }).setupOpen).toBe(true);
    expect(recommendSources({ ...base, state: state({ onboardingComplete: true }, diabetic) }).setupOpen).toBe(false);
  });
});
