import { projectAppData, update, useStore } from '@/store/useStore';

/**
 * The app data, and a way to change it.
 *
 * The name is now historical: this reads and writes IndexedDB through the one
 * reactive store (D13), not `localStorage`. The signature is unchanged so
 * every existing screen keeps working, but the two things that were wrong
 * before are fixed:
 *
 * - **One copy, not one per caller.** This used to hand each component its own
 *   `useState` snapshot, which is why Clear-all-data could not reach
 *   onboarding: `App`'s route gate still held the old data until a reload.
 *   Every caller now reads the same object and is told about every change.
 * - **Writes are reported.** `update` returns the store's result, so a caller
 *   that wants to say "Saved" — or to show that the device is full (D16) — can
 *   await it. Ignoring it is still safe: a failure also lands on
 *   `state.failure`, which `useStorageNotice` reads.
 *
 * `update` publishes before it stores, so a screen that writes and navigates
 * in the same tick is seen by the next screen. See `update` for why.
 */
export function useAppData() {
  const data = projectAppData(useStore());
  return [data, update] as const;
}
