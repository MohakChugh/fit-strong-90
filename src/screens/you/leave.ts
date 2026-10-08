/**
 * Where "Done" on You goes.
 *
 * You is opened from the person button on any of the four tabs, so it has no
 * fixed parent. "Done" goes back to the screen it was opened from, past every
 * screen pushed inside You since — the history entry just before the first
 * You entry. React Router keeps each entry's position as `idx` in history
 * state, which is what makes that countable.
 */

/** The position React Router gave the current history entry, if it did. */
export function historyIndex(state: unknown = typeof window === 'undefined' ? undefined : window.history.state): number | undefined {
  const idx = (state as { idx?: unknown } | null | undefined)?.idx;
  return typeof idx === 'number' && Number.isInteger(idx) && idx >= 0 ? idx : undefined;
}

/**
 * How far back to go, or `undefined` when there is nowhere to go back to —
 * You was the first page loaded — and Today is the place to land.
 */
export function leaveDelta(entry: number | undefined, current: number | undefined): number | undefined {
  if (entry === undefined || current === undefined || entry === 0 || entry > current) return undefined;
  return entry - 1 - current;
}

/** The first You entry seen so far: the lowest index of any You screen visited. */
export function earliest(entry: number | undefined, current: number | undefined): number | undefined {
  if (current === undefined) return entry;
  return entry === undefined ? current : Math.min(entry, current);
}
