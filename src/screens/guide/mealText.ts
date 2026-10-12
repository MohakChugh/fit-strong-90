import { componentsFor, FOOD_GROUP_LABEL, MEASURES, type MealComponent, type MealTemplate, type Pattern } from '@/content';

/** A meal row's second line: its food groups, in plate order, once each. */
export function mealDetail(meal: MealTemplate, pattern?: Pattern): string {
  const groups = [...new Set(componentsFor(meal, pattern).map(c => FOOD_GROUP_LABEL[c.group]))];
  return groups.join(' · ');
}

/** A component's second line: its food group, and its portion when a source gives one. */
export function componentDetail(component: MealComponent): string {
  const measure = component.measure ? MEASURES[component.measure]?.text : undefined;
  return measure ? `${FOOD_GROUP_LABEL[component.group]} · ${measure}` : FOOD_GROUP_LABEL[component.group];
}

/** The claims behind the measures a meal uses, without repeating ones shown elsewhere on it. */
export function measureClaimIds(meal: MealTemplate, pattern: Pattern | undefined, shown: readonly string[]): string[] {
  const ids = componentsFor(meal, pattern).flatMap(c => (c.measure ? MEASURES[c.measure]?.claimIds ?? [] : []));
  return [...new Set(ids)].filter(id => !shown.includes(id));
}
