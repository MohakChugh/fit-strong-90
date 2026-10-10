import type { MouseEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CircleUserRoundIcon, CompassIcon, HouseIcon, LineChartIcon, type LucideIcon } from 'lucide-react';
import { shouldAnimate } from '@/design/motion';
import { cn } from '@/lib/utils';
import { currentTab, getNavState, markBack, markTab, rootLink, rootStep, tabLink, useNavStack, type Tab } from './navigation';

/**
 * Four destinations (journey §5, board D39). There is no More tab: anything
 * that does not belong to one of these is a hub, a sheet or a detail pushed
 * from it, and the person's own settings are the Me tab.
 */
const TABS: { tab: Tab; label: string; icon: LucideIcon }[] = [
  { tab: 'home', label: 'Home', icon: HouseIcon },
  { tab: 'trends', label: 'Trends', icon: LineChartIcon },
  { tab: 'browse', label: 'Browse', icon: CompassIcon },
  { tab: 'me', label: 'Me', icon: CircleUserRoundIcon },
];

/** The system's Reduce motion, or the app's own (`data-reduce-motion`, motion rule 4). */
const reduceMotion = () => !shouldAnimate({
  systemReduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  appReduced: document.documentElement.dataset.reduceMotion !== undefined,
});

/**
 * GlassTabBar (journey §20.2): a floating glass capsule above the home
 * indicator on a phone, and a labelled glass sidebar on a wide screen, with
 * the same four places either way. Labels always show, because icon-only tabs
 * are guesswork for anyone who has not learned them, and the bar never
 * shrinks (K-27). The tinted pill marks the selected tab; its label stays in
 * body ink, which is what reads at 4.5:1 on glass over any page (K-28).
 *
 * As iOS keeps each tab's navigation: a tab returns to where it was left,
 * scrolled where it was; tapping the tab already selected pops it to its root,
 * and at the root scrolls to the top. A screen opened from another tab's row
 * keeps that tab selected, as it was pushed there.
 */
export function TabBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const stack = useNavStack();
  const selected = currentTab(stack, pathname);

  const select = (tab: Tab, active: boolean, shown: { to: string }) => (event: MouseEvent) => {
    // A new browser tab or window is the browser's to open.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!active) {
      markTab(tab);
      // Asked again at the tap: the record a place shows may have gone since this drew.
      const place = tabLink(getNavState(), tab);
      if (place.to !== shown.to) {
        event.preventDefault();
        navigate(place.to, { state: place.state });
      }
      return;
    }
    event.preventDefault();
    const step = rootStep(stack, tab);
    if (step === 'top') {
      window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
      return;
    }
    markBack();
    if (step === 'replace') {
      const root = rootLink(stack, tab);
      navigate(root.to, { replace: true, state: root.state });
    } else navigate(step);
  };

  return (
    <nav
      aria-label="Main"
      style={{ viewTransitionName: 'app-nav' }}
      className={cn(
        // Clear of the home indicator and the side safe areas, and no wider than a phone's on a tablet.
        'glass fixed bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-[max(12px,env(safe-area-inset-left))] right-[max(12px,env(safe-area-inset-right))] z-40 mx-auto max-w-[28rem] rounded-full',
        'lg:inset-y-0 lg:left-0 lg:right-auto lg:mx-0 lg:w-60 lg:max-w-none lg:rounded-none lg:pt-safe',
      )}
    >
      <ul className="flex items-stretch p-1 lg:flex-col lg:gap-1 lg:p-3 lg:pt-6">
        {TABS.map(({ tab, label, icon: Icon }) => {
          const active = tab === selected;
          const place = active ? rootLink(stack, tab) : tabLink(stack, tab);
          return (
            <li key={tab} className="flex min-w-0 flex-1 lg:flex-none">
              <Link
                to={place.to}
                state={place.state}
                viewTransition
                aria-current={active ? 'page' : undefined}
                onClick={select(tab, active, place)}
                className={cn(
                  // The pill fades to the tapped tab: a transition on its fill alone, which reduced motion makes instant.
                  // Tabs grow with the text size, but no taller than 72px and no label past 18px, so "Browse"
                  // still fits a quarter of a 320px bar with room between: as iOS does, the bar never outgrows the screen.
                  'flex min-h-[min(3.5rem,72px)] w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-[min(var(--text-footnote),18px)] font-semibold leading-tight transition-colors',
                  'lg:min-h-11 lg:flex-row lg:justify-start lg:gap-3 lg:rounded-lg lg:px-3 lg:text-[length:var(--text-body)]',
                  active ? 'bg-tint/15 text-foreground' : 'text-foreground/80 lg:hover:bg-muted',
                )}
              >
                <Icon className="size-[min(1.5rem,32px)] shrink-0 lg:size-5" strokeWidth={active ? 2.4 : 1.9} aria-hidden />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
