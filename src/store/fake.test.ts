/**
 * F29: the fake must behave like IndexedDB wherever the store's correctness
 * rests on it, or the store's tests prove nothing. Each case is a native
 * behaviour the previous fake got wrong.
 */

import { describe, it, expect } from 'vitest';
import { openDb } from './db';
import { fakeIndexedDB } from './fakeIdb';

type Handler = ((event?: unknown) => void) | null;
interface RawRequest { result: unknown; error: unknown; onsuccess: Handler; onerror: Handler; onupgradeneeded: Handler }
interface RawTx { error: unknown; onerror: Handler; onabort: Handler; oncomplete: Handler; objectStore(name: string): RawStore }
interface RawStore { put(row: object): RawRequest; get(key: string): RawRequest }
interface RawDb { createObjectStore(name: string, o: { keyPath: string }): unknown; transaction(names: string[], mode: string): RawTx; close(): void }

function rawOpen(factory: IDBFactory): Promise<RawDb> {
  return new Promise(resolve => {
    const req = factory.open('raw', 1) as unknown as RawRequest;
    req.onupgradeneeded = () => void (req.result as RawDb).createObjectStore('s', { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result as RawDb);
  });
}

describe('F29 — the fake behaves like IndexedDB where the store depends on it', () => {
  it('refuses a record with no key at its key path', async () => {
    const db = await openDb(fakeIndexedDB());
    const result = await db.put('sessions', [{ date: '2026-10-08', sets: [] }]);
    expect(result.ok).toBe(false);
    expect(await db.getAll('sessions')).toEqual([]);
    db.close();
  });

  it('counts only new keys towards the quota', async () => {
    const db = await openDb(fakeIndexedDB({ quotaAfter: 2, quotaStore: 'observations' }));
    expect((await db.put('observations', [{ id: 'a', value: 1 }])).ok).toBe(true);
    // Overwrite `a`, add `b`: two rows, within a quota of two.
    expect((await db.put('observations', [{ id: 'a', value: 2 }, { id: 'b', value: 3 }])).ok).toBe(true);
    db.close();
  });

  it('can be closed and opened again', async () => {
    const factory = fakeIndexedDB();
    const first = await openDb(factory);
    await first.put('sessions', [{ id: 's1', date: '2026-10-08', sets: [], status: 'completed' }]);
    first.close();
    const second = await openDb(factory);
    expect(await second.getAll('sessions')).toHaveLength(1);
    second.close();
  });

  it('reports a failed request before the abort sets the transaction error', async () => {
    const db = await rawOpen(fakeIndexedDB({ quotaAfter: 0 }));
    const seen = await new Promise<{ atError: unknown; atAbort: unknown }>(resolve => {
      const tx = db.transaction(['s'], 'readwrite');
      let atError: unknown = 'not called';
      tx.onerror = () => { atError = tx.error; };
      tx.onabort = () => resolve({ atError, atAbort: tx.error });
      tx.objectStore('s').put({ id: 'a' });
    });
    expect(seen.atError).toBeNull();
    expect((seen.atAbort as { name?: string } | null)?.name).toBe('QuotaExceededError');
    db.close();
  });

  it('runs readwrite transactions on the same store one at a time, across connections', async () => {
    const factory = fakeIndexedDB();
    const a = await rawOpen(factory);
    const b = await rawOpen(factory);
    // A reads then writes inside one transaction; B, created after A, must
    // see A's write. Two tabs depend on exactly this.
    const first = new Promise<void>(resolve => {
      const tx = a.transaction(['s'], 'readwrite');
      tx.oncomplete = () => resolve();
      const req = tx.objectStore('s').get('counter');
      req.onsuccess = () => void tx.objectStore('s').put({ id: 'counter', n: ((req.result as { n?: number } | undefined)?.n ?? 0) + 1 });
    });
    const second = new Promise<number>(resolve => {
      const tx = b.transaction(['s'], 'readwrite');
      const req = tx.objectStore('s').get('counter');
      req.onsuccess = () => {
        const n = ((req.result as { n?: number } | undefined)?.n ?? 0) + 1;
        tx.objectStore('s').put({ id: 'counter', n });
        tx.oncomplete = () => resolve(n);
      };
    });
    await first;
    expect(await second).toBe(2);
    a.close();
    b.close();
  });
});
