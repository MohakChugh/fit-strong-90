/**
 * The Trends tab (journey §12): its root, each category's trend at `:id`,
 * and a past workout at `workout/:id`, the address it already had. Food's
 * trend is `:id` too, and opens the Food hub without estimates (D74, D114).
 * Anything else is an address that has moved (§19.3).
 */
import { Navigate, Route, Routes } from 'react-router-dom';
import RecordScreen from '@/screens/workout/RecordScreen';
import CategoryTrend from './CategoryTrend';
import TrendsScreen from './TrendsScreen';

export default function TrendsRoutes() {
  return (
    <Routes>
      <Route index element={<TrendsScreen />} />
      <Route path="workout/:id" element={<RecordScreen />} />
      <Route path=":id" element={<CategoryTrend />} />
      <Route path="*" element={<Navigate to="/home?moved=1" replace />} />
    </Routes>
  );
}
