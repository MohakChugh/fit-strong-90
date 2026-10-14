/**
 * Answers changed in one place, written onto the answers as they are now
 * (H5-12, H5-13; boards D165, D190, D196). Only what a page or an edit
 * changed from what it opened with is written, so another copy's answers
 * stay. A checklist (the conditions, the medicine classes) is merged row by
 * row.
 *
 * Where both copies changed the same answer, a preference takes this one, the
 * later. A safety answer of Yes, No or Not sure takes the earlier in Yes, Not
 * sure, No, so a disclosure or a doubt is never erased by another copy's
 * answer (§6.1; H5F-03). Any other safety answer both changed is never chosen
 * between: the stored one stays, and the answer is named, so the person
 * checks it.
 */
import type { PageId, SetupAnswers } from '@/types/setup';
import { sameValue } from '@/store/transfer';
import { keysOfChapter } from './fields';
import { SAFETY_CHAPTERS } from './graph';

type Bag = Record<string, unknown>;

const CHECKLISTS: readonly string[] = ['conditions', 'classes'];
/** The answers the engine reads: the safety chapters', and whether the person exercises now (H5-11). */
const SAFETY = new Set<string>([...SAFETY_CHAPTERS.flatMap(c => keysOfChapter(c) as string[]), 'active']);

/** A field's name: an answer, or a checklist's row as `conditions.feet`. */
export const fieldRoot = (field: string): string => field.split('.')[0];
export const isSafetyField = (field: string): boolean => SAFETY.has(fieldRoot(field));

export function getField(a: SetupAnswers, field: string): unknown {
  const [key, row] = field.split('.');
  const value = (a as Bag)[key];
  return row === undefined ? value : ((value ?? {}) as Bag)[row];
}

/**
 * `a` with `field` set to `value`. An answer cleared stays named, so the
 * profile clears it too (`profileFrom` reads `'weightKg' in a`); a
 * checklist's row cleared is taken away, unanswered.
 */
export function putField(a: SetupAnswers, field: string, value: unknown): SetupAnswers {
  const [key, row] = field.split('.');
  const out = { ...a } as Bag;
  if (row === undefined) {
    out[key] = value;
    return out as SetupAnswers;
  }
  const rows = { ...((out[key] ?? {}) as Bag) };
  if (value === undefined) delete rows[row];
  else rows[row] = value;
  out[key] = rows;
  return out as SetupAnswers;
}

/** Every field `a` and `b` hold between them: each checklist's rows, every other answer whole. */
function fieldsOf(...all: SetupAnswers[]): string[] {
  const out = new Set<string>();
  for (const a of all) {
    for (const [key, value] of Object.entries(a as Bag)) {
      if (key === 'skippedPages') continue;
      if (CHECKLISTS.includes(key) && value && typeof value === 'object') for (const row of Object.keys(value)) out.add(`${key}.${row}`);
      else out.add(key);
    }
  }
  return [...out];
}

/** A Yes, No or Not sure answer, most disclosing first (board D196). */
const TRI_ORDER: readonly unknown[] = ['yes', 'unsure', 'no'];

/**
 * The answer a safety field takes when both copies changed it (board D196):
 * of two Yes, No or Not sure answers, the earlier in Yes, Not sure, No;
 * of any other answers, neither, `undefined`, so the stored one stays.
 */
export function stricterAnswer(stored: unknown, mine: unknown): { value: unknown } | undefined {
  const [a, b] = [TRI_ORDER.indexOf(stored), TRI_ORDER.indexOf(mine)];
  return a >= 0 && b >= 0 ? { value: a <= b ? stored : mine } : undefined;
}

export interface Merged {
  answers: SetupAnswers;
  /** Safety answers both copies changed, not Yes, No or Not sure: the stored one stays. */
  conflicts: string[];
}

/** `mine`'s changes from `opened`, onto `now`. Skipped pages are the caller's: they are kept as `now` has them. */
export function mergeAnswersWithConflicts(now: SetupAnswers, opened: SetupAnswers, mine: SetupAnswers): Merged {
  let out = now;
  const both: string[] = [];
  for (const field of fieldsOf(opened, mine)) {
    const [o, m, n] = [getField(opened, field), getField(mine, field), getField(now, field)];
    if (sameValue(m, o)) continue;
    if (!sameValue(n, o) && !sameValue(n, m) && isSafetyField(field)) both.push(field);
    else out = putField(out, field, m);
  }
  const conflicts: string[] = [];
  for (const field of both) {
    const chosen = stricterAnswer(getField(now, field), getField(mine, field));
    if (chosen) out = putField(out, field, chosen.value);
    else conflicts.push(field);
  }
  return { answers: out, conflicts };
}

export function mergeAnswers(now: SetupAnswers, opened: SetupAnswers, mine: SetupAnswers): SetupAnswers {
  return mergeAnswersWithConflicts(now, opened, mine).answers;
}

/** A page's own skip marks, as changed from what it opened with, onto the marks as they are now. */
export function mergeSkipped(now: readonly PageId[] | undefined, opened: readonly PageId[] | undefined, mine: readonly PageId[] | undefined): PageId[] {
  const [was, is] = [new Set(opened ?? []), new Set(mine ?? [])];
  const out = new Set(now ?? []);
  for (const page of is) if (!was.has(page)) out.add(page);
  for (const page of was) if (!is.has(page)) out.delete(page);
  return [...out];
}
