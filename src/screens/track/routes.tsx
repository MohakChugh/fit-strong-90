import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { BackLeg } from './BackLeg';
import { MetricDetail } from './MetricDetail';
import { MyDay } from './MyDay';
import { CheckInDetail, PressureDetail, ReadingDetail, SessionDetail, WalkDetail } from './RecordDetails';

// The Workout Log is its own area's work, loaded the first time it is opened.
const WorkoutRoutes = lazy(() => import('@/screens/workout/routes'));

/**
 * Track: "What did I do or record?" (codex-vision §3).
 *
 * - `/track` — My Day. `?day=YYYY-MM-DD` picks the day, `?view=trends` the
 *   Trends list, and `?add=<kind>` opens Quick Log on one form (a log kind
 *   such as `glucose` or `lab`, or any stored kind name).
 * - `/track/metric/:kind` — one measure over time.
 * - `/track/back` — the back and leg screen (D21).
 * - `/track/reading|pressure|walk|session/:id`, `/track/check-in/:date` — one record.
 * - `/track/workout/*` — the Workout Log.
 */
export default function TrackRoutes() {
  return (
    <Routes>
      <Route index element={<MyDay />} />
      <Route path="metric/:kind" element={<MetricDetail />} />
      <Route path="back" element={<BackLeg />} />
      <Route path="reading/:id" element={<ReadingDetail />} />
      <Route path="pressure/:id" element={<PressureDetail />} />
      <Route path="walk/:id" element={<WalkDetail />} />
      <Route path="session/:id" element={<SessionDetail />} />
      <Route path="check-in/:date" element={<CheckInDetail />} />
      <Route path="workout/*" element={<WorkoutRoutes />} />
      {/* An address Track does not have lands on My Day (shell review F15).
          Absolute on purpose: inside a "*" route React Router 7 resolves "."
          to the very address being caught, so it would navigate nowhere. */}
      <Route path="*" element={<Navigate to="/track" replace />} />
    </Routes>
  );
}
