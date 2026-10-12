/**
 * The 15-minute mobility block (spec §4.2; back-sciatica-mobility.md §3–§5):
 * Raise → spine mobility + direction drill → McGill Big 3 → nerve sliders →
 * prime-mover stretches (≤ 30 s) → deep holds (non-prime movers / flexibility
 * targets) → coverage slot (region furthest behind) → activation →
 * potentiation, ending with a transition talk that absorbs the remainder so
 * the block is exactly on budget.
 */

import type { WorkoutSession } from '@/types';
import type { Readiness } from '@/types/checkin';
import type { EquipmentTag, MobilityMeta, MobilityRegion } from '@/types/catalog';
import type { DrillStep, HoldStep, MobilityDayType, Side, Step, TalkStep } from '@/types/plan';
import type { UserProfile } from '@/types/profile';
import { getMeta, getMobility, hasEquipment } from '@/data/catalog';
import { evaluateFlags, type Conditions } from './safety';
import { affectedFirst } from './dosage';
import { stepSeconds } from './timing';
import type { SpeechSizer } from './speech';

/** Regions for strength-catalogue drills used inside the mobility block. */
const EXTRA_REGIONS: Record<string, MobilityRegion[]> = {
  'mcgill-curl-up': ['torso'],
  'side-plank': ['torso'],
  'bird-dog': ['torso', 'lowerBack'],
  'dead-bug': ['torso'],
  'glute-bridge': ['glutes'],
  'pallof-press': ['torso'],
};

export function regionsOf(id: string): MobilityRegion[] {
  return getMobility(id)?.regions ?? EXTRA_REGIONS[id] ?? [];
}

/** Weekly exposure targets (spec §4.2 coverage guarantee). */
export const REGION_TARGETS: Record<MobilityRegion, number> = {
  lowerBack: 6, torso: 6,
  hipFlexors: 3, glutes: 3, shoulders: 3, thoracic: 3, calves: 3,
  neck: 2, chest: 2, lats: 2, armsWrists: 2, adductors: 2, hamstrings: 2, quads: 2,
};

const REGION_ITEMS: Record<MobilityRegion, string[]> = {
  neck: ['upper-trap-stretch', 'chin-tuck', 'levator-scapulae-stretch'],
  thoracic: ['open-book', 'thread-the-needle', 'foam-roller-thoracic-extension'],
  shoulders: ['cross-body-shoulder-stretch', 'scapular-wall-slide'],
  chest: ['doorway-pec-stretch', 'biceps-wall-stretch'],
  lats: ['standing-rack-lat-stretch', 'kneeling-lat-stretch', 'overhead-triceps-stretch'],
  armsWrists: ['wrist-flexor-extensor-stretch', 'overhead-triceps-stretch', 'biceps-wall-stretch'],
  torso: ['standing-side-bend', 'supine-twist'],
  lowerBack: ['pelvic-tilt', 'supine-twist', 'cat-cow'],
  hipFlexors: ['half-kneeling-hip-flexor-stretch', 'reverse-lunge-overhead-reach'],
  glutes: ['supine-figure-4', 'seated-piriformis-stretch', 'ninety-ninety-hip-switch'],
  adductors: ['adductor-rock-back', 'ninety-ninety-hip-switch'],
  hamstrings: ['supine-hamstring-stretch-strap', 'active-knee-extension', 'sciatic-nerve-glide-supine'],
  quads: ['side-lying-quad-stretch'],
  calves: ['soleus-stretch', 'wall-calf-stretch', 'knee-to-wall-rock'],
};

/** Equipment-free alternatives for drills that need kit the user lacks. */
const EQUIPMENT_SWAP: Record<string, string> = {
  'band-pull-apart': 'prone-y-t',
  'band-row': 'prone-y-t',
  'band-walk': 'glute-bridge',
  'scapular-pull-up': 'prone-y-t',
  'foam-roller-thoracic-extension': 'open-book',
  'march-in-place': 'diaphragmatic-breathing-90-90',
};

interface Item {
  id: string;
  /** Override hold seconds (holds) or reps (drills). */
  hold?: number;
  reps?: number;
  sets?: number;
  /** Which template slot this came from (for trimming priority). */
  slot: 'raise' | 'spine' | 'big3' | 'nerve' | 'prime' | 'deep' | 'coverage' | 'activate' | 'potentiate';
}

const DAY: Record<Exclude<MobilityDayType, 'core'>, { first: Item; prime: Item[]; deep: Item[]; activate: Item[]; potentiate: Item[] }> = {
  upperPush: {
    first: { id: 'open-book', reps: 6, slot: 'nerve' },
    prime: [{ id: 'scapular-wall-slide', reps: 8, slot: 'prime' }, { id: 'doorway-pec-stretch', hold: 20, sets: 2, slot: 'prime' }],
    deep: [{ id: 'half-kneeling-hip-flexor-stretch', hold: 60, slot: 'deep' }],
    activate: [{ id: 'scapular-push-up', reps: 10, slot: 'activate' }, { id: 'band-pull-apart', reps: 15, slot: 'activate' }],
    potentiate: [{ id: 'incline-push-up', reps: 8, slot: 'potentiate' }],
  },
  upperPull: {
    first: { id: 'thread-the-needle', reps: 6, slot: 'nerve' },
    prime: [{ id: 'kneeling-lat-stretch', hold: 20, sets: 2, slot: 'prime' }, { id: 'biceps-wall-stretch', hold: 20, slot: 'prime' }],
    deep: [{ id: 'supine-figure-4', hold: 60, slot: 'deep' }],
    activate: [{ id: 'prone-y-t', reps: 8, slot: 'activate' }, { id: 'scapular-pull-up', reps: 8, slot: 'activate' }],
    potentiate: [{ id: 'band-row', reps: 12, slot: 'potentiate' }],
  },
  lowerSquat: {
    first: { id: 'knee-to-wall-rock', reps: 10, slot: 'nerve' },
    prime: [{ id: 'soleus-stretch', hold: 20, slot: 'prime' }, { id: 'side-lying-quad-stretch', hold: 20, slot: 'prime' }, { id: 'adductor-rock-back', reps: 8, slot: 'prime' }],
    deep: [{ id: 'doorway-pec-stretch', hold: 45, slot: 'deep' }, { id: 'standing-rack-lat-stretch', hold: 30, slot: 'deep' }],
    activate: [{ id: 'glute-bridge', reps: 10, slot: 'activate' }, { id: 'band-walk', reps: 10, slot: 'activate' }],
    potentiate: [{ id: 'box-squat', reps: 8, slot: 'potentiate' }],
  },
  lowerHinge: {
    first: { id: 'active-knee-extension', reps: 8, slot: 'nerve' },
    prime: [{ id: 'supine-hamstring-stretch-strap', hold: 20, sets: 2, slot: 'prime' }, { id: 'supine-figure-4', hold: 20, slot: 'prime' }],
    deep: [{ id: 'half-kneeling-hip-flexor-stretch', hold: 60, slot: 'deep' }],
    activate: [{ id: 'glute-bridge', reps: 8, slot: 'activate' }, { id: 'dead-bug', reps: 6, slot: 'activate' }],
    potentiate: [{ id: 'dowel-hinge', reps: 10, slot: 'potentiate' }],
  },
  fullBody: {
    first: { id: 'reverse-lunge-overhead-reach', reps: 5, slot: 'nerve' },
    prime: [{ id: 'open-book', reps: 5, slot: 'prime' }, { id: 'scapular-wall-slide', reps: 8, slot: 'prime' }, { id: 'knee-to-wall-rock', reps: 8, slot: 'prime' }],
    deep: [{ id: 'half-kneeling-hip-flexor-stretch', hold: 50, slot: 'deep' }],
    activate: [{ id: 'glute-bridge', reps: 10, slot: 'activate' }, { id: 'band-pull-apart', reps: 12, slot: 'activate' }],
    potentiate: [{ id: 'box-squat', reps: 5, slot: 'potentiate' }, { id: 'incline-push-up', reps: 6, slot: 'potentiate' }],
  },
};

/** Muscles about to be loaded hard each day: never get long static holds. */
const PRIME_REGIONS: Record<MobilityDayType, MobilityRegion[]> = {
  upperPush: ['chest', 'shoulders', 'armsWrists'],
  upperPull: ['lats', 'armsWrists', 'shoulders'],
  lowerSquat: ['quads', 'glutes', 'adductors', 'calves'],
  lowerHinge: ['hamstrings', 'glutes', 'lowerBack'],
  fullBody: ['glutes', 'quads', 'chest'],
  core: [],
};

/** Deep-hold item for each flexibility target region. */
const TARGET_DEEP: Partial<Record<MobilityRegion, string>> = {
  hamstrings: 'supine-hamstring-stretch-strap',
  hipFlexors: 'half-kneeling-hip-flexor-stretch',
  thoracic: 'foam-roller-thoracic-extension',
  glutes: 'supine-figure-4',
  chest: 'doorway-pec-stretch',
  lats: 'standing-rack-lat-stretch',
  quads: 'side-lying-quad-stretch',
  calves: 'soleus-stretch',
  adductors: 'adductor-rock-back',
  shoulders: 'cross-body-shoulder-stretch',
  neck: 'upper-trap-stretch',
};

export interface MobilityContext {
  dayType: MobilityDayType;
  profile: UserProfile;
  readiness: Readiness;
  conditions: Conditions;
  equipment: EquipmentTag[];
  week: number;
  budgetSeconds: number;
  /** Exposures per region earlier this week. */
  coverage: Partial<Record<MobilityRegion, number>>;
  /** Mobility day types still to come this week (lookahead for the coverage slot). */
  upcoming?: MobilityDayType[];
  /** Sizes prep time to the narration. */
  speech?: SpeechSizer;
  /** Id prefix for step ids. */
  idPrefix?: string;
}

/** Deep-hold length by phase (flexibility progression, spec §4.2). */
export function deepHoldSeconds(week: number): number {
  if (week <= 4) return 45;
  if (week <= 8) return 55;
  return 60;
}

function sidesFor(meta: MobilityMeta | undefined, id: string, profile: UserProfile): Side[] | null {
  const sides = meta?.dose.sides ?? (['side-plank', 'bird-dog', 'dead-bug'].includes(id) ? 'each' : 'none');
  if (sides === 'none') return null;
  if (sides === 'affectedFirst') return profile.pain.sciaticaSide === 'both' ? ['left', 'right'] : affectedFirst(profile);
  return ['left', 'right'];
}

/** Resolve an item to something safe and available today, or null to drop it. */
function resolve(id: string, ctx: MobilityContext, used: Set<string>, depth = 0): string | null {
  if (depth > 3) return null;
  const meta = getMeta(id);
  if (!meta) return null;
  const mob = meta.kind === 'mobility' ? meta : undefined;
  const c = ctx.conditions;
  const swap = (to: string | undefined) => (to ? resolve(to, ctx, used, depth + 1) : null);

  if (mob?.status === 'excluded' || (mob?.retired ?? false)) return null;
  if (!hasEquipment(meta, ctx.equipment)) return swap(EQUIPMENT_SWAP[id]);
  if (mob && mob.status === 'avoidWhenIrritable' && (c.backIrritable || c.sciaticaActive)) return swap(mob.irritableSwap);
  if (mob?.irritableSwap && c.sciaticaActive && (meta.flags.sciaticTension ?? 0) >= 1 && mob.mode === 'hold') return swap(mob.irritableSwap);
  if (meta.flags.endRangeFlexion && c.worseWith === 'flexion' && ctx.profile.pain.preference !== 'flexion') return swap(mob?.irritableSwap);
  if (meta.flags.endRangeExtension && c.worseWith === 'extension' && ctx.profile.pain.preference !== 'extension') return null;
  const verdict = evaluateFlags(meta.flags, c);
  if (verdict.excluded) return swap(mob?.irritableSwap ?? EQUIPMENT_SWAP[id]);
  if (used.has(id)) return null;
  return id;
}

/** Long holds never tension an un-cleared sciatic nerve (gate G5). */
function nerveUnsafe(ctx: MobilityContext, id: string): boolean {
  return ctx.profile.pain.areas.includes('sciatica') && !ctx.profile.ladder.neuralGate && (getMeta(id)?.flags.sciaticTension ?? 0) >= 2;
}

function toStep(item: Item, ctx: MobilityContext, index: number): HoldStep | DrillStep {
  const meta = getMobility(item.id);
  const name = getMeta(item.id)?.name ?? item.id;
  const id = `${ctx.idPrefix ?? 'm'}${index}-${item.id}`;
  const sides = sidesFor(meta, item.id, ctx.profile);
  const floorPrep = ctx.speech?.prepSeconds(item.id, sides, meta?.floor ? 10 : 6) ?? (meta?.floor ? 10 : 6);
  // Mobility work earns the same caps as strength work: a hold limit under
  // raised blood pressure, and the range cues nerve tension asks for.
  const caps = capsFor(item.id, ctx);
  if (meta?.mode === 'hold') {
    let hold = item.hold ?? meta.dose.holdSeconds ?? 20;
    if (ctx.conditions.sciaticaActive && meta.regions.includes('hamstrings')) hold = Math.min(hold, 30);
    if (caps.maxHoldSeconds !== undefined) hold = Math.min(hold, caps.maxHoldSeconds);
    return {
      kind: 'hold', id, block: 'mobility', title: name, exerciseId: item.id,
      holdSeconds: hold, sets: item.sets ?? meta.dose.sets, sides, prepSeconds: floorPrep, switchSeconds: 5,
      deep: item.slot === 'deep', ...(caps.notes.length ? { caps: caps.notes } : {}),
    };
  }
  if (meta?.mode === 'breathing') {
    const reps = item.reps ?? meta.dose.reps ?? 6;
    return {
      kind: 'drill', id, block: 'mobility', title: name, exerciseId: item.id, reps, secondsPerRep: 10, sets: 1,
      sides: null, prepSeconds: floorPrep, switchSeconds: 0, breathing: { inhale: 4, exhale: 6 },
      ...(caps.notes.length ? { caps: caps.notes } : {}),
    };
  }
  // Reps drills, sliders, activation (incl. strength-catalogue trunk drills).
  const big3Hold = ['mcgill-curl-up', 'bird-dog'].includes(item.id) && item.slot === 'big3';
  const secondsPerRep = big3Hold ? 12 : meta?.dose.secondsPerRep ?? (item.id === 'glute-bridge' ? 4 : 4);
  return {
    kind: 'drill', id, block: 'mobility', title: name, exerciseId: item.id,
    reps: item.reps ?? meta?.dose.reps ?? 8, secondsPerRep, sets: item.sets ?? 1,
    sides: big3Hold && item.id === 'mcgill-curl-up' ? null : sides, prepSeconds: floorPrep, switchSeconds: 5,
    ...(caps.notes.length ? { caps: caps.notes } : {}),
  };
}

/** Caps this drill's own safety flags earn, whatever catalogue it comes from. */
function capsFor(id: string, ctx: MobilityContext) {
  const flags = getMeta(id)?.flags;
  return flags ? evaluateFlags(flags, ctx.conditions).caps : { notes: [] as string[], maxHoldSeconds: undefined };
}

function sideHold(item: Item, ctx: MobilityContext, index: number): HoldStep {
  const sides: Side[] = ['left', 'right'];
  const caps = capsFor(item.id, ctx);
  return {
    kind: 'hold', id: `${ctx.idPrefix ?? 'm'}${index}-${item.id}`, block: 'mobility',
    title: getMeta(item.id)?.name ?? item.id, exerciseId: item.id,
    holdSeconds: Math.min(item.hold ?? 10, caps.maxHoldSeconds ?? Infinity), sets: item.sets ?? 2,
    sides, prepSeconds: ctx.speech?.prepSeconds(item.id, sides, 8) ?? 8, switchSeconds: 5, deep: false,
    ...(caps.notes.length ? { caps: caps.notes } : {}),
  };
}

function directionDrill(profile: UserProfile): Item {
  if (profile.pain.preference === 'extension') return { id: 'prone-press-up', reps: 10, slot: 'spine' };
  if (profile.pain.preference === 'flexion') return { id: 'knee-to-chest', hold: 15, slot: 'spine' };
  return { id: 'pelvic-tilt', reps: 10, slot: 'spine' };
}

function welcome(ctx: MobilityContext): TalkStep {
  return { kind: 'talk', id: `${ctx.idPrefix ?? 'm'}welcome`, block: 'intro', title: 'Welcome', topic: 'welcome', seconds: 30 };
}

/** Exposures the default templates of the coming days will provide. */
function projectedExposures(days: MobilityDayType[]): Partial<Record<MobilityRegion, number>> {
  const out: Partial<Record<MobilityRegion, number>> = {};
  const add = (id: string) => { for (const r of regionsOf(id)) out[r] = (out[r] ?? 0) + 1; };
  for (const d of days) {
    for (const id of ['cat-cow', 'mcgill-curl-up', 'side-plank', 'bird-dog']) add(id);
    if (d === 'core') continue;
    const t = DAY[d];
    for (const it of [t.first, ...t.prime, ...t.deep, ...t.activate, ...t.potentiate]) add(it.id);
  }
  return out;
}

/** Count region exposures in a list of steps. */
export function exposuresIn(steps: Step[]): Partial<Record<MobilityRegion, number>> {
  const out: Partial<Record<MobilityRegion, number>> = {};
  for (const s of steps) {
    if (s.kind !== 'hold' && s.kind !== 'drill') continue;
    for (const r of regionsOf(s.exerciseId)) out[r] = (out[r] ?? 0) + 1;
  }
  return out;
}

/** Weekly exposures from logged sessions between weekStart (inclusive) and before `date`. */
export function coverageFromSessions(sessions: WorkoutSession[], weekStart: string, date: string): Partial<Record<MobilityRegion, number>> {
  const out: Partial<Record<MobilityRegion, number>> = {};
  for (const s of sessions) {
    if (s.date < weekStart || s.date >= date) continue;
    for (const m of s.mobility ?? []) for (const r of regionsOf(m.exerciseId)) out[r] = (out[r] ?? 0) + 1;
  }
  return out;
}

export function mobilityBlock(ctx: MobilityContext): Step[] {
  if (ctx.dayType === 'core') return coreDayBlock(ctx);
  const day = DAY[ctx.dayType];
  const c = ctx.conditions;
  const used = new Set<string>();
  const items: Item[] = [];
  const push = (item: Item | null) => {
    if (!item) return;
    const id = resolve(item.id, ctx, used);
    if (!id) return;
    used.add(id);
    items.push({ ...item, id });
  };

  // Raise: standing march, or seated/floor breathing when feet need protecting.
  push({ id: c.foot ? 'diaphragmatic-breathing-90-90' : 'march-in-place', reps: c.foot ? 6 : 30, slot: 'raise' });
  push({ id: 'cat-cow', reps: 7, slot: 'spine' });
  push(directionDrill(ctx.profile));

  // McGill Big 3 (bird dog and curl-up as short holds; side plank both sides).
  push({ id: 'mcgill-curl-up', reps: 3, slot: 'big3' });
  const sidePlank = resolve('side-plank', ctx, used);
  if (sidePlank) { used.add(sidePlank); items.push({ id: sidePlank, hold: 10, sets: 2, slot: 'big3' }); }
  push({ id: 'bird-dog', reps: 3, slot: 'big3' });

  // Nerve sliders for anyone with sciatica; otherwise the day's first drill.
  const sciatica = ctx.profile.pain.areas.includes('sciatica') || c.sciaticaActive;
  push(sciatica ? { id: 'sciatic-nerve-glide-supine', reps: 12, slot: 'nerve' } : day.first);

  for (const p of day.prime) push(p);

  // Deep holds: a flexibility target that isn't a prime mover today, else the default.
  const deepSeconds = deepHoldSeconds(ctx.week);
  const today = exposuresIn(items.map((it, i) => toStep(it, ctx, i)));
  const targets = ctx.profile.flexibilityTargets
    .filter(r => !PRIME_REGIONS[ctx.dayType].includes(r) && TARGET_DEEP[r])
    .sort((a, b) => ((ctx.coverage[a] ?? 0) + (today[a] ?? 0)) - ((ctx.coverage[b] ?? 0) + (today[b] ?? 0)));
  let deepPlaced = false;
  for (const r of targets) {
    const id = resolve(TARGET_DEEP[r]!, ctx, used);
    if (id && !c.backIrritable && !nerveUnsafe(ctx, id)) {
      used.add(id);
      items.push({ id, hold: deepSeconds, sets: 1, slot: 'deep' });
      deepPlaced = true;
      break;
    }
  }
  if (!deepPlaced) {
    for (const d of day.deep) if (!nerveUnsafe(ctx, d.id)) push({ ...d, sets: 1, hold: Math.min(d.hold ?? deepSeconds, deepSeconds + 15) });
  }

  // Coverage: the region furthest behind its weekly target, counting what the
  // rest of the week's templates will cover anyway.
  const planned = exposuresIn(items.map((it, i) => toStep(it, ctx, i)));
  const future = projectedExposures(ctx.upcoming ?? []);
  const deficits = (Object.keys(REGION_TARGETS) as MobilityRegion[])
    .map(r => ({ r, gap: REGION_TARGETS[r] - (ctx.coverage[r] ?? 0) - (planned[r] ?? 0) - (future[r] ?? 0) }))
    .filter(x => x.gap > 0 && !(planned[x.r]))
    .sort((a, b) => b.gap - a.gap);
  for (const { r } of deficits) {
    const id = REGION_ITEMS[r].map(x => resolve(x, ctx, used)).find(Boolean);
    if (id) {
      used.add(id);
      items.push({ id, hold: 20, reps: 8, slot: 'coverage' });
      break;
    }
  }

  for (const a of day.activate) push(a);
  if (!c.backIrritable || ctx.dayType.startsWith('upper')) for (const p of day.potentiate) push(p);

  return fitToBudget(items, ctx);
}

/** Build steps; trim or pad so the block (incl. welcome and transition) equals the budget. */
function fitToBudget(items: Item[], ctx: MobilityContext): Step[] {
  const TRANSITION_MIN = 20;
  const build = () => {
    const steps: Step[] = [welcome(ctx)];
    items.forEach((it, i) => steps.push(it.id === 'side-plank' ? sideHold(it, ctx, i) : toStep(it, ctx, i)));
    return steps;
  };
  let steps = build();
  const total = () => steps.reduce((s, x) => s + stepSeconds(x), 0);

  // Trim lowest-priority work first if over budget.
  const trimOrder: Item['slot'][] = ['potentiate', 'activate', 'coverage', 'prime', 'deep', 'nerve'];
  for (const slot of trimOrder) {
    while (total() + TRANSITION_MIN > ctx.budgetSeconds) {
      const idx = items.map(x => x.slot).lastIndexOf(slot);
      if (idx < 0) break;
      const it = items[idx];
      if (it.reps && it.reps > 5) { it.reps -= 2; } else if (it.hold && it.hold > 20) { it.hold -= 5; } else items.splice(idx, 1);
      steps = build();
    }
  }

  // Pad: lengthen the deep hold, then add calm breathing.
  const deep = items.find(x => x.slot === 'deep');
  while (deep && (deep.hold ?? 0) < 60 && total() + TRANSITION_MIN + 10 <= ctx.budgetSeconds - 30) {
    deep.hold = (deep.hold ?? 45) + 5;
    steps = build();
  }
  const spare = ctx.budgetSeconds - total() - TRANSITION_MIN;
  if (spare >= 40) {
    items.push({ id: 'box-breathing', reps: Math.min(6, Math.floor((spare - 10) / 10)), slot: 'activate' });
    steps = build();
  }

  const remaining = ctx.budgetSeconds - total();
  steps.push({
    kind: 'talk', id: `${ctx.idPrefix ?? 'm'}to-strength`, block: 'mobility', title: 'Mobility complete',
    topic: 'transition', seconds: Math.max(TRANSITION_MIN, remaining),
  });
  return steps;
}

/** Core / conditioning and active-recovery days (back-sciatica-mobility.md §5). */
function coreDayBlock(ctx: MobilityContext): Step[] {
  const used = new Set<string>();
  const items: Item[] = [];
  const push = (item: Item) => {
    const id = resolve(item.id, ctx, used);
    if (!id) return;
    used.add(id);
    items.push({ ...item, id });
  };
  push({ id: ctx.conditions.foot ? 'diaphragmatic-breathing-90-90' : 'march-in-place', reps: ctx.conditions.foot ? 6 : 30, slot: 'raise' });
  push({ id: 'cat-cow', reps: 7, slot: 'spine' });
  push(directionDrill(ctx.profile));
  push({ id: 'mcgill-curl-up', reps: 3, slot: 'big3' });
  const sidePlank = resolve('side-plank', ctx, used);
  if (sidePlank) { used.add(sidePlank); items.push({ id: sidePlank, hold: 10, sets: 2, slot: 'big3' }); }
  push({ id: 'bird-dog', reps: 3, slot: 'big3' });
  if (ctx.profile.pain.areas.includes('sciatica') || ctx.conditions.sciaticaActive) push({ id: 'sciatic-nerve-glide-supine', reps: 12, slot: 'nerve' });
  else { push({ id: 'chin-tuck', reps: 10, slot: 'nerve' }); push({ id: 'upper-trap-stretch', hold: 20, slot: 'nerve' }); }
  // The training-day deep slot's guards hold here too: no long holds on an
  // irritable back, and none that tension an un-cleared sciatic nerve. Checked
  // on what the item resolves to, since a swap can change it.
  for (const r of ctx.profile.flexibilityTargets.slice(0, 2)) {
    const target = TARGET_DEEP[r];
    const id = target && !ctx.conditions.backIrritable ? resolve(target, ctx, used) : null;
    if (id && !nerveUnsafe(ctx, id)) {
      used.add(id);
      items.push({ id, hold: 45, slot: 'deep' });
    }
  }
  if (!nerveUnsafe(ctx, 'supine-figure-4')) push({ id: 'supine-figure-4', hold: 30, slot: 'deep' });
  push({ id: 'dead-bug', reps: 6, slot: 'activate' });
  push({ id: 'crocodile-breathing', reps: 6, slot: 'activate' });
  return fitToBudget(items, ctx);
}
