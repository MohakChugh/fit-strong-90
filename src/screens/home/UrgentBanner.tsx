import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { SirenIcon, TriangleAlertIcon } from 'lucide-react';
import { useSayWhatHappened } from '@/components/checkin/sayWhatHappened';
import { markTab, ScreenTopContext, SheetTopContext, type SheetExit } from '@/components/hig/navigation';
import { cn } from '@/lib/utils';
import { RIGHT_NOW_ID, UrgentContext, says, useUrgent, type Urgent } from './urgent';
import { SayWhatHappenedProvider } from './SayWhatHappened';

/** Said in a sheet while its way on waits for it to finish saving (codex W-05). */
const WAITING = 'Waiting for this to finish saving.';

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
 * on any other screen it goes to Home. In a sheet (`exit`) it closes the
 * sheet first, through the sheet's own close, and goes on only once the sheet
 * has closed: never from under a sheet still saving (codex W-05). For an
 * unanswered "I need to stop" the safe action is "Say what happened": the
 * stop's own questions, here, after any sheet has closed (K6R-03).
 */
export function UrgentBanner({ urgent, exit }: { urgent: Urgent; exit?: SheetExit }) {
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
  const say = useSayWhatHappened();
  const stopFirst = urgent.stop && say;
  const leave = () => exit?.leave(() => {
    // The sheet has closed: once its dialog has handed focus back, and the page behind it is live again.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (home) {
        showRightNow();
      } else {
        markTab('home');
        navigate('/home');
      }
    }));
  });
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
      {stopFirst
        ? <button type="button" onClick={() => (exit ? exit.leave(() => requestAnimationFrame(() => requestAnimationFrame(say))) : say())} className={button}>Say what happened</button>
        : exit
        ? <button type="button" onClick={leave} className={button}>What to do</button>
        : home
          ? <button type="button" onClick={showRightNow} className={button}>What to do</button>
          : <Link to="/home" onClick={() => markTab('home')} className={button}>What to do</Link>}
      {exit?.waiting && <p aria-hidden className="text-[length:var(--text-body)] font-medium leading-snug">{WAITING}</p>}
      {/* In the page from the start, so a screen reader hears the wait when it begins. */}
      {exit && <span aria-live="polite" className="sr-only">{exit.waiting ? WAITING : ''}</span>}
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
  const inSheet = useMemo(() => (urgent
    ? { key: [urgent.kind, urgent.headline, urgent.when].join('|'), draw: (exit: SheetExit) => <UrgentBanner urgent={urgent} exit={exit} /> }
    : null), [urgent]);
  return (
    <UrgentContext value={urgent}>
      <SayWhatHappenedProvider>
        <ScreenTopContext value={banner}>
          <SheetTopContext value={inSheet}>{children}</SheetTopContext>
        </ScreenTopContext>
      </SayWhatHappenedProvider>
      {createPortal(
        <div aria-live="assertive" aria-atomic="true" className="sr-only">{urgent ? `${urgent.headline}. ${lineOf(urgent)}.` : ''}</div>,
        document.body,
      )}
    </UrgentContext>
  );
}

/** The gate's answer as a full-screen task's own screen draws it: how firmly it refuses, and the reasons it lists. */
type Drawn = Parameters<typeof says>[0];
/** A full-screen task's claim that its own screen draws this answer, until it lets go. */
const ClaimContext = createContext<((drawn: Drawn) => () => void) | null>(null);

/**
 * Rendered with the gate's answer a full-screen task's own screen draws, as
 * it draws it now: the player's gate, a held walk. Only while that answer is
 * the urgent decision standing now (`says`) does the task's surface step
 * aside, so the decision is said once (codex V1-03). A screen still showing
 * an older or another answer hides nothing (codex W-01).
 */
export function OwnsUrgent({ shows }: { shows: Drawn }) {
  const claim = useContext(ClaimContext);
  // By its words, so drawing the same answer again is the same claim.
  const key = JSON.stringify([shows.allowed, shows.disposition, shows.reasons]);
  useLayoutEffect(() => {
    if (!claim) return;
    const [allowed, disposition, reasons] = JSON.parse(key) as [Drawn['allowed'], Drawn['disposition'], Drawn['reasons']];
    return claim({ allowed, disposition, reasons });
  }, [claim, key]);
  return null;
}

/**
 * The shared surface at the top of a full-screen task (B-02, codex V1-03),
 * unless the task's own screen already says that very decision
 * (`OwnsUrgent`, `says`). A screen inside the task does not repeat it.
 */
export function TaskUrgent({ children }: { children: ReactNode }) {
  const urgent = useContext(UrgentContext);
  const banner = useContext(ScreenTopContext);
  const [claims, setClaims] = useState<readonly Drawn[]>([]);
  const claim = useCallback((drawn: Drawn) => {
    setClaims(c => [...c, drawn]);
    return () => setClaims(c => c.filter(k => k !== drawn));
  }, []);
  const shownHere = urgent !== undefined && claims.some(drawn => says(drawn, urgent));
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
