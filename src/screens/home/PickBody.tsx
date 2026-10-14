/**
 * "+ Add"'s body (journey §7.6, §14, D56): Browse in pick mode. Loaded when
 * the sheet first opens: Browse brings the content library and, through the
 * meal ideas, the food table, which stay off the first screen (Plan 7).
 */
import { useMemo, useState } from 'react';
import { MAX_PER_GROUP, type CategoryId } from '@/categories';
import { contextOf } from '@/content';
import type { HomeLayout } from '@/types';
import { PickRows, SearchField } from '@/screens/browse/BrowseList';
import { browse } from '@/screens/browse/browse';

/** Pick mode lists categories only, so it needs none of the person's Guide answers. */
const NO_GUIDE = contextOf();

export function PickBody({ layout, onAdd, onDone }: { layout: HomeLayout; onAdd: (id: CategoryId) => Promise<string | undefined>; onDone: () => void }) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => browse(query, NO_GUIDE, 'pick'), [query]);
  // The page behind is inert while the sheet is open, so the sheet says what happened itself.
  const [said, setSaid] = useState('');
  return (
    <>
      <p className="px-1 text-[length:var(--text-body)] leading-snug">Choose a tile for Home. Each group holds up to {MAX_PER_GROUP}.</p>
      <SearchField value={query} onChange={setQuery} />
      <p role="status" className="sr-only">{said}</p>
      <PickRows results={results} layout={layout} onPick={id => void onAdd(id).then(words => { if (words) setSaid(words); })} />
      {results.groups.length === 0 && (
        <p className="px-1 text-[length:var(--text-body)] leading-snug text-muted-foreground">Nothing matches “{query.trim()}”. Try another word.</p>
      )}
      <button
        type="button"
        onClick={onDone}
        className="press-feedback min-h-[60px] rounded-xl bg-tint px-4 text-[length:var(--text-body)] font-semibold text-on-tint"
      >
        Done
      </button>
      {/* Room to scroll the last row clear of an Undo toast still standing from Edit Home (M19). */}
      <div aria-hidden className="h-24" />
    </>
  );
}
