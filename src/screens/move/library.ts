/**
 * Find an exercise: the catalogue, searched and filtered (codex-vision §4,
 * Exercise Library). The old Library page's filters, kept in the address so
 * a search survives a reload and Back from an exercise returns to it.
 */

import type { Exercise } from '@/types';
import type { CatalogMeta, MobilityRegion, Pattern } from '@/types/catalog';
import { exercises } from '@/data/exercises';
import { getMeta } from '@/data/catalog';
import { getCoaching } from '@/data/coaching';

export type Kind = 'all' | CatalogMeta['kind'];

export const KINDS: { value: Kind; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'mobility', label: 'Stretch & mobility' },
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Cardio' },
];

export interface Area { value: string; label: string; match: (m: CatalogMeta) => boolean }

const regions = (value: string, label: string, r: MobilityRegion[]): Area =>
  ({ value, label, match: m => m.kind === 'mobility' && m.regions.some(x => r.includes(x)) });
const patterns = (value: string, label: string, p: Pattern[]): Area =>
  ({ value, label, match: m => m.kind === 'strength' && m.patterns.some(x => p.includes(x)) });

/** Body areas for stretches, movement patterns for strength; cardio has none. */
export const AREAS: Partial<Record<Kind, Area[]>> = {
  mobility: [
    regions('neck', 'Neck', ['neck']),
    regions('shoulders', 'Shoulders & arms', ['shoulders', 'armsWrists']),
    regions('upperBack', 'Upper back', ['thoracic', 'lats']),
    regions('chest', 'Chest', ['chest']),
    regions('torso', 'Torso', ['torso']),
    regions('lowerBack', 'Lower back', ['lowerBack']),
    regions('hips', 'Hips & glutes', ['hipFlexors', 'glutes', 'adductors']),
    regions('legs', 'Legs', ['hamstrings', 'quads', 'calves']),
    { value: 'nerve', label: 'Nerve glides', match: m => m.kind === 'mobility' && m.mode === 'slider' },
  ],
  strength: [
    patterns('squat', 'Squat', ['squat']),
    patterns('hinge', 'Hinge', ['hinge', 'backExtension']),
    patterns('lunge', 'Lunge & step-up', ['lunge']),
    patterns('push', 'Push', ['hPush', 'vPush', 'chestFly']),
    patterns('pull', 'Pull', ['hPull', 'vPull', 'rearDelt']),
    patterns('core', 'Core', ['antiExtension', 'antiRotation', 'antiLateral', 'rotation']),
    patterns('carry', 'Carries', ['carry']),
    patterns('shoulders', 'Shoulders', ['sideDelt', 'rearDelt']),
    patterns('arms', 'Arms', ['biceps', 'triceps']),
    patterns('legs', 'Hamstrings & calves', ['kneeFlexion', 'calf']),
  ],
};

export interface Filters {
  query: string;
  kind: Kind;
  /** An area of `AREAS[kind]`, or 'all'. */
  area: string;
}

export const NO_FILTERS: Filters = { query: '', kind: 'all', area: 'all' };

/** The filters a URL holds; anything unknown reads as no filter. */
export function readFilters(params: URLSearchParams): Filters {
  const type = params.get('type') as Kind | null;
  const kind = KINDS.some(k => k.value === type) ? type! : 'all';
  const area = params.get('area') ?? 'all';
  return {
    query: params.get('q') ?? '',
    kind,
    area: AREAS[kind]?.some(a => a.value === area) ? area : 'all',
  };
}

/** The filters as URL parameters, leaving out the defaults. */
export function filterParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.query) p.set('q', f.query);
  if (f.kind !== 'all') p.set('type', f.kind);
  if (f.area !== 'all') p.set('area', f.area);
  return p;
}

/** Lower case, letters and digits only: "cat cow" finds "Cat-Cow". */
const fold = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * Words people type for what the catalogue names otherwise (scan S-21): a
 * person with sciatica types "sciatica", not "sciatic nerve glide".
 */
const SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  sciatica: ['sciatic', 'nerve'],
  posture: ['thoracic', 'chin', 'row', 'retraction'],
  neck: ['cervical', 'chin'],
  knee: ['quad'],
};
/** Words that say why, not what: "back pain" means the back's exercises. */
const FILLER = new Set(['pain', 'ache', 'aches', 'exercise', 'exercises', 'for', 'my', 'the', 'a', 'an', 'to']);

/** Every word of the query appears in the name, equipment or muscles, or as one of its synonyms. */
export function filterExercises(f: Filters, list: Exercise[] = exercises): Exercise[] {
  const typed = fold(f.query).split(' ').filter(Boolean);
  const meaningful = typed.filter(w => !FILLER.has(w));
  const words = meaningful.length > 0 ? meaningful : typed;
  const area = AREAS[f.kind]?.find(a => a.value === f.area);
  return list.filter(ex => {
    const m = getMeta(ex.id);
    if (!m || (f.kind !== 'all' && m.kind !== f.kind) || (area && !area.match(m))) return false;
    const text = fold([ex.name, ex.equipment, ...ex.primaryMuscles, ...ex.secondaryMuscles].join(' '));
    return words.every(w => text.includes(w) || (SYNONYMS[w] ?? []).some(s => text.includes(s)) || (w === 'yoga' && m.kind === 'mobility'));
  });
}

export interface Section { kind: CatalogMeta['kind']; title: string; items: Exercise[] }

/** Stretches first, as the people this app is for mostly look for them. */
export function sections(list: Exercise[]): Section[] {
  return (['mobility', 'strength', 'cardio'] as const)
    .map(kind => ({ kind, title: KINDS.find(k => k.value === kind)!.label, items: list.filter(ex => getMeta(ex.id)?.kind === kind) }))
    .filter(s => s.items.length > 0);
}

const BACK_NOTE = {
  modify: 'Modify for your back',
  avoidWhenIrritable: 'Skip on flare-up days',
  excluded: 'Not used in plans',
} as const;

/** How the back and sciatica research rates it, when that changes how to use it. */
export function backNote(id: string): string | null {
  const status = getCoaching(id)?.backSafety.status;
  return status && status !== 'ok' ? BACK_NOTE[status] : null;
}

/** "30 s hold · each side, sore side first" from the catalogue dose. */
export function doseLine(m: CatalogMeta | undefined): string {
  if (m?.kind !== 'mobility') return m?.kind === 'cardio' ? 'Cardio' : 'Strength';
  const d = m.dose;
  const amount = d.holdSeconds ? `${d.holdSeconds} s hold` : `${d.reps} ${m.mode === 'breathing' ? 'breaths' : 'slow reps'}`;
  const sets = d.sets > 1 ? ` × ${d.sets}` : '';
  const sides = d.sides === 'each' ? ' · each side' : d.sides === 'affectedFirst' ? ' · each side, sore side first' : '';
  return `${amount}${sets}${sides}`;
}

const LIBRARY = '/move/exercises';

/**
 * The navigation state an exercise is opened with: the list it was opened
 * from, search and filters included. A related exercise passes it on, so
 * Back still lands on that list however many exercises were followed.
 */
export function libraryState(pathname: string, search: string): { from: string } {
  return { from: `${pathname}${search}` };
}

/**
 * Where an exercise's Back goes: the list it came from, or the whole library
 * for a direct link. Only the library itself is accepted, so state left by
 * some other screen can never send Back somewhere else.
 */
export function libraryReturn(state: unknown): string {
  const from = (state as { from?: unknown } | null | undefined)?.from;
  return typeof from === 'string' && /^\/move\/exercises(\?[^#]*)?$/.test(from) ? from : LIBRARY;
}

/** Easier and harder versions, and what to do instead on a flare-up day. */
export function relatedExercises(id: string): { label: string; id: string }[] {
  const m = getMeta(id);
  const pairs: [string, string | undefined][] = m?.kind === 'strength'
    ? [['Easier', m.regressionId], ['Harder', m.progressionId]]
    : m?.kind === 'mobility' ? [['On flare-up days', m.irritableSwap]] : [];
  return pairs.flatMap(([label, other]) => (other && getMeta(other) ? [{ label, id: other }] : []));
}
