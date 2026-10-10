import { describe, expect, it } from 'vitest';
import type { HabitSettings } from '@/types/habits';
import { createDefaultProfile } from '@/profile/defaults';
import { newObservation } from '@/health/observation';
import { calendarEvents } from './ics';
import { dailyTimes, nextAfter } from './schedule';
import { conditionBlock, fluidRestriction, waterBlock, waterRecorded, withFluidAnswer } from './water';

describe('waterRecorded', () => {
  const total = (value: number, at: string, source: 'manual' | 'imported' = 'manual') =>
    newObservation({ kind: 'water', scope: 'dayTotal', source, value, at });

  it('is the day\'s latest total, not a sum of the totals written through the day', () => {
    const day = [total(250, '2026-10-08T09:00:00.000+05:30'), total(500, '2026-10-08T11:00:00.000+05:30'), total(750, '2026-10-08T13:00:00.000+05:30')];
    expect(waterRecorded('2026-10-08', day)).toBe(750);
  });

  it('is unknown, not zero, for a day with nothing recorded', () => {
    expect(waterRecorded('2026-10-09', [total(250, '2026-10-08T09:00:00.000+05:30')])).toBeUndefined();
    expect(waterRecorded('2026-10-08', [])).toBeUndefined();
  });
});

const WATER: HabitSettings = { water: { enabled: true, glassMl: 250, everyMinutes: 60, from: '08:00', to: '20:00' } };
const healthy = createDefaultProfile({ weightKg: 80 });

describe('waterBlock', () => {
  it('allows water reminders for a profile with no reason to limit fluids', () => {
    expect(waterBlock(healthy, WATER)).toBeUndefined();
    expect(waterBlock(createDefaultProfile({ health: { diabetes: 'type2', hypertension: 'treated', diuretic: true } }), WATER)).toBeUndefined();
  });

  it('blocks them for kidney disease of any kind, and when unsure', () => {
    for (const kidneyDisease of ['ckd', 'dialysis_or_transplant', 'unsure'] as const) {
      const reason = waterBlock(createDefaultProfile({ health: { kidneyDisease } }), WATER);
      expect(reason, kidneyDisease).toMatch(/kidney/i);
      expect(reason).toMatch(/fluid limit/);
    }
  });

  it('blocks them for a heart or circulation condition, naming heart failure', () => {
    expect(waterBlock(createDefaultProfile({ health: { heartOrVascularDisease: true } }), WATER)).toMatch(/heart failure/);
  });

  it('blocks them when the user said their care team limits fluids, whatever the profile says', () => {
    expect(waterBlock(healthy, { ...WATER, fluidLimit: true })).toMatch(/limit fluids/);
  });

  it('blocks them when the profile records a fluid limit, or the person is not sure', () => {
    const limited = createDefaultProfile({ health: { fluidRestriction: true } });
    const unsure = createDefaultProfile({ health: { fluidRestriction: 'unsure' } });
    expect(waterBlock(limited, WATER)).toMatch(/limit fluids/);
    expect(waterBlock(unsure, WATER)).toMatch(/Ask them first/);
    expect(waterBlock(createDefaultProfile({ health: { fluidRestriction: false } }), WATER)).toBeUndefined();
  });

  it('still reads an answer kept the old way, and prefers the profile\'s own', () => {
    expect(fluidRestriction(healthy, { fluidLimit: true })).toBe(true);
    expect(fluidRestriction(createDefaultProfile({ health: { fluidRestriction: 'unsure' } }), { fluidLimit: false })).toBe('unsure');
    expect(fluidRestriction(healthy, undefined)).toBeUndefined();
    expect(fluidRestriction(undefined, { fluidLimit: true })).toBe(true);
    // A "no" on the profile is the newer answer and stands.
    expect(fluidRestriction(createDefaultProfile({ health: { fluidRestriction: false } }), { fluidLimit: true })).toBe(false);
  });

  it('carries an old answer onto the profile, where it now lives, without overwriting a newer one', () => {
    expect(withFluidAnswer(healthy, { fluidLimit: true }).health.fluidRestriction).toBe(true);
    const own = createDefaultProfile({ health: { fluidRestriction: false } });
    expect(withFluidAnswer(own, { fluidLimit: true })).toBe(own);
    expect(withFluidAnswer(healthy, {})).toBe(healthy);
  });

  it('keeps the conditions separate from the fluid answer, for the setup screen', () => {
    expect(conditionBlock(createDefaultProfile({ health: { fluidRestriction: true } }))).toBeUndefined();
    expect(conditionBlock(createDefaultProfile({ health: { kidneyDisease: 'ckd' } }))).toMatch(/kidney/);
  });

  it('blocks them when the health answers are missing or are unconfirmed defaults', () => {
    expect(waterBlock(undefined, WATER)).toMatch(/health questions/);
    expect(waterBlock(createDefaultProfile({ needsHealthReview: true }), WATER)).toMatch(/review/);
  });

  it('gives one line, never a paragraph', () => {
    for (const profile of [undefined, createDefaultProfile({ health: { kidneyDisease: 'ckd' } }), createDefaultProfile({ health: { heartOrVascularDisease: true } })]) {
      const reason = waterBlock(profile, WATER) ?? '';
      expect(reason).not.toMatch(/\n/);
      expect(reason.length).toBeLessThan(120);
    }
  });
});

describe('a fluid limit silences water everywhere', () => {
  const ckd = createDefaultProfile({ health: { kidneyDisease: 'ckd' } });
  const both: HabitSettings = { ...WATER, sittingBreak: { enabled: true, everyMinutes: 30, from: '09:00', to: '10:00' } };

  it('in the app, even though the stored setting still says on', () => {
    expect(dailyTimes(both, ckd).some(t => t.habit === 'water')).toBe(false);
    expect(nextAfter({ day: '2026-10-08', minute: 7 * 60 }, { habits: WATER, profile: ckd, status: 'normal' })).toBeUndefined();
  });

  it('in the calendar file', () => {
    const events = calendarEvents(both, ckd);
    expect(events.length).toBe(2);
    expect(events.every(e => e.habit === 'sittingBreak')).toBe(true);
    expect(calendarEvents({ ...both, fluidLimit: true }, healthy).some(e => e.habit === 'water')).toBe(false);
    expect(calendarEvents(both, createDefaultProfile({ health: { fluidRestriction: 'unsure' } })).some(e => e.habit === 'water')).toBe(false);
  });
});
