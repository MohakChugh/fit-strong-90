import type { PageId } from '@/types/setup';
import type { PageView } from '../controls';
import { AboutBody, AboutFigure, AboutName } from './about';
import { BackFeetHistory, BackFeetSide, BackFeetWhere } from './backFeet';
import { DayMeals, DayQuiet, DaySitting, DayVoice, DayWalks, DayWater } from './day';
import { FoodAllergies, FoodHowYouEat, FoodLogging } from './food';
import { HealthBp, HealthConditions, HealthDiabetes, HealthEyes, HealthFeet, HealthFluid, HealthLimits } from './health';
import { MedicinesKetones, MedicinesLows, MedicinesMonitors, MedicinesRegular, MedicinesStanding, MedicinesWhich } from './medicines';
import { MovementFocus, MovementGoal, MovementProgramme } from './movement';

/** About you's views, by page (journey §6.2 ch. 2). */
export const ABOUT_VIEWS: Record<'about.name' | 'about.figure' | 'about.body', PageView> = {
  'about.name': AboutName,
  'about.figure': AboutFigure,
  'about.body': AboutBody,
} satisfies Partial<Record<PageId, PageView>>;

/** Your health's views: the engine's safety inputs, in §6.3's words (board D76). */
export const HEALTH_VIEWS: Record<'health.conditions' | 'health.diabetes' | 'health.bp' | 'health.fluid' | 'health.eyes' | 'health.feet' | 'health.limits', PageView> = {
  'health.conditions': HealthConditions,
  'health.diabetes': HealthDiabetes,
  'health.bp': HealthBp,
  'health.fluid': HealthFluid,
  'health.eyes': HealthEyes,
  'health.feet': HealthFeet,
  'health.limits': HealthLimits,
};

/** Your medicines' views, asked whatever the diagnosis (A-06, K-05). */
export const MEDICINES_VIEWS: Record<'medicines.regular' | 'medicines.which' | 'medicines.lows' | 'medicines.ketones' | 'medicines.standing' | 'medicines.monitors', PageView> = {
  'medicines.regular': MedicinesRegular,
  'medicines.which': MedicinesWhich,
  'medicines.lows': MedicinesLows,
  'medicines.ketones': MedicinesKetones,
  'medicines.standing': MedicinesStanding,
  'medicines.monitors': MedicinesMonitors,
};

/** Your back and feet's views (journey §6.2 ch. 5; board D77). */
export const BACK_FEET_VIEWS: Record<'backFeet.where' | 'backFeet.side' | 'backFeet.history', PageView> = {
  'backFeet.where': BackFeetWhere,
  'backFeet.side': BackFeetSide,
  'backFeet.history': BackFeetHistory,
};

/** Your movement's views (journey §6.2 ch. 6). The programme's Join flow is its own sheet (board D81). */
export const MOVEMENT_VIEWS: Record<'movement.focus' | 'movement.goal' | 'movement.programme', PageView> = {
  'movement.focus': MovementFocus,
  'movement.goal': MovementGoal,
  'movement.programme': MovementProgramme,
};

/** Your food's views: the contract Plan 7 consumes (board D82). */
export const FOOD_VIEWS: Record<'food.pattern' | 'food.allergies' | 'food.logging', PageView> = {
  'food.pattern': FoodHowYouEat,
  'food.allergies': FoodAllergies,
  'food.logging': FoodLogging,
};

/** Your day and coach's views (journey §6.2 ch. 8). */
export const DAY_VIEWS: Record<'day.water' | 'day.sitting' | 'day.walks' | 'day.meals' | 'day.quiet' | 'day.voice', PageView> = {
  'day.water': DayWater,
  'day.sitting': DaySitting,
  'day.walks': DayWalks,
  'day.meals': DayMeals,
  'day.quiet': DayQuiet,
  'day.voice': DayVoice,
};

/** Every page's view, keyed by its id: a page added to the graph without a view fails the build. */
export const PAGE_VIEWS: Record<Exclude<PageId, 'welcome.start' | 'review'>, PageView> = {
  ...ABOUT_VIEWS, ...HEALTH_VIEWS, ...MEDICINES_VIEWS, ...BACK_FEET_VIEWS, ...MOVEMENT_VIEWS, ...FOOD_VIEWS, ...DAY_VIEWS,
};
