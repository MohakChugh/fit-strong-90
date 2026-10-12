import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BUILD_KEY, CLOSE_OTHERS, UPDATED, UPDATE_READY, countWindows, dismissUpdated, resetUpdatesForTests, restartToUpdate,
  startUpdates, updateLine, updateState, type ContainerLike, type RegistrationLike, type WorkerLike,
} from './updates';

type FakeWorker = WorkerLike & { asked: string[]; state: string; changed: (() => void)[]; held: (() => void)[]; addEventListener(t: 'statechange', fn: () => void): void };

/**
 * A worker of this app: answers on the port it is sent, as public/sw.js
 * does, counting FitStrong's windows as it answers. `silent`: one from before
 * Plan 8, which never answers. `slow`: a restart answered only when the test
 * lets it (`held`).
 */
function worker(build: string, world: { windows: number }, { silent = false, slow = false } = {}): FakeWorker {
  const w: FakeWorker = {
    asked: [], state: 'installed', changed: [], held: [],
    postMessage(message, transfer) {
      const type = (message as { type: string }).type;
      w.asked.push(type);
      if (silent) return;
      // The page closes its end once answered, or once it stops waiting, which closes both.
      const answer = () => (transfer[0] as MessagePort).postMessage({ build, windows: world.windows, restarting: type === 'restart' && world.windows === 1 });
      if (slow && type === 'restart') w.held.push(answer);
      else answer();
    },
    addEventListener: (_t, fn) => void w.changed.push(fn),
  };
  return w;
}

function browser(own: WorkerLike | null) {
  const world = { windows: 1 };
  const changes: (() => void)[] = [];
  const found: (() => void)[] = [];
  const registration: { -readonly [K in keyof RegistrationLike]: RegistrationLike[K] } = {
    waiting: null, installing: null, addEventListener: (_t, fn) => void found.push(fn),
  };
  const container: { -readonly [K in keyof ContainerLike]: ContainerLike[K] } = {
    controller: own, register: async () => registration, addEventListener: (_t, fn) => void changes.push(fn),
  };
  /** A new release finishes installing while this page runs. */
  const install = (build: string, opts: { slow?: boolean } = {}) => {
    const next = worker(build, world, opts);
    registration.installing = next;
    for (const fn of found) fn();
    registration.installing = null;
    registration.waiting = next;
    for (const fn of next.changed) fn();
    return next;
  };
  /** The waiting worker takes over, as a real one does once it has skipped waiting. */
  const takeOver = () => {
    container.controller = registration.waiting;
    registration.waiting = null;
    for (const fn of changes) fn();
  };
  /** The very first release's worker takes over this page, which no worker controlled (P8S-11). */
  const claim = (w: WorkerLike) => {
    container.controller = w;
    for (const fn of changes) fn();
  };
  return { world, registration, container, install, takeOver, claim };
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0));
function storage() {
  const rows = new Map<string, string>();
  return { getItem: (k: string) => rows.get(k) ?? null, setItem: (k: string, v: string) => void rows.set(k, v), rows };
}

afterEach(() => {
  resetUpdatesForTests();
  vi.useRealTimers();
});

describe('a new release waits for this window, and nothing reloads by itself (J§21.2, D106)', () => {
  it('found while the page runs: waiting, with FitStrong’s windows counted, and no reload', async () => {
    const b = browser(worker('aaa', { windows: 1 }));
    const reload = vi.fn();
    await startUpdates({ container: b.container, swUrl: '/sw.js', reload });
    expect(updateState().waiting).toBe(false);
    b.install('bbb');
    await settle();
    expect(updateState()).toMatchObject({ waiting: true, windows: 1, restarting: false });
    // A takeover nobody asked for here (the worker never does one) still reloads nothing.
    b.takeOver();
    expect(reload).not.toHaveBeenCalled();
  });

  it('found waiting from an earlier open, too', async () => {
    const b = browser(worker('aaa', { windows: 1 }));
    b.registration.waiting = worker('bbb', b.world);
    await startUpdates({ container: b.container, swUrl: '/sw.js', reload: vi.fn() });
    await settle();
    expect(updateState().waiting).toBe(true);
  });

  it('a first visit, until its release’s first worker takes it over, has nothing waiting for it', async () => {
    const b = browser(null);
    b.registration.waiting = worker('bbb', b.world);
    await startUpdates({ container: b.container, swUrl: '/sw.js', reload: vi.fn() });
    expect(updateState().waiting).toBe(false);
  });

  it('taken over by its release’s first worker, a first visit reloads nothing, and a later release then waits for it (P8S-11)', async () => {
    const b = browser(null);
    const reload = vi.fn();
    await startUpdates({ container: b.container, swUrl: '/sw.js', reload });
    b.claim(worker('aaa', b.world));
    await settle();
    expect(reload).not.toHaveBeenCalled();
    b.install('bbb');
    await settle();
    expect(updateState()).toMatchObject({ waiting: true, windows: 1 });
  });
});

describe('Restart to update (D106, P8S-12, P8S-13)', () => {
  it('as FitStrong’s only window: the cover first and new work held, then the worker asked once the queued work is done; one reload, at the takeover', async () => {
    const b = browser(worker('aaa', { windows: 1 }));
    const reload = vi.fn();
    const order: string[] = [];
    const resume = vi.fn();
    let done!: () => void;
    await startUpdates({
      container: b.container, swUrl: '/sw.js', reload,
      hold: () => { order.push('hold'); return resume; },
      settled: () => new Promise<void>(resolve => { order.push('settled'); done = resolve; }),
    });
    const next = b.install('bbb');
    const how = restartToUpdate();
    await settle();
    expect(updateState().restarting).toBe(true);
    expect(order).toEqual(['hold', 'settled']);
    expect(next.asked).not.toContain('restart');
    done();
    expect(await how).toBe('restarting');
    expect(next.asked).toContain('restart');
    expect(resume).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    b.takeOver();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('a slow answer saying another window opened meanwhile: the cover goes, work is let in again, and nothing reloads', async () => {
    const b = browser(worker('aaa', { windows: 1 }));
    const reload = vi.fn();
    const resume = vi.fn();
    await startUpdates({ container: b.container, swUrl: '/sw.js', reload, hold: () => resume });
    const next = b.install('bbb', { slow: true });
    const how = restartToUpdate();
    await settle();
    expect(updateState().restarting).toBe(true);
    b.world.windows = 2;
    for (const answer of next.held) answer();
    expect(await how).toBe('others');
    expect(updateState()).toMatchObject({ restarting: false, windows: 2 });
    expect(resume).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });

  it('with something under way when it is tapped: nothing is put up, held or asked (P8S-12)', async () => {
    const b = browser(worker('aaa', { windows: 1 }));
    const hold = vi.fn(() => () => undefined);
    let busy = true;
    await startUpdates({ container: b.container, swUrl: '/sw.js', reload: vi.fn(), hold, underWay: () => busy });
    const next = b.install('bbb');
    expect(await restartToUpdate()).toBe('busy');
    expect(updateState().restarting).toBe(false);
    expect(hold).not.toHaveBeenCalled();
    expect(next.asked).not.toContain('restart');
    busy = false;
    expect(await restartToUpdate()).toBe('restarting');
  });

  it('with another window open: nothing changes but the count, and nothing reloads', async () => {
    const b = browser(worker('aaa', { windows: 1 }));
    const reload = vi.fn();
    await startUpdates({ container: b.container, swUrl: '/sw.js', reload });
    b.install('bbb');
    b.world.windows = 2;
    expect(await restartToUpdate()).toBe('others');
    expect(updateState()).toMatchObject({ windows: 2, restarting: false });
    b.world.windows = 1;
    await countWindows();
    expect(updateState().windows).toBe(1);
    expect(reload).not.toHaveBeenCalled();
  });

  it('a takeover that never comes: the restart the person asked for reloads all the same, once', async () => {
    const b = browser(worker('aaa', { windows: 1 }));
    const reload = vi.fn();
    await startUpdates({ container: b.container, swUrl: '/sw.js', reload });
    b.install('bbb');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    expect(await restartToUpdate()).toBe('restarting');
    await vi.advanceTimersByTimeAsync(9_000);
    expect(reload).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('"Updated" once the release changed, until dismissed (K8-03)', () => {
  it('compares this page’s release with the last open’s, and keeps the line until it is dismissed, however long', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const kept = storage();
    const marks: string[] = [];
    await startUpdates({ container: browser(worker('aaa', { windows: 1 })).container, swUrl: '/sw.js', reload: vi.fn(), storage: kept, mark: b => void marks.push(b) });
    expect(updateState().updated).toBe(false);
    expect(kept.rows.get(BUILD_KEY)).toBe('aaa');
    resetUpdatesForTests();
    await startUpdates({ container: browser(worker('bbb', { windows: 1 })).container, swUrl: '/sw.js', reload: vi.fn(), storage: kept, mark: b => void marks.push(b) });
    expect(updateState().updated).toBe(true);
    expect(marks).toEqual(['aaa', 'bbb']);
    vi.setSystemTime(Date.now() + 24 * 60 * 60 * 1000);
    expect(updateState().updated).toBe(true);
    dismissUpdated();
    expect(updateState().updated).toBe(false);
  });

  it('says nothing when the worker in charge is one from before Plan 8, which never answers', async () => {
    const kept = storage();
    await startUpdates({ container: browser(worker('old', { windows: 1 }, { silent: true })).container, swUrl: '/sw.js', reload: vi.fn(), storage: kept, answerMs: 20 });
    expect(updateState().updated).toBe(false);
    expect(kept.rows.size).toBe(0);
  });
});

describe('Home’s line, in words (D106)', () => {
  const s = (over: object) => ({ waiting: false, restarting: false, updated: false, ...over });

  it('offers the restart only with nothing under way and no other window open', () => {
    expect(updateLine(s({ waiting: true, windows: 1 }), false)).toEqual({ text: UPDATE_READY, action: 'restart' });
    expect(updateLine(s({ waiting: true, windows: 1 }), true)).toEqual({ text: UPDATE_READY });
    expect(updateLine(s({ waiting: true }), false)).toEqual({ text: UPDATE_READY });
    expect(updateLine(s({ waiting: true, windows: 2 }), false)).toEqual({ text: UPDATE_READY, detail: CLOSE_OTHERS });
  });

  it('says Updated, to dismiss, when nothing newer waits; and nothing otherwise', () => {
    expect(updateLine(s({ updated: true }), true)).toEqual({ text: UPDATED, action: 'dismiss' });
    expect(updateLine(s({ updated: true, waiting: true, windows: 1 }), false)).toEqual({ text: UPDATE_READY, action: 'restart' });
    expect(updateLine(s({}), false)).toBeUndefined();
  });
});
