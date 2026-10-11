/**
 * Answers changed in one place, written onto the answers as they are now
 * (H5-12, H5-13; boards D165, D190). Only what a page or an edit changed from
 * what it opened with is written, so another copy's answers stay. A checklist
 * (the conditions, the medicine classes) is merged row by row.
 *
 * Where both copies changed the same answer, a preference takes this one, the
 * later. A safety answer keeps whichever the engine finds stricter, each
 * evaluated as the profile it gives (`engine/candidates.ts`), so "Not sure"
 * is never turned into "No" (§6.1) and no answer is decided by the order of
 * the saves (K5R-09). Where neither is stricter, the stored answer stays and
 * the answer is named, so the caller can say so.
 */
import type { PageId, SetupAnswers } from '@/types/setup';
import type { UserProfile } from '@/types/profile';
import { stricterOf } from '@/engine/candidates';
import { profileOnlyReadiness } from '@/engine/readiness';
import { dayOf, nowAt } from '@/health/observation';
import { createDefaultProfile } from '@/profile/defaults';
import { sameValue } from '@/store/transfer';
import { profileFrom } from './assemble';
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

/** `a` with `field` set to `value`, or taken away when `value` is `undefined`. */
export function putField(a: SetupAnswers, field: string, value: unknown): SetupAnswers {
  const [key, row] = field.split('.');
  const out = { ...a } as Bag;
  if (row === undefined) {
    if (value === undefined) delete out[key];
    else out[key] = value;
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

const profileOf = (a: SetupAnswers): UserProfile => profileFrom(a, BASE, dayOf(nowAt()), { thisYear: new Date().getFullYear() });
const BASE = createDefaultProfile({ needsHealthReview: false });

/**
 * The answer a safety field takes when both copies changed it: `stored` or
 * `mine`, whichever gives the stricter profile with the rest of `answers`;
 * the later where the engine reads them alike; `undefined` where neither is
 * stricter.
 */
export function stricterAnswer(answers: SetupAnswers, field: string, stored: unknown, mine: unknown): { value: unknown } | undefined {
  const which = stricterOf(profileOf(putField(answers, field, stored)), profileOf(putField(answers, field, mine)), p => profileOnlyReadiness(p));
  return which === undefined ? undefined : { value: which === 'a' ? stored : mine };
}

export interface Merged {
  answers: SetupAnswers;
  /** Safety answers both copies changed where neither is stricter: the stored one stays. */
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
    const chosen = stricterAnswer(out, field, getField(now, field), getField(mine, field));
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
