/**
 * The live walk's journal as the browser keeps it: IndexedDB through the
 * store, and this page's latest checkpoint per walk in memory, so the
 * summary finds its route at once, even when nothing can be stored.
 */
import { putWalkJournal, readWalkJournals } from '@/store/useStore';
import type { JournalEntry } from './journal';
import type { JournalPort } from './live';

const latest = new Map<string, JournalEntry>();

export function cachedJournal(id: string): JournalEntry | undefined {
  return latest.get(id);
}

/** B-05: this page forgets every kept route too. */
export function forgetCachedRoutes(): void {
  for (const [id, entry] of latest) {
    const { route: _erased, ...rest } = entry;
    void _erased;
    latest.set(id, rest);
  }
}

export function journalPort(): JournalPort {
  return {
    checkpoint(entry) {
      latest.set(entry.id, entry);
      return putWalkJournal(entry);
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
