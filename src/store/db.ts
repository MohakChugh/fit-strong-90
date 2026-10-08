/**
 * IndexedDB, hand-rolled (PLAN.md Task 1, D13).
 *
 * `localStorage` is 5 MiB and synchronous; an installed iOS PWA gets roughly
 * 60% of disk through IndexedDB, and WebKit exempts installed web apps from
 * the 7-day storage wipe. A lifelong health record belongs here.
 *
 * Deliberate shapes:
 *
 * - **Writes return a result, they do not reject.** A full device is a thing
 *   that happens to real people, and `QuotaExceededError` must reach the
 *   screen, not a swallowed promise (D16).
 * - **One logical change, one transaction.** `transact` spans every store, so
 *   a check-in and the readings lifted out of it, or an import's clear and
 *   its writes, commit together or not at all. `readAll` reads every store in
 *   one transaction, so an export is one moment even while another tab writes.
 * - **Every write moves `revision`.** It is the one row that tells a second
 *   open copy of the app that what it holds in memory is out of date.
 * - **The factory is an argument.** Vitest runs in node with no IndexedDB, so
 *   tests pass in a fake rather than the app taking a dependency.
 */

export const DB_NAME = 'fit-strong';
export const DB_VERSION = 1;

export const STORE_NAMES = ['observations', 'sessions', 'settings', 'content-state'] as const;
export type StoreName = (typeof STORE_NAMES)[number];

/** Indexes on `observations`: the two things every screen groups by. */
export type ObservationIndex = 'kind' | 'day';

export type FailureCode =
  /** The device is out of space. The user has to be told (D16). */
  | 'quotaExceeded'
  /** No IndexedDB at all, or the browser refused it outright. */
  | 'unavailable'
  /** Another open copy of the app is holding the database. */
  | 'blocked'
  | 'aborted'
  /** A record the rules refuse: nothing was written. */
  | 'invalid'
  /** The change collides with what is stored — an id already in use, an import conflict. */
  | 'conflict'
  /** This copy was closed so a newer version could open the database; it must reload. */
  | 'stale'
  /** Part of a multi-step action happened. The message says which part. */
  | 'partial'
  /** Stored records could not be read, so nothing new is written over them. */
  | 'readFailed'
  | 'unknown';

/** One refused item in a batch: its position in what was passed, its id, and why. */
export interface FailureDetail {
  index: number;
  id?: string;
  reason: string;
}

export class StoreFailure extends Error {
  readonly code: FailureCode;
  /** For a refused batch, which items were refused and why. */
  readonly details?: readonly FailureDetail[];

  constructor(code: FailureCode, message: string, cause?: unknown, details?: readonly FailureDetail[]) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'StoreFailure';
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export type StoreResult<T = void> = { ok: true; value: T } | { ok: false; failure: StoreFailure };

const QUOTA_MESSAGE = 'There is not enough space on this device to save that. Free some space, or export and remove older records.';

/** Fields read off whatever was thrown, without trusting it to be an `Error` from this realm. */
function describeError(error: unknown): { name?: string; message?: string; code?: number } {
  if (typeof error !== 'object' || error === null) return {};
  const e = error as { name?: unknown; message?: unknown; code?: unknown };
  return {
    ...(typeof e.name === 'string' ? { name: e.name } : {}),
    ...(typeof e.message === 'string' ? { message: e.message } : {}),
    ...(typeof e.code === 'number' ? { code: e.code } : {}),
  };
}

/**
 * Whether this is the device running out of space.
 *
 * Duck-typed on purpose: a `DOMException` from another realm (a worker, an
 * iframe, some WebIDL exception shapes) is not `instanceof Error` here. The
 * name is the real test; legacy WebKit's `code` 22 and Firefox's old name are
 * the same condition; the message is a last resort for a wrapper that rethrew
 * and lost the name, because engines word it differently and some localise it.
 */
function isQuota(error: unknown): boolean {
  const { name, message, code } = describeError(error);
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') return true;
  if (code === 22) return true;
  return message !== undefined && /quota/i.test(message);
}

/** Turn anything a storage API threw into something the UI can show. */
export function toFailure(error: unknown, fallback: FailureCode = 'unknown'): StoreFailure {
  if (error instanceof StoreFailure) return error;
  if (isQuota(error)) return new StoreFailure('quotaExceeded', QUOTA_MESSAGE, error);
  const { name, message } = describeError(error);
  if (name === 'AbortError') return new StoreFailure('aborted', 'The save was interrupted before it finished.', error);
  // The database is a newer version than this code: another tab updated it.
  if (name === 'VersionError') return new StoreFailure('stale', 'The app was updated in another tab or window.', error);
  // A record the rules refuse is the caller's message to show, not a storage fault.
  if (name === 'ObservationError') return new StoreFailure('invalid', message ?? 'That record cannot be saved.', error);
  if (name === 'DataCloneError') return new StoreFailure('invalid', 'That contains something that cannot be stored.', error);
  const detail = message ?? String(error);
  return new StoreFailure(fallback, `Could not reach this device's storage: ${detail}`, error);
}

/** Every row of every store, read in one transaction. */
export interface Rows {
  observations: unknown[];
  sessions: unknown[];
  /** `{ key, value }` documents, including `schemaVersion` and `revision`. */
  settings: unknown[];
  content: unknown[];
}

/**
 * A readwrite transaction across every store, driven by callbacks.
 *
 * Callbacks run inside IndexedDB's success events, where the transaction is
 * still active, so a read can be followed by writes that depend on it — the
 * read-modify-write that keeps two tabs from overwriting each other. Nothing
 * here may `await`: a transaction left idle for a task commits underneath you.
 */
export interface TxHandle {
  get(store: StoreName, key: string, then: (value: unknown) => void): void;
  getAll(store: StoreName, then: (rows: unknown[]) => void): void;
  put(store: StoreName, value: object): void;
  delete(store: StoreName, key: string): void;
  clear(store: StoreName): void;
  /** Stop: nothing is written, and the transaction's result is this failure. */
  fail(failure: StoreFailure): void;
}

export interface Db {
  get<T>(store: StoreName, key: string): Promise<T | undefined>;
  getAll<T>(store: StoreName): Promise<T[]>;
  byIndex<T>(store: 'observations', index: ObservationIndex, value: string): Promise<T[]>;
  /** One store's rows, written together. Moves `revision`. */
  put(store: StoreName, records: readonly object[]): Promise<StoreResult>;
  remove(store: StoreName, keys: readonly string[]): Promise<StoreResult>;
  clear(stores: readonly StoreName[]): Promise<StoreResult>;
  /** Every store, in one readonly transaction. Rejects with a `StoreFailure`. */
  readAll(): Promise<Rows>;
  /** One readwrite transaction across every store. Never rejects. */
  transact(run: (tx: TxHandle) => void): Promise<StoreResult>;
  close(): void;
}

/** The error a failed request carried, from the event that reported it. */
function requestError(event: unknown): unknown {
  const target = (event as { target?: { error?: unknown } } | undefined)?.target;
  return target?.error ?? undefined;
}

function upgrade(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains('observations')) {
    const observations = db.createObjectStore('observations', { keyPath: 'id' });
    observations.createIndex('kind', 'kind');
    observations.createIndex('day', 'day');
  }
  if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'id' });
  // `settings` and `content-state` are keyed documents: `{ key, value }`.
  if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
  if (!db.objectStoreNames.contains('content-state')) db.createObjectStore('content-state', { keyPath: 'key' });
}

export interface OpenOptions {
  /**
   * Another copy holds an older version open. With this, the open keeps
   * waiting and finishes when that copy closes; without it, the open is given
   * up as `blocked` and a connection that turns up later is closed at once
   * rather than leaked.
   */
  onBlocked?: () => void;
  /**
   * Another copy wants to upgrade the database. The handler must close this
   * connection soon; without one, it is closed immediately so the upgrade is
   * never blocked by a tab nobody is looking at.
   */
  onVersionChange?: () => void;
}

/**
 * Open the database, creating the stores on first run.
 *
 * Rejects with a `StoreFailure` when there is no IndexedDB to open — the
 * caller shows a nothing-is-being-saved state rather than a blank screen.
 */
export function openDb(factory: IDBFactory | undefined = globalThis.indexedDB, options: OpenOptions = {}): Promise<Db> {
  if (!factory) {
    return Promise.reject(new StoreFailure('unavailable', 'This browser is not letting the app store data on the device.'));
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    let req: IDBOpenDBRequest;
    let abandoned = false;
    try {
      req = factory.open(DB_NAME, DB_VERSION);
    } catch (error) {
      reject(toFailure(error, 'unavailable'));
      return;
    }
    req.onupgradeneeded = () => upgrade(req.result);
    req.onsuccess = () => {
      if (abandoned) {
        req.result.close();
        return;
      }
      resolve(req.result);
    };
    req.onerror = () => reject(toFailure(req.error));
    req.onblocked = () => {
      if (options.onBlocked) {
        options.onBlocked();
        return;
      }
      abandoned = true;
      reject(new StoreFailure('blocked', 'Another copy of the app is open. Close its other tabs or windows and try again.'));
    };
  }).then(db => {
    db.onversionchange = () => {
      if (options.onVersionChange) options.onVersionChange();
      else db.close();
    };
    return wrap(db);
  });
}

function wrap(db: IDBDatabase): Db {
  function read<T>(store: StoreName, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      try {
        const req = run(db.transaction(store, 'readonly').objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = event => reject(toFailure(requestError(event) ?? req.error));
      } catch (error) {
        reject(toFailure(error));
      }
    });
  }

  function transact(run: (tx: TxHandle) => void): Promise<StoreResult> {
    return new Promise<StoreResult>(resolve => {
      let tx: IDBTransaction;
      try {
        // Strict: "complete" should mean on disk. This is the only copy of a
        // health record, and the writes come one tap at a time.
        tx = db.transaction(STORE_NAMES as unknown as string[], 'readwrite', { durability: 'strict' });
      } catch (error) {
        resolve({ ok: false, failure: toFailure(error) });
        return;
      }

      let explicit: StoreFailure | undefined;
      let lastRequestError: unknown;

      const stop = (error: unknown) => {
        explicit ??= toFailure(error);
        try { tx.abort(); } catch { /* already finished */ }
      };
      /** Callbacks run inside IndexedDB's events; anything they throw stops the transaction. */
      const guard = <A>(fn: (arg: A) => void) => (arg: A) => {
        try { fn(arg); } catch (error) { stop(error); }
      };

      // A failed request reports itself first and the transaction second, and
      // only the abort that follows sets `tx.error` — so in `onerror` it is
      // still null. Keep the request's own error for the abort to report.
      tx.onerror = event => { lastRequestError = requestError(event) ?? lastRequestError; };
      tx.oncomplete = () => resolve({ ok: true, value: undefined });
      tx.onabort = () => resolve({
        ok: false,
        failure: explicit ?? toFailure(tx.error ?? lastRequestError ?? new DOMException('Aborted', 'AbortError')),
      });

      const handle: TxHandle = {
        get: (store, key, then) => {
          const req = tx.objectStore(store).get(key);
          req.onsuccess = guard(() => then(req.result));
        },
        getAll: (store, then) => {
          const req = tx.objectStore(store).getAll();
          req.onsuccess = guard(() => then(req.result));
        },
        put: (store, value) => void tx.objectStore(store).put(value),
        delete: (store, key) => void tx.objectStore(store).delete(key),
        clear: store => void tx.objectStore(store).clear(),
        fail: failure => stop(failure),
      };

      // Some engines throw from `put` itself when the quota is already gone,
      // others fail the request a moment later, others abort at commit. All
      // three end in `onabort`.
      guard(run)(handle);
    });
  }

  /** The old single-store writes, kept for fixtures and tests. They move `revision` too. */
  function write(stores: readonly StoreName[], run: (tx: TxHandle) => void): Promise<StoreResult> {
    void stores;
    return transact(tx => {
      tx.get('settings', 'revision', row => {
        const revision = Number((row as Doc | undefined)?.value ?? 0);
        run(tx);
        tx.put('settings', doc('revision', (Number.isFinite(revision) ? revision : 0) + 1));
      });
    });
  }

  return {
    get: <T>(store: StoreName, key: string) => read<T | undefined>(store, s => s.get(key) as IDBRequest<T | undefined>),
    getAll: <T>(store: StoreName) => read<T[]>(store, s => s.getAll() as IDBRequest<T[]>),
    byIndex: <T>(store: 'observations', index: ObservationIndex, value: string) =>
      read<T[]>(store, s => s.index(index).getAll(value) as IDBRequest<T[]>),
    put: (store, records) => write([store], tx => {
      for (const record of records) tx.put(store, record);
    }),
    remove: (store, keys) => write([store], tx => {
      for (const key of keys) tx.delete(store, key);
    }),
    clear: stores => write(stores, tx => {
      for (const store of stores) tx.clear(store);
    }),
    readAll: () => new Promise<Rows>((resolve, reject) => {
      let tx: IDBTransaction;
      try {
        tx = db.transaction(STORE_NAMES as unknown as string[], 'readonly');
      } catch (error) {
        reject(toFailure(error, 'readFailed'));
        return;
      }
      // Every request is made before any result arrives: one transaction, one
      // moment, whatever another tab is doing.
      const rows: Partial<Rows> = {};
      const want: [StoreName, keyof Rows][] = [
        ['observations', 'observations'], ['sessions', 'sessions'], ['settings', 'settings'], ['content-state', 'content'],
      ];
      let lastRequestError: unknown;
      for (const [store, slot] of want) {
        const req = tx.objectStore(store).getAll();
        req.onsuccess = () => { rows[slot] = req.result; };
      }
      tx.onerror = event => { lastRequestError = requestError(event) ?? lastRequestError; };
      tx.oncomplete = () => resolve(rows as Rows);
      tx.onabort = () => reject(toFailure(tx.error ?? lastRequestError ?? new DOMException('Aborted', 'AbortError'), 'readFailed'));
    }),
    transact,
    close: () => db.close(),
  };
}

/**
 * The keyed documents in the `settings` store. Everything here is one small
 * object or one list that is read whole and written whole.
 *
 * ponytail: `checkIns` is a single row rewritten on each check-in — about
 * 11 MB after thirty years, which IndexedDB handles off the main thread.
 * Upgrade: a row per check-in, read by key prefix, if that ever shows up in a
 * profile.
 */
export const DOC_KEYS = [
  'schemaVersion',
  'settings',
  'profile',
  'checkIns',
  'personalRecords',
  'bodyMetrics',
  'focusOverrides',
  /** Moves on every write; how a second open copy learns it is out of date. */
  'revision',
] as const;

export type DocKey = (typeof DOC_KEYS)[number];

export interface Doc {
  key: DocKey;
  value: unknown;
}

export function doc(key: DocKey, value: unknown): Doc {
  return { key, value };
}

export async function readDoc<T>(db: Db, key: DocKey): Promise<T | undefined> {
  const row = await db.get<Doc>('settings', key);
  return row === undefined ? undefined : (row.value as T);
}

/**
 * Ask for storage that survives eviction (D16).
 *
 * Feature-detected and never throws: Safari grants this without a prompt for
 * an installed web app and refuses it in a tab, and either answer is something
 * the first-run screen needs to be able to state honestly.
 */
export async function requestPersistence(nav: Navigator | undefined = globalThis.navigator): Promise<boolean> {
  const storage = nav?.storage;
  if (!storage || typeof storage.persist !== 'function' || typeof storage.persisted !== 'function') return false;
  try {
    if (await storage.persisted()) return true;
    return await storage.persist();
  } catch {
    return false;
  }
}
