import { beforeEach, describe, expect, it, vi } from 'vitest';
import { newObservation } from '@/health/observation';
import { emptySnapshot, prepare, type Snapshot } from './snapshot';

// The legacy conversion, counted: a file past a limit must be refused before it is entered (P8-15).
const spies = vi.hoisted(() => ({ migrated: 0, projected: 0 }));
vi.mock('@/services/storage', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/storage')>();
  return { ...actual, migrateData: (...args: Parameters<typeof actual.migrateData>) => { spies.migrated += 1; return actual.migrateData(...args); } };
});
vi.mock('./migrate', async importOriginal => {
  const actual = await importOriginal<typeof import('./migrate')>();
  return { ...actual, projectV4: (...args: Parameters<typeof actual.projectV4>) => { spies.projected += 1; return actual.projectV4(...args); } };
});

const {
  IMPORT_LIMITS, exportExcess, exportWarning, limitLines, readBackupFile, routePoints, shapeExcess, shapeProblem, sizeText,
  textTooLong, tooDeep, tooLarge, tooMany, tooManyPoints, unpacksTooLarge,
} = await import('./limits');
const { decode, encode, planImport, previewImport, toTransferDoc } = await import('./transfer');

const AT = '2026-10-08T09:00:00.000+05:30';
const nested = (levels: number, inner: unknown = 1, wrap: (x: unknown) => unknown = x => [x]) => {
  let value = inner;
  for (let i = 0; i < levels; i++) value = wrap(value);
  return value;
};
const session = (id: string, notes = '') => ({
  id, date: '2026-10-01', dayOfWeek: 'thursday', muscleGroup: 'lower', phase: 'foundation', week: 1,
  status: 'completed', sets: [], startedAt: null, completedAt: null, notes, totalVolume: 0,
});
/** A backup from the previous version of the app (Settings → Export), as `fromLegacyBackup` reads one. */
const legacy = (over: Record<string, unknown> = {}) => ({
  version: 4,
  settings: {
    startDate: '2026-09-28', currentWeight: 82, targetGoal: 'Pain-free back', defaultRestSeconds: 90, useMetric: true, theme: 'system', onboardingComplete: true,
    gymDays: { monday: 'legs', tuesday: 'back', wednesday: 'rest', thursday: 'chest', friday: 'arms', saturday: 'core', sunday: 'rest' },
  },
  sessions: [session('legacy-1')], bodyMetrics: [], personalRecords: [], checkIns: [], focusOverrides: {},
  ...over,
});

beforeEach(() => {
  spies.migrated = 0;
  spies.projected = 0;
});

describe('what a restore takes, in words (B-26, D108)', () => {
  it('sizes a file as Files shows it', () => {
    expect(sizeText(900)).toBe('1 KB');
    expect(sizeText(1_500)).toBe('2 KB');
    expect(sizeText(1_363_149)).toBe('1.3 MB');
    expect(sizeText(IMPORT_LIMITS.bytes)).toBe('128 MB');
    expect(sizeText(129 * 1024 * 1024)).toBe('129 MB');
  });

  it('refuses with the limit, the file’s own figure, and that nothing changed', () => {
    expect(tooLarge(129 * 1024 * 1024)).toBe('That file is too large to restore: it is 129 MB, and a restore takes at most 128 MB. Nothing was changed.');
    expect(unpacksTooLarge()).toBe('That file is too large to restore: it unpacks to over 128 MB, and a restore takes at most 128 MB. Nothing was changed.');
    expect(tooMany('observations', 1_000_001)).toBe('That file holds 10,00,001 readings, and a restore takes at most 10,00,000. Nothing was changed.');
    expect(tooMany('routes', 100_001)).toBe('That file holds 1,00,001 walk routes, and a restore takes at most 1,00,000. Nothing was changed.');
    expect(tooManyPoints(5_020_000)).toBe('That file holds 50,20,000 route points, and a restore takes at most 50,00,000. Nothing was changed.');
    expect(textTooLong(100_001)).toBe('That file holds a text 1,00,001 characters long, and a restore takes none longer than 1,00,000. Nothing was changed.');
    expect(tooDeep()).toBe('That file is built in a way this app never writes. Nothing was changed.');
  });

  it('lists every limit in Me → Data’s words', () => {
    expect(limitLines()).toEqual([
      { label: 'File size', value: '128 MB, packed or unpacked' },
      { label: 'Readings', value: '10,00,000' },
      { label: 'Sessions', value: '1,00,000' },
      { label: 'Check-ins', value: '1,00,000' },
      { label: 'Personal records', value: '10,000' },
      { label: 'Body measurements', value: '1,00,000' },
      { label: 'Workout swaps', value: '1,00,000' },
      { label: 'Learn progress entries', value: '1,00,000' },
      { label: 'Walk routes', value: '1,00,000' },
      { label: 'Meals', value: '2,00,000' },
      { label: 'Usual meals', value: '10,000' },
      { label: 'Own foods', value: '10,000' },
      { label: 'Route points, all routes together', value: '50,00,000' },
      { label: 'Longest single text', value: '1,00,000 characters' },
    ]);
  });
});

describe('the walk over a document (Review Focus 5)', () => {
  it('finds a text too long, or nesting too deep, anywhere, a key included', () => {
    expect(shapeProblem(toTransferDoc(emptySnapshot()))).toBeUndefined();
    expect(shapeProblem({ sessions: [{ notes: 'x'.repeat(100_001) }] })).toBe(textTooLong(100_001));
    expect(shapeProblem({ ['k'.repeat(100_001)]: 1 })).toBe(textTooLong(100_001));
    expect(shapeProblem({ observations: nested(40) })).toBe(tooDeep());
    // Deeper than any call stack: still answered.
    expect(shapeProblem(nested(200_000, 1, x => ({ a: x })))).toBe(tooDeep());
    // The limits themselves are taken: a text of exactly 1,00,000 characters, and nesting exactly 32 deep.
    expect(shapeProblem({ notes: 'x'.repeat(IMPORT_LIMITS.textChars) })).toBeUndefined();
    expect(shapeExcess(nested(IMPORT_LIMITS.depth))).toBeUndefined();
    expect(shapeExcess(nested(IMPORT_LIMITS.depth + 1))).toEqual({ kind: 'depth' });
  });

  it('holds a frame per level, not per item, however broad the document (P8-16)', () => {
    const broad = { frames: 0 };
    expect(shapeExcess({ ...toTransferDoc(emptySnapshot()), unknownField: new Array(1_000_000).fill(7) }, broad)).toBeUndefined();
    expect(broad.frames).toBeLessThanOrEqual(3);
    const wide: Record<string, number> = {};
    for (let i = 0; i < 200_000; i++) wide[`k${i}`] = i;
    const keys = { frames: 0 };
    expect(shapeExcess({ ...toTransferDoc(emptySnapshot()), unknownField: wide }, keys)).toBeUndefined();
    expect(keys.frames).toBeLessThanOrEqual(3);
    const deep = { frames: 0 };
    expect(shapeExcess(nested(IMPORT_LIMITS.depth - 1), deep)).toBeUndefined();
    expect(deep.frames).toBe(IMPORT_LIMITS.depth - 1);
  });

  it('reads a broad file with nothing the app knows in it, and changes nothing', () => {
    const broad = { ...toTransferDoc(emptySnapshot()), unknownField: new Array(1_000_000).fill(7) };
    expect(previewImport(broad).ok).toBe(true);
    const base = emptySnapshot();
    const plan = planImport(broad, 'merge', base);
    expect(plan.report.observations + plan.report.sessions + plan.report.checkIns).toBe(0);
    expect(prepare(base, plan.change).next.observations).toEqual([]);
  });

  it('counts every route’s points together, whatever else the file holds', () => {
    expect(routePoints([{ segments: [{ coords: [[1, 2], [3, 4]] }, { coords: [[5, 6]] }] }, { segments: 'damaged' }, null, 7])).toBe(3);
    expect(routePoints(undefined)).toBe(0);
  });
});

describe('a file past a limit is refused before any record is read or converted (B-26, Review Focus 5)', () => {
  const file = (over: Record<string, unknown> = {}) => ({ ...toTransferDoc(emptySnapshot()), ...over });

  it('a file larger than the limit, by its size, before it is read (P8-15)', async () => {
    const arrayBuffer = vi.fn(async () => new ArrayBuffer(8));
    await expect(readBackupFile({ size: IMPORT_LIMITS.bytes + 1, arrayBuffer })).rejects.toThrow(tooLarge(IMPORT_LIMITS.bytes + 1));
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(await readBackupFile({ size: 8, arrayBuffer })).toBeInstanceOf(ArrayBuffer);
    // The limit itself is taken.
    expect(await readBackupFile({ size: IMPORT_LIMITS.bytes, arrayBuffer })).toBeInstanceOf(ArrayBuffer);
  });

  it('bytes handed in past the limit, named by their size', async () => {
    await expect(decode(new Uint8Array(2048), { maxBytes: 1024 })).rejects.toThrow(tooLarge(2048, 1024));
  });

  it('a small gzip that unpacks past the limit', async () => {
    const bomb = new Uint8Array(await new Response(new Blob([new Uint8Array(4 * 1024 * 1024)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    expect(bomb.byteLength).toBeLessThan(64 * 1024);
    await expect(decode(bomb, { maxBytes: 1024 * 1024 })).rejects.toThrow(unpacksTooLarge(1024 * 1024));
  });

  it('one enormous text, named by its length', () => {
    const reading = { id: 'g1', kind: 'glucose', value: 100, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: '2026-10-08T09:00:00+05:30', day: '2026-10-08', note: 'x'.repeat(100_001) };
    expect(previewImport(file({ observations: [reading] }))).toEqual({ ok: false, reason: textTooLong(100_001) });
  });

  it('nesting no app writes', () => {
    expect(previewImport(file({ focusOverrides: { '2026-10-08': nested(40) } }))).toEqual({ ok: false, reason: tooDeep() });
  });

  it('more routes than a restore takes, before any is read', () => {
    expect(previewImport(file({ stores: ['routes'], records: { routes: new Array(100_001).fill(null) } }))).toEqual({ ok: false, reason: tooMany('routes', 100_001) });
  });

  it('more route points than a restore takes, before any route is read', () => {
    const coords = new Array(20_000).fill([12.97, 77.59]);
    const routes = Array.from({ length: 251 }, (_, i) => ({ walkId: `walk-${i}`, segments: [{ coords }] }));
    expect(previewImport(file({ stores: ['routes'], records: { routes } }))).toEqual({ ok: false, reason: tooManyPoints(5_020_000) });
  });

  it('a legacy backup past a limit, a text too long or nesting too deep, before it is converted (P8-15)', () => {
    expect(previewImport(legacy({ sessions: new Array(100_001).fill(session('same')) }))).toEqual({ ok: false, reason: tooMany('sessions', 100_001) });
    expect(previewImport(legacy({ sessions: [session('s1', 'x'.repeat(100_001))] }))).toEqual({ ok: false, reason: textTooLong(100_001) });
    expect(previewImport(legacy({ focusOverrides: { '2026-10-02': nested(40) } }))).toEqual({ ok: false, reason: tooDeep() });
    expect([spies.migrated, spies.projected]).toEqual([0, 0]);
  });

  it('a legacy backup within every limit is converted, a long note no textarea capped included', () => {
    expect(previewImport(legacy({ sessions: [session('s1', 'x'.repeat(50_000))] })).ok).toBe(true);
    expect(spies.migrated).toBeGreaterThan(0);
  });
});

describe('an export past a limit keeps everything, and says so (D108, P8-17)', () => {
  it('names the limit and the record’s own figure, and the same file is refused in the same terms', async () => {
    const lifts = Array.from({ length: IMPORT_LIMITS.personalRecords + 1 }, (_, i) => ({ exerciseId: `exercise-${i}`, weight: 20, reps: 5, date: '2026-10-01', volume: 100 }));
    const doc = toTransferDoc({ ...emptySnapshot(), personalRecords: lifts } as Snapshot, AT);
    const made = await encode(doc);
    // What a restore unpacks it to: the JSON itself, larger than the gzip that carries it.
    expect(made.gzip).toBe(true);
    expect(made.textBytes).toBe(new TextEncoder().encode(JSON.stringify(await decode(made.bytes))).byteLength);
    const excess = exportExcess(doc, { packed: made.bytes.byteLength, unpacked: made.textBytes });
    expect(excess).toEqual({ kind: 'count', name: 'personalRecords', count: 10_001 });
    expect(exportWarning(excess!)).toBe('This backup holds everything, but it holds 10,001 personal records, and a restore takes at most 10,000, so this version of the app can’t restore it. Keep it: nothing was left out of it.');
    const back = await decode(made.bytes);
    expect((back as { personalRecords: unknown[] }).personalRecords).toHaveLength(10_001);
    expect(previewImport(back)).toEqual({ ok: false, reason: tooMany('personalRecords', 10_001) });
  });

  it('a file too large, packed or unpacked, is named by its size', () => {
    const doc = toTransferDoc(emptySnapshot(), AT);
    expect(exportExcess(doc, { packed: IMPORT_LIMITS.bytes + 1, unpacked: IMPORT_LIMITS.bytes + 1 })).toEqual({ kind: 'bytes', bytes: IMPORT_LIMITS.bytes + 1, max: IMPORT_LIMITS.bytes });
    expect(exportExcess(doc, { packed: 1024, unpacked: IMPORT_LIMITS.bytes + 1 })).toEqual({ kind: 'unpacked', max: IMPORT_LIMITS.bytes });
    expect(exportExcess(doc, { packed: 1024, unpacked: IMPORT_LIMITS.bytes })).toBeUndefined();
  });

  it('a record within every limit exports, reads back and restores whole', async () => {
    const water = newObservation({ id: 'water-1', kind: 'water', value: 500, scope: 'dayTotal', source: 'manual', at: AT });
    const snap: Snapshot = {
      ...emptySnapshot(),
      observations: [water],
      sessions: [session('s1', 'A steady one')] as unknown as Snapshot['sessions'],
      bodyMetrics: [{ date: '2026-10-01', weight: 82, waist: 96, notes: '' }] as Snapshot['bodyMetrics'],
      content: { 'guide:read:walking': { readAt: AT } },
      records: {
        routes: [], meals: [{ id: 'meal-1', at: AT, day: '2026-10-08', meal: 'lunch', items: [{ kind: 'quick', size: 'normal', name: 'Normal plate' }], level: 'meals', loggedAt: AT, edits: [] }],
        savedMeals: [{ id: 'usual-1', name: 'Weekday lunch', items: [{ kind: 'quick', size: 'normal', name: 'Normal plate' }], savedAt: AT, updatedAt: AT }],
        customFoods: [{ id: 'food-1', name: 'Bhel puri', per: { qty: 1, unit: 'plate' }, createdAt: AT, updatedAt: AT }],
      },
    };
    const doc = toTransferDoc(snap, AT);
    const made = await encode(doc);
    expect(exportExcess(doc, { packed: made.bytes.byteLength, unpacked: made.textBytes })).toBeUndefined();
    const raw = await decode(made.bytes);
    expect(previewImport(raw).ok).toBe(true);
    const restored = prepare(emptySnapshot(), planImport(raw, 'replace', emptySnapshot()).change).next;
    expect(restored.observations.map(o => [o.id, o.value])).toEqual([['water-1', 500]]);
    expect(restored.sessions.map(s => s.id)).toEqual(['s1']);
    expect(restored.content['guide:read:walking']).toEqual({ readAt: AT });
    expect([restored.records.meals.length, restored.records.savedMeals.length, restored.records.customFoods.length]).toEqual([1, 1, 1]);
  });
});
