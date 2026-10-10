import { useId, useLayoutEffect, useState, type CSSProperties } from 'react';
import { Menu } from '@base-ui/react/menu';
import { categoryById, type CategoryId } from '@/categories';
import { MOTION, springLinear } from '@/design/motion';
import type { HomeLayout } from '@/types';
import type { MenuTarget } from './editor';

/**
 * The menu grows from its corner with `spring-quick` (M18); Reduce Motion
 * makes it static (index.css). Custom properties, read by its classes: the
 * popup sets its own `transition` while it positions itself.
 */
const GROW = { '--grow-ms': `${MOTION.springQuick.cssMs}ms`, '--grow-ease': springLinear(0) } as CSSProperties;

const ITEM = 'flex min-h-12 w-full cursor-default select-none items-center px-4 py-2 text-[length:var(--text-body)] leading-snug outline-none [overflow-wrap:break-word] data-[highlighted]:bg-muted data-[disabled]:text-muted-foreground';

/**
 * A tile's menu (journey §7.2, M18): Hide from Home · Move up · Move down ·
 * Edit Home, and Close, as full-width labelled rows under the tile's name. It
 * opens from a long-press on a tile, anchored to the tile, or from More in
 * Edit Home, anchored to More, and dims the page without blurring it.
 *
 * It owns its moment as a modal (B-03): the page behind is inert, Escape and
 * Close close it, and focus goes back to what opened it, or to the screen's
 * title when that has gone. An urgent decision closes it at once
 * (`useHomeEditor` drops the target while one stands).
 */
export function TileMenu({ target, layout, editing, onHide, onMove, onEdit, onClose, onClosed }: {
  target: MenuTarget | null;
  layout: HomeLayout;
  editing: boolean;
  onHide: (id: CategoryId) => void;
  onMove: (id: CategoryId, by: -1 | 1) => void;
  onEdit: (id: CategoryId) => void;
  /** `action` when an item chose where focus goes; `dismiss` for Escape, Close and a tap outside. */
  onClose: (reason: 'action' | 'dismiss') => void;
  /** It has finished closing: an Undo it set off can be offered now (B-03). */
  onClosed: () => void;
}) {
  const titleId = useId();
  // The last tile it opened for, so its rows stay put while it closes.
  const [shown, setShown] = useState(target);
  if (target && target !== shown) setShown(target);
  const open = target !== null;
  useInertPage(open, shown?.opener);
  if (!shown) return null;

  const { title, group } = categoryById(shown.id);
  const list = layout.order[group];
  const at = list.indexOf(shown.id);
  return (
    <Menu.Root
      open={open}
      onOpenChange={(next, details) => { if (!next) onClose(details.reason === 'item-press' ? 'action' : 'dismiss'); }}
      onOpenChangeComplete={isOpen => { if (!isOpen) onClosed(); }}
    >
      <Menu.Portal>
        <Menu.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        {/* Beside the tile when there is room; with none on either side (large text, a short screen), over it, kept in view. */}
        <Menu.Positioner anchor={shown.anchor} side="bottom" align="start" sideOffset={8} collisionPadding={16} sticky className="z-50 outline-none">
          <Menu.Popup
            aria-labelledby={titleId}
            finalFocus={false}
            style={GROW}
            className="max-h-[calc(100dvh-2rem)] w-[min(20rem,calc(100vw-2rem))] origin-[var(--transform-origin)] overflow-y-auto overscroll-contain rounded-2xl bg-grouped-card py-1 text-foreground shadow-2xl outline-none transition-[transform,opacity] duration-[var(--grow-ms)] ease-[var(--grow-ease)] data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[starting-style]:scale-90 data-[starting-style]:opacity-0"
          >
            <p id={titleId} className="px-4 pb-1 pt-3 text-[length:var(--text-footnote)] font-medium uppercase tracking-wide text-muted-foreground [overflow-wrap:break-word]">{title}</p>
            <Menu.Item className={ITEM} onClick={() => onHide(shown.id)}>Hide from Home</Menu.Item>
            <Menu.Item className={ITEM} disabled={at <= 0} onClick={() => onMove(shown.id, -1)}>Move up</Menu.Item>
            <Menu.Item className={ITEM} disabled={at < 0 || at >= list.length - 1} onClick={() => onMove(shown.id, 1)}>Move down</Menu.Item>
            {!editing && <Menu.Item className={ITEM} onClick={() => onEdit(shown.id)}>Edit Home</Menu.Item>}
            <Menu.Separator className="my-1 h-px bg-separator" />
            <Menu.Item className={ITEM} onClick={() => onClose('dismiss')}>Close</Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/**
 * The page behind is out of reach while the menu is open, as behind a sheet
 * (`hig/Sheet`); the menu and toasts are outside `#app`. A layout effect, so
 * the page wakes in the commit that closes the menu, before focus goes back.
 * Closed from outside (an urgent decision arriving), focus would fall to the
 * page: it goes back to the opener then, or to the screen's title (B-03).
 */
function useInertPage(open: boolean, opener: HTMLElement | undefined) {
  useLayoutEffect(() => {
    const root = document.getElementById('app');
    if (!open || !root) return;
    const was = root.inert;
    root.inert = true;
    return () => {
      root.inert = was;
      requestAnimationFrame(() => {
        // Still inside the menu as it fades out counts as lost: it is about to go.
        const at = document.activeElement;
        const lost = at === null || at === document.body || !at.isConnected || at.closest('[role="menu"]') !== null;
        if (lost) (opener?.isConnected ? opener : document.querySelector<HTMLElement>('main h1'))?.focus({ preventScroll: true });
      });
    };
  }, [open, opener]);
}
