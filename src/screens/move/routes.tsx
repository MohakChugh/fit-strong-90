import { Navigate, Route, Routes } from 'react-router-dom';
import WorkoutHub from '@/screens/hub/WorkoutHub';
import { ExerciseScreen } from './ExerciseScreen';
import { ExercisesScreen } from './ExercisesScreen';
import { PlanScreen } from './PlanScreen';

/**
 * The Workout hub and its pages (journey §8.3, §19.2): the hub at the index,
 * Your plan, and the exercise library. Logging a workout is the workout
 * area's, at `/hub/workout/log` (src/routes.tsx, B-14). v1's `stretch` path
 * stays listed, for the redirect inventory, and goes to the Stretch hub.
 */
export default function MoveRoutes() {
  return (
    <Routes>
      <Route index element={<WorkoutHub />} />
      <Route path="stretch" element={<Navigate to="/hub/stretch" replace />} />
      <Route path="plan" element={<PlanScreen />} />
      <Route path="exercises" element={<ExercisesScreen />} />
      <Route path="exercises/:id" element={<ExerciseScreen />} />
      {/* A mistyped or retired address lands on the Workout hub rather than an empty shell. */}
      <Route path="*" element={<Navigate to="/hub/workout" replace />} />
    </Routes>
  );
}
