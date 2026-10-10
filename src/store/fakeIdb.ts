/**
 * An in-memory IndexedDB, for tests only.
 *
 * Vitest runs in a node environment with no IndexedDB, and the brief forbids a
 * new dependency, so `db.ts` takes its `IDBFactory` as an argument and the
 * tests hand it this. Nothing in the app imports it.
 *
 * It models the parts of the spec that the store's correctness rests on, and a
 * test that passes against a fake that skips them proves nothing:
 *
 * - **Connections and versions.** Several `open` calls share one database;
 *   closing one connection leaves the others usable; reopening works; a higher
 *   version fires `versionchange` at open connections and `blocked` at the
 *   request until they close.
 * - **Transaction scheduling** (IndexedDB 3.0 §2.7.2). A readwrite transaction
 *   waits for every earlier transaction with an overlapping scope; a readonly
 *   one waits for earlier readwrite ones. This is what makes a read-modify-write
 *   inside one transaction safe across two tabs.
 * - **Writes are visible inside their transaction** and undone on abort.
 * - **Inline keys are required.** A record with no key at its key path is a
 *   `DataError`, as natively.
 * - **The error event order.** A failed request fires `error` at the request
 *   and then at the transaction *before* the abort sets `tx.error`, so a
 *   handler that reads `tx.error` in `onerror` sees `null` — exactly the trap
 *   real engines set.
 *
 * Not modelled: transaction inactivity between tasks (the store never awaits
 * inside a transaction, by construction), key ranges, cursors, compound keys.
 */

export interface FakeOptions {
  /** How `open` should fail, if at all. `blocked` waits until `control.unblock()`. */
  openFails?: 'throw' | 'error' | 'blocked';
  /** Writes that would leave a store holding more than this many rows fail with QuotaExceededError. */
  quotaAfter?: number;
  /** Limit the quota to one store, so one write can fail while another works. */
  quotaStore?: string;
  /**
   * How a quota failure arrives: thrown from `put` itself (`sync`), as a failed
   * request that aborts the transaction (`abort`), or as an abort at commit
   * with no request error at all (`commit`). Engines do all three.
   */
  quota?: 'sync' | 'abort' | 'commit';
  /** Every write fails with this error, for testing how it is classified. */
  writeError?: () => unknown;
  /** Fail one particular write: return an error to fail it, undefined to let it through. */
  failWrite?: (store: string, value: Record<string, unknown>) => unknown;
  /** Fail one particular delete, the same way. */
  failDelete?: (store: string, key: string) => unknown;
  /**
   * Called as each transaction is created, before it is scheduled. A test uses
   * it to start another connection's transaction at exactly that moment: the
   * order in which two tabs' transactions reach the database is the order in
   * which they run.
   */
  onTransaction?: (scope: string[], mode: 'readonly' | 'readwrite') => void;
  /**
   * Model an engine that aborts after a failed request without setting
   * `tx.error`: only the request's own error says what went wrong.
   */
  abortWithoutError?: boolean;
}

export interface FakeControl {
  /** Hold readwrite transactions just before they commit, until `release()`. */
  hold(): void;
  release(): void;
  /** Change the quota mid-test: "free some space". */
  setQuota(rows: number | undefined): void;
  /** Let a request held by `openFails: 'blocked'` go through. */
  unblock(): void;
  /** Connections currently open, across every database. */
  openConnections(): number;
  /** Fail every write from now on, or stop failing them. */
  setWriteError(make: (() => unknown) | undefined): void;
}

type Row = Record<string, unknown>;
type Handler = ((event: { target: unknown }) => void) | null;

interface StoreData {
  keyPath: string;
  indexes: Map<string, string>;
  rows: Map<string, Row>;
}

interface Database {
  version: number;
  stores: Map<string, StoreData>;
  connections: Set<Connection>;
  /** Unfinished transactions, in creation order. */
  transactions: Tx[];
}

interface Connection {
  closed: boolean;
  database: Database;
  onversionchange: Handler;
}

interface Tx {
  scope: string[];
  mode: 'readonly' | 'readwrite';
  started: boolean;
  finished: boolean;
  start(): void;
}

function quotaError(): DOMException {
  // The message deliberately does not say "quota": real engines word it
  // differently and some localise it, so `db.ts` must go by the name.
  return new DOMException('The operation failed.', 'QuotaExceededError');
}

function validKey(key: unknown): key is string | number {
  return (typeof key === 'string') || (typeof key === 'number' && !Number.isNaN(key));
}

export function fakeIndexedDB(options: FakeOptions = {}): IDBFactory & { control: FakeControl } {
  const databases = new Map<string, Database>();
  let quotaAfter = options.quotaAfter;
  let writeError = options.writeError;
  let holding = false;
  let held: (() => void)[] = [];
  let unblocked = false;
  const blockedOpens: (() => void)[] = [];
  const waitingOpens = new Set<() => void>();

  const control: FakeControl = {
    hold: () => void (holding = true),
    release: () => {
      holding = false;
      const go = held;
      held = [];
      for (const run of go) run();
    },
    setQuota: rows => void (quotaAfter = rows),
    unblock: () => {
      unblocked = true;
      for (const go of blockedOpens.splice(0)) go();
    },
    openConnections: () => [...databases.values()].reduce((n, d) => n + d.connections.size, 0),
    setWriteError: make => void (writeError = make),
  };

  function overlaps(a: string[], b: string[]): boolean {
    return a.some(name => b.includes(name));
  }

  /** IndexedDB 3.0 §2.7.2: may this transaction start yet? */
  function canStart(database: Database, tx: Tx): boolean {
    for (const earlier of database.transactions) {
      if (earlier === tx) return true;
      if (earlier.finished || !overlaps(earlier.scope, tx.scope)) continue;
      if (tx.mode === 'readwrite' || earlier.mode === 'readwrite') return false;
    }
    return true;
  }

  function schedule(database: Database): void {
    for (const tx of database.transactions) {
      if (!tx.started && canStart(database, tx)) tx.start();
    }
  }

  function makeTransaction(connection: Connection, names: string | string[], mode: 'readonly' | 'readwrite') {
    const database = connection.database;
    const scope = typeof names === 'string' ? [names] : [...names];
    for (const name of scope) {
      if (!database.stores.has(name)) throw new DOMException(`No object store named ${name}.`, 'NotFoundError');
    }

    const queue: (() => void)[] = [];
    const undo: (() => void)[] = [];
    let running = false;
    let aborted = false;

    const tx = {
      error: null as unknown,
      oncomplete: null as Handler,
      onerror: null as Handler,
      onabort: null as Handler,
      objectStore(name: string) {
        if (!scope.includes(name)) throw new DOMException(`${name} is not in this transaction's scope.`, 'NotFoundError');
        return objectStore(name, database.stores.get(name)!);
      },
      abort() {
        if (state.finished) throw new DOMException('The transaction has finished.', 'InvalidStateError');
        abortWith(null);
      },
    };

    const state: Tx = {
      scope,
      mode,
      started: false,
      finished: false,
      start() {
        state.started = true;
        pump();
      },
    };
    database.transactions.push(state);
    options.onTransaction?.(scope, mode);

    function finish(): void {
      state.finished = true;
      database.transactions.splice(database.transactions.indexOf(state), 1);
      schedule(database);
    }

    function abortWith(error: unknown): void {
      if (state.finished || aborted) return;
      aborted = true;
      for (const revert of undo.reverse()) revert();
      queue.length = 0;
      tx.error = options.abortWithoutError ? null : error;
      finish();
      tx.onabort?.({ target: tx });
    }

    function commit(): void {
      if (state.finished || aborted) return;
      if (mode === 'readwrite' && options.quota === 'commit' && wouldExceedQuota()) {
        abortWith(quotaError());
        return;
      }
      finish();
      tx.oncomplete?.({ target: tx });
    }

    // A commit-time quota check needs the rows as they stand with this
    // transaction's writes applied, which is what the stores hold right now.
    function wouldExceedQuota(): boolean {
      if (quotaAfter === undefined) return false;
      return scope.some(name => {
        if (options.quotaStore !== undefined && options.quotaStore !== name) return false;
        return database.stores.get(name)!.rows.size > quotaAfter!;
      });
    }

    function pump(): void {
      if (!state.started || running || state.finished) return;
      running = true;
      queueMicrotask(function next() {
        if (state.finished) { running = false; return; }
        const job = queue.shift();
        if (job) {
          job();
          queueMicrotask(next);
          return;
        }
        running = false;
        // Nothing left: commit once the callbacks' own microtasks have had the
        // chance to queue more work, as auto-commit does at the end of a task.
        queueMicrotask(() => {
          if (queue.length > 0) { pump(); return; }
          if (state.finished) return;
          if (mode === 'readwrite' && holding) held.push(() => (queue.length > 0 ? pump() : commit()));
          else commit();
        });
      });
    }

    function request<T>(run: () => T) {
      if (state.finished) throw new DOMException('The transaction has finished.', 'TransactionInactiveError');
      const req = {
        result: undefined as T,
        error: null as unknown,
        onsuccess: null as Handler,
        onerror: null as Handler,
      };
      queue.push(() => {
        let value: T;
        try {
          value = run();
        } catch (error) {
          req.error = error;
          const event = { target: req };
          // Spec order: the request, then the transaction (bubbling), and only
          // then the abort that finally sets `tx.error`.
          req.onerror?.(event);
          tx.onerror?.(event);
          abortWith(error);
          return;
        }
        req.result = value;
        req.onsuccess?.({ target: req });
      });
      pump();
      return req;
    }

    function objectStore(name: string, data: StoreData) {
      const write = (run: () => void) => {
        if (mode !== 'readwrite') throw new DOMException('The transaction is read-only.', 'ReadOnlyError');
        return request(run);
      };
      return {
        get: (key: string) => request(() => {
          const row = data.rows.get(String(key));
          return row === undefined ? undefined : structuredClone(row);
        }),
        getAll: () => request(() => [...data.rows.values()].map(row => structuredClone(row))),
        put: (row: Row) => {
          if (mode !== 'readwrite') throw new DOMException('The transaction is read-only.', 'ReadOnlyError');
          const key = row?.[data.keyPath];
          if (!validKey(key)) {
            throw new DOMException(`Evaluating the key path "${data.keyPath}" did not yield a valid key.`, 'DataError');
          }
          const copy = structuredClone(row);
          const id = String(key);
          if (writeError !== undefined && options.quota === 'sync') throw writeError();
          if (options.quota === 'sync' && !data.rows.has(id) && overQuota(name, data, 1)) throw quotaError();
          return write(() => {
            if (writeError !== undefined) throw writeError();
            const refused = options.failWrite?.(name, copy);
            if (refused !== undefined) throw refused;
            if (options.quota !== 'commit' && !data.rows.has(id) && overQuota(name, data, 1)) throw quotaError();
            const before = data.rows.get(id);
            data.rows.set(id, copy);
            undo.push(() => (before === undefined ? data.rows.delete(id) : data.rows.set(id, before)));
          });
        },
        delete: (key: string) => write(() => {
          const id = String(key);
          const refused = options.failDelete?.(name, id);
          if (refused !== undefined) throw refused;
          const before = data.rows.get(id);
          if (before === undefined) return;
          data.rows.delete(id);
          undo.push(() => data.rows.set(id, before));
        }),
        clear: () => write(() => {
          const before = new Map(data.rows);
          data.rows.clear();
          undo.push(() => { for (const [k, v] of before) data.rows.set(k, v); });
        }),
        index: (index: string) => {
          const path = data.indexes.get(index);
          if (path === undefined) throw new DOMException(`No index ${index} on ${name}.`, 'NotFoundError');
          return {
            getAll: (value: unknown) => request(() =>
              [...data.rows.values()].filter(row => row[path] === value).map(row => structuredClone(row))),
          };
        },
      };
    }

    // An empty transaction still completes, once its creator has had the turn.
    queueMicrotask(() => schedule(database));
    return tx;
  }

  function overQuota(name: string, data: StoreData, adding: number): boolean {
    if (quotaAfter === undefined) return false;
    if (options.quotaStore !== undefined && options.quotaStore !== name) return false;
    return data.rows.size + adding > quotaAfter;
  }

  function connect(database: Database): { connection: Connection; handle: unknown } {
    const connection: Connection = { closed: false, database, onversionchange: null };
    database.connections.add(connection);
    const handle = {
      get objectStoreNames() {
        return { contains: (name: string) => database.stores.has(name) };
      },
      get onversionchange() { return connection.onversionchange; },
      set onversionchange(fn: Handler) { connection.onversionchange = fn; },
      createObjectStore(name: string, config: { keyPath: string }) {
        const data: StoreData = { keyPath: config.keyPath, indexes: new Map(), rows: new Map() };
        database.stores.set(name, data);
        return { createIndex: (index: string, path: string) => void data.indexes.set(index, path) };
      },
      transaction(names: string | string[], mode: 'readonly' | 'readwrite' = 'readonly') {
        if (connection.closed) throw new DOMException('The database connection is closing.', 'InvalidStateError');
        return makeTransaction(connection, names, mode);
      },
      close() {
        if (connection.closed) return;
        connection.closed = true;
        database.connections.delete(connection);
        for (const retry of [...waitingOpens]) retry();
      },
    };
    return { connection, handle };
  }

  const factory = {
    control,
    open(name: string, version?: number) {
      if (options.openFails === 'throw') throw new DOMException('Refused.', 'SecurityError');
      const req = {
        result: undefined as unknown,
        error: null as unknown,
        onsuccess: null as Handler,
        onerror: null as Handler,
        onupgradeneeded: null as Handler,
        onblocked: null as Handler,
      };

      queueMicrotask(() => {
        if (options.openFails === 'error') {
          req.error = new DOMException('Open failed.', 'UnknownError');
          req.onerror?.({ target: req });
          return;
        }

        let database = databases.get(name);
        if (!database) {
          database = { version: 0, stores: new Map(), connections: new Set(), transactions: [] };
          databases.set(name, database);
        }
        const target = version ?? Math.max(database.version, 1);
        if (target < database.version) {
          req.error = new DOMException(`Requested version ${target} is lower than ${database.version}.`, 'VersionError');
          req.onerror?.({ target: req });
          return;
        }

        const succeed = () => {
          const { handle } = connect(database);
          req.result = handle;
          if (target > database.version) {
            database.version = target;
            req.onupgradeneeded?.({ target: req });
          }
          req.onsuccess?.({ target: req });
        };

        const proceed = () => {
          if (target > database.version && database.connections.size > 0) {
            // Ask the others to close; any still open block this request.
            for (const other of [...database.connections]) other.onversionchange?.({ target: other });
            queueMicrotask(() => {
              if (database.connections.size === 0) { succeed(); return; }
              req.onblocked?.({ target: req });
              const retry = () => {
                if (database.connections.size > 0) return;
                waitingOpens.delete(retry);
                succeed();
              };
              waitingOpens.add(retry);
            });
            return;
          }
          succeed();
        };

        if (options.openFails === 'blocked' && !unblocked) {
          req.onblocked?.({ target: req });
          blockedOpens.push(proceed);
          return;
        }
        proceed();
      });
      return req;
    },
  };
  return factory as unknown as IDBFactory & { control: FakeControl };
}
