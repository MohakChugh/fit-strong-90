/**
 * The first walk's questions (journey §9.1, A-51, K-09): two separate route
 * consents and the one-time step card, each asked once and answerable later
 * in Me → Data. This phone's own answers, never switched on by an import (B-26).
 */
import type { UserSettings } from '@/types';
import type { ObservationInput } from '@/health/observation';
import type { WalkPlan } from './clock';

export type WalkSettings = NonNullable<UserSettings['walk']>;

export const UNASKED: WalkSettings = { saveRoutes: 'unasked', map: 'unasked' };

export function walkSettings(s: Pick<UserSettings, 'walk'>): WalkSettings {
  return s.walk ?? UNASKED;
}

/**
 * B-19: this phone's clock changed during a walk. Its generation moves on, so
 * every reading taken here from now carries the new one, and the days either
 * side of the change are those whose earlier readings can't be timed (board
 * D174).
 */
export function withClockChange(walk: WalkSettings, days: readonly string[]): WalkSettings {
  return { ...walk, clock: { generation: (walk.clock?.generation ?? 0) + 1, days: [...new Set(days)].sort() } };
}

/** The clock generation readings taken here now carry (`gen`): 0 until a walk sees the clock change. */
export const clockGeneration = (s: Pick<UserSettings, 'walk'> | undefined): number => s?.walk?.clock?.generation ?? 0;

/** A glucose reading recorded here now, in this phone's clock generation; anything else, as it is. */
export function takenHere(input: ObservationInput, generation: number): ObservationInput {
  return input.kind === 'glucose' && input.gen === undefined && generation > 0 ? { ...input, gen: generation } : input;
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

/** The plan as it finally starts: the route kept only on this phone's yes, and only with location (§9.1). */
export function withConsent(plan: WalkPlan, walk: WalkSettings): WalkPlan {
  const { keepRoute: _asked, ...rest } = plan;
  void _asked;
  return { ...rest, ...(plan.gps && walk.saveRoutes === true ? { keepRoute: true } : {}) };
}

/** This phone's two walk choices in words, for the Walk hub and Me → Data. */
export function consentSummary(walk: WalkSettings): { routes: string; map: string } {
  const unasked = 'Asked on your first walk with location';
  return {
    routes: walk.saveRoutes === 'unasked' ? unasked : walk.saveRoutes ? 'Kept on this phone' : 'Not kept',
    map: walk.map === 'unasked' ? unasked : walk.map === 'on' ? 'On' : 'Off',
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
