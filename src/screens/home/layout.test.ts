import { describe, expect, it } from 'vitest';
import {
  addButton, addTile, groupFull, hiddenTiles, hideTile, movedMessage, moveTile, moveTileTo, notOnHome, placedMessage, restoreTile, showTile,
} from './layout';
import type { HomeLayout } from '@/types';

const L: HomeLayout = { order: { move: ['workout', 'stretch', 'walk'], eat: ['food'], check: ['glucose', 'water', 'sleep'], learn: ['learn'] }, hidden: [] };

describe('Edit Home operations (journey §7.6)', () => {
  it('hides a tile and lists it as hidden', () => {
    const next = hideTile(L, 'sleep');
    expect(next.order.check).toEqual(['glucose', 'water']);
    expect(next.hidden).toEqual(['sleep']);
  });
  it('shows a hidden tile at the end of its group', () => {
    expect(showTile(hideTile(L, 'sleep'), 'sleep').order.check).toEqual(['glucose', 'water', 'sleep']);
  });
  it('moves within its group, and never past the ends', () => {
    expect(moveTile(L, 'water', -1).order.check).toEqual(['water', 'glucose', 'sleep']);
    expect(moveTile(L, 'glucose', -1).order.check).toEqual(['glucose', 'water', 'sleep']);
    expect(moveTile(L, 'sleep', 1).order.check).toEqual(['glucose', 'water', 'sleep']);
  });
  it('adds a category to its own group, once', () => {
    const next = addTile(L, 'labs');
    expect(next.order.check).toEqual(['glucose', 'water', 'sleep', 'labs']);
    expect(addTile(next, 'labs')).toEqual(next);
  });
  it('refuses a sixth tile in a group (at most 5 choices, design research 4f)', () => {
    const full = addTile(addTile(L, 'labs'), 'weight');
    expect(full.order.check).toHaveLength(5);
    expect(() => addTile(full, 'waist')).toThrow(/full/);
  });
  it('never mutates its input', () => {
    const copy = structuredClone(L);
    hideTile(L, 'sleep'); moveTile(L, 'water', -1); addTile(L, 'labs');
    expect(L).toEqual(copy);
  });
});

describe('restoreTile: Undo puts a hidden tile back where it was (B-04, M19)', () => {
  const W: HomeLayout = { order: { move: ['workout'], eat: [], check: ['glucose', 'bp', 'back', 'water', 'sleep'], learn: [] }, hidden: [] };
  it('goes back ahead of the tile that followed it, and off the hidden list', () => {
    const hidden = hideTile(W, 'back');
    expect(restoreTile(hidden, 'back', W)).toEqual(W);
  });
  it('restores two stacked Undos in either order, each keeping the other (B-04)', () => {
    const one = hideTile(W, 'bp');
    const two = hideTile(one, 'water');
    expect(restoreTile(restoreTile(two, 'bp', W), 'water', one).order.check).toEqual(W.order.check);
    expect(restoreTile(restoreTile(two, 'water', one), 'bp', W).order.check).toEqual(W.order.check);
    // Restoring one leaves the other hidden.
    expect(restoreTile(two, 'bp', W).hidden).toEqual(['water']);
  });
  it('goes back next to its neighbour when the tile after it was hidden too', () => {
    const one = hideTile(W, 'water');
    const two = hideTile(one, 'sleep');
    expect(restoreTile(two, 'water', W).order.check).toEqual(['glucose', 'bp', 'back', 'water']);
    expect(restoreTile(restoreTile(two, 'water', W), 'sleep', one).order.check).toEqual(W.order.check);
  });
  it('goes last when it was last, and is not added twice', () => {
    const hidden = hideTile(W, 'sleep');
    expect(restoreTile(hidden, 'sleep', W).order.check.at(-1)).toBe('sleep');
    expect(restoreTile(W, 'sleep', W)).toBe(W);
  });
  it('never makes a sixth tile', () => {
    const hidden = hideTile(W, 'sleep');
    const refilled = addTile(hidden, 'labs');
    expect(() => restoreTile(refilled, 'sleep', W)).toThrow(/full/);
  });
});

describe('moveTileTo: a drag drops the tile at a place in its group (M17)', () => {
  it('moves it there, the others closing up behind it', () => {
    expect(moveTileTo(L, 'workout', 2).order.move).toEqual(['stretch', 'walk', 'workout']);
    expect(moveTileTo(L, 'walk', 0).order.move).toEqual(['walk', 'workout', 'stretch']);
  });
  it('stays inside its group, whatever place it is dropped at', () => {
    expect(moveTileTo(L, 'workout', 9).order.move).toEqual(['stretch', 'walk', 'workout']);
    expect(moveTileTo(L, 'walk', -3).order.move).toEqual(['walk', 'workout', 'stretch']);
    expect(moveTileTo(L, 'walk', 9).order.check).toEqual(L.order.check);
  });
  it('returns the same layout when nothing moves, or the tile is not shown', () => {
    expect(moveTileTo(L, 'stretch', 1)).toBe(L);
    expect(moveTileTo(L, 'labs', 0)).toBe(L);
  });
});

describe('the group cap in Edit Home (at most 5 choices, journey §20.4 rule 13, B-08)', () => {
  const full: HomeLayout = { ...L, order: { ...L.order, check: ['glucose', 'water', 'sleep', 'bp', 'back'] } };
  it('knows when a group is full', () => {
    expect(groupFull(L, 'check')).toBe(false);
    expect(groupFull(full, 'check')).toBe(true);
  });
  it('says why it cannot add, with the words on the button itself', () => {
    expect(addButton(full, 'labs')).toEqual({ label: 'Check is full (5)', disabled: true });
    expect(addButton(full, 'labs', 'Show')).toEqual({ label: 'Check is full (5)', disabled: true });
    expect(addButton(L, 'labs')).toEqual({ label: 'Add', disabled: false });
    expect(addButton(L, 'labs', 'Show')).toEqual({ label: 'Show', disabled: false });
    expect(addButton(L, 'glucose')).toEqual({ label: 'Added', disabled: true });
  });
});

describe('notOnHome: what "+ Add" offers until Browse’s pick mode (Plan 4)', () => {
  it('lists every category not on Home, hidden ones too, by group in the registry’s order', () => {
    const hidden = hideTile(L, 'water');
    expect(notOnHome(hidden)).toEqual([
      { group: 'move', ids: ['steps'] },
      { group: 'check', ids: ['bp', 'back', 'weight', 'water', 'waist', 'labs'] },
    ]);
  });
  it('leaves out a group whose every category is on Home', () => {
    const all: HomeLayout = {
      order: { move: ['workout', 'stretch', 'walk', 'steps'], eat: ['food'], check: ['glucose', 'bp', 'back', 'weight', 'water'], learn: ['learn'] },
      hidden: [],
    };
    expect(notOnHome(all)).toEqual([{ group: 'check', ids: ['sleep', 'waist', 'labs'] }]);
  });
});

describe('hiddenTiles: what Edit Home lists under Hidden', () => {
  it('lists them in the registry’s order, whatever order they were hidden in', () => {
    expect(hiddenTiles(hideTile(hideTile(L, 'water'), 'glucose'))).toEqual(['glucose', 'water']);
    expect(hiddenTiles(L)).toEqual([]);
  });
});

describe('what VoiceOver hears after a change (M17)', () => {
  it('says where a moved tile is now, in its group', () => {
    const W: HomeLayout = { ...L, order: { ...L.order, check: ['glucose', 'bp', 'water', 'sleep', 'back'] } };
    expect(movedMessage(moveTile(W, 'water', -1), 'water')).toBe('Water moved to position 2 of 5');
  });
  it('says where an added or restored tile went', () => {
    expect(placedMessage(addTile(L, 'labs'), 'labs', 'added')).toBe('Labs added to Home, position 4 of 4');
    expect(placedMessage(L, 'stretch', 'back')).toBe('Stretch back on Home, position 2 of 3');
  });
});
