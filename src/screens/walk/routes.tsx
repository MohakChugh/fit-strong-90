import { Navigate, Route, Routes } from 'react-router-dom';
import { WalkSetup } from './WalkSetup';
import { WalkSummary } from './WalkSummary';

/**
 * Walk inside the tab shell: the setup at `/walk` and the summary at
 * `/walk/summary`. The live walk itself is mounted full screen at
 * `/walk/live`, outside the shell (see `src/routes.tsx`).
 */
export default function WalkRoutes() {
  return (
    <Routes>
      <Route index element={<WalkSetup />} />
      <Route path="summary" element={<WalkSummary />} />
      {/* Absolute: "." inside a splat route resolves to the same address and renders nothing. */}
      <Route path="*" element={<Navigate to="/walk" replace />} />
    </Routes>
  );
}
