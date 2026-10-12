import { describe, expect, it } from 'vitest';
import { getMeal } from '@/content';
import { contextOf, search } from '@/content';
import {
  AVOID_HELP, foodSummary, longDate, onlyPartial, parseAvoid, partialDetail, SOURCE_LINK_NOTE, unmatchedNote,
} from './format';
import { componentDetail, mealDetail, measureClaimIds } from './mealText';

describe('Guide formatting', () => {
  it('writes a review date out in full, as a local date', () => {
    expect(longDate('2026-10-08')).toBe('8 October 2026');
    expect(longDate('2026-01-31')).toBe('31 January 2026');
  });

  it('summarises what the person eats', () => {
    expect(foodSummary({ pattern: 'vegetarian', avoid: [] })).toBe('Vegetarian');
    expect(foodSummary({ pattern: 'vegan', avoid: ['peanuts'], region: 'south' })).toBe('Vegan · South Indian · no peanuts');
    expect(foodSummary({ pattern: 'eggetarian', avoid: [], region: 'mixed' })).toBe('Vegetarian with eggs');
  });

  it('splits the leave-out field into foods, dropping blanks and repeats', () => {
    expect(parseAvoid(' peanuts, mushrooms ,, peanuts;  ')).toEqual(['peanuts', 'mushrooms']);
    expect(parseAvoid('')).toEqual([]);
  });

  it('lists as left out only the foods that hid a meal, and says so plainly about the rest', () => {
    expect(foodSummary({ pattern: 'vegan', avoid: ['peanuts', 'zzzz', 'பருப்பு'] })).toBe('Vegan · no peanuts');
    // Re-check R04: a dish no single meal contains is not a successful exclusion.
    expect(foodSummary({ pattern: 'vegetarian', avoid: ['peanut chutney', 'coconut milk', 'peanuts'] })).toBe('Vegetarian · no peanuts');
    expect(foodSummary({ pattern: 'vegan', avoid: ['curd'] })).toBe('Vegan');
    expect(unmatchedNote([])).toBeUndefined();
    expect(unmatchedNote(['zzzz'])).toBe('Nothing was left out for “zzzz”: none of the meal ideas shown to you names it. A meal can still contain it under another name.');
    expect(unmatchedNote(['a', 'b', 'c'])).toMatch(/^Nothing was left out for “a”, “b” or “c”: none of the meal ideas shown to you names them/);
  });

  it('says leaving a food out is not an allergy check, and that links carry no profile or readings', () => {
    expect(AVOID_HELP).toMatch(/not an allergy check/);
    expect(SOURCE_LINK_NOTE).toBe('Opens the original in a new tab. Your profile and readings are not included in the link.');
  });
});

describe('meal text', () => {
  const dal = getMeal('l-roti-dal-sabzi')!;

  it('lists a meal’s food groups once each, without the ones a pattern drops', () => {
    expect(mealDetail(dal, 'vegetarian')).toBe('Vegetables · Dal and pulses · Grains · Dairy');
    expect(mealDetail(dal, 'vegan')).toBe('Vegetables · Dal and pulses · Grains');
  });

  it('shows a portion only where a source gives one', () => {
    expect(componentDetail(dal.components[0])).toBe('Vegetables · Half the plate');
    expect(componentDetail({ name: 'Coconut chutney', group: 'fats' })).toBe('Fats');
  });

  it('cites the measures a meal uses without repeating claims already on it', () => {
    expect(measureClaimIds(dal, 'vegetarian', dal.claimIds)).toEqual(['meal-curd-glass']);
    expect(measureClaimIds(dal, 'vegan', dal.claimIds)).toEqual([]);
  });
});

describe('partial search results', () => {
  it('labels results that match only some words, and not complete ones', () => {
    const partial = search('insulin zebra', contextOf());
    expect(onlyPartial(partial)).toBe(true);
    expect(partialDetail(partial[0])).toBe('Matches “insulin”, not “zebra”');
    expect(onlyPartial(search('dal', contextOf()))).toBe(false);
    expect(onlyPartial([])).toBe(false);
  });
});
