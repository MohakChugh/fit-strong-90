/**
 * The Trends tab (journey §12): its root, each category's trend at `:id`,
 * and a past workout at `workout/:id`, the address it already had. Food's
 * trend is Plan 7's: until then its address opens the Food hub (D74).
 * Anything else is an address that has moved (§19.3).
 */
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import RecordScreen from '@/screens/workout/RecordScreen';
import CategoryTrend from './CategoryTrend';
import TrendsScreen from './TrendsScreen';

/** Food's trend address, on to the Food hub with its query and navigation state. */
function FoodHub() {
  const { search, state } = useLocation();
  return <Navigate to={{ pathname: '/hub/food', search }} replace state={state} />;
}

export default function TrendsRoutes() {
  return (
    <Routes>
      <Route index element={<TrendsScreen />} />
      <Route path="workout/:id" element={<RecordScreen />} />
      <Route path="food" element={<FoodHub />} />
      <Route path=":id" element={<CategoryTrend />} />
      <Route path="*" element={<Navigate to="/home?moved=1" replace />} />
    </Routes>
  );
}
