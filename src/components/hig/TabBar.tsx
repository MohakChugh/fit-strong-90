import type { MouseEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BookOpenIcon, HeartPulseIcon, HouseIcon, type LucideIcon, WavesIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { currentTab, getNavState, markBack, markTab, rootLink, rootStep, tabLink, useNavStack, type Tab } from './navigation';

/**
 * Four destinations, each answering one question (board D4). There is no More
 * tab: anything that does not belong to one of these is a sheet or a detail
 * pushed from it, and personal settings live behind the `You` button in each
 * root screen's bar.
 */
const TABS: { tab: Tab; label: string; icon: LucideIcon }[] = [
  { tab: 'today', label: 'Today', icon: HouseIcon },
  { tab: 'move', label: 'Move', icon: WavesIcon },
  { tab: 'track', label: 'Track', icon: HeartPulseIcon },
  { tab: 'guide', label: 'Guide', icon: BookOpenIcon },
];

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A bottom tab bar on a phone and a labelled sidebar on a wide screen: the
 * same four places either way, so nothing has to be relearned on a laptop.
 * Fixed rather than sticky, with the shell padding for it, which is what the
 * old navigation used and what was checked at 320×568 and 390×844.
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
        'fixed inset-x-0 bottom-0 z-40 border-t border-separator bg-grouped-bg/85 pb-safe backdrop-blur-xl supports-backdrop-filter:bg-grouped-bg/70',
        'lg:inset-x-auto lg:inset-y-0 lg:left-0 lg:w-60 lg:border-t-0 lg:border-r lg:pb-0 lg:pt-safe',
      )}
    >
      <ul className="flex items-stretch pl-safe pr-safe lg:flex-col lg:gap-1 lg:p-3 lg:pt-6">
        {TABS.map(({ tab, label, icon: Icon }) => {
          const active = tab === selected;
          const place = active ? rootLink(stack, tab) : tabLink(stack, tab);
          return (
            <li key={tab} className="flex-1 lg:flex-none">
              <Link
                to={place.to}
                state={place.state}
                viewTransition
                aria-current={active ? 'page' : undefined}
                onClick={select(tab, active, place)}
                className={cn(
                  // 49pt is the iOS tab-bar height; the label stays visible because
                  // icon-only tabs are guesswork for anyone who has not learned them.
                  'flex h-[3.0625rem] flex-col items-center justify-center gap-0.5 text-[0.625rem] font-medium transition-colors',
                  'lg:h-11 lg:flex-row lg:justify-start lg:gap-3 lg:rounded-lg lg:px-3 lg:text-[length:var(--text-body)]',
                  active ? 'text-tint lg:bg-tint/10' : 'text-muted-foreground lg:text-foreground lg:hover:bg-muted',
                )}
              >
                <Icon className="size-6 lg:size-5" strokeWidth={active ? 2.4 : 1.9} aria-hidden />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
