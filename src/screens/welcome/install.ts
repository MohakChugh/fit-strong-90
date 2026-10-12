/**
 * Where the app is running, as far as installing it goes (D16).
 *
 * On iPhone and iPad it matters twice over. In Safari a website's data can be
 * cleared after seven days of browsing without a visit; a Home Screen app is
 * not part of Safari and keeps its own (platform research §9). And the two do
 * not share data: what is entered in Safari stays in Safari, and the Home
 * Screen app starts empty (WebKit: a web app is given no other website data
 * when it is created). So an iPhone user in Safari is shown how to install
 * *before* they answer anything, or their answers would stay behind.
 */

export type InstallContext =
  /** Opened from the Home Screen (or installed on a computer). */
  | 'installed'
  /** Safari, or another browser, on an iPhone or iPad. */
  | 'iosBrowser'
  | 'android'
  | 'desktop';

export interface InstallEnv {
  /** Running as an installed app rather than a browser tab. */
  standalone: boolean;
  userAgent: string;
  maxTouchPoints: number;
}

/** iPadOS asks for desktop sites and says "Macintosh"; a Mac has no touch screen. */
function isIos(env: InstallEnv): boolean {
  return /iPhone|iPad|iPod/.test(env.userAgent) || (/Macintosh/.test(env.userAgent) && env.maxTouchPoints > 1);
}

export function installContext(env: InstallEnv): InstallContext {
  if (env.standalone) return 'installed';
  if (isIos(env)) return 'iosBrowser';
  if (/Android/.test(env.userAgent)) return 'android';
  return 'desktop';
}

/** What to call the device in copy: "Keep it on this iPhone". */
export function deviceNoun(env: InstallEnv): 'iPhone' | 'iPad' | 'device' {
  if (/iPhone|iPod/.test(env.userAgent)) return 'iPhone';
  if (isIos(env)) return 'iPad';
  return 'device';
}

/** The live values, read from the browser. */
export function readInstallEnv(win: Window = window): InstallEnv {
  const query = '(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)';
  const standalone = (typeof win.matchMedia === 'function' && win.matchMedia(query).matches)
    // Safari's own flag for a Home Screen app, older than display-mode support.
    || (win.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return { standalone, userAgent: win.navigator.userAgent, maxTouchPoints: win.navigator.maxTouchPoints ?? 0 };
}
