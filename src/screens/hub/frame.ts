/**
 * The hub frame's rules (journey §8.1, §8.4; motion M3, M24): where Back goes
 * with nothing to pop to, when the category wash takes part in the tile's
 * morph, what a loading hub is called, the trend a hub links to, and how a
 * day strip lays out.
 */
import { CATEGORIES, type Category } from '@/categories';

/** With nothing below it to pop to, a hub goes Home (journey §19.1: a deep link's Back goes to Home). */
export const HUB_BACK = { to: '/home', label: 'Home' } as const;

/**
 * How strongly the category colour washes the top of a hub, in percent. Text
 * on it is checked in `tokens.node.test.ts`: the light tint keeps 4.5:1 only
 * up to 8% (Sleep is the lowest, 4.56:1; at 10% it is 4.44:1).
 */
export const HUB_WASH = 8;

/** History shows the last 3 entries, then "Show all" (journey §8.2). */
export const HISTORY_PREVIEW = 3;

/**
 * The far end of the tile's morph (M3, B-27): the wash takes the tile's
 * `hub-card-bg` name only during the router's transition from a Home tile,
 * and never while an urgent decision stands or the hub opens on a hold or a
 * stop (motion rule 2).
 */
export function morphNamed({ transitioning, fromHome, urgent, held }: { transitioning: boolean; fromHome: boolean; urgent: boolean; held: boolean }): boolean {
  return transitioning && fromHome && !urgent && !held;
}

/** The category a hub address belongs to: `/hub/{id}` and anything under it. */
export function hubCategory(pathname: string): Category | undefined {
  const id = /^\/hub\/([^/?#]+)/.exec(pathname)?.[1];
  return CATEGORIES.find(c => c.id === id);
}

/** What a loading hub is called: its category, or "Loading" for an address that names none. */
export function skeletonTitle(pathname: string): string {
  return hubCategory(pathname)?.title ?? 'Loading';
}

/** "See trends": the category's own trend, with a query that names which (Labs keeps its kind, B-14). */
export function trendHref(category: Pick<Category, 'trend'>, search = ''): string | undefined {
  return category.trend ? `${category.trend}${search}` : undefined;
}

/** Seven columns, or seven rows below 375 px or above 130% text (K-42): rows wherever Home's tiles are one column. */
export function stripLayout(columns: 1 | 2 | 3 | 4): 'strip' | 'list' {
  return columns === 1 ? 'list' : 'strip';
}
