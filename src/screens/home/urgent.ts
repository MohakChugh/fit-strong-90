/**
 * The one safety surface (journey §4.7, B-02): every active emergency, stop
 * for today, low being treated and re-check, said the same way on every tab
 * screen, in the engine's own headline, with when it was measured or answered
 * and the safe action now. Ordinary holds (no check-in yet, a profile gap, a
 * foot that needs protecting) are not urgent: tiles and hubs say them in
 * their own mode's words.
 *
 * The decision is `recommend`'s, from the same inputs Home uses
 * (`recommendSources`): the surface only reads it, so it can never disagree
 * with the Right now card.
 */
import { createContext, useMemo, useState } from 'react';
import { gateFor } from '@/components/checkin/start';
import type { Mode, Permission } from '@/engine/permission';
import { RECHECK_MINUTES, toMgdl, withLogged } from '@/engine/readiness';
import { nextBoundary, recommend, type RecommendInput, type Recommendation } from '@/health/recommend';
import { useGuided } from '@/hooks/useGuided';
import { prefersHour12, timeOf } from '@/lib/time';
import { toDateString } from '@/lib/utils';
import { useClock, useWakeAt } from '@/screens/today/clock';
import { loadProgress, type ProgressSlot, type SavedProgress } from '@/session/persistence';
import { useStore, type StoreState } from '@/store/useStore';
import type { CheckInRecord, GlucoseEntry } from '@/types/checkin';

export interface Urgent {
  kind: 'emergency' | 'seekHelp' | 'recheck' | 'low';
  /** Stop ink for an emergency or a stop for today; caution ink for a low and its re-check. */
  tone: 'stop' | 'caution';
  /** The engine's own headline, as the Right now card shows it. */
  headline: string;
  /** What it is about, and when it was measured or answered: "Low glucose at 1:30 pm", "Emergency answer today". */
  when: string;
  /** The safe action now, when it has a time of its own: "Re-check at 1:45 pm", then "Re-check now". */
  next?: string;
}

// ============================================================================
// The decision
// ============================================================================

/** Readings behind a stop, by what was read: the surface names the reading and when it was taken. */
const READ: Record<string, 'glucose' | 'ketones' | 'bp'> = {
  extremeGlucose: 'glucose', severeLow: 'glucose', persistentHi: 'glucose', suspectUnit: 'glucose',
  ketonesUrgent: 'ketones', ketonesHigh: 'ketones', illnessKetones: 'ketones',
  bpEmergency: 'bp', bpSevere: 'bp',
};
/** A reading from earlier today, still deciding today (the engine's message says which). */
const EARLIER = new Set([
  'extremeGlucoseEarlier', 'extremeGlucoseAssessed', 'severeLowEarlier', 'severeLowAssessed',
  'ketonesEarlier', 'ketonesEarlierUrgent', 'illnessKetonesEarlier', 'ketonesAssessed', 'bpSevereEarlier', 'bpAssessed',
]);
const READING_NAME = { glucose: 'Glucose reading', ketones: 'Ketone reading', bp: 'Blood pressure reading' } as const;
/** Feeling low, said in the check-in or during movement, with no reading after it yet: treat it as a low. */
const FEELING_LOW = new Set(['lowSymptoms', 'lowReported']);

const LOW_MGDL = 70;
/** A low by its number, in either unit, or a meter showing LO. A reading in no unit the app knows is no low it can name. */
const isLow = (e: GlucoseEntry) => {
  if ('display' in e) return e.display === 'LO';
  return (e.unit === 'mg/dL' || e.unit === 'mmol/L') && toMgdl(e.value, e.unit) < LOW_MGDL;
};
const timeIn = (iso: string | undefined) => (iso ? Date.parse(iso) : Number.NaN);
/** " at 1:30 pm" for a time today, or " today" when the record kept none. */
const atOrToday = (iso: string | undefined, hour12: boolean) => {
  const t = timeIn(iso);
  return Number.isNaN(t) ? ' today' : ` at ${timeOf(t, hour12)}`;
};

/** Today's glucose readings, the check-in's and Track's, as the gate reads them. */
function glucoseToday(c: CheckInRecord | undefined): GlucoseEntry[] {
  if (!c) return [];
  const v = withLogged(c);
  return [...(v.glucoseEarlier ?? []), ...[v.glucose, v.glucoseDisplay].filter((e): e is GlucoseEntry => e !== undefined)];
}

/**
 * When an emergency or a stop for today was measured or answered: the
 * reading behind it and its time, an earlier day's answer, or today's.
 */
function stopWhen(kind: 'emergency' | 'seekHelp', c: CheckInRecord | undefined, hour12: boolean): string {
  const top = c?.readiness.reasons.find(r => r.disposition === (kind === 'emergency' ? 'emergency' : 'today'));
  if (!c || !top || top.code.startsWith('carried')) return 'From your last check-in';
  const read = READ[top.code];
  if (read === 'glucose') {
    const latest = glucoseToday(c).filter(e => !Number.isNaN(timeIn(e.measuredAt))).sort((a, b) => timeIn(a.measuredAt) - timeIn(b.measuredAt)).at(-1)
      ?? glucoseToday(c).at(-1);
    return `${top.code === 'severeLow' ? 'Low glucose' : READING_NAME.glucose}${atOrToday(latest?.measuredAt, hour12)}`;
  }
  if (read === 'ketones') return `${READING_NAME.ketones}${atOrToday(withLogged(c).ketones?.measuredAt, hour12)}`;
  if (read === 'bp') return `${READING_NAME.bp}${atOrToday(withLogged(c).bpReadings?.at(-1)?.at, hour12)}`;
  if (EARLIER.has(top.code)) return 'A reading from earlier today';
  return kind === 'emergency' ? 'Emergency answer today' : 'From today’s check-in';
}

/**
 * The reading a re-check counts from, and when: the engine sets the re-check
 * 15 minutes after it (`RECHECK_MINUTES`), so that reading is the one taken
 * then. A low says so; a reading under the start level or falling is named
 * only as a reading. A low just before midnight is the same episode as the
 * readings after it (X2-08), so its time says "yesterday" (A-12).
 */
function recheckWhen(c: CheckInRecord | undefined, hour12: boolean): string {
  const due = timeIn(c?.readiness.recheckAt);
  if (!c || Number.isNaN(due)) return 'Glucose reading today';
  const taken = due - RECHECK_MINUTES * 60_000;
  const reading = glucoseToday(c).find(e => timeIn(e.measuredAt) === taken);
  const day = toDateString(new Date(taken)) === c.date ? '' : ' yesterday';
  return `${reading && isLow(reading) ? 'Low glucose' : READING_NAME.glucose} at ${timeOf(taken, hour12)}${day}`;
}

/** "Re-check at 1:45 pm" until then; "Re-check now" once it is time, or when no time is known. */
function recheckNext(c: CheckInRecord | undefined, now: Date, hour12: boolean): string {
  const due = timeIn(c?.readiness.recheckAt);
  return !Number.isNaN(due) && due > now.getTime() ? `Re-check at ${timeOf(due, hour12)}` : 'Re-check now';
}

/**
 * Whether the recommendation is urgent, and what the surface says (journey
 * §4.7): an emergency, a stop for today ("get advice today"), a re-check, or
 * a low reported with no reading yet. Anything else, including an ordinary
 * hold, is not urgent. `checkIn` is today's effective record (`useGuided`).
 */
export function urgentOf(r: Recommendation, now: Date, checkIn?: CheckInRecord, hour12: boolean = prefersHour12()): Urgent | undefined {
  if (r.kind === 'emergency' || r.kind === 'seekHelp') {
    return { kind: r.kind, tone: 'stop', headline: r.title, when: stopWhen(r.kind, checkIn, hour12) };
  }
  if (r.kind === 'recheck') {
    return { kind: 'recheck', tone: 'caution', headline: r.title, when: recheckWhen(checkIn, hour12), next: recheckNext(checkIn, now, hour12) };
  }
  if (r.kind === 'hold' && checkIn?.readiness.reasons.some(x => FEELING_LOW.has(x.code))) {
    // The engine's words for it: check now, and treat it as a low if that can't be done.
    return { kind: 'low', tone: 'caution', headline: 'Check your glucose now', when: `Feeling low${atOrToday(checkIn.lowSymptomsAt, hour12)}` };
  }
  return undefined;
}

// ============================================================================
// The inputs, shared with Home
// ============================================================================

/** The guided session and a stretch each keep their own saved run. */
export const SLOTS: ProgressSlot[] = ['guided', 'stretch'];

/**
 * Every day's records with today's as every screen must act on it: the
 * stored one, or an answer the device would not keep that is at least as
 * restrictive (`useGuided().checkIn`).
 */
export function withEffectiveToday(stored: readonly CheckInRecord[], effective: CheckInRecord | undefined): CheckInRecord[] {
  if (!effective || stored.includes(effective)) return [...stored];
  return [...stored.filter(c => c.date !== effective.date), effective];
}

/** What `recommend` works from, all but the gate: what Home freezes, and what the shell reads live. */
export function recommendSources({ now, state, plan, checkIns }: {
  now: Date;
  state: Pick<StoreState, 'settings' | 'profile' | 'sessions' | 'observations'>;
  plan: RecommendInput['plan'];
  checkIns: readonly CheckInRecord[];
}): Omit<RecommendInput, 'permissions'> {
  const saved = SLOTS.map(slot => loadProgress(now.getTime(), slot)).filter((p): p is SavedProgress => p !== null);
  return {
    now, settings: state.settings, ...(state.profile ? { profile: state.profile } : {}), plan,
    sessions: state.sessions, checkIns, observations: state.observations, saved,
  };
}

/** The gate's answer for every mode, now. */
export function gatesNow(records: Parameters<typeof gateFor>[0]): Record<Mode, Permission> {
  return { guided: gateFor(records, 'guided'), stretch: gateFor(records, 'stretch'), walk: gateFor(records, 'walk') };
}

// ============================================================================
// The shell's copy
// ============================================================================

/** Where the surface's "What to do" takes the eye on Home: the Right now card. */
export const RIGHT_NOW_ID = 'right-now';

/** The urgent decision as the shell worked it out, for every screen in it; nothing outside the shell (full-screen tasks show their own stop). */
export const UrgentContext = createContext<Urgent | undefined>(undefined);

/**
 * The urgent decision as it stands, for the shell. Worked out live from the
 * same inputs as Home's card, again when the clock passes a boundary
 * (`nextBoundary`) and when the app becomes visible; the same object while
 * the words stay the same.
 */
export function useUrgent(): Urgent | undefined {
  const state = useStore();
  const guided = useGuided();
  const { now } = useClock();
  const checkIns = useMemo(() => withEffectiveToday(state.checkIns, guided.checkIn), [state.checkIns, guided.checkIn]);
  useWakeAt(nextBoundary(now, { ...(guided.checkIn ? { checkIn: guided.checkIn } : {}), ...(state.settings.habits ? { habits: state.settings.habits } : {}) }));
  const r = recommend({ ...recommendSources({ now, state, plan: guided.plan, checkIns }), permissions: gatesNow(guided) });
  const urgent = urgentOf(r, now, guided.checkIn);
  // The same object while the words are the same, so the screens under it draw again only when it changes.
  const key = urgent ? JSON.stringify(urgent) : '';
  const [kept, setKept] = useState({ key, urgent });
  if (kept.key !== key) {
    setKept({ key, urgent });
    return urgent;
  }
  return kept.urgent;
}
