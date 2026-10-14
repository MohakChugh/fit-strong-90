import { Navigate, Route, Routes } from 'react-router-dom';

/**
 * v1's Today is Home now (journey §19.3): the app sends `/today` and its
 * query on through `redirectFor`, so this subtree only redirects, should
 * anything still mount it.
 */
export default function TodayRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/home" replace />} />
      <Route path="*" element={<Navigate to="/home?moved=1" replace />} />
    </Routes>
  );
}
