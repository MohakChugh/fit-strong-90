/**
 * Where an Undo belongs (B-04, board D113): the screen it was offered on —
 * Today's log is one screen, whichever day it shows — and the record details
 * opened from that screen, or from one of those. Where a screen was opened
 * from is its router state's origin (`useOrigin`), or the screen below it on
 * the navigation stack where a link carries none. Pure, so the rule is
 * tested without a router.
 */
export interface Place {
  /** The route on screen now, with or without its query. */
  path: string;
  /** Where this screen was opened from. */
  from?: string;
}

export interface Scope {
  /** The screen the Undo was offered on. */
  root: string;
  /** The record details opened within it so far. */
  inside: readonly string[];
}

/** The app's record screens (`recordPath`) and Log a meal: the screens that can be a record's detail at all. */
const RECORD_SCREENS = ['/track/reading/', '/track/pressure/', '/track/walk/', '/track/session/', '/track/workout/', '/track/check-in/'];
const MEAL_SCREEN = '/hub/food/log';

/** A route's path, without its query or hash. */
export const pathOf = (route: string): string => route.split(/[?#]/)[0] || '/';

export const isDetail = (route: string): boolean => {
  const path = pathOf(route);
  return path === MEAL_SCREEN || RECORD_SCREENS.some(r => path.startsWith(r) && path.length > r.length);
};

const sameScreen = (a: string, b: string) => a === b || (a.startsWith('/day/') && b.startsWith('/day/'));

export const scopeOf = (root: string): Scope => ({ root: pathOf(root), inside: [] });

/** The scope after a navigation, or undefined when the place is outside it, and the Undo ends. */
export function follow(scope: Scope, place: Place): Scope | undefined {
  const path = pathOf(place.path);
  if (sameScreen(path, scope.root) || scope.inside.includes(path)) return scope;
  const from = place.from === undefined ? undefined : pathOf(place.from);
  const opened = from !== undefined && (sameScreen(from, scope.root) || scope.inside.includes(from));
  return opened && isDetail(path) ? { ...scope, inside: [...scope.inside, path] } : undefined;
}
