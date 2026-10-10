/**
 * The real platform, as the ports `live.ts` asks for. Each is a thin wrapper
 * that feature-detects and never throws: a missing capability is a port that
 * is absent, and the walk degrades to what is left (D24). Kept free of logic
 * so that everything worth testing is in the pure modules.
 */

import type { Fix } from './gps';
import { createLiveWalk, type GeoError, type GeoPort, type LivePorts, type LiveWalk, type MotionPort, type VisibilityPort, type WakeLockPort } from './live';
import { storeGate, watchClinical } from './gate';
import { createWakeLockPort } from './wakeLock';
import { sessionWalkStorage } from './persist';

type MotionPermission = 'granted' | 'denied';

/** iOS's `DeviceMotionEvent.requestPermission`, which TypeScript's DOM types do not know. */
function motionPermissionApi(): (() => Promise<MotionPermission>) | undefined {
  if (typeof DeviceMotionEvent === 'undefined') return undefined;
  const api = (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<MotionPermission> }).requestPermission;
  return typeof api === 'function' ? api.bind(DeviceMotionEvent) : undefined;
}

/** Whether this browser can share a location at all. Asking is a separate, tapped step. */
export function canLocate(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.geolocation;
}

/** Whether this browser has a motion sensor API at all. Asking is a separate, tapped step. */
export function canSenseMotion(): boolean {
  return typeof DeviceMotionEvent !== 'undefined';
}

/**
 * Ask for motion access. Call it straight from a tap: iOS refuses the request
 * without one (`NotAllowedError`), and forgets the answer on every launch.
 * Browsers with no such permission are simply allowed.
 */
export async function requestMotion(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (typeof DeviceMotionEvent === 'undefined') return 'unsupported';
  const ask = motionPermissionApi();
  if (!ask) return 'granted';
  try {
    return (await ask()) === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

/**
 * Ask for location, which shows the system prompt the first time. Only a
 * refusal counts as no: a fix that does not come quickly still means
 * permission was given.
 */
export function requestLocation(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve('unsupported');
  return new Promise(resolve => {
    try {
      navigator.geolocation.getCurrentPosition(
        () => resolve('granted'),
        error => resolve(error.code === error.PERMISSION_DENIED ? 'denied' : 'granted'),
        { enableHighAccuracy: false, timeout: 15_000, maximumAge: 10 * 60_000 },
      );
    } catch {
      resolve('unsupported');
    }
  });
}

function geolocationPort(): GeoPort | undefined {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return undefined;
  const geo = navigator.geolocation;
  return {
    watch(onFix, onError) {
      let id: number | undefined;
      try {
        id = geo.watchPosition(
          p => onFix({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy, timestamp: p.timestamp } satisfies Fix),
          e => onError((e.code === e.PERMISSION_DENIED ? 'denied' : e.code === e.TIMEOUT ? 'timeout' : 'unavailable') satisfies GeoError),
          // High accuracy is a hint the browser may ignore; maximumAge 0 asks
          // for fresh fixes, and the track refuses stale ones anyway.
          { enableHighAccuracy: true, maximumAge: 0 },
        );
      } catch {
        onError('unavailable');
      }
      return () => {
        if (id !== undefined) geo.clearWatch(id);
      };
    },
  };
}

function motionPort(): MotionPort | undefined {
  if (typeof window === 'undefined' || typeof DeviceMotionEvent === 'undefined') return undefined;
  return {
    needsPermission: motionPermissionApi() !== undefined,
    async request() {
      return (await requestMotion()) === 'granted' ? 'granted' : 'denied';
    },
    listen(onSample) {
      // Each sample's own time, on the wall clock the walk's segments use, so
      // a step can be dated to its day (N03). `timeStamp` counts from the
      // page's time origin, which a sleeping phone can leave behind, so the
      // offset is taken now, as listening starts.
      const offset = Date.now() - performance.now();
      const handler = (e: DeviceMotionEvent) => {
        const a = e.accelerationIncludingGravity;
        if (!a || a.x === null || a.y === null || a.z === null) return;
        onSample(offset + e.timeStamp, a.x, a.y, a.z);
      };
      window.addEventListener('devicemotion', handler);
      return () => window.removeEventListener('devicemotion', handler);
    },
  };
}

function wakeLockPort(): WakeLockPort | undefined {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return undefined;
  return createWakeLockPort(navigator.wakeLock, () => document.visibilityState === 'visible');
}

/**
 * Hidden or shown. `pagehide` counts as hidden: on a reload or a close it is
 * the last moment to close the segment and store it. A page restored from the
 * back-forward cache comes back through `pageshow`.
 */
function visibilityPort(): VisibilityPort {
  const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible';
  return {
    visible,
    subscribe(onChange) {
      const onVisibility = () => onChange(visible());
      const onHide = () => onChange(false);
      const onShow = (e: PageTransitionEvent) => {
        if (e.persisted) onChange(visible());
      };
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('pagehide', onHide);
      window.addEventListener('pageshow', onShow);
      return () => {
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('pagehide', onHide);
        window.removeEventListener('pageshow', onShow);
      };
    },
  };
}

export function browserPorts(): LivePorts {
  return {
    mayRun: storeGate,
    watchClinical,
    now: () => Date.now(),
    later(fn, ms) {
      const id = window.setTimeout(fn, ms);
      return () => window.clearTimeout(id);
    },
    storage: sessionWalkStorage(),
    visibility: visibilityPort(),
    geolocation: geolocationPort(),
    motion: motionPort(),
    wakeLock: wakeLockPort(),
  };
}

let shared: LiveWalk | undefined;

/** The one live walk for this tab, created on first use. */
export function liveWalk(): LiveWalk {
  shared ??= createLiveWalk(browserPorts());
  return shared;
}
