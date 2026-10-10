import { Navigate, Route, Routes } from 'react-router-dom';
import { TodayScreen } from './TodayScreen';

/**
 * Today is the landing screen, loaded with the app; it has one screen and
 * sheets over it. Mounted at `/home` until Task 9 replaces it with Home.
 */
export default function TodayRoutes() {
  return (
    <Routes>
      <Route index element={<TodayScreen />} />
      {/* An address under Home that isn't one lands on Home, saying so (journey §19.3).
          Absolute: "." inside a `*` route resolves to the same address and renders nothing. */}
      <Route path="*" element={<Navigate to="/home?moved=1" replace />} />
    </Routes>
  );
}
