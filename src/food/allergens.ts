/**
 * Allergens by Plan 5's canonical ids, with the words people use for them
 * (B-13; board D99). Meal ideas leave out anything that contains an
 * allergen, may contain one, or isn't fully tagged. With an allergy the
 * aliases don't name, only fully tagged dishes without that word are
 * recommended. Logging never hides a food: it says what's in it
 * (`allergyWarning`).
 *
 * Kept free of the food table: it's matched against whatever tags it's given.
 */
import { tokens } from '@/content/text';
import { ALLERGEN_IDS, type AllergenId, type FoodPreferences } from '@/types/profile';
import type { SetupAnswers, SetupRecord } from '@/types/setup';
import { ownTextProblem } from '@/setup/limits';
import type { CustomFood } from './types';

export interface Allergen {
  id: AllergenId;
  /** On the chip. */
  label: string;
  /** In a sentence: "Contains tree nuts". */
  name: string;
  aliases: readonly string[];
}

// Every word Plan 5's interim lists read as an allergen is kept (board D82), since setup and backups stored
// custom allergies against them; allergens.test.ts holds that list (H7-01, K7-01).
const ALLERGEN_DEFS: Record<AllergenId, Omit<Allergen, 'id'>> = {
  peanut: { label: 'Peanuts', name: 'peanut', aliases: ['peanut', 'groundnut', 'moongphali', 'mungfali', 'nut', 'मूंगफली', 'मूँगफली'] },
  treeNut: { label: 'Tree nuts (almond, cashew)', name: 'tree nuts', aliases: ['tree nut', 'nut', 'almond', 'badam', 'cashew', 'kaju', 'walnut', 'akhrot', 'pistachio', 'pista', 'hazelnut', 'pecan', 'बादाम', 'काजू'] },
  milk: {
    label: 'Milk', name: 'milk',
    aliases: [
      'milk', 'dairy', 'lactose', 'curd', 'dahi', 'yogurt', 'yoghurt', 'paneer', 'ghee', 'butter', 'buttermilk', 'cream', 'cheese', 'khoya', 'khoa',
      'mawa', 'malai', 'chhena', 'doodh', 'raita', 'chaas', 'lassi', 'thayir', 'दूध', 'दही', 'पनीर', 'घी',
      // Regional words for buttermilk, butter and shrikhand, and the food table's own spellings of chaas (K7R-02; board D200).
      'chaach', 'mattha', 'taak', 'moru', 'majjiga', 'makhan', 'shrikhand', 'chhachh', 'majjige', 'mor',
    ],
  },
  egg: { label: 'Egg', name: 'egg', aliases: ['egg', 'anda', 'omelette', 'अंडा'] },
  // Our recipes use no barley, rye or oats, so gluten here is wheat's (D99).
  wheat: { label: 'Wheat (gluten)', name: 'wheat', aliases: ['wheat', 'gluten', 'atta', 'maida', 'sooji', 'suji', 'rava', 'semolina', 'dalia', 'daliya', 'gehun', 'coeliac', 'celiac', 'गेहूं', 'गेहूँ', 'मैदा'] },
  soy: { label: 'Soy', name: 'soy', aliases: ['soy', 'soya', 'soybean', 'tofu'] },
  // "Seeds" may be sesame, as Plan 5 read it.
  sesame: { label: 'Sesame (til)', name: 'sesame', aliases: ['sesame', 'til', 'gingelly', 'seed', 'तिल'] },
  fish: { label: 'Fish', name: 'fish', aliases: ['fish', 'seafood', 'machli', 'machhli', 'meen', 'मछली'] },
  shellfish: { label: 'Shellfish (prawn, crab)', name: 'shellfish', aliases: ['shellfish', 'seafood', 'crustacean', 'prawn', 'shrimp', 'jhinga', 'crab', 'lobster', 'mollusc', 'mollusk', 'squid', 'clam', 'oyster', 'mussel', 'झींगा'] },
  mustard: { label: 'Mustard (rai)', name: 'mustard', aliases: ['mustard', 'rai', 'sarson', 'सरसों', 'राई'] },
};

export const ALLERGENS: readonly Allergen[] = ALLERGEN_IDS.map(id => ({ id, ...ALLERGEN_DEFS[id] }));

const ALIASES = ALLERGENS.flatMap(a => a.aliases.map(alias => ({ id: a.id, words: tokens(alias) })));
const unique = <T>(xs: readonly T[]): T[] => [...new Set(xs)];
const joined = (word: string) => (names: readonly string[]) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} ${word} ${names.at(-1)}`);
const and = joined('and');
const or = joined('or');

export function isAllergenId(x: unknown): x is AllergenId {
  return typeof x === 'string' && (ALLERGEN_IDS as readonly string[]).includes(x);
}

export function allergenName(id: AllergenId): string {
  return ALLERGEN_DEFS[id].name;
}

/** "milk, tree nuts and sesame". */
export function allergenList(ids: readonly AllergenId[]): string {
  return and(ids.map(allergenName));
}

/**
 * The canonical allergens a person's own words name: those an alias matches
 * exactly ("tree nuts"), or else every one whose alias the words contain
 * ("allergic to nuts and dairy"). An id from a chip is itself.
 */
export function resolveAllergens(text: string): AllergenId[] {
  return resolve(text).ids;
}

/** `resolveAllergens`, saying whether an alias (or a chip's id) names the whole entry. */
function resolve(text: string): { ids: AllergenId[]; whole: boolean } {
  if (isAllergenId(text)) return { ids: [text], whole: true };
  const words = tokens(text);
  if (words.length === 0) return { ids: [], whole: true };
  const phrase = words.join(' ');
  const exact = ALIASES.filter(a => a.words.join(' ') === phrase).map(a => a.id);
  if (exact.length > 0) return { ids: unique(exact), whole: true };
  const have = new Set(words);
  return { ids: unique(ALIASES.filter(a => a.words.length > 0 && a.words.every(w => have.has(w))).map(a => a.id)), whole: false };
}

/** What the person said they're allergic to: the chips' ids and their own words. */
export type AllergyAnswer = Pick<FoodPreferences, 'allergies' | 'customAllergies'>;

/** Setup's session (`useSetupSession`): while setup goes on without saving, its answers are there, not stored (Plan 5's B-07, H5-06). */
type SetupSessionAnswers = { unsaved: boolean; answers: SetupAnswers; raw?: Readonly<Record<string, string>> };

/**
 * The allergy answer setup keeps for a food record not made yet (Plan 5's D166, D167; board D205): asked on its
 * 'food.allergies' page whatever the pattern, so with the pattern skipped it waits in setup's answers. Read from
 * this session while setup goes on without saving, as every reader of setup's answers does, since a draft stored
 * before is older; else finished setup, else the draft; as far as it can be read. Nothing is no answer, which is
 * never "none". Own words typed that can't be stored yet leave the whole answer not known until they can: the
 * earlier exclusions wait beside them, never dropped (H5F-08; board D222).
 */
export function setupAllergyAnswer(setup: SetupRecord | undefined, session?: SetupSessionAnswers): AllergyAnswer | undefined {
  const typed = (session?.unsaved ? session.raw : setup?.draft?.raw)?.customAllergies;
  if (typeof typed === 'string' && ownTextProblem(typed) !== null) return undefined;
  const answered = (a: unknown): a is Record<string, unknown> =>
    typeof a === 'object' && a !== null && ((a as Record<string, unknown>).allergies !== undefined || (a as Record<string, unknown>).customAllergies !== undefined);
  const answers = [session?.unsaved ? session.answers : undefined, setup?.answers, setup?.draft?.answers].find(answered);
  if (!answers) return undefined;
  const allergies = Array.isArray(answers.allergies) ? answers.allergies.filter(isAllergenId) : undefined;
  const custom = Array.isArray(answers.customAllergies) ? answers.customAllergies.filter((w): w is string => typeof w === 'string' && w.trim() !== '') : undefined;
  if (!allergies && !custom) return undefined;
  return { ...(allergies ? { allergies } : {}), ...(custom ? { customAllergies: custom } : {}) };
}

/**
 * The person's allergies as far as they're known (board D205): their food record's wherever it answered them, and
 * without that, setup's waiting answer (this session's while setup goes on without saving). A record that never
 * answered them, as v1's `{ pattern, avoid, region }`, is not known either (owner decision; Plan 5's board D194).
 * Nothing means not known: meal ideas ask first, never treat it as none.
 */
export function allergyAnswer(food: AllergyAnswer | undefined, setup: SetupRecord | undefined, session?: SetupSessionAnswers): AllergyAnswer | undefined {
  if (food?.allergies === undefined && food?.customAllergies === undefined) return setupAllergyAnswer(setup, session);
  return { ...(food.allergies ? { allergies: food.allergies } : {}), ...(food.customAllergies ? { customAllergies: food.customAllergies } : {}) };
}

export interface Allergies {
  known: AllergenId[];
  /** Each own-words entry the aliases don't name, as its folded words. */
  custom: string[][];
}

/**
 * The person's allergies: the chips, and their own words read through the
 * aliases first. An entry no alias names whole is also kept in their own
 * words: "coconut milk" is milk, and it still keeps out coconut milk.
 */
export function allergiesOf(food: Pick<FoodPreferences, 'allergies' | 'customAllergies'> | undefined): Allergies {
  const known: AllergenId[] = [...(food?.allergies ?? [])];
  const custom: string[][] = [];
  for (const entry of food?.customAllergies ?? []) {
    const { ids, whole } = resolve(entry);
    known.push(...ids);
    if (!whole) {
      const words = tokens(entry);
      if (words.length > 0) custom.push(words);
    }
  }
  return { known: unique(known), custom };
}

/** What a dish, a meal idea or a food is tagged with. `words` are folded (`tokens`). */
export interface AllergenTags {
  contains: readonly AllergenId[];
  mayContain: readonly AllergenId[];
  /** Every part's canonical allergens are tagged: a part whose make-up isn't established isn't. */
  complete: boolean;
  /**
   * Every part is known by name, so a custom allergy can be matched against
   * `words` (B-13: "only dishes whose ingredients are all tagged"). A blend,
   * such as compounded hing, isn't: its allergens are tagged, its flours aren't named (K7-02).
   */
  named: boolean;
  words: readonly string[];
}

/** Whether this may be recommended to this person (B-13). */
export function recommendable(tags: AllergenTags, allergies: Allergies): boolean {
  if (allergies.known.length === 0 && allergies.custom.length === 0) return true;
  if (!tags.complete) return false;
  if (allergies.known.some(id => tags.contains.includes(id) || tags.mayContain.includes(id))) return false;
  if (allergies.custom.length > 0 && !tags.named) return false;
  const words = new Set(tags.words);
  return !allergies.custom.some(entry => entry.every(w => words.has(w)));
}

const listed = (n: number) => (n === 1 ? 'which you listed as an allergy' : 'which you listed as allergies');

/**
 * Why a food the person can still log is marked for them, or nothing. A
 * food whose allergens aren't tagged says so, and what to check it for
 * (H7-04): logging stays open (B-13).
 */
export function allergyWarning(tags: AllergenTags, allergies: Allergies): string | undefined {
  const contains = allergies.known.filter(id => tags.contains.includes(id));
  if (contains.length > 0) return `Contains ${allergenList(contains)}, ${listed(contains.length)}`;
  const may = allergies.known.filter(id => tags.mayContain.includes(id));
  if (may.length > 0) return `May contain ${allergenList(may)}, ${listed(may.length)}`;
  const words = new Set(tags.words);
  const hits = allergies.custom.filter(entry => entry.every(w => words.has(w))).map(entry => entry.join(' '));
  if (hits.length > 0) return `Contains ${and(hits)}, ${listed(hits.length)}`;
  const own = allergies.custom.map(entry => entry.join(' '));
  const all = [...allergies.known.map(allergenName), ...own];
  if (!tags.complete && all.length > 0) return `What’s in it isn’t known. Check it for ${or(all)}.`;
  // A blend's allergens are tagged; an allergy in the person's own words can't be matched against it (K7-02, K7-14).
  return !tags.named && own.length > 0 ? `Not everything in it is known by name. Check it for ${or(own)}.` : undefined;
}

/**
 * Your own food's tags (H7-04): what the person ticked, and any allergen its
 * name says ("Peanut chutney"), which may be in it whatever was ticked.
 * Nothing ticked is unknown, never "none"; "None of these" is `allergens: []`.
 * Its ingredients are never known by name.
 */
export function ownFoodTags(food: Pick<CustomFood, 'name' | 'allergens'>): AllergenTags {
  const contains = food.allergens ?? [];
  return {
    contains,
    mayContain: resolveAllergens(food.name).filter(id => !contains.includes(id)),
    complete: food.allergens !== undefined,
    named: false,
    words: tokens(food.name),
  };
}
