import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { LegacyRedirect } from '@/routes';
import { CheckInDetail, PressureDetail, ReadingDetail, SessionDetail, WalkDetail } from './RecordDetails';

// The Workout Log is its own area's work, loaded the first time it is opened.
const WorkoutRoutes = lazy(() => import('@/screens/workout/routes'));

/**
 * Track's record details, which keep their v1 addresses (journey §19.2):
 * `/track/reading|pressure|walk|session/:id`, `/track/check-in/:date` and a
 * past workout at `/track/workout/:id`.
 *
 * Everything else Track had has moved (§19.3), and its old address is sent on
 * by `redirectFor`: My Day to `/day/:date` (or `/trends` for its trends view),
 * `metric/:kind` to its hub, `back` to `/hub/back` and the Workout Log to
 * `/trends/workout`. The moved paths stay listed, so the redirect inventory
 * (`redirects.test.ts`) keeps checking them.
 */
export default function TrackRoutes() {
  return (
    <Routes>
      <Route index element={<LegacyRedirect />} />
      <Route path="metric/:kind" element={<LegacyRedirect />} />
      <Route path="back" element={<LegacyRedirect />} />
      <Route path="reading/:id" element={<ReadingDetail />} />
      <Route path="pressure/:id" element={<PressureDetail />} />
      <Route path="walk/:id" element={<WalkDetail />} />
      <Route path="session/:id" element={<SessionDetail />} />
      <Route path="check-in/:date" element={<CheckInDetail />} />
      <Route path="workout" element={<LegacyRedirect />} />
      <Route path="workout/*" element={<WorkoutRoutes />} />
      <Route path="*" element={<LegacyRedirect />} />
    </Routes>
  );
}
