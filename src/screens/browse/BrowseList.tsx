import { useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import { SearchIcon } from 'lucide-react';
import { categoryById, type CategoryId } from '@/categories';
import { Group, Row } from '@/components/hig/List';
import { skipNextTransition } from '@/design/motion';
import { partialDetail } from '@/screens/guide/format';
import { tileHref } from '@/screens/home/model';
import { TileIcon } from '@/screens/home/Tile';
import type { BrowseResults } from './browse';

/** Where a row was opened from, so the screen it opens says "Back to Browse" (journey §8.1). */
export interface Origin {
  path: string;
  label: string;
  search?: string;
}

/**
 * The search field at the top of Browse (journey §14) and of its pick mode.
 * Labelled, 48 px, with a labelled Clear. Submitting closes the keyboard and
 * nothing else.
 */
export function SearchField({ value, onChange, label = 'Search' }: { value: string; onChange: (value: string) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const field = useId();
  return (
    <form role="search" onSubmit={e => { e.preventDefault(); input.current?.blur(); }} className="flex flex-col gap-1.5">
      <label htmlFor={field} className="px-1 text-[length:var(--text-subhead)] font-medium text-muted-foreground">{label}</label>
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
            placeholder="Glucose, roti, sciatica…"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="min-h-12 w-full rounded-xl bg-grouped-card pl-10 pr-3 text-[length:var(--text-body)] text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-tint/50 [&::-webkit-search-cancel-button]:appearance-none"
          />
        </div>
        {value && (
          <button
            type="button"
            onClick={() => { onChange(''); input.current?.focus(); }}
            className="press-feedback min-h-12 shrink-0 px-3 text-[length:var(--text-body)] font-semibold text-tint"
          >
            Clear
          </button>
        )}
      </div>
    </form>
  );
}

/**
 * Browse's groups (journey §14):
 * - a category row opens its hub, and has a labelled More beside it;
 * - a shortcut row opens its target;
 * - a Guide topic, answer or meal opens its page.
 * A partial result says what it matches and what it doesn't.
 */
export function BrowseRows({ results, origin, held, onMore }: {
  results: BrowseResults;
  origin: Origin;
  /** Asked at the tap: this category's screen opens on its refusal now (`opensOnHold`), so nothing animates into it (motion rule 2). */
  held: (id: CategoryId) => boolean;
  onMore: (id: CategoryId, button: HTMLElement) => void;
}) {
  return (
    <>
      {results.groups.map(g => (
        <Group key={g.id} header={g.title}>
          {g.rows.map(r => {
            if (r.kind === 'category') return <CategoryRow key={`category-${r.id}`} id={r.id} origin={origin} held={held} onMore={onMore} />;
            if (r.kind === 'shortcut') return <Row key={`shortcut-${r.id}`} as={Link} to={r.to} state={origin} viewTransition label={r.title} chevron />;
            return (
              <Row
                key={`${r.kind}-${r.id}`}
                as={Link}
                to={r.to}
                state={origin}
                viewTransition
                label={r.title}
                detail={results.partial ? partialDetail(r.result) : r.detail}
                chevron
              />
            );
          })}
        </Group>
      ))}
    </>
  );
}

/**
 * Narrower than 16 rem (its group is the container, as for `Row`): a 320-point
 * screen at about 150% text. It stacks, as `Row` does: the icon above the
 * title, and More under them, so the title keeps whole words.
 */
function CategoryRow({ id, origin, held, onMore }: { id: CategoryId; origin: Origin; held: (id: CategoryId) => boolean; onMore: (id: CategoryId, button: HTMLElement) => void }) {
  const category = categoryById(id);
  return (
    <div className="flex items-center gap-2 pr-3 @max-[16rem]:flex-wrap @max-[16rem]:gap-y-1 @max-[16rem]:px-2 @max-[16rem]:pb-2">
      <Link
        to={tileHref(category)}
        state={origin}
        viewTransition
        onClick={() => { if (held(id)) skipNextTransition(); }}
        className="press-feedback flex min-h-[3.25rem] min-w-0 flex-1 items-center gap-3 py-2 pl-4 text-left transition-colors active:bg-muted/60 @max-[16rem]:basis-full @max-[16rem]:flex-wrap @max-[16rem]:gap-y-1 @max-[16rem]:pl-0"
      >
        <TileIcon category={category} />
        <span className="min-w-0 flex-1 text-[length:var(--text-body)] leading-snug [overflow-wrap:break-word] @max-[16rem]:basis-full">{category.title}</span>
      </Link>
      {/* The menu's visible way in (journey §20.4 rule 3). */}
      <button
        type="button"
        aria-label={`More, ${category.title}`}
        onClick={e => onMore(id, e.currentTarget)}
        className="press-feedback flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-full bg-tint/10 px-3 text-[length:var(--text-subhead)] font-semibold text-tint"
      >
        More
      </button>
    </div>
  );
}
