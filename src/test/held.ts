/**
 * A change the store refuses because a reading still holds movement (board
 * D119), made the person's own way: "It was a mistake" answers exactly the
 * measurements the refusal named, and the same change is tried again. For
 * tests whose subject is what happens after a typo is deleted or corrected,
 * not the refusal itself. Read by shape, since each copy of the app a test
 * starts has classes of its own.
 */
import type { HeldReading } from '@/store/db';

/** The refusal in a store's result (`failure`) or a check-in correction's (`held`), if it is one. */
export function heldIn(result: unknown): { held: readonly HeldReading[]; message: string } | undefined {
  const r = result as { failure?: unknown; held?: unknown } | undefined;
  const f = (r?.held ?? r?.failure) as { code?: unknown; held?: unknown; message?: unknown } | undefined;
  return f && f.code === 'held' && Array.isArray(f.held) ? { held: f.held as HeldReading[], message: String(f.message ?? '') } : undefined;
}

export async function typedWrongly<R>(change: () => Promise<R>, answer: (held: readonly HeldReading[]) => Promise<{ stored: boolean }>): Promise<R> {
  const first = await change();
  const refusal = heldIn(first);
  if (!refusal) return first;
  if (refusal.held.length === 0) throw new Error(`refused with nothing to answer: ${refusal.message}`);
  if (!(await answer(refusal.held)).stored) throw new Error('the answer “It was a mistake” wasn’t stored');
  return change();
}
