import { categoryById, type CategoryId } from '@/categories';
import { ActionMenu } from '@/components/hig/ActionMenu';
import type { HomeLayout } from '@/types';
import type { MenuTarget } from './editor';

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
  return (
    <ActionMenu
      target={target}
      describe={shown => {
        const { title, group } = categoryById(shown.id);
        const list = layout.order[group];
        const at = list.indexOf(shown.id);
        return {
          title,
          actions: [
            { label: 'Hide from Home', onSelect: () => onHide(shown.id) },
            { label: 'Move up', disabled: at <= 0, onSelect: () => onMove(shown.id, -1) },
            { label: 'Move down', disabled: at < 0 || at >= list.length - 1, onSelect: () => onMove(shown.id, 1) },
            ...(editing ? [] : [{ label: 'Edit Home', onSelect: () => onEdit(shown.id) }]),
          ],
        };
      }}
      onClose={onClose}
      onClosed={onClosed}
    />
  );
}
