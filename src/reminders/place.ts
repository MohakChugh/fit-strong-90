/**
 * Where a waiting reminder shows (coordinator decision, after the R03 round):
 * never over navigation. Just above the tab bar on every screen that has one,
 * above the bottom safe area on any that does not. Not on Today, which shows
 * the waiting reminder in its own place; and not during a session or a live
 * walk, where a prompt to stand or walk is noise.
 */

/** Full-screen tasks: a reminder that comes due there is not shown. */
const FOCUSED = ['/session', '/walk/live'];
/** The screens inside the app shell, which all have the tab bar. */
const WITH_TAB_BAR = ['/today', '/move', '/walk', '/track', '/guide', '/you'];

/** How long the banner stays when nobody is using it. The reminder stays waiting after. */
export const AUTO_HIDE_MS = 8000;

const under = (pathname: string, root: string) => pathname === root || pathname.startsWith(`${root}/`);

/** A reminder that comes due here is skipped, not saved for later: a session or a live walk. */
export function skipsReminders(pathname: string): boolean {
  return FOCUSED.some(root => under(pathname, root));
}

export function bannerPlace(pathname: string): 'aboveTabBar' | 'aboveSafeArea' | 'hidden' {
  if (skipsReminders(pathname) || under(pathname, '/today')) return 'hidden';
  return WITH_TAB_BAR.some(root => under(pathname, root)) ? 'aboveTabBar' : 'aboveSafeArea';
}
