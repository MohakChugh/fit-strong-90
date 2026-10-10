import { useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { ActivityIcon, DumbbellIcon, FootprintsIcon, SearchIcon, WindIcon } from 'lucide-react';
import { Screen } from '@/components/hig/Screen';
import { Group, Row } from '@/components/hig/List';
import { Sheet } from '@/components/hig/Sheet';
import { exercises } from '@/data/exercises';
import { getMeta } from '@/data/catalog';
import type { Exercise } from '@/types';
import { ChoiceRows, Wrap } from './controls';
import {
  AREAS, backNote, filterExercises, filterParams, KINDS, libraryState, NO_FILTERS, readFilters, sections, type Filters, type Kind,
} from './library';

function KindIcon({ id }: { id: string }) {
  const m = getMeta(id);
  const Icon = m?.kind === 'cardio' ? FootprintsIcon
    : m?.kind === 'strength' ? DumbbellIcon
      : m?.kind === 'mobility' && m.mode === 'breathing' ? WindIcon : ActivityIcon;
  return <Icon strokeWidth={1.9} />;
}

function detailOf(ex: Exercise): string {
  return [ex.primaryMuscles.slice(0, 2).join(', '), backNote(ex.id)].filter(Boolean).join(' · ');
}

/**
 * Find an exercise (codex-vision §4, Exercise Library): search, filters in a
 * sheet, and plain rows. The 3D demos play on the exercise itself, never in
 * the list. The search and filters live in the address, which each exercise
 * is handed as it opens, so its Back comes back to the same list.
 */
export function ExercisesScreen() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const from = readFilters(params);
  // Typing updates the list at once; the address follows for reload and Back.
  const [query, setQuery] = useState(from.query);
  const [filterOpen, setFilterOpen] = useState(false);
  const filters: Filters = { ...from, query };
  const { kind, area } = filters;
  const list = useMemo(() => filterExercises({ query, kind, area }), [query, kind, area]);
  const groups = sections(list);
  const areas = AREAS[kind];
  const filtered = kind !== 'all' || area !== 'all';

  const store = (f: Filters) => setParams(filterParams(f), { replace: true, preventScrollReset: true });

  // An old Library link, `?ex=<id>`, opens that exercise.
  const legacy = params.get('ex');
  if (legacy) return <Navigate to={`/move/exercises/${encodeURIComponent(legacy)}`} replace />;

  const summary = [
    kind !== 'all' && KINDS.find(k => k.value === kind)?.label,
    area !== 'all' && areas?.find(a => a.value === area)?.label,
  ].filter(Boolean).join(' · ');

  return (
    <Screen
      title="Find an exercise"
      back={{ to: '/move', label: 'Move' }}
      trailing={(
        <button type="button" onClick={() => setFilterOpen(true)} aria-haspopup="dialog"
          className="press-feedback flex min-h-11 items-center px-2 text-[length:var(--text-body)] text-tint">
          Filter
        </button>
      )}
    >
      <div className="flex flex-col gap-2">
        <label className="flex min-h-11 items-center gap-2 rounded-xl bg-grouped-card px-3 focus-within:ring-2 focus-within:ring-tint/40">
          <SearchIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="sr-only">Search exercises</span>
          <input
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder="Name, muscle or equipment"
            value={query}
            onChange={e => { setQuery(e.target.value); store({ ...filters, query: e.target.value }); }}
            className="min-w-0 flex-1 bg-transparent py-2.5 text-[length:var(--text-body)] outline-none placeholder:text-muted-foreground"
          />
        </label>
        <p aria-live="polite" className="px-4 text-[length:var(--text-footnote)] text-muted-foreground">
          {filtered ? `${summary} · ` : ''}{list.length === exercises.length ? `${list.length} exercises` : `${list.length} of ${exercises.length}`}
          {filtered && (
            <>
              {' · '}
              <button type="button" onClick={() => store({ ...NO_FILTERS, query })} className="inline-flex min-h-11 items-center text-tint">
                Clear filter
              </button>
            </>
          )}
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
          <p className="text-[length:var(--text-body)] font-semibold">No matches</p>
          <p className="text-[length:var(--text-subhead)] text-muted-foreground">Try fewer words, or clear the filter.</p>
        </div>
      ) : groups.map(g => (
        <Group key={g.kind} header={g.title}>
          {g.items.map(ex => (
            // The list as it is now, search and filters included, so the exercise's Back returns here.
            <Row key={ex.id} as={Link} to={`/move/exercises/${ex.id}`} state={libraryState(location.pathname, location.search)} viewTransition icon={<KindIcon id={ex.id} />}
              label={<Wrap>{ex.name}</Wrap>} detail={detailOf(ex) || undefined} chevron />
          ))}
        </Group>
      ))}

      <Sheet open={filterOpen} onOpenChange={setFilterOpen} title="Filter" detent="large">
        <Group header="Type">
          <ChoiceRows<Kind> label="Type" options={KINDS} value={kind} onChange={k => store({ ...filters, kind: k, area: 'all' })} />
        </Group>
        {areas && (
          <Group header={kind === 'mobility' ? 'Body area' : 'Movement'}>
            <ChoiceRows<string>
              label={kind === 'mobility' ? 'Body area' : 'Movement'}
              options={[{ value: 'all', label: 'Any' }, ...areas.map(a => ({ value: a.value, label: a.label }))]}
              value={area}
              onChange={a => store({ ...filters, area: a })}
            />
          </Group>
        )}
        <p aria-live="polite" className="px-4 text-center text-[length:var(--text-subhead)] text-muted-foreground">
          {list.length === 1 ? '1 exercise' : `${list.length} exercises`}
        </p>
      </Sheet>
    </Screen>
  );
}
