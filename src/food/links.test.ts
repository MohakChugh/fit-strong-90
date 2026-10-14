import { describe, expect, it } from 'vitest';
import { logHref, logRequest } from './links';

describe('addresses into Food (journey §11.3)', () => {
  it('open the sheet for what was asked', () => {
    expect(logHref()).toBe('/hub/food/log');
    expect(logHref({ meal: 'lunch' })).toBe('/hub/food/log?meal=lunch');
    expect(logHref({ edit: 'meal-1', day: '2026-10-07' })).toBe('/hub/food/log?edit=meal-1&day=2026-10-07');
    expect(logHref({ usual: 'saved:usual-1', quick: true })).toBe('/hub/food/log?usual=saved%3Ausual-1&quick=1');
  });
  it('read back what they asked, and nothing they can’t read', () => {
    expect(logRequest('?meal=lunch&day=2026-10-07&quick=1')).toEqual({ meal: 'lunch', day: '2026-10-07', quick: true });
    expect(logRequest(logHref({ usual: 'saved:usual-1', food: 'roti', edit: 'meal-1' }).split('?')[1])).toEqual({ usual: 'saved:usual-1', food: 'roti', edit: 'meal-1' });
    expect(logRequest('?meal=brunch&day=2026-02-30&edit=&quick=yes')).toEqual({});
  });
});

describe('addresses into Food: the other rules (mutation-checked)', () => {
  it('reads no field longer than 200 characters', () => {
    expect(logRequest(`?edit=${'m'.repeat(201)}&usual=${'u'.repeat(201)}&food=${'f'.repeat(201)}`)).toEqual({});
    expect(logRequest(`?food=${'f'.repeat(200)}`)).toEqual({ food: 'f'.repeat(200) });
  });
});
