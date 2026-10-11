import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FOOD_COPY } from '@/food/copy';
import { foodById } from '@/food/data';
import type { NumbersView } from '@/food/level';
import { PortionPage, Stepper } from './parts';

const roti = foodById('roti')!;
const text = (numbers: NumbersView) => renderToStaticMarkup(createElement(PortionPage, {
  food: roti, numbers, allergies: { known: [], custom: [] },
  look: { food: foodById, custom: () => undefined }, onBack() {}, onSave() {},
})).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('a food’s portion page', () => {
  it('says carb figures are rough wherever it shows carbs as a range (K-22)', () => {
    const ranged = text({ show: true, ranges: true });
    expect(ranged).toMatch(/about \d+–\d+ g carbs/);
    expect(ranged).toContain(FOOD_COPY.roughCarbs);
  });
  it('says nothing of the sort with plain estimates, or counts-free, which shows no figure (B-11)', () => {
    expect(text({ show: true, ranges: false })).not.toContain(FOOD_COPY.roughCarbs);
    const free = text({ show: false });
    expect(free).not.toContain(FOOD_COPY.roughCarbs);
    expect(free).not.toMatch(/kcal|g carbs|Estimated/);
  });
});

describe('the stepper, for a shaky hand and large text (H7-16, K7-08; board D141)', () => {
  const html = (removes: boolean) => renderToStaticMarkup(createElement(Stepper, {
    label: 'Toor dal', text: '1½ katoris (≈ 225 g)', removes, moreDisabled: false, onLess() {}, onMore() {},
  }));
  const buttons = (markup: string) => [...markup.matchAll(/<button[^>]*class="([^"]*)"[^>]*>(.*?)<\/button>/g)].map(m => ({ cls: m[1], text: m[2].replace(/<[^>]+>/g, '') }));
  it('gives Less and More 48 px targets, 12 px apart, with their words visible', () => {
    const [less, more] = buttons(html(false));
    for (const b of [less, more]) expect(b.cls.split(' ')).toEqual(expect.arrayContaining(['min-h-12', 'min-w-12']));
    expect(less.text).toBe('−Less');
    expect(more.text).toBe('+More');
    expect(html(false)).toMatch(/class="[^"]*\bgap-3\b/);
    expect(buttons(html(true))[0].text).toBe('Remove');
  });
  it('stacks in a narrow container, the quantity on its own line above the buttons', () => {
    const markup = html(false);
    expect(markup).toMatch(/class="[^"]*@container/);
    expect(markup).toMatch(/class="[^"]*@max-\[22rem\]:grid-cols-2/);
    expect(markup).toMatch(/class="[^"]*@max-\[13rem\]:grid-cols-1/);
    expect(markup).toMatch(/<span class="[^"]*@max-\[22rem\]:col-span-full[^"]*@max-\[22rem\]:order-1/);
  });
});
