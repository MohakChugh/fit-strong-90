import { beforeEach, describe, expect, it } from 'vitest';
import {
  backLabelFit, backPending, backTarget, cameFrom, currentTab, followRouter, forgetPlaces, getNavState, isChunkLoadError, markBack,
  markInPlace, markShown, markTab, originOf, record, resetNavigationForTests, rootLink, rootStep, scrollKeyOf, setPlaceCheck, setTitle,
  tabLink, tabOf, takeFocusRequest, type NavState,
} from './navigation';

/**
 * The navigation stack, driven the way the router drives it: one `record`
 * per committed location, with React Router's history index, and the titles
 * the screens show. Scan findings S-02, S-09–S-12, S-18 and S-24.
 */

let key = 0;
const at = (path: string, state: unknown = null) => {
  const [pathname, search = ''] = path.split('?');
  return { pathname, search: search ? `?${search}` : '', state, key: `k${++key}` };
};
let index = -1;
/** A push from the screen on show, as a tap on a row does. */
const push = (path: string, state?: unknown) => record(at(path, state), 'PUSH', ++index);
const replace = (path: string, state?: unknown) => record(at(path, state), 'REPLACE', index);
const pop = (to: number) => { index = to; return record(at(currentPathAt(to)), 'POP', to); };
let stack: NavState;
const currentPathAt = (i: number) => {
  const e = stack.entries[i]!;
  return `${e.pathname}${e.search}`;
};
/** A screen showing its title, as `Screen` does once it is on screen. */
const shows = (path: string, title: string) => { setTitle(path.split('?')[0], title); };
const launch = (path: string) => { index = 0; return record(at(path), 'LAUNCH', 0); };
const go = (fn: () => NavState) => { stack = fn(); return stack; };
const back = (parent: { to: string; label: string }, locationState: unknown = null) => backTarget(stack, parent, locationState);
/** The stack as it is now, after a change made outside `go`. */
const nav = getNavState;

beforeEach(() => {
  resetNavigationForTests();
  index = -1;
});

describe('Back pops exactly one entry (S-09)', () => {
  it('pops twice in a row, the second time to Browse, never replacing it with a duplicate', () => {
    go(() => launch('/home')); shows('/home', 'Home');
    markTab('browse'); go(() => push('/browse')); shows('/browse', 'Browse');
    go(() => push('/hub/learn/topic/food-diabetes')); shows('/hub/learn/topic/food-diabetes', 'Food & diabetes');
    go(() => push('/hub/learn/card/card-dal'));
    expect(back({ to: '/hub/learn/topic/food-diabetes', label: 'Food & diabetes' })).toEqual({ pop: true, label: 'Food & diabetes' });
    go(() => pop(2));
    // The old single "previous path" was the card here, so this Back replaced the topic with /browse.
    expect(back({ to: '/browse', label: 'Browse' })).toEqual({ pop: true, label: 'Browse' });
    go(() => pop(1));
    expect(stack.index).toBe(1);
    expect(cameFrom()).toBe('/home');
  });

  it('replaces this entry with the parent only when nothing of this tab is below it', () => {
    go(() => launch('/hub/learn/card/card-dal'));
    expect(back({ to: '/hub/learn/topic/food-diabetes', label: 'Food & diabetes' }))
      .toEqual({ pop: false, to: '/hub/learn/topic/food-diabetes', label: 'Food & diabetes' });
  });

  it('keeps the stack across a reload, from session storage, as history itself is kept', () => {
    const store = new Map<string, string>();
    globalThis.sessionStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v), removeItem: k => void store.delete(k), clear: () => store.clear(), key: () => null, length: 0 } as Storage;
    try {
      go(() => launch('/home')); shows('/home', 'Home');
      go(() => push('/hub/workout/plan', { path: '/home', label: 'Home' }));
      const saved = JSON.parse(store.get('fit-strong-90-navigation')!);
      expect(saved.entries.map((e: { pathname: string } | null) => e?.pathname)).toEqual(['/home', '/hub/workout/plan']);
      expect(saved.entries[0].title).toBe('Home');
    } finally {
      delete (globalThis as { sessionStorage?: Storage }).sessionStorage;
    }
  });
});

describe('a screen opened from another tab stays in that tab and returns to it (S-10)', () => {
  it('pops back to Home from the glucose trend, named Home, with Home still the selected tab', () => {
    go(() => launch('/home')); shows('/home', 'Home');
    go(() => push('/trends/glucose', { path: '/home', label: 'Home' }));
    expect(currentTab(stack, '/trends/glucose')).toBe('home');
    expect(back({ to: '/home', label: 'Home' })).toEqual({ pop: true, label: 'Home' });
    // Without Home's origin, the screen's own parent (Trends) would have been the target.
    expect(back({ to: '/trends', label: 'Trends' })).toEqual({ pop: true, label: 'Home' });
  });

  it('pops to Home from the plan opened by the chooser, a row that names no origin', () => {
    go(() => launch('/home')); shows('/home', 'Home');
    go(() => push('/hub/workout/plan'));
    expect(back({ to: '/hub/workout', label: 'Workout' })).toEqual({ pop: true, label: 'Home' });
  });

  it('with nothing to pop to, goes to the opener the navigation state names, not the parent', () => {
    go(() => launch('/hub/workout/plan'));
    expect(back({ to: '/hub/workout', label: 'Workout' }, { path: '/home', label: 'Home' })).toEqual({ pop: false, to: '/home', label: 'Home' });
    expect(originOf({ path: '/hub/glucose', label: 'Glucose', search: '?group=all' })).toEqual({ path: '/hub/glucose', label: 'Glucose', search: '?group=all' });
    expect(originOf({ from: 'search' })).toBeUndefined();
  });
});

describe('a related link goes Back to the screen that opened it (S-11)', () => {
  it('returns from a related card to the card, not to the related card’s own topic', () => {
    go(() => launch('/hub/learn')); shows('/hub/learn', 'Learn');
    go(() => push('/hub/learn/topic/food-diabetes')); shows('/hub/learn/topic/food-diabetes', 'Food & diabetes');
    go(() => push('/hub/learn/card/card-dal')); shows('/hub/learn/card/card-dal', 'Dal, chana and rajma');
    const opener = { path: '/hub/learn/card/card-dal', label: 'Dal, chana and rajma' };
    go(() => push('/hub/learn/card/card-b12-food', opener));
    expect(back({ to: '/hub/learn/topic/b12', label: 'Vitamin B12' }, opener)).toEqual({ pop: true, label: 'Dal, chana and rajma' });
  });

  it('returns from an easier exercise to the exercise, not to the list', () => {
    go(() => launch('/hub/workout/exercises')); shows('/hub/workout/exercises', 'Find an exercise');
    go(() => push('/hub/workout/exercises/goblet-squat', { from: '/hub/workout/exercises' })); shows('/hub/workout/exercises/goblet-squat', 'Goblet Squat');
    const state = { from: '/hub/workout/exercises', path: '/hub/workout/exercises/goblet-squat', label: 'Goblet Squat' };
    go(() => push('/hub/workout/exercises/goblet-box-squat', state));
    expect(back({ to: '/hub/workout/exercises', label: 'Exercises' }, state)).toEqual({ pop: true, label: 'Goblet Squat' });
  });

  it('keeps the name a screen gives its own parent when Back pops to that parent', () => {
    go(() => launch('/hub/workout/exercises?q=cat')); shows('/hub/workout/exercises', 'Find an exercise');
    go(() => push('/hub/workout/exercises/cat-cow', { from: '/hub/workout/exercises?q=cat' }));
    expect(back({ to: '/hub/workout/exercises?q=cat', label: 'Exercises' })).toEqual({ pop: true, label: 'Exercises' });
  });
});

describe('Back is named after the real parent, never "Back to Back" (S-12)', () => {
  it('fits the name as iOS does: the whole name, then "Back", then the chevron alone', () => {
    expect(backLabelFit(130, 124, 38)).toBe('full');
    expect(backLabelFit(100, 124, 38)).toBe('short');
    expect(backLabelFit(30, 124, 38)).toBe('none');
  });

  it('falls back to "Back" only for an opener that showed no title', () => {
    go(() => launch('/session'));
    go(() => push('/me/profile'));
    expect(back({ to: '/me', label: 'Me' })).toEqual({ pop: true, label: 'Back' });
  });
});

describe('focus after a navigation (S-02)', () => {
  it('asks the new screen to take focus on the first navigation after launch, not during it', () => {
    launch('/');
    record(at('/home'), 'REPLACE', 0); // the launch redirect
    expect(takeFocusRequest('/home')).toBe(false);
    markShown(); // Home is on screen
    index = 0;
    push('/hub/workout/plan');
    // The screen decides from the navigation itself, whatever order effects run in.
    expect(takeFocusRequest('/hub/workout/plan')).toBe(true);
    expect(takeFocusRequest('/hub/workout/plan')).toBe(false);
  });

  it('leaves no request behind for a screen that is not the one navigated to', () => {
    launch('/home');
    markShown();
    push('/browse');
    expect(takeFocusRequest('/home')).toBe(false);
    expect(takeFocusRequest('/browse')).toBe(true);
  });

  it('does not ask for focus when only the query changes, as typing a search does', () => {
    launch('/browse');
    markShown();
    replace('/browse?q=dal');
    expect(takeFocusRequest('/browse')).toBe(false);
  });

  it('does not ask for focus when a screen pages its own address, as Today’s log does from day to day', () => {
    launch('/day/today');
    markShown();
    markInPlace();
    replace('/day/2026-10-09');
    expect(takeFocusRequest('/day/2026-10-09')).toBe(false);
    // The next navigation to another screen asks again.
    push('/track/reading/r1');
    expect(takeFocusRequest('/track/reading/r1')).toBe(true);
  });
});

describe('each tab keeps its place (S-18)', () => {
  it('links a tab back to where it was left, with that place’s scroll position', () => {
    go(() => launch('/home'));
    markTab('browse'); go(() => push('/browse?q=dal'));
    go(() => push('/hub/learn/card/card-dal', { from: 'search' })); shows('/hub/learn/card/card-dal', 'Dal, chana and rajma');
    const card = stack.entries[2]!;
    markTab('home'); go(() => push('/home'));
    expect(tabLink(stack, 'browse')).toEqual({ to: '/hub/learn/card/card-dal', state: { from: 'search', restoreScroll: card.scrollKey } });
    // The place borrows its scroll key, so ScrollRestoration puts it back where it was.
    markTab('browse'); go(() => push('/hub/learn/card/card-dal', tabLink(stack, 'browse').state));
    expect(scrollKeyOf({ key: 'new', state: stack.entries[stack.index]!.state })).toBe(card.scrollKey);
    expect(currentTab(stack, '/hub/learn/card/card-dal')).toBe('browse');
  });

  it('never returns a tab to a full-screen task or to another tab’s screen', () => {
    go(() => launch('/home'));
    go(() => push('/session'));
    go(() => push('/me')); shows('/me', 'Me');
    expect(tabLink(nav(), 'home')).toEqual({ to: '/home', state: { restoreScroll: stack.entries[0]!.scrollKey } });
  });

  it('the walk summary is a task: no tab returns to it by itself', () => {
    go(() => launch('/home')); shows('/home', 'Home');
    go(() => push('/hub/walk')); shows('/hub/walk', 'Walk');
    go(() => push('/walk/summary')); shows('/walk/summary', 'Your walk');
    markTab('trends'); go(() => push('/trends'));
    expect(tabLink(stack, 'home').to).not.toBe('/walk/summary');
    expect(tabLink(stack, 'home').to).toBe('/hub/walk');
  });

  it('pops to the root on a tap of the selected tab: back through its entries, or by replacing', () => {
    go(() => launch('/browse')); shows('/browse', 'Browse');
    go(() => push('/hub/learn/topic/food-diabetes'));
    go(() => push('/hub/learn/card/card-dal'));
    expect(rootStep(stack, 'browse')).toBe(-2);
    markTab('home'); go(() => push('/home'));
    markTab('browse'); go(() => push('/hub/learn/card/card-dal'));
    // Home's entry is in the way: replace instead, with the root as it was left.
    expect(rootStep(stack, 'browse')).toBe('replace');
    expect(rootLink(stack, 'browse').to).toBe('/browse');
  });

  it('scrolls to the top when the selected tab is already at its root', () => {
    go(() => launch('/home'));
    expect(rootStep(stack, 'home')).toBe('top');
  });

  it('keeps the root’s own search when popping back to it after a tab switch', () => {
    go(() => launch('/browse?q=dal'));
    go(() => push('/hub/learn/card/card-dal', { from: 'search' }));
    markTab('home'); go(() => push('/home'));
    markTab('browse'); go(() => push('/hub/learn/card/card-dal', { from: 'search' }));
    expect(rootLink(stack, 'browse').to).toBe('/browse?q=dal');
    expect(back({ to: '/browse', label: 'Browse' })).toMatchObject({ pop: false, to: '/browse?q=dal', label: 'Browse' });
  });

  it('sends a tab to its root when its place no longer leads anywhere: a record gone, or a screen never shown', () => {
    go(() => launch('/trends'));
    go(() => push('/track/workout/w1')); shows('/track/workout/w1', 'Workout');
    markTab('home'); go(() => push('/home'));
    expect(tabLink(stack, 'trends').to).toBe('/track/workout/w1');
    setPlaceCheck(place => place.pathname !== '/track/workout/w1');
    expect(tabLink(stack, 'trends').to).toBe('/trends');
    setPlaceCheck(() => true);
    // An address that only redirected never showed its screen, so it is no place to return to.
    markTab('browse'); go(() => push('/hub/learn/topic/nope'));
    markTab('home'); go(() => push('/home'));
    expect(tabLink(stack, 'browse').to).toBe('/browse');
  });

  it('does not return a tab to a hub place whose screen never showed, or that no longer leads anywhere (J18)', () => {
    go(() => launch('/trends')); shows('/trends', 'Trends');
    // Home's place is a hub that redirected before it showed.
    markTab('home'); go(() => push('/hub/glucose'));
    markTab('trends'); go(() => push('/trends'));
    expect(tabLink(stack, 'home').to).toBe('/home');
    // Shown this time, then its place check fails, as after a delete.
    markTab('home'); go(() => push('/hub/glucose')); shows('/hub/glucose', 'Glucose');
    markTab('trends'); go(() => push('/trends'));
    expect(tabLink(stack, 'home').to).toBe('/hub/glucose');
    setPlaceCheck(place => place.pathname !== '/hub/glucose');
    expect(tabLink(stack, 'home').to).toBe('/home');
  });

  it('keeps each root its own when typed addresses share the default scroll key (J20)', () => {
    // Addresses the router did not create all carry the key "default".
    const typed = (path: string) => { index += 1; return record({ ...at(path), key: 'default' }, 'POP', index); };
    go(() => typed('/home')); shows('/home', 'Home');
    go(() => typed('/hub/walk')); shows('/hub/walk', 'Walk');
    go(() => typed('/me')); shows('/me', 'Me');
    go(() => typed('/me/data')); shows('/me/data', 'Data & offline');
    expect(nav().roots.home?.pathname ?? '/home').toBe('/home');
    expect(nav().roots.me?.pathname ?? '/me').toBe('/me');
  });

  it('forgets every tab’s place, and each root’s, when the record is cleared (J18)', () => {
    go(() => launch('/trends?period=month')); shows('/trends', 'Trends');
    go(() => push('/track/workout/w1')); shows('/track/workout/w1', 'Workout');
    markTab('home'); go(() => push('/home'));
    forgetPlaces();
    expect(tabLink(nav(), 'trends')).toEqual({ to: '/trends' });
    expect(rootLink(nav(), 'trends')).toEqual({ to: '/trends' });
  });

  it('does not keep places a different build saved, which may name screens this one lacks', () => {
    const store = new Map<string, string>([['fit-strong-90-navigation', JSON.stringify({
      build: '/fit-strong-90/assets/index-OLD.js',
      entries: [{ pathname: '/home', search: '', state: null, scrollKey: 'a', tab: 'home', title: 'Home' }],
      places: { browse: { pathname: '/hub/learn/gone', search: '', state: null, scrollKey: 'b', tab: 'browse', title: 'Gone' } },
      roots: {},
    })]]);
    Object.assign(globalThis, {
      sessionStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) },
      window: { history: { state: { idx: 0 } } },
    });
    try {
      followRouter({ state: { location: at('/home'), historyAction: 'POP' }, subscribe: () => () => {} });
      expect(tabLink(nav(), 'browse')).toEqual({ to: '/browse' });
      // The stack itself is kept: Back still knows what is below.
      expect(nav().entries[0]?.title).toBe('Home');
    } finally {
      delete (globalThis as { sessionStorage?: Storage }).sessionStorage;
      delete (globalThis as { window?: unknown }).window;
    }
  });

  it('gives each address its own tab, Home covering hubs, the day and records, and a task none', () => {
    expect(tabOf('/hub/walk')).toBe('home');
    expect(tabOf('/track/reading/r1')).toBe('home');
    expect(tabOf('/trends/glucose')).toBe('trends');
    expect(tabOf('/walk/summary')).toBeUndefined();
  });

  it('a hub belongs to Home by its address', () => {
    expect(tabOf('/hub/walk')).toBe('home');
    expect(tabOf('/day/2026-10-08')).toBe('home');
    expect(tabOf('/me/data')).toBe('me');
  });

  it('a record opened from Trends stays in Trends (pushed in its opener’s tab)', () => {
    go(() => launch('/trends')); shows('/trends', 'Trends');
    go(() => push('/track/reading/x'));
    expect(stack.entries[stack.index]?.tab).toBe('trends');
    expect(currentTab(stack, '/track/reading/x')).toBe('trends');
  });
});

describe('which way a move goes (S-24)', () => {
  it('marks a push forward, a pop back, a Back that replaces back, and a tab tap as a tab', () => {
    go(() => launch('/browse'));
    expect(go(() => push('/hub/learn/topic/b12')).direction).toBe('forward');
    expect(go(() => pop(0)).direction).toBe('back');
    expect(go(() => pop(1)).direction).toBe('forward');
    markBack();
    expect(backPending()).toBe(true);
    expect(go(() => replace('/browse')).direction).toBe('back');
    expect(backPending()).toBe(false);
    markTab('home');
    expect(go(() => push('/home')).direction).toBe('tab');
  });

  it('forgets a Back that no navigation followed', () => {
    markBack(1_000);
    expect(backPending(1_000 + 5_000)).toBe(false);
  });
});

describe('a screen whose code did not download (S-13)', () => {
  it('is told apart from a screen that broke while drawing, in each engine’s words', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/routes-a.js'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module: https://x/a.js'))).toBe(true);
    expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/a.css'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Cannot read properties of undefined'))).toBe(false);
  });
});
