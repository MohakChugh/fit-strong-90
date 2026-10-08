/**
 * The number on the app's Home Screen icon (Badging API).
 *
 * iOS shows it for Home Screen web apps from 16.4, and only while code runs to
 * set it, so it is a passive nudge: the count of reminders shown and not yet
 * answered. Two traps, both handled here:
 *
 * - `setAppBadge(0)` clears the badge, and `setAppBadge()` with no argument
 *   draws a dot. The app never wants a dot, so a count of zero always goes
 *   through `clearAppBadge`.
 * - Outside an installed app the methods are missing, or reject. A badge is
 *   decoration; failing to draw one must never surface as an error.
 */

export interface BadgeHost {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
}

function quietly(run: () => Promise<void> | undefined): void {
  try {
    run()?.catch(() => {});
  } catch {
    // Thrown synchronously, e.g. outside a secure context. Nothing to show.
  }
}

/** Show `count` on the icon, or clear it at zero. Feature-detected; never throws. */
export function showBadge(count: number, host: BadgeHost | undefined = globalThis.navigator as BadgeHost | undefined): void {
  if (!host) return;
  const n = Number.isFinite(count) ? Math.floor(count) : 0;
  if (n > 0) {
    if (typeof host.setAppBadge === 'function') quietly(() => host.setAppBadge?.(n));
    return;
  }
  if (typeof host.clearAppBadge === 'function') quietly(() => host.clearAppBadge?.());
}
