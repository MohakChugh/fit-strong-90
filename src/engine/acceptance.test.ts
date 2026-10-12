/**
 * Engine wording the acceptance suite checks (2026-10-08 run): what a reason
 * says must be exactly what the readings and the profile hold.
 */

import { describe, expect, it } from 'vitest';
import { createDefaultProfile } from '@/profile/defaults';
import type { DailyCheckIn } from '@/types/checkin';
import { evaluateCheckIn } from './readiness';

const NOW = new Date(2026, 9, 8, 9, 0, 0);
const at = (minutesAgo: number) => new Date(NOW.getTime() - minutesAgo * 60_000).toISOString();
const ci = (over: Partial<DailyCheckIn> = {}): DailyCheckIn => ({ date: '2026-10-08', urgentSymptoms: false, emergency: [], news: [], ...over });
const known = { medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous' as const, glucoseMonitor: 'meter' as const, bpMonitor: true };

describe('J04 step 2: a severe pair is named by what was severe in each reading', () => {
  it('190/80 then 150/121 names the top 190 and the bottom 121, and never says the top stayed high', () => {
    const r = evaluateCheckIn(createDefaultProfile({ health: known }), ci({ bpReadings: [{ sys: 190, dia: 80, at: at(2) }, { sys: 150, dia: 121, at: at(1) }] }));
    const text = r.reasons.find(x => x.code === 'bpSevere')!.message;
    expect(text).toMatch(/top number 190, then bottom number 121/);
    expect(text).not.toMatch(/still that high/);
    expect(r.disposition).toBe('today');
  });

  it('a reading severe in both numbers is named whole, and the order is the order taken', () => {
    const r = evaluateCheckIn(createDefaultProfile({ health: known }), ci({ bpReadings: [{ sys: 150, dia: 125, at: at(1) }], bpEarlier: [{ sys: 185, dia: 122, at: at(3) }] }));
    expect(r.reasons.find(x => x.code === 'bpSevere')!.message).toMatch(/185\/122, then bottom number 125/);
  });
});

describe('the start level says whose it is', () => {
  const insulin = { ...known, diabetes: 'type2' as const, insulin: 'injections_or_pump' as const, insulinRegimen: 'basalOnly' as const };
  const below = (health: object, glucose: number) =>
    evaluateCheckIn(createDefaultProfile({ health }), ci({ glucose: { value: glucose, unit: 'mg/dL', measuredAt: at(1) } })).reasons.find(x => x.code === 'belowStart')?.message ?? '';

  it('the care team’s own number', () => {
    expect(below({ ...insulin, clinicianTargets: { glucoseStartMin: 120 } }, 110)).toMatch(/your care team’s start level/);
  });
  it('the standard number for the medicines is not called the person’s own', () => {
    const text = below(insulin, 85);
    expect(text).toMatch(/the start level with your medicines/);
    expect(text).not.toMatch(/your start level|care team/);
  });
});
