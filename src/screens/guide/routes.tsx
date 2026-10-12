import { Navigate, Route, Routes } from 'react-router-dom';
import CardScreen from './CardScreen';
import GuideScreen from './GuideScreen';
import MealDetailScreen from './MealDetailScreen';
import MealIdeasScreen from './MealIdeasScreen';
import SampleWeekScreen from './SampleWeekScreen';
import SourcesScreen from './SourcesScreen';
import TopicScreen from './TopicScreen';

/**
 * Guide: search and topics, each topic's answers, meal ideas with a sample
 * week, and the sources behind all of it. The whole area loads on first visit.
 */
export default function GuideRoutes() {
  return (
    <Routes>
      <Route index element={<GuideScreen />} />
      <Route path="topic/:topicId" element={<TopicScreen />} />
      <Route path="card/:cardId" element={<CardScreen />} />
      <Route path="meals" element={<MealIdeasScreen />} />
      <Route path="meals/week" element={<SampleWeekScreen />} />
      <Route path="meals/:mealId" element={<MealDetailScreen />} />
      <Route path="sources" element={<SourcesScreen />} />
      {/* Absolute on purpose: in a splat route React Router 7 resolves "." to
          the unmatched address itself, so `to="."` left /guide/x blank. */}
      <Route path="*" element={<Navigate to="/guide" replace />} />
    </Routes>
  );
}
