/**
 * A movement hub's This week and History (journey §8.2):
 * - the Monday–Sunday strip for the hub's own mode;
 * - the week's minutes against this week's goal (B-16);
 * - the last entries, each a way to its record, where it is corrected.
 * Plain functions over the records, using the same counts as Home and
 * Today's log.
 */
import { format } from 'date-fns';
import type { StatusPeriod, WorkoutSession } from '@/types';
import type { Mode } from '@/engine/permission';
import { STRETCH_FOCUS_LABEL, specFromPlanId } from '@/engine/stretch';
import type { Observation } from '@/health/observation';
import { activitiesFrom, isProgrammeSession } from '@/health/recommend';
import { STATUS_LABEL, statusOn } from '@/health/status';
import { STATUS_TEXT, type WeekDay } from '@/screens/move/plan';
import { formatClock, formatObservation, tagLabel, type DisplayPrefs } from '@/screens/track/format';
import { recordedMovement } from '@/screens/track/movement';
import { addDays, weekOf } from '@/screens/track/periods';
import type { RecordRef } from '@/screens/track/timeline';
import { STATUS_LABEL as SESSION_STATUS, sessionTitle, sourceLabel as sessionSource } from '@/screens/workout/summary';
import { walkRecords } from '@/walk/record';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const NOTHING: Record<Mode, string> = { guided: 'No workout', stretch: 'No stretch', walk: 'No walk' };

export type HubDayState = 'done' | 'rest' | 'status' | 'none';

export interface HubDay {
  day: string;
  /** "M", "T", …: the strip's visible label. */
  letter: string;
  /** "Monday": for the list, and for a screen reader before the words. */
  name: string;
  state: HubDayState;
  /** What the day holds, in words, never colour alone: "Done", "Stretched", "12 min walked", "Rest", "Flare-up". */
  words: string;
  today: boolean;
  future: boolean;
}

const did = (s: WorkoutSession) => s.status === 'completed' || s.status === 'partial';

export function modeWeek({ mode, today, sessions, observations, statusPeriods, programme }: {
  mode: Mode;
  today: string;
  sessions: readonly WorkoutSession[];
  observations: readonly Observation[];
  statusPeriods?: readonly StatusPeriod[];
  /** Workout, in the programme: the week as Your plan counts it (`weekView`). */
  programme?: readonly WeekDay[];
}): HubDay[] {
  const { from } = weekOf(today);
  const stretched = new Set(activitiesFrom(sessions, []).filter(a => a.mode === 'stretch').map(a => a.day));
  // Measured walking only, as each walk's own minutes are; time the person added is theirs, not walked.
  const walks = mode === 'walk' ? observations.filter(o => o.kind === 'walkDuration' && o.source === 'measured' && o.context?.startsWith('walk:')) : [];
  return LETTERS.map((letter, i): HubDay => {
    const day = addDays(from, i);
    const future = day > today;
    const base = { day, letter, name: NAMES[i], today: day === today, future };
    const planned = mode === 'guided' ? programme?.find(p => p.date === day) : undefined;
    if (planned) {
      const s = planned.status;
      const state: HubDayState = s === 'done' || s === 'partial' || s === 'recovery' ? 'done'
        : s === 'rest' ? 'rest' : s === 'flare' || s === 'unwell' || s === 'away' ? 'status' : 'none';
      return { ...base, state, words: STATUS_TEXT[s] };
    }
    if (mode === 'guided' && sessions.some(s => s.date === day && isProgrammeSession(s) && did(s))) return { ...base, state: 'done', words: 'Done' };
    if (mode === 'stretch' && stretched.has(day)) return { ...base, state: 'done', words: 'Stretched' };
    // Each part of a walk on its own day, cut at midnight, and overlaps once, as the week's ring counts (F17, D10; codex H2-03).
    const minutes = mode === 'walk' ? recordedMovement({ from: day, to: day }, walks, []).minutes : 0;
    if (minutes > 0) return { ...base, state: 'done', words: `${Math.round(minutes)} min walked` };
    const status = statusOn(statusPeriods, day);
    if (status !== 'normal') return { ...base, state: 'status', words: STATUS_LABEL[status] };
    return { ...base, state: 'none', words: future ? 'Still to come' : NOTHING[mode] };
  });
}

/** "64 of 150 min this week", or "64 min moved this week" with no goal (D31). */
export function goalLine(minutes: number, goal: number | undefined): { text: string; reached: boolean } {
  if (goal === undefined) return { text: `${minutes} min moved this week`, reached: false };
  return { text: `${minutes} of ${goal} min this week`, reached: minutes >= goal };
}

export interface HistoryRow {
  key: string;
  label: string;
  detail: string;
  ref: RecordRef;
  /** When it happened, for newest-first order. */
  at: string;
}

const join = (...parts: (string | undefined | false)[]) => parts.filter((p): p is string => !!p).join(' · ');
function dayLabel(day: string, current: string): string {
  return format(new Date(`${day}T12:00:00`), day.slice(0, 4) === current.slice(0, 4) ? 'EEE d MMM' : 'EEE d MMM yyyy');
}
const isStretch = (s: WorkoutSession) => s.planKind === 'stretch' || (s.planId?.startsWith('stretch:') ?? false);
const newest = (a: { at: string }, b: { at: string }) => Date.parse(b.at) - Date.parse(a.at);

/** The hub's records, newest first, each opening its record, where it can be corrected. */
export function movementHistory(
  mode: Mode, sessions: readonly WorkoutSession[], observations: readonly Observation[], prefs: DisplayPrefs, current: string,
): HistoryRow[] {
  if (mode === 'walk') {
    return walkRecords(observations).map(w => ({
      key: `walk:${w.id}`,
      label: formatObservation({ kind: 'walkDuration', value: w.minutes, unit: 'min' }, prefs),
      detail: join(
        dayLabel(w.day, current), formatClock(w.at, prefs.hour12), w.mealStartedAt !== undefined && tagLabel('afterMeal'),
        w.distanceKm !== undefined && formatObservation({ kind: 'walkDistance', value: w.distanceKm, unit: 'km' }, prefs),
      ),
      ref: { type: 'walk' as const, id: w.id },
      at: w.at,
    })).sort(newest);
  }
  return sessions
    .filter(s => s.status !== 'not_started' && (mode === 'stretch' ? isStretch(s) : isProgrammeSession(s)))
    .map(s => {
      const spec = mode === 'stretch' ? specFromPlanId(s.planId) : null;
      return {
        key: `session:${s.id}`,
        label: spec ? `${STRETCH_FOCUS_LABEL[spec.focus]} · ${spec.minutes} min` : sessionTitle(s),
        detail: join(dayLabel(s.date, current), SESSION_STATUS[s.status], mode === 'guided' && sessionSource(s)),
        // As Today's log opens them: a guided run's summary, or a hand-logged workout in the Workout Log.
        ref: s.guided ? { type: 'session' as const, id: s.id } : { type: 'workout' as const, id: s.id },
        at: s.startedAt ?? `${s.date}T12:00:00`,
      };
    })
    .sort(newest);
}
