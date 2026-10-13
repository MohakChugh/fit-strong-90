import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { SirenIcon, TriangleAlertIcon } from 'lucide-react';
import { AnsweringStopContext, useSayWhatHappened } from '@/components/checkin/sayWhatHappened';
import { markTab, ScreenTopContext, SheetTopContext, type SheetExit } from '@/components/hig/navigation';
import { PauseClaimContext } from '@/components/profile/pauseClaim';
import { CLINICAL_UNSAVED } from '@/engine/readiness';
import { cn } from '@/lib/utils';
import { discardClinical, retryClinical, useClinicalUnsaved } from '@/setup/effective';
import { RIGHT_NOW_ID, UrgentContext, UrgentsContext, says, useUrgents, type Urgent } from './urgent';
import { SayWhatHappenedProvider } from './SayWhatHappened';

/** Said in a sheet while its way on waits for it to finish saving (codex W-05). */
const WAITING = 'Waiting for this to finish saving.';

/** "Low glucose at 1:30 pm · Re-check at 1:45 pm". */
const lineOf = (u: Urgent) => [u.when, u.next].filter(Boolean).join(' · ');

/** The surface's buttons, in its stop or caution ink. */
const buttonIn = (stop: boolean) => cn(
  'press-feedback flex min-h-12 w-full items-center justify-center rounded-xl border-2 px-4 text-[length:var(--text-body)] font-semibold',
  stop ? 'border-white/90 text-white' : 'border-black/80 text-black',
);

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
 * stop's own questions, here, after any sheet has closed (K6R-03). Over those
 * questions it says every decision but that stop, the one they answer: an
 * emergency reported there shows in them at once (H6F-01, board D212).
 */
export function UrgentBanner({ urgent, exit }: { urgent: Urgent; exit?: SheetExit }) {
  const titleId = useId();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const stop = urgent.tone === 'stop';
  const Icon = urgent.kind === 'emergency' ? SirenIcon : TriangleAlertIcon;
  const button = buttonIn(stop);
  const home = pathname === '/home';
  const say = useSayWhatHappened();
  const stopFirst = urgent.stop && say;
  // Over the stop's own questions, the stop is what they answer: every other decision is said there (H6F-01).
  const answering = useContext(AnsweringStopContext);
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
  if (answering && urgent.stop) return null;
  return (
    <section
      aria-labelledby={titleId}
      data-urgent-kind={urgent.kind}
      className={cn('@container flex flex-col gap-3 rounded-2xl p-4', stop ? 'bg-stop-fill text-white' : 'bg-caution-fill text-black')}
    >
      {/* Narrow for its text size (200% on a 320 px phone), the icon goes above the headline, so every word
          keeps the card's width whole rather than breaking mid-word (Plan 6's report). */}
      <h2 id={titleId} className="flex items-start gap-2 text-[length:var(--text-title-2)] font-bold leading-tight [overflow-wrap:break-word] @max-[12rem]:flex-col">
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

/** Says what became of the pause once the surface's way out of it was taken, from outside `#app` (`UrgentProvider`). */
const PauseNewsContext = createContext<(text: string) => void>(() => {});
/** Whether the pause stands, as the shell worked it out, for a full-screen task's surface (`TaskUrgent`). */
const PausedContext = createContext(false);

/** Where focus goes once the way out has gone with the pause (B-03): the sheet it was in, or the screen's title. */
const landingFor = (from: HTMLElement | null): HTMLElement | null =>
  from?.closest?.<HTMLElement>('[role="dialog"] [tabindex="-1"]') ?? document.querySelector<HTMLElement>('main h1');

/**
 * The pause on the shared surface (boards D197, D224): while a clinical answer
 * couldn't be stored, "Your health answers aren't saved, so movement is
 * paused.", with Try again and Discard changes. Last, after whatever other
 * decision stands: beside every one, never instead of one. Tried again and
 * refused, it says so and stays. Stored or not kept, it goes with the pause:
 * what happened is said, and focus goes where `landingFor` says.
 */
function PauseBanner() {
  const titleId = useId();
  const tell = useContext(PauseNewsContext);
  const section = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  const button = buttonIn(false);
  const gone = (text: string, landing: HTMLElement | null) => {
    tell(text);
    requestAnimationFrame(() => landing?.focus({ preventScroll: true }));
  };
  const retry = async () => {
    if (busy) return;
    const landing = landingFor(section.current);
    setBusy(true);
    const saved = await retryClinical();
    setBusy(false);
    if (!saved) return;
    if (saved.ok) gone('Saved. Movement follows your health answers again.', landing);
    else setProblem(`That did not save. ${saved.failure.message}`);
  };
  const discard = () => {
    const landing = landingFor(section.current);
    discardClinical();
    gone('Not kept. The health answers stored before stand.', landing);
  };
  return (
    <section ref={section} aria-labelledby={titleId} data-urgent-pause="" className="flex flex-col gap-3 rounded-2xl bg-caution-fill p-4 text-black">
      <h2 id={titleId} className="flex items-start gap-2 text-[length:var(--text-title-2)] font-bold leading-tight [overflow-wrap:break-word]">
        <TriangleAlertIcon className="mt-0.5 size-6 shrink-0" aria-hidden />
        <span className="min-w-0">{CLINICAL_UNSAVED}</span>
      </h2>
      {problem && <p role="alert" className="text-[length:var(--text-body)] font-medium leading-snug [overflow-wrap:break-word]">{problem}</p>}
      <button type="button" onClick={() => void retry()} className={button}>{busy ? 'Saving…' : 'Try again'}</button>
      <button type="button" onClick={discard} className={button}>Discard changes</button>
    </section>
  );
}

/**
 * Everything the shared surface says, at once and in order (journey §4.7,
 * board D224): each decision that stands (`urgentsOf`), then the pause while
 * health answers aren't saved, beside them and never instead of one. Beside an
 * emergency, which stands alone, nothing: its caller leaves the pause out.
 */
function SafetySurface({ urgents, paused, exit }: { urgents: readonly Urgent[]; paused: boolean; exit?: SheetExit }) {
  return (
    <div className="flex flex-col gap-3">
      {urgents.map(u => <UrgentBanner key={u.kind} urgent={u} {...(exit ? { exit } : {})} />)}
      {paused && <PauseBanner />}
    </div>
  );
}

/**
 * The app's side of the surface, above the routes (codex V1-03): works out
 * the urgent decisions once (`useUrgents`) and hands them to every screen,
 * which shows them first, to a screen still loading or one that failed, to
 * full-screen tasks (`TaskUrgent`) and to every sheet (codex V1-02), with the
 * pause after them while health answers aren't saved, but never beside an
 * emergency (board D224). While a decision stands no view transition runs,
 * and one already running is skipped (motion rule 2, read by `main.tsx` from
 * `data-urgent`). A screen reader hears them once when they arrive or change,
 * not on every screen, from outside `#app`, which an open sheet makes inert;
 * and hears there what became of the pause once its way out was taken.
 */
export function UrgentProvider({ children }: { children: ReactNode }) {
  const urgents = useUrgents();
  const urgent = urgents[0];
  // An emergency stands alone: "call now", with nothing beside it.
  const paused = useClinicalUnsaved() && urgent?.kind !== 'emergency';
  const [news, setNews] = useState({ text: '', n: 0 });
  const tell = useCallback((text: string) => setNews(was => ({ text, n: was.n + 1 })), []);
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (urgent) root.dataset.urgent = urgent.kind;
    else delete root.dataset.urgent;
  }, [urgent]);
  useEffect(() => () => { delete document.documentElement.dataset.urgent; }, []);
  const banner = useMemo(() => (urgents.length > 0 || paused ? <SafetySurface urgents={urgents} paused={paused} /> : null), [urgents, paused]);
  const inSheet = useMemo(() => (urgents.length > 0 || paused
    ? {
      key: [...urgents.flatMap(u => [u.kind, u.headline, u.when]), ...(paused ? ['unsaved'] : [])].join('|'),
      draw: (exit: SheetExit) => <SafetySurface urgents={urgents} paused={paused} exit={exit} />,
    }
    : null), [urgents, paused]);
  // The stop's shared questions sit under the sheets' surface too, so a report there that is an
  // emergency says so in them at once, before and whatever its save (H6F-01, board D212).
  return (
    <UrgentContext value={urgent}>
      <UrgentsContext value={urgents}>
        <PauseNewsContext value={tell}>
          <PausedContext value={paused}>
            <ScreenTopContext value={banner}>
              <SheetTopContext value={inSheet}>
                <SayWhatHappenedProvider>{children}</SayWhatHappenedProvider>
              </SheetTopContext>
            </ScreenTopContext>
          </PausedContext>
        </PauseNewsContext>
      </UrgentsContext>
      {createPortal(
        <div aria-live="assertive" aria-atomic="true" className="sr-only">{urgents.map(u => `${u.headline}. ${lineOf(u)}.`).join(' ')}</div>,
        document.body,
      )}
      {/* Said again when the words repeat: each is its own line. */}
      {createPortal(<div aria-live="polite" className="sr-only"><p key={news.n}>{news.text}</p></div>, document.body)}
    </UrgentContext>
  );
}

/** A full-screen task's own stop questions are open (`AnsweringStop`). */
const AnsweringClaimContext = createContext<(() => () => void) | null>(null);

/**
 * Rendered while a full-screen task's own stop questions are open (the
 * player's "Stop: something's wrong", F-safety-02): its surface says every
 * decision but the stop they answer, as over the shared stop questions
 * (H6F-01, board D212).
 */
export function AnsweringStop() {
  const claim = useContext(AnsweringClaimContext);
  useLayoutEffect(() => claim?.(), [claim]);
  return null;
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
 * all but what the task's own screen already says: each decision it draws
 * (`OwnsUrgent`, `says`), and the way out of the pause (`UnsavedClinical`,
 * board D224), so each is said once. A screen inside the task does not
 * repeat it.
 */
export function TaskUrgent({ children }: { children: ReactNode }) {
  const urgents = useContext(UrgentsContext);
  const paused = useContext(PausedContext);
  const banner = useContext(ScreenTopContext);
  const [claims, setClaims] = useState<readonly Drawn[]>([]);
  const claim = useCallback((drawn: Drawn) => {
    setClaims(c => [...c, drawn]);
    return () => setClaims(c => c.filter(k => k !== drawn));
  }, []);
  const [ways, setWays] = useState(0);
  const claimPause = useCallback(() => {
    setWays(n => n + 1);
    return () => setWays(n => n - 1);
  }, []);
  const [answering, setAnswering] = useState(0);
  const claimAnswering = useCallback(() => {
    setAnswering(n => n + 1);
    return () => setAnswering(n => n - 1);
  }, []);
  const left = urgents.filter(u => !claims.some(drawn => says(drawn, u)) && !(answering > 0 && u.stop));
  const pauseHere = paused && ways > 0;
  const top = left.length === urgents.length && !pauseHere ? banner
    : (left.length > 0 || (paused && !pauseHere)) && <SafetySurface urgents={left} paused={paused && !pauseHere} />;
  return (
    <ClaimContext value={claim}>
      <AnsweringClaimContext value={claimAnswering}>
      <PauseClaimContext value={claimPause}>
        {top && (
          <div className="pb-1 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))]">
            {top}
          </div>
        )}
        <ScreenTopContext value={null}>{children}</ScreenTopContext>
      </PauseClaimContext>
      </AnsweringClaimContext>
    </ClaimContext>
  );
}
