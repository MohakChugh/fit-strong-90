import { describe, expect, it } from 'vitest';
import { createDefaultProfile } from '@/profile/defaults';
import { permission, type Mode, type Permission } from '@/engine/permission';
import { evaluateCheckIn } from '@/engine/readiness';
import { recommend, type Recommendation } from '@/health/recommend';
import type { CheckInRecord, DailyCheckIn, Readiness } from '@/types/checkin';
import type { SessionPlan } from '@/types/plan';
import type { UserProfile } from '@/types/profile';
import { urgentOf, withEffectiveToday } from './urgent';

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
  return { r, urgent: urgentOf(r, now, today, true) };
}

const kind = (k: Recommendation['kind'], over: Partial<Recommendation> = {}): Recommendation =>
  ({ kind: k, title: 'Title', detail: '', reason: '', action: { label: 'Review your check-in', to: '/home?checkin=guided' }, ...over });

describe('which decisions are urgent (journey §4.7, B-02)', () => {
  it('an emergency, a stop for today and a re-check, and nothing else the card can say', () => {
    expect(urgentOf(kind('emergency'), at('09:00'))?.kind).toBe('emergency');
    expect(urgentOf(kind('seekHelp'), at('09:00'))?.kind).toBe('seekHelp');
    expect(urgentOf(kind('recheck'), at('09:00'))?.kind).toBe('recheck');
    for (const k of ['hold', 'resume', 'status', 'preference', 'habit', 'scheduled', 'gentle', 'mealWalk', 'plan', 'choose'] as const) {
      expect(urgentOf(kind(k), at('09:00')), k).toBeUndefined();
    }
  });

  it('a low being treated, before its reading: urgent though the card holds it as a hold', () => {
    const c = record(diabetic, answered({ news: ['lowSymptoms'] }));
    const { r, urgent } = surface(diabetic, c, at('09:00'));
    expect(r.kind).toBe('hold');
    expect(urgent).toEqual({ kind: 'low', tone: 'caution', headline: 'Check your glucose now', when: 'Feeling low today' });
  });

  it('ordinary holds are not urgent: no check-in yet, a profile gap, a foot that needs protecting', () => {
    expect(surface(diabetic, undefined, at('09:00')).urgent).toBeUndefined();
    const unreviewed = createDefaultProfile({ needsHealthReview: true });
    expect(surface(unreviewed, undefined, at('09:00')).urgent).toBeUndefined();
    const c = record(footWound, answered());
    expect(surface(footWound, c, at('09:00')).urgent).toBeUndefined();
  });
});

describe('what the surface says: the engine’s headline, when, and the safe action now', () => {
  it('a 62 mg/dL at 1:30 pm: "Low glucose at 1:30 pm · Re-check at 1:45 pm", then "Re-check now"', () => {
    const c = record(diabetic, answered({ glucose: { value: 62, unit: 'mg/dL', measuredAt: iso('13:30') } }));
    expect(surface(diabetic, c, at('13:32')).urgent).toEqual({
      kind: 'recheck', tone: 'caution', headline: 'Re-check your glucose', when: 'Low glucose at 1:30 pm', next: 'Re-check at 1:45 pm',
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
    expect(surface(diabetic, c, at('09:00')).urgent).toEqual({ kind: 'emergency', tone: 'stop', headline: 'Call emergency services now', when: 'Emergency answer today' });
  });

  it('a reading behind a stop is named with the time it was taken', () => {
    const extreme = record(diabetic, answered({ glucose: { value: 650, unit: 'mg/dL', measuredAt: iso('09:05') } }));
    expect(surface(diabetic, extreme, at('09:10')).urgent).toEqual({ kind: 'emergency', tone: 'stop', headline: 'Call emergency services now', when: 'Glucose reading at 9:05 am' });
    const severe = record(diabetic, answered({ glucose: { value: 48, unit: 'mg/dL', measuredAt: iso('09:05') } }));
    expect(surface(diabetic, severe, at('09:10')).urgent).toEqual({
      kind: 'seekHelp', tone: 'stop', headline: 'No exercise today. Get medical advice today.', when: 'Low glucose at 9:05 am',
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
    expect(urgentOf(kind('recheck', { title: 'Re-check your glucose' }), at('00:02'), today, true)).toMatchObject({
      when: 'Glucose reading at 11:55 pm yesterday', next: 'Re-check at 12:10 am',
    });
  });

  it('writes times on the device’s clock', () => {
    const c = record(diabetic, answered({ glucose: { value: 62, unit: 'mg/dL', measuredAt: iso('13:30') } }));
    const { r } = surface(diabetic, c, at('13:32'));
    expect(urgentOf(r, at('13:32'), c, false)).toMatchObject({ when: 'Low glucose at 13:30', next: 'Re-check at 13:45' });
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
