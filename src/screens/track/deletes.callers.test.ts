/**
 * Routine deletes through their real screens (B-04, D111, D119, P8-13): a
 * standalone reading, a check-in's reading, a blood pressure, a walk and a
 * workout go at once from their own screen, with no confirmation, offer Undo
 * through the real toast manager on the screen they go back to, and Undo
 * puts each back, or says why it can't; a reading that holds movement is
 * refused in place, and "It was a mistake" lets it go; one the device refuses
 * stays on its screen, saying why. The store, the engine and a fake
 * IndexedDB are real; sonner and the router are stand-ins.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import type { DailyCheckIn } from '@/types/checkin';
import { createDefaultProfile } from '@/profile/defaults';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, type Host } from '@/test/host';

type Shown = { text: string; id?: string; action?: { label: string; onClick: (e: { preventDefault(): void }) => void } };
const sonner = vi.hoisted(() => ({ shown: [] as Shown[], dismissed: [] as string[] }));
vi.mock('sonner', () => ({
  toast: Object.assign((text: string, options: Record<string, unknown> = {}) => { sonner.shown.push({ text, ...options } as Shown); return options.id; }, {
    dismiss: (id: string) => void sonner.dismissed.push(id),
  }),
}));
const router = vi.hoisted(() => ({ id: '', navigate: vi.fn() }));
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: router.id }),
  useLocation: () => ({ pathname: `/track/reading/${router.id}`, search: '', state: { path: '/day/today', label: 'My Day' } }),
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
const { PressureDetail, ReadingDetail, WalkDetail } = await import('./RecordDetails');
const { default: RecordScreen } = await import('@/screens/workout/RecordScreen');
const { NEWER_STAYS, resetPendingCheckInsForTests } = await import('@/components/checkin/pending');
const { evaluateCheckIn } = await import('@/engine/readiness');
const { followPlace, resetUndosForTests } = await import('@/components/hig/undo');
const { HOLD_REFUSAL, MISTAKE_HINT } = await import('@/store/db');
const { MISTAKE_LABEL } = await import('@/components/checkin/HeldProblem');
const { NOT_RECENT, RECENT_MS } = await import('@/store/recent');
const { bpReadingId, checkInDayOf, isBpKind } = await import('@/health/observation');
const { walkRecords } = await import('@/walk/record');

const DAY = '2026-10-08';
const iso = (h: number, m = 0) => new Date(2026, 9, 8, h, m, 0).toISOString();
const PROFILE = createDefaultProfile({ health: { medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous', glucoseMonitor: 'meter', glucoseUnit: 'mg/dL', diabetes: 'type2' } });
const ON_INSULIN = createDefaultProfile({
  health: {
    medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous', glucoseMonitor: 'meter', glucoseUnit: 'mg/dL',
    diabetes: 'type2', insulin: 'injections_or_pump', insulinRegimen: 'basalOnly', bpMonitor: true, hypertension: 'treated', bpMedicinesReviewed: true, betaBlocker: false, diuretic: false,
  },
});
let host: Host | undefined;
let fake: ReturnType<typeof fakeIndexedDB>;

const latest = (id: string) => [...sonner.shown].reverse().find(s => s.id === id)!;
const undoOffers = () => [...new Set(sonner.shown.map(s => s.id!))].filter(id => !sonner.dismissed.includes(id) && latest(id).action?.label === 'Undo').map(latest);
async function open(id: string, screen: unknown = ReadingDetail) {
  host?.unmount();
  router.id = id;
  host = render(createElement(screen as never));
  await host.settle();
  return host;
}
const press = async (h: Host, offer: Shown) => {
  offer.action!.onClick({ preventDefault() {} });
  await h.settle();
};
const deviceFull = () => fake.control.setWriteError(() => new DOMException('The device is full.', 'QuotaExceededError'));
const seedCheckIn = (profile: typeof PROFILE, c: DailyCheckIn) =>
  store.update(prev => ({ ...prev, profile, checkIns: [{ ...c, readiness: evaluateCheckIn(profile, c, []) }] }));
const BASE: DailyCheckIn = { date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4 };
/** A blood pressure as Track's own form stores it: two halves, one reading. */
const pressure = (id: string, sys: number, dia: number, at: string) => (['bloodPressureSystolic', 'bloodPressureDiastolic'] as const).map(kind => ({
  id: `${id}:${kind === 'bloodPressureSystolic' ? 's' : 'd'}`, kind, value: kind === 'bloodPressureSystolic' ? sys : dia, unit: 'mmHg',
  scope: 'pointInTime' as const, source: 'manual' as const, at, context: `bp:${id}`,
}));
const bpOfDay = () => store.getState().observations.filter(o => isBpKind(o.kind));

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 8, 9, 0));
  local.clear();
  sonner.shown.length = 0;
  sonner.dismissed.length = 0;
  router.navigate.mockClear();
  resetUndosForTests();
  store.resetForTests();
  resetPendingCheckInsForTests();
  fake = fakeIndexedDB();
  await store.start({ factory: fake, broadcast: null });
});
afterEach(() => {
  host?.unmount();
  host = undefined;
  vi.useRealTimers();
});

describe('a reading deleted from its own screen (B-04, D111)', () => {
  it('goes at once, with no confirmation, offers Undo on the screen it came from, and Undo puts it back', async () => {
    const saved = await store.addObservation({ kind: 'weight', value: 82, unit: 'kg', scope: 'pointInTime', source: 'manual', at: iso(8) });
    if (!saved.ok) throw saved.failure;
    const h = await open(saved.value.id);
    await h.click(h.button('Delete this reading'));
    expect(h.all().some(n => n.props.role === 'dialog')).toBe(false);
    expect(store.getState().observations.some(o => o.kind === 'weight')).toBe(false);
    expect(router.navigate).toHaveBeenCalled();
    const [offer] = undoOffers();
    expect(offer.text).toMatch(/^Weight .+ deleted$/);
    // Back on the screen it was opened from, it still stands (D113).
    followPlace({ path: '/day/today' });
    expect(undoOffers()).toEqual([offer]);
    offer.action!.onClick({ preventDefault() {} });
    await h.settle();
    expect(store.getState().observations).toEqual([expect.objectContaining({ kind: 'weight', value: 82, restoredFrom: saved.value.id })]);
  });

  it('a check-in’s reading the same way, out of its check-in and back into it, and into the series', async () => {
    const c: DailyCheckIn = { date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, glucose: { value: 118, unit: 'mg/dL', measuredAt: iso(8, 50), source: 'meter' } };
    await store.update(prev => ({ ...prev, profile: PROFILE, checkIns: [{ ...c, readiness: evaluateCheckIn(PROFILE, c, []) }] }));
    const lifted = store.getState().observations.find(o => o.kind === 'glucose' && checkInDayOf(o) === DAY)!;
    const h = await open(lifted.id);
    await h.click(h.button('Delete this reading'));
    expect(store.getState().checkIns[0].glucose).toBeUndefined();
    const [offer] = undoOffers();
    offer.action!.onClick({ preventDefault() {} });
    await h.settle();
    expect(store.getState().checkIns[0].glucose).toMatchObject({ value: 118 });
    expect(store.getState().observations.filter(o => o.kind === 'glucose' && checkInDayOf(o) === DAY)).toEqual([expect.objectContaining({ value: 118, restoredFrom: lifted.id })]);
  });

  it('a 52 that holds movement isn’t deleted: it says why in place, and It was a mistake lets it go (D119)', async () => {
    const c: DailyCheckIn = { date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(8, 50), source: 'meter' } };
    await store.update(prev => ({ ...prev, profile: ON_INSULIN, checkIns: [{ ...c, readiness: evaluateCheckIn(ON_INSULIN, c, []) }] }));
    const low = await store.addObservation({ kind: 'glucose', value: 52, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: iso(8, 58) });
    if (!low.ok) throw low.failure;
    const h = await open(low.value.id);
    await h.click(h.button('Delete this reading'));
    expect(store.getState().observations.some(o => o.id === low.value.id)).toBe(true);
    expect(h.text()).toContain(`${HOLD_REFUSAL} ${MISTAKE_HINT}`);
    expect(undoOffers()).toEqual([]);
    expect(router.navigate).not.toHaveBeenCalled();
    await h.click(h.button(MISTAKE_LABEL));
    await h.settle();
    expect(store.getState().observations.some(o => o.id === low.value.id)).toBe(false);
    expect(undoOffers()).toHaveLength(1);
  });

  it('a check-in’s pain answered again since: Undo says the newer answer stays, and puts nothing back (K8-06)', async () => {
    await seedCheckIn(PROFILE, { ...BASE, back: { legPain: 1 } });
    const leg = store.getState().observations.find(o => o.kind === 'legPain' && checkInDayOf(o) === DAY)!;
    const h = await open(leg.id);
    await h.click(h.button('Delete this reading'));
    expect(store.getState().checkIns[0].back?.legPain).toBeUndefined();
    // Answered again in the check-in.
    expect((await store.update(prev => ({ ...prev, checkIns: (prev.checkIns ?? []).map(c => ({ ...c, back: { ...c.back, legPain: 3 } })) }))).ok).toBe(true);
    const [offer] = undoOffers();
    await press(h, offer);
    expect(latest(offer.id!)).toMatchObject({ text: NEWER_STAYS, action: { label: 'Close' } });
    expect(store.getState().checkIns[0].back?.legPain).toBe(3);
  });

  it('a check-in’s reading no longer in Recently deleted: Undo says so beside Undo again, and nothing comes back', async () => {
    await seedCheckIn(PROFILE, { ...BASE, glucose: { value: 118, unit: 'mg/dL', measuredAt: iso(8, 50), source: 'meter' } });
    const lifted = store.getState().observations.find(o => o.kind === 'glucose' && checkInDayOf(o) === DAY)!;
    const h = await open(lifted.id);
    await h.click(h.button('Delete this reading'));
    vi.setSystemTime(new Date(2026, 9, 8, 9, 0).getTime() + RECENT_MS + 60_000);
    expect((await store.expireDeleted()).ok).toBe(true);
    const [offer] = undoOffers();
    await press(h, offer);
    expect(latest(offer.id!)).toMatchObject({ text: expect.stringContaining(`It wasn’t restored. ${NOT_RECENT}`), action: { label: 'Undo' } });
    expect(store.getState().checkIns[0].glucose).toBeUndefined();
  });
});

describe('a blood pressure deleted from its own screen (B-04, D111, D119)', () => {
  it('goes at once, both halves as one reading, and Undo brings both back as one', async () => {
    expect((await store.addObservations(pressure('r1', 128, 82, iso(8)))).ok).toBe(true);
    const h = await open('r1', PressureDetail);
    await h.click(h.button('Delete this reading'));
    expect(bpOfDay()).toEqual([]);
    const [offer] = undoOffers();
    expect(offer.text).toMatch(/^Blood pressure 128\/82\b.* deleted$/);
    await press(h, offer);
    expect(bpOfDay().map(o => o.value).sort((a, b) => a - b)).toEqual([82, 128]);
    expect(new Set(bpOfDay().map(o => bpReadingId(o.context))).size).toBe(1);
  });

  it('one the device didn’t delete stays on its screen, both halves, saying why', async () => {
    expect((await store.addObservations(pressure('r3', 128, 82, iso(8)))).ok).toBe(true);
    const h = await open('r3', PressureDetail);
    deviceFull();
    await h.click(h.button('Delete this reading'));
    fake.control.setWriteError(undefined);
    expect(bpOfDay()).toHaveLength(2);
    expect(h.text()).toContain('Not deleted:');
    expect(undoOffers()).toEqual([]);
  });

  // Opened as a reading, as an older address does: the reason is kept by the reading's screen.
  it('a check-in’s the device didn’t delete, opened as a reading: it stays, in its check-in too, saying why', async () => {
    await seedCheckIn(PROFILE, { ...BASE, bp: { sys: 124, dia: 78 }, bpReadings: [{ sys: 124, dia: 78, at: iso(8, 52) }] });
    const h = await open(bpOfDay().find(o => checkInDayOf(o) === DAY)!.id);
    deviceFull();
    await h.click(h.button('Delete this reading'));
    fake.control.setWriteError(undefined);
    expect(store.getState().checkIns[0].bpReadings).toEqual([expect.objectContaining({ sys: 124, dia: 78 })]);
    expect(bpOfDay()).toHaveLength(2);
    expect(h.text()).toContain('Not deleted:');
    expect(undoOffers()).toEqual([]);
  });

  it('one of Track’s that holds movement isn’t deleted: why is said in place, with It was a mistake (D119)', async () => {
    await seedCheckIn(ON_INSULIN, BASE);
    expect((await store.addObservations(pressure('r2', 210, 125, iso(8, 58)))).ok).toBe(true);
    const h = await open('r2:s');
    await h.click(h.button('Delete this reading'));
    expect(bpOfDay()).toHaveLength(2);
    expect(h.text()).toContain(`${HOLD_REFUSAL} ${MISTAKE_HINT}`);
    expect(h.buttons(MISTAKE_LABEL)).toHaveLength(1);
    expect(undoOffers()).toEqual([]);
  });

  it('a check-in’s that holds movement the same way (D119)', async () => {
    await seedCheckIn(ON_INSULIN, { ...BASE, bp: { sys: 210, dia: 125 }, bpReadings: [{ sys: 210, dia: 125, at: iso(8, 52) }] });
    const half = bpOfDay().find(o => checkInDayOf(o) === DAY)!;
    const h = await open(half.id);
    await h.click(h.button('Delete this reading'));
    expect(store.getState().checkIns[0].bpReadings).toEqual([expect.objectContaining({ sys: 210, dia: 125 })]);
    expect(h.text()).toContain(`${HOLD_REFUSAL} ${MISTAKE_HINT}`);
    expect(h.buttons(MISTAKE_LABEL)).toHaveLength(1);
    expect(undoOffers()).toEqual([]);
  });
});

describe('a walk deleted from its own screen (B-04, D110, D111)', () => {
  const W = 'mgh3k2x1-1a2b3c4d';
  const walked = (['walkDuration', 'movementMinutes'] as const).map(kind =>
    ({ id: `${W}:s0:${kind}`, kind, value: 20, scope: 'sessionObserved' as const, source: 'measured' as const, at: iso(8), coverageMs: 1_200_000, context: `walk:${W}` }));

  it('goes at once, with what was recorded with it, and Undo brings it back', async () => {
    expect((await store.addObservations(walked)).ok).toBe(true);
    const h = await open(W, WalkDetail);
    await h.click(h.button('Delete this walk'));
    expect(walkRecords(store.getState().observations)).toEqual([]);
    const [offer] = undoOffers();
    expect(offer.text).toBe('Walk deleted');
    await press(h, offer);
    expect(walkRecords(store.getState().observations)).toHaveLength(1);
  });

  it('one the device didn’t delete says why under it, and offers no Undo', async () => {
    expect((await store.addObservations(walked)).ok).toBe(true);
    const h = await open(W, WalkDetail);
    deviceFull();
    await h.click(h.button('Delete this walk'));
    fake.control.setWriteError(undefined);
    expect(h.text()).toContain('This walk was not deleted:');
    expect(walkRecords(store.getState().observations)).toHaveLength(1);
    expect(undoOffers()).toEqual([]);
  });
});

describe('a workout deleted from its record (B-04, D111)', () => {
  const set = { id: 'a', exerciseId: 'goblet-squat', setNumber: 1, plannedReps: 10, actualReps: 10, weight: 20, status: 'completed', rpe: null };
  const session = { id: 's1', date: DAY, dayOfWeek: 'thursday', muscleGroup: 'lower', phase: 'foundation', week: 1, status: 'completed', sets: [set], startedAt: iso(7), completedAt: iso(7, 40), notes: '', totalVolume: 200 };

  it('goes at once, offers Undo on the screen it was opened from, and Undo brings it back', async () => {
    expect((await store.putSession(session as never)).ok).toBe(true);
    const h = await open('s1', RecordScreen);
    await h.click(h.button('Delete workout'));
    expect(store.getState().sessions).toEqual([]);
    followPlace({ path: '/day/today' });
    const [offer] = undoOffers();
    expect(offer.text).toBe('Workout deleted');
    await press(h, offer);
    expect(store.getState().sessions).toHaveLength(1);
    expect(latest(offer.id!)).toMatchObject({ text: 'Workout restored', action: { label: 'Close' } });
  });

  it('an Undo the device didn’t store says why beside Undo again, which then brings it back', async () => {
    expect((await store.putSession(session as never)).ok).toBe(true);
    const h = await open('s1', RecordScreen);
    await h.click(h.button('Delete workout'));
    const [offer] = undoOffers();
    deviceFull();
    await press(h, offer);
    fake.control.setWriteError(undefined);
    expect(latest(offer.id!)).toMatchObject({ text: expect.stringMatching(/^Workout deleted\. It wasn’t restored\. \S/), action: { label: 'Undo' } });
    expect(store.getState().sessions).toEqual([]);
    await press(h, latest(offer.id!));
    expect(store.getState().sessions).toHaveLength(1);
  });

  // The record stays on its screen until the delete is stored, so a refusal is said beside it,
  // never lost with a screen that went for a moment and came back.
  it('one the device didn’t delete stays on its screen, saying why, and offers no Undo', async () => {
    expect((await store.putSession(session as never)).ok).toBe(true);
    const h = await open('s1', RecordScreen);
    deviceFull();
    await h.click(h.button('Delete workout'));
    fake.control.setWriteError(undefined);
    expect(h.text()).toContain('That did not save');
    expect(store.getState().sessions).toHaveLength(1);
    expect(undoOffers()).toEqual([]);
  });
});

describe('F-walk-02: a route deleted from its walk’s screen stays deleted (B-05, D111)', () => {
  const W = 'mgh3k2x1-5c5c5c5c';
  it('a summary still open in another tab, saving the lines it holds, and a checkpoint carrying them, bring none of it back', async () => {
    const { finishWalk, startWalk } = await import('@/walk/clock');
    const { walkSave } = await import('@/walk/save');
    const { journalEntry } = await import('@/walk/journal');
    // The route's drawing asks the browser about motion.
    Object.assign(globalThis, { window: globalThis, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) });
    const t0 = new Date(2026, 9, 8, 8, 0).getTime();
    const walk = finishWalk(startWalk(W, { kind: 'walk', gps: true, steps: false, keepRoute: true, routeGen: 0 }, t0), t0 + 20 * 60_000, 'finish');
    const line = { start: t0, end: t0 + 60_000, coords: [[12.97, 77.59], [12.9705, 77.5902]] as [number, number][], ms: [0, 60_000] };
    expect((await store.setSettings({ walk: { saveRoutes: true, map: 'off' } })).ok).toBe(true);
    expect((await store.saveWalk(walkSave(walk, { route: [line] }))).ok).toBe(true);
    expect(store.getState().records.routes).toHaveLength(1);
    const h = await open(W, WalkDetail);
    await h.click(h.button('Delete this route'));
    await h.click(h.button('Delete route', { exact: true }));
    expect(store.getState().records.routes).toEqual([]);
    // The other tab's summary, unsaved when the walk was saved here, saves it now with its lines.
    expect((await store.saveWalk(walkSave(walk, { route: [line] }))).ok).toBe(true);
    expect(store.getState().records.routes).toEqual([]);
    expect(store.getState().settings.deleted?.records?.routes ?? []).toContain(W);
    // A checkpoint of it, carrying its route, keeps none.
    expect((await store.putWalkJournal(journalEntry(walk, Date.now(), [line]))).ok).toBe(true);
    const kept = await store.readWalkJournals();
    expect(kept.ok && kept.value.find(e => e.id === W)?.route).toBeUndefined();
  });
});
