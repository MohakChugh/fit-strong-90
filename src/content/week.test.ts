import { describe, expect, it } from 'vitest';
import type { FoodPreferences } from '@/types/profile';
import { MEALS } from './meals';
import type { Pattern, Slot } from './schema';
import { componentsFor, isAvoided, mealsFor, sampleWeek, WEEKDAYS } from './week';

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
