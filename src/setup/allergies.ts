/**
 * The chips chapter 7 offers, by the canonical ids Plan 7 consumes (B-13,
 * board D82), with the labels Plan 7 gives them in `src/food/allergens.ts`.
 * Anything else is the person's own words (`customAllergies`).
 */
import { ALLERGEN_IDS, type AllergenId } from '@/types/profile';

const LABEL: Record<AllergenId, string> = {
  peanut: 'Peanuts', treeNut: 'Tree nuts (almond, cashew)', milk: 'Milk', egg: 'Egg', wheat: 'Wheat (gluten)',
  soy: 'Soy', sesame: 'Sesame (til)', fish: 'Fish', shellfish: 'Shellfish (prawn, crab)', mustard: 'Mustard (rai)',
};

export const ALLERGY_CHIPS: { value: AllergenId; label: string }[] = ALLERGEN_IDS.map(value => ({ value, label: LABEL[value] }));

/** A stored allergy as the person reads it. */
export const allergyName = (id: AllergenId): string => LABEL[id];
