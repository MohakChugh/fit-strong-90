import { describe, it, expect } from 'vitest';
import { createDefaultProfile } from './defaults';

describe('createDefaultProfile', () => {
  it('defaults to six training days, 60 minutes and no conditions', () => {
    const p = createDefaultProfile();
    expect(p.trainingDays).toEqual(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']);
    expect(p.sessionMinutes).toBe(60);
    expect(p.health.diabetes).toBe('none');
    expect(p.health.hypertension).toBe('none');
    expect(p.pain.areas).toEqual([]);
    expect(p.ladder).toEqual({ hinge: 3, squat: 3, neuralGate: true });
    expect(p.voice.rate).toBeCloseTo(0.85);
  });

  it('merges nested overrides without dropping sibling defaults', () => {
    const p = createDefaultProfile({
      pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left' },
      health: { diabetes: 'type2' },
    });
    expect(p.pain.areas).toEqual(['lowerBack', 'sciatica']);
    expect(p.pain.sciaticaSide).toBe('left');
    expect(p.pain.preference).toBe('untested');
    expect(p.health.diabetes).toBe('type2');
    expect(p.health.glucoseUnit).toBe('mg/dL');
  });

  it('never shares nested objects between profiles', () => {
    const a = createDefaultProfile();
    const b = createDefaultProfile();
    a.health.diabetes = 'type1';
    expect(b.health.diabetes).toBe('none');
  });
});
