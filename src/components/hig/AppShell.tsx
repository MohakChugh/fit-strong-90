import { Suspense } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { CircleUserRoundIcon } from 'lucide-react';
import { ErrorBoundary } from './ErrorBoundary';
import { TabBar } from './TabBar';

/**
 * The frame every tab and pushed screen sits in. Screens load on first visit
 * while the tab bar stays put, so a slow chunk never blanks the navigation —
 * and a chunk that fails shows a recovery screen instead of taking the whole
 * app down with it.
 */
export function AppShell() {
  const { pathname } = useLocation();
  return (
    <div className="flex min-h-dvh flex-col bg-grouped-bg">
      <main className="flex flex-1 flex-col pb-[calc(3.0625rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-60">
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

/**
 * Personal settings, from the bar of each root screen. A person, not a cog:
 * what is behind it is about them (profile, health, data), not the app.
 */
export function YouButton() {
  return (
    <Link
      to="/you"
      viewTransition
      aria-label="You: profile, reminders and data"
      className="press-feedback flex size-11 items-center justify-center rounded-full text-tint"
    >
      <CircleUserRoundIcon className="size-7" strokeWidth={1.8} aria-hidden />
    </Link>
  );
}
