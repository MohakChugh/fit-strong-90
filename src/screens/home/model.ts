/**
 * Home's own rules that are not the recommendation, the gate or the week:
 * the greeting, how many columns the tiles take, and what a tile says when
 * it isn't a movement's (journey §7.1, §7.2). Plain functions, so the screen
 * stays a layout.
 */
import { format } from 'date-fns';
import type { Category } from '@/categories';
import { pairBloodPressure, series } from '@/health/aggregate';
import { isBpKind, type Observation, type ObservationKind } from '@/health/observation';
import { formatDayShort, formatObservation, type DisplayPrefs } from '@/screens/track/format';
import { METRICS } from '@/screens/track/metrics';
import { addDays } from '@/screens/track/periods';
import { formatPressure } from '@/screens/track/timeline';
import type { Mode } from '@/engine/permission';
import type { DueItem } from '@/health/cadence';
import { dayPartOf, type DayPart, type Recommendation } from '@/health/recommend';
import type { Status } from '@/health/status';
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

/**
 * Two columns at 375 CSS px wide and above with text at 130% or less;
 * otherwise one (journey §7.1). A desktop flows them into 3 from 1024 px and
 * 4 from 1280 px (§7.7); large text keeps one column at any width.
 */
export function tileColumns({ width, scale }: { width: number; scale: number }): 1 | 2 | 3 | 4 {
  if (width < 375 || scale > TWO_UP_SCALE + 1e-9) return 1;
  return width >= 1280 ? 4 : width >= 1024 ? 3 : 2;
}

/** What a stretch or a walk is, when the suggestion is about something else. */
const PLAIN: Record<Exclude<Mode, 'guided'>, string> = { stretch: '10 or 15 min', walk: 'Just a walk' };

/**
 * A movement tile's line when its gate allows it (`movementLine`'s `normal`):
 * the suggestion's own title when the Right now card suggests this mode, so
 * the tile and the card read alike; otherwise the programme's session, or a
 * plain line for a stretch or a walk.
 */
export function normalLine(mode: Mode, { recommendation: r, enrolled, plan, done = false }: {
  recommendation: Recommendation;
  enrolled: boolean;
  plan: Pick<SessionPlan, 'label' | 'totalSeconds'>;
  /** The twelve weeks are over (D116). */
  done?: boolean;
}): string {
  if (mode === 'guided' && enrolled && done) return 'The 12 weeks are done';
  // The day's session is the plan's own line, with its minutes.
  if (r.action.mode === mode && r.kind !== 'scheduled') return r.title;
  if (mode === 'guided') return workoutNormal({ enrolled, label: plan.label, minutes: Math.round(plan.totalSeconds / 60) });
  return PLAIN[mode];
}

/**
 * The line on a tile that starts no movement. Glucose and blood pressure show
 * today's latest reading with when and where it was taken (A-12); otherwise
 * each reading shows its last value and its day (`lastReadings`), until Plan
 * 2's hubs take this over, and invites one when there has been none.
 */
export function readingLine(id: CategoryId, latest: { glucose?: Reading; pressure?: Reading; last?: Partial<Record<CategoryId, TileLine>> }): TileLine {
  if (id === 'learn') return { text: 'For you', tone: 'normal' };
  const last = latest.last?.[id];
  if (id === 'glucose' || id === 'bp') {
    const reading = id === 'glucose' ? latest.glucose : latest.pressure;
    if (reading) return { text: reading.value, detail: `Today · ${reading.detail}`, tone: 'normal' };
    return last ?? { text: 'Not entered today', tone: 'normal' };
  }
  return last ?? { text: 'Add a reading', tone: 'normal' };
}

const newest = (list: readonly Observation[]) => list.reduce<Observation | undefined>((a, o) => (!a || Date.parse(o.at) > Date.parse(a.at) ? o : a), undefined);
const LABS: readonly ObservationKind[] = ['hba1c', 'b12', 'vitaminD'];
const TOTALS: [CategoryId, ObservationKind][] = [['steps', 'steps'], ['water', 'water'], ['sleep', 'sleep']];

/**
 * Each reading tile's last value, with when it was taken (journey §7.2, A-12,
 * kiro KV-17): "Last: 65 kg · Mon", "Last: 4,210 steps · Wed", "Last HbA1c
 * 6.8% · Mar". The day is "today", a weekday within the week, or the date.
 * Today's glucose and blood pressure are left to their own line, with its
 * time and source. Only dated records count: an undated weight from v1's
 * settings is no reading (B-16).
 */
export function lastReadings(observations: readonly Observation[], today: string, prefs: DisplayPrefs): Partial<Record<CategoryId, TileLine>> {
  const day = (d: string) => (d === today ? 'today' : d > addDays(today, -7) ? format(new Date(`${d}T12:00:00`), 'EEE') : formatDayShort(d, today));
  const line = (text: string): TileLine => ({ text, tone: 'normal' });
  const out: Partial<Record<CategoryId, TileLine>> = {};
  const points = (kinds: readonly ObservationKind[]) => observations.filter(o => kinds.includes(o.kind) && o.scope === 'pointInTime');

  const glucose = newest(points(['glucose']));
  if (glucose && glucose.day !== today) out.glucose = line(`Last: ${formatObservation(glucose, prefs)} · ${day(glucose.day)}`);
  const bp = pairBloodPressure(observations.filter(o => isBpKind(o.kind))).at(-1);
  const bpDay = bp?.halves[0]?.day;
  if (bp && bpDay && bpDay !== today) out.bp = line(`Last: ${formatPressure(bp)} · ${day(bpDay)}`);
  for (const kind of ['weight', 'waist'] as const) {
    const o = newest(points([kind]));
    if (o) out[kind] = line(`Last: ${formatObservation(o, prefs)} · ${day(o.day)}`);
  }
  // Day totals go through the aggregate, which applies the replace rule and never double-counts.
  for (const [id, kind] of TOTALS) {
    const own = observations.filter(o => o.kind === kind);
    if (!own.length) continue;
    const from = own.reduce((min, o) => (o.day < min ? o.day : min), today);
    const p = series(kind, { from, to: today }, own).points.filter(x => x.scope === 'dayTotal').at(-1);
    if (p) out[id] = line(`Last: ${formatObservation({ kind, value: p.value, unit: p.observations[0].unit }, prefs)} · ${day(p.day)}`);
  }
  // Back and leg as one record: the latest moment, and only what it held (as Trends reads it, J2-13).
  const pain = newest(points(['backPain', 'legPain']));
  if (pain) {
    const record = observations.filter(o => (o.kind === 'backPain' || o.kind === 'legPain') && o.context === pain.context && o.at === pain.at);
    const back = record.find(o => o.kind === 'backPain');
    const leg = record.find(o => o.kind === 'legPain');
    out.back = line(`Last: ${[back && `Back ${back.value}`, leg && `Leg ${leg.value}`].filter(Boolean).join(' · ')} · ${day(pain.day)}`);
  }
  const lab = newest(points(LABS));
  if (lab) {
    const month = format(new Date(`${lab.day}T12:00:00`), lab.day.slice(0, 4) === today.slice(0, 4) ? 'MMM' : 'MMM yyyy');
    out.labs = line(`Last ${METRICS[lab.kind as 'hba1c' | 'b12' | 'vitaminD'].title} ${formatObservation(lab, prefs)} · ${month}`);
  }
  return out;
}

/** Blood pressure readings due today: a weekly check day, or a day of the diagnostic week (`@/health/cadence`). */
const BP_DAY = new Set<DueItem['kind']>(['bpCheckDay', 'bpWeek']);

/**
 * The words beside a tile's caution dot when something is due today (journey
 * §7.2): "Check day" on Blood pressure, from the cadence model's own list,
 * which v1's Today showed as "Blood pressure check day". Glucose has none:
 * the model sets no recurring glucose check without a clinician's plan. As the
 * prompt row does, nothing is asked while Away or Unwell, or beside a stop.
 */
export function dueWords(id: CategoryId, { due, status, stopped }: { due: readonly DueItem[]; status: Status; stopped: boolean }): string | undefined {
  if (stopped || status === 'away' || status === 'unwell') return undefined;
  if (id === 'bp' && due.some(d => BP_DAY.has(d.kind))) return 'Check day';
  return undefined;
}
