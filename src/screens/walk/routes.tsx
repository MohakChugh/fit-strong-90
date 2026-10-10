import { Navigate, Route, Routes } from 'react-router-dom';
import WalkHub from '@/screens/hub/WalkHub';
import { WalkSummary } from './WalkSummary';

/**
 * Walk inside the tab shell: the Walk hub at `/hub/walk` and the summary at
 * `/hub/walk/summary`. The live walk itself is mounted full screen at
 * `/walk/live`, outside the shell (see `src/routes.tsx`).
 */
export default function WalkRoutes() {
  return (
    <Routes>
      <Route index element={<WalkHub />} />
      <Route path="summary" element={<WalkSummary />} />
      {/* Absolute: "." inside a splat route resolves to the same address and renders nothing. */}
      <Route path="*" element={<Navigate to="/hub/walk" replace />} />
    </Routes>
  );
}
