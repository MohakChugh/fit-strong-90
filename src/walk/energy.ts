/**
 * About how much energy a walk used (journey §12.4, V7, A-50, B-17, B-18).
 *
 * Active energy, the energy above resting: (MET − 1) × kg × hours, from the
 * 2024 Compendium of Physical Activities by measured speed, worked out per
 * covered interval. Shown as "about", to the nearest 10, on summaries and
 * details only. Never a gross figure, never live.
 */
import { format } from 'date-fns';
import type { Observation } from '@/health/observation';
import { measuredRuns, type Walk } from './clock';
import type { WalkInput } from './record';
import { isoAt } from './time';

export interface MetBand {
  /** The band runs from this speed to the next band's. */
  fromMph: number;
  met: number;
  /** The Compendium's activity code. */
  code: string;
}

/** 2024 Adult Compendium, level walking, firm surface (pacompendium.com/walking, checked at the source on the board, D85). */
export const ADULT_WALKING: readonly MetBand[] = [
  { fromMph: 0, met: 2.3, code: '17151' },
  { fromMph: 2.0, met: 2.8, code: '17152' },
  { fromMph: 2.5, met: 3.0, code: '17170' },
  { fromMph: 2.8, met: 3.8, code: '17190' },
  { fromMph: 3.5, met: 4.8, code: '17200' },
  { fromMph: 4.0, met: 5.5, code: '17220' },
  { fromMph: 4.5, met: 7.0, code: '17230' },
];
/** Time without a usable speed (journey §12.4: "Without it, the walk uses 2.8"). */
export const ADULT_NO_DISTANCE: MetBand = { fromMph: 2.0, met: 2.8, code: '17152' };
/** At this speed or faster it isn't a walk for this app: no estimate (B-18). */
export const MAX_WALK_MPH = 5;

export interface OlderTable {
  bands: readonly MetBand[];
  noDistance: MetBand;
  /** MET60+ values are read against an older adult's lower resting rate: kcal scale by this. */
  restingFactor: number;
}
/**
 * The 2024 Older Adult Compendium's walking values, as printed (MET60+, read
 * against 2.7 mL/kg/min), confirmed at the source on the board (B-18, D85).
 * Undefined would mean no figure for 60 and over.
 */
export const OLDER_ADULT_WALKING: OlderTable | undefined = {
  bands: [
    { fromMph: 0, met: 3.0, code: '1715160' },
    { fromMph: 1.0, met: 4.0, code: '1715260' },
    { fromMph: 2.0, met: 3.8, code: '1715360' },
    { fromMph: 2.2, met: 4.5, code: '1717060' },
    { fromMph: 2.8, met: 5.3, code: '1719060' },
    { fromMph: 3.3, met: 6.0, code: '1720060' },
    { fromMph: 4.0, met: 7.3, code: '1722060' },
    { fromMph: 4.5, met: 9.0, code: '1723060' },
  ],
  noDistance: { fromMph: 2.0, met: 3.8, code: '1715360' },
  restingFactor: 2.7 / 3.5,
};

export const MPH_PER_MPS = 2.236936;
/** Thinner than either, a run has no speed worth a band (the same floor as the average pace). */
const RUN_MIN_MS = 60_000;
const RUN_MIN_M = 100;

export type AgeBand = 'adult' | 'older' | 'young' | 'unknown';

/**
 * Which Compendium (B-18), from a birth year alone, conservatively (B-31): the
 * person may or may not have had this year's birthday, so both ages count.
 */
export function ageBand(birthYear: number | undefined, year: number): AgeBand {
  if (birthYear === undefined || !Number.isFinite(birthYear)) return 'unknown';
  const youngest = year - birthYear - 1;
  const oldest = year - birthYear;
  if (youngest < 19) return 'young';
  if (oldest >= 60) return 'older';
  return 'adult';
}

/** The band a speed falls in, or nothing for a speed this app can't estimate. */
export function walkingMet(mph: number, bands: readonly MetBand[]): MetBand | undefined {
  if (!(mph >= 0) || mph >= MAX_WALK_MPH) return undefined;
  let found: MetBand | undefined;
  for (const band of bands) if (mph >= band.fromMph) found = band;
  return found;
}

export interface WeightUsed {
  kg: number;
  from: 'reading' | 'profile';
  /** The reading's day, for a dated reading. */
  day?: string;
}

/** The weight in effect at `atMs` (A-36): the latest dated reading at or before it, else the profile's. */
export function weightAt(observations: readonly Observation[], atMs: number, profileKg: number | undefined): WeightUsed | undefined {
  let best: Observation | undefined;
  for (const o of observations) {
    if (o.kind !== 'weight' || !(o.value > 0)) continue;
    const t = Date.parse(o.at);
    if (!(t <= atMs)) continue;
    const b = best ? Date.parse(best.at) : -Infinity;
    if (t > b || (t === b && (o.seq ?? 0) > (best?.seq ?? 0))) best = o;
  }
  if (best) return { kg: best.value, from: 'reading', day: best.day };
  return profileKg !== undefined && profileKg > 0 ? { kg: profileKg, from: 'profile' } : undefined;
}

export type EnergyNone = 'noWeight' | 'unknownAge' | 'young' | 'olderUnconfirmed' | 'tooFast' | 'tooShort';
export type EnergyEstimate =
  | { kind: 'about'; kcal: number; rounded: number; coveredMs: number; uncoveredMs: number; kg: number }
  | { kind: 'none'; reason: EnergyNone };

/** To the nearest 10; under 5 kcal there's no estimate worth the words. */
export function roundKcal(kcal: number): number | undefined {
  if (!(kcal >= 5)) return undefined;
  return Math.max(10, Math.round(kcal / 10) * 10);
}

const ADULT: OlderTable = { bands: ADULT_WALKING, noDistance: ADULT_NO_DISTANCE, restingFactor: 1 };

export function estimateEnergy(
  input: { runs: readonly { ms: number; metres: number }[]; observedMs: number; kg?: number; band: AgeBand },
  tables: { older?: OlderTable } = { older: OLDER_ADULT_WALKING },
): EnergyEstimate {
  if (input.band === 'unknown') return { kind: 'none', reason: 'unknownAge' };
  if (input.band === 'young') return { kind: 'none', reason: 'young' };
  const table = input.band === 'adult' ? ADULT : tables.older;
  if (!table) return { kind: 'none', reason: 'olderUnconfirmed' };
  if (input.kg === undefined || !(input.kg > 0)) return { kind: 'none', reason: 'noWeight' };
  const kg = input.kg;
  let kcal = 0;
  let covered = 0;
  for (const run of input.runs) {
    if (run.ms < RUN_MIN_MS || run.metres < RUN_MIN_M) continue;
    const band = walkingMet((run.metres / (run.ms / 1000)) * MPH_PER_MPS, table.bands);
    if (!band) return { kind: 'none', reason: 'tooFast' };
    kcal += (band.met - 1) * table.restingFactor * kg * (run.ms / 3_600_000);
    covered += run.ms;
  }
  const uncovered = Math.max(0, input.observedMs - covered);
  kcal += (table.noDistance.met - 1) * table.restingFactor * kg * (uncovered / 3_600_000);
  const rounded = roundKcal(kcal);
  if (rounded === undefined) return { kind: 'none', reason: 'tooShort' };
  return { kind: 'about', kcal, rounded, coveredMs: covered, uncoveredMs: uncovered, kg };
}

const WHY_NOT: Record<EnergyNone, string> = {
  noWeight: 'Add your weight for an estimate.',
  unknownAge: 'Add your birth year for an estimate.',
  young: 'Estimates are for ages 19 and over.',
  olderUnconfirmed: 'Estimates for ages 60 and over aren’t available yet.',
  tooFast: 'No estimate: part of this walk was faster than walking pace.',
  tooShort: 'Too short for an energy estimate.',
};

/** The words for an estimate: its figure, and what it was worked out from (B-17), with the weight it used (B-16). */
export function energyText(e: EnergyEstimate, weight?: WeightUsed): { value: string; detail: string } {
  if (e.kind === 'none') return { value: 'No estimate', detail: WHY_NOT[e.reason] };
  const min = (ms: number) => Math.round(ms / 60_000);
  const covered = min(e.coveredMs);
  const uncovered = min(e.uncoveredMs);
  const basis = covered > 0 && uncovered > 0
    ? `From ${covered} min with distance and ${uncovered} min without it, counted at an easy pace.`
    : covered > 0 ? `From ${covered} min with distance.` : `From ${uncovered} min without distance, counted at an easy pace.`;
  const kg = Math.round(e.kg * 10) / 10;
  const from = weight?.from === 'reading' && weight.day
    ? `, your weight on ${format(new Date(`${weight.day}T12:00:00`), 'd MMM')}`
    : ', from your profile';
  return { value: `about ${e.rounded} kcal`, detail: `${basis} Using ${kg} kg${from}.` };
}

/** A finished walk's estimate, and the record it is kept as, with the weight it used (B-16). */
export function walkEnergy(
  walk: Walk,
  ctx: { birthYear?: number; observations: readonly Observation[]; profileKg?: number },
): { estimate: EnergyEstimate; weight?: WeightUsed; input?: WalkInput } {
  const first = walk.segments[0];
  const band = ageBand(ctx.birthYear, Number(first.day.slice(0, 4)));
  const weight = weightAt(ctx.observations, first.start, ctx.profileKg);
  const runs = walk.plan.gps ? walk.segments.flatMap(measuredRuns).map(r => ({ ms: r.end - r.start, metres: r.distanceM })) : [];
  const observedMs = walk.segments.reduce((t, s) => t + s.accruedMs, 0);
  const estimate = estimateEnergy({ runs, observedMs, ...(weight ? { kg: weight.kg } : {}), band });
  if (estimate.kind !== 'about' || !weight) return { estimate, ...(weight ? { weight } : {}) };
  return {
    estimate,
    weight,
    input: {
      id: `${walk.id}:activeEnergy`, kind: 'activeEnergy', value: Math.round(estimate.kcal * 10) / 10,
      scope: 'sessionObserved', source: 'measured', at: isoAt(first.start, first.offsetMin), coverageMs: observedMs,
      context: `walk:${walk.id}`, note: energyText(estimate, weight).detail,
    },
  };
}
