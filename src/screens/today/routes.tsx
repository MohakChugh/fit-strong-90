import { Navigate, Route, Routes } from 'react-router-dom';
import { TodayScreen } from './TodayScreen';

/** Today is the landing screen, loaded with the app; it has one screen and sheets over it. */
export default function TodayRoutes() {
  return (
    <Routes>
      <Route index element={<TodayScreen />} />
      {/* Absolute: "." inside a `*` route resolves to the same address and renders nothing. */}
      <Route path="*" element={<Navigate to="/today" replace />} />
    </Routes>
  );
}
