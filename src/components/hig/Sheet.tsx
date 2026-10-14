import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode, type RefObject } from 'react';
import {
  Sheet as SheetRoot,
  SheetClose,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { claimModal } from './modal';
import { SheetTopContext } from './navigation';
import { createSwipe } from './sheetGesture';

/** How much of the screen the sheet takes. iOS calls these detents. */
export type Detent = 'medium' | 'large';

/**
 * iOS gives a sheet two useful heights, and the web can have the same two:
 * `medium` for a bounded decision — pick a date, pick a unit — and `large`
 * for something you read or fill in.
 *
 * The height is fixed per detent rather than driven by the content, so the
 * sheet lands in the same place every time and the body is the part that
 * scrolls. That matters at 200% text, where a "short" sheet is no longer short.
 */
const HEIGHT: Record<Detent, string> = {
  // 55dvh, not vh: iOS shrinks the viewport when the address bar is showing.
  medium: 'data-[side=bottom]:h-[55dvh]',
  large: 'data-[side=bottom]:h-[92dvh]',
};

/**
 * Nested sheets are a trap, not a feature: two focus traps fight, iOS locks
 * scroll twice and the second sheet has no visible way back. A sheet that
 * needs another step pushes a detail screen instead.
 */
const InSheet = createContext(false);

/**
 * While any sheet is open, the screen behind it is inert, and its toasts wait
 * (`claimModal`, B-03). The sheet itself is portalled to <body>, outside
 * #app, so it stays live.
 */
function useInertBackground(open: boolean) {
  // What had focus as the sheet opened, for the hand-back.
  const opened = useRef<HTMLElement | null>(null);
  // A layout effect, so the page wakes in the same commit that closes the
  // sheet, before the dialog hands focus back to whatever opened it.
  useLayoutEffect(() => {
    if (!open || !document.getElementById('app')) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    opened.current = opener;
    const release = claimModal();
    return () => {
      release();
      // If the hand-back raced the wake-up and focus fell to the page, finish it.
      requestAnimationFrame(() => {
        if (document.activeElement === document.body && opener?.isConnected) opener.focus({ preventScroll: true });
      });
    };
  }, [open]);
  return opened;
}

/**
 * Swipe down on the grabber or the title bar to dismiss, as on iOS: the sheet
 * follows the finger, then closes when pulled far enough or flicked, or
 * settles back (see `createSwipe`). It asks before it goes, so a sheet that
 * refuses to close — one saving — stays in view. Close stays for everyone who
 * does not drag. The settling uses the sheet's own transition, which reduced
 * motion already makes instant.
 */
function useSwipeToDismiss({ open, dismissible, onOpenChange }: { open: boolean; dismissible: boolean; onOpenChange: (open: boolean) => void }) {
  // Read when the drag ends, so the answer is the sheet's latest.
  const latest = useRef({ open, dismissible, onOpenChange });
  useLayoutEffect(() => {
    latest.current = { open, dismissible, onOpenChange };
  });
  const swipe = useRef<ReturnType<typeof createSwipe> | null>(null);

  return {
    onPointerDown(e: PointerEvent<HTMLElement>) {
      // A tap on Close stays a tap.
      if (e.button !== 0 || (e.target as Element).closest('button')) return;
      const panel = e.currentTarget.closest<HTMLElement>('[data-slot="sheet-content"]');
      if (!panel) return;
      // Keeps the moves coming if the pointer leaves the bar. A touch is held
      // by its target anyway; a capture the browser refuses changes nothing.
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
      const backdrop = panel.parentElement?.querySelector<HTMLElement>(':scope > [data-slot="sheet-overlay"]') ?? null;
      // Made on the first drag, here rather than while rendering.
      swipe.current ??= createSwipe({
        dismiss: () => latest.current.onOpenChange(false),
        isOpen: () => latest.current.open,
        dismissible: () => latest.current.dismissible,
        // Two frames: the refusal or the close has been rendered by then.
        afterAnswer: answered => requestAnimationFrame(() => requestAnimationFrame(answered)),
      });
      swipe.current.start(e.pointerId, e.clientY, e.timeStamp, { panel, backdrop });
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => swipe.current?.move(e.pointerId, e.clientY, e.timeStamp),
    onPointerUp: (e: PointerEvent<HTMLElement>) => swipe.current?.end(e.pointerId, e.clientY, e.timeStamp),
    onPointerCancel: (e: PointerEvent<HTMLElement>) => swipe.current?.cancel(e.pointerId),
  };
}

/**
 * The shared safety surface at the top of an open sheet (codex V1-02), and
 * what its way on does here.
 *
 * - A decision arriving, or escalating, while the sheet is open is brought
 *   into view at the top of its body, heading first, however far down the
 *   person had scrolled: inserted above content they were reading, it would
 *   otherwise stay out of sight (codex W-02). Nothing else moves: the form
 *   under it and anything being saved stay as they are, and the decision's
 *   time coming due ("Re-check now") pulls nobody away from what they type.
 * - "What to do" closes the sheet through its own close, and goes on only
 *   once the sheet has closed (codex W-05). A sheet that refuses to close,
 *   one saving, keeps the person and its save; the way on waits, and says
 *   so. Should the sheet become closable and stay open, its save having
 *   failed, the person is left with what it says and taps again.
 */
function useSurfaceAtTop({ open, dismissible, ownsUrgent, onOpenChange }: {
  open: boolean;
  dismissible: boolean;
  ownsUrgent: boolean;
  onOpenChange: (open: boolean) => void;
}): { surface: ReactNode; body: RefObject<HTMLDivElement | null> } {
  /** The sheet's scrolling body. */
  const body = useRef<HTMLDivElement>(null);
  const top = useContext(SheetTopContext);
  const shown = ownsUrgent ? null : top;
  // The decision drawn while open, by which decision it is: not by its words, which change as its time comes due.
  const arrived = open && shown ? shown.key : null;
  useLayoutEffect(() => {
    if (arrived !== null && body.current) body.current.scrollTop = 0;
  }, [arrived]);

  // A way on asked for, and one to take now; each a new object, so each is taken once.
  const [leaving, setLeaving] = useState<{ go: () => void } | null>(null);
  const [going, setGoing] = useState<{ go: () => void } | null>(null);
  if (leaving && !open) {
    // Closed: go, once this has committed and the page behind it is live again.
    setLeaving(null);
    setGoing(leaving);
  } else if (leaving && dismissible) {
    // It could have closed and didn't: nothing waits to go later, out of the blue.
    setLeaving(null);
  }
  useEffect(() => {
    going?.go();
  }, [going]);

  const surface = shown?.draw({
    leave: go => {
      setLeaving({ go });
      onOpenChange(false);
    },
    waiting: leaving !== null,
  });
  return { surface, body };
}

/**
 * A bottom sheet with a labelled close, a title, and a body that scrolls.
 *
 * Focus handling is the base-ui dialog's: on open it moves into the sheet —
 * here onto the body, so a screen reader announces the title and the content
 * is immediately scrollable from the keyboard — and on close it returns to
 * whatever opened the sheet.
 */
export function Sheet({ open, onOpenChange, title, detent = 'medium', dismissible = true, ownsUrgent = false, holdClose, returnFocus, children, className }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Short, sentence case. It is the sheet's accessible name. */
  title: string;
  /**
   * The sheet says today's safety decision itself, as the check-in does with
   * its outcome. Every other sheet shows the shared surface at its top while
   * one stands, since the page behind it is out of reach (codex V1-02).
   */
  ownsUrgent?: boolean;
  /**
   * False while the sheet must stay, such as while it saves: a swipe then
   * gives a little and settles back. Pass it alongside an `onOpenChange` that
   * refuses to close at those times.
   */
  dismissible?: boolean;
  /**
   * Asked as the person closes the sheet themselves, with Close or Escape:
   * true keeps it open, its owner asking first (the check-in's "Keep your
   * answers?", F-safety-07). The safety surface's way on closes it all the same.
   */
  holdClose?: () => boolean;
  /** `medium` (about half the screen) unless the content is something to read. */
  detent?: Detent;
  /**
   * Where focus goes on closing when nothing opened the sheet, as when its
   * address opened it: focus would otherwise fall to the page (B-03).
   */
  returnFocus?: () => HTMLElement | null;
  children: ReactNode;
  className?: string;
}) {
  const swipe = useSwipeToDismiss({ open, dismissible, onOpenChange });
  // What had focus as it opened, for `returnFocus` (B-03).
  const opened = useInertBackground(open);
  const { surface, body } = useSurfaceAtTop({ open, dismissible, ownsUrgent, onOpenChange });

  if (useContext(InSheet)) {
    throw new Error('hig/Sheet: sheets must not nest. Push a detail screen from the sheet instead.');
  }

  return (
    <InSheet value>
      <SheetRoot open={open} onOpenChange={next => { if (!next && holdClose?.()) return; onOpenChange(next); }}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          initialFocus={body}
          // The opener when there was one; otherwise `returnFocus`'s element (B-03).
          {...(returnFocus ? { finalFocus: () => (opened.current && opened.current !== document.body && opened.current.isConnected ? true : returnFocus() ?? true) } : {})}
          className={cn(
            'gap-0 rounded-t-2xl bg-grouped-bg text-[length:var(--text-body)] text-foreground',
            // Never taller than the screen, whatever the detent asks for.
            'max-h-[92dvh]',
            HEIGHT[detent],
            className,
          )}
        >
          {/* The grabber and the title bar are what you drag. `touch-none`
              keeps the browser from taking the drag for a scroll. */}
          <div className="@container shrink-0 touch-none select-none border-b border-separator" {...swipe}>
            {/* The grab handle is iOS's cue that the sheet can be dragged. It
                is a picture of an affordance, so it is hidden from assistive
                technology; Close is the way for everyone. */}
            <div aria-hidden className="flex justify-center pt-2">
              <div className="h-1 w-9 rounded-full bg-separator" />
            </div>

            {/* The title is centred between Close and a mirror of it, and
                wraps as far as it needs. When the text is too large for that
                to leave room, Close takes its own line and the title runs the
                full width under it, rather than being cut short (scan S-04). */}
            <div className="flex min-h-12 items-center gap-2 pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] @max-[16rem]:flex-col-reverse @max-[16rem]:items-stretch @max-[16rem]:gap-0 @max-[16rem]:pl-0">
              <span aria-hidden className="invisible shrink-0 px-2 text-[length:var(--text-body)] @max-[16rem]:hidden">Close</span>
              <SheetTitle className="min-w-0 flex-1 py-2.5 text-center text-[length:var(--text-body)] font-semibold leading-tight [overflow-wrap:break-word] @max-[16rem]:pb-3 @max-[16rem]:pl-[min(1rem,20px)] @max-[16rem]:pr-2 @max-[16rem]:pt-0 @max-[16rem]:text-left">
                {title}
              </SheetTitle>
              {/* A word, not a glyph: it reads at any text size, and its hit
                  area is the full height of the bar. */}
              <SheetClose className="flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-lg px-2 text-[length:var(--text-body)] text-tint transition-opacity active:opacity-60 @max-[16rem]:self-end">
                Close
              </SheetClose>
            </div>
          </div>

          {/* A plain block scroller with the flex column *inside* it. If the
              scroller were itself the flex column, a tall child would be
              shrunk to fit rather than overflow — which is precisely how a
              sheet clips its content at 200% text instead of scrolling. */}
          <div
            ref={body}
            tabIndex={-1}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain pl-safe pr-safe outline-none"
          >
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-[min(1rem,20px)] pt-4">
              {surface}
              {children}
            </div>
            {/* Bottom room, and clears the home indicator, so the last row is
                never half under it. */}
            <div aria-hidden className="h-8 pb-safe" />
          </div>
        </SheetContent>
      </SheetRoot>
    </InSheet>
  );
}
