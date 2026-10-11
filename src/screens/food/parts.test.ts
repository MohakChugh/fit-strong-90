import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FOOD_COPY } from '@/food/copy';
import { foodById } from '@/food/data';
import type { NumbersView } from '@/food/level';
import { PortionPage } from './parts';

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
