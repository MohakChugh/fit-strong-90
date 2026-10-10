/**
 * Edit Home's behaviour (journey §7.6; motion M17 to M19; B-03, B-04): the
 * edit mode, each change written to `settings.home` through the store's
 * settings update as it is made, what VoiceOver hears, where focus goes, Undo
 * for Hide, the long-press that opens a tile's menu, and the reorder
 * animation. The operations themselves are `./layout`'s, and pure.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent, type TouchEvent } from 'react';
import { toast } from 'sonner';
import { MAX_PER_GROUP, categoryById, isHomeLayout, type CategoryId } from '@/categories';
import { MOTION, springLinear } from '@/design/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { setSettings, update } from '@/store/useStore';
import type { HomeLayout } from '@/types';
import { layoutNow } from './homeLayout';
import { addTile, groupFull, hiddenTiles, hideTile, movedMessage, moveTile, moveTileTo, placedMessage, restoreTile, showTile } from './layout';

/** A control on a tile in edit mode, found again by name once the tile has moved. */
export type Control = 'up' | 'down' | 'hide' | 'more';

// ============================================================================
// The reorder animation (M17)
// ============================================================================

const EASE = springLinear(0);
const playing = new WeakMap<Element, Animation>();

/**
 * Tiles move to their new place rather than jumping (M17, `spring-quick`):
 * `snapshot()` notes where every `[data-flip]` element is drawn just before a
 * change, and after the change renders each one plays from there to its new
 * place. The state changes first and at once; this only draws the way there
 * (motion rule 1). Nothing plays under Reduce Motion, or while an urgent
 * decision stands (motion rule 2).
 */
export function useFlip<T extends HTMLElement>(still: boolean) {
  const ref = useRef<T>(null);
  const before = useRef<Map<string, DOMRect> | null>(null);
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    const was = before.current;
    before.current = null;
    const root = ref.current;
    if (!was || !root || reduced || still) return;
    for (const el of root.querySelectorAll<HTMLElement>('[data-flip]')) {
      const from = was.get(el.dataset.flip ?? '');
      if (!from) continue;
      playing.get(el)?.cancel();
      const to = el.getBoundingClientRect();
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      try {
        playing.set(el, el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: MOTION.springQuick.cssMs, easing: EASE }));
      } catch {
        // An engine without `linear()` easing: the tile is already in its place.
      }
    }
  });
  const snapshot = () => {
    const root = ref.current;
    if (!root) return;
    const map = new Map<string, DOMRect>();
    for (const el of root.querySelectorAll<HTMLElement>('[data-flip]')) map.set(el.dataset.flip ?? '', el.getBoundingClientRect());
    before.current = map;
    // A change that renders nothing would leave this for some later render to replay.
    requestAnimationFrame(() => { if (before.current === map) before.current = null; });
  };
  return { ref, snapshot };
}

// ============================================================================
// Long-press (M18)
// ============================================================================

const LONG_PRESS_MS = 500;
/** A finger that travels further is scrolling, not pressing. */
const SLOP_PX = 10;

/**
 * A 500 ms press and hold opens a tile's menu (journey §7.2, M18). A right
 * click, the context-menu key and Android's own long press arrive as
 * `contextmenu` and open it too. A tap still opens the hub by the browser's
 * own click rules: only a hold that fired swallows the click after it, and on
 * iOS the touch's end, so lifting the finger opens nothing behind the menu.
 * The visible equivalent is "Edit Home" (journey §20.4 rule 3).
 */
export function useLongPress(onLongPress: ((el: HTMLElement) => void) | undefined) {
  const timer = useRef<number | undefined>(undefined);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  useEffect(() => () => stop(timer), []);
  const cancel = () => {
    stop(timer);
    origin.current = null;
  };
  const handlers = onLongPress ? {
    onPointerDown(e: PointerEvent<HTMLElement>) {
      fired.current = false;
      cancel();
      if (!e.isPrimary || e.button !== 0) return;
      origin.current = { x: e.clientX, y: e.clientY };
      const el = e.currentTarget;
      timer.current = window.setTimeout(() => {
        timer.current = undefined;
        origin.current = null;
        fired.current = true;
        onLongPress(el);
      }, LONG_PRESS_MS);
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      const o = origin.current;
      if (o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > SLOP_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu(e: MouseEvent<HTMLElement>) {
      e.preventDefault();
      cancel();
      if (fired.current) return;
      fired.current = true;
      onLongPress(e.currentTarget);
    },
    onTouchEnd(e: TouchEvent<HTMLElement>) {
      if (fired.current) e.preventDefault();
    },
  } : {};
  /** Whether the press that ended was a long one, so its click opens nothing; asking resets it. */
  const consumed = () => {
    const was = fired.current;
    fired.current = false;
    return was;
  };
  return { handlers, consumed };
}

function stop(timer: { current: number | undefined }): void {
  window.clearTimeout(timer.current);
  timer.current = undefined;
}

// ============================================================================
// Edit Home
// ============================================================================

/** A tile's menu (M18): drawn against the tile, and handing focus back to what opened it. */
export interface MenuTarget {
  id: CategoryId;
  anchor: HTMLElement;
  /** The tile itself after a long-press, or its More button. */
  opener: HTMLElement;
}

interface Undo {
  key: string;
  id: CategoryId;
  /** The layout it was hidden from, so Undo can put it back in its place. */
  before: HomeLayout;
}

/** Every Undo still offered goes (B-04): on leaving Home, or a change that isn't another Hide. */
function endUndos(undos: { current: Undo[] }, counted?: (n: number) => void): void {
  for (const u of undos.current) toast.dismiss(u.key);
  undos.current = [];
  counted?.(0);
}

/** Toasts are solid and read at the body size; Undo is a 48 px target (journey §20.4 rules 1 and 12). */
const TOAST_STYLE: CSSProperties = { fontSize: 'var(--text-body)' };
const UNDO_STYLE: CSSProperties = {
  height: 'auto', minHeight: '3rem', minWidth: '3rem', paddingInline: '1rem', borderRadius: '9999px',
  fontSize: 'var(--text-body)', fontWeight: 600, background: 'var(--tint)', color: 'var(--on-tint)',
};

export function useHomeEditor({ fallback, still, urgent }: {
  /** The layout drawn while none is stored: the defaults from the person's answers. */
  fallback: HomeLayout;
  /** A safety decision stands, so nothing on the page moves (motion rule 2). */
  still: boolean;
  /** The urgent surface is showing: a menu closes at once and stays closed (M18). */
  urgent: boolean;
}) {
  const [editing, setEditing] = useState(false);
  // The tile whose menu opened edit mode, so Done hands focus back to it.
  const [startedFrom, setStartedFrom] = useState<CategoryId>();
  const [menu, setMenu] = useState<MenuTarget | null>(null);
  // Browse's pick mode over Edit Home (journey §7.6, D56).
  const [picking, setPicking] = useState(false);
  // Closed, not just hidden, so it can't open again by itself once the urgent state has gone.
  if (urgent && menu !== null) setMenu(null);
  // Polite, and said again even when the words repeat.
  const [said, setSaid] = useState({ text: '', n: 0 });
  const [error, setError] = useState<string>();
  // A change the device refused, kept as a draft and drawn in its place, with Try again (codex V1-11).
  const [refused, setRefused] = useState<{ layout: HomeLayout; message: string; then?: () => void }>();
  const draft = useRef<HomeLayout | undefined>(undefined);
  // Writes still on their way, and whether Done is waiting for them (journey §4.5).
  const inFlight = useRef(0);
  const closing = useRef(false);
  const written = useRef(0);
  // How many Undo toasts stand, so Edit Home keeps its Done scrollable clear of them (M19).
  const [undoCount, setUndoCount] = useState(0);
  const flip = useFlip<HTMLDivElement>(still);
  const undos = useRef<Undo[]>([]);
  const seq = useRef(0);
  // An Undo waiting for the menu it came from to close (B-03), and whether one is open.
  const pending = useRef<(() => void) | null>(null);
  const menuOpen = useRef(false);

  // Leaving Home ends every Undo it offered (B-04); a hidden tile is still in Edit Home, with Show.
  useEffect(() => () => endUndos(undos), []);

  /** The layout as it stands now, a refused draft or a change still being written included, so quick taps build on each other. */
  const latest = (): HomeLayout => draft.current ?? layoutNow(fallback);
  const say = (text: string) => setSaid(s => ({ text, n: s.n + 1 }));
  // After the change has rendered: the element a control was on may have been moved or replaced.
  const focusLater = (find: () => HTMLElement | null | undefined, options?: FocusOptions) => requestAnimationFrame(() => find()?.focus(options));
  const inTiles = (selector: string) => flip.ref.current?.querySelector<HTMLElement>(selector) ?? null;
  const tileControl = (id: CategoryId, control?: Control) =>
    (control ? inTiles(`[data-tile="${id}"] [data-control="${control}"]`) : null) ?? inTiles(`[data-tile="${id}"] a, [data-tile="${id}"] button`);
  const screenTitle = () => document.querySelector<HTMLElement>('main h1');

  const finish = () => {
    closing.current = false;
    setPicking(false);
    setEditing(false);
    focusLater(() => (startedFrom ? tileControl(startedFrom) : null) ?? document.querySelector<HTMLElement>('[data-edit-home-row]'));
  };

  /**
   * Each change is written at once, and drawn at once; what it says (an
   * announcement, an Undo) is said only once the device has stored it
   * (journey §4.5, codex V1-11). A refused write keeps the layout it tried
   * as a draft, drawn in its place, until Try again stores it or a later
   * change, which carries it, does.
   */
  const write = (next: HomeLayout, then?: () => void, refusedThen?: (message: string) => void) => {
    flip.snapshot();
    const n = ++written.current;
    inFlight.current += 1;
    void setSettings({ home: next }).then(result => {
      inFlight.current -= 1;
      // Only the newest write says how things stand: it carries every change before it.
      if (n === written.current) {
        if (result.ok) {
          draft.current = undefined;
          setRefused(undefined);
        } else {
          draft.current = next;
          closing.current = false;
          setRefused({ layout: next, message: result.failure.message, ...(then ? { then } : {}) });
        }
      }
      if (!result.ok) {
        refusedThen?.(result.failure.message);
        return;
      }
      setError(undefined);
      then?.();
      if (closing.current && inFlight.current === 0 && !draft.current) finish();
    });
  };
  /** Try again: the refused draft, written again, saying then what it would have said. */
  const retry = () => {
    if (refused) write(refused.layout, refused.then);
  };

  const forget = (key: string) => {
    undos.current = undos.current.filter(x => x.key !== key);
    setUndoCount(undos.current.length);
  };
  const end = () => endUndos(undos, setUndoCount);

  /** Undo, from its toast: the toast stays until the tile is stored back in its place (codex V1-11). */
  const undo = (key: string, event?: { preventDefault(): void }) => {
    event?.preventDefault();
    const u = undos.current.find(x => x.key === key);
    if (!u) return;
    const now = latest();
    const { title, group } = categoryById(u.id);
    const restored = (next: HomeLayout) => () => {
      forget(key);
      toast.dismiss(key);
      say(placedMessage(next, u.id, 'back'));
      focusLater(() => tileControl(u.id, 'hide'), { preventScroll: true });
    };
    if (now.order[group].includes(u.id)) {
      // Back in its place already: in a refused draft, which this Undo writes again; or stored.
      if (draft.current) write(draft.current, restored(draft.current));
      else {
        forget(key);
        toast.dismiss(key);
      }
      return;
    }
    // Only when another copy of the app filled the group meanwhile: say so, and what to do.
    if (groupFull(now, group)) {
      setError(`${title} couldn’t go back: that group already has ${MAX_PER_GROUP} tiles. Hide one in Edit Home, then show ${title} from Hidden.`);
      return;
    }
    const next = restoreTile(now, u.id, u.before);
    write(next, restored(next));
  };

  const offerUndo = (id: CategoryId, before: HomeLayout) => {
    const key = `home-undo-${++seq.current}`;
    undos.current = [...undos.current, { key, id, before }];
    // Two at most, the newer stacked above the older; restoring one keeps the other (M19, B-04).
    while (undos.current.length > 2) {
      const [oldest, ...rest] = undos.current;
      toast.dismiss(oldest.key);
      undos.current = rest;
    }
    setUndoCount(undos.current.length);
    // Never on a timer (journey §20.4 rule 6): it goes when Home is left or something else is changed.
    toast(`${categoryById(id).title} hidden from Home`, {
      id: key, duration: Infinity, style: TOAST_STYLE, actionButtonStyle: UNDO_STYLE,
      action: { label: 'Undo', onClick: event => undo(key, event) },
      onDismiss: () => forget(key),
    });
  };

  /** Hide (M17): at once, with Undo once stored. From a menu, focus goes to the screen's title and the Undo waits for the menu to close (B-03). */
  const hide = (id: CategoryId, from: 'edit' | 'menu') => {
    const before = latest();
    const list = before.order[categoryById(id).group];
    const i = list.indexOf(id);
    if (i < 0) return;
    if (from === 'menu') {
      focusLater(screenTitle, { preventScroll: true });
      write(hideTile(before, id), () => {
        const offer = () => offerUndo(id, before);
        if (menuOpen.current) pending.current = offer;
        else offer();
      });
      return;
    }
    const neighbour = list[i + 1] ?? list[i - 1];
    write(hideTile(before, id), () => offerUndo(id, before));
    focusLater(() => (neighbour ? tileControl(neighbour, 'hide') : inTiles('[data-edit-heading]')));
  };

  /** Move up or down one place in its group; focus stays on the moved tile (M17). */
  const move = (id: CategoryId, by: -1 | 1, control?: Control) => {
    const before = latest();
    const next = moveTile(before, id, by);
    if (next === before) return;
    end();
    write(next, () => say(movedMessage(next, id)));
    focusLater(() => tileControl(id, control));
  };

  /** A drag's drop (M17). */
  const drop = (id: CategoryId, index: number) => {
    const before = latest();
    const next = moveTileTo(before, id, index);
    if (next === before) return;
    end();
    write(next, () => say(movedMessage(next, id)));
  };

  /** Show, from Hidden: back at the end of its group, unless the group is full. */
  const show = (id: CategoryId) => {
    const before = latest();
    const { group } = categoryById(id);
    if (!before.hidden.includes(id) || before.order[group].includes(id) || groupFull(before, group)) return;
    const listed = hiddenTiles(before);
    const i = listed.indexOf(id);
    const neighbour = listed[i + 1] ?? listed[i - 1];
    end();
    const next = showTile(before, id);
    write(next, () => say(placedMessage(next, id, 'back')));
    focusLater(() => (neighbour ? inTiles(`[data-hidden-tile="${neighbour}"] button`) : inTiles('[data-control="add"]')));
  };

  /**
   * Add, from "+ Add". Resolves to what to announce once stored, or that it
   * didn't save: the page is inert behind the sheet, so the sheet says it.
   */
  const add = (id: CategoryId): Promise<string | undefined> => {
    const before = latest();
    const { group } = categoryById(id);
    if (before.order[group].includes(id) || groupFull(before, group)) return Promise.resolve(undefined);
    end();
    const next = addTile(before, id);
    return new Promise(resolve => {
      write(next, () => resolve(placedMessage(next, id, 'added')), () => resolve(`${categoryById(id).title} wasn’t saved on this phone. Try again from Edit Home.`));
    });
  };

  const start = (from?: CategoryId) => {
    setEditing(true);
    setStartedFrom(from);
    setMenu(null);
    focusLater(() => {
      const heading = inTiles('[data-edit-heading]');
      heading?.scrollIntoView({ block: 'start' });
      return heading;
    }, { preventScroll: true });
  };

  /** Edit Home with pick mode over it, as `#/browse?pick=1` asks (journey §19.2). State only, so it is safe during render; the sheet takes focus itself. */
  const openPick = () => {
    setEditing(true);
    setMenu(null);
    setPicking(true);
  };

  /**
   * Done: once every change is stored, focus goes back to where editing began
   * (journey §20.4 rule 10). A change still being written is waited for; a
   * refused one keeps Edit Home open with its Try again (codex V1-11).
   */
  const done = () => {
    if (draft.current) return;
    if (inFlight.current > 0) {
      closing.current = true;
      return;
    }
    finish();
  };

  const openMenu = (id: CategoryId, anchor: HTMLElement, opener: HTMLElement = anchor) => {
    menuOpen.current = true;
    setMenu({ id, anchor, opener });
  };
  /** An action chose its own focus; anything else (Escape, Close, outside) returns it to the opener, or the title (B-03). */
  const closeMenu = (reason: 'action' | 'dismiss') => {
    const target = menu;
    setMenu(null);
    if (reason === 'dismiss' && target) focusLater(() => (target.opener.isConnected ? target.opener : screenTitle()), { preventScroll: true });
  };
  const menuClosed = () => {
    menuOpen.current = false;
    const offer = pending.current;
    pending.current = null;
    offer?.();
  };

  return {
    editing, start, done, menu, openMenu, closeMenu, menuClosed, picking, setPicking, openPick,
    hide, move, drop, show, add, said, error, undoCount, flipRef: flip.ref,
    /** The refused draft, drawn in place of the stored layout; its message; and Try again. */
    draft: refused?.layout, failed: refused?.message, retry,
  };
}

export type HomeEditor = ReturnType<typeof useHomeEditor>;

/**
 * Home's first layout (journey §5.1, codex V1-12): the defaults, worked out
 * once from the answers and drawn as they were, even if later data would
 * give others, until the device has stored them. A refused write is tried
 * again on the next visit to the app (`visit`), and never over a layout
 * stored meanwhile: the person's own edits always win.
 */
export function useFirstLayout({ stored, fallback, ready, visit }: {
  /** The layout stored on the device, if any. */
  stored: HomeLayout | undefined;
  /** The defaults from the answers, as they stand now. */
  fallback: HomeLayout;
  /** There are answers to work the defaults out from (a stored profile). */
  ready: boolean;
  /** Counts returns to the app (`useClock().visit`). */
  visit: number;
}): HomeLayout {
  const [first, setFirst] = useState<HomeLayout>();
  if (!stored && ready && !first) setFirst(fallback);
  const writing = useRef(false);
  const [refusedOn, setRefusedOn] = useState<number>();
  useEffect(() => {
    if (stored || !first || writing.current || refusedOn === visit) return;
    writing.current = true;
    void update(prev => (prev.settings.home !== undefined && isHomeLayout(prev.settings.home)
      ? prev
      : { ...prev, settings: { ...prev.settings, home: first } })).then(result => {
      writing.current = false;
      if (!result.ok) setRefusedOn(visit);
    });
  }, [stored, first, visit, refusedOn]);
  return stored ?? first ?? fallback;
}
