/**
 * Speech-duration estimates shared by the planner (to size prep and setup
 * time) and the narrator (watchdogs, gap fitting). Calibrated for calm
 * coaching: about 2.7 words per second at rate 1, plus a pause per sentence.
 */

const WORDS_PER_SECOND_AT_RATE_1 = 2.7;
/** Calm pacing: a real pause after every sentence. */
export const SENTENCE_GAP_MS = 600;
/**
 * The rate the planner sizes steps at, and the baseline a recorded pack's
 * `pace` is measured against (src/voice/packs.ts).
 */
export const PLANNER_RATE = 0.85;

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function sentenceCount(text: string): number {
  return Math.max(1, (text.match(/[.!?]+(\s|$)/g) ?? []).length);
}

export function estimateSpeechMs(text: string, rate = PLANNER_RATE): number {
  if (!text.trim()) return 0;
  const speak = (wordCount(text) / (WORDS_PER_SECOND_AT_RATE_1 * rate)) * 1000;
  return Math.round(speak + sentenceCount(text) * SENTENCE_GAP_MS);
}
