/**
 * Edit Home's operations (journey §7.6, M17): pure, each returning a new
 * layout and never changing the one it is given. Tiles move within their
 * group, groups keep their order, and no group ever holds more than 5 tiles
 * (journey §20.4 rule 13, B-08): adding to a full group fails.
 */
import { CATEGORIES, GROUPS, MAX_PER_GROUP, categoryById, isHomeLayout } from '@/categories';
import type { CategoryId, GroupId, HomeLayout } from '@/types';

/**
 * A stored or imported `settings.home` this build can draw (`isHomeLayout`),
 * or nothing. The caller then falls back to the defaults, never to an empty Home.
 */
export function storedLayout(home: unknown): HomeLayout | undefined {
  return home !== undefined && isHomeLayout(home) ? home : undefined;
}

const clone = (l: HomeLayout): HomeLayout => ({ order: { move: [...l.order.move], eat: [...l.order.eat], check: [...l.order.check], learn: [...l.order.learn] }, hidden: [...l.hidden] });

export function hideTile(layout: HomeLayout, id: CategoryId): HomeLayout {
  const next = clone(layout);
  const g = categoryById(id).group;
  next.order[g] = next.order[g].filter(x => x !== id);
  if (!next.hidden.includes(id)) next.hidden.push(id);
  return next;
}

export function addTile(layout: HomeLayout, id: CategoryId): HomeLayout {
  const g = categoryById(id).group;
  if (layout.order[g].includes(id)) return layout;
  if (layout.order[g].length >= MAX_PER_GROUP) throw new Error(`The ${g} group is full`);
  const next = clone(layout);
  next.order[g].push(id);
  next.hidden = next.hidden.filter(x => x !== id);
  return next;
}

export const showTile = addTile;

export function moveTile(layout: HomeLayout, id: CategoryId, by: -1 | 1): HomeLayout {
  const g = categoryById(id).group;
  const list = layout.order[g];
  const i = list.indexOf(id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= list.length) return layout;
  const next = clone(layout);
  [next.order[g][i], next.order[g][j]] = [next.order[g][j], next.order[g][i]];
  return next;
}

/** A drag's drop (M17): the tile goes to `index` in its own group, clamped to the group's ends. */
export function moveTileTo(layout: HomeLayout, id: CategoryId, index: number): HomeLayout {
  const g = categoryById(id).group;
  const from = layout.order[g].indexOf(id);
  const to = Math.min(Math.max(0, Math.round(index)), layout.order[g].length - 1);
  if (from < 0 || from === to) return layout;
  const next = clone(layout);
  next.order[g].splice(from, 1);
  next.order[g].splice(to, 0, id);
  return next;
}

/**
 * Undo for Hide (B-04): the tile goes back where it was in `before`, the
 * layout it was hidden from, ahead of the first tile that followed it then and
 * is still shown. So two stacked Undos each put their own tile back in its
 * place, in either order, and nothing else changed since is lost.
 */
export function restoreTile(layout: HomeLayout, id: CategoryId, before: HomeLayout): HomeLayout {
  const g = categoryById(id).group;
  if (layout.order[g].includes(id)) return layout;
  if (layout.order[g].length >= MAX_PER_GROUP) throw new Error(`The ${g} group is full`);
  const was = before.order[g];
  const i = was.indexOf(id);
  const followers = new Set(i < 0 ? [] : was.slice(i + 1));
  const next = clone(layout);
  const at = next.order[g].findIndex(x => followers.has(x));
  next.order[g].splice(at < 0 ? next.order[g].length : at, 0, id);
  next.hidden = next.hidden.filter(x => x !== id);
  return next;
}

export function groupFull(layout: HomeLayout, group: GroupId): boolean {
  return layout.order[group].length >= MAX_PER_GROUP;
}

const groupTitle = (group: GroupId) => GROUPS.find(g => g.id === group)?.title ?? group;

/**
 * What an Add or Show button says, and whether it can be pressed. A full
 * group says so on the button itself, "Check is full (5)", rather than the
 * button quietly doing nothing (journey §20.4 rule 9).
 */
export function addButton(layout: HomeLayout, id: CategoryId, verb: 'Add' | 'Show' = 'Add'): { label: string; disabled: boolean } {
  const { group } = categoryById(id);
  if (layout.order[group].includes(id)) return { label: 'Added', disabled: true };
  if (groupFull(layout, group)) return { label: `${groupTitle(group)} is full (${MAX_PER_GROUP})`, disabled: true };
  return { label: verb, disabled: false };
}

/** The hidden tiles as Edit Home lists them, under Hidden with Show: in the registry's order. */
export function hiddenTiles(layout: HomeLayout): CategoryId[] {
  return CATEGORIES.filter(c => layout.hidden.includes(c.id)).map(c => c.id);
}

/** "2 of 5": a shown tile's place in its group. */
function place(layout: HomeLayout, id: CategoryId): string {
  const list = layout.order[categoryById(id).group];
  return `${list.indexOf(id) + 1} of ${list.length}`;
}

/** What VoiceOver hears after a move (M17): "Water moved to position 2 of 5". */
export function movedMessage(layout: HomeLayout, id: CategoryId): string {
  return `${categoryById(id).title} moved to position ${place(layout, id)}`;
}

/** After an Add or a Show, or an Undo that put the tile back: where it went. */
export function placedMessage(layout: HomeLayout, id: CategoryId, how: 'added' | 'back'): string {
  return `${categoryById(id).title} ${how === 'added' ? 'added to' : 'back on'} Home, position ${place(layout, id)}`;
}
