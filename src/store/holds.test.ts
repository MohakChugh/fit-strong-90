import { describe, expect, it } from 'vitest';
import type { Permission } from '@/engine/permission';
import { bpReadingId } from '@/engine/readiness';
import type { Readiness } from '@/types/checkin';
import { emptySnapshot } from './snapshot';
import { clockHoldOn, loosens, looser, measurements, touchesClinical } from './holds';

const ready = (over: Partial<Readiness>): Readiness => ({ outcome: 'green', modifiers: [], back: 'green', nerveFlag: false, reasons: [], actions: [], vigorousLocked: false, capHeavy: false, rpeOnly: true, notices: [], ...over });
const allowed = (over: Partial<Permission> = {}): Permission => ({ mode: 'walk', allowed: true, disposition: 'reassure', reasons: [], restrictions: [], codes: [], needsCheckIn: false, ...over });
const refused = (over: Partial<Permission> = {}): Permission => allowed({ allowed: false, disposition: 'hold', ...over });

describe('what lets a mode do more, as the engine says it (D119)', () => {
  it('a refusal gone, a gentler disposition, or a restriction gone', () => {
    expect(looser(refused(), allowed())).toBe(true);
    expect(looser(refused({ disposition: 'today' }), refused({ disposition: 'hold' }))).toBe(true);
    expect(looser(allowed({ disposition: 'adjust', codes: ['capHeavy'] }), allowed())).toBe(true);
    expect(looser(allowed({ codes: ['INT', 'capHeavy'] }), allowed({ codes: ['INT'] }))).toBe(true);
    expect(looser(allowed(), refused())).toBe(false);
    expect(looser(refused({ disposition: 'hold' }), refused({ disposition: 'today' }))).toBe(false);
    expect(looser(allowed({ codes: ['INT'] }), allowed({ codes: ['INT', 'capHeavy'] }))).toBe(false);
  });
});

describe('what makes the day’s answer less strict (D119)', () => {
  const hold = { code: 'severeLow', message: '', outcome: 'red' as const, disposition: 'today' as const };
  it('a restriction gone, a serious reading no longer asked about, a mode or cap lifted, or a re-check sooner', () => {
    expect(loosens(ready({ reasons: [hold] }), ready({}))).toBe(true);
    expect(loosens(ready({}), ready({ reasons: [hold] }))).toBe(false);
    expect(loosens(ready({ reasons: [{ ...hold, disposition: 'reassure' }] }), ready({}))).toBe(false);
    expect(loosens(ready({ episodes: [{ kind: 'severeLow', readings: [{ id: 'g:1', label: '' }] }] }), ready({}))).toBe(true);
    expect(loosens(ready({ episodes: [{ kind: 'severeLow', readings: [{ id: 'g:1', label: '', settled: 'mistake' }] }] }), ready({}))).toBe(false);
    expect(loosens(ready({ refusedModes: ['walk'] }), ready({}))).toBe(true);
    expect(loosens(ready({ modifiers: ['INT'] }), ready({}))).toBe(true);
    expect(loosens(ready({ capHeavy: true }), ready({}))).toBe(true);
    expect(loosens(ready({ recheckAt: '2026-10-08T09:15:00+05:30' }), ready({ recheckAt: '2026-10-08T09:10:00+05:30' }))).toBe(true);
    expect(loosens(ready({ recheckAt: '2026-10-08T09:10:00+05:30' }), ready({ recheckAt: '2026-10-08T09:15:00+05:30' }))).toBe(false);
  });

  it('a restriction named anew, as strict or stricter, is no restriction gone; one fewer at any level is', () => {
    const r = (code: string, disposition: 'adjust' | 'hold' | 'today' | 'emergency') => ({ code, message: '', outcome: 'red' as const, disposition });
    // A newer reading deleted, so an earlier low is the latest again: still held, under the engine's other name for it.
    expect(loosens(ready({ reasons: [r('lowNotRecovered', 'hold'), r('oneLow', 'adjust')] }), ready({ reasons: [r('low', 'hold'), r('oneLow', 'adjust')] }))).toBe(false);
    // A reading a clinician had seen, corrected into a new incident: stricter.
    expect(loosens(ready({ reasons: [r('extremeGlucoseAssessed', 'today')] }), ready({ reasons: [r('extremeGlucoseEarlier', 'emergency')] }))).toBe(false);
    // Two holds and one gone, or a hold become an adjustment, is fewer.
    expect(loosens(ready({ reasons: [r('low', 'hold'), r('bpSevereUnconfirmed', 'hold')] }), ready({ reasons: [r('low', 'hold')] }))).toBe(true);
    expect(loosens(ready({ reasons: [r('low', 'hold')] }), ready({ reasons: [r('lowEarlier', 'adjust')] }))).toBe(true);
  });
});

describe('which changes are asked about, and what they take away (D119, P8S-01, P8S-03)', () => {
  it('a change to a reading or a check-in, whoever makes it; never one that touches neither', () => {
    const base = { ...emptySnapshot(), observations: [{ id: 'g1', kind: 'glucose' }, { id: 'w1', kind: 'water' }] } as never;
    expect(touchesClinical({ observations: { remove: ['g1'] } }, base)).toBe(true);
    expect(touchesClinical({ observations: { put: [{ id: 'g2', kind: 'glucose' }] } } as never, base)).toBe(true);
    expect(touchesClinical({ checkIns: [] }, base)).toBe(true);
    expect(touchesClinical({ reset: true }, base)).toBe(true);
    expect(touchesClinical({ observations: { remove: ['w1'] } }, base)).toBe(false);
    expect(touchesClinical({ content: { put: { a: 1 } } }, base)).toBe(false);
  });

  it('names each measurement the engine’s own way, so a change takes away only the one it removes', () => {
    const at = (m: number) => `2026-10-08T09:0${m}:00.000+05:30`;
    const day = (bp: { sys: number; dia: number; at: string }[]) => ({ profile: {} as never, checkIns: [{ date: '2026-10-08', urgentSymptoms: false, news: [], logged: { bp } } as never] });
    const before = measurements(day([{ sys: 186, dia: 98, at: at(1) }, { sys: 181, dia: 96, at: at(2) }]));
    const after = measurements(day([{ sys: 181, dia: 96, at: at(2) }]));
    expect([...before.values()].filter(m => !after.has(m.id))).toEqual([{ kind: 'severeBp', id: bpReadingId({ sys: 186, dia: 98, at: at(1) }, '2026-10-08') }]);
  });

  it('the phone’s clock change holds on its days, and not after them (P8S-02)', () => {
    const settings = { walk: { saveRoutes: 'unasked', map: 'unasked', clock: { generation: 1, days: ['2026-10-08', '2026-10-09'] } } } as never;
    expect(clockHoldOn(settings, new Date(2026, 9, 9, 9))).toBe(true);
    expect(clockHoldOn(settings, new Date(2026, 9, 10, 9))).toBe(false);
    expect(clockHoldOn(undefined, new Date(2026, 9, 9, 9))).toBe(false);
    // One seen and not stored yet holds from the moment it is seen (Plan 6's H6F-02).
    expect(clockHoldOn(undefined, new Date(2026, 9, 9, 9), [['2026-10-09']])).toBe(true);
  });
});
