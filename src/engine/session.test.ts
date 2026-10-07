import { describe, it, expect } from 'vitest';
import { createDefaultProfile, type ProfileInput } from '@/profile/defaults';
import type { DailyCheckIn } from '@/types/checkin';
import type { DayFocus, Step } from '@/types/plan';
import { buildSessionPlan } from './session';
import { stepSeconds } from './timing';
import { exposuresIn, REGION_TARGETS } from './mobility';
import type { MobilityRegion } from '@/types/catalog';

const START = '2026-09-28'; // a Monday; 2026-10-05 is week 2

// 2026-10-05 is a Monday → lowerA, Tue upperA … Sat upperC, Sun rest.
const DATES: Record<string, string> = {
  lowerA: '2026-10-05', upperA: '2026-10-06', lowerB: '2026-10-07', upperB: '2026-10-08',
  lowerC: '2026-10-09', upperC: '2026-10-10', rest: '2026-10-11',
};

const PROFILES: Record<string, ProfileInput> = {
  default: {},
  backSciatica: { pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left', worseWith: 'flexion' }, ladder: { hinge: 2, squat: 2, neuralGate: false } },
  insulin: { health: { diabetes: 'type2', insulin: 'injections_or_pump', glucoseMonitor: 'meter', clearance: 'vigorous' } },
  hypertension: { health: { hypertension: 'treated', betaBlocker: true } },
  // Every condition the profile can carry, at home with no equipment: the
  // hardest case for both the safety rules and the time budget.
  everythingAtHome: {
    equipment: 'homeNone',
    pain: { areas: ['lowerBack', 'sciatica', 'hamstring', 'calf'], sciaticaSide: 'right', worseWith: 'flexion' },
    health: {
      diabetes: 'type1', insulin: 'injections_or_pump', sulfonylureaOrMeglitinide: true, sglt2i: true, highHypoRisk: true,
      hypertension: 'treated', betaBlocker: true, diuretic: true, heartOrVascularDisease: true,
      kidneyDisease: 'ckd', retinopathy: 'severe_or_proliferative', peripheralNeuropathy: 'yes',
      footStatus: 'past_ulcer_or_charcot', dizzyOnStandingOrAutonomicNeuropathy: true,
      glucoseMonitor: 'cgm', ketoneTest: 'blood', bpMonitor: true, currentlyActive: false, clearance: 'moderate',
    },
    ladder: { hinge: 0, squat: 0, neuralGate: false },
  },
};

/** Check-ins that change the shape of the session but must not change its length. */
const BUDGET_CHECKINS: Record<string, Partial<DailyCheckIn>> = {
  none: {},
  hot: { news: ['hot'] },
  shortSleep: { sleep: 'lt5' },
  mildBack: { back: { pain: 3, newNeuro: false, caudaEquinaFlag: false } },
  raisedBp: { bp: { sys: 165, dia: 102 } },
};

const plan = (p: ProfileInput, date: string, checkIn?: Partial<DailyCheckIn>, focusOverride?: DayFocus) =>
  buildSessionPlan({
    profile: createDefaultProfile(p), date, startDate: START, sessions: [],
    ...(checkIn ? { checkIn: { date, urgentSymptoms: false, news: [], sleep: 'gt7', energy: 4, ...checkIn } } : {}),
    ...(focusOverride ? { focusOverride } : {}),
  });

describe('60-minute budget', () => {
  for (const [profileName, p] of Object.entries(PROFILES)) {
    for (const [focus, date] of Object.entries(DATES)) {
      if (focus === 'rest') continue;
      it(`${profileName} · ${focus} lands at 60 ± 2 min with exact block starts`, () => {
        const s = plan(p, date);
        expect(s.kind).toBe('full');
        expect(s.focus).toBe(focus);
        expect(s.totalSeconds).toBeGreaterThanOrEqual(3600 - 120);
        expect(s.totalSeconds).toBeLessThanOrEqual(3600 + 120);
        expect(s.blockStarts.intro).toBe(0);
        expect(s.blockStarts.strength).toBe(900);
        expect(s.blockStarts.cardio).toBe(2820);
        expect(s.blockStarts.wrapUp).toBe(3540);
      });
    }
  }

  // A hot day caps cardio; the freed time must come back as cool-down, not vanish.
  for (const [name, checkIn] of Object.entries(BUDGET_CHECKINS)) {
    it(`stays at 60 ± 2 min with a "${name}" check-in, on every profile`, () => {
      for (const p of Object.values(PROFILES)) {
        const s = plan(p, DATES.lowerA, checkIn);
        if (s.kind !== 'full') continue;
        expect(s.totalSeconds, `${name}`).toBeGreaterThanOrEqual(3600 - 120);
        expect(s.totalSeconds, `${name}`).toBeLessThanOrEqual(3600 + 120);
      }
    });
  }

  it('replaces cardio with a seated and floor flow when nothing suitable is to hand, and still lasts an hour', () => {
    const s = plan({ equipment: 'homeNone' }, DATES.upperB, { news: ['footProblem'] });
    expect(s.cardio).toBeNull();
    expect(s.steps.some(x => x.kind === 'cardio')).toBe(false);
    expect(s.changes.join(' ')).toMatch(/no cardio today/i);
    expect(s.totalSeconds).toBeGreaterThanOrEqual(3600 - 120);
    expect(s.totalSeconds).toBeLessThanOrEqual(3600 + 120);
    expect(s.blockStarts.wrapUp).toBe(3540);
  });

  it('fills every strength slot, even for the most restricted home profile (Review Focus #3)', () => {
    for (const date of Object.values(DATES).slice(0, 6)) {
      const s = plan(PROFILES.everythingAtHome, date);
      expect(s.exercises.length).toBeGreaterThanOrEqual(4);
      expect(s.steps.some(x => x.kind === 'set')).toBe(true);
    }
  });

  it('scales to 45 and 75 minute sessions', () => {
    expect(Math.abs(plan({ sessionMinutes: 45 }, DATES.lowerA).totalSeconds - 2700)).toBeLessThanOrEqual(120);
    expect(Math.abs(plan({ sessionMinutes: 75 }, DATES.lowerA).totalSeconds - 4500)).toBeLessThanOrEqual(150);
  });
});

describe('session content', () => {
  it('starts with a welcome and ends with a wrap-up', () => {
    const s = plan({}, DATES.lowerC);
    expect(s.steps[0]).toMatchObject({ kind: 'talk', topic: 'welcome' });
    expect(s.steps.at(-1)).toMatchObject({ kind: 'talk', topic: 'wrapUp' });
  });

  it('puts nerve sliders in the mobility block for sciatica, affected side first', () => {
    const s = plan(PROFILES.backSciatica, DATES.lowerC);
    const slider = s.steps.find(x => x.kind === 'drill' && x.exerciseId.startsWith('sciatic-nerve-glide')) as Extract<Step, { kind: 'drill' }>;
    expect(slider).toBeDefined();
    expect(slider.sides).toEqual(['left', 'right']);
  });

  it('never schedules a straight-leg hamstring hold while leg symptoms are active', () => {
    const s = plan(PROFILES.backSciatica, DATES.lowerC, { back: { pain: 2, legPain: 2, reach: 'thigh', newNeuro: false, caudaEquinaFlag: false } });
    expect(s.steps.some(x => 'exerciseId' in x && x.exerciseId === 'supine-hamstring-stretch-strap')).toBe(false);
    expect(s.exercises.map(e => e.exerciseId)).not.toContain('romanian-deadlift');
  });

  it('keeps the hinge back-safe for a level-2 back profile', () => {
    const s = plan(PROFILES.backSciatica, DATES.lowerC);
    expect(s.exercises[0].exerciseId).toBe('trap-bar-deadlift');
    expect(s.steps.some(x => x.kind === 'checkpoint' && x.question === 'backSymptoms')).toBe(true);
  });

  it('adds a glucose check before cardio for insulin users', () => {
    const s = plan(PROFILES.insulin, DATES.lowerA, { glucose: { value: 150, unit: 'mg/dL' } });
    const cardioStart = s.steps.findIndex(x => x.block === 'cardio');
    expect(s.steps[cardioStart]).toMatchObject({ kind: 'checkpoint', question: 'glucose' });
  });

  it('caps hypertension sets at 3 reps in reserve with the exhale cue', () => {
    const s = plan(PROFILES.hypertension, DATES.lowerA);
    const main = s.exercises[0];
    expect(main.rx.rir).toBeGreaterThanOrEqual(3);
    expect(main.rx.caps.join(' ')).toMatch(/never hold your breath/i);
  });

  it('uses intervals on Upper B for a healthy profile and explains when it cannot', () => {
    expect(plan({}, DATES.upperB).cardio?.format).toBe('intervals');
    const bp = plan({}, DATES.upperB, { bp: { sys: 150, dia: 92 } });
    expect(bp.cardio?.format).toBe('zone2');
    expect(bp.changes.join(' ')).toMatch(/steady cardio instead of intervals/i);
  });

  it('lists exercise swaps with their reason', () => {
    const s = plan(PROFILES.backSciatica, DATES.lowerC);
    expect(s.changes.some(c => /instead of/i.test(c))).toBe(true);
  });
});

describe('variants', () => {
  it('builds a recovery session under 30 minutes on a red back day', () => {
    const s = plan(PROFILES.backSciatica, DATES.lowerC, { back: { pain: 7, newNeuro: false, caudaEquinaFlag: false } });
    expect(s.kind).toBe('recovery');
    expect(s.exercises).toEqual([]);
    expect(s.totalSeconds).toBeLessThanOrEqual(1800);
    expect(s.steps.some(x => x.kind === 'set')).toBe(false);
  });

  it('builds no session on a red day and an empty plan when urgent', () => {
    expect(plan({}, DATES.lowerA, { news: ['unwell'] }).kind).toBe('none');
    const urgent = plan({}, DATES.lowerA, { urgentSymptoms: true });
    expect(urgent.kind).toBe('none');
    expect(urgent.readiness.outcome).toBe('urgent');
  });

  it('offers an optional mobility + walk on rest days', () => {
    expect(plan({}, DATES.rest).kind).toBe('restDay');
    expect(plan({ restDayMobility: false }, DATES.rest).kind).toBe('none');
  });

  it('is deterministic', () => {
    expect(plan(PROFILES.backSciatica, DATES.lowerA)).toEqual(plan(PROFILES.backSciatica, DATES.lowerA));
  });
});

describe('mobility coverage over a week', () => {
  it('covers every region from neck to calves at least its weekly target', () => {
    const profile = createDefaultProfile(PROFILES.backSciatica);
    const sessions: Parameters<typeof buildSessionPlan>[0]['sessions'] = [];
    const counts: Partial<Record<MobilityRegion, number>> = {};
    for (const date of Object.values(DATES).slice(0, 6)) {
      const s = buildSessionPlan({ profile, date, startDate: START, sessions });
      const mob = s.steps.filter(x => x.block === 'mobility' || x.block === 'intro');
      const ex = exposuresIn(mob);
      for (const [r, n] of Object.entries(ex)) counts[r as MobilityRegion] = (counts[r as MobilityRegion] ?? 0) + (n ?? 0);
      sessions.push({
        id: date, date, dayOfWeek: 'monday', muscleGroup: 'lower', phase: 'foundation', week: 2, status: 'completed',
        sets: [], startedAt: null, completedAt: null, notes: '', totalVolume: 0,
        mobility: mob.filter(x => x.kind === 'hold' || x.kind === 'drill').map(x => ({ exerciseId: (x as { exerciseId: string }).exerciseId, seconds: stepSeconds(x) })),
      });
    }
    const short = (Object.keys(REGION_TARGETS) as MobilityRegion[]).filter(r => (counts[r] ?? 0) < Math.min(REGION_TARGETS[r], 6));
    expect(short, JSON.stringify(counts)).toEqual([]);
  });
});
