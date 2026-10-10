import { describe, expect, it } from 'vitest';
import type { DailyCheckIn } from '@/types/checkin';
import { neverLooser } from './pending';

const DAY = '2026-10-08';
const at = (h: number, m: number) => new Date(2026, 9, 8, h, m).toISOString();
const day = (over: Partial<DailyCheckIn> = {}): DailyCheckIn => ({ date: DAY, urgentSymptoms: false, emergency: [], news: [], ...over });
const g = (value: number, h: number, m: number) => ({ value, unit: 'mg/dL' as const, measuredAt: at(h, m), source: 'meter' as const });

describe('two copies of one day, never looser than this device’s (H6-03)', () => {
  it('keeps the device’s readings current and the other’s as earlier ones', () => {
    const merged = neverLooser(day({ glucose: g(60, 13, 30) }), day({ glucose: g(110, 13, 15) }));
    expect(merged.glucose).toEqual(g(60, 13, 30));
    expect(merged.glucoseEarlier).toEqual([g(110, 13, 15)]);
  });

  it('adds what either says, and settles nothing with the other’s answers', () => {
    const reading = 'g:x';
    const mistake = { kind: 'severeLow' as const, readings: [reading], resolution: 'mistake' as const, at: at(13, 40) };
    const reopened = { kind: 'severeLow' as const, readings: [reading], resolution: 'reopened' as const, at: at(13, 45) };
    const merged = neverLooser(day({ news: ['stopped'] }), day({ news: ['dizzy'], urgentSymptoms: true, emergency: ['chest'], resolutions: [mistake, reopened] }));
    expect(merged.news.sort()).toEqual(['dizzy', 'stopped']);
    expect(merged.emergency).toEqual(['chest']);
    expect(merged.urgentSymptoms).toBe(true);
    expect(merged.resolutions).toEqual([reopened]);
    const own = neverLooser(day({ resolutions: [mistake] }), day());
    expect(own.resolutions).toEqual([mistake]);
  });

  it('keeps the later “feeling low” moment, so no reading between the two answers it', () => {
    const merged = neverLooser(day({ news: ['lowSymptoms'], lowSymptomsAt: at(13, 30) }), day({ news: ['lowSymptoms'], lowSymptomsAt: at(7, 0) }));
    expect(merged.lowSymptomsAt).toBe(at(13, 30));
    expect(neverLooser(day({ lowSymptomsAt: at(7, 0) }), day({ lowSymptomsAt: at(13, 30) })).lowSymptomsAt).toBe(at(13, 30));
  });
});
