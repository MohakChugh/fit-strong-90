/**
 * Home's own rules that are not the recommendation, the gate or the week:
 * the greeting, how many columns the tiles take, and what a tile says when
 * it isn't a movement's (journey §7.1, §7.2). Plain functions, so the screen
 * stays a layout.
 */
import type { Category } from '@/categories';
import type { Mode } from '@/engine/permission';
import { dayPartOf, type DayPart, type Recommendation } from '@/health/recommend';
import type { CategoryId } from '@/types';
import type { SessionPlan } from '@/types/plan';
import type { Reading } from '@/screens/today/model';
import { workoutNormal, type TileLine } from './tileLine';

/** Screens opened from Home name it as their opener, so their Back says "Home" (scan S-10). */
export const FROM_HOME = { path: '/home', label: 'Home' };

const GREETING: Record<DayPart, string> = { morning: 'Good morning', daytime: 'Good afternoon', evening: 'Good evening' };

/** "Good evening, Asha": the part of the day as the app reads it, with the person's name when they gave one. */
export function greeting(now: Date, name?: string): string {
  const who = name?.trim();
  return `${GREETING[dayPartOf(now.getHours())]}${who ? `, ${who}` : ''}`;
}

/**
 * Where a tile goes: its hub. Glucose opens on every reading, so the one on
 * the tile is always in the list, whichever group the hub would open on
 * (scan J2-08).
 */
export function tileHref(category: Pick<Category, 'id' | 'hub'>): string {
  return category.id === 'glucose' ? `${category.hub}?group=all` : category.hub;
}

/** The largest text that still takes two tile columns (K-26, A-59). */
const TWO_UP_SCALE = 1.3;

/** Two columns at 375 CSS px wide and above with text at 130% or less; otherwise one (journey §7.1). */
export function tileColumns({ width, scale }: { width: number; scale: number }): 1 | 2 {
  return width >= 375 && scale <= TWO_UP_SCALE + 1e-9 ? 2 : 1;
}

/** What a stretch or a walk is, when the suggestion is about something else. */
const PLAIN: Record<Exclude<Mode, 'guided'>, string> = { stretch: '10 or 15 min', walk: 'Just a walk' };

/**
 * A movement tile's line when its gate allows it (`movementLine`'s `normal`):
 * the suggestion's own title when the Right now card suggests this mode, so
 * the tile and the card read alike; otherwise the programme's session, or a
 * plain line for a stretch or a walk.
 */
export function normalLine(mode: Mode, { recommendation: r, enrolled, plan }: {
  recommendation: Recommendation;
  enrolled: boolean;
  plan: Pick<SessionPlan, 'label' | 'totalSeconds'>;
}): string {
  // The day's session is the plan's own line, with its minutes.
  if (r.action.mode === mode && r.kind !== 'scheduled') return r.title;
  if (mode === 'guided') return workoutNormal({ enrolled, label: plan.label, minutes: Math.round(plan.totalSeconds / 60) });
  return PLAIN[mode];
}

/**
 * The line on a tile that starts no movement. Glucose and blood pressure show
 * today's latest reading with when and where it was taken (A-12); the other
 * readings get their own lines in Plan 2 and invite one meanwhile.
 */
export function readingLine(id: CategoryId, latest: { glucose?: Reading; pressure?: Reading }): TileLine {
  if (id === 'food') return { text: 'Meal ideas for you', tone: 'normal' };
  if (id === 'learn') return { text: 'For you', tone: 'normal' };
  if (id === 'glucose' || id === 'bp') {
    const reading = id === 'glucose' ? latest.glucose : latest.pressure;
    return reading ? { text: reading.value, detail: `Today · ${reading.detail}`, tone: 'normal' } : { text: 'Not entered today', tone: 'normal' };
  }
  return { text: 'Add a reading', tone: 'normal' };
}
