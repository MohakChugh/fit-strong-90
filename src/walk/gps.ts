/**
 * GPS for one segment of a walk: which fixes to trust, how far they say the
 * person walked, and a pace worth showing.
 *
 * Research basis: `docs/research/frontend-only-health-platform.md` §2. iOS
 * reports `coords.speed` as null more often than not, so speed is computed
 * from positions; `coords.accuracy` is the radius of 95% confidence and is the
 * one in-app signal of fix quality. Raw fixes jitter by metres while a person
 * stands still, so summing every fix-to-fix hop would invent distance. Three
 * defences, each simple:
 *
 * 1. **Refuse bad fixes** — poor accuracy, stale or out-of-order timestamps,
 *    and jumps no walker could make.
 * 2. **Smooth** — the position is an accuracy-weighted mean of the last few
 *    seconds of fixes, which shrinks independent jitter by roughly √n.
 * 3. **Count only real movement** — distance grows when the smoothed position
 *    has moved further than the fixes' own uncertainty from where it was last
 *    counted, and never at a speed no walker could reach.
 *
 * A track lives inside one segment. A new segment starts a new track, so
 * distance is never drawn as a straight line across a gap (D18).
 *
 * ponytail: smoothing + distance threshold, not a Kalman filter. Upgrade: a
 * constant-velocity Kalman filter in a local tangent plane if on-device traces
 * show corner-cutting or lag that matters for a walk.
 */

export interface Fix {
  lat: number;
  lon: number;
  /** Metres, 95% confidence (W3C Geolocation §6.6). */
  accuracy: number;
  /** Epoch ms when the position was acquired. */
  timestamp: number;
}

export const GPS = {
  /**
   * Fixes less certain than this are refused. The research puts the useful
   * cut-off at 20–30 m; 25 m keeps the 5–16 m an iPhone usually reports
   * outdoors, and refuses the ~65 m Wi-Fi and cell estimates it falls back
   * to indoors, which would otherwise turn a room into a stroll.
   */
  maxAccuracyM: 25,
  /** Older than this when it arrives, the fix describes the past. */
  maxFixAgeMs: 15_000,
  /** Clock skew tolerated for a fix stamped slightly in the future. */
  futureToleranceMs: 10_000,
  /**
   * 3 m/s is 10.8 km/h: brisk walking and a gentle jog stay inside it, a
   * multipath jump or a bus does not.
   */
  maxSpeedMps: 3,
  /** Fixes averaged into one position. */
  smoothWindowMs: 5_000,
  /** The smallest movement counted, whatever the fixes claim. */
  minMoveM: 5,
  /**
   * Pace is averaged over this much recent walking: the long end of the
   * research's 30–60 s, because at 45 s a noisy fix moved the figure by up to
   * a tenth between two readings, and a walker does not change pace that fast.
   */
  paceWindowMs: 60_000,
  /** And shown only once there is this much of it in the segment. */
  paceMinSpanMs: 30_000,
  /** No usable fix for this long and the signal is gone. */
  lostAfterMs: 20_000,
  /** A cold start can take this long to produce a first fix. */
  firstFixGraceMs: 30_000,
  /**
   * Below this speed (about 42 min/km) the person is standing, not walking
   * slowly, and a pace figure would mean nothing.
   */
  stillSpeedMps: 0.4,
  /**
   * After this many refused jumps that agree with each other, the position
   * really has moved — a bad first fix, or a ride — and tracking starts again
   * from there without counting the distance between.
   */
  reanchorRun: 3,
} as const;

export type FixVerdict = 'accepted' | 'invalid' | 'stale' | 'inaccurate' | 'jump';

/**
 * - `acquiring` — waiting for a first usable fix, within a cold start's time.
 * - `weak` — fixes arrive but none can be trusted.
 * - `lost` — no fixes arrive at all.
 * - `measuring` — usable fixes, but not yet enough walking for a pace.
 * - `still` — usable fixes and no real movement, so no pace.
 * - `ok` — a pace.
 */
export type PaceState = 'acquiring' | 'weak' | 'lost' | 'measuring' | 'still' | 'ok';

export interface PaceReadout {
  state: PaceState;
  /** Seconds per kilometre, only when `state` is `ok`. */
  secPerKm?: number;
}

/**
 * One unbroken stretch of usable signal: when it began and ended (fix times,
 * epoch ms) and how far was counted inside it. Times only — never a position
 * — so a walk can keep its runs without keeping its route.
 *
 * A run's span is exactly the time GPS was measuring, which is what makes a
 * pace from saved records the same pace the walk showed (re-audit F16).
 */
export interface GpsRun {
  start: number;
  end: number;
  distanceM: number;
}

export interface Track {
  /** Offer a fix, with the time it arrived. */
  push(fix: Fix, now: number): FixVerdict;
  readout(now: number): PaceReadout;
  /** Metres walked in this track: the sum of its runs. */
  readonly distanceM: number;
  /** Time covered by usable fixes: the sum of its runs' spans. */
  readonly coveredMs: number;
  /** Usable fixes so far. */
  readonly accepted: number;
  /** Each unbroken stretch of signal, oldest first. Copies. */
  readonly runs: GpsRun[];
}

const EARTH_RADIUS_M = 6_371_008.8;
const rad = (degrees: number) => (degrees * Math.PI) / 180;

/** Keep a longitude difference in −180..180, so the antimeridian is not 40,000 km wide. */
function wrapLon(degrees: number): number {
  return ((((degrees + 180) % 360) + 360) % 360) - 180;
}

/** Great-circle distance in metres (haversine). */
export function metresBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(wrapLon(b.lon - a.lon));
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function isUsableShape(fix: Fix): boolean {
  return (
    Number.isFinite(fix.lat) && Math.abs(fix.lat) <= 90 &&
    Number.isFinite(fix.lon) && Math.abs(fix.lon) <= 180 &&
    Number.isFinite(fix.accuracy) && fix.accuracy >= 0 &&
    Number.isFinite(fix.timestamp)
  );
}

/**
 * Could a walker have got from `a` to `b`? The fixes' own uncertainty is
 * allowed for, so two fixes a second apart are not refused for jitter, while
 * a 60 m hop in a second is.
 */
function plausible(a: Fix, b: Fix): boolean {
  const seconds = Math.max(0, b.timestamp - a.timestamp) / 1000;
  return metresBetween(a, b) - (a.accuracy + b.accuracy) <= GPS.maxSpeedMps * seconds;
}

interface Point {
  lat: number;
  lon: number;
  /** Fix time, epoch ms. */
  t: number;
}

interface Mark {
  /** Fix time, epoch ms. */
  t: number;
  /** Metres walked in this track by then. */
  c: number;
}

/** Accuracy-weighted mean position of a few fixes, and their typical accuracy. */
function smoothed(buffer: Fix[]): { lat: number; lon: number; accuracy: number } {
  const ref = buffer[0];
  let weight = 0;
  let dLat = 0;
  let dLon = 0;
  let accuracy = 0;
  for (const f of buffer) {
    const w = 1 / (f.accuracy * f.accuracy);
    weight += w;
    dLat += w * (f.lat - ref.lat);
    dLon += w * wrapLon(f.lon - ref.lon);
    accuracy += f.accuracy;
  }
  return { lat: ref.lat + dLat / weight, lon: wrapLon(ref.lon + dLon / weight), accuracy: accuracy / buffer.length };
}

/** Metres walked by time `t`, read off the marks with straight lines between them. */
function walkedBy(marks: Mark[], t: number): number {
  if (t <= marks[0].t) return marks[0].c;
  for (let i = 1; i < marks.length; i++) {
    const a = marks[i - 1];
    const b = marks[i];
    if (t <= b.t) return a.c + ((b.c - a.c) * (t - a.t)) / (b.t - a.t);
  }
  return marks[marks.length - 1].c;
}

/** A track for a segment that started at `segmentStart` (epoch ms). */
export function createTrack(segmentStart: number): Track {
  let distance = 0;
  let covered = 0;
  let accepted = 0;
  /** The last fix trusted, and when it arrived. */
  let last: Fix | undefined;
  let lastArrived = 0;
  /** When any well-formed fix last arrived, trusted or not. */
  let heard: number | undefined;
  let buffer: Fix[] = [];
  /** Where distance was last counted from. */
  let anchor: Point | undefined;
  let threshold: number = GPS.minMoveM;
  /** Each time the counted position moved; the pace is read off these. */
  let marks: Mark[] = [];
  /** When this run of tracking began, and how many movements it has counted. */
  let origin = 0;
  let moves = 0;
  let refused: Fix[] = [];
  const runs: GpsRun[] = [];

  /**
   * Begin a new run from this fix: after a first fix, a signal gap, or a jump
   * the fixes agree was real. Nothing between the last run and this one is
   * walked as far as GPS can say, so no distance or time crosses it.
   */
  function startFrom(fix: Fix, now: number) {
    last = fix;
    lastArrived = now;
    accepted += 1;
    buffer = [fix];
    anchor = { lat: fix.lat, lon: fix.lon, t: fix.timestamp };
    threshold = Math.max(GPS.minMoveM, fix.accuracy);
    marks = [{ t: fix.timestamp, c: distance }];
    origin = fix.timestamp;
    moves = 0;
    refused = [];
    // A fix stamped a moment before the segment (clock skew) starts its run
    // at the segment, so a run never reaches back into a gap or a day before.
    const start = Math.max(fix.timestamp, segmentStart);
    runs.push({ start, end: start, distanceM: 0 });
  }

  function refuseJump(fix: Fix, now: number): FixVerdict {
    const previous = refused[refused.length - 1];
    refused = previous && plausible(previous, fix) ? [...refused, fix] : [fix];
    // Several refused fixes that agree with each other mean the position
    // really moved. Start again from there; the distance between is not walked.
    if (refused.length >= GPS.reanchorRun) {
      startFrom(fix, now);
      return 'accepted';
    }
    return 'jump';
  }

  function accept(fix: Fix, now: number): FixVerdict {
    // The first fix starts the first run; every later one has an anchor.
    if (!last || !anchor) {
      startFrom(fix, now);
      return 'accepted';
    }
    const run = runs[runs.length - 1];
    covered += fix.timestamp - last.timestamp;
    run.end = Math.max(run.end, fix.timestamp);
    last = fix;
    lastArrived = now;
    accepted += 1;
    refused = [];

    buffer = [...buffer.filter(f => f.timestamp > fix.timestamp - GPS.smoothWindowMs), fix];
    const p = smoothed(buffer);
    threshold = Math.max(GPS.minMoveM, p.accuracy);

    const moved = metresBetween(anchor, p);
    if (moved < threshold) return 'accepted';

    const seconds = (fix.timestamp - anchor.t) / 1000;
    // Moved, but faster than any walk: follow the position, count nothing.
    if (seconds > 0 && moved / seconds <= GPS.maxSpeedMps) {
      distance += moved;
      run.distanceM += moved;
      moves += 1;
    }
    anchor = { lat: p.lat, lon: p.lon, t: fix.timestamp };
    marks.push({ t: fix.timestamp, c: distance });
    // Keep one mark from before the pace window, to read the walk at its edge.
    const edge = fix.timestamp - GPS.paceWindowMs;
    while (marks.length > 2 && marks[1].t <= edge) marks.shift();
    return 'accepted';
  }

  return {
    push(raw, now) {
      if (!isUsableShape(raw)) return 'invalid';
      // A claimed accuracy of 0 (location overrides and emulators report it)
      // is read as 1 m: no fix is perfect, and the weighting divides by it.
      const fix = raw.accuracy < 1 ? { ...raw, accuracy: 1 } : raw;
      // Cached from before this segment, too old to describe now, or from a
      // clock far ahead of this one.
      if (fix.timestamp < segmentStart - 1000) return 'stale';
      if (now - fix.timestamp > GPS.maxFixAgeMs) return 'stale';
      if (fix.timestamp - now > GPS.futureToleranceMs) return 'stale';
      heard = now;
      if (last && fix.timestamp === last.timestamp) {
        // The same fix delivered again: nothing new, but the signal is alive.
        lastArrived = now;
        return 'stale';
      }
      if (last && fix.timestamp < last.timestamp) return 'stale';
      if (fix.accuracy > GPS.maxAccuracyM) return 'inaccurate';
      // The first fix after a silence longer than the signal takes to count
      // as lost begins a new run. The two ends of a silence say nothing about
      // the route between them, so neither distance nor time crosses it, and
      // a position from before it is no basis for judging this one a jump
      // (re-audit F15, and D18 for the app being away).
      if (last && fix.timestamp - last.timestamp > GPS.lostAfterMs) {
        startFrom(fix, now);
        return 'accepted';
      }
      if (last && !plausible(last, fix)) return refuseJump(fix, now);
      return accept(fix, now);
    },

    readout(now) {
      const hearing = heard !== undefined && now - heard <= GPS.lostAfterMs;
      if (!last) {
        if (now - segmentStart < GPS.firstFixGraceMs) return { state: 'acquiring' };
        return { state: hearing ? 'weak' : 'lost' };
      }
      if (now - lastArrived > GPS.lostAfterMs) return { state: hearing ? 'weak' : 'lost' };

      const first = marks[0];
      const latest = marks[marks.length - 1];
      if (moves < 2 || latest.t - origin < GPS.paceMinSpanMs) return { state: 'measuring' };

      // Nothing counted for longer than a very slow walker would take to cover
      // the threshold: standing, so an old pace would be a lie.
      const stillAfter = Math.max(20_000, (threshold / GPS.stillSpeedMps) * 1000);
      if (last.timestamp - latest.t > stillAfter) return { state: 'still' };

      // Pace over the window ending at the last counted movement, so it does
      // not sag between two counts.
      const from = Math.max(first.t, latest.t - GPS.paceWindowMs);
      const speed = (latest.c - walkedBy(marks, from)) / ((latest.t - from) / 1000);
      if (!(speed >= GPS.stillSpeedMps)) return { state: 'still' };
      return { state: 'ok', secPerKm: 1000 / speed };
    },

    get distanceM() {
      return distance;
    },
    get coveredMs() {
      return covered;
    },
    get accepted() {
      return accepted;
    },
    get runs() {
      return runs.map(r => ({ ...r }));
    },
  };
}
