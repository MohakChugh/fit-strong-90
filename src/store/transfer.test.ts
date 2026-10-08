import { describe, it, expect } from 'vitest';
import { createDefaultProfile } from '@/profile/defaults';
import type { CheckInRecord, Readiness } from '@/types/checkin';
import type { WorkoutSession } from '@/types';
import { newObservation, type Observation } from '@/health/observation';
import { doc, openDb, type Db } from './db';
import { fakeIndexedDB } from './fakeIdb';
import {
  TRANSFER_FORMAT,
  applyImport,
  collect,
  decode,
  deliver,
  deliveryMethod,
  encode,
  planImport,
  previewImport,
} from './transfer';

const readiness: Readiness = {
  outcome: 'green', modifiers: [], back: 'green', nerveFlag: false, reasons: [], actions: [],
  vigorousLocked: false, capHeavy: false, rpeOnly: true, notices: [],
};

const session: WorkoutSession = {
  id: 'session-1', date: '2026-10-01', dayOfWeek: 'thursday', muscleGroup: 'lower', phase: 'foundation',
  week: 1, status: 'completed', sets: [], startedAt: null, completedAt: null, notes: 'Steady.', totalVolume: 240,
};

const checkIn: CheckInRecord = {
  date: '2026-10-01', urgentSymptoms: false, news: [], sleep: '5to7', energy: 4, readiness,
};

const glucose = (id: string, day: string, value: number): Observation => newObservation({
  id, kind: 'glucose', value, scope: 'pointInTime', source: 'manual', at: `${day}T07:30:00+05:30`,
});

const steps = (id: string, day: string, value: number): Observation => newObservation({
  id, kind: 'steps', value, scope: 'dayTotal', source: 'manual', at: `${day}T22:00:00+05:30`,
});

async function seeded(options: Parameters<typeof fakeIndexedDB>[0] = {}): Promise<Db> {
  const db = await openDb(fakeIndexedDB(options));
  await db.put('observations', [glucose('g1', '2026-10-01', 132), glucose('g2', '2026-10-05', 118), steps('s1', '2026-10-01', 8100)]);
  await db.put('sessions', [session]);
  await db.put('settings', [
    doc('schemaVersion', 5),
    doc('settings', { theme: 'dark', defaultRestSeconds: 90 }),
    doc('profile', createDefaultProfile({ weightKg: 82 })),
    doc('checkIns', [checkIn]),
    doc('personalRecords', [{ exerciseId: 'goblet-squat', weight: 24, reps: 10, date: '2026-10-01', volume: 240 }]),
    doc('bodyMetrics', [{ date: '2026-10-01', weight: 82, waist: 96, notes: '' }]),
    doc('focusOverrides', { '2026-10-08': 'activeRecovery' }),
  ]);
  return db;
}

/**
 * Every store, so a round trip that loses one is caught (review F12) — minus
 * the commit metadata (`seq`, the `revision` row) that a new commit
 * legitimately moves.
 */
async function dump(db: Db) {
  const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);
  const byKey = (a: { key: string }, b: { key: string }) => a.key.localeCompare(b.key);
  const unstamped = (rows: { id: string; seq?: number }[]) => rows.map(({ seq, ...rest }) => { void seq; return rest; });
  return {
    observations: unstamped(await db.getAll<{ id: string; seq?: number }>('observations')).sort(byId),
    sessions: (await db.getAll<{ id: string }>('sessions')).sort(byId),
    settings: (await db.getAll<{ key: string }>('settings')).filter(row => row.key !== 'revision').sort(byKey),
    content: (await db.getAll<{ key: string }>('content-state')).sort(byKey),
  };
}

describe('collect', () => {
  it('gathers everything on the device into one document', async () => {
    const db = await seeded();
    const result = await collect(db);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const exported = result.value;
    expect(exported.format).toBe(TRANSFER_FORMAT);
    expect(exported.schemaVersion).toBe(5);
    expect(exported.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}(Z|[+-]\d{2}:\d{2})$/);
    expect(exported.observations.map(o => o.id)).toEqual(['g1', 's1', 'g2']);
    expect(exported.sessions).toEqual([session]);
    expect(exported.checkIns).toEqual([checkIn]);
    expect(exported.settings).toMatchObject({ theme: 'dark' });
    expect(exported.profile).toMatchObject({ weightKg: 82 });
    expect(exported.personalRecords).toHaveLength(1);
    expect(exported.bodyMetrics).toHaveLength(1);
    expect(exported.focusOverrides).toEqual({ '2026-10-08': 'activeRecovery' });
    db.close();
  });

  it('exports a device with nothing on it without inventing anything', async () => {
    const db = await openDb(fakeIndexedDB());
    const result = await collect(db);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.observations).toEqual([]);
      expect(result.value.profile).toBeUndefined();
      expect(result.value.checkIns).toEqual([]);
    }
    db.close();
  });
});

describe('encode and decode', () => {
  it('round-trips through gzip without losing a field', async () => {
    const db = await seeded();
    const collected = await collect(db);
    if (!collected.ok) return expect.unreachable('collect failed');

    const file = await encode(collected.value);
    expect(file.gzip).toBe(true);
    expect(file.name).toMatch(/^fit-strong-health-record-\d{4}-\d{2}-\d{2}\.json\.gz$/);
    expect([file.bytes[0], file.bytes[1]]).toEqual([0x1f, 0x8b]);

    expect(await decode(file.bytes)).toEqual(collected.value);
    db.close();
  });

  it('compresses, which is the point of doing it at all', async () => {
    const db = await seeded();
    const collected = await collect(db);
    if (!collected.ok) return expect.unreachable('collect failed');
    const plain = new TextEncoder().encode(JSON.stringify(collected.value));
    const file = await encode(collected.value);
    expect(file.bytes.byteLength).toBeLessThan(plain.byteLength);
    db.close();
  });

  it('reads a plain JSON file too, for a hand-edited backup or an older export', async () => {
    const plain = new TextEncoder().encode(JSON.stringify({ format: TRANSFER_FORMAT, version: 1, observations: [] }));
    expect(await decode(plain)).toMatchObject({ format: TRANSFER_FORMAT });
    expect(await decode(plain.buffer as ArrayBuffer)).toMatchObject({ format: TRANSFER_FORMAT });
  });

  it('refuses a file that is not readable at all', async () => {
    await expect(decode(new TextEncoder().encode('{ not json'))).rejects.toThrow(/could not be read/i);
    await expect(decode(new Uint8Array([0x1f, 0x8b, 0x00, 0x01]))).rejects.toThrow(/could not be read/i);
  });
});

describe('previewImport', () => {
  const file = {
    format: TRANSFER_FORMAT,
    version: 1,
    exportedAt: '2026-10-08T09:00:00+05:30',
    schemaVersion: 5,
    observations: [glucose('g1', '2026-10-01', 132), glucose('g9', '2026-10-09', 101), steps('s1', '2026-10-01', 8100)],
    sessions: [session],
    checkIns: [checkIn],
    personalRecords: [{ exerciseId: 'goblet-squat', weight: 24, reps: 10, date: '2026-10-01', volume: 240 }],
    bodyMetrics: [{ date: '2026-10-01', weight: 82, waist: 96, notes: '' }],
    focusOverrides: { '2026-10-08': 'activeRecovery' },
    settings: { theme: 'dark' },
    profile: { weightKg: 82 },
  };

  it('counts what is in the file, per kind, before anything is written', () => {
    const preview = previewImport(file);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.observations).toEqual({ glucose: 2, steps: 1 });
    expect(preview.sessions).toBe(1);
    expect(preview.checkIns).toBe(1);
    expect(preview.personalRecords).toBe(1);
    expect(preview.bodyMetrics).toBe(1);
    expect(preview.focusOverrides).toBe(1);
    expect(preview.hasSettings).toBe(true);
    expect(preview.hasProfile).toBe(true);
    expect(preview.range).toEqual({ from: '2026-10-01', to: '2026-10-09' });
    expect(preview.exportedAt).toBe('2026-10-08T09:00:00+05:30');
  });

  it('says how much of it this device already has', () => {
    const preview = previewImport(file, ['g1', 'nothing-like-it']);
    if (!preview.ok) return expect.unreachable('preview failed');
    expect(preview.alreadyHere).toBe(1);
  });

  it('counts records it cannot read rather than pretending they are fine', () => {
    const preview = previewImport({
      ...file,
      observations: [...file.observations, { id: 'bad', kind: 'glucose', value: 'lots' }, null, { id: 'x', kind: 'nonsense', at: '2026-10-01T07:00:00+05:30', day: '2026-10-01', value: 1, unit: 'mg/dL', scope: 'pointInTime', source: 'manual' }],
    });
    if (!preview.ok) return expect.unreachable('preview failed');
    expect(preview.observations).toEqual({ glucose: 2, steps: 1 });
    expect(preview.unreadableObservations).toBe(3);
  });

  it('refuses a file from another app, or from the future', () => {
    expect(previewImport(null)).toMatchObject({ ok: false });
    expect(previewImport('a string')).toMatchObject({ ok: false });
    expect(previewImport({ format: 'something-else', version: 1 })).toMatchObject({ ok: false });
    expect(previewImport({ format: TRANSFER_FORMAT, version: 99 })).toMatchObject({ ok: false });
    expect(previewImport({ format: TRANSFER_FORMAT, version: 99 })).toMatchObject({ reason: expect.stringMatching(/newer/i) });
  });

  it('accepts a file with nothing in it, and says it is empty', () => {
    const preview = previewImport({ format: TRANSFER_FORMAT, version: 1 });
    if (!preview.ok) return expect.unreachable('preview failed');
    expect(preview.observations).toEqual({});
    expect(preview.range).toBeUndefined();
    expect(preview.isEmpty).toBe(true);
  });

  it('a file with health answers and settings but no readings is not empty, and restores them (D-07)', async () => {
    const answers = { format: TRANSFER_FORMAT, version: 1, settings: { onboardingComplete: true, theme: 'dark' }, profile: { weightKg: 64 } };
    const preview = previewImport(answers);
    if (!preview.ok) return expect.unreachable('preview failed');
    expect(preview.isEmpty).toBe(false);
    expect(previewImport({ format: TRANSFER_FORMAT, version: 1, profile: { weightKg: 64 } })).toMatchObject({ isEmpty: false });
    const { emptySnapshot } = await import('./snapshot');
    const { change } = planImport(answers, 'replace', emptySnapshot());
    expect(change.profile?.weightKg).toBe(64);
    expect(change.settings?.replace?.theme).toBe('dark');
  });
});

describe('applyImport', () => {
  const incoming = {
    format: TRANSFER_FORMAT,
    version: 1,
    exportedAt: '2026-10-08T09:00:00+05:30',
    schemaVersion: 5,
    observations: [glucose('g1', '2026-10-01', 999), glucose('g9', '2026-10-09', 101)],
    sessions: [{ ...session, id: 'session-9', date: '2026-10-09' }],
    checkIns: [{ ...checkIn, date: '2026-10-09' }],
    personalRecords: [{ exerciseId: 'bench-press', weight: 60, reps: 5, date: '2026-10-09', volume: 300 }],
    bodyMetrics: [{ date: '2026-10-09', weight: 81, waist: null, notes: '' }],
    focusOverrides: { '2026-10-09': 'upperA' },
    settings: { theme: 'light' },
    profile: { weightKg: 70 },
  };

  it('replaces: the device ends up holding exactly what the file held', async () => {
    const db = await seeded();
    const result = await applyImport(db, incoming, 'replace');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.mode).toBe('replace');
    expect(result.value.observations).toBe(2);

    expect((await db.getAll<Observation>('observations')).map(o => o.id).sort()).toEqual(['g1', 'g9']);
    expect((await db.getAll<WorkoutSession>('sessions')).map(s => s.id)).toEqual(['session-9']);
    // A partial profile is completed on the way in, so the planner never meets
    // one missing fields (review F22).
    expect(await db.get('settings', 'profile')).toMatchObject({ value: { weightKg: 70 } });
    expect(await db.get<{ value: { trainingDays: unknown[] } }>('settings', 'profile')).toMatchObject({ value: { trainingDays: expect.any(Array) } });
    expect(await db.get('settings', 'schemaVersion')).toEqual(doc('schemaVersion', 5));
    expect(await db.get('settings', 'focusOverrides')).toEqual(doc('focusOverrides', { '2026-10-09': 'upperA' }));
    db.close();
  });

  // A clash with no way to tell which copy is newer keeps this device's
  // record unless the user says otherwise (review F08).
  it('merges: the file is added, and a clash keeps this device\'s record unless told otherwise', async () => {
    const db = await seeded();
    const result = await applyImport(db, incoming, 'merge');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // g9, plus the weight series of the file's new 9 October measurement (F14).
    expect(result.value.observations).toBe(2);
    expect(result.value.replacedObservations).toBe(0);
    expect(result.value.conflicts?.observations).toBe(1);

    const observations = await db.getAll<Observation>('observations');
    expect(observations.map(o => o.id).sort()).toEqual(['bodyMetric:2026-10-09:weight', 'g1', 'g2', 'g9', 's1']);
    expect(observations.find(o => o.id === 'g1')?.value).toBe(132);
    expect(observations.find(o => o.id === 'bodyMetric:2026-10-09:weight')?.value).toBe(81);

    const told = await applyImport(db, incoming, 'merge', { onConflict: 'takeFile' });
    expect(told.ok && told.value.replacedObservations).toBe(1);
    expect((await db.get<Observation>('observations', 'g1'))?.value).toBe(999);

    expect((await db.getAll<WorkoutSession>('sessions')).map(s => s.id).sort()).toEqual(['session-1', 'session-9']);
    expect(await db.get('settings', 'checkIns')).toMatchObject({ value: [checkIn, { date: '2026-10-09' }] });
    expect(await db.get<{ value: unknown[] }>('settings', 'personalRecords')).toMatchObject({ value: [{ exerciseId: 'goblet-squat' }, { exerciseId: 'bench-press' }] });
    expect(await db.get('settings', 'focusOverrides')).toEqual(doc('focusOverrides', { '2026-10-08': 'activeRecovery', '2026-10-09': 'upperA' }));
    db.close();
  });

  it('merges without overwriting this device\'s own settings and profile', async () => {
    const db = await seeded();
    await applyImport(db, incoming, 'merge');
    expect(await db.get('settings', 'settings')).toMatchObject({ value: { theme: 'dark' } });
    expect(await db.get('settings', 'profile')).toMatchObject({ value: { weightKg: 82 } });
    db.close();
  });

  // A personal record is a historical maximum, so taking a lower imported
  // value would delete a lift the user actually did.
  it('keeps the heavier of two personal records for the same exercise', async () => {
    const db = await seeded();
    await applyImport(db, {
      ...incoming,
      personalRecords: [
        { exerciseId: 'goblet-squat', weight: 20, reps: 8, date: '2026-09-01', volume: 160 },
        { exerciseId: 'bench-press', weight: 60, reps: 5, date: '2026-10-09', volume: 300 },
      ],
    }, 'merge');
    expect(await db.get('settings', 'personalRecords')).toMatchObject({
      value: [{ exerciseId: 'goblet-squat', volume: 240 }, { exerciseId: 'bench-press', volume: 300 }],
    });
    db.close();
  });

  it('takes the file\'s personal record when it is the heavier one', async () => {
    const db = await seeded();
    await applyImport(db, {
      ...incoming,
      personalRecords: [{ exerciseId: 'goblet-squat', weight: 32, reps: 10, date: '2026-10-09', volume: 320 }],
    }, 'merge');
    expect(await db.get('settings', 'personalRecords')).toMatchObject({ value: [{ exerciseId: 'goblet-squat', volume: 320 }] });
    db.close();
  });

  it('adopts the file\'s profile when this device has none yet', async () => {
    const db = await openDb(fakeIndexedDB());
    await applyImport(db, incoming, 'merge');
    expect(await db.get('settings', 'profile')).toMatchObject({ value: { weightKg: 70 } });
    db.close();
  });

  // A damaged file is refused whole unless the user asks for the readable
  // rest: it must never half-replace a good record (review F22).
  it('leaves out records it cannot read only when asked, and says how many', async () => {
    const db = await seeded();
    const damaged = { ...incoming, observations: [...incoming.observations, { id: 'bad', kind: 'glucose', value: 'lots' }] };

    const refused = await applyImport(db, damaged, 'replace');
    expect(refused.ok).toBe(false);
    expect((await db.getAll<Observation>('observations')).map(o => o.id).sort()).toEqual(['g1', 'g2', 's1']);

    const result = await applyImport(db, damaged, 'replace', { allowRejected: true });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.skipped).toBe(1);
    expect((await db.getAll<Observation>('observations')).map(o => o.id).sort()).toEqual(['g1', 'g9']);
    db.close();
  });

  it('refuses a file it does not understand, before writing anything', async () => {
    const db = await seeded();
    const before = await dump(db);
    const result = await applyImport(db, { format: 'something-else' }, 'replace');
    expect(result.ok).toBe(false);
    expect(await dump(db)).toEqual(before);
    db.close();
  });

  it('reports a full device instead of half-importing', async () => {
    const db = await openDb(fakeIndexedDB({ quotaAfter: 1 }));
    const result = await applyImport(db, incoming, 'replace');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('quotaExceeded');
    expect(await db.getAll('observations')).toEqual([]);
    db.close();
  });

  it('survives the whole journey: export here, import there', async () => {
    const source = await seeded();
    const collected = await collect(source);
    if (!collected.ok) return expect.unreachable('collect failed');
    const file = await encode(collected.value);

    const target = await openDb(fakeIndexedDB());
    const applied = await applyImport(target, await decode(file.bytes), 'replace');
    expect(applied.ok).toBe(true);
    expect(await dump(target)).toEqual(await dump(source));
    source.close();
    target.close();
  });
});

// D17: no File System Access and no Share Target on iOS, so a round trip is
// always an explicit user action — and it has to work when sharing does not.
describe('delivering the file', () => {
  const file = new File([new Uint8Array([1, 2, 3])], 'record.json.gz', { type: 'application/gzip' });

  it('shares when the browser will share a file, and downloads when it will not', () => {
    const sharing = { canShare: () => true, share: async () => undefined } as unknown as Navigator;
    expect(deliveryMethod(file, sharing)).toBe('share');
    expect(deliveryMethod(file, { share: async () => undefined } as unknown as Navigator)).toBe('download');
    expect(deliveryMethod(file, { canShare: () => false, share: async () => undefined } as unknown as Navigator)).toBe('download');
    expect(deliveryMethod(file, undefined)).toBe('download');
  });

  it('shares the file', async () => {
    const shared: unknown[] = [];
    const result = await deliver(file, {
      navigator: { canShare: () => true, share: async (data: unknown) => void shared.push(data) } as unknown as Navigator,
    });
    expect(result).toEqual({ ok: true, value: 'share' });
    expect(shared).toEqual([{ files: [file] }]);
  });

  it('reports a cancelled share as cancelled, not as a failure', async () => {
    const result = await deliver(file, {
      navigator: {
        canShare: () => true,
        share: async () => { throw new DOMException('cancelled', 'AbortError'); },
      } as unknown as Navigator,
    });
    expect(result).toEqual({ ok: true, value: 'cancelled' });
  });

  it('falls back to a download when sharing fails for any other reason', async () => {
    const clicks: string[] = [];
    const result = await deliver(file, {
      navigator: { canShare: () => true, share: async () => { throw new Error('no'); } } as unknown as Navigator,
      document: fakeDocument(clicks),
      createObjectURL: () => 'blob:x',
      revokeObjectURL: () => undefined,
    });
    expect(result).toEqual({ ok: true, value: 'download' });
    expect(clicks).toEqual(['record.json.gz@blob:x']);
  });

  it('downloads through a link when there is no share sheet', async () => {
    const clicks: string[] = [];
    const result = await deliver(file, { document: fakeDocument(clicks), createObjectURL: () => 'blob:y', revokeObjectURL: () => undefined });
    expect(result).toEqual({ ok: true, value: 'download' });
    expect(clicks).toEqual(['record.json.gz@blob:y']);
  });

  it('says it cannot hand over the file rather than doing nothing', async () => {
    const result = await deliver(file, {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.message).toMatch(/could not/i);
  });
});

function fakeDocument(clicks: string[]): Document {
  return {
    createElement: () => {
      const link = { href: '', download: '', rel: '', click: () => clicks.push(`${link.download}@${link.href}`) };
      return link as unknown as HTMLAnchorElement;
    },
  } as unknown as Document;
}
