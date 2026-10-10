import { useEffect, useId, useLayoutEffect, useMemo, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SirenIcon, TriangleAlertIcon } from 'lucide-react';
import { markTab, ScreenTopContext } from '@/components/hig/navigation';
import { cn } from '@/lib/utils';
import { RIGHT_NOW_ID, UrgentContext, useUrgent, type Urgent } from './urgent';

/** "Low glucose at 1:30 pm · Re-check at 1:45 pm". */
const lineOf = (u: Urgent) => [u.when, u.next].filter(Boolean).join(' · ');

/**
 * The shared safety surface (journey §4.7, B-02): the engine's headline, when
 * it was measured or answered, and the safe action now. A solid strip in stop
 * or caution fill with words, never colour alone, at the top of every tab
 * screen. It is in the first frame with no entrance (motion rule 2), and it
 * can't be dismissed: it goes only when the decision does.
 *
 * "What to do" brings Home's Right now card into view, where the action is;
 * on any other screen it goes to Home.
 */
export function UrgentBanner({ urgent }: { urgent: Urgent }) {
  const titleId = useId();
  const { pathname } = useLocation();
  const stop = urgent.tone === 'stop';
  const Icon = urgent.kind === 'emergency' ? SirenIcon : TriangleAlertIcon;
  const button = cn(
    'press-feedback flex min-h-12 w-full items-center justify-center rounded-xl border-2 px-4 text-[length:var(--text-body)] font-semibold',
    stop ? 'border-white/90 text-white' : 'border-black/80 text-black',
  );
  const show = () => {
    const card = document.getElementById(RIGHT_NOW_ID);
    if (!card) return;
    card.focus({ preventScroll: true });
    card.scrollIntoView({ block: 'start' });
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
      {pathname === '/home'
        ? <button type="button" onClick={show} className={button}>What to do</button>
        : <Link to="/home" onClick={() => markTab('home')} className={button}>What to do</Link>}
    </section>
  );
}

/**
 * The shell's side of the surface: works out the urgent decision once
 * (`useUrgent`) and hands it to every screen in the shell, which shows it
 * first. While it stands no view transition runs, and one already running is
 * skipped (motion rule 2, read by `main.tsx` from `data-urgent`). A screen
 * reader hears it once when it arrives or changes, not on every screen.
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
  return (
    <UrgentContext value={urgent}>
      <ScreenTopContext value={banner}>{children}</ScreenTopContext>
      <div role="alert" className="sr-only">{urgent ? `${urgent.headline}. ${lineOf(urgent)}.` : ''}</div>
    </UrgentContext>
  );
}
