/**
 * Whether a manual workout is begun and not finished in this window (board
 * D106, Codex P8S-12): its rest timer and the exercise in front of the person
 * live only in memory, and a reload starts it again from the stored record,
 * without them. Kept apart from the workout's own code, so Home can ask
 * without loading it.
 */
let live = false;

export const workoutUnderWay = (): boolean => live;

/** Told by `useWorkout` whenever its workout changes. */
export function noteWorkout(underWay: boolean): void {
  live = underWay;
}
