/**
 * Stretch (Move → Stretch): a short routine on its own, outside the programme
 * (board D6, D8).
 *
 * Stretch is new clinical surface for people with disc problems and sciatica,
 * so it is not a list of exercises chosen here. Every movement comes out of the
 * guided session's own mobility block, which applies the safety-flag matrix,
 * the irritability swaps, the nerve-glide regressions and the direction rules
 * exactly as the guided session does. This module only decides which of that
 * block's templates suits the chosen area, then checks the result against the
 * matrix once more and refuses to plan anything that fails.
 *
 * The plan has the shape of the guided session's recovery and rest-day plans:
 * a welcome, the mobility steps, the flow's closing talk and a wrap-up, so the
 * existing player and narration run it unchanged.
 */

import type { AppData, WorkoutSession } from '@/types';
import { MOBILITY_REGIONS, type EquipmentTag, type MobilityRegion } from '@/types/catalog';
import type { DailyCheckIn, Readiness } from '@/types/checkin';
import type { Block, MobilityDayType, SessionPlan, Step, StretchFocus, StretchMinutes, StretchSpec } from '@/types/plan';
import type { UserProfile } from '@/types/profile';
import { EQUIPMENT_BY_ACCESS, getMeta, hasEquipment } from '@/data/catalog';
import { getWeekNumber } from '@/lib/utils';
import { periodOn } from '@/health/status';
import { evaluateCheckIn, profileOnlyReadiness } from './readiness';
import { activeConditions, evaluateFlags, type Conditions } from './safety';
import { mobilityBlock, REGION_TARGETS, regionsOf } from './mobility';
import { modeFor, phaseFor } from './dosage';
import { stepSeconds, totalSeconds } from './timing';
import { createSpeechSizer } from './speech';

export const STRETCH_FOCI: StretchFocus[] = ['backHips', 'neckShoulders', 'hipsLegs', 'wholeBody'];
export const STRETCH_MINUTES: StretchMinutes[] = [10, 15];

export const STRETCH_FOCUS_LABEL: Record<StretchFocus, string> = {
  backHips: 'Back & hips',
  neckShoulders: 'Neck & shoulders',
  hipsLegs: 'Hips & legs',
  wholeBody: 'Whole body',
};

/** The routine people with a back history are offered first (and everyone, until they choose). */
export const DEFAULT_STRETCH: StretchSpec = { focus: 'backHips', minutes: 10 };

/**
 * Ten minutes is Back & hips only. The shared basics take six and a half of
 * those minutes, and with sciatica the nerve glide most of the rest, so a
 * ten-minute "Neck & shoulders" would be the same back routine under another
 * name. Fifteen minutes leaves room for the chosen area.
 */
export function stretchOffered(spec: StretchSpec): boolean {
  return spec.minutes === 15 || spec.focus === 'backHips';
}

/** The nearest routine that is offered: the area is kept, the length grows if it must. */
export function offeredSpec(spec: StretchSpec): StretchSpec {
  return stretchOffered(spec) ? spec : { focus: spec.focus, minutes: 15 };
}

/** "10 min · Back & hips". */
export function stretchSummary(spec: StretchSpec): string {
  return `${spec.minutes} min · ${STRETCH_FOCUS_LABEL[spec.focus]}`;
}

/**
 * Which mobility templates can carry each area, best first, and the regions
 * that count as the area.
 *
 * The targets steer the block's long deep holds (45–60 s), and only to
 * stretches the guided session already holds that long: the hip flexor,
 * figure-4 and strap hamstring stretches, and the thoracic and adductor
 * drills. Neck, shoulder, quad and calf stretches stay at the 20–30 s the
 * back and sciatica research doses them at, and everything the coach says in
 * a long hold is already recorded (voice packs). Their order matters because a
 * core day uses the first two.
 */
const FOCUS: Record<StretchFocus, { days: MobilityDayType[]; regions: readonly MobilityRegion[]; targets?: MobilityRegion[] }> = {
  backHips: {
    days: ['core', 'lowerHinge'],
    regions: ['lowerBack', 'torso', 'glutes', 'hipFlexors', 'adductors'],
    targets: ['glutes', 'hipFlexors', 'adductors'],
  },
  neckShoulders: {
    days: ['upperPull', 'upperPush'],
    regions: ['neck', 'shoulders', 'thoracic', 'chest', 'lats'],
    targets: ['thoracic'],
  },
  hipsLegs: {
    days: ['lowerSquat', 'lowerHinge'],
    regions: ['glutes', 'hipFlexors', 'adductors', 'hamstrings', 'quads', 'calves'],
    targets: ['hipFlexors', 'glutes', 'adductors', 'hamstrings'],
  },
  // The person's own flexibility targets, as the guided session uses them.
  wholeBody: { days: ['fullBody', 'core'], regions: MOBILITY_REGIONS },
};

/** The regions an area counts as its own. */
export function focusRegions(focus: StretchFocus): readonly MobilityRegion[] {
  return FOCUS[focus].regions;
}

/**
 * A stretch happens wherever the person is, so it plans for what most homes
 * have (a mat, a chair, a wall, a strap or towel, a broom handle, a step),
 * not for the gym the programme assumes. The block swaps out anything else.
 */
const STRETCH_EQUIPMENT: EquipmentTag[] = EQUIPMENT_BY_ACCESS.homeNone;

/** Mirrors the guided session's closing talk, so the same recorded lines play. */
const WRAP_UP_SECONDS = 60;

export interface StretchInput {
  profile: UserProfile;
  /** YYYY-MM-DD */
  date: string;
  /** Programme start (settings.startDate): sets the week, which sets how long deep holds last. */
  startDate: string;
  /** Earlier sessions: how familiar each drill is, which sizes the spoken instructions. */
  sessions: WorkoutSession[];
  checkIn?: DailyCheckIn;
  /** Earlier check-ins, for the two-days-running rules. */
  recentCheckIns?: DailyCheckIn[];
  focus: StretchFocus;
  minutes: StretchMinutes;
  /**
   * A Flare-up status covers this day. With a back history the routine is
   * the gentler one the check-in's irritable back would choose, without
   * waiting for the check-in to say so: the person has already said it.
   */
  flare?: boolean;
}

/** Read the day the way the guided session's planner does. */
function readinessOf(input: StretchInput): Readiness {
  return input.checkIn
    ? evaluateCheckIn(input.profile, input.checkIn, input.recentCheckIns ?? [])
    : profileOnlyReadiness(input.profile);
}

function blockStartsOf(steps: Step[]): Partial<Record<Block, number>> {
  const starts: Partial<Record<Block, number>> = {};
  let t = 0;
  for (const s of steps) {
    if (starts[s.block] === undefined) starts[s.block] = t;
    t += stepSeconds(s);
  }
  return starts;
}

type Movement = Extract<Step, { kind: 'hold' | 'drill' }>;
const movements = (steps: Step[]): Movement[] => steps.filter((s): s is Movement => s.kind === 'hold' || s.kind === 'drill');

/**
 * Why a planned movement fails today's safety matrix, or null when it passes.
 *
 * The block already applies these rules; this is the same matrix asked again
 * of the finished plan, so a gap in one template path cannot reach the person.
 * One rule is deliberately the block's own reading of gate G5: a hold that
 * tensions an un-cleared sciatic nerve is allowed only as a short stretch, the
 * 20–30 seconds the back and sciatica research doses the strap stretch at,
 * never as a long flexibility hold.
 */
function unsafeReason(step: Movement, c: Conditions, profile: UserProfile, equipment: EquipmentTag[]): string | null {
  const meta = getMeta(step.exerciseId);
  if (!meta) return 'not in the catalogue';
  if ('retired' in meta && meta.retired) return 'retired';
  if (meta.kind === 'mobility' && meta.status === 'excluded') return 'excluded from plans';
  if (meta.kind === 'cardio') return 'not a mobility drill';
  if (!hasEquipment(meta, equipment)) return 'needs equipment a stretch does not assume';
  const verdict = evaluateFlags(meta.flags, c);
  if (verdict.excluded) return verdict.reason ?? 'excluded today';
  const hold = step.kind === 'hold' ? step.holdSeconds : 0;
  if (verdict.needsNeuralGate && (step.kind !== 'hold' || hold > 30)) return 'tensions the sciatic nerve before its gate is cleared';
  if (verdict.caps.maxHoldSeconds !== undefined && hold > verdict.caps.maxHoldSeconds) return 'held longer than today allows';
  if (c.sciaticaActive && hold > 30 && regionsOf(step.exerciseId).includes('hamstrings')) return 'a long hamstring hold with leg symptoms';
  if (meta.kind === 'mobility' && meta.status === 'avoidWhenIrritable' && (c.backIrritable || c.sciaticaActive)) return 'avoided while the back is irritable';
  if (meta.flags.endRangeFlexion && c.worseWith === 'flexion' && profile.pain.preference !== 'flexion') return 'end-range bending that makes the back worse';
  if (meta.flags.endRangeExtension && c.worseWith === 'extension' && profile.pain.preference !== 'extension') return 'end-range arching that makes the back worse';
  const ladder = meta.kind === 'strength' ? meta.ladder : undefined;
  if (ladder && c.ladder[ladder.track] < ladder.level) return `above today's ${ladder.track} level`;
  return null;
}

function idOf(date: string, spec: StretchSpec, r: Readiness): string {
  return `stretch:${date}:${spec.focus}:${spec.minutes}:${r.outcome}:${[...r.modifiers].sort().join('')}`;
}

/** The spec a stretch plan id was built from, or null for any other id. */
export function specFromPlanId(id: string | undefined): StretchSpec | null {
  const [tag, , focus, minutes] = (id ?? '').split(':');
  const spec = { focus, minutes: Number(minutes) } as StretchSpec;
  return tag === 'stretch' && STRETCH_FOCI.includes(spec.focus) && STRETCH_MINUTES.includes(spec.minutes) ? spec : null;
}

export function buildStretchPlan(input: StretchInput): SessionPlan {
  const { profile, date } = input;
  const spec: StretchSpec = { focus: input.focus, minutes: input.minutes };
  const readiness = readinessOf(input);
  const week = getWeekNumber(input.startDate, date);
  const changes = readiness.reasons.filter(r => r.outcome !== 'green').map(r => r.message);
  // A recovery day gets the recovery session's own gentle template whatever
  // the area, as the guided session does on that day.
  const recovery = readiness.outcome === 'recovery';
  const days = recovery ? ['core' as const] : FOCUS[spec.focus].days;
  const base = {
    id: idOf(date, spec, readiness), date, week, phase: phaseFor(week), mode: modeFor(week),
    // A stretch is no day of the programme. Recorded sessions carry the plan
    // kind, which is what keeps it from counting as the day's workout.
    focus: 'activeRecovery' as const,
    label: `${STRETCH_FOCUS_LABEL[spec.focus]} stretch`,
    readiness, stretch: spec, exercises: [], cardio: null, warnings: [],
  };
  const none = (extra: string[] = []): SessionPlan => ({
    ...base, kind: 'none', mobilityDayType: days[0], steps: [], blockStarts: {}, totalSeconds: 0, changes: [...changes, ...extra],
  });
  // Refused for stretching alone: the reason that refuses it is said first (J2-04).
  const refusing = readiness.reasons.filter(r => r.refuses?.includes('stretch')).map(r => r.message);

  if (readiness.outcome === 'urgent' || readiness.outcome === 'red') return none();
  if (refusing.length || readiness.refusedModes?.includes('stretch')) return { ...none(), changes: [...refusing, ...changes.filter(x => !refusing.includes(x))] };

  // A declared flare-up is an irritable back for the routine's choices, and
  // only ever gentler: a back already amber or red is left as it is.
  const backHistory = profile.pain.areas.includes('lowerBack') || profile.pain.areas.includes('sciatica');
  const flare = input.flare === true && backHistory && readiness.back !== 'amber' && readiness.back !== 'red';
  const day: Readiness = flare ? { ...readiness, back: 'amber' } : readiness;
  if (flare) changes.push('A gentler routine: your back is in a flare-up.');
  const conditions = activeConditions(profile, day);
  const area = FOCUS[spec.focus];
  const budget = spec.minutes * 60 - WRAP_UP_SECONDS;
  // A stretch does not chase the week's coverage ledger; the guided session
  // does that. Regions outside the area count as covered and the area's as
  // open, so the block's coverage slot picks the area region this routine
  // leaves furthest behind. The routine, and so every line the coach says in
  // it, then depends on the day and not on the history.
  const coverage = Object.fromEntries(MOBILITY_REGIONS.map(r => [r, area.regions.includes(r) ? 0 : REGION_TARGETS[r]]));
  const speech = createSpeechSizer(profile, input.sessions);

  /**
   * One template's block, re-planned without any target region whose deep
   * hold fails the matrix. Null when it cannot be made to pass, or to fit.
   */
  const blockFor = (dayType: MobilityDayType): Step[] | null => {
    for (let targets = area.targets ?? profile.flexibilityTargets; ;) {
      const steps = mobilityBlock({
        dayType, profile: { ...profile, flexibilityTargets: targets }, readiness: day, conditions,
        equipment: STRETCH_EQUIPMENT, week, budgetSeconds: budget, coverage, speech, idPrefix: 's',
      });
      if (totalSeconds(steps) > budget) return null;
      const unsafe = movements(steps).filter(s => unsafeReason(s, conditions, profile, STRETCH_EQUIPMENT) !== null);
      if (unsafe.length === 0) return steps;
      const kept = targets.filter(r => !unsafe.some(s => regionsOf(s.exerciseId).includes(r)));
      if (kept.length === targets.length) return null;
      targets = kept;
    }
  };

  // The template that spends the most time in the chosen area; the first
  // listed wins a tie.
  const inArea = (steps: Step[]) => movements(steps)
    .filter(s => regionsOf(s.exerciseId).some(r => area.regions.includes(r)))
    .reduce((t, s) => t + stepSeconds(s), 0);
  let best: { dayType: MobilityDayType; steps: Step[]; score: number } | null = null;
  for (const dayType of days) {
    const steps = blockFor(dayType);
    if (!steps) continue;
    const score = inArea(steps);
    if (!best || score > best.score) best = { dayType, steps, score };
  }
  if (!best) return none(['This routine cannot be put together safely today. Try another area or length.']);

  // First, so a one-line summary of the day says what changed for the stretch.
  if (recovery) changes.unshift('A gentle routine today: the one a recovery day uses, whatever the area.');
  const steps: Step[] = [
    ...best.steps,
    { kind: 'talk', id: 'wrap-up', block: 'wrapUp', title: 'Session complete', topic: 'wrapUp', seconds: WRAP_UP_SECONDS },
  ];
  return {
    ...base, kind: 'stretch', mobilityDayType: best.dayType, steps,
    blockStarts: blockStartsOf(steps), totalSeconds: totalSeconds(steps), changes,
  };
}

/**
 * Today's stretch, built from the stored record the way `planFor` builds the
 * guided session: only earlier sessions feed it, so the Stretch screen's
 * preview and the player build the same plan.
 */
export function stretchPlanFor(
  data: Pick<AppData, 'settings' | 'sessions' | 'checkIns'>,
  profile: UserProfile,
  date: string,
  spec: StretchSpec,
): SessionPlan {
  const checkIns = data.checkIns ?? [];
  const checkIn = checkIns.find(c => c.date === date);
  return buildStretchPlan({
    profile, date, startDate: data.settings.startDate,
    sessions: data.sessions.filter(s => s.date < date),
    recentCheckIns: checkIns.filter(c => c.date < date),
    ...(checkIn ? { checkIn } : {}),
    ...(periodOn(data.settings.statusPeriods, date)?.kind === 'flare' ? { flare: true } : {}),
    ...spec,
  });
}

/** The routine last recorded, or the default when there is none. */
export function lastStretch(sessions: WorkoutSession[]): StretchSpec {
  let latest: WorkoutSession | undefined;
  for (const s of sessions) {
    if (s.planKind !== 'stretch' || !specFromPlanId(s.planId)) continue;
    const when = (x: WorkoutSession) => `${x.date}|${x.startedAt ?? ''}`;
    if (!latest || when(s) > when(latest)) latest = s;
  }
  const spec = latest ? specFromPlanId(latest.planId) : null;
  return spec ? offeredSpec(spec) : DEFAULT_STRETCH;
}

/** Where Start stretch goes: the session player, told which routine to build. */
export function stretchHref(spec: StretchSpec): string {
  return `/session?mode=stretch&focus=${spec.focus}&minutes=${spec.minutes}`;
}

/**
 * The routine a player URL asks for, or null when it asks for something else
 * (the guided session, a resume). An unknown area or length falls back to the
 * default rather than to the guided session: whoever tapped Start stretch
 * asked for a stretch.
 */
export function parseStretchSpec(params: URLSearchParams): StretchSpec | null {
  if (params.get('mode') !== 'stretch') return null;
  return readStretchSpec(params, DEFAULT_STRETCH);
}

/** The area and length in a URL's query, each falling back to `fallback`'s. */
export function readStretchSpec(params: URLSearchParams, fallback: StretchSpec): StretchSpec {
  const focus = params.get('focus') as StretchFocus | null;
  const minutes = Number(params.get('minutes'));
  return offeredSpec({
    focus: focus && STRETCH_FOCI.includes(focus) ? focus : fallback.focus,
    minutes: STRETCH_MINUTES.includes(minutes as StretchMinutes) ? minutes as StretchMinutes : fallback.minutes,
  });
}
