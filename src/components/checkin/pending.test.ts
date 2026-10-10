import { describe, expect, it } from 'vitest';
import type { DailyCheckIn } from '@/types/checkin';
import { neverLooser, withoutAnswersAbout } from './pending';

const DAY = '2026-10-08';
const at = (h: number, m: number) => new Date(2026, 9, 8, h, m).toISOString();
const day = (over: Partial<DailyCheckIn> = {}): DailyCheckIn => ({ date: DAY, urgentSymptoms: false, emergency: [], news: [], ...over });
const g = (value: number, h: number, m: number) => ({ value, unit: 'mg/dL' as const, measuredAt: at(h, m), source: 'meter' as const });

describe('two copies of one day, never looser than this device’s (H6-03)', () => {
  it('keeps the device’s readings current and the other’s as earlier ones', () => {
    const merged = neverLooser(day({ glucose: g(60, 13, 30) }), day({ glucose: g(110, 13, 15) }), new Set());
    expect(merged.glucose).toEqual(g(60, 13, 30));
    expect(merged.glucoseEarlier).toEqual([g(110, 13, 15)]);
  });

  it('adds what either says, and neither settles nor reopens a reading this device holds with the other’s answers (P8-02)', () => {
    const reading = 'g:x';
    const mistake = { kind: 'severeLow' as const, readings: [reading], resolution: 'mistake' as const, at: at(13, 40) };
    const reopened = { kind: 'severeLow' as const, readings: [reading], resolution: 'reopened' as const, at: at(13, 45) };
    const known = new Set([reading]);
    const merged = neverLooser(day({ news: ['stopped'] }), day({ news: ['dizzy'], urgentSymptoms: true, emergency: ['chest'], resolutions: [mistake, reopened] }), known);
    expect(merged.news.sort()).toEqual(['dizzy', 'stopped']);
    expect(merged.emergency).toEqual(['chest']);
    expect(merged.urgentSymptoms).toBe(true);
    expect(merged.resolutions).toBeUndefined();
    const own = neverLooser(day({ resolutions: [mistake] }), day({ resolutions: [reopened] }), known);
    expect(own.resolutions).toEqual([mistake]);
    // The other's answers about its own readings come with them.
    expect(neverLooser(day(), day({ resolutions: [mistake, reopened] }), new Set()).resolutions).toEqual([mistake, reopened]);
  });

  it('leaves out only the readings this device holds from an answer that names others too', () => {
    const both = { kind: 'severeLow' as const, readings: ['g:mine', 'g:theirs'], resolution: 'mistake' as const, at: at(13, 40) };
    expect(withoutAnswersAbout(day({ resolutions: [both] }), new Set(['g:mine'])).resolutions).toEqual([{ ...both, readings: ['g:theirs'] }]);
    const kept = day({ resolutions: [both] });
    expect(withoutAnswersAbout(kept, new Set(['g:other']))).toBe(kept);
    expect(withoutAnswersAbout(kept, new Set(['g:mine', 'g:theirs'])).resolutions).toBeUndefined();
  });

  it('keeps the later “feeling low” moment, so no reading between the two answers it', () => {
    const merged = neverLooser(day({ news: ['lowSymptoms'], lowSymptomsAt: at(13, 30) }), day({ news: ['lowSymptoms'], lowSymptomsAt: at(7, 0) }), new Set());
    expect(merged.lowSymptomsAt).toBe(at(13, 30));
    expect(neverLooser(day({ lowSymptomsAt: at(7, 0) }), day({ lowSymptomsAt: at(13, 30) }), new Set()).lowSymptomsAt).toBe(at(13, 30));
  });
});
