import { Navigate, Route, Routes } from 'react-router-dom';
import { HomeScreen } from './HomeScreen';

/**
 * `/home/*`, the launch screen, loaded with the app: one screen with its
 * sheets over it. v1's `/today` arrives here through `redirectFor`.
 */
export default function HomeRoutes() {
  return (
    <Routes>
      <Route index element={<HomeScreen />} />
      {/* An address under Home that isn't one lands on Home, saying so (journey §19.3).
          Absolute: "." inside a `*` route resolves to the same address and renders nothing. */}
      <Route path="*" element={<Navigate to="/home?moved=1" replace />} />
    </Routes>
  );
}
