import { createContext, useContext, useLayoutEffect, useRef, type PointerEvent, type ReactNode } from 'react';
import {
  Sheet as SheetRoot,
  SheetClose,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
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
 * While any sheet is open, the screen behind it is inert: out of the tab
 * order, the accessibility tree and the pointer's reach, as behind an iOS
 * sheet. The sheet itself is portalled to <body>, outside #app, so it stays
 * live, and so do toasts. Counted, so a sheet closing while another opens
 * never wakes the page.
 */
let openSheets = 0;
function useInertBackground(open: boolean) {
  // A layout effect, so the page wakes in the same commit that closes the
  // sheet, before the dialog hands focus back to whatever opened it.
  useLayoutEffect(() => {
    const root = document.getElementById('app');
    if (!open || !root) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (openSheets++ === 0) root.inert = true;
    return () => {
      if (--openSheets === 0) root.inert = false;
      // If the hand-back raced the wake-up and focus fell to the page, finish it.
      requestAnimationFrame(() => {
        if (document.activeElement === document.body && opener?.isConnected) opener.focus({ preventScroll: true });
      });
    };
  }, [open]);
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
 * A bottom sheet with a labelled close, a title, and a body that scrolls.
 *
 * Focus handling is the base-ui dialog's: on open it moves into the sheet —
 * here onto the body, so a screen reader announces the title and the content
 * is immediately scrollable from the keyboard — and on close it returns to
 * whatever opened the sheet.
 */
export function Sheet({ open, onOpenChange, title, detent = 'medium', dismissible = true, children, className }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Short, sentence case. It is the sheet's accessible name. */
  title: string;
  /**
   * False while the sheet must stay, such as while it saves: a swipe then
   * gives a little and settles back. Pass it alongside an `onOpenChange` that
   * refuses to close at those times.
   */
  dismissible?: boolean;
  /** `medium` (about half the screen) unless the content is something to read. */
  detent?: Detent;
  children: ReactNode;
  className?: string;
}) {
  const body = useRef<HTMLDivElement>(null);
  const swipe = useSwipeToDismiss({ open, dismissible, onOpenChange });
  useInertBackground(open);

  if (useContext(InSheet)) {
    throw new Error('hig/Sheet: sheets must not nest. Push a detail screen from the sheet instead.');
  }

  return (
    <InSheet value>
      <SheetRoot open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          initialFocus={body}
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
            <div className="flex min-h-11 items-center gap-2 pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] @max-[16rem]:flex-col-reverse @max-[16rem]:items-stretch @max-[16rem]:gap-0 @max-[16rem]:pl-0">
              <span aria-hidden className="invisible shrink-0 px-2 text-[length:var(--text-body)] @max-[16rem]:hidden">Close</span>
              <SheetTitle className="min-w-0 flex-1 py-2.5 text-center text-[length:var(--text-body)] font-semibold leading-tight [overflow-wrap:break-word] @max-[16rem]:pb-3 @max-[16rem]:pl-[min(1rem,20px)] @max-[16rem]:pr-2 @max-[16rem]:pt-0 @max-[16rem]:text-left">
                {title}
              </SheetTitle>
              {/* A word, not a glyph: it reads at any text size, and its hit
                  area is the full height of the bar. */}
              <SheetClose className="flex min-h-11 shrink-0 items-center rounded-lg px-2 text-[length:var(--text-body)] text-tint transition-opacity active:opacity-60 @max-[16rem]:self-end">
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
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-[min(1rem,20px)] pt-4">{children}</div>
            {/* Bottom room, and clears the home indicator, so the last row is
                never half under it. */}
            <div aria-hidden className="h-8 pb-safe" />
          </div>
        </SheetContent>
      </SheetRoot>
    </InSheet>
  );
}
