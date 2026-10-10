/**
 * Edit Home (journey §7.6, M17): each tile with labelled Move up, Move down,
 * Hide and More, and a drag handle; "+ Add"; the tiles the person hid, each
 * with Show; and Done. One column, so "up" and "down" mean what they say.
 * Every change is stored as it is made (`useHomeEditor`), so Done only ends
 * the mode. Dragging is the gesture for what Move up and Move down do
 * (journey §20.4 rule 3), so the handle is a picture of an affordance, hidden
 * from assistive technology like a sheet's grabber.
 */
import { useId, useMemo, useRef, useState, type PointerEvent } from 'react';
import { GripVerticalIcon, PlusIcon } from 'lucide-react';
import { GROUPS, MAX_PER_GROUP, categoryById, type CategoryId, type GroupId } from '@/categories';
import { MOTION, springLinear } from '@/design/motion';
import { Sheet } from '@/components/hig/Sheet';
import { contextOf } from '@/content';
import { cn } from '@/lib/utils';
import type { HomeLayout } from '@/types';
import { PickRows, SearchField } from '@/screens/browse/BrowseList';
import { browse } from '@/screens/browse/browse';
import type { HomeEditor } from './editor';
import { addButton, groupFull, hiddenTiles } from './layout';
import { EditButton } from './EditButton';
import { TileIcon } from './Tile';

/** The others make room for a dragged tile with `spring-quick` (M17); the dragged one follows the finger 1:1. */
const MAKE_ROOM = `transform ${MOTION.springQuick.cssMs}ms ${springLinear(0)}`;

export function EditTiles({ layout, editor }: { layout: HomeLayout; editor: HomeEditor }) {
  const titleId = useId();
  const groups = GROUPS.filter(g => layout.order[g.id].length > 0);
  const hidden = hiddenTiles(layout);
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 px-1">
        {/* Done beside the heading, and again at the end: the screen's bar has no room for it at large text. */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <h2 id={titleId} tabIndex={-1} data-edit-heading className="scroll-mt-20 text-[length:var(--text-title-2)] font-bold leading-tight outline-none [overflow-wrap:break-word]">
            Edit Home
          </h2>
          <button
            type="button"
            onClick={editor.done}
            className="press-feedback flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-full bg-tint/10 px-4 text-[length:var(--text-body)] font-semibold text-tint"
          >
            Done
          </button>
        </div>
        <p className="text-[length:var(--text-subhead)] leading-snug text-muted-foreground">
          Hide, move or add tiles. Each change is kept as you make it.
        </p>
      </div>
      {groups.map(g => <EditGroup key={g.id} id={g.id} title={g.title} ids={layout.order[g.id]} editor={editor} />)}
      <button
        type="button"
        data-flip="add"
        data-control="add"
        onClick={() => editor.setPicking(true)}
        className="press-feedback flex min-h-[60px] items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-tint/60 px-4 text-[length:var(--text-body)] font-semibold text-tint animate-[fs-fade-in_200ms_ease-out_both]"
      >
        <PlusIcon aria-hidden className="size-5 shrink-0" />
        Add<span className="sr-only"> a tile to Home</span>
      </button>
      {hidden.length > 0 && <HiddenTiles layout={layout} ids={hidden} onShow={editor.show} />}
      {/* Room under Done for each Undo toast standing, so they never cover it (M19). */}
      <button
        type="button"
        data-flip="done"
        onClick={editor.done}
        style={{ marginBottom: `${editor.undoCount * 6}rem` }}
        className="press-feedback min-h-[60px] rounded-xl bg-tint px-4 text-[length:var(--text-body)] font-semibold text-on-tint"
      >
        Done
      </button>
      <PickSheet open={editor.picking} onOpenChange={editor.setPicking} layout={layout} onAdd={editor.add} />
    </section>
  );
}

interface Drag {
  id: CategoryId;
  pointer: number;
  from: number;
  to: number;
  /** Where the press began and how far it has travelled, in page coordinates, so a scroll is counted. */
  startY: number;
  dy: number;
  /** Each tile's middle when the drag began. */
  mids: number[];
  /** How far a tile steps aside to make room: the dragged tile's height and the gap. */
  shift: number;
}

/** One group in edit mode, with a live reorder by drag: the others step aside, the tile drops into its place. */
function EditGroup({ id, title, ids, editor }: { id: GroupId; title: string; ids: readonly CategoryId[]; editor: HomeEditor }) {
  const headingId = useId();
  const list = useRef<HTMLUListElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  const grab = (tile: CategoryId, e: PointerEvent<HTMLElement>) => {
    if (!e.isPrimary || e.button !== 0) return;
    const items = [...(list.current?.children ?? [])];
    const from = ids.indexOf(tile);
    if (from < 0 || items.length !== ids.length) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not capturable: moves still arrive while over the handle */ }
    const rects = items.map(el => el.getBoundingClientRect());
    const gap = rects.length > 1 ? rects[1].top - rects[0].bottom : 0;
    setDrag({
      id: tile, pointer: e.pointerId, from, to: from, startY: e.clientY + window.scrollY, dy: 0,
      mids: rects.map(r => r.top + window.scrollY + r.height / 2), shift: rects[from].height + gap,
    });
  };
  const follow = (e: PointerEvent<HTMLElement>) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    const dy = e.clientY + window.scrollY - drag.startY;
    const mid = drag.mids[drag.from] + dy;
    setDrag({ ...drag, dy, to: drag.mids.filter((m, k) => k !== drag.from && m < mid).length });
  };
  const release = (e: PointerEvent<HTMLElement>, keep: boolean) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    if (keep && drag.to !== drag.from) editor.drop(drag.id, drag.to);
    setDrag(null);
  };
  const offset = (k: number): number => {
    if (!drag) return 0;
    if (k === drag.from) return drag.dy;
    if (drag.from < drag.to && k > drag.from && k <= drag.to) return -drag.shift;
    if (drag.to < drag.from && k >= drag.to && k < drag.from) return drag.shift;
    return 0;
  };

  return (
    <section aria-labelledby={headingId} data-group={id} className="flex flex-col">
      <h3 id={headingId} data-flip={`group-${id}`} className="px-4 pb-2 text-[length:var(--text-footnote)] font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      <ul ref={list} className="flex flex-col gap-3">
        {ids.map((cid, k) => {
          const lifted = drag?.id === cid;
          const dy = offset(k);
          return (
            <li
              key={cid}
              data-flip={cid}
              data-tile={cid}
              className={cn('relative', lifted && 'z-10')}
              // Only while dragging: the drop's own render has no transition, so the tiles stay where they are drawn.
              style={drag ? { transform: dy ? `translateY(${dy}px)` : undefined, transition: lifted ? 'none' : MAKE_ROOM } : undefined}
            >
              <EditTile
                id={cid}
                first={k === 0}
                last={k === ids.length - 1}
                lifted={lifted}
                editor={editor}
                handle={{
                  onPointerDown: e => grab(cid, e),
                  onPointerMove: follow,
                  onPointerUp: e => release(e, true),
                  onPointerCancel: e => release(e, false),
                  onLostPointerCapture: e => release(e, false),
                }}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

type HandleEvents = Record<'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel' | 'onLostPointerCapture', (e: PointerEvent<HTMLElement>) => void>;

function EditTile({ id, first, last, lifted, editor, handle }: {
  id: CategoryId;
  first: boolean;
  last: boolean;
  lifted: boolean;
  editor: HomeEditor;
  handle: HandleEvents;
}) {
  const category = categoryById(id);
  return (
    <div
      className={cn(
        '@container flex flex-col gap-3 rounded-2xl bg-grouped-card p-3 animate-[fs-fade-in_200ms_ease-out_both]',
        lifted && 'scale-[1.03] shadow-xl',
      )}
    >
      {/* Narrower than 13 rem (large text on a phone), the title takes its own line and keeps whole words, as a Row does. */}
      <div className="flex items-center gap-3 @max-[13rem]:flex-wrap">
        <TileIcon category={category} />
        <span className="min-w-0 flex-1 text-[length:var(--text-body)] font-semibold leading-snug [overflow-wrap:break-word] @max-[13rem]:order-last @max-[13rem]:basis-full">{category.title}</span>
        <span
          aria-hidden
          data-handle
          className="ml-auto flex size-12 shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-xl text-muted-foreground active:cursor-grabbing"
          {...handle}
        >
          <GripVerticalIcon className="size-6" />
        </span>
      </div>
      <div className="flex flex-wrap gap-3">
        <EditButton control="up" disabled={first} label="Move up" name={category.title} onClick={() => editor.move(id, -1, 'up')} />
        <EditButton control="down" disabled={last} label="Move down" name={category.title} onClick={() => editor.move(id, 1, 'down')} />
        <EditButton control="hide" label="Hide" name={category.title} onClick={() => editor.hide(id, 'edit')} />
        {/* The long-press menu's visible way in (journey §20.4 rule 3). */}
        <EditButton control="more" label="More" name={category.title} onClick={button => editor.openMenu(id, button)} />
      </div>
    </div>
  );
}

/** "Hidden": the tiles the person hid, or that didn't fit by default, each with Show (journey §7.6). */
function HiddenTiles({ layout, ids, onShow }: { layout: HomeLayout; ids: readonly CategoryId[]; onShow: (id: CategoryId) => void }) {
  const headingId = useId();
  const full = GROUPS.filter(g => groupFull(layout, g.id) && ids.some(id => categoryById(id).group === g.id));
  return (
    <section aria-labelledby={headingId} data-flip="hidden" className="flex flex-col">
      <h3 id={headingId} className="px-4 pb-2 text-[length:var(--text-footnote)] font-medium uppercase tracking-wide text-muted-foreground">Hidden</h3>
      <ul className="overflow-hidden rounded-2xl bg-grouped-card [&>*+*]:border-t [&>*+*]:border-separator">
        {ids.map(id => {
          const category = categoryById(id);
          const button = addButton(layout, id, 'Show');
          return (
            <li key={id} data-hidden-tile={id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <TileIcon category={category} />
              <span className="min-w-0 flex-1 text-[length:var(--text-body)] font-semibold leading-snug [overflow-wrap:break-word]">{category.title}</span>
              <EditButton control="show" disabled={button.disabled} label={button.label} name={category.title} onClick={() => onShow(id)} />
            </li>
          );
        })}
      </ul>
      {full.length > 0 && <FullNote groups={full.map(g => g.title)} />}
    </section>
  );
}

function FullNote({ groups }: { groups: readonly string[] }) {
  return (
    <p className="px-4 pt-2 text-[length:var(--text-footnote)] leading-snug text-muted-foreground">
      A group holds up to {MAX_PER_GROUP} tiles. Hide one in {groups.join(' or ')} to make room.
    </p>
  );
}

/** Pick mode lists categories only, so it needs none of the person's Guide answers. */
const NO_GUIDE = contextOf();

/**
 * "+ Add" (journey §7.6, §14, D56): Browse in pick mode, over Edit Home.
 * Every category, grouped, each with Add or Added; search at the top; Done.
 * A tile added here fades in at its place in its group (M17).
 */
export function PickSheet({ open, onOpenChange, layout, onAdd }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layout: HomeLayout;
  /** `editor.add`: resolves to what to announce once stored, or that it didn't save; to nothing when it couldn't add. */
  onAdd: (id: CategoryId) => Promise<string | undefined>;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add to Home"
      detent="large"
      // Opened from its address (`#/browse?pick=1`), nothing opened it: focus goes to "+ Add", pick mode's own way in (B-03).
      returnFocus={() => document.querySelector<HTMLElement>('[data-control="add"]')}
    >
      {open && <PickBody layout={layout} onAdd={onAdd} onDone={() => onOpenChange(false)} />}
    </Sheet>
  );
}

function PickBody({ layout, onAdd, onDone }: { layout: HomeLayout; onAdd: (id: CategoryId) => Promise<string | undefined>; onDone: () => void }) {
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
