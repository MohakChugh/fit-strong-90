import { describe, expect, it } from 'vitest';
import { finishWalk, leaveWalk, pauseWalk, returnToWalk, startWalk, updateOpenSegment, type Segment, type Walk } from './clock';
import {
  clearWalk,
  draftStored,
  LAST_WALK_KEY,
  lastStartedId,
  loadWalk,
  markStarted,
  parseWalk,
  peekWalk,
  storeWalk,
  WALK_KEY,
  type WalkStorage,
} from './persist';

const T = Date.UTC(2026, 9, 8, 13, 0, 0);

function memory(): WalkStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: k => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: k => void map.delete(k),
  };
}

function aWalk(): Walk {
  let w = startWalk('mgh3k2x1-1a2b3c4d', { kind: 'afterMeal', meal: { which: 'dinner', startedAt: T - 600_000 }, targetMinutes: 10, gps: true, steps: true }, T);
  w = updateOpenSegment(w, s => ({ ...s, gps: [{ start: T + 10_000, end: T + 290_000, distanceM: 412.5 }], steps: 540, motion: true }));
  w = returnToWalk(leaveWalk(w, T + 300_000, 'hidden'), T + 420_000).walk;
  return w;
}

describe('walk storage', () => {
  it('round-trips a walk in progress', () => {
    const storage = memory();
    const w = aWalk();
    expect(storeWalk(storage, w)).toBe(true);
    expect(loadWalk(storage)).toEqual(w);
  });

  it('never stores a position', () => {
    const storage = memory();
    storeWalk(storage, aWalk());
    const raw = storage.map.get(WALK_KEY)!;
    expect(raw).not.toMatch(/lat|lon|coords|accuracy/i);
  });

  it('keeps a walk that ended for symptoms that need emergency help', () => {
    const storage = memory();
    const w = finishWalk(aWalk(), T + 600_000, 'emergency');
    storeWalk(storage, w);
    clearWalk(undefined);
    expect(parseWalk(JSON.parse(storage.map.get(WALK_KEY)!))?.endedBy).toBe('emergency');
  });

  it('round-trips every state a walk can be in', () => {
    const storage = memory();
    for (const w of [aWalk(), pauseWalk(aWalk(), T + 500_000), leaveWalk(aWalk(), T + 500_000, 'left'), finishWalk(aWalk(), T + 500_000, 'low')]) {
      storeWalk(storage, w);
      expect(loadWalk(storage)).toEqual(w);
    }
  });

  it('drops a walk it cannot trust rather than guessing', () => {
    const good = aWalk();
    const broken: unknown[] = [
      null,
      'walk',
      { ...good, version: 2 },
      { ...good, id: 'NOT VALID!' },
      { ...good, status: 'jogging' },
      { ...good, segments: [] },
      // Open, but the walk is not running.
      { ...good, status: 'paused' },
      // Closed, but the walk claims to be running.
      { ...good, segments: good.segments.map(s => ({ ...s, end: s.start + 1, endedBy: 'paused' })) },
      // Overlapping segments.
      { ...good, segments: [{ ...good.segments[0], end: T + 500_000 }, good.segments[1]] },
      { ...good, segments: [{ ...good.segments[0], steps: -1 }, good.segments[1]] },
      { ...good, segments: [{ ...good.segments[0], gps: [{ start: T, end: T + 1, distanceM: Number.NaN }] }, good.segments[1]] },
      { ...good, gaps: [{ start: T, end: T - 1, cause: 'hidden', added: false }] },
      { ...good, plan: { ...good.plan, kind: 'afterMeal', meal: { which: 'brunch', startedAt: T } } },
      { ...good, plan: { kind: 'walk', gps: 'yes', steps: true } },
      { ...good, pain: { back: { value: 11, at: T } } },
      // A GPS run may carry when and how far, never where.
      { ...good, segments: [{ ...good.segments[0], gps: [{ start: T, end: T + 1, distanceM: 1, lat: 12.97 }] }, good.segments[1]] },
      { ...good, segments: [{ ...good.segments[0], gps: [{ start: T + 5, end: T, distanceM: 1 }] }, good.segments[1]] },
      { ...good, segments: [{ ...good.segments[0], gps: undefined }, good.segments[1]] },
      { ...good, finishedAt: T },
      { ...finishWalk(good, T + 500_000, 'finish'), endedBy: 'bored' },
      { ...leaveWalk(good, T + 500_000, 'hidden'), awayCause: 'nap' },
    ];
    for (const b of broken) expect(parseWalk(b)).toBeNull();
    expect(parseWalk(good)).not.toBeNull();
  });

  it('survives storage that is missing, full or holding nonsense', () => {
    const full: WalkStorage = {
      getItem: () => '{not json',
      setItem: () => { throw new DOMException('full', 'QuotaExceededError'); },
      removeItem: () => { throw new Error('locked'); },
    };
    expect(loadWalk(full)).toBeNull();
    expect(storeWalk(full, aWalk())).toBe(false);
    expect(() => clearWalk(full)).not.toThrow();
    expect(() => markStarted(full, 'x')).not.toThrow();
  });

  it('keeps the walk for this page when the browser will not store it', () => {
    // Without this, a walk finished in a browser that refuses storage would
    // vanish between the live screen and its summary.
    const w = aWalk();
    expect(storeWalk(undefined, w)).toBe(false);
    expect(loadWalk(undefined)).toBe(w);
    clearWalk(undefined);
    expect(loadWalk(undefined)).toBeNull();

    const refusing: WalkStorage = {
      getItem: () => null,
      setItem: () => { throw new DOMException('full', 'QuotaExceededError'); },
      removeItem: () => {},
    };
    expect(storeWalk(refusing, w)).toBe(false);
    expect(loadWalk(refusing)).toBe(w);
    markStarted(refusing, 'mgh3k2x1-1a2b3c4d');
    expect(lastStartedId(refusing)).toBe('mgh3k2x1-1a2b3c4d');
    markStarted(undefined, 'abcd-0002');
    expect(lastStartedId(undefined)).toBe('abcd-0002');
  });

  it('prefers what this page kept over an older stored copy', () => {
    const storage = memory();
    const older = aWalk();
    storeWalk(storage, older);
    const newer = pauseWalk(older, T + 600_000);
    // The write fails, so only this page knows about the pause.
    storage.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
    storeWalk(storage, newer);
    expect(loadWalk(storage)).toBe(newer);
  });

  it('says whether a reload would bring back the walk this page holds (F08)', () => {
    const storage = memory();
    const w = aWalk();
    // Nothing held by the page: what is stored is what a reload finds.
    expect(draftStored(storage)).toBe(true);
    storeWalk(storage, w);
    expect(draftStored(storage)).toBe(true);
    // The finishing write is refused: this page has the finished walk, a
    // reload would find the walk still running. The summary must say so on
    // arrival, before anything there writes again.
    const write = storage.setItem;
    storage.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
    storeWalk(storage, finishWalk(w, T + 600_000, 'finish'));
    expect(draftStored(storage)).toBe(false);
    // The next write that goes through makes it safe again.
    storage.setItem = write;
    storeWalk(storage, loadWalk(storage)!);
    expect(draftStored(storage)).toBe(true);
    // No storage at all: only the page holds it.
    storeWalk(undefined, w);
    expect(draftStored(undefined)).toBe(false);
    clearWalk(undefined);
    expect(draftStored(undefined)).toBe(true);
  });

  it('clears', () => {
    const storage = memory();
    storeWalk(storage, aWalk());
    clearWalk(storage);
    expect(loadWalk(storage)).toBeNull();
  });

  it('remembers the last walk started, separately from the walk', () => {
    const storage = memory();
    expect(lastStartedId(storage)).toBeNull();
    markStarted(storage, 'mgh3k2x1-1a2b3c4d');
    expect(storage.map.get(LAST_WALK_KEY)).toBe('mgh3k2x1-1a2b3c4d');
    clearWalk(storage);
    expect(lastStartedId(storage)).toBe('mgh3k2x1-1a2b3c4d');
  });
});

describe('peekWalk', () => {
  it('points back to a walk in progress, or to one waiting to be saved', () => {
    const storage = memory();
    expect(peekWalk(storage)).toBeNull();
    storeWalk(storage, aWalk());
    expect(peekWalk(storage)).toMatchObject({ state: 'inProgress', href: '/walk/live', id: 'mgh3k2x1-1a2b3c4d' });
    storeWalk(storage, finishWalk(aWalk(), T + 500_000, 'finish'));
    expect(peekWalk(storage)).toMatchObject({ state: 'unsaved', href: '/walk/summary' });
  });
});

describe('walks kept before B-19', () => {
  const strip = (x: Segment) => {
    const { accruedMs, accruedAt, day, offsetMin, ...rest } = x;
    void accruedMs; void accruedAt; void day; void offsetMin;
    return rest;
  };

  it('are read with their accrued time, day and offset filled in', () => {
    // Seen a minute into its open segment.
    const w = { ...aWalk(), seenAt: T + 480_000 };
    const back = parseWalk(JSON.parse(JSON.stringify({ ...w, segments: w.segments.map(strip) })))!;
    expect(back.segments[0].accruedMs).toBe(300_000);
    expect(back.segments[0].accruedAt).toBe(T + 300_000);
    expect(back.segments[1].accruedMs).toBe(w.seenAt - w.segments[1].start);
    expect(back.segments[1].accruedAt).toBe(w.seenAt);
    expect(back.segments[0].day).toBe(w.segments[0].day);
    expect(back.segments[0].offsetMin).toBe(w.segments[0].offsetMin);
  });

  it('refuse an accrual, a day or an offset that cannot be read', () => {
    const w = aWalk();
    const withFirst = (patch: Record<string, unknown>) => parseWalk({ ...w, segments: [{ ...w.segments[0], ...patch }, w.segments[1]] });
    expect(withFirst({ accruedMs: -1 })).toBeNull();
    expect(withFirst({ accruedAt: 'soon' })).toBeNull();
    expect(withFirst({ day: '2026-13-01' })).toBeNull();
    expect(withFirst({ offsetMin: 15 * 60 })).toBeNull();
    expect(withFirst({ offsetMin: 330.5 })).toBeNull();
    expect(withFirst({ offsetMin: -14 * 60 })).not.toBeNull();
  });

  it('refuses a plan field this build does not know the shape of', () => {
    const w = aWalk();
    expect(parseWalk({ ...w, plan: { ...w.plan, from: '/elsewhere' } })).toBeNull();
    expect(parseWalk({ ...w, plan: { ...w.plan, meal: { ...w.plan.meal, basis: 'ate' } } })).toBeNull();
    expect(parseWalk({ ...w, plan: { ...w.plan, stepsDenied: false } })).toBeNull();
    expect(parseWalk({ ...w, plan: { ...w.plan, stepsDenied: true } })).not.toBeNull();
    expect(parseWalk({ ...w, plan: { ...w.plan, from: '/hub/walk', meal: { ...w.plan.meal, basis: 'had' } } })).not.toBeNull();
  });

  it('refuse a route consent that is not a yes or a no', () => {
    const w = aWalk();
    expect(parseWalk({ ...w, plan: { ...w.plan, keepRoute: true } })?.plan.keepRoute).toBe(true);
    expect(parseWalk({ ...w, plan: { ...w.plan, keepRoute: 'yes' } })).toBeNull();
  });

  it('keep a segment closed by a change to the clock, and the change itself (B-19)', () => {
    const w = aWalk();
    const changed = { ...w, clockChangedAt: T + 300_000, segments: [{ ...w.segments[0], endedBy: 'clockChange' as const }, w.segments[1]] };
    expect(parseWalk(JSON.parse(JSON.stringify(changed)))).toEqual(changed);
    expect(parseWalk({ ...changed, clockChangedAt: 'then' })).toBeNull();
  });
});
