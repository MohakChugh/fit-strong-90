import type { FoodPreferences } from '@/types/profile';
import { PATTERN_LABEL, unmatchedAvoid, type SearchResult } from '@/content';

/** "2026-10-08" → "8 October 2026", read as a local calendar date. */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export const REGION_LABEL: Record<NonNullable<FoodPreferences['region']>, string> = {
  north: 'North Indian',
  south: 'South Indian',
  east: 'East Indian',
  west: 'West Indian',
  mixed: 'Any region',
};

/**
 * "Vegetarian · South Indian · no peanuts", for the row that shows what the
 * person eats. Only foods that actually hid something are listed as left out.
 */
export function foodSummary(food: FoodPreferences): string {
  const parts = [PATTERN_LABEL[food.pattern]];
  if (food.region && food.region !== 'mixed') parts.push(REGION_LABEL[food.region]);
  const unmatched = new Set(unmatchedAvoid(food.avoid, food.pattern));
  const left = food.avoid.filter(a => !unmatched.has(a));
  if (left.length > 0) parts.push(`no ${left.join(', ')}`);
  return parts.join(' · ');
}

/** The comma-separated "leave out" field, as the list the profile stores. */
export function parseAvoid(text: string): string[] {
  return [...new Set(text.split(/[,;\n]/).map(s => s.trim()).filter(Boolean))];
}

/**
 * Said plainly when a "leave out" entry hid no meal, so a misspelling, a dish
 * no meal names or a script the meals do not know is never taken as done
 * (Codex content audit F21, re-check R04).
 */
export function unmatchedNote(entries: readonly string[]): string | undefined {
  if (entries.length === 0) return undefined;
  const names = entries.map(e => `“${e}”`);
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} or ${names.at(-1)}`;
  return entries.length === 1
    ? `Nothing was left out for ${list}: none of the meal ideas shown to you names it. A meal can still contain it under another name.`
    : `Nothing was left out for ${list}: none of the meal ideas shown to you names them. A meal can still contain them under other names.`;
}

/** "“insulin”", or "“fasting” and “insulin”". */
function quoted(words: readonly string[]): string {
  return words.length === 1 ? `“${words[0]}”` : `${words.slice(0, -1).map(w => `“${w}”`).join(', ')} and “${words.at(-1)}”`;
}

/** No result matches every word typed: the screen says so instead of presenting answers (Codex content audit F22). */
export function onlyPartial(results: readonly SearchResult[]): boolean {
  return results.length > 0 && results.every(r => r.missing.length > 0);
}

/** A partial result's second line: what it matches, and what it does not. */
export function partialDetail(result: SearchResult): string {
  return `Matches ${quoted(result.matched)}, not ${quoted(result.missing)}`;
}

/** Under the "leave out" field: what it does, and what it is not. */
export const AVOID_HELP = 'Meal ideas that name these foods are hidden. This is not an allergy check: other dishes and kitchens can still contain them. Separate foods with commas.';

/** Under every list of sources (Codex content audit F24): what the link carries, and no more. */
export const SOURCE_LINK_NOTE = 'Opens the original in a new tab. Your profile and readings are not included in the link.';
