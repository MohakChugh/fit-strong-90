/**
 * The Guide's content library: typed, cited guidance for the Guide screens
 * and for any area that needs to explain itself (reminders, Today's "Why this?").
 */
export type * from './schema';
export { DISCLAIMER, ROUTES } from './schema';
export { CLAIMS, REVIEWED } from './claims';
export { CARDS } from './cards';
export { TOPICS } from './topics';
export { SOURCES, FURTHER_READING } from './sources';
export { MEALS, MEASURES, MEAL_INTRO, SLOT_NOTES, SLOTS, FOOD_GROUP_LABEL, PATTERN_LABEL } from './meals';
export { HABITS } from './habits';
export {
  attachedCautions, cardsInTopic, claimIdsOfCard, claimIdsOfMeal, claimIdsOfMealIdeas, claims, getCard, getClaim,
  getMeal, getReading, getSource, getTopic, recommendationLabel, recommendationNumbers, reviewedOn, sourcesFor,
  type CitedSource,
} from './library';
export {
  actionFor, cardBlocks, cardsForTopic, contextFromProfile, contextOf, habitAdvice, holds, idsShown, isCardVisible,
  isForYou, isRelevant, relatedCards, resolveGroups, topicsFor, visibleCards,
  type CardBlock, type GuideContext, type HabitAdvice, type ShownClaim, type TopicForYou,
} from './personalise';
export { search, type ResultKind, type SearchResult } from './search';
export {
  componentsFor, isAvoided, mealsFor, sampleWeek, suits, unmatchedAvoid, WEEKDAYS, type SampleDay, type Weekday,
} from './week';
