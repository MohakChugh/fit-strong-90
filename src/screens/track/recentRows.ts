/**
 * Recently deleted's words (J§20.4 rule 6, board D109): what each entry was,
 * and when it went. A meal, a usual meal and an own food are named by their
 * words, never a figure, and an energy figure from movement by its kind
 * alone while counts-free is chosen, as the log shows it, whenever it was
 * deleted (B-11, Codex P8S-10). The row, Restore's name and what Restore
 * says all come from this one title.
 */
import { SLOT_LABEL, itemsLine } from '@/food/format';
import type { MealRecord, SavedMeal } from '@/food/types';
import type { Observation } from '@/health/observation';
import type { RecentDeletion } from '@/store/recent';
import { sessionTitle } from '@/screens/workout/summary';
import { formatClock, formatDayRelative, formatObservation, kindTitle, tagLabel, type DisplayPrefs } from './format';
import { formatPressure } from './timeline';
import { formatNumber } from './units';

export interface RecentRow {
  id: string;
  title: string;
  /**
   * A clinical reading's measured date and time, and its context (J§4.10,
   * F-data-03): what tells two alike apart, in the row and in its Restore's
   * name. "Measured today at 7:30 am, fasting"; one kept without a time says
   * so. Absent for everything else.
   */
  measured?: string;
  /** When it was deleted, said on its own. */
  detail: string;
}

/** Readings a clinical value is shown with its measured time and context for (J§4.10). */
const CLINICAL = new Set<Observation['kind']>(['glucose', 'bloodPressureSystolic', 'bloodPressureDiastolic']);

/** "today", "yesterday", or "on Thursday, 8 October". */
const dayWords = (day: string, today: string) => {
  const d = formatDayRelative(day, today);
  return d === 'Today' || d === 'Yesterday' ? d.toLowerCase() : `on ${d}`;
};

/** When the entry's clinical reading was measured, and in what context (F-data-03). */
function measuredOf(e: RecentDeletion, prefs: DisplayPrefs, today: string): string | undefined {
  const o = (e.observations ?? []).find(x => CLINICAL.has(x.kind));
  if (!o) return undefined;
  const when = o.timeUnknown ? `${dayWords(o.day, today)}, time not recorded` : `${dayWords(o.day, today)} at ${formatClock(o.at, prefs.hour12)}`;
  return `Measured ${when}${o.tag ? `, ${tagLabel(o.tag).toLowerCase()}` : ''}`;
}

const half = (obs: readonly Observation[], kind: 'bloodPressureSystolic' | 'bloodPressureDiastolic') => obs.find(o => o.kind === kind)?.value ?? null;

function titleOf(e: RecentDeletion, prefs: DisplayPrefs, countsFree: boolean): string {
  const obs = e.observations ?? [];
  switch (e.kind) {
    case 'reading':
      if (obs[0] && countsFree && obs[0].kind === 'activeEnergy') return kindTitle(obs[0].kind);
      return obs[0] ? `${kindTitle(obs[0].kind)} ${formatObservation(obs[0], prefs)}` : 'A reading';
    case 'checkInReading':
      if (e.kept?.kind === 'pressure') return `Blood pressure ${formatPressure({ systolic: e.kept.entry.sys, diastolic: e.kept.entry.dia })}, from your check-in`;
      return obs[0] ? `${kindTitle(obs[0].kind)} ${formatObservation(obs[0], prefs)}, from your check-in` : 'A check-in reading';
    case 'pressure':
      return `Blood pressure ${formatPressure({ systolic: half(obs, 'bloodPressureSystolic'), diastolic: half(obs, 'bloodPressureDiastolic') })}`;
    case 'walk': {
      const minutes = obs.filter(o => o.kind === 'walkDuration').reduce((t, o) => t + o.value, 0);
      return minutes > 0 ? `Walk, ${formatNumber(Math.round(minutes))} min` : 'Walk';
    }
    case 'meal': {
      const meal = e.records?.meals?.[0] as MealRecord | undefined;
      return meal ? `${SLOT_LABEL[meal.meal]}: ${itemsLine(meal.items)}` : 'A meal';
    }
    case 'usualMeal': {
      const usual = e.records?.savedMeals?.[0] as SavedMeal | undefined;
      return usual ? `Usual meal: ${usual.name}` : 'A usual meal';
    }
    case 'ownFood': {
      const food = e.records?.customFoods?.[0] as { name?: string } | undefined;
      return food?.name ? `Your own food: ${food.name}` : 'One of your own foods';
    }
    case 'session':
      return e.session ? sessionTitle(e.session) : 'A workout';
  }
}

/** One entry: "Water 500 ml", "Deleted today at 9:05 am". `countsFree`: the person's choice now, not when it was deleted. */
export function recentRow(e: RecentDeletion, prefs: DisplayPrefs, today: string, countsFree = false): RecentRow {
  const measured = measuredOf(e, prefs, today);
  return {
    id: e.id, title: titleOf(e, prefs, countsFree), ...(measured ? { measured } : {}),
    detail: `Deleted ${dayWords(e.at.slice(0, 10), today)} at ${formatClock(e.at, prefs.hour12)}`,
  };
}

/** What Restore is called: what it restores, and for a clinical reading when it was measured (F-data-03). */
export const restoreName = (row: RecentRow): string => `Restore ${row.title}${row.measured ? `, ${row.measured.charAt(0).toLowerCase()}${row.measured.slice(1)}` : ''}`;
