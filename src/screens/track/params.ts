/**
 * My Day's address: `?day=` (absent for today), `?view=trends` (absent for the
 * timeline) and `?add=` (an open Quick Log). One function applies a change,
 * so the URL stays canonical — today is always plain `/track`.
 */

export type View = 'timeline' | 'trends';

export interface ParamChange {
  /** A day to show; `null`, or today, means today. */
  day?: string | null;
  view?: View | null;
  /** `null` closes Quick Log. */
  add?: null;
}

/** Fold one change into another; later fields win. */
export function mergeChanges(a: ParamChange | undefined, b: ParamChange): ParamChange {
  return { ...a, ...b };
}

export function applyChange(prev: URLSearchParams, change: ParamChange, current: string): URLSearchParams {
  const p = new URLSearchParams(prev);
  if (change.day !== undefined) {
    if (change.day === null || change.day === current) p.delete('day');
    else p.set('day', change.day);
  }
  if (change.view !== undefined) {
    if (change.view === null || change.view === 'timeline') p.delete('view');
    else p.set('view', change.view);
  }
  if (change.add === null) p.delete('add');
  return p;
}
