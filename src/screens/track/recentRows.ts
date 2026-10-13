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
import { formatClock, formatDayRelative, formatObservation, kindTitle, type DisplayPrefs } from './format';
import { formatPressure } from './timeline';
import { formatNumber } from './units';

export interface RecentRow {
  id: string;
  title: string;
  detail: string;
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
  const day = formatDayRelative(e.at.slice(0, 10), today);
  const when = day === 'Today' || day === 'Yesterday' ? day.toLowerCase() : `on ${day}`;
  return { id: e.id, title: titleOf(e, prefs, countsFree), detail: `Deleted ${when} at ${formatClock(e.at, prefs.hour12)}` };
}
