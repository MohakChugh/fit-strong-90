/**
 * What a backup can hold, which is what setup takes (H5-18): one set of
 * limits for the forms, the stored answers and the import check
 * (store/importCheck.ts), so nothing setup stores is refused on restore.
 */
export const NAME_MAX = 60;
/** Allergies in the person's own words (B-13). */
export const OWN_ALLERGIES_MAX = 30;
export const OWN_ALLERGY_LENGTH_MAX = 60;

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
