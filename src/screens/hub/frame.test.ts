import { describe, expect, it } from 'vitest';
import { categoryById } from '@/categories';
import { HUB_BACK, HUB_WASH, hubCategory, morphNamed, skeletonTitle, stripLayout, trendHref, washOf } from './frame';

describe('the hub frame (journey §8.1, §8.4; M3)', () => {
  it('goes Home with nothing below it to pop to (journey §19.1)', () => {
    expect(HUB_BACK).toEqual({ to: '/home', label: 'Home' });
  });

  it('names the wash for the morph only from a Home tile, and never beside a stop or a hold (motion rule 2)', () => {
    const base = { transitioning: true, fromHome: true, urgent: false, held: false };
    expect(morphNamed(base)).toBe(true);
    expect(morphNamed({ ...base, transitioning: false })).toBe(false);
    expect(morphNamed({ ...base, fromHome: false })).toBe(false);
    expect(morphNamed({ ...base, urgent: true })).toBe(false);
    expect(morphNamed({ ...base, held: true })).toBe(false);
  });

  it('knows a hub’s category from its address, sub-pages included', () => {
    expect(hubCategory('/hub/glucose')?.id).toBe('glucose');
    expect(hubCategory('/hub/workout/plan')?.id).toBe('workout');
    expect(hubCategory('/hub/nope')).toBeUndefined();
    expect(hubCategory('/home')).toBeUndefined();
  });

  it('calls a loading hub by its category, and anything else "Loading"', () => {
    expect(skeletonTitle('/hub/bp')).toBe('Blood pressure');
    expect(skeletonTitle('/hub/nope')).toBe('Loading');
  });

  it('links each category to its own trend, with the query that names which; Learn has none (B-14)', () => {
    expect(trendHref(categoryById('glucose'))).toBe('/trends/glucose');
    expect(trendHref(categoryById('labs'), '?metric=b12')).toBe('/trends/labs?metric=b12');
    expect(trendHref(categoryById('learn'))).toBeUndefined();
  });

  it('draws a day strip as rows wherever Home’s tiles are one column (K-42)', () => {
    expect(stripLayout(1)).toBe('list');
    expect(stripLayout(2)).toBe('strip');
    expect(stripLayout(4)).toBe('strip');
  });

  it('names a category only for an address that starts at a hub', () => {
    expect(hubCategory('/track/hub/glucose')).toBeUndefined();
  });

  it('washes a hub in its own colour, loading or loaded: solid, fading into the page (§8.1, §20.1)', () => {
    expect(washOf(categoryById('glucose'))).toBe(`linear-gradient(to bottom, color-mix(in oklab, var(--cat-glucose) ${HUB_WASH}%, var(--grouped-bg)), var(--grouped-bg))`);
  });
});
