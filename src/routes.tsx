import { lazy } from 'react';
import type React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '@/components/hig/AppShell';
import { ErrorBoundary } from '@/components/hig/ErrorBoundary';
import { TaskFrame } from '@/components/hig/StorageBanner';
import TodayRoutes from '@/screens/today/routes';

// Today is the landing screen, so it ships with the app. Every other area
// loads the first time it is opened.
const MoveRoutes = lazy(() => import('@/screens/move/routes'));
const WalkRoutes = lazy(() => import('@/screens/walk/routes'));
const LiveWalkScreen = lazy(() => import('@/screens/walk/LiveWalkScreen'));
const TrackRoutes = lazy(() => import('@/screens/track/routes'));
const GuideRoutes = lazy(() => import('@/screens/guide/routes'));
const YouRoutes = lazy(() => import('@/screens/you/routes'));
const WelcomeRoutes = lazy(() => import('@/screens/welcome/routes'));
const SessionPage = lazy(() => import('@/pages/SessionPage'));

/**
 * Old addresses, so a bookmark or an installed shortcut from the previous
 * version still lands somewhere sensible instead of on a blank page.
 */
const LEGACY: Record<string, string> = {
  '/dashboard': '/today',
  '/workout': '/track/workout',
  '/plan': '/move/plan',
  '/library': '/move/exercises',
  '/progress': '/track',
  '/history': '/track',
  '/settings': '/you',
  '/profile': '/you/profile',
  '/onboarding': '/welcome',
};

/** Keeps the query string, so `/dashboard?checkin=1` still opens the check-in. */
function Redirect({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace />;
}

/** Full-screen tasks: a main landmark, the storage notice, and a failure that stays contained. */
function Task({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return (
    <TaskFrame>
      <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>
    </TaskFrame>
  );
}

/**
 * Each area owns its own subtree (`screens/<area>/routes.tsx`), so the areas
 * can change independently. Full-screen tasks — the session player and a live
 * walk — sit outside the shell: no tab bar to hit by accident mid-exercise.
 */
export function AppRoutes({ onboarded }: { onboarded: boolean }) {
  if (!onboarded) {
    return (
      <Routes>
        <Route path="/welcome/*" element={<Task><WelcomeRoutes /></Task>} />
        <Route path="*" element={<Navigate to="/welcome" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/today" replace />} />
      <Route path="/welcome/*" element={<Navigate to="/today" replace />} />
      <Route path="/session" element={<Task><SessionPage /></Task>} />
      <Route path="/walk/live" element={<Task><LiveWalkScreen /></Task>} />

      <Route element={<AppShell />}>
        <Route path="/today/*" element={<TodayRoutes />} />
        <Route path="/move/*" element={<MoveRoutes />} />
        <Route path="/walk/*" element={<WalkRoutes />} />
        <Route path="/track/*" element={<TrackRoutes />} />
        <Route path="/guide/*" element={<GuideRoutes />} />
        <Route path="/you/*" element={<YouRoutes />} />
      </Route>

      {Object.entries(LEGACY).map(([from, to]) => (
        <Route key={from} path={from} element={<Redirect to={to} />} />
      ))}
      <Route path="*" element={<Navigate to="/today" replace />} />
    </Routes>
  );
}
