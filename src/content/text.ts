/**
 * Word handling shared by search and the "leave out" filter, so the two agree
 * on what counts as the same word.
 */

/** Words that carry no meaning in a question ("how much water should I drink"). */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'of', 'and', 'or', 'for', 'to', 'in', 'on', 'with', 'my', 'i', 'me', 'is', 'it', 'its',
  'do', 'does', 'how', 'what', 'can', 'should', 'much', 'many', 'am', 'are', 'be', 'about', 'at', 'from',
  'by', 'when', 'which', 'who', 'will', 'would', 'could', 'your', 'you', 'any', 'some', 'there',
]);

/**
 * Lower case, Latin accents and punctuation removed, apostrophes dropped
 * (can’t → cant). Letters of every script are kept: Devanagari "दाल" is a
 * word to match, not noise to delete (Codex content audit F21).
 */
export function normalise(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Joiners shape Indic letters; they are not word breaks.
    .replace(/[\u200c\u200d]/g, '')
    .toLowerCase()
    .replace(/['’‘`]/g, '')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * Fold simple English plurals so "rotis", "idlis" and "glasses" find "roti",
 * "idli" and "glass". Applied to both the query and the content, so an odd
 * fold ("diabetes" → "diabete") still matches itself. Other scripts and
 * numbers are left as they are.
 */
export function stem(word: string): string {
  if (word.length <= 3 || !/^[a-z]+$/.test(word)) return word;
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (/(ss|x|z|ch|sh)es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/** The meaningful words of a text, as typed (`word`) and folded for matching (`token`). */
export function words(text: string): { word: string; token: string }[] {
  return normalise(text).split(' ').filter(w => w && !STOP_WORDS.has(w)).map(word => ({ word, token: stem(word) }));
}

/** Meaningful, folded words of a text. */
export function tokens(text: string): string[] {
  return words(text).map(w => w.token);
}
