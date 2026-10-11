import { describe, expect, it } from 'vitest';
import { FOOD_COPY } from './copy';
import { totalsOf } from './estimate';
import { careTeamLine, foodTileLine, itemEstimate, totalsLines } from './format';
import type { FoodItem } from './types';

/** Words that judge, count down to a limit, or offer making up for food (journey §11.4–11.5, A-50). */
const FORBIDDEN = /\b(net|earn(ed|s)?|burn(ed|t|s)?|allowance|over|remaining|left today|exceed(ed|s)?|skip|fast(ing)?|cheat|guilt|junk|bad|compensate|make up|work (it )?off)\b/i;
const sample = (v: unknown): string => (typeof v === 'function' ? String((v as (s: string) => string)('Lunch')) : String(v));

describe('food words', () => {
  it('never judge, never count down, never offer making up for food', () => {
    for (const [key, value] of Object.entries(FOOD_COPY)) expect(sample(value), key).not.toMatch(FORBIDDEN);
    const roti: FoodItem = { kind: 'food', foodId: 'roti', rev: 1, name: 'Roti', unit: 'piece', count: 2, gramsPerPortion: 40, kcal: 204, carbsG: 43.2 };
    const shown = { show: true, ranges: true } as const;
    const lines = totalsLines(totalsOf([roti]), shown);
    for (const text of [itemEstimate(roti, shown), lines.estimate, careTeamLine({ kcal: 1600, setOn: '2026-10-01' }, shown), foodTileLine('estimates', 2).text]) {
      expect(text).not.toMatch(FORBIDDEN);
    }
  });
});
