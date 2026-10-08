/**
 * Code review C2-01, through the real callers: a check-in's reading corrected
 * or deleted on its own Track screen (`ReadingDetail`, the correction sheet,
 * the delete confirmation), over the real store and a fake IndexedDB, then a
 * reload, the gates a walk start reads, and the next save of that day's
 * check-in. Nothing here re-implements a save, a merge or a gate.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import type { DailyCheckIn } from '@/types/checkin';
import type { UserProfile } from '@/types/profile';
import { createDefaultProfile } from '@/profile/defaults';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, textOf, type Host, type HostNode } from '@/test/host';

const router = vi.hoisted(() => ({ id: '', navigate: vi.fn() }));
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: router.id }),
  useLocation: () => ({ pathname: `/track/reading/${router.id}`, search: '', state: null }),
  useNavigate: () => router.navigate,
  Link: () => null,
  Navigate: () => null,
}));
vi.mock('@/components/hig/Screen', async () => {
  const { createElement: h } = await import('react');
  return { Screen: ({ title, children }: { title: string; children?: unknown }) => h('main', null, h('h1', null, title), children as never) };
});
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
const { ReadingDetail } = await import('./RecordDetails');
const { effectiveCheckIns, reportSymptoms, resetPendingCheckInsForTests, restorePendingCheckInsForTests } = await import('@/components/checkin/pending');
const { evaluateCheckIn } = await import('@/engine/readiness');
const { permission } = await import('@/engine/permission');
const { checkInDayOf, isBpKind } = await import('@/health/observation');

const DAY = '2026-10-08';
const iso = (h: number, m = 0) => new Date(2026, 9, 8, h, m, 0).toISOString();
const clock = (h: number, m = 0) => vi.setSystemTime(new Date(2026, 9, 8, h, m, 0));
const known = { medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous' as const, glucoseMonitor: 'meter' as const, glucoseUnit: 'mg/dL' as const };
const PROFILE: UserProfile = createDefaultProfile({
  health: {
    ...known, diabetes: 'type2', insulin: 'injections_or_pump', insulinRegimen: 'basalOnly',
    bpMonitor: true, hypertension: 'treated', bpMedicinesReviewed: true, betaBlocker: false, diuretic: false,
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
  router.navigate.mockClear();
  const full = () => (refuse ? new DOMException('Full', 'QuotaExceededError') : undefined);
  fake = fakeIndexedDB({
    failWrite: (_name, row) => (row.key === 'checkIns' || 'kind' in row ? full() : undefined),
    failDelete: () => full(),
  });
  await store.start({ factory: fake, broadcast: null });
});
afterEach(() => {
  host?.unmount();
  host = undefined;
  vi.useRealTimers();
});

async function seed(c: DailyCheckIn) {
  await store.update(prev => ({ ...prev, profile: PROFILE, checkIns: [{ ...c, readiness: evaluateCheckIn(PROFILE, c, []) }] }));
}

async function reload() {
  host?.unmount();
  host = undefined;
  store.resetForTests();
  await store.start({ factory: fake, broadcast: null });
  restorePendingCheckInsForTests();
}

/** The record a walk start reads, through the gate a walk start asks. */
function walk() {
  const list = effectiveCheckIns(store.getState().checkIns, PROFILE);
  const checkIn = list.find(c => c.date === DAY);
  return { checkIn, gate: permission({ profile: PROFILE, ...(checkIn ? { checkIn } : {}), now: new Date(), recent: list }, 'walk') };
}

const ofDay = (kind: string) => store.getState().observations.filter(o => o.kind === kind && checkInDayOf(o) === DAY);
const glucoseSeries = () => ofDay('glucose').map(o => o.value).sort((a, b) => a - b);
const stored = () => store.getState().checkIns.find(c => c.date === DAY);
const report = (news: DailyCheckIn['news']) => reportSymptoms({ news }, { profile: PROFILE, update: store.update, date: DAY });

/** The reading's own screen in Track, as a person reaches it. */
async function open(id: string) {
  host?.unmount();
  router.id = id;
  host = render(createElement(ReadingDetail));
  await host.settle();
  return host;
}

const valueBox = (h: Host): HostNode => h.all().find(n => n.type === 'input' && (n.props.inputMode === 'numeric' || n.props.inputMode === 'decimal'))!;

async function correctTo(id: string, value: string) {
  const h = await open(id);
  await h.click(h.button('Correct this'));
  await h.change(valueBox(h), { value });
  await h.click(h.button('Save correction'));
  await h.settle();
  return h;
}

async function remove(id: string) {
  const h = await open(id);
  await h.click(h.button('Delete this reading'));
  await h.click(h.button('Delete', { exact: true }));
  await h.settle();
  return h;
}

describe('C2-01: a check-in glucose corrected in Track is what every gate reads, and stays corrected', () => {
  const morning: DailyCheckIn = { ...BASE, glucose: { value: 146, unit: 'mg/dL', measuredAt: iso(8, 55), source: 'meter' }, bp: { sys: 124, dia: 78 }, bpReadings: [{ sys: 124, dia: 78, at: iso(8, 56) }] };

  it('corrects the record and the reading in one write: after a reload a walk is held, and the next report keeps 46', async () => {
    await seed(morning);
    expect(walk().gate.allowed).toBe(true);
    const [reading] = ofDay('glucose');

    await correctTo(reading.id, '46');
    await reload();
    expect(stored()!.glucose).toMatchObject({ value: 46, unit: 'mg/dL', measuredAt: iso(8, 55) });
    expect(stored()!.glucoseEarlier ?? []).toEqual([]);
    expect(glucoseSeries()).toEqual([46]);
    expect(ofDay('glucose')[0].id).toBe(reading.id);
    expect(walk().checkIn!.glucose!.value).toBe(46);
    expect(walk().gate.allowed).toBe(false);

    clock(9, 10);
    await report(['dizzy']);
    await reload();
    expect(glucoseSeries()).toEqual([46]);
    expect(stored()!.glucose!.value).toBe(46);
    expect(walk().gate.allowed).toBe(false);
  });

  it('counts a correction the device refused for the gates at once, and says it was not saved', async () => {
    await seed(morning);
    const [reading] = ofDay('glucose');
    refuse = true;
    const h = await correctTo(reading.id, '46');
    expect(h.text()).toMatch(/Not corrected/);
    expect(walk().gate.allowed).toBe(false);
  });

  it('corrects an untimed check-in reading in place, not as a second one', async () => {
    // An older record kept no time for its reading.
    await seed({ ...BASE, glucose: { value: 146, unit: 'mg/dL' } });
    const [reading] = ofDay('glucose');
    await correctTo(reading.id, '46');
    clock(9, 10);
    await report(['dizzy']);
    await reload();
    expect(stored()!.glucose).toEqual({ value: 46, unit: 'mg/dL' });
    expect(glucoseSeries()).toEqual([46]);
    expect(ofDay('glucose')[0].id).toBe(reading.id);
  });

  it('stores one reading when a refused correction is tried again from its guidance', async () => {
    await seed(morning);
    const [reading] = ofDay('glucose');
    refuse = true;
    const h = await correctTo(reading.id, '46');
    expect(h.text()).toMatch(/Not corrected/);
    refuse = false;
    await h.click(h.button('Try saving again'));
    await h.settle();
    await reload();
    expect(stored()!.glucose).toMatchObject({ value: 46, measuredAt: iso(8, 55) });
    expect(stored()!.glucoseEarlier ?? []).toEqual([]);
    expect(glucoseSeries()).toEqual([46]);
    clock(9, 10);
    await report(['dizzy']);
    expect(glucoseSeries()).toEqual([46]);
  });

  it('gives the corrected number a new identity, so an answer about the old one cannot settle it', async () => {
    // An earlier extreme reading answered as assessed by a clinician, then a normal one.
    const day: DailyCheckIn = {
      ...BASE, glucoseEarlier: [{ value: 610, unit: 'mg/dL', measuredAt: iso(8, 40), source: 'meter' }],
      glucose: { value: 130, unit: 'mg/dL', measuredAt: iso(8, 55), source: 'meter' },
    };
    const ids = evaluateCheckIn(PROFILE, day).episodes?.flatMap(e => e.readings.map(r => r.id)) ?? [];
    expect(ids).toHaveLength(1);
    await seed({ ...day, resolutions: [{ kind: 'extremeGlucose', readings: ids, resolution: 'assessed', at: iso(8, 58) }] });
    expect(walk().checkIn!.readiness.unresolved ?? []).toEqual([]);

    // The earlier one is corrected to another extreme number: it is a new incident.
    await correctTo(ofDay('glucose').find(o => o.value === 610)!.id, '650');
    await reload();
    expect(stored()!.glucoseEarlier).toEqual([{ value: 650, unit: 'mg/dL', measuredAt: iso(8, 40), source: 'meter' }]);
    expect(walk().checkIn!.readiness.unresolved).toContain('extremeGlucose');
    expect(walk().gate.allowed).toBe(false);
  });

  it('keeps a check-in reading’s time, and says why, so a correction can never record it twice', async () => {
    await seed(morning);
    const h = await open(ofDay('glucose')[0].id);
    expect(h.text()).toContain('The time can’t be changed here: it is your check-in’s.');
    await h.click(h.button('Correct this'));
    expect(h.all().some(n => n.type === 'input' && n.props.type === 'datetime-local')).toBe(false);
    // Said in the correction sheet itself, where the time would have been.
    const sheet = h.all().find(n => n.props.role === 'dialog')!;
    expect(textOf(sheet.children)).toContain('The time can’t be changed here: it is your check-in’s.');
    await h.change(valueBox(h), { value: '150' });
    await h.click(h.button('Save correction'));
    await h.settle();
    clock(9, 10);
    await report(['dizzy']);
    expect(ofDay('glucose')).toHaveLength(1);
    expect(glucoseSeries()).toEqual([150]);
  });

  it('still lets a glucose added in Track have its time corrected', async () => {
    await store.addObservation({ kind: 'glucose', value: 120, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: '2026-10-08T08:30:00.000+05:30' });
    const own = store.getState().observations.find(o => o.kind === 'glucose')!;
    const h = await open(own.id);
    expect(h.text()).not.toContain('it is your check-in’s');
    await h.click(h.button('Correct this'));
    expect(h.all().some(n => n.type === 'input' && n.props.type === 'datetime-local')).toBe(true);
  });
});

describe('C2-01: a check-in reading deleted in Track leaves the record too, and never comes back', () => {
  it('removes a glucose and a blood pressure from the record and the series; the next report brings neither back', async () => {
    await seed({ ...BASE, glucose: { value: 410, unit: 'mg/dL', measuredAt: iso(8, 50), source: 'meter' }, bp: { sys: 210, dia: 125 }, bpReadings: [{ sys: 210, dia: 125, at: iso(8, 52) }] });
    expect(ofDay('glucose')).toHaveLength(1);
    await remove(ofDay('glucose')[0].id);
    const half = store.getState().observations.find(o => isBpKind(o.kind) && checkInDayOf(o) === DAY)!;
    await remove(half.id);

    await reload();
    expect(ofDay('glucose')).toHaveLength(0);
    expect(store.getState().observations.filter(o => isBpKind(o.kind) && checkInDayOf(o) === DAY)).toHaveLength(0);
    expect(stored()!.glucose).toBeUndefined();
    expect(stored()!.bpReadings ?? []).toEqual([]);
    expect(stored()!.bp).toBeUndefined();

    clock(9, 10);
    await report(['dizzy']);
    await reload();
    expect(ofDay('glucose')).toHaveLength(0);
    expect(store.getState().observations.filter(o => isBpKind(o.kind) && checkInDayOf(o) === DAY)).toHaveLength(0);
    const gates = walk().checkIn!;
    expect([gates.glucose, ...(gates.glucoseEarlier ?? [])].some(g => g && 'value' in g && g.value === 410)).toBe(false);
    expect([...(gates.bpReadings ?? []), ...(gates.bpEarlier ?? [])].some(r => r.sys === 210)).toBe(false);
  });

  it('makes the reading before a deleted latest one the latest again, as it was before', async () => {
    await seed({ ...BASE, glucoseEarlier: [{ value: 60, unit: 'mg/dL', measuredAt: iso(8, 0), source: 'meter' }], glucose: { value: 110, unit: 'mg/dL', measuredAt: iso(8, 20), source: 'meter' } });
    const latest = ofDay('glucose').find(o => o.value === 110)!;
    await remove(latest.id);
    await reload();
    expect(stored()!.glucose).toMatchObject({ value: 60, measuredAt: iso(8, 0) });
    expect(stored()!.glucoseEarlier ?? []).toEqual([]);
    expect(glucoseSeries()).toEqual([60]);
    expect(walk().gate.allowed).toBe(false);
  });

  it('removes an earlier reading and keeps the latest', async () => {
    await seed({ ...BASE, glucoseEarlier: [{ value: 60, unit: 'mg/dL', measuredAt: iso(8, 0), source: 'meter' }], glucose: { value: 110, unit: 'mg/dL', measuredAt: iso(8, 20), source: 'meter' } });
    await remove(ofDay('glucose').find(o => o.value === 60)!.id);
    clock(9, 10);
    await report(['dizzy']);
    await reload();
    expect(stored()!.glucose).toMatchObject({ value: 110 });
    expect(stored()!.glucoseEarlier ?? []).toEqual([]);
    expect(glucoseSeries()).toEqual([110]);
  });

  it('keeps a delete the device refused out of nothing: the reading still counts until the delete is stored', async () => {
    await seed({ ...BASE, glucose: { value: 46, unit: 'mg/dL', measuredAt: iso(8, 50), source: 'meter' } });
    expect(walk().gate.allowed).toBe(false);
    refuse = true;
    const h = await remove(ofDay('glucose')[0].id);
    expect(h.text()).toMatch(/not enough space|Not deleted/i);
    // Still in what the gates read — as the latest or an earlier reading — and still in the series.
    const gates = walk().checkIn!;
    expect([gates.glucose, ...(gates.glucoseEarlier ?? [])].some(g => g && 'value' in g && g.value === 46)).toBe(true);
    expect(walk().gate.allowed).toBe(false);
    expect(ofDay('glucose')).toHaveLength(1);
  });
});

describe('C2-01: a check-in pain score corrected or deleted in Track', () => {
  it('reaches the record a gate reads, and stays as corrected', async () => {
    await seed({ ...BASE, back: { pain: 2, legPain: 1 } });
    const back = ofDay('backPain')[0];
    await correctTo(back.id, '8');
    await reload();
    expect(stored()!.back).toMatchObject({ pain: 8, legPain: 1 });
    expect(walk().checkIn!.back?.pain).toBe(8);
    clock(9, 10);
    await report(['dizzy']);
    expect(ofDay('backPain').map(o => o.value)).toEqual([8]);
  });

  it('leaves the record when deleted, and does not come back', async () => {
    await seed({ ...BASE, back: { pain: 2, legPain: 1 } });
    await remove(ofDay('legPain')[0].id);
    clock(9, 10);
    await report(['dizzy']);
    await reload();
    expect(ofDay('legPain')).toHaveLength(0);
    expect(stored()!.back).toEqual({ pain: 2 });
  });
});

describe('T3-01 and C2-01: a refused blood-pressure correction tried again', () => {
  it('stores one reading, not the old and the new side by side', async () => {
    const { EditPressureSheet } = await import('./EditSheets');
    const { pairBloodPressure } = await import('@/health/aggregate');
    await seed({ ...BASE, bp: { sys: 130, dia: 80 }, bpReadings: [{ sys: 130, dia: 80, at: iso(8, 56) }] });
    const pairs = () => pairBloodPressure(store.getState().observations.filter(o => isBpKind(o.kind) && checkInDayOf(o) === DAY));
    refuse = true;
    host = render(createElement(EditPressureSheet, { open: true, onOpenChange: () => {}, reading: pairs()[0] }));
    await host.settle();
    const boxes = host.all().filter(n => n.type === 'input' && n.props.inputMode === 'numeric');
    await host.change(boxes[0], { value: '190' });
    await host.click(host.button('Save correction'));
    await host.settle();
    expect(host.text()).toMatch(/Not corrected/);
    refuse = false;
    await host.click(host.button('Try saving again'));
    await host.settle();
    await reload();
    expect(stored()!.bpReadings).toEqual([{ sys: 190, dia: 80, at: iso(8, 56) }]);
    expect(stored()!.bpEarlier ?? []).toEqual([]);
    expect(pairs().map(r => [r.systolic, r.diastolic])).toEqual([[190, 80]]);
  });
});

describe('X2-11: Track’s guidance names this person’s own start level, as the check-in does', () => {
  const careful: UserProfile = createDefaultProfile({ health: { ...PROFILE.health, highHypoRisk: true } });

  it('in Quick Log', async () => {
    const { QuickLog } = await import('./QuickLog');
    const { DEFAULT_PREFS } = await import('./format');
    await store.update(prev => ({ ...prev, profile: careful }));
    host = render(createElement(QuickLog, { open: true, onOpenChange: () => {}, initial: { kind: 'glucose' }, onSaved: () => {}, prefs: DEFAULT_PREFS }));
    await host.settle();
    await host.change(valueBox(host), { value: '60' });
    await host.click(host.button('Save', { exact: true }));
    await host.settle();
    expect(host.text()).toContain('Start only when you are 145 mg/dL or above and feel fine.');
  });

  it('in a correction', async () => {
    await store.update(prev => ({ ...prev, profile: careful, checkIns: [{ ...BASE, glucose: { value: 120, unit: 'mg/dL', measuredAt: iso(8, 55) }, readiness: evaluateCheckIn(careful, { ...BASE, glucose: { value: 120, unit: 'mg/dL', measuredAt: iso(8, 55) } }, []) }] }));
    const h = await correctTo(ofDay('glucose')[0].id, '60');
    await h.click(h.button('Yes, just now'));
    expect(h.text()).toContain('Start only when you are 145 mg/dL or above and feel fine.');
  });
});
