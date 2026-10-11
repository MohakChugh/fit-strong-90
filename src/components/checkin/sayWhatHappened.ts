import { createContext, useContext } from 'react';

/**
 * Opens the shared stop questions, "Say what happened" (journey §4.4,
 * K6R-03): provided above the routes (`SayWhatHappenedProvider`), so the
 * safety surface, every movement hub and the check-in reach the same ones.
 * Nothing outside the provider.
 */
export const SayWhatHappenedContext = createContext<(() => void) | null>(null);

export function useSayWhatHappened(): (() => void) | null {
  return useContext(SayWhatHappenedContext);
}
