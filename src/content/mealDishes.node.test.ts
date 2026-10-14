import { describe, expect, it } from 'vitest';
import { INGREDIENTS } from '../../scripts/food/ingredients';
import { RECIPES } from '../../scripts/food/recipes';
import { MEALS } from './meals';
import { componentKey, MEAL_DISHES } from './mealDishes';
import { tokens } from './text';

/** Every ingredient name a text says, longest first, so "moong sprouts" isn't also read as "moong". */
function named(text: string): string[] {
  const said = tokens(text);
  const phrases = [...new Set(INGREDIENTS.flatMap(i => i.aliases.map(a => tokens(a).join(' '))))].filter(Boolean).sort((a, b) => b.split(' ').length - a.split(' ').length);
  const taken = new Set<number>();
  const found: { at: number; phrase: string }[] = [];
  for (const phrase of phrases) {
    const words = phrase.split(' ');
    for (let at = 0; at + words.length <= said.length; at++) {
      const span = words.map((_, k) => at + k);
      if (span.some(k => taken.has(k)) || !words.every((w, k) => said[at + k] === w)) continue;
      span.forEach(k => taken.add(k));
      found.push({ at, phrase });
    }
  }
  return found.sort((a, b) => a.at - b.at).map(f => f.phrase);
}

const RECIPE_KEYS = new Map(RECIPES.map(r => [r.id, r.ingredients.map(([key]) => key)]));
/** Every name the ingredients a component's dishes and its own `also` hold go by. */
function covers(mealId: string, componentName: string): Set<string> {
  const mapped = MEAL_DISHES[componentKey(mealId, componentName)];
  const keys = new Set([...mapped.dishes.flatMap(d => RECIPE_KEYS.get(d) ?? []), ...(mapped.also ?? [])]);
  return new Set(INGREDIENTS.filter(i => keys.has(i.key)).flatMap(i => i.aliases.map(a => tokens(a).join(' '))));
}

describe('what meal ideas say they hold (B-13)', () => {
  it('covers every food a component names with one of its dishes or an ingredient of its own, so a custom allergy finds it by any name (H7-02)', () => {
    const missing: string[] = [];
    for (const m of MEALS) {
      for (const c of m.components) {
        const covered = covers(m.id, c.name);
        for (const phrase of named(c.name)) if (!covered.has(phrase)) missing.push(`${m.id} | ${c.name}: ${phrase}`);
      }
      const all = new Set(m.components.flatMap(c => [...covers(m.id, c.name)]));
      for (const phrase of named(m.name)) if (!all.has(phrase)) missing.push(`${m.id}: ${phrase}`);
    }
    expect(missing).toEqual([]);
  });
  it('reads names whole, in the order they’re said: "moong sprouts" is the sprouts, not moong dal', () => {
    expect(named('Cooked moong sprouts')).toEqual(['moong sprout']);
    expect(named('Sabzi and salad — bhindi, lauki, gobhi or palak')).toEqual(['bhindi', 'lauki', 'gobhi', 'palak']);
  });
});
