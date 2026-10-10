/**
 * Walks Home offers to save after the app was closed or crashed mid-walk
 * (journey §9.4, V-J34, A-57). They come from the journal, never from a draft
 * this tab still holds or a walk another tab may still be recording, and
 * never twice: a journal whose walk is saved is only tidied away.
 */
import { differenceInCalendarDays, format } from 'date-fns';
import type { Observation } from '@/health/observation';
import { finishWalk, openSegment, type Walk } from './clock';
import { JOURNAL_STALE_MS, type JournalEntry } from './journal';
import { hasRecord, summarise, walkObservationIds } from './record';

/** Finished where the last checkpoint left it (B-19): an interrupted segment ends at its last checkpoint. */
export function interruptedWalk(walk: Walk): Walk {
  if (walk.status === 'finished') return walk;
  const open = openSegment(walk);
  return finishWalk(walk, open ? open.accruedAt : walk.seenAt, 'interrupted');
}

export interface Recoverable {
  entry: JournalEntry;
  walk: Walk;
  /** Recorded minutes, at least 1. */
  minutes: number;
}

export interface RecoveryInput {
  entries: readonly JournalEntry[];
  now: number;
  observations: readonly Observation[];
  /** The walk this tab's draft holds. */
  draftId?: string;
}

export function recoveryPlan(input: RecoveryInput): { offer: Recoverable[]; retire: string[]; wakeAt?: number } {
  const offer: Recoverable[] = [];
  const retire: string[] = [];
  let wakeAt: number | undefined;
  for (const entry of input.entries) {
    if (entry.id === input.draftId) continue;
    if (walkObservationIds(entry.id, input.observations).length > 0) {
      retire.push(entry.id);
      continue;
    }
    if (input.now - entry.at < JOURNAL_STALE_MS) {
      wakeAt = Math.min(wakeAt ?? Infinity, entry.at + JOURNAL_STALE_MS);
      continue;
    }
    const walk = interruptedWalk(entry.walk);
    if (!hasRecord(walk)) {
      retire.push(entry.id);
      continue;
    }
    offer.push({ entry, walk, minutes: Math.max(1, Math.round(summarise(walk).observedMs / 60_000)) });
  }
  offer.sort((a, b) => a.walk.startedAt - b.walk.startedAt);
  return { offer, retire, ...(wakeAt !== undefined ? { wakeAt } : {}) };
}

/** "Your walk on Tuesday was interrupted at 18 min. Save it?" (journey §9.4). */
export function recoveryText(r: Recoverable, now: number): string {
  const start = new Date(r.walk.segments[0].start);
  const days = differenceInCalendarDays(new Date(now), start);
  const when = days <= 0 ? 'today' : days === 1 ? 'yesterday' : days < 7 ? `on ${format(start, 'EEEE')}` : `on ${format(start, 'd MMM')}`;
  return `Your walk ${when} was interrupted at ${r.minutes} min. Save it?`;
}
