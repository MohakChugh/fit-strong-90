import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { useAppData } from '@/hooks/useLocalStorage';
import AppLayout from '@/components/layout/AppLayout';
import DashboardPage from '@/pages/DashboardPage';

// Today loads with the app; every other page (and its libraries, like the
// charts on Progress) loads the first time it's opened.
const WorkoutPage = lazy(() => import('@/pages/WorkoutPage'));
const PlanPage = lazy(() => import('@/pages/PlanPage'));
const LibraryPage = lazy(() => import('@/pages/LibraryPage'));
const ProgressPage = lazy(() => import('@/pages/ProgressPage'));
const HistoryPage = lazy(() => import('@/pages/HistoryPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'));
const SessionPage = lazy(() => import('@/pages/SessionPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));

function App() {
  const { theme } = useTheme();
  const [data] = useAppData();
  const isOnboardingComplete = data.settings.onboardingComplete;

  useEffect(() => {
    // Apply theme on mount
    const root = window.document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const shouldBeDark = theme === 'dark' || (theme === 'system' && mediaQuery.matches);

    if (shouldBeDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" aria-busy="true" />}>
    <Routes>
      {/* Onboarding Route - No Layout */}
      <Route
        path="/onboarding"
        element={
          isOnboardingComplete ? <Navigate to="/dashboard" replace /> : <OnboardingPage />
        }
      />

      {/* Protected Routes - Require Onboarding */}
      {!isOnboardingComplete ? (
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      ) : (
        <>
          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Full-screen guided session and profile editing (no app chrome) */}
          <Route path="/session" element={<SessionPage />} />
          <Route path="/profile" element={<ProfilePage />} />

          {/* App Routes with Layout */}
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/workout" element={<WorkoutPage />} />
            <Route path="/plan" element={<PlanPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          {/* Catch all - redirect to dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </>
      )}
    </Routes>
    </Suspense>
  );
}

export default App;
