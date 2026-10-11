/**
 * Answers changed in one place, written onto the answers as they are now
 * (H5-12, H5-13; board D165). Only what a page or an edit changed from what
 * it opened with is written, so another copy's answers stay. A checklist
 * (the conditions, the medicine classes) is merged row by row.
 *
 * Where both copies changed the same answer: for Yes, No or Not sure, the
 * stricter stays ("Not sure" is never turned into "No", §6.1); for anything
 * else, this one's, the later.
 */
import type { SetupAnswers, Tri } from '@/types/setup';
import { sameValue } from '@/store/transfer';
import { has } from './facts';

type Bag = Record<string, unknown>;

const CHECKLISTS: readonly string[] = ['conditions', 'classes'];
const isTri = (v: unknown): v is Tri => v === 'yes' || v === 'no' || v === 'unsure';

/** One answer: as it is now unless changed here; changed in both, the stricter yes/no/not-sure or else this one. */
function merged(now: unknown, opened: unknown, mine: unknown): unknown {
  if (sameValue(mine, opened)) return now;
  if (sameValue(now, opened)) return mine;
  return isTri(now) && isTri(mine) && has(now) && !has(mine) ? now : mine;
}

function put(out: Bag, key: string, value: unknown): void {
  if (value === undefined) delete out[key];
  else out[key] = value;
}

/** `mine`'s changes from `opened`, onto `now`. Skipped pages are the caller's: they are kept as `now` has them. */
export function mergeAnswers(now: SetupAnswers, opened: SetupAnswers, mine: SetupAnswers): SetupAnswers {
  const [n, o, m] = [now as Bag, opened as Bag, mine as Bag];
  const out: Bag = { ...n };
  for (const key of new Set([...Object.keys(o), ...Object.keys(m)])) {
    if (key === 'skippedPages') continue;
    if (CHECKLISTS.includes(key)) {
      if (sameValue(m[key], o[key])) continue;
      const [nr, or, mr] = [(n[key] ?? {}) as Bag, (o[key] ?? {}) as Bag, (m[key] ?? {}) as Bag];
      const rows: Bag = { ...nr };
      for (const row of new Set([...Object.keys(or), ...Object.keys(mr)])) put(rows, row, merged(nr[row], or[row], mr[row]));
      out[key] = rows;
    } else {
      put(out, key, merged(n[key], o[key], m[key]));
    }
  }
  return out as SetupAnswers;
}
