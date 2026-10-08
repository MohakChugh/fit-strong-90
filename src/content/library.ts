import { CARDS } from './cards';
import { CLAIMS } from './claims';
import { HABITS } from './habits';
import { MEAL_INTRO, MEALS, MEASURES, SLOT_NOTES } from './meals';
import type { Claim, FurtherReading, GuidanceCard, MealTemplate, Source, Topic, TopicId } from './schema';
import { FURTHER_READING, SOURCES } from './sources';
import { TOPICS } from './topics';

function byId<T extends { id: string }>(items: T[]): ReadonlyMap<string, T> {
  return new Map(items.map(item => [item.id, item]));
}

const claimById = byId(CLAIMS);
const sourceById = byId(SOURCES);
const cardById = byId(CARDS);
const mealById = byId(MEALS);
const topicById = byId(TOPICS);
const readingById = byId(FURTHER_READING);

export const getClaim = (id: string): Claim | undefined => claimById.get(id);
export const getSource = (id: string): Source | undefined => sourceById.get(id);
export const getCard = (id: string): GuidanceCard | undefined => cardById.get(id);
export const getMeal = (id: string): MealTemplate | undefined => mealById.get(id);
export const getTopic = (id: string): Topic | undefined => topicById.get(id);
export const getReading = (id: string): FurtherReading | undefined => readingById.get(id);

/**
 * Resolve ids to claims, in order. Every id resolves — the integrity test
 * guarantees it — so a miss can only mean a broken build, and it is dropped
 * rather than rendered as an empty sentence.
 */
export function claims(ids: readonly string[]): Claim[] {
  return ids.flatMap(id => claimById.get(id) ?? []);
}

/** Claims shown under another wherever it appears, because it is unsafe for someone without them. */
export function attachedCautions(claim: Claim): Claim[] {
  return claims(claim.cautionIds ?? []);
}

/** A claim, everything that may be shown in its place, and everything that travels with those. */
function withEverythingItCarries(ids: readonly string[]): string[] {
  const direct = claims(ids);
  const swapped = claims(direct.flatMap(c => c.swap?.with ?? []));
  return unique([...ids, ...swapped.map(c => c.id), ...[...direct, ...swapped].flatMap(c => c.cautionIds ?? [])]);
}

/** Every claim a card can show to anyone, including emergencies, swaps and attached cautions. */
export function claimIdsOfCard(card: GuidanceCard): string[] {
  return withEverythingItCarries([...card.answer, ...(card.emergencies ?? []), ...card.notes, ...card.actions, ...card.cautions]);
}

/** Every claim a meal can show: how it is built, its measures, swaps and notes. */
export function claimIdsOfMeal(meal: MealTemplate): string[] {
  const measures = meal.components.flatMap(c => (c.measure ? MEASURES[c.measure]?.claimIds ?? [] : []));
  return withEverythingItCarries([...meal.claimIds, ...measures, ...meal.swaps, ...meal.salt, ...meal.sugar]);
}

/** Claims shown on the Meal ideas screen itself. */
export function claimIdsOfMealIdeas(): string[] {
  return withEverythingItCarries([...MEAL_INTRO, ...Object.values(SLOT_NOTES).flat()]);
}

/**
 * The recommendation numbers a locator names, in order: "Recommendation 5.16;
 * Micronutrients" gives ["5.16"]. Board D32: the ADA Standards are cited by
 * these numbers and nothing else.
 */
export function recommendationNumbers(locator: string): string[] {
  const found: string[] = [];
  for (const m of locator.matchAll(/recommendations?\s+(\d+\.\d+[a-z]?(?:\s*(?:,|and)\s*\d+\.\d+[a-z]?)*)/gi)) {
    for (const [n] of m[1].matchAll(/\d+\.\d+[a-z]?/g)) if (!found.includes(n)) found.push(n);
  }
  return found;
}

const byNumber = (a: string, b: string) => {
  const [as, an] = a.split('.').map(parseFloat);
  const [bs, bn] = b.split('.').map(parseFloat);
  return as - bs || an - bn;
};

/** "Recommendation 5.16", or "Recommendations 5.14, 5.24 and 5.25". */
export function recommendationLabel(numbers: readonly string[]): string {
  const sorted = [...numbers].sort(byNumber);
  return sorted.length === 1
    ? `Recommendation ${sorted[0]}`
    : `Recommendations ${sorted.slice(0, -1).join(', ')} and ${sorted.at(-1)}`;
}

export interface CitedSource {
  source: Source;
  /** Where in the source, for the claims on this screen. */
  locators: string[];
}

/**
 * The sources behind a set of claims, each once, with the places in it those
 * claims rely on. This is what a card's or meal's Sources section lists. A
 * source cited by recommendation number shows only its numbers (board D32);
 * the full locator stays in the claim as the editorial record.
 */
export function sourcesFor(claimIds: readonly string[]): CitedSource[] {
  const cited = new Map<string, CitedSource>();
  const numbers = new Map<string, string[]>();
  for (const claim of claims(claimIds)) {
    for (const { sourceId, locator } of claim.support) {
      const source = sourceById.get(sourceId);
      if (!source) continue;
      const entry = cited.get(sourceId) ?? { source, locators: [] };
      cited.set(sourceId, entry);
      if (source.citeBy === 'recommendation') {
        const seen = numbers.get(sourceId) ?? [];
        for (const n of recommendationNumbers(locator)) if (!seen.includes(n)) seen.push(n);
        numbers.set(sourceId, seen);
        continue;
      }
      // A locator may name several sections ("Liquids; Track your liquids");
      // list each section once per source.
      for (const part of locator.split(/;\s*/)) {
        if (part && !entry.locators.includes(part)) entry.locators.push(part);
      }
    }
  }
  for (const [sourceId, ns] of numbers) if (ns.length > 0) cited.get(sourceId)!.locators = [recommendationLabel(ns)];
  return [...cited.values()];
}

/** Cards whose home is this topic first, then cards that also list it. */
export function cardsInTopic(topicId: TopicId): GuidanceCard[] {
  const home = CARDS.filter(c => c.topics[0] === topicId);
  const also = CARDS.filter(c => c.topics[0] !== topicId && c.topics.includes(topicId));
  return [...home, ...also];
}

/** Every claim referenced anywhere a person can see it. */
export function shownClaimIds(): Set<string> {
  return new Set([
    ...CARDS.flatMap(claimIdsOfCard),
    ...MEALS.flatMap(claimIdsOfMeal),
    ...claimIdsOfMealIdeas(),
    ...HABITS.flatMap(h => withEverythingItCarries([...h.claimIds, ...(h.cueClaimId ? [h.cueClaimId] : []), ...(h.withheldClaimId ? [h.withheldClaimId] : [])])),
  ]);
}

/** The most recent review date among a set of claims. */
export function reviewedOn(claimIds: readonly string[]): string | undefined {
  return claims(claimIds).map(c => c.reviewedDate).sort().at(-1);
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}
