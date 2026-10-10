/**
 * Every category the app has, once (journey §5.1). Home's tiles, the hubs,
 * Trends, Browse and the routes all read from here, so a category can't be
 * on Home without a hub or a trend (audit A-28).
 */
import { deriveHealth } from '@/engine/health';
import type { Mode } from '@/engine/permission';
import type { CategoryId, GroupId, HomeLayout, UserSettings } from '@/types';
import type { UserProfile } from '@/types/profile';

export type { CategoryId, GroupId } from '@/types';
export type HubVariant = 'movement' | 'reading' | 'food' | 'learn';

export interface Category {
  id: CategoryId;
  title: string;
  group: GroupId;
  variant: HubVariant;
  /** The movement this category starts, if any; its tile line comes from that mode's gate. */
  mode?: Mode;
  /** `/hub/{id}` */
  hub: string;
  /** `/trends/{id}`, for a category that declares a trend; Learn declares none (B-14). */
  trend?: string;
  /** CSS custom property holding the category colour (graphics) and its ink (text). */
  colour: string;
}

/**
 * A Browse row that is not a category (B-14): it has only a target, so it is
 * never a tile, a hub or a trend.
 */
export interface Shortcut {
  id: string;
  title: string;
  to: string;
}

const c = (id: CategoryId, title: string, group: GroupId, variant: HubVariant, mode?: Mode): Category =>
  ({ id, title, group, variant, ...(mode ? { mode } : {}), hub: `/hub/${id}`, ...(id === 'learn' ? {} : { trend: `/trends/${id}` }), colour: `--cat-${id}` });

export const CATEGORIES: readonly Category[] = [
  c('workout', 'Workout', 'move', 'movement', 'guided'),
  c('stretch', 'Stretch', 'move', 'movement', 'stretch'),
  c('walk', 'Walk', 'move', 'movement', 'walk'),
  c('steps', 'Steps', 'move', 'reading'),
  c('food', 'Food', 'eat', 'food'),
  c('glucose', 'Glucose', 'check', 'reading'),
  c('bp', 'Blood pressure', 'check', 'reading'),
  c('back', 'Back & leg', 'check', 'reading'),
  c('weight', 'Weight', 'check', 'reading'),
  c('water', 'Water', 'check', 'reading'),
  c('sleep', 'Sleep', 'check', 'reading'),
  c('waist', 'Waist', 'check', 'reading'),
  c('labs', 'Labs', 'check', 'reading'),
  c('learn', 'Learn', 'learn', 'learn'),
];

export const GROUPS: readonly { id: GroupId; title: string }[] = [
  { id: 'move', title: 'Move' },
  { id: 'eat', title: 'Eat' },
  { id: 'check', title: 'Check' },
  { id: 'learn', title: 'Learn' },
];

const BY_ID = new Map(CATEGORIES.map(x => [x.id, x]));
export function categoryById(id: CategoryId): Category {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown category ${id}`);
  return found;
}

/**
 * Walking held by a standing foot restriction (an open wound or active
 * Charcot foot): Walk would only ever say "No walking for now", so it isn't a
 * default tile, and neither Steps nor a steps line is shown (L-09).
 */
export function walkingHeldForFeet(profile: UserProfile): boolean {
  return profile.health.footStatus === 'current_wound_or_active_charcot';
}

const MAX_TILES = 9;
/** At most 5 tiles in a group, by default and after any edit (journey §20.4 rule 13, B-08). */
export const MAX_PER_GROUP = 5;
/** Added, in this order, until Home has 9 tiles (journey §5.1). */
const FILL_INS: CategoryId[] = ['weight', 'sleep', 'learn'];
/**
 * Dropped, in this order, while the "when" rules alone give more than 9 (journey §5.1).
 * ponytail: those rules give at most 10 tiles and 5 per group today, so only Labs is
 * ever dropped. A tile a new rule takes past a group's 5 still goes to Hidden (`arrange`).
 */
const DROP_ORDER: CategoryId[] = ['labs', 'water', 'steps'];

/**
 * The first layout, from the setup answers (journey §5.1). Worked out once;
 * after that `settings.home` holds the person's own layout.
 */
export function defaultHome({ profile, settings, hasSteps }: { profile: UserProfile; settings: UserSettings; hasSteps: boolean }): HomeLayout {
  const h = profile.health;
  const derived = deriveHealth(h);
  const areas = profile.pain.areas;
  const footHeld = walkingHeldForFeet(profile);
  const wanted: CategoryId[] = [
    'workout', 'stretch',
    ...(footHeld ? [] : ['walk' as const]),
    ...(!footHeld && (settings.dailyStepsGoal !== undefined || hasSteps) ? ['steps' as const] : []),
    'food',
    ...(derived.diabetic || h.diabetes === 'prediabetes' ? ['glucose' as const] : []),
    ...(h.hypertension !== 'none' || derived.onBpMeds || h.bpMonitor ? ['bp' as const] : []),
    // Back pain or sciatica, not any pain: Back & leg only for relevant answers (A-38).
    ...(areas.includes('lowerBack') || areas.includes('sciatica') ? ['back' as const] : []),
    ...(settings.habits?.water?.enabled ? ['water' as const] : []),
    // For HbA1c.
    ...(derived.diabetic ? ['labs' as const] : []),
  ];
  // Too many: the dropped tiles go to `hidden`, so Edit Home offers them under Hidden.
  const hidden = DROP_ORDER.filter(id => wanted.includes(id)).slice(0, Math.max(0, wanted.length - MAX_TILES));
  return arrange(wanted.filter(id => !hidden.includes(id)), hidden);
}

/**
 * The tiles in their groups, in order, then the fill-ins up to 9 (journey
 * §5.1, B-08). A wanted tile that would take its group past 5, or Home past
 * 9, goes to Hidden after `dropped`, so Edit Home still offers it (kiro
 * KV-23); a fill-in that doesn't fit is simply not added, so fill-ins never
 * cause "too many". A group left with no tiles stays empty, and Home hides
 * its heading (L-14).
 */
export function arrange(wanted: readonly CategoryId[], dropped: readonly CategoryId[] = []): HomeLayout {
  const order: Record<GroupId, CategoryId[]> = { move: [], eat: [], check: [], learn: [] };
  const hidden = [...dropped];
  const place = (id: CategoryId): boolean => {
    const group = categoryById(id).group;
    if (order[group].length >= MAX_PER_GROUP || Object.values(order).flat().length >= MAX_TILES) return false;
    order[group].push(id);
    return true;
  };
  for (const id of wanted) if (!place(id)) hidden.push(id);
  for (const id of FILL_INS) place(id);
  return { order, hidden };
}

const GROUP_IDS = new Set<string>(GROUPS.map(g => g.id));

/**
 * A layout this build can draw: every id a category it knows, each shown in
 * its own group or hidden, never both and never twice, and no group over 5.
 * What a stored or imported `settings.home` must be before Home trusts it.
 */
export function isHomeLayout(x: unknown): x is HomeLayout {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return false;
  const { order, hidden } = x as Record<string, unknown>;
  if (typeof order !== 'object' || order === null || Array.isArray(order) || !Array.isArray(hidden)) return false;
  const groups = Object.entries(order as Record<string, unknown>);
  if (groups.length !== GROUP_IDS.size || groups.some(([g, ids]) => !GROUP_IDS.has(g) || !Array.isArray(ids) || ids.length > MAX_PER_GROUP)) return false;
  const seen = new Set<unknown>();
  const known = (id: unknown, group?: string) => {
    if (seen.has(id) || typeof id !== 'string' || !BY_ID.has(id as CategoryId)) return false;
    seen.add(id);
    return group === undefined || BY_ID.get(id as CategoryId)?.group === group;
  };
  return groups.every(([g, ids]) => (ids as unknown[]).every(id => known(id, g))) && hidden.every(id => known(id));
}

