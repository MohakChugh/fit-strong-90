import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Observation } from '@/health/observation';
import { entryFor, summariseDay } from '@/health/aggregate';
import { fakeIndexedDB } from './fakeIdb';
import { emptySnapshot, prepare } from './snapshot';

// The store sweeps localStorage on clear-all; node has none, so give it one.
const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null,
  setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k),
  clear: () => local.clear(),
  key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;

const store = await import('./useStore');
const { decode, TRANSFER_FORMAT } = await import('./transfer');

const DAY = '2026-10-08';
const total = (id: string, value: number, seq?: number): Observation => ({
  id, kind: 'steps', at: `${DAY}T18:00:00.000+05:30`, day: DAY, value, unit: 'steps', scope: 'dayTotal', source: 'manual',
  ...(seq !== undefined ? { seq } : {}),
} as Observation);

/** The day's steps as the app reads them: the later statement of two at the same instant. */
const stepsOn = (observations: readonly Observation[]) => entryFor(summariseDay(DAY, observations), 'steps', 'dayTotal')?.total;

/** A file as an export writes it: 2,000 stated first, 2,500 after, with ids that sort the other way. */
const file = () => ({
  format: TRANSFER_FORMAT, version: 1, exportedAt: `${DAY}T19:00:00.000+05:30`, schemaVersion: 5,
  observations: [total('steps-z-first', 2000, 3), total('steps-a-later', 2500, 4)],
  sessions: [], checkIns: [], personalRecords: [], bodyMetrics: [], focusOverrides: {}, contentState: [],
});

describe('prepare, keeping commit order within one change', () => {
  it('restamps the puts in their given order as consecutive commit numbers, and ends on the last', () => {
    const base = emptySnapshot(10);
    const { next } = prepare(base, { observations: { put: [total('a', 1, 7), total('b', 2, 3), total('c', 3, 7)], keepOrder: true } });
    const seq = Object.fromEntries(next.observations.map(o => [o.id, o.seq]));
    expect(seq).toEqual({ b: 11, a: 12, c: 12 });
    expect(next.revision).toBe(12);
  });

  it('puts an observation with no order of its own first', () => {
    const { next } = prepare(emptySnapshot(0), { observations: { put: [total('x', 1, 5), total('y', 2)], keepOrder: true } });
    expect(Object.fromEntries(next.observations.map(o => [o.id, o.seq]))).toEqual({ y: 1, x: 2 });
  });

  it('otherwise stamps every put with the one commit number, as before', () => {
    const { next } = prepare(emptySnapshot(10), { observations: { put: [total('a', 1, 7), total('b', 2, 3)] } });
    expect(next.observations.map(o => o.seq)).toEqual([11, 11]);
    expect(next.revision).toBe(11);
  });
});

describe('export and import keep the order things were said (J05)', () => {
  beforeEach(async () => {
    local.clear();
    store.resetForTests();
    await store.start({ factory: fakeIndexedDB() });
  });

  it('a replace keeps the later of two same-instant totals as the day\'s total', async () => {
    expect((await store.importRecord(file(), 'replace')).ok).toBe(true);
    expect(stepsOn(store.getState().observations)).toBe(2500);
  });

  it('so does a merge', async () => {
    expect((await store.importRecord(file(), 'merge')).ok).toBe(true);
    expect(stepsOn(store.getState().observations)).toBe(2500);
  });

  it('round-trips: exported again and imported into another device, still the later total', async () => {
    await store.importRecord(file(), 'replace');
    const exported = await store.exportRecord();
    if (!exported.ok) throw new Error('export failed');
    const again = await decode(exported.value.bytes);
    store.resetForTests();
    await store.start({ factory: fakeIndexedDB() });
    expect((await store.importRecord(again, 'replace')).ok).toBe(true);
    expect(stepsOn(store.getState().observations)).toBe(2500);
  });

  it('writes nothing again when the same file is merged a second time', async () => {
    await store.importRecord(file(), 'merge');
    const report = await store.importRecord(file(), 'merge');
    expect(report.ok && report.value.observations).toBe(0);
    expect(stepsOn(store.getState().observations)).toBe(2500);
  });
});

describe('a lifetime of readings, restored or merged (C2-04)', () => {
  /** One reading per commit, two minutes apart: what a real export holds. */
  const reading = (i: number, seq: number, minute: number): Observation => {
    const at = new Date(Date.UTC(2020, 0, 1) + minute * 60_000).toISOString().replace('Z', '+00:00');
    return { id: `o-${i}`, kind: 'glucose', at, day: at.slice(0, 10), value: 100, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', seq } as Observation;
  };
  const N = 100_000;
  const timed = <T>(run: () => T): [T, number] => {
    const start = performance.now();
    const value = run();
    return [value, performance.now() - start];
  };

  it('restamps 100,000 readings in their order without scanning the order for each', () => {
    const put = Array.from({ length: N }, (_, i) => reading(i, i + 1, i * 2));
    const [{ next }, ms] = timed(() => prepare(emptySnapshot(0), { observations: { put, keepOrder: true } }));
    expect(next.observations).toHaveLength(N);
    expect(next.observations[N - 1].seq).toBe(N);
    expect(ms).toBeLessThan(1000);
  });

  it('merges 100,000 readings into 100,000 without moving the list once per reading', () => {
    const base = prepare(emptySnapshot(0), { observations: { put: Array.from({ length: N }, (_, i) => reading(i, i + 1, i * 2)), keepOrder: true } }).next;
    const more = Array.from({ length: N }, (_, i) => reading(N + i, i + 1, i * 2 + 1));
    const [{ next }, ms] = timed(() => prepare(base, { observations: { put: more, keepOrder: true } }));
    expect(next.observations).toHaveLength(2 * N);
    // Still in order: each reading after the one before it.
    expect(next.observations.every((o, i, all) => i === 0 || Date.parse(all[i - 1].at) <= Date.parse(o.at))).toBe(true);
    expect(ms).toBeLessThan(1500);
  });
});

describe('a long check-in history, merged (R5-04)', () => {
  const readiness = { outcome: 'green', modifiers: [], back: 'green', nerveFlag: false, reasons: [], actions: [], vigorousLocked: false, capHeavy: false, rpeOnly: true, notices: [] };
  const day = (i: number) => new Date(Date.UTC(1900, 0, 1) + i * 86_400_000).toISOString().slice(0, 10);

  it('folds 50,000 days into the record without copying it once per day', async () => {
    const { previewImport } = await import('./transfer');
    const checkIns = Array.from({ length: 50_000 }, (_, i) => ({ date: day(i), urgentSymptoms: false, news: [], sleep: '5to7', energy: 4, readiness }));
    const raw = { format: TRANSFER_FORMAT, version: 1, exportedAt: `${DAY}T19:00:00.000+05:30`, schemaVersion: 5,
      observations: [], sessions: [], checkIns, personalRecords: [], bodyMetrics: [], focusOverrides: {}, contentState: [] };
    const here = { checkIns: [{ date: day(10), urgentSymptoms: false, news: [], sleep: 'gt7', energy: 2, readiness }] };
    const start = performance.now();
    const preview = previewImport(raw, here as never);
    const ms = performance.now() - start;
    expect(preview.ok && preview.conflicts?.checkIns).toBe(1);
    expect(ms).toBeLessThan(1500);
  });

  // What is measured here is the merge's own share: the history handed to the
  // engine once, with every day to work out again, and nothing gone over once
  // more for each of those days (N-06). The engine's share is measured with
  // the engine itself below.
  it('works out 10,000 cleaned days of 50,000 again, handing the engine the history once', async () => {
    const calls: { history: number; days: { date: string; glucose?: unknown }[] }[] = [];
    vi.resetModules();
    vi.doMock('@/engine/readiness', async (original: () => Promise<typeof import('@/engine/readiness')>) => ({
      ...(await original()),
      evaluateDays: (_profile: unknown, history: unknown[], days: Iterable<{ date: string; glucose?: unknown }>) => {
        const list = [...days];
        calls.push({ history: history.length, days: list });
        return new Map(list.map(d => [d, readiness]));
      },
    }));
    try {
      const { previewImport } = await import('./transfer');
      const { readingKey } = await import('./project');
      const { createDefaultProfile } = await import('@/profile/defaults');
      const at = (i: number) => `${day(i)}T08:00:00.000Z`;
      const deleted = (i: number) => i % 5 === 0;
      const checkIns = Array.from({ length: 50_000 }, (_, i) => ({
        date: day(i), urgentSymptoms: false, news: [], sleep: '5to7', energy: 4, readiness,
        ...(deleted(i) ? { glucose: { value: 300, unit: 'mg/dL', measuredAt: at(i) } } : {}),
      }));
      // Deleted on this device, the file's record of each of those days still naming it.
      const readings = checkIns.filter((_, i) => deleted(i))
        .map((c, n) => readingKey({ kind: 'glucose', at: at(n * 5), value: 300, unit: 'mg/dL', context: `checkIn:${c.date}` })!);
      const raw = { format: TRANSFER_FORMAT, version: 1, exportedAt: `${DAY}T19:00:00.000+05:30`, schemaVersion: 5,
        observations: [], sessions: [], checkIns, personalRecords: [], bodyMetrics: [], focusOverrides: {}, contentState: [] };
      const here = { profile: createDefaultProfile({ weightKg: 80 }), settings: { deleted: { readings } }, checkIns: [] };
      const start = performance.now();
      const preview = previewImport(raw, here as never);
      const ms = performance.now() - start;
      expect(preview.ok).toBe(true);
      expect(calls).toHaveLength(1);
      expect(calls[0].history).toBe(50_000);
      expect(calls[0].days).toHaveLength(10_000);
      // Each the day's record without its deleted reading.
      expect(calls[0].days.every(d => d.glucose === undefined && deleted(Math.round((Date.parse(d.date) - Date.UTC(1900, 0, 1)) / 86_400_000)))).toBe(true);
      expect(ms).toBeLessThan(1500);
    } finally {
      vi.doUnmock('@/engine/readiness');
      vi.resetModules();
    }
  });

  // With the engine itself, at sizes one person's record can reach and well
  // beyond: the history is prepared once for every day worked out again
  // (`evaluateDays`), so the cost grows with the history, not with it times
  // the days. Worked out one day at a time, 1,000 days of 27 years took about
  // 3 s and 10,000 of 137 about three minutes.
  const realHistory = async (days: number, cleaned: number) => {
    const { planImport } = await import('./transfer');
    const { readingKey } = await import('./project');
    const { emptySnapshot } = await import('./snapshot');
    const { createDefaultProfile } = await import('@/profile/defaults');
    const at = (i: number) => `${day(i)}T08:00:00.000Z`;
    const every = Math.floor(days / cleaned);
    const deleted = (i: number) => i % every === 0 && i / every < cleaned;
    const checkIns = Array.from({ length: days }, (_, i) => ({
      date: day(i), urgentSymptoms: false, emergency: [], news: [], sleep: '5to7', energy: 4, readiness,
      glucose: { value: deleted(i) ? 300 : 120, unit: 'mg/dL', measuredAt: at(i) },
    }));
    // Deleted on this device; the file's record of each of those days still names it.
    const readings = checkIns.flatMap((c, i) => (deleted(i) ? [readingKey({ kind: 'glucose', at: at(i), value: 300, unit: 'mg/dL', context: `checkIn:${c.date}` })!] : []));
    const raw = { format: TRANSFER_FORMAT, version: 1, exportedAt: `${DAY}T19:00:00.000+05:30`, schemaVersion: 5,
      observations: [], sessions: [], checkIns, personalRecords: [], bodyMetrics: [], focusOverrides: {}, contentState: [] };
    const profile = createDefaultProfile({ weightKg: 80, health: { diabetes: 'type2', metformin: true, medicinesReviewed: true, glucoseMonitor: 'meter' } });
    const base = { ...emptySnapshot(), profile, settings: { deleted: { readings } } };
    const start = performance.now();
    const { change } = planImport(raw, 'merge', base as never);
    const ms = performance.now() - start;
    const out = change.checkIns ?? [];
    const again = out.filter((_, i) => deleted(i));
    expect(out).toHaveLength(days);
    expect(again).toHaveLength(cleaned);
    // Each without the deleted reading, and worked out again by the engine.
    expect(again.every(c => c.glucose === undefined && c.readiness !== readiness && c.readiness.disposition !== undefined)).toBe(true);
    return ms;
  };

  it('with the engine itself, works out 100 cleaned days of ten years again in under 2 s', async () => {
    expect(await realHistory(3_650, 100)).toBeLessThan(2_000);
  }, 60_000);

  it('and 1,000 of 27 years in under 2 s', async () => {
    expect(await realHistory(10_000, 1_000)).toBeLessThan(2_000);
  }, 60_000);

  it('and 10,000 of 137 years in under 2 s', async () => {
    expect(await realHistory(50_000, 10_000)).toBeLessThan(2_000);
  }, 60_000);
});
