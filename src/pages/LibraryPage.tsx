import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { exercises, getExerciseById } from '@/data/exercises';
import { getMeta, nameOf } from '@/data/catalog';
import { getCoaching } from '@/data/coaching';
import type { CatalogMeta, MobilityRegion, Pattern } from '@/types/catalog';
import { ChipGroup } from '@/components/profile/ChipGroup';
import { ExerciseFigure } from '@/components/exercise/ExerciseFigure';
import { FormDemo } from '@/components/motion/FormDemo';
import { CoachingDetails } from '@/components/session/InfoSheet';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ChevronRight, LibraryIcon, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

type Kind = 'all' | CatalogMeta['kind'];
interface Area { value: string; label: string; match: (m: CatalogMeta) => boolean }

const KINDS: { value: Kind; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'mobility', label: 'Stretch & mobility' },
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Cardio' },
];

const regions = (value: string, label: string, r: MobilityRegion[]): Area =>
  ({ value, label, match: m => m.kind === 'mobility' && m.regions.some(x => r.includes(x)) });
const patterns = (value: string, label: string, p: Pattern[]): Area =>
  ({ value, label, match: m => m.kind === 'strength' && m.patterns.some(x => p.includes(x)) });

const AREAS: Partial<Record<Kind, Area[]>> = {
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

const BACK_NOTE = {
  modify: 'Modify for your back',
  avoidWhenIrritable: 'Skip on flare-up days',
  excluded: 'Not used in plans',
} as const;

/** "30 s hold · each side, sore side first" from the catalogue dose. */
function doseLine(m: CatalogMeta | undefined): string {
  if (m?.kind !== 'mobility') return m?.kind === 'cardio' ? 'Cardio' : 'Strength';
  const d = m.dose;
  const amount = d.holdSeconds ? `${d.holdSeconds} s hold` : `${d.reps} ${m.mode === 'breathing' ? 'breaths' : 'slow reps'}`;
  const sets = d.sets > 1 ? ` × ${d.sets}` : '';
  const sides = d.sides === 'each' ? ' · each side' : d.sides === 'affectedFirst' ? ' · each side, sore side first' : '';
  return `${amount}${sets}${sides}`;
}

export default function LibraryPage() {
  const [params] = useSearchParams();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<Kind>('all');
  const [area, setArea] = useState('all');
  // ?ex=<id> opens an exercise directly (deep link from the session or Today).
  const [openId, setOpenId] = useState<string | null>(() => params.get('ex'));

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const areaDef = AREAS[kind]?.find(a => a.value === area);
    return exercises.filter(ex => {
      const m = getMeta(ex.id);
      if (!m || (kind !== 'all' && m.kind !== kind) || (areaDef && !areaDef.match(m))) return false;
      return !q || [ex.name, ex.equipment, ...ex.primaryMuscles, ...ex.secondaryMuscles].some(t => t.toLowerCase().includes(q));
    });
  }, [query, kind, area]);

  const open = openId ? getExerciseById(openId) : undefined;
  const openMeta = openId ? getMeta(openId) : undefined;
  const openCoaching = openId ? getCoaching(openId) : undefined;
  const related: [string, string | undefined][] = openMeta?.kind === 'strength'
    ? [['Easier', openMeta.regressionId], ['Harder', openMeta.progressionId]]
    : openMeta?.kind === 'mobility' ? [['On flare-up days', openMeta.irritableSwap]] : [];
  const areas = AREAS[kind];
  // Focus the sheet itself on open: the first link sits near the end and would scroll the sheet down.
  const sheetRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col gap-5 pb-4">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight sm:text-4xl">
          <LibraryIcon className="size-7 sm:size-9" />
          Library
        </h1>
        <p className="mt-1 text-muted-foreground">
          {exercises.length} stretches, exercises and cardio sessions, each with step-by-step coaching.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search name, muscle, equipment" aria-label="Search the library"
          value={query} onChange={e => setQuery(e.target.value)} className="h-11 pl-10 text-base sm:text-sm" />
      </div>

      <ChipGroup label="Type" options={KINDS} value={[kind]} onChange={([v]) => { setKind(v); setArea('all'); }} />
      {areas && (
        <ChipGroup label={kind === 'mobility' ? 'Body area' : 'Movement'} options={[{ value: 'all', label: 'All' }, ...areas]}
          value={[area]} onChange={([v]) => setArea(v)} />
      )}

      <p className="text-sm text-muted-foreground" aria-live="polite">
        Showing {list.length} of {exercises.length}
      </p>

      {list.length === 0 ? (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription>Nothing matches. Try another search or filter.</AlertDescription>
        </Alert>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {list.map(ex => {
            const status = getCoaching(ex.id)?.backSafety.status;
            return (
              <li key={ex.id}>
                <button type="button" onClick={() => setOpenId(ex.id)}
                  className="flex min-h-16 w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/50 press-feedback focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                  <ExerciseFigure exerciseId={ex.id} compact className="size-12 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-tight">{ex.name}</span>
                    <span className="block truncate text-sm text-muted-foreground first-letter:uppercase">{ex.primaryMuscles.slice(0, 3).join(' · ')}</span>
                    {status && status !== 'ok' && (
                      <span className={cn('block text-xs font-medium', status === 'modify' ? 'text-amber-700 dark:text-amber-400' : 'text-[var(--safety)]')}>
                        {BACK_NOTE[status]}
                      </span>
                    )}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet open={!!open} onOpenChange={o => { if (!o) setOpenId(null); }}>
        <SheetContent ref={sheetRef} initialFocus={sheetRef} side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-2xl pb-safe focus:outline-none">
          {open && (
            <>
              <SheetHeader className="pr-12 text-left">
                <SheetTitle className="text-xl">{open.name}</SheetTitle>
                <SheetDescription>{doseLine(openMeta)}{open.equipment ? ` · ${open.equipment}` : ''}</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-5 px-4 pb-6">
                <FormDemo exerciseId={open.id} className="h-64 [@media(max-height:640px)]:h-44" />
                {open.tips && open.tips.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-sm font-semibold">Key cues</h3>
                    <ul className="flex flex-wrap gap-2">
                      {open.tips.map(t => <li key={t} className="rounded-full bg-muted px-3 py-1.5 text-sm">{t}</li>)}
                    </ul>
                  </section>
                )}
                {related.some(([, id]) => id) && (
                  <div className="flex flex-wrap gap-2">
                    {related.map(([label, id]) => id && (
                      <button key={label} type="button" onClick={() => setOpenId(id)}
                        className="min-h-11 rounded-full border px-4 text-left text-sm hover:bg-muted press-feedback">
                        <span className="text-muted-foreground">{label}:</span> <span className="font-medium">{nameOf(id)}</span>
                      </button>
                    ))}
                  </div>
                )}
                {openCoaching ? <CoachingDetails c={openCoaching} /> : (
                  <p className="text-sm text-muted-foreground">This one is no longer used in plans. It stays here so your history keeps its name.</p>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
