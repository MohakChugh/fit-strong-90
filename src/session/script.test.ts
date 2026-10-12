import { describe, it, expect } from 'vitest';
import { createDefaultProfile, type ProfileInput } from '@/profile/defaults';
import { buildSessionPlan } from '@/engine/session';
import { getCoaching } from '@/data/coaching';
import { catchUpText, scriptFor, setupLines } from './script';
import { segmentsFor } from '@/engine/timing';
import type { SessionPlan, Step } from '@/types/plan';
import { evaluateCheckIn } from '@/engine/readiness';
import { splitSentences } from '@/voice/sentences';

const START = '2026-09-28';
const DATE = '2026-10-06';

const planFor = (p: ProfileInput) => {
  const profile = createDefaultProfile(p);
  return { profile, plan: buildSessionPlan({ profile, date: DATE, startDate: START, sessions: [] }) };
};
const cuesFor = (profile: ReturnType<typeof createDefaultProfile>, plan: SessionPlan, step: Step, exposures = 0) =>
  scriptFor(step, { profile, plan, coaching: getCoaching, exposures: () => exposures });

describe('narration script', () => {
  it('speaks at least one non-empty cue for every step of a full plan', () => {
    const { profile, plan } = planFor({ pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left' }, health: { diabetes: 'type2' } });
    expect(plan.kind).toBe('full');
    for (const step of plan.steps) {
      const cues = cuesFor(profile, plan, step);
      expect(cues.length, step.id).toBeGreaterThan(0);
      for (const c of cues) {
        expect(c.text.trim(), step.id).not.toBe('');
        expect(c.priority).toBeGreaterThanOrEqual(0);
        expect(c.priority).toBeLessThanOrEqual(3);
      }
    }
  });

  // Spec §4.6: breath-holding spikes blood pressure and eye pressure.
  it.each([
    [{ health: { diabetes: 'type2' } }, true],
    [{ health: { hypertension: 'treated' } }, true],
    [{ health: { retinopathy: 'moderate' } }, true],
    [{}, false],
  ] as [ProfileInput, boolean][])('breathing cue on every set: %o → %s', (p, expected) => {
    const { profile, plan } = planFor(p);
    const sets = plan.steps.filter(s => s.kind === 'set');
    expect(sets.length).toBeGreaterThan(0);
    for (const step of sets) {
      const has = cuesFor(profile, plan, step).some(c => /Never hold your breath/.test(c.text));
      expect(has, step.id).toBe(expected);
    }
  });

  it('announces the affected side first on a unilateral step', () => {
    const { profile, plan } = planFor({ pain: { areas: ['sciatica'], sciaticaSide: 'left' } });
    const sided = plan.steps.find(s => (s.kind === 'hold' || s.kind === 'drill') && s.sides?.length === 2);
    expect(sided).toBeTruthy();
    const first = cuesFor(profile, plan, sided!)[0];
    expect(first.text.toLowerCase()).toContain('left');
  });

  it('ends a countdown exactly at the end of its segment', () => {
    const { profile, plan } = planFor({});
    for (const step of plan.steps) {
      for (const c of cuesFor(profile, plan, step)) {
        if (c.align !== 'end') continue;
        expect(c.offsetMs, `${step.id} ${c.text}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('gives a detailed first exposure and a shorter one later', () => {
    const { profile, plan } = planFor({});
    const step = plan.steps.find(s => s.kind === 'setup');
    expect(step).toBeTruthy();
    const detailed = cuesFor(profile, plan, step!, 0).reduce((n, c) => n + c.text.length, 0);
    const later = cuesFor(profile, plan, step!, 5).reduce((n, c) => n + c.text.length, 0);
    expect(detailed).toBeGreaterThan(later);
  });

  it('names the exercise and side in the catch-up line', () => {
    const { plan } = planFor({ pain: { areas: ['sciatica'], sciaticaSide: 'left' } });
    for (const step of plan.steps) {
      for (const seg of segmentsFor(step)) {
        const text = catchUpText(step, seg.side);
        if (text === null) continue;
        expect(text).toMatch(/^Welcome back\./);
        if (seg.side) expect(text.toLowerCase()).toContain(seg.side);
      }
    }
  });
});

describe('setup lines', () => {
  const rx = { sets: 1, targetReps: 10, rir: 2 };
  it('says "1 set", "1 round" and "1 carry", not "1 sets"', () => {
    const say = (r: Parameters<typeof setupLines>[2]) => setupLines('goblet-squat', 'Goblet Squat', r, undefined, 'detailed').map(l => l.text).join(' ');
    expect(say(rx)).toContain('1 set of 10.');
    expect(say({ ...rx, holdSeconds: 20 })).toContain('1 round of 20 second holds');
    expect(say({ ...rx, carrySeconds: 30 })).toContain('1 carry of 30 seconds');
    expect(say({ ...rx, sets: 3 })).toContain('3 sets of 10.');
  });
});

describe('narration when there is no cardio to do', () => {
  const profile = createDefaultProfile({ equipment: 'homeNone' });
  const plan = buildSessionPlan({ profile, date: '2026-10-08', startDate: START, sessions: [], checkIn: { date: '2026-10-08', urgentSymptoms: false, news: ['footProblem'], sleep: 'gt7', energy: 4 } });
  const all = plan.steps.flatMap(s => cuesFor(profile, plan, s)).map(c => c.say ?? c.text).join(' ');

  it('never sends the user to a machine or promises cardio', () => {
    expect(plan.cardio).toBeNull();
    expect(all).not.toMatch(/treadmill|bike|elliptical|minutes of cardio|for your cardio/i);
  });

  it('welcomes once, introduces the seated flow and ends it without sending anyone to a station', () => {
    expect(all.match(/Welcome\./g)).toHaveLength(1);
    expect(all).toMatch(/seated and floor flow/i);
    const end = plan.steps[plan.steps.length - 2];
    expect(end).toMatchObject({ kind: 'talk', topic: 'transition', title: 'Flow complete' });
    const closing = cuesFor(profile, plan, end).map(c => c.text).join(' ');
    expect(closing).toMatch(/flow done/i);
    expect(closing).not.toMatch(/first station/i);
  });
});

// Contract H-DIZZY and Codex re-audit F13, as the rest's own line on screen:
// told there is a fluid limit the coach never offers water, told there is
// none it may, and not told it says so only conditionally.
describe('water in what the coach says follows the fluid limit', () => {
  const FOCI = ['lowerA', 'upperA', 'lowerB', 'upperB', 'lowerC', 'upperC', 'fullA', 'fullB'] as const;
  /** Every spoken line, and its shorter form, across a full session of each kind. */
  const said = (health: ProfileInput['health']) => {
    const profile = createDefaultProfile({ health: { medicinesReviewed: true, ...health } });
    const out = new Set<string>();
    for (const focus of FOCI) {
      const plan = buildSessionPlan({ profile, date: DATE, startDate: START, sessions: [], focusOverride: focus });
      for (const step of plan.steps) {
        for (const c of cuesFor(profile, plan, step)) for (const t of [c.say ?? c.text, c.short]) if (t) out.add(t);
      }
    }
    return [...out];
  };

  it.each([
    ['a recorded fluid limit', { fluidRestriction: true }],
    ['an unsure answer about one', { fluidRestriction: 'unsure' }],
    ['kidney disease', { kidneyDisease: 'ckd' }],
  ] as [string, ProfileInput['health']][])('with %s no cue says "sip", water or drink; rests and the walk to a station keep to the fluid plan', (_, health) => {
    const lines = said(health);
    expect(lines.filter(l => /\bsip\b|water|drink/i.test(l))).toEqual([]);
    expect(lines.some(l => l.includes('Shake out your arms and legs, breathe slowly, and keep to your fluid plan.'))).toBe(true);
    expect(lines.some(l => l.includes('Keep to your fluid plan, and walk to your first station.'))).toBe(true);
  });

  it('with no fluid limit it still says to sip water; not asked yet, only unless there is a limit', () => {
    const free = said({ fluidRestriction: false });
    expect(free.some(l => l.includes('Shake out your arms and legs, breathe slowly, and sip some water.'))).toBe(true);
    expect(free.some(l => l.includes('Take a sip of water and walk to your first station.'))).toBe(true);
    const unknown = said({});
    expect(unknown.some(l => l.includes('Shake out your arms and legs, breathe slowly, and sip some water unless you have a fluid limit.'))).toBe(true);
    expect(unknown.some(l => l.includes('Take a sip of water unless you have a fluid limit, and walk to your first station.'))).toBe(true);
    expect(unknown.filter(l => /\bsip\b/i.test(l) && !l.includes('unless you have a fluid limit'))).toEqual([]);
  });
});

// Scan X2-19 for the voice: the glucose check before cardio says the number
// the check-in's own line uses (`Under 7.0 mmol/L: keep fast-acting
// carbohydrate within reach…`), in the person's unit. mg/dL is unchanged.
describe('the glucose check before cardio speaks the person’s unit', () => {
  const insulin = (health: ProfileInput['health']) => createDefaultProfile({ health: { medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous', diabetes: 'type2', insulin: 'injections_or_pump', glucoseMonitor: 'meter', ...health } });
  const check = (profile: ReturnType<typeof createDefaultProfile>) => {
    const plan = buildSessionPlan({ profile, date: DATE, startDate: START, sessions: [] });
    const step = plan.steps.find(s => s.kind === 'checkpoint' && s.question === 'glucose')!;
    return cuesFor(profile, plan, step).map(c => c.say ?? c.text).join(' ');
  };
  /** The level the check-in's own carbohydrate line names, for a reading just above the start level. */
  const checkInLevel = (profile: ReturnType<typeof createDefaultProfile>, value: number) => {
    const r = evaluateCheckIn(profile, { date: DATE, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, glucose: { value, unit: profile.health.glucoseUnit, measuredAt: '2026-10-06T08:00:00.000Z', source: 'meter' } });
    return Number(/^Under ([\d.]+) mmol\/L: keep fast-acting carbohydrate/m.exec(r.actions.join('\n'))?.[1]);
  };

  it.each([[{}, 7, 5.5], [{ highHypoRisk: true }, 9, 8.5]] as const)('in mmol/L (%o): under %d mmol/L, the check-in’s own number, and no mg/dL number', (extra, said, reading) => {
    const profile = insulin({ glucoseUnit: 'mmol/L', ...extra });
    const line = check(profile);
    expect(line).toContain(`If you are under ${said} mmol/L, have 15 to 20 grams of fast carbs first.`);
    expect(checkInLevel(profile, reading)).toBe(said);
    expect(line).not.toMatch(/\b126\b|\b162\b/);
    // One recordable sentence: a decimal point would cut it in two.
    expect(splitSentences(line)).toContain(`If you are under ${said} mmol/L, have 15 to 20 grams of fast carbs first.`);
  });

  it('in mg/dL the line is as it was', () => {
    expect(check(insulin({ glucoseUnit: 'mg/dL' }))).toContain('Time to check your glucose before cardio. If you are under 126, have 15 to 20 grams of fast carbs first.');
    expect(check(insulin({ glucoseUnit: 'mg/dL', highHypoRisk: true }))).toContain('If you are under 162, have 15 to 20 grams of fast carbs first.');
  });
});
