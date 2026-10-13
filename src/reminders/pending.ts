/**
 * Reminders that have shown and not been answered yet.
 *
 * One list for the whole app, the same shape as the main store: the banner
 * reads it, the badge counts it, and any screen that wants to offer "Done" for
 * a waiting reminder (Today's habit row, say) can read it too.
 *
 * Kept in memory only. It describes this run of the app; after a reload
 * nothing is waiting, because nothing has shown yet — which is also why the
 * host clears the icon badge when it starts.
 */

import { useSyncExternalStore } from 'react';
import { reminderKey, type Occurrence, type ReminderKind } from './schedule';

export interface Pending {
  occurrence: Occurrence;
  /** Epoch ms when it showed. */
  shownAt: number;
}

/**
 * Add newly due reminders. A habit has at most one waiting reminder: the
 * 13:00 water reminder replaces an unanswered 11:00 one rather than stacking.
 * Newest first, which is the order the banner shows them in.
 */
export function withShown(list: readonly Pending[], due: readonly Occurrence[], shownAt: number): Pending[] {
  const seen = new Set<string>();
  const fresh: Pending[] = [];
  // Latest first, keeping only the newest of each habit.
  for (const occurrence of [...due].sort((a, b) => b.day.localeCompare(a.day) || b.minute - a.minute)) {
    const key = reminderKey(occurrence);
    if (seen.has(key)) continue;
    seen.add(key);
    fresh.push({ occurrence, shownAt });
  }
  return [...fresh, ...list.filter(p => !seen.has(reminderKey(p.occurrence)))];
}

export function withoutReminder(list: readonly Pending[], id: string): Pending[] {
  return list.filter(p => p.occurrence.id !== id);
}

/** The reminders that invite movement. */
const MOVES: ReadonlySet<ReminderKind> = new Set(['sittingBreak', 'mealWalk']);

/**
 * What may be offered now. A reminder that invites movement, a walk or a
 * stand-up, is not offered while any hold on movement stands (`held`, the
 * shared verdict `movementHeld`, board D224), whether or not it raises the
 * shared surface. While a safety decision stands there (`urgent`, journey
 * §4.7), only water is: the surface says what to do instead (§7.4). What is
 * held back is not answered, so it is offered again once the hold has gone.
 */
export function offeredNow(list: readonly Pending[], { urgent, held }: { urgent: boolean; held: boolean }): readonly Pending[] {
  if (urgent) return list.filter(p => p.occurrence.habit === 'water');
  return held ? list.filter(p => !MOVES.has(p.occurrence.habit)) : list;
}

let pending: Pending[] = [];
const listeners = new Set<() => void>();

function publish(next: Pending[]): void {
  pending = next;
  for (const listener of [...listeners]) listener();
}

export function getPending(): readonly Pending[] {
  return pending;
}

export function subscribePending(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function showReminders(due: readonly Occurrence[], shownAt = Date.now()): void {
  if (due.length > 0) publish(withShown(pending, due, shownAt));
}

/** The user answered it — done, or not now. Either way it is no longer waiting. */
export function answerReminder(id: string): void {
  if (pending.some(p => p.occurrence.id === id)) publish(withoutReminder(pending, id));
}

/**
 * Drop waiting reminders that may no longer show — a fluid limit recorded, a
 * habit turned off, a day that is no longer Normal. Run whenever any of that
 * changes, so nothing already waiting outlives it.
 */
export function prunePending(keep: (item: Pending) => boolean): void {
  const kept = pending.filter(keep);
  if (kept.length !== pending.length) publish(kept);
}

export function clearReminders(): void {
  if (pending.length > 0) publish([]);
}

export function usePending(): readonly Pending[] {
  return useSyncExternalStore(subscribePending, getPending, getPending);
}
