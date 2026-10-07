/**
 * Sentence keys shared by the build-time voice renderer and the runtime clip
 * narrator: the same text always maps to the same recorded clip.
 */

/** Split narration into sentences (keeps the punctuation). */
export function splitSentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]*/g) ?? [text]).map(s => normalizeLine(s)).filter(Boolean);
}

/** Collapse whitespace and trim; the canonical form of a spoken line. */
export function normalizeLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** cyrb53: fast 53-bit string hash (public domain). */
function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** File-safe key for one sentence (case-insensitive). */
export function clipKey(sentence: string): string {
  return cyrb53(normalizeLine(sentence).toLowerCase()).toString(36);
}
