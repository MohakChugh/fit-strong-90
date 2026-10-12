import { describe, expect, it } from 'vitest';
import { contextOf } from './personalise';
import { search } from './search';
import { normalise, stem, tokens } from './text';
import { TOPICS } from './topics';

const anyone = contextOf();
const ids = (q: string, ctx = anyone) => search(q, ctx).map(r => r.id);
const meals = (q: string, ctx = anyone) => search(q, ctx).filter(r => r.kind === 'meal').map(r => r.id);

describe('an empty query', () => {
  it('returns the topics and nothing else', () => {
    const results = search('', anyone);
    expect(results.every(r => r.kind === 'topic')).toBe(true);
    expect(results.map(r => r.id)).toEqual(TOPICS.map(t => t.id));
  });

  it('treats whitespace and filler words as empty', () => {
    expect(search('   ', anyone).map(r => r.id)).toEqual(TOPICS.map(t => t.id));
    expect(search('how do I', anyone).map(r => r.id)).toEqual(TOPICS.map(t => t.id));
  });

  it('lists the person’s own topics first', () => {
    expect(search('', contextOf(['backPain']))[0].id).toBe('desk');
  });
});

describe('Hindi food names', () => {
  it.each([
    ['dal', 'l-roti-dal-sabzi'],
    ['roti', 'l-roti-dal-sabzi'],
    ['sabzi', 'l-roti-dal-sabzi'],
    ['idli', 'b-idli-sambar'],
    ['poha', 'b-poha'],
    ['upma', 'b-upma'],
    ['dosa', 'b-dosa-sambar'],
    ['chana', 'l-chana-roti'],
    ['rajma', 'l-rajma-rice'],
    ['paneer', 'l-palak-paneer'],
    ['dahi', 'l-roti-dal-sabzi'],
  ])('“%s” finds %s', (query, meal) => {
    expect(meals(query)).toContain(meal);
  });

  it('ranks the dish named after the word first', () => {
    expect(meals('idli')[0]).toBe('b-idli-sambar');
    expect(meals('rajma')[0]).toBe('l-rajma-rice');
    expect(meals('poha')[0]).toBe('b-poha');
  });

  it('finds the matching answers too, not only meals', () => {
    expect(ids('rajma')).toContain('card-dal');
    expect(ids('dahi')).toContain('card-b12-food');
  });
});

describe('tolerance', () => {
  it('ignores case and accents', () => {
    expect(meals('IDLI')).toEqual(meals('idli'));
    expect(meals('Dosá')).toEqual(meals('dosa'));
  });

  it('folds simple plurals', () => {
    expect(meals('rotis')).toEqual(meals('roti'));
    expect(meals('idlis')).toEqual(meals('idli'));
    expect(ids('glasses of water')).toContain('card-water-amount');
  });

  it('matches the last word as a prefix while typing', () => {
    expect(meals('pane')).toContain('l-palak-paneer');
    expect(ids('posture')).toContain('card-posture');
    expect(ids('postu')).toContain('card-posture');
  });

  it('does not treat a single letter as a prefix', () => {
    const results = ids('vitamin d');
    expect(results).toContain('vitamin-d');
    expect(results).toContain('card-d-get');
    expect(results).not.toContain('card-b12-food');
  });

  it('finds spelling variants through aliases', () => {
    expect(meals('daal')).toContain('l-roti-dal-sabzi');
    expect(meals('chapati')).toContain('l-roti-dal-sabzi');
    expect(meals('curd')).toContain('l-roti-dal-sabzi');
  });

  it('falls back to the closest matches when no result has every word', () => {
    expect(ids('best food for diabetes').length).toBeGreaterThan(0);
  });

  it('returns nothing for words it has never seen', () => {
    expect(search('xylophone', anyone)).toEqual([]);
  });
});

describe('the person’s answers shape results', () => {
  it('hides the generic water card from someone with a kidney condition', () => {
    expect(ids('water')).toContain('card-water-amount');
    expect(ids('water', contextOf(['kidney', 'fluidCaution']))).not.toContain('card-water-amount');
    expect(ids('water', contextOf(['kidney', 'fluidCaution']))).toContain('card-water-limit');
  });

  it('shows a vegetarian no meat or fish meals', () => {
    const veg = contextOf(['vegetarian'], { pattern: 'vegetarian', avoid: [] });
    expect(meals('chicken', veg)).toEqual([]);
    expect(meals('curry', veg)).not.toContain('l-fish-curry-rice');
  });

  it('does not match a vegan’s dal meal by the dahi they would not eat', () => {
    const vegan = contextOf(['vegan'], { pattern: 'vegan', avoid: [] });
    expect(meals('dahi', vegan)).not.toContain('l-roti-dal-sabzi');
    expect(meals('dal', vegan)).toContain('l-roti-dal-sabzi');
  });

  it('leaves out meals with a food the person asked to avoid', () => {
    const noPeanuts = contextOf([], { pattern: 'vegetarian', avoid: ['peanuts'] });
    expect(meals('poha', noPeanuts)).toEqual([]);
  });
});

describe('text helpers', () => {
  it('normalises punctuation, accents and apostrophes', () => {
    expect(normalise('Can’t  SLEEP, idlí!')).toBe('cant sleep idli');
  });

  it('folds plurals without mangling short words', () => {
    expect(stem('rotis')).toBe('roti');
    expect(stem('glasses')).toBe('glass');
    expect(stem('berries')).toBe('berry');
    expect(stem('dal')).toBe('dal');
    expect(stem('bus')).toBe('bus');
    expect(stem('glass')).toBe('glass');
  });

  it('drops filler words', () => {
    expect(tokens('How much water should I drink?')).toEqual(['water', 'drink']);
  });
});

describe('ranking', () => {
  it('puts a whole-word match above a word that only starts with it', () => {
    const cards = search('dal', contextOf()).filter(r => r.kind === 'card').map(r => r.id);
    expect(cards[0]).toBe('card-dal');
    // "dalchini" (cinnamon) starts with "dal"; it may match, but it must not lead.
    expect(cards.indexOf('card-supplements')).toBeGreaterThan(cards.indexOf('card-plate'));
  });
});
