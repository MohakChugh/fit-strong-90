import { describe, expect, it } from 'vitest';
import { ALLERGEN_IDS, type AllergenId, type FoodPreferences } from '@/types/profile';
import {
  ALLERGENS, allergenList, allergiesOf, allergyAnswer, allergyWarning, ownFoodTags, recommendable, resolveAllergens, setupAllergyAnswer, type AllergenTags,
} from './allergens';
import type { CustomFood } from './types';

const tags = (over: Partial<AllergenTags> = {}): AllergenTags => ({ contains: [], mayContain: [], complete: true, named: true, words: [], ...over });

describe('the canonical allergens (B-13, board D99)', () => {
  it('are Plan 5’s ten, each with a chip label and aliases', () => {
    expect(ALLERGENS.map(a => a.id)).toEqual([...ALLERGEN_IDS]);
    for (const a of ALLERGENS) expect(a.aliases.length, a.id).toBeGreaterThan(1);
  });
});

describe('resolveAllergens: the person’s own words to canonical ids (B-13, Review Focus 2)', () => {
  it('finds a canonical allergen by any of its names, singular or plural, in English, Hindi or Hinglish', () => {
    expect(resolveAllergens('peanut')).toEqual(['peanut']);
    expect(resolveAllergens('Peanuts')).toEqual(['peanut']);
    expect(resolveAllergens('groundnuts')).toEqual(['peanut']);
    expect(resolveAllergens('मूंगफली')).toEqual(['peanut']);
    expect(resolveAllergens('Prawns')).toEqual(['shellfish']);
    expect(resolveAllergens('dahi')).toEqual(['milk']);
    expect(resolveAllergens('gluten')).toEqual(['wheat']);
    expect(resolveAllergens('lactose intolerant')).toEqual(['milk']);
    expect(resolveAllergens('treeNut')).toEqual(['treeNut']);
  });
  it('reads an umbrella word as every allergen it covers', () => {
    expect(resolveAllergens('nuts')).toEqual(['peanut', 'treeNut']);
    expect(resolveAllergens('seafood')).toEqual(['fish', 'shellfish']);
    expect(resolveAllergens('tree nuts')).toEqual(['treeNut']);
  });
  it('keeps coconut apart from tree nuts (board D99)', () => {
    expect(resolveAllergens('coconut')).toEqual([]);
    expect(resolveAllergens('tree nuts')).not.toContain('coconut');
  });
  it('names nothing for a word it doesn’t know', () => {
    expect(resolveAllergens('brinjal')).toEqual([]);
    expect(resolveAllergens('  ')).toEqual([]);
  });
  // Plan 5's interim word lists (board D82), which setup and restored backups wrote custom allergies against (H7-01, K7-01).
  const PLAN_5_TERMS: Record<AllergenId, readonly string[]> = {
    peanut: ['peanut', 'groundnut', 'moongphali', 'mungfali', 'nut', 'मूंगफली'],
    treeNut: ['nut', 'almond', 'badam', 'cashew', 'kaju', 'walnut', 'akhrot', 'pistachio', 'pista', 'hazelnut', 'pecan', 'बादाम', 'काजू'],
    milk: ['milk', 'dairy', 'lactose', 'curd', 'dahi', 'yogurt', 'yoghurt', 'paneer', 'cheese', 'ghee', 'butter', 'buttermilk', 'cream', 'khoya', 'doodh', 'raita', 'chaas', 'lassi', 'thayir', 'दूध', 'दही', 'पनीर', 'घी'],
    egg: ['egg', 'anda', 'omelette', 'अंडा'],
    wheat: ['wheat', 'gluten', 'atta', 'maida', 'sooji', 'suji', 'rava', 'semolina', 'dalia', 'daliya', 'गेहूं'],
    soy: ['soy', 'soya', 'soybean', 'tofu'],
    sesame: ['sesame', 'til', 'gingelly', 'seed', 'तिल'],
    fish: ['fish', 'seafood', 'machli', 'machhli', 'meen', 'मछली'],
    shellfish: ['shellfish', 'seafood', 'prawn', 'shrimp', 'jhinga', 'crab', 'lobster', 'squid', 'clam', 'oyster', 'mussel', 'झींगा'],
    mustard: ['mustard', 'rai', 'sarson', 'सरसों', 'राई'],
  };
  it('keeps every word Plan 5 read as an allergen, so an allergy setup or a backup stored still names it (H7-01, K7-01)', () => {
    for (const [id, terms] of Object.entries(PLAN_5_TERMS)) for (const term of terms) expect(resolveAllergens(term), `${term} → ${id}`).toContain(id);
    expect(resolveAllergens('Buttermilk')).toEqual(['milk']);
    expect(resolveAllergens('omelettes')).toEqual(['egg']);
    expect(resolveAllergens('seeds')).toEqual(['sesame']);
  });
  it('reads the other words for milk sweets and cream as milk (K7-01)', () => {
    for (const word of ['khoa', 'mawa', 'malai', 'chhena']) expect(resolveAllergens(word), word).toEqual(['milk']);
  });
  it('reads the regional words for buttermilk, butter and shrikhand as milk, and the food table’s own spellings too (K7R-02; board D200)', () => {
    for (const word of ['chaach', 'mattha', 'taak', 'moru', 'majjiga', 'makhan', 'shrikhand', 'chhachh', 'majjige', 'mor']) {
      expect(resolveAllergens(word), word).toEqual(['milk']);
    }
  });
});

describe('allergiesOf', () => {
  it('reads the chips, and the own words through the aliases, leaving the rest as custom allergies', () => {
    expect(allergiesOf({ allergies: ['peanut', 'sesame'], customAllergies: ['Groundnut', 'Brinjals', 'coconut'] }))
      .toEqual({ known: ['peanut', 'sesame'], custom: [['brinjal'], ['coconut']] });
    expect(allergiesOf(undefined)).toEqual({ known: [], custom: [] });
    expect(allergiesOf({})).toEqual({ known: [], custom: [] });
  });
  it('also keeps a phrase that only contains an allergen’s name in the person’s own words, so “coconut milk” keeps out coconut milk', () => {
    const coconutMilk = allergiesOf({ customAllergies: ['Coconut milk'] });
    expect(coconutMilk).toEqual({ known: ['milk'], custom: [['coconut', 'milk']] });
    expect(recommendable(tags({ words: ['chicken', 'stew', 'coconut', 'milk', 'nariyal'] }), coconutMilk)).toBe(false);
    expect(allergyWarning(tags({ words: ['coconut', 'milk'] }), coconutMilk)).toBe('Contains coconut milk, which you listed as an allergy');
  });
});

describe('recommendable (B-13)', () => {
  const peanut = allergiesOf({ allergies: ['peanut'] });
  const brinjal = allergiesOf({ customAllergies: ['brinjal'] });
  it('recommends anything to someone with no allergies, fully tagged or not', () => {
    expect(recommendable(tags({ complete: false }), allergiesOf({}))).toBe(true);
  });
  it('leaves out what contains or may contain the allergen', () => {
    expect(recommendable(tags({ contains: ['peanut'] }), peanut)).toBe(false);
    expect(recommendable(tags({ mayContain: ['peanut'] }), peanut)).toBe(false);
    expect(recommendable(tags({ contains: ['milk'] }), peanut)).toBe(true);
  });
  it('with any allergy, leaves out what isn’t fully tagged', () => {
    expect(recommendable(tags({ complete: false }), peanut)).toBe(false);
    expect(recommendable(tags({ complete: false }), brinjal)).toBe(false);
  });
  it('with a custom allergy, leaves out what isn’t known by name; a canonical allergy reads the tags (B-13, K7-02)', () => {
    expect(recommendable(tags({ named: false }), brinjal)).toBe(false);
    expect(recommendable(tags({ named: false }), allergiesOf({ allergies: ['peanut'], customAllergies: ['brinjal'] }))).toBe(false);
    expect(recommendable(tags({ named: false }), peanut)).toBe(true);
    expect(recommendable(tags({ named: false }), allergiesOf({}))).toBe(true);
  });
  it('matches a custom allergy against every word the dish and its ingredients go by', () => {
    expect(recommendable(tags({ words: ['baingan', 'brinjal', 'bharta'] }), brinjal)).toBe(false);
    expect(recommendable(tags({ words: ['roti', 'wheat'] }), brinjal)).toBe(true);
    expect(recommendable(tags({ words: ['green', 'pea', 'matar'] }), allergiesOf({ customAllergies: ['green peas'] }))).toBe(false);
    expect(recommendable(tags({ words: ['pea'] }), allergiesOf({ customAllergies: ['green peas'] }))).toBe(true);
  });
});

describe('allergyWarning: logging never hides a food, it says why (B-13)', () => {
  it('names a contained or possible allergen, or a custom match, in plain words', () => {
    expect(allergyWarning(tags({ contains: ['peanut', 'mustard'] }), allergiesOf({ allergies: ['peanut', 'mustard'] }))).toBe('Contains peanut and mustard, which you listed as allergies');
    expect(allergyWarning(tags({ mayContain: ['wheat'] }), allergiesOf({ customAllergies: ['gluten'] }))).toBe('May contain wheat, which you listed as an allergy');
    expect(allergyWarning(tags({ words: ['brinjal'] }), allergiesOf({ customAllergies: ['Brinjal'] }))).toBe('Contains brinjal, which you listed as an allergy');
    expect(allergyWarning(tags({ contains: ['milk'] }), allergiesOf({ allergies: ['peanut'] }))).toBeUndefined();
  });
  it('says when not everything is known by name, for an allergy in the person’s own words (K7-14)', () => {
    expect(allergyWarning(tags({ named: false }), allergiesOf({ customAllergies: ['brinjal'] }))).toBe('Not everything in it is known by name. Check it for brinjal.');
    expect(allergyWarning(tags({ named: false }), allergiesOf({ allergies: ['peanut'] }))).toBeUndefined();
    // The tags speak for peanut; only the own words need checking.
    expect(allergyWarning(tags({ named: false }), allergiesOf({ allergies: ['peanut'], customAllergies: ['brinjal'] }))).toBe('Not everything in it is known by name. Check it for brinjal.');
    expect(allergyWarning(tags({ named: false, words: ['brinjal'] }), allergiesOf({ customAllergies: ['brinjal'] }))).toBe('Contains brinjal, which you listed as an allergy');
  });
  it('lists allergens as a sentence would', () => {
    expect(allergenList(['wheat'])).toBe('wheat');
    expect(allergenList(['milk', 'treeNut', 'sesame'])).toBe('milk, tree nuts and sesame');
  });
});

describe('your own food’s allergens: unanswered is unknown, and its name is read too (H7-04)', () => {
  const peanut = allergiesOf({ allergies: ['peanut'] });
  const own = (over: Partial<CustomFood> = {}): CustomFood => ({
    id: 'food-1', name: 'Peanut chutney', per: { qty: 1, unit: 'katori' }, createdAt: '2026-10-08T09:00:00.000+05:30', updatedAt: '2026-10-08T09:00:00.000+05:30', ...over,
  });
  it('warns of an allergen its name says, ticked or not', () => {
    expect(allergyWarning(ownFoodTags(own()), peanut)).toBe('May contain peanut, which you listed as an allergy');
    expect(allergyWarning(ownFoodTags(own({ allergens: [] })), peanut)).toBe('May contain peanut, which you listed as an allergy');
    expect(allergyWarning(ownFoodTags(own({ allergens: ['peanut'] })), peanut)).toBe('Contains peanut, which you listed as an allergy');
    expect(allergyWarning(ownFoodTags(own({ name: 'Groundnut ladoo' })), peanut)).toBe('May contain peanut, which you listed as an allergy');
  });
  it('says what isn’t known when nothing was answered, and nothing once “none of these” was', () => {
    expect(allergyWarning(ownFoodTags(own({ name: 'Bhel puri' })), peanut)).toBe('What’s in it isn’t known. Check it for peanut.');
    expect(allergyWarning(ownFoodTags(own({ name: 'Bhel puri' })), allergiesOf({ allergies: ['peanut', 'milk'], customAllergies: ['brinjal'] })))
      .toBe('What’s in it isn’t known. Check it for peanut, milk or brinjal.');
    expect(allergyWarning(ownFoodTags(own({ name: 'Bhel puri', allergens: [] })), peanut)).toBeUndefined();
    expect(allergyWarning(ownFoodTags(own({ name: 'Bhel puri' })), allergiesOf({}))).toBeUndefined();
  });
  it('never reads your own food as fully known by name', () => {
    expect(ownFoodTags(own({ allergens: [] }))).toMatchObject({ complete: true, named: false });
    expect(ownFoodTags(own())).toMatchObject({ complete: false, named: false });
  });
});

describe('the allergy answer setup keeps for a food record not made yet (Plan 5’s D166, D167; board D205)', () => {
  // Asked on setup's 'food.allergies' page whatever the pattern: with 'food.pattern' skipped, it waits in setup's answers.
  it('reads the answer from finished setup, or else the draft, as given', () => {
    expect(setupAllergyAnswer({ stage: 'done', answers: { allergies: ['peanut'], customAllergies: ['brinjal'], skippedPages: ['food.pattern'] } }))
      .toEqual({ allergies: ['peanut'], customAllergies: ['brinjal'] });
    expect(setupAllergyAnswer({ stage: 'open', draft: { answers: { allergies: ['milk'] } } })).toEqual({ allergies: ['milk'] });
    expect(setupAllergyAnswer({ answers: { pattern: 'vegan' }, draft: { answers: { customAllergies: ['chaach'] } } })).toEqual({ customAllergies: ['chaach'] });
    // "No food allergies" is an answer: an empty list.
    expect(setupAllergyAnswer({ answers: { allergies: [] } })).toEqual({ allergies: [] });
  });
  it('is nothing, never “none”, when setup holds no answer, or one it can’t read', () => {
    expect(setupAllergyAnswer(undefined)).toBeUndefined();
    expect(setupAllergyAnswer({})).toBeUndefined();
    expect(setupAllergyAnswer({ answers: { pattern: 'vegetarian' } })).toBeUndefined();
    expect(setupAllergyAnswer({ answers: { allergies: 'peanut' } } as never)).toBeUndefined();
    expect(setupAllergyAnswer({ answers: { allergies: ['peanut', 'unicorn', 7] } } as never)).toEqual({ allergies: ['peanut'] });
  });
  it('gives the food record’s own allergies wherever there is one, and setup’s only without', () => {
    const setup = { answers: { allergies: ['milk' as const] } };
    const vegan: FoodPreferences = { pattern: 'vegan', avoid: [] };
    expect(allergyAnswer({ ...vegan, allergies: ['peanut'] } as FoodPreferences, setup)).toEqual({ allergies: ['peanut'] });
    expect(allergyAnswer(vegan, setup)).toEqual({});
    expect(allergyAnswer(undefined, setup)).toEqual({ allergies: ['milk'] });
    expect(allergyAnswer(undefined, undefined)).toBeUndefined();
  });
});
