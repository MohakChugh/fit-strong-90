import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { isDay } from '@/health/observation';
import { MyDay } from '@/screens/track/MyDay';

/**
 * Today's log (journey §13): v1's My Day, with the day in the path. `today`
 * is passed on as it is, so My Day reads it as the current day and moves on
 * at midnight; a date that isn't one goes to today.
 */
function DayFor() {
  const { date = 'today' } = useParams();
  if (date !== 'today' && !isDay(date)) return <Navigate to="/day/today" replace />;
  return <MyDay day={date} />;
}

export default function DayRoutes() {
  return (
    <Routes>
      <Route path=":date" element={<DayFor />} />
      <Route path="*" element={<Navigate to="/day/today" replace />} />
    </Routes>
  );
}
