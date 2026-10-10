import { lazy } from 'react';
import type React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '@/components/hig/AppShell';
import { ErrorBoundary } from '@/components/hig/ErrorBoundary';
import { TaskFrame } from '@/components/hig/StorageBanner';
import { redirectFor } from '@/redirects';
import HomeRoutes from '@/screens/home/routes';

// Home is the landing screen, so it ships with the app. Every other area
// loads the first time it is opened.
const MoveRoutes = lazy(() => import('@/screens/move/routes'));
const StretchScreen = lazy(() => import('@/screens/move/StretchScreen').then(m => ({ default: m.StretchScreen })));
const WalkRoutes = lazy(() => import('@/screens/walk/routes'));
const WalkSummary = lazy(() => import('@/screens/walk/WalkSummary').then(m => ({ default: m.WalkSummary })));
const LiveWalkScreen = lazy(() => import('@/screens/walk/LiveWalkScreen'));
const GuideRoutes = lazy(() => import('@/screens/guide/routes'));
const MealIdeasScreen = lazy(() => import('@/screens/guide/MealIdeasScreen'));
const MealDetailScreen = lazy(() => import('@/screens/guide/MealDetailScreen'));
const SampleWeekScreen = lazy(() => import('@/screens/guide/SampleWeekScreen'));
const BackLeg = lazy(() => import('@/screens/track/BackLeg').then(m => ({ default: m.BackLeg })));
const MetricFor = lazy(() => import('@/screens/track/MetricDetail').then(m => ({ default: m.MetricFor })));
const MyDay = lazy(() => import('@/screens/track/MyDay').then(m => ({ default: m.MyDay })));
const TrackRoutes = lazy(() => import('@/screens/track/routes'));
const WorkoutRoutes = lazy(() => import('@/screens/workout/routes'));
const DayRoutes = lazy(() => import('@/screens/day/routes'));
const BrowseScreen = lazy(() => import('@/screens/browse/BrowseScreen'));
const YouRoutes = lazy(() => import('@/screens/you/routes'));
const WelcomeRoutes = lazy(() => import('@/screens/welcome/routes'));
const SessionPage = lazy(() => import('@/pages/SessionPage'));

/**
 * Every v1 address, and any other this version doesn't have, sent on with its
 * query and its navigation state (journey §19.3): to its v2 place, or to Home
 * saying "That page has moved", never to a blank screen.
 */
export function LegacyRedirect() {
  const { pathname, search, state } = useLocation();
  // Mounted only once set up, so v1's setup addresses go Home, in one hop.
  return <Navigate to={redirectFor(pathname, search, { onboarded: true }) ?? '/home?moved=1'} replace state={state} />;
}

/** A redirect of the route table's own, keeping the address's query and navigation state (journey §19.3, K-17). */
function Keeping({ to }: { to: string }) {
  const { search, state } = useLocation();
  return <Navigate to={{ pathname: to, search }} replace state={state} />;
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
 * can change independently. Full-screen tasks — setup, the session player, a
 * live walk and its summary — sit outside the shell: no tab bar to hit by
 * accident mid-exercise.
 *
 * Until Plans 2 to 4 build them, the hubs, Trends and Me are v1's screens at
 * their v2 addresses (journey §19.2, B-22).
 */
export function AppRoutes({ onboarded }: { onboarded: boolean }) {
  if (!onboarded) {
    return (
      <Routes>
        <Route path="/setup/*" element={<Task><WelcomeRoutes /></Task>} />
        <Route path="*" element={<Keeping to="/setup" />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Keeping to="/home" />} />
      {/* Set up already: setup's addresses go Home, which is also how finishing setup arrives there. */}
      <Route path="/setup/*" element={<Keeping to="/home" />} />
      <Route path="/session" element={<Task><SessionPage /></Task>} />
      <Route path="/walk/live" element={<Task><LiveWalkScreen /></Task>} />
      <Route path="/walk/summary" element={<Task><WalkSummary /></Task>} />

      <Route element={<AppShell />}>
        <Route path="/home/*" element={<HomeRoutes />} />
        <Route path="/hub/workout/*" element={<MoveRoutes />} />
        <Route path="/hub/stretch" element={<StretchScreen />} />
        <Route path="/hub/walk/*" element={<WalkRoutes />} />
        <Route path="/hub/learn/*" element={<GuideRoutes />} />
        <Route path="/hub/food" element={<MealIdeasScreen />} />
        <Route path="/hub/food/ideas" element={<MealIdeasScreen />} />
        <Route path="/hub/food/ideas/:mealId" element={<MealDetailScreen />} />
        <Route path="/hub/food/week" element={<SampleWeekScreen />} />
        <Route path="/hub/back" element={<BackLeg />} />
        <Route path="/hub/:id" element={<MetricFor />} />
        <Route path="/day/*" element={<DayRoutes />} />
        <Route path="/trends" element={<MyDay view="trends" />} />
        <Route path="/trends/workout/*" element={<WorkoutRoutes />} />
        <Route path="/trends/:id" element={<MetricFor trend />} />
        <Route path="/browse" element={<BrowseScreen />} />
        <Route path="/me/*" element={<YouRoutes />} />
        <Route path="/track/*" element={<TrackRoutes />} />
      </Route>

      <Route path="*" element={<LegacyRedirect />} />
    </Routes>
  );
}
