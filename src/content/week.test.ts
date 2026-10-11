import { describe, expect, it } from 'vitest';
import type { FoodPreferences } from '@/types/profile';
import { MEALS } from './meals';
import type { Pattern, Slot } from './schema';
import { JAIN_LEAVES_OUT, withPicked } from './allergens';
import { componentsFor, isAvoided, mealAllowed, mealsFor, mealTags, sampleWeek, suits, WEEKDAYS } from './week';

const PATTERNS: Pattern[] = ['vegetarian', 'eggetarian', 'nonVegetarian', 'vegan'];
const SLOTS: Slot[] = ['breakfast', 'lunch', 'snack', 'dinner'];
const food = (pattern: Pattern, over: Partial<FoodPreferences> = {}): FoodPreferences => ({ pattern, avoid: [], ...over });
const meal = (id: string) => MEALS.find(m => m.id === id)!;

describe('meals for a pattern', () => {
  it('gives vegetarians no egg, fish or meat', () => {
    const groups = mealsFor(food('vegetarian')).flatMap(m => componentsFor(m, 'vegetarian').map(c => c.group));
    expect(groups).not.toContain('eggsMeatFish');
  });

  it('gives vegans no dairy, eggs, fish or meat, once their components are dropped', () => {
    const groups = mealsFor(food('vegan')).flatMap(m => componentsFor(m, 'vegan').map(c => c.group));
    expect(groups).not.toContain('dairy');
    expect(groups).not.toContain('eggsMeatFish');
  });

  it('drops the dahi from a vegan’s plate but keeps the meal', () => {
    const dal = meal('l-roti-dal-sabzi');
    expect(componentsFor(dal, 'vegan').some(c => c.group === 'dairy')).toBe(false);
    expect(componentsFor(dal, 'vegetarian').some(c => c.group === 'dairy')).toBe(true);
    expect(mealsFor(food('vegan'), 'lunch')).toContain(dal);
  });

  it('offers eggetarians eggs but no fish or meat', () => {
    const names = mealsFor(food('eggetarian')).map(m => m.id);
    expect(names).toContain('b-egg-bhurji');
    expect(names).not.toContain('l-fish-curry-rice');
    expect(names).not.toContain('l-chicken-roti');
  });

  it('puts the chosen region first and still offers every other dish', () => {
    const west = mealsFor(food('vegetarian', { region: 'west' }), 'breakfast');
    expect(west[0].regions).toContain('west');
    expect(mealsFor(food('vegetarian'), 'breakfast')[0].regions).not.toContain('west');
    expect(new Set(west.map(m => m.id))).toEqual(new Set(mealsFor(food('vegetarian'), 'breakfast').map(m => m.id)));
  });

  it('treats "mixed" as no regional order', () => {
    expect(mealsFor(food('vegetarian', { region: 'mixed' }))).toEqual(mealsFor(food('vegetarian')));
  });
});

describe('leaving foods out', () => {
  it('hides meals containing a food the person named, by word', () => {
    expect(isAvoided(meal('b-poha'), ['peanuts'])).toBe(true);
    expect(isAvoided(meal('b-poha'), ['Peanut'])).toBe(true);
    expect(isAvoided(meal('b-poha'), ['groundnut'])).toBe(true);
    expect(mealsFor(food('vegetarian', { avoid: ['peanut'] })).map(m => m.id)).not.toContain('b-poha');
  });

  it('does not match part of a word', () => {
    // A nut allergy is not a reason to hide coconut chutney.
    expect(isAvoided(meal('b-idli-sambar'), ['nut'])).toBe(false);
  });

  it('matches through what a food is called elsewhere', () => {
    expect(isAvoided(meal('l-roti-dal-sabzi'), ['curd'], 'vegetarian')).toBe(true);
    expect(isAvoided(meal('l-palak-paneer'), ['dairy'])).toBe(true);
    expect(isAvoided(meal('l-chana-roti'), ['gluten'])).toBe(true);
  });

  it('ignores a food the person would not eat in that meal anyway', () => {
    // A vegan's roti-dal-sabzi has no dahi to leave out.
    expect(isAvoided(meal('l-roti-dal-sabzi'), ['curd'], 'vegan')).toBe(false);
  });

  it('ignores empty entries', () => {
    expect(isAvoided(meal('b-poha'), ['', '  '])).toBe(false);
  });
});

describe('the sample week', () => {
  it.each(PATTERNS)('fills all seven days and four slots for %s eaters, every meal suiting them', pattern => {
    const week = sampleWeek(food(pattern));
    expect(week.map(d => d.day)).toEqual([...WEEKDAYS]);
    for (const day of week) {
      for (const slot of SLOTS) {
        const m = day.meals[slot];
        expect(m, `${day.day} ${slot}`).toBeDefined();
        expect(m!.slot).toBe(slot);
        expect(m!.patterns).toContain(pattern);
      }
    }
  });

  it.each(PATTERNS)('never repeats a meal two days running for %s eaters', pattern => {
    const week = sampleWeek(food(pattern));
    for (const slot of SLOTS) {
      for (let i = 1; i < week.length; i++) {
        expect(week[i].meals[slot]?.id, `${slot} on ${week[i].day}`).not.toBe(week[i - 1].meals[slot]?.id);
      }
    }
  });

  it('uses only meal templates, so it adds nothing they do not cite', () => {
    const ids = new Set(MEALS.map(m => m.id));
    for (const day of sampleWeek(food('nonVegetarian'))) {
      for (const m of Object.values(day.meals)) expect(ids.has(m!.id)).toBe(true);
    }
  });

  it('respects foods left out', () => {
    const week = sampleWeek(food('vegetarian', { avoid: ['peanuts', 'paneer'] }));
    const used = week.flatMap(d => Object.values(d.meals).map(m => m!.id));
    expect(used).not.toContain('b-poha');
    expect(used).not.toContain('l-palak-paneer');
  });

  it('leaves a slot empty rather than inventing a meal when everything is excluded', () => {
    const week = sampleWeek(food('vegan', { avoid: ['chana', 'sprouts', 'fruit', 'seeds'] }));
    expect(week.every(d => d.meals.snack === undefined)).toBe(true);
    expect(week.every(d => d.meals.lunch !== undefined)).toBe(true);
  });

  it('starts with regional dishes when a region is chosen', () => {
    expect(sampleWeek(food('vegetarian', { region: 'west' }))[0].meals.breakfast?.regions).toContain('west');
  });
});

describe('setup’s food answers in meal ideas (board D82)', () => {
  const ids = (f: FoodPreferences, slot?: Slot) => mealsFor(f, slot).map(m => m.id);

  it('hides the ideas that name an allergen setup stored: peanut, milk and egg', () => {
    expect(ids(food('vegetarian', { allergies: ['peanut'] }), 'breakfast')).not.toContain('b-poha');
    expect(ids(food('vegetarian', { allergies: ['peanut'] }), 'breakfast')).toContain('b-idli-sambar');
    expect(ids(food('vegetarian', { allergies: ['milk'] }), 'lunch')).not.toContain('l-palak-paneer');
    expect(ids(food('eggetarian', { allergies: ['egg'] }), 'breakfast')).not.toContain('b-egg-bhurji');
    // "No food allergies" hides nothing.
    expect(ids(food('vegetarian', { allergies: [] }))).toEqual(ids(food('vegetarian')));
  });

  it('hides an allergy given in the person’s own words', () => {
    expect(ids(food('vegetarian', { customAllergies: ['groundnuts'] }), 'breakfast')).not.toContain('b-poha');
  });

  it('gives a Jain plate vegetarian ideas at every meal, with nothing Jain cooking leaves out', () => {
    const jain = food('jain');
    for (const slot of SLOTS) {
      const shown = mealsFor(jain, slot);
      expect(shown.length, slot).toBeGreaterThan(0);
      for (const m of shown) {
        expect(mealsFor(food('vegetarian'), slot), m.id).toContain(m);
        expect(isAvoided(m, JAIN_LEAVES_OUT, 'jain'), m.id).toBe(false);
      }
    }
    expect(ids(jain, 'breakfast')).not.toContain('b-poha');
    expect(JAIN_LEAVES_OUT).toEqual(expect.arrayContaining(['onion', 'garlic', 'potato', 'honey']));
  });

  it('drops from a Jain plate any part a vegetarian wouldn’t eat', () => {
    const base = meal('l-roti-dal-sabzi');
    const withEgg = { ...base, components: [...base.components, { ...base.components[0], name: 'Boiled egg', notFor: ['vegetarian', 'vegan'] as Pattern[] }] };
    expect(componentsFor(withEgg, 'jain').map(c => c.name)).not.toContain('Boiled egg');
    expect(componentsFor(withEgg, 'eggetarian').map(c => c.name)).toContain('Boiled egg');
  });

  it('Meal ideas’ own question changes only what it asks: setup’s allergies, level and screening answer stay', () => {
    const stored: FoodPreferences = {
      pattern: 'vegetarian', avoid: [], region: 'north', allergies: ['peanut'], customAllergies: ['brinjal'], level: 'estimates', hardBefore: 'no',
    };
    expect(withPicked(stored, { pattern: 'jain', avoid: ['mushrooms'], region: 'any' }))
      .toEqual({ pattern: 'jain', avoid: ['mushrooms'], allergies: ['peanut'], customAllergies: ['brinjal'], level: 'estimates', hardBefore: 'no' });
    expect(withPicked(undefined, { pattern: 'vegan', avoid: [], region: 'south' })).toEqual({ pattern: 'vegan', avoid: [], region: 'south' });
  });
});

describe('allergies and the Jain pattern from recipe tags (B-13, board D99, D100)', () => {
  const ids = (f: FoodPreferences, slot?: Slot) => mealsFor(f, slot).map(m => m.id);
  it('leaves out every idea with an allergen, or one that may contain it', () => {
    expect(ids(food('vegetarian', { allergies: ['peanut'] }), 'breakfast')).not.toContain('b-poha');
    expect(ids(food('vegetarian', { allergies: ['peanut'] }), 'breakfast')).toContain('b-idli-sambar');
    // "A few seeds or nuts" may carry them.
    expect(ids(food('vegetarian', { allergies: ['peanut'] }), 'snack')).not.toContain('s-salad-seeds');
    expect(ids(food('vegetarian', { allergies: ['wheat'] }), 'lunch')).not.toContain('l-roti-dal-sabzi');
    // Sambar's hing may contain wheat, and "gluten" in the person's own words is wheat.
    expect(ids(food('vegetarian', { allergies: ['wheat'] }), 'breakfast')).not.toContain('b-idli-sambar');
    expect(ids(food('vegetarian', { customAllergies: ['gluten'] }), 'breakfast')).not.toContain('b-idli-sambar');
    expect(ids(food('vegetarian', { allergies: ['milk'] }), 'lunch')).not.toContain('l-roti-dal-sabzi');
  });
  it('keeps a custom allergy’s word out, through the dishes’ own ingredients (Review Focus 2)', () => {
    expect(ids(food('vegetarian', { customAllergies: ['drumstick'] }), 'breakfast')).not.toContain('b-idli-sambar');
    expect(ids(food('vegetarian', { customAllergies: ['drumstick'] }), 'breakfast')).toContain('b-poha');
    // Coconut isn't canonical (D99): it's matched by word, here in the chutney's coconut.
    expect(ids(food('vegetarian', { customAllergies: ['coconut'] }), 'breakfast')).not.toContain('b-idli-sambar');
  });
  it('matches a food left out against the meal’s own words, as v1 did, and an allergy against its recipes too (D99)', () => {
    expect(isAvoided(meal('l-rajma-rice'), ['garlic'])).toBe(false);
    expect(ids(food('vegetarian', { customAllergies: ['garlic'] }), 'lunch')).not.toContain('l-rajma-rice');
    expect(ids(food('vegetarian', { customAllergies: ['garlic'] }), 'lunch')).toContain('l-roti-dal-sabzi');
  });
  it('offers a Jain plate only ideas without root vegetables, eggs, fish or meat', () => {
    const jain = food('jain');
    expect(ids(jain, 'breakfast')).toEqual(['b-dalia']);
    expect(ids(jain, 'lunch')).toEqual(['l-roti-dal-sabzi']);
    expect(ids(jain, 'snack')).toEqual(['s-roasted-chana', 's-fruit', 's-chaas']);
    expect(ids(jain, 'dinner')).toEqual(['d-khichdi', 'd-millet-roti-dal', 'd-dal-bhat']);
    // Kanda poha is onion poha; sambar and the palak paneer recipe have onion.
    expect(suits(meal('b-poha'), 'jain')).toBe(false);
    expect(suits(meal('b-idli-sambar'), 'jain')).toBe(false);
    expect(suits(meal('l-palak-paneer'), 'jain')).toBe(false);
  });
  it('tags an idea from its dishes, never listing as “may contain” what it contains', () => {
    expect(mealTags(meal('l-roti-dal-sabzi'), 'vegetarian')).toMatchObject({ contains: expect.arrayContaining(['milk', 'wheat']), mayContain: [], complete: true });
    expect(mealTags(meal('l-roti-dal-sabzi'), 'vegetarian').contains).toHaveLength(2);
  });
  it('keeps out, for anyone with an allergy, an idea with a part the map doesn’t know', () => {
    const base = meal('l-roti-dal-sabzi');
    const unknown = { ...base, components: [...base.components, { ...base.components[0], name: 'Something new' }] };
    expect(mealTags(unknown, 'vegetarian').complete).toBe(false);
    expect(mealAllowed(unknown, food('vegetarian', { allergies: ['soy'] }))).toBe(false);
    expect(mealAllowed(unknown, food('vegetarian'))).toBe(true);
  });
  it('takes the picker’s allergies when it gives them: an empty list is “none”, and emptied own words go', () => {
    const stored: FoodPreferences = { pattern: 'vegetarian', avoid: [], allergies: ['peanut'], customAllergies: ['brinjal'], level: 'meals' };
    expect(withPicked(stored, { pattern: 'vegetarian', avoid: [], region: 'any', allergies: ['milk'], customAllergies: ['drumstick'] }))
      .toEqual({ pattern: 'vegetarian', avoid: [], allergies: ['milk'], customAllergies: ['drumstick'], level: 'meals' });
    expect(withPicked(stored, { pattern: 'vegetarian', avoid: [], region: 'any', allergies: [], customAllergies: [] }))
      .toEqual({ pattern: 'vegetarian', avoid: [], allergies: [], level: 'meals' });
  });
  it('fills a Jain sample week from those ideas', () => {
    for (const day of sampleWeek(food('jain'))) expect(Object.keys(day.meals).sort()).toEqual(['breakfast', 'dinner', 'lunch', 'snack']);
  });
});
