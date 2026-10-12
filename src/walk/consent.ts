/**
 * The first walk's questions (journey §9.1, A-51, K-09): two separate route
 * consents and the one-time step card, each asked once and answerable later
 * in Me → Data. This phone's own answers, never switched on by an import (B-26).
 */
import type { UserSettings } from '@/types';
import type { ClockHold, GlucoseEntry } from '@/types/checkin';
import type { ObservationInput } from '@/health/observation';
import type { WalkPlan } from './clock';

export type WalkSettings = NonNullable<UserSettings['walk']>;

export const UNASKED: WalkSettings = { saveRoutes: 'unasked', map: 'unasked' };

export function walkSettings(s: Pick<UserSettings, 'walk'>): WalkSettings {
  return s.walk ?? UNASKED;
}

/**
 * B-19: this phone's clock changed. Its generation moves on, so every reading
 * acquired here from now carries the new one, and the days either side of the
 * change are those whose earlier readings can't be timed (board D174, D186).
 */
export function withClockChange(walk: WalkSettings, days: readonly string[]): WalkSettings {
  return { ...walk, clock: { generation: (walk.clock?.generation ?? 0) + 1, days: [...new Set(days)].sort() } };
}

/**
 * B-19: the hold with changes to the clock seen here and not yet stored
 * (H6F-02, board D188): on their days too, and of a generation past every
 * one kept, so no reading, all of them stamped by what is kept, releases it
 * until they are stored.
 */
export function withPendingClock(stored: ClockHold | undefined, pending: readonly (readonly string[])[]): ClockHold | undefined {
  if (pending.length === 0) return stored;
  return { generation: (stored?.generation ?? 0) + 1, days: [...new Set([...(stored?.days ?? []), ...pending.flat()])].sort() };
}

/** This phone's clock generation, the count of changes to its clock it has kept: 0 until it sees one. */
export const clockGeneration = (s: Pick<UserSettings, 'walk'> | undefined): number => s?.walk?.clock?.generation ?? 0;

/**
 * B-19: a glucose reading as it is acquired, by the screen that takes it,
 * stamped with the clock generation it is acquired in (`gen`), and only
 * then: a new one, typed into an empty box or saved for the first time.
 * One already stamped, retimed or corrected, keeps its own; one acquired
 * before any change carries none, as does one from a file (H6R-03, board
 * D186). Never stamped as it is stored, which a retry can do after a change.
 */
export function acquiredIn<T extends GlucoseEntry | ObservationInput>(reading: T, generation: number): T {
  return generation > 0 && reading.gen === undefined ? { ...reading, gen: generation } : reading;
}

export type PreflightPage = 'keepRoute' | 'mapPictures' | 'stepCard';

/** What this walk still has to ask, in order. The map question waits on the route one; the step card comes last, just before motion is asked for. */
export function preflightPages(walk: WalkSettings, plan: Pick<WalkPlan, 'gps' | 'steps'>): PreflightPage[] {
  const pages: PreflightPage[] = [];
  if (plan.gps && walk.saveRoutes === 'unasked') pages.push('keepRoute');
  if (plan.gps && walk.saveRoutes !== false && walk.map === 'unasked') pages.push('mapPictures');
  if (plan.steps && !walk.stepCardSeen) pages.push('stepCard');
  return pages;
}

export type PreflightAnswer = { page: 'keepRoute'; keep: boolean } | { page: 'mapPictures'; show: boolean } | { page: 'stepCard' };

/** The one setting an answer changes, to write against this phone's settings as they are then (H6R-07). */
export function answerOf(a: PreflightAnswer): Partial<WalkSettings> {
  switch (a.page) {
    case 'keepRoute': return { saveRoutes: a.keep };
    case 'mapPictures': return { map: a.show ? 'on' : 'off' };
    case 'stepCard': return { stepCardSeen: true };
  }
}

export function answered(walk: WalkSettings, a: PreflightAnswer): WalkSettings {
  return { ...walk, ...answerOf(a) };
}

/** How many times "Erase all routes" has run on this phone (B-05). */
export const erasedGeneration = (walk: WalkSettings | undefined): number => walk?.erased?.generation ?? 0;

/**
 * B-05: an erase this phone knows erased this walk's route, whatever the walk
 * says of itself: by its walk's id, or, for an erase made before board D176
 * that kept only when it ran, by when the walk began, at or before it. Until
 * this phone has turned that erase into its record, its old marker is read as
 * it is (`routesErasedAt`, H6F-07, board D210).
 */
export function erasedHere(walk: WalkSettings | undefined, walkId: string, startedAt: number): boolean {
  const before = walk?.erased?.before ?? (walk as { routesErasedAt?: unknown } | undefined)?.routesErasedAt;
  return (walk?.erased?.walks.includes(walkId) ?? false) || (typeof before === 'number' && !(startedAt > before));
}

/**
 * B-05: this walk's route is erased for good: an "Erase all routes" ran since
 * the walk began, by this phone's own count, never its clock, or erased this
 * walk's route by name, or began before an erase made before board D176
 * (H6R-08, K6R-12, H6F-07, board D176, D210).
 */
export function routeErased(walk: WalkSettings | undefined, walkId: string, plan: Pick<WalkPlan, 'routeGen'>, startedAt: number): boolean {
  return (plan.routeGen ?? 0) !== erasedGeneration(walk) || erasedHere(walk, walkId, startedAt);
}

/** "Erase all routes": the count moves on, and these walks' routes are erased by name, as well as every earlier erase's. */
export function withErase(walk: WalkSettings, walks: readonly string[]): WalkSettings {
  return { ...walk, erased: { generation: erasedGeneration(walk) + 1, walks: [...new Set([...(walk.erased?.walks ?? []), ...walks])].sort() } };
}

/** The plan as it finally starts: the route kept only on this phone's yes, and only with location (§9.1), in the erase generation it begins in. */
export function withConsent(plan: WalkPlan, walk: WalkSettings): WalkPlan {
  const { keepRoute: _asked, routeGen: _then, ...rest } = plan;
  void _asked;
  void _then;
  return { ...rest, ...(plan.gps && walk.saveRoutes === true ? { keepRoute: true, routeGen: erasedGeneration(walk) } : {}) };
}

/** This phone's two walk choices in words, for the Walk hub and Me → Data. */
export function consentSummary(walk: WalkSettings): { routes: string; map: string } {
  const unasked = 'Asked on your first walk with location';
  return {
    routes: walk.saveRoutes === 'unasked' ? unasked : walk.saveRoutes ? 'Kept on this phone' : 'Not kept',
    // Never asked while routes aren't kept: the first walk asks only with a yes (K6R-08).
    map: walk.map === 'unasked' ? (walk.saveRoutes === false ? 'Only used with kept routes' : unasked) : walk.map === 'on' ? 'On' : 'Off',
  };
}

/** Under the "Measure distance and pace" switch. */
export function routeNote(walk: WalkSettings): string {
  if (walk.saveRoutes === true) return 'Uses GPS. Your route is kept on this phone.';
  if (walk.saveRoutes === false) return 'Uses GPS. Your route isn’t kept.';
  return 'Uses GPS. You’ll be asked whether to keep your route.';
}

export const CONSENT = {
  keepRoute: {
    title: 'Keep a record of your route on this phone?',
    detail: 'Routes are kept only on this phone. You can change this later in Me → Data.',
    yes: 'Yes, keep routes',
    no: 'No, don’t keep routes',
  },
  mapPictures: {
    title: 'Show map pictures under your saved routes?',
    detail: 'Map pictures come from OpenStreetMap. When you open a walk, they receive your internet address and the map squares for that area, so they can tell roughly where you walked. Your readings and your route file are never sent.',
    yes: 'Show map pictures',
    no: 'No pictures',
  },
  stepCard: {
    title: 'Counting steps',
    detail: 'FitStrong counts steps only while it’s open on the screen.',
    go: 'Start walk',
  },
} as const;
