import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { SirenIcon, TriangleAlertIcon } from 'lucide-react';
import { markTab, ScreenTopContext, SheetTopContext } from '@/components/hig/navigation';
import { cn } from '@/lib/utils';
import { RIGHT_NOW_ID, UrgentContext, useUrgent, type Urgent } from './urgent';

/** "Low glucose at 1:30 pm · Re-check at 1:45 pm". */
const lineOf = (u: Urgent) => [u.when, u.next].filter(Boolean).join(' · ');

/** Home's Right now card, where the action is: in view, with the focus. */
function showRightNow(): void {
  const card = document.getElementById(RIGHT_NOW_ID);
  if (!card) return;
  card.focus({ preventScroll: true });
  card.scrollIntoView({ block: 'start' });
}

/**
 * The shared safety surface (journey §4.7, B-02): the engine's headline, when
 * it was measured or answered, and the safe action now. A solid strip in stop
 * or caution fill with words, never colour alone, at the top of every screen,
 * full-screen task and sheet. It is in the first frame with no entrance
 * (motion rule 2), and it can't be dismissed: it goes only when the decision
 * does.
 *
 * "What to do" brings Home's Right now card into view, where the action is;
 * on any other screen it goes to Home. In a sheet (`onLeave`) it closes the
 * sheet first, through the sheet's own close.
 */
export function UrgentBanner({ urgent, onLeave }: { urgent: Urgent; onLeave?: () => void }) {
  const titleId = useId();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const stop = urgent.tone === 'stop';
  const Icon = urgent.kind === 'emergency' ? SirenIcon : TriangleAlertIcon;
  const button = cn(
    'press-feedback flex min-h-12 w-full items-center justify-center rounded-xl border-2 px-4 text-[length:var(--text-body)] font-semibold',
    stop ? 'border-white/90 text-white' : 'border-black/80 text-black',
  );
  const home = pathname === '/home';
  const leave = () => {
    onLeave?.();
    // Once the sheet has gone and the page behind it is live again.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (home) {
        showRightNow();
      } else {
        markTab('home');
        navigate('/home');
      }
    }));
  };
  return (
    <section
      aria-labelledby={titleId}
      data-urgent-kind={urgent.kind}
      className={cn('flex flex-col gap-3 rounded-2xl p-4', stop ? 'bg-stop-fill text-white' : 'bg-caution-fill text-black')}
    >
      <h2 id={titleId} className="flex items-start gap-2 text-[length:var(--text-title-2)] font-bold leading-tight [overflow-wrap:break-word]">
        <Icon className="mt-0.5 size-6 shrink-0" aria-hidden />
        <span className="min-w-0">{urgent.headline}</span>
      </h2>
      <p className="text-[length:var(--text-body)] font-medium leading-snug [overflow-wrap:break-word]">{lineOf(urgent)}</p>
      {onLeave
        ? <button type="button" onClick={leave} className={button}>What to do</button>
        : home
          ? <button type="button" onClick={showRightNow} className={button}>What to do</button>
          : <Link to="/home" onClick={() => markTab('home')} className={button}>What to do</Link>}
    </section>
  );
}

/**
 * The app's side of the surface, above the routes (codex V1-03): works out
 * the urgent decision once (`useUrgent`) and hands it to every screen, which
 * shows it first, to a screen still loading or one that failed, to
 * full-screen tasks (`TaskUrgent`) and to every sheet (codex V1-02). While it
 * stands no view transition runs, and one already running is skipped (motion
 * rule 2, read by `main.tsx` from `data-urgent`). A screen reader hears it
 * once when it arrives or changes, not on every screen, from outside `#app`,
 * which an open sheet makes inert.
 */
export function UrgentProvider({ children }: { children: ReactNode }) {
  const urgent = useUrgent();
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (urgent) root.dataset.urgent = urgent.kind;
    else delete root.dataset.urgent;
  }, [urgent]);
  useEffect(() => () => { delete document.documentElement.dataset.urgent; }, []);
  const banner = useMemo(() => (urgent ? <UrgentBanner urgent={urgent} /> : null), [urgent]);
  const inSheet = useMemo(() => (urgent ? (close: () => void) => <UrgentBanner urgent={urgent} onLeave={close} /> : null), [urgent]);
  return (
    <UrgentContext value={urgent}>
      <ScreenTopContext value={banner}>
        <SheetTopContext value={inSheet}>{children}</SheetTopContext>
      </ScreenTopContext>
      {createPortal(
        <div aria-live="assertive" aria-atomic="true" className="sr-only">{urgent ? `${urgent.headline}. ${lineOf(urgent)}.` : ''}</div>,
        document.body,
      )}
    </UrgentContext>
  );
}

type Kinds = readonly Urgent['kind'][];
const ALL_KINDS: Kinds = ['emergency', 'seekHelp', 'recheck', 'low', 'hold'];
/** A full-screen task's claim that its own screen shows these kinds of decision, until it lets go. */
const ClaimContext = createContext<((kinds: Kinds) => () => void) | null>(null);

/**
 * Rendered by a full-screen task while its own screen shows the safety
 * decision, or these kinds of it: the player's gate, a held walk, a walk
 * that ended for an emergency. The task's surface steps aside, so the
 * decision is said once (codex V1-03).
 */
export function OwnsUrgent({ kinds = ALL_KINDS }: { kinds?: Kinds }) {
  const claim = useContext(ClaimContext);
  const key = kinds.join(' ');
  useLayoutEffect(() => claim?.(key.split(' ') as Kinds), [claim, key]);
  return null;
}

/**
 * The shared surface at the top of a full-screen task (B-02, codex V1-03),
 * unless the task's own screen already shows that decision (`OwnsUrgent`).
 * A screen inside the task does not repeat it.
 */
export function TaskUrgent({ children }: { children: ReactNode }) {
  const urgent = useContext(UrgentContext);
  const banner = useContext(ScreenTopContext);
  const [claims, setClaims] = useState<readonly Kinds[]>([]);
  const claim = useCallback((kinds: Kinds) => {
    setClaims(c => [...c, kinds]);
    return () => setClaims(c => c.filter(k => k !== kinds));
  }, []);
  const shownHere = urgent !== undefined && claims.some(k => k.includes(urgent.kind));
  return (
    <ClaimContext value={claim}>
      {banner && !shownHere && (
        <div className="pb-1 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))]">
          {banner}
        </div>
      )}
      <ScreenTopContext value={null}>{children}</ScreenTopContext>
    </ClaimContext>
  );
}
