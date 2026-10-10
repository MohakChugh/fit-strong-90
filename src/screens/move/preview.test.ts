import { describe, expect, it } from 'vitest';
import { createDefaultProfile } from '@/profile/defaults';
import { buildStretchPlan } from '@/engine/stretch';
import type { Permission } from '@/engine/permission';
import type { DailyCheckIn } from '@/types/checkin';
import { clock, kitLine, previewRows, talkSeconds, todayLine } from './preview';

const DATE = '2026-10-08';
const back = createDefaultProfile({ pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left', worseWith: 'flexion' }, ladder: { hinge: 2, squat: 2, neuralGate: false } });
const ci = (over: Partial<DailyCheckIn>): DailyCheckIn => ({ date: DATE, urgentSymptoms: false, news: [], sleep: 'gt7', energy: 4, ...over });
const plan = (over?: Partial<DailyCheckIn>, recent: DailyCheckIn[] = []) => buildStretchPlan({
  profile: back, date: DATE, startDate: '2026-09-28', sessions: [], focus: 'backHips', minutes: 15,
  ...(over ? { checkIn: ci(over) } : {}), recentCheckIns: recent,
});
const allowed: Permission = { mode: 'stretch', allowed: true, disposition: 'reassure', reasons: [], restrictions: [], needsCheckIn: false };

describe('previewRows', () => {
  it('lists every movement with its dose and time, and the talk around them adds up to the whole', () => {
    const p = plan();
    const rows = previewRows(p);
    expect(rows.length).toBe(p.steps.filter(s => s.kind === 'hold' || s.kind === 'drill').length);
    expect(rows[0]).toMatchObject({ name: 'March in Place', dose: '30 reps' });
    expect(rows.find(r => r.name === 'Side Plank')?.dose).toBe('2 × 10 s each side');
    expect(rows.find(r => r.name === 'Supine Sciatic Nerve Glide')?.dose).toBe('12 reps each side');
    expect(rows.reduce((t, r) => t + r.seconds, 0) + talkSeconds(p)).toBe(p.totalSeconds);
  });
});

describe('clock', () => {
  it('reads as minutes and seconds', () => {
    expect([clock(0), clock(5), clock(65), clock(600), clock(59.6)]).toEqual(['0:00', '0:05', '1:05', '10:00', '1:00']);
  });
});

describe('kitLine', () => {
  it('names what to have to hand, in plain words', () => {
    expect(kitLine(plan())).toBe('You need a mat.');
    const neck = buildStretchPlan({ profile: back, date: DATE, startDate: '2026-09-28', sessions: [], focus: 'neckShoulders', minutes: 15 });
    expect(kitLine(neck)).toBe('You need a mat and a wall.');
    expect(kitLine({ ...plan(), steps: [] })).toBeNull();
  });
});

describe('todayLine', () => {
  it('says why there is no routine on a stop day', () => {
    expect(todayLine(plan({ news: ['unwell'] }), allowed)).toMatch(/unwell/i);
  });

  it('says what the stretch changed on a recovery day, first', () => {
    const p = plan({ sleep: 'lt5' }, [ci({ sleep: 'lt5' })].map(c => ({ ...c, date: '2026-10-07' })));
    expect(todayLine(p, allowed)).toMatch(/^A gentle routine today/);
  });

  it('gives a refusal the check-in cannot fix its own reason, and leaves a missing check-in to the sheet', () => {
    const held: Permission = { ...allowed, allowed: false, disposition: 'hold', reasons: ['Your foot needs protecting today.'] };
    expect(todayLine(plan(), held)).toBe('Your foot needs protecting today.');
    expect(todayLine(plan(), { ...held, needsCheckIn: true, reasons: ['Check in first.'] })).toBeNull();
  });

  it('is quiet on an ordinary day', () => {
    expect(todayLine(plan(), allowed)).toBeNull();
  });
});
