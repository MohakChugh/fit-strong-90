import { Suspense, useContext } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ErrorBoundary } from './ErrorBoundary';
import { ScreenTopContext } from './navigation';
import { TabBar } from './TabBar';
import { useToastSpace } from './toastSpace';

/**
 * While a screen's code loads: nothing of the screen yet, but the shared
 * safety surface already, as the screen would show it first (codex V1-03,
 * journey §4.7). `full` fills the whole page, outside the shell.
 */
export function ScreenLoading({ full = false }: { full?: boolean }) {
  const first = useContext(ScreenTopContext);
  return (
    <div aria-busy="true" className={cn('bg-grouped-bg', full ? 'min-h-dvh' : 'flex-1')}>
      {first && <div className="px-[max(min(1rem,20px),env(safe-area-inset-left))] pt-[max(0.75rem,env(safe-area-inset-top))]">{first}</div>}
    </div>
  );
}

/**
 * The frame every tab and pushed screen sits in. Screens load on first visit
 * while the tab bar stays put, so a slow chunk never blanks the navigation —
 * and a chunk that fails shows a recovery screen instead of taking the whole
 * app down with it.
 *
 * The bottom padding lets the last row scroll clear of the floating tab bar:
 * the bar's 4rem at most (tabs of up to 3.5rem in 0.25rem of padding), the
 * gap under it, and a little room above it. While toasts stand above the
 * bar, the room they take is kept under the screen too (`useToastSpace`).
 *
 * Every screen in it shows the shared safety surface first (journey §4.7,
 * B-02): Trends, Browse, Me and the hubs as well as Home. The app owns the
 * decision above the routes (`UrgentProvider`), so a screen still loading,
 * or one that failed, shows it as well.
 */
export function AppShell() {
  const { pathname } = useLocation();
  const first = useContext(ScreenTopContext);
  const toasts = useToastSpace();
  return (
    <div className="flex min-h-dvh flex-col bg-grouped-bg">
      <main className="flex flex-1 flex-col pb-[calc(4.5rem+max(0.5rem,env(safe-area-inset-bottom)))] lg:pb-0 lg:pl-60">
        <ErrorBoundary resetKey={pathname} before={first}>
          <Suspense fallback={<ScreenLoading />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
        {toasts > 0 && <div aria-hidden className="shrink-0" style={{ height: toasts }} />}
      </main>
      <TabBar />
    </div>
  );
}
