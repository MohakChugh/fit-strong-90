import { describe, it, expect } from 'vitest';
import { newObservation } from '@/health/observation';
import { DB_VERSION, JOURNAL_STORE, STORE_NAMES, StoreFailure, openDb, requestPersistence, type Db } from './db';
import { fakeIndexedDB } from './fakeIdb';
import { RECORD_STORES } from './records';

async function open(options: Parameters<typeof fakeIndexedDB>[0] = {}): Promise<Db> {
  return openDb(fakeIndexedDB(options));
}

const glucose = (id: string, day: string, value: number) => newObservation({
  id, kind: 'glucose', value, scope: 'pointInTime', source: 'manual', at: `${day}T07:30:00+05:30`,
});

describe('openDb', () => {
  it('creates every store the app needs, with the observation indexes', async () => {
    const db = await open();
    for (const name of STORE_NAMES) expect(await db.getAll(name)).toEqual([]);
    expect(await db.byIndex('observations', 'kind', 'glucose')).toEqual([]);
    expect(await db.byIndex('observations', 'day', '2026-10-08')).toEqual([]);
    db.close();
  });

  it('reports a missing IndexedDB as a typed failure rather than crashing', async () => {
    await expect(openDb(undefined)).rejects.toThrow(StoreFailure);
    await expect(openDb(undefined)).rejects.toMatchObject({ code: 'unavailable' });
    // The message goes on the screen (D16), so it has to be a sentence rather
    // than the stack-level complaint of calling a method on nothing.
    const failure = await openDb(undefined).then(
      () => { throw new Error('openDb must not resolve when there is no IndexedDB'); },
      (error: StoreFailure) => error,
    );
    expect(failure.message).toMatch(/this browser is not letting the app store data/i);
    expect(failure.message).not.toMatch(/undefined|cannot read/i);
  });

  it('reports a refused open as a typed failure', async () => {
    await expect(open({ openFails: 'throw' })).rejects.toMatchObject({ code: 'unavailable' });
    await expect(open({ openFails: 'error' })).rejects.toMatchObject({ code: 'unknown' });
    await expect(open({ openFails: 'blocked' })).rejects.toMatchObject({ code: 'blocked' });
  });
});

describe('reading and writing', () => {
  it('round-trips records and finds them by index', async () => {
    const db = await open();
    const records = [glucose('a', '2026-10-08', 112), glucose('b', '2026-10-08', 141), glucose('c', '2026-10-09', 98)];
    expect(await db.put('observations', records)).toEqual({ ok: true, value: undefined });

    expect(await db.get('observations', 'b')).toEqual(records[1]);
    expect(await db.get('observations', 'nope')).toBeUndefined();
    expect((await db.getAll('observations')).map(o => (o as { id: string }).id).sort()).toEqual(['a', 'b', 'c']);
    expect((await db.byIndex('observations', 'day', '2026-10-08')).map(o => (o as { id: string }).id).sort()).toEqual(['a', 'b']);
    expect(await db.byIndex('observations', 'kind', 'weight')).toEqual([]);
    db.close();
  });

  it('replaces a record with the same key', async () => {
    const db = await open();
    await db.put('observations', [glucose('a', '2026-10-08', 112)]);
    await db.put('observations', [glucose('a', '2026-10-08', 120)]);
    expect(await db.getAll('observations')).toHaveLength(1);
    expect(await db.get<{ value: number }>('observations', 'a')).toMatchObject({ value: 120 });
    db.close();
  });

  it('stores keyed documents in the settings store', async () => {
    const db = await open();
    await db.put('settings', [{ key: 'profile', value: { weightKg: 82 } }]);
    expect(await db.get('settings', 'profile')).toEqual({ key: 'profile', value: { weightKg: 82 } });
    db.close();
  });

  it('removes and clears', async () => {
    const db = await open();
    await db.put('observations', [glucose('a', '2026-10-08', 112), glucose('b', '2026-10-08', 141)]);
    await db.put('sessions', [{ id: 's1' }]);

    expect(await db.remove('observations', ['a'])).toMatchObject({ ok: true });
    expect(await db.getAll('observations')).toHaveLength(1);

    expect(await db.clear(['observations', 'sessions'])).toMatchObject({ ok: true });
    expect(await db.getAll('observations')).toEqual([]);
    expect(await db.getAll('sessions')).toEqual([]);
    db.close();
  });

  it('writes nothing at all when a write in the batch fails', async () => {
    // Both routes a full device takes: the transaction aborting a moment
    // later, and `put` itself throwing before the batch is even submitted. In
    // the second case the records queued ahead of the failure must not commit.
    for (const quota of ['abort', 'sync'] as const) {
      const db = await open({ quotaAfter: 1, quota });
      const result = await db.put('observations', [glucose('a', '2026-10-08', 112), glucose('b', '2026-10-08', 141)]);
      expect(result.ok).toBe(false);
      expect(await db.getAll('observations')).toEqual([]);
      db.close();
    }
  });

  it('survives a closed database without throwing into a void', async () => {
    const db = await open();
    db.close();
    const result = await db.put('observations', [glucose('a', '2026-10-08', 112)]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure).toBeInstanceOf(StoreFailure);
  });
});

// D16: the device filling up is a thing that happens to real people, and the UI
// has to be able to say so.
describe('QuotaExceededError', () => {
  it('surfaces a quota failure the UI can show, however the engine reports it', async () => {
    for (const quota of ['sync', 'abort'] as const) {
      const db = await open({ quotaAfter: 0, quota });
      const result = await db.put('observations', [glucose('a', '2026-10-08', 112)]);
      expect(result.ok).toBe(false);
      if (result.ok) expect.unreachable('a write past the quota must not report success');
      expect(result.failure).toBeInstanceOf(StoreFailure);
      expect(result.failure.code).toBe('quotaExceeded');
      expect(result.failure.message).toMatch(/space/i);
      db.close();
    }
  });

  // Engines word this differently and some localise it, so the name is what
  // identifies it; the message is only a last resort.
  it('recognises a full device by the error name, not by reading the message', async () => {
    const db = await open({ writeError: () => new DOMException('The operation failed.', 'QuotaExceededError') });
    const result = await db.put('observations', [glucose('a', '2026-10-08', 112)]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('quotaExceeded');
    db.close();
  });

  it('still recognises one that only says so in the message', async () => {
    const db = await open({ writeError: () => Object.assign(new Error('Storage limit reached: quota.'), { name: 'UnknownError' }) });
    const result = await db.put('observations', [glucose('a', '2026-10-08', 112)]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('quotaExceeded');
    db.close();
  });

  it('does not mistake an unrelated failure for a full device', async () => {
    const db = await open({ writeError: () => new DOMException('Write refused.', 'UnknownError') });
    const result = await db.put('observations', [glucose('a', '2026-10-08', 112)]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe('unknown');
    db.close();
  });
});

describe('requestPersistence', () => {
  it('is false when the browser does not offer persistent storage', async () => {
    expect(await requestPersistence(undefined)).toBe(false);
    expect(await requestPersistence({} as Navigator)).toBe(false);
  });

  it('asks once and reports what the browser said', async () => {
    const calls: string[] = [];
    const nav = {
      storage: {
        persisted: async () => { calls.push('persisted'); return false; },
        persist: async () => { calls.push('persist'); return true; },
      },
    } as unknown as Navigator;
    expect(await requestPersistence(nav)).toBe(true);
    expect(calls).toEqual(['persisted', 'persist']);
  });

  it('does not ask again once storage is already persistent', async () => {
    const calls: string[] = [];
    const nav = {
      storage: {
        persisted: async () => { calls.push('persisted'); return true; },
        persist: async () => { calls.push('persist'); return false; },
      },
    } as unknown as Navigator;
    expect(await requestPersistence(nav)).toBe(true);
    expect(calls).toEqual(['persisted']);
  });

  it('reports false rather than throwing when the browser refuses to answer', async () => {
    const nav = { storage: { persisted: async () => { throw new Error('denied'); } } } as unknown as Navigator;
    expect(await requestPersistence(nav)).toBe(false);
  });
});

/** A v1 build's database: its four stores and one reading, as a phone holds it today. */
async function v1Database(factory: IDBFactory): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = factory.open('fit-strong', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      const o = db.createObjectStore('observations', { keyPath: 'id' });
      o.createIndex('kind', 'kind');
      o.createIndex('day', 'day');
      db.createObjectStore('sessions', { keyPath: 'id' });
      db.createObjectStore('settings', { keyPath: 'key' });
      db.createObjectStore('content-state', { keyPath: 'key' });
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(['observations'], 'readwrite');
      tx.objectStore('observations').put(glucose('a', '2026-10-08', 112));
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Another tab still on v1: a plain connection at version 1. */
function v1Tab(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>(resolve => {
    const req = factory.open('fit-strong', 1);
    req.onsuccess = () => resolve(req.result);
  });
}

describe('IndexedDB version 2 (journey §18.3)', () => {
  it('upgrades a version 1 database in place: every row kept, every v2 store added, empty', async () => {
    const factory = fakeIndexedDB();
    await v1Database(factory);
    const db = await openDb(factory);
    expect(DB_VERSION).toBe(2);
    expect(await db.getAll('observations')).toHaveLength(1);
    for (const store of [...RECORD_STORES, JOURNAL_STORE] as const) expect(await db.getAll(store)).toEqual([]);
    const rows = await db.readAll();
    expect(Object.keys(rows.records).sort()).toEqual([...RECORD_STORES].sort());
    expect(JOURNAL_STORE in rows).toBe(false);
    db.close();
  });

  it('asks an open v1 copy to close, then opens: the bump never deadlocks with an old tab', async () => {
    const factory = fakeIndexedDB();
    await v1Database(factory);
    const old = await v1Tab(factory);
    // What v1's own handler does with a versionchange: close (src/store/db.ts, openDb).
    old.onversionchange = () => old.close();
    const db = await openDb(factory);
    expect(await db.getAll('routes')).toEqual([]);
    db.close();
  });

  it('waits for a v1 copy that cannot let go at once, then upgrades with every row kept (B-21)', async () => {
    const factory = fakeIndexedDB();
    await v1Database(factory);
    const old = await v1Tab(factory);
    // A v1 tab part-way through its own start, which lets go only later.
    old.onversionchange = () => undefined;
    let blocked = 0;
    let opened: Db | undefined;
    const opening = openDb(factory, { onBlocked: () => { blocked += 1; } }).then(db => { opened = db; return db; });
    await new Promise(resolve => setTimeout(resolve, 5));
    expect(blocked).toBe(1);
    expect(opened).toBeUndefined();
    old.close();
    const db = await opening;
    expect(await db.getAll('observations')).toHaveLength(1);
    expect(await db.getAll('routes')).toEqual([]);
    expect(factory.control.openConnections()).toBe(1);
    db.close();
  });
});
