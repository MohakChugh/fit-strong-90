import { describe, expect, it } from 'vitest';
import { CATEGORIES, SHORTCUTS } from '@/categories';
import { TOPICS, contextOf } from '@/content';
import { CATEGORY_ALIASES, SHORTCUT_ALIASES, browse } from './browse';

const anyone = contextOf();
const group = (q: string, id: string, mode: 'browse' | 'pick' = 'browse') => browse(q, anyone, mode).groups.find(g => g.id === id);
const ids = (q: string, id: string, mode: 'browse' | 'pick' = 'browse') => group(q, id, mode)?.rows.map(r => r.id) ?? [];
const row = (q: string, gid: string, id: string) => group(q, gid)?.rows.find(r => r.id === id);

describe('Browse with nothing typed (journey §14)', () => {
  it('lists every category once, in its own group, in the registry’s order, then that group’s shortcuts', () => {
    const { groups, partial } = browse('', anyone);
    expect(partial).toBe(false);
    expect(groups.map(g => g.title)).toEqual(['Move', 'Eat', 'Check', 'Learn', 'Your data']);
    expect(ids('', 'move')).toEqual(['workout', 'stretch', 'walk', 'steps', 'programme', 'library']);
    expect(ids('', 'eat')).toEqual(['food', 'meal-ideas']);
    expect(ids('', 'check')).toEqual(['glucose', 'bp', 'back', 'weight', 'water', 'sleep', 'waist', 'labs', 'bmi']);
    expect(ids('', 'data')).toEqual(['today-log', 'backup']);
    const categories = groups.flatMap(g => g.rows).filter(r => r.kind === 'category').map(r => r.id);
    expect([...categories].sort()).toEqual(CATEGORIES.map(c => c.id).sort());
  });
  it('lists Learn, then the Guide’s topics in the person’s order, at their v2 places', () => {
    expect(ids('', 'learn')).toEqual(['learn', ...TOPICS.map(t => t.id)]);
    expect(row('', 'learn', TOPICS[0].id)).toMatchObject({ kind: 'topic', to: `/hub/learn/topic/${TOPICS[0].id}` });
  });
  it('keeps Water in Check only (B-14)', () => {
    expect(ids('', 'eat')).not.toContain('water');
  });
  it('has words for every category and shortcut', () => {
    for (const c of CATEGORIES) expect(CATEGORY_ALIASES[c.id].length, c.id).toBeGreaterThan(0);
    for (const s of Object.values(SHORTCUTS).flat()) expect(SHORTCUT_ALIASES[s.id]?.length, s.id).toBeGreaterThan(0);
  });
});

describe('searching (journey §14)', () => {
  it('finds a food and its Guide answer by an Indian spelling (V-J08: chapatti)', () => {
    expect(browse('chapatti', anyone).partial).toBe(false);
    expect(row('chapatti', 'eat', 'l-roti-dal-sabzi')).toMatchObject({ kind: 'meal', title: 'Roti, dal and sabzi', to: '/hub/food/ideas/l-roti-dal-sabzi' });
    expect(row('chapatti', 'learn', 'card-grains')).toMatchObject({ kind: 'card', to: '/hub/learn/card/card-grains' });
    expect(ids('roti', 'eat')).toContain('l-roti-dal-sabzi');
  });
  it('finds a category by the words people use for it', () => {
    expect(ids('sciatica', 'check')).toEqual(['back']);
    expect(ids('sciatica', 'learn')).toContain('card-keep-moving');
    expect(ids('sugar', 'check')).toEqual(['glucose']);
    expect(ids('blood sugar', 'check')).toEqual(['glucose']);
    expect(ids('BP', 'check')).toEqual(['bp']);
    expect(ids('hba1c', 'check')).toEqual(['labs']);
    expect(ids('bmi', 'check')).toEqual(['weight', 'bmi']);
    expect(ids('plan', 'move')).toEqual(['programme']);
    expect(ids('history', 'data')).toEqual(['today-log']);
    expect(ids('backup', 'data')).toEqual(['backup']);
  });
  it('reads the last word as the start of one while typing, but never a single letter', () => {
    expect(ids('gluc', 'check')).toEqual(['glucose']);
    expect(ids('g', 'check')).toEqual([]);
    // Only the last word, as the Guide's search reads it: in “gluc meter” the unfinished word is the first.
    expect(ids('gluc meter', 'check')).toEqual([]);
  });
  it('passes the person’s food choices through: a vegan’s search for dahi finds no meal with dahi', () => {
    const vegan = contextOf(['vegan'], { pattern: 'vegan', avoid: [] });
    expect(browse('dahi', vegan).groups.find(g => g.id === 'eat')?.rows.filter(r => r.kind === 'meal') ?? []).toEqual([]);
  });
});

describe('when nothing matches, or only part does', () => {
  it('returns no groups for a word nothing has', () => {
    expect(browse('xylophone', anyone)).toEqual({ groups: [], partial: false });
  });
  it('labels the results partial when nothing has every word', () => {
    const r = browse('insulin zebra', anyone);
    expect(r.partial).toBe(true);
    expect(r.groups.length).toBeGreaterThan(0);
  });
  it('a category with every word is never partial, and the Guide’s part-matches are dropped beside it', () => {
    const r = browse('sugar zebra', anyone);
    expect(r.partial).toBe(true);
    expect(browse('sugar meter', anyone).partial).toBe(false);
    expect(ids('sugar meter', 'check')).toEqual(['glucose']);
    // “shugar” is only Glucose’s word, so the Guide matches “meter” alone: those rows go, and nothing is partial.
    expect(browse('shugar meter', anyone)).toMatchObject({ partial: false, groups: [{ id: 'check', rows: [{ id: 'glucose' }] }] });
  });
});

describe('pick mode (Edit Home’s “+ Add”)', () => {
  it('lists the categories only: a shortcut or a topic can never be a tile (B-14)', () => {
    const { groups } = browse('', anyone, 'pick');
    expect(groups.map(g => g.id)).toEqual(['move', 'eat', 'check', 'learn']);
    expect(groups.flatMap(g => g.rows).every(r => r.kind === 'category')).toBe(true);
    expect(groups.flatMap(g => g.rows)).toHaveLength(CATEGORIES.length);
  });
  it('searches the categories alone', () => {
    expect(browse('sugar', anyone, 'pick').groups.map(g => [g.id, g.rows.map(r => r.id)])).toEqual([['check', ['glucose']]]);
    expect(browse('chapatti', anyone, 'pick').groups).toEqual([]);
  });
});

describe('whatever is typed (Review Focus 2)', () => {
  it('reads punctuation, spaces and case as the Guide’s search does, and never throws', () => {
    expect(browse('???', anyone)).toEqual(browse('', anyone));
    expect(browse('  ChapaTTi  ', anyone)).toEqual(browse('chapatti', anyone));
    expect(() => browse('x'.repeat(500), anyone)).not.toThrow();
    const roti = browse('रोटी', anyone);
    expect(roti.groups.find(g => g.id === 'eat')?.rows.some(r => r.kind === 'meal')).toBe(true);
    for (const g of roti.groups) for (const r of g.rows) if (r.kind !== 'category') expect(r.to).toMatch(/^\//);
  });
});
