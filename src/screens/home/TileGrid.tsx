import { useId, useSyncExternalStore } from 'react';
import { GROUPS, categoryById, type CategoryId, type GroupId } from '@/categories';
import { scaleFromRoot } from '@/lib/textSize';
import { cn } from '@/lib/utils';
import type { HomeLayout } from '@/types';
import { tileColumns } from './model';
import { Tile } from './Tile';
import type { TileLine } from './tileLine';

/** Columns for this viewport and this text size; the text size can change on return to the app (`applyTextSize`). */
function columnsNow(): 1 | 2 {
  return tileColumns({ width: window.innerWidth, scale: scaleFromRoot(parseFloat(getComputedStyle(document.documentElement).fontSize)) });
}
function onResize(changed: () => void): () => void {
  window.addEventListener('resize', changed);
  document.addEventListener('visibilitychange', changed);
  return () => {
    window.removeEventListener('resize', changed);
    document.removeEventListener('visibilitychange', changed);
  };
}
const useColumns = () => useSyncExternalStore(onResize, columnsNow, () => 1 as const);

export interface TileState {
  line: TileLine;
  /** The gate holds or stops the tile's mode as drawn. */
  held: boolean;
}

/**
 * "What would you like to do?" (journey §7.1): the person's tiles, one group
 * per heading (Move, Eat, Check, Learn), in their own order. A group with no
 * tiles has no heading (L-14). Two columns at 375 px and wider with text at
 * 130% or less, one otherwise (K-26, A-59).
 */
export function TileGrid({ layout, tile, urgent, opensOnHold }: {
  layout: HomeLayout;
  tile: (id: CategoryId) => TileState;
  urgent: boolean;
  opensOnHold: (id: CategoryId) => boolean;
}) {
  const titleId = useId();
  const columns = useColumns();
  const groups = GROUPS.filter(g => layout.order[g.id].length > 0);
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-4">
      <h2 id={titleId} className="px-1 text-[length:var(--text-title-2)] font-bold leading-tight [overflow-wrap:break-word]">What would you like to do?</h2>
      {groups.map(g => <TileGroup key={g.id} id={g.id} title={g.title} ids={layout.order[g.id]} columns={columns} tile={tile} urgent={urgent} opensOnHold={opensOnHold} />)}
    </section>
  );
}

function TileGroup({ id, title, ids, columns, tile, urgent, opensOnHold }: {
  id: GroupId;
  title: string;
  ids: readonly CategoryId[];
  columns: 1 | 2;
  tile: (id: CategoryId) => TileState;
  urgent: boolean;
  opensOnHold: (id: CategoryId) => boolean;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} data-group={id} className="flex flex-col">
      <h3 id={headingId} className="px-4 pb-2 text-[length:var(--text-footnote)] font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      <ul className={cn('grid gap-3', columns === 2 ? 'grid-cols-2' : 'grid-cols-1')}>
        {ids.map(cid => {
          const { line, held } = tile(cid);
          return (
            <li key={cid} className="min-w-0">
              <Tile category={categoryById(cid)} line={line} held={held} urgent={urgent} opensOnHold={() => opensOnHold(cid)} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
