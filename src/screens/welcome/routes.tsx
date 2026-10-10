import { Navigate, Route, Routes } from 'react-router-dom';
import { FocusStep } from './FocusStep';
import { HealthStep } from './HealthStep';
import { KeepStep } from './KeepStep';

/**
 * First run, shown until `settings.onboardingComplete`. Three steps: what the
 * person would like more of, the health questions safety needs, and keeping
 * the record on this device. Each saves as it goes; see `assemble.ts`.
 */
export default function WelcomeRoutes() {
  return (
    <Routes>
      <Route index element={<FocusStep />} />
      <Route path="health" element={<HealthStep />} />
      <Route path="keep" element={<KeepStep />} />
      <Route path="*" element={<Navigate to="/welcome" replace />} />
    </Routes>
  );
}
