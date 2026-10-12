import { createContext, useContext, useSyncExternalStore } from 'react';

/**
 * The navigation state iOS keeps for free, kept once for the whole app.
 *
 * A stack of the screens the person has been through: one entry per history
 * entry (React Router numbers them, `history.state.idx`), each with the tab it
 * belongs to and the title it showed. From it:
 * - Back pops exactly one entry, to the screen the person came from, named
 *   after it. With nothing of this tab to pop to (a fresh launch, a place a tab
 *   returned to) it goes to the screen's parent instead.
 * - A screen opened from a row stays in the tab it was opened from, as a
 *   navigation controller pushes inside its own tab, even when its address
 *   belongs to another area.
 * - Each tab keeps its place, so leaving it and coming back returns there.
 * - Each move is forward, back or a change of tab, so the transition can say which.
 * - A navigation asks its screen to take focus, once.
 *
 * The router feeds it directly (`followRouter`), before anything renders, so
 * no screen ever reads it a navigation late. sessionStorage keeps it across a
 * reload, as history itself is kept.
 */

export type Tab = 'today' | 'move' | 'track' | 'guide';

export const TAB_ROOT: Record<Tab, string> = { today: '/today', move: '/move', track: '/track', guide: '/guide' };
const TABS = Object.keys(TAB_ROOT) as Tab[];
/** A walk has its own address but is part of Move. */
const ALSO: Partial<Record<Tab, readonly string[]>> = { move: ['/walk'] };
/** Full-screen tasks outside the tabs: a tab never returns to one by itself. */
const TASKS = ['/session', '/walk/live', '/welcome'];

export const within = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/** The tab an address belongs to by itself. You belongs to none: it opens over any of them. */
export function tabOf(pathname: string): Tab | undefined {
  return TABS.find(t => [TAB_ROOT[t], ...(ALSO[t] ?? [])].some(base => within(pathname, base)));
}

const rootOf = (pathname: string) => TABS.find(t => TAB_ROOT[t] === pathname);
const keepsPlace = (pathname: string) => tabOf(pathname) !== undefined && !TASKS.some(t => within(pathname, t));
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export interface NavEntry {
  pathname: string;
  search: string;
  /** Its navigation state (`location.state`), so a tab returns to it as it was. */
  state: unknown;
  /** Where its scroll position is kept. */
  scrollKey: string;
  /** The tab it was pushed onto. None only for a screen outside the tabs with nothing before it. */
  tab?: Tab;
  /** What its screen was called, for the Back button of the screen opened from it. */
  title?: string;
}

export type Direction = 'forward' | 'back' | 'tab';

export interface NavState {
  /** By history index; a gap is an entry this app has not seen. */
  readonly entries: readonly (NavEntry | undefined)[];
  readonly index: number;
  /** Each tab's last place. */
  readonly places: Readonly<Partial<Record<Tab, NavEntry>>>;
  /** Each tab's root as it was last left — its search, its scroll — for popping back to it. */
  readonly roots: Readonly<Partial<Record<Tab, NavEntry>>>;
  /** Which way the last move went. */
  readonly direction: Direction;
}

export interface LocationLike {
  pathname: string;
  search: string;
  state: unknown;
  key: string;
}

type Action = 'POP' | 'PUSH' | 'REPLACE' | 'LAUNCH';

const EMPTY: NavState = { entries: [], index: -1, places: {}, roots: {}, direction: 'forward' };
let nav: NavState = EMPTY;
const listeners = new Set<() => void>();

/** A screen has been on screen: from now on a navigation is the person's, not the launch's. */
let shown = false;
/** The screen a navigation is waiting to focus. */
let focusFor: string | undefined;
/** What the next navigation is, when its kind alone cannot say: a Back that replaces, a tab. */
let intent: { kind: 'back' | 'tab'; tab?: Tab; at: number } | undefined;
/** An intent belongs to the navigation it was set for; `history.go` is not instant, so allow a moment. */
const INTENT_MS = 1000;

const STORE_KEY = 'fit-strong-90-navigation';
/** Enough history for any real Back; older entries are forgotten rather than kept for ever. */
const KEEP = 100;

/**
 * The build that wrote the saved places: its entry script, which a deploy
 * renames. Places saved by another build may name screens this one does not
 * have, so they are not kept across an update.
 */
function buildOf(): string {
  return typeof document === 'undefined' ? '' : document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.getAttribute('src') ?? '';
}

/** Whether a remembered place still leads somewhere; the app supplies the rule (see `setPlaceCheck`). */
let placeCheck: (place: NavEntry) => boolean = () => true;

function publish(next: NavState): void {
  nav = next;
  try {
    const from = Math.max(0, next.entries.length - KEEP);
    sessionStorage.setItem(STORE_KEY, JSON.stringify({
      build: buildOf(),
      entries: next.entries.map((e, i) => (i < from ? null : e ?? null)),
      places: next.places,
      roots: next.roots,
    }));
  } catch {
    // No session storage: the stack still works for this page load.
  }
  for (const listener of listeners) listener();
}

function isEntry(v: unknown): v is NavEntry {
  return isRecord(v) && typeof v.pathname === 'string' && typeof v.search === 'string' && typeof v.scrollKey === 'string'
    && (v.tab === undefined || TABS.includes(v.tab as Tab)) && (v.title === undefined || typeof v.title === 'string');
}

function restore(): void {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(STORE_KEY) ?? 'null');
    if (!isRecord(saved)) return;
    const entries = Array.isArray(saved.entries) ? saved.entries.map(e => (isEntry(e) ? e : undefined)) : [];
    const byTab = (v: unknown) => {
      const out: Partial<Record<Tab, NavEntry>> = {};
      if (isRecord(v)) for (const t of TABS) if (isEntry(v[t])) out[t] = v[t] as NavEntry;
      return out;
    };
    const sameBuild = saved.build === buildOf();
    nav = { ...EMPTY, entries, places: sameBuild ? byTab(saved.places) : {}, roots: sameBuild ? byTab(saved.roots) : {} };
  } catch {
    nav = EMPTY;
  }
}

function takeIntent(now: number) {
  const asked = intent;
  intent = undefined;
  return asked && now - asked.at < INTENT_MS ? asked : undefined;
}

/** The next navigation is Back: it reads as going back even when it replaces. */
export function markBack(now = Date.now()): void {
  intent = { kind: 'back', at: now };
}

/** The next navigation is a tap on this tab: the screen it opens belongs to it. */
export function markTab(tab: Tab, now = Date.now()): void {
  intent = { kind: 'tab', tab, at: now };
}

/** A Back is on its way, so a replace may animate. */
export function backPending(now = Date.now()): boolean {
  return intent?.kind === 'back' && now - intent.at < INTENT_MS;
}

/** The key a location's scroll position is kept under: a returning tab borrows its place's. */
const RESTORE = 'restoreScroll';
export function scrollKeyOf(location: { key: string; state: unknown }): string {
  const key = isRecord(location.state) ? location.state[RESTORE] : undefined;
  return typeof key === 'string' ? key : location.key;
}

/**
 * Records one committed location. Exported for tests; the app calls it
 * through `followRouter`. `historyIndex` is React Router's `idx`, missing
 * only when something other than the router made the entry (a hash typed by
 * hand), which starts a new stack.
 */
export function record(location: LocationLike, action: Action, historyIndex: number | undefined, now = Date.now()): NavState {
  const { entries, index, places, roots } = nav;
  const leaving = entries[index];
  const asked = takeIntent(now);
  const fresh = historyIndex === undefined && action !== 'PUSH' && action !== 'REPLACE';
  const idx = historyIndex ?? (fresh ? 0 : action === 'PUSH' ? index + 1 : Math.max(index, 0));
  const base = fresh ? [] : entries;
  const known = base[idx];
  // The same screen in the same entry: a reload, a return, a changed query.
  const same = known?.pathname === location.pathname ? known : undefined;
  const below = base[idx - 1];
  const tab = asked?.kind === 'tab' ? asked.tab
    : rootOf(location.pathname)
      ?? (action === 'PUSH' ? (below ? below.tab : tabOf(location.pathname))
        : action === 'REPLACE' ? (known ? known.tab : below ? below.tab : tabOf(location.pathname))
          : same ? same.tab : tabOf(location.pathname));
  // A new entry, or another screen in this one, has not shown its title yet.
  const title = action !== 'PUSH' ? same?.title : undefined;
  const entry: NavEntry = {
    pathname: location.pathname,
    search: location.search,
    state: location.state ?? null,
    scrollKey: scrollKeyOf(location),
    ...(tab ? { tab } : {}),
    ...(title !== undefined ? { title } : {}),
  };
  // A push discards whatever was ahead of it, as the browser does.
  const next = action === 'PUSH' ? base.slice(0, idx) : base.slice();
  next[idx] = entry;
  const direction: Direction = action === 'POP' ? (!fresh && idx < index ? 'back' : 'forward') : asked?.kind ?? 'forward';
  if (shown && action !== 'LAUNCH' && leaving?.pathname !== location.pathname) focusFor = location.pathname;
  publish({
    entries: next,
    index: idx,
    places: tab && keepsPlace(location.pathname) ? { ...places, [tab]: entry } : places,
    roots: tab && rootOf(location.pathname) === tab ? { ...roots, [tab]: entry } : roots,
    direction,
  });
  return nav;
}

interface RouterLike {
  state: { location: LocationLike; historyAction: string };
  subscribe(listener: (state: RouterLike['state']) => void): () => void;
}

function historyIndex(): number | undefined {
  const idx = (window.history.state as { idx?: unknown } | null)?.idx;
  return typeof idx === 'number' && Number.isInteger(idx) && idx >= 0 ? idx : undefined;
}

/**
 * Follows the router from launch. Subscribed before React renders, so this
 * runs before React Router's own subscriber: each location is recorded, and
 * the direction is on the document, before its transition starts.
 */
export function followRouter(router: RouterLike): () => void {
  restore();
  let last = router.state.location;
  record(last, 'LAUNCH', historyIndex());
  return router.subscribe(state => {
    if (state.location === last) return;
    last = state.location;
    const action = state.historyAction === 'PUSH' || state.historyAction === 'REPLACE' ? state.historyAction : 'POP';
    record(state.location, action, historyIndex());
    document.documentElement.dataset.nav = nav.direction;
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The stack, live. */
export function useNavStack(): NavState {
  return useSyncExternalStore(subscribe, () => nav, () => nav);
}

/** The stack as it is this moment, for an event handler. */
export function getNavState(): NavState {
  return nav;
}

/**
 * A screen shows its title: the next screen's Back is named after it, and a
 * tab may return to it — a place whose screen never showed (an address that
 * only redirected) is not one to go back to.
 */
export function setTitle(pathname: string, title: string): void {
  const here = nav.entries[nav.index];
  if (!here || here.pathname !== pathname || here.title === title) return;
  const entries = nav.entries.slice();
  const titled = { ...here, title };
  entries[nav.index] = titled;
  // The same entry, not merely the same scroll key: every address the router
  // did not create (typed, bookmarked, the launch) shares the key "default",
  // and must not overwrite another screen's place or root (acceptance J20).
  const same = (e: NavEntry | undefined) =>
    e !== undefined && e.scrollKey === here.scrollKey && e.pathname === here.pathname && e.search === here.search;
  const stamp = (byTab: Readonly<Partial<Record<Tab, NavEntry>>>) =>
    here.tab && same(byTab[here.tab]) ? { ...byTab, [here.tab]: titled } : byTab;
  publish({ ...nav, entries, places: stamp(nav.places), roots: stamp(nav.roots) });
}

/**
 * The rule for whether a remembered place still leads somewhere, such as
 * "the record it shows is still stored". A place that fails it, or whose
 * screen never showed, sends its tab to the root instead.
 */
export function setPlaceCheck(check: (place: NavEntry) => boolean): void {
  placeCheck = check;
}

/**
 * Every tab forgets its place, as when the record is deleted or not yet set
 * up: none of them should reopen a screen from a record that has gone
 * (acceptance J18).
 */
export function forgetPlaces(): void {
  if (Object.keys(nav.places).length === 0 && Object.keys(nav.roots).length === 0) return;
  publish({ ...nav, places: {}, roots: {} });
}

/** A screen is on screen, so the launch is over. */
export function markShown(): void {
  shown = true;
}

/**
 * True once per navigation, for the screen it went to: that screen's title
 * takes the focus, so a screen reader announces where the person now is. Not
 * on launch, and not for a screen that changes its title without a navigation.
 */
export function takeFocusRequest(pathname: string): boolean {
  if (focusFor !== pathname) return false;
  focusFor = undefined;
  return true;
}

/** The path of the entry just below this one, if the app has seen it. */
export function cameFrom(): string | undefined {
  return nav.entries[nav.index - 1]?.pathname;
}

/** Where a screen came from, when the screen that opened it says (`{ path, label }` in navigation state). */
export interface Origin {
  path: string;
  label: string;
  search?: string;
}

export function originOf(state: unknown): Origin | undefined {
  if (!isRecord(state) || typeof state.path !== 'string' || typeof state.label !== 'string') return undefined;
  return { path: state.path, label: state.label, ...(typeof state.search === 'string' ? { search: state.search } : {}) };
}

export type BackTarget = { pop: true; label: string } | { pop: false; to: string; state?: Record<string, unknown>; label: string };

const pathnameOf = (to: string) => to.split(/[?#]/)[0];

/**
 * What Back does from the current screen. Pop when the entry below is in the
 * same tab: that is the screen the person came from, named as the screen
 * names its parent, or as the opener named itself, or by its own title.
 * Otherwise go to the opener the navigation state names, or to the parent, in
 * place of this entry.
 */
export function backTarget(state: NavState, parent: { to: string; label: string }, locationState: unknown): BackTarget {
  const here = state.entries[state.index];
  const below = state.entries[state.index - 1];
  const origin = originOf(locationState);
  if (here && below && below.tab === here.tab) {
    const label = pathnameOf(parent.to) === below.pathname ? parent.label
      : origin?.path === below.pathname ? origin.label
        : below.title ?? 'Back';
    return { pop: true, label };
  }
  if (origin) return { pop: false, to: `${origin.path}${origin.search ?? ''}`, label: origin.label };
  // A tab's root goes back as it was left: its search, its scroll position.
  const root = rootOf(parent.to);
  if (root) return { pop: false, ...rootLink(state, root), label: parent.label };
  return { pop: false, to: parent.to, label: parent.label };
}

/** A place to go back to as it was, keeping its scroll position. */
function placeLink(place: NavEntry): { to: string; state: Record<string, unknown> } {
  return { to: `${place.pathname}${place.search}`, state: { ...(isRecord(place.state) ? place.state : {}), [RESTORE]: place.scrollKey } };
}

/** A tab's root, as it was last left. */
export function rootLink(state: NavState, tab: Tab): { to: string; state?: Record<string, unknown> } {
  const root = state.roots[tab];
  return root ? placeLink(root) : { to: TAB_ROOT[tab] };
}

/** Where a tab's button goes: back to its place, keeping that place's scroll position. */
export function tabLink(state: NavState, tab: Tab): { to: string; state?: Record<string, unknown> } {
  const place = state.places[tab];
  return place && place.title !== undefined && placeCheck(place) ? placeLink(place) : rootLink(state, tab);
}

/**
 * Tapping the tab already selected: at its root, scroll to the top; deeper,
 * pop to the root — by going back through this tab's own entries when they
 * lead there, or by replacing this one with the root, as it was left
 * (`rootLink`), when they don't.
 */
export function rootStep(state: NavState, tab: Tab): 'top' | 'replace' | number {
  if (state.entries[state.index]?.pathname === TAB_ROOT[tab]) return 'top';
  for (let i = state.index - 1; i >= 0; i--) {
    const e = state.entries[i];
    if (!e || e.tab !== tab) break;
    if (e.pathname === TAB_ROOT[tab]) return i - state.index;
  }
  return 'replace';
}

/** The tab to show as selected: the one the current screen was opened in. */
export function currentTab(state: NavState, pathname: string): Tab | undefined {
  const here = state.entries[state.index];
  return here?.pathname === pathname ? here.tab : tabOf(pathname);
}

/**
 * How the Back button's text fits beside the title, as iOS decides it: the
 * parent's name when it fits, "Back" when that fits, else the chevron alone
 * (the button keeps the full name for VoiceOver either way).
 */
export function backLabelFit(room: number, full: number, short: number): 'full' | 'short' | 'none' {
  if (full <= room) return 'full';
  return short <= room ? 'short' : 'none';
}

/**
 * A screen whose code could not be downloaded, rather than one that broke
 * while drawing. Browsers keep a failed module download for the life of the
 * page (Chromium never asks the network again), so only a reload retries it.
 */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(message);
}

/** Tests only. */
export function resetNavigationForTests(): void {
  nav = EMPTY;
  shown = false;
  focusFor = undefined;
  intent = undefined;
  placeCheck = () => true;
}

/**
 * True inside a full-screen task frame, which shows the storage notice itself;
 * a `Screen` inside it must not show a second one.
 */
export const TaskFrameContext = createContext(false);

export function useInTaskFrame(): boolean {
  return useContext(TaskFrameContext);
}
