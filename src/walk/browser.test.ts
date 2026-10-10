/**
 * The real ports, as `liveWalk()` builds them: wiring only (B-19, H6-02).
 * The store is the only thing replaced, so the gate is the production one.
 */
import { describe, expect, it, vi } from 'vitest';
import type { CheckInRecord } from '@/types/checkin';
import { createDefaultProfile } from '@/profile/defaults';
import { evaluateCheckIn, glucoseReadingId } from '@/engine/readiness';
import { toDateString } from '@/lib/utils';
import type { Walk } from './clock';

const NOW = new Date();
const TODAY = toDateString(NOW);
const reading = { value: 140, unit: 'mg/dL' as const, measuredAt: new Date(NOW.getTime() - 5 * 60_000).toISOString(), source: 'meter' as const };
const profile = createDefaultProfile({
  health: { diabetes: 'type2', insulin: 'injections_or_pump', glucoseMonitor: 'meter', currentlyActive: true, clearance: 'moderate', medicinesReviewed: true },
});
const day = { date: TODAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7' as const, energy: 4 as const, glucose: reading };
const state = vi.hoisted(() => ({ value: undefined as unknown }));
vi.mock('@/store/useStore', async importOriginal => {
  const real = await importOriginal<typeof import('@/store/useStore')>();
  return { ...real, getState: () => state.value as ReturnType<typeof real.getState> };
});
state.value = {
  profile, settings: { currentWeight: 80 }, observations: [],
  checkIns: [{ ...day, readiness: evaluateCheckIn(profile, day) } satisfies CheckInRecord],
};

const { browserPorts } = await import('./browser');

describe('the browser’s live walk ports (B-19)', () => {
  it('name the readings the device knows, and ask the gate with the ones a clock change left untimed', () => {
    const ports = browserPorts();
    const known = ports.readingsNow!([TODAY]);
    expect(known).toEqual([glucoseReadingId(reading, TODAY)]);
    const walk = (over: Partial<Walk>) => ({ id: 'a1b2', ...over }) as Walk;
    expect(ports.mayRun('live', walk({}))).toBe(true);
    expect(ports.mayRun('live', walk({ clockChangedAt: NOW.getTime(), untimedReadings: [...known] }))).toBe(false);
    expect(ports.mayRun('restart', walk({ clockChangedAt: NOW.getTime(), untimedReadings: [] }))).toBe(true);
  });

  it('ask this phone’s own route consent, as it is now, at each journal write (H6-04)', () => {
    const ports = browserPorts();
    const was = state.value as { settings: object };
    expect(ports.keepsRoutes!()).toBe(false);
    for (const [saveRoutes, keeps] of [['unasked', false], [false, false], [true, true]] as const) {
      state.value = { ...was, settings: { ...was.settings, walk: { saveRoutes, map: 'off' } } };
      expect(ports.keepsRoutes!()).toBe(keeps);
    }
    state.value = was;
  });
});
