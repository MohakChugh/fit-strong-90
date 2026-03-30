import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { loadData } from '@/services/storage';
import AppLayout from '@/components/layout/AppLayout';
import DashboardPage from '@/pages/DashboardPage';
import WorkoutPage from '@/pages/WorkoutPage';
import PlanPage from '@/pages/PlanPage';
import LibraryPage from '@/pages/LibraryPage';
import ProgressPage from '@/pages/ProgressPage';
import HistoryPage from '@/pages/HistoryPage';
import SettingsPage from '@/pages/SettingsPage';
import OnboardingPage from '@/pages/OnboardingPage';

function App() {
  const { theme } = useTheme();
  const data = loadData();
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
  );
}

export default App;
