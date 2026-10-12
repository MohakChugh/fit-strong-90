/**
 * Track's round 3 findings, driven through the real callers: the correction
 * sheet, Quick Log's blood-pressure form and the guidance view, over the real
 * store and a fake IndexedDB that can refuse a write, then a reload. Nothing
 * here re-implements a save or a gate; every step is a typed number, a tap or
 * a write the store itself reports.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import type { CheckInRecord, DailyCheckIn } from '@/types/checkin';
import type { UserProfile } from '@/types/profile';
import { createDefaultProfile } from '@/profile/defaults';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, type Host, type HostNode } from '@/test/host';

vi.mock('react-router-dom', () => ({ useNavigate: () => () => {}, Link: () => null }));
vi.mock('@/components/hig/Sheet', async () => {
  const { createElement: h } = await import('react');
  return { Sheet: ({ open, children }: { open: boolean; children?: unknown }) => (open ? h('div', { role: 'dialog' }, children as never) : null) };
});

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;
Object.assign(globalThis, { document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} } });

const store = await import('@/store/useStore');
const { EditPressureSheet } = await import('./EditSheets');
const { QuickLog } = await import('./QuickLog');
const { Guidance } = await import('./Guidance');
const { glucoseEscalation } = await import('./escalation');
const { DEFAULT_PREFS } = await import('./format');
const { effectiveCheckIns, resetPendingCheckInsForTests, withPressureCorrected } = await import('@/components/checkin/pending');
const { evaluateCheckIn } = await import('@/engine/readiness');
const { liveGate, startGate } = await import('@/session/gate');
const { pairBloodPressure } = await import('@/health/aggregate');
const { bpReadingId } = await import('@/health/observation');

const DAY = '2026-10-08';
const iso = (h: number, m = 0, s = 0) => new Date(2026, 9, 8, h, m, s).toISOString();
const clock = (h: number, m = 0, s = 0) => vi.setSystemTime(new Date(2026, 9, 8, h, m, s));
const PROFILE: UserProfile = createDefaultProfile({
  health: {
    medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous', glucoseMonitor: 'meter', glucoseUnit: 'mg/dL',
    diabetes: 'type2', metformin: true, hypertension: 'treated', bpMonitor: true, bpMedicinesReviewed: true, betaBlocker: false, diuretic: false,
  },
});
const BASE: DailyCheckIn = { date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4 };

let refuse = false;
let fake: ReturnType<typeof fakeIndexedDB>;
let host: Host | undefined;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  clock(9);
  local.clear();
  store.resetForTests();
  resetPendingCheckInsForTests();
  refuse = false;
  fake = fakeIndexedDB({
    failWrite: (_name, row) => (refuse && (row.key === 'checkIns' || 'kind' in row) ? new DOMException('Full', 'QuotaExceededError') : undefined),
  });
  await store.start({ factory: fake, broadcast: null });
});
afterEach(() => {
  host?.unmount();
  host = undefined;
  vi.useRealTimers();
});

async function seed(records: DailyCheckIn[]) {
  const recs = records.map((c, i) => ({ ...c, readiness: evaluateCheckIn(PROFILE, c, records.slice(0, i)) }));
  await store.update(prev => ({ ...prev, profile: PROFILE, checkIns: recs }));
}

/** What a movement caller gets: the effective check-in, through the shared Start and live gates. */
function gates() {
  const list = effectiveCheckIns(store.getState().checkIns, PROFILE);
  const checkIn = list.find(c => c.date === DAY);
  const input = { profile: PROFILE, ...(checkIn ? { checkIn } : {}), now: new Date(), recent: list };
  return { start: startGate(input, 'walk'), live: liveGate(input, 'walk') };
}

const checkInReading = () => pairBloodPressure(store.getState().observations.filter(o => bpReadingId(o.context)?.startsWith('checkIn:')))[0];
const stored = (): CheckInRecord | undefined => store.getState().checkIns.find(c => c.date === DAY);

async function reload() {
  store.resetForTests();
  await store.start({ factory: fake, broadcast: null });
}

/** Open the reading's correction sheet, type the numbers and save, as a person would. */
async function correct(numbers: { sys?: string; dia?: string }, then?: (h: Host) => Promise<void>) {
  host?.unmount();
  host = render(createElement(EditPressureSheet, { open: true, onOpenChange: () => {}, reading: checkInReading() }));
  await host.settle();
  if (numbers.sys) await host.change(host.field('Top (systolic)'), { value: numbers.sys });
  if (numbers.dia) await host.change(host.field('Bottom (diastolic)'), { value: numbers.dia });
  await then?.(host);
  await host.click(host.button('Save correction'));
  await host.settle();
}

describe('T3-01: a corrected check-in reading reaches the record every gate reads', () => {
  const morning = { ...BASE, glucose: { value: 140, unit: 'mg/dL' as const, measuredAt: iso(8, 55) } };

  it('updates the reading, the record and its summary in one write, and holds Start and live movement after a reload', async () => {
    await seed([{ ...morning, bp: { sys: 130, dia: 80 }, bpReadings: [{ sys: 130, dia: 80, at: iso(8, 56) }] }]);
    expect(gates().start.allowed).toBe(true);

    await correct({ sys: '190' });
    await host!.click(host!.button('Yes, just now'));
    expect(host!.text()).toContain('Corrected on this device');
    expect(host!.text()).toContain('no exercise today');

    await reload();
    expect(stored()!.bpReadings).toEqual([{ sys: 190, dia: 80, at: iso(8, 56) }]);
    expect(stored()!.bp).toEqual({ sys: 190, dia: 80 });
    // A typo replaced, not a second reading: the old number is not kept as earlier.
    expect(stored()!.bpEarlier ?? []).toEqual([]);
    const shown = checkInReading();
    expect([shown.systolic, shown.diastolic]).toEqual([190, 80]);
    expect(pairBloodPressure(store.getState().observations)).toHaveLength(1);
    const g = gates();
    expect(g.start.allowed).toBe(false);
    expect(g.live?.allowed).toBe(false);
  });

  it('counts a refused correction for the gates at once, and says it was not saved', async () => {
    await seed([{ ...morning, bp: { sys: 130, dia: 80 }, bpReadings: [{ sys: 130, dia: 80, at: iso(8, 56) }] }]);
    refuse = true;
    await correct({ sys: '190' });
    expect(host!.text()).toMatch(/Not corrected: /);
    expect(gates().start.allowed).toBe(false);
    expect(checkInReading().systolic).toBe(130);
  });

  it('gives the corrected number a new identity: an answer about the old one does not settle it', async () => {
    // An earlier severe reading, answered as typed wrongly, then a normal one.
    const day = { ...morning, bpEarlier: [{ sys: 185, dia: 95, at: iso(8, 40) }], bp: { sys: 130, dia: 80 }, bpReadings: [{ sys: 130, dia: 80, at: iso(8, 56) }] };
    const ids = evaluateCheckIn(PROFILE, day).episodes?.find(e => e.kind === 'severeBp')?.readings.map(r => r.id) ?? [];
    expect(ids).toHaveLength(1);
    await seed([{ ...day, resolutions: [{ kind: 'severeBp', readings: ids, resolution: 'mistake', at: iso(8, 58) }] }]);
    expect(gates().start.allowed).toBe(true);

    // The earlier reading is the one opened (08:40), corrected to another severe number.
    expect(checkInReading().systolic).toBe(185);
    await correct({ sys: '190' });
    await reload();
    expect(stored()!.bpEarlier).toEqual([{ sys: 190, dia: 95, at: iso(8, 40) }]);
    expect(stored()!.bpReadings).toEqual([{ sys: 130, dia: 80, at: iso(8, 56) }]);
    expect(gates().start.allowed).toBe(false);
  });
});

describe('T3-03: a value-only correction keeps a time that was never recorded', () => {
  it('keeps "time not recorded" on both halves of an older check-in reading through a reload', async () => {
    clock(9, 0);
    await seed([{ ...BASE, date: '2026-10-01', bp: { sys: 130, dia: 80 } }]);
    const before = checkInReading();
    expect(before.halves.every(h => h.timeUnknown === true)).toBe(true);

    await correct({ sys: '135' }, async () => {});
    await reload();
    const after = checkInReading();
    expect(after.systolic).toBe(135);
    expect(after.halves.every(h => h.timeUnknown === true)).toBe(true);
    expect(after.halves.map(h => h.id).sort()).toEqual(before.halves.map(h => h.id).sort());
    expect(store.getState().checkIns.find(c => c.date === '2026-10-01')!.bp).toEqual({ sys: 135, dia: 80 });
  });

  it('keeps the unrecorded time when the reading has outlived its check-in summary', async () => {
    await seed([{ ...BASE, date: '2026-10-01', bp: { sys: 130, dia: 80 } }]);
    await store.removeCheckIn('2026-10-01');
    await correct({ sys: '136' });
    await reload();
    const after = checkInReading();
    expect(after.systolic).toBe(136);
    expect(after.halves.every(h => h.timeUnknown === true)).toBe(true);
  });
});

describe('which check-in reading a correction is of', () => {
  const day: DailyCheckIn = { ...BASE, bpReadings: [{ sys: 130, dia: 80, at: iso(8, 56) }, { sys: 130, dia: 80, at: iso(9, 2) }], bp: { sys: 130, dia: 80 } };

  it('is found by its time and its numbers: the same numbers at another time are another reading', () => {
    const fixed = withPressureCorrected(day, { at: iso(9, 2), was: { sys: 130, dia: 80 }, to: { sys: 190, dia: 80 } });
    expect(fixed?.bpReadings).toEqual([{ sys: 130, dia: 80, at: iso(8, 56) }, { sys: 190, dia: 80, at: iso(9, 2) }]);
    expect(fixed?.bp).toEqual({ sys: 160, dia: 80 });
  });

  it('is found by its time alone once its number was corrected on its own before, and not at all when nothing fits', () => {
    expect(withPressureCorrected(day, { at: iso(9, 2), was: { sys: 128, dia: 80 }, to: { sys: 190, dia: 80 } })?.bpReadings?.[1]).toMatchObject({ sys: 190 });
    expect(withPressureCorrected(day, { at: iso(10, 0), was: { sys: 128, dia: 80 }, to: { sys: 190, dia: 80 } })).toBeUndefined();
  });
});

describe('T3-04: clearing a reading’s timing saves', () => {
  it('removes Morning from both halves when the chip is cleared, through a reload', async () => {
    await store.putBloodPressure({ systolic: 132, diastolic: 84, at: '2026-10-08T07:30:00.000+05:30', tag: 'morning', readingId: 'reading-x' });
    const reading = pairBloodPressure(store.getState().observations)[0];
    host = render(createElement(EditPressureSheet, { open: true, onOpenChange: () => {}, reading }));
    await host.settle();
    await host.click(host.button('Morning'));
    await host.click(host.button('Save correction'));
    await reload();
    const halves = store.getState().observations.filter(o => bpReadingId(o.context) === 'reading-x');
    expect(halves).toHaveLength(2);
    expect(halves.map(h => h.tag)).toEqual([undefined, undefined]);
  });

  it('leaves the timing alone when it is not touched', async () => {
    await store.putBloodPressure({ systolic: 132, diastolic: 84, at: '2026-10-08T07:30:00.000+05:30', tag: 'morning', readingId: 'reading-y' });
    const reading = pairBloodPressure(store.getState().observations)[0];
    host = render(createElement(EditPressureSheet, { open: true, onOpenChange: () => {}, reading }));
    await host.settle();
    await host.change(host.field('Top (systolic)'), { value: '134' });
    await host.click(host.button('Save correction'));
    const halves = store.getState().observations.filter(o => bpReadingId(o.context) === 'reading-y');
    expect(halves.map(h => h.tag)).toEqual(['morning', 'morning']);
  });
});

describe('T3-02: looking at the first reading’s time does not change it', () => {
  /** The number boxes in screen order — top and bottom of the first reading, then of the second. (The host's ids repeat, so labels cannot be used.) */
  const boxes = (h: Host): HostNode[] => h.all().filter(n => n.type === 'input' && n.props.inputMode === 'numeric');

  async function pair(gapSeconds: number) {
    clock(7, 42, 30);
    host = render(createElement(QuickLog, { open: true, onOpenChange: () => {}, initial: { kind: 'bloodPressure' }, onSaved: () => {}, prefs: DEFAULT_PREFS }));
    await host.settle();
    await host.change(boxes(host)[0], { value: '130' });
    await host.change(boxes(host)[1], { value: '80' });
    await host.click(host.button('Add a second reading'));
    // Opening the time to look at it, and leaving it as it is.
    await host.click(host.button(/First reading’s time/));
    expect(host.text()).toContain('Sit quietly. Take the second reading in a minute.');
    clock(7, 42, 30 + gapSeconds);
    await host.change(boxes(host)[2], { value: '132' });
    await host.change(boxes(host)[3], { value: '82' });
    await host.click(host.button('Save', { exact: true }));
    await host.settle();
    const ats = store.getState().observations.filter(o => o.kind === 'bloodPressureSystolic').map(o => Date.parse(o.at)).sort();
    return (ats[1] - ats[0]) / 1000;
  }

  it('keeps a 30-second pair 30 seconds apart', async () => {
    expect(await pair(30)).toBe(30);
  });

  it('keeps a 59-second pair 59 seconds apart', async () => {
    expect(await pair(59)).toBe(59);
  });
});

describe('T3-05: a second tap on retry cannot close the help', () => {
  it('keeps the retry control in place, disabled, and Done where it was, when the retry succeeds at once', async () => {
    const onDone = vi.fn();
    const retry = vi.fn(async () => undefined);
    host = render(createElement(Guidance, {
      shown: { figure: '600', unit: 'mg/dL', escalation: glucoseEscalation(600, 'mg/dL')!, pending: Promise.resolve('Storage is full'), retry },
      onDone,
    }));
    await host.settle();
    const order = () => host!.all().filter(n => n.type === 'button').map(n => String(n.children.join(' ')).trim());
    expect(host.text()).toContain('Not saved: Storage is full');
    const before = order();
    await host.click(host.button('Try saving again'));
    await host.settle();
    expect(retry).toHaveBeenCalledTimes(1);
    expect(host.text()).toContain('Saved on this device');
    // The control the finger is on is still there, and does nothing now.
    const control = host.button(/Saved|Saving/);
    expect(control.props.disabled).toBe(true);
    await expect(host.click(control)).rejects.toThrow(/disabled/);
    expect(order().length).toBe(before.length);
    expect(onDone).not.toHaveBeenCalled();
    expect(host.text()).toContain('Get emergency medical help now.');
  });
});
