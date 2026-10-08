/**
 * Saving a reading the safety contract may have something to say about (F01).
 *
 * The guidance comes from the values entered, so it never waits for the
 * write: it is shown as soon as the write has started, and the write then only
 * settles the save status shown beside it. A pending, slow or refused save
 * cannot hold back emergency instructions, and nothing says "Saved" or
 * "Corrected" until the store has said so.
 */

import type { Escalation } from './escalation';

export type SaveState =
  | { state: 'saving' }
  | { state: 'saved' }
  | { state: 'failed'; message: string };

/** The words for each state, so a correction says "corrected" and a new reading "saved". */
export interface SaveWords {
  saving: string;
  saved: string;
  failed: string;
}

export const SAVE_WORDS: SaveWords = { saving: 'Saving on this device…', saved: 'Saved on this device', failed: 'Not saved' };
export const CORRECT_WORDS: SaveWords = { saving: 'Saving the correction…', saved: 'Corrected on this device', failed: 'Not corrected' };

/**
 * Start the write, then — with guidance to give — show it straight away,
 * handing it the write so it can show how that ends. Without guidance the
 * caller simply waits, and keeps any error on its own form. Resolves with the
 * write's failure message, if any.
 */
export function saveWithGuidance({ escalation, write, show }: {
  escalation: Escalation | undefined;
  /** Resolves with the store's failure message, or undefined once saved. */
  write: () => Promise<string | undefined>;
  show: (pending: Promise<string | undefined>) => void;
}): Promise<string | undefined> {
  const pending = write();
  if (escalation) show(pending);
  return pending;
}

/** How a write ended, as a state. A write that throws is a failure like any other. */
export async function settle(pending: Promise<string | undefined>): Promise<SaveState> {
  try {
    const failure = await pending;
    return failure === undefined ? { state: 'saved' } : { state: 'failed', message: failure };
  } catch (error) {
    return { state: 'failed', message: error instanceof Error ? error.message : String(error) };
  }
}

export function saveLabel(state: SaveState, words: SaveWords): string {
  switch (state.state) {
    case 'saving': return words.saving;
    case 'saved': return words.saved;
    case 'failed': return `${words.failed}: ${state.message}`;
  }
}
