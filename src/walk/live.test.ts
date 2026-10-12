import { afterEach, describe, expect, it } from 'vitest';
import type { AppData } from '@/types';
import type { CheckInRecord, DailyCheckIn, Readiness } from '@/types/checkin';
import { createDefaultProfile } from '@/profile/defaults';
import { toDateString } from '@/lib/utils';
import type { UserProfile } from '@/types/profile';
import { reportSymptoms, resetPendingCheckInsForTests, saveCheckInRecord, type StoreUpdate, type SymptomReport } from '@/components/checkin/pending';
import { STALE_AFTER_MS, type WalkPlan } from './clock';
import { deviceClinical, deviceGate, walkInput, walkRefusal, watchClinical } from './gate';
import { feelLow, lowReading } from './low';
import { legReport, stopReport, type LegAnswers } from './stop';
import { createStepDetector } from './steps';
import type { Fix } from './gps';
import { createLiveWalk, MOTION_WAIT_MS, NOTICE_MIN_GAP_MS, type GeoError, type LivePorts, type WalkIntent } from './live';
import { clearWalk, loadWalk, type WalkStorage } from './persist';
import { walkObservations } from './record';

const T0 = Date.UTC(2026, 9, 8, 13, 0, 0);
const R = 6_371_008.8;
const HOME = { lat: 12.9716, lon: 77.5946 };
const G = 9.80665;

function offset(from: { lat: number; lon: number }, north: number) {
  return { lat: from.lat + (north / R) * (180 / Math.PI), lon: from.lon };
}

/** A fake world: a clock, timers, storage, visibility and sensors you can drive. */
function world(options: {
  geolocation?: boolean;
  motion?: boolean | 'ios';
  wakeLock?: boolean | 'refuse';
  storage?: WalkStorage;
  /** A real gate in place of the switchable one, given this world's clock. */
  gate?: (now: () => Date) => (intent: WalkIntent) => boolean;
  watchClinical?: (onChange: () => void) => () => void;
} = {}) {
  /** What the safety engine would answer, question by question. Tests flip it between arrivals. */
  const yes: Record<WalkIntent, boolean> = { start: true, restart: true, live: true };
  let allow = { ...yes };
  const asked: WalkIntent[] = [];
  let now = T0;
  let timers: { at: number; fn: () => void; id: number }[] = [];
  let nextId = 0;
  const map = new Map<string, string>();
  const storage: WalkStorage = options.storage ?? {
    getItem: k => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: k => void map.delete(k),
  };

  let visible = true;
  const visibilityListeners = new Set<(v: boolean) => void>();

  const geoWatchers = new Set<{ onFix: (f: Fix) => void; onError: (e: GeoError) => void }>();
  let geoStarts = 0;

  const motionListeners = new Set<(t: number, x: number, y: number, z: number) => void>();
  let motionAnswer: 'granted' | 'denied' = 'granted';
  /** iOS after a relaunch: listening works, but nothing arrives until a tap grants it again. */
  let motionGranted = options.motion !== 'ios';
  let motionRequests = 0;

  let wakeHeld = false;
  let wakeRequests = 0;
  let onWakeLost: (() => void) | undefined;

  const realGate = options.gate?.(() => new Date(now));
  const ports: LivePorts = {
    mayRun(intent) {
      asked.push(intent);
      return realGate ? realGate(intent) : allow[intent];
    },
    ...(options.watchClinical ? { watchClinical: options.watchClinical } : {}),
    now: () => now,
    later(fn, ms) {
      const id = nextId++;
      timers.push({ at: now + ms, fn, id });
      return () => {
        timers = timers.filter(t => t.id !== id);
      };
    },
    storage,
    visibility: {
      visible: () => visible,
      subscribe(fn) {
        visibilityListeners.add(fn);
        return () => void visibilityListeners.delete(fn);
      },
    },
    ...(options.geolocation === false ? {} : {
      geolocation: {
        watch(onFix, onError) {
          geoStarts += 1;
          const w = { onFix, onError };
          geoWatchers.add(w);
          return () => void geoWatchers.delete(w);
        },
      },
    }),
    ...(options.motion === false ? {} : {
      motion: {
        needsPermission: options.motion === 'ios',
        async request() {
          motionRequests += 1;
          if (motionAnswer === 'granted') motionGranted = true;
          return motionAnswer;
        },
        listen(fn) {
          motionListeners.add(fn);
          return () => void motionListeners.delete(fn);
        },
      },
    }),
    ...(options.wakeLock === false ? {} : {
      wakeLock: {
        async request(onLost) {
          wakeRequests += 1;
          if (options.wakeLock === 'refuse') return false;
          wakeHeld = true;
          onWakeLost = onLost;
          return true;
        },
        release() {
          wakeHeld = false;
        },
      },
    }),
  };

  /** Move the clock on, running any timers that fall due, in order. */
  function advance(ms: number) {
    const end = now + ms;
    for (;;) {
      const due = timers.filter(t => t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      timers = timers.filter(t => t !== due);
      now = Math.max(now, due.at);
      due.fn();
    }
    now = end;
  }

  return {
    ports,
    storage,
    advance,
    /** Refuse movement, as an emergency check-in would; or refuse one question only. */
    refuse(intent?: WalkIntent) {
      allow = intent ? { ...allow, [intent]: false } : { start: false, restart: false, live: false };
    },
    permit() {
      allow = { ...yes };
    },
    get asked() { return asked; },
    get now() { return now; },
    set now(t: number) { now = t; },
    /** The page dies: every timer and listener with it, storage survives. */
    kill() {
      timers = [];
      visibilityListeners.clear();
      geoWatchers.clear();
      motionListeners.clear();
    },
    /** iOS may deliver the wake lock's release only once the page is visible again: `deferWake` keeps it back. */
    hide({ deferWake = false } = {}) {
      visible = false;
      if (wakeHeld) {
        wakeHeld = false;
        if (!deferWake) onWakeLost?.();
      }
      for (const fn of [...visibilityListeners]) fn(false);
    },
    /** The release callback of the lock held now, to deliver late. */
    get wakeLostCallback() { return onWakeLost; },
    show() {
      visible = true;
      for (const fn of [...visibilityListeners]) fn(true);
    },
    fix(north: number, accuracy = 5, timestamp = now) {
      const fix = { ...offset(HOME, north), accuracy, timestamp };
      for (const w of [...geoWatchers]) w.onFix(fix);
    },
    geoError(e: GeoError) {
      for (const w of [...geoWatchers]) w.onError(e);
    },
    get watching() { return geoWatchers.size; },
    get geoStarts() { return geoStarts; },
    /** One motion sample. Undelivered while iOS has not granted access. */
    sample(t: number, y: number) {
      if (!motionGranted) return;
      for (const fn of [...motionListeners]) fn(t, 0, y, 0);
    },
    get listeningForMotion() { return motionListeners.size; },
    set motionAnswer(a: 'granted' | 'denied') { motionAnswer = a; },
    get motionRequests() { return motionRequests; },
    get wakeHeld() { return wakeHeld; },
    get wakeRequests() { return wakeRequests; },
    loseWake() {
      wakeHeld = false;
      onWakeLost?.();
    },
  };
}

const PLAN: WalkPlan = { kind: 'walk', gps: true, steps: true };
const START = { id: 'mgh3k2x1-1a2b3c4d', plan: PLAN };

/** Walk north at 1.3 m/s for `seconds`, one fix a second, from `fromNorth` metres. */
function walkFor(w: ReturnType<typeof world>, seconds: number, fromNorth: number) {
  for (let i = 0; i < seconds; i++) {
    w.fix(fromNorth + 1.3 * i);
    w.advance(1000);
  }
  return fromNorth + 1.3 * seconds;
}

/** A 2 Hz walking bounce, sampled at 60 Hz, for `seconds`. */
function bounce(w: ReturnType<typeof world>, seconds: number) {
  const start = w.now;
  for (let i = 0; i < seconds * 60; i++) {
    const t = i / 60;
    w.sample(start + t * 1000, G + 2.5 * Math.sin(2 * Math.PI * 2 * t));
    if (i % 60 === 59) w.advance(1000);
  }
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('starting and the clock', () => {
  it('starts a new walk once, and publishes about once a second', async () => {
    const w = world();
    const live = createLiveWalk(w.ports);
    let renders = 0;
    live.subscribe(() => { renders += 1; });
    expect(live.getSnapshot()).toBeNull();
    expect(live.attach(START)).toBe('created');
    await flush();
    const first = renders;
    w.advance(10_000);
    // Ten ticks in ten seconds, never one per sensor event.
    expect(renders - first).toBe(10);
    expect(live.getSnapshot()!.observedMs).toBe(10_000);
    expect(loadWalk(w.storage)?.status).toBe('running');
  });

  it('lands each tick on the observed second, so the clock never skips one', () => {
    const w = world();
    const live = createLiveWalk(w.ports);
    live.attach(START);
    const seconds: number[] = [];
    live.subscribe(() => seconds.push(Math.floor(live.getSnapshot()!.observedMs / 1000)));
    w.advance(30_000);
    expect(seconds).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });

  it('does not count a pause, and stops the sensors during it', () => {
    const w = world();
    const live = createLiveWalk(w.ports);
    live.attach(START);
    w.advance(60_000);
    live.pause();
    expect(w.watching).toBe(0);
    expect(w.listeningForMotion).toBe(0);
    expect(live.getSnapshot()!.gps.state).toBe('paused');
    w.advance(120_000);
    live.resume();
    expect(w.watching).toBe(1);
    w.advance(30_000);
    expect(live.getSnapshot()!.observedMs).toBe(90_000);
  });

  it('will not start the same walk twice, from history after it was saved', () => {
    const w = world();
    const first = createLiveWalk(w.ports);
    first.attach(START);
    first.finish('finish');
    first.detach();
    // Saved: the summary clears the walk.
    clearWalk(w.storage);
    expect(createLiveWalk(w.ports).attach(START)).toBe('none');
    expect(createLiveWalk(w.ports).attach()).toBe('none');
  });

  it('resumes the walk in progress rather than starting another', () => {
    const w = world();
    const a = createLiveWalk(w.ports);
    a.attach(START);
    w.advance(5_000);
    a.detach();
    const b = createLiveWalk(w.ports);
    expect(b.attach({ id: 'zzzz-9999', plan: PLAN })).toBe('resumed');
    expect(b.getSnapshot()!.walk.id).toBe(START.id);
  });
});

describe('hidden mid-walk', () => {
  it('stamps the gap, never counts distance across it, and starts a new segment on return', () => {
    const w = world();
    const live = createLiveWalk(w.ports);
    live.attach(START);
    let north = walkFor(w, 120, 0);
    const before = live.getSnapshot()!.distanceM;
    expect(before).toBeGreaterThan(156 * 0.93);
    expect(before).toBeLessThan(156 * 1.05);

    w.hide();
    expect(w.watching).toBe(0);
    expect(live.getSnapshot()!.walk.status).toBe('away');
    // Five minutes away. The person walked 400 m the app never saw.
    w.advance(300_000);
    north += 400;
    w.show();

    const back = live.getSnapshot()!;
    expect(back.walk.status).toBe('running');
    expect(back.walk.segments).toHaveLength(2);
    expect(back.walk.gaps).toEqual([{ start: T0 + 120_000, end: T0 + 420_000, cause: 'hidden', added: false }]);
    expect(back.notice).toMatchObject({ kind: 'away', gapIndex: 0 });
    expect(back.gps.state).toBe('acquiring');

    walkFor(w, 120, north);
    const after = live.getSnapshot()!;
    // Two walks of about 156 m each; the 400 m gap is not in it.
    expect(after.distanceM).toBeGreaterThan(312 * 0.93);
    expect(after.distanceM).toBeLessThan(312 * 1.05);
    expect(after.observedMs).toBe(240_000);
  });

  it('refuses a position cached from before the gap', () => {
    const w = world();
    const live = createLiveWalk(w.ports);
    live.attach(START);
    walkFor(w, 60, 0);
    w.hide();
    w.advance(60_000);
    w.show();
    // A fix taken a few seconds before the return, while the app was away,
    // delivered late: fresh enough by age, but from the gap.
    w.fix(500, 5, w.now - 5_000);
    expect(live.getSnapshot()!.walk.segments[1].gps).toEqual([]);
    w.fix(500);
    w.advance(1000);
    // One fix starts a run but spans no time, so it has measured nothing yet.
    expect(live.getSnapshot()!.walk.segments[1].gps).toHaveLength(1);
    expect(live.getSnapshot()!.walk.segments[1].gps[0].distanceM).toBe(0);
  });

  it('records a glance away without announcing it', () => {
    const w = world();
    const live = createLiveWalk(w.ports);
    live.attach(START);
    w.advance(60_000);
    w.hide();
    w.advance(NOTICE_MIN_GAP_MS - 1000);
    w.show();
    const snap = live.getSnapshot()!;
    expect(snap.notice).toBeNull();
    expect(snap.walk.gaps).toHaveLength(1);
    w.advance(1000);
    expect(live.getSnapshot()!.observedMs).toBe(61_000);
  });

  it('adds the missing time only when asked, as time the person entered', () => {
    const w = world();
    const live = createLiveWalk(w.ports);
    live.attach(START);
    w.advance(300_000);
    w.hide();
    w.advance(240_000);
    w.show();
    live.addAwayTime();
    const snap = live.getSnapshot()!;
    expect(snap.notice).toMatchObject({ kind: 'added' });
    expect(snap.walk.gaps[0].added).toBe(true);
    // Observed time is unchanged: the added time is a correction.
    expect(snap.observedMs).toBe(300_000);
    live.finish('finish');
    const manual = walkObservations(live.getSnapshot()!.walk).filter(o => o.source === 'manual' && o.kind === 'walkDuration');
    expect(manual.map(m => m.value)).toEqual([4]);
  });

  it('dismisses the notice when the person carries on', () => {
    const w = world();
    const live = createLiveWalk(w.ports);
    live.attach(START);
    w.advance(60_000);
    w.hide();
    w.advance(60_000);
    w.show();
    live.dismissNotice();
    expect(live.getSnapshot()!.notice).toBeNull();
    expect(live.getSnapshot()!.walk.gaps[0].added).toBe(false);
  });

  it('finishes with what was recorded when the app was away for hours', () => {
    const w = world();
    const live = createLiveWalk(w.ports);
    live.attach(START);
    w.advance(600_000);
    w.hide();
    w.advance(STALE_AFTER_MS + 60_000);
    w.show();
    const snap = live.getSnapshot()!;
    expect(snap.walk.status).toBe('finished');
    expect(snap.walk.endedBy).toBe('stale');
    expect(snap.observedMs).toBe(600_000);
    expect(w.watching).toBe(0);
  });
});

describe('a reload', () => {
  it('survives in sessionStorage and resumes with the time it was away stamped as a gap', () => {
    const storage = (() => {
      const map = new Map<string, string>();
      return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k) };
    })();
    const w = world({ storage });
    const before = createLiveWalk(w.ports);
    before.attach(START);
    walkFor(w, 90, 0);
    // The tab reloads: no hide, no detach, just gone. The last heartbeat stands.
    const seen = loadWalk(storage)!.seenAt;
    expect(seen).toBe(w.now);
    w.kill();
    w.advance(20_000);

    const after = createLiveWalk(w.ports);
    expect(after.attach(START)).toBe('resumed');
    const snap = after.getSnapshot()!;
    expect(snap.walk.status).toBe('running');
    expect(snap.walk.gaps).toEqual([{ start: seen, end: seen + 20_000, cause: 'interrupted', added: false }]);
    expect(snap.notice).toMatchObject({ kind: 'away' });
    expect(snap.observedMs).toBe(90_000);
    expect(snap.distanceM).toBeGreaterThan(100);
  });

  it('offers a walk left for hours as finished, not resumed', () => {
    const w = world();
    const before = createLiveWalk(w.ports);
    before.attach(START);
    w.advance(900_000);
    // The tab dies with the walk running, and nobody opens it for hours.
    w.kill();
    w.advance(STALE_AFTER_MS + 1000);
    const after = createLiveWalk(w.ports);
    after.attach();
    const snap = after.getSnapshot()!;
    expect(snap.walk.status).toBe('finished');
    expect(snap.walk.endedBy).toBe('stale');
    expect(snap.observedMs).toBe(900_000);
  });

  it('carries straight on through an immediate remount', () => {
    const w = world();
    const live = createLiveWalk(w.ports);
    live.attach(START);
    w.advance(30_000);
    live.detach();
    live.attach(START);
    const snap = live.getSnapshot()!;
    expect(snap.walk.segments).toHaveLength(1);
    expect(snap.walk.gaps).toEqual([]);
    expect(snap.notice).toBeNull();
    expect(w.watching).toBe(1);
  });

  it('stops recording when the walk screen is closed, and says so when it reopens', () => {
    const w = world();
    const live = createLiveWalk(w.ports);
    live.attach(START);
    w.advance(30_000);
    live.detach();
    expect(w.watching).toBe(0);
    expect(loadWalk(w.storage)!.status).toBe('away');
    w.advance(120_000);
    live.attach();
    const snap = live.getSnapshot()!;
    expect(snap.walk.gaps[0]).toMatchObject({ cause: 'left', start: T0 + 30_000, end: T0 + 150_000 });
    expect(snap.notice?.kind).toBe('away');
    expect(snap.observedMs).toBe(30_000);
  });
});

describe('GPS', () => {
  it('leaves a fully working timed walk when location is refused', () => {
    const w = world();
    const live = createLiveWalk(w.ports);
    live.attach(START);
    w.advance(10_000);
    w.geoError('denied');
    expect(w.watching).toBe(0);
    expect(live.getSnapshot()!.gps.state).toBe('denied');
    w.advance(50_000);
    expect(live.getSnapshot()!.observedMs).toBe(60_000);
    expect(live.getSnapshot()!.walk.status).toBe('running');
    // A later pause and resume does not ask again.
    live.pause();
    live.resume();
    expect(w.watching).toBe(0);
    expect(live.getSnapshot()!.gps.state).toBe('denied');
  });

  it('keeps going through a weak signal', () => {
    const w = world();
    const live = createLiveWalk(w.ports);
    live.attach(START);
    w.geoError('unavailable');
    expect(w.watching).toBe(1);
    expect(live.getSnapshot()!.gps.state).toBe('acquiring');
  });

  it('is off when not chosen, and says so when the browser has none', () => {
    const off = world();
    const a = createLiveWalk(off.ports);
    a.attach({ id: 'abcd-0001', plan: { ...PLAN, gps: false } });
    expect(off.watching).toBe(0);
    expect(a.getSnapshot()!.gps.state).toBe('off');

    const none = world({ geolocation: false });
    const b = createLiveWalk(none.ports);
    b.attach(START);
    expect(b.getSnapshot()!.gps.state).toBe('unsupported');
  });

  it('shows a pace once there is enough walking', () => {
    const w = world();
    const live = createLiveWalk(w.ports);
    live.attach(START);
    walkFor(w, 10, 0);
    expect(live.getSnapshot()!.gps.state).toBe('measuring');
    walkFor(w, 60, 13);
    const gps = live.getSnapshot()!.gps;
    expect(gps.state).toBe('ok');
    expect(gps.secPerKm!).toBeGreaterThan((1000 / 1.3) * 0.9);
    expect(gps.secPerKm!).toBeLessThan((1000 / 1.3) * 1.1);
  });
});

describe('steps', () => {
  it('counts steps while walking, into the open segment', () => {
    const w = world();
    const live = createLiveWalk(w.ports);
    live.attach(START);
    bounce(w, 20);
    const snap = live.getSnapshot()!;
    expect(snap.stepsState).toBe('counting');
    expect(snap.steps).toBeGreaterThanOrEqual(37);
    expect(snap.steps).toBeLessThanOrEqual(41);
    expect(snap.walk.segments[0].motion).toBe(true);
  });

  it('asks for a tap when iOS has forgotten the motion grant, and counts once given', async () => {
    const w = world({ motion: 'ios' });
    const live = createLiveWalk(w.ports);
    live.attach(START);
    expect(live.getSnapshot()!.stepsState).toBe('waiting');
    bounce(w, 4);
    expect(live.getSnapshot()!.stepsState).toBe('needsPermission');
    expect(live.getSnapshot()!.steps).toBe(0);

    await live.enableMotion();
    expect(w.motionRequests).toBe(1);
    bounce(w, 20);
    expect(live.getSnapshot()!.stepsState).toBe('counting');
    expect(live.getSnapshot()!.steps).toBeGreaterThan(30);
  });

  it('says so when motion is refused, and the walk carries on', async () => {
    const w = world({ motion: 'ios' });
    const live = createLiveWalk(w.ports);
    live.attach(START);
    w.advance(MOTION_WAIT_MS + 1000);
    w.motionAnswer = 'denied';
    await live.enableMotion();
    expect(live.getSnapshot()!.stepsState).toBe('denied');
    w.advance(5_000);
    expect(live.getSnapshot()!.walk.status).toBe('running');
  });

  it('says there is no sensor when nothing arrives and no permission could help', () => {
    const w = world({ motion: true });
    const live = createLiveWalk(w.ports);
    live.attach(START);
    w.advance(MOTION_WAIT_MS + 1000);
    expect(live.getSnapshot()!.stepsState).toBe('noSensor');

    const none = world({ motion: false });
    const b = createLiveWalk(none.ports);
    b.attach(START);
    expect(b.getSnapshot()!.stepsState).toBe('unsupported');
  });

  it('counts nothing while hidden, and starts the rhythm afresh after', () => {
    const w = world();
    const live = createLiveWalk(w.ports);
    live.attach(START);
    bounce(w, 10);
    const before = live.getSnapshot()!.steps;
    w.hide();
    bounce(w, 10);
    expect(live.getSnapshot()!.steps).toBe(before);
    w.show();
    bounce(w, 10);
    const after = live.getSnapshot()!;
    expect(after.walk.segments[1].steps).toBeGreaterThanOrEqual(17);
    expect(after.steps).toBe(before + after.walk.segments[1].steps);
  });
});

describe('screen wake lock', () => {
  it('is held while walking, re-requested on return, and released at the end', async () => {
    const w = world();
    const live = createLiveWalk(w.ports);
    live.attach(START);
    await flush();
    expect(w.wakeHeld).toBe(true);
    expect(live.getSnapshot()!.wake).toBe('held');
    w.hide();
    expect(live.getSnapshot()!.wake).toBe('pending');
    w.show();
    await flush();
    expect(w.wakeRequests).toBe(2);
    expect(live.getSnapshot()!.wake).toBe('held');
    live.finish('finish');
    expect(w.wakeHeld).toBe(false);
  });

  it('asks again on return even when the release arrives late, and ignores the late release', async () => {
    const w = world();
    const live = createLiveWalk(w.ports);
    live.attach(START);
    await flush();
    const late = w.wakeLostCallback!;
    w.hide({ deferWake: true });
    w.show();
    await flush();
    expect(w.wakeRequests).toBe(2);
    expect(w.wakeHeld).toBe(true);
    // The old lock's release, delivered after the return, is about a lock already replaced.
    late();
    expect(live.getSnapshot()!.wake).toBe('held');
  });

  it('says it is unavailable when the browser has none or refuses', async () => {
    const none = world({ wakeLock: false });
    const a = createLiveWalk(none.ports);
    a.attach(START);
    expect(a.getSnapshot()!.wake).toBe('unavailable');

    const refused = world({ wakeLock: 'refuse' });
    const b = createLiveWalk(refused.ports);
    b.attach(START);
    await flush();
    expect(b.getSnapshot()!.wake).toBe('unavailable');
  });

  it('says so when the system takes the lock back while the walk is on screen', async () => {
    const w = world();
    const live = createLiveWalk(w.ports);
    live.attach(START);
    await flush();
    w.loseWake();
    expect(live.getSnapshot()!.wake).toBe('unavailable');
  });
});

describe('a walk that may not move now', () => {
  /** A paused walk already on the device, as leaving the screen leaves one. */
  function stored(w: ReturnType<typeof world>) {
    const first = createLiveWalk(w.ports);
    first.attach(START);
    w.advance(300_000);
    first.pause();
    first.detach();
    return loadWalk(w.storage)!;
  }

  it('W01: restores a stored walk for inspection only after an emergency answer', () => {
    const w = world();
    const held = stored(w);
    expect(held.status).toBe('paused');

    // A check-in with chest pain is saved; movement is now refused.
    w.refuse();
    const live = createLiveWalk(w.ports);
    live.attach();
    const snap = live.getSnapshot()!;
    expect(snap.blocked).toBe('restart');
    expect(snap.walk.status).not.toBe('running');
    // The progress is still there, so it can be saved.
    expect(snap.observedMs).toBe(300_000);
    expect(w.watching).toBe(0);
    expect(w.listeningForMotion).toBe(0);
  });

  it('W01: Resume does not start a refused walk', () => {
    const w = world();
    stored(w);
    w.refuse();
    const live = createLiveWalk(w.ports);
    live.attach();
    live.resume();
    expect(live.getSnapshot()!.walk.status).not.toBe('running');
    expect(live.getSnapshot()!.blocked).toBe('restart');
    w.advance(60_000);
    // No time accrues while it cannot move.
    expect(live.getSnapshot()!.observedMs).toBe(300_000);
  });

  it('W01: coming back to the screen does not restart a refused walk', () => {
    const w = world();
    const live = createLiveWalk(w.ports);
    live.attach(START);
    w.advance(120_000);
    w.hide();
    expect(live.getSnapshot()!.walk.status).toBe('away');

    // The person answers a check-in in another copy of the app while away.
    w.refuse();
    w.show();
    const snap = live.getSnapshot()!;
    expect(snap.blocked).toBe('restart');
    expect(snap.walk.status).not.toBe('running');
    expect(w.watching).toBe(0);
    w.advance(60_000);
    expect(live.getSnapshot()!.observedMs).toBe(120_000);
  });

  it('refuses to start a new walk the gate does not allow', () => {
    const w = world();
    w.refuse();
    const live = createLiveWalk(w.ports);
    expect(live.attach(START)).toBe('none');
    expect(live.getSnapshot()).toBeNull();
    expect(loadWalk(w.storage)).toBeNull();
  });

  it('asks about restarting, not starting, when a walk is already recorded', () => {
    const w = world();
    stored(w);
    const live = createLiveWalk(w.ports);
    live.attach(START);
    expect(w.asked.at(-1)).toBe('restart');
  });

  it('lets a walk that is allowed again carry on', () => {
    const w = world();
    stored(w);
    w.refuse();
    const live = createLiveWalk(w.ports);
    live.attach();
    expect(live.getSnapshot()!.blocked).toBe('restart');
    // The answer is corrected, so movement is allowed again.
    w.permit();
    live.resume();
    const snap = live.getSnapshot()!;
    expect(snap.walk.status).toBe('running');
    expect(snap.blocked).toBeNull();
    w.advance(30_000);
    expect(live.getSnapshot()!.observedMs).toBe(330_000);
  });

  it('can always be finished and saved, even when it may not move', () => {
    const w = world();
    stored(w);
    w.refuse();
    const live = createLiveWalk(w.ports);
    live.attach();
    live.finish('stop');
    const snap = live.getSnapshot()!;
    expect(snap.walk.status).toBe('finished');
    expect(snap.observedMs).toBe(300_000);
    expect(loadWalk(w.storage)!.status).toBe('finished');
  });
});

describe('re-audit 3, B03: every return to recording is a restart', () => {
  it('asks the restart question when a stored walk is restored, on Resume after a pause, and on the return from hidden', () => {
    const w = world();
    const first = createLiveWalk(w.ports);
    first.attach(START);
    expect(w.asked).toEqual(['start']);
    w.advance(60_000);
    first.detach();

    const live = createLiveWalk(w.ports);
    live.attach();
    expect(w.asked.at(-1)).toBe('restart');
    w.advance(5_000);
    live.pause();
    live.resume();
    expect(w.asked.at(-1)).toBe('restart');
    w.advance(5_000);
    w.hide();
    w.advance(20_000);
    w.show();
    expect(w.asked.at(-1)).toBe('restart');
  });

  it('holds a paused walk whose restart is refused only by the starting checks (P09), progress kept', () => {
    const w = world();
    const live = createLiveWalk(w.ports);
    live.attach(START);
    w.advance(120_000);
    live.pause();
    // 31 minutes on, an insulin user's reading is too old to start on.
    w.advance(31 * 60_000);
    w.refuse('restart');
    live.resume();
    const snap = live.getSnapshot()!;
    expect(snap.walk.status).toBe('paused');
    expect(snap.blocked).toBe('restart');
    expect(snap.observedMs).toBe(120_000);
    expect(w.watching).toBe(0);
  });

  it('restores stored progress held when there is no check-in today (P10)', () => {
    const w = world();
    const first = createLiveWalk(w.ports);
    first.attach(START);
    w.advance(90_000);
    first.detach();
    w.refuse('restart');
    const live = createLiveWalk(w.ports);
    expect(live.attach()).toBe('resumed');
    expect(live.getSnapshot()!.walk.status).not.toBe('running');
    expect(live.getSnapshot()!.blocked).toBe('restart');
    w.advance(30_000);
    expect(live.getSnapshot()!.observedMs).toBe(90_000);
  });

  it('keeps an uninterrupted walk going on the live question: the starting checks are not asked again', () => {
    const w = world();
    const live = createLiveWalk(w.ports);
    live.attach(START);
    // The reading turns 31 minutes old mid-walk: a restart would be refused,
    // walking on is not.
    w.refuse('restart');
    w.refuse('start');
    w.advance(40 * 60_000);
    const snap = live.getSnapshot()!;
    expect(snap.walk.status).toBe('running');
    expect(snap.blocked).toBeNull();
    expect(snap.observedMs).toBe(40 * 60_000);
    expect(w.asked.filter(a => a !== 'live')).toEqual(['start']);
  });
});

describe('re-audit 3, B03: the live gate while recording (release condition 5)', () => {
  /** A walk recording GPS and steps for two minutes. */
  function walking() {
    const w = world();
    const live = createLiveWalk(w.ports);
    live.attach(START);
    walkFor(w, 120, 0);
    expect(w.watching).toBe(1);
    expect(w.listeningForMotion).toBe(1);
    return { w, live };
  }

  it('stops recording and the sensors at once when the clinical picture changes to a refusal', () => {
    const { w, live } = walking();
    // A chest-pain answer arrives in the middle of the walk.
    w.refuse('live');
    live.reconsider();
    const snap = live.getSnapshot()!;
    expect(snap.walk.status).toBe('paused');
    expect(snap.blocked).toBe('live');
    expect(w.watching).toBe(0);
    expect(w.listeningForMotion).toBe(0);
    // Progress is kept, on the device too, and nothing more accrues.
    expect(snap.observedMs).toBe(120_000);
    expect(loadWalk(w.storage)!.status).toBe('paused');
    w.advance(60_000);
    expect(live.getSnapshot()!.observedMs).toBe(120_000);
  });

  it('stops it by the next tick even if nobody says the picture changed', () => {
    const { w, live } = walking();
    w.refuse('live');
    w.advance(1000);
    const snap = live.getSnapshot()!;
    expect(snap.walk.status).toBe('paused');
    expect(snap.blocked).toBe('live');
    expect(snap.observedMs).toBeLessThanOrEqual(121_000);
    expect(w.watching).toBe(0);
  });

  it('can be finished and saved once held, with every second it recorded', () => {
    const { w, live } = walking();
    w.refuse('live');
    live.reconsider();
    live.finish('stop');
    const walk = loadWalk(w.storage)!;
    expect(walk.status).toBe('finished');
    expect(walkObservations(walk).find(o => o.kind === 'walkDuration')!.value).toBe(2);
  });

  it('lifts the hold once the answer changes, but never moves until Resume asks the restart question', () => {
    const { w, live } = walking();
    w.refuse('live');
    live.reconsider();
    w.permit();
    live.reconsider();
    expect(live.getSnapshot()!.blocked).toBeNull();
    expect(live.getSnapshot()!.walk.status).toBe('paused');
    expect(w.watching).toBe(0);
    live.resume();
    expect(w.asked.at(-1)).toBe('restart');
    expect(live.getSnapshot()!.walk.status).toBe('running');
  });

  it('asks nothing of a walk that is not recording', () => {
    const w = world();
    const live = createLiveWalk(w.ports);
    live.reconsider();
    live.attach(START);
    live.pause();
    const before = w.asked.length;
    w.advance(10_000);
    live.reconsider();
    expect(w.asked.length).toBe(before);
    expect(live.getSnapshot()!.blocked).toBeNull();
  });
});

describe('round 3: what the walk acts on is every day’s effective record', () => {
  afterEach(() => resetPendingCheckInsForTests());

  const profile = createDefaultProfile({
    pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left', worseWith: 'flexion' },
    health: { diabetes: 'type2', currentlyActive: true, clearance: 'moderate', medicinesReviewed: true },
  });
  const settings = { currentWeight: 82 } as AppData['settings'];
  const readiness: Readiness = {
    outcome: 'green', modifiers: [], back: 'green', nerveFlag: false, reasons: [], actions: [],
    vigorousLocked: false, capHeavy: false, rpeOnly: false, notices: [],
  };
  const answers = (date: string, over: Partial<DailyCheckIn> = {}): DailyCheckIn =>
    ({ date, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, ...over });
  const record = (date: string, over: Partial<DailyCheckIn> = {}): CheckInRecord => ({ ...answers(date, over), readiness });
  const chest = (date: string) => answers(date, { urgentSymptoms: true, emergency: ['chest'] });

  /** A device: the stored check-ins, the real gate over them and the waiting answers, and its change notices. */
  function device(stored: CheckInRecord[], who: UserProfile = profile) {
    const store = { checkIns: stored };
    const storeListeners = new Set<() => void>();
    /** The store's `update`: applied and announced when the device keeps it, refused otherwise. */
    const update = (ok: boolean): StoreUpdate => async apply => {
      const next = apply({ checkIns: store.checkIns } as AppData);
      if (ok) {
        store.checkIns = next.checkIns ?? [];
        for (const l of [...storeListeners]) l();
      }
      return { ok };
    };
    const w = world({
      // The production gate: effective, reachable days worked out only when they change (C2-05).
      gate: now => deviceGate(() => ({ profile: who, checkIns: store.checkIns, settings }), now),
      // The real watcher for answers waiting to be stored; the store's own notices from here.
      watchClinical: onChange => {
        storeListeners.add(onChange);
        const stopPending = watchClinical(onChange);
        return () => {
          storeListeners.delete(onChange);
          stopPending();
        };
      },
    });
    return {
      w,
      store,
      /** How many listeners the controller has on the store now. */
      get listening() { return storeListeners.size; },
      /** A check-in stored, as another copy of the app would. */
      put(next: CheckInRecord[]) {
        store.checkIns = next;
        for (const l of [...storeListeners]) l();
      },
      /** A check-in save the device refuses, as the sheet makes it. */
      refuse: (a: DailyCheckIn) => saveCheckInRecord(a, { profile: who, update: update(false) }),
      /** A check-in save, as the sheet makes it. */
      save: (a: DailyCheckIn, ok = true) => saveCheckInRecord(a, { profile: who, update: update(ok) }),
      /** Symptoms reported through the shared path, as a screen reports them. */
      report: (r: SymptomReport, at: Date, ok = true) => reportSymptoms(r, { profile: who, update: update(ok), date: toDateString(at) }, at),
    };
  }

  it('holds a recording walk when a chest-pain answer arrives whose save the device refused', async () => {
    const day = toDateString(new Date(T0));
    const d = device([record(day)]);
    const live = createLiveWalk(d.w.ports);
    live.attach(START);
    walkFor(d.w, 60, 0);
    expect(live.getSnapshot()!.walk.status).toBe('running');

    const saved = await d.refuse(chest(day));
    expect(saved.stored).toBe(false);
    // The store never changed: only the waiting answer says so, and it is heard.
    const snap = live.getSnapshot()!;
    expect(snap.walk.status).toBe('paused');
    expect(snap.blocked).toBe('live');
    expect(d.w.watching).toBe(0);
    expect(d.w.listeningForMotion).toBe(0);
    expect(snap.observedMs).toBe(60_000);
  });

  it('keeps a walk held for a 23:59 emergency held at 00:01, before the new day has a check-in', () => {
    const d = device([record('2026-10-11')]);
    d.w.now = new Date(2026, 9, 11, 23, 57).getTime();
    const live = createLiveWalk(d.w.ports);
    live.attach(START);
    d.w.advance(120_000);
    d.put([record('2026-10-11', { urgentSymptoms: true, emergency: ['chest'] })]);
    expect(live.getSnapshot()!.blocked).toBe('live');

    d.w.advance(120_000);
    expect(toDateString(new Date(d.w.now))).toBe('2026-10-12');
    // Anything that makes it ask again — a write, the new day — still finds the emergency.
    live.reconsider();
    expect(live.getSnapshot()!.blocked).toBe('live');
    live.resume();
    expect(live.getSnapshot()!.walk.status).toBe('paused');
    expect(live.getSnapshot()!.blocked).toBe('restart');
    expect(live.getSnapshot()!.observedMs).toBe(120_000);
  });

  it('keeps it held at 00:01 when the 23:59 emergency was never stored either', async () => {
    const d = device([record('2026-10-11')]);
    d.w.now = new Date(2026, 9, 11, 23, 58).getTime();
    const live = createLiveWalk(d.w.ports);
    live.attach(START);
    d.w.advance(60_000);
    await d.refuse(chest('2026-10-11'));
    expect(live.getSnapshot()!.blocked).toBe('live');
    d.w.advance(120_000);
    d.put([...d.store.checkIns]);
    expect(live.getSnapshot()!.blocked).toBe('live');
    expect(live.getSnapshot()!.walk.status).toBe('paused');
  });

  it('stops listening when the walk screen closes, and listens once when it opens again', async () => {
    const day = toDateString(new Date(T0));
    const d = device([record(day)]);
    const live = createLiveWalk(d.w.ports);
    live.attach(START);
    expect(d.listening).toBe(1);
    d.w.advance(10_000);
    live.detach();
    expect(d.listening).toBe(0);
    const asked = d.w.asked.length;
    d.put([record(day)]);
    expect(d.w.asked.length).toBe(asked);

    // Back again: one listener, so one change is one question.
    live.attach();
    expect(d.listening).toBe(1);
    const before = d.w.asked.length;
    d.put([record(day)]);
    expect(d.w.asked.length - before).toBe(1);
    await d.refuse(chest(day));
    expect(live.getSnapshot()!.blocked).toBe('live');
  });

  it('N01: stops recording at the tap itself, whatever the answer turns out to allow', async () => {
    const w = world();
    const live = createLiveWalk(w.ports);
    live.attach(START);
    walkFor(w, 30, 0);
    const reports: SymptomReport[] = [];
    // A report the engine would not hold for, saved later: the tap still stops the walk now.
    void feelLow(live, async r => {
      reports.push(r);
      return { record: record(toDateString(new Date(w.now))), stored: true };
    });
    expect(live.getSnapshot()!.walk.status).toBe('paused');
    expect(w.watching).toBe(0);
    expect(reports).toEqual([{ news: ['lowSymptoms'] }]);
  });

  describe('N01: "I feel low" is a clinical answer, not only a walk ending', () => {
    const onInsulin = createDefaultProfile({
      health: { diabetes: 'type2', insulin: 'injections_or_pump', glucoseMonitor: 'meter', currentlyActive: true, clearance: 'moderate', medicinesReviewed: true },
    });
    const at = (h: number, m: number, s = 0) => new Date(2026, 9, 8, h, m, s);
    const DAY = '2026-10-08';
    const before = () => record(DAY, { glucose: { value: 140, unit: 'mg/dL', measuredAt: at(19, 0).toISOString() } });

    for (const ok of [true, false]) {
      it(`holds the walk at the tap, and the next start, until a later reading answers it (save ${ok ? 'stored' : 'refused'})`, async () => {
        const d = device([before()], onInsulin);
        d.w.now = at(19, 2).getTime();
        const live = createLiveWalk(d.w.ports);
        expect(live.attach(START)).toBe('created');
        d.w.advance(180_000);

        const saved = await feelLow(live, (r, when) => d.report(r, when, ok), at(19, 5));
        expect(saved.stored).toBe(ok);
        expect(saved.record.lowSymptomsAt).toBe(at(19, 5).toISOString());
        // No reading is made up from the button.
        expect(saved.record.glucose?.value).toBe(140);
        const snap = live.getSnapshot()!;
        expect(snap.walk.status).toBe('paused');
        expect(d.w.watching).toBe(0);
        expect(snap.observedMs).toBe(180_000);

        // Carrying on is a restart, and the report holds it.
        live.resume();
        expect(live.getSnapshot()!.walk.status).toBe('paused');
        expect(live.getSnapshot()!.blocked).toBe('restart');

        // Ended and saved, the record says why; and the next walk is held, though 19:00's 140 is fresh.
        live.finish('low');
        expect(walkObservations(live.getSnapshot()!.walk)[0].note).toContain('Ended because you felt low.');
        const next = walkRefusal(walkInput(deviceClinical({ profile: onInsulin, checkIns: d.store.checkIns, settings }), at(19, 6)), 'start');
        expect(next?.needsCheckIn).toBe(true);
        expect(next?.reasons.join(' ')).toMatch(/You said you feel low/);
      });
    }

    it('is released only by a reading taken after it, with the symptoms gone, and then only through Resume', async () => {
      const d = device([before()], onInsulin);
      d.w.now = at(19, 2).getTime();
      const live = createLiveWalk(d.w.ports);
      live.attach(START);
      d.w.advance(180_000);
      await feelLow(live, (r, when) => d.report(r, when), at(19, 5));
      d.w.now = at(19, 10).getTime();
      live.resume();
      expect(live.getSnapshot()!.blocked).toBe('restart');

      const saved = await d.report(lowReading({ value: 112, unit: 'mg/dL', source: 'meter' }, true), at(19, 10));
      expect(saved.record.glucose).toMatchObject({ value: 112, measuredAt: at(19, 10).toISOString() });
      expect(saved.record.news).not.toContain('lowSymptoms');
      // Heard at once: no longer held, and still not moving.
      expect(live.getSnapshot()!.blocked).toBeNull();
      expect(live.getSnapshot()!.walk.status).toBe('paused');
      live.resume();
      expect(live.getSnapshot()!.walk.status).toBe('running');
      d.w.advance(60_000);
      expect(live.getSnapshot()!.observedMs).toBe(240_000);
    });

    for (const ok of [true, false]) {
      it(`a low someone else had to help treat ends exercise for today, even after a normal reading (M-05, save ${ok ? 'stored' : 'refused'})`, async () => {
        const d = device([before()], onInsulin);
        d.w.now = at(19, 2).getTime();
        const live = createLiveWalk(d.w.ports);
        live.attach(START);
        d.w.advance(60_000);
        await feelLow(live, (r, when) => d.report(r, when, ok), at(19, 3));
        d.w.now = at(19, 20).getTime();
        const saved = await d.report(lowReading({ value: 110, unit: 'mg/dL', source: 'meter' }, true, true), at(19, 20), ok);
        expect(saved.stored).toBe(ok);
        expect(saved.record.news).toContain('lowSevere');
        live.resume();
        expect(live.getSnapshot()!.walk.status).toBe('paused');
        expect(live.getSnapshot()!.blocked).toBe('restart');
        const next = walkRefusal(walkInput(deviceClinical({ profile: onInsulin, checkIns: d.store.checkIns, settings }), at(19, 30)), 'start');
        expect(next).toBeDefined();
        expect(next?.disposition).not.toBe('reassure');
      });
    }

    it('stays held after a low reading: the engine decides what the reading allows, not the button', async () => {
      const d = device([before()], onInsulin);
      d.w.now = at(19, 2).getTime();
      const live = createLiveWalk(d.w.ports);
      live.attach(START);
      d.w.advance(60_000);
      await feelLow(live, (r, when) => d.report(r, when), at(19, 3));
      d.w.now = at(19, 5).getTime();
      await d.report(lowReading({ value: 62, unit: 'mg/dL', source: 'meter' }, false), at(19, 5));
      live.resume();
      expect(live.getSnapshot()!.walk.status).toBe('paused');
      expect(live.getSnapshot()!.blocked).toBe('restart');
    });
  });

  describe('"I need to stop" records what happened', () => {
    const DAY = toDateString(new Date(T0));
    const none: LegAnswers = { weakness: false, fast: false, bothLegs: false, saddle: false, bladderBowel: false };
    /** A walk two minutes in, stopped with "I need to stop": recording pauses at the tap. */
    function stopped(who: UserProfile = profile, before: CheckInRecord = record(DAY, { back: { pain: 2, reach: 'buttock', newNeuro: false, caudaEquinaFlag: false } })) {
      const d = device([before], who);
      const live = createLiveWalk(d.w.ports);
      live.attach(START);
      d.w.advance(120_000);
      live.pause();
      return { d, live };
    }
    const next = (d: ReturnType<typeof device>, who: UserProfile = profile) =>
      walkRefusal(walkInput(deviceClinical({ profile: who, checkIns: d.store.checkIns, settings }), new Date(d.w.now)), 'start');

    const emergencies: [string, SymptomReport][] = [
      ['chest pain', stopReport('chest')],
      ['signs of a stroke', stopReport('stroke')],
      ['new severe breathlessness', stopReport('breathless')],
      ['weakness in both legs', legReport({ ...none, bothLegs: true }, 'buttock')],
      ['saddle numbness', legReport({ ...none, saddle: true }, 'buttock')],
      ['bladder or bowel change', legReport({ ...none, bladderBowel: true }, 'buttock')],
      ['leg weakness getting worse quickly', legReport({ ...none, weakness: true, fast: true }, 'buttock')],
    ];
    for (const ok of [true, false]) {
      for (const [what, report] of emergencies) {
        it(`${what}: an emergency that ends the walk, and holds the next start (save ${ok ? 'stored' : 'refused'})`, async () => {
          const { d, live } = stopped();
          const saved = await d.report(report, new Date(d.w.now), ok);
          expect(saved.stored).toBe(ok);
          live.resume();
          expect(live.getSnapshot()!.walk.status).toBe('paused');
          const why = walkRefusal(walkInput(deviceClinical({ profile, checkIns: d.store.checkIns, settings }), new Date(d.w.now)), 'restart');
          expect(why?.disposition).toBe('emergency');
          expect(next(d)?.disposition).toBe('emergency');
          live.finish('emergency');
          expect(walkObservations(live.getSnapshot()!.walk)[0].note).toContain('Ended because of symptoms that need emergency help.');
          expect(live.getSnapshot()!.observedMs).toBe(120_000);
        });
      }

      it(`dizzy or faint: held, not an emergency, until today’s answers change (save ${ok ? 'stored' : 'refused'})`, async () => {
        const { d, live } = stopped();
        expect((await d.report(stopReport('dizzy'), new Date(d.w.now), ok)).stored).toBe(ok);
        live.resume();
        expect(live.getSnapshot()!.walk.status).toBe('paused');
        expect(live.getSnapshot()!.blocked).toBe('restart');
        const why = next(d);
        expect(why?.disposition).toBe('hold');
        expect(why?.reasons.join(' ')).toMatch(/Dizzy or faint/);
      });

      it(`new weakness in one leg: the engine holds the walk, and the next start (save ${ok ? 'stored' : 'refused'})`, async () => {
        const { d, live } = stopped();
        await d.report(legReport({ ...none, weakness: true }, 'buttock'), new Date(d.w.now), ok);
        live.resume();
        expect(live.getSnapshot()!.walk.status).toBe('paused');
        const why = next(d);
        expect(why).toBeDefined();
        expect(why?.disposition).not.toBe('emergency');
      });

      it(`symptoms reaching further down the leg: recorded, and Resume does what the restart question says (save ${ok ? 'stored' : 'refused'})`, async () => {
        const { d, live } = stopped();
        const saved = await d.report(legReport({ ...none, reach: 'belowKnee' }, 'buttock'), new Date(d.w.now), ok);
        expect(saved.record.back).toMatchObject({ reach: 'belowKnee', spreadToday: true });
        const answer = walkRefusal(walkInput(deviceClinical({ profile, checkIns: d.store.checkIns, settings }), new Date(d.w.now)), 'restart');
        live.resume();
        expect(d.w.asked.at(-1)).toBe('restart');
        expect(live.getSnapshot()!.walk.status).toBe(answer ? 'paused' : 'running');
      });
    }

    it('just a rest: nothing recorded, and Resume carries on', () => {
      const { d, live } = stopped();
      const before = JSON.stringify(d.store.checkIns);
      live.resume();
      expect(live.getSnapshot()!.walk.status).toBe('running');
      expect(JSON.stringify(d.store.checkIns)).toBe(before);
    });
  });

  it('N06: a restart held for a stale reading is released by a fresh one from the check-in, and Resume carries on with the walk so far', async () => {
    const onInsulin = createDefaultProfile({
      health: { diabetes: 'type2', insulin: 'injections_or_pump', glucoseMonitor: 'meter', currentlyActive: true, clearance: 'moderate', medicinesReviewed: true },
    });
    const at = (h: number, m: number) => new Date(2026, 9, 8, h, m);
    const d = device([record('2026-10-08', { glucose: { value: 140, unit: 'mg/dL', measuredAt: at(19, 0).toISOString() } })], onInsulin);
    d.w.now = at(19, 1).getTime();
    const live = createLiveWalk(d.w.ports);
    live.attach(START);
    d.w.advance(5 * 60_000);
    live.pause();
    d.w.advance(26 * 60_000);
    live.resume();
    expect(live.getSnapshot()!.blocked).toBe('restart');

    const fresh = await d.save(answers('2026-10-08', { glucose: { value: 130, unit: 'mg/dL', measuredAt: new Date(d.w.now).toISOString() } }));
    expect(fresh.stored).toBe(true);
    expect(live.getSnapshot()!.blocked).toBeNull();
    live.resume();
    expect(live.getSnapshot()!.walk.status).toBe('running');
    d.w.advance(60_000);
    expect(live.getSnapshot()!.observedMs).toBe(6 * 60_000);
    expect(live.getSnapshot()!.walk.segments).toHaveLength(2);
  });
});

describe('F08: a walk the tab will not store', () => {
  it('says so as soon as a write is refused, and keeps trying until one is kept', () => {
    const map = new Map<string, string>();
    let refusing = false;
    const storage: WalkStorage = {
      getItem: k => map.get(k) ?? null,
      setItem: (k, v) => {
        if (refusing) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
        map.set(k, v);
      },
      removeItem: k => void map.delete(k),
    };
    const w = world({ storage });
    const live = createLiveWalk(w.ports);
    live.attach(START);
    w.advance(60_000);
    expect(live.getSnapshot()!.draftKept).toBe(true);

    refusing = true;
    w.advance(1_000);
    expect(live.getSnapshot()!.draftKept).toBe(false);
    // What a reload would find is older than what the screen shows.
    expect(JSON.parse(map.get('fit-strong-walk')!).seenAt).toBeLessThan(w.now);

    refusing = false;
    w.advance(1_000);
    expect(live.getSnapshot()!.draftKept).toBe(true);
    expect(JSON.parse(map.get('fit-strong-walk')!).seenAt).toBe(w.now);
  });

  it('says so from the start when the tab has no storage at all', () => {
    const w = world();
    const live = createLiveWalk({ ...w.ports, storage: undefined });
    live.attach(START);
    expect(live.getSnapshot()!.draftKept).toBe(false);
  });
});

describe('F17: walking through midnight', () => {
  it('closes the segment at local midnight and carries straight on in a new one', () => {
    const w = world();
    w.now = new Date(2026, 9, 11, 23, 59).getTime();
    const live = createLiveWalk(w.ports);
    live.attach(START);
    w.advance(180_000);
    const snap = live.getSnapshot()!;
    const midnight = new Date(2026, 9, 12).getTime();
    expect(snap.walk.segments.map(x => [x.start, x.end, x.endedBy])).toEqual([
      [new Date(2026, 9, 11, 23, 59).getTime(), midnight, 'midnight'],
      [midnight, undefined, undefined],
    ]);
    // No gap: the walk was watched throughout, so no time is lost.
    expect(snap.walk.gaps).toEqual([]);
    expect(snap.observedMs).toBe(180_000);
    expect(snap.walk.status).toBe('running');
  });

  it('puts a step taken after midnight on the new day, though the clock has not ticked yet (N03)', () => {
    const w = world({ geolocation: false });
    w.now = new Date(2026, 9, 11, 23, 59, 50, 500).getTime();
    const live = createLiveWalk(w.ports);
    live.attach({ id: 'mgh3k2x1-1a2b3c4d', plan: { kind: 'walk', gps: false, steps: true } });
    const midnight = new Date(2026, 9, 12).getTime();
    // The same samples through a detector of the test's own, to date every step.
    const reference = createStepDetector();
    const dated: number[] = [];
    const start = w.now;
    for (let i = 0; i < 11 * 50; i++) {
      const at = start + i * 20;
      // Timers run in their order between samples, the walk's tick among them.
      w.advance(at - w.now);
      const y = G + 2.5 * Math.sin(2 * Math.PI * 2 * (i / 50));
      w.sample(at, y);
      if (reference.push(at, 0, y, 0)) dated.push(...reference.lastCommitted);
    }
    live.finish('finish');
    const steps = walkObservations(live.getSnapshot()!.walk).filter(o => o.kind === 'steps');
    const onDay = (day: string) => steps.filter(o => o.at!.startsWith(day)).reduce((t, o) => t + o.value, 0);
    // The trigger: a step after midnight, committed before the first tick of the new day.
    expect(dated.some(t => t >= midnight && t < midnight + 500)).toBe(true);
    expect(onDay('2026-10-11')).toBe(dated.filter(t => t < midnight).length);
    expect(onDay('2026-10-12')).toBe(dated.filter(t => t >= midnight).length);
  });

  it('dates the steps of a run confirmed after midnight to the day each was taken (N03)', () => {
    const w = world({ geolocation: false });
    w.now = new Date(2026, 9, 11, 23, 59, 58).getTime();
    const live = createLiveWalk(w.ports);
    live.attach({ id: 'mgh3k2x1-1a2b3c4d', plan: { kind: 'walk', gps: false, steps: true } });
    const midnight = new Date(2026, 9, 12).getTime();
    const reference = createStepDetector();
    const batches: number[][] = [];
    const start = w.now;
    for (let i = 0; i < 5 * 50; i++) {
      const at = start + i * 20;
      w.advance(at - w.now);
      const y = G + 2.5 * Math.sin(2 * Math.PI * 2 * (i / 50));
      w.sample(at, y);
      if (reference.push(at, 0, y, 0)) batches.push([...reference.lastCommitted]);
    }
    // The trigger: the run that starts the count holds steps from both days.
    expect(batches.some(b => b.some(t => t < midnight) && b.some(t => t >= midnight))).toBe(true);
    live.finish('finish');
    const steps = walkObservations(live.getSnapshot()!.walk).filter(o => o.kind === 'steps');
    const onDay = (day: string) => steps.filter(o => o.at!.startsWith(day)).reduce((t, o) => t + o.value, 0);
    const dated = batches.flat();
    expect(onDay('2026-10-11')).toBe(dated.filter(t => t < midnight).length);
    expect(onDay('2026-10-12')).toBe(dated.filter(t => t >= midnight).length);
  });

  it('never lets a GPS run reach past its segment at midnight (N03)', () => {
    const w = world({ motion: false });
    w.now = new Date(2026, 9, 11, 23, 59, 30, 500).getTime();
    const live = createLiveWalk(w.ports);
    live.attach({ id: 'mgh3k2x1-1a2b3c4d', plan: { kind: 'walk', gps: true, steps: false } });
    // A fix every second at .200: one comes at 00:00:00.200, before the tick at .500.
    let north = 0;
    for (let at = new Date(2026, 9, 11, 23, 59, 31, 200).getTime(); at < new Date(2026, 9, 12, 0, 0, 20).getTime(); at += 1000) {
      w.advance(at - w.now);
      w.fix(north);
      north += 1.3;
    }
    const segments = live.getSnapshot()!.walk.segments;
    expect(segments).toHaveLength(2);
    for (const s of segments) {
      for (const r of s.gps) {
        expect(r.start).toBeGreaterThanOrEqual(s.start);
        if (s.end !== undefined) expect(r.end).toBeLessThanOrEqual(s.end);
      }
    }
    expect(segments[1].gps.length).toBeGreaterThan(0);
  });
});

describe('finishing', () => {
  it('stops everything and keeps the finished walk for the summary', () => {
    const w = world();
    const live = createLiveWalk(w.ports);
    live.attach(START);
    w.advance(120_000);
    live.finish('low');
    const snap = live.getSnapshot()!;
    expect(snap.walk.status).toBe('finished');
    expect(snap.walk.endedBy).toBe('low');
    expect(w.watching).toBe(0);
    expect(w.listeningForMotion).toBe(0);
    expect(loadWalk(w.storage)!.status).toBe('finished');
    w.advance(60_000);
    expect(live.getSnapshot()!.observedMs).toBe(120_000);
  });
});
