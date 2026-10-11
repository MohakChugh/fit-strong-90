import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import FoodHubScreen from './FoodHubScreen';

const MealIdeasScreen = lazy(() => import('@/screens/guide/MealIdeasScreen'));
const MealDetailScreen = lazy(() => import('@/screens/guide/MealDetailScreen'));
const SampleWeekScreen = lazy(() => import('@/screens/guide/SampleWeekScreen'));
const UsualMealsScreen = lazy(() => import('./UsualMealsScreen'));

/**
 * `/hub/food/*` (journey §11, §19.2). The hub and its "Log a meal" sheet are
 * one route, `*`, so opening and closing the sheet never remounts the hub;
 * the hub sends any other address to itself.
 */
export default function FoodRoutes() {
  return (
    <Routes>
      <Route path="ideas" element={<MealIdeasScreen />} />
      <Route path="ideas/:mealId" element={<MealDetailScreen />} />
      <Route path="week" element={<SampleWeekScreen />} />
      <Route path="usual" element={<UsualMealsScreen />} />
      <Route path="*" element={<FoodHubScreen />} />
    </Routes>
  );
}
