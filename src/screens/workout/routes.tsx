import { Navigate, Route, Routes } from 'react-router-dom';
import TodayWorkoutScreen from './TodayWorkoutScreen';
import RecordScreen from './RecordScreen';

/**
 * The Workout Log (PLAN.md Task 6), mounted by Track at `/track/workout/*`:
 * today's workout at the index, a past one at `:id`. Any deeper address an
 * old link or a typo makes lands back on today's workout.
 *
 * `..`, not `.`: inside a `*` route React Router 7 resolves "." to the very
 * address being caught, which navigates nowhere and leaves a blank screen.
 */
export default function WorkoutRoutes() {
  return (
    <Routes>
      <Route index element={<TodayWorkoutScreen />} />
      <Route path=":id" element={<RecordScreen />} />
      <Route path="*" element={<Navigate to=".." replace />} />
    </Routes>
  );
}
