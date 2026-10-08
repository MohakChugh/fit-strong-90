import { beforeEach, describe, expect, it } from 'vitest';
import {
  backLabelFit, backPending, backTarget, cameFrom, currentTab, followRouter, forgetPlaces, getNavState, isChunkLoadError, markBack,
  markShown, markTab, originOf, record, resetNavigationForTests, rootLink, rootStep, scrollKeyOf, setPlaceCheck, setTitle,
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
  it('pops twice in a row, the second time to Guide, never replacing it with a duplicate', () => {
    go(() => launch('/today')); shows('/today', 'Today');
    markTab('guide'); go(() => push('/guide')); shows('/guide', 'Guide');
    go(() => push('/guide/topic/food-diabetes')); shows('/guide/topic/food-diabetes', 'Food & diabetes');
    go(() => push('/guide/card/card-dal'));
    expect(back({ to: '/guide/topic/food-diabetes', label: 'Food & diabetes' })).toEqual({ pop: true, label: 'Food & diabetes' });
    go(() => pop(2));
    // The old single "previous path" was the card here, so this Back replaced the topic with /guide.
    expect(back({ to: '/guide', label: 'Guide' })).toEqual({ pop: true, label: 'Guide' });
    go(() => pop(1));
    expect(stack.index).toBe(1);
    expect(cameFrom()).toBe('/today');
  });

  it('replaces this entry with the parent only when nothing of this tab is below it', () => {
    go(() => launch('/guide/card/card-dal'));
    expect(back({ to: '/guide/topic/food-diabetes', label: 'Food & diabetes' }))
      .toEqual({ pop: false, to: '/guide/topic/food-diabetes', label: 'Food & diabetes' });
  });

  it('keeps the stack across a reload, from session storage, as history itself is kept', () => {
    const store = new Map<string, string>();
    globalThis.sessionStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v), removeItem: k => void store.delete(k), clear: () => store.clear(), key: () => null, length: 0 } as Storage;
    try {
      go(() => launch('/today')); shows('/today', 'Today');
      go(() => push('/move/plan', { path: '/today', label: 'Today' }));
      const saved = JSON.parse(store.get('fit-strong-90-navigation')!);
      expect(saved.entries.map((e: { pathname: string } | null) => e?.pathname)).toEqual(['/today', '/move/plan']);
      expect(saved.entries[0].title).toBe('Today');
    } finally {
      delete (globalThis as { sessionStorage?: Storage }).sessionStorage;
    }
  });
});

describe('a screen opened from another tab stays in that tab and returns to it (S-10)', () => {
  it('pops back to Today from Glucose, named Today, with Today still the selected tab', () => {
    go(() => launch('/today')); shows('/today', 'Today');
    go(() => push('/track/metric/glucose', { path: '/today', label: 'Today' }));
    expect(currentTab(stack, '/track/metric/glucose')).toBe('today');
    expect(back({ to: '/today', label: 'Today' })).toEqual({ pop: true, label: 'Today' });
    // Without Today's origin, the screen's own parent (My Day) would have been the target.
    expect(back({ to: '/track', label: 'My Day' })).toEqual({ pop: true, label: 'Today' });
  });

  it('pops to Today from the plan opened by the chooser, a row that names no origin', () => {
    go(() => launch('/today')); shows('/today', 'Today');
    go(() => push('/move/plan'));
    expect(back({ to: '/move', label: 'Move' })).toEqual({ pop: true, label: 'Today' });
  });

  it('with nothing to pop to, goes to the opener the navigation state names, not the parent', () => {
    go(() => launch('/move/plan'));
    expect(back({ to: '/move', label: 'Move' }, { path: '/today', label: 'Today' })).toEqual({ pop: false, to: '/today', label: 'Today' });
    expect(originOf({ path: '/track', label: 'My Day', search: '?day=2026-10-01' })).toEqual({ path: '/track', label: 'My Day', search: '?day=2026-10-01' });
    expect(originOf({ from: 'search' })).toBeUndefined();
  });
});

describe('a related link goes Back to the screen that opened it (S-11)', () => {
  it('returns from a related card to the card, not to the related card’s own topic', () => {
    go(() => launch('/guide')); shows('/guide', 'Guide');
    go(() => push('/guide/topic/food-diabetes')); shows('/guide/topic/food-diabetes', 'Food & diabetes');
    go(() => push('/guide/card/card-dal')); shows('/guide/card/card-dal', 'Dal, chana and rajma');
    const opener = { path: '/guide/card/card-dal', label: 'Dal, chana and rajma' };
    go(() => push('/guide/card/card-b12-food', opener));
    expect(back({ to: '/guide/topic/b12', label: 'Vitamin B12' }, opener)).toEqual({ pop: true, label: 'Dal, chana and rajma' });
  });

  it('returns from an easier exercise to the exercise, not to the list', () => {
    go(() => launch('/move/exercises')); shows('/move/exercises', 'Find an exercise');
    go(() => push('/move/exercises/goblet-squat', { from: '/move/exercises' })); shows('/move/exercises/goblet-squat', 'Goblet Squat');
    const state = { from: '/move/exercises', path: '/move/exercises/goblet-squat', label: 'Goblet Squat' };
    go(() => push('/move/exercises/goblet-box-squat', state));
    expect(back({ to: '/move/exercises', label: 'Exercises' }, state)).toEqual({ pop: true, label: 'Goblet Squat' });
  });

  it('keeps the name a screen gives its own parent when Back pops to that parent', () => {
    go(() => launch('/move/exercises?q=cat')); shows('/move/exercises', 'Find an exercise');
    go(() => push('/move/exercises/cat-cow', { from: '/move/exercises?q=cat' }));
    expect(back({ to: '/move/exercises?q=cat', label: 'Exercises' })).toEqual({ pop: true, label: 'Exercises' });
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
    go(() => push('/you/profile'));
    expect(back({ to: '/you', label: 'You' })).toEqual({ pop: true, label: 'Back' });
  });
});

describe('focus after a navigation (S-02)', () => {
  it('asks the new screen to take focus on the first navigation after launch, not during it', () => {
    launch('/');
    record(at('/today'), 'REPLACE', 0); // the launch redirect
    expect(takeFocusRequest('/today')).toBe(false);
    markShown(); // Today is on screen
    index = 0;
    push('/move/plan');
    // The screen decides from the navigation itself, whatever order effects run in.
    expect(takeFocusRequest('/move/plan')).toBe(true);
    expect(takeFocusRequest('/move/plan')).toBe(false);
  });

  it('leaves no request behind for a screen that is not the one navigated to', () => {
    launch('/today');
    markShown();
    push('/guide');
    expect(takeFocusRequest('/today')).toBe(false);
    expect(takeFocusRequest('/guide')).toBe(true);
  });

  it('does not ask for focus when only the query changes, as typing a search does', () => {
    launch('/guide');
    markShown();
    replace('/guide?q=dal');
    expect(takeFocusRequest('/guide')).toBe(false);
  });
});

describe('each tab keeps its place (S-18)', () => {
  it('links a tab back to where it was left, with that place’s scroll position', () => {
    go(() => launch('/today'));
    markTab('guide'); go(() => push('/guide?q=dal'));
    go(() => push('/guide/card/card-dal', { from: 'search' })); shows('/guide/card/card-dal', 'Dal, chana and rajma');
    const card = stack.entries[2]!;
    markTab('today'); go(() => push('/today'));
    expect(tabLink(stack, 'guide')).toEqual({ to: '/guide/card/card-dal', state: { from: 'search', restoreScroll: card.scrollKey } });
    // The place borrows its scroll key, so ScrollRestoration puts it back where it was.
    markTab('guide'); go(() => push('/guide/card/card-dal', tabLink(stack, 'guide').state));
    expect(scrollKeyOf({ key: 'new', state: stack.entries[stack.index]!.state })).toBe(card.scrollKey);
    expect(currentTab(stack, '/guide/card/card-dal')).toBe('guide');
  });

  it('never returns a tab to a full-screen task or to You', () => {
    go(() => launch('/today'));
    go(() => push('/session'));
    go(() => push('/you')); shows('/you', 'You');
    expect(tabLink(nav(), 'today')).toEqual({ to: '/today', state: { restoreScroll: stack.entries[0]!.scrollKey } });
  });

  it('pops to the root on a tap of the selected tab: back through its entries, or by replacing', () => {
    go(() => launch('/guide')); shows('/guide', 'Guide');
    go(() => push('/guide/topic/food-diabetes'));
    go(() => push('/guide/card/card-dal'));
    expect(rootStep(stack, 'guide')).toBe(-2);
    markTab('today'); go(() => push('/today'));
    markTab('guide'); go(() => push('/guide/card/card-dal'));
    // Today's entry is in the way: replace instead, with the root as it was left.
    expect(rootStep(stack, 'guide')).toBe('replace');
    expect(rootLink(stack, 'guide').to).toBe('/guide');
  });

  it('scrolls to the top when the selected tab is already at its root', () => {
    go(() => launch('/today'));
    expect(rootStep(stack, 'today')).toBe('top');
  });

  it('keeps the root’s own search when popping back to it after a tab switch', () => {
    go(() => launch('/guide?q=dal'));
    go(() => push('/guide/card/card-dal', { from: 'search' }));
    markTab('today'); go(() => push('/today'));
    markTab('guide'); go(() => push('/guide/card/card-dal', { from: 'search' }));
    expect(rootLink(stack, 'guide').to).toBe('/guide?q=dal');
    expect(back({ to: '/guide', label: 'Guide' })).toMatchObject({ pop: false, to: '/guide?q=dal', label: 'Guide' });
  });

  it('sends a tab to its root when its place no longer leads anywhere: a record gone, or a screen never shown', () => {
    go(() => launch('/track'));
    go(() => push('/track/workout/w1')); shows('/track/workout/w1', 'Workout');
    markTab('today'); go(() => push('/today'));
    expect(tabLink(stack, 'track').to).toBe('/track/workout/w1');
    setPlaceCheck(place => place.pathname !== '/track/workout/w1');
    expect(tabLink(stack, 'track').to).toBe('/track');
    setPlaceCheck(() => true);
    // An address that only redirected never showed its screen, so it is no place to return to.
    markTab('guide'); go(() => push('/guide/topic/nope'));
    markTab('today'); go(() => push('/today'));
    expect(tabLink(stack, 'guide').to).toBe('/guide');
  });

  it('keeps each root its own when typed addresses share the default scroll key (J20)', () => {
    // Addresses the router did not create all carry the key "default".
    const typed = (path: string) => { index += 1; return record({ ...at(path), key: 'default' }, 'POP', index); };
    go(() => typed('/move')); shows('/move', 'Move');
    go(() => typed('/walk')); shows('/walk', 'Walk');
    go(() => typed('/guide')); shows('/guide', 'Guide');
    go(() => typed('/guide/sources')); shows('/guide/sources', 'Sources');
    expect(nav().roots.move?.pathname ?? '/move').toBe('/move');
    expect(nav().roots.guide?.pathname ?? '/guide').toBe('/guide');
  });

  it('forgets every tab’s place, and each root’s, when the record is cleared (J18)', () => {
    go(() => launch('/track?day=2026-09-25')); shows('/track', 'My Day');
    go(() => push('/track/workout/w1')); shows('/track/workout/w1', 'Workout');
    markTab('today'); go(() => push('/today'));
    forgetPlaces();
    expect(tabLink(nav(), 'track')).toEqual({ to: '/track' });
    expect(rootLink(nav(), 'track')).toEqual({ to: '/track' });
  });

  it('does not keep places a different build saved, which may name screens this one lacks', () => {
    const store = new Map<string, string>([['fit-strong-90-navigation', JSON.stringify({
      build: '/fit-strong-90/assets/index-OLD.js',
      entries: [{ pathname: '/today', search: '', state: null, scrollKey: 'a', tab: 'today', title: 'Today' }],
      places: { guide: { pathname: '/guide/gone', search: '', state: null, scrollKey: 'b', tab: 'guide', title: 'Gone' } },
      roots: {},
    })]]);
    Object.assign(globalThis, {
      sessionStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) },
      window: { history: { state: { idx: 0 } } },
    });
    try {
      followRouter({ state: { location: at('/today'), historyAction: 'POP' }, subscribe: () => () => {} });
      expect(tabLink(nav(), 'guide')).toEqual({ to: '/guide' });
      // The stack itself is kept: Back still knows what is below.
      expect(nav().entries[0]?.title).toBe('Today');
    } finally {
      delete (globalThis as { sessionStorage?: Storage }).sessionStorage;
      delete (globalThis as { window?: unknown }).window;
    }
  });

  it('gives each address its own tab, Move covering a walk, and You none', () => {
    expect(tabOf('/walk/summary')).toBe('move');
    expect(tabOf('/track/metric/glucose')).toBe('track');
    expect(tabOf('/you/data')).toBeUndefined();
  });
});

describe('which way a move goes (S-24)', () => {
  it('marks a push forward, a pop back, a Back that replaces back, and a tab tap as a tab', () => {
    go(() => launch('/guide'));
    expect(go(() => push('/guide/topic/b12')).direction).toBe('forward');
    expect(go(() => pop(0)).direction).toBe('back');
    expect(go(() => pop(1)).direction).toBe('forward');
    markBack();
    expect(backPending()).toBe(true);
    expect(go(() => replace('/guide')).direction).toBe('back');
    expect(backPending()).toBe(false);
    markTab('today');
    expect(go(() => push('/today')).direction).toBe('tab');
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
