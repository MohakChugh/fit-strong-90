/**
 * The workout's plan in plain words. Kept apart from the screens so the
 * wording is tested and reads the same everywhere it appears.
 */

import { nameOf } from '@/data/catalog';
import type { Group, Item, Target } from './model';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "3 sets of 8–10 reps", "2 sets of 20 s each side". */
export function targetText(t: Target): string {
  return `${plural(t.sets, 'set', 'sets')} of ${amountText(t)}`;
}

/** One set's amount: "8–10 reps", "20 s each side". */
export function amountText(t: Target): string {
  const amount = t.timed ? `${t.reps} s` : t.range ? `${t.range[0]}–${t.range[1]} reps` : plural(t.reps, 'rep', 'reps');
  return `${amount}${t.perSide ? ' each side' : ''}`;
}

/** Warm-up sets are advice: the plan's working sets are what is logged. */
export function rampText(t: Target): string | undefined {
  return t.rampSets > 0 ? `Warm up first with ${plural(t.rampSets, 'lighter set', 'lighter sets')}, not logged.` : undefined;
}

/** The planner's own reason for its choice, in the sentence its day notes use. */
export function plannerSwapText(item: Pick<Item, 'exerciseId' | 'plannerSwap'>): string | undefined {
  const s = item.plannerSwap;
  return s ? `${nameOf(item.exerciseId)} instead of ${nameOf(s.from)}: ${s.reason}.` : undefined;
}

function list(names: string[]): string {
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** How a superset or circuit is done, named from the exercise in front of you. */
export function groupText(group: Group, items: Item[], key: string): string {
  const others = group.keys.filter(k => k !== key).map(k => nameOf(items.find(i => i.key === k)?.exerciseId ?? k));
  return group.kind === 'superset'
    ? `Superset with ${list(others)}: one set of each in turn.`
    : `Circuit with ${list(others)}: one set of each, then round again.`;
}

/** Where an exercise stands: "Set 2 of 3", "All 3 sets done", "Skipped". */
export function progressText(item: Item): string {
  const next = item.sets.findIndex(s => s.status === 'pending');
  const done = item.sets.filter(s => s.status === 'completed').length;
  if (next >= 0) return `Set ${next + 1} of ${item.sets.length}`;
  if (done === 0) return 'Skipped';
  return done === item.sets.length ? `All ${plural(done, 'set', 'sets')} done` : `${done} of ${item.sets.length} sets done`;
}
