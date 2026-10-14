/**
 * What a backup can hold, which is what setup takes (H5-18): one set of
 * limits for the forms, the stored answers and the import check
 * (store/importCheck.ts), so nothing setup stores is refused on restore.
 */
export const NAME_MAX = 60;
/**
 * The numbers setup's pages have people type, by their key in `draft.raw`:
 * the answer's name, or with a part, as `heightCm.ft` (board D169).
 */
export const RAW_KEYS = [
  'birthYear', 'heightCm', 'heightCm.ft', 'heightCm.inch', 'weightKg', 'waistCm',
  'bpStopSystolic', 'bpPermission.sys', 'bpPermission.dia', 'hba1cPercent', 'glucoseStartMin', 'metforminSince',
  'customAllergies',
] as const;
export type RawKey = typeof RAW_KEYS[number];
/** A number as typed: its field takes no more. */
export const TYPED_MAX = 12;
/** Allergies in the person's own words (B-13). */
export const OWN_ALLERGIES_MAX = 30;
export const OWN_ALLERGY_LENGTH_MAX = 60;
/** What a field typed into takes (H5-18): a number's few characters, or every allergy of the person's own with its comma. */
export const typedMax = (key: RawKey): number => (key === 'customAllergies' ? OWN_ALLERGIES_MAX * (OWN_ALLERGY_LENGTH_MAX + 2) : TYPED_MAX);

/** What's wrong with the name, or `null`. */
export function nameProblem(name: string | undefined): string | null {
  return (name?.length ?? 0) > NAME_MAX ? `Use ${NAME_MAX} characters or fewer.` : null;
}

/** What's wrong with the allergies typed, or `null`. */
export function ownAllergiesProblem(list: readonly string[] | undefined): string | null {
  if (!list) return null;
  if (list.length > OWN_ALLERGIES_MAX) return `Up to ${OWN_ALLERGIES_MAX} allergies of your own, separated by commas.`;
  if (list.some(x => x.length > OWN_ALLERGY_LENGTH_MAX)) return `Each allergy in ${OWN_ALLERGY_LENGTH_MAX} characters or fewer.`;
  return null;
}

/** A comma-separated field ("leave out", allergies of the person's own), as the list the profile stores. */
export function parseAvoid(text: string): string[] {
  return [...new Set(text.split(/[,;\n]/).map(s => s.trim()).filter(Boolean))];
}

/** Own-word allergies typed that can't be stored as given: kept as typed, and no answer until they fit (H5-18, H5F-08). */
export const ownTextProblem = (text: string): string | null => ownAllergiesProblem(parseAvoid(text));
