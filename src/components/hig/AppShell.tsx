import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './ErrorBoundary';
import { TabBar } from './TabBar';

/**
 * The frame every tab and pushed screen sits in. Screens load on first visit
 * while the tab bar stays put, so a slow chunk never blanks the navigation —
 * and a chunk that fails shows a recovery screen instead of taking the whole
 * app down with it.
 *
 * The bottom padding lets the last row scroll clear of the floating tab bar:
 * the bar's 4rem at most (tabs of up to 3.5rem in 0.25rem of padding), the
 * gap under it, and a little room above it.
 */
export function AppShell() {
  const { pathname } = useLocation();
  return (
    <div className="flex min-h-dvh flex-col bg-grouped-bg">
      <main className="flex flex-1 flex-col pb-[calc(4.5rem+max(0.5rem,env(safe-area-inset-bottom)))] lg:pb-0 lg:pl-60">
        <ErrorBoundary resetKey={pathname}>
          <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      <TabBar />
    </div>
  );
}
