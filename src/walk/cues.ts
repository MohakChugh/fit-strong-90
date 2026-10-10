/**
 * The walk's spoken cues (journey §9.2, A-72): fixed lines at fixed minutes
 * of recorded time, each one recorded sentence, so nothing is ever composed
 * from a number.
 */

export interface WalkCue {
  /** Minutes of recorded walking time. */
  minute: number;
  line: string;
}

export const WALK_CUES: readonly WalkCue[] = [
  { minute: 10, line: 'Ten minutes of walking.' },
  { minute: 20, line: 'Twenty minutes of walking.' },
  { minute: 30, line: 'Thirty minutes of walking.' },
  { minute: 45, line: 'Forty-five minutes of walking.' },
  { minute: 60, line: 'One hour of walking.' },
];

/**
 * A cue is said within 65 s of its minute. The screen redraws every second,
 * but a phone that slept, or a test clock moving a minute at a time, can step
 * past the exact moment. Later than that, the cue is dropped.
 */
export const CUE_GRACE_MS = 65_000;

const at = (c: WalkCue) => c.minute * 60_000;

/** The cue due now, if one is and it hasn't been said. */
export function cueDue(observedMs: number, said: ReadonlySet<number>): WalkCue | undefined {
  return WALK_CUES.find(c => !said.has(c.minute) && observedMs >= at(c) && observedMs < at(c) + CUE_GRACE_MS);
}

/** The cues a walk already past them has had: what a reopened live screen starts from. */
export function cuesSaidBy(observedMs: number): Set<number> {
  return new Set(WALK_CUES.filter(c => at(c) < observedMs).map(c => c.minute));
}
