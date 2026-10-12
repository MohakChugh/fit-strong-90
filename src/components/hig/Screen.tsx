import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeftIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  backLabelFit, backTarget, markBack, markShown, setTitle, takeFocusRequest, useInTaskFrame, useNavStack,
} from './navigation';
import { StorageBanner } from './StorageBanner';

/**
 * A screen with the large title iOS uses: the title sits in the content and
 * scrolls away, while a compact title fades into the bar above it. That one
 * movement is what makes a list feel native, and it costs no library — an
 * IntersectionObserver on a sentinel tells us when the big title has passed
 * under the bar.
 *
 * Pushed screens pass `back`, their parent. Like a navigation controller, Back
 * pops one entry, to the screen the person came from, and is named after it;
 * with nothing in this tab to pop to (a fresh launch, a place a tab came back
 * to) it replaces this entry with the opener the navigation state names, or
 * with `back` (see `backTarget`).
 */
export function Screen({ title, subtitle, back, trailing, inline, children, className }: {
  title: string;
  /** A quiet line under the large title, e.g. the date on Today. */
  subtitle?: ReactNode;
  /** The screen this one belongs under. */
  back?: { to: string; label: string };
  /** Usually the `You` button on a root screen, or an Add button. */
  trailing?: ReactNode;
  /** A compact title from the start, for task screens that need the room. */
  inline?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const stack = useNavStack();
  const framed = useInTaskFrame();
  const header = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const topSentinel = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  // The bar turns solid as soon as the large title starts to pass under it,
  // so the title never slides beneath a transparent bar and over Back; the
  // small title fades in as soon as the large one has gone.
  const [underBar, setUnderBar] = useState(false);
  // The bar's real height: the top safe area (notch), the storage notice when
  // one shows, then the 44px bar. The title counts as gone once it is under it.
  const [headerHeight, setHeaderHeight] = useState(44);
  const collapsed = inline || scrolled;
  const target = back ? backTarget(stack, back, location.state) : undefined;

  useEffect(() => {
    const el = header.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setHeaderHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = sentinel.current;
    const top = topSentinel.current;
    if (inline || !el || !top || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.target === el) setScrolled(!e.isIntersecting);
          else setUnderBar(!e.isIntersecting);
        }
      },
      { rootMargin: `-${headerHeight}px 0px 0px 0px`, threshold: 0 },
    );
    io.observe(el);
    io.observe(top);
    return () => io.disconnect();
  }, [inline, headerHeight]);

  useEffect(() => {
    document.title = `${title} · FitStrong`;
    // So the Back button of the next screen can say where it goes.
    setTitle(location.pathname, title);
  }, [title, location.pathname, location.key]);

  useEffect(() => {
    // After a navigation, move focus to the new screen's title so a screen
    // reader announces where the person now is. Not on launch, and never out
    // of a sheet that is open. Decided here, from the navigation itself, so
    // the order in which React runs effects cannot make it a screen late.
    if (takeFocusRequest(location.pathname) && !document.activeElement?.closest('[role="dialog"]')) {
      heading.current?.focus({ preventScroll: true });
    }
    markShown();
  }, [location.pathname]);

  const goBack = () => {
    if (!target) return;
    markBack();
    if (target.pop) navigate(-1);
    else navigate(target.to, { replace: true, state: target.state });
  };

  return (
    <div className={cn('bg-grouped-bg', className)}>
      <div ref={header} className="sticky top-0 z-30 pt-safe">
        {!framed && <StorageBanner inHeader />}
        <div className={cn(
          'grid h-11 items-center gap-2 px-2 pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] transition-colors duration-200',
          // Equal sides centre the compact title; until it shows, Back may use
          // whatever the trailing items leave, so a parent's name fits more often.
          collapsed ? 'grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]' : 'grid-cols-[minmax(0,1fr)_auto_auto]',
          (collapsed || underBar) && 'bg-grouped-bg/85 backdrop-blur-xl supports-backdrop-filter:bg-grouped-bg/70',
          collapsed && 'border-b border-separator',
        )}>
          <div className="flex min-w-0 items-center">
            {target && <BackButton label={target.label} onClick={goBack} />}
          </div>
          {/* A visual duplicate of the h1 below; the h1 is the one exposed. */}
          <span
            aria-hidden
            className={cn(
              'truncate text-center text-[length:var(--text-body)] font-semibold transition-[opacity,transform] duration-200',
              // Hidden, it takes no width, so a long back label is not squeezed for a title nobody can see.
              collapsed ? 'max-w-[50vw] translate-y-0 opacity-100' : 'pointer-events-none max-w-0 translate-y-1 opacity-0',
            )}
          >
            {title}
          </span>
          <div className="flex min-w-0 items-center justify-end">{trailing}</div>
        </div>
      </div>

      {inline ? (
        <h1 ref={heading} tabIndex={-1} className="sr-only">{title}</h1>
      ) : (
        <>
          <div ref={topSentinel} aria-hidden className="h-px" />
          <div className="mx-auto w-full max-w-2xl pb-4 pl-[max(min(1rem,20px),env(safe-area-inset-left))] pr-[max(min(1rem,20px),env(safe-area-inset-right))]">
            <h1 ref={heading} tabIndex={-1} className="text-[length:var(--text-large-title)] font-bold leading-tight tracking-tight outline-none [overflow-wrap:break-word] hyphens-auto">
              {title}
            </h1>
            {/* Straight under the title, not under the subtitle and padding:
                the compact title shows as soon as the large one is under the bar. */}
            <div ref={sentinel} aria-hidden className="h-px" />
            {subtitle && <p className="text-[length:var(--text-subhead)] text-muted-foreground">{subtitle}</p>}
          </div>
        </>
      )}

      {/* The side margins grow with the text up to 20px and no further, as
          iOS keeps its layout margins: at 200% the content needs the width. */}
      <div className={cn(
        'mx-auto flex w-full max-w-2xl flex-col gap-6 pb-8',
        'pl-[max(min(1rem,20px),env(safe-area-inset-left))] pr-[max(min(1rem,20px),env(safe-area-inset-right))]',
        inline && 'pt-4',
      )}>
        {children}
      </div>
    </div>
  );
}

/**
 * Back, with its text fitted the way iOS fits it beside a title: the parent's
 * name when it fits, "Back" when that fits, else the chevron alone. Measured
 * rather than truncated, since "Food & di…" names nothing. The button keeps
 * the full name for VoiceOver whatever shows.
 */
function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  const button = useRef<HTMLButtonElement>(null);
  const chevron = useRef<SVGSVGElement>(null);
  const full = useRef<HTMLSpanElement>(null);
  const short = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState<'full' | 'short' | 'none'>('full');

  useLayoutEffect(() => {
    const el = button.current;
    const cell = el?.parentElement;
    if (!el || !cell || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const style = getComputedStyle(el);
      // Everything in the cell that is not the text: the chevron, the gap and
      // the padding, less the margin that lets the chevron sit in the bar's own.
      const chrome = (chevron.current?.getBoundingClientRect().width ?? 0) + (parseFloat(style.columnGap) || 0)
        + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + parseFloat(style.marginLeft);
      setFit(backLabelFit(cell.clientWidth - chrome, full.current?.offsetWidth ?? 0, short.current?.offsetWidth ?? 0));
    };
    // An observer reports once as soon as it starts, after layout and before
    // paint, so the first fit is never seen wrong.
    const ro = new ResizeObserver(measure);
    ro.observe(cell);
    // The text's own width changes with the person's text size.
    if (full.current) ro.observe(full.current);
    return () => ro.disconnect();
  }, [label]);

  return (
    <button
      ref={button}
      type="button"
      onClick={onClick}
      aria-label={label === 'Back' ? 'Back' : `Back to ${label}`}
      className="press-feedback relative -ml-1 flex min-h-11 min-w-11 max-w-full items-center gap-0.5 pr-2 text-[length:var(--text-body)] text-tint"
    >
      <ChevronLeftIcon ref={chevron} className="size-6 shrink-0" strokeWidth={2.2} aria-hidden />
      {fit !== 'none' && <span className="min-w-0 truncate">{fit === 'full' ? label : 'Back'}</span>}
      {/* The two candidates, measured at their natural width and never seen. */}
      <span aria-hidden className="pointer-events-none invisible absolute left-0 top-0 h-0 w-0 overflow-hidden">
        <span ref={full} className="inline-block whitespace-nowrap">{label}</span>
        <span ref={short} className="inline-block whitespace-nowrap">Back</span>
      </span>
    </button>
  );
}
