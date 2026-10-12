/**
 * The live walk's journal as the browser keeps it: IndexedDB through the
 * store, and this page's latest checkpoint per walk in memory, so the
 * summary finds its route at once, even when nothing can be stored.
 */
import { putWalkJournal, readWalkJournals } from '@/store/useStore';
import type { JournalEntry } from './journal';
import type { JournalPort } from './live';

/** Each walk's route as this page last knew it whole: its own checkpoint, or what the journal stored (H6F-08). */
const latest = new Map<string, JournalEntry>();
/** When each walk's last whole checkpoint was made, by this page's count of checkpoints. */
const wholeAt = new Map<string, number>();
let checkpoints = 0;
/** When this page last forgot every route (`forgetCachedRoutes`): a journal's answer to a checkpoint made before it brings none back. */
let forgottenAt = 0;

export function cachedJournal(id: string): JournalEntry | undefined {
  return latest.get(id);
}

/** B-05: this page forgets every kept route too, and any a journal still answering for one made before brings back. */
export function forgetCachedRoutes(): void {
  forgottenAt = ++checkpoints;
  for (const [id, entry] of latest) {
    const { route: _erased, ...rest } = entry;
    void _erased;
    latest.set(id, rest);
  }
}

export function journalPort(): JournalPort {
  return {
    checkpoint(entry, options) {
      const at = ++checkpoints;
      if (!options?.keepJournalled) {
        // The page's whole route: here at once, so the summary finds it, even when nothing can be stored.
        latest.set(entry.id, entry);
        wholeAt.set(entry.id, at);
        return putWalkJournal(entry, options);
      }
      // Made while the route is read back, it holds only part of it, so it never stands here for
      // the route: what the journal says it holds, merging both in its own transaction, does, and
      // that only if the page has not checkpointed the route whole since (H6F-08, board D211).
      const written = putWalkJournal(entry, options);
      void written.then(result => {
        if (result.ok && (wholeAt.get(entry.id) ?? 0) < at && forgottenAt < at) latest.set(entry.id, result.value);
      });
      return written;
    },
    async read(id) {
      const here = latest.get(id);
      if (here) return here;
      const kept = await readWalkJournals();
      // A journal that can't be read is not an empty one (H6-06).
      if (!kept.ok) throw kept.failure;
      return kept.value.find(e => e.id === id);
    },
  };
}
