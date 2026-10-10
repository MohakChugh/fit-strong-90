import { useId, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  ActivityIcon, BookOpenIcon, BoneIcon, DropletIcon, DumbbellIcon, FlaskConicalIcon, FootprintsIcon, GlassWaterIcon, HeartPulseIcon,
  MoonIcon, PersonStandingIcon, RulerIcon, SearchIcon, UtensilsIcon, WeightIcon, type LucideIcon,
} from 'lucide-react';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { CATEGORIES, GROUPS, type Category, type CategoryId } from '@/categories';
import { gateFor, opensOnHold } from '@/components/checkin/start';
import { skipNextTransition } from '@/design/motion';
import { useGuided } from '@/hooks/useGuided';

const ICON: Record<CategoryId, LucideIcon> = {
  workout: DumbbellIcon, stretch: PersonStandingIcon, walk: FootprintsIcon, steps: ActivityIcon,
  food: UtensilsIcon,
  glucose: DropletIcon, bp: HeartPulseIcon, back: BoneIcon, weight: WeightIcon, water: GlassWaterIcon, sleep: MoonIcon, waist: RulerIcon, labs: FlaskConicalIcon,
  learn: BookOpenIcon,
};

const named = (c: Category, query: string) => c.title.toLocaleLowerCase('en-IN').includes(query.trim().toLocaleLowerCase('en-IN'));

/**
 * Browse, for now (journey §14): every category in the registry, in its
 * group, each opening its hub, and a search by name. Plan 4 adds topics and
 * foods to the search, "Add to Home" and pick mode.
 */
export default function BrowseScreen() {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  // The field owns what is typed; the address keeps it, so Back from a hub returns to the same search.
  const [query, setQuery] = useState(() => params.get('q') ?? '');
  const input = useRef<HTMLInputElement>(null);
  const field = useId();
  const origin = { path: location.pathname, label: 'Browse', ...(location.search ? { search: location.search } : {}) };
  const guided = useGuided();

  const change = (value: string) => {
    setQuery(value);
    setParams(value ? { q: value } : {}, { replace: true, preventScrollReset: true });
  };
  const groups = GROUPS.map(g => ({ ...g, rows: CATEGORIES.filter(c => c.group === g.id && named(c, query)) })).filter(g => g.rows.length > 0);

  return (
    <Screen title="Browse">
      <form role="search" onSubmit={e => { e.preventDefault(); input.current?.blur(); }} className="flex flex-col gap-1.5">
        <label htmlFor={field} className="px-1 text-[length:var(--text-subhead)] font-medium text-muted-foreground">Find a category</label>
        <div className="flex items-center gap-1">
          <div className="relative min-w-0 flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              ref={input}
              id={field}
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Glucose, walk, food…"
              value={query}
              onChange={e => change(e.target.value)}
              className="min-h-12 w-full rounded-xl bg-grouped-card pl-10 pr-3 text-[length:var(--text-body)] text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-tint/50 [&::-webkit-search-cancel-button]:appearance-none"
            />
          </div>
          {query && (
            <button
              type="button"
              onClick={() => { change(''); input.current?.focus(); }}
              className="press-feedback min-h-12 shrink-0 px-3 text-[length:var(--text-body)] font-semibold text-tint"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {groups.map(g => (
        <Group key={g.id} header={g.title}>
          {g.rows.map(c => {
            const Icon = ICON[c.id];
            return (
              <Row
                key={c.id}
                as={Link}
                to={c.hub}
                state={origin}
                viewTransition
                // A movement screen that opens on its refusal shows it in the first frame, asked at the tap.
                onClick={c.mode ? () => { if (opensOnHold(gateFor(guided, c.mode!))) skipNextTransition(); } : undefined}
                icon={(
                  <span
                    className="flex size-7 items-center justify-center rounded-full"
                    style={{ backgroundColor: `color-mix(in oklab, var(${c.colour}) 16%, transparent)`, color: `var(${c.colour}-ink)` }}
                  >
                    <Icon aria-hidden />
                  </span>
                )}
                label={c.title}
                chevron
              />
            );
          })}
        </Group>
      ))}
      <p role="status" className="px-2 pt-4 text-center text-[length:var(--text-body)] text-muted-foreground empty:hidden">
        {groups.length === 0 ? `No category is called “${query.trim()}”. Try another word.` : ''}
      </p>
    </Screen>
  );
}
