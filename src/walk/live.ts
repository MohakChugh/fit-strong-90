/**
 * The walk while it happens: the clock, the GPS track and the step counter
 * wired to the platform, with a snapshot published about once a second.
 *
 * Nothing in here touches the browser directly. Every platform capability
 * comes in as a port (`browser.ts` supplies the real ones), so the whole live
 * behaviour — hiding mid-walk, a reload, denied location, a step permission
 * lost on relaunch — is tested in node with fakes.
 *
 * Sensor callbacks only update state; they never notify. Motion arrives at up
 * to 100 Hz and GPS about once a second, and re-rendering on each would cost
 * battery on the heaviest thing the app does (research §2). The once-a-second
 * tick publishes, lands on the second boundary of the observed time so the
 * clock never skips or repeats a second, and keeps the stored walk current.
 */

import {
  addGapTime,
  creditSteps,
  finishWalk,
  heartbeat,
  leaveWalk,
  measuredRuns,
  observedMs,
  openSegment,
  pauseWalk,
  restoreWalk,
  resumeWalk,
  returnToWalk,
  segmentDistance,
  splitAtMidnight,
  startWalk,
  updateOpenSegment,
  type EndedBy,
  type Gap,
  type Walk,
  type WalkPlan,
  type WalkStatus,
} from './clock';
import { createTrack, type Fix, type GpsRun, type PaceState, type Track } from './gps';
import { createStepDetector } from './steps';
import { lastStartedId, loadWalk, markStarted, storeWalk, type WalkStorage } from './persist';

export type GeoError = 'denied' | 'unavailable' | 'timeout';

export interface GeoPort {
  /** Start watching with high accuracy. Returns a function that stops. */
  watch(onFix: (fix: Fix) => void, onError: (error: GeoError) => void): () => void;
}

export interface MotionPort {
  /**
   * iOS will not deliver motion events until a tap grants it, and forgets the
   * grant whenever the app is relaunched (research §1).
   */
  needsPermission: boolean;
  /** Must be called from a tap. */
  request(): Promise<'granted' | 'denied'>;
  /** Acceleration including gravity, m/s², with the event's own time in ms. */
  listen(onSample: (t: number, x: number, y: number, z: number) => void): () => void;
}

export interface WakeLockPort {
  /** Resolves true when the screen will stay on. `onLost` runs if the lock is later released. */
  request(onLost: () => void): Promise<boolean>;
  release(): void;
}

export interface VisibilityPort {
  visible(): boolean;
  subscribe(onChange: (visible: boolean) => void): () => void;
}

/**
 * Why movement is being asked about (re-audit 3, B03):
 * - `start`: a walk beginning now;
 * - `restart`: recording again after anything that was not walking — a
 *   stored walk restored, Resume after a pause, the return from hidden.
 *   Restarting is starting, so it is the full question: today's check-in, a
 *   fresh reading where that matters, every condition and profile rule;
 * - `live`: walking under way, uninterrupted. Every current clinical
 *   condition and profile rule still stops it; the starting checks — a
 *   reading turning 30 minutes old, no check-in today — do not.
 */
export type WalkIntent = 'start' | 'restart' | 'live';

export interface LivePorts {
  /**
   * May this walk move right now? Asked at every transition into recording,
   * and every second while recording, never cached: a walk already on the
   * device is progress to inspect and save, never permission to walk
   * (re-audit F06). `browser.ts` answers from the readiness engine, with what
   * the live screen knows (B04).
   */
  mayRun(intent: WalkIntent): boolean;
  /**
   * Tells the controller when anything that could change that answer
   * changes — the store, or an answer waiting to be stored — so a walk
   * recording now is asked again at once. Returns a function that stops.
   */
  watchClinical?(onChange: () => void): () => void;
  now(): number;
  /** Run `fn` after `ms`. Returns a function that cancels it. */
  later(fn: () => void, ms: number): () => void;
  storage: WalkStorage | undefined;
  visibility: VisibilityPort;
  geolocation?: GeoPort;
  motion?: MotionPort;
  wakeLock?: WakeLockPort;
}

/** A gap shorter than this is recorded but not announced: a glance at a notification. */
export const NOTICE_MIN_GAP_MS = 10_000;
/** Offer to add a gap as walking time only from a minute: adding seconds is noise. */
export const ADDABLE_GAP_MS = 60_000;
/** Listening this long with no motion sample means none is coming. */
export const MOTION_WAIT_MS = 3_000;

export type GpsState = 'off' | 'unsupported' | 'denied' | 'paused' | PaceState;

export type StepsState =
  | 'off'
  | 'unsupported'
  | 'denied'
  /** iOS forgot the grant (a relaunch): a tap brings it back. */
  | 'needsPermission'
  | 'waiting'
  /** Listening, and nothing arrives: no sensor this browser can read. */
  | 'noSensor'
  | 'paused'
  | 'counting';

export type WakeState = 'pending' | 'held' | 'unavailable';

export type Notice =
  /** Back after the app was away. `gapIndex` is the gap in `walk.gaps`. */
  | { kind: 'away'; gapIndex: number; gap: Gap }
  | { kind: 'added'; gap: Gap };

export interface LiveSnapshot {
  walk: Walk;
  now: number;
  observedMs: number;
  gps: { state: GpsState; secPerKm?: number };
  /** Metres over the whole walk, segment by segment. */
  distanceM: number;
  /** Some segment had two usable fixes, so the distance is a measurement. */
  distanceMeasured: boolean;
  steps: number;
  stepsState: StepsState;
  wake: WakeState;
  notice: Notice | null;
  /**
   * The walk is held because movement is not allowed now: the question that
   * refused it, so the screen can say why, or null. Its progress is here to
   * read and save; it cannot record again until the answer changes.
   */
  blocked: WalkIntent | null;
  /**
   * The last write of the walk in progress reached the tab's storage. False
   * means only this page's memory holds the latest progress, so a reload
   * would bring back an older copy (re-audit F08). Every tick tries again.
   */
  draftKept: boolean;
}

export type AttachResult = 'created' | 'resumed' | 'none';

export interface LiveWalk {
  subscribe(listener: () => void): () => void;
  getSnapshot(): LiveSnapshot | null;
  /**
   * Open the walk screen: resume the stored walk, or start `request` if there
   * is none and it has not been started before. `none` means there is no walk
   * to show.
   */
  attach(request?: { id: string; plan: WalkPlan }): AttachResult;
  /** Close the walk screen. A running walk stops recording until it reopens. */
  detach(): void;
  pause(): void;
  /**
   * Carry on: from a pause, or after the app was away. A restart, so it asks
   * the full question; refused, the walk stays held with its progress intact.
   */
  resume(): void;
  /**
   * What the person's check-in or profile says has changed. A walk recording
   * now is asked the live question and, refused, stops recording at once,
   * progress kept. A held walk whose answer has changed is no longer held —
   * it does not move until Resume asks the restart question. Called by the
   * controller itself whenever `watchClinical` fires.
   */
  reconsider(): void;
  finish(endedBy: EndedBy): void;
  /** Count the gap in the current notice as walking time the person entered. */
  addAwayTime(): void;
  dismissNotice(): void;
  /** From a tap: ask again for motion, after iOS forgot the grant. */
  enableMotion(): Promise<void>;
}

export function createLiveWalk(ports: LivePorts): LiveWalk {
  const listeners = new Set<() => void>();
  let walk: Walk | null = null;
  let snapshot: LiveSnapshot | null = null;
  let notice: Notice | null = null;
  let blocked: WalkIntent | null = null;

  let track: Track | null = null;
  /** The open segment's GPS figures when its current track began. */
  /** The open segment's GPS runs from before its current track began (a quick remount). */
  let trackBase: GpsRun[] = [];
  let stopGps: (() => void) | undefined;
  let gpsDenied = false;

  const detector = createStepDetector();
  let stopMotion: (() => void) | undefined;
  let motionDenied = false;
  let listeningSince: number | undefined;
  let lastSample: number | undefined;

  let wake: WakeState = 'pending';
  /** Bumped on every request and release, so a late answer cannot overwrite a newer state. */
  let wakeToken = 0;

  let cancelTick: (() => void) | undefined;
  let stopVisibility: (() => void) | undefined;
  let stopClinical: (() => void) | undefined;

  let draftKept = true;

  /** Keep the walk in progress, and remember whether that worked, to say so. */
  function persist() {
    if (walk) draftKept = storeWalk(ports.storage, walk);
  }

  function gpsState(now: number): LiveSnapshot['gps'] {
    if (!walk?.plan.gps) return { state: 'off' };
    if (!ports.geolocation) return { state: 'unsupported' };
    if (gpsDenied) return { state: 'denied' };
    if (walk.status !== 'running' || !track) return { state: 'paused' };
    return track.readout(now);
  }

  function stepsState(now: number): StepsState {
    if (!walk?.plan.steps) return 'off';
    if (!ports.motion) return 'unsupported';
    if (motionDenied) return 'denied';
    if (walk.status !== 'running') return 'paused';
    if (lastSample !== undefined) return 'counting';
    if (listeningSince !== undefined && now - listeningSince < MOTION_WAIT_MS) return 'waiting';
    return ports.motion.needsPermission ? 'needsPermission' : 'noSensor';
  }

  function emit() {
    if (!walk) {
      snapshot = null;
    } else {
      const now = ports.now();
      snapshot = {
        walk,
        now,
        observedMs: observedMs(walk, now),
        gps: gpsState(now),
        distanceM: walk.segments.reduce((t, s) => t + segmentDistance(s), 0),
        distanceMeasured: walk.segments.some(s => measuredRuns(s).length > 0),
        steps: walk.segments.reduce((t, s) => t + s.steps, 0),
        stepsState: stepsState(now),
        wake,
        notice,
        blocked,
        draftKept,
      };
    }
    for (const listener of [...listeners]) listener();
  }

  function onFix(fix: Fix) {
    if (!walk || walk.status !== 'running' || !track) return;
    const now = ports.now();
    // The day may have ended since the last tick: split first, so the fix
    // lands in the day it was taken in (re-audit N03).
    catchUpMidnight(now);
    if (!track || track.push(fix, now) !== 'accepted') return;
    const t = track;
    walk = updateOpenSegment(walk, s => ({ ...s, gps: [...trackBase, ...t.runs] }));
  }

  function onGeoError(error: GeoError) {
    // Unavailable and timeout are weather: the readout already says the
    // signal is gone. Only a refusal is final for this walk.
    if (error !== 'denied') return;
    gpsDenied = true;
    stopGps?.();
    stopGps = undefined;
    track = null;
    emit();
  }

  function onSample(t: number, x: number, y: number, z: number) {
    if (!walk || walk.status !== 'running') return;
    const now = ports.now();
    // As for a fix: a day that has ended is split before anything is added.
    // The detector keeps its rhythm, so no walking run is lost at midnight.
    catchUpMidnight(now);
    lastSample = now;
    if (detector.push(t, x, y, z) > 0) {
      // Each step to the segment it happened in, by its own time (N03).
      walk = creditSteps(walk, detector.lastCommitted);
    } else if (openSegment(walk)?.motion === false) {
      walk = updateOpenSegment(walk, s => ({ ...s, motion: true }));
    }
  }

  function listenForMotion(now: number) {
    if (!ports.motion) return;
    stopMotion?.();
    detector.reset();
    listeningSince = now;
    lastSample = undefined;
    stopMotion = ports.motion.listen(onSample);
  }

  /** Begin measuring the open segment. A fresh track: never a line across a gap. */
  function startSensors(now: number) {
    const segment = walk && openSegment(walk);
    if (!walk || !segment) return;
    if (walk.plan.gps && ports.geolocation && !gpsDenied) {
      track = createTrack(segment.start);
      trackBase = segment.gps;
      stopGps = ports.geolocation.watch(onFix, onGeoError);
    }
    if (walk.plan.steps && !motionDenied) listenForMotion(now);
  }

  function stopSensors() {
    stopGps?.();
    stopGps = undefined;
    track = null;
    stopMotion?.();
    stopMotion = undefined;
    listeningSince = undefined;
    lastSample = undefined;
  }

  function requestWake() {
    if (!walk || walk.status === 'finished') return;
    if (!ports.wakeLock) {
      wake = 'unavailable';
      return;
    }
    if (wake === 'held') return;
    const token = ++wakeToken;
    wake = 'pending';
    const lost = () => {
      if (token !== wakeToken) return;
      // Released while hidden is expected and comes back on return; released
      // while visible means the system took it, and the person should know.
      wake = ports.visibility.visible() ? 'unavailable' : 'pending';
      emit();
    };
    void ports.wakeLock.request(lost).then(held => {
      if (token !== wakeToken) return;
      wake = held ? 'held' : 'unavailable';
      emit();
    });
  }

  function releaseWake() {
    wakeToken += 1;
    ports.wakeLock?.release();
    wake = 'pending';
  }

  /**
   * May this walk move? Asked fresh every time, and a refusal is remembered
   * so the screen can show why and offer to save what was recorded.
   */
  function mayRun(intent: WalkIntent): boolean {
    const allowed = ports.mayRun(intent);
    blocked = allowed ? null : intent;
    return allowed;
  }

  /**
   * Walking under way is no longer allowed — an emergency answered, a stop
   * for today, a profile restriction (release condition 5). Recording and the
   * sensors stop now; what was recorded stays, to be read and saved.
   */
  function holdBack(now: number) {
    if (!walk || walk.status !== 'running') return;
    catchUpMidnight(now);
    stopSensors();
    walk = pauseWalk(walk, now);
    notice = null;
  }

  /** Something the answer depends on changed: ask again, as `LiveWalk.reconsider` says. */
  function reconsider() {
    if (!walk || walk.status === 'finished') return;
    if (walk.status === 'running') {
      if (mayRun('live')) return;
      holdBack(ports.now());
      persist();
      emit();
      scheduleTick();
      return;
    }
    // Held: the same question again. A yes lifts the hold so Resume is
    // offered; it never moves the walk by itself.
    if (blocked && ports.mayRun(blocked)) {
      blocked = null;
      emit();
    }
  }

  /** The person is back: a new segment, an announced gap, or a walk left too long. */
  function comeBack(now: number): WalkStatus | undefined {
    if (!walk) return undefined;
    const back = returnToWalk(walk, now);
    walk = back.walk;
    if (back.gap && back.gap.end - back.gap.start >= NOTICE_MIN_GAP_MS) {
      notice = { kind: 'away', gapIndex: walk.gaps.length - 1, gap: back.gap };
    }
    return walk.status;
  }

  function scheduleTick() {
    cancelTick?.();
    cancelTick = undefined;
    if (!walk || walk.status === 'finished') return;
    // Land on the next whole second of observed time, so the clock shows
    // every second exactly once. A timer that fires a hair early finds a
    // second not quite passed and simply ticks again a moment later.
    const delay = walk.status === 'running' ? 1000 - (observedMs(walk, ports.now()) % 1000) : 1000;
    cancelTick = ports.later(tick, delay);
  }

  /**
   * A walk recorded through local midnight carries on in a new segment from
   * midnight, so every day is credited with its own time, distance and steps
   * (re-audit F17). The GPS watch and the step counter keep running: only a
   * fresh track begins, so no distance is credited across the boundary.
   */
  function catchUpMidnight(now: number) {
    if (!walk || walk.status !== 'running') return;
    const split = splitAtMidnight(walk, now);
    if (split === walk) return;
    walk = split;
    const open = openSegment(walk);
    if (track && open) {
      track = createTrack(open.start);
      trackBase = [];
    }
  }

  function tick() {
    cancelTick = undefined;
    if (!walk) return;
    const now = ports.now();
    catchUpMidnight(now);
    walk = heartbeat(walk, now);
    // Asked every second, so nothing new about the person's health has to
    // wait for the screen to notice before the walk stops.
    if (walk.status === 'running' && !mayRun('live')) holdBack(now);
    persist();
    emit();
    scheduleTick();
  }

  function onVisibility(visible: boolean) {
    if (!walk || walk.status === 'finished') return;
    const now = ports.now();
    if (!visible) {
      if (walk.status === 'running') {
        catchUpMidnight(now);
        stopSensors();
        walk = leaveWalk(walk, now, 'hidden');
      }
      // A hidden page loses its wake lock. Count it gone now: iOS can deliver
      // the release only after the page is back, which would otherwise skip
      // the request on return and leave the screen free to sleep.
      wakeToken += 1;
      wake = 'pending';
      persist();
      emit();
      return;
    }
    // Coming back is a transition into recording, so it is gated: a walk
    // already recorded is never its own permission to carry on.
    if (walk.status === 'away' && mayRun('restart') && comeBack(now) === 'running') startSensors(now);
    requestWake();
    persist();
    emit();
    scheduleTick();
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },

    getSnapshot: () => snapshot,

    attach(request) {
      if (walk) return 'resumed';
      const now = ports.now();
      const stored = loadWalk(ports.storage);
      let created = false;
      if (stored) {
        // Restored to be read and saved. Whether it may move is a separate
        // question, asked below.
        walk = restoreWalk(stored, now);
      } else if (request && lastStartedId(ports.storage) !== request.id) {
        if (!mayRun('start')) return 'none';
        walk = startWalk(request.id, request.plan, now);
        markStarted(ports.storage, request.id);
        created = true;
      } else {
        return 'none';
      }

      stopVisibility = ports.visibility.subscribe(onVisibility);
      stopClinical = ports.watchClinical?.(reconsider);
      if (walk.status !== 'finished') {
        if (!ports.visibility.visible()) {
          if (walk.status === 'running') walk = leaveWalk(walk, now, 'hidden');
        } else if (created || mayRun('restart')) {
          // A restored walk is never running — `restoreWalk` closes its
          // segment at the moment the screen was last seen — so a refusal
          // below simply leaves it held, with no clock running.
          if (walk.status === 'away') comeBack(now);
          if (walk.status === 'running') startSensors(now);
          requestWake();
        }
      }
      persist();
      emit();
      scheduleTick();
      return created ? 'created' : 'resumed';
    },

    detach() {
      if (!walk) return;
      const now = ports.now();
      catchUpMidnight(now);
      stopSensors();
      cancelTick?.();
      cancelTick = undefined;
      stopVisibility?.();
      stopVisibility = undefined;
      stopClinical?.();
      stopClinical = undefined;
      releaseWake();
      walk = walk.status === 'running' ? leaveWalk(walk, now, 'left') : heartbeat(walk, now);
      persist();
      walk = null;
      notice = null;
      blocked = null;
      draftKept = true;
      gpsDenied = false;
      motionDenied = false;
      emit();
    },

    pause() {
      if (!walk || walk.status !== 'running') return;
      const now = ports.now();
      catchUpMidnight(now);
      stopSensors();
      walk = pauseWalk(walk, now);
      notice = null;
      persist();
      emit();
      scheduleTick();
    },

    resume() {
      if (!walk || (walk.status !== 'paused' && walk.status !== 'away')) return;
      if (!mayRun('restart')) {
        emit();
        return;
      }
      const now = ports.now();
      // From a pause, or back from an absence the app could not record: both
      // open a new segment, and the absence is stamped as the gap it was.
      if (walk.status === 'away') comeBack(now);
      else walk = resumeWalk(walk, now);
      notice = null;
      if (walk.status === 'running') startSensors(now);
      persist();
      emit();
      scheduleTick();
    },

    reconsider,

    finish(endedBy) {
      if (!walk || walk.status === 'finished') return;
      const now = ports.now();
      catchUpMidnight(now);
      stopSensors();
      walk = finishWalk(walk, now, endedBy);
      notice = null;
      releaseWake();
      persist();
      emit();
      scheduleTick();
    },

    addAwayTime() {
      if (!walk || notice?.kind !== 'away') return;
      const { gapIndex, gap } = notice;
      walk = addGapTime(walk, gapIndex);
      notice = { kind: 'added', gap };
      persist();
      emit();
    },

    dismissNotice() {
      if (!notice) return;
      notice = null;
      emit();
    },

    async enableMotion() {
      if (!ports.motion) return;
      // Asked before anything else, while the tap still counts as a gesture.
      const answer = await ports.motion.request();
      if (!walk) return;
      if (answer === 'denied') {
        motionDenied = true;
      } else if (walk.status === 'running') {
        listenForMotion(ports.now());
      }
      emit();
    },
  };
}
