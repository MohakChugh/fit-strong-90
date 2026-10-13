import { createContext } from 'react';

/**
 * A full-screen task's own screen drawing the way out of the pause
 * (`UnsavedClinical`), until it lets go: the task's surface then says the
 * pause once, as it says a decision its screen draws once (`OwnsUrgent`;
 * board D224, codex V1-03). Nothing outside a task (`TaskUrgent`).
 */
export const PauseClaimContext = createContext<(() => () => void) | null>(null);
