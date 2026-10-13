/**
 * Today's log's "Recently deleted" (J§20.4 rule 6, board D109) through the
 * real screens, the real store and a fake IndexedDB: the row and its count
 * on today's log only, a day emptied by its deletes included; its sheet,
 * newest first, each Restore named by what it is; Restore through each
 * kind's own rules, said under the list, its Undo gone and its row out of
 * the list; a check-in's reading already back, said so; one that can't be
 * restored, said why; the routes it holds, and counts-free as it is now.
 * The router, sonner, the screen frame and the sheet are stand-ins.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import type { DailyCheckIn } from '@/types/checkin';
import { createDefaultProfile } from '@/profile/defaults';
import type { StoredRecord } from '@/store/records';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, type Host } from '@/test/host';

type Shown = { text: string; id?: string };
const sonner = vi.hoisted(() => ({ shown: [] as Shown[], dismissed: [] as string[] }));
vi.mock('sonner', () => ({
  toast: Object.assign((text: string, options: Record<string, unknown> = {}) => { sonner.shown.push({ text, ...options } as Shown); return options.id; }, {
    dismiss: (id: string) => void sonner.dismissed.push(id),
  }),
}));
vi.mock('react-router-dom', async () => {
  const { createElement: h } = await import('react');
  return {
    useParams: () => ({}),
    useLocation: () => ({ pathname: '/day/today', search: '', state: null, key: 'k0' }),
    useNavigate: () => () => undefined,
    useSearchParams: () => [new URLSearchParams(), () => {}],
    Link: ({ children }: { children?: unknown }) => h('a', null, children as never),
    Navigate: () => null,
  };
});
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
Object.assign(globalThis, {
  window: globalThis,
  document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {}, getElementById: () => null },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
});

const store = await import('@/store/useStore');
const { RecentlyDeleted } = await import('./RecentlyDeleted');
const { MyDay } = await import('./MyDay');
const { displayPrefs } = await import('./logKinds');
const { offerUndo, resetUndosForTests } = await import('@/components/hig/undo');
const { ALREADY_BACK, NEWER_STAYS, removeCheckInReading, resetPendingCheckInsForTests } = await import('@/components/checkin/pending');
const { restoreEntry } = await import('./restoreEntry');
const { recentEntries } = await import('@/store/recent');
const { deleteWorkout } = await import('@/screens/workout/deletion');
const { saveMeal } = await import('@/food/store');
const { mealsIn } = await import('@/food/records');
const { evaluateCheckIn } = await import('@/engine/readiness');
const { checkInDayOf, nowAt } = await import('@/health/observation');
const { routeRecord } = await import('@/walk/routeRecord');

const DAY = '2026-10-08';
const iso = (h: number, m = 0) => new Date(2026, 9, 8, h, m, 0).toISOString();
const at = (h: number, m = 0) => vi.setSystemTime(new Date(2026, 9, 8, h, m, 0));
const PROFILE = createDefaultProfile({ health: { medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous', glucoseMonitor: 'meter', glucoseUnit: 'mg/dL', diabetes: 'type2' } });
const MEAL = { id: 'meal-1', at: iso(8, 10), day: DAY, meal: 'breakfast' as const, items: [{ kind: 'quick' as const, size: 'normal' as const, name: 'Normal plate' }], level: 'meals' as const, loggedAt: iso(8, 10), edits: [] };
const SET = { id: 'a', exerciseId: 'goblet-squat', setNumber: 1, plannedReps: 10, actualReps: 10, weight: 20, status: 'completed', rpe: null };
const SESSION = { id: 's1', date: DAY, dayOfWeek: 'thursday', muscleGroup: 'lower', phase: 'foundation', week: 1, status: 'completed', sets: [SET], startedAt: iso(7), completedAt: iso(7, 40), notes: '', totalVolume: 200 };
let fake: ReturnType<typeof fakeIndexedDB>;
let host: Host | undefined;

const ok = async (result: Promise<{ ok: boolean }>) => expect((await result).ok).toBe(true);
/** Delete through the store, as each screen does; the entry's id. */
async function gone(result: Promise<{ ok: true; value: string } | { ok: false; failure: Error }>): Promise<string> {
  const r = await result;
  if (!r.ok) throw r.failure;
  return r.value;
}
const prefs = () => { const s = store.getState(); return displayPrefs(s.settings, s.profile, s.observations, true); };
async function show(screen: () => unknown = () => createElement(RecentlyDeleted, { prefs: prefs(), today: DAY })) {
  host?.unmount();
  host = render(createElement(screen as never));
  await host.settle();
  return host;
}
async function openSheet(h: Host) {
  await h.click(h.button('Recently deleted'));
  return h;
}
const restores = (h: Host) => h.all().filter(n => n.type === 'button' && String(n.props['aria-label'] ?? '').startsWith('Restore ')).map(n => String(n.props['aria-label']));

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  at(9);
  local.clear();
  sonner.shown.length = 0;
  sonner.dismissed.length = 0;
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

describe('Recently deleted on today’s log (J§20.4 rule 6, D109)', () => {
  it('shows nothing when nothing was deleted in the last 7 days', async () => {
    expect((await show()).text()).toBe('');
  });

  it('counts what was deleted, and lists it newest first, each Restore named by what it is', async () => {
    const w = await store.addObservation({ kind: 'water', value: 500, scope: 'dayTotal', source: 'manual', at: iso(8) });
    if (!w.ok) throw w.failure;
    await ok(saveMeal(MEAL));
    await ok(store.putSession(SESSION as never));
    at(9, 1);
    await gone(store.deleteRecord({ kind: 'reading', id: w.value.id }));
    at(9, 2);
    await gone(store.deleteRecord({ kind: 'meal', id: MEAL.id }));
    at(9, 3);
    await gone(deleteWorkout(SESSION.id));
    const h = await show();
    expect(h.text()).toBe('Recently deleted 3');
    await openSheet(h);
    expect(restores(h)).toEqual([expect.stringMatching(/^Restore .*workout/i), 'Restore Breakfast: Normal plate', 'Restore Water 500 ml']);
    expect(h.text()).toContain('Deleted today at 9:01 am');
    expect(h.text()).toContain('Each is kept on this device for 7 days after it was deleted, then removed for good.');
    expect(h.text()).not.toContain('Erase all routes');
  });

  it('Restore brings it back, says so under the list, takes its row out of the list, and ends its Undo; another stays', async () => {
    const w = await store.addObservation({ kind: 'water', value: 500, scope: 'dayTotal', source: 'manual', at: iso(8) });
    if (!w.ok) throw w.failure;
    await ok(saveMeal(MEAL));
    const waterEntry = await gone(store.deleteRecord({ kind: 'reading', id: w.value.id }));
    const mealEntry = await gone(store.deleteRecord({ kind: 'meal', id: MEAL.id }));
    offerUndo({ text: 'Water 500 ml deleted', restored: 'Water 500 ml restored', scope: '/day/today', entry: waterEntry, undo: async () => ({ done: true }) });
    offerUndo({ text: 'Breakfast deleted', restored: 'Breakfast restored', scope: '/day/today', entry: mealEntry, undo: async () => ({ done: true }) });
    const [waterUndo, mealUndo] = [...new Set(sonner.shown.map(s => s.id!))];
    const h = await openSheet(await show());
    await h.click(h.button('Restore Water 500 ml'));
    expect(h.text()).toContain('Water 500 ml restored.');
    expect(restores(h)).toEqual(['Restore Breakfast: Normal plate']);
    expect(store.getState().observations).toEqual([expect.objectContaining({ kind: 'water', value: 500, restoredFrom: w.value.id })]);
    expect(sonner.dismissed).toContain(waterUndo);
    expect(sonner.dismissed).not.toContain(mealUndo);
    expect(h.text()).toContain('Recently deleted 1');
    // A meal comes back through the store's own rules too.
    await h.click(h.button('Restore Breakfast: Normal plate'));
    expect(mealsIn(store.getState().records)).toEqual([expect.objectContaining({ restoredFrom: MEAL.id })]);
    expect(h.text()).toContain('Nothing deleted in the last 7 days');
    // Opening it again starts with nothing said.
    await h.click(h.button('Recently deleted'));
    expect(h.text()).not.toContain('restored.');
  });

  it('a workout comes back through its own rules, and one the device didn’t store says why', async () => {
    await ok(store.putSession(SESSION as never));
    await gone(deleteWorkout(SESSION.id));
    const h = await openSheet(await show());
    fake.control.setWriteError(() => new DOMException('Full', 'QuotaExceededError'));
    await h.click(h.button(/^Restore .*workout/i));
    fake.control.setWriteError(undefined);
    expect(h.text()).toMatch(/workout wasn’t restored\. \S/i);
    expect(store.getState().sessions).toEqual([]);
    await h.click(h.button(/^Restore .*workout/i));
    expect(store.getState().sessions).toHaveLength(1);
    expect(h.text()).toMatch(/workout restored\./i);
  });

  it('a check-in’s reading answered again with the same number: Restore says it’s already back, and its row leaves', async () => {
    const c: DailyCheckIn = { date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, glucose: { value: 118, unit: 'mg/dL', measuredAt: iso(8, 50), source: 'meter' } };
    await ok(store.update(prev => ({ ...prev, profile: PROFILE, checkIns: [{ ...c, readiness: evaluateCheckIn(PROFILE, c, []) }] })));
    const lifted = store.getState().observations.find(o => o.kind === 'glucose' && checkInDayOf(o) === DAY)!;
    const deps = { profile: PROFILE, update: store.update, date: DAY };
    expect((await removeCheckInReading({ kind: 'glucose', at: lifted.at, value: 118, unit: 'mg/dL' }, [lifted.id], deps, { entry: 'deleted-ci', at: iso(9), observations: [lifted] })).stored).toBe(true);
    // The check-in answered again, with the same number.
    await ok(store.update(prev => ({ ...prev, checkIns: [{ ...c, readiness: evaluateCheckIn(PROFILE, c, []) }] })));
    const h = await openSheet(await show());
    await h.click(h.button('Restore Glucose 118 mg/dL, from your check-in'));
    expect(h.text()).toContain(ALREADY_BACK);
    expect(restores(h)).toEqual([]);
    // Once in its check-in, not twice.
    expect(store.getState().checkIns[0]).toMatchObject({ glucose: { value: 118 } });
    expect(store.getState().checkIns[0].glucoseEarlier ?? []).toEqual([]);
  });

  it('a check-in’s pain answered again since: Restore says the newer answer stays', async () => {
    const c: DailyCheckIn = { date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, back: { legPain: 1 } };
    await ok(store.update(prev => ({ ...prev, profile: PROFILE, checkIns: [{ ...c, readiness: evaluateCheckIn(PROFILE, c, []) }] })));
    const leg = store.getState().observations.find(o => o.kind === 'legPain' && checkInDayOf(o) === DAY)!;
    const deps = { profile: PROFILE, update: store.update, date: DAY };
    expect((await removeCheckInReading({ kind: 'legPain', value: 1 }, [leg.id], deps, { entry: 'deleted-leg', at: iso(9), observations: [leg] })).stored).toBe(true);
    await ok(store.update(prev => ({ ...prev, checkIns: (prev.checkIns ?? []).map(x => ({ ...x, back: { ...x.back, legPain: 3 } })) })));
    const h = await openSheet(await show());
    await h.click(h.button('Restore Leg pain 1 of 10, from your check-in'));
    expect(h.text()).toContain(NEWER_STAYS);
    expect(store.getState().checkIns[0].back?.legPain).toBe(3);
  });

  it('a check-in’s reading the device didn’t put back says why, and stays; with no profile, it says it needs one', async () => {
    const c: DailyCheckIn = { date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, glucose: { value: 118, unit: 'mg/dL', measuredAt: iso(8, 50), source: 'meter' } };
    await ok(store.update(prev => ({ ...prev, profile: PROFILE, checkIns: [{ ...c, readiness: evaluateCheckIn(PROFILE, c, []) }] })));
    const lifted = store.getState().observations.find(o => o.kind === 'glucose' && checkInDayOf(o) === DAY)!;
    const deps = { profile: PROFILE, update: store.update, date: DAY };
    expect((await removeCheckInReading({ kind: 'glucose', at: lifted.at, value: 118, unit: 'mg/dL' }, [lifted.id], deps, { entry: 'deleted-ci', at: iso(9), observations: [lifted] })).stored).toBe(true);
    const h = await openSheet(await show());
    fake.control.setWriteError(() => new DOMException('The device is full.', 'QuotaExceededError'));
    await h.click(h.button('Restore Glucose 118 mg/dL, from your check-in'));
    fake.control.setWriteError(undefined);
    expect(h.text()).toMatch(/Glucose 118 mg\/dL, from your check-in wasn’t restored\. \S/);
    // With when it was measured, as every clinical row says it (F-data-03).
    expect(restores(h)).toEqual(['Restore Glucose 118 mg/dL, from your check-in, measured today at 8:50 am']);
    expect(store.getState().checkIns[0].glucose).toBeUndefined();
    const [entry] = recentEntries(store.getState().contentState, Date.now());
    expect(await restoreEntry(entry, undefined)).toEqual({ problem: 'It needs your profile to go back into its check-in.' });
  });

  it('one the device didn’t restore says why, and stays in the list', async () => {
    const w = await store.addObservation({ kind: 'water', value: 500, scope: 'dayTotal', source: 'manual', at: iso(8) });
    if (!w.ok) throw w.failure;
    await gone(store.deleteRecord({ kind: 'reading', id: w.value.id }));
    const h = await openSheet(await show());
    fake.control.setWriteError(() => new DOMException('The device is full.', 'QuotaExceededError'));
    await h.click(h.button('Restore Water 500 ml'));
    fake.control.setWriteError(undefined);
    expect(h.text()).toMatch(/Water 500 ml wasn’t restored\. \S/);
    expect(restores(h)).toEqual(['Restore Water 500 ml']);
    expect(store.getState().observations).toEqual([]);
  });

  it('says that Erase all routes removes a deleted walk’s route here at once', async () => {
    const W = 'mgh3k2x1-1a2b3c4d';
    await ok(store.addObservations((['walkDuration', 'movementMinutes'] as const).map(kind =>
      ({ id: `${W}:s0:${kind}`, kind, value: 20, scope: 'sessionObserved' as const, source: 'measured' as const, at: iso(7), coverageMs: 1_200_000, context: `walk:${W}` }))));
    const start = new Date(2026, 9, 8, 7, 0, 0).getTime();
    await ok(store.putRecords('routes', [routeRecord(W, iso(7), [{ start, end: start + 20_000, coords: [[12.97, 77.59], [12.971, 77.5905]], ms: [0, 20_000] }])! as unknown as StoredRecord]));
    await gone(store.deleteRecord({ kind: 'walk', walkId: W }));
    const h = await openSheet(await show());
    expect(restores(h)).toEqual(['Restore Walk, 20 min']);
    expect(h.text()).toContain('Erase all routes, in Me → Data, removes the routes here at once.');
  });

  it('names an energy figure without it once counts-free is chosen, whenever it was deleted (P8S-10)', async () => {
    await ok(store.setProfile(createDefaultProfile({ food: { level: 'estimates' } } as never)));
    const e = await store.addObservation({ kind: 'activeEnergy', value: 85, scope: 'sessionObserved', coverageMs: 1_200_000, source: 'measured', at: iso(7) });
    if (!e.ok) throw e.failure;
    await gone(store.deleteRecord({ kind: 'reading', id: e.value.id }));
    await ok(store.setProfile(createDefaultProfile({ food: { level: 'meals' } } as never)));
    const h = await openSheet(await show());
    expect(restores(h)).toEqual(['Restore Active energy']);
    expect(h.text()).not.toMatch(/85|kcal/);
  });

  it('is at the end of today’s log only, a day emptied by its deletes included', async () => {
    const w = await store.addObservation({ kind: 'water', value: 500, scope: 'dayTotal', source: 'manual', at: iso(8) });
    if (!w.ok) throw w.failure;
    await gone(store.deleteRecord({ kind: 'reading', id: w.value.id }));
    expect((await show(() => createElement(MyDay, { day: DAY }))).text()).toMatch(/Nothing recorded yet today\.[\s\S]*Recently deleted 1$/);
    expect((await show(() => createElement(MyDay, { day: '2026-10-07' }))).text()).not.toContain('Recently deleted');
    // With records on the day too: after them.
    await ok(saveMeal(MEAL));
    expect((await show(() => createElement(MyDay, { day: DAY }))).text()).toMatch(/Breakfast[\s\S]*Recently deleted 1$/);
  });
});

describe('F-data-03: a clinical reading in Recently deleted says when it was measured, and in what context (J§4.10)', () => {
  it('two 112s, fasting at 07:30 and after a meal at 14:00, deleted in the same minute: each row and Restore says which', async () => {
    at(15);
    // Kept as Track keeps a reading: the wall clock it was taken in, with its offset.
    const local = (h: number, m = 0) => nowAt(new Date(2026, 9, 8, h, m, 0));
    const fasting = await store.addObservation({ kind: 'glucose', value: 112, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: local(7, 30), tag: 'fasting' });
    const afterMeal = await store.addObservation({ kind: 'glucose', value: 112, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: local(14), tag: 'afterMeal' });
    if (!fasting.ok || !afterMeal.ok) throw new Error('not stored');
    at(15, 1);
    await gone(store.deleteRecord({ kind: 'reading', id: fasting.value.id }));
    await gone(store.deleteRecord({ kind: 'reading', id: afterMeal.value.id }));
    const h = await openSheet(await show());
    expect(restores(h).sort()).toEqual([
      'Restore Glucose 112 mg/dL, measured today at 2:00 pm, after a meal',
      'Restore Glucose 112 mg/dL, measured today at 7:30 am, fasting',
    ]);
    // The measurement and the deletion each said on their own.
    expect(h.text()).toContain('Measured today at 7:30 am, fasting');
    expect(h.text()).toContain('Deleted today at 3:01 pm');
  });

  it('one kept without a time says so, and a water total keeps its row as it was', async () => {
    const dated = await store.addObservation({ kind: 'glucose', value: 140, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: nowAt(new Date(2026, 9, 8, 12)), timeUnknown: true });
    const water = await store.addObservation({ kind: 'water', value: 500, scope: 'dayTotal', source: 'manual', at: iso(8) });
    if (!dated.ok || !water.ok) throw new Error('not stored');
    await gone(store.deleteRecord({ kind: 'reading', id: dated.value.id }));
    await gone(store.deleteRecord({ kind: 'reading', id: water.value.id }));
    const h = await openSheet(await show());
    expect(restores(h).sort()).toEqual(['Restore Glucose 140 mg/dL, measured today, time not recorded', 'Restore Water 500 ml']);
  });
});
