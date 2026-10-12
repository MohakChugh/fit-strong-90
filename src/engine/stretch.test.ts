import { describe, expect, it } from 'vitest';
import { createDefaultProfile, type ProfileInput } from '@/profile/defaults';
import type { WorkoutSession } from '@/types';
import type { DailyCheckIn } from '@/types/checkin';
import type { SessionPlan, Step, StretchFocus, StretchSpec } from '@/types/plan';
import type { UserProfile } from '@/types/profile';
import { EQUIPMENT_BY_ACCESS, getMeta, hasEquipment } from '@/data/catalog';
import { getCoaching } from '@/data/coaching';
import { scriptFor } from '@/session/script';
import { evaluateCheckIn } from './readiness';
import { activeConditions, evaluateFlags } from './safety';
import { regionsOf } from './mobility';
import { stepSeconds } from './timing';
import {
  buildStretchPlan, DEFAULT_STRETCH, focusRegions, lastStretch, offeredSpec, parseStretchSpec, readStretchSpec,
  specFromPlanId, STRETCH_FOCI, STRETCH_MINUTES, stretchHref, stretchOffered, stretchPlanFor, stretchSummary,
} from './stretch';

const DATE = '2026-10-08';
const START = '2026-09-28';
const BACK: ProfileInput = {
  pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left', worseWith: 'flexion' },
  ladder: { hinge: 2, squat: 2, neuralGate: false },
};
const REVIEWED = { medicinesReviewed: true, metformin: true } as const;

const checkIn = (over: Partial<DailyCheckIn> = {}, date = DATE): DailyCheckIn =>
  ({ date, urgentSymptoms: false, news: [], sleep: 'gt7', energy: 4, ...over });

/** The profiles the brief names, each with the day that matters for it. */
const CASES: Record<string, { profile: ProfileInput; checkIn?: DailyCheckIn; recent?: DailyCheckIn[] }> = {
  irritableSciatica: { profile: BACK, checkIn: checkIn({ back: { pain: 4, legPain: 3, reach: 'thigh', newNeuro: false, caudaEquinaFlag: false } }) },
  quietSciatica: { profile: BACK },
  footWound: { profile: { health: { ...REVIEWED, diabetes: 'type2', peripheralNeuropathy: 'yes', footStatus: 'current_wound_or_active_charcot' } } },
  newFootSore: { profile: { health: { ...REVIEWED, diabetes: 'type2' } }, checkIn: checkIn({ news: ['footProblem'] }) },
  severeRetinopathy: { profile: { health: { ...REVIEWED, diabetes: 'type2', retinopathy: 'severe_or_proliferative' } } },
  noBackIssues: { profile: {} },
  extensionSensitive: { profile: { pain: { areas: ['lowerBack'], worseWith: 'extension', preference: 'none' } } },
  // Low sleep two days running: a recovery day, so the gentle template.
  recoveryDay: { profile: BACK, checkIn: checkIn({ sleep: 'lt5' }), recent: [checkIn({ sleep: 'lt5' }, '2026-10-07')] },
};

const OFFERED: StretchSpec[] = STRETCH_FOCI.flatMap(focus => STRETCH_MINUTES.map(minutes => ({ focus, minutes }))).filter(stretchOffered);

function build(name: string, spec: StretchSpec, sessions: WorkoutSession[] = []): { plan: SessionPlan; profile: UserProfile } {
  const c = CASES[name];
  const profile = createDefaultProfile(c.profile);
  const plan = buildStretchPlan({
    profile, date: DATE, startDate: START, sessions,
    ...(c.checkIn ? { checkIn: c.checkIn } : {}), recentCheckIns: c.recent ?? [], ...spec,
  });
  return { plan, profile };
}

type Movement = Extract<Step, { kind: 'hold' | 'drill' }>;
const movementsOf = (plan: SessionPlan) => plan.steps.filter((s): s is Movement => s.kind === 'hold' || s.kind === 'drill');

/**
 * Today's safety matrix asked of every movement, written out here rather than
 * borrowed from the builder, so the builder cannot pass by agreeing with itself.
 */
function violations(plan: SessionPlan, profile: UserProfile): string[] {
  const c = activeConditions(profile, plan.readiness);
  const out: string[] = [];
  for (const s of movementsOf(plan)) {
    const m = getMeta(s.exerciseId);
    if (!m) { out.push(`${s.exerciseId}: unknown`); continue; }
    const v = evaluateFlags(m.flags, c);
    const hold = s.kind === 'hold' ? s.holdSeconds : 0;
    const bad = (why: string) => out.push(`${s.exerciseId}: ${why}`);
    if (v.excluded) bad(v.reason ?? 'excluded');
    if (v.needsNeuralGate && hold > 30) bad('long hold on an uncleared sciatic nerve');
    if (v.caps.maxHoldSeconds !== undefined && hold > v.caps.maxHoldSeconds) bad('hold over its cap');
    if (m.kind === 'mobility' && m.status === 'excluded') bad('excluded drill');
    if (m.kind === 'mobility' && m.status === 'avoidWhenIrritable' && (c.backIrritable || c.sciaticaActive)) bad('irritable-day drill');
    if (c.sciaticaActive && hold > 30 && regionsOf(s.exerciseId).includes('hamstrings')) bad('long hamstring hold with leg symptoms');
    if (m.flags.endRangeFlexion && c.worseWith === 'flexion' && profile.pain.preference !== 'flexion') bad('end-range flexion');
    if (m.flags.endRangeExtension && c.worseWith === 'extension' && profile.pain.preference !== 'extension') bad('end-range extension');
    if (m.kind === 'strength' && m.ladder && c.ladder[m.ladder.track] < m.ladder.level) bad('above the spinal-loading ladder');
    if (!hasEquipment(m, EQUIPMENT_BY_ACCESS.homeNone)) bad('needs equipment a home does not have');
  }
  return out;
}

describe('buildStretchPlan: time', () => {
  for (const name of Object.keys(CASES)) {
    it(`${name}: every offered routine lasts exactly its length`, () => {
      for (const spec of OFFERED) {
        const { plan } = build(name, spec);
        expect(plan.kind, stretchSummary(spec)).toBe('stretch');
        expect(plan.totalSeconds, stretchSummary(spec)).toBe(spec.minutes * 60);
        expect(plan.steps.reduce((t, s) => t + stepSeconds(s), 0)).toBe(plan.totalSeconds);
      }
    });
  }

  it('does not offer five minutes, or a ten-minute routine for any area but Back & hips', () => {
    expect(STRETCH_MINUTES).toEqual([10, 15]);
    expect(OFFERED).toEqual([
      { focus: 'backHips', minutes: 10 }, { focus: 'backHips', minutes: 15 },
      { focus: 'neckShoulders', minutes: 15 }, { focus: 'hipsLegs', minutes: 15 }, { focus: 'wholeBody', minutes: 15 },
    ]);
  });
});

describe('buildStretchPlan: shape the player runs', () => {
  it('is a welcome, the mobility flow, the flow’s close and a wrap-up', () => {
    for (const name of Object.keys(CASES)) {
      for (const spec of OFFERED) {
        const { plan } = build(name, spec);
        const [first, ...rest] = plan.steps;
        const wrap = rest.at(-1)!;
        const close = rest.at(-2)!;
        expect(first).toMatchObject({ kind: 'talk', topic: 'welcome', block: 'intro' });
        expect(close).toMatchObject({ kind: 'talk', topic: 'transition', block: 'mobility' });
        expect(wrap).toMatchObject({ kind: 'talk', topic: 'wrapUp', block: 'wrapUp', seconds: 60 });
        expect(rest.slice(0, -2).every(s => (s.kind === 'hold' || s.kind === 'drill') && s.block === 'mobility')).toBe(true);
        expect(plan.blockStarts).toEqual({ intro: 0, mobility: stepSeconds(first), wrapUp: plan.totalSeconds - 60 });
        expect(plan).toMatchObject({ exercises: [], cardio: null, stretch: spec, date: DATE });
        expect(new Set(plan.steps.map(s => s.id)).size).toBe(plan.steps.length);
      }
    }
  });

  it('never repeats a movement within a routine', () => {
    for (const name of Object.keys(CASES)) {
      for (const spec of OFFERED) {
        const ids = movementsOf(build(name, spec).plan).map(s => s.exerciseId);
        expect(new Set(ids).size, `${name} ${stretchSummary(spec)}`).toBe(ids.length);
      }
    }
  });

  it('is deterministic', () => {
    expect(build('irritableSciatica', DEFAULT_STRETCH).plan).toEqual(build('irritableSciatica', DEFAULT_STRETCH).plan);
  });

  it('speaks lines the recorded packs already hold: the rest-day welcome and the flow’s close', () => {
    const profile = createDefaultProfile(BACK);
    const { plan } = build('quietSciatica', DEFAULT_STRETCH);
    const ctx = { profile, plan, coaching: getCoaching, exposures: () => 0 };
    expect(scriptFor(plan.steps[0], ctx)[0].text).toBe('Welcome. Today is an easy mobility session.');
    expect(scriptFor(plan.steps.at(-2)!, ctx).map(c => c.text)).toEqual(['That is the flow done. Rise slowly if you were on the floor.']);
  });
});

describe('buildStretchPlan: the safety matrix', () => {
  for (const name of Object.keys(CASES)) {
    it(`${name}: every movement passes today's matrix, the ladder and the home kit`, () => {
      for (const spec of OFFERED) {
        const { plan, profile } = build(name, spec);
        expect(violations(plan, profile), `${name} ${stretchSummary(spec)}`).toEqual([]);
      }
    });
  }

  it('keeps a long nerve-tensioning hold out before the sciatic nerve gate is cleared, even where the core template would add one', () => {
    // Whole body uses the person's own targets (hamstrings first), and a
    // recovery day uses the core template, which holds its first two targets
    // for 45 seconds without asking the nerve gate.
    const { plan } = build('recoveryDay', { focus: 'wholeBody', minutes: 15 });
    expect(plan.kind).toBe('stretch');
    const strap = movementsOf(plan).find(s => s.exerciseId === 'supine-hamstring-stretch-strap');
    expect(strap === undefined || (strap.kind === 'hold' && strap.holdSeconds <= 30)).toBe(true);
  });

  it('swaps to nerve glides with leg symptoms, sore side first, and drops the strap hamstring stretch', () => {
    for (const spec of OFFERED) {
      const ms = movementsOf(build('irritableSciatica', spec).plan);
      const glide = ms.find(s => s.exerciseId.startsWith('sciatic-nerve-glide'));
      expect(glide?.sides, stretchSummary(spec)).toEqual(['left', 'right']);
      expect(ms.some(s => s.exerciseId === 'supine-hamstring-stretch-strap')).toBe(false);
    }
  });

  it('keeps every movement off a foot that needs protecting', () => {
    for (const name of ['footWound', 'newFootSore']) {
      for (const spec of OFFERED) {
        const ms = movementsOf(build(name, spec).plan);
        expect(ms.filter(s => getMeta(s.exerciseId)?.flags.weightBearing).map(s => s.exerciseId), `${name} ${stretchSummary(spec)}`).toEqual([]);
        expect(ms[0].exerciseId).toBe('diaphragmatic-breathing-90-90');
      }
    }
  });

  it('holds no sustained brace and nothing head-down with severe eye disease', () => {
    for (const spec of OFFERED) {
      for (const s of movementsOf(build('severeRetinopathy', spec).plan)) {
        const f = getMeta(s.exerciseId)!.flags;
        expect(f.isometricHold === 2 || f.headBelowHeart === true, s.exerciseId).toBe(false);
      }
    }
  });

  it('has no end-range arching for a back that extension makes worse', () => {
    for (const spec of OFFERED) {
      const ids = movementsOf(build('extensionSensitive', spec).plan).map(s => s.exerciseId);
      expect(ids).not.toContain('prone-press-up');
    }
  });

  it('plans only for the kit most homes have, whatever gym the profile names', () => {
    for (const spec of OFFERED) {
      for (const s of movementsOf(build('noBackIssues', spec).plan)) {
        expect(hasEquipment(getMeta(s.exerciseId)!, EQUIPMENT_BY_ACCESS.homeNone), s.exerciseId).toBe(true);
      }
    }
  });
});

describe('buildStretchPlan: readiness', () => {
  const alarming: Partial<DailyCheckIn>[] = [
    { urgentSymptoms: true },
    { back: { pain: 2, newNeuro: false, caudaEquinaFlag: true } },
    { news: ['unwell'] },
    { news: ['fainted'] },
    { bp: { sys: 190, dia: 125 } },
  ];
  it('makes no plan on a red or urgent day, as the guided session does', () => {
    const profile = createDefaultProfile(BACK);
    for (const over of alarming) {
      const c = checkIn(over);
      expect(['red', 'urgent'], JSON.stringify(over)).toContain(evaluateCheckIn(profile, c).outcome);
      for (const spec of OFFERED) {
        const plan = buildStretchPlan({ profile, date: DATE, startDate: START, sessions: [], checkIn: c, ...spec });
        expect(plan).toMatchObject({ kind: 'none', steps: [], totalSeconds: 0 });
        expect(plan.changes.length).toBeGreaterThan(0);
      }
    }
  });

  it('uses the recovery session’s gentle template on a recovery day, and says so', () => {
    for (const spec of OFFERED) {
      const { plan } = build('recoveryDay', spec);
      expect(plan.readiness.outcome).toBe('recovery');
      expect(plan.mobilityDayType).toBe('core');
      expect(plan.changes.join(' ')).toMatch(/gentle routine/i);
    }
  });

  it('builds from the profile alone when there is no check-in yet', () => {
    const { plan } = build('quietSciatica', DEFAULT_STRETCH);
    expect(plan.kind).toBe('stretch');
    expect(plan.readiness.outcome).not.toBe('red');
  });
});

describe('buildStretchPlan: the chosen area', () => {
  /** Share of a plan's movement time spent in an area's regions. */
  const share = (plan: SessionPlan, focus: StretchFocus) => {
    const ms = movementsOf(plan);
    const inArea = ms.filter(s => regionsOf(s.exerciseId).some(r => focusRegions(focus).includes(r)));
    return inArea.reduce((t, s) => t + stepSeconds(s), 0) / ms.reduce((t, s) => t + stepSeconds(s), 0);
  };

  it('gives each area more of its own regions than any other area’s routine does, at 15 minutes', () => {
    const areas: StretchFocus[] = ['backHips', 'neckShoulders', 'hipsLegs'];
    for (const name of ['quietSciatica', 'noBackIssues', 'footWound', 'severeRetinopathy']) {
      const plans = Object.fromEntries(areas.map(f => [f, build(name, { focus: f, minutes: 15 }).plan]));
      for (const f of areas) {
        for (const other of areas.filter(o => o !== f)) {
          expect(share(plans[f], f), `${name}: ${f} vs ${other}`).toBeGreaterThan(share(plans[other], f));
        }
      }
    }
  });

  it('puts the area into the routine on an ordinary day: a neck movement, a hip and a leg stretch, a hip stretch', () => {
    const has = (plan: SessionPlan, regions: string[], holdOnly = false) =>
      movementsOf(plan).some(s => (!holdOnly || s.kind === 'hold') && !s.exerciseId.startsWith('sciatic-nerve-glide')
        && regionsOf(s.exerciseId).some(r => regions.includes(r)));
    for (const name of ['quietSciatica', 'noBackIssues', 'footWound', 'severeRetinopathy']) {
      expect(has(build(name, { focus: 'neckShoulders', minutes: 15 }).plan, ['neck']), `${name} neck`).toBe(true);
      const legs = build(name, { focus: 'hipsLegs', minutes: 15 }).plan;
      expect(has(legs, ['glutes', 'hipFlexors', 'adductors']) && has(legs, ['hamstrings', 'quads', 'calves']), `${name} hips & legs`).toBe(true);
      expect(has(build(name, { focus: 'backHips', minutes: 15 }).plan, ['glutes', 'hipFlexors'], true), `${name} hips`).toBe(true);
    }
  });

  it('is the same routine whatever this week’s history, so what the coach says never depends on it', () => {
    // The same two neck-heavy sessions, once last week and once this week:
    // equally familiar, but only one of them counts towards this week.
    const neckDay = (date: string): WorkoutSession => ({
      id: date, date, dayOfWeek: 'monday', muscleGroup: 'mobility', phase: 'foundation', week: 2, status: 'completed',
      sets: [], startedAt: null, completedAt: null, notes: '', totalVolume: 0,
      mobility: ['upper-trap-stretch', 'chin-tuck', 'levator-scapulae-stretch', 'cross-body-shoulder-stretch'].map(exerciseId => ({ exerciseId, seconds: 60 })),
    });
    for (const spec of OFFERED) {
      const lastWeek = build('noBackIssues', spec, [neckDay('2026-09-28'), neckDay('2026-09-29')]).plan;
      const thisWeek = build('noBackIssues', spec, [neckDay('2026-10-05'), neckDay('2026-10-06')]).plan;
      expect(thisWeek.steps, stretchSummary(spec)).toEqual(lastWeek.steps);
    }
  });

  it('labels the plan with the area', () => {
    expect(build('noBackIssues', { focus: 'neckShoulders', minutes: 15 }).plan.label).toBe('Neck & shoulders stretch');
  });
});

describe('stretch spec in a URL', () => {
  it('round-trips every offered routine through the player link', () => {
    for (const spec of OFFERED) {
      const href = stretchHref(spec);
      expect(href.startsWith('/session?')).toBe(true);
      expect(parseStretchSpec(new URLSearchParams(href.split('?')[1]))).toEqual(spec);
    }
  });

  it('leaves the guided session and a resume alone', () => {
    for (const q of ['', 'resume=1', 'mode=guided', 'focus=backHips&minutes=10']) {
      expect(parseStretchSpec(new URLSearchParams(q)), q).toBeNull();
    }
  });

  it('falls back to the default for anything it does not recognise, and lengthens a routine that is not offered', () => {
    expect(parseStretchSpec(new URLSearchParams('mode=stretch'))).toEqual(DEFAULT_STRETCH);
    expect(parseStretchSpec(new URLSearchParams('mode=stretch&focus=toes&minutes=5'))).toEqual(DEFAULT_STRETCH);
    expect(parseStretchSpec(new URLSearchParams('mode=stretch&focus=neckShoulders&minutes=10'))).toEqual({ focus: 'neckShoulders', minutes: 15 });
    expect(readStretchSpec(new URLSearchParams('minutes=15'), { focus: 'hipsLegs', minutes: 15 })).toEqual({ focus: 'hipsLegs', minutes: 15 });
    expect(offeredSpec({ focus: 'wholeBody', minutes: 10 })).toEqual({ focus: 'wholeBody', minutes: 15 });
  });

  it('summarises a routine the way the Move tab shows it', () => {
    expect(stretchSummary(DEFAULT_STRETCH)).toBe('10 min · Back & hips');
  });
});

describe('the last routine chosen', () => {
  const session = (date: string, planId: string | undefined, planKind?: WorkoutSession['planKind'], startedAt: string | null = null): WorkoutSession => ({
    id: `${date}-${planId}`, date, dayOfWeek: 'monday', muscleGroup: 'mobility', phase: 'foundation', week: 2, status: 'completed',
    sets: [], startedAt, completedAt: null, notes: '', totalVolume: 0, guided: true, ...(planId ? { planId } : {}), ...(planKind ? { planKind } : {}),
  });

  it('reads a stretch plan id back to its routine, and nothing else', () => {
    const { plan } = build('noBackIssues', { focus: 'hipsLegs', minutes: 15 });
    expect(specFromPlanId(plan.id)).toEqual({ focus: 'hipsLegs', minutes: 15 });
    expect(specFromPlanId('2026-10-08:lowerA:full:green:')).toBeNull();
    expect(specFromPlanId('stretch:2026-10-08:toes:15:green:')).toBeNull();
    expect(specFromPlanId(undefined)).toBeNull();
  });

  it('is the most recent recorded stretch, ignoring programme sessions', () => {
    const sessions = [
      session('2026-10-06', 'stretch:2026-10-06:neckShoulders:15:green:', 'stretch'),
      session('2026-10-07', 'stretch:2026-10-07:hipsLegs:15:green:', 'stretch', '2026-10-07T07:00:00.000Z'),
      session('2026-10-07', 'stretch:2026-10-07:backHips:15:green:', 'stretch', '2026-10-07T19:00:00.000Z'),
      session('2026-10-08', '2026-10-08:lowerA:full:green:', 'full'),
      session('2026-10-09', 'nonsense', 'stretch'),
    ];
    expect(lastStretch(sessions)).toEqual({ focus: 'backHips', minutes: 15 });
    expect(lastStretch(sessions.slice(0, 2))).toEqual({ focus: 'hipsLegs', minutes: 15 });
    expect(lastStretch([])).toEqual(DEFAULT_STRETCH);
    expect(lastStretch([session('2026-10-08', '2026-10-08:lowerA:full:green:', 'full')])).toEqual(DEFAULT_STRETCH);
  });
});

describe('stretchPlanFor', () => {
  it('builds from that day’s check-in and only earlier sessions, like the guided session’s planFor', () => {
    const profile = createDefaultProfile(BACK);
    const today = checkIn({ back: { pain: 4, legPain: 3, reach: 'thigh', newNeuro: false, caudaEquinaFlag: false } });
    const yesterday = { ...checkIn({ sleep: 'lt5' }, '2026-10-07'), readiness: evaluateCheckIn(profile, checkIn({ sleep: 'lt5' }, '2026-10-07')) };
    const earlier: WorkoutSession = {
      id: 'e', date: '2026-10-06', dayOfWeek: 'tuesday', muscleGroup: 'mobility', phase: 'foundation', week: 2, status: 'completed',
      sets: [], startedAt: null, completedAt: null, notes: '', totalVolume: 0,
      mobility: [{ exerciseId: 'cat-cow', seconds: 50 }, { exerciseId: 'bird-dog', seconds: 80 }],
    };
    const later = { ...earlier, id: 'l', date: DATE };
    const data = {
      settings: { startDate: START } as AppDataSettings,
      sessions: [later, earlier],
      checkIns: [yesterday, { ...today, readiness: evaluateCheckIn(profile, today) }],
    };
    const plan = stretchPlanFor(data, profile, DATE, DEFAULT_STRETCH);
    expect(plan).toEqual(buildStretchPlan({
      profile, date: DATE, startDate: START, sessions: [earlier], checkIn: data.checkIns[1], recentCheckIns: [yesterday], ...DEFAULT_STRETCH,
    }));
    expect(plan.readiness.back).toBe('amber');
    // Something logged today never reshapes today's routine.
    expect(stretchPlanFor({ ...data, sessions: [earlier] }, profile, DATE, DEFAULT_STRETCH)).toEqual(plan);
  });
});

type AppDataSettings = Parameters<typeof stretchPlanFor>[0]['settings'];

describe('a declared flare-up chooses the gentler routine on its own (coordinator, status scan)', () => {
  const flare = { startDate: START, statusPeriods: [{ kind: 'flare' as const, from: DATE }] };
  const data = (settings: object, checkIns: DailyCheckIn[] = []) =>
    ({ settings: { startDate: START, ...settings }, sessions: [], checkIns: checkIns.map(c => ({ ...c, readiness: evaluateCheckIn(createDefaultProfile(BACK), c) })) }) as unknown as Parameters<typeof stretchPlanFor>[0];
  const ids = (p: SessionPlan) => p.steps.filter(s => s.kind === 'hold' || s.kind === 'drill').map(s => (s as { exerciseId: string }).exerciseId);
  const avoided = (id: string) => { const m = getMeta(id); return m?.kind === 'mobility' && m.status === 'avoidWhenIrritable'; };

  it('with a back history, the routine an irritable back gets, before any check-in says so', () => {
    const profile = createDefaultProfile(BACK);
    for (const focus of STRETCH_FOCI) {
      const spec = { focus, minutes: 10 as const };
      const normal = stretchPlanFor(data({}), profile, DATE, spec);
      const flared = stretchPlanFor(data(flare), profile, DATE, spec);
      const irritable = stretchPlanFor(data({}, [checkIn({ back: { pain: 4, legPain: 0 } })]), profile, DATE, spec);
      expect(flared.changes, focus).toContain('A gentler routine: your back is in a flare-up.');
      for (const id of ids(flared)) expect(avoided(id), `${focus}: ${id}`).toBe(false);
      if (ids(normal).some(avoided)) expect(ids(flared), focus).not.toEqual(ids(normal));
      expect(ids(flared), focus).toEqual(ids(irritable));
    }
  });

  it('changes nothing for someone with no back history, or a back the check-in already calls irritable', () => {
    const plain = createDefaultProfile({});
    const spec = { focus: 'backHips' as const, minutes: 10 as const };
    expect(ids(stretchPlanFor(data(flare), plain, DATE, spec))).toEqual(ids(stretchPlanFor(data({}), plain, DATE, spec)));
    expect(stretchPlanFor(data(flare), plain, DATE, spec).changes).not.toContain('A gentler routine: your back is in a flare-up.');
    const profile = createDefaultProfile(BACK);
    const sore = [checkIn({ back: { pain: 4, legPain: 0 } })];
    const flaredSore = stretchPlanFor(data(flare, sore), profile, DATE, spec);
    expect(ids(flaredSore)).toEqual(ids(stretchPlanFor(data({}, sore), profile, DATE, spec)));
    expect(flaredSore.changes).not.toContain('A gentler routine: your back is in a flare-up.');
  });
});
