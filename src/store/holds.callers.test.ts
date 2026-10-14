/**
 * Review Focus 1 (journey §4.6, A-05; Codex P8-01, P8R-01, P8R-02, P8S-01,
 * P8S-02, P8S-03, P8S-05; Kiro K8-07, K8-08), through the real store, a fake
 * IndexedDB, and the gate a walk start asks (`deviceClinical`, `walkInput`,
 * `permission`): a 52 mg/dL low deleted, the same 186/98 retimed to
 * yesterday, a 52 corrected to 152, a check-in's own low corrected, and a
 * check-in holding an LO or a top number of 186 alone removed. Each is
 * refused while the reading holds, with nothing written, and goes through
 * once v1's "It was a mistake" has answered exactly the measurement it takes
 * away. Then two severe readings with one of them answered; a current single
 * reading's way out; the phone's clock moved a day on and back; a correction
 * through the store's own `update`, outside every caller; and a correction
 * the hold allows, keeping what it replaced. Nothing here re-implements a
 * delete, an edit, an import or a gate.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyCheckIn } from '@/types/checkin';
import type { UserProfile } from '@/types/profile';
import { createDefaultProfile } from '@/profile/defaults';
import { DB_NAME } from './db';
import { fakeIndexedDB } from './fakeIdb';

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;
Object.assign(globalThis, { document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} } });

const store = await import('./useStore');
const { CLOCK_REFUSAL, HOLD_REFUSAL, MISTAKE_HINT, isHeld } = await import('./db');
const { bpReadingId: measured, evaluateCheckIn } = await import('@/engine/readiness');
const { permission, readinessFor } = await import('@/engine/permission');
const { deviceClinical, walkInput } = await import('@/walk/gate');
const { answerMistakes, correctCheckInGlucose, correctCheckInPressure, pendingCheckIn, resetPendingCheckInsForTests } = await import('@/components/checkin/pending');
const { bpReadingId } = await import('@/health/observation');
const { decode } = await import('./transfer');
const { isRecentKey } = await import('./recent');

const DAY = '2026-10-08';
const NEXT = '2026-10-09';
const iso = (h: number, m = 0, day = 8) => new Date(2026, 9, day, h, m, 0).toISOString();
const clock = (h: number, m = 0, day = 8) => vi.setSystemTime(new Date(2026, 9, day, h, m, 0));
const PROFILE: UserProfile = createDefaultProfile({
  health: {
    medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous', glucoseMonitor: 'meter', glucoseUnit: 'mg/dL',
    diabetes: 'type2', insulin: 'injections_or_pump', insulinRegimen: 'basalOnly', bpMonitor: true, hypertension: 'treated', bpMedicinesReviewed: true, betaBlocker: false, diuretic: false,
  },
});
const day = (date: string, h: number): DailyCheckIn => ({
  date, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4,
  glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(h, 50, Number(date.slice(8))), source: 'meter' },
  bp: { sys: 124, dia: 78 }, bpReadings: [{ sys: 124, dia: 78, at: iso(h, 52, Number(date.slice(8))) }],
});
const low = { kind: 'glucose', value: 52, unit: 'mg/dL', scope: 'pointInTime', source: 'manual' } as const;
const deps = { profile: PROFILE, update: store.update };
let fake: ReturnType<typeof fakeIndexedDB>;

/** What a walk start asks, of everything this device holds. */
const walk = () => permission(walkInput(deviceClinical(store.getState()), new Date()), 'walk');
/** The day's answer, as every gate reads it. */
const codes = () => readinessFor(walkInput(deviceClinical(store.getState()), new Date())).reasons.map(r => r.code);
const recent = () => Object.keys(store.getState().contentState).filter(isRecentKey);
/** The observations as IndexedDB holds them. */
async function stored(): Promise<Record<string, unknown>[]> {
  const db = await new Promise<IDBDatabase>(resolve => {
    const req = fake.open(DB_NAME);
    req.onsuccess = () => resolve(req.result);
  });
  const rows = await new Promise<Record<string, unknown>[]>(resolve => {
    const req = db.transaction('observations').objectStore('observations').getAll();
    req.onsuccess = () => resolve(req.result as Record<string, unknown>[]);
  });
  db.close();
  return rows;
}

/**
 * A store of its own, over a fresh IndexedDB, holding one day's check-in, with setup finished (every gate holds
 * all movement while it isn't: Plan 5's H5-05, board D197): a setup never changes what an earlier one held.
 */
async function fresh(c: DailyCheckIn = day(DAY, 8)) {
  store.resetForTests();
  resetPendingCheckInsForTests();
  local.clear();
  fake = fakeIndexedDB();
  await store.start({ factory: fake, broadcast: null });
  const seeded = await store.update(prev => ({ ...prev, profile: PROFILE, settings: { ...prev.settings, onboardingComplete: true }, checkIns: [{ ...c, readiness: evaluateCheckIn(PROFILE, c, []) }] }));
  if (!seeded.ok) throw seeded.failure;
}
/** The blood pressure reading holding 186 now, by its reading id. */
const severe = () => bpReadingId(store.getState().observations.find(o => o.kind === 'bloodPressureSystolic' && o.value === 186)!.context)!;
async function ok<T>(p: Promise<{ ok: true; value: T } | { ok: false; failure: Error }>): Promise<T> {
  const r = await p;
  if (!r.ok) throw r.failure;
  return r.value;
}
/** The refusal a result carries, or a failed test. */
function heldBy(r: { ok: boolean; failure?: unknown }) {
  if (r.ok || !isHeld(r.failure)) throw new Error(`not refused as held: ${JSON.stringify(r)}`);
  return r.failure;
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  clock(9);
  await fresh();
});
afterEach(() => vi.useRealTimers());

describe('a serious low can’t be deleted or corrected away while it holds (Review Focus 1, P8-01, K8-07)', () => {
  it('a delete is refused in words, writes nothing, and goes through once the 52 is answered as typed wrongly', async () => {
    expect(walk().allowed).toBe(true);
    const reading = await ok(store.addObservation({ ...low, at: iso(8, 58) }));
    expect(walk().allowed).toBe(false);
    const refusal = heldBy(await store.deleteRecord({ kind: 'reading', id: reading.id }));
    expect(refusal.message).toBe(`${HOLD_REFUSAL} ${MISTAKE_HINT}`);
    expect(refusal.held).toEqual([{ kind: 'severeLow', id: expect.stringMatching(/52/) }]);
    expect(store.getState().observations.some(o => o.id === reading.id)).toBe(true);
    expect(recent()).toEqual([]);
    // Said where it was asked, never as the storage banner.
    expect(store.getState().failure).toBeUndefined();
    // A later normal reading resolves nothing (J§4.6).
    clock(9, 5);
    await ok(store.addObservation({ ...low, value: 120, at: iso(9, 5) }));
    expect(walk().allowed).toBe(false);
    clock(9, 6);
    expect((await answerMistakes(refusal.held, deps)).stored).toBe(true);
    expect(walk().allowed).toBe(true);
    expect((await store.deleteRecord({ kind: 'reading', id: reading.id })).ok).toBe(true);
    expect(walk().allowed).toBe(true);
  });

  it('52 corrected to 152 is refused; answered as typed wrongly, the correction goes through, and the record keeps the 52', async () => {
    const reading = await ok(store.addObservation({ ...low, at: iso(8, 58) }));
    const refusal = heldBy(await store.editObservation(reading.id, { value: 152 }));
    expect(store.getState().observations.find(o => o.id === reading.id)?.value).toBe(52);
    expect((await answerMistakes(refusal.held, deps)).stored).toBe(true);
    expect((await store.editObservation(reading.id, { value: 152 })).ok).toBe(true);
    // The correction's history (J§4.6): what was measured, on the record, and what was said about it.
    expect(store.getState().observations.find(o => o.id === reading.id)).toMatchObject({ value: 152, was: [expect.objectContaining({ value: 52 })] });
    expect(store.getState().checkIns.find(c => c.date === DAY)?.resolutions).toEqual([
      expect.objectContaining({ kind: 'severeLow', resolution: 'mistake', readings: [expect.stringMatching(/52/)] }),
    ]);
    expect(walk().allowed).toBe(true);
  });

  it('a check-in’s severe blood pressure corrected away is refused the same way, nothing left waiting', async () => {
    await fresh({ ...day(DAY, 8), bp: { sys: 186, dia: 98 }, bpReadings: [{ sys: 186, dia: 98, at: iso(8, 52) }] });
    expect(walk().allowed).toBe(false);
    const result = await correctCheckInPressure({ at: iso(8, 52), was: { sys: 186, dia: 98 }, to: { sys: 124, dia: 78 } }, { ...deps, date: DAY });
    expect(result).toMatchObject({ matched: true, stored: false, held: { code: 'held' } });
    expect(store.getState().checkIns[0].bpReadings).toEqual([{ sys: 186, dia: 98, at: iso(8, 52) }]);
    expect(pendingCheckIn(DAY)).toBeUndefined();
    expect(walk().allowed).toBe(false);
  });

  it('a check-in’s own low corrected is refused, and nothing is left waiting that a gate could read differently', async () => {
    await fresh({ ...day(DAY, 8), glucose: { value: 46, unit: 'mg/dL', measuredAt: iso(8, 50), source: 'meter' } });
    expect(walk().allowed).toBe(false);
    const result = await correctCheckInGlucose({ at: iso(8, 50), was: { value: 46, unit: 'mg/dL' }, to: { value: 146, unit: 'mg/dL' } }, { ...deps, date: DAY });
    expect(result).toMatchObject({ matched: true, stored: false });
    expect(result.held?.code).toBe('held');
    expect(store.getState().checkIns[0].glucose?.value).toBe(46);
    expect(pendingCheckIn(DAY)).toBeUndefined();
    expect(walk().allowed).toBe(false);
  });
});

describe('a severe blood pressure can’t be retimed or halved away (P8R-01)', () => {
  it('the same 186/98 moved to yesterday is refused, and so is taking one of its halves', async () => {
    await ok(store.putBloodPressure({ systolic: 186, diastolic: 98, at: iso(8, 59) }));
    const readingId = severe();
    expect(walk().allowed).toBe(false);
    heldBy(await store.putBloodPressure({ readingId, systolic: 186, diastolic: 98, at: iso(20, 0, 7) }));
    expect(store.getState().observations.filter(o => o.context === `bp:${readingId}`).every(o => Date.parse(o.at) === Date.parse(iso(8, 59)))).toBe(true);
    const bottom = store.getState().observations.find(o => o.kind === 'bloodPressureDiastolic' && o.context === `bp:${readingId}`)!;
    heldBy(await store.removeObservation(bottom.id));
    heldBy(await store.removeReading(readingId));
    expect(walk().allowed).toBe(false);
  });

  it('a pair late in the day, judged for tomorrow too, and still the next morning when it is yesterday’s (K8-08)', async () => {
    clock(23, 58);
    await fresh(day(DAY, 23));
    await ok(store.putBloodPressure({ systolic: 186, diastolic: 98, at: iso(23, 55) }));
    await ok(store.putBloodPressure({ systolic: 182, diastolic: 97, at: iso(23, 56) }));
    heldBy(await store.deleteRecord({ kind: 'pressure', readingId: severe() }));
    // Past midnight the pair is yesterday's, and the engine still asks about it today.
    clock(0, 5, 9);
    heldBy(await store.deleteRecord({ kind: 'pressure', readingId: severe() }));
  });
});

describe('exactly the measurement a change takes away (P8S-01)', () => {
  it('two severe readings, one of them deleted: only that one is answered, and the other still holds after a normal reading', async () => {
    await ok(store.putBloodPressure({ systolic: 186, diastolic: 98, at: iso(8, 58) }));
    await ok(store.putBloodPressure({ systolic: 181, diastolic: 96, at: iso(9, 0) }));
    expect(walk().allowed).toBe(false);
    const first = severe();
    const named = measured({ sys: 186, dia: 98, at: iso(8, 58) }, DAY);
    const refusal = heldBy(await store.deleteRecord({ kind: 'pressure', readingId: first }));
    // Deleting one of the two ends the pair the engine carries to tomorrow: the other is still never named.
    expect(refusal.held).toEqual([{ kind: 'severeBp', id: named }]);
    expect((await answerMistakes(refusal.held, deps)).stored).toBe(true);
    expect((await store.deleteRecord({ kind: 'pressure', readingId: first })).ok).toBe(true);
    clock(9, 10);
    await ok(store.putBloodPressure({ systolic: 124, diastolic: 78, at: iso(9, 10) }));
    expect(walk().allowed).toBe(false);
    expect(store.getState().checkIns.flatMap(c => c.resolutions ?? []).flatMap(a => a.readings)).toEqual([named]);
  });

  it('a current single reading: its way out is “It was a mistake”, and then it goes', async () => {
    await ok(store.putBloodPressure({ systolic: 186, diastolic: 98, at: iso(8, 59) }));
    expect(walk().allowed).toBe(false);
    const refusal = heldBy(await store.deleteRecord({ kind: 'pressure', readingId: severe() }));
    expect(refusal.message).toBe(`${HOLD_REFUSAL} ${MISTAKE_HINT}`);
    expect(refusal.held).toEqual([{ kind: 'severeBp', id: measured({ sys: 186, dia: 98, at: iso(8, 59) }, DAY) }]);
    expect((await answerMistakes(refusal.held, deps)).stored).toBe(true);
    expect((await store.deleteRecord({ kind: 'pressure', readingId: severe() })).ok).toBe(true);
    expect(walk().allowed).toBe(true);
  });
});

describe('while the phone’s clock change holds the device, nothing clinical is changed or removed (P8S-02)', () => {
  /** The clock a day on, which a walk under way sees (Plan 6's `markClockChange`, board D174); a delete; the clock back. */
  async function overTheJump(request: () => Parameters<typeof store.deleteRecord>[0], code: string) {
    expect(walk().allowed).toBe(false);
    const asked = request();
    const held = store.getState().observations.length;
    clock(9, 0, 9);
    await ok(store.markClockChange([DAY, NEXT]));
    const refusal = heldBy(await store.deleteRecord(asked));
    expect(refusal.message).toBe(CLOCK_REFUSAL);
    expect(refusal.held).toEqual([]);
    clock(9, 10);
    expect(store.getState().observations).toHaveLength(held);
    expect(walk().allowed).toBe(false);
    expect(codes()).toContain(code);
  }

  it('a single severe blood pressure', async () => {
    await ok(store.putBloodPressure({ systolic: 186, diastolic: 98, at: iso(8, 59) }));
    await overTheJump(() => ({ kind: 'pressure', readingId: severe() }), 'bpSevereUnconfirmed');
  });

  it('a mild low', async () => {
    const reading = await ok(store.addObservation({ ...low, value: 68, at: iso(8, 59) }));
    await overTheJump(() => ({ kind: 'reading', id: reading.id }), 'low');
  });
});

describe('every clinical shape a check-in holds, whoever changes it (P8R-02, P8S-03)', () => {
  const shapes: [string, Partial<DailyCheckIn>][] = [
    ['a check-in showing LO', { glucoseDisplay: { display: 'LO', measuredAt: iso(8, 55), source: 'meter' } }],
    ['a top number of 186 entered alone', { bpPartial: [{ sys: 186, at: iso(8, 55) }] }],
  ];
  for (const [what, shown] of shapes) {
    it(`${what} can’t be removed while it holds`, async () => {
      await fresh({ ...day(DAY, 8), ...shown });
      expect(walk().allowed).toBe(false);
      heldBy(await store.removeCheckIn(DAY));
      expect(store.getState().checkIns.map(c => c.date)).toEqual([DAY]);
      expect(walk().allowed).toBe(false);
    });
  }

  it('a check-in’s 52 corrected to 152 through the store’s own `update`, outside every caller, is refused the same way', async () => {
    await fresh({ ...day(DAY, 8), glucose: { value: 52, unit: 'mg/dL', measuredAt: iso(8, 50), source: 'meter' } });
    expect(walk().allowed).toBe(false);
    const result = await store.update(prev => ({
      ...prev, checkIns: (prev.checkIns ?? []).map(c => (c.date === DAY && c.glucose ? { ...c, glucose: { ...c.glucose, value: 152 } } : c)),
    }), { readings: 'correct' });
    heldBy(result);
    expect(store.getState().checkIns[0].glucose?.value).toBe(52);
    expect(store.getState().checkIns[0].resolutions ?? []).toEqual([]);
    expect(walk().allowed).toBe(false);
  });
});

describe('a correction the hold allows keeps what it replaced (J§4.6, P8S-05)', () => {
  it('186/98 corrected to 190/98: as strict as before, so it goes through, and the stored reading keeps 186, its time and when it was corrected', async () => {
    await ok(store.putBloodPressure({ systolic: 186, diastolic: 98, at: iso(8, 59) }));
    const readingId = severe();
    clock(9, 5);
    await ok(store.putBloodPressure({ readingId, systolic: 190, diastolic: 98 }));
    expect(walk().allowed).toBe(false);
    const halves = (await stored()).filter(o => o.context === `bp:${readingId}`);
    expect(halves.find(o => o.kind === 'bloodPressureSystolic')).toMatchObject({ value: 190, editedAt: expect.any(String), was: [expect.objectContaining({ value: 186, at: iso(8, 59) })] });
    // The bottom number didn't change, so it has nothing to keep.
    expect(halves.find(o => o.kind === 'bloodPressureDiastolic')?.was).toBeUndefined();
  });

  it('the same in a check-in, kept on its reading in the series', async () => {
    await fresh({ ...day(DAY, 8), bp: { sys: 186, dia: 98 }, bpReadings: [{ sys: 186, dia: 98, at: iso(8, 52) }] });
    clock(9, 5);
    const result = await correctCheckInPressure({ at: iso(8, 52), was: { sys: 186, dia: 98 }, to: { sys: 190, dia: 98 } }, { ...deps, date: DAY });
    expect(result).toMatchObject({ matched: true, stored: true });
    expect((await stored()).find(o => o.kind === 'bloodPressureSystolic' && o.value === 190)?.was).toEqual([expect.objectContaining({ value: 186 })]);
  });
});

describe('only “It was a mistake” lets a measurement go, and it names exactly what is taken out (D119)', () => {
  it('a reading a clinician has seen still can’t be deleted: that answer settles the incident, not the reading', async () => {
    await ok(store.putBloodPressure({ systolic: 186, diastolic: 98, at: iso(8, 59) }));
    const named = measured({ sys: 186, dia: 98, at: iso(8, 59) }, DAY);
    // Answered as assessed, kept in today's check-in as the sheet keeps it.
    await ok(store.update(prev => ({ ...prev, checkIns: prev.checkIns!.map(c => (c.date === DAY ? { ...c, resolutions: [{ kind: 'severeBp' as const, readings: [named], resolution: 'assessed' as const, at: iso(9, 0) }] } : c)) })));
    const refusal = heldBy(await store.deleteRecord({ kind: 'pressure', readingId: severe() }));
    expect(refusal.held).toEqual([{ kind: 'severeBp', id: named }]);
    // "It was a mistake", said later, goes beside the clinician's answer, never in its place (at one instant the
    // stricter answer stands, as the engine reads them: N-03).
    clock(9, 5);
    expect((await answerMistakes(refusal.held, deps)).stored).toBe(true);
    expect(store.getState().checkIns.find(c => c.date === DAY)?.resolutions?.map(a => a.resolution)).toEqual(['assessed', 'mistake']);
    expect((await store.deleteRecord({ kind: 'pressure', readingId: severe() })).ok).toBe(true);
  });

  for (const [what, shown, gone] of [
    ['LO, taken out of its check-in', { glucoseDisplay: { display: 'LO', measuredAt: iso(8, 55), source: 'meter' } }, (c: DailyCheckIn) => { const { glucoseDisplay: _lo, ...rest } = c; void _lo; return rest; }],
    ['a 186 entered alone, taken out of its check-in', { bpPartial: [{ sys: 186, at: iso(8, 55) }] }, (c: DailyCheckIn) => { const { bpPartial: _half, ...rest } = c; void _half; return rest; }],
  ] as [string, Partial<DailyCheckIn>, (c: DailyCheckIn) => DailyCheckIn][]) {
    it(`${what} is named, so the answer settles it and nothing else`, async () => {
      await fresh({ ...day(DAY, 8), ...shown });
      const change = () => store.update(prev => ({ ...prev, checkIns: prev.checkIns!.map(c => (c.date === DAY ? gone(c) as never : c)) }));
      const refusal = heldBy(await change());
      expect(refusal.held).toHaveLength(1);
      expect((await answerMistakes(refusal.held, deps)).stored).toBe(true);
      expect((await change()).ok).toBe(true);
    });
  }

  it('a check-in removed for its answers alone says the engine’s own words for the hold, with nothing to answer', async () => {
    await fresh({ date: DAY, urgentSymptoms: false, emergency: [], news: ['dizzy'], sleep: 'gt7', energy: 4 });
    expect(walk().allowed).toBe(false);
    const refusal = heldBy(await store.removeCheckIn(DAY));
    expect(refusal.held).toEqual([]);
    expect(refusal.release).toBeDefined();
    expect(refusal.message).toBe(`${HOLD_REFUSAL} ${refusal.release}`);
    expect(store.getState().checkIns.map(c => c.date)).toEqual([DAY]);
  });
});

describe('what holds nothing goes at once, and an older backup changes nothing (H6-03)', () => {
  it('a normal reading deletes and restores with no refusal', async () => {
    const normal = await ok(store.addObservation({ ...low, value: 130, at: iso(8, 59) }));
    const entry = await ok(store.deleteRecord({ kind: 'reading', id: normal.id }));
    expect(walk().allowed).toBe(true);
    expect((await store.restoreDeleted(entry)).ok).toBe(true);
    expect(walk().allowed).toBe(true);
  });

  it('a backup from before the low, merged either way or replaced over it, leaves it holding', async () => {
    const made = await store.exportRecord();
    if (!made.ok) throw made.failure;
    const older = await decode(made.value.bytes);
    await ok(store.addObservation({ ...low, at: iso(8, 58) }));
    for (const onConflict of ['keepDevice', 'takeFile'] as const) {
      await ok(store.importRecord(older, 'merge', { onConflict }));
      expect(walk().allowed).toBe(false);
    }
    await ok(store.importRecord(older, 'replace'));
    expect(walk().allowed).toBe(false);
  });
});
